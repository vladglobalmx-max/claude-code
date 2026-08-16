-- GS Orders — Migración 0018: THÖREN Quotes Q1 — Customers Foundation
--
-- Primera pieza de THÖREN Quotes: introduce `customers`, entidad Core
-- reutilizable (Quotes, y en el futuro Orders/CRM/Documents/Invoices), SIN
-- tocar orders.client_name, el modelo de acceso ni el comportamiento
-- visible actual de GS Orders/THÖREN.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `customers`, tabla org-scoped (organization_id FK a
--    organizations(id)) con el modelo mínimo aprobado: id, organization_id,
--    name, legal_name (nullable), tax_id (nullable), email (nullable),
--    phone (nullable), active, created_at, updated_at. Sin addresses,
--    contacts, credit/payment terms, notes, metadata, tags, salesperson
--    owner, business_unit_id ni ningún campo CRM — ninguno tiene consumidor
--    real hoy (ver THÖREN QUOTES — Architecture Discovery Report).
-- 2) RLS propia, reutilizando is_organization_member()/is_organization_admin()
--    de 0013 — NO se crea ningún helper SECURITY DEFINER nuevo.
--    - SELECT: ADMIN ve todos los customers de su organización (activos e
--      inactivos); VENDEDOR (miembro no-admin activo) solo ve los activos.
--      Mismo patrón exacto que business_units_select_member (0014).
--    - INSERT: cualquier miembro activo de la organización (ADMIN o
--      VENDEDOR) — ambos roles pueden dar de alta clientes.
--    - UPDATE: solo ADMIN.
--    - DELETE: sin policy para ningún rol — no existe borrado físico;
--      desactivación es UPDATE active=false (solo ADMIN, vía la policy de
--      update).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca orders.client_name: sin FK, sin backfill, sin matching por
--   nombre, sin sincronización. Customers y orders.client_name conviven
--   como conceptos completamente independientes en esta fase. Crear/editar/
--   duplicar pedidos sigue funcionando exactamente igual, sin ninguna
--   dependencia de customers.
-- - NO toca fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, prefix ni sequence_current. Los folios de
--   Orders siguen siendo exclusivamente salesperson-scoped, sin ninguna
--   relación con esta tabla.
-- - NO toca orders, order_items, salespeople, business_units, people,
--   person_business_units, user_profiles, organizations ni
--   organization_members. customers es una tabla nueva, aislada, sin
--   ninguna FK entrante desde tablas existentes todavía.
-- - NO agrega business_unit_id a customers — Quotes (fase posterior) es
--   quien pertenece a una Business Unit, no el Customer en sí; un mismo
--   cliente puede eventualmente cotizar con más de una unidad de negocio.
-- - NO agrega el motor de folios de Quotes (Salesperson × Business Unit,
--   quote_prefix, sequence_current propio) — esa es una decisión de
--   arquitectura ya aprobada para una fase posterior, no se implementa
--   aquí.
-- - NO agrega ninguna pantalla, acción server-side ni RPC más allá de lo
--   estrictamente necesario para el CRUD de /clientes (ver código de la
--   app en el mismo cambio, fuera de esta migración).
--
-- =========================================================================
-- DECISIÓN — sin UNIQUE(organization_id, name):
-- =========================================================================
-- Dos customers distintos pueden compartir nombre legítimamente (empresas
-- homónimas en ciudades distintas). "Control de duplicados" es apoyo de
-- UI/búsqueda (índice sobre lower(name), igual que orders_client_name_idx),
-- nunca una restricción de base de datos que bloquee un alta legítima.
--
-- =========================================================================
-- DECISIÓN — legal_name y tax_id nullable, sin exigirlos al crear:
-- =========================================================================
-- Tienen consumidor futuro concreto (razón social/RFC en documentos
-- comerciales — Quotes, y eventualmente Invoices), pero no son necesarios
-- para dar de alta un cliente rápido durante una cotización. Se agregan
-- ahora porque no tienen costo de esquema real, no porque se vayan a usar
-- ya en Q1.
--
-- =========================================================================
-- DECISIÓN — RLS: VENDEDOR solo ve customers activos, igual que
-- business_units (no igual que people):
-- =========================================================================
-- A diferencia de people (CORE 2B: SOLO admin, ni siquiera activos, porque
-- no existía ningún consumidor real que necesitara que un VENDEDOR leyera
-- esa tabla), customers SÍ tiene un consumidor inmediato: un VENDEDOR debe
-- poder buscar/seleccionar un cliente existente al cotizar. Ocultarle los
-- inactivos (igual que business_units) evita que aparezcan como opción
-- operativa sin impedirle ver el catálogo completo que sí necesita.
--
-- =========================================================================
-- DECISIÓN — sin policy de DELETE:
-- =========================================================================
-- Ningún consumidor requiere borrado físico hoy. Mismo principio que
-- business_units/people/product_types: desactivar (active=false, vía
-- UPDATE, solo ADMIN) es el mecanismo, nunca DELETE.
--
-- Como el resto del proyecto: crea/reemplaza todo de forma idempotente
-- (create table if not exists, do $$ if not exists $$ para policies/
-- triggers) y corre completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) customers
-- =========================================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null
    constraint customers_name_not_blank check (btrim(name) <> ''),
  legal_name text,
  tax_id text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_organization_idx on customers (organization_id);
create index if not exists customers_name_idx on customers (lower(name));

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_customers_updated_at') then
    create trigger trg_customers_updated_at
      before update on customers
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) RLS — reutiliza is_organization_member()/is_organization_admin() de
--    0013. No se crea ningún helper SECURITY DEFINER nuevo.
-- =========================================================================
alter table customers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_select_member'
  ) then
    create policy "customers_select_member" on customers
      for select using (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and active = true)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_insert_member'
  ) then
    create policy "customers_insert_member" on customers
      for insert with check (is_organization_member(organization_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers'
      and policyname = 'customers_update_admin'
  ) then
    create policy "customers_update_admin" on customers
      for update using (is_organization_admin(organization_id))
      with check (is_organization_admin(organization_id));
  end if;
end $$;

commit;
