-- THÖREN 0071 — Fulfillment / Picking / Delivery MVP para Sales Orders.
--
-- =========================================================================
-- PRINCIPIO (explícito en el ticket, ya validado contra el repo real):
-- reutilizar `warehouses`/`inventory_movements` tal cual — NO se crea
-- ninguna tabla de balances paralela, el ON HAND sigue siendo
-- SUM(inventory_movements.quantity_delta) por producto×almacén, exactamente
-- como en 0036/0070. La única extensión al ledger es aditiva: dos columnas
-- nuevas de trazabilidad + un movement_type nuevo, mismo patrón EXACTO ya
-- usado en 0038 (Fulfillment de Pedidos) al agregar 'surtido_pedido' —
-- 0071 es su equivalente para Sales Orders.
--
-- =========================================================================
-- DECISIÓN — nombre del movement_type: 'surtido_venta' (no el literal
-- inglés "sales_fulfillment" sugerido por el ticket). El ticket mismo pide
-- "sales_fulfillment o equivalente CONSISTENTE CON EL ENUM ACTUAL" — el
-- enum actual es 100% español (recepcion_compra, entrada_manual,
-- salida_manual, ajuste_positivo, ajuste_negativo, correccion_recepcion,
-- surtido_pedido). 'surtido_venta' es el paralelo exacto de
-- 'surtido_pedido' (mismo verbo, "venta" en vez de "pedido") — consistente
-- con el vocabulario real, no una mezcla de idiomas.
--
-- =========================================================================
-- DECISIÓN — Pedidos y Sales Orders NUNCA se mezclan (0067/0069): este
-- movement_type usa sales_fulfillment_id/sales_fulfillment_item_id
-- (columnas NUEVAS), nunca order_id/inventory_reservation_id (que son
-- exclusivamente de 'surtido_pedido', Pedidos). Misma arquitectura de "dos
-- documentos hermanos, un solo ledger compartido" ya usada entre
-- recepción de PO (0035/0036) y recepción de Requisición (0069).
--
-- =========================================================================
-- DECISIÓN — capability nueva `can_manage_sales_fulfillment`: existe
-- `can_fulfill_inventory` (0040/0044), pero su descripción y guard real
-- (rpc_fulfill_inventory_reservation) son EXPLÍCITAMENTE de Pedidos
-- ("Surtir reservas de inventario para pedidos de cualquier vendedor") —
-- reutilizarla para Sales Orders confundiría a quien la otorgue (un admin
-- viendo "can_fulfill_inventory" no sabría que también habilita Sales
-- Orders). Mismo criterio de 0068 (can_manage_sales_order_finance): se
-- crea una capability nueva cuando ninguna existente encaja sin ambigüedad.
-- Sin rama de ownership (admin O la capability, igual que
-- can_manage_sales_order_finance/can_receive_inventory): logística
-- normalmente NO es el salesperson dueño de la Sales Order.
--
-- =========================================================================
-- DECISIÓN — reutiliza fulfillment_release_status (0068) para el estado
-- físico de surtido, EXACTAMENTE como pide el ticket: su CHECK constraint
-- YA incluía 'fulfilled' desde 0068 sin que nada lo asignara nunca — señal
-- de que 0068 reservó a propósito ese valor para este ticket.
-- 'released'/'partially_released'/'fulfilled' pasan a significar, una vez
-- que empieza el surtido, "liberada Y [nada/parcial/todo] entregado" —
-- 0071 SOLO escribe este campo desde rpc_dispatch_sales_fulfillment (nunca
-- lo baja a 'blocked': eso sigue siendo exclusivo de Finanzas, 0068).
-- LIMITACIÓN ACEPTADA (documentada para no redescubrirse como bug): si
-- Finanzas bloquea financieramente una Sales Order YA 100% surtida
-- (rpc_set_sales_order_financial_hold, 0068, sigue operando sobre
-- 'confirmed'/'in_progress'/'fulfilled' sin cambio), fulfillment_release_status
-- pasa a 'blocked' y el marcador visual "fulfilled" se pierde a nivel de
-- ese campo — el registro real de qué se entregó (sales_fulfillments/
-- sales_fulfillment_items, y el propio ledger) permanece intacto y es la
-- fuente de verdad. No se modifica 0068 para evitar "cambios fuera del
-- ticket". `sales_orders.status` (draft/confirmed/in_progress/fulfilled/
-- closed/cancelled) NUNCA se toca aquí — sigue siendo 100% manual vía
-- rpc_update_sales_order_status, sin acoplamiento con fulfillment_release_status
-- (confirmado revisando trg_sales_order_status_transition, 0067).
--
-- =========================================================================
-- DECISIÓN — verificación de stock (regla 6/7): solo se valida de forma
-- AUTORITATIVA en rpc_dispatch_sales_fulfillment (el único momento que
-- realmente mueve inventario) — mismo criterio que 0070 (over-receipt real
-- solo se exige al postear, no al armar el draft). El trigger de líneas sí
-- valida en draft que el acumulado solicitado no exceda lo vendido (UX
-- temprana), pero NUNCA puede validar existencia real de forma fiable en
-- draft (el stock cambia con el tiempo) — validarlo ahí sería una falsa
-- promesa.
--
-- Como el resto del proyecto: idempotente (create table if not exists,
-- add column if not exists, drop+create para policies/funciones/
-- constraints) y corre completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) capabilities — nueva capacidad, aditiva sobre el catálogo de 0040.
-- =========================================================================
insert into capabilities (key, description) values
  ('can_manage_sales_fulfillment', 'Crear, preparar, despachar y marcar como entregados los surtidos (fulfillments) de Sales Orders.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) inventory_movements — nuevo movement_type 'surtido_venta' (salida,
--    delta negativo) con referencia a sales_fulfillment/item (nunca a PO
--    ni a Pedido/reserva). Mismo patrón EXACTO de 0038 al agregar
--    'surtido_pedido' — columnas nuevas NULL para cualquier otro tipo.
-- =========================================================================
alter table inventory_movements
  add column if not exists sales_fulfillment_id uuid,
  add column if not exists sales_fulfillment_item_id uuid;

