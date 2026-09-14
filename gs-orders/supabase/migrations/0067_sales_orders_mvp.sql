-- =========================================================================
-- THÖREN — 0067: Sales Orders MVP
-- =========================================================================
-- Primer flujo operativo de ventas independiente de `orders` (Pedidos —
-- órdenes de fabricación/instalación internas, ver 0001_core.sql) y de
-- `purchase_orders` (Compras a proveedor, ver 0035). `sales_orders` es un
-- concepto comercial nuevo y paralelo: encabezado con cliente/vendedor/
-- moneda/condiciones comerciales/direcciones snapshot + totales, y líneas
-- (`sales_order_items`) con snapshot completo por línea (producto de
-- catálogo o línea libre). No reemplaza ni toca `orders`/`purchase_orders`/
-- `quotes` en absoluto — 100% aditivo.
--
-- No se implementa aquí: Inventory (reservas/fulfillment reales),
-- Procurement automático, Payments, Commissions, Financial Release, PDF.
-- `estimated_unit_cost`/`estimated_margin` por línea existen como columnas
-- (spec del ticket) pero NUNCA se calculan automáticamente en este archivo
-- — quedan NULL salvo que se provean explícitamente, listas para una fase
-- de costos/márgenes futura (can_view_costs, 0040, sigue sin dato real que
-- gatear).
--
-- =========================================================================
-- DECISIÓN — status en inglés (draft/confirmed/in_progress/fulfilled/
-- closed/cancelled), a diferencia de quotes/orders/purchase_orders
-- (español: borrador/enviada/...): así se especificó explícitamente en el
-- ticket 0067. Las etiquetas visibles en UI sí se traducen (ver
-- SALES_ORDER_STATUS_LABELS en domain.ts) — el valor almacenado en DB es
-- el que se documenta aquí.
--
-- =========================================================================
-- DECISIÓN — máquina de estados MVP, lineal, sin retorno a draft:
-- =========================================================================
--   draft      -> confirmed | cancelled
--   confirmed  -> in_progress | cancelled
--   in_progress -> fulfilled | cancelled
--   fulfilled  -> closed
--   closed / cancelled: terminales.
-- "draft" NUNCA es un destino asignable (igual que 'borrador' en Purchase
-- Orders desde 0045) — solo lo asigna rpc_create_sales_order al nacer la
-- fila. Esto satisface la regla "una SO confirmada no puede volver
-- silenciosamente a draft" por construcción, no por un chequeo ad-hoc.
--
-- =========================================================================
-- DECISIÓN — congelamiento de contenido comercial: por NEW.status, no por
-- OLD.status (más estricto que trg_quote_status_transition, 0020):
-- =========================================================================
-- El guard usa `if new.status <> 'draft' then <congelar> end if`, no
-- `if old.status <> 'draft'`. Así, incluso la transición draft->confirmed
-- rechaza un UPDATE que intente colar un cambio de customer_id/currency/
-- totales en el MISMO statement que confirma — cierre más fuerte de la
-- regla "cambios posteriores al catálogo/contenido NO deben modificar una
-- SO confirmada" que el patrón original de Quotes. `internal_notes` queda
-- deliberadamente fuera del congelamiento (anotación operativa interna,
-- nunca contenido comercial) — mismo criterio que `quotes.notes`.
-- `confirmed_at` se asigna EXCLUSIVAMENTE por este trigger en la transición
-- draft->confirmed (ignora cualquier valor mandado por el cliente) y queda
-- inmutable después — nunca lo escribe ninguna RPC directamente.
--
-- =========================================================================
-- DECISIÓN — snapshot de línea se resuelve en cada escritura de draft, no
-- solo "al confirmar":
-- =========================================================================
-- sku_snapshot/description_snapshot/uom_snapshot se copian desde
-- product_catalog (si catalog_product_id no es null) o se toman tal cual
-- las capturó el usuario (línea libre) en CADA rpc_create_sales_order /
-- rpc_update_sales_order — igual que quote_items.model. Como las líneas
-- solo son escribibles mientras status = 'draft' (RLS + RPC + trigger),
-- para cuando la SO se confirma el snapshot YA está completo y congelado
-- — "guardar snapshots completos al confirmar" se cumple sin necesitar que
-- rpc_update_sales_order_status vuelva a tocar las líneas. Una edición
-- posterior del Catálogo nunca puede alcanzar una línea ya escrita (no se
-- vuelve a leer product_catalog fuera de esas dos RPCs).
--
-- =========================================================================
-- DECISIÓN — fórmula de dinero: descuento e impuesto son PORCENTAJES POR
-- LÍNEA (columnas `discount`/`tax`, nombres exactos del ticket), sin
-- descuento/impuesto global de encabezado (el encabezado solo tiene
-- subtotal/tax_total/total, sin discount_total — a diferencia de Quotes):
-- =========================================================================
--   line_gross           = quantity × unit_price
--   line_discount_amount = round(line_gross × discount / 100, 2)
--   line_subtotal         = line_gross − line_discount_amount   (post-descuento, pre-impuesto)
--   line_tax_amount       = round(line_subtotal × tax / 100, 2)
--   line_total             = line_subtotal + line_tax_amount
--   subtotal (header)      = Σ line_subtotal
--   tax_total (header)     = Σ line_tax_amount
--   total (header)         = subtotal + tax_total = Σ line_total
-- Calculada EXCLUSIVAMENTE dentro de rpc_create_sales_order/
-- rpc_update_sales_order — la app nunca manda un total confiable.
--
-- =========================================================================
-- DECISIÓN — billing_address_snapshot/shipping_address_snapshot/
-- customer_contact_snapshot: columnas existen (spec del ticket), pero:
-- =========================================================================
-- - customer_contact_snapshot SÍ se resuelve automáticamente server-side
--   (dentro de ambas RPCs) desde el contacto principal ACTIVO del Customer
--   en customer_contacts (0021) — reutiliza estructura ya existente, sin
--   UI nueva. Si el Customer no tiene contacto principal activo, queda
--   NULL — nunca se inventa.
-- - billing_address_snapshot/shipping_address_snapshot son texto libre,
--   nullable, aceptados por ambas RPCs pero SIN campo de captura en el
--   formulario mínimo de este ticket (la lista explícita de campos del
--   formulario no las incluye) — listas para una UI futura sin requerir
--   otra migración.
--
-- =========================================================================
-- DECISIÓN — organization_id / cross-org (regla 4/5 del ticket):
-- =========================================================================
-- trg_check_sales_order_consistency (SECURITY INVOKER — salespeople y
-- customers ya son legibles bajo la RLS del propio invocador para las
-- filas que le importan: su propia fila de salespeople, o cualquiera si es
-- admin de esa organización; ver 0054_quote_salesperson_organization_fix,
-- que ya quitó la necesidad de SECURITY DEFINER para este mismo patrón en
-- Quotes) valida que customer_id/salesperson_id pertenezcan a
-- organization_id. catalog_product_id (si se manda) se valida DENTRO de
-- ambas RPCs (organization_id del producto == organization_id de la SO) —
-- no tiene FK directo a organization_id en sales_order_items, igual que
-- quote_items/purchase_order_items no repiten organization_id.
--
-- =========================================================================
-- DECISIÓN — reemplazo de líneas: una sola RPC transaccional, nunca
-- delete+insert por separado desde la app (aprendizaje directo de 0066):
-- =========================================================================
-- rpc_update_sales_order hace DELETE + INSERT de sales_order_items DENTRO
-- de la misma invocación de función — una sola transacción implícita,
-- igual que rpc_update_quote/rpc_replace_purchase_order_items/
-- rpc_replace_supplier_product_references. Si cualquier línea falla su
-- validación, TODO se revierte, incluidas las líneas anteriores (nunca
-- queda un reemplazo a medias). La app SIEMPRE llama a esta RPC — nunca
-- hace `.from("sales_order_items").delete()` + `.insert()` por separado.
--
-- =========================================================================
-- DECISIÓN — autoridad: "own or admin", sin capability nueva:
-- =========================================================================
-- Mismo patrón que Quotes: ADMIN de la organización, o el propio vendedor
-- dueño de la SO (salesperson_id = current_user_salesperson_id()). Lectura
-- se amplía adicionalmente con can_view_all_sales (0040/0041) — SOLO
-- lectura, nunca escritura, mismo criterio ya establecido para
-- quotes/orders/purchase_orders. "No resolver permisos especiales de
-- Dirección General todavía" (ticket) se cumple no inventando ninguna
-- capability nueva aquí — Commissions decidirá eso en su propia fase.
--
-- Como el resto del proyecto: idempotente (create table if not exists, do
-- $$ if not exists $$ para triggers, drop+create para policies/funciones)
-- y corre completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) sales_order_sequences — motor de order_number, un row por
--    organización (mismo patrón que purchase_order_sequences, 0035). Sin
--    UI de administración en este MVP (mismo criterio que PO: prefijo fijo
--    'SO', autoprovisionado dentro de fn_next_sales_order_number).
-- =========================================================================
create table if not exists sales_order_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'SO'
    constraint sales_order_sequences_prefix_format check (prefix = upper(prefix))
    constraint sales_order_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint sales_order_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sales_order_sequences enable row level security;

