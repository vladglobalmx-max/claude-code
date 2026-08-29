-- =========================================================================
-- THÖREN — Fase 6R.1B-2A: Autoridad backend de Logística Cross-Sales
-- =========================================================================
-- OBJETIVO: conectar 4 de las 11 capabilities YA sembradas en 0040 (nunca
-- usadas hasta ahora) a la autoridad real de RPC/RLS de Reservas,
-- Fulfillment, Entregas y Recepción de mercancía — para que un usuario
-- logístico (ej. Rodolfo: Logística/Almacén, también con función
-- comercial propia) pueda operar sobre Pedidos de CUALQUIER vendedor sin
-- convertirse en admin ni ganar autoridad comercial general.
--
-- Capabilities conectadas aquí (ninguna nueva — las 4 ya existen en
-- 0040_roles_capabilities.sql):
--   - can_reserve_inventory  -> rpc_reserve_inventory / rpc_adjust_inventory_reservation / rpc_release_inventory_reservation
--   - can_fulfill_inventory  -> rpc_fulfill_inventory_reservation
--   - can_manage_deliveries  -> rpc_create_delivery / rpc_update_delivery_status / rpc_update_delivery_details / delivery_files (INSERT/DELETE)
--   - can_receive_inventory  -> rpc_receive_purchase_order_item ÚNICAMENTE
--
-- =========================================================================
-- DECISIÓN — patrón de cambio: agregar UN OR-branch al guard existente,
-- nunca reescribir la función
-- =========================================================================
-- Cada RPC ya tiene exactamente esta forma (ownership-or-admin):
--   if not current_user_is_admin() and v_order_salesperson_id <> current_user_salesperson_id() then
--     raise exception '...';
--   end if;
-- Se agrega `and not current_user_has_capability('can_x')` a la condición
-- del `if` — la excepción ahora solo dispara si NINGUNA de las tres
-- autoridades aplica (admin, dueño, o capability). Todo el resto de cada
-- función (validaciones de cantidad/almacén/estado, locks `for update`,
-- ledger de eventos, invariantes ON HAND/COMMITTED/AVAILABLE) se preserva
-- carácter por carácter — cero cambios de lógica de negocio. Se usa
-- `create or replace function` sobre la definición VIGENTE de cada una
-- (auditado antes de escribir esta migración — ver DECISIÓN de versión
-- vigente abajo), nunca sobre una definición ya superseded.
--
-- =========================================================================
-- DECISIÓN — versión VIGENTE de cada función (auditoría previa a este
-- cambio, crítica para no reemplazar por una definición obsoleta)
-- =========================================================================
-- rpc_reserve_inventory              -> vigente desde 0037 (nunca redefinida después).
-- rpc_adjust_inventory_reservation   -> VIGENTE es la de 0038 (agrega el
--   tope contra fulfilled_quantity y compara el PENDIENTE, no `quantity` a
--   secas, contra AVAILABLE) — la de 0037 quedó superseded. Este archivo
--   reemplaza la versión de 0038, no la de 0037.
-- rpc_release_inventory_reservation  -> vigente desde 0037 (nunca redefinida después).
-- rpc_fulfill_inventory_reservation  -> vigente desde 0038 (única definición).
-- rpc_create_delivery / rpc_update_delivery_status / rpc_update_delivery_details
--                                     -> vigentes desde 0039 (única definición cada una).
-- rpc_receive_purchase_order_item    -> VIGENTE es la de 0036 (agrega
--   p_warehouse_id y quedó SECURITY DEFINER) — la de 0035 quedó
--   explícitamente reemplazada (`drop function if exists ...(uuid,
--   integer)` en 0036, firma distinta de 3 parámetros). Este archivo
--   reemplaza la versión de 0036.
--
-- =========================================================================
-- DECISIÓN — can_reserve_inventory cubre TODO el ciclo de vida de una
-- reserva (crear/ajustar/liberar), no solo "crear"
-- =========================================================================
-- La descripción de 0040 ("Reservar inventario para pedidos de cualquier
-- vendedor, no solo propios") no distingue crear de ajustar/liberar, y el
-- catálogo de 11 capabilities no tiene una capability separada para cada
-- sub-operación — ajustar/liberar son parte del mismo ciclo operativo que
-- crear la reserva. Consistente con la auditoría 6R.1B-2 ya aprobada.
--
-- =========================================================================
-- DECISIÓN — delivery_files: split de la policy FOR ALL en policies por
-- comando, ampliando ÚNICAMENTE INSERT y DELETE
-- =========================================================================
-- `delivery_files_via_delivery` (0039) era una sola policy `for all` con
-- el mismo `using`/`with check` para SELECT+INSERT+UPDATE+DELETE. Auditado
-- el código real (src/app/(app)/entregas/actions.ts): `attachDeliveryFile`
-- hace INSERT, `removeDeliveryFile` hace DELETE — NINGÚN camino de la
-- aplicación ejecuta UPDATE sobre delivery_files. Por eso se reemplaza por
-- TRES policies separadas:
--   1) delivery_files_select_own_or_admin (SELECT) — mismo `using` de
--      siempre, sin capability. La visibilidad cross-sales YA la cubre la
--      policy SIBLING `delivery_files_select_can_view_all_sales` (0041,
--      intacta, no se toca aquí) — ambas se combinan con OR de forma
--      automática (múltiples policies permisivas del mismo comando).
--   2) delivery_files_insert_own_or_admin_or_logistics (INSERT) — agrega
--      `or current_user_has_capability('can_manage_deliveries')`.
--   3) delivery_files_delete_own_or_admin_or_logistics (DELETE) — mismo
--      OR-branch.
-- Deliberadamente SIN policy de UPDATE — nada en la aplicación la necesita
-- hoy; abrirla sería ampliar autoridad que nadie pidió (ver auditoría
-- 6R.1B-2 §12). Esto es además una reducción incidental de la superficie
-- de escritura previa (la FOR ALL sí permitía UPDATE en RLS aunque ningún
-- código lo usara) — nunca ha sido código muerto usado por nadie.
--
-- =========================================================================
-- DECISIÓN — Storage (storage.objects) NO se toca en esta migración
-- =========================================================================
-- Auditado 0011_users_roles_rls.sql: las policies de escritura de los
-- buckets `order-media`/`order-files` (`order_media_write_authenticated`,
-- `order_media_update_authenticated`, `order_media_delete_authenticated`,
-- y sus equivalentes `order_files_*`) YA son abiertas a cualquier usuario
-- `authenticated` activo, SIN chequeo de ownership/admin/capability desde
-- el diseño original de 0011 (comentario explícito ahí: un usuario podría
-- subir "a ciegas" bajo la carpeta de un pedido ajeno, pero nunca leerlo
-- sin la RLS de la tabla de metadatos correspondiente, y el objeto
-- huérfano no queda referenciado por ningún row real). La única autoridad
-- real sobre evidencia de Entregas vive en `delivery_files` (arriba) — el
-- storage.objects subyacente NUNCA fue el cuello de botella y no requiere
-- ningún cambio para que can_manage_deliveries funcione end-to-end.
--
-- =========================================================================
-- FUERA DE ALCANCE (explícito, ver auditoría 6R.1B-2)
-- =========================================================================
-- can_prepare_purchase_orders / can_approve_purchase_orders: NO se tocan.
-- rpc_create_purchase_order / rpc_update_purchase_order_status /
-- rpc_update_purchase_order_details siguen admin-only, sin cambios. Ningún
-- RLS/RPC de Quotes/Orders comerciales (status, notas, edición de
-- cliente/vendedor/precios/partidas) se toca — el fix de ownership de
-- 6R.1B-1 (canWriteRecord) permanece completamente intacto, ninguna
-- capability logística aparece como OR-branch en ninguna escritura
-- comercial. Ninguna capability nueva se crea — las 4 usadas aquí ya
-- existían en 0040. Ninguna capability se asigna a ningún usuario en esta
-- migración (eso es 6R.1B-2C, con autorización aparte).
-- =========================================================================

