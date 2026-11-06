# Script para registrar cajachica.local.cpslp en Windows hosts
$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$entry = "127.0.0.1 cajachica.local.cpslp"

$content = Get-Content -Path $hostsPath -Raw -ErrorAction SilentlyContinue
if ($content -match "cajachica\.local\.cpslp") {
    Write-Host "`n[OK] El dominio cajachica.local.cpslp ya esta registrado en hosts." -ForegroundColor Green
} else {
    Add-Content -Path $hostsPath -Value "`n$entry"
    Write-Host "`n[OK] Dominio cajachica.local.cpslp agregado exitosamente a hosts." -ForegroundColor Green
}

Clear-DnsClientCache -ErrorAction SilentlyContinue
Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host " Listo! Puedes ingresar desde tu navegador a:" -ForegroundColor Cyan
Write-Host " http://cajachica.local.cpslp" -ForegroundColor Yellow
Write-Host "===================================================`n" -ForegroundColor Cyan
