-- GS Orders — Migración 0020: THÖREN Quotes Q3 — Quotes Core
--
-- Tercera pieza de THÖREN Quotes: crea `quotes`, `quote_items` y
-- `salesperson_quote_sequences` (motor de folios propio, independiente de
-- Orders). 100% aditivo — ninguna tabla existente se modifica (a
-- diferencia de 0018/0019, que sí tocaban tablas ya en producción).
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `quotes`: pertenece obligatoriamente a Organization, Business
--    Unit, Salesperson y Customer (FKs not null, on delete restrict).
--    Folio inmutable, status con lifecycle fijo, currency MXN/USD,
--    tax_rate y global_discount_percent numeric(5,2), valid_until,
--    snapshots comerciales (customer/business_unit/salesperson) y totales
--    persistidos (subtotal/discount_total/tax_total/total).
-- 2) Crea `quote_items`: catalog_product_id opcional (línea de catálogo o
--    línea libre), snapshot comercial completo por línea (model,
--    description, unit_price, quantity, line_discount_percent,
--    line_subtotal) — nunca vuelve a leer product_catalog una vez creada.
-- 3) Crea `salesperson_quote_sequences`: motor de folios Salesperson × BU,
--    completamente independiente de salespeople.prefix/sequence_current.
-- 4) fn_next_quote_folio(): equivalente conceptual a fn_next_order_folio(),
--    SELECT FOR UPDATE sobre la fila de secuencia, atómico.
-- 5) rpc_create_quote()/rpc_update_quote(): SECURITY INVOKER, transacción
--    única (RPC), calculan snapshots y totales server-side — la app nunca
--    manda un total confiable, solo cantidades/precios/porcentajes de
--    entrada.
-- 6) Triggers de integridad: consistencia cross-organization
--    (quotes y salesperson_quote_sequences), inmutabilidad de folio
--    (trg_prevent_quote_folio_change, equivalente a
--    trg_prevent_folio_change de Orders pero independiente), y
--    transición de status + congelamiento de contenido comercial fuera
--    de "borrador" (trg_quote_status_transition).
-- 7) RLS de las 3 tablas: ADMIN ve/administra todo en su organización;
--    VENDEDOR ve/crea/edita únicamente sus propias Quotes, y únicamente
--    mientras status = 'borrador' para quote_items; sin policy de DELETE
--    en quotes (cancelación es un status, no un borrado físico).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca `orders`, `order_items`, `product_catalog`,
--   `product_business_units`, `customers`, `salespeople`, `business_units`,
--   `people`, `person_business_units`, `organizations`,
--   `organization_members`, `user_profiles`. Ninguna de estas tablas
--   recibe ALTER, ninguna policy existente se reemplaza.
-- - NO toca fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, salespeople.prefix,
--   salespeople.sequence_current. El motor de folios de Quotes es
--   completamente propio, sin código ni tabla compartida con Orders.
-- - NO crea ni modifica UI/RPC de administración de person_business_units
--   — ver DECISIÓN "fallback legacy" abajo. Esa administración explícita
--   es una fase posterior.
-- - NO crea quote versions, approval workflow, e-signatures, envío por
--   email/WhatsApp, generación de PDF, conversión Quote→Order, invoices,
--   payments, CRM opportunities, commissions, inventory, suppliers,
--   cost/margin, FX engine, audit log complejo, attachments, templates,
--   generación por IA.
-- - NO agrega status "vencida": el vencimiento (valid_until < hoy) es una
--   condición derivada, calculada y mostrada por la UI en una fase
--   posterior — nunca cambia el status almacenado.
--
-- =========================================================================
-- DECISIÓN — Salesperson ↔ Business Unit: fallback legacy temporal:
-- =========================================================================
-- salespeople NO tiene organization_id propio (decisión ya registrada en
-- 0013) — la única forma de resolver su organización es
-- salesperson_id → person_id (0016, nullable) → people.organization_id.
-- Reglas exactas aplicadas por trg_check_salesperson_quote_sequence_valid:
--   A) salesperson.person_id IS NULL → excepción explícita, ninguna
--      configuración de folio posible. Sin backfill automático, sin
--      inventar Person.
--   B) La Person tiene 1+ filas en person_business_units → solo puede
--      configurarse/cotizar para esas Business Units exactas.
--   C) La Person tiene 0 filas en person_business_units → FALLBACK LEGACY
--      TEMPORAL: puede configurarse para cualquier Business Unit ACTIVA
--      de su misma organización.
--
-- Legacy compatibility fallback.
-- When explicit Person↔Business Unit administration is implemented,
-- this fallback should be removed and explicit assignments required.
--
-- No es una regla permanente del producto: hoy person_business_units está
-- vacía en producción (sin UI/RPC que la escriba, ver 0017), así que exigir
-- 1+ filas como requisito duro bloquearía al 100% de los vendedores. Esta
-- migración NO crea UI ni RPC para administrar person_business_units —
-- eso queda para una fase posterior, momento en el que este fallback debe
-- eliminarse explícitamente.
--
-- =========================================================================
-- DECISIÓN — organization_id en salesperson_quote_sequences:
-- =========================================================================
-- Se incluye de forma explícita (no derivado únicamente vía joins)
-- porque salespeople no tiene organization_id propio: sin esta columna,
-- un UNIQUE real de prefix por organización sería imposible de expresar
-- como índice simple, y la RLS necesitaría una subconsulta encadenada en
-- cada evaluación. Con organization_id presente, el UNIQUE
-- (organization_id, upper(quote_prefix)) es directo y la RLS reutiliza
-- is_organization_admin(organization_id)/is_organization_member(organization_id)
-- exactamente igual que el resto de Core.
--
-- =========================================================================
-- DECISIÓN — quote_prefix: 1–20 caracteres, NO limitado a 3:
-- =========================================================================
-- check (quote_prefix = upper(quote_prefix)) fuerza mayúsculas; charset
-- '^[A-Z0-9-]+$' permite "VPT", "VP", "VLAD-T", "NORTE01"; longitud 1–20
-- es un límite razonable de sanidad, nunca una regla de negocio de 3
-- caracteres. La UI futura podrá sugerir nomenclatura sin imponerla en DB.
--
-- =========================================================================
-- DECISIÓN — dinero: numeric(12,2), nunca float ni centavos enteros:
-- =========================================================================
-- Consistente con product_catalog.default_price_mxn/usd (0019). Fórmula y
-- redondeo (aplicados en rpc_create_quote/rpc_update_quote, nunca en la
-- app): cada multiplicación por porcentaje se redondea a 2 decimales
-- inmediatamente después de calcularse; sumas/restas entre valores ya
-- redondeados son exactas (numeric, sin coma flotante binaria):
--   line_gross = quantity × unit_price
--   line_discount_amount = round(line_gross × line_discount_percent / 100, 2)
--   line_subtotal = line_gross − line_discount_amount
--   quote_subtotal = Σ line_subtotal
--   global_discount_amount = round(quote_subtotal × global_discount_percent / 100, 2)
--   taxable_base = quote_subtotal − global_discount_amount
--   tax_total = round(taxable_base × tax_rate / 100, 2)
--   total = taxable_base + tax_total
--
-- =========================================================================
-- DECISIÓN — totales persistidos, mantenidos únicamente por RPC:
-- =========================================================================
-- subtotal/discount_total/tax_total/total (quotes) y line_subtotal
-- (quote_items) se recalculan completos dentro de rpc_create_quote/
-- rpc_update_quote en cada escritura — nunca por trigger por fila, nunca
-- confiando en un valor mandado por la app. Evita listados/PDFs futuros
-- con lógica de cálculo inconsistente sin duplicar la fuente de verdad
-- (las líneas siguen siendo la fuente real; los totales son su resultado
-- cacheado, mantenido en un único punto de escritura).
--
-- =========================================================================
-- DECISIÓN — trg_check_quote_consistency es SECURITY DEFINER (única
-- excepción de esta migración):
-- =========================================================================
-- Descubierto empíricamente durante pruebas: bajo una sesión de VENDEDOR
-- (rpc_create_quote/rpc_update_quote son SECURITY INVOKER), el trigger
-- necesita leer people.organization_id para resolver la organización del
-- salesperson, pero `people` solo tiene policy de SELECT para ADMIN. Sin
-- SECURITY DEFINER, esa lectura vuelve NULL bajo la sesión del VENDEDOR y
-- el trigger rechaza con un falso "no pertenecen a la misma
-- organización" cada Quote creada/editada por un VENDEDOR — no es una
-- preferencia de diseño, es un requisito real verificado con pruebas.
-- No amplía autorización (no decide quién puede crear una Quote, eso lo
-- siguen decidiendo las policies de `quotes`), solo permite validar una
-- invariante estructural sin depender de la visibilidad RLS de quien
-- dispara el trigger. trg_check_salesperson_quote_sequence_valid NO
-- necesitó este cambio: en su lugar se acotó a disparar solo en INSERT o
-- en updates de las columnas de identidad (salesperson_id/
-- business_unit_id/organization_id) — esas solo las escribe un ADMIN en
-- la práctica, que sí puede leer `people`; los incrementos rutinarios de
-- sequence_current (hechos por el propio VENDEDOR vía fn_next_quote_folio)
-- ya no disparan el trigger en absoluto.
--
-- =========================================================================
-- DECISIÓN — snapshots: siempre resueltos server-side, nunca confiados
-- desde el cliente:
-- =========================================================================
-- customer_name/legal_name/tax_id, business_unit_name/code,
-- salesperson_name, y cada model/description/unit_price/quantity/
-- line_discount_percent de quote_items se resuelven dentro del RPC desde
-- las entidades reales en el momento de crear — mismo principio que
-- product_type_name_snapshot (0010). Una edición posterior de Customer/
-- Product Master/Business Unit/Salesperson jamás altera una Quote ya
-- creada.
--
-- =========================================================================
-- DECISIÓN — edición solo en "borrador", con protección en DB (no solo
-- UI):
-- =========================================================================
-- trg_quote_status_transition valida transiciones permitidas
-- (borrador→enviada|cancelada; enviada→aceptada|rechazada|cancelada;
-- aceptada/rechazada/cancelada son terminales) y congela el contenido
-- comercial completo (customer_id, currency, tax_rate,
-- global_discount_percent, valid_until, snapshots, totales) en cuanto
-- old.status <> 'borrador'. `notes` queda explícitamente fuera de ese
-- congelamiento — es una anotación interna, no contenido comercial/legal
-- de la cotización. quote_items usa el mismo criterio vía RLS (solo
-- escribible mientras la Quote padre esté en 'borrador').
--
-- Como el resto del proyecto: idempotente (create table if not exists, do
-- $$ if not exists $$ para policies/triggers) y corre completa en una
-- sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) quotes
-- =========================================================================
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  business_unit_id uuid not null references business_units (id) on delete restrict,
  salesperson_id uuid not null references salespeople (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,

  folio text not null,
  sequence_number integer not null,

  quote_date date not null,
  status text not null default 'borrador'
    check (status in ('borrador', 'enviada', 'aceptada', 'rechazada', 'cancelada')),

  currency text not null check (currency in ('MXN', 'USD')),
  tax_rate numeric(5,2) not null default 16.00 check (tax_rate between 0 and 100),
  global_discount_percent numeric(5,2) not null default 0 check (global_discount_percent between 0 and 100),

  valid_until date not null,

  customer_name text not null,
  customer_legal_name text,
  customer_tax_id text,
  business_unit_name text not null,
  business_unit_code text not null,
  salesperson_name text not null,

  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quotes_folio_unique on quotes (folio);
create index if not exists quotes_organization_idx on quotes (organization_id);
create index if not exists quotes_salesperson_idx on quotes (salesperson_id);
create index if not exists quotes_customer_idx on quotes (customer_id);
create index if not exists quotes_business_unit_idx on quotes (business_unit_id);
create index if not exists quotes_status_idx on quotes (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_quotes_updated_at') then
    create trigger trg_quotes_updated_at
      before update on quotes
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) quote_items
-- =========================================================================
create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes (id) on delete cascade,
  position integer not null default 0,

  catalog_product_id uuid references product_catalog (id) on delete set null,

  model text not null,
  description text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_discount_percent numeric(5,2) not null default 0 check (line_discount_percent between 0 and 100),

  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_items_quote_idx on quote_items (quote_id);
create index if not exists quote_items_catalog_product_idx on quote_items (catalog_product_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_quote_items_updated_at') then
    create trigger trg_quote_items_updated_at
      before update on quote_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) salesperson_quote_sequences — motor de folios propio de Quotes
-- =========================================================================
create table if not exists salesperson_quote_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  salesperson_id uuid not null references salespeople (id) on delete restrict,
  business_unit_id uuid not null references business_units (id) on delete restrict,

  quote_prefix text not null
    constraint quote_prefix_format check (quote_prefix = upper(quote_prefix))
    constraint quote_prefix_charset check (quote_prefix ~ '^[A-Z0-9-]+$')
    constraint quote_prefix_length check (char_length(quote_prefix) between 1 and 20),

  sequence_current integer not null default 0 check (sequence_current >= 0),
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint salesperson_quote_sequences_unique_pair unique (salesperson_id, business_unit_id)
);

