"""API coverage for operational duties, scope, separation of duties, and ADMIN policy."""
import os
import secrets
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(tempfile.mkdtemp(prefix='organ-duty-api-')) / 'duty.sqlite3'}")

from fastapi.testclient import TestClient

from backend.app.auth import create_access_token, hash_password
from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.models import AuditLog, Donor, Hospital, Organ, Recipient, User


class DutyAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            h1 = Hospital(code="DUTY-1", name="Synthetic Hospital One", city="X", state="X")
            h2 = Hospital(code="DUTY-2", name="Synthetic Hospital Two", city="Y", state="Y")
            db.add_all([h1, h2])
            db.flush()
            self.hospitals = {"one": h1.id, "two": h2.id}
            self.users = {}
            accounts = [
                ("admin", "ADMIN", None, h1.id),
                ("doctor", "HOSPITAL", "PATIENT_DOCTOR", h1.id),
                ("doctor2", "HOSPITAL", "PATIENT_DOCTOR", h1.id),
                ("procurement", "HOSPITAL", "PROCUREMENT_ORGANIZER", h1.id),
                ("matching", "HOSPITAL", "ORGAN_MATCHING_ORGANIZER", h1.id),
                ("matching2", "HOSPITAL", "ORGAN_MATCHING_ORGANIZER", h1.id),
                ("surgeon", "HOSPITAL", "DONOR_SURGEON", h1.id),
                ("transporter", "HOSPITAL", "TRANSPORTER", h1.id),
                ("transplant", "HOSPITAL", "TRANSPLANT_SURGEON", h1.id),
                ("wrong", "HOSPITAL", "PATIENT_DOCTOR", h1.id),
            ]
            for username, role, duty, hospital_id in accounts:
                user = User(username=username, email=f"{username}@example.test", full_name=username,
                            hashed_password=hash_password("synthetic-test-password"), role=role,
                            operational_role=duty, hospital_id=hospital_id)
                db.add(user)
                self.users[username] = user
            db.flush()
            donor = Donor(donor_id="DUTY-D1", name="Synthetic Donor", age=35, gender="X",
                          blood_group="O+", organ_type="Kidney", bmi=22.0, hospital_id=h1.id,
                          status="PENDING_APPROVAL")
            recipient = Recipient(recipient_id="DUTY-R1", name="Synthetic Recipient", age=40,
                                  gender="X", blood_group="O+", required_organ="Kidney", bmi=23.0,
                                  hospital_id=h1.id, status="WAITING")
            db.add_all([donor, recipient])
            db.flush()
            organ = Organ(organ_id="DUTY-O1", donor_id=donor.id, organ_type="Kidney",
                          source_hospital_id=h1.id, status="MEDICALLY_APPROVED")
            other_organ = Organ(organ_id="DUTY-O2", donor_id=donor.id, organ_type="Kidney",
                                source_hospital_id=h2.id, status="MEDICALLY_APPROVED")
            db.add_all([organ, other_organ])
            db.flush()
            self.records = {"donor": donor.id, "recipient": recipient.id,
                            "organ": organ.id, "other_organ": other_organ.id}
            # Registrar rows mirror the action/resource identifiers written by the handlers.
            db.add(AuditLog(action="DONOR_REGISTERED_PENDING", actor_username="doctor2", actor_role="HOSPITAL",
                            resource_type="DONOR", resource_id=donor.donor_id))
            db.commit()

    def headers(self, username):
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == username).one()
            token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
        return {"Authorization": f"Bearer {token}"}

    def _post(self, path, username, body):
        return self.client.post(path, json=body, headers=self.headers(username))

    def test_visible_hospital_reads_and_admin_read_tabs_are_authorized(self):
        hospital_users = [
            "doctor", "procurement", "matching", "surgeon", "transporter", "transplant"
        ]
        for username in hospital_users:
            headers = self.headers(username)
            for path in ("/api/donors", "/api/recipients", "/api/organs", "/api/hospitals"):
                self.assertEqual(self.client.get(path, headers=headers).status_code, 200, (username, path))
            self.assertEqual(self.client.get("/api/ml/metrics", headers=headers).status_code, 200, username)

            matching_status = self.client.get(
                f"/api/matching/candidates/{self.records['organ']}", headers=headers
            ).status_code
            self.assertEqual(matching_status, 200 if username == "matching" else 403, username)

        admin_headers = self.headers("admin")
        for path in (
            "/api/donors", "/api/recipients", "/api/organs", "/api/hospitals",
            "/api/blockchain/transactions", "/api/audit", "/api/admin/stats",
        ):
            self.assertEqual(self.client.get(path, headers=admin_headers).status_code, 200, path)
        self.assertEqual(
            self.client.get(f"/api/matching/candidates/{self.records['organ']}",
                            headers=admin_headers).status_code,
            403,
        )

    def test_matching_review_requires_recipient_id_from_candidate_results(self):
        candidate_response = self.client.get(
            f"/api/matching/candidates/{self.records['organ']}",
            headers=self.headers("matching"),
        )
        self.assertEqual(candidate_response.status_code, 200)
        candidate = candidate_response.json()["ranked_candidates"][0]
        self.assertIsInstance(candidate["id"], int)
        self.assertIsInstance(candidate["recipient_id"], str)
        self.assertNotEqual(candidate["id"], candidate["recipient_id"])

        review_path = f"/api/matching/review/{self.records['organ']}"
        missing_id_response = self._post(
            review_path,
            "matching",
            {"decision": "REJECTED", "notes": "synthetic"},
        )
        self.assertEqual(missing_id_response.status_code, 422)
        self.assertEqual(missing_id_response.json()["detail"][0]["loc"], ["body", "recipient_id"])

        valid_response = self._post(
            review_path,
            "matching",
            {"recipient_id": candidate["id"], "decision": "REJECTED", "notes": "synthetic"},
        )
        self.assertEqual(valid_response.status_code, 200)

    def test_endpoint_duty_matrix_and_business_successes(self):
        donor_body = {"donor_id": "DUTY-D2", "name": "Synthetic Donor Two", "age": 36,
                      "gender": "X", "blood_group": "O+", "organ_type": "Kidney", "bmi": 22.5,
                      "hospital_id": self.hospitals["one"]}
        recipient_body = {"recipient_id": "DUTY-R2", "name": "Synthetic Recipient Two", "age": 41,
                          "gender": "X", "blood_group": "O+", "required_organ": "Kidney", "bmi": 23.5,
                          "hospital_id": self.hospitals["one"]}
        self.assertEqual(self._post("/api/donors", "doctor", donor_body).status_code, 403)
        self.assertEqual(self._post("/api/donors", "procurement", donor_body).status_code, 200)
        self.assertEqual(self._post("/api/recipients", "procurement", recipient_body).status_code, 403)
        registered_recipient = self._post("/api/recipients", "doctor", recipient_body)
        self.assertEqual(registered_recipient.status_code, 200)
        registered_recipient_id = registered_recipient.json()["id"]

        self.assertEqual(self._post(f"/api/donors/{self.records['donor']}/approve", "matching",
                                    {"is_approved": True, "medical_notes": "synthetic"}).status_code, 403)
        from backend.app.routers import donors, matching, organs
        with patch.object(donors.blockchain_service, "record_donor_approval", return_value="0xtest"), \
             patch.object(donors.blockchain_service, "record_donor_registration", return_value="0xtest"), \
             patch.object(matching.blockchain_service, "record_matching_decision", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_organ_removal", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_organ_packaging", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_delivery_start", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_delivery_end", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_organ_receipt", return_value="0xtest"), \
             patch.object(organs.blockchain_service, "record_transplantation", return_value="0xtest"):
            # A qualified account other than the audited donor registrar may approve.
            self.assertEqual(self._post(f"/api/donors/{self.records['donor']}/approve", "doctor2",
                                        {"is_approved": True, "medical_notes": "synthetic"}).status_code, 403)
            self.assertEqual(self._post(f"/api/donors/{self.records['donor']}/approve", "doctor",
                                        {"is_approved": True, "medical_notes": "synthetic"}).status_code, 200)

            candidate_path = f"/api/matching/candidates/{self.records['organ']}"
            self.assertEqual(self.client.get(candidate_path, headers=self.headers("doctor")).status_code, 403)
            self.assertEqual(self.client.get(candidate_path, headers=self.headers("matching")).status_code, 200)
            direct = {"donor_age": 35, "donor_bg": "O+", "recipient_age": 40,
                      "recipient_bg": "O+", "organ_type": "Kidney"}
            self.assertEqual(self._post("/api/matching/direct-predict", "doctor", direct).status_code, 403)
            self.assertEqual(self._post("/api/matching/direct-predict", "matching", direct).status_code, 200)

            # Recipient registrar is denied even after being assigned the matching duty.
            with SessionLocal() as db:
                user = db.query(User).filter(User.username == "doctor").one()
                user.operational_role = "ORGAN_MATCHING_ORGANIZER"
                db.commit()
            review = {"recipient_id": registered_recipient_id, "decision": "APPROVED", "notes": "synthetic"}
            self.assertEqual(self._post(f"/api/matching/review/{self.records['organ']}", "doctor", review).status_code, 403)
            self.assertEqual(self._post(f"/api/matching/review/{self.records['organ']}", "matching", review).status_code, 200)

            # Exercise every lifecycle duty against a valid predecessor and a wrong duty.
            lifecycle = [
                ("MATCHED", "MEDICALLY_APPROVED", "matching"),
                ("READY_FOR_RETRIEVAL", "MATCHED", "surgeon"),
                ("RETRIEVED", "READY_FOR_RETRIEVAL", "surgeon"),
                ("PACKAGED", "RETRIEVED", "surgeon"),
                ("DISPATCHED", "PACKAGED", "transporter"),
                ("DELIVERED", "DISPATCHED", "transporter"),
                ("RECEIVED", "DELIVERED", "transplant"),
                ("TRANSPLANTED", "RECEIVED", "transplant"),
            ]
            for stage, predecessor, qualified_user in lifecycle:
                with SessionLocal() as db:
                    organ = db.query(Organ).filter(Organ.id == self.records["organ"]).one()
                    organ.status = predecessor
                    organ.matched_recipient_id = self.records["recipient"]
                    organ.destination_hospital_id = self.hospitals["one"]
                    db.commit()
                body = {"stage": stage, "location": "Synthetic checkpoint", "notes": "synthetic"}
                if stage == "MATCHED":
                    self.assertEqual(self._post(f"/api/organs/{self.records['organ']}/transition", "matching", body).status_code, 400)
                    continue
                self.assertEqual(self._post(f"/api/organs/{self.records['organ']}/transition", "wrong", body).status_code, 403, stage)
                with SessionLocal() as db:
                    organ = db.query(Organ).filter(Organ.id == self.records["organ"]).one()
                    organ.status = predecessor
                    db.commit()
                self.assertEqual(self._post(f"/api/organs/{self.records['organ']}/transition", qualified_user, body).status_code, 200, stage)
                if stage == "RETRIEVED":
                    with SessionLocal() as db:
                        donor = db.query(Donor).filter(Donor.id == self.records["donor"]).one()
                        self.assertEqual(donor.status, "DONATED")

    def test_lifecycle_rejects_contract_shortcuts(self):
        for predecessor, stage in (
            ("RETRIEVED", "IN_TRANSIT"),
            ("IN_TRANSIT", "RECEIVED"),
            ("DISPATCHED", "RECEIVED"),
        ):
            with SessionLocal() as db:
                organ = db.query(Organ).filter(Organ.id == self.records["organ"]).one()
                organ.status = predecessor
                db.commit()
            response = self._post(
                f"/api/organs/{self.records['organ']}/transition",
                "transporter" if stage != "RECEIVED" else "transplant",
                {"stage": stage, "location": "Synthetic checkpoint", "notes": "synthetic"},
            )
            self.assertEqual(response.status_code, 400, f"{predecessor} -> {stage}")

    def test_cross_hospital_is_404_and_admin_clinical_writes_are_denied(self):
        self.assertEqual(self.client.get(f"/api/matching/candidates/{self.records['other_organ']}",
                                         headers=self.headers("matching")).status_code, 404)
        self.assertEqual(self.client.get(f"/api/organs/{self.records['other_organ']}",
                                         headers=self.headers("matching")).status_code, 404)
        body = {"donor_id": "ADMIN-D", "name": "Synthetic", "age": 30, "gender": "X",
                "blood_group": "O+", "organ_type": "Kidney", "bmi": 20, "hospital_id": self.hospitals["one"]}
        self.assertEqual(self._post("/api/donors", "admin", body).status_code, 403)
        self.assertEqual(self._post("/api/recipients", "admin", {"recipient_id": "ADMIN-R", "name": "Synthetic",
                           "age": 30, "gender": "X", "blood_group": "O+", "required_organ": "Kidney",
                           "bmi": 20, "hospital_id": self.hospitals["one"]}).status_code, 403)
        self.assertEqual(self._post("/api/donors/" + str(self.records["donor"]) + "/approve", "admin",
                                    {"is_approved": True, "medical_notes": "synthetic"}).status_code, 403)
        self.assertEqual(self.client.get(f"/api/matching/candidates/{self.records['organ']}",
                                         headers=self.headers("admin")).status_code, 403)
        direct = {"donor_age": 35, "donor_bg": "O+", "recipient_age": 40,
                  "recipient_bg": "O+", "organ_type": "Kidney"}
        self.assertEqual(self._post("/api/matching/direct-predict", "admin", direct).status_code, 403)
        self.assertEqual(self._post(f"/api/matching/review/{self.records['organ']}", "admin",
                                    {"recipient_id": self.records["recipient"], "decision": "APPROVED",
                                     "notes": "synthetic"}).status_code, 403)
        with SessionLocal() as db:
            db.query(Organ).filter(Organ.id == self.records["organ"]).update({"status": "READY_FOR_RETRIEVAL"})
            db.commit()
        self.assertEqual(self._post(f"/api/organs/{self.records['organ']}/transition", "admin",
                                    {"stage": "RETRIEVED", "location": "synthetic"}).status_code, 403)
        self.assertEqual(self.client.get("/api/admin/users", headers=self.headers("admin")).status_code, 200)
        self.assertEqual(self.client.get("/api/admin/stats", headers=self.headers("admin")).status_code, 200)
        self.assertEqual(self.client.get("/api/hospitals", headers=self.headers("admin")).status_code, 200)
        self.assertEqual(self.client.get("/api/audit", headers=self.headers("admin")).status_code, 200)

    def tearDown(self):
        Base.metadata.drop_all(bind=engine)


if __name__ == "__main__":
    unittest.main()
