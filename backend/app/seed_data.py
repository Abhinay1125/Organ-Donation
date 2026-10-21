"""
Safe Demonstration Dataset & Seed Script
Generates clearly labelled synthetic records to demonstrate all features:
- User roles & credentials
- Hospitals
- Donors & medical evaluations
- Recipients & waiting lists
- Complete end-to-end organ donation & transplantation lifecycle
- Audit logs & model version metadata
"""

import datetime
import os
import secrets
from sqlalchemy.orm import Session
from backend.app.database import SessionLocal, engine, Base
from backend.app.demo_duty_users import DUTY_DEMO_USERS
from backend.app.models import (
    User, Hospital, Donor, Recipient, Organ, OrganMovement,
    MatchRun, AuditLog, ModelVersionRecord
)
from backend.app.auth import hash_password
from ml.model import ml_service

def seed_database():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Check if already seeded
    if db.query(User).filter(User.username == "admin").first():
        print("Database already seeded with demo records.")
        db.close()
        return

    print("Seeding demo hospitals...")
    hosp1 = Hospital(code="HOSP-APOLLO", name="Apollo Multi-Specialty Hospital", city="New Delhi", state="Delhi", address="Sarita Vihar, Mathura Rd", contact_phone="+91-11-2692-5858")
    hosp2 = Hospital(code="HOSP-AIIMS", name="AIIMS Apex Transplant Center", city="New Delhi", state="Delhi", address="Ansari Nagar East", contact_phone="+91-11-2658-8500")
    hosp3 = Hospital(code="HOSP-MANIPAL", name="Manipal Comprehensive Healthcare", city="Bengaluru", state="Karnataka", address="98 HAL Old Airport Rd", contact_phone="+91-80-2502-4444")
    db.add_all([hosp1, hosp2, hosp3])
    db.commit()
    hospitals_by_code = {hospital.code: hospital for hospital in (hosp1, hosp2, hosp3)}

    print("Seeding demo users...")
    # Demo Users
    u_admin = User(
        username="admin",
        email="admin@transplant.org",
        full_name="System Administrator (Dr. R. Verma)",
        hashed_password=hash_password(os.getenv("SEED_ADMIN_PASSWORD") or "admin123"),
        role="ADMIN",
        operational_role="ADMIN",
        hospital_id=None,
        eth_address="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )
    u_doc = User(
        username="dr_sharma",
        email="sharma@apollo.org",
        full_name="Dr. Suresh Sharma (Transplant Lead)",
        hashed_password=hash_password(os.getenv("SEED_MATCHING_PASSWORD") or "hospital123"),
        role="HOSPITAL",
        operational_role="ORGAN_MATCHING_ORGANIZER",
        hospital_id=hosp1.id,
        eth_address="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    )
    duty_users = {
        spec["username"]: User(
            username=spec["username"],
            email=spec["email"],
            full_name=spec["full_name"],
            hashed_password=hash_password(os.getenv(spec["password_env"]) or secrets.token_urlsafe(24)),
            role="HOSPITAL",
            operational_role=spec["operational_role"],
            hospital_id=hospitals_by_code[spec["hospital_code"]].id,
        )
        for spec in DUTY_DEMO_USERS
    }
    u_surgeon_donor = User(
        username="dr_ananya",
        email="ananya@apollo.org",
        full_name="Dr. Ananya Roy (Donor Surgeon)",
        hashed_password=hash_password(os.getenv("SEED_DONOR_SURGEON_PASSWORD") or "surgeon123"),
        role="HOSPITAL",
        operational_role="DONOR_SURGEON",
        hospital_id=hosp1.id,
        eth_address="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
    )
    u_transporter = User(
        username="courier_med",
        email="transit@medlogistics.org",
        full_name="Rajesh Kumar (Medical Transporter)",
        hashed_password=hash_password(os.getenv("SEED_TRANSPORTER_PASSWORD") or "transit123"),
        role="HOSPITAL",
        operational_role="TRANSPORTER",
        hospital_id=hosp1.id,
        eth_address="0x9965507D1a55bcC2695C58ba16FB37d819B0A4df"
    )
    u_surgeon_tx = User(
        username="dr_kapoor",
        email="kapoor@aiims.org",
        full_name="Dr. Vikram Kapoor (Transplant Surgeon)",
        hashed_password=hash_password(os.getenv("SEED_TRANSPLANT_SURGEON_PASSWORD") or "surgeon123"),
        role="HOSPITAL",
        operational_role="TRANSPLANT_SURGEON",
        hospital_id=hosp2.id,
        eth_address="0x976EA74026E726554dB657fA54763abd0C3a0aa9"
    )
    u_donor_user = User(
        username="donor_rahul",
        email="rahul.donor@synthetic.mail",
        full_name="Rahul Verma (Synthetic Donor)",
        hashed_password=hash_password(os.getenv("SEED_DONOR_PASSWORD") or "donor123"),
        role="DONOR",
        operational_role="DONOR",
        hospital_id=hosp1.id
    )
    u_recip_user = User(
        username="patient_priya",
        email="priya.patient@synthetic.mail",
        full_name="Priya Nair (Synthetic Recipient)",
        hashed_password=hash_password(os.getenv("SEED_RECIPIENT_PASSWORD") or "recipient123"),
        role="RECIPIENT",
        operational_role="RECIPIENT",
        hospital_id=hosp2.id
    )
    db.add_all([u_admin, u_doc, *duty_users.values(), u_surgeon_donor, u_transporter, u_surgeon_tx, u_donor_user, u_recip_user])
    db.commit()

    print("Seeding synthetic recipients...")
    now = datetime.datetime.utcnow()
    r1 = Recipient(
        recipient_id="REC-201",
        name="Priya Nair (Synthetic)",
        age=38,
        gender="FEMALE",
        blood_group="O+",
        required_organ="Kidney",
        height_cm=162.0,
        weight_kg=60.0,
        bmi=22.8,
        hospital_id=hosp2.id,
        waiting_since=now - datetime.timedelta(days=420),
        status="TRANSPLANTED",
        cpra=0.0,
        dialysis_months=28.0,
        urgency_tier="URGENT",
        blockchain_tx=None
    )
    r2 = Recipient(
        recipient_id="REC-202",
        name="Amitabh Sen (Synthetic)",
        age=45,
        gender="MALE",
        blood_group="O+",
        required_organ="Kidney",
        height_cm=175.0,
        weight_kg=74.0,
        bmi=24.2,
        hospital_id=hosp1.id,
        waiting_since=now - datetime.timedelta(days=260),
        status="WAITING",
        cpra=5.0,
        dialysis_months=18.0,
        urgency_tier="STANDARD"
    )
    r3 = Recipient(
        recipient_id="REC-203",
        name="Meera Joshi (Synthetic)",
        age=52,
        gender="FEMALE",
        blood_group="A+",
        required_organ="Liver",
        height_cm=158.0,
        weight_kg=65.0,
        bmi=26.0,
        hospital_id=hosp3.id,
        waiting_since=now - datetime.timedelta(days=190),
        status="MATCHED",
        cpra=0.0,
        dialysis_months=0.0,
        urgency_tier="URGENT"
    )
    r4 = Recipient(
        recipient_id="REC-204",
        name="Arjun Reddy (Synthetic)",
        age=29,
        gender="MALE",
        blood_group="B+",
        required_organ="Kidney",
        height_cm=180.0,
        weight_kg=78.0,
        bmi=24.1,
        hospital_id=hosp2.id,
        waiting_since=now - datetime.timedelta(days=95),
        status="WAITING",
        cpra=10.0,
        dialysis_months=12.0,
        urgency_tier="STANDARD"
    )
    db.add_all([r1, r2, r3, r4])
    db.commit()

    print("Seeding synthetic donors...")
    d1 = Donor(
        donor_id="DON-101",
        name="Rahul Verma (Synthetic)",
        age=34,
        gender="MALE",
        blood_group="O+",
        organ_type="Kidney",
        height_cm=172.0,
        weight_kg=70.0,
        bmi=23.6,
        hospital_id=hosp1.id,
        status="DONATED",
        is_medically_approved=True,
        medical_notes="Brain death declared. Medical suitability screening passed. Serology negative.",
        blockchain_tx=None
    )
    d2 = Donor(
        donor_id="DON-102",
        name="Sneha Rao (Synthetic)",
        age=41,
        gender="FEMALE",
        blood_group="O+",
        organ_type="Kidney",
        height_cm=165.0,
        weight_kg=62.0,
        bmi=22.8,
        hospital_id=hosp1.id,
        status="APPROVED",
        is_medically_approved=True,
        medical_notes="Cleared for organ procurement. Normal renal function parameters.",
        blockchain_tx=None
    )
    d3 = Donor(
        donor_id="DON-103",
        name="Kavita Deshmukh (Synthetic)",
        age=48,
        gender="FEMALE",
        blood_group="A+",
        organ_type="Liver",
        height_cm=160.0,
        weight_kg=59.0,
        bmi=23.0,
        hospital_id=hosp3.id,
        status="APPROVED",
        is_medically_approved=True,
        medical_notes="Medically approved donor. Liver function tests within normal reference range.",
        blockchain_tx=None
    )
    db.add_all([d1, d2, d3])
    db.commit()

    print("Seeding organs and completed lifecycle demonstration...")
    # Organ 1: Completed successful lifecycle journey
    org1 = Organ(
        organ_id="ORG-101",
        donor_id=d1.id,
        organ_type="Kidney",
        source_hospital_id=hosp1.id,
        destination_hospital_id=hosp2.id,
        status="TRANSPLANTED",
        matched_recipient_id=r1.id,
        matched_score=94.5,
        blockchain_tx=None
    )
    # Organ 2: Available & Ready for matching demonstration
    org2 = Organ(
        organ_id="ORG-102",
        donor_id=d2.id,
        organ_type="Kidney",
        source_hospital_id=hosp1.id,
        status="MEDICALLY_APPROVED",
        blockchain_tx=None
    )
    # Organ 3: Matched and awaiting retrieval
    org3 = Organ(
        organ_id="ORG-103",
        donor_id=d3.id,
        organ_type="Liver",
        source_hospital_id=hosp3.id,
        destination_hospital_id=hosp3.id,
        status="MATCHED",
        matched_recipient_id=r3.id,
        matched_score=91.0,
        blockchain_tx=None
    )
    db.add_all([org1, org2, org3])
    db.commit()

    # Organ Movement Timeline for ORG-101
    t0 = now - datetime.timedelta(hours=14)
    m1 = OrganMovement(organ_id=org1.id, stage="RETRIEVED", location="Apollo Hospital OT-3", actor_name="Dr. Ananya Roy", actor_role="DONOR_SURGEON", notes="Cold perfusion initiated. Minimal warm ischemia time (12 min).", blockchain_tx=None, timestamp=t0)
    m2 = OrganMovement(organ_id=org1.id, stage="PACKAGED", location="Apollo Surgical Logistics", actor_name="Dr. Ananya Roy", actor_role="DONOR_SURGEON", notes="Preservation in static cold storage box at 4°C with certified logger.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(minutes=35))
    m3 = OrganMovement(organ_id=org1.id, stage="DISPATCHED", location="Apollo Ambulance Bay", actor_name="Rajesh Kumar", actor_role="TRANSPORTER", notes="Green Corridor transport dispatched with police escort.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(hours=1))
    m4 = OrganMovement(organ_id=org1.id, stage="IN_TRANSIT", location="Mathura Road Transit Checkpoint", actor_name="Rajesh Kumar", actor_role="TRANSPORTER", notes="Temperature verified 3.8°C; transit proceeding without incident.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(hours=2))
    m5 = OrganMovement(organ_id=org1.id, stage="DELIVERED", location="AIIMS Emergency Gate 2", actor_name="Rajesh Kumar", actor_role="TRANSPORTER", notes="Handover completed to AIIMS Transplant Coordinator.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(hours=3))
    m6 = OrganMovement(organ_id=org1.id, stage="RECEIVED", location="AIIMS Transplant ICU", actor_name="Dr. Vikram Kapoor", actor_role="TRANSPLANT_SURGEON", notes="Organ inspection intact. Vessel anatomy confirmed suitable.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(hours=3, minutes=30))
    m7 = OrganMovement(organ_id=org1.id, stage="TRANSPLANTED", location="AIIMS Operation Theatre 5", actor_name="Dr. Vikram Kapoor", actor_role="TRANSPLANT_SURGEON", notes="End-to-side arterial anastomosis completed. Immediate perfusion and urine output noted.", blockchain_tx=None, timestamp=t0 + datetime.timedelta(hours=6))
    db.add_all([m1, m2, m3, m4, m5, m6, m7])
    db.commit()

    # MatchRun for ORG-101
    mr = MatchRun(
        match_id="MATCH-DEMO-001",
        organ_id=org1.id,
        donor_id=d1.id,
        recipient_id=r1.id,
        model_version="RF-v1",
        rule_score=95.0,
        ml_score=94.5,
        recommendation="High Compatibility",
        details={
            "abo_check": {"compatible": True, "identical": True, "detail": "ABO identical (O+ -> O+)"},
            "organ_check": {"compatible": True, "detail": "Kidney match"},
            "physio_check": {"age_diff": 4.0, "bmi_diff": 0.8}
        },
        reviewer_id=u_doc.id,
        reviewer_decision="APPROVED",
        reviewer_notes="Candidate has high waiting duration (420 days) and outstanding physiological matching index.",
        reviewed_at=t0 - datetime.timedelta(hours=2),
        blockchain_tx=None
    )
    db.add(mr)

    # Initial Audit Logs
    audit1 = AuditLog(action="PATIENT_WAITING_LIST_REGISTERED", actor_username="dr_kapoor", actor_role="HOSPITAL", resource_type="RECIPIENT", resource_id="REC-201", details="Patient Priya Nair added to Kidney waiting list", blockchain_tx="DEMO-AUDIT-REC-201")
    audit2 = AuditLog(action="DONOR_MEDICAL_APPROVAL", actor_username="dr_sharma", actor_role="HOSPITAL", resource_type="DONOR", resource_id="DON-101", details="Donor medical clearance approved by Lead Clinician", blockchain_tx="DEMO-AUDIT-DON-101")
    audit3 = AuditLog(action="MATCH_CONFIRMED_BY_REVIEWER", actor_username="dr_sharma", actor_role="ORGAN_MATCHING_ORGANIZER", resource_type="MATCH", resource_id="MATCH-DEMO-001", details="Reviewer confirmed matching allocation based on RF-v1 decision support", blockchain_tx="DEMO-AUDIT-MATCH-001")
    audit4 = AuditLog(action="ORGAN_LIFECYCLE_TRANSPLANTED", actor_username="dr_kapoor", actor_role="TRANSPLANT_SURGEON", resource_type="ORGAN", resource_id="ORG-101", details="Transplantation surgery concluded successfully", blockchain_tx="DEMO-AUDIT-ORG-101")
    db.add_all([audit1, audit2, audit3, audit4])

    # Model Version Record
    model_info = ml_service.get_model_info()
    if model_info and "metrics" in model_info:
        m_rec = ModelVersionRecord(
            version_tag="RF-v1",
            model_name="Random Forest Compatibility Classifier",
            training_date="2026-10-04",
            dataset_name="simK Synthetic Kidney Transplantation Dataset",
            accuracy=model_info["metrics"]["accuracy"],
            precision_score=model_info["metrics"]["precision"],
            recall_score=model_info["metrics"]["recall"],
            f1_score=model_info["metrics"]["f1_score"],
            metrics_json=model_info["metrics"],
            feature_importance_json=model_info.get("feature_importance", {})
        )
        db.add(m_rec)

    db.commit()
    db.close()
    print("[SUCCESS] Database successfully initialized and seeded with verified research demonstration data!")

if __name__ == "__main__":
    seed_database()