create unique index if not exists salesperson_quote_sequences_prefix_unique
  on salesperson_quote_sequences (organization_id, upper(quote_prefix));
create index if not exists salesperson_quote_sequences_organization_idx
  on salesperson_quote_sequences (organization_id);
create index if not exists salesperson_quote_sequences_business_unit_idx
  on salesperson_quote_sequences (business_unit_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_salesperson_quote_sequences_updated_at'
  ) then
    create trigger trg_salesperson_quote_sequences_updated_at
      before update on salesperson_quote_sequences
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 4) Trigger: Salesperson ↔ Business Unit ↔ Organization — ver DECISIÓN
--    "fallback legacy" arriba.
-- =========================================================================
create or replace function trg_check_salesperson_quote_sequence_valid()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_person_id uuid;
  v_person_org uuid;
  v_bu_org uuid;
  v_bu_active boolean;
  v_assigned_count integer;
  v_matching_assignment integer;
begin
  select person_id into v_person_id from salespeople where id = new.salesperson_id;

  if v_person_id is null then
    raise exception
      'salesperson_quote_sequences: el salesperson % no tiene Person vinculada (person_id NULL). No se puede configurar folio de Quotes hasta resolver ese vínculo.',
      new.salesperson_id;
  end if;

  select organization_id into v_person_org from people where id = v_person_id;
  select organization_id, active into v_bu_org, v_bu_active from business_units where id = new.business_unit_id;

  if v_person_org is distinct from v_bu_org then
    raise exception
      'salesperson_quote_sequences: el salesperson % (organización %) y la business unit % (organización %) no pertenecen a la misma organización.',
      new.salesperson_id, v_person_org, new.business_unit_id, v_bu_org;
  end if;

  if new.organization_id is distinct from v_bu_org then
    raise exception
      'salesperson_quote_sequences: organization_id (%) no coincide con la organización real de la business unit (%).',
      new.organization_id, v_bu_org;
  end if;

  select count(*) into v_assigned_count from person_business_units where person_id = v_person_id;

  if v_assigned_count > 0 then
    select count(*) into v_matching_assignment
      from person_business_units
      where person_id = v_person_id and business_unit_id = new.business_unit_id;

    if v_matching_assignment = 0 then
      raise exception
        'salesperson_quote_sequences: la Person del salesperson % tiene asignaciones explícitas en person_business_units, pero ninguna corresponde a la business unit %. Solo puede configurarse para sus Business Units asignadas.',
        new.salesperson_id, new.business_unit_id;
    end if;
  else
    -- Fallback legacy temporal (ver DECISIÓN arriba): sin asignaciones
    -- explícitas, cualquier Business Unit ACTIVA de la misma organización
    -- es válida.
    if not v_bu_active then
      raise exception
        'salesperson_quote_sequences: fallback legacy (sin asignaciones explícitas en person_business_units) solo permite Business Units activas; % está inactiva.',
        new.business_unit_id;
    end if;
  end if;

  return new;
