from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import Organ, OrganMovement, Donor, Recipient, Hospital, User, AuditLog
from backend.app.schemas import OrganResponse, OrganMovementResponse, OrganMovementCreate
from backend.app.auth import get_current_user, require_roles, require_hospital_assignment, ensure_operational_role
from backend.app.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/organs", tags=["Organs & Movements"])

def _attach_refs(db: Session, organs):
    donor_ids = {organ.donor_id for organ in organs if organ.donor_id}
    recipient_ids = {organ.matched_recipient_id for organ in organs if organ.matched_recipient_id}
    donor_refs = {
        row.id: row.donor_id
        for row in db.query(Donor.id, Donor.donor_id).filter(Donor.id.in_(donor_ids)).all()
    } if donor_ids else {}
    recipient_refs = {
        row.id: row.recipient_id
        for row in db.query(Recipient.id, Recipient.recipient_id).filter(Recipient.id.in_(recipient_ids)).all()
    } if recipient_ids else {}

    for organ in organs:
        organ.donor_ref = donor_refs.get(organ.donor_id)
        organ.matched_recipient_ref = recipient_refs.get(organ.matched_recipient_id)
    return organs


VALID_TRANSITIONS = {
    "MEDICALLY_APPROVED": [],
    "MATCHED": ["READY_FOR_RETRIEVAL", "RETRIEVED"],
    "READY_FOR_RETRIEVAL": ["RETRIEVED"],
    "RETRIEVED": ["PACKAGED"],
    "PACKAGED": ["DISPATCHED"],
    "DISPATCHED": ["DELIVERED"],
    "IN_TRANSIT": ["DELIVERED"],
    "DELIVERED": ["RECEIVED"],
    "RECEIVED": ["TRANSPLANTED"],
    "TRANSPLANTED": []
}

STAGE_OPERATIONAL_ROLES = {
    "READY_FOR_RETRIEVAL": ["DONOR_SURGEON"],
    "RETRIEVED": ["DONOR_SURGEON"],
    "PACKAGED": ["DONOR_SURGEON"],
    "DISPATCHED": ["TRANSPORTER"],
    "DELIVERED": ["TRANSPORTER"],
    "RECEIVED": ["TRANSPLANT_SURGEON"],
    "TRANSPLANTED": ["TRANSPLANT_SURGEON"],
}