begin;

-- =========================================================================
-- 1) rpc_reserve_inventory — agrega can_reserve_inventory al guard.
-- =========================================================================
create or replace function rpc_reserve_inventory(
  p_reservation_id uuid,
  p_order_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity integer
)
returns inventory_reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
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

  select organization_id, salesperson_id into v_order_organization_id, v_order_salesperson_id
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

-- =========================================================================
-- 2) rpc_adjust_inventory_reservation — reemplaza la versión VIGENTE
--    (0038, con el tope de fulfilled_quantity), agrega can_reserve_inventory.
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
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para ajustar esta reserva.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero; usa liberar para quitar la reserva por completo.';
  end if;

  -- THÖREN Fase 6O — no reducir por debajo de lo ya surtido.
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
  -- fulfilled_quantity), no `p_quantity` a secas.
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
-- 3) rpc_release_inventory_reservation — agrega can_reserve_inventory.
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
  v_order_salesperson_id uuid;
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
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_reserve_inventory') then
    raise exception 'No tienes permiso para liberar esta reserva.';
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  update inventory_reservations
    set released_at = clock_timestamp(), released_by_user_id = v_user_id, released_by_name = coalesce(v_user_name, '—')
    where id = v_reservation.id
    returning * into v_reservation;

  insert into inventory_reservation_events (
    reservation_id, organization_id, order_id, product_id, warehouse_id,
    event_type, previous_quantity, new_quantity, changed_by_user_id, changed_by_name
  ) values (
    v_reservation.id, v_reservation.organization_id, v_reservation.order_id, v_reservation.product_id, v_reservation.warehouse_id,
    'liberada', v_reservation.quantity, v_reservation.quantity, v_user_id, coalesce(v_user_name, '—')
  );

  return v_reservation;