create index if not exists inventory_movements_sales_fulfillment_idx on inventory_movements (sales_fulfillment_id);
create index if not exists inventory_movements_sales_fulfillment_item_idx on inventory_movements (sales_fulfillment_item_id);

alter table inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in (
    'recepcion_compra', 'entrada_manual', 'salida_manual',
    'ajuste_positivo', 'ajuste_negativo', 'correccion_recepcion', 'surtido_pedido',
    'surtido_venta'
  ));

alter table inventory_movements
  drop constraint if exists inventory_movements_type_sign;
alter table inventory_movements
  add constraint inventory_movements_type_sign
  check (
    (movement_type in ('entrada_manual', 'ajuste_positivo', 'recepcion_compra') and quantity_delta > 0)
    or
    (movement_type in ('salida_manual', 'ajuste_negativo', 'correccion_recepcion', 'surtido_pedido', 'surtido_venta') and quantity_delta < 0)
  );

alter table inventory_movements
  drop constraint if exists inventory_movements_po_reference;
alter table inventory_movements
  drop constraint if exists inventory_movements_reference_by_type;
alter table inventory_movements
  add constraint inventory_movements_reference_by_type
  check (
    (movement_type in ('recepcion_compra', 'correccion_recepcion')
      and purchase_order_id is not null and purchase_order_item_id is not null
      and order_id is null and inventory_reservation_id is null
      and sales_fulfillment_id is null and sales_fulfillment_item_id is null)
    or
    (movement_type = 'surtido_pedido'
      and order_id is not null and inventory_reservation_id is not null
      and purchase_order_id is null and purchase_order_item_id is null
      and sales_fulfillment_id is null and sales_fulfillment_item_id is null)
    or
    (movement_type = 'surtido_venta'
      and sales_fulfillment_id is not null and sales_fulfillment_item_id is not null
      and purchase_order_id is null and purchase_order_item_id is null
      and order_id is null and inventory_reservation_id is null)
    or
    (movement_type in ('entrada_manual', 'salida_manual', 'ajuste_positivo', 'ajuste_negativo')
      and purchase_order_id is null and purchase_order_item_id is null
      and order_id is null and inventory_reservation_id is null
      and sales_fulfillment_id is null and sales_fulfillment_item_id is null)
  );

-- =========================================================================
-- 3) sales_fulfillment_sequences — motor de fulfillment_number, mismo
--    patrón que purchase_requisition_sequences/goods_receipt_sequences
--    (0069/0070) CON el endurecimiento de auditoría desde el día uno:
--    REVOKE PUBLIC + GRANT authenticated explícitos.
-- =========================================================================
create table if not exists sales_fulfillment_sequences (
  organization_id uuid primary key references organizations (id) on delete restrict,
  prefix text not null default 'SF'
    constraint sales_fulfillment_sequences_prefix_format check (prefix = upper(prefix))
    constraint sales_fulfillment_sequences_prefix_charset check (prefix ~ '^[A-Z0-9-]+$')
    constraint sales_fulfillment_sequences_prefix_length check (char_length(prefix) between 1 and 20),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sales_fulfillment_sequences enable row level security;

drop policy if exists "sales_fulfillment_sequences_select_admin" on sales_fulfillment_sequences;
create policy "sales_fulfillment_sequences_select_admin" on sales_fulfillment_sequences
  for select using (is_organization_admin(organization_id));

create or replace function fn_next_sales_fulfillment_number(
  p_organization_id uuid,
  p_date date
) returns table (fulfillment_number text, sequence_number integer)
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
    raise exception 'fn_next_sales_fulfillment_number: no tienes permiso para generar un número de surtido de esta organización.';
  end if;

  insert into sales_fulfillment_sequences (organization_id)
    values (p_organization_id)
    on conflict (organization_id) do nothing;

  update sales_fulfillment_sequences
    set sequence_current = sequence_current + 1
    where organization_id = p_organization_id
    returning sequence_current, prefix into v_seq, v_prefix;

  v_date_part := to_char(p_date, 'YYYY') || to_char(p_date, 'DD') || to_char(p_date, 'MM');
  return query select v_prefix || '-' || v_date_part || '-' || lpad(v_seq::text, 3, '0'), v_seq;
end;
$$;

revoke all on function fn_next_sales_fulfillment_number(uuid, date) from public;
grant execute on function fn_next_sales_fulfillment_number(uuid, date) to authenticated;

-- =========================================================================
-- 4) sales_fulfillments — encabezado del documento de surtido.
-- =========================================================================
create table if not exists sales_fulfillments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  fulfillment_number text not null,
  sequence_number integer not null,
  sales_order_id uuid not null references sales_orders (id) on delete restrict,
  warehouse_id uuid not null references warehouses (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'shipped', 'delivered', 'cancelled')),
  prepared_by uuid references auth.users (id) on delete restrict,
  prepared_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  delivered_by uuid references auth.users (id) on delete restrict,
  delivery_contact text,
  delivery_notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_fulfillments_number_unique on sales_fulfillments (organization_id, fulfillment_number);
