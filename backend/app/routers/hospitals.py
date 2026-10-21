from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database import get_db
from backend.app.models import Hospital, User, AuditLog
from backend.app.schemas import HospitalCreate, HospitalDirectoryResponse, HospitalResponse
from backend.app.auth import get_current_user, require_roles

router = APIRouter(prefix="/api/hospitals", tags=["Hospitals"])

@router.get("", response_model=List[HospitalDirectoryResponse])
def get_hospitals(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    hospitals = db.query(Hospital).all()
    if current_user.role == "ADMIN":
        return hospitals

    # Donor and recipient registration only needs these fields for its selector.
    return [{"id": hospital.id, "name": hospital.name, "city": hospital.city} for hospital in hospitals]

@router.post("", response_model=HospitalResponse)
def create_hospital(
    hospital_in: HospitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    existing = db.query(Hospital).filter(Hospital.code == hospital_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Hospital with code {hospital_in.code} already exists")

    hosp = Hospital(**hospital_in.dict())
    db.add(hosp)
    db.commit()
    db.refresh(hosp)

    log = AuditLog(
        action="HOSPITAL_CREATED",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="HOSPITAL",
        resource_id=str(hosp.id),
        details=f"Created hospital {hosp.name} ({hosp.code})"
    )
    db.add(log)
    db.commit()

    return hosp
