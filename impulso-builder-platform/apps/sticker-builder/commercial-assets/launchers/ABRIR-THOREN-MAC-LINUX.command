#!/bin/bash
# THÖREN Sticker Builder — launcher para macOS/Linux.
#
# Por qué existe este script (no basta con abrir index.html directamente):
# los navegadores modernos bloquean los módulos de JavaScript bajo el
# protocolo file:// (política de seguridad del navegador, no un límite de
# THÖREN) — hace falta un servidor local mínimo. Este script NO envía nada
# a internet: solo sirve los archivos de esta misma carpeta (index.html y
# assets/ viven junto a este script, ver Packaging Guide) a tu propio
# navegador, en tu propia máquina.
#
# Puerto FIJO (4173) a propósito: así tus proyectos guardados siguen
# disponibles la próxima vez que abras THÖREN (incluida una versión
# actualizada) — ver "Cómo actualizar" en docs/. Si alguna vez cambia,
# tus proyectos NO se pierden (existe respaldo/restauración desde
# "Mis proyectos"), pero sí quedarían en un origen distinto.
#
# ¿macOS dice "no se puede abrir porque es de un desarrollador no
# identificado"? Es normal la primera vez (este script no está firmado) —
# ver docs/05-problemas-frecuentes-y-soporte.md para cómo permitirlo.

PORT=4173
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON=python
  else
    echo "No se encontró Python en este equipo."
    echo "THÖREN necesita Python (ya instalado en la mayoría de Mac/Linux) para abrirse."
    echo "Instálalo desde https://www.python.org/downloads/ y vuelve a intentarlo."
    read -p "Presiona Enter para cerrar esta ventana..."
    exit 1
  fi
else
  PYTHON=python3
fi

cd "$DIR" || { echo "No se pudo acceder a la carpeta de este script."; read -p "Presiona Enter para cerrar..."; exit 1; }
if [ ! -f "index.html" ]; then
  echo "No se encontró index.html junto a este script — el paquete puede estar incompleto."
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

"$PYTHON" -m http.server "$PORT" >/tmp/thoren-sticker-builder.log 2>&1 &
SERVER_PID=$!
# EXIT cubre una salida normal; INT/TERM/HUP cubren Ctrl+C o cerrar la
# ventana/terminal — sin esto, el servidor puede quedar huérfano corriendo
# en segundo plano (confirmado con una prueba real: `timeout` enviando
# SIGTERM no disparaba un `trap ... EXIT` a secas).
cleanup() {
  kill "$SERVER_PID" 2>/dev/null
  exit 0
}
trap cleanup EXIT INT TERM HUP

sleep 1

URL="http://localhost:$PORT/index.html"
echo "THÖREN Sticker Builder está corriendo en $URL — NO cierres esta ventana mientras lo uses."
if command -v open >/dev/null 2>&1; then
  open "$URL"            # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"        # Linux
else
  echo "Abre manualmente esta dirección en tu navegador: $URL"
fi

echo "Deja esta ventana abierta mientras usas THÖREN. Ciérrala para salir."
wait "$SERVER_PID"
