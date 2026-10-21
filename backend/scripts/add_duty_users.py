"""Idempotently add synthetic hospital duty demo accounts."""
import os
import secrets

from backend.app.auth import hash_password
from backend.app.database import SessionLocal
from backend.app.demo_duty_users import DUTY_DEMO_USERS
from backend.app.models import Hospital, User


def add_duty_users():
    db = SessionLocal()
    try:
        reset_passwords = os.getenv("RESET_DEMO_PASSWORDS", "").lower() == "true"
        for spec in DUTY_DEMO_USERS:
            hospital = db.query(Hospital).filter(Hospital.code == spec["hospital_code"]).first()
            if hospital is None:
                raise RuntimeError(f"Seed hospital {spec['hospital_code']} before adding duty users")

            user = db.query(User).filter(User.username == spec["username"]).first()
            if user is None:
                user = User(username=spec["username"], email=spec["email"], full_name=spec["full_name"])
                db.add(user)

            user.role = "HOSPITAL"
            user.operational_role = spec["operational_role"]
            user.hospital_id = hospital.id

            if user.id is None or reset_passwords:
                password = os.getenv(spec["password_env"]) or secrets.token_urlsafe(24)
                user.hashed_password = hash_password(password)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    add_duty_users()
