-- THÖREN — Ticket C1 de la transición orders -> sales_orders: abastecimiento
-- automático POR PARTIDA para sales_orders (shortage + reservas +
-- sincronización de requisiciones de compra). Backend únicamente — sin UI,
-- sin navegación, sin Logística/entrega al cliente, sin notificaciones, sin
-- facturación/comisiones, sin tocar `orders` legado.
--
-- =========================================================================
-- AUDITORÍA PREVIA (mínima, dirigida) — qué ya existe y es reutilizable
-- =========================================================================
-- inventory_movements: ya es 100% producto×almacén, sin ninguna referencia
--   a `orders`/`order_items` salvo para movimientos de recepción de compra
--   (purchase_order_id/purchase_order_item_id) — reutilizable TAL CUAL,
--   sin ningún cambio.
-- rpc_inventory_stock_levels / rpc_inventory_incoming_by_product: ya
--   agregan por producto×almacén / producto, sin ninguna referencia a
--   `orders` — reutilizables TAL CUAL. rpc_inventory_incoming_by_product ya
--   incluye correctamente una PO originada en Requisición (confirmado en el
--   comentario de 0069) — las recepciones YA alimentan shortage sin ningún
--   cambio: recibir reduce quantity_ordered-quantity_received (baja
--   incoming) y agrega un movimiento 'recepcion_compra' (sube on_hand).
-- inventory_reservations: HOY hardcoded a `orders` (order_id not null,
--   sin ninguna columna de sales_order). Es la ÚNICA pieza que requiere
--   cambio de esquema real — se extiende (nunca se duplica) en la sección
--   1 de abajo.
-- fn_order_product_shortage / rpc_sync_order_procurement (0064): el
--   patrón de cálculo/sincronización completo ya existe y está probado —
--   se REPLICA su fórmula algebraica exacta (demanda total vs. oferta
--   total menos lo reclamado por terceros, independiente de cuánto ya
--   reservó el propio Pedido) pero cambiando la unidad de demanda de
--   "producto agregado dentro de un Pedido" a "sales_order_item individual"
--   — PRINCIPIO explícito del ticket: no copiar ciegamente el modelo
--   agregado por producto. purchase_requirements (orders, agregado por
--   producto) NO se reutiliza ni se extiende — es la tabla equivocada para
--   este alcance.
-- purchase_requisitions/purchase_requisition_items (0069): YA tienen
--   granularidad real por partida (sales_order_item_id NOT NULL en cada
--   línea) — es la tabla CORRECTA para sincronizar necesidad de compra de
--   sales_orders, ya existente, 100% manual hasta hoy. C1 la extiende con
--   un marcador `auto_generated` para poder reconciliar automáticamente
--   SOLO las líneas que el propio sync creó, sin tocar nunca una
--   requisición armada a mano por Compras. trg_check_purchase_requisition_eligible
--   (0069) YA exige `fulfillment_release_status in ('released',
--   'partially_released')` para poder crear CUALQUIER requisición — es
--   EXACTAMENTE el gate financiero que este ticket pide respetar, reutilizado
--   sin reimplementar ninguna lógica financiera nueva.
-- sales_fulfillment_items (0071): quantity_fulfilled ya se actualiza
--   exclusivamente al despachar (rpc_dispatch_sales_fulfillment), que
--   simultáneamente inserta un movimiento 'surtido_venta' (resta on_hand).
--   NO se toca 0071 — el shortage de C1 usa SUM(quantity_fulfilled) como
--   demanda ya cubierta, y como on_hand YA refleja esa misma salida física,
--   la resta nunca duplica el conteo (ver DECISIÓN "fórmula de shortage").
--
-- =========================================================================
-- DECISIÓN — fórmula de shortage por sales_order_item (sin doble conteo)
-- =========================================================================
-- pending_qty   = sales_order_items.quantity - SUM(quantity_fulfilled de
--                 TODOS sus sales_fulfillment_items, surtidos activos)
-- on_hand_qty   = SUM(inventory_movements.quantity_delta) del producto,
--                 en almacenes ACTIVOS de la organización (igual criterio
--                 que fn_order_product_shortage) — YA refleja cualquier
--                 'surtido_venta' ya despachado, así que no se vuelve a
--                 restar aparte.
-- reserved_other_qty = SUM(quantity) de TODAS las reservas activas del
--                 MISMO producto que NO pertenecen a esta partida —
--                 incluye automáticamente reservas de `orders` legado Y de
--                 otras sales_order_items (misma Sales Order u otra),
--                 porque ambas comparten la MISMA tabla inventory_reservations
--                 — es la razón de fondo para extender, no duplicar, esa
--                 tabla: así ninguna de las dos canalizaciones puede
--                 sobrevender contra la otra.
-- incoming_qty  = rpc_inventory_incoming_by_product() reutilizada tal cual
--                 (ya cubre PO de Requisición).
-- shortage_qty  = greatest(pending_qty - on_hand_qty + reserved_other_qty
--                 - incoming_qty, 0)
--                 — ALGEBRAICAMENTE IDÉNTICA a fn_order_product_shortage,
--                 solo que "requested_qty" pasa a ser "pending_qty" POR
--                 PARTIDA en vez de "requested_qty" agregado por producto
--                 dentro del Pedido. reserved_this_qty (esta misma partida)
--                 NUNCA aparece en la fórmula — se cancela algebraicamente,
--                 igual que en 0064 (reservar no crea ni destruye
--                 disponibilidad física, solo la reasigna).
-- Dos partidas del MISMO producto en la MISMA Sales Order quedan
-- automáticamente independientes y sin doble conteo: cada una tiene su
-- PROPIA reserva (sales_order_item_id distinto), así que la reserva de
-- una cuenta como "reserved_other" para la otra — compiten de forma
-- realista por el mismo pool físico, exactamente como competirían dos
-- Pedidos legado distintos.
--
-- =========================================================================
-- DECISIÓN — reservas: extensión de inventory_reservations, no tabla nueva
-- =========================================================================
-- order_id pasa a NULLABLE; se agregan sales_order_id/sales_order_item_id
-- (NULLABLE, ligados entre sí). CHECK "exactamente un origen" — nunca
-- ambos, nunca ninguno. Nuevo índice único parcial
-- (sales_order_item_id, warehouse_id) WHERE released_at IS NULL — mismo
-- criterio que el de `orders` (GAP 1, 0064), pero sin necesitar product_id
-- en la clave porque una sales_order_item YA tiene un producto fijo.
-- rpc_reserve_inventory se extiende (parámetro nuevo opcional al final,
-- compatible con cualquier llamador existente que use argumentos con
-- nombre, patrón estándar de Supabase/PostgREST) para aceptar
-- p_sales_order_item_id; rpc_adjust_inventory_reservation/
-- rpc_release_inventory_reservation/rpc_fulfill_inventory_reservation se
-- reemplazan SOLO para resolver el dueño (salesperson) por cualquiera de
-- los dos orígenes vía un helper nuevo — el resto de cada función es
-- carácter por carácter idéntico a su versión vigente (0044).
--
-- =========================================================================
-- DECISIÓN — gate financiero: reutilizado, no reinventado
-- =========================================================================
-- rpc_sync_sales_order_procurement verifica explícitamente
-- fulfillment_release_status in ('released', 'partially_released') ANTES
-- de tocar reservas o requisiciones — mismo criterio exacto que ya exige
-- trg_check_purchase_requisition_eligible para cualquier INSERT en
-- purchase_requisitions (la creación real de la fila habría fallado de
-- todas formas sin este chequeo explícito; se valida aquí también para
-- poder devolver un no-op limpio en vez de una excepción, mismo patrón que
-- rpc_sync_order_procurement con status <> 'pedido'). Si la Sales Order
-- está bloqueada (blocked) o aún no confirmada (draft/confirmed sin
-- liberar), el sync es un no-op total: no reserva, no requisita, no toca
-- nada.
--
-- =========================================================================
-- DECISIÓN — idempotencia
-- =========================================================================
-- Reservas: mismo patrón TOP-UP/SHRINK de 0064, keyed por
-- sales_order_item_id — correr el sync dos veces sin cambios produce
-- v_desired_reserved_total = v_current_reserved_total, sin ninguna
-- escritura. Requisiciones: a lo sumo UNA requisición auto_generated=true
-- en status='draft' por Sales Order a la vez (índice único parcial);
-- sus líneas se reconcilian por (purchase_requisition_id,
-- sales_order_item_id) — único también — así que una segunda corrida
-- sin cambios hace UPDATE de los mismos valores (no-op real) en vez de
-- insertar una línea duplicada.
--
-- Como el resto del proyecto: idempotente donde aplica y corre completa en
-- una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) inventory_reservations — soporte de sales_order/sales_order_item.
-- =========================================================================
alter table inventory_reservations
  alter column order_id drop not null;

