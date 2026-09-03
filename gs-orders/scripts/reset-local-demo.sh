#!/usr/bin/env bash
# THÖREN 7C — única vía sancionada para sembrar datos de demo localmente.
#
# `supabase db reset` YA NO siembra datos por sí solo (ver
# supabase/config.toml, [db.seed] enabled = false): seed_demo_data.sql
# ahora exige el GUC de sesión thoren.allow_demo_seed=local, que este
# script fija de forma explícita, en la MISMA sesión de psql que corre el
# archivo — nada en un proyecto Supabase Cloud fija ese GUC por accidente.
#
# Esto es deliberado: crea usuarios de auth.users con password conocida
# (Thoren2026!) y NUNCA debe poder ejecutarse contra un proyecto real
# (staging/producción) por error de copiar/pegar un comando.
#
# Uso: ./scripts/reset-local-demo.sh
# Variables opcionales:
#   LOCAL_DB_URL — sobreescribe la URL de Postgres local (default: la fija
#                  de Supabase CLI, postgres:postgres@127.0.0.1:54322/postgres,
#                  que coincide con [db] port en supabase/config.toml).

set -euo pipefail

LOCAL_DB_URL="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# Salvaguarda adicional (barata, no es el guard real — ese vive en el SQL):
# si alguien exportó una DATABASE_URL/SUPABASE_DB_URL apuntando a un host
# que no es localhost/127.0.0.1, algo está mal configurado en la terminal —
# aborta antes de tocar nada.
for var in DATABASE_URL SUPABASE_DB_URL; do
  value="${!var:-}"
  if [[ -n "$value" && "$value" != *"127.0.0.1"* && "$value" != *"localhost"* ]]; then
    echo "ABORTADO: \$$var está definida y NO apunta a localhost/127.0.0.1 ($value)." >&2
    echo "Este script es solo para el stack local — revisa tu entorno antes de continuar." >&2
    exit 1
  fi
done

echo "==> supabase db reset (esquema + migraciones, sin seed automático)"
supabase db reset

echo "==> Sembrando datos de demo (thoren.allow_demo_seed=local, misma sesión psql)"
psql "$LOCAL_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -c "select set_config('thoren.allow_demo_seed', 'local', false);" \
  -f "$(dirname "$0")/../supabase/seed/seed_demo_data.sql"

cat <<'EOF'

==> Listo. Cuentas de prueba (password "Thoren2026!", SOLO en este stack local):
    admin@thoren.local     -> ADMIN
    vladimir@thoren.local  -> VENDEDOR (Vladimir Peña, VPT)
    karla@thoren.local     -> VENDEDOR (Karla Saucedo, KST)
EOF
