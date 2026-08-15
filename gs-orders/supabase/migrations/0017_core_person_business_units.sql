-- GS Orders — Migración 0017: THÖREN Core 2D — Person ↔ Business Units
--
-- Quinta pieza de THÖREN Core: introduce `person_business_units`, la
-- relación N:M entre people (CORE 2B) y business_units (CORE 2A) — una
-- misma Person puede pertenecer a una o varias Business Units de su propia
-- organización. Fundación pura: tabla puramente asociativa, sin backfill,
-- sin RPC de escritura, sin UI. SIN tocar folios/orders/salespeople/
-- user_profiles/organization_members/business_units existentes.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `person_business_units` con PK compuesta (person_id,
--    business_unit_id) — mismo patrón que organization_members (0013):
--    la fila ES la relación, sin id propio innecesario.
-- 2) Trigger de integridad: impide asociar una Person y una Business Unit
--    de organizaciones distintas — la única invariante que un CHECK simple
--    no puede expresar (requiere comparar dos tablas).
-- 3) RLS: única policy SELECT, solo ADMIN de la organización (mismo
--    patrón que people en 0015) — reutiliza is_organization_admin() de
--    0013, sin funciones SECURITY DEFINER nuevas.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO hace backfill: no existe hoy ninguna fuente de datos real de la que
--   inferir qué Person pertenece a qué Business Unit (a diferencia de
--   CORE 2C, donde user_profiles.salesperson_id daba una relación
--   preexistente real). Crear la tabla vacía es lo correcto; poblarla es
--   un acto humano/UI de una fase futura.
-- - NO crea ninguna policy de INSERT/UPDATE/DELETE — sin consumidor real
--   todavía (mismo principio de least privilege que people en 0015).
-- - NO crea ningún RPC.
-- - NO crea ninguna pantalla ni UI.
-- - NO modifica user_profiles, salespeople, orders, order_items,
--   organization_members, business_units, ni el flujo de creación de
--   Person (insertProfileAndMembershipOrCompensate / rpc_create_person_
--   for_user, CORE 2C).
-- - NO toca fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, prefix, sequence_current.
--
-- =========================================================================
-- DECISIÓN — PK compuesta, sin UNIQUE adicional:
-- =========================================================================
-- (person_id, business_unit_id) como PK ya impide duplicados exactos —
-- mismo patrón que organization_members (0013). Sin columna id propia:
-- la fila no tiene identidad más allá de la relación misma.
--
-- =========================================================================
-- DECISIÓN — ON DELETE CASCADE en ambos FK:
-- =========================================================================
-- A diferencia de salespeople.person_id/user_profiles.person_id (SET
-- NULL, porque esas tablas tienen identidad propia independiente de
-- people), una fila de person_business_units NO tiene sentido por sí sola
-- si Person o Business Unit desaparecen — es la relación, no una entidad
-- con datos propios. Borrar cualquiera de los dos lados debe limpiar la
-- fila automáticamente.
--
-- =========================================================================
-- DECISIÓN — trigger de integridad "misma organización":
-- =========================================================================
-- No existe una forma de expresar "people.organization_id =
-- business_units.organization_id" con un CHECK simple (requiere leer otra
-- tabla). Se usa un trigger BEFORE INSERT/UPDATE que compara ambas
-- organizaciones y lanza excepción explícita si difieren — la única forma
-- de que esta invariante se sostenga incluso si en el futuro se abriera
-- escritura directa a la tabla. No es una función SECURITY DEFINER: es un
-- trigger de validación, sin necesidad de bypass de RLS.
--
-- =========================================================================
-- DECISIÓN — RLS: solo SELECT, admin-scoped, sin organization_id propio
-- en la tabla:
-- =========================================================================
-- person_business_units no tiene columna organization_id (sería
-- redundante: ya se deriva de people.organization_id, que el trigger de
-- arriba garantiza que coincide con business_units.organization_id). La
-- policy de SELECT navega a través de people para resolver la
-- organización y reutiliza is_organization_admin() (0013) — mismo
-- principio de mínimo privilegio que people en 0015: ningún consumidor
-- real necesita hoy que un VENDEDOR lea esta tabla.
--
-- Como el resto del proyecto: idempotente (create table if not exists, do
-- $$ if not exists $$ para policies/triggers) y corre completa en una
-- sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) person_business_units
-- =========================================================================
create table if not exists person_business_units (
  person_id uuid not null references people (id) on delete cascade,
  business_unit_id uuid not null references business_units (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint person_business_units_pk primary key (person_id, business_unit_id)
);

-- Sin índice propio por person_id: la PK compuesta (person_id,
-- business_unit_id) ya cubre búsquedas por person_id como columna líder.
create index if not exists person_business_units_bu_idx on person_business_units (business_unit_id);

-- =========================================================================
-- 2) Trigger de integridad: Person y Business Unit deben pertenecer a la
--    misma organización.
-- =========================================================================
create or replace function trg_check_person_business_unit_same_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_person_org uuid;
  v_bu_org uuid;
begin
  select organization_id into v_person_org from people where id = new.person_id;
  select organization_id into v_bu_org from business_units where id = new.business_unit_id;

  if v_person_org is distinct from v_bu_org then
    raise exception 'person_business_units: la Person % (organización %) y la Business Unit % (organización %) no pertenecen a la misma organización.',
      new.person_id, v_person_org, new.business_unit_id, v_bu_org;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_person_business_units_same_org'
  ) then
    create trigger trg_person_business_units_same_org
      before insert or update on person_business_units
      for each row execute function trg_check_person_business_unit_same_org();
  end if;
end $$;

-- =========================================================================
-- 3) RLS — única policy: SELECT, solo ADMIN de la organización (vía
--    people, sin columna organization_id propia). Reutiliza
--    is_organization_admin() de 0013. Sin INSERT/UPDATE/DELETE.
-- =========================================================================
alter table person_business_units enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'person_business_units'
      and policyname = 'person_business_units_select_admin'
  ) then
    create policy "person_business_units_select_admin" on person_business_units
      for select using (
        exists (
          select 1 from people p
          where p.id = person_id
            and is_organization_admin(p.organization_id)
        )
      );
  end if;
end $$;

commit;
