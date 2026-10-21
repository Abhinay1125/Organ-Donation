from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User, AuditLog
from backend.app.schemas import LoginRequest, Token, UserResponse, UserCreate
from backend.app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact Administrator."
        )

    # Log successful login
    log = AuditLog(
        action="USER_LOGIN",
        actor_username=user.username,
        actor_role=user.role,
        resource_type="USER",
        resource_id=str(user.id),
        details=f"User {user.username} logged in successfully"
    )
    db.add(log)
    db.commit()

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "operational_role": user.operational_role,
        "id": user.id,
        "hospital_id": user.hospital_id
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "operational_role": user.operational_role,
            "hospital_id": user.hospital_id,
            "eth_address": user.eth_address
        }
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
