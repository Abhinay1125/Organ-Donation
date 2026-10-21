"""Regression test for repairing existing demo duty accounts without resetting passwords."""
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_add_duty_users_repairs_existing_account_and_is_idempotent():
    from backend.app.auth import hash_password, verify_password
    from backend.app.database import Base
    from backend.app.models import Hospital, User
    from backend.scripts import add_duty_users as duty_user_script

    with tempfile.TemporaryDirectory(prefix="duty-user-upsert-") as temp_dir:
        engine = create_engine(f"sqlite:///{Path(temp_dir) / 'isolated.sqlite3'}")
        Base.metadata.create_all(bind=engine)
        test_sessions = sessionmaker(bind=engine)

        with test_sessions() as db:
            apollo = Hospital(code="HOSP-APOLLO", name="Test Apollo", city="Test", state="Test")
            aiims = Hospital(code="HOSP-AIIMS", name="Test AIIMS", city="Test", state="Test")
            other = Hospital(code="OTHER", name="Other Hospital", city="Test", state="Test")
            db.add_all([apollo, aiims, other])
            db.flush()
            apollo_id = apollo.id
            aiims_id = aiims.id
            previous_hash = hash_password("preserve-this-synthetic-test-password")
            db.add(User(
                username="dr_mehta",
                email="mehta@apollo.example.test",
                full_name="Wrong existing role",
                hashed_password=previous_hash,
                role="DONOR",
                operational_role="DONOR",
                hospital_id=other.id,
            ))
            db.commit()

        with patch.object(duty_user_script, "SessionLocal", test_sessions), patch.dict(
            os.environ,
            {
                "RESET_DEMO_PASSWORDS": "false",
                "DEMO_PATIENT_DOCTOR_PASSWORD": "synthetic-test-only",
                "DEMO_AIIMS_PATIENT_DOCTOR_PASSWORD": "synthetic-aiims-test-only",
                "DEMO_PROCUREMENT_ORGANIZER_PASSWORD": "synthetic-test-only",
            },
        ):
            duty_user_script.add_duty_users()
            with test_sessions() as db:
                repaired = db.query(User).filter_by(username="dr_mehta").one()
                aiims_doctor = db.query(User).filter_by(username="dr_iyer_aiims").one()
                created = db.query(User).filter_by(username="procurement_rao").one()
                first_state = [
                    (user.username, user.role, user.operational_role, user.hospital_id, user.hashed_password)
                    for user in db.query(User).order_by(User.username).all()
                ]
                assert (repaired.role, repaired.operational_role, repaired.hospital_id) == (
                    "HOSPITAL", "PATIENT_DOCTOR", apollo_id
                )
                assert repaired.hashed_password == previous_hash
                assert (aiims_doctor.role, aiims_doctor.operational_role, aiims_doctor.hospital_id) == (
                    "HOSPITAL", "PATIENT_DOCTOR", aiims_id
                )
                assert verify_password("synthetic-aiims-test-only", aiims_doctor.hashed_password)
                assert (created.role, created.operational_role, created.hospital_id) == (
                    "HOSPITAL", "PROCUREMENT_ORGANIZER", apollo_id
                )

            duty_user_script.add_duty_users()
            with test_sessions() as db:
                second_state = [
                    (user.username, user.role, user.operational_role, user.hospital_id, user.hashed_password)
                    for user in db.query(User).order_by(User.username).all()
                ]
                assert second_state == first_state

        engine.dispose()
