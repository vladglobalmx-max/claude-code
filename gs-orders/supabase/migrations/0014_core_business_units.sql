-- GS Orders — Migración 0014: THÖREN Core 2A — Business Units Foundation
--
-- Segunda pieza de THÖREN Core: introduce `business_units`, un catálogo
-- mínimo de unidades de negocio dentro de una organización (tenant), SIN
-- tocar el modelo de acceso ni el comportamiento visible actual de GS
-- Orders.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `business_units`, tabla de catálogo org-scoped (organization_id
--    FK a organizations(id)) con el modelo mínimo aprobado: id, organization_id,
--    name, code, active, created_at, updated_at. Sin slug/prefix/branding/
--    metadata/legal_name/description/settings/sequence/folio_prefix — nada
--    de eso tiene un consumidor real hoy (ver THÖREN CORE 2 — Discovery
--    Report).
-- 2) RLS propia, reutilizando is_organization_member()/is_organization_admin()
--    de 0013 — NO se crea ningún helper SECURITY DEFINER nuevo. Solo existe
--    policy de SELECT: ADMIN de la organización ve todas sus business_units
--    (activas e inactivas); VENDEDOR/miembro no-admin solo ve las activas.
--    No existe policy de insert/update/delete: sin UI ni flujo real que las
--    necesite todavía (mismo principio de least privilege que organizations
--    en 0013).
-- 3) Bootstrap: siembra exactamente las 6 Business Units aprobadas para
--    Global Supplier MTY (slug 'global-supplier-mty'), resuelta por slug —
--    nunca por UUID hardcodeado ni por LIMIT 1 — y la migración FALLA
--    explícitamente (raise exception, rollback completo vía begin/commit)
--    si esa organización no existe.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca orders, salespeople, order_items, product_catalog, product_types,
--   user_profiles, organizations ni organization_members. business_units es
--   una tabla nueva, aislada, sin ninguna FK entrante desde tablas
--   existentes todavía.
-- - NO toca la columna legacy `business_unit` (text) de salespeople/orders,
--   ni su CHECK constraint, ni sus valores ('thunder', 'juno_promotional',
--   'got_fresh_breath', 'the_fire_spot'). Sigue existiendo, sin relación con
--   esta tabla nueva — ver THÖREN CORE 2 Discovery Report: es vestigial
--   (nunca se lee para lógica de negocio) pero no se toca ni se hace
--   backfill en esta fase.
-- - NO toca fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, prefix ni sequence_current. Los folios siguen
--   siendo exclusivamente salesperson-scoped, sin ninguna dependencia de
--   business_units (decisión permanente, no solo de esta fase).
-- - NO agrega business_unit_id a orders ni a salespeople.
-- - NO crea `people` ni `person_business_units` (bridge many-to-many
--   Persona↔BusinessUnit) — quedan para CORE 2B/2C.
-- - NO agrega ninguna pantalla, acción server-side ni RPC de administración
--   de business_units. Fundación de datos, no feature visible.
--
-- =========================================================================
-- DECISIÓN — UNIQUE(organization_id, name) no se agrega:
-- =========================================================================
-- Se analizó agregar un índice único adicional sobre (organization_id, name)
-- además de (organization_id, code). Se descarta en esta fase: `code` ya es
-- el identificador técnico estable y único por organización (el que
-- cualquier FK futura o lógica de aplicación debe usar); `name` es texto de
-- presentación que podría necesitar variantes o ajustes editoriales sin que
-- eso deba chocar con una constraint de unicidad. Agregar una constraint
-- sin un consumidor real que la requiera hoy sería exactamente el tipo de
-- diseño prematuro que este proyecto evita (ver Discovery Report). Si en el
-- futuro surge un caso de uso real que dependa de nombres únicos, se agrega
-- en esa fase con su propia migración.
--
-- =========================================================================
-- DECISIÓN — organization_id references organizations(id) on delete restrict:
-- =========================================================================
-- Mismo patrón que orders.salesperson_id (0001_core.sql): RESTRICT impide
-- borrar una organización que todavía tiene business_units, forzando una
-- decisión explícita (reasignar o borrar primero las business_units) en
-- vez de un cascade silencioso que las eliminaría a todas. Hoy no existe
-- ninguna policy ni acción que permita borrar organizations en absoluto
-- (ver 0013), así que esto es una salvaguarda para el futuro, no un
-- comportamiento que se ejercite hoy.
--
-- Como el resto del proyecto: crea/reemplaza todo de forma idempotente
-- (create table if not exists, do $$ if not exists $$ para policies/
-- triggers, on conflict do nothing en el bootstrap) y corre completa en una
-- sola transacción (begin/commit) — si el bootstrap falla, TODA la
-- migración se revierte, nunca queda business_units parcialmente sembrada.

begin;

-- =========================================================================
-- 1) business_units
-- =========================================================================
create table if not exists business_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null,
  code text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_units_org_code_unique unique (organization_id, code)
);

create index if not exists business_units_organization_idx on business_units (organization_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_business_units_updated_at') then
    create trigger trg_business_units_updated_at
      before update on business_units
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) RLS — reutiliza is_organization_member()/is_organization_admin() de
--    0013. No se crea ningún helper SECURITY DEFINER nuevo.
--
--    Única policy: SELECT. ADMIN de la organización ve TODAS sus
--    business_units (activas e inactivas, para poder administrarlas en el
--    futuro). Miembro no-admin (vendedor) solo ve las activas — una
--    business_unit inactiva no debe aparecer como opción operativa para
--    nadie que no sea admin. No existe policy de insert/update/delete: sin
--    UI ni flujo real que las necesite todavía. La siembra de abajo corre
--    como dueño de la tabla (bootstrap de migración), no depende de
--    ninguna policy.
-- =========================================================================
alter table business_units enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'business_units'
      and policyname = 'business_units_select_member'
  ) then
    create policy "business_units_select_member" on business_units
      for select using (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and active = true)
      );
  end if;
end $$;

-- =========================================================================
-- 3) Bootstrap: siembra las 6 Business Units aprobadas para Global Supplier
--    MTY. Resuelto por slug (nunca UUID hardcodeado, nunca LIMIT 1 sin
--    condición) — si la organización no existe, la migración completa
--    aborta (begin/commit revierte todo, business_units no queda creada a
--    medias).
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_units_before integer;
  v_units_after integer;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';

  if v_org_id is null then
    raise exception 'CORE 2A: no se encontró la organización global-supplier-mty. Bootstrap de business_units abortado.';
  end if;

  select count(*) into v_units_before from business_units where organization_id = v_org_id;

  insert into business_units (organization_id, name, code)
  values
    (v_org_id, 'Thunder Safety Solutions', 'thunder_safety'),
    (v_org_id, 'Thunder LED Lights', 'thunder_led'),
    (v_org_id, 'Got Fresh Breath Mexico', 'got_fresh_breath'),
    (v_org_id, 'The Fire Spot', 'the_fire_spot'),
    (v_org_id, 'Juno Promotional', 'juno_promotional'),
    (v_org_id, 'GTX Systems', 'gtx_systems')
  on conflict (organization_id, code) do nothing;

  select count(*) into v_units_after from business_units where organization_id = v_org_id;

  raise notice 'CORE 2A bootstrap: organization_id=%, business_units antes=%, business_units después=%',
    v_org_id, v_units_before, v_units_after;
end $$;

commit;
