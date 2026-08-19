#!/bin/bash
# THÖREN Quote → Order V2 (0023) — TEST EXPLÍCITO #15: dos conversiones
# simultáneas de la MISMA Quote (Quote B, aceptada, sin convertir) desde
# dos conexiones Postgres reales y separadas. Corre DESPUÉS de:
# local_harness_setup.sql + migraciones 0001-0023 + fixtures.sql +
# 0023_fixtures.sql, TODO ya confirmado (no en una transacción que se
# revierta — esto necesita commits reales para que el índice único dispare
# entre backends). Requisito exacto: exactamente UNA conversión exitosa,
# exactamente UNA falla, existe exactamente UN Order con
# source_quote_id = Quote B, no queda ningún Order huérfano/parcial.

set -uo pipefail

DB=thoren_test
QUOTE_B='80000000-0000-0000-0000-00000000000b'
VENDEDOR1='00000000-0000-0000-0000-000000000002'

RUN_SQL="
set role authenticated;
select test_set_user('$VENDEDOR1');
select rpc_create_order_from_quote('$QUOTE_B', 'otro', current_date);
"

echo "$RUN_SQL" > /tmp/0023_concurrency_run.sql

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f /tmp/0023_concurrency_run.sql > /tmp/0023_concurrency_a.log 2>&1 &
PID_A=$!
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f /tmp/0023_concurrency_run.sql > /tmp/0023_concurrency_b.log 2>&1 &
PID_B=$!

wait $PID_A
EXIT_A=$?
wait $PID_B
EXIT_B=$?

echo "=== Conexión A (exit $EXIT_A) ==="
cat /tmp/0023_concurrency_a.log
echo
echo "=== Conexión B (exit $EXIT_B) ==="
cat /tmp/0023_concurrency_b.log
echo

SUCCESS_COUNT=0
[ $EXIT_A -eq 0 ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
[ $EXIT_B -eq 0 ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))

echo "=== Verificación post-concurrencia ==="
ORDER_COUNT=$(sudo -u postgres psql -d "$DB" -t -A -c "select count(*) from orders where source_quote_id = '$QUOTE_B';")
echo "Orders con source_quote_id = Quote B: $ORDER_COUNT"
echo "Conexiones exitosas (exit 0): $SUCCESS_COUNT de 2"

if [ "$SUCCESS_COUNT" -eq 1 ] && [ "$ORDER_COUNT" -eq 1 ]; then
  echo "TEST 15 OK: exactamente una conversión tuvo éxito, existe exactamente un Order, sin duplicados ni huérfanos."
  exit 0
else
  echo "TEST 15 FALLÓ: se esperaba 1 éxito y 1 Order, se obtuvo $SUCCESS_COUNT éxito(s) y $ORDER_COUNT Order(s)."
  exit 1
fi
