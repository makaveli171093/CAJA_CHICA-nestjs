# ================================================================
#           CAJA PETROLERA DE SALUD - CAJA CHICA
#                 Deteniendo Servicios...
# ================================================================

$ports = @(3000, 80)
$killed = 0

foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "   - Deteniendo $($proc.ProcessName) (PID: $($proc.Id)) en puerto $port..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }
}

# Cerrar consolas asociadas si siguen abiertas
Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match 'Caja Chica - (Backend|Frontend)' } | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

if ($killed -gt 0) {
    Write-Host "`n[OK] Todos los servicios de Caja Chica han sido detenidos exitosamente.`n" -ForegroundColor Green
} else {
    Write-Host "`n   No habia procesos activos en los puertos 3000 u 80.`n" -ForegroundColor Gray
}