create index if not exists sales_fulfillments_organization_idx on sales_fulfillments (organization_id);
create index if not exists sales_fulfillments_sales_order_idx on sales_fulfillments (sales_order_id);
create index if not exists sales_fulfillments_status_idx on sales_fulfillments (status);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_fulfillments_updated_at') then
    create trigger trg_sales_fulfillments_updated_at
      before update on sales_fulfillments
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 5) sales_fulfillment_items — líneas. sales_order_item_id SIEMPRE apunta
--    a una línea real de la Sales Order de este surtido (regla 3/4).
--    catalog_product_id se copia de esa línea (nullable: línea libre
--    soportada, regla 8 — nunca inventa un producto para ella).
-- =========================================================================
create table if not exists sales_fulfillment_items (
  id uuid primary key default gen_random_uuid(),
  sales_fulfillment_id uuid not null references sales_fulfillments (id) on delete cascade,
  sales_order_item_id uuid not null references sales_order_items (id) on delete restrict,
  catalog_product_id uuid references product_catalog (id) on delete set null,
  description_snapshot text not null constraint sales_fulfillment_items_description_not_blank check (btrim(description_snapshot) <> ''),
  uom_snapshot text,
  quantity_requested integer not null check (quantity_requested > 0),
  quantity_fulfilled integer not null default 0 check (quantity_fulfilled >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_fulfillment_items_fulfilled_not_exceed_requested check (quantity_fulfilled <= quantity_requested)
);

create index if not exists sales_fulfillment_items_fulfillment_idx on sales_fulfillment_items (sales_fulfillment_id);
create index if not exists sales_fulfillment_items_sales_order_item_idx on sales_fulfillment_items (sales_order_item_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sales_fulfillment_items_updated_at') then
    create trigger trg_sales_fulfillment_items_updated_at
      before update on sales_fulfillment_items
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 6) sales_fulfillment_events — historial mínimo, inmutable (solo
--    INSERT). Mismo criterio que purchase_requisition_events/
--    goods_receipt_events (0069/0070), con previous_status/new_status
--    explícitos porque el ticket los pide.
-- =========================================================================
create table if not exists sales_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  sales_fulfillment_id uuid not null references sales_fulfillments (id) on delete cascade,
  event_type text not null check (event_type in ('created', 'ready', 'shipped', 'delivered', 'cancelled', 'notes_updated')),
  previous_status text,
  new_status text,
  reason text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists sales_fulfillment_events_fulfillment_idx on sales_fulfillment_events (sales_fulfillment_id);

-- =========================================================================
-- 7) Trigger: inmutabilidad de identidad (fulfillment_number/
--    sequence_number/organization_id/sales_order_id) — siempre, sin
--    excepción de status. warehouse_id/delivery_contact solo mientras
--    'draft'; delivery_notes editable en cualquier status NO terminal para
--    edición (draft/ready/shipped/delivered — regla 12: "inmutable salvo
--    notas"), pero NO en 'cancelled'.
-- =========================================================================
create or replace function trg_prevent_sales_fulfillment_field_change()
returns trigger
language plpgsql
as $$
begin
  if new.fulfillment_number is distinct from old.fulfillment_number then
    raise exception 'El número de un surtido no se puede modificar (%).', old.fulfillment_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de un surtido no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de un surtido no se puede modificar.';
  end if;
  if new.sales_order_id is distinct from old.sales_order_id then
    raise exception 'La Sales Order de origen de un surtido no se puede modificar.';
  end if;

  if old.status <> 'draft' then
    if new.warehouse_id is distinct from old.warehouse_id or new.delivery_contact is distinct from old.delivery_contact then
      raise exception 'No se puede modificar el almacén o el contacto de entrega de un surtido fuera de status draft (actual: %).', old.status;
    end if;
  end if;

  if new.delivery_notes is distinct from old.delivery_notes and old.status = 'cancelled' then
    raise exception 'No se pueden modificar las notas de un surtido cancelado.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_fulfillments_prevent_field_change on sales_fulfillments;
create trigger trg_sales_fulfillments_prevent_field_change
  before update on sales_fulfillments
  for each row execute function trg_prevent_sales_fulfillment_field_change();

-- =========================================================================
-- 8) Trigger: elegibilidad al crear (reglas 1/2) — SOLO en INSERT, nunca
--    revalida retroactivamente si la Sales Order cambia de estado después
--    (mismo criterio que 0066/0067/0069/0070). rpc_dispatch_sales_fulfillment
--    (sección 17) revalida la Sales Order OTRA VEZ en vivo al despachar —
--    esa es la autoridad real para el momento que de verdad importa.
-- =========================================================================
create or replace function trg_check_sales_fulfillment_eligible()
returns trigger
language plpgsql
as $$
declare
  v_so_org uuid;
  v_so_status text;
  v_so_release text;
  v_wh_org uuid;
  v_wh_active boolean;
begin
  select organization_id, status, fulfillment_release_status
    into v_so_org, v_so_status, v_so_release
    from sales_orders where id = new.sales_order_id;
  if v_so_org is null then
    raise exception 'sales_fulfillments: Sales Order % no existe o no es visible para tu usuario.', new.sales_order_id;
  end if;
  if new.organization_id is distinct from v_so_org then
    raise exception 'sales_fulfillments: organization_id (%) no coincide con la organización de la Sales Order (%).', new.organization_id, v_so_org;
  end if;
  if v_so_status = 'draft' then
    raise exception 'No se puede crear un surtido a partir de una Sales Order en draft.';
  end if;
  if v_so_status = 'cancelled' then
    raise exception 'No se puede crear un surtido a partir de una Sales Order cancelada.';
  end if;
  if v_so_release not in ('released', 'partially_released') then
    raise exception 'Solo una Sales Order liberada financieramente (released o partially_released) puede generar un surtido — estado actual: %.', v_so_release;
  end if;

  select organization_id, active into v_wh_org, v_wh_active from warehouses where id = new.warehouse_id;
  if v_wh_org is null then
    raise exception 'sales_fulfillments: Almacén % no existe.', new.warehouse_id;
  end if;
  if v_wh_org is distinct from new.organization_id then
    raise exception 'El almacén seleccionado no pertenece a tu organización.';
  end if;
  if not v_wh_active then
    raise exception 'El almacén seleccionado está inactivo.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_fulfillments_eligible on sales_fulfillments;
create trigger trg_sales_fulfillments_eligible
  before insert on sales_fulfillments
  for each row execute function trg_check_sales_fulfillment_eligible();

