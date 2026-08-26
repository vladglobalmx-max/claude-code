-- =========================================================================
-- THÖREN — Fase 6O: Fulfillment / Surtido de Pedidos
-- =========================================================================
-- OBJETIVO: cerrar el ciclo Pedido → Compra → Recepción → Inventario →
-- Reserva → Surtido/Entrega. Surtir consume físicamente una reserva
-- activa: baja ON HAND (vía inventory_movements, igual que cualquier otra
-- salida) y baja COMMITTED por la misma cantidad, dejando AVAILABLE
-- matemáticamente sin cambio. NO se toca Purchasing, recepción de PO, ni
-- el cálculo de INCOMING (0035/0036) — cero cambios ahí.
--
-- =========================================================================
-- DECISIÓN — reutilizar inventory_reservations/inventory_movements, un
-- solo campo nuevo por tabla (mínimo necesario, sin tablas nuevas)
-- =========================================================================
-- `inventory_reservations.quantity` sigue significando exactamente lo
-- mismo que en 6N: el total reservado/comprometido (lo que
-- rpc_reserve_inventory/rpc_adjust_inventory_reservation manejan). Surtir
-- NO modifica `quantity` — se agrega `fulfilled_quantity` (acumulado
-- surtido, 0 <= fulfilled_quantity <= quantity) y COMMITTED pasa a ser
-- `quantity - fulfilled_quantity` (lo que aún falta surtir), no `quantity`
-- a secas. Esto evita conflicts de significado en una sola columna y dos
-- semánticas distintas ("cuánto reservé" vs "cuánto ya entregué"), y deja
-- `inventory_reservations_quantity_check (quantity > 0)` intacto: nunca se
-- pone `quantity` en 0, así que ese CHECK original de 0037 no se toca.
-- `inventory_movements` gana `order_id`/`inventory_reservation_id`
-- (nullable, NULL para todo lo que no sea 'surtido_pedido') — mismo
-- criterio de trazabilidad por FK ya usado para
-- `purchase_order_id`/`purchase_order_item_id` en 0036, nunca un campo de
-- texto libre. No se creó ninguna tabla nueva: el ledger de
-- `inventory_reservation_events` (0037) ya cubre "historial/auditoría de
-- surtidos" con un event_type más ('surtida').
--
-- =========================================================================
-- DECISIÓN — idempotencia: mismo patrón "valor ABSOLUTO + delta interno +
-- for update" que rpc_receive_purchase_order_item (0036) y
-- rpc_adjust_inventory_reservation (0037)
-- =========================================================================
-- `rpc_fulfill_inventory_reservation` recibe `p_fulfilled_quantity` como
-- el acumulado NUEVO (no un delta) — reenviar el mismo valor no genera
-- movimiento ni evento nuevo (idempotente, requisito "no debe existir
-- doble descuento"). El `select ... for update` sobre la reserva bloquea
-- dos llamadas concurrentes con el mismo valor. A diferencia de la
-- recepción de PO (que sí admite corregir hacia abajo con un movimiento
-- compensatorio), surtir NO admite reducir `fulfilled_quantity`: es una
-- salida física ya ejecutada, no una cifra administrativa — una reducción
-- se rechaza explícitamente (si de verdad se necesita revertir un surtido
-- erróneo, el mecanismo existente es un movimiento manual de
-- 'entrada_manual' desde /inventario, ADMIN-only, fuera de esta RPC).
--
-- =========================================================================
-- DECISIÓN — requisito #8: reserva huérfana se libera, pero NO se surtir
-- =========================================================================
-- `rpc_fulfill_inventory_reservation` repite la MISMA validación que
-- `rpc_reserve_inventory` (0037): el producto debe seguir referenciado por
-- `order_items` de ese Pedido. `rpc_release_inventory_reservation` no gana
-- esa validación — una huérfana sigue liberándose con total normalidad.
--
-- =========================================================================
-- DECISIÓN — rpc_adjust_inventory_reservation ahora compara el PENDIENTE,
-- no `quantity` a secas, contra AVAILABLE
-- =========================================================================
-- En 0037, `quantity` y "lo que falta cubrir" eran lo mismo, así que
-- comparar `p_quantity > AVAILABLE` era correcto. Con fulfilled_quantity
-- (6O), una parte de `quantity` ya salió físicamente de ON HAND — seguir
-- comparando `p_quantity` completo contra AVAILABLE rechazaría ajustes
-- legítimos sobre una reserva ya parcialmente surtida. La comparación
-- correcta es `(p_quantity - fulfilled_quantity) > AVAILABLE` — el
-- PENDIENTE nuevo, nunca el total. Detectado escribiendo las pruebas de
-- esta fase.
--
-- =========================================================================
-- FUERA DE ALCANCE de esta migración (ver enunciado completo de la fase)
-- =========================================================================
-- Cambios a Purchasing/recepción de PO/INCOMING, automatización de
-- operational_status, reversión/corrección de surtidos, transferencias
-- entre almacenes, costos/valuación.
-- =========================================================================

begin;

-- =========================================================================
-- 1) inventory_reservations — agrega fulfilled_quantity (acumulado
--    surtido). quantity sigue sin tocarse por el surtido.
-- =========================================================================
alter table inventory_reservations
  add column if not exists fulfilled_quantity integer not null default 0;

