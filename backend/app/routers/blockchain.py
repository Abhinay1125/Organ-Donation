from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from backend.app.database import get_db
from backend.app.models import AuditLog, OrganMovement, MatchRun
from backend.app.auth import get_current_user, require_roles
from backend.app.blockchain_service import blockchain_service

router = APIRouter(prefix="/api/blockchain", tags=["Blockchain & Ledger"])

@router.get("/status")
def get_blockchain_status(current_user = Depends(require_roles(["ADMIN", "HOSPITAL"]))):
    return blockchain_service.get_status()

@router.get("/transactions")
def get_recent_blockchain_transactions(db: Session = Depends(get_db), current_user = Depends(require_roles(["ADMIN"]))):
    """
    Returns ledger transactions linked to workflow actions:
    Patient Added, Donor Medical Approval, Donor Registered, Match Generated,
    Organ Removed, Delivery Started, Delivery Completed, Organ Received, Transplantation.
    """
    logs_with_tx = db.query(AuditLog).filter(
        AuditLog.blockchain_tx.isnot(None),
        AuditLog.blockchain_tx != ""
    ).order_by(AuditLog.id.desc()).limit(50).all()

    tx_list = []
    for log in logs_with_tx:
        tx_list.append({
            "id": log.id,
            "action": log.action,
            "actor": log.actor_username,
            "role": log.actor_role,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "blockchain_tx": log.blockchain_tx,
            "timestamp": log.timestamp,
            "details": log.details
        })

    return {
        "status": blockchain_service.get_status(),
        "total_recorded_transactions": len(tx_list),
        "transactions": tx_list
    }
