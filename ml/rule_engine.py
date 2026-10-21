"""
Rule-Based Screening Engine for Organ Matching (Layer 1)
Transparent baseline compatibility screening based on clinical and protocol rules.
Provides deterministic, explainable pass/fail criteria before ML decision support.
"""

def parse_blood_group(bg_str: str):
    """Normalize blood group strings like 'A+', 'O Negative', 'B Positive'."""
    if not bg_str:
        return ("O", "+")
    s = bg_str.strip().upper()
    s = s.replace("POSITIVE", "+").replace("NEGATIVE", "-").replace(" ", "")
    
    rh = "-" if "-" in s else "+"
    abo = s.replace("+", "").replace("-", "")
    if abo not in ["A", "B", "AB", "O"]:
        abo = "O"
    return abo, rh

def check_abo_compatibility(donor_bg: str, recipient_bg: str) -> dict:
    """
    Checks ABO compatibility.
    O -> O, A, B, AB (Universal donor)
    A -> A, AB
    B -> B, AB
    AB -> AB only
    """
    d_abo, d_rh = parse_blood_group(donor_bg)
    r_abo, r_rh = parse_blood_group(recipient_bg)

    identical = (d_abo == r_abo)
    compatible = False

    if d_abo == "O":
        compatible = True
    elif d_abo == "A" and r_abo in ["A", "AB"]:
        compatible = True
    elif d_abo == "B" and r_abo in ["B", "AB"]:
        compatible = True
    elif d_abo == "AB" and r_abo == "AB":
        compatible = True

    return {
        "compatible": compatible,
        "identical": identical,
        "donor_abo": d_abo,
        "recipient_abo": r_abo,
        "donor_rh": d_rh,
        "recipient_rh": r_rh,
        "detail": "ABO identical" if identical else ("ABO compatible" if compatible else "ABO incompatible")
    }

def check_organ_type_compatibility(donor_organ: str, recipient_required: str) -> dict:
    """Checks if requested organ type matches the donor organ."""
    d_org = donor_organ.strip().lower() if donor_organ else ""
    r_org = recipient_required.strip().lower() if recipient_required else ""
    compatible = (d_org == r_org) and len(d_org) > 0
    return {
        "compatible": compatible,
        "detail": "Organ types match perfectly" if compatible else f"Organ mismatch: donor has {donor_organ}, patient requires {recipient_required}"
    }

def check_physiological_constraints(donor_age: float, recipient_age: float,
                                     donor_bmi: float = 24.0, recipient_bmi: float = 24.0) -> dict:
    """
    Evaluates age difference and BMI constraints.
    Research prototype parameters:
    - Age difference acceptable up to 35 years
    - BMI difference acceptable up to 12 kg/m^2
    """
    age_diff = abs(donor_age - recipient_age)
    bmi_diff = abs(donor_bmi - recipient_bmi)

    age_pass = age_diff <= 35
    bmi_pass = bmi_diff <= 14

    return {
        "age_difference": age_diff,
        "age_compatible": age_pass,
        "bmi_difference": bmi_diff,
        "bmi_compatible": bmi_pass,
        "detail": f"Age diff {age_diff:.0f} yrs ({'OK' if age_pass else 'High'}), BMI diff {bmi_diff:.1f} ({'OK' if bmi_pass else 'High'})"
    }

def evaluate_rule_baseline(donor: dict, recipient: dict) -> dict:
    """
    Complete Layer 1 Rule-Based Evaluation.
    Returns:
    - overall_passed: bool
    - score: float (0 - 100)
    - breakdown: dict of component checks
    - explanations: list of human-readable statements
    """
    abo_check = check_abo_compatibility(donor.get("blood_group", "O+"), recipient.get("blood_group", "O+"))
    organ_check = check_organ_type_compatibility(donor.get("organ_type", ""), recipient.get("organ_type", ""))
    
    d_age = float(donor.get("age", 40))
    r_age = float(recipient.get("age", 40))
    d_bmi = float(donor.get("bmi", 24.0))
    r_bmi = float(recipient.get("bmi", 24.0))
    physio_check = check_physiological_constraints(d_age, r_age, d_bmi, r_bmi)

    explanations = []
    if not organ_check["compatible"]:
        explanations.append(f"REJECTED: {organ_check['detail']}")
    else:
        explanations.append("PASSED: Organ type matches requirement")

    if not abo_check["compatible"]:
        explanations.append(f"REJECTED: {abo_check['detail']}")
    else:
        explanations.append(f"PASSED: {abo_check['detail']}")

    if not physio_check["age_compatible"]:
        explanations.append(f"WARNING: Large age disparity ({physio_check['age_difference']:.0f} years)")
    else:
        explanations.append(f"PASSED: Age criteria satisfied ({physio_check['age_difference']:.0f} yr diff)")

    if not physio_check["bmi_compatible"]:
        explanations.append(f"WARNING: High BMI discrepancy ({physio_check['bmi_difference']:.1f})")
    else:
        explanations.append(f"PASSED: BMI compatibility within acceptable limits")

    overall_passed = organ_check["compatible"] and abo_check["compatible"]

    # Calculate baseline rule score
    base_score = 0.0
    if organ_check["compatible"]:
        base_score += 30.0
    if abo_check["compatible"]:
        base_score += 40.0 if abo_check["identical"] else 25.0
    if physio_check["age_compatible"]:
        age_bonus = max(0.0, 15.0 - (physio_check["age_difference"] * 0.4))
        base_score += age_bonus
    if physio_check["bmi_compatible"]:
        bmi_bonus = max(0.0, 15.0 - (physio_check["bmi_difference"] * 0.8))
        base_score += bmi_bonus

    return {
        "passed": overall_passed,
        "rule_score": round(base_score, 1),
        "abo_check": abo_check,
        "organ_check": organ_check,
        "physio_check": physio_check,
        "explanations": explanations
    }
