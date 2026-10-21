import os
import sys
from pathlib import Path

# Ensure workspace root is in sys.path so 'backend.app...' and 'ml...' imports always resolve
WORKSPACE_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database import engine, Base
from backend.app.seed_data import seed_database
from backend.app.routers import (
    auth, hospitals, donors, recipients,
    organs, matching, blockchain, audit, admin, ml_analytics
)

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Blockchain & AI Organ Donation Management System",
    description="Research prototype implementing the IEEE framework for secure, transparent organ donation and transplantation management.",
    version="1.0.0"
)

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(hospitals.router)
app.include_router(donors.router)
app.include_router(recipients.router)
app.include_router(organs.router)
app.include_router(matching.router)
app.include_router(ml_analytics.router)
app.include_router(blockchain.router)
app.include_router(audit.router)
app.include_router(admin.router)

@app.on_event("startup")
def on_startup():
    seed_database()

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "Organ Donation & Transplantation Management System API is running.",
        "interactive_docs": "/docs",
        "health_check": "/api/health",
        "frontend_portal": "http://localhost:5173"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "operational",
        "service": "Blockchain & AI Organ Donation Platform",
        "version": "1.0.0",
        "architecture": "Rule Screening + Random Forest ML (RF-v1) + Authorized Review + Permissioned Ledger"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
