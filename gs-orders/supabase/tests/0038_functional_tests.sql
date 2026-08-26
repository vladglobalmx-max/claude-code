-- THÖREN — Fase 6O: Fulfillment / Surtido de Pedidos (0038) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql
-- + migraciones 0001-0038 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible. NO repite regresión de
-- Purchasing/recepción/Incoming (0035/0036) ni de reservas base (0037) —
-- esta fase no tocó esa lógica salvo lo documentado en la migración.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- Fixtures: producto con 80 ON HAND en un almacén, un Pedido de vendedor1
-- con ese producto como partida, y una reserva activa de 30 sobre esa
-- partida (exactamente el ejemplo obligatorio del enunciado: ON HAND 80 /
-- COMMITTED 30 / AVAILABLE 50). Además, producto/almacén de Org B
-- (cross-org).
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, active)
  values ('60000000-0000-0000-0000-00000000002b', v_orgb, 'SKU-ORGB-6O', 'Producto Org B 6O', true)
  on conflict (id) do nothing;
  insert into warehouses (id, organization_id, name, code)
  values ('70000000-0000-0000-0000-00000000002b', v_orgb, 'Almacén Org B 6O', 'ALB-6O')
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_product product_catalog;
  v_warehouse warehouses;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6O', 'quantity', 100, 'unit', 'pza'))
  );
  perform set_config('test.order0038_id', v_order.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6O-001', 'Proyector 6O', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0038_id', v_product.id::text, false);

  update order_items set catalog_product_id = v_product.id where order_id = v_order.id and model = 'PROY-6O';

  insert into warehouses (organization_id, name, code, location)
  values (v_org1, 'Almacén 6O Principal', 'ALM-6O-1', 'Monterrey')
  returning * into v_warehouse;
  perform set_config('test.warehouse0038_id', v_warehouse.id::text, false);

  -- ON HAND 80.
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 80)
  );

  raise notice 'SETUP OK: producto %, Pedido % (ON HAND 80), almacén %', v_product.id, v_order.id, v_warehouse.id;
end $$;

select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0038_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 30
  );
  perform set_config('test.reservation0038_id', v_reservation.id::text, false);
  raise notice 'SETUP OK: reserva % (30) creada — ON HAND 80 / COMMITTED 30 / AVAILABLE 50', v_reservation.id;
end $$;

-- =========================================================================
-- TEST 1 (ejemplo obligatorio parte 1): ON HAND 80 / COMMITTED 30 /
-- AVAILABLE 50. Surtir 20 -> ON HAND 60 / COMMITTED 10 / AVAILABLE 50 /
-- SURTIDO 20.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038_id')::uuid;
  v_on_hand integer;
  v_committed integer;
  v_incoming integer;
  v_fulfilled integer;
  v_movement_count integer;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_on_hand <> 80 or v_committed <> 30 then
    raise exception 'TEST 1 FALLÓ (precondición): esperaba ON HAND=80/COMMITTED=30, vi %/%', v_on_hand, v_committed;
  end if;

  perform rpc_fulfill_inventory_reservation(v_reservation_id, 20);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  select incoming into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  select fulfilled_quantity into v_fulfilled from inventory_reservations where id = v_reservation_id;
  select count(*) into v_movement_count from inventory_movements where inventory_reservation_id = v_reservation_id;

  if v_on_hand <> 60 then raise exception 'TEST 1 FALLÓ: ON HAND debería ser 60, es %', v_on_hand; end if;
  if v_committed <> 10 then raise exception 'TEST 1 FALLÓ: COMMITTED debería ser 10, es %', v_committed; end if;
  if v_on_hand - v_committed <> 50 then raise exception 'TEST 1 FALLÓ: AVAILABLE debería ser 50, es %', v_on_hand - v_committed; end if;
  if v_fulfilled <> 20 then raise exception 'TEST 1 FALLÓ: SURTIDO debería ser 20, es %', v_fulfilled; end if;
  if coalesce(v_incoming, 0) <> 0 then raise exception 'TEST 1 FALLÓ: INCOMING no debe cambiar (esperaba 0, es %)', v_incoming; end if;
  if v_movement_count <> 1 then raise exception 'TEST 1 FALLÓ: debería existir exactamente 1 movimiento de surtido, hay %', v_movement_count; end if;

  raise notice 'TEST 1 OK: surtir 20 -> ON HAND 60 / COMMITTED 10 / AVAILABLE 50 / SURTIDO 20, INCOMING sin cambio';
