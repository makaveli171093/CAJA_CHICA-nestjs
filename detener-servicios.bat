@echo off
chcp 65001 >nul
setlocal
set "BASE_DIR=%~dp0"

echo ================================================================
echo           CAJA PETROLERA DE SALUD - CAJA CHICA
echo                 Deteniendo Servicios...
echo ================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ports = @(3000, 80); " ^
    "$killed = 0; " ^
    "foreach ($port in $ports) { " ^
    "    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; " ^
    "    foreach ($c in $conns) { " ^
    "        $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; " ^
    "        if ($p) { " ^
    "            Write-Host ('   - Deteniendo proceso ' + $p.ProcessName + ' (PID: ' + $p.Id + ') en puerto ' + $port) -ForegroundColor Yellow; " ^
    "            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; " ^
    "            $killed++; " ^
    "        } " ^
    "    } " ^
    "}; " ^
    "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'Caja Chica - (Backend|Frontend)' } | ForEach-Object { " ^
    "    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; " ^
    "}; " ^
    "if ($killed -gt 0) { Write-Host '`n[OK] Procesos detenidos con exito.' -ForegroundColor Green } else { Write-Host '   No habia procesos ocupando los puertos 3000 u 80.' -ForegroundColor Gray }"

if "%1"=="--silent" goto :eof

echo.
echo ================================================================
echo           TODOS LOS SERVICIOS HAN SIDO DETENIDOS
echo ================================================================
echo.
pause
