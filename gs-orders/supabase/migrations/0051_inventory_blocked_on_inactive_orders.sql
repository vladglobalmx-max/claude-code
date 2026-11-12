-- =========================================================================
-- GS Orders — Migración 0051: no se puede reservar, surtir ni entregar
-- inventario sobre un Pedido en Borrador o Cancelado.
-- =========================================================================
-- HALLAZGO (auditoría de lógica de negocio, #3): `rpc_reserve_inventory`,
-- `rpc_fulfill_inventory_reservation` y `rpc_create_delivery` nunca
-- revisaban `orders.status` — solo validaban organización, dueño,
-- producto/almacén y cantidades. Un pedido en 'borrador' (que sigue
-- siendo libremente editable/borrable) o 'cancelado' podía terminar con
-- stock real comprometido (reservado, surtido — salida física de
-- almacén — o hasta con una Entrega creada) a su nombre.
--
-- Combinado con el hallazgo #2 (ya resuelto en 0049): un pedido cancelado
-- podía seguir teniendo stock real comprometido sin ningún camino claro
-- en la app para revertirlo — el propio equipo de operaciones quedaría
-- con inventario "atorado" detrás de un pedido que, para el negocio, ya no
-- existe.
--
-- Fix: bloquear las 3 operaciones que INICIAN/AUMENTAN compromiso de
-- inventario contra un pedido en 'borrador'/'cancelado', con un mensaje
-- claro. `rpc_release_inventory_reservation` NO se toca — liberar debe
-- seguir funcionando siempre, es exactamente la salida para un pedido que
-- ya se canceló con reservas activas. `rpc_adjust_inventory_reservation`
-- tampoco se toca en esta migración — permite tanto aumentar como reducir
-- una reserva existente; reducir debe seguir abierto igual que liberar.
-- Bloquear solo el aumento ahí queda como deuda técnica menor, fuera del
-- alcance exacto de este hallazgo (que nombra reservar/surtir/entregar,
-- no ajustar) — anotado aquí para no perderlo de vista.
-- =========================================================================
begin;

create or replace function rpc_reserve_inventory(p_reservation_id uuid, p_order_id uuid, p_product_id uuid, p_warehouse_id uuid, p_quantity integer)
returns inventory_reservations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
  v_order_status text;
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

  select organization_id, salesperson_id, status into v_order_organization_id, v_order_salesperson_id, v_order_status
    from orders where id = p_order_id;
  if v_order_organization_id is null then
    raise exception 'Pedido no encontrado: %', p_order_id;
  end if;
  if not is_organization_member(v_order_organization_id) then
    raise exception 'El Pedido no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para reservar inventario sobre este Pedido.';
  end if;
  if v_order_status in ('borrador', 'cancelado') then
    raise exception 'No se puede reservar inventario: el pedido está en estado "%".', v_order_status;
  end if;

  -- Validación de forma (cantidad) antes que las de negocio/pertenencia,
  -- para que un valor inválido siempre se reporte igual sin importar el
  -- producto/almacén elegidos.
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad a reservar debe ser mayor a cero.';
  end if;

  if not exists (
    select 1 from product_catalog where id = p_product_id and organization_id = v_order_organization_id
  ) then
    raise exception 'El producto seleccionado no existe o no pertenece a tu organización.';
  end if;
  if not exists (
    select 1 from order_items where order_id = p_order_id and catalog_product_id = p_product_id
  ) then
    raise exception 'Este producto no forma parte de las partidas de este Pedido.';
  end if;
  if not exists (
    select 1 from warehouses where id = p_warehouse_id and organization_id = v_order_organization_id and active = true
  ) then
    raise exception 'El almacén seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if exists (
    select 1 from inventory_reservations
    where order_id = p_order_id and product_id = p_product_id and released_at is null
  ) then
    raise exception 'Ya existe una reserva activa para este producto en este Pedido; ajústala en vez de crear una nueva.';
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
    id, organization_id, order_id, product_id, warehouse_id, quantity,
    created_by_user_id, created_by_name
  ) values (
    p_reservation_id, v_order_organization_id, p_order_id, p_product_id, p_warehouse_id, p_quantity,
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_row;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_row.id, v_order_organization_id, p_order_id, p_product_id, p_warehouse_id,
    'creada', null, p_quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_row;
end;
$$;

create or replace function rpc_fulfill_inventory_reservation(p_reservation_id uuid, p_fulfilled_quantity integer)
returns inventory_reservations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_reservation inventory_reservations;
  v_order_salesperson_id uuid;
  v_order_status text;
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
  select salesperson_id, status into v_order_salesperson_id, v_order_status from orders where id = v_reservation.order_id;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_fulfill_inventory') then
    raise exception 'No tienes permiso para surtir esta reserva.';
  end if;
  if v_order_status in ('borrador', 'cancelado') then
    raise exception 'No se puede surtir inventario: el pedido está en estado "%".', v_order_status;
  end if;

  -- Requisito #8 (6O): sin partida activa en el Pedido, no se puede surtir
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

create or replace function rpc_create_delivery(p_delivery_id uuid, p_delivery jsonb, p_items jsonb default '[]'::jsonb)
returns deliveries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_organization_id uuid;
  v_order_id uuid;
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
  v_order_status text;
  v_delivery_type text;
  v_sequence_number integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_delivery deliveries;
  v_item jsonb;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_src_model text;
  v_src_description text;
  v_src_unit text;
  v_fulfilled integer;
  v_previously_delivered integer;
  v_available integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();
  v_order_id := nullif(p_delivery->>'order_id', '')::uuid;

  select organization_id, salesperson_id, status into v_order_organization_id, v_order_salesperson_id, v_order_status
    from orders where id = v_order_id;
  if v_order_organization_id is null then
    raise exception 'Pedido no encontrado: %', v_order_id;
  end if;
  if v_order_organization_id <> v_organization_id then
    raise exception 'El Pedido no pertenece a tu organización.';
  end if;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_manage_deliveries') then
    raise exception 'No tienes permiso para crear entregas sobre este Pedido.';
  end if;
  if v_order_status in ('borrador', 'cancelado') then
    raise exception 'No se puede crear una entrega: el pedido está en estado "%".', v_order_status;
  end if;

  v_delivery_type := p_delivery->>'delivery_type';
  if v_delivery_type not in ('entrega', 'instalacion', 'entrega_instalacion') then
    raise exception '"%" no es un tipo de entrega válido.', v_delivery_type;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Una entrega debe incluir al menos una partida.';
  end if;

  -- Bloquea la fila del Pedido como mutex para calcular el siguiente
  -- sequence_number sin colisión entre Entregas concurrentes del mismo
  -- Pedido — ver DECISIÓN "sin folio propio" en 0039.
  perform 1 from orders where id = v_order_id for update;
  select coalesce(max(sequence_number), 0) + 1 into v_sequence_number from deliveries where order_id = v_order_id;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  insert into deliveries (
    id, organization_id, order_id, sequence_number, delivery_type, status,
    scheduled_date, actual_datetime, address, contact_name, contact_phone,
    responsible_name, installer_name, installation_datetime, installation_notes,
    notes, received_by_name, customer_observations,
    created_by_user_id, created_by_name
  ) values (
    p_delivery_id, v_organization_id, v_order_id, v_sequence_number, v_delivery_type, 'programada',
    nullif(p_delivery->>'scheduled_date', '')::date,
    nullif(p_delivery->>'actual_datetime', '')::timestamptz,
    nullif(p_delivery->>'address', ''),
    nullif(p_delivery->>'contact_name', ''),
    nullif(p_delivery->>'contact_phone', ''),
    nullif(p_delivery->>'responsible_name', ''),
    nullif(p_delivery->>'installer_name', ''),
    nullif(p_delivery->>'installation_datetime', '')::timestamptz,
    nullif(p_delivery->>'installation_notes', ''),
    nullif(p_delivery->>'notes', ''),
    nullif(p_delivery->>'received_by_name', ''),
    nullif(p_delivery->>'customer_observations', ''),
    v_user_id, coalesce(v_user_name, '—')
  )
  returning * into v_delivery;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity_delivered', '')::integer;

    if v_catalog_product_id is null then
      raise exception 'Cada partida de la entrega requiere un producto de catálogo.';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad a entregar debe ser mayor a cero.';
    end if;

    select model, description, unit into v_src_model, v_src_description, v_src_unit
      from order_items where order_id = v_order_id and catalog_product_id = v_catalog_product_id
      limit 1;
    if v_src_model is null then
      raise exception 'El producto % no forma parte de las partidas de este Pedido.', v_catalog_product_id;
    end if;

    -- Surtido total = TODAS las reservas del Pedido+producto (activas o
    -- liberadas). Ya entregado = solo Entregas NO canceladas.
    select coalesce(sum(fulfilled_quantity), 0) into v_fulfilled
      from inventory_reservations
      where order_id = v_order_id and product_id = v_catalog_product_id;
    select coalesce(sum(di.quantity_delivered), 0) into v_previously_delivered
      from delivery_items di
      join deliveries d on d.id = di.delivery_id
      where d.order_id = v_order_id and d.status <> 'cancelada' and di.catalog_product_id = v_catalog_product_id;
    v_available := v_fulfilled - v_previously_delivered;

    if v_quantity > v_available then
      raise exception 'No puedes entregar más de lo surtido disponible (surtido: %, ya entregado: %, disponible: %, solicitado: %).',
        v_fulfilled, v_previously_delivered, v_available, v_quantity;
    end if;

    insert into delivery_items (delivery_id, catalog_product_id, model, description, unit, quantity_delivered)
    values (v_delivery.id, v_catalog_product_id, v_src_model, v_src_description, v_src_unit, v_quantity);
  end loop;

  return v_delivery;
end;
$$;

commit;