alter table inventory_reservations
  add column if not exists sales_order_id uuid references sales_orders (id) on delete restrict,
  add column if not exists sales_order_item_id uuid references sales_order_items (id) on delete restrict;

alter table inventory_reservations
  drop constraint if exists inventory_reservations_exactly_one_origin;
alter table inventory_reservations
  add constraint inventory_reservations_exactly_one_origin check (
    (order_id is not null and sales_order_id is null and sales_order_item_id is null)
    or
    (order_id is null and sales_order_id is not null and sales_order_item_id is not null)
  );

create index if not exists inventory_reservations_sales_order_idx on inventory_reservations (sales_order_id);
create index if not exists inventory_reservations_sales_order_item_idx on inventory_reservations (sales_order_item_id);

-- A lo sumo UNA reserva ACTIVA por sales_order_item + almacén — mismo
-- criterio que inventory_reservations_active_unique (orders), sin
-- necesitar product_id en la clave porque una sales_order_item ya tiene un
-- producto fijo.
create unique index if not exists inventory_reservations_so_item_active_unique
  on inventory_reservations (sales_order_item_id, warehouse_id)
  where released_at is null;

-- =========================================================================
-- 2) inventory_reservation_events — mismo par de columnas, mismo criterio.
-- =========================================================================
alter table inventory_reservation_events
  alter column order_id drop not null;