end $$;

-- =========================================================================
-- TEST 2 (ejemplo obligatorio parte 2): surtir los 10 restantes -> ON HAND
-- 50 / COMMITTED 0 / AVAILABLE 50 / SURTIDO 30.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038_id')::uuid;
  v_on_hand integer;
  v_committed integer;
  v_fulfilled integer;
  v_movement_count integer;
begin
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 30);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  select fulfilled_quantity into v_fulfilled from inventory_reservations where id = v_reservation_id;
  select count(*) into v_movement_count from inventory_movements where inventory_reservation_id = v_reservation_id;

  if v_on_hand <> 50 then raise exception 'TEST 2 FALLÓ: ON HAND debería ser 50, es %', v_on_hand; end if;
  if v_committed <> 0 then raise exception 'TEST 2 FALLÓ: COMMITTED debería ser 0, es %', v_committed; end if;
  if v_on_hand - v_committed <> 50 then raise exception 'TEST 2 FALLÓ: AVAILABLE debería ser 50, es %', v_on_hand - v_committed; end if;
  if v_fulfilled <> 30 then raise exception 'TEST 2 FALLÓ: SURTIDO debería ser 30, es %', v_fulfilled; end if;
  if v_movement_count <> 2 then raise exception 'TEST 2 FALLÓ: deberían existir 2 movimientos de surtido (20 y luego 10), hay %', v_movement_count; end if;

  raise notice 'TEST 2 OK: surtir los 10 restantes -> ON HAND 50 / COMMITTED 0 / AVAILABLE 50 / SURTIDO 30';
end $$;

-- =========================================================================
-- TEST 3: reenviar el mismo acumulado (30) es idempotente — sin
-- movimiento ni evento nuevo (no debe existir doble descuento).
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_movements_before integer;
  v_movements_after integer;
  v_events_before integer;
  v_events_after integer;
begin
  select count(*) into v_movements_before from inventory_movements where inventory_reservation_id = v_reservation_id;
  select count(*) into v_events_before from inventory_reservation_events where reservation_id = v_reservation_id;

  perform rpc_fulfill_inventory_reservation(v_reservation_id, 30);

  select count(*) into v_movements_after from inventory_movements where inventory_reservation_id = v_reservation_id;
  select count(*) into v_events_after from inventory_reservation_events where reservation_id = v_reservation_id;

  if v_movements_after <> v_movements_before or v_events_after <> v_events_before then
    raise exception 'TEST 3 FALLÓ: reenviar el mismo acumulado no debería generar movimiento/evento nuevo (movs %->%, eventos %->%)',
      v_movements_before, v_movements_after, v_events_before, v_events_after;
  end if;
  raise notice 'TEST 3 OK: reenviar el mismo acumulado surtido es idempotente';
end $$;

-- =========================================================================
-- TEST 4 (ledger correcto): inventory_movements referencia Pedido +
-- reserva + usuario, con delta negativo, movement_type 'surtido_pedido' y
-- sin tocar purchase_order_id/purchase_order_item_id; los eventos
-- 'surtida' de inventory_reservation_events registran previous/new
-- (fulfilled_quantity) correctos. Se corre ANTES de reutilizar esta misma
-- reserva en los TEST siguientes, para que la secuencia sea exacta.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_order_id uuid := current_setting('test.order0038_id')::uuid;
  v_movement inventory_movements;
  v_sequence text;