drop policy if exists "sales_order_sequences_select_admin" on sales_order_sequences;
create policy "sales_order_sequences_select_admin" on sales_order_sequences
  for select using (is_organization_admin(organization_id));

-- SECURITY DEFINER — igual justificación que fn_next_purchase_order_folio:
-- autoprovisiona la fila (insert ... on conflict do nothing) y hace el
-- UPDATE atómico del consecutivo aunque quien llama no tenga policy de
-- INSERT/UPDATE directa sobre esta tabla (solo ADMIN tiene SELECT). Nunca
-- confía en p_organization_id por sí solo: exige is_organization_member.
create or replace function fn_next_sales_order_number(
  p_organization_id uuid,
  p_order_date date
) returns table (order_number text, sequence_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq integer;
  v_date_part text;
begin
  if not is_organization_member(p_organization_id) then
    raise exception 'fn_next_sales_order_number: no tienes permiso para generar un número de Sales Order de esta organización.';
  end if;

  insert into sales_order_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update sales_order_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_order_date, 'YYYY') || to_char(p_order_date, 'DD') || to_char(p_order_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

-- =========================================================================
-- 2) sales_orders — encabezado
-- =========================================================================
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  customer_id uuid not null references customers (id) on delete restrict,
  salesperson_id uuid not null references salespeople (id) on delete restrict,

  order_number text not null,
  sequence_number integer not null,

  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'in_progress', 'fulfilled', 'closed', 'cancelled')),

  currency text not null check (currency in ('MXN', 'USD')),
  exchange_rate numeric(12,6) check (exchange_rate is null or exchange_rate > 0),
  payment_terms text,
  requested_delivery_date date,

  billing_address_snapshot text,
  shipping_address_snapshot text,
  customer_contact_snapshot text,

  commercial_notes text,
  internal_notes text,

  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),

  created_by uuid not null references auth.users (id) on delete restrict,
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_orders_order_number_unique on sales_orders (order_number);
create index if not exists sales_orders_organization_idx on sales_orders (organization_id);
create index if not exists sales_orders_customer_idx on sales_orders (customer_id);
create index if not exists sales_orders_salesperson_idx on sales_orders (salesperson_id);
create index if not exists sales_orders_status_idx on sales_orders (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_orders_updated_at') then
    create trigger trg_sales_orders_updated_at
      before update on sales_orders
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) sales_order_items — líneas. catalog_product_id nullable = línea
--    libre. sku_snapshot es el identificador obligatorio de la línea
--    (equivalente de `model` en quote_items/order_items) — para una línea
--    de catálogo se copia de product_catalog.sku; para una línea libre lo
--    captura el usuario. description_snapshot/uom_snapshot son opcionales,
--    igual que quote_items.description/unit.
-- =========================================================================
create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders (id) on delete cascade,
  position integer not null default 0,

  catalog_product_id uuid references product_catalog (id) on delete set null,

  sku_snapshot text not null constraint sales_order_items_sku_snapshot_not_blank check (btrim(sku_snapshot) <> ''),
  description_snapshot text,
  uom_snapshot text,

  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  -- Porcentajes por línea (0-100), no montos fijos — ver DECISIÓN "fórmula de dinero" arriba.
  discount numeric(5,2) not null default 0 check (discount between 0 and 100),
  tax numeric(5,2) not null default 0 check (tax between 0 and 100),

  line_subtotal numeric(12,2) not null check (line_subtotal >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),

  -- Fase de costos/márgenes futura — NUNCA calculadas automáticamente aquí.
  estimated_unit_cost numeric(12,2) check (estimated_unit_cost is null or estimated_unit_cost >= 0),
  estimated_margin numeric(12,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_order_items_sales_order_idx on sales_order_items (sales_order_id);
create index if not exists sales_order_items_catalog_product_idx on sales_order_items (catalog_product_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_order_items_updated_at') then
    create trigger trg_sales_order_items_updated_at
      before update on sales_order_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 4) Trigger: consistencia cross-organization (regla 4/5 del ticket).
--    SECURITY INVOKER — ver DECISIÓN arriba.
-- =========================================================================
create or replace function trg_check_sales_order_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer_org uuid;
  v_sp_org uuid;
begin
  select organization_id into v_customer_org from customers where id = new.customer_id;
  if v_customer_org is null then
    raise exception 'sales_orders: el cliente % no existe o no es visible para tu usuario.', new.customer_id;
  end if;

  select organization_id into v_sp_org from salespeople where id = new.salesperson_id;
  if v_sp_org is null then
    raise exception 'sales_orders: el vendedor % no existe o no es visible para tu usuario.', new.salesperson_id;
  end if;

  if new.organization_id is distinct from v_customer_org or new.organization_id is distinct from v_sp_org then
    raise exception
      'sales_orders: organization_id (%) no es consistente entre customer (%) y salesperson (%).',
      new.organization_id, v_customer_org, v_sp_org;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_orders_consistency') then
    create trigger trg_sales_orders_consistency
      before insert or update on sales_orders
      for each row execute function trg_check_sales_order_consistency();
  end if;
end $$;

-- =========================================================================
-- 5) Trigger: inmutabilidad de identidad (order_number/sequence_number/
--    organization_id/salesperson_id) — siempre, sin excepción de status.
-- =========================================================================
create or replace function trg_prevent_sales_order_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is distinct from old.order_number then
    raise exception 'El número de Sales Order no se puede modificar (%).', old.order_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una Sales Order no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una Sales Order no se puede modificar.';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de una Sales Order no se puede cambiar.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_orders_prevent_identity_change') then
    create trigger trg_sales_orders_prevent_identity_change
      before update on sales_orders
      for each row execute function trg_prevent_sales_order_identity_change();
  end if;