end;
$$;

-- =========================================================================
-- 4) rpc_fulfill_inventory_reservation — agrega can_fulfill_inventory.
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
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_fulfill_inventory') then
    raise exception 'No tienes permiso para surtir esta reserva.';
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

-- =========================================================================
-- 5) rpc_create_delivery — agrega can_manage_deliveries.
-- =========================================================================
create or replace function rpc_create_delivery(
  p_delivery_id uuid,
  p_delivery jsonb,
  p_items jsonb default '[]'::jsonb
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_order_id uuid;
  v_order_organization_id uuid;
  v_order_salesperson_id uuid;
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

  select organization_id, salesperson_id into v_order_organization_id, v_order_salesperson_id
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

-- =========================================================================
-- 6) rpc_update_delivery_status — agrega can_manage_deliveries.
-- =========================================================================
create or replace function rpc_update_delivery_status(
  p_delivery_id uuid,
  p_status text
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries;
  v_order_salesperson_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if p_status not in ('programada', 'en_proceso', 'completada', 'cancelada') then
    raise exception '"%" no es un estado válido de entrega.', p_status;
  end if;

  select * into v_delivery from deliveries where id = p_delivery_id;
  if v_delivery.id is null then
    raise exception 'Entrega no encontrada: %', p_delivery_id;
  end if;
  if not is_organization_member(v_delivery.organization_id) then
    raise exception 'Esta entrega no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_delivery.order_id;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_manage_deliveries') then
    raise exception 'No tienes permiso para cambiar el estado de esta entrega.';
  end if;
  if v_delivery.status in ('completada', 'cancelada') then
    raise exception 'Esta entrega ya está en un estado final (%) y no puede cambiar de estado.', v_delivery.status;
  end if;

  update deliveries
    set status = p_status,
        completed_at = case when p_status = 'completada' then clock_timestamp() else completed_at end
    where id = p_delivery_id
    returning * into v_delivery;

  return v_delivery;
end;
$$;