begin
  select * into v_movement from inventory_movements
    where inventory_reservation_id = v_reservation_id and quantity_delta = -20;
  if v_movement.movement_type <> 'surtido_pedido' or v_movement.order_id <> v_order_id
     or v_movement.purchase_order_id is not null or v_movement.purchase_order_item_id is not null
     or v_movement.created_by_user_id is null then
    raise exception 'TEST 4 FALLÓ: movimiento de surtido mal formado';
  end if;

  select string_agg(event_type || ':' || coalesce(previous_quantity::text, 'null') || '->' || new_quantity, ', ' order by changed_at)
    into v_sequence
    from inventory_reservation_events where reservation_id = v_reservation_id and event_type = 'surtida';
  if v_sequence <> 'surtida:0->20, surtida:20->30' then
    raise exception 'TEST 4 FALLÓ: secuencia de eventos de surtido inesperada: %', v_sequence;
  end if;

  raise notice 'TEST 4 OK: ledger de movimientos y eventos de surtido correcto y trazable a Pedido/usuario';
end $$;

-- =========================================================================
-- Fixture B: la reserva del TEST 1-4 ya está 100% surtida (quantity=30,
-- fulfilled=30) pero SIGUE ACTIVA (surtir por completo no libera
-- automáticamente, ver DECISIÓN en 0038) — el índice único parcial por
-- (order_id, product_id) impide crear una SEGUNDA reserva activa para el
-- mismo producto. Se reutiliza la MISMA reserva aumentándola a 50
-- (rpc_adjust_inventory_reservation) para dejar 20 unidades pendientes de
-- surtir — escenario realista de "se necesita más de lo ya entregado".
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
begin
  perform rpc_adjust_inventory_reservation(v_reservation_id, 50);
  raise notice 'SETUP TEST 5+ OK: reserva % aumentada a 50 (30 ya surtidas + 20 pendientes)', v_reservation_id;
end $$;

-- =========================================================================
-- TEST 5 (surtido parcial): surtir 5 de los 20 pendientes -> ON HAND 45 /
-- COMMITTED 15.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038_id')::uuid;
  v_on_hand integer;
  v_committed integer;
begin
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 35);
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_on_hand <> 45 then raise exception 'TEST 5 FALLÓ: ON HAND debería ser 45, es %', v_on_hand; end if;
  if v_committed <> 15 then raise exception 'TEST 5 FALLÓ: COMMITTED debería ser 15 (50-35), es %', v_committed; end if;
  raise notice 'TEST 5 OK: surtido parcial (5 más, total 35 de 50) -> ON HAND 45 / COMMITTED 15';
end $$;

-- =========================================================================
-- TEST 6: rechazo por cantidad superior a lo reservado (51 > 50).
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 51);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 6 FALLÓ: se esperaba rechazo por surtir más de lo reservado'; end if;
  if v_msg not ilike '%reservado%' then raise exception 'TEST 6 FALLÓ: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 6 OK: no se puede surtir más de lo reservado';
end $$;

-- =========================================================================
-- TEST 7 + 8 (aislados en un producto/reserva propios, para no depender de
-- la aritmética de TEST 1-6): un movimiento manual posterior a la reserva
-- puede dejar el ON HAND físico por debajo de lo reservado — surtir debe
-- respetar el ON HAND REAL, nunca solo el tope de lo reservado, y nunca
-- dejarlo negativo.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid;
  v_order_id uuid := current_setting('test.order0038_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0038_id')::uuid;
  v_product product_catalog;
  v_reservation inventory_reservations;
begin
  select org1 into v_org1 from _ids;

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6O-002', 'Producto aislado TEST7-8', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0038c_id', v_product.id::text, false);

  insert into order_items (order_id, model, quantity, catalog_product_id)
  values (v_order_id, 'TEST7-8-6O aislado', 10, v_product.id);

  -- ON HAND 10, reservar el total (10) -> COMMITTED 10, AVAILABLE 0.
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 10)
  );
  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order_id, v_product.id, v_warehouse_id, 10
  );
  perform set_config('test.reservation0038c_id', v_reservation.id::text, false);

  -- Movimiento manual independiente deja el ON HAND real en 5 — la
  -- reserva sigue diciendo "10 pendientes" pero físicamente solo hay 5.
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse_id, 'movement_type', 'salida_manual', 'quantity', 5)
  );

  raise notice 'SETUP TEST 7+8 OK: producto % con ON HAND real 5 pero reserva de 10 pendientes', v_product.id;
