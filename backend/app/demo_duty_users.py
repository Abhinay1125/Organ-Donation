"""Shared demo account details for hospital duty users."""

DUTY_DEMO_USERS = (
    {
        "username": "dr_mehta",
        "email": "mehta@apollo.example.test",
        "full_name": "Dr. Kavya Mehta (Patient Doctor)",
        "operational_role": "PATIENT_DOCTOR",
        "hospital_code": "HOSP-APOLLO",
        "password_env": "DEMO_PATIENT_DOCTOR_PASSWORD",
    },
    {
        "username": "dr_iyer_aiims",
        "email": "leela.iyer@aiims.example.test",
        "full_name": "Dr. Leela Iyer (Patient Doctor)",
        "operational_role": "PATIENT_DOCTOR",
        "hospital_code": "HOSP-AIIMS",
        "password_env": "DEMO_AIIMS_PATIENT_DOCTOR_PASSWORD",
    },
    {
        "username": "procurement_rao",
        "email": "rao.procurement@apollo.example.test",
        "full_name": "Nikhil Rao (Procurement Organizer)",
        "operational_role": "PROCUREMENT_ORGANIZER",
        "hospital_code": "HOSP-APOLLO",
        "password_env": "DEMO_PROCUREMENT_ORGANIZER_PASSWORD",
    },
)
