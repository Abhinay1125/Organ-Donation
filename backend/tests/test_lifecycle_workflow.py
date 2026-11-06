"""Comprehensive tests for Role-Based Organ Lifecycle Workflow and Transitions."""
import os
import secrets
import tempfile
import unittest
from pathlib import Path

os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(tempfile.mkdtemp(prefix='organ-lifecycle-workflow-')) / 'lifecycle.sqlite3'}")

from fastapi.testclient import TestClient
from backend.app.auth import create_access_token, hash_password
from backend.app.database import Base, SessionLocal, engine
from backend.app.main import app
from backend.app.models import AuditLog, Donor, Hospital, Organ, OrganMovement, Recipient, User


class LifecycleWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            src_hosp = Hospital(code="HOSP-SRC", name="Source Hospital", city="New Delhi", state="Delhi")
            dst_hosp = Hospital(code="HOSP-DST", name="Destination Hospital", city="Bengaluru", state="Karnataka")
            other_hosp = Hospital(code="HOSP-OTHER", name="Other Hospital", city="Mumbai", state="Maharashtra")
            db.add_all([src_hosp, dst_hosp, other_hosp])
            db.flush()

            self.hospitals = {
                "source": src_hosp.id,
                "destination": dst_hosp.id,
                "other": other_hosp.id
            }

            accounts = [
                ("admin_user", "ADMIN", "ADMIN", None),
                ("donor_surgeon", "HOSPITAL", "DONOR_SURGEON", src_hosp.id),
                ("procurement_user", "HOSPITAL", "PROCUREMENT_ORGANIZER", src_hosp.id),
                ("transporter_user", "HOSPITAL", "TRANSPORTER", src_hosp.id),
                ("transplant_surgeon", "HOSPITAL", "TRANSPLANT_SURGEON", dst_hosp.id),
                ("doctor_user", "HOSPITAL", "PATIENT_DOCTOR", src_hosp.id),
                ("donor_account", "DONOR", "DONOR", src_hosp.id),
                ("recipient_account", "RECIPIENT", "RECIPIENT", dst_hosp.id),
            ]
            self.users = {}
            for username, role, duty, hosp_id in accounts:
                user = User(
                    username=username,
                    email=f"{username}@lifecycle.test",
                    full_name=f"Full {username}",
                    hashed_password=hash_password("pw-123456"),
                    role=role,
                    operational_role=duty,
                    hospital_id=hosp_id,
                    is_active=True
                )
                db.add(user)
                self.users[username] = user
            db.flush()

            donor = Donor(
                donor_id="DON-WF-1",
                name="Test Donor",
                age=32,
                gender="MALE",
                blood_group="O+",
                organ_type="Kidney",
                bmi=23.0,
                hospital_id=src_hosp.id,
                status="APPROVED",
                is_medically_approved=True
            )
            recipient = Recipient(
                recipient_id="REC-WF-1",
                name="Test Recipient",
                age=44,
                gender="FEMALE",
                blood_group="O+",
                required_organ="Kidney",
                bmi=22.5,
                hospital_id=dst_hosp.id,
                status="MATCHED"
            )
            db.add_all([donor, recipient])
            db.flush()

            organ = Organ(
                organ_id="ORG-WF-1",
                donor_id=donor.id,
                organ_type="Kidney",
                source_hospital_id=src_hosp.id,
                destination_hospital_id=dst_hosp.id,
                status="MATCHED",
                matched_recipient_id=recipient.id,
                matched_score=95.0
            )
            db.add(organ)
            db.flush()

            self.donor_id = donor.id
            self.recipient_id = recipient.id
            self.organ_id = organ.id

            db.commit()

    def tearDown(self):
        Base.metadata.drop_all(bind=engine)

    def headers(self, username):
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == username).one()
            token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
        return {"Authorization": f"Bearer {token}"}

    def _post_transition(self, username, payload, organ_id=None):
        target_id = organ_id if organ_id is not None else self.organ_id
        return self.client.post(
            f"/api/organs/{target_id}/transition",
            json=payload,
            headers=self.headers(username)
        )

    # 1. Authorized Donor Surgeon can perform retrieval
    def test_authorized_donor_surgeon_can_perform_retrieval(self):
        res = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "Source Hospital OT 1", "notes": "Cold perfusion commenced"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["new_state"], "RETRIEVED")
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "RETRIEVED")

    # 2. Authorized Donor Surgeon can perform packaging
    def test_authorized_donor_surgeon_can_perform_packaging(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "RETRIEVED"
            db.commit()

        res = self._post_transition(
            "donor_surgeon",
            {"stage": "PACKAGED", "location": "Surgical Logistics Unit", "notes": "Box sealed at 4C"}
        )
        self.assertEqual(res.status_code, 200)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "PACKAGED")

    # 3. Unauthorized Transporter cannot perform retrieval
    def test_unauthorized_transporter_cannot_perform_retrieval(self):
        res = self._post_transition(
            "transporter_user",
            {"stage": "RETRIEVED", "location": "OT 1"}
        )
        self.assertEqual(res.status_code, 403)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "MATCHED")

    # 4. Authorized Transporter can perform dispatch, transit, and delivery transitions
    def test_authorized_transporter_can_perform_dispatch_transit_and_delivery(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "PACKAGED"
            db.commit()

        # Step 4a: Dispatched
        res_dispatch = self._post_transition(
            "transporter_user",
            {"stage": "DISPATCHED", "location": "Source Hospital Ambulance Bay", "notes": "Departing"}
        )
        self.assertEqual(res_dispatch.status_code, 200)

        # Step 4b: In Transit
        res_transit = self._post_transition(
            "transporter_user",
            {"stage": "IN_TRANSIT", "location": "National Highway Checkpoint A", "notes": "GPS tracking active"}
        )
        self.assertEqual(res_transit.status_code, 200)

        # Step 4c: Delivered
        res_delivery = self._post_transition(
            "transporter_user",
            {"stage": "DELIVERED", "location": "Destination Hospital Emergency Bay", "notes": "Organ box handed over"}
        )
        self.assertEqual(res_delivery.status_code, 200)

        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "DELIVERED")

    # 5. Unauthorized Donor Surgeon cannot perform transportation transitions
    def test_unauthorized_donor_surgeon_cannot_perform_transportation_transitions(self):
        # When PACKAGED, DISPATCHED is the valid next stage, but donor_surgeon is unauthorized -> 403
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "PACKAGED"
            db.commit()

        res_dispatch = self._post_transition(
            "donor_surgeon",
            {"stage": "DISPATCHED", "location": "Source Ambulance Bay"}
        )
        self.assertEqual(res_dispatch.status_code, 403)

        # When DISPATCHED, IN_TRANSIT and DELIVERED are valid next stages, but donor_surgeon is unauthorized -> 403
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "DISPATCHED"
            db.commit()

        res_transit = self._post_transition(
            "donor_surgeon",
            {"stage": "IN_TRANSIT", "location": "Transit Checkpoint"}
        )
        self.assertEqual(res_transit.status_code, 403)

        res_delivery = self._post_transition(
            "donor_surgeon",
            {"stage": "DELIVERED", "location": "Destination Bay"}
        )
        self.assertEqual(res_delivery.status_code, 403)

    # 6. Authorized Transplant Surgeon can confirm receipt
    def test_authorized_transplant_surgeon_can_confirm_receipt(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "DELIVERED"
            db.commit()

        res = self._post_transition(
            "transplant_surgeon",
            {"stage": "RECEIVED", "location": "Destination Hospital ICU", "notes": "Organ inspected and intact"}
        )
        self.assertEqual(res.status_code, 200)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "RECEIVED")

    # 7. Authorized Transplant Surgeon can confirm transplantation
    def test_authorized_transplant_surgeon_can_confirm_transplantation(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "RECEIVED"
            db.commit()

        res = self._post_transition(
            "transplant_surgeon",
            {"stage": "TRANSPLANTED", "location": "Destination Hospital OT 4", "notes": "Graft revascularized successfully"}
        )
        self.assertEqual(res.status_code, 200)
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            self.assertEqual(organ.status, "TRANSPLANTED")
            rec = db.query(Recipient).filter(Recipient.id == self.recipient_id).one()
            self.assertEqual(rec.status, "TRANSPLANTED")

    # 8. Unauthorized roles cannot perform transplantation
    def test_unauthorized_roles_cannot_perform_transplantation(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "RECEIVED"
            db.commit()

        unauthorized_users = ["donor_surgeon", "transporter_user", "doctor_user", "procurement_user"]
        for username in unauthorized_users:
            res = self._post_transition(
                username,
                {"stage": "TRANSPLANTED", "location": "OT 4"}
            )
            self.assertEqual(res.status_code, 403, f"User {username} should not be allowed to transplant")

    # 9. ADMIN cannot bypass clinical operational-role restrictions
    def test_admin_cannot_bypass_clinical_restrictions(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "PACKAGED"
            db.commit()

        res = self._post_transition(
            "admin_user",
            {"stage": "DISPATCHED", "location": "Ambulance Bay"}
        )
        self.assertEqual(res.status_code, 403)

    # 10. Invalid stage transitions are rejected
    def test_invalid_stage_transitions_are_rejected(self):
        with SessionLocal() as db:
            organ = db.query(Organ).filter(Organ.id == self.organ_id).one()
            organ.status = "PACKAGED"
            db.commit()

        # Cannot skip DISPATCHED to RECEIVED
        res = self._post_transition(
            "transplant_surgeon",
            {"stage": "RECEIVED", "location": "ICU"}
        )
        self.assertEqual(res.status_code, 400)

    # 11. Missing operational location is rejected where required
    def test_missing_operational_location_is_rejected(self):
        # Empty string
        res_empty = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": ""}
        )
        self.assertEqual(res_empty.status_code, 422)

        # Whitespace string
        res_whitespace = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "   "}
        )
        self.assertEqual(res_whitespace.status_code, 422)

    # 12. Missing organ returns 404
    def test_missing_organ_returns_404(self):
        res = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "OT 1"},
            organ_id=999999
        )
        self.assertEqual(res.status_code, 404)

    # 13. Successful transitions create organ_movements entries
    def test_successful_transitions_create_movement_entries(self):
        with SessionLocal() as db:
            initial_count = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).count()

        res = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "OT Suite 2", "notes": "Logged movement"}
        )
        self.assertEqual(res.status_code, 200)

        with SessionLocal() as db:
            new_count = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).count()
            self.assertEqual(new_count, initial_count + 1)
            latest = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).order_by(OrganMovement.id.desc()).first()
            self.assertEqual(latest.stage, "RETRIEVED")
            self.assertEqual(latest.location, "OT Suite 2")
            self.assertEqual(latest.actor_name, "Full donor_surgeon")
            self.assertEqual(latest.actor_role, "DONOR_SURGEON")

    # 14. Successful transitions create audit_logs entries
    def test_successful_transitions_create_audit_entries(self):
        res = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "OT Suite 2", "notes": "Audited movement"}
        )
        self.assertEqual(res.status_code, 200)

        with SessionLocal() as db:
            audit = db.query(AuditLog).filter(
                AuditLog.action == "ORGAN_LIFECYCLE_RETRIEVED",
                AuditLog.resource_id == "ORG-WF-1"
            ).first()
            self.assertIsNotNone(audit)
            self.assertEqual(audit.actor_username, "donor_surgeon")
            self.assertIn("RETRIEVED", audit.details)

    # 15. Failed transitions do not create successful movement records
    def test_failed_transitions_do_not_create_movement_records(self):
        with SessionLocal() as db:
            initial_count = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).count()

        # Attempt unauthorized transition (Transporter trying to retrieve)
        res = self._post_transition(
            "transporter_user",
            {"stage": "RETRIEVED", "location": "OT 1"}
        )
        self.assertEqual(res.status_code, 403)

        with SessionLocal() as db:
            new_count = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).count()
            self.assertEqual(new_count, initial_count)

    # 16. Previously completed movement history remains unchanged
    def test_completed_movement_history_remains_unchanged(self):
        # Record retrieval
        res1 = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "First OT", "notes": "Initial retrieval note"}
        )
        self.assertEqual(res1.status_code, 200)

        with SessionLocal() as db:
            m1 = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id, OrganMovement.stage == "RETRIEVED").one()
            m1_id = m1.id
            m1_loc = m1.location
            m1_notes = m1.notes

        # Advance to packaging
        res2 = self._post_transition(
            "donor_surgeon",
            {"stage": "PACKAGED", "location": "Packaging Room", "notes": "Packaging note"}
        )
        self.assertEqual(res2.status_code, 200)

        with SessionLocal() as db:
            # Check original retrieval movement is completely unaltered
            m1_check = db.query(OrganMovement).filter(OrganMovement.id == m1_id).one()
            self.assertEqual(m1_check.stage, "RETRIEVED")
            self.assertEqual(m1_check.location, m1_loc)
            self.assertEqual(m1_check.notes, m1_notes)

            # Both movements exist in chronological order
            all_movements = db.query(OrganMovement).filter(OrganMovement.organ_id == self.organ_id).order_by(OrganMovement.id.asc()).all()
            self.assertEqual(len(all_movements), 2)
            self.assertEqual(all_movements[0].stage, "RETRIEVED")
            self.assertEqual(all_movements[1].stage, "PACKAGED")

    # 17. Concurrency conflict check: stale current_stage is rejected with 409
    def test_concurrency_conflict_detected(self):
        res = self._post_transition(
            "donor_surgeon",
            {"stage": "RETRIEVED", "location": "OT 1", "current_stage": "PACKAGED"}  # Organ is actually MATCHED
        )
        self.assertEqual(res.status_code, 409)

    # 18. Organ detail response provides role-tailored permissible & authorized next stages
    def test_organ_detail_exposes_authorized_next_stages(self):
        # Request organ detail as donor surgeon
        res_surgeon = self.client.get(f"/api/organs/{self.organ_id}", headers=self.headers("donor_surgeon"))
        self.assertEqual(res_surgeon.status_code, 200)
        data = res_surgeon.json()
        self.assertIn("next_permissible_stages", data)
        self.assertIn("authorized_next_stages", data)
        self.assertIn("RETRIEVED", data["authorized_next_stages"])

        # Request organ detail as transporter (unauthorized at MATCHED stage)
        res_transporter = self.client.get(f"/api/organs/{self.organ_id}", headers=self.headers("transporter_user"))
        self.assertEqual(res_transporter.status_code, 200)
        t_data = res_transporter.json()
        self.assertEqual(t_data["authorized_next_stages"], [])

        # Request organ detail as admin (read/monitoring only, no clinical transition rights)
        res_admin = self.client.get(f"/api/organs/{self.organ_id}", headers=self.headers("admin_user"))
        self.assertEqual(res_admin.status_code, 200)
        admin_data = res_admin.json()
        self.assertEqual(admin_data["authorized_next_stages"], [])


if __name__ == "__main__":
    unittest.main()