-- =========================================================================
-- 7) rpc_update_delivery_details — agrega can_manage_deliveries.
-- =========================================================================
create or replace function rpc_update_delivery_details(
  p_delivery_id uuid,
  p_delivery jsonb
)
returns deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery deliveries;
  v_order_salesperson_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select * into v_delivery from deliveries where id = p_delivery_id;
  if v_delivery.id is null then
    raise exception 'Entrega no encontrada: %', p_delivery_id;
  end if;
  if not is_organization_member(v_delivery.organization_id) then
    raise exception 'Esta entrega no pertenece a tu organización.';
  end if;
  select salesperson_id into v_order_salesperson_id from orders where id = v_delivery.order_id;
  if not current_user_is_admin()
     and v_order_salesperson_id <> current_user_salesperson_id()
     and not current_user_has_capability('can_manage_deliveries') then
    raise exception 'No tienes permiso para editar esta entrega.';
  end if;
  if v_delivery.status in ('completada', 'cancelada') then
    raise exception 'No se pueden editar los datos de una entrega en estado %.', v_delivery.status;
  end if;

  update deliveries set
    scheduled_date = nullif(p_delivery->>'scheduled_date', '')::date,
    actual_datetime = nullif(p_delivery->>'actual_datetime', '')::timestamptz,
    address = nullif(p_delivery->>'address', ''),
    contact_name = nullif(p_delivery->>'contact_name', ''),
    contact_phone = nullif(p_delivery->>'contact_phone', ''),
    responsible_name = nullif(p_delivery->>'responsible_name', ''),
    installer_name = nullif(p_delivery->>'installer_name', ''),
    installation_datetime = nullif(p_delivery->>'installation_datetime', '')::timestamptz,
    installation_notes = nullif(p_delivery->>'installation_notes', ''),
    notes = nullif(p_delivery->>'notes', ''),
    received_by_name = nullif(p_delivery->>'received_by_name', ''),
    customer_observations = nullif(p_delivery->>'customer_observations', '')
  where id = p_delivery_id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

-- =========================================================================
-- 8) delivery_files — split de la policy FOR ALL en policies por comando
--    (ver DECISIÓN arriba). SELECT sin cambios de autoridad (la
--    visibilidad cross-sales ya la cubre la policy sibling de 0041,
--    intacta). INSERT/DELETE ganan can_manage_deliveries. Sin policy de
--    UPDATE — nada en la aplicación la usa.
-- =========================================================================
drop policy if exists "delivery_files_via_delivery" on delivery_files;

create policy "delivery_files_select_own_or_admin" on delivery_files
  for select using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and (current_user_is_admin() or o.salesperson_id = current_user_salesperson_id())
    )
  );

create policy "delivery_files_insert_own_or_admin_or_logistics" on delivery_files
  for insert with check (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and (
          current_user_is_admin()
          or o.salesperson_id = current_user_salesperson_id()
          or current_user_has_capability('can_manage_deliveries')
        )
    )
  );

create policy "delivery_files_delete_own_or_admin_or_logistics" on delivery_files
  for delete using (
    current_user_active() and exists (
      select 1 from deliveries d
      join orders o on o.id = d.order_id
      where d.id = delivery_files.delivery_id
        and is_organization_member(d.organization_id)
        and (
          current_user_is_admin()
          or o.salesperson_id = current_user_salesperson_id()
          or current_user_has_capability('can_manage_deliveries')
        )
    )
  );

