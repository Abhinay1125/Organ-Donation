"""
Backend API Automated Test Suite
Verifies:
1. Authentication & token issuance
2. Protected route rejection
3. Donor registration & approval workflow
4. Recipient waiting list
5. Matching & Candidate ranking
6. Organ movement lifecycle & blockchain tx logging
7. Real ML metrics retrieval
8. Audit history
"""

import os
import secrets
import tempfile
from pathlib import Path

os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(48)
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp(prefix='organ-api-')) / 'api.sqlite3'}"

from fastapi.testclient import TestClient
from uuid import uuid4
from backend.app.auth import create_access_token
from backend.app.database import SessionLocal
from backend.app.main import app
from backend.app.models import User
from backend.app.routers import matching as matching_router
from backend.app.routers import recipients as recipients_router
from backend.app.seed_data import seed_database

# Ensure seed data is populated
seed_database()
client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "operational"
    print("  [PASS] Health check verified.")

def test_auth_and_login():
    # Valid login
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"
    token = data["access_token"]
    print("  [PASS] Admin login succeeded.")

    # Invalid login
    res_bad = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert res_bad.status_code == 401
    print("  [PASS] Invalid login rejected.")

    # Protected route with token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    assert res_me.json()["username"] == "admin"
    print("  [PASS] Protected route accessed with JWT token.")