-- =========================================================================
-- 9) Trigger: máquina de estados de sales_fulfillments. draft -> ready |
--    cancelled; ready -> shipped; shipped -> delivered. Cancelar SOLO
--    desde draft (regla del ticket, UI: "cancelar draft si aplica" — mismo
--    criterio MVP que 0070 con goods_receipts posted). delivered es
--    terminal salvo notas (congeladas aparte, sección 7).
-- =========================================================================
create or replace function trg_sales_fulfillment_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'shipped')
      or (old.status = 'shipped' and new.status = 'delivered')
    ) then
      raise exception 'Transición de estado inválida para un surtido: % -> %.', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_fulfillments_status_transition on sales_fulfillments;
create trigger trg_sales_fulfillments_status_transition
  before update on sales_fulfillments
  for each row execute function trg_sales_fulfillment_status_transition();

-- =========================================================================
-- 10) Triggers de sales_fulfillment_items:
--     a) validación por línea (reglas 3/4): pertenencia a la MISMA Sales
--        Order del surtido, consistencia de catalog_product_id, y tope
--        "no exceder lo vendido" usando el acumulado de quantity_requested
--        de TODOS los surtidos activos (no cancelados) de esa línea —
--        validación de UX en draft; la autoridad real es
--        rpc_dispatch_sales_fulfillment, que revalida esto mismo (usando
--        quantity_fulfilled REAL) en vivo al despachar.
--     b) congelamiento total fuera de 'draft': ninguna columna de una
--        línea cambia, y tampoco se puede borrar, una vez que el surtido
--        sale de draft — quantity_fulfilled lo actualiza EXCLUSIVAMENTE
--        rpc_dispatch_sales_fulfillment vía una ruta que no pasa por RLS
--        de `authenticated` (ver sección 12, sin policy de UPDATE amplia:
--        el propio RPC hace el UPDATE bajo su propio contexto SECURITY
--        INVOKER, pero ANTES de que el trigger de status ya haya sacado la
--        fila de 'draft' — ver DECISIÓN dentro del RPC, sección 17).
-- =========================================================================
create or replace function trg_check_sales_fulfillment_item_quantity()
returns trigger
language plpgsql
as $$
declare
  v_sf_org uuid;
  v_sf_sales_order_id uuid;
  v_so_item_sales_order_id uuid;
  v_so_item_quantity integer;
  v_so_item_catalog_product_id uuid;
  v_already_requested integer;
begin
  select organization_id, sales_order_id into v_sf_org, v_sf_sales_order_id
    from sales_fulfillments where id = new.sales_fulfillment_id;
  if v_sf_sales_order_id is null then
    raise exception 'sales_fulfillment_items: surtido % no encontrado.', new.sales_fulfillment_id;
  end if;

  select sales_order_id, quantity, catalog_product_id
    into v_so_item_sales_order_id, v_so_item_quantity, v_so_item_catalog_product_id
    from sales_order_items where id = new.sales_order_item_id;
  if v_so_item_sales_order_id is null then
    raise exception 'sales_fulfillment_items: línea de Sales Order % no encontrada.', new.sales_order_item_id;
  end if;
  if v_so_item_sales_order_id <> v_sf_sales_order_id then
    raise exception 'La línea de Sales Order % no pertenece a la Sales Order de este surtido.', new.sales_order_item_id;
  end if;
  if new.catalog_product_id is distinct from v_so_item_catalog_product_id then
    raise exception 'catalog_product_id de la línea de surtido debe coincidir con el de su línea de Sales Order de origen.';
  end if;

  -- Regla 4: acumulado solicitado (quantity_requested) de esta MISMA línea
  -- de Sales Order, a través de TODOS los surtidos activos (cancelled se
  -- excluye — cancelar libera el cupo), nunca puede superar la cantidad
  -- vendida.
  select coalesce(sum(sfi.quantity_requested), 0) into v_already_requested
    from sales_fulfillment_items sfi
    join sales_fulfillments sf on sf.id = sfi.sales_fulfillment_id
    where sfi.sales_order_item_id = new.sales_order_item_id
      and sf.status <> 'cancelled'
      and sfi.id <> new.id;

  if v_already_requested + new.quantity_requested > v_so_item_quantity then
    raise exception
      'La línea de Sales Order % ya tiene % unidad(es) comprometida(s) en otros surtidos (de % vendidas en total) — no se puede comprometer % más.',
      new.sales_order_item_id, v_already_requested, v_so_item_quantity, new.quantity_requested;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sales_fulfillment_items_check_quantity on sales_fulfillment_items;
create trigger trg_sales_fulfillment_items_check_quantity
  before insert or update of sales_order_item_id, quantity_requested, catalog_product_id
  on sales_fulfillment_items
  for each row execute function trg_check_sales_fulfillment_item_quantity();

-- THÖREN 0071 — a diferencia de goods_receipt_items (0070, freeze total),
-- aquí SÍ hay una columna que legítimamente sigue cambiando fuera de
-- draft: quantity_fulfilled, que rpc_dispatch_sales_fulfillment actualiza
-- MIENTRAS el encabezado sigue en 'ready' (el propio RPC recién lo pasa a
-- 'shipped' DESPUÉS de procesar todas las líneas) — mismo patrón exacto de
-- trg_purchase_requisition_item_freeze (0069) para quantity_ordered.
create or replace function trg_sales_fulfillment_item_freeze()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from sales_fulfillments where id = coalesce(new.sales_fulfillment_id, old.sales_fulfillment_id);
  if v_status <> 'draft' then
    if tg_op = 'DELETE' then
      raise exception 'No se puede eliminar una línea de surtido fuera de status draft (actual: %).', v_status;
    end if;
    if new.sales_fulfillment_id is distinct from old.sales_fulfillment_id
      or new.sales_order_item_id is distinct from old.sales_order_item_id
      or new.catalog_product_id is distinct from old.catalog_product_id
      or new.description_snapshot is distinct from old.description_snapshot
      or new.uom_snapshot is distinct from old.uom_snapshot
      or new.quantity_requested is distinct from old.quantity_requested
    then
      raise exception 'No se puede modificar una línea de surtido fuera de status draft (actual: %) — solo quantity_fulfilled cambia, vía despacho.', v_status;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_fulfillment_items_freeze on sales_fulfillment_items;
