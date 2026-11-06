from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: Literal["ADMIN", "HOSPITAL", "DONOR", "RECIPIENT"] = "HOSPITAL"
    operational_role: Optional[Literal["ADMIN", "ORGAN_MATCHING_ORGANIZER", "DONOR_SURGEON", "TRANSPORTER", "TRANSPLANT_SURGEON", "PATIENT_DOCTOR", "PROCUREMENT_ORGANIZER", "DONOR", "RECIPIENT"]] = None
    hospital_id: Optional[int] = None
    eth_address: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Literal["ADMIN", "HOSPITAL", "DONOR", "RECIPIENT"]] = None
    operational_role: Optional[Literal["ADMIN", "ORGAN_MATCHING_ORGANIZER", "DONOR_SURGEON", "TRANSPORTER", "TRANSPLANT_SURGEON", "PATIENT_DOCTOR", "PROCUREMENT_ORGANIZER", "DONOR", "RECIPIENT"]] = None
    hospital_id: Optional[int] = None
    eth_address: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    operational_role: Optional[str]
    hospital_id: Optional[int]
    eth_address: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Hospital Schemas
class HospitalCreate(BaseModel):
    code: str
    name: str
    city: str
    state: str
    address: Optional[str] = None
    contact_phone: Optional[str] = None

class HospitalResponse(BaseModel):
    id: int
    code: str
    name: str
    city: str
    state: str
    address: Optional[str]
    contact_phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class HospitalDirectoryResponse(BaseModel):
    id: int
    name: str
    city: str
    code: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Donor Schemas
class DonorCreate(BaseModel):
    donor_id: str
    name: str
    age: int = Field(ge=0, le=120)
    gender: str
    blood_group: str
    organ_type: str
    height_cm: Optional[float] = Field(default=None, ge=30, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=2, le=400)
    bmi: float = Field(ge=5, le=100)
    hospital_id: int
    medical_notes: Optional[str] = None

class DonorApproval(BaseModel):
    is_approved: bool
    medical_notes: str

class DonorResponse(BaseModel):
    id: int
    donor_id: str
    name: str
    age: int
    gender: str
    blood_group: str
    organ_type: str
    height_cm: Optional[float]
    weight_kg: Optional[float]
    bmi: float
    hospital_id: int
    status: str
    is_medically_approved: bool
    medical_notes: Optional[str]
    blockchain_tx: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Recipient Schemas
class RecipientCreate(BaseModel):
    recipient_id: str
    name: str
    age: int = Field(ge=0, le=120)
    gender: str
    blood_group: str
    required_organ: str
    height_cm: Optional[float] = Field(default=None, ge=30, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=2, le=400)
    bmi: float = Field(ge=5, le=100)
    hospital_id: int
    cpra: Optional[float] = Field(default=0.0, ge=0, le=100)
    dialysis_months: Optional[float] = Field(default=0.0, ge=0)
    urgency_tier: Optional[str] = "STANDARD"

class RecipientResponse(BaseModel):
    id: int
    recipient_id: str
    name: str
    age: int
    gender: str
    blood_group: str
    required_organ: str
    height_cm: Optional[float]
    weight_kg: Optional[float]
    bmi: float
    hospital_id: int
    waiting_since: datetime
    status: str
    cpra: float
    dialysis_months: float
    urgency_tier: str
    blockchain_tx: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Organ Schemas
class OrganRegister(BaseModel):
    organ_id: str
    donor_id: int
    organ_type: str
    source_hospital_id: int

class OrganResponse(BaseModel):
    id: int
    organ_id: str
    donor_id: int
    donor_ref: Optional[str] = None
    organ_type: str
    source_hospital_id: int
    destination_hospital_id: Optional[int]
    status: str
    matched_recipient_id: Optional[int]
    matched_recipient_ref: Optional[str] = None
    matched_score: Optional[float]
    blockchain_tx: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Movement Stage Schema
class OrganMovementCreate(BaseModel):
    stage: str # RETRIEVED, PACKAGED, DISPATCHED, IN_TRANSIT, RECEIVED, TRANSPLANTED
    location: str
    notes: Optional[str] = None
    destination_hospital_id: Optional[int] = None
    current_stage: Optional[str] = None

class OrganMovementResponse(BaseModel):
    id: int
    organ_id: int
    stage: str
    location: str
    actor_name: str
    actor_role: str
    notes: Optional[str]
    blockchain_tx: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True

# Matching Review Schemas
class MatchReviewRequest(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    notes: str
    recipient_id: int

class DirectMLPredictRequest(BaseModel):
    donor_age: float
    recipient_age: float
    donor_bg: str
    recipient_bg: str
    donor_bmi: Optional[float] = 24.0
    recipient_bmi: Optional[float] = 24.0
    organ_type: Optional[str] = "Kidney"
    dialysis_months: Optional[float] = 24.0
    cPRA: Optional[float] = 0.0

class AuditLogResponse(BaseModel):
    id: int
    action: str
    actor_username: str
    actor_role: str
    resource_type: str
    resource_id: str
    details: Optional[str]
    blockchain_tx: Optional[str]
    ip_address: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