alter table inventory_reservation_events
  add column if not exists sales_order_id uuid references sales_orders (id) on delete restrict,
  add column if not exists sales_order_item_id uuid references sales_order_items (id) on delete restrict;

create index if not exists inventory_reservation_events_sales_order_item_idx
  on inventory_reservation_events (sales_order_item_id);

-- =========================================================================
-- 3) RLS — inventory_reservations / inventory_reservation_events: agrega
--    la rama de dueño vía sales_order (salesperson), reemplazando las
--    policies vigentes (0041) — el resto queda carácter por carácter igual.
-- =========================================================================
drop policy if exists "inventory_reservations_select" on inventory_reservations;
create policy "inventory_reservations_select" on inventory_reservations
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservations.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or exists (
        select 1 from sales_orders so
        where so.id = inventory_reservations.sales_order_id
          and so.salesperson_id = current_user_salesperson_id()
      )
      or current_user_has_capability('can_view_all_sales')
    )
  );

drop policy if exists "inventory_reservation_events_select" on inventory_reservation_events;
create policy "inventory_reservation_events_select" on inventory_reservation_events
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = inventory_reservation_events.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or exists (
        select 1 from sales_orders so
        where so.id = inventory_reservation_events.sales_order_id
          and so.salesperson_id = current_user_salesperson_id()
      )
      or current_user_has_capability('can_view_all_sales')
    )
  );

-- =========================================================================
-- 4) fn_inventory_reservation_owner_salesperson — helper nuevo, pequeño:
--    resuelve el salesperson dueño de una reserva para CUALQUIERA de los
--    dos orígenes, para no duplicar esta rama 3 veces (adjust/release/
--    fulfill). STABLE, SECURITY INVOKER (lee orders/sales_orders bajo la
--    RLS del caller — ambas ya son legibles para cualquier dueño/admin).
-- =========================================================================
create or replace function fn_inventory_reservation_owner_salesperson(p_reservation inventory_reservations)
returns uuid
language sql
stable
as $$
  select case
    when p_reservation.order_id is not null then
      (select salesperson_id from orders where id = p_reservation.order_id)
    else
      (select salesperson_id from sales_orders where id = p_reservation.sales_order_id)
  end;
$$;

