# Organ Donation & Transplantation Management System Startup Script (PowerShell)
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "Starting Organ Donation & Transplantation Management System" -ForegroundColor Green
Write-Host "IEEE Research Prototype: Permissioned Ledger + Random Forest Decision Support" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Wait-ForPort {
    param([string]$Address, [int]$Port, [int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-NetConnection -ComputerName $Address -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

# 1. Start Hardhat Node
Write-Host "`n[1/4] Starting Local Blockchain Node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/blockchain'; npx hardhat node"

if (-not (Wait-ForPort -Address "127.0.0.1" -Port 8545)) {
    Write-Host "Hardhat node did not open port 8545 within 60 seconds. Aborting." -ForegroundColor Red
    exit 1
}

# 2. Deploy Contracts
Write-Host "[2/4] Deploying Smart Contracts..." -ForegroundColor Yellow
Push-Location "$Root/blockchain"
npx hardhat run scripts/deploy.js --network localhost
$deployExit = $LASTEXITCODE
Pop-Location
if ($deployExit -ne 0) {
    Write-Host "Contract deployment failed (exit code $deployExit). Aborting." -ForegroundColor Red
    exit 1
}

# 3. Start Backend
Write-Host "[3/4] Launching FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/backend'; python -m uvicorn app.main:app --host localhost --port 8000 --reload"

# 4. Start Frontend
Write-Host "[4/4] Launching Vite React Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root/frontend'; npm run dev -- --host localhost --port 5173 --strictPort"

Write-Host "`n===============================================================================" -ForegroundColor Green
Write-Host "All system tiers launched!" -ForegroundColor Green
Write-Host "Frontend Portal:  http://localhost:5173" -ForegroundColor White
Write-Host "Interactive Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "Blockchain Node:  http://127.0.0.1:8545" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green