end $$;
select test_set_user(:'vendedor1');

do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038c_id')::uuid;
  v_product_id uuid := current_setting('test.product0038c_id')::uuid;
  v_on_hand integer;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 10);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 7 FALLÓ: se esperaba rechazo por surtir más del ON HAND real (reservado 10, ON HAND real 5)'; end if;
  if v_msg not ilike '%negativo%' then raise exception 'TEST 7 FALLÓ: mensaje inesperado: %', v_msg; end if;

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 5 then raise exception 'TEST 7 FALLÓ: el intento rechazado no debe alterar ON HAND (esperaba 5, es %)', v_on_hand; end if;

  raise notice 'TEST 7 OK: no se puede surtir más del ON HAND real aunque esté dentro de lo reservado (reservado 10, ON HAND real 5)';
end $$;

do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038c_id')::uuid;
  v_product_id uuid := current_setting('test.product0038c_id')::uuid;
  v_on_hand integer;
begin
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 5);
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 0 then raise exception 'TEST 8 FALLÓ: ON HAND debería quedar en 0, es %', v_on_hand; end if;
  if v_on_hand < 0 then raise exception 'TEST 8 FALLÓ: ON HAND nunca debería quedar negativo, es %', v_on_hand; end if;
  raise notice 'TEST 8 OK: surtir hasta el ON HAND real disponible funciona; nunca queda negativo';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 9: cross-org — Org B no puede surtir una reserva de Org 1.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 40);
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 9 FALLÓ: Org B no debería poder surtir una reserva de Org 1';
  end if;
  raise notice 'TEST 9 OK: cross-org rechazado al surtir';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 10: permisos propietario/admin — VENDEDOR2 (no dueño del Pedido) no
-- puede surtir; ADMIN sí puede sobre cualquier Pedido de su organización.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 40);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: VENDEDOR2 no debería poder surtir un Pedido ajeno'; end if;
  if v_msg not ilike '%permiso%' then raise exception 'TEST 10 FALLÓ: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 10 OK: VENDEDOR2 bloqueado al surtir un Pedido ajeno';
end $$;
select test_set_user(:'admin');
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038_id')::uuid;
  v_fulfilled integer;
  v_on_hand integer;
begin
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 41);
  select fulfilled_quantity into v_fulfilled from inventory_reservations where id = v_reservation_id;
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_fulfilled <> 41 then raise exception 'TEST 10 FALLÓ: ADMIN debería poder surtir un Pedido ajeno (fulfilled=%)', v_fulfilled; end if;
  if v_on_hand <> 39 then raise exception 'TEST 10 FALLÓ: ON HAND debería ser 39 (45-6), es %', v_on_hand; end if;
  raise notice 'TEST 10 OK: ADMIN surte sobre cualquier Pedido de su organización (fulfilled=41, ON HAND=39)';
end $$;

-- =========================================================================
-- TEST 11: reserva huérfana (producto ya no en las partidas del Pedido) se
-- puede LIBERAR pero NO surtir. Usa un producto/reserva propios para no
-- interferir con el índice único activo de reservation0038.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid;
  v_order_id uuid := current_setting('test.order0038_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0038_id')::uuid;
  v_product product_catalog;
begin
  select org1 into v_org1 from _ids;
  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6O-003', 'Producto aislado TEST11', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0038d_id', v_product.id::text, false);
  insert into order_items (order_id, model, quantity, catalog_product_id)
  values (v_order_id, 'TEST11-6O aislado', 5, v_product.id);
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 5)
  );