end;
$$;

-- Disparador acotado a insert / cambios de columnas de identidad
-- (salesperson_id, business_unit_id, organization_id) — NUNCA en updates
-- simples de sequence_current. Es más que una optimización: la función no
-- es SECURITY DEFINER, así que su SELECT interno a `people` queda sujeto a
-- la RLS de quien ejecuta el UPDATE. fn_next_quote_folio() incrementa
-- sequence_current bajo la sesión del propio VENDEDOR, que NO tiene
-- policy de SELECT sobre `people` (admin-only, 0015/0016) — si el trigger
-- disparara en cada incremento, esa relectura fallaría (resolvería
-- organización NULL) y rechazaría folios legítimos. Disparar solo cuando
-- las columnas de identidad cambian evita ese falso negativo sin
-- necesitar SECURITY DEFINER: esas columnas solo las escribe un ADMIN
-- (INSERT/reconfiguración), que sí puede leer `people`.
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_salesperson_quote_sequences_valid'
  ) then
    create trigger trg_salesperson_quote_sequences_valid
      before insert or update of salesperson_id, business_unit_id, organization_id
      on salesperson_quote_sequences
      for each row execute function trg_check_salesperson_quote_sequence_valid();
  end if;
end $$;

-- =========================================================================
-- 5) Trigger: consistencia cross-organization en quotes (business_unit,
--    customer, salesperson vía person_id, deben coincidir con
--    organization_id).
-- =========================================================================
-- SECURITY DEFINER — única excepción de esta migración a "sin helpers
-- SECURITY DEFINER nuevos", justificada por necesidad real y verificada
-- empíricamente (no preferencia de diseño): esta función corre en cada
-- INSERT de una Quote, incluidas las creadas por un VENDEDOR (RPC
-- SECURITY INVOKER). Necesita leer people.organization_id para resolver
-- la organización real del salesperson, pero `people` solo tiene policy
-- de SELECT para ADMIN (0015/0016) — bajo una sesión de VENDEDOR, sin
-- DEFINER, esa lectura devuelve NULL y rechaza folios/Quotes legítimas
-- con un falso "no pertenecen a la misma organización". No es una
-- decisión de autorización (no relaja quién puede crear una Quote — eso
-- lo deciden las policies de `quotes`, evaluadas aparte); es únicamente
-- para poder validar una invariante estructural sin depender de la
-- visibilidad RLS de quien dispara el trigger.
create or replace function trg_check_quote_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bu_org uuid;
  v_customer_org uuid;
  v_person_id uuid;
  v_person_org uuid;