alter table inventory_reservations
  drop constraint if exists inventory_reservations_fulfilled_within_bounds;
alter table inventory_reservations
  add constraint inventory_reservations_fulfilled_within_bounds
  check (fulfilled_quantity >= 0 and fulfilled_quantity <= quantity);

-- =========================================================================
-- 2) inventory_reservation_events — agrega 'surtida' como event_type
--    válido. previous_quantity/new_quantity representan, para este tipo,
--    el fulfilled_quantity anterior/nuevo (no `quantity` de la reserva).
-- =========================================================================
alter table inventory_reservation_events
  drop constraint if exists inventory_reservation_events_event_type_check;
alter table inventory_reservation_events
  add constraint inventory_reservation_events_event_type_check
  check (event_type in ('creada', 'aumentada', 'reducida', 'liberada', 'surtida'));

-- =========================================================================
-- 3) inventory_movements — nuevo movement_type 'surtido_pedido' (salida,
--    delta negativo) con referencia a Pedido + reserva (nunca a PO). Las
--    columnas nuevas son NULL para cualquier otro movement_type.
-- =========================================================================
alter table inventory_movements
  add column if not exists order_id uuid references orders (id) on delete restrict,
  add column if not exists inventory_reservation_id uuid references inventory_reservations (id) on delete restrict;

create index if not exists inventory_movements_order_idx on inventory_movements (order_id);
create index if not exists inventory_movements_reservation_idx on inventory_movements (inventory_reservation_id);

alter table inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in (
    'recepcion_compra', 'entrada_manual', 'salida_manual',
    'ajuste_positivo', 'ajuste_negativo', 'correccion_recepcion', 'surtido_pedido'
  ));

alter table inventory_movements
  drop constraint if exists inventory_movements_type_sign;
alter table inventory_movements
  add constraint inventory_movements_type_sign
  check (
    (movement_type in ('entrada_manual', 'ajuste_positivo', 'recepcion_compra') and quantity_delta > 0)
    or
    (movement_type in ('salida_manual', 'ajuste_negativo', 'correccion_recepcion', 'surtido_pedido') and quantity_delta < 0)
  );

-- Reemplaza inventory_movements_po_reference (0036): ahora también rige la
-- referencia a Pedido/reserva de 'surtido_pedido', con el mismo criterio
-- (exactamente los campos de referencia correctos para cada tipo, nunca
-- una mezcla, nunca ambos NULL cuando corresponde).
alter table inventory_movements
  drop constraint if exists inventory_movements_po_reference;
alter table inventory_movements
  drop constraint if exists inventory_movements_reference_by_type;
alter table inventory_movements
  add constraint inventory_movements_reference_by_type
  check (
    (movement_type in ('recepcion_compra', 'correccion_recepcion')
      and purchase_order_id is not null and purchase_order_item_id is not null
      and order_id is null and inventory_reservation_id is null)
    or
    (movement_type = 'surtido_pedido'
      and order_id is not null and inventory_reservation_id is not null
      and purchase_order_id is null and purchase_order_item_id is null)
    or
    (movement_type in ('entrada_manual', 'salida_manual', 'ajuste_positivo', 'ajuste_negativo')
      and purchase_order_id is null and purchase_order_item_id is null
      and order_id is null and inventory_reservation_id is null)
  );

