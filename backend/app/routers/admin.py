from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import User, Hospital, Donor, Recipient, Organ, MatchRun, AuditLog
from backend.app.schemas import UserResponse, UserCreate, UserUpdate
from backend.app.auth import get_current_user, require_roles, hash_password
from backend.app.blockchain_service import blockchain_service
from ml.model import ml_service

router = APIRouter(prefix="/api/admin", tags=["Admin Console"])

@router.get("/stats")
def get_dashboard_statistics(db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN"]))):
    """
    Computes real-time statistics directly from database and ledger state.
    Never hardcoded.

    Returns donor totals (total, approved, pending), recipient totals (total,
    waiting, matched_or_transplanted), organ totals (total, available, matched,
    in_transit, received, transplanted), match totals (total_runs,
    pending_reviews), blockchain transaction count and status, and ML model
    version and readiness. Restricted to administrators because these are
    platform-wide operational statistics.
    """
    total_donors = db.query(Donor).count()
    active_approved_donors = db.query(Donor).filter(Donor.status == "APPROVED").count()
    total_recipients = db.query(Recipient).count()
    waiting_recipients = db.query(Recipient).filter(Recipient.status == "WAITING").count()
    
    total_organs = db.query(Organ).count()
    available_organs = db.query(Organ).filter(Organ.status == "MEDICALLY_APPROVED").count()
    matched_organs = db.query(Organ).filter(Organ.status == "MATCHED").count()
    in_transit_organs = db.query(Organ).filter(Organ.status.in_(["PACKAGED", "DISPATCHED", "IN_TRANSIT"])).count()
    received_organs = db.query(Organ).filter(Organ.status == "RECEIVED").count()
    completed_transplants = db.query(Organ).filter(Organ.status == "TRANSPLANTED").count()
    
    total_match_runs = db.query(MatchRun).count()
    pending_reviews = db.query(MatchRun).filter(MatchRun.reviewer_decision == "PENDING").count()
    
    blockchain_events_count = db.query(AuditLog).filter(
        AuditLog.blockchain_tx.isnot(None),
        AuditLog.blockchain_tx != ""
    ).count()

    return {
        "donors": {
            "total": total_donors,
            "approved": active_approved_donors,
            "pending": total_donors - active_approved_donors
        },
        "recipients": {
            "total": total_recipients,
            "waiting": waiting_recipients,
            "matched_or_transplanted": total_recipients - waiting_recipients
        },
        "organs": {
            "total": total_organs,
            "available": available_organs,
            "matched": matched_organs,
            "in_transit": in_transit_organs,
            "received": received_organs,
            "transplanted": completed_transplants
        },
        "matches": {
            "total_runs": total_match_runs,
            "pending_reviews": pending_reviews
        },
        "blockchain": {
            "recorded_transactions": blockchain_events_count,
            "status": blockchain_service.get_status()
        },
        "ml": {
            "model_version": ml_service.model_version,
            "is_ready": ml_service.is_ready()
        }
    }

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    return db.query(User).order_by(User.id.asc()).all()

@router.post("/users", response_model=UserResponse)
def create_user_by_admin(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    existing = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already in use")

    if user_in.role == "HOSPITAL" and user_in.hospital_id is None:
        raise HTTPException(status_code=422, detail="Hospital users must be assigned to a hospital")
    if user_in.hospital_id is not None and not db.query(Hospital).filter(Hospital.id == user_in.hospital_id).first():
        raise HTTPException(status_code=422, detail="Assigned hospital does not exist")

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
        operational_role=user_in.operational_role,
        hospital_id=user_in.hospital_id,
        eth_address=user_in.eth_address,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log = AuditLog(
        action="USER_CREATED_BY_ADMIN",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="USER",
        resource_id=str(new_user.id),
        details=f"Admin created user {new_user.username} with role {new_user.role}"
    )
    db.add(log)
    db.commit()

    return new_user

@router.put("/users/{id}", response_model=UserResponse)
def update_user_by_admin(
    id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    user = db.query(User).filter(User.id == id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    effective_role = user_in.role or user.role
    effective_hospital_id = user_in.hospital_id if user_in.hospital_id is not None else user.hospital_id
    if effective_role == "HOSPITAL" and effective_hospital_id is None:
        raise HTTPException(status_code=422, detail="Hospital users must be assigned to a hospital")
    if user_in.hospital_id is not None and not db.query(Hospital).filter(Hospital.id == user_in.hospital_id).first():
        raise HTTPException(status_code=422, detail="Assigned hospital does not exist")

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.operational_role is not None:
        user.operational_role = user_in.operational_role
    if user_in.hospital_id is not None:
        user.hospital_id = user_in.hospital_id
    if user_in.eth_address is not None:
        user.eth_address = user_in.eth_address
    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    db.commit()
    db.refresh(user)

    log = AuditLog(
        action="USER_UPDATED_BY_ADMIN",
        actor_username=current_user.username,
        actor_role=current_user.role,
        resource_type="USER",
        resource_id=str(user.id),
        details=f"Admin updated user {user.username} (active={user.is_active}, role={user.role})"
    )
    db.add(log)
    db.commit()

    return user