begin
  select organization_id into v_bu_org from business_units where id = new.business_unit_id;
  select organization_id into v_customer_org from customers where id = new.customer_id;
  select person_id into v_person_id from salespeople where id = new.salesperson_id;

  if v_person_id is null then
    raise exception
      'quotes: el salesperson % no tiene Person vinculada. No se puede crear/editar una Quote hasta resolver ese vínculo.',
      new.salesperson_id;
  end if;

  select organization_id into v_person_org from people where id = v_person_id;

  if new.organization_id is distinct from v_bu_org
     or new.organization_id is distinct from v_customer_org
     or new.organization_id is distinct from v_person_org then
    raise exception
      'quotes: organization_id (%) no es consistente entre business_unit (%), customer (%) y salesperson (%).',
      new.organization_id, v_bu_org, v_customer_org, v_person_org;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_quotes_consistency'
  ) then
    create trigger trg_quotes_consistency
      before insert or update on quotes
      for each row execute function trg_check_quote_consistency();
  end if;
end $$;

-- =========================================================================
-- 6) Trigger: inmutabilidad de folio — equivalente conceptual a
--    trg_prevent_folio_change (Orders), completamente independiente.
-- =========================================================================
create or replace function trg_prevent_quote_folio_change()
returns trigger
language plpgsql
as $$
begin
  if new.folio is distinct from old.folio then
    raise exception 'El folio de una Quote no se puede modificar (%). Duplícala para generar una nueva.', old.folio;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una Quote no se puede modificar.';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  if new.business_unit_id is distinct from old.business_unit_id then
    raise exception 'La Business Unit de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  if new.quote_date is distinct from old.quote_date then
    raise exception 'La fecha de una Quote no se puede cambiar una vez generado el folio.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_quotes_prevent_folio_change'
  ) then
    create trigger trg_quotes_prevent_folio_change
      before update on quotes
      for each row execute function trg_prevent_quote_folio_change();
  end if;
