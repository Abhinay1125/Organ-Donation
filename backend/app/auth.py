import os
import datetime
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models import User
from backend.app.models import AuditLog

ADMIN_MAY_PERFORM_CLINICAL_ACTIONS = False

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
if (len(SECRET_KEY) < 32 or len(set(SECRET_KEY)) < 16 or
        SECRET_KEY.lower() in {"change-me", "changeme", "insecure-secret", "development-secret"} or
        SECRET_KEY.lower().startswith("organ_donation_research_")):
    raise RuntimeError("JWT_SECRET_KEY must be configured with a strong value of at least 32 characters")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours for prototype demonstration

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
    return user

def require_roles(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {allowed_roles}"
            )
        return current_user
    return role_checker


def require_hospital_assignment(user: User, hospital_id: int) -> None:
    """Reject hospital users attempting to act on another hospital's records."""
    if user.role == "ADMIN":
        return
    if user.role != "HOSPITAL" or user.hospital_id != hospital_id:
        raise HTTPException(status_code=404, detail="Resource not found")


def ensure_operational_role(user: User, allowed: list[str]) -> None:
    if user.role == "ADMIN" and ADMIN_MAY_PERFORM_CLINICAL_ACTIONS:
        return
    if user.operational_role not in allowed:
        raise HTTPException(status_code=403, detail="Access denied for this operational duty")


def require_operational_roles(allowed: list[str]):
    base_role_check = require_roles(["ADMIN", "HOSPITAL"])

    def duty_checker(current_user: User = Depends(base_role_check)):
        ensure_operational_role(current_user, allowed)
        return current_user
    return duty_checker


def ensure_not_record_registrar(db: Session, user: User, action: str, resource_type: str, resource_id: str) -> None:
    registered_by = db.query(AuditLog).filter(
        AuditLog.action == action,
        AuditLog.resource_type == resource_type,
        AuditLog.resource_id == resource_id,
    ).first()
    if registered_by and registered_by.actor_username == user.username:
        raise HTTPException(status_code=403, detail="Separation of duties policy denied this action")