create trigger trg_sales_fulfillment_items_freeze
  before update or delete on sales_fulfillment_items
  for each row execute function trg_sales_fulfillment_item_freeze();

-- =========================================================================
-- 11) RLS — sales_orders/sales_order_items: se amplía SOLO lectura para
--     can_manage_sales_fulfillment (mismo patrón que 0069 con
--     can_prepare_purchase_orders). Reemplaza las policies de 0069,
--     agregando una rama más — el resto queda carácter por carácter igual.
-- =========================================================================
drop policy if exists "sales_orders_select_own_or_admin" on sales_orders;
create policy "sales_orders_select_own_or_admin" on sales_orders
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and salesperson_id = current_user_salesperson_id())
    or (is_organization_member(organization_id) and current_user_has_capability('can_view_all_sales'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_prepare_purchase_orders'))
    or (is_organization_member(organization_id) and current_user_has_capability('can_manage_sales_fulfillment'))
  );

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
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_order_finance'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_prepare_purchase_orders'))
          or (is_organization_member(so.organization_id) and current_user_has_capability('can_manage_sales_fulfillment'))
        )
    )
  );

-- =========================================================================
-- 12) RLS — sales_fulfillments / sales_fulfillment_items /
--     sales_fulfillment_events. Autoridad uniforme: admin O
--     can_manage_sales_fulfillment (escritura); + can_view_all_sales (solo
--     lectura, mismo patrón ya establecido en 0069).
--     UPDATE de sales_fulfillment_items SIN restricción de status en RLS a
--     propósito (mismo criterio que purchase_requisition_items/
--     goods_receipt_items, 0069/0070): rpc_dispatch_sales_fulfillment
--     necesita poder actualizar quantity_fulfilled cuando el status YA
--     dejó de ser 'draft' (lo hace DESPUÉS de mover la fila a 'shipped',
--     ver sección 17) — el congelamiento real de las demás columnas lo
--     impone trg_sales_fulfillment_item_freeze (sección 10), que SÍ
--     permite ÚNICAMENTE esa escritura porque la hace el propio RPC con
--     una sentencia UPDATE que solo toca quantity_fulfilled.
-- =========================================================================
alter table sales_fulfillments enable row level security;

drop policy if exists "sales_fulfillments_select" on sales_fulfillments;
create policy "sales_fulfillments_select" on sales_fulfillments
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or current_user_has_capability('can_manage_sales_fulfillment')
      or current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "sales_fulfillments_insert" on sales_fulfillments;
create policy "sales_fulfillments_insert" on sales_fulfillments
  for insert with check (
    current_user_active()
    and is_organization_member(organization_id)
    and status = 'draft'
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
  );

drop policy if exists "sales_fulfillments_update" on sales_fulfillments;
create policy "sales_fulfillments_update" on sales_fulfillments
  for update using (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
  )
  with check (
    current_user_active()
    and is_organization_member(organization_id)
    and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
  );

alter table sales_fulfillment_items enable row level security;

drop policy if exists "sales_fulfillment_items_select" on sales_fulfillment_items;
create policy "sales_fulfillment_items_select" on sales_fulfillment_items
  for select using (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_items.sales_fulfillment_id
        and current_user_active() and is_organization_member(sf.organization_id)
        and (
          current_user_is_admin()
          or current_user_has_capability('can_manage_sales_fulfillment')
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "sales_fulfillment_items_insert_draft" on sales_fulfillment_items;
create policy "sales_fulfillment_items_insert_draft" on sales_fulfillment_items
  for insert with check (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_items.sales_fulfillment_id
        and is_organization_member(sf.organization_id)
        and sf.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
    )
  );

drop policy if exists "sales_fulfillment_items_update" on sales_fulfillment_items;
create policy "sales_fulfillment_items_update" on sales_fulfillment_items
  for update using (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_items.sales_fulfillment_id
        and is_organization_member(sf.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
    )
  )
  with check (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_items.sales_fulfillment_id
        and is_organization_member(sf.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
    )
  );

drop policy if exists "sales_fulfillment_items_delete_draft" on sales_fulfillment_items;
create policy "sales_fulfillment_items_delete_draft" on sales_fulfillment_items
  for delete using (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_items.sales_fulfillment_id
        and is_organization_member(sf.organization_id)
        and sf.status = 'draft'
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
    )
  );

alter table sales_fulfillment_events enable row level security;

drop policy if exists "sales_fulfillment_events_select" on sales_fulfillment_events;
create policy "sales_fulfillment_events_select" on sales_fulfillment_events
  for select using (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_events.sales_fulfillment_id
        and current_user_active() and is_organization_member(sf.organization_id)
        and (
          current_user_is_admin()
          or current_user_has_capability('can_manage_sales_fulfillment')
          or current_user_has_capability('can_view_all_sales')
        )
    )
  );