end $$;

-- =========================================================================
-- 7) Trigger: transición de status + congelamiento de contenido comercial
--    fuera de "borrador". Protección en DB, no solo en UI.
-- =========================================================================
create or replace function trg_quote_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'borrador' and new.status in ('enviada', 'cancelada'))
      or (old.status = 'enviada' and new.status in ('aceptada', 'rechazada', 'cancelada'))
    ) then
      raise exception 'Transición de status inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status <> 'borrador' then
    if new.customer_id is distinct from old.customer_id
      or new.currency is distinct from old.currency
      or new.tax_rate is distinct from old.tax_rate
      or new.global_discount_percent is distinct from old.global_discount_percent
      or new.valid_until is distinct from old.valid_until
      or new.subtotal is distinct from old.subtotal
      or new.discount_total is distinct from old.discount_total
      or new.tax_total is distinct from old.tax_total
      or new.total is distinct from old.total
      or new.customer_name is distinct from old.customer_name
      or new.customer_legal_name is distinct from old.customer_legal_name
      or new.customer_tax_id is distinct from old.customer_tax_id
      or new.business_unit_name is distinct from old.business_unit_name
      or new.business_unit_code is distinct from old.business_unit_code
      or new.salesperson_name is distinct from old.salesperson_name
    then
      raise exception 'No se puede modificar el contenido comercial de una Quote fuera de status borrador (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_quotes_status_transition'
  ) then
    create trigger trg_quotes_status_transition
      before update on quotes
      for each row execute function trg_quote_status_transition();
  end if;