end $$;

-- =========================================================================
-- 6) Trigger: máquina de estados + confirmed_at + congelamiento de
--    contenido comercial fuera de "draft" — ver DECISIÓN arriba (por
--    NEW.status, no OLD.status).
-- =========================================================================
create or replace function trg_sales_order_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('fulfilled', 'cancelled'))
      or (old.status = 'fulfilled' and new.status = 'closed')
    ) then
      raise exception 'Transición de estado inválida para una Sales Order: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status = 'draft' and new.status = 'confirmed' then
    new.confirmed_at := now();
  elsif new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'confirmed_at es de solo lectura — se asigna automáticamente al confirmar la Sales Order.';
  end if;

  if new.status <> 'draft' then
    if new.customer_id is distinct from old.customer_id
      or new.currency is distinct from old.currency
      or new.exchange_rate is distinct from old.exchange_rate
      or new.payment_terms is distinct from old.payment_terms
      or new.requested_delivery_date is distinct from old.requested_delivery_date
      or new.billing_address_snapshot is distinct from old.billing_address_snapshot
      or new.shipping_address_snapshot is distinct from old.shipping_address_snapshot
      or new.customer_contact_snapshot is distinct from old.customer_contact_snapshot
      or new.commercial_notes is distinct from old.commercial_notes
      or new.subtotal is distinct from old.subtotal
      or new.tax_total is distinct from old.tax_total
      or new.total is distinct from old.total
    then
      raise exception 'No se puede modificar el contenido comercial de una Sales Order fuera de status draft (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_orders_status_transition') then
    create trigger trg_sales_orders_status_transition
      before update on sales_orders
      for each row execute function trg_sales_order_status_transition();
  end if;
