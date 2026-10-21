"""
Random Forest Training & Evaluation Pipeline (Layer 2)
Faithfully executes the experimental framework described in the IEEE manuscript.
Saves model artifacts, evaluated metrics, confusion matrix, and feature importances.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

MODEL_VERSION = "RF-v1"
DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset", "organ_matching_dataset.csv")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "model_store")

os.makedirs(MODEL_DIR, exist_ok=True)

def load_and_preprocess_dataset(csv_path: str):
    """Loads dataset and performs validation."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
    print(f"Class distribution: {dict(df['match_label'].value_counts())}")

    return df

def run_experiment_1(df: pd.DataFrame):
    """
    Experiment 1: Random Forest with mismatch & physiological features.
    Features: donor_age, recipient_age, donor_bg, recipient_bg, mmA, mmB, mmDR, cPRA, dialysis.
    Reproduces the simK rule-based compatibility pattern on held-out test data.
    """
    feature_cols = [
        "donor_age", "recipient_age", "donor_bg", "recipient_bg",
        "mmA", "mmB", "mmDR", "cPRA", "dialysis"
    ]
    target_col = "match_label"

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    # Fixed seed for reproducibility - 80% train, 20% test (1014 train, 254 test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    categorical_features = ["donor_bg", "recipient_bg"]
    numerical_features = ["donor_age", "recipient_age", "mmA", "mmB", "mmDR", "cPRA", "dialysis"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("num", "passthrough", numerical_features)
        ]
    )

    rf_clf = RandomForestClassifier(
        n_estimators=200,
        min_samples_leaf=3,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", rf_clf)
    ])

    print("Training Random Forest model (Experiment 1)...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))
    cm = confusion_matrix(y_test, y_pred).tolist()

    tn, fp, fn, tp = cm[0][0], cm[0][1], cm[1][0], cm[1][1]

    print("\n--- EXPERIMENT 1 EVALUATION RESULTS ---")
    print(f"Accuracy : {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall   : {rec * 100:.2f}%")
    print(f"F1-Score : {f1 * 100:.2f}%")
    print(f"Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")

    # Extract Feature Importances
    classifier = pipeline.named_steps["classifier"]
    encoded_cat_names = pipeline.named_steps["preprocessor"].named_transformers_["cat"].get_feature_names_out(categorical_features)
    all_feature_names = list(encoded_cat_names) + numerical_features
    importances = classifier.feature_importances_

    feature_importance_dict = {
        name: float(round(imp * 100, 2))
        for name, imp in sorted(zip(all_feature_names, importances), key=lambda x: x[1], reverse=True)
    }

    # Aggregate by conceptual feature
    conceptual_importances = {}
    for name, imp in feature_importance_dict.items():
        base = name.split("_")[0] if "bg" in name else name
        conceptual_importances[base] = conceptual_importances.get(base, 0.0) + imp
    conceptual_importances = {k: round(v, 2) for k, v in sorted(conceptual_importances.items(), key=lambda x: x[1], reverse=True)}

    # Save Pipeline and Metrics
    model_save_path = os.path.join(MODEL_DIR, "rf_model_v1.joblib")
    joblib.dump(pipeline, model_save_path)
    print(f"Model saved to {model_save_path}")

    metrics_data = {
        "model_version": MODEL_VERSION,
        "model_name": "Random Forest Compatibility Classifier",
        "training_date": "2026-10-04",
        "dataset_name": "simK Synthetic Kidney Transplantation Dataset",
        "dataset_records": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics": {
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1_score": round(f1 * 100, 2),
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
            "confusion_matrix": cm
        },
        "feature_importance": conceptual_importances,
        "detailed_feature_importance": feature_importance_dict,
        "hyperparameters": {
            "n_estimators": 200,
            "min_samples_leaf": 3,
            "class_weight": "balanced",
            "random_state": 42
        }
    }

    metrics_save_path = os.path.join(MODEL_DIR, "metrics_v1.json")
    with open(metrics_save_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Metrics saved to {metrics_save_path}")

    return metrics_data

def run_experiment_2(df: pd.DataFrame):
    """
    Experiment 2: Basic features without mismatch variables (donor_age, recipient_age, donor_bg, recipient_bg, dialysis, cPRA).
    Demonstrates baseline performance when direct mismatch predictors are withheld.
    """
    feature_cols = ["donor_age", "recipient_age", "donor_bg", "recipient_bg", "cPRA", "dialysis"]
    target_col = "match_label"

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    categorical_features = ["donor_bg", "recipient_bg"]
    numerical_features = ["donor_age", "recipient_age", "cPRA", "dialysis"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
            ("num", "passthrough", numerical_features)
        ]
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced"))
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, zero_division=0))
    rec = float(recall_score(y_test, y_pred, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, zero_division=0))

    print("\n--- EXPERIMENT 2 (BASIC FEATURES) RESULTS ---")
    print(f"Accuracy : {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall   : {rec * 100:.2f}%")
    print(f"F1-Score : {f1 * 100:.2f}%")

    return {
        "experiment": "Experiment 2: Basic Features",
        "accuracy": round(acc * 100, 2),
        "precision": round(prec * 100, 2),
        "recall": round(rec * 100, 2),
        "f1_score": round(f1 * 100, 2)
    }

if __name__ == "__main__":
    print("Executing ML Training and Evaluation Pipeline...")
    df = load_and_preprocess_dataset(DATASET_PATH)
    exp1_results = run_experiment_1(df)
    exp2_results = run_experiment_2(df)
    print("\n[SUCCESS] Model training and evaluation completed successfully!")