end $$;

-- =========================================================================
-- 8) fn_next_quote_folio — equivalente conceptual a fn_next_order_folio(),
--    completamente independiente. SELECT ... FOR UPDATE atómico.
-- =========================================================================
-- SECURITY DEFINER — justificado: la policy de UPDATE de
-- salesperson_quote_sequences es ahora ADMIN-only (ver sección 13), así
-- que un VENDEDOR ya NO puede hacer ningún UPDATE directo sobre esa tabla
-- (ni quote_prefix, ni active, ni sequence_current). El único camino para
-- que un VENDEDOR obtenga folio de su propia Quote es esta función,
-- corriendo con privilegios elevados para poder ejecutar el UPDATE
-- atómico del consecutivo — pero NUNCA confía en los parámetros de
-- entrada por sí solos: reimplementa exactamente la misma decisión de
-- autorización que antes daba la RLS (ADMIN de la organización real de
-- la fila, resuelta desde la fila misma — nunca de un parámetro — o el
-- propio VENDEDOR dueño de p_salesperson_id, verificado contra
-- current_user_salesperson_id()), reutilizando is_organization_admin()/
-- is_organization_member() (0013) — sin helpers nuevos. No amplía acceso
-- a ninguna otra tabla: solo lee/actualiza salesperson_quote_sequences.
create or replace function fn_next_quote_folio(
  p_salesperson_id uuid,
  p_business_unit_id uuid,
  p_quote_date date
)
returns table (folio text, sequence_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_prefix text;
  v_active boolean;
  v_seq integer;
  v_date_part text;
begin
  select organization_id, quote_prefix, active
    into v_organization_id, v_prefix, v_active
    from salesperson_quote_sequences
    where salesperson_id = p_salesperson_id and business_unit_id = p_business_unit_id
    for update;

  if v_prefix is null then
    raise exception 'No existe configuración de folio de Quotes para este Salesperson × Business Unit.';
  end if;

  -- Autorización explícita (esta función corre con privilegios elevados,
  -- bypassa RLS): organization_id se resolvió de la fila real, nunca de
  -- un parámetro — imposible de falsificar. ADMIN de esa organización, o
  -- el propio VENDEDOR dueño de p_salesperson_id y miembro activo de esa
  -- organización. Ninguna otra combinación puede generar folio.
  if not (
    is_organization_admin(v_organization_id)
    or (is_organization_member(v_organization_id) and p_salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'fn_next_quote_folio: no tienes permiso para generar un folio para este Salesperson × Business Unit.';
  end if;

  if not v_active then
    raise exception 'La configuración de folio % está inactiva.', v_prefix;
  end if;

  update salesperson_quote_sequences
    set sequence_current = sequence_current + 1
    where salesperson_id = p_salesperson_id and business_unit_id = p_business_unit_id
    returning sequence_current into v_seq;

  v_date_part := to_char(p_quote_date, 'YYYY') || to_char(p_quote_date, 'DD') || to_char(p_quote_date, 'MM');

  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

-- =========================================================================
-- 9) rpc_create_quote — SECURITY INVOKER: la RLS real de quotes/quote_items
--    se aplica sobre las escrituras internas, esta función no bypassa
--    autorización, solo orquesta snapshots + folio + totales en una sola
--    transacción.
-- =========================================================================
create or replace function rpc_create_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_business_unit_id uuid := (p_quote->>'business_unit_id')::uuid;
  v_salesperson_id uuid := (p_quote->>'salesperson_id')::uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_quote_date date := coalesce((p_quote->>'quote_date')::date, current_date);
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := coalesce((p_quote->>'valid_until')::date, (coalesce((p_quote->>'quote_date')::date, current_date) + 15));
  v_notes text := p_quote->>'notes';

  v_organization_id uuid;
  v_bu_name text;
  v_bu_code text;
  v_sp_name text;
  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_folio_result record;

  v_item jsonb;
  v_position integer;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select organization_id, name, code into v_organization_id, v_bu_name, v_bu_code
    from business_units where id = v_business_unit_id;
  if v_organization_id is null then
    raise exception 'rpc_create_quote: business unit % no encontrada.', v_business_unit_id;
  end if;

  select name into v_sp_name from salespeople where id = v_salesperson_id;
  if v_sp_name is null then
    raise exception 'rpc_create_quote: salesperson % no encontrado.', v_salesperson_id;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote: customer % no encontrado.', v_customer_id;
  end if;

  select * into v_folio_result from fn_next_quote_folio(v_salesperson_id, v_business_unit_id, v_quote_date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  insert into quotes (
    id, organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status,
    currency, tax_rate, global_discount_percent, valid_until,
    customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total, notes
  )
  values (
    p_quote_id, v_organization_id, v_business_unit_id, v_salesperson_id, v_customer_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_quote_date, 'borrador',
    v_currency, v_tax_rate, v_global_discount_percent, v_valid_until,
    v_customer_name, v_customer_legal_name, v_customer_tax_id,
    v_bu_name, v_bu_code, v_sp_name,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_notes
  )
  returning * into v_quote;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal
    )
    values (
      v_quote.id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 10) rpc_update_quote — SECURITY INVOKER, mismo patrón "borra y reinserta
--     todos los items" que rpc_update_order. Verifica status = 'borrador'
--     explícitamente (defensa adicional sobre RLS/trigger, mismo criterio
--     que updateCustomer/updateCatalogProduct).
-- =========================================================================
create or replace function rpc_update_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_current_status text;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := (p_quote->>'valid_until')::date;
  v_notes text := p_quote->>'notes';

  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_item jsonb;
  v_position integer;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select status into v_current_status from quotes where id = p_quote_id;
  if v_current_status is null then
    raise exception 'rpc_update_quote: Quote % no encontrada.', p_quote_id;
  end if;
  if v_current_status <> 'borrador' then
    raise exception
      'rpc_update_quote: la Quote % no está en borrador (status actual: %); su contenido comercial no puede editarse.',
      p_quote_id, v_current_status;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_update_quote: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  update quotes set
    customer_id = v_customer_id,
    currency = v_currency,
    tax_rate = v_tax_rate,
    global_discount_percent = v_global_discount_percent,
    valid_until = v_valid_until,
    customer_name = v_customer_name,
    customer_legal_name = v_customer_legal_name,
    customer_tax_id = v_customer_tax_id,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    total = v_total,
    notes = v_notes
  where id = p_quote_id
  returning * into v_quote;

  if not found then
    raise exception 'rpc_update_quote: Quote % no encontrada al actualizar.', p_quote_id;
  end if;

  delete from quote_items where quote_id = p_quote_id;
  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal
    )
    values (
      p_quote_id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 11) RLS — quotes: ADMIN ve/crea/edita todo en su organización; VENDEDOR
--     solo sus propias Quotes. Reutiliza is_organization_admin()/
--     is_organization_member() (0013) + current_user_salesperson_id()
--     (0011) — sin helpers SECURITY DEFINER nuevos. Sin policy de DELETE.
-- =========================================================================
alter table quotes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes'
      and policyname = 'quotes_select_own_or_admin'
  ) then
    create policy "quotes_select_own_or_admin" on quotes
      for select using (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes'
      and policyname = 'quotes_insert_own_or_admin'
  ) then
    create policy "quotes_insert_own_or_admin" on quotes
      for insert with check (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quotes'
      and policyname = 'quotes_update_own_or_admin'
  ) then
    create policy "quotes_update_own_or_admin" on quotes
      for update using (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
      ) with check (
        is_organization_admin(organization_id)
        or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
      );
  end if;