end $$;
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0038_id')::uuid;
  v_product_id uuid := current_setting('test.product0038d_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0038_id')::uuid;
  v_reservation inventory_reservations;
  v_failed boolean := false;
  v_msg text;
begin
  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 1
  );

  -- Quita la partida del producto del Pedido (rpc_update_order borra/
  -- reinserta order_items, 0034) -> la reserva queda huérfana. Como
  -- reemplazo se deja una partida SIN catalog_product_id (línea manual) y
  -- ninguna de las anteriores, para desligar completamente el producto.
  perform rpc_update_order(
    v_order_id,
    jsonb_build_object('product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Reemplazo sin catálogo 6O', 'quantity', 1))
  );

  begin
    perform rpc_fulfill_inventory_reservation(v_reservation.id, 1);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 11 FALLÓ: una reserva huérfana no debería poder surtirse'; end if;
  if v_msg not ilike '%partida activa%' then raise exception 'TEST 11 FALLÓ: mensaje inesperado: %', v_msg; end if;

  -- Pero SÍ se puede liberar con total normalidad.
  perform rpc_release_inventory_reservation(v_reservation.id);
  raise notice 'TEST 11 OK: reserva huérfana rechazada al surtir, liberada sin problema';
end $$;

-- =========================================================================
-- TEST 12: rpc_adjust_inventory_reservation no permite reducir `quantity`
-- por debajo de lo ya surtido; ajustar a un valor >= fulfilled_quantity
-- sigue funcionando (comparando el PENDIENTE contra AVAILABLE, no el
-- total — ver DECISIÓN en 0038).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_fulfilled integer;
  v_failed boolean := false;
  v_msg text;
begin
  select fulfilled_quantity into v_fulfilled from inventory_reservations where id = v_reservation_id;
  if v_fulfilled <> 41 then raise exception 'TEST 12 FALLÓ (precondición): esperaba fulfilled=41, es %', v_fulfilled; end if;

  begin
    perform rpc_adjust_inventory_reservation(v_reservation_id, 40);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 12 FALLÓ: no debería poder reducirse la reserva por debajo de lo surtido'; end if;
  if v_msg not ilike '%surtido%' then raise exception 'TEST 12 FALLÓ: mensaje inesperado: %', v_msg; end if;

  -- Ajustar exactamente al valor ya surtido (pendiente nuevo = 0) sigue
  -- funcionando aunque el AVAILABLE actual sea menor que 41.
  perform rpc_adjust_inventory_reservation(v_reservation_id, 41);
  raise notice 'TEST 12 OK: no se puede reducir la reserva por debajo de lo surtido; ajustar al pendiente 0 sigue funcionando';
end $$;

-- =========================================================================
-- TEST 13: idempotencia/concurrencia razonable — un intento rechazado
-- (reducir el acumulado surtido) no toca el ledger; el `for update` sobre
-- la reserva es la misma garantía ya usada en 0036/0037 para llamadas
-- concurrentes con el mismo valor.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0038_id')::uuid;
  v_movements_before integer;
  v_movements_after integer;
  v_failed boolean := false;
begin
  select count(*) into v_movements_before from inventory_movements where inventory_reservation_id = v_reservation_id;
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 25);
  exception when others then v_failed := true; end;
  select count(*) into v_movements_after from inventory_movements where inventory_reservation_id = v_reservation_id;

  if not v_failed then raise exception 'TEST 13 FALLÓ: reducir el acumulado surtido debería rechazarse'; end if;
  if v_movements_after <> v_movements_before then
    raise exception 'TEST 13 FALLÓ: un intento rechazado no debe alterar el ledger (antes %, después %)', v_movements_before, v_movements_after;
  end if;
  raise notice 'TEST 13 OK: intento de reducir el acumulado surtido rechazado sin tocar el ledger';
end $$;

select 'TESTS 1-13 (0038 Fulfillment / Surtido, Fase 6O) PASARON' as resultado;

rollback;