drop policy if exists "sales_fulfillment_events_insert" on sales_fulfillment_events;
create policy "sales_fulfillment_events_insert" on sales_fulfillment_events
  for insert with check (
    exists (
      select 1 from sales_fulfillments sf
      where sf.id = sales_fulfillment_events.sales_fulfillment_id
        and is_organization_member(sf.organization_id)
        and (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment'))
    )
  );

-- =========================================================================
-- 13) rpc_create_sales_fulfillment — SECURITY INVOKER. Crea encabezado +
--     líneas en una transacción. organization_id/created_by SIEMPRE
--     resueltos server-side.
-- =========================================================================
create or replace function rpc_create_sales_fulfillment(
  p_fulfillment_id uuid,
  p_fulfillment jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
  v_organization_id uuid;
  v_sales_order_id uuid := nullif(p_fulfillment->>'sales_order_id', '')::uuid;
  v_warehouse_id uuid := nullif(p_fulfillment->>'warehouse_id', '')::uuid;
  v_delivery_contact text := nullif(p_fulfillment->>'delivery_contact', '');
  v_delivery_notes text := nullif(p_fulfillment->>'delivery_notes', '');
  v_number_result record;
  v_item jsonb;
  v_sales_order_item_id uuid;
  v_quantity_requested integer;
  v_so_sku text;
  v_so_description text;
  v_so_uom text;
  v_so_catalog_product_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede crear un surtido de Sales Order.';
  end if;
  if v_sales_order_id is null then
    raise exception 'Debe indicarse la Sales Order de origen.';
  end if;
  if v_warehouse_id is null then
    raise exception 'Debe indicarse el almacén de surtido.';
  end if;

  v_organization_id := current_user_organization_id();

  select * into v_number_result from fn_next_sales_fulfillment_number(v_organization_id, current_date);

  insert into sales_fulfillments (
    id, organization_id, fulfillment_number, sequence_number, sales_order_id, warehouse_id,
    status, delivery_contact, delivery_notes, created_by
  ) values (
    p_fulfillment_id, v_organization_id, v_number_result.fulfillment_number, v_number_result.sequence_number,
    v_sales_order_id, v_warehouse_id, 'draft', v_delivery_contact, v_delivery_notes, auth.uid()
  )
  returning * into v_sf;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_sales_order_item_id := nullif(v_item->>'sales_order_item_id', '')::uuid;
    v_quantity_requested := nullif(v_item->>'quantity_requested', '')::integer;

    if v_sales_order_item_id is null then
      raise exception 'Cada línea debe indicar de qué línea de la Sales Order proviene.';
    end if;
    if v_quantity_requested is null or v_quantity_requested <= 0 then
      raise exception 'La cantidad a surtir de cada línea debe ser mayor a cero.';
    end if;

    select catalog_product_id, sku_snapshot, description_snapshot, uom_snapshot
      into v_so_catalog_product_id, v_so_sku, v_so_description, v_so_uom
      from sales_order_items where id = v_sales_order_item_id and sales_order_id = v_sales_order_id;
    if v_so_sku is null then
      raise exception 'La línea % no pertenece a la Sales Order de origen.', v_sales_order_item_id;
    end if;

    insert into sales_fulfillment_items (
      sales_fulfillment_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity_requested, quantity_fulfilled
    ) values (
      v_sf.id, v_sales_order_item_id, v_so_catalog_product_id,
      coalesce(v_so_description, v_so_sku), v_so_uom, v_quantity_requested, 0
    );
  end loop;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (v_sf.id, 'created', null, 'draft', auth.uid());

  return v_sf;
end;
$$;

-- =========================================================================
-- 14) rpc_update_sales_fulfillment — SECURITY INVOKER. Solo mientras
--     status = 'draft' (verificado dentro del RPC, además de RLS/trigger).
--     Reemplaza almacén/contacto/notas + todo el set de
--     sales_fulfillment_items en la MISMA transacción (DELETE + INSERT).
-- =========================================================================
create or replace function rpc_update_sales_fulfillment(
  p_fulfillment_id uuid,
  p_fulfillment jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
  v_current_status text;
  v_warehouse_id uuid := nullif(p_fulfillment->>'warehouse_id', '')::uuid;
  v_delivery_contact text := nullif(p_fulfillment->>'delivery_contact', '');
  v_delivery_notes text := nullif(p_fulfillment->>'delivery_notes', '');
  v_item jsonb;
  v_sales_order_item_id uuid;
  v_quantity_requested integer;
  v_so_sku text;
  v_so_description text;
  v_so_uom text;
  v_so_catalog_product_id uuid;
begin
  select status into v_current_status from sales_fulfillments where id = p_fulfillment_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_sales_fulfillment: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if v_current_status <> 'draft' then
    raise exception 'rpc_update_sales_fulfillment: el surtido % no está en draft (status actual: %); su contenido no puede editarse.', p_fulfillment_id, v_current_status;
  end if;
  if v_warehouse_id is null then
    raise exception 'Debe indicarse el almacén de surtido.';
  end if;

  update sales_fulfillments
    set warehouse_id = v_warehouse_id, delivery_contact = v_delivery_contact, delivery_notes = v_delivery_notes
    where id = p_fulfillment_id
    returning * into v_sf;

  delete from sales_fulfillment_items where sales_fulfillment_id = p_fulfillment_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_sales_order_item_id := nullif(v_item->>'sales_order_item_id', '')::uuid;
    v_quantity_requested := nullif(v_item->>'quantity_requested', '')::integer;

    if v_sales_order_item_id is null then
      raise exception 'Cada línea debe indicar de qué línea de la Sales Order proviene.';
    end if;
    if v_quantity_requested is null or v_quantity_requested <= 0 then
      raise exception 'La cantidad a surtir de cada línea debe ser mayor a cero.';
    end if;

    select catalog_product_id, sku_snapshot, description_snapshot, uom_snapshot
      into v_so_catalog_product_id, v_so_sku, v_so_description, v_so_uom
      from sales_order_items where id = v_sales_order_item_id and sales_order_id = v_sf.sales_order_id;
    if v_so_sku is null then
      raise exception 'La línea % no pertenece a la Sales Order de origen.', v_sales_order_item_id;
    end if;

    insert into sales_fulfillment_items (
      sales_fulfillment_id, sales_order_item_id, catalog_product_id,
      description_snapshot, uom_snapshot, quantity_requested, quantity_fulfilled
    ) values (
      p_fulfillment_id, v_sales_order_item_id, v_so_catalog_product_id,
      coalesce(v_so_description, v_so_sku), v_so_uom, v_quantity_requested, 0
    );
  end loop;

  return v_sf;
end;
$$;

-- =========================================================================
-- 15) rpc_cancel_sales_fulfillment — SECURITY INVOKER. SOLO
--     'draft' -> 'cancelled' (ver DECISIÓN de cabecera: MVP no permite
--     cancelar más allá de draft, mismo criterio que 0070).
-- =========================================================================
create or replace function rpc_cancel_sales_fulfillment(p_fulfillment_id uuid)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede cancelar un surtido de Sales Order.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_cancel_sales_fulfillment: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;
  if v_sf.status <> 'draft' then
    raise exception 'Solo se puede cancelar un surtido en draft (status actual: %).', v_sf.status;
  end if;

  update sales_fulfillments set status = 'cancelled' where id = p_fulfillment_id returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (p_fulfillment_id, 'cancelled', 'draft', 'cancelled', auth.uid());

  return v_sf;
