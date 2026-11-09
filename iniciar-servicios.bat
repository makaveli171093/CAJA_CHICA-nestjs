@echo off
chcp 65001 >nul
setlocal
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

echo ================================================================
echo           CAJA PETROLERA DE SALUD - CAJA CHICA
echo                 Iniciando Servicios...
echo ================================================================
echo.

:: 1. Verificar si Node.js está instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado o no se encuentra en el PATH.
    echo Por favor instale Node.js antes de continuar.
    echo.
    pause
    exit /b 1
)

:: 2. Si los puertos 3000 u 80 ya están en uso, reiniciar limpiamente
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$busy = Get-NetTCPConnection -LocalPort 3000, 80 -State Listen -ErrorAction SilentlyContinue; if ($busy) { exit 1 } else { exit 0 }"
if %errorlevel% equ 1 (
    echo [AVISO] Se detectaron servicios previos en ejecucion (puertos 3000 u 80).
    echo Reiniciando procesos para garantizar una sesion limpia...
    call "%BASE_DIR%detener-servicios.bat" --silent
    timeout /t 2 /nobreak >nul
)

:: 3. Iniciar el Backend (NestJS en puerto 3000)
echo [1/2] Iniciando Backend API (NestJS - Puerto 3000)...
start "Caja Chica - Backend" cmd /k "title Caja Chica - Backend && cd /d \"%BASE_DIR%backend\" && npm run start:dev"

:: 4. Esperar 3 segundos para que el backend empiece a levantar
timeout /t 3 /nobreak >nul

:: 5. Iniciar el Frontend (Vite en puerto 80)
echo [2/2] Iniciando Frontend Web (Vite - Puerto 80)...
start "Caja Chica - Frontend" cmd /k "title Caja Chica - Frontend && cd /d \"%BASE_DIR%frontend\" && npm run dev"

echo.
echo ================================================================
echo           SERVICIOS INICIADOS CORRECTAMENTE
echo ================================================================
echo.
echo   * URL en tu maquina:   http://cajachica.local.cpslp
echo   * URL alternativa:     http://localhost
echo   * Backend REST API:    http://localhost:3000/api
echo   * Documentacion API:   http://localhost:3000/api/docs
echo.
echo   (Para detenerlos en cualquier momento, ejecuta: detener-servicios.bat)
echo ================================================================
echo.

:: Preguntar si desea abrir el navegador
set /p ABRIR="¿Deseas abrir la aplicacion en tu navegador ahora? (S/n): "
if /i "%ABRIR%"=="n" (
    echo.
    echo Listo. Presiona cualquier tecla para cerrar esta ventana de control...
    pause >nul
    exit /b 0
)

echo Abriendo navegador en http://cajachica.local.cpslp ...
start http://cajachica.local.cpslp
timeout /t 2 /nobreak >nul
exit /b 0
