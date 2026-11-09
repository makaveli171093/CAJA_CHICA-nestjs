# ================================================================
#           CAJA PETROLERA DE SALUD - CAJA CHICA
#                 Iniciando Servicios...
# ================================================================

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Verificar si Node.js está disponible
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no está instalado o no está en el PATH." -ForegroundColor Red
    exit 1
}

# 2. Verificar puertos ocupados
$busy = Get-NetTCPConnection -LocalPort 3000, 80 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "[AVISO] Puertos 3000 u 80 en uso. Deteniendo procesos previos..." -ForegroundColor Yellow
    & "$baseDir\detener-servicios.ps1"
    Start-Sleep -Seconds 2
}

# 3. Iniciar Backend
Write-Host "[1/2] Iniciando Backend API (NestJS - Puerto 3000)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k title Caja Chica - Backend && cd /d `"$baseDir\backend`" && npm run start:dev"

Start-Sleep -Seconds 3

# 4. Iniciar Frontend
Write-Host "[2/2] Iniciando Frontend Web (Vite - Puerto 80)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k title Caja Chica - Frontend && cd /d `"$baseDir\frontend`" && npm run dev"

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "           SERVICIOS INICIADOS CORRECTAMENTE" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "   * URL en tu maquina:   http://cajachica.local.cpslp" -ForegroundColor White
Write-Host "   * URL alternativa:     http://localhost" -ForegroundColor White
Write-Host "   * Backend REST API:    http://localhost:3000/api" -ForegroundColor White
Write-Host "   * Documentacion API:   http://localhost:3000/api/docs" -ForegroundColor White
Write-Host "`n   (Para detenerlos ejecuta: .\detener-servicios.ps1 o detener-servicios.bat)" -ForegroundColor Gray
Write-Host "================================================================`n" -ForegroundColor Green