@router.get("", response_model=List[OrganResponse])
def get_all_organs(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    query = db.query(Organ)
    if current_user.role == "HOSPITAL":
        query = query.filter((Organ.source_hospital_id == current_user.hospital_id) | (Organ.destination_hospital_id == current_user.hospital_id))
    return _attach_refs(db, query.order_by(Organ.id.desc()).all())

@router.get("/{id}")
def get_organ_detail(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    organ = db.query(Organ).filter(Organ.id == id).first()
    if not organ:
        raise HTTPException(status_code=404, detail="Organ not found")

    if current_user.role == "HOSPITAL" and current_user.hospital_id not in {organ.source_hospital_id, organ.destination_hospital_id}:
        raise HTTPException(status_code=404, detail="Organ not found")

    donor = db.query(Donor).filter(Donor.id == organ.donor_id).first()
    recipient = db.query(Recipient).filter(Recipient.id == organ.matched_recipient_id).first() if organ.matched_recipient_id else None
    src_hosp = db.query(Hospital).filter(Hospital.id == organ.source_hospital_id).first()
    dst_hosp = db.query(Hospital).filter(Hospital.id == organ.destination_hospital_id).first() if organ.destination_hospital_id else None
    movements = db.query(OrganMovement).filter(OrganMovement.organ_id == organ.id).order_by(OrganMovement.id.asc()).all()

    return {
        "organ": organ,
        "donor": donor,
        "matched_recipient": recipient,
        "source_hospital": src_hosp,
        "destination_hospital": dst_hosp,
        "movements": movements
    }

@router.post("/{id}/transition")
def transition_organ_lifecycle(
    id: int,
    movement_in: OrganMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    organ = db.query(Organ).filter(Organ.id == id).first()
    if not organ:
        raise HTTPException(status_code=404, detail="Organ not found")
    if current_user.role == "HOSPITAL" and current_user.hospital_id not in {organ.source_hospital_id, organ.destination_hospital_id}:
        raise HTTPException(status_code=404, detail="Organ not found")

    target_stage = movement_in.stage.upper()
    allowed_stages = VALID_TRANSITIONS.get(organ.status, [])

    if target_stage not in allowed_stages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid state transition: Cannot move from {organ.status} to {target_stage}. Allowed: {allowed_stages}"
        )

    ensure_operational_role(current_user, STAGE_OPERATIONAL_ROLES[target_stage])

    # Check scope and referenced hospitals before any state changes or ledger calls.
    if current_user.role == "HOSPITAL":
        required_hospital = organ.destination_hospital_id if target_stage in {"RECEIVED", "TRANSPLANTED"} else organ.source_hospital_id
        require_hospital_assignment(current_user, required_hospital)
    if movement_in.destination_hospital_id is not None:
        destination = db.query(Hospital).filter(Hospital.id == movement_in.destination_hospital_id).first()
        if destination is None:
            raise HTTPException(status_code=422, detail="Destination hospital does not exist")
        if current_user.role == "HOSPITAL" and current_user.hospital_id != organ.source_hospital_id:
            raise HTTPException(status_code=404, detail="Organ not found")
        if organ.matched_recipient_id is not None:
            matched_recipient = db.query(Recipient).filter(Recipient.id == organ.matched_recipient_id).first()
            if matched_recipient is None or destination.id != matched_recipient.hospital_id:
                raise HTTPException(status_code=409, detail="Destination must match the selected recipient's hospital")

    if target_stage == "TRANSPLANTED":
        recipient = db.query(Recipient).filter(Recipient.id == organ.matched_recipient_id).first() if organ.matched_recipient_id else None
        if recipient is None or organ.destination_hospital_id != recipient.hospital_id:
            raise HTTPException(status_code=409, detail="Organ destination does not match its selected recipient")

    donor = db.query(Donor).filter(Donor.id == organ.donor_id).first()
    src_hosp = db.query(Hospital).filter(Hospital.id == organ.source_hospital_id).first()
    dst_hosp_name = "Destination Hospital"
    if movement_in.destination_hospital_id:
        organ.destination_hospital_id = movement_in.destination_hospital_id
        dst_h = db.query(Hospital).filter(Hospital.id == movement_in.destination_hospital_id).first()
        if dst_h:
            dst_hosp_name = dst_h.name

    tx_hash = None

    # Submit to Blockchain based on specific stage
    if target_stage == "RETRIEVED":
        tx_hash = blockchain_service.record_organ_removal(
            organ.organ_id,
            donor.donor_id if donor else "DON-UNKNOWN",
            organ.organ_type,
            src_hosp.name if src_hosp else "Donor Hospital"
        )
        if donor:
            donor.status = "DONATED"
    elif target_stage == "PACKAGED":
        tx_hash = blockchain_service.record_organ_packaging(
            organ.organ_id,
            src_hosp.name if src_hosp else "Donor Hospital"
        )
    elif target_stage == "DISPATCHED":
        tx_hash = blockchain_service.record_delivery_start(
            organ.organ_id,
            f"Courier Log - {current_user.full_name}",
            src_hosp.name if src_hosp else "Origin Hospital",
            dst_hosp_name
        )
    elif target_stage == "DELIVERED":
        tx_hash = blockchain_service.record_delivery_end(
            organ.organ_id,
            movement_in.notes or "Delivered in cold preservation condition"
        )
    elif target_stage == "RECEIVED":
        tx_hash = blockchain_service.record_organ_receipt(
            organ.organ_id,
            dst_hosp_name,
            current_user.full_name
        )
    elif target_stage == "TRANSPLANTED":
        rec_id = "REC-UNKNOWN"
        if organ.matched_recipient_id:
            rec = db.query(Recipient).filter(Recipient.id == organ.matched_recipient_id).first()
            if rec:
                rec_id = rec.recipient_id
                rec.status = "TRANSPLANTED"
        tx_hash = blockchain_service.record_transplantation(
            organ.organ_id,
            rec_id,
            movement_in.notes or "Transplantation surgery completed successfully"
        )

    # Update Organ State
    organ.status = target_stage
    if tx_hash:
        organ.blockchain_tx = tx_hash

    # Add Movement Record
    movement = OrganMovement(
        organ_id=organ.id,
        stage=target_stage,
        location=movement_in.location,
        actor_name=current_user.full_name,
        actor_role=current_user.operational_role or current_user.role,
        notes=movement_in.notes,
        blockchain_tx=tx_hash
    )
    db.add(movement)

    # Application Audit Log
    log = AuditLog(
        action=f"ORGAN_LIFECYCLE_{target_stage}",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="ORGAN",
        resource_id=organ.organ_id,
        details=f"Organ {organ.organ_id} transitioned to {target_stage} at {movement_in.location}. Notes: {movement_in.notes}",
        blockchain_tx=tx_hash
    )
    db.add(log)
    db.commit()
    db.refresh(organ)

    return {
        "status": "success",
        "organ_id": organ.organ_id,
        "new_state": organ.status,
        "blockchain_tx": tx_hash,
        "movement": movement
    }
