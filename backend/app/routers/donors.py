from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database import get_db
from backend.app.models import Donor, Organ, User, AuditLog, Hospital
from backend.app.schemas import DonorCreate, DonorResponse, DonorApproval
from backend.app.auth import get_current_user, require_roles, require_hospital_assignment, ensure_operational_role, ensure_not_record_registrar
from backend.app.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/donors", tags=["Donors"])

@router.get("", response_model=List[DonorResponse])
def get_donors(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    query = db.query(Donor)
    if current_user.role == "HOSPITAL":
        query = query.filter(Donor.hospital_id == current_user.hospital_id)
    return query.order_by(Donor.id.desc()).all()

@router.get("/{donor_id}", response_model=DonorResponse)
def get_donor_by_id(donor_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    require_hospital_assignment(current_user, donor.hospital_id)
    return donor

@router.post("", response_model=DonorResponse)
def register_donor(
    donor_in: DonorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    require_hospital_assignment(current_user, donor_in.hospital_id)
    if not db.query(Hospital).filter(Hospital.id == donor_in.hospital_id).first():
        raise HTTPException(status_code=422, detail="Hospital does not exist")
    ensure_operational_role(current_user, ["PROCUREMENT_ORGANIZER"])
    existing = db.query(Donor).filter(Donor.donor_id == donor_in.donor_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Donor identifier is already registered")

    donor = Donor(
        donor_id=donor_in.donor_id,
        name=donor_in.name,
        age=donor_in.age,
        gender=donor_in.gender,
        blood_group=donor_in.blood_group,
        organ_type=donor_in.organ_type,
        height_cm=donor_in.height_cm,
        weight_kg=donor_in.weight_kg,
        bmi=donor_in.bmi,
        hospital_id=donor_in.hospital_id,
        medical_notes=donor_in.medical_notes,
        status="PENDING_APPROVAL",
        is_medically_approved=False
    )
    db.add(donor)
    db.commit()
    db.refresh(donor)

    # Application Audit Log
    log = AuditLog(
        action="DONOR_REGISTERED_PENDING",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="DONOR",
        resource_id=donor.donor_id,
        details=f"Registered prospective donor {donor.name} ({donor.blood_group}) for {donor.organ_type}"
    )
    db.add(log)
    db.commit()

    return donor

@router.post("/{id}/approve", response_model=DonorResponse)
def evaluate_donor_medical_approval(
    id: int,
    approval: DonorApproval,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    donor = db.query(Donor).filter(Donor.id == id).first()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    require_hospital_assignment(current_user, donor.hospital_id)
    ensure_operational_role(current_user, ["PATIENT_DOCTOR"])
    ensure_not_record_registrar(db, current_user, "DONOR_REGISTERED_PENDING", "DONOR", donor.donor_id)

    hosp = db.query(Hospital).filter(Hospital.id == donor.hospital_id).first()
    hosp_code = hosp.code if hosp else "HOSP-01"

    donor.is_medically_approved = approval.is_approved
    donor.medical_notes = approval.medical_notes
    donor.status = "APPROVED" if approval.is_approved else "REJECTED"

    # Call Blockchain TestApproval
    approval_tx = blockchain_service.record_donor_approval(
        donor.donor_id,
        approval.is_approved,
        approval.medical_notes
    )

    if approval.is_approved:
        # Also record on-chain donor registration
        reg_tx = blockchain_service.record_donor_registration(
            donor.donor_id,
            donor.name,
            donor.blood_group,
            donor.organ_type,
            donor.age,
            donor.bmi,
            hosp_code
        )
        donor.blockchain_tx = reg_tx

        # Auto-create Organ record ready for matching
        organ_code = f"ORG-{donor.donor_id.replace('DON-', '')}"
        existing_org = db.query(Organ).filter(Organ.organ_id == organ_code).first()
        if not existing_org:
            new_organ = Organ(
                organ_id=organ_code,
                donor_id=donor.id,
                organ_type=donor.organ_type,
                source_hospital_id=donor.hospital_id,
                status="MEDICALLY_APPROVED",
                blockchain_tx=reg_tx
            )
            db.add(new_organ)
    else:
        donor.blockchain_tx = approval_tx

    log = AuditLog(
        action="DONOR_MEDICAL_APPROVAL" if approval.is_approved else "DONOR_MEDICAL_REJECTION",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="DONOR",
        resource_id=donor.donor_id,
        details=f"Doctor {current_user.username} decision: {'Approved' if approval.is_approved else 'Rejected'}. Notes: {approval.medical_notes}",
        blockchain_tx=donor.blockchain_tx
    )
    db.add(log)
    db.commit()
    db.refresh(donor)

    return donor