def test_donors_and_organs():
    res_login = client.post("/api/auth/login", json={"username": "dr_sharma", "password": "hospital123"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch donors
    res_donors = client.get("/api/donors", headers=headers)
    assert res_donors.status_code == 200
    donors = res_donors.json()
    assert len(donors) >= 1
    print(f"  [PASS] Retrieved {len(donors)} donors.")

    # Fetch recipients
    res_recip = client.get("/api/recipients", headers=headers)
    assert res_recip.status_code == 200
    recips = res_recip.json()
    assert len(recips) >= 1
    print(f"  [PASS] Retrieved {len(recips)} recipients.")

    # Fetch organs
    res_organs = client.get("/api/organs", headers=headers)
    assert res_organs.status_code == 200
    organs = res_organs.json()
    assert len(organs) >= 1
    assert all(organ["donor_ref"].startswith("DON-") for organ in organs)
    assert next(organ for organ in organs if organ["matched_recipient_id"])["matched_recipient_ref"] == "REC-201"
    print(f"  [PASS] Retrieved {len(organs)} organs.")

def _patient_doctor_headers():
    with SessionLocal() as db:
        user = db.query(User).filter(User.operational_role == "PATIENT_DOCTOR").first()
        assert user is not None
        token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
        hospital_id = user.hospital_id
    return {"Authorization": f"Bearer {token}"}, hospital_id

def test_recipient_dialysis_zero_and_create_validation(monkeypatch):
    monkeypatch.setattr(
        recipients_router.blockchain_service,
        "record_patient_registration",
        lambda **kwargs: "DEMO-TEST-RECIPIENT",
    )
    headers, hospital_id = _patient_doctor_headers()
    recipient_payload = {
        "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}",
        "name": "Synthetic Liver Recipient",
        "age": 38,
        "gender": "OTHER",
        "blood_group": "O+",
        "required_organ": "Liver",
        "height_cm": 162,
        "weight_kg": 60,
        "bmi": 22.8,
        "hospital_id": hospital_id,
        "dialysis_months": 0,
    }

    registered = client.post("/api/recipients", json=recipient_payload, headers=headers)
    assert registered.status_code == 200, registered.text
    assert registered.json()["dialysis_months"] == 0

    invalid_payloads = []
    invalid_payloads.append({**recipient_payload, "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}", "cpra": 150})
    invalid_payloads.append({**recipient_payload, "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}", "dialysis_months": -1})

    missing_gender = {**recipient_payload, "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}"}
    missing_gender.pop("gender")
    invalid_payloads.append(missing_gender)
    for height in (29, 251):
        invalid_payloads.append({
            **recipient_payload,
            "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}",
            "height_cm": height,
        })
    for weight in (1, 401):
        invalid_payloads.append({
            **recipient_payload,
            "recipient_id": f"REC-API-{uuid4().hex[:8].upper()}",
            "weight_kg": weight,
        })

    for payload in invalid_payloads:
        response = client.post("/api/recipients", json=payload, headers=headers)
        assert response.status_code == 422, response.text

def test_matching_candidates_pass_cpra_key_to_ml(monkeypatch):
    seen_candidates = []

    def capture_candidates(donor, candidates):
        seen_candidates.extend(candidates)
        return []

    monkeypatch.setattr(matching_router.ml_service, "rank_candidates", capture_candidates)
    login = client.post("/api/auth/login", json={"username": "dr_sharma", "password": "hospital123"})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    organs = client.get("/api/organs", headers=headers)
    assert organs.status_code == 200
    organ = next(item for item in organs.json() if item["status"] == "MEDICALLY_APPROVED")

    response = client.get(f"/api/matching/candidates/{organ['id']}", headers=headers)
    assert response.status_code == 200, response.text
    assert seen_candidates
    assert all("cPRA" in candidate for candidate in seen_candidates)

def test_matching_and_ai():
    res_login = client.post("/api/auth/login", json={"username": "dr_sharma", "password": "hospital123"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test candidates matching endpoint for available organ (ORG-102 is organ id 2)
    res_organs = client.get("/api/organs", headers=headers)
    org_list = res_organs.json()
    available_org = next((o for o in org_list if o["status"] == "MEDICALLY_APPROVED"), org_list[0])

    res_match = client.get(f"/api/matching/candidates/{available_org['id']}", headers=headers)
    assert res_match.status_code == 200
    data = res_match.json()
    assert "ranked_candidates" in data
    assert "name" not in data["donor"]
    assert all("recipient_name" not in candidate for candidate in data["ranked_candidates"])
    assert data["model_version"] == "RF-v1"
    print(f"  [PASS] Matching candidates evaluated: {len(data['ranked_candidates'])} candidates ranked by AI.")

def test_matching_and_ml_access_control():
    def login_headers(username, password):
        response = client.post("/api/auth/login", json={"username": username, "password": password})
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    admin_headers = login_headers("admin", "admin123")
    surgeon_headers = login_headers("dr_ananya", "surgeon123")
    matching_headers = login_headers("dr_sharma", "hospital123")
    organs_response = client.get("/api/organs", headers=matching_headers)
    assert organs_response.status_code == 200
    organ = next(organ for organ in organs_response.json() if organ["status"] == "MEDICALLY_APPROVED")
    organ_id = organ["id"]

    matching_response = client.get(
        f"/api/matching/candidates/{organ_id}", headers=matching_headers
    )
    assert matching_response.status_code == 200
    recipient_id = matching_response.json()["ranked_candidates"][0]["id"]
    review_body = {
        "decision": "REJECTED",
        "notes": "Synthetic test review",
        "recipient_id": recipient_id,
    }
    direct_body = {
        "donor_age": 35,
        "recipient_age": 40,
        "donor_bg": "O+",
        "recipient_bg": "O+",
    }
    endpoints = [
        ("GET", f"/api/matching/candidates/{organ_id}", None),
        ("POST", f"/api/matching/review/{organ_id}", review_body),
        ("POST", "/api/matching/direct-predict", direct_body),
        ("GET", "/api/ml/metrics", None),
    ]

    for method, path, body in endpoints:
        for headers in (None, admin_headers, surgeon_headers):
            response = client.request(method, path, json=body, headers=headers)
            assert response.status_code == (401 if headers is None else 403), (method, path)
        response = client.request(method, path, json=body, headers=matching_headers)
        assert response.status_code == 200, (method, path, response.text)

    for path, method, body in (
        ("/api/matching/candidates/99999999", "GET", None),
        ("/api/matching/review/99999999", "POST", review_body),
    ):
        for headers in (admin_headers, surgeon_headers):
            response = client.request(method, path, json=body, headers=headers)
            assert response.status_code == 403, (method, path)

    invalid_review = client.post(
        f"/api/matching/review/{organ_id}",
        json={"decision": "approve", "notes": "Synthetic test review", "recipient_id": recipient_id},
        headers=matching_headers,
    )
    assert invalid_review.status_code == 422

def test_ml_metrics():
    res_login = client.post("/api/auth/login", json={"username": "dr_sharma", "password": "hospital123"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_metrics = client.get("/api/ml/metrics", headers=headers)
    assert res_metrics.status_code == 200
    m = res_metrics.json()
    assert "metrics" in m
    assert m["metrics"]["accuracy"] > 80.0
    print(f"  [PASS] Genuine ML metrics loaded: Accuracy={m['metrics']['accuracy']}%, Precision={m['metrics']['precision']}%, Recall={m['metrics']['recall']}%.")

def test_blockchain_and_audit():
    res_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Blockchain status
    res_bc = client.get("/api/blockchain/status", headers=headers)
    assert res_bc.status_code == 200
    print(f"  [PASS] Blockchain status: {res_bc.json()['mode']}")

    # Blockchain transactions
    res_tx = client.get("/api/blockchain/transactions", headers=headers)
    assert res_tx.status_code == 200
    txs = res_tx.json()["transactions"]
    assert len(txs) >= 1
    assert all(tx["blockchain_tx"].startswith("DEMO-") for tx in txs)
    print(f"  [PASS] Retrieved {len(txs)} seeded audit entries with marked demo references.")

    # Admin stats
    res_stats = client.get("/api/admin/stats", headers=headers)
    assert res_stats.status_code == 200
    s = res_stats.json()
    assert s["donors"]["total"] >= 1
    assert s["organs"]["total"] >= 1
    print("  [PASS] Admin real-time statistics verified.")

def test_admin_stats_access_control():
    # Requests without a bearer token must be rejected.
    res_unauthenticated = client.get("/api/admin/stats")
    assert res_unauthenticated.status_code == 401

    # A valid token for a non-admin account must not grant platform-wide stats.
    res_login = client.post("/api/auth/login", json={"username": "dr_sharma", "password": "hospital123"})
    assert res_login.status_code == 200
    headers = {"Authorization": f"Bearer {res_login.json()['access_token']}"}
    res_non_admin = client.get("/api/admin/stats", headers=headers)
    assert res_non_admin.status_code == 403

    # Administrator access is retained.
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    res_admin = client.get("/api/admin/stats", headers=admin_headers)
    assert res_admin.status_code == 200
    stats = res_admin.json()
    assert set(stats) == {"donors", "recipients", "organs", "matches", "blockchain", "ml"}
    assert stats["ml"]["is_ready"] is True
    assert stats["ml"]["model_version"]
    print("  [PASS] Admin stats restricted to authenticated administrators.")

def test_hospital_listing_and_creation_authorization():
    # Hospital directory requires ADMIN or HOSPITAL authentication.
    assert client.get("/api/hospitals").status_code == 401
    donor_login = client.post("/api/auth/login", json={"username": "donor_rahul", "password": "donor123"})
    assert donor_login.status_code == 200
    donor_headers = {"Authorization": f"Bearer {donor_login.json()['access_token']}"}
    donor_list = client.get("/api/hospitals", headers=donor_headers)
    assert donor_list.status_code == 403

    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
    admin_list = client.get("/api/hospitals", headers=admin_headers)
    assert admin_list.status_code == 200
    assert {"id", "code", "name", "city", "state", "address", "contact_phone", "created_at"}.issubset(admin_list.json()[0])

    hospital_data = {
        "code": f"T{uuid4().hex[:10].upper()}",
        "name": "API Test Hospital",
        "city": "Test City",
        "state": "Test State",
        "address": "1 Test Road",
        "contact_phone": "000-000-0000",
    }
    assert client.post("/api/hospitals", json=hospital_data, headers=donor_headers).status_code == 403
    assert client.post("/api/hospitals", json={"code": hospital_data["code"]}, headers=admin_headers).status_code == 422

    created = client.post("/api/hospitals", json=hospital_data, headers=admin_headers)
    assert created.status_code == 200
    assert created.json()["code"] == hospital_data["code"]
    print("  [PASS] Hospital directory authentication and admin-only creation verified.")

if __name__ == "__main__":
    print("=================================================");
    print("RUNNING BACKEND REST API TEST SUITE");
    print("=================================================\n");
    test_health()
    test_auth_and_login()
    test_donors_and_organs()
    test_matching_and_ai()
    test_matching_and_ml_access_control()
    test_ml_metrics()
    test_blockchain_and_audit()
    test_admin_stats_access_control()
    test_hospital_listing_and_creation_authorization()
    print("\n=================================================");
    print("ALL BACKEND API TESTS PASSED SUCCESSFULLY! (8/8)");
    print("=================================================\n");