-- =========================================================================
-- 9) rpc_receive_purchase_order_item — reemplaza la versión VIGENTE (0036,
--    con p_warehouse_id). Agrega ÚNICAMENTE can_receive_inventory — nunca
--    can_prepare_purchase_orders ni can_approve_purchase_orders (fuera de
--    alcance, ver DECISIÓN arriba). El resto de la función (validación de
--    status de la OC, cantidades, almacén, movimiento de inventario,
--    recálculo de status de la OC) queda carácter por carácter igual.
-- =========================================================================
create or replace function rpc_receive_purchase_order_item(
  p_purchase_order_item_id uuid,
  p_quantity_received integer,
  p_warehouse_id uuid
)
returns purchase_order_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item purchase_order_items;
  v_po_id uuid;
  v_po_status text;
  v_po_organization_id uuid;
  v_quantity_ordered integer;
  v_previous_received integer;
  v_product_id uuid;
  v_delta integer;
  v_total_items integer;
  v_fully_received_items integer;
  v_any_received_items integer;
  v_existing_warehouse_id uuid;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_movement_type text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() and not current_user_has_capability('can_receive_inventory') then
    raise exception 'Solo un administrador o un usuario con autoridad de recepción de inventario puede registrar recepción de mercancía.';
  end if;

  -- `for update` — evita que dos llamadas concurrentes con el mismo valor
  -- nuevo calculen el mismo delta dos veces (idempotencia real, no solo
  -- "en la práctica").
  select purchase_order_id, quantity_ordered, quantity_received, catalog_product_id
    into v_po_id, v_quantity_ordered, v_previous_received, v_product_id
    from purchase_order_items where id = p_purchase_order_item_id
    for update;
  if v_po_id is null then
    raise exception 'Partida de Purchase Order no encontrada: %', p_purchase_order_item_id;
  end if;

  select status, organization_id into v_po_status, v_po_organization_id from purchase_orders where id = v_po_id;
  if not is_organization_member(v_po_organization_id) then
    raise exception 'Esta Purchase Order no pertenece a tu organización.';
  end if;
  if v_po_status = 'borrador' then
    raise exception 'No se puede registrar recepción de una Purchase Order en borrador — primero debe marcarse como Ordenada.';
  end if;
  if v_po_status = 'cancelada' then
    raise exception 'No se puede registrar recepción de una Purchase Order cancelada.';
  end if;

  if p_quantity_received < 0 or p_quantity_received > v_quantity_ordered then
    raise exception 'La cantidad recibida (%) no puede ser negativa ni mayor a la cantidad ordenada (%).', p_quantity_received, v_quantity_ordered;
  end if;

  -- THÖREN Fase 6M — una línea manual sin catalog_product_id (0029) no
  -- tiene producto de catálogo que rastrear: no genera movimiento.
  if v_product_id is not null then
    if p_warehouse_id is null or not exists (
      select 1 from warehouses where id = p_warehouse_id and organization_id = v_po_organization_id and active = true
    ) then
      raise exception 'Debes seleccionar un almacén activo de tu organización para registrar la recepción.';
    end if;

    select warehouse_id into v_existing_warehouse_id
      from inventory_movements where purchase_order_item_id = p_purchase_order_item_id limit 1;
    if v_existing_warehouse_id is not null and v_existing_warehouse_id <> p_warehouse_id then
      raise exception 'Esta partida ya se recibió en otro almacén; no se puede cambiar el almacén de recepción.';
    end if;

    v_delta := p_quantity_received - v_previous_received;

    if v_delta <> 0 then
      if v_delta < 0 then
        select coalesce(sum(quantity_delta), 0) into v_current_on_hand
          from inventory_movements where product_id = v_product_id and warehouse_id = p_warehouse_id;
        if v_current_on_hand + v_delta < 0 then
          raise exception 'La corrección dejaría On Hand negativo en ese almacén (actual: %, ajuste: %).', v_current_on_hand, v_delta;
        end if;
        v_movement_type := 'correccion_recepcion';
      else
        v_movement_type := 'recepcion_compra';
      end if;

      select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

      insert into inventory_movements (
        organization_id, product_id, warehouse_id, quantity_delta, movement_type,
        purchase_order_id, purchase_order_item_id, created_by_user_id, created_by_name
      ) values (
        v_po_organization_id, v_product_id, p_warehouse_id, v_delta, v_movement_type,
        v_po_id, p_purchase_order_item_id, v_user_id, coalesce(v_user_name, '—')
      );
    end if;
    -- v_delta = 0 (reejecutar la misma recepción) -> ningún movimiento nuevo.
  end if;

  update purchase_order_items set quantity_received = p_quantity_received
    where id = p_purchase_order_item_id
    returning * into v_item;

  select
    count(*),
    count(*) filter (where quantity_received >= quantity_ordered),
    count(*) filter (where quantity_received > 0)
    into v_total_items, v_fully_received_items, v_any_received_items
    from purchase_order_items where purchase_order_id = v_po_id;

  if v_total_items > 0 and v_fully_received_items = v_total_items then
    update purchase_orders set status = 'recibida' where id = v_po_id;
  elsif v_any_received_items > 0 then
    update purchase_orders set status = 'recibida_parcial' where id = v_po_id;
  else
    update purchase_orders set status = pre_receiving_status where id = v_po_id;
  end if;

  return v_item;
end;
$$;

commit;