-- =========================================================================
-- 4) rpc_inventory_committed_levels — COMMITTED ahora es lo que FALTA por
--    surtir de cada reserva activa (quantity - fulfilled_quantity), no
--    `quantity` a secas. Mismo nombre/firma/visibilidad que 0037 — se
--    reemplaza, no se duplica.
-- =========================================================================
create or replace function rpc_inventory_committed_levels(p_product_id uuid default null)
returns table (product_id uuid, warehouse_id uuid, committed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid := current_user_organization_id();
begin
  if v_organization_id is null then
    return;
  end if;

  return query
    select ir.product_id, ir.warehouse_id, sum(ir.quantity - ir.fulfilled_quantity)::integer
    from inventory_reservations ir
    where ir.organization_id = v_organization_id
      and ir.released_at is null
      and (p_product_id is null or ir.product_id = p_product_id)
    group by ir.product_id, ir.warehouse_id;
end;
$$;

-- =========================================================================
-- 5) rpc_adjust_inventory_reservation — se reemplaza (misma firma) solo
--    para agregar UNA validación nueva: no se puede reducir `quantity` por
--    debajo de lo ya surtido (violaría fulfilled_quantity <= quantity).
--    Todo lo demás es idéntico a 0037.
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
  v_order_salesperson_id uuid;
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
  select salesperson_id into v_order_salesperson_id from orders where id = v_reservation.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para ajustar esta reserva.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero; usa liberar para quitar la reserva por completo.';
  end if;

  -- THÖREN Fase 6O — nueva validación: no reducir por debajo de lo surtido.
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

  -- THÖREN Fase 6O — se compara el PENDIENTE nuevo (p_quantity -
  -- fulfilled_quantity), no `p_quantity` a secas: la porción ya surtida
  -- de la reserva ya salió físicamente de ON HAND, así que no debe
  -- contarse otra vez contra el disponible actual.
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
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.product_id, v_reservation.warehouse_id,
    v_event_type, v_previous_quantity, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 6) rpc_fulfill_inventory_reservation — surte físicamente una reserva
--    activa: genera un movimiento 'surtido_pedido' (ON HAND baja) y avanza
--    fulfilled_quantity (COMMITTED baja por la misma cantidad, AVAILABLE
--    sin cambio). Nunca permite surtir más de lo reservado, más del ON
--    HAND, ni reducir fulfilled_quantity. Reserva huérfana (producto ya no
--    en las partidas del Pedido) se rechaza — requisito #8.
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
  v_order_salesperson_id uuid;
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
  select salesperson_id into v_order_salesperson_id from orders where id = v_reservation.order_id;
  if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
    raise exception 'No tienes permiso para surtir esta reserva.';
  end if;

  -- Requisito #8: sin partida activa en el Pedido, no se puede surtir
  -- (liberar sigue funcionando vía rpc_release_inventory_reservation).
  if not exists (
    select 1 from order_items
    where order_id = v_reservation.order_id and catalog_product_id = v_reservation.product_id
  ) then
    raise exception 'Esta reserva ya no tiene una partida activa en el Pedido; no se puede surtir (puedes liberarla).';
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
    -- Reenviar el mismo acumulado es idempotente: sin movimiento/evento nuevo.
    return v_reservation;
  end if;

  select coalesce(sum(quantity_delta), 0) into v_current_on_hand
    from inventory_movements
    where product_id = v_reservation.product_id and warehouse_id = v_reservation.warehouse_id;
  if v_current_on_hand - v_delta < 0 then
    raise exception 'La operación dejaría On Hand negativo en ese almacén (actual: %, solicitado: %).', v_current_on_hand, v_delta;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into inventory_movements (
    organization_id, product_id, warehouse_id, quantity_delta, movement_type,
    order_id, inventory_reservation_id, created_by_user_id, created_by_name
  ) values (
    v_reservation.organization_id, v_reservation.product_id, v_reservation.warehouse_id, -v_delta, 'surtido_pedido',
    v_reservation.order_id, v_reservation.id, v_user_id, coalesce(v_user_name, '—')
  );

  update inventory_reservations set fulfilled_quantity = p_fulfilled_quantity
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.product_id, v_reservation.warehouse_id,
    'surtida', p_fulfilled_quantity - v_delta, p_fulfilled_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

commit;
