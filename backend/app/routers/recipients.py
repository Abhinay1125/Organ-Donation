from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database import get_db
from backend.app.models import Recipient, User, AuditLog, Hospital
from backend.app.schemas import RecipientCreate, RecipientResponse
from backend.app.auth import get_current_user, require_roles, require_hospital_assignment, ensure_operational_role
from backend.app.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/recipients", tags=["Recipients"])

@router.get("", response_model=List[RecipientResponse])
def get_recipients(
    organ_type: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):
    query = db.query(Recipient)
    if current_user.role == "HOSPITAL":
        query = query.filter(Recipient.hospital_id == current_user.hospital_id)
    if organ_type:
        query = query.filter(Recipient.required_organ.ilike(f"%{organ_type}%"))
    if status_filter:
        query = query.filter(Recipient.status == status_filter)
    return query.order_by(Recipient.id.desc()).all()

@router.get("/{recipient_id}", response_model=RecipientResponse)
def get_recipient_by_id(
    recipient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))
):
    recipient = db.query(Recipient).filter(Recipient.id == recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    require_hospital_assignment(current_user, recipient.hospital_id)
    return recipient

@router.post("", response_model=RecipientResponse)
def register_recipient(
    recipient_in: RecipientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["HOSPITAL", "ADMIN"]))
):
    require_hospital_assignment(current_user, recipient_in.hospital_id)
    existing = db.query(Recipient).filter(Recipient.recipient_id == recipient_in.recipient_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recipient identifier is already registered")

    hosp = db.query(Hospital).filter(Hospital.id == recipient_in.hospital_id).first()
    if not hosp:
        raise HTTPException(status_code=422, detail="Hospital does not exist")
    ensure_operational_role(current_user, ["PATIENT_DOCTOR"])
    hosp_code = hosp.code

    # Call Blockchain AddingNewPatient
    tx_hash = blockchain_service.record_patient_registration(
        patient_id=recipient_in.recipient_id,
        name=recipient_in.name,
        blood_group=recipient_in.blood_group,
        organ_type=recipient_in.required_organ,
        age=recipient_in.age,
        bmi=recipient_in.bmi,
        hospital_id=hosp_code
    )

    recipient = Recipient(
        recipient_id=recipient_in.recipient_id,
        name=recipient_in.name,
        age=recipient_in.age,
        gender=recipient_in.gender,
        blood_group=recipient_in.blood_group,
        required_organ=recipient_in.required_organ,
        height_cm=recipient_in.height_cm,
        weight_kg=recipient_in.weight_kg,
        bmi=recipient_in.bmi,
        hospital_id=recipient_in.hospital_id,
        status="WAITING",
        cpra=recipient_in.cpra or 0.0,
        dialysis_months=recipient_in.dialysis_months or 12.0,
        urgency_tier=recipient_in.urgency_tier or "STANDARD",
        blockchain_tx=tx_hash
    )
    db.add(recipient)
    db.commit()
    db.refresh(recipient)

    log = AuditLog(
        action="PATIENT_WAITING_LIST_REGISTERED",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="RECIPIENT",
        resource_id=recipient.recipient_id,
        details=f"Added patient {recipient.name} ({recipient.blood_group}) to {recipient.required_organ} waiting list",
        blockchain_tx=tx_hash
    )
    db.add(log)
    db.commit()

    return recipient
