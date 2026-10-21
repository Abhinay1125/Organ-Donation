"""
Unit Tests for ML Decision Support Layer and Rule Engine
"""

from ml.rule_engine import (
    check_abo_compatibility,
    check_organ_type_compatibility,
    check_physiological_constraints,
    evaluate_rule_baseline
)
from ml.model import ml_service

def test_abo():
    print("Testing ABO compatibility rules...")
    # O can give to O, A, B, AB
    assert check_abo_compatibility("O+", "A+")["compatible"] is True
    assert check_abo_compatibility("O+", "O+")["identical"] is True
    # A can give to A, AB but not B
    assert check_abo_compatibility("A+", "B+")["compatible"] is False
    assert check_abo_compatibility("A+", "AB+")["compatible"] is True
    print("  [PASS] ABO compatibility logic verified.")

def test_organ():
    print("Testing organ compatibility...")
    assert check_organ_type_compatibility("Kidney", "Kidney")["compatible"] is True
    assert check_organ_type_compatibility("Kidney", "Liver")["compatible"] is False
    print("  [PASS] Organ type compatibility verified.")

def test_model_inference():
    print("Testing Random Forest inference & decision support...")
    assert ml_service.is_ready() is True
    donor = {
        "donor_id": "D-101",
        "blood_group": "O+",
        "organ_type": "Kidney",
        "age": 35,
        "bmi": 23.5
    }
    compatible_recipient = {
        "recipient_id": "R-201",
        "blood_group": "O+",
        "organ_type": "Kidney",
        "age": 38,
        "bmi": 24.0,
        "dialysis": 18.0
    }
    incompatible_recipient = {
        "recipient_id": "R-202",
        "blood_group": "B+",
        "organ_type": "Liver",
        "age": 70,
        "bmi": 32.0,
        "dialysis": 60.0
    }

    res_comp = ml_service.predict_pair(donor, compatible_recipient)
    assert res_comp["rule_screening"]["passed"] is True
    assert res_comp["compatibility_score"] >= 70.0
    assert res_comp["model_version"] == "RF-v1"
    print(f"  [PASS] Compatible candidate scored: {res_comp['compatibility_score']}% ({res_comp['recommendation']})")

    res_incomp = ml_service.predict_pair(donor, incompatible_recipient)
    assert res_incomp["rule_screening"]["passed"] is False
    assert res_incomp["compatibility_score"] < 50.0
    print(f"  [PASS] Incompatible candidate correctly rejected: {res_incomp['compatibility_score']}% ({res_incomp['recommendation']})")

def test_candidate_ranking():
    print("Testing Candidate Ranking...")
    donor = {"donor_id": "D-101", "blood_group": "O+", "organ_type": "Kidney", "age": 35, "bmi": 23.5}
    cands = [
        {"recipient_id": "R-1", "name": "Patient 1 (Incompatible Organ)", "blood_group": "O+", "organ_type": "Heart", "age": 40, "bmi": 23, "waiting_days": 100},
        {"recipient_id": "R-2", "name": "Patient 2 (Compatible Good Match)", "blood_group": "O+", "organ_type": "Kidney", "age": 36, "bmi": 24, "waiting_days": 250},
        {"recipient_id": "R-3", "name": "Patient 3 (Compatible High Waiting)", "blood_group": "O+", "organ_type": "Kidney", "age": 37, "bmi": 24, "waiting_days": 500},
    ]
    ranked = ml_service.rank_candidates(donor, cands)
    assert len(ranked) == 3
    # Top ranked must have passed rule screening
    assert ranked[0]["rule_passed"] is True
    assert ranked[-1]["recipient_id"] == "R-1"  # Incompatible organ ranked last
    print(f"  [PASS] Top candidate: {ranked[0]['recipient_name']} with score {ranked[0]['score']}%")

if __name__ == "__main__":
    print("=================================================");
    print("RUNNING MACHINE LEARNING VERIFICATION SUITE");
    print("=================================================\n");
    test_abo()
    test_organ()
    test_model_inference()
    test_candidate_ranking()
    print("\n=================================================");
    print("ALL ML UNIT TESTS PASSED SUCCESSFULLY! (4/4)");
    print("=================================================\n");
