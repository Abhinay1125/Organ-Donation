"""
ML Inference Service (Decision Support Layer)
Integrates Rule-Based Baseline (Layer 1) with Random Forest Model (Layer 2).
Exposes structured prediction, candidate scoring, and feature attribution.
"""

import os
import json
import joblib
import pandas as pd
from typing import Dict, Any, List
from ml.rule_engine import evaluate_rule_baseline

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model_store")
MODEL_PATH = os.path.join(MODEL_DIR, "rf_model_v1.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics_v1.json")

class MLMatchingService:
    def __init__(self):
        self.model = None
        self.metrics = None
        self.model_version = "RF-v1"
        self._load_artifacts()

    def _load_artifacts(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model = joblib.load(MODEL_PATH)
                print(f"[ML Service] Loaded model from {MODEL_PATH}")
            except Exception as e:
                print(f"[ML Service] Error loading model: {e}")
        else:
            print(f"[ML Service] Model file not found at {MODEL_PATH}")

        if os.path.exists(METRICS_PATH):
            try:
                with open(METRICS_PATH, "r") as f:
                    self.metrics = json.load(f)
                self.model_version = self.metrics.get("model_version", "RF-v1")
            except Exception as e:
                print(f"[ML Service] Error loading metrics: {e}")

    def is_ready(self) -> bool:
        return self.model is not None

    def get_model_info(self) -> Dict[str, Any]:
        if not self.metrics:
            return {
                "model_version": self.model_version,
                "status": "Ready" if self.is_ready() else "Not Trained",
                "metrics": None
            }
        return self.metrics

    def predict_pair(self, donor: Dict[str, Any], recipient: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes Two-Layer Compatibility Analysis:
        Layer 1: Rule-Based Screening Baseline
        Layer 2: Random Forest Decision Support Classifier
        """
        # 1. Layer 1 Rule-Based Evaluation
        rule_eval = evaluate_rule_baseline(donor, recipient)

        # 2. Extract features for RF Model
        donor_bg = donor.get("blood_group", "O+").split()[0]
        recipient_bg = recipient.get("blood_group", "O+").split()[0]
        
        d_age = float(donor.get("age", 40))
        r_age = float(recipient.get("age", 40))
        
        # Approximate / clinical mismatch indicators if not explicitly provided
        # In simK: mmA (0-2), mmB (0-2), mmDR (0-2)
        # If identical blood type and close age, estimated mismatch is low
        mm_a = int(donor.get("mmA", 1 if donor_bg != recipient_bg else 0))
        mm_b = int(donor.get("mmB", 1 if donor_bg != recipient_bg else 0))
        mm_dr = int(donor.get("mmDR", 1 if donor_bg != recipient_bg else 0))
        cpra = float(recipient.get("cPRA", 0.0))
        dialysis = float(recipient.get("dialysis", 24.0))

        feature_dict = {
            "donor_age": [d_age],
            "recipient_age": [r_age],
            "donor_bg": [donor_bg],
            "recipient_bg": [recipient_bg],
            "mmA": [mm_a],
            "mmB": [mm_b],
            "mmDR": [mm_dr],
            "cPRA": [cpra],
            "dialysis": [dialysis]
        }
        df_input = pd.DataFrame(feature_dict)

        # 3. Layer 2 Random Forest Inference
        rf_prob = 0.0
        rf_pred = 0
        if self.model is not None:
            try:
                rf_prob = float(self.model.predict_proba(df_input)[0][1])
                rf_pred = int(self.model.predict(df_input)[0])
            except Exception as e:
                print(f"[ML Service] Prediction error: {e}")
                rf_prob = rule_eval["rule_score"] / 100.0
                rf_pred = 1 if rf_prob >= 0.5 else 0
        else:
            rf_prob = rule_eval["rule_score"] / 100.0
            rf_pred = 1 if rf_prob >= 0.5 else 0

        # 4. Integrate Score (Weighted Decision Support Index)
        # Rule baseline acts as prerequisite; ML provides nuanced compatibility weight
        if not rule_eval["passed"]:
            final_score = round(rule_eval["rule_score"] * 0.3, 1)
            recommendation = "Incompatible (Failed Rule Screening)"
            category = "REJECTED"
        else:
            # 40% rule baseline + 60% ML prediction probability
            combined = (rule_eval["rule_score"] * 0.4) + (rf_prob * 100.0 * 0.6)
            final_score = round(combined, 1)
            if final_score >= 80.0:
                recommendation = "High Compatibility"
                category = "HIGH"
            elif final_score >= 60.0:
                recommendation = "Moderate Compatibility"
                category = "MODERATE"
            else:
                recommendation = "Low Compatibility (Caution Advised)"
                category = "LOW"

        feature_importance = self.metrics.get("feature_importance", {}) if self.metrics else {}

        return {
            "model_version": self.model_version,
            "prediction": "Compatible" if rf_pred == 1 and rule_eval["passed"] else "Incompatible",
            "compatibility_score": final_score,
            "rf_probability": round(rf_prob, 4),
            "recommendation": recommendation,
            "recommendation_category": category,
            "rule_screening": rule_eval,
            "feature_importance": feature_importance,
            "input_features": {
                "donor_age": d_age,
                "recipient_age": r_age,
                "donor_blood_group": donor_bg,
                "recipient_blood_group": recipient_bg,
                "donor_bmi": donor.get("bmi", 24.0),
                "recipient_bmi": recipient.get("bmi", 24.0),
                "organ_type": donor.get("organ_type", "Kidney"),
                "estimated_mismatches": f"Proxy from blood-group equality (HLA typing not collected): mmA:{mm_a}, mmB:{mm_b}, mmDR:{mm_dr}",
                "recipient_cpra": cpra,
                "recipient_dialysis_months": dialysis
            },
            "disclaimer": "RESEARCH PROTOTYPE: AI model provides decision support only. Clinical decisions require authorized human review."
        }

    def rank_candidates(self, donor: Dict[str, Any], candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Ranks multiple recipient candidates for a donor organ:
        1. Filters with Rule Baseline
        2. Scores with Random Forest
        3. Sorts by compatibility score and waiting time
        """
        results = []
        for candidate in candidates:
            analysis = self.predict_pair(donor, candidate)
            results.append({
                "recipient_id": candidate.get("recipient_id", ""),
                "recipient_name": candidate.get("name", ""),
                "blood_group": candidate.get("blood_group", ""),
                "age": candidate.get("age", 0),
                "bmi": candidate.get("bmi", 0),
                "organ_type": candidate.get("organ_type", ""),
                "waiting_days": candidate.get("waiting_days", 0),
                "hospital": candidate.get("hospital_name", ""),
                "analysis": analysis,
                "rule_passed": analysis["rule_screening"]["passed"],
                "score": analysis["compatibility_score"],
                "recommendation": analysis["recommendation"]
            })

        # Sort: first rule_passed (True first), then score (descending), then waiting_days (descending)
        results.sort(key=lambda x: (x["rule_passed"], x["score"], x["waiting_days"]), reverse=True)
        return results

# Singleton instance
ml_service = MLMatchingService()