end $$;

-- =========================================================================
-- 7) rpc_create_sales_order — SECURITY INVOKER. Crea encabezado + líneas
--    en una sola transacción. organization_id/created_by SIEMPRE
--    resueltos server-side, nunca confiados del cliente.
-- =========================================================================
create or replace function rpc_create_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_salesperson_id uuid := nullif(p_sales_order->>'salesperson_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

  v_order_date date := current_date;
  v_number_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_sku text;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_sku_snapshot text;
  v_description_snapshot text;
  v_uom_snapshot text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_discount numeric(5,2);
  v_tax numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_tax_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_estimated_unit_cost numeric(12,2);
  v_estimated_margin numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();

  if not (
    current_user_is_admin()
    or (is_organization_member(v_organization_id) and v_salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'Solo puedes crear una Sales Order a tu propio nombre, salvo que seas administrador.';
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_create_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede crear una Sales Order para un cliente inactivo.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  -- customer_contact_snapshot: contacto principal ACTIVO del cliente, resuelto server-side — nunca capturado desde la UI.
  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

  select * into v_number_result from fn_next_sales_order_number(v_organization_id, v_order_date);

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada línea debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada línea es obligatorio y no puede ser negativo.';
    end if;

    if v_catalog_product_id is not null then
      select sku, name, unit, organization_id into v_cat_sku, v_cat_name, v_cat_unit, v_cat_org
        from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_create_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      v_sku_snapshot := nullif(v_item->>'sku_snapshot', '');
      if v_sku_snapshot is null then
        raise exception 'Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia.';
      end if;
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax_amount;
    v_total := v_total + v_line_total;
  end loop;

  insert into sales_orders (
    id, organization_id, customer_id, salesperson_id, order_number, sequence_number, status,
    currency, exchange_rate, payment_terms, requested_delivery_date,
    billing_address_snapshot, shipping_address_snapshot, customer_contact_snapshot,
    commercial_notes, internal_notes,
    subtotal, tax_total, total, created_by
  )
  values (
    p_sales_order_id, v_organization_id, v_customer_id, v_salesperson_id,
    v_number_result.order_number, v_number_result.sequence_number, 'draft',
    v_currency, v_exchange_rate, v_payment_terms, v_requested_delivery_date,
    v_billing_address, v_shipping_address, v_customer_contact_snapshot,
    v_commercial_notes, v_internal_notes,
    v_subtotal, v_tax_total, v_total, auth.uid()
  )
  returning * into v_so;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    v_estimated_unit_cost := nullif(v_item->>'estimated_unit_cost', '')::numeric;
    v_estimated_margin := nullif(v_item->>'estimated_margin', '')::numeric;

    if v_catalog_product_id is not null then
      select sku, name, unit into v_cat_sku, v_cat_name, v_cat_unit from product_catalog where id = v_catalog_product_id;
      v_sku_snapshot := v_cat_sku;
      v_description_snapshot := coalesce(nullif(v_item->>'description_snapshot', ''), v_cat_name);
      v_uom_snapshot := coalesce(nullif(v_item->>'uom_snapshot', ''), v_cat_unit);
    else
      v_sku_snapshot := v_item->>'sku_snapshot';
      v_description_snapshot := nullif(v_item->>'description_snapshot', '');
      v_uom_snapshot := nullif(v_item->>'uom_snapshot', '');
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    insert into sales_order_items (
      sales_order_id, position, catalog_product_id,
      sku_snapshot, description_snapshot, uom_snapshot,
      quantity, unit_price, discount, tax, line_subtotal, line_total,
      estimated_unit_cost, estimated_margin
    )
    values (
      v_so.id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- =========================================================================
-- 8) rpc_update_sales_order — SECURITY INVOKER. Reemplaza contenido
--    comercial + líneas completas de una Sales Order EN DRAFT, en una sola
--    transacción (DELETE + INSERT de líneas dentro de la misma invocación
--    — ver DECISIÓN "reemplazo de líneas" arriba). customer_contact_snapshot
--    se re-resuelve igual que en create (puede cambiar si el contacto
--    principal del cliente cambió mientras la SO seguía en draft).
--    salesperson_id/currency de origen no se tocan aquí más allá de lo que
--    el propio payload permite — currency SÍ es editable en draft.
-- =========================================================================
create or replace function rpc_update_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_current_status text;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_sku text;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_sku_snapshot text;
  v_description_snapshot text;
  v_uom_snapshot text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_discount numeric(5,2);
  v_tax numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_tax_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_estimated_unit_cost numeric(12,2);
  v_estimated_margin numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  select status, organization_id into v_current_status, v_organization_id
    from sales_orders where id = p_sales_order_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_sales_order: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_current_status <> 'draft' then
    raise exception
      'rpc_update_sales_order: la Sales Order % no está en draft (status actual: %); su contenido no puede editarse.',
      p_sales_order_id, v_current_status;
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_update_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede asignar un cliente inactivo a una Sales Order.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada línea debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada línea es obligatorio y no puede ser negativo.';
    end if;

    if v_catalog_product_id is not null then
      select organization_id into v_cat_org from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_update_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      if nullif(v_item->>'sku_snapshot', '') is null then
        raise exception 'Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia.';
      end if;
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax_amount;
    v_total := v_total + v_line_total;
  end loop;

  update sales_orders set
    customer_id = v_customer_id,
    currency = v_currency,
    exchange_rate = v_exchange_rate,
    payment_terms = v_payment_terms,
    requested_delivery_date = v_requested_delivery_date,
    billing_address_snapshot = v_billing_address,
    shipping_address_snapshot = v_shipping_address,
    customer_contact_snapshot = v_customer_contact_snapshot,
    commercial_notes = v_commercial_notes,
    internal_notes = v_internal_notes,
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total = v_total
  where id = p_sales_order_id
  returning * into v_so;

  delete from sales_order_items where sales_order_id = p_sales_order_id;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    v_estimated_unit_cost := nullif(v_item->>'estimated_unit_cost', '')::numeric;
    v_estimated_margin := nullif(v_item->>'estimated_margin', '')::numeric;

    if v_catalog_product_id is not null then
      select sku, name, unit into v_cat_sku, v_cat_name, v_cat_unit from product_catalog where id = v_catalog_product_id;
      v_sku_snapshot := v_cat_sku;
      v_description_snapshot := coalesce(nullif(v_item->>'description_snapshot', ''), v_cat_name);
      v_uom_snapshot := coalesce(nullif(v_item->>'uom_snapshot', ''), v_cat_unit);
    else
      v_sku_snapshot := v_item->>'sku_snapshot';
      v_description_snapshot := nullif(v_item->>'description_snapshot', '');
      v_uom_snapshot := nullif(v_item->>'uom_snapshot', '');
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    insert into sales_order_items (
      sales_order_id, position, catalog_product_id,
      sku_snapshot, description_snapshot, uom_snapshot,
      quantity, unit_price, discount, tax, line_subtotal, line_total,
      estimated_unit_cost, estimated_margin
    )
    values (
      p_sales_order_id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- =========================================================================
-- 9) rpc_update_sales_order_status — SECURITY INVOKER. Confirma/cancela/
--    avanza el estado. La máquina de estados real la impone
--    trg_sales_order_status_transition (sección 6); esta función solo
--    autoriza (own-or-admin, defensa adicional sobre RLS) y traduce el
--    UPDATE. "draft" nunca es un destino aceptado aquí (igual que
--    purchase_orders, 0045) — regla 8 del ticket por construcción.
-- =========================================================================
create or replace function rpc_update_sales_order_status(
  p_sales_order_id uuid,
  p_status text
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_current_status text;
  v_salesperson_id uuid;
  v_organization_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if p_status not in ('confirmed', 'in_progress', 'fulfilled', 'closed', 'cancelled') then
    raise exception '"%" no es un estado asignable manualmente — "draft" solo se asigna al crear la Sales Order.', p_status;
  end if;

  select status, salesperson_id, organization_id into v_current_status, v_salesperson_id, v_organization_id
    from sales_orders where id = p_sales_order_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_sales_order_status: Sales Order % no encontrada.', p_sales_order_id;
  end if;

  if not (
    current_user_is_admin()
    or (is_organization_member(v_organization_id) and v_salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'No tienes autoridad para cambiar el estado de esta Sales Order.';
  end if;

  update sales_orders set status = p_status
    where id = p_sales_order_id
    returning * into v_so;

  return v_so;
end;
$$;

-- =========================================================================
-- 10) RLS — sales_orders. own-or-admin para escritura; +can_view_all_sales
--     (0041) SOLO para lectura, mismo patrón que quotes/orders/purchase_orders.
--     Sin policy de DELETE — cancelación es un status, no un borrado físico.
-- =========================================================================
alter table sales_orders enable row level security;

drop policy if exists "sales_orders_select_own_or_admin" on sales_orders;
create policy "sales_orders_select_own_or_admin" on sales_orders
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
  );

drop policy if exists "sales_orders_insert_own_or_admin" on sales_orders;
create policy "sales_orders_insert_own_or_admin" on sales_orders
  for insert with check (
    current_user_active()
    and status = 'draft'
    and (
      is_organization_admin(organization_id)
      or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    )
  );

drop policy if exists "sales_orders_update_own_or_admin" on sales_orders;
create policy "sales_orders_update_own_or_admin" on sales_orders
  for update using (
    current_user_active()
    and (
      is_organization_admin(organization_id)
      or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    )
  )
  with check (
    current_user_active()
    and (
      is_organization_admin(organization_id)
      or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    )
  );

-- =========================================================================
-- 11) RLS — sales_order_items. Solo escribibles mientras la SO padre está
--     en 'draft' — regla 1/3 del ticket, protección en DB (no solo en las
--     RPCs). Lectura sigue la misma visibilidad que el encabezado
--     (incluido can_view_all_sales).
-- =========================================================================
alter table sales_order_items enable row level security;

drop policy if exists "sales_order_items_select_own_or_admin" on sales_order_items;
create policy "sales_order_items_select_own_or_admin" on sales_order_items
  for select using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_view_all_sales'))
        )
    )
  );

drop policy if exists "sales_order_items_insert_draft_own_or_admin" on sales_order_items;
create policy "sales_order_items_insert_draft_own_or_admin" on sales_order_items
  for insert with check (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and so.status = 'draft'
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
        )
    )
  );

drop policy if exists "sales_order_items_update_draft_own_or_admin" on sales_order_items;
create policy "sales_order_items_update_draft_own_or_admin" on sales_order_items
  for update using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and so.status = 'draft'
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
        )
    )
  )
  with check (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and so.status = 'draft'
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
        )
    )
  );

drop policy if exists "sales_order_items_delete_draft_own_or_admin" on sales_order_items;
create policy "sales_order_items_delete_draft_own_or_admin" on sales_order_items
  for delete using (
    exists (
      select 1 from sales_orders so
      where so.id = sales_order_items.sales_order_id
        and so.status = 'draft'
        and (
          is_organization_admin(so.organization_id)
          or (is_organization_member(so.organization_id) and so.salesperson_id = current_user_salesperson_id())
        )
    )
  );

commit;
