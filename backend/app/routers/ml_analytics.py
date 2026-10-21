from fastapi import APIRouter, Depends
from backend.app.auth import require_roles
from ml.model import ml_service

router = APIRouter(prefix="/api/ml", tags=["ML Analytics"])

@router.get("/metrics")
def get_ml_metrics(current_user = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    """
    Returns actual evaluated metrics from genuine execution of Random Forest on held-out test data.
    Never fabricated: Accuracy, Precision, Recall, F1, Confusion Matrix, Feature Importance.
    """
    return ml_service.get_model_info()