end;
$$;

-- =========================================================================
-- 16) rpc_mark_sales_fulfillment_ready — SECURITY INVOKER. draft -> ready
--     (picking/packing confirmado). NO afecta inventario (regla 9) — solo
--     registra quién/cuándo preparó.
-- =========================================================================
create or replace function rpc_mark_sales_fulfillment_ready(p_fulfillment_id uuid)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
  v_item_count integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede preparar un surtido de Sales Order.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_mark_sales_fulfillment_ready: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;
  if v_sf.status <> 'draft' then
    raise exception 'Solo se puede preparar un surtido que esté en draft (status actual: %).', v_sf.status;
  end if;

  select count(*) into v_item_count from sales_fulfillment_items where sales_fulfillment_id = p_fulfillment_id;
  if v_item_count = 0 then
    raise exception 'No puedes preparar un surtido sin líneas.';
  end if;

  update sales_fulfillments set status = 'ready', prepared_by = auth.uid(), prepared_at = now()
    where id = p_fulfillment_id
    returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (p_fulfillment_id, 'ready', 'draft', 'ready', auth.uid());

  return v_sf;
end;
$$;

-- =========================================================================
-- 17) rpc_dispatch_sales_fulfillment — SECURITY INVOKER. Despacha TODAS
--     las líneas en UNA transacción: ready -> shipped. Bloquea/valida el
--     surtido, la Sales Order (EN VIVO — regla 1/2, puede haber cambiado
--     desde 'ready'), cantidades pendientes (regla 4, EN VIVO contra
--     quantity_fulfilled real), y existencia/stock (regla 6/7) antes de
--     crear los movimientos OUT — mismo patrón exacto de
--     rpc_fulfill_inventory_reservation (0038) para el chequeo de ON HAND.
--     Idempotente respecto a doble despacho (regla 11): un surtido que ya
--     no está en 'ready' se rechaza explícitamente. Si CUALQUIER línea
--     falla, la excepción revierte TODA la transacción (regla: rollback
--     completo) — incluidas las líneas ya procesadas en este mismo loop.
--     Al final, recalcula fulfillment_release_status de la Sales Order
--     (released -> partially_released -> fulfilled) sumando
--     quantity_fulfilled de TODAS las líneas de TODOS sus surtidos
--     activos contra sales_order_items.quantity — NUNCA lo baja a
--     'blocked' (eso es exclusivo de Finanzas, 0068).
-- =========================================================================
-- SECURITY DEFINER (a diferencia del resto de las RPCs de esta migración):
-- necesita insertar directamente en inventory_movements (sin policy de
-- INSERT para `authenticated`, ver DECISIÓN 0036/0038 — solo escriben ahí
-- funciones SECURITY DEFINER) y actualizar sales_orders.fulfillment_release_status
-- (sin policy de UPDATE para can_manage_sales_fulfillment, ver
-- sales_orders_update_finance, 0068) — mismo criterio EXACTO que
-- rpc_receive_purchase_order_item (0035/0036) y
-- rpc_fulfill_inventory_reservation (0038), las únicas otras dos RPCs de
-- todo el proyecto que también escriben en el ledger. La autorización real
-- la sigue imponiendo el chequeo explícito de capability al inicio del
-- cuerpo — SECURITY DEFINER nunca reemplaza esa validación, solo permite
-- que la escritura ya autorizada llegue a las tablas.
create or replace function rpc_dispatch_sales_fulfillment(p_fulfillment_id uuid)
returns sales_fulfillments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
  v_so sales_orders;
  v_item sales_fulfillment_items;
  v_so_item sales_order_items;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_total_required integer;
  v_total_fulfilled integer;
  v_new_release_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede despachar un surtido de Sales Order.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_dispatch_sales_fulfillment: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;
  if v_sf.status <> 'ready' then
    raise exception 'Este surtido ya fue despachado o no está listo para despachar (status actual: %) — no se puede duplicar la salida.', v_sf.status;
  end if;

  -- Revalidación EN VIVO de la Sales Order (regla 1/2) — puede haber
  -- cambiado desde que se creó/preparó el surtido.
  select * into v_so from sales_orders where id = v_sf.sales_order_id for update;
  if v_so.id is null or v_so.organization_id <> v_sf.organization_id then
    raise exception 'La Sales Order de este surtido no existe o no pertenece a tu organización.';
  end if;
  if v_so.status = 'cancelled' then
    raise exception 'No se puede despachar un surtido de una Sales Order cancelada.';
  end if;
  if v_so.fulfillment_release_status not in ('released', 'partially_released', 'fulfilled') then
    raise exception 'No se puede despachar un surtido de una Sales Order que no esté liberada financieramente (estado actual: %).', v_so.fulfillment_release_status;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  for v_item in select * from sales_fulfillment_items where sales_fulfillment_id = p_fulfillment_id order by created_at
  loop
    select * into v_so_item from sales_order_items where id = v_item.sales_order_item_id for update;

    -- Regla 4 (autoritativa, EN VIVO): acumulado REALMENTE surtido
    -- (quantity_fulfilled) de esta línea a través de TODOS los surtidos,
    -- nunca puede superar lo vendido.
    if (
      select coalesce(sum(sfi.quantity_fulfilled), 0)
      from sales_fulfillment_items sfi
      where sfi.sales_order_item_id = v_item.sales_order_item_id
    ) + v_item.quantity_requested > v_so_item.quantity then
      raise exception
        'La línea de Sales Order % ya tiene % unidad(es) surtida(s) (de % vendidas) — no se puede surtir % más.',
        v_item.sales_order_item_id,
        (select coalesce(sum(sfi.quantity_fulfilled), 0) from sales_fulfillment_items sfi where sfi.sales_order_item_id = v_item.sales_order_item_id),
        v_so_item.quantity, v_item.quantity_requested;
    end if;

    -- Regla 8: línea libre (sin catalog_product_id) no mueve inventario —
    -- solo se marca surtida operativamente.
    if v_item.catalog_product_id is not null then
      select coalesce(sum(quantity_delta), 0) into v_current_on_hand
        from inventory_movements
        where product_id = v_item.catalog_product_id and warehouse_id = v_sf.warehouse_id;
      if v_current_on_hand - v_item.quantity_requested < 0 then
        raise exception 'No hay existencia suficiente de % en el almacén seleccionado para surtir % unidad(es) (disponible: %).',
          v_item.description_snapshot, v_item.quantity_requested, v_current_on_hand;
      end if;

      insert into inventory_movements (
        organization_id, product_id, warehouse_id, quantity_delta, movement_type,
        sales_fulfillment_id, sales_fulfillment_item_id, created_by_user_id, created_by_name
      ) values (
        v_sf.organization_id, v_item.catalog_product_id, v_sf.warehouse_id, -v_item.quantity_requested, 'surtido_venta',
        v_sf.id, v_item.id, v_user_id, coalesce(v_user_name, '—')
      );
    end if;

    update sales_fulfillment_items set quantity_fulfilled = quantity_requested where id = v_item.id;
  end loop;

  update sales_fulfillments set status = 'shipped', shipped_at = now()
    where id = p_fulfillment_id
    returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (p_fulfillment_id, 'shipped', 'ready', 'shipped', auth.uid());

  -- Recalcula fulfillment_release_status de la Sales Order completa
  -- (TODAS sus líneas, TODOS sus surtidos activos) — mismo patrón de
  -- agregación que rpc_receive_purchase_order_item (0035/0036) para el
  -- status de recepción de una PO.
  select coalesce(sum(soi.quantity), 0) into v_total_required
    from sales_order_items soi where soi.sales_order_id = v_so.id;
  select coalesce(sum(sfi.quantity_fulfilled), 0) into v_total_fulfilled
    from sales_fulfillment_items sfi
    join sales_fulfillments sf on sf.id = sfi.sales_fulfillment_id
    where sf.sales_order_id = v_so.id and sf.status <> 'cancelled';

  if v_total_required > 0 and v_total_fulfilled >= v_total_required then
    v_new_release_status := 'fulfilled';
  elsif v_total_fulfilled > 0 then
    v_new_release_status := 'partially_released';
  else
    v_new_release_status := v_so.fulfillment_release_status;
  end if;

  if v_new_release_status is distinct from v_so.fulfillment_release_status then
    update sales_orders set fulfillment_release_status = v_new_release_status where id = v_so.id;
  end if;

  return v_sf;