end $$;

-- =========================================================================
-- 12) RLS — quote_items: visibilidad igual a la Quote padre; escritura
--     (INSERT/UPDATE/DELETE) solo mientras la Quote padre esté en
--     'borrador'.
-- =========================================================================
alter table quote_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_items'
      and policyname = 'quote_items_select_own_or_admin'
  ) then
    create policy "quote_items_select_own_or_admin" on quote_items
      for select using (
        exists (
          select 1 from quotes q
          where q.id = quote_id
            and (is_organization_admin(q.organization_id)
              or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_items'
      and policyname = 'quote_items_insert_borrador_own_or_admin'
  ) then
    create policy "quote_items_insert_borrador_own_or_admin" on quote_items
      for insert with check (
        exists (
          select 1 from quotes q
          where q.id = quote_id
            and q.status = 'borrador'
            and (is_organization_admin(q.organization_id)
              or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_items'
      and policyname = 'quote_items_update_borrador_own_or_admin'
  ) then
    create policy "quote_items_update_borrador_own_or_admin" on quote_items
      for update using (
        exists (
          select 1 from quotes q
          where q.id = quote_id
            and q.status = 'borrador'
            and (is_organization_admin(q.organization_id)
              or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
        )
      ) with check (
        exists (
          select 1 from quotes q
          where q.id = quote_id
            and q.status = 'borrador'
            and (is_organization_admin(q.organization_id)
              or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'quote_items'
      and policyname = 'quote_items_delete_borrador_own_or_admin'
  ) then
    create policy "quote_items_delete_borrador_own_or_admin" on quote_items
      for delete using (
        exists (
          select 1 from quotes q
          where q.id = quote_id
            and q.status = 'borrador'
            and (is_organization_admin(q.organization_id)
              or (is_organization_member(q.organization_id) and q.salesperson_id = current_user_salesperson_id()))
        )
      );
  end if;
end $$;

-- =========================================================================
-- 13) RLS — salesperson_quote_sequences: SELECT cualquier miembro activo;
--     INSERT/UPDATE/DELETE exclusivamente ADMIN. A diferencia del patrón
--     de salespeople.sequence_current (0011, donde el propio VENDEDOR
--     tiene UPDATE directo sobre su fila), aquí se decidió deliberadamente
--     NO heredar esa exposición: un VENDEDOR nunca tiene UPDATE directo
--     sobre quote_prefix/sequence_current/active, ni siquiera de su propia
--     fila. El incremento atómico de sequence_current para un VENDEDOR
--     pasa exclusivamente por fn_next_quote_folio() (SECURITY DEFINER,
--     ver sección 8), que reimplementa la misma autorización
--     (ADMIN u propio dueño) dentro de la función en vez de vía RLS.
-- =========================================================================
alter table salesperson_quote_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'salesperson_quote_sequences'
      and policyname = 'salesperson_quote_sequences_select_member'
  ) then
    create policy "salesperson_quote_sequences_select_member" on salesperson_quote_sequences
      for select using (is_organization_member(organization_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'salesperson_quote_sequences'
      and policyname = 'salesperson_quote_sequences_insert_admin'
  ) then
    create policy "salesperson_quote_sequences_insert_admin" on salesperson_quote_sequences
      for insert with check (is_organization_admin(organization_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'salesperson_quote_sequences'
      and policyname = 'salesperson_quote_sequences_delete_admin'
  ) then
    create policy "salesperson_quote_sequences_delete_admin" on salesperson_quote_sequences
      for delete using (is_organization_admin(organization_id));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'salesperson_quote_sequences'
      and policyname = 'salesperson_quote_sequences_update_admin'
  ) then
    create policy "salesperson_quote_sequences_update_admin" on salesperson_quote_sequences
      for update using (is_organization_admin(organization_id))
      with check (is_organization_admin(organization_id));
  end if;
end $$;

commit;
