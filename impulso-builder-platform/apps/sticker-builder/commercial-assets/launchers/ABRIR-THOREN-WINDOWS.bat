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
REM Python instalado. Windows no lo incluye por defecto -- y en muchos
REM equipos Windows deja un "alias de ejecucion de aplicaciones" vacio con
REM el mismo nombre, que este script sabe distinguir de un Python real (ver
REM comentario mas abajo). Si de verdad no hay Python, este script te lo
REM indica con un mensaje claro en vez de fallar en silencio -- instalalo
REM una sola vez desde https://www.python.org/downloads/ (marca la casilla
REM "Add Python to PATH" durante la instalacion).

setlocal
set PORT=4173
set DIR=%~dp0

REM No basta con `where python` -- Windows instala por defecto un "alias de
REM ejecucion de aplicaciones" llamado python.exe que SI aparece en PATH
REM (where lo encuentra, ERRORLEVEL 0) pero no es un interprete real: al
REM ejecutarlo no pasa nada util, y el servidor local de mas abajo nunca
REM llega a arrancar (el navegador termina mostrando ERR_CONNECTION_REFUSED
REM sin ninguna pista de por que). Se verifica ejecutando de verdad
REM "--version" -- eso es lo unico que distingue un interprete real del
REM alias vacio.
python --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  set PYCMD=python
) else (
  py -3 --version >nul 2>nul
  if %ERRORLEVEL% EQU 0 (
    set PYCMD=py -3
  ) else (
    echo No se encontro Python en este equipo.
    echo THOREN necesita Python para abrirse en Windows.
    echo.
    echo Si Windows abrio la Microsoft Store al escribir "python", es la
    echo prueba de que Python NO esta instalado -- Windows solo dejo un
    echo acceso directo vacio con ese nombre. Instala Python real desde
    echo https://www.python.org/downloads/ marcando la casilla "Add Python to
    echo PATH" durante la instalacion, y vuelve a intentarlo.
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
