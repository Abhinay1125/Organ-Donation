"""Standard-library security regression tests against a temporary SQLite database."""
import datetime
import os
import secrets
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_test_root = Path(tempfile.mkdtemp(prefix="organ-donation-security-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_test_root / 'security.sqlite3'}"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)

import jwt
from fastapi.testclient import TestClient

from backend.app.auth import create_access_token, hash_password
from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.models import Hospital, User, Donor, Recipient, Organ, AuditLog, OrganMovement


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        h1 = Hospital(code="TEST-1", name="Test Hospital One", city="A", state="A")
        h2 = Hospital(code="TEST-2", name="Test Hospital Two", city="B", state="B")
        db.add_all([h1, h2])
        db.flush()
        users = {}
        for username, role, hospital_id, active in [
            ("test-admin", "ADMIN", h1.id, True),
            ("test-hospital-1", "HOSPITAL", h1.id, True),
            ("test-hospital-2", "HOSPITAL", h2.id, True),
            ("test-donor", "DONOR", h1.id, True),
            ("test-recipient", "RECIPIENT", h2.id, True),
            ("test-inactive", "HOSPITAL", h1.id, False),
        ]:
            duty = "ORGAN_MATCHING_ORGANIZER" if role == "HOSPITAL" else None
            user = User(username=username, email=f"{username}@example.test", full_name=username,
                        hashed_password=hash_password("synthetic-test-password"), role=role,
                        operational_role=duty, hospital_id=hospital_id, is_active=active)
            db.add(user)
            users[username] = user
        db.flush()
        d1 = Donor(donor_id="TEST-D1", name="Synthetic Donor One", age=40, gender="X", blood_group="O+",
                   organ_type="Kidney", bmi=22.0, hospital_id=h1.id, medical_notes="synthetic")
        d2 = Donor(donor_id="TEST-D2", name="Synthetic Donor Two", age=41, gender="X", blood_group="A+",
                   organ_type="Kidney", bmi=23.0, hospital_id=h2.id, medical_notes="synthetic")
        r1 = Recipient(recipient_id="TEST-R1", name="Synthetic Recipient One", age=45, gender="X",
                       blood_group="O+", required_organ="Kidney", bmi=24.0, hospital_id=h1.id)
        r2 = Recipient(recipient_id="TEST-R2", name="Synthetic Recipient Two", age=46, gender="X",
                       blood_group="A+", required_organ="Liver", bmi=25.0, hospital_id=h2.id)
        db.add_all([d1, d2, r1, r2])
        db.flush()
        o1 = Organ(organ_id="TEST-O1", donor_id=d1.id, organ_type="Kidney", source_hospital_id=h1.id,
                   status="MEDICALLY_APPROVED")
        o2 = Organ(organ_id="TEST-O2", donor_id=d2.id, organ_type="Kidney", source_hospital_id=h2.id,
                   status="MEDICALLY_APPROVED")
        db.add_all([o1, o2])
        db.commit()
        self.records = {"h1": h1.id, "h2": h2.id, "d1": d1.id, "d2": d2.id, "r1": r1.id, "r2": r2.id,
                        "o1": o1.id, "o2": o2.id}
        db.close()

    def tearDown(self):
        Base.metadata.drop_all(bind=engine)

    def headers(self, username):
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == username).one()
            token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
        return {"Authorization": f"Bearer {token}"}

    def test_authentication_required_invalid_expired_and_inactive(self):
        self.assertEqual(self.client.get("/api/donors").status_code, 401)
        self.assertEqual(self.client.get("/api/donors", headers={"Authorization": "Bearer invalid"}).status_code, 401)
        expired = jwt.encode({"sub": "test-admin", "exp": datetime.datetime.utcnow() - datetime.timedelta(minutes=1)},
                             os.environ["JWT_SECRET_KEY"], algorithm="HS256")
        self.assertEqual(self.client.get("/api/donors", headers={"Authorization": f"Bearer {expired}"}).status_code, 401)
        response = self.client.get("/api/donors", headers=self.headers("test-inactive"))
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("synthetic", response.text)

    def test_donor_and_recipient_records_are_role_and_hospital_scoped(self):
        self.assertEqual(self.client.get("/api/donors", headers=self.headers("test-donor")).status_code, 403)
        self.assertEqual(self.client.get("/api/recipients", headers=self.headers("test-recipient")).status_code, 403)
        h1 = self.headers("test-hospital-1")
        self.assertEqual([row["id"] for row in self.client.get("/api/donors", headers=h1).json()], [self.records["d1"]])
        self.assertEqual([row["id"] for row in self.client.get("/api/recipients", headers=h1).json()], [self.records["r1"]])
        self.assertEqual(self.client.get(f"/api/donors/{self.records['d2']}", headers=h1).status_code, 404)
        self.assertEqual(self.client.get(f"/api/recipients/{self.records['r2']}", headers=h1).status_code, 404)

    def test_hospital_scope_for_organs_and_create_requests(self):
        h1 = self.headers("test-hospital-1")
        self.assertEqual([row["id"] for row in self.client.get("/api/organs", headers=h1).json()], [self.records["o1"]])
        self.assertEqual(self.client.get(f"/api/organs/{self.records['o2']}", headers=h1).status_code, 404)
        self.assertEqual(self.client.get(f"/api/matching/candidates/{self.records['o1']}", headers=h1).status_code, 200)
        self.assertEqual(self.client.get(f"/api/matching/candidates/{self.records['o2']}", headers=h1).status_code, 404)
        donor = {"donor_id": "X", "name": "Synthetic", "age": 30, "gender": "X", "blood_group": "O+",
                 "organ_type": "Kidney", "bmi": 20, "hospital_id": self.records["h2"]}
        recipient = {"recipient_id": "X", "name": "Synthetic", "age": 30, "gender": "X", "blood_group": "O+",
                     "required_organ": "Kidney", "bmi": 20, "hospital_id": self.records["h2"]}
        self.assertEqual(self.client.post("/api/donors", json=donor, headers=h1).status_code, 404)
        self.assertEqual(self.client.post("/api/recipients", json=recipient, headers=h1).status_code, 404)
        self.assertEqual(self.client.post("/api/donors", json=donor, headers=self.headers("test-donor")).status_code, 403)

    def test_privileged_metadata_and_actions_deny_donor_recipient_roles(self):
        donor, recipient = self.headers("test-donor"), self.headers("test-recipient")
        for path in ["/api/matching/candidates/1", "/api/ml/metrics", "/api/blockchain/status",
                     "/api/blockchain/transactions", "/api/audit"]:
            self.assertEqual(self.client.get(path, headers=donor).status_code, 403, path)
            self.assertEqual(self.client.get(path, headers=recipient).status_code, 403, path)
        self.assertEqual(self.client.post("/api/matching/direct-predict", json={}, headers=donor).status_code, 403)
        self.assertEqual(self.client.post(f"/api/donors/{self.records['d1']}/approve",
                                          json={"is_approved": True, "medical_notes": "x"}, headers=donor).status_code, 403)
        self.assertEqual(self.client.post(f"/api/organs/{self.records['o1']}/transition",
                                          json={"stage": "MATCHED", "location": "x"}, headers=recipient).status_code, 403)

    def test_cross_hospital_workflow_rejected_before_side_effects(self):
        from backend.app.routers import organs, matching, donors
        def forbidden(*args, **kwargs):
            raise AssertionError("Unauthorized workflow reached a side-effecting service")
        h1 = self.headers("test-hospital-1")
        with patch.object(organs.blockchain_service, "record_organ_removal", forbidden), \
             patch.object(matching.blockchain_service, "record_matching_decision", forbidden), \
             patch.object(donors.blockchain_service, "record_donor_approval", forbidden):
            self.assertEqual(self.client.post(f"/api/donors/{self.records['d2']}/approve",
                                              json={"is_approved": True, "medical_notes": "x"}, headers=h1).status_code, 404)
            self.assertEqual(self.client.post(f"/api/organs/{self.records['o2']}/transition",
                                              json={"stage": "RETRIEVED", "location": "x"}, headers=h1).status_code, 404)
            review = {"recipient_id": self.records["r1"], "decision": "APPROVED", "notes": "synthetic"}
            self.assertEqual(self.client.post(f"/api/matching/review/{self.records['o2']}",
                                              json=review, headers=h1).status_code, 404)

    def test_matching_requires_eligible_recipient_and_valid_organ_state(self):
        from backend.app.routers import matching
        def forbidden(*args, **kwargs):
            raise AssertionError("Invalid matching request reached ledger service")
        with patch.object(matching.blockchain_service, "record_matching_decision", forbidden):
            response = self.client.post(f"/api/matching/review/{self.records['o1']}",
                                        json={"recipient_id": self.records["r2"], "decision": "APPROVED", "notes": "synthetic"},
                                        headers=self.headers("test-hospital-1"))
            self.assertEqual(response.status_code, 409)
            invalid = self.client.post(f"/api/matching/review/{self.records['o1']}",
                                       json={"recipient_id": self.records["r1"], "decision": "MAYBE", "notes": "synthetic"},
                                       headers=self.headers("test-hospital-1"))
            self.assertEqual(invalid.status_code, 422)

    def test_role_and_hospital_assignment_validation(self):
        admin = self.headers("test-admin")
        invalid = {"username": "bad-role", "email": "bad@example.test", "full_name": "Synthetic",
                   "password": "synthetic", "role": "ROOT"}
        self.assertEqual(self.client.post("/api/admin/users", json=invalid, headers=admin).status_code, 422)
        missing = {"username": "no-hospital", "email": "no-hospital@example.test", "full_name": "Synthetic",
                   "password": "synthetic", "role": "HOSPITAL"}
        self.assertEqual(self.client.post("/api/admin/users", json=missing, headers=admin).status_code, 422)
        self.assertEqual(self.client.post("/api/admin/users", json=invalid,
                                          headers=self.headers("test-hospital-1")).status_code, 403)

    def test_invalid_lifecycle_transition_has_no_side_effects(self):
        h1 = self.headers("test-hospital-1")
        response = self.client.post(f"/api/organs/{self.records['o1']}/transition",
                                    json={"stage": "TRANSPLANTED", "location": "synthetic"}, headers=h1)
        self.assertEqual(response.status_code, 400)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.records["o1"]).one()
            self.assertEqual(organ.status, "MEDICALLY_APPROVED")
            self.assertEqual(db.query(OrganMovement).filter(OrganMovement.organ_id == organ.id).count(), 0)
            self.assertEqual(db.query(AuditLog).filter(AuditLog.resource_id == "TEST-O1").count(), 0)

    def test_matched_stage_must_be_set_by_match_review(self):
        h1 = self.headers("test-hospital-1")
        response = self.client.post(f"/api/organs/{self.records['o1']}/transition",
                                    json={"stage": "MATCHED", "location": "synthetic"}, headers=h1)
        self.assertEqual(response.status_code, 400)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.records["o1"]).one()
            self.assertEqual(organ.status, "MEDICALLY_APPROVED")
            self.assertEqual(db.query(OrganMovement).filter(OrganMovement.organ_id == organ.id).count(), 0)

    def test_ensure_operational_role(self):
        from backend.app import auth
        from fastapi import HTTPException
        with SessionLocal() as db:
            matching = db.query(User).filter(User.username == "test-hospital-1").one()
            auth.ensure_operational_role(matching, ["ORGAN_MATCHING_ORGANIZER"])
            with self.assertRaises(HTTPException) as wrong:
                auth.ensure_operational_role(matching, ["PATIENT_DOCTOR"])
            self.assertEqual(wrong.exception.status_code, 403)
            matching.operational_role = None
            with self.assertRaises(HTTPException):
                auth.ensure_operational_role(matching, ["PATIENT_DOCTOR"])
            admin = db.query(User).filter(User.username == "test-admin").one()
            with self.assertRaises(HTTPException):
                auth.ensure_operational_role(admin, ["PATIENT_DOCTOR"])
            with patch.object(auth, "ADMIN_MAY_PERFORM_CLINICAL_ACTIONS", True):
                auth.ensure_operational_role(admin, ["PATIENT_DOCTOR"])
            with patch.object(auth, "ADMIN_MAY_PERFORM_CLINICAL_ACTIONS", False):
                with self.assertRaises(HTTPException):
                    auth.ensure_operational_role(admin, ["PATIENT_DOCTOR"])

    def test_stage_role_map_covers_transition_targets(self):
        from backend.app.routers.organs import STAGE_OPERATIONAL_ROLES, VALID_TRANSITIONS
        targets = {stage for next_stages in VALID_TRANSITIONS.values() for stage in next_stages}
        self.assertEqual(targets - set(STAGE_OPERATIONAL_ROLES), set())


if __name__ == "__main__":
    unittest.main()
