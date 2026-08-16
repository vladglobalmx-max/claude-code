-- GS Orders — Migración 0019: THÖREN Quotes Q2 — Product Master + Pricing
-- Foundation
--
-- Segunda pieza de THÖREN Quotes: hace `product_catalog` organization-scoped,
-- agrega precio sugerido MXN/USD, e introduce `product_business_units`
-- (N:M) para acotar opcionalmente un producto a una o varias Business
-- Units. A diferencia de 0018 (tabla nueva), esta migración modifica una
-- tabla ya en producción con datos reales — ver DECISIÓN de backfill abajo.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega a `product_catalog`:
--    - organization_id uuid not null (FK organizations, on delete restrict)
--      — backfill production-safe, ver DECISIÓN abajo.
--    - default_price_mxn / default_price_usd numeric(12,2) nullable, con
--      CHECK >= 0. Precio SUGERIDO/DEFAULT únicamente — nunca se vuelve a
--      leer una vez congelado en un futuro quote_item (esa tabla no se
--      crea aquí). Sin conversión automática entre monedas.
-- 2) Reemplaza las policies de `product_catalog` (creadas en 0011) por
--    versiones organization-scoped usando los helpers Core de 0013
--    (is_organization_admin/is_organization_member) — mismo resultado
--    visible que hoy (SELECT: admin ve todo, miembro activo ve solo
--    active=true; INSERT/UPDATE/DELETE: solo admin), ahora acotado también
--    por organización.
-- 3) Crea `product_business_units`, tabla puramente asociativa N:M entre
--    product_catalog y business_units: 0 filas para un producto = producto
--    compartido/disponible para TODAS las Business Units de su
--    organización; 1+ filas = disponible únicamente para esas Business
--    Units. Esta regla es de LECTURA (cómo una consulta futura de Quotes
--    debe interpretar la tabla) — 0019 no construye esa consulta todavía.
-- 4) Trigger de integridad: impide relacionar un Product y una Business
--    Unit de organizaciones distintas (mismo patrón que
--    trg_person_business_units_same_org, 0017).
-- 5) RLS de `product_business_units`: SELECT para cualquier miembro activo
--    de la organización del producto (consumidor real: un VENDEDOR
--    necesitará leer esta tabla para saber qué productos están
--    disponibles al cotizar); INSERT/DELETE solo ADMIN de esa
--    organización; sin policy de UPDATE (la relación se borra y se vuelve
--    a crear, nunca se edita).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO agrega business_unit_id directamente a product_catalog — la
--   pertenencia a Business Units vive exclusivamente en
--   product_business_units.
-- - NO agrega cost — sin consumidor real en Quotes v1 (el PDF de
--   cotización nunca muestra costo interno).
-- - NO agrega ninguna tabla de pricing separada — el precio sugerido es
--   1:1 con el producto, mismo criterio que power/color/lens_type (ya
--   columnas simples, no una tabla de specs aparte).
-- - NO toca `product_types` — es clasificación de `orders`, sin relación
--   con Quotes.
-- - NO toca `orders`, `order_items`, `salespeople`, `organizations`,
--   `organization_members`, `business_units`, `customers`,
--   `fn_next_order_folio()`, `trg_set_order_folio`,
--   `trg_prevent_folio_change`, `salespeople.prefix`,
--   `salespeople.sequence_current`. `order_items.catalog_product_id`
--   sigue siendo la misma FK sin cambios de tipo ni de comportamiento.
-- - NO crea `quote_items` ni ninguna consulta de "productos disponibles
--   para cotizar" — fundación de datos, no feature de Quotes todavía.
-- - NO agrega columna `active` a product_business_units — la fila ES la
--   relación, existe o no existe (mismo principio que
--   person_business_units, 0017, pero ahí sí se agregó `active`; aquí se
--   omite explícitamente porque no hay caso de uso real para desactivar
--   una relación sin borrarla).
--
-- =========================================================================
-- DECISIÓN — backfill de organization_id: production-safe, sin asumir
-- datos:
-- =========================================================================
-- product_catalog ya puede tener productos reales en producción (a
-- diferencia de customers/0018, tabla nueva). El backfill NUNCA incrusta
-- un slug ('global-supplier-mty') ni usa min()/max() sobre uuid (no tiene
-- orden significativo): en tiempo de ejecución cuenta cuántos productos
-- existen sin organization_id; si hay al menos uno, exige que exista
-- EXACTAMENTE una organización en toda la base — si hay 0 o más de 1,
-- aborta la migración completa (ROLLBACK, begin/commit envuelve todo) en
-- vez de adivinar. Solo si hay exactamente una organización, resuelve su
-- id explícitamente y lo asigna a los productos huérfanos. Si
-- product_catalog está vacía, el backfill se salta por completo — no se
-- exige ninguna condición sobre `organizations` que no haga falta.
--
-- =========================================================================
-- DECISIÓN — organization_id nullable primero, NOT NULL al final:
-- =========================================================================
-- Mismo patrón seguro que el resto del proyecto para columnas NOT NULL
-- sobre tablas con datos: se agrega nullable, se backfillea, se verifica
-- que no queden NULLs, y solo entonces se aplica `SET NOT NULL`. Nunca se
-- intenta un NOT NULL directo que fallaría (o bloquearía) contra filas
-- existentes.
--
-- =========================================================================
-- DECISIÓN — trigger de integridad cross-organization (no CHECK):
-- =========================================================================
-- "product_catalog.organization_id = business_units.organization_id" no es
-- expresable con un CHECK simple (requiere leer dos tablas). Se usa un
-- trigger BEFORE INSERT/UPDATE, sin SECURITY DEFINER (no necesita bypass
-- de RLS, solo valida), con `set search_path = public` — mismo patrón
-- exacto que trg_person_business_units_same_org (0017).
--
-- =========================================================================
-- DECISIÓN — precios sin conversión automática ni historial:
-- =========================================================================
-- default_price_mxn/default_price_usd son sugerencias independientes: si
-- solo una está llena y una cotización futura es en la otra moneda, el
-- vendedor captura el precio a mano en quote_item (que no existe aún). No
-- hay motor de conversión ni tabla de historial de precios — el precio
-- vigente de venta siempre vivirá como snapshot en quote_items, nunca
-- recalculado contra este valor.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create table if not exists, do $$ if not exists $$ para triggers/
-- policies nuevas, drop+create para policies reemplazadas) y corre
-- completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) product_catalog: organization_id (backfill production-safe) + pricing
-- =========================================================================
alter table product_catalog
  add column if not exists organization_id uuid null references organizations (id) on delete restrict;