end;
$$;

-- =========================================================================
-- 18) rpc_mark_sales_fulfillment_delivered — SECURITY INVOKER. shipped ->
--     delivered. Registra delivered_at/delivered_by/notas (regla:
--     "registrar delivered_at, usuario, notas/evidencia textual mínima").
--     NO mueve inventario (la salida física ya ocurrió al despachar) ni
--     vuelve a tocar fulfillment_release_status (ya se calculó al
--     despachar, sección 17).
-- =========================================================================
create or replace function rpc_mark_sales_fulfillment_delivered(
  p_fulfillment_id uuid,
  p_delivery_notes text default null
)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede marcar un surtido como entregado.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_mark_sales_fulfillment_delivered: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;
  if v_sf.status <> 'shipped' then
    raise exception 'Solo se puede marcar como entregado un surtido que ya fue despachado (status actual: %).', v_sf.status;
  end if;

  update sales_fulfillments
    set status = 'delivered', delivered_at = now(), delivered_by = auth.uid(),
        delivery_notes = coalesce(nullif(p_delivery_notes, ''), delivery_notes)
    where id = p_fulfillment_id
    returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, reason, created_by)
    values (p_fulfillment_id, 'delivered', 'shipped', 'delivered', p_delivery_notes, auth.uid());

  return v_sf;
end;
$$;

-- =========================================================================
-- 19) rpc_update_sales_fulfillment_delivery_notes — SECURITY INVOKER.
--     Único campo editable fuera de draft y aun con status 'delivered'
--     (regla 12: "inmutable salvo notas permitidas explícitamente") — no
--     aplica a 'cancelled' (trg_prevent_sales_fulfillment_field_change,
--     sección 7, lo rechaza).
-- =========================================================================
create or replace function rpc_update_sales_fulfillment_delivery_notes(
  p_fulfillment_id uuid,
  p_delivery_notes text
)
returns sales_fulfillments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede editar las notas de un surtido.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_update_sales_fulfillment_delivery_notes: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;

  update sales_fulfillments set delivery_notes = nullif(p_delivery_notes, '')
    where id = p_fulfillment_id
    returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (p_fulfillment_id, 'notes_updated', v_sf.status, v_sf.status, auth.uid());

  return v_sf;
end;
$$;

commit;
