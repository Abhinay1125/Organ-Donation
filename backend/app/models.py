import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="HOSPITAL")  # ADMIN, HOSPITAL, DONOR, RECIPIENT
    operational_role = Column(String(50), nullable=True) # PATIENT_DOCTOR, DONOR_SURGEON, TRANSPORTER, TRANSPLANT_SURGEON, etc.
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    eth_address = Column(String(42), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    hospital = relationship("Hospital", back_populates="users")

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    address = Column(String(255), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    users = relationship("User", back_populates="hospital")
    donors = relationship("Donor", back_populates="hospital")
    recipients = relationship("Recipient", back_populates="hospital")

class Donor(Base):
    __tablename__ = "donors"

    id = Column(Integer, primary_key=True, index=True)
    donor_id = Column(String(30), unique=True, index=True, nullable=False) # e.g. DON-001
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    blood_group = Column(String(10), nullable=False)
    organ_type = Column(String(50), nullable=False)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    bmi = Column(Float, nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    status = Column(String(30), default="PENDING_APPROVAL") # PENDING_APPROVAL, APPROVED, REJECTED, DONATED
    is_medically_approved = Column(Boolean, default=False)
    medical_notes = Column(Text, nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    hospital = relationship("Hospital", back_populates="donors")
    organs = relationship("Organ", back_populates="donor")

class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(String(30), unique=True, index=True, nullable=False) # e.g. REC-001
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String(20), nullable=False)
    blood_group = Column(String(10), nullable=False)
    required_organ = Column(String(50), nullable=False)
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    bmi = Column(Float, nullable=False)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    waiting_since = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String(30), default="WAITING") # WAITING, MATCHED, TRANSPLANTED, CANCELLED
    cpra = Column(Float, default=0.0) # Calculated Panel Reactive Antibodies
    dialysis_months = Column(Float, default=12.0)
    urgency_tier = Column(String(20), default="STANDARD") # URGENT, STANDARD, ELECTIVE
    blockchain_tx = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    hospital = relationship("Hospital", back_populates="recipients")

class Organ(Base):
    __tablename__ = "organs"

    id = Column(Integer, primary_key=True, index=True)
    organ_id = Column(String(30), unique=True, index=True, nullable=False) # e.g. ORG-001
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    organ_type = Column(String(50), nullable=False)
    source_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False)
    destination_hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)
    status = Column(String(30), default="REGISTERED")
    # States: REGISTERED, MEDICALLY_APPROVED, MATCHED, READY_FOR_RETRIEVAL, RETRIEVED, PACKAGED, DISPATCHED, IN_TRANSIT, RECEIVED, TRANSPLANTED
    matched_recipient_id = Column(Integer, ForeignKey("recipients.id"), nullable=True)
    matched_score = Column(Float, nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    donor = relationship("Donor", back_populates="organs")
    source_hospital = relationship("Hospital", foreign_keys=[source_hospital_id])
    destination_hospital = relationship("Hospital", foreign_keys=[destination_hospital_id])
    matched_recipient = relationship("Recipient", foreign_keys=[matched_recipient_id])
    movements = relationship("OrganMovement", back_populates="organ", cascade="all, delete-orphan")

class OrganMovement(Base):
    __tablename__ = "organ_movements"

    id = Column(Integer, primary_key=True, index=True)
    organ_id = Column(Integer, ForeignKey("organs.id"), nullable=False)
    stage = Column(String(50), nullable=False) # RETRIEVED, PACKAGED, DISPATCHED, IN_TRANSIT, RECEIVED, TRANSPLANTED
    location = Column(String(150), nullable=False)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    organ = relationship("Organ", back_populates="movements")

class MatchRun(Base):
    __tablename__ = "match_runs"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(String(36), unique=True, index=True, nullable=False)
    organ_id = Column(Integer, ForeignKey("organs.id"), nullable=False)
    donor_id = Column(Integer, ForeignKey("donors.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("recipients.id"), nullable=False)
    model_version = Column(String(50), default="RF-v1")
    rule_score = Column(Float, nullable=False)
    ml_score = Column(Float, nullable=False)
    recommendation = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_decision = Column(String(20), default="PENDING") # PENDING, APPROVED, REJECTED
    reviewer_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    actor_username = Column(String(50), nullable=False)
    actor_role = Column(String(50), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    blockchain_tx = Column(String(66), nullable=True)
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ModelVersionRecord(Base):
    __tablename__ = "model_version_records"

    id = Column(Integer, primary_key=True, index=True)
    version_tag = Column(String(50), unique=True, nullable=False)
    model_name = Column(String(100), nullable=False)
    training_date = Column(String(50), nullable=False)
    dataset_name = Column(String(100), nullable=False)
    accuracy = Column(Float, nullable=False)
    precision_score = Column(Float, nullable=False)
    recall_score = Column(Float, nullable=False)
    f1_score = Column(Float, nullable=False)
    metrics_json = Column(JSON, nullable=True)
    feature_importance_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