do $$
declare
  v_legacy_count integer;
  v_org_count integer;
  v_org_id uuid;
begin
  select count(*) into v_legacy_count from product_catalog where organization_id is null;

  if v_legacy_count > 0 then
    select count(*) into v_org_count from organizations;

    if v_org_count <> 1 then
      raise exception
        '0019: % producto(s) de product_catalog requieren backfill de organization_id, pero existen % organizaciones (se esperaba exactamente 1). Backfill abortado — requiere resolución manual antes de continuar.',
        v_legacy_count, v_org_count;
    end if;

    select id into v_org_id from organizations;

    update product_catalog set organization_id = v_org_id where organization_id is null;

    if exists (select 1 from product_catalog where organization_id is null) then
      raise exception '0019: quedaron productos con organization_id NULL después del backfill. Abortado.';
    end if;
  end if;
end $$;

alter table product_catalog alter column organization_id set not null;

create index if not exists product_catalog_organization_idx on product_catalog (organization_id);

alter table product_catalog
  add column if not exists default_price_mxn numeric(12,2)
    constraint product_catalog_default_price_mxn_nonneg check (default_price_mxn is null or default_price_mxn >= 0),
  add column if not exists default_price_usd numeric(12,2)
    constraint product_catalog_default_price_usd_nonneg check (default_price_usd is null or default_price_usd >= 0);

-- =========================================================================
-- 2) RLS product_catalog — reemplaza las policies de 0011 por versiones
--    organization-scoped (mismo resultado visible hoy: una sola
--    organización real).
-- =========================================================================
drop policy if exists "product_catalog_select" on product_catalog;
create policy "product_catalog_select" on product_catalog
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and active = true)
  );

drop policy if exists "product_catalog_admin_write" on product_catalog;
create policy "product_catalog_admin_write" on product_catalog
  for all using (is_organization_admin(organization_id)) with check (is_organization_admin(organization_id));

-- =========================================================================
-- 3) product_business_units — N:M, 0 filas = compartido con todas las BU
--    de la organización del producto.
-- =========================================================================
create table if not exists product_business_units (
  product_id uuid not null references product_catalog (id) on delete cascade,
  business_unit_id uuid not null references business_units (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_business_units_pk primary key (product_id, business_unit_id)
);

-- Sin índice propio por product_id: la PK compuesta ya lo cubre como
-- columna líder (mismo criterio que person_business_units, 0017).
create index if not exists product_business_units_bu_idx on product_business_units (business_unit_id);

-- =========================================================================
-- 4) Trigger de integridad: Product y Business Unit deben pertenecer a la
--    misma organización.
-- =========================================================================
create or replace function trg_check_product_business_unit_same_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_product_org uuid;
  v_bu_org uuid;
begin
  select organization_id into v_product_org from product_catalog where id = new.product_id;
  select organization_id into v_bu_org from business_units where id = new.business_unit_id;

  if v_product_org is distinct from v_bu_org then
    raise exception
      'product_business_units: el producto % (organización %) y la business unit % (organización %) no pertenecen a la misma organización.',
      new.product_id, v_product_org, new.business_unit_id, v_bu_org;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_product_business_units_same_org'
  ) then
    create trigger trg_product_business_units_same_org
      before insert or update on product_business_units
      for each row execute function trg_check_product_business_unit_same_org();
  end if;
end $$;

-- =========================================================================
-- 5) RLS product_business_units — sin columna organization_id propia:
--    se deriva de product_catalog.organization_id (el trigger de arriba
--    garantiza que coincide con business_units.organization_id).
-- =========================================================================
alter table product_business_units enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_business_units'
      and policyname = 'product_business_units_select_member'
  ) then
    create policy "product_business_units_select_member" on product_business_units
      for select using (
        exists (
          select 1 from product_catalog pc
          where pc.id = product_id and is_organization_member(pc.organization_id)
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_business_units'
      and policyname = 'product_business_units_insert_admin'
  ) then
    create policy "product_business_units_insert_admin" on product_business_units
      for insert with check (
        exists (
          select 1 from product_catalog pc
          where pc.id = product_id and is_organization_admin(pc.organization_id)
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_business_units'
      and policyname = 'product_business_units_delete_admin'
  ) then
    create policy "product_business_units_delete_admin" on product_business_units
      for delete using (
        exists (
          select 1 from product_catalog pc
          where pc.id = product_id and is_organization_admin(pc.organization_id)
        )
      );
  end if;
end $$;

commit;
