import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import Organ, Donor, Recipient, MatchRun, User, AuditLog, Hospital
from backend.app.schemas import MatchReviewRequest, DirectMLPredictRequest
from backend.app.auth import get_current_user, require_roles, require_hospital_assignment, ensure_operational_role, ensure_not_record_registrar
from ml.model import ml_service
from backend.app.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/matching", tags=["Matching & AI Decision Support"])

@router.get("/candidates/{organ_id}")
def evaluate_matching_candidates(
    organ_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):
    """
    Ranks potential recipients for an available organ using:
    Layer 1: Rule-Based Screening Baseline
    Layer 2: Random Forest Compatibility Model
    """
    organ = db.query(Organ).filter(Organ.id == organ_id).first()
    if not organ:
        raise HTTPException(status_code=404, detail="Organ not found")
    require_hospital_assignment(current_user, organ.source_hospital_id)
    ensure_operational_role(current_user, ["ORGAN_MATCHING_ORGANIZER"])
    if organ.status != "MEDICALLY_APPROVED":
        raise HTTPException(status_code=409, detail="Matching is available only for medically approved organs")

    donor = db.query(Donor).filter(Donor.id == organ.donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Associated donor record missing")

    # Fetch waiting recipients matching the required organ
    candidates = db.query(Recipient).filter(
        Recipient.required_organ.ilike(f"%{organ.organ_type}%"),
        Recipient.status == "WAITING"
    ).all()

    donor_dict = {
        "donor_id": donor.donor_id,
        "name": donor.name,
        "age": donor.age,
        "blood_group": donor.blood_group,
        "organ_type": donor.organ_type,
        "bmi": donor.bmi
    }

    cand_list = []
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    for c in candidates:
        waiting_days = (now - c.waiting_since).days
        hosp = db.query(Hospital).filter(Hospital.id == c.hospital_id).first()
        cand_list.append({
            "id": c.id,
            "recipient_id": c.recipient_id,
            "name": c.name,
            "age": c.age,
            "gender": c.gender,
            "blood_group": c.blood_group,
            "organ_type": c.required_organ,
            "bmi": c.bmi,
            "cpra": c.cpra,
            "dialysis": c.dialysis_months,
            "waiting_days": waiting_days,
            "hospital_name": hosp.name if hosp else "Unknown Hospital"
        })

    # Execute ML Candidate Ranking
    ranked_candidates = ml_service.rank_candidates(donor_dict, cand_list)
    candidate_ids = {candidate["recipient_id"]: candidate["id"] for candidate in cand_list}
    donor_public = {key: value for key, value in donor_dict.items() if key != "name"}
    for candidate in ranked_candidates:
        candidate["id"] = candidate_ids[candidate["recipient_id"]]
        candidate.pop("recipient_name", None)

    return {
        "organ": {
            "id": organ.id,
            "organ_id": organ.organ_id,
            "organ_type": organ.organ_type,
            "status": organ.status
        },
        "donor": donor_public,
        "total_candidates_evaluated": len(cand_list),
        "model_version": ml_service.model_version,
        "ranked_candidates": ranked_candidates,
        "disclaimer": "RESEARCH PROTOTYPE: AI model provides decision support only. Final decision remains under authorized human clinical review."
    }

@router.post("/review/{organ_id}")
def submit_authorized_match_review(
    organ_id: int,
    review_in: MatchReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    """
    Authorized human review of AI-generated recommendation:
    - Verifies human confirmation
    - Updates application state
    - Emits on-chain transaction to MatchingProcess in OrganDonation contract
    """
    organ = db.query(Organ).filter(Organ.id == organ_id).first()
    if not organ:
        raise HTTPException(status_code=404, detail="Organ not found")
    require_hospital_assignment(current_user, organ.source_hospital_id)
    if organ.status != "MEDICALLY_APPROVED":
        raise HTTPException(status_code=409, detail="Organ is not available for matching review")

    donor = db.query(Donor).filter(Donor.id == organ.donor_id).first()
    recipient = db.query(Recipient).filter(Recipient.id == review_in.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Selected recipient not found")
    if review_in.decision == "APPROVED":
        ensure_not_record_registrar(db, current_user, "PATIENT_WAITING_LIST_REGISTERED", "RECIPIENT", recipient.recipient_id)
    ensure_operational_role(current_user, ["ORGAN_MATCHING_ORGANIZER"])
    if recipient.status != "WAITING" or organ.organ_type.casefold() not in recipient.required_organ.casefold():
        raise HTTPException(status_code=409, detail="Recipient is not eligible for this organ")

    if review_in.decision == "APPROVED":
        # Run ML calculation for definitive audit storage
        donor_dict = {"age": donor.age, "blood_group": donor.blood_group, "organ_type": donor.organ_type, "bmi": donor.bmi}
        rec_dict = {"age": recipient.age, "blood_group": recipient.blood_group, "organ_type": recipient.required_organ, "bmi": recipient.bmi, "dialysis": recipient.dialysis_months, "cPRA": recipient.cpra}
        analysis = ml_service.predict_pair(donor_dict, rec_dict)

        match_code = f"MATCH-{uuid.uuid4().hex[:8].upper()}"

        # Submit to Blockchain
        tx_hash = blockchain_service.record_matching_decision(
            match_id=match_code,
            donor_id=donor.donor_id,
            patient_id=recipient.recipient_id,
            organ_type=organ.organ_type,
            score=analysis["compatibility_score"],
            model_version=ml_service.model_version,
            remarks=review_in.notes
        )

        # Update Organ and Recipient
        organ.status = "MATCHED"
        organ.matched_recipient_id = recipient.id
        organ.matched_score = analysis["compatibility_score"]
        organ.destination_hospital_id = recipient.hospital_id
        organ.blockchain_tx = tx_hash

        recipient.status = "MATCHED"

        # Record MatchRun in DB
        match_run = MatchRun(
            match_id=match_code,
            organ_id=organ.id,
            donor_id=donor.id,
            recipient_id=recipient.id,
            model_version=ml_service.model_version,
            rule_score=analysis["rule_screening"]["rule_score"],
            ml_score=analysis["compatibility_score"],
            recommendation=analysis["recommendation"],
            details=analysis,
            reviewer_id=current_user.id,
            reviewer_decision="APPROVED",
            reviewer_notes=review_in.notes,
            blockchain_tx=tx_hash
        )
        db.add(match_run)

        # Application Audit Log
        log = AuditLog(
            action="MATCH_CONFIRMED_BY_REVIEWER",
            actor_username=current_user.username,
            actor_role=current_user.operational_role or current_user.role,
            resource_type="MATCH",
            resource_id=match_code,
            details=f"Authorized match between {donor.donor_id} and {recipient.recipient_id}. Notes: {review_in.notes}",
            blockchain_tx=tx_hash
        )
        db.add(log)
        db.commit()
        db.refresh(organ)

        return {
            "status": "APPROVED",
            "match_id": match_code,
            "organ_id": organ.organ_id,
            "recipient_id": recipient.recipient_id,
            "score": analysis["compatibility_score"],
            "blockchain_tx": tx_hash,
            "message": "Authorized human review completed and recorded to blockchain ledger."
        }
    else:
        # Match rejected by reviewer
        log = AuditLog(
            action="MATCH_REJECTED_BY_REVIEWER",
            actor_username=current_user.username,
            actor_role=current_user.operational_role or current_user.role,
            resource_type="ORGAN",
            resource_id=organ.organ_id,
            details=f"Reviewer rejected recommendation for {recipient.recipient_id}. Reason: {review_in.notes}"
        )
        db.add(log)
        db.commit()

        return {
            "status": "REJECTED",
            "message": "Recommendation rejected by authorized reviewer. No workflow change enacted."
        }

@router.post("/direct-predict")
def direct_prediction_sandbox(
    req: DirectMLPredictRequest,
    current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):
    """Interactive sandbox for ad-hoc compatibility prediction and explainability."""
    ensure_operational_role(current_user, ["ORGAN_MATCHING_ORGANIZER"])
    donor = {
        "age": req.donor_age,
        "blood_group": req.donor_bg,
        "bmi": req.donor_bmi or 24.0,
        "organ_type": req.organ_type or "Kidney"
    }
    recipient = {
        "age": req.recipient_age,
        "blood_group": req.recipient_bg,
        "bmi": req.recipient_bmi or 24.0,
        "organ_type": req.organ_type or "Kidney",
        "dialysis": req.dialysis_months or 24.0,
        "cPRA": req.cPRA or 0.0
    }
    return ml_service.predict_pair(donor, recipient)
