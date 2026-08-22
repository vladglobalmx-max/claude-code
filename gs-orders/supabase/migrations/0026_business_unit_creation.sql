-- GS Orders — Migración 0026: THÖREN Business Units — Crear nuevas
--
-- Permite a un ADMIN crear Business Units desde la UI (/unidades-negocio/nueva).
-- Hoy `business_units` NO tiene NINGUNA policy de INSERT (confirmado por
-- discovery de esta fase: 0014_core_business_units.sql documenta
-- explícitamente "sin policy de insert/update/delete: sin UI ni flujo real
-- que las necesite todavía"; 0024_business_unit_branding.sql agregó la
-- primera y única policy de escritura hasta hoy, pero solo de UPDATE) —
-- por eso ninguna Business Unit nueva puede crearse todavía, ni siquiera
-- por un ADMIN. Implementa exactamente lo aprobado en "THÖREN — Business
-- Units — Crear nuevas Unidades de Negocio" de esta misma sesión.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `business_units_insert_admin` — la policy de INSERT sobre
--    `business_units` (segunda policy de escritura después de
--    business_units_update_admin, 0024). Usa is_organization_admin(organization_id)
--    — mismo helper, mismo criterio, sin helper nuevo. organization_id
--    llega siempre resuelto server-side (current_user_organization_id(),
--    0013, vía resolveCurrentOrganizationId() en la app — mismo patrón ya
--    usado por createCustomer en clientes/actions.ts) — la policy es la
--    última línea de defensa, no la única: el Server Action nunca confía
--    en un organization_id mandado por el navegador.
-- 2) Agrega `business_units_code_format` — CHECK constraint sobre `code`:
--    minúsculas, empieza con letra, solo [a-z0-9_] después, 2-60
--    caracteres. Antes de agregarla se verificaron los 6 codes reales ya
--    sembrados por 0014 (got_fresh_breath, gtx_systems, juno_promotional,
--    the_fire_spot, thunder_led, thunder_safety) — los 6 cumplen el
--    patrón exactamente, así que la constraint no rompe ningún dato
--    existente. Es la misma decisión de defensa en profundidad ya usada
--    en 0020 para quote_prefix (constraint en DB + validación Zod en la
--    app, nunca solo uno de los dos) — hasta hoy `code` nunca había sido
--    insertable desde la app (solo bootstrap de migración), así que nunca
--    había hecho falta.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO relaja `business_units_select_member` ni `business_units_update_admin`
--   (0014/0024) — sin cambios ahí. code/organization_id siguen inmutables
--   después de creada (trg_business_units_prevent_org_code_change, 0024,
--   dispara en UPDATE, nunca en INSERT — no necesita ningún cambio).
-- - NO agrega policy de DELETE — eliminar Business Units queda
--   explícitamente fuera de alcance de esta fase (Quotes/Orders históricos
--   requieren su propio análisis).
-- - NO crea ninguna función ni RPC nueva: el INSERT lo hace la app
--   directamente contra `business_units`, protegido únicamente por RLS
--   (igual que customers_insert_member, 0018) — no hace falta orquestar
--   folio/snapshot/totales como sí requieren rpc_create_quote/rpc_create_order.
-- - NO toca Storage ni `business-unit-assets` (0024 ya cubre por completo
--   la subida de logo una vez que la Business Unit existe — sin cambios).
-- - NO toca `quotes`, `quote_items`, `orders`, `order_items`,
--   `salesperson_quote_sequences`, folios, ni ninguna otra migración.
--
-- Como el resto del proyecto: idempotente (drop/create policy, do $$ if
-- not exists $$ para la constraint) y corre completa en una sola
-- transacción (begin/commit).

begin;

-- =========================================================================
-- 1) RLS — INSERT de business_units, solo ADMIN de la organización real.
-- =========================================================================
drop policy if exists "business_units_insert_admin" on business_units;
create policy "business_units_insert_admin" on business_units
  for insert with check (is_organization_admin(organization_id));

-- =========================================================================
-- 2) code — formato validado también en DB (defensa en profundidad, no
--    solo Zod en la app). Verificado contra los 6 codes reales existentes
--    antes de agregarla — ninguno la viola.
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_units_code_format'
  ) then
    alter table business_units
      add constraint business_units_code_format
      check (code ~ '^[a-z][a-z0-9_]*$' and char_length(code) between 2 and 60);
  end if;
end $$;

commit;
