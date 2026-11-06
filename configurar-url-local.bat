@echo off
setlocal
echo ===================================================
echo  Configuracion de Dominio Local: cajachica.local.cpslp
echo ===================================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

findstr /C:"cajachica.local.cpslp" "%WINDIR%\System32\drivers\etc\hosts" >nul
if %errorlevel% equ 0 (
    echo.
    echo [OK] El dominio cajachica.local.cpslp ya se encuentra configurado en hosts.
) else (
    echo.>>"%WINDIR%\System32\drivers\etc\hosts"
    echo 127.0.0.1 cajachica.local.cpslp>>"%WINDIR%\System32\drivers\etc\hosts"
    echo.
    echo [OK] Dominio cajachica.local.cpslp agregado exitosamente a hosts.
)

ipconfig /flushdns >nul
echo Cache DNS actualizada.
echo.
echo ===================================================
echo  LISTO! Ya puedes ingresar desde tu navegador a:
echo  http://cajachica.local.cpslp
echo ===================================================
echo.
pause
