@echo off
REM THOREN Sticker Builder -- launcher para Windows.
REM
REM Por que existe este script (no basta con abrir index.html directamente):
REM los navegadores modernos bloquean los modulos de JavaScript bajo el
REM protocolo file:// (politica de seguridad del navegador, no un limite de
REM THOREN) -- hace falta un servidor local minimo. Este script NO envia
REM nada a internet: solo sirve los archivos de esta misma carpeta a tu
REM propio navegador, en tu propia maquina.
REM
REM LIMITACION CONOCIDA (honesta, no resuelta en esta version): requiere
REM Python instalado. Windows no lo incluye por defecto. Si no lo tienes,
REM este script te lo indica con un mensaje claro en vez de fallar en
REM silencio -- instalalo una sola vez desde https://www.python.org/downloads/
REM (marca la casilla "Add Python to PATH" durante la instalacion).

setlocal
set PORT=4173
set DIR=%~dp0

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set PYCMD=python
) else (
  where py >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    set PYCMD=py -3
  ) else (
    echo No se encontro Python en este equipo.
    echo THOREN necesita Python para abrirse en Windows.
    echo Instalalo desde https://www.python.org/downloads/ marcando
    echo "Add Python to PATH", y vuelve a intentarlo.
    pause
    exit /b 1
  )
)

if not exist "%DIR%index.html" (
  echo No se encontro index.html junto a este script -- el paquete puede estar incompleto.
  pause
  exit /b 1
)

cd /d "%DIR%"
start "THOREN Sticker Builder (servidor local)" %PYCMD% -m http.server %PORT%

timeout /t 1 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"

echo THOREN Sticker Builder esta corriendo en http://localhost:%PORT%/ -- NO cierres
echo la ventana negra "THOREN Sticker Builder (servidor local)" mientras lo uses.
pause