-- =========================================================================
-- 5) rpc_reserve_inventory — reemplaza la versión vigente (0044), agrega
--    p_sales_order_item_id (parámetro NUEVO al final, default null —
--    compatible con cualquier llamador existente que invoque con
--    argumentos nombrados, patrón estándar PostgREST/supabase-js).
--    Exactamente uno de p_order_id / p_sales_order_item_id debe venir
--    informado. Resto de la función (chequeos de cantidad/almacén/
--    disponibilidad, ledger de eventos) carácter por carácter igual,
--    bifurcando solo donde depende del origen.
-- =========================================================================
create or replace function rpc_reserve_inventory(
  p_reservation_id uuid,
  p_order_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity integer,
  p_sales_order_item_id uuid default null
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_owner_salesperson_id uuid;
  v_sales_order_id uuid;
  v_committed_others integer;
  v_on_hand integer;
  v_available integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_row inventory_reservations;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if (p_order_id is not null) = (p_sales_order_item_id is not null) then
    raise exception 'rpc_reserve_inventory: debe indicarse exactamente un origen (Pedido o partida de Sales Order), nunca ambos ni ninguno.';
  end if;

  if p_order_id is not null then
    select organization_id, salesperson_id into v_organization_id, v_owner_salesperson_id
      from orders where id = p_order_id;
    if v_organization_id is null then
      raise exception 'Pedido no encontrado: %', p_order_id;
    end if;
  else
    select so.organization_id, so.salesperson_id, so.id
      into v_organization_id, v_owner_salesperson_id, v_sales_order_id
      from sales_order_items soi join sales_orders so on so.id = soi.sales_order_id
      where soi.id = p_sales_order_item_id;
    if v_organization_id is null then
      raise exception 'Partida de Sales Order no encontrada: %', p_sales_order_item_id;
    end if;
  end if;

  if not is_organization_member(v_organization_id) then
    raise exception 'Este documento no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_owner_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para reservar inventario sobre este documento.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad a reservar debe ser mayor a cero.';
  end if;

  if not exists (
    select 1 from product_catalog where id = p_product_id and organization_id = v_organization_id
  ) then
    raise exception 'El producto seleccionado no existe o no pertenece a tu organización.';
  end if;

  if p_order_id is not null then
    if not exists (
      select 1 from order_items where order_id = p_order_id and catalog_product_id = p_product_id
    ) then
      raise exception 'Este producto no forma parte de las partidas de este Pedido.';
    end if;
  else
    if not exists (
      select 1 from sales_order_items where id = p_sales_order_item_id and catalog_product_id = p_product_id
    ) then
      raise exception 'Este producto no corresponde a la partida de Sales Order indicada.';
    end if;
  end if;

  if not exists (
    select 1 from warehouses where id = p_warehouse_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El almacén seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if p_order_id is not null then
    if exists (
      select 1 from inventory_reservations
      where order_id = p_order_id and product_id = p_product_id and warehouse_id = p_warehouse_id and released_at is null
    ) then
      raise exception 'Ya existe una reserva activa para este producto en este almacén y Pedido; ajústala en vez de crear una nueva.';
    end if;
  else
    if exists (
      select 1 from inventory_reservations
      where sales_order_item_id = p_sales_order_item_id and warehouse_id = p_warehouse_id and released_at is null
    ) then
      raise exception 'Ya existe una reserva activa para esta partida en este almacén; ajústala en vez de crear una nueva.';
    end if;
  end if;

  select coalesce(sum(quantity), 0) into v_committed_others
    from inventory_reservations
    where product_id = p_product_id and warehouse_id = p_warehouse_id and released_at is null;
  select coalesce(sum(quantity_delta), 0) into v_on_hand
    from inventory_movements
    where product_id = p_product_id and warehouse_id = p_warehouse_id;
  v_available := v_on_hand - v_committed_others;

  if p_quantity > v_available then
    raise exception 'No hay suficiente disponible en ese almacén (disponible: %, solicitado: %).', v_available, p_quantity;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into inventory_reservations (
    id, organization_id, order_id, sales_order_id, sales_order_item_id, product_id, warehouse_id, quantity,
    created_by_user_id, created_by_name
  ) values (
    p_reservation_id, v_organization_id, p_order_id, v_sales_order_id, p_sales_order_item_id, p_product_id, p_warehouse_id, p_quantity,
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_row;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, sales_order_id, sales_order_item_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_row.id, v_organization_id, p_order_id, v_sales_order_id, p_sales_order_item_id, p_product_id, p_warehouse_id,
    'creada', null, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_row;
end;
$$;

-- =========================================================================
-- 6) rpc_adjust_inventory_reservation — reemplaza la versión vigente
--    (0044): única diferencia real, usa fn_inventory_reservation_owner_salesperson
--    en vez de leer `orders` directamente. Resto carácter por carácter igual.
-- =========================================================================
create or replace function rpc_adjust_inventory_reservation(
  p_reservation_id uuid,
  p_quantity integer
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation inventory_reservations;
  v_owner_salesperson_id uuid;
  v_committed_others integer;
  v_on_hand integer;
  v_available integer;
  v_event_type text;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_previous_quantity integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_reservation
    from inventory_reservations where id = p_reservation_id and released_at is null
    for update;
  if v_reservation.id is null then
    raise exception 'Reserva activa no encontrada: %', p_reservation_id;
  end if;

  if not is_organization_member(v_reservation.organization_id) then
    raise exception 'Esta reserva no pertenece a tu organización.';
  end if;
  v_owner_salesperson_id := fn_inventory_reservation_owner_salesperson(v_reservation);
  if not current_user_is_admin()
     and v_owner_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para ajustar esta reserva.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero; usa liberar para quitar la reserva por completo.';
  end if;

  if p_quantity < v_reservation.fulfilled_quantity then
    raise exception 'No puedes reducir la reserva por debajo de lo ya surtido (surtido: %, solicitado: %).',
      v_reservation.fulfilled_quantity, p_quantity;
  end if;

  v_previous_quantity := v_reservation.quantity;
  if p_quantity = v_previous_quantity then
    return v_reservation;
  end if;

  select coalesce(sum(quantity - fulfilled_quantity), 0) into v_committed_others
    from inventory_reservations
    where product_id = v_reservation.product_id
      and warehouse_id = v_reservation.warehouse_id
      and released_at is null
      and id <> v_reservation.id;
  select coalesce(sum(quantity_delta), 0) into v_on_hand
    from inventory_movements
    where product_id = v_reservation.product_id and warehouse_id = v_reservation.warehouse_id;
  v_available := v_on_hand - v_committed_others;

  if (p_quantity - v_reservation.fulfilled_quantity) > v_available then
    raise exception 'No hay suficiente disponible en ese almacén (disponible: %, pendiente solicitado: %).',
      v_available, p_quantity - v_reservation.fulfilled_quantity;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;
  v_event_type := case when p_quantity > v_previous_quantity then 'aumentada' else 'reducida' end;

  update inventory_reservations set quantity = p_quantity
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, sales_order_id, sales_order_item_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.sales_order_id, v_reservation.sales_order_item_id,
    v_reservation.product_id, v_reservation.warehouse_id,
    v_event_type, v_previous_quantity, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 7) rpc_release_inventory_reservation — reemplaza la versión vigente
--    (0044): misma única diferencia (helper de dueño). Resto idéntico.
-- =========================================================================
create or replace function rpc_release_inventory_reservation(
  p_reservation_id uuid
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation inventory_reservations;
  v_owner_salesperson_id uuid;
  v_user_id uuid := auth.uid();
  v_user_name text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_reservation
    from inventory_reservations where id = p_reservation_id and released_at is null
    for update;
  if v_reservation.id is null then
    raise exception 'Reserva activa no encontrada: %', p_reservation_id;
  end if;

  if not is_organization_member(v_reservation.organization_id) then
    raise exception 'Esta reserva no pertenece a tu organización.';
  end if;
  v_owner_salesperson_id := fn_inventory_reservation_owner_salesperson(v_reservation);
  if not current_user_is_admin()
     and v_owner_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para liberar esta reserva.';
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  update inventory_reservations
    set released_at = clock_timestamp(), released_by_user_id = v_user_id, released_by_name = coalesce(v_user_name, '—')
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, sales_order_id, sales_order_item_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.sales_order_id, v_reservation.sales_order_item_id,
    v_reservation.product_id, v_reservation.warehouse_id,
    'liberada', v_reservation.quantity, v_reservation.quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 8) rpc_fulfill_inventory_reservation — reemplaza la versión vigente
--    (0044): misma única diferencia (helper de dueño) + el chequeo de
--    "partida activa" bifurca por origen. No forma parte del flujo de
--    surtido de sales_orders hoy (rpc_dispatch_sales_fulfillment, 0071, no
--    la invoca — fuera de alcance de C1 tocar 0071) — se corrige aquí
--    únicamente por defensa en profundidad (closes the ownership-bypass
--    gap para cualquier origen), no porque algo nuevo la invoque.
-- =========================================================================
create or replace function rpc_fulfill_inventory_reservation(
  p_reservation_id uuid,
  p_fulfilled_quantity integer
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation inventory_reservations;
  v_owner_salesperson_id uuid;
  v_delta integer;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_reservation
    from inventory_reservations where id = p_reservation_id and released_at is null
    for update;
  if v_reservation.id is null then
    raise exception 'Reserva activa no encontrada: %', p_reservation_id;
  end if;

  if not is_organization_member(v_reservation.organization_id) then
    raise exception 'Esta reserva no pertenece a tu organización.';
  end if;
  v_owner_salesperson_id := fn_inventory_reservation_owner_salesperson(v_reservation);
  if not current_user_is_admin()
     and v_owner_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_fulfill_inventory') then
    raise exception 'No tienes permiso para surtir esta reserva.';
  end if;

  if v_reservation.order_id is not null then
    if not exists (
      select 1 from order_items
      where order_id = v_reservation.order_id and catalog_product_id = v_reservation.product_id
    ) then
      raise exception 'Esta reserva ya no tiene una partida activa en el Pedido; no se puede surtir (puedes liberarla).';
    end if;
  else
    if not exists (select 1 from sales_order_items where id = v_reservation.sales_order_item_id) then
      raise exception 'Esta reserva ya no tiene una partida de Sales Order activa; no se puede surtir (puedes liberarla).';
    end if;
  end if;

  if p_fulfilled_quantity is null or p_fulfilled_quantity < 0 then
    raise exception 'La cantidad surtida no puede ser negativa.';
  end if;
  if p_fulfilled_quantity > v_reservation.quantity then
    raise exception 'No puedes surtir más de lo reservado (reservado: %, solicitado: %).',
      v_reservation.quantity, p_fulfilled_quantity;
  end if;
  if p_fulfilled_quantity < v_reservation.fulfilled_quantity then
    raise exception 'No se puede reducir la cantidad ya surtida — es una salida física ejecutada, no un valor administrativo.';
  end if;

  v_delta := p_fulfilled_quantity - v_reservation.fulfilled_quantity;
  if v_delta = 0 then
    return v_reservation;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  select coalesce(sum(quantity_delta), 0) into v_current_on_hand
    from inventory_movements
    where product_id = v_reservation.product_id and warehouse_id = v_reservation.warehouse_id;
  if v_current_on_hand < v_delta then
    raise exception 'No hay existencia suficiente en ese almacén para surtir esta cantidad (disponible: %, solicitado: %).',
      v_current_on_hand, v_delta;
  end if;

  insert into inventory_movements (
    organization_id, product_id, warehouse_id, quantity_delta, movement_type,
    created_by_user_id, created_by_name
  ) values (
    v_reservation.organization_id, v_reservation.product_id, v_reservation.warehouse_id, -v_delta, 'salida_manual',
    v_user_id, coalesce(v_user_name, '—')
  );

  update inventory_reservations set fulfilled_quantity = p_fulfilled_quantity
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, sales_order_id, sales_order_item_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.sales_order_id, v_reservation.sales_order_item_id,
    v_reservation.product_id, v_reservation.warehouse_id,
    'surtida', v_reservation.fulfilled_quantity - v_delta, p_fulfilled_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 9) purchase_requisitions.auto_generated — marcador para que el sync
--    reconcilie SOLO lo que él mismo creó, nunca una requisición armada a
--    mano. Índice único: a lo sumo UNA requisición auto_generated=true en
--    status='draft' por Sales Order a la vez (protección real contra
--    duplicados, no solo el pre-chequeo del propio sync).
-- =========================================================================
alter table purchase_requisitions
  add column if not exists auto_generated boolean not null default false;

create unique index if not exists purchase_requisitions_auto_draft_unique
  on purchase_requisitions (sales_order_id)
  where auto_generated = true and status = 'draft';

-- Línea única por (requisición, partida de origen) — evita que el sync
-- (o cualquier caller) duplique una línea para la misma sales_order_item
-- dentro de la MISMA requisición.
create unique index if not exists purchase_requisition_items_requisition_so_item_unique
  on purchase_requisition_items (purchase_requisition_id, sales_order_item_id);

-- =========================================================================
-- 10) fn_sales_order_item_shortage — solo lectura. Shortage/disponibilidad
--     por sales_order_item, ver DECISIÓN "fórmula de shortage" arriba.
--     SECURITY DEFINER + filtro explícito de organización (mismo criterio
--     que fn_order_product_shortage, 0064) porque necesita leer
--     inventory_movements/product_catalog de forma agregada sin depender
--     de que el caller tenga SELECT directo fila por fila.
-- =========================================================================
create or replace function fn_sales_order_item_shortage(p_sales_order_id uuid)
returns table (
  sales_order_item_id uuid,
  catalog_product_id uuid,
  pending_qty integer,
  on_hand_qty integer,
  reserved_other_qty integer,
  reserved_this_qty integer,
  available_qty integer,
  incoming_qty integer,
  shortage_qty integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from sales_orders where id = p_sales_order_id;
  if v_organization_id is null then
    return;
  end if;

  return query
    with demand as (
      select
        soi.id as item_id,
        soi.position as item_position,
        soi.catalog_product_id as product_id,
        (soi.quantity - coalesce((
          select sum(sfi.quantity_fulfilled)
          from sales_fulfillment_items sfi
          join sales_fulfillments sf on sf.id = sfi.sales_fulfillment_id
          where sfi.sales_order_item_id = soi.id and sf.status <> 'cancelled'
        ), 0))::integer as pending_qty
      from sales_order_items soi
      where soi.sales_order_id = p_sales_order_id and soi.catalog_product_id is not null
    ),
    on_hand as (
      select im.product_id, sum(im.quantity_delta)::integer as qty
      from inventory_movements im
      join warehouses w on w.id = im.warehouse_id
      where im.product_id in (select product_id from demand)
        and w.active = true
        and w.organization_id = v_organization_id
      group by im.product_id
    ),
    reserved_this as (
      select ir.sales_order_item_id as item_id, sum(ir.quantity)::integer as qty
      from inventory_reservations ir
      where ir.sales_order_item_id in (select item_id from demand) and ir.released_at is null
      group by ir.sales_order_item_id
    ),
    reserved_other as (
      select d.item_id, coalesce(sum(ir.quantity), 0)::integer as qty
      from demand d
      join inventory_reservations ir on ir.product_id = d.product_id and ir.released_at is null
      where ir.sales_order_item_id is null or ir.sales_order_item_id <> d.item_id
      group by d.item_id
    ),
    incoming as (
      select i.product_id, i.incoming::integer as qty
      from rpc_inventory_incoming_by_product() i
      where i.product_id in (select product_id from demand)
    )
    select
      d.item_id,
      d.product_id,
      d.pending_qty,
      coalesce(oh.qty, 0) as on_hand_qty,
      coalesce(ro.qty, 0) as reserved_other_qty,
      coalesce(rt.qty, 0) as reserved_this_qty,
      (coalesce(oh.qty, 0) - coalesce(ro.qty, 0) - coalesce(rt.qty, 0))::integer as available_qty,
      coalesce(inc.qty, 0) as incoming_qty,
      greatest(
        d.pending_qty - coalesce(oh.qty, 0) + coalesce(ro.qty, 0) - coalesce(inc.qty, 0),
        0
      )::integer as shortage_qty
    from demand d
    left join on_hand oh on oh.product_id = d.product_id
    left join reserved_this rt on rt.item_id = d.item_id
    left join reserved_other ro on ro.item_id = d.item_id
    left join incoming inc on inc.product_id = d.product_id
    -- Orden determinista por posición de la partida — mismo orden en que
    -- aparece en la Sales Order. rpc_sync_sales_order_procurement itera
    -- este resultado en ESTE orden: ante inventario insuficiente para
    -- cubrir dos partidas del mismo producto, la partida que aparece
    -- PRIMERO en la Sales Order se reserva primero (regla simple,
    -- predecible — no hay ninguna otra señal de prioridad de negocio entre
    -- partidas hermanas).
    order by d.item_position;
end;
$$;

-- =========================================================================
-- 11) rpc_sync_sales_order_procurement — SECURITY DEFINER, único punto de
--     entrada para sincronizar abastecimiento de una Sales Order. Ver
--     DECISIONES "gate financiero" e "idempotencia" arriba.
-- =========================================================================
create or replace function rpc_sync_sales_order_procurement(p_sales_order_id uuid)
returns table (
  sales_order_item_id uuid,
  catalog_product_id uuid,
  pending_qty integer,
  available_qty integer,
  reserved_qty integer,
  shortage_qty integer,
  purchase_requisition_item_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_release_status text;
  v_so_status text;
  v_owner_salesperson_id uuid;
  v_row record;
  v_reservation record;
  v_warehouse record;
  v_current_reserved_total integer;
  v_desired_reserved_total integer;
  v_delta integer;
  v_take integer;
  v_reducible integer;
  v_existing_id uuid;
  v_existing_qty integer;
  v_req_id uuid;
  v_req_item_id uuid;
  v_requisitioned_elsewhere integer;
  v_desired_requisition_qty integer;
  v_so_item sales_order_items;
  v_actual_shortage integer;
begin
  select organization_id, status, fulfillment_release_status, salesperson_id
    into v_organization_id, v_so_status, v_release_status, v_owner_salesperson_id
    from sales_orders where id = p_sales_order_id;
  if v_organization_id is null then
    raise exception 'Sales Order no encontrada: %', p_sales_order_id;
  end if;

  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_owner_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para sincronizar el abastecimiento de esta Sales Order.';
  end if;

  -- GATE FINANCIERO (reutilizado, nunca reimplementado): sin liberación,
  -- no-op total — nada que reservar ni requisitar todavía.
  if v_so_status = 'cancelled' then
    for v_reservation in
      select id from inventory_reservations where sales_order_id = p_sales_order_id and released_at is null
    loop
      perform rpc_release_inventory_reservation(v_reservation.id);
    end loop;

    update purchase_requisitions
      set status = 'cancelled'
      where sales_order_id = p_sales_order_id and auto_generated = true and status = 'draft';

    return;
  end if;

  if v_release_status not in ('released', 'partially_released') then
    return;
  end if;

  select id into v_req_id
    from purchase_requisitions
    where sales_order_id = p_sales_order_id and auto_generated = true and status = 'draft'
    for update;

  for v_row in select * from fn_sales_order_item_shortage(p_sales_order_id)
  loop
    select coalesce(sum(ir.quantity), 0) into v_current_reserved_total
      from inventory_reservations ir
      where ir.sales_order_item_id = v_row.sales_order_item_id and ir.released_at is null;

    v_desired_reserved_total := least(v_row.pending_qty, v_current_reserved_total + greatest(v_row.available_qty, 0));

    if v_desired_reserved_total > v_current_reserved_total then
      v_delta := v_desired_reserved_total - v_current_reserved_total;

      for v_warehouse in
        select w.id as warehouse_id,
               (coalesce(sum(im.quantity_delta), 0) - coalesce((
                 select sum(ir.quantity) from inventory_reservations ir
                 where ir.product_id = v_row.catalog_product_id and ir.warehouse_id = w.id and ir.released_at is null
               ), 0))::integer as free_qty
        from warehouses w
        left join inventory_movements im on im.warehouse_id = w.id and im.product_id = v_row.catalog_product_id
        where w.organization_id = v_organization_id and w.active = true
        group by w.id
        having (coalesce(sum(im.quantity_delta), 0) - coalesce((
                 select sum(ir.quantity) from inventory_reservations ir
                 where ir.product_id = v_row.catalog_product_id and ir.warehouse_id = w.id and ir.released_at is null
               ), 0)) > 0
        order by free_qty desc
      loop
        exit when v_delta <= 0;
        v_take := least(v_delta, v_warehouse.free_qty);

        select ir.id, ir.quantity into v_existing_id, v_existing_qty
          from inventory_reservations ir
          where ir.sales_order_item_id = v_row.sales_order_item_id
            and ir.warehouse_id = v_warehouse.warehouse_id and ir.released_at is null;

        if v_existing_id is not null then
          perform rpc_adjust_inventory_reservation(v_existing_id, v_existing_qty + v_take);
        else
          perform rpc_reserve_inventory(
            gen_random_uuid(), null, v_row.catalog_product_id, v_warehouse.warehouse_id, v_take,
            v_row.sales_order_item_id
          );
        end if;

        v_delta := v_delta - v_take;
      end loop;
    elsif v_desired_reserved_total < v_current_reserved_total then
      v_delta := v_current_reserved_total - v_desired_reserved_total;

      for v_reservation in
        select ir.id, ir.quantity, ir.fulfilled_quantity
          from inventory_reservations ir
          where ir.sales_order_item_id = v_row.sales_order_item_id and ir.released_at is null
          order by ir.created_at desc
      loop
        exit when v_delta <= 0;
        v_reducible := least(v_delta, v_reservation.quantity - v_reservation.fulfilled_quantity);
        if v_reducible <= 0 then
          continue;
        end if;
        if v_reservation.quantity - v_reducible <= 0 then
          perform rpc_release_inventory_reservation(v_reservation.id);
        else
          perform rpc_adjust_inventory_reservation(v_reservation.id, v_reservation.quantity - v_reducible);
        end if;
        v_delta := v_delta - v_reducible;
      end loop;
    end if;

    -- RELECTURA REAL post-reserva — cuando dos partidas de esta MISMA
    -- Sales Order compiten por el mismo producto, fn_sales_order_item_shortage
    -- (una sola llamada, al inicio de esta función) les da a AMBAS una
    -- foto "antes de reservar nada" — la partida que se procesa primero
    -- (orden determinista por posición, ver fn_sales_order_item_shortage)
    -- reclama disponibilidad real que la segunda partida todavía no sabía
    -- que perdería. Se relee v_current_reserved_total (YA es una lectura en
    -- vivo, ver arriba) y se recalcula el shortage real = pendiente menos
    -- lo que esta partida REALMENTE logró reservar — nunca el valor
    -- stale de v_row.shortage_qty — para evitar sub-requisicionar la
    -- partida perdedora.
    select coalesce(sum(ir.quantity), 0) into v_current_reserved_total
      from inventory_reservations ir
      where ir.sales_order_item_id = v_row.sales_order_item_id and ir.released_at is null;
    v_desired_reserved_total := v_current_reserved_total;
    v_actual_shortage := greatest(v_row.pending_qty - v_desired_reserved_total, 0);

    -- PROCUREMENT — reconcilia SOLO la línea auto_generated de esta
    -- sales_order_item, descontando lo YA requisicionado en cualquier
    -- OTRA requisición activa (manual o auto) para no duplicar necesidad.
    select coalesce(sum(pri.quantity_required), 0) into v_requisitioned_elsewhere
      from purchase_requisition_items pri
      join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
      where pri.sales_order_item_id = v_row.sales_order_item_id
        and pr.status <> 'cancelled'
        and (v_req_id is null or pr.id <> v_req_id);

    v_desired_requisition_qty := greatest(v_actual_shortage - v_requisitioned_elsewhere, 0);

    select pri2.id into v_req_item_id
      from purchase_requisition_items pri2
      where pri2.sales_order_item_id = v_row.sales_order_item_id
        and pri2.purchase_requisition_id = v_req_id;

    if v_desired_requisition_qty <= 0 then
      if v_req_item_id is not null then
        delete from purchase_requisition_items where id = v_req_item_id;
        v_req_item_id := null;
      end if;
    else
      if v_req_id is null then
        select * into v_so_item from sales_order_items where id = v_row.sales_order_item_id;
        insert into purchase_requisitions (
          id, organization_id, requisition_number, sequence_number, sales_order_id, status, requested_by, auto_generated
        )
        select
          gen_random_uuid(), v_organization_id, n.requisition_number, n.sequence_number, p_sales_order_id, 'draft', auth.uid(), true
        from fn_next_purchase_requisition_number(v_organization_id, current_date) n
        returning id into v_req_id;

        insert into purchase_requisition_events (purchase_requisition_id, event_type, created_by)
          values (v_req_id, 'created', auth.uid());
      end if;

      select * into v_so_item from sales_order_items where id = v_row.sales_order_item_id;

      if v_req_item_id is not null then
        update purchase_requisition_items
          set quantity_required = v_desired_requisition_qty
          where id = v_req_item_id;
      else
        insert into purchase_requisition_items (
          purchase_requisition_id, sales_order_item_id, catalog_product_id,
          description_snapshot, uom_snapshot, quantity_required, quantity_ordered
        ) values (
          v_req_id, v_row.sales_order_item_id, v_so_item.catalog_product_id,
          coalesce(v_so_item.description_snapshot, v_so_item.sku_snapshot), v_so_item.uom_snapshot,
          v_desired_requisition_qty, 0
        )
        returning id into v_req_item_id;
      end if;
    end if;

    sales_order_item_id := v_row.sales_order_item_id;
    catalog_product_id := v_row.catalog_product_id;
    pending_qty := v_row.pending_qty;
    available_qty := v_row.available_qty;
    reserved_qty := v_desired_reserved_total;
    shortage_qty := v_actual_shortage;
    purchase_requisition_item_id := v_req_item_id;
    return next;
  end loop;

  -- Requisición auto_generated vacía (todo su shortage se resolvió) → se
  -- elimina, mismo criterio de limpieza que purchase_requirements (0064)
  -- cuando shortage llega a 0 y nada está ya asignado.
  if v_req_id is not null and not exists (
    select 1 from purchase_requisition_items where purchase_requisition_id = v_req_id
  ) then
    delete from purchase_requisition_events where purchase_requisition_id = v_req_id;
    delete from purchase_requisitions where id = v_req_id;
  end if;
end;
$$;

commit;
