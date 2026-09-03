#!/bin/bash
# THÖREN Fase 7C — guard real de seed_demo_data.sql. Corre DESPUÉS de:
# local_harness_setup.sql + migraciones 0001-0053 (fixtures.sql NO es
# necesario para este archivo). Cubre TESTS 11/12/13 del set de 16:
#   11. seed autorizado (thoren.allow_demo_seed=local) corre y crea las
#       cuentas de demo.
#   12. seed bloqueado si el GUC no está presente (RAISE EXCEPTION antes de
#       tocar ninguna tabla).
#   13. la contraseña demo (auth.users con encrypted_password conocido)
#       nunca llega a crearse cuando el guard bloquea — verificado contando
#       filas de auth.users con email @thoren.local antes/después.
#
# Corre el archivo REAL (supabase/seed/seed_demo_data.sql), no una copia,
# para que esta prueba deje de pasar si alguien afloja el guard sin querer.

set -uo pipefail

DB=gsorders_test
SEED_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../seed" && pwd)/seed_demo_data.sql"

count_thoren_users() {
  sudo -u postgres psql -d "$DB" -t -A -c "select count(*) from auth.users where email like '%@thoren.local';"
}

FAILED=0

# =========================================================================
# TEST 12: SIN el GUC -> bloqueado, cero filas nuevas.
# =========================================================================
echo "=== TEST 12: seed SIN thoren.allow_demo_seed -> debe bloquear ==="
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -f "$SEED_FILE" > /tmp/seed_guard_blocked.log 2>&1
EXIT_BLOCKED=$?
COUNT_AFTER_BLOCKED=$(count_thoren_users)

echo "exit=$EXIT_BLOCKED, usuarios @thoren.local tras el intento bloqueado=$COUNT_AFTER_BLOCKED"
if grep -q "BLOQUEADO: seed_demo_data.sql no puede correr" /tmp/seed_guard_blocked.log && [ "$EXIT_BLOCKED" -ne 0 ] && [ "$COUNT_AFTER_BLOCKED" -eq 0 ]; then
  echo "TEST 12 OK: bloqueado correctamente, sin crear ninguna fila."
else
  echo "TEST 12 FALLÓ: se esperaba exit!=0, mensaje BLOQUEADO y 0 usuarios @thoren.local."
  cat /tmp/seed_guard_blocked.log
  FAILED=1
fi

# =========================================================================
# TEST 13: la contraseña demo (encrypted_password conocido) tampoco existe
# tras el intento bloqueado. El guard corre ANTES de cualquier INSERT (ver
# seed_demo_data.sql) así que esto es una consecuencia directa de TEST 12
# (0 filas nuevas) — se verifica explícito sobre la credencial en sí, no
# solo el conteo de filas.
# =========================================================================
echo
echo "=== TEST 13: password demo no llega a crearse cuando el guard bloquea ==="
DEMO_PW_COUNT=$(sudo -u postgres psql -d "$DB" -t -A -c "select count(*) from auth.users where email = 'admin@thoren.local' and encrypted_password is not null;")
if [ "$DEMO_PW_COUNT" -eq 0 ]; then
  echo "TEST 13 OK: ninguna cuenta con password demo fue creada."
else
  echo "TEST 13 FALLÓ: se encontraron $DEMO_PW_COUNT cuenta(s) con password demo tras un intento bloqueado."
  FAILED=1
fi

# =========================================================================
# TEST 11: CON el GUC (misma sesión psql, vía -c + -f) -> corre y crea las
# 3 cuentas de demo.
# =========================================================================
echo
echo "=== TEST 11: seed CON thoren.allow_demo_seed=local -> debe correr ==="
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 \
  -c "select set_config('thoren.allow_demo_seed', 'local', false);" \
  -f "$SEED_FILE" > /tmp/seed_guard_authorized.log 2>&1
EXIT_AUTHORIZED=$?
COUNT_AFTER_AUTHORIZED=$(count_thoren_users)

echo "exit=$EXIT_AUTHORIZED, usuarios @thoren.local tras el seed autorizado=$COUNT_AFTER_AUTHORIZED"
if [ "$EXIT_AUTHORIZED" -eq 0 ] && [ "$COUNT_AFTER_AUTHORIZED" -eq 3 ]; then
  echo "TEST 11 OK: seed autorizado corrió y creó las 3 cuentas de demo."
else
  echo "TEST 11 FALLÓ: se esperaba exit=0 y 3 usuarios @thoren.local."
  cat /tmp/seed_guard_authorized.log
  FAILED=1
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "=== seed_guard_test: 3/3 TESTS OK (11/12/13) ==="
  exit 0
else
  echo "=== seed_guard_test: FALLÓ ==="
  exit 1
fi
