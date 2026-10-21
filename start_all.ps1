# Organ Donation & Transplantation Management System Startup Script (PowerShell)
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "Starting Organ Donation & Transplantation Management System" -ForegroundColor Green
Write-Host "IEEE Research Prototype: Permissioned Ledger + Random Forest Decision Support" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Start Hardhat Node
Write-Host "`n[1/3] Starting Local Blockchain Node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/blockchain'; npx hardhat node"

Start-Sleep -Seconds 5

# 2. Deploy Contracts
Write-Host "[2/3] Deploying Smart Contracts..." -ForegroundColor Yellow
Push-Location "$Root/blockchain"
npx hardhat run scripts/deploy.js --network localhost
Pop-Location

# 3. Start Backend
Write-Host "[3/4] Launching FastAPI Backend on Port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 4. Start Frontend
Write-Host "[4/4] Launching Vite React Frontend on Port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/frontend'; npm run dev"

Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "All system tiers launched!" -ForegroundColor Green
Write-Host "Frontend Portal:  http://localhost:5173" -ForegroundColor White
Write-Host "Interactive Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "Blockchain Node:  http://127.0.0.1:8545" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green
