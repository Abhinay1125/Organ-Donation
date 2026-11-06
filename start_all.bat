@echo off
TITLE Organ Donation & Transplantation Management System (Blockchain & AI Framework)
echo ===============================================================================
echo Starting Organ Donation & Transplantation Management System
echo IEEE Research Prototype: Permissioned Ledger + Random Forest Decision Support
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Local Blockchain Node (Hardhat)...
start "Blockchain Node" cmd /k "cd blockchain && npx hardhat node"

echo Waiting 5 seconds for Hardhat node initialization...
timeout /t 5 /nobreak >nul

echo [2/3] Deploying Smart Contracts to Local Node...
start /wait cmd /c "cd blockchain && npx hardhat run scripts/deploy.js --network localhost"

echo [3/3] Launching FastAPI Backend Server (Port 8000)...
start "FastAPI Backend" cmd /k "cd backend && python -m uvicorn app.main:app --host localhost --port 8000 --reload"

echo [4/4] Launching React Enterprise Frontend (Port 5173)...
start "React Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===============================================================================
echo All system services have been launched in dedicated terminal windows!
echo - Frontend Application: http://localhost:5173
echo - Backend REST API:     http://localhost:8000/docs
echo - Blockchain JSON-RPC:  http://127.0.0.1:8545
echo.
echo Default Demo Credentials:
echo - Administrator:       admin / admin123
echo - Matching Lead:       dr_sharma / hospital123
echo - Donor Surgeon:       dr_ananya / surgeon123
echo - Medical Courier:     courier_med / transit123
echo ===============================================================================
pause
