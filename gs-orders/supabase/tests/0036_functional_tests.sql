-- THÖREN — Fase 6M: Inventory MVP (0036) — pruebas funcionales contra
-- Postgres real. Corre DESPUÉS de: local_harness_setup.sql + migraciones
-- 0001-0036 + fixtures.sql. Todo el script corre en una transacción que se
-- revierte al final — repetible.

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
-- Fixtures: producto de catálogo, Pedido con 1 partida, proveedor, 2
-- almacenes, y una Purchase Order 'ordenada' con esa partida (10
-- unidades) — usados por la mayoría de las pruebas. Además, un producto y
-- un almacén de Org B para las pruebas cross-org.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, active)
  values ('60000000-0000-0000-0000-00000000000b', v_orgb, 'SKU-ORGB', 'Producto Org B', true)
  on conflict (id) do nothing;
  insert into warehouses (id, organization_id, name, code)
  values ('70000000-0000-0000-0000-00000000000b', v_orgb, 'Almacén Org B', 'ALB')
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_product product_catalog;
  v_order_item_id uuid;
  v_supplier suppliers;
  v_warehouse1 warehouses;
  v_warehouse2 warehouses;
  v_po purchase_orders;
  v_po_item_id uuid;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6M', 'quantity', 10, 'unit', 'pza'))
  );
  perform set_config('test.order0036_id', v_order.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6M-001', 'Proyector 6M', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0036_id', v_product.id::text, false);

  -- Reasocia la partida del Pedido de fixture al producto de catálogo real
  -- (el enforcement de catalog_product_id × Business Unit ya está probado
  -- en 0032; esta fase no lo repite).
  update order_items set catalog_product_id = v_product.id where order_id = v_order.id
    returning id into v_order_item_id;
  perform set_config('test.orderitem0036_id', v_order_item_id::text, false);

  insert into suppliers (organization_id, name, active)
  values (v_org1, 'Proveedor 6M', true)
  returning * into v_supplier;
  perform set_config('test.supplier0036_id', v_supplier.id::text, false);

  insert into warehouses (organization_id, name, code, location)
  values (v_org1, 'Almacén Principal', 'ALM-1', 'Monterrey')
  returning * into v_warehouse1;
  perform set_config('test.warehouse0036_id', v_warehouse1.id::text, false);

  insert into warehouses (organization_id, name, code)
  values (v_org1, 'Almacén Secundario', 'ALM-2')
  returning * into v_warehouse2;
  perform set_config('test.warehouse0036b_id', v_warehouse2.id::text, false);

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', v_supplier.id),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 10))
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  select id into v_po_item_id from purchase_order_items where purchase_order_id = v_po.id;
  perform set_config('test.po0036_id', v_po.id::text, false);
  perform set_config('test.poi0036_id', v_po_item_id::text, false);

  raise notice 'SETUP OK: producto %, proveedor %, PO % (ordenada), 2 almacenes creados',
    v_product.id, v_supplier.id, v_po.id;
end $$;

-- =========================================================================
-- TEST 1: warehouses — solo ADMIN puede crear/editar (a diferencia de
-- suppliers/customers). VENDEDOR ve almacenes activos pero no puede
-- escribir.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
  v_count integer;
begin
  select org1 into v_org1 from _ids;

  begin
    insert into warehouses (organization_id, name, code) values (v_org1, 'Intento VENDEDOR', 'VEND-1');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 1 FALLÓ: VENDEDOR no debería poder crear un almacén';
  end if;

  select count(*) into v_count from warehouses where organization_id = v_org1 and active = true;
  if v_count < 2 then
    raise exception 'TEST 1 FALLÓ: VENDEDOR debería poder ver los almacenes activos (encontró %)', v_count;
  end if;

  raise notice 'TEST 1 OK: solo ADMIN crea almacenes; VENDEDOR los ve';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 2: recepción de PO exige almacén válido de la organización.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 4, null);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 2 FALLÓ: se esperaba rechazo sin almacén';
  end if;
  if v_msg not ilike '%almacén%' then
    raise exception 'TEST 2 FALLÓ: mensaje inesperado: %', v_msg;
  end if;

  v_failed := false;
  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 4, '70000000-0000-0000-0000-00000000000b');
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 2 FALLÓ: se esperaba rechazo por almacén de otra organización';
  end if;

  raise notice 'TEST 2 OK: recepción exige almacén válido de la propia organización';
end $$;

-- =========================================================================
-- TEST 3 (ejemplo obligatorio del enunciado): recepción parcial 4 de 10 ->
-- ON HAND +4, INCOMING queda 6.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_on_hand integer;
  v_incoming integer;
  v_movement_count integer;
begin
  perform rpc_receive_purchase_order_item(v_poi_id, 4, v_warehouse_id);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 4 then
    raise exception 'TEST 3 FALLÓ: ON HAND debería ser 4, es %', v_on_hand;
  end if;

  select coalesce(incoming, 0) into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if v_incoming <> 6 then
    raise exception 'TEST 3 FALLÓ: INCOMING debería ser 6, es %', v_incoming;
  end if;

  select count(*) into v_movement_count from inventory_movements where purchase_order_item_id = v_poi_id;
  if v_movement_count <> 1 then
    raise exception 'TEST 3 FALLÓ: debería existir exactamente 1 movimiento, hay %', v_movement_count;
  end if;

  raise notice 'TEST 3 OK: recepción 4/10 -> ON HAND +4, INCOMING 6, 1 movimiento (recepcion_compra)';
end $$;

-- =========================================================================
-- TEST 4 (ejemplo obligatorio): recibido acumulado 4 -> 10: movimiento
-- adicional +6, ON HAND total +10, INCOMING 0.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_on_hand integer;
  v_incoming integer;
  v_movement_count integer;
  v_po_status text;
begin
  perform rpc_receive_purchase_order_item(v_poi_id, 10, v_warehouse_id);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 10 then
    raise exception 'TEST 4 FALLÓ: ON HAND debería ser 10, es %', v_on_hand;
  end if;

  select coalesce(incoming, 0) into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if coalesce(v_incoming, 0) <> 0 then
    raise exception 'TEST 4 FALLÓ: INCOMING debería ser 0, es %', v_incoming;
  end if;

  select count(*) into v_movement_count from inventory_movements where purchase_order_item_id = v_poi_id;
  if v_movement_count <> 2 then
    raise exception 'TEST 4 FALLÓ: debería haber exactamente 2 movimientos (4 y luego +6), hay %', v_movement_count;
  end if;

  select status into v_po_status from purchase_orders where id = current_setting('test.po0036_id')::uuid;
  if v_po_status <> 'recibida' then
    raise exception 'TEST 4 FALLÓ: la PO debería quedar en "recibida", es %', v_po_status;
  end if;

  raise notice 'TEST 4 OK: 4->10 genera movimiento adicional +6, ON HAND 10, INCOMING 0, PO recibida';
end $$;

-- =========================================================================
-- TEST 5 (ejemplo obligatorio): corregir recibido 10 -> 8: movimiento
-- compensatorio -2, ON HAND neto 8, INCOMING vuelve a 2. Los movimientos
-- anteriores NO se borran.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_on_hand integer;
  v_incoming integer;
  v_movement_count integer;
  v_negative_count integer;
  v_po_status text;
begin
  perform rpc_receive_purchase_order_item(v_poi_id, 8, v_warehouse_id);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 8 then
    raise exception 'TEST 5 FALLÓ: ON HAND neto debería ser 8, es %', v_on_hand;
  end if;

  select incoming into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if v_incoming <> 2 then
    raise exception 'TEST 5 FALLÓ: INCOMING debería volver a 2, es %', v_incoming;
  end if;

  select count(*) into v_movement_count from inventory_movements where purchase_order_item_id = v_poi_id;
  if v_movement_count <> 3 then
    raise exception 'TEST 5 FALLÓ: deberían existir 3 movimientos históricos (4, +6, -2), hay %', v_movement_count;
  end if;

  select count(*) into v_negative_count
    from inventory_movements where purchase_order_item_id = v_poi_id and movement_type = 'correccion_recepcion' and quantity_delta = -2;
  if v_negative_count <> 1 then
    raise exception 'TEST 5 FALLÓ: debería existir un movimiento correccion_recepcion de -2';
  end if;

  select status into v_po_status from purchase_orders where id = current_setting('test.po0036_id')::uuid;
  if v_po_status <> 'recibida_parcial' then
    raise exception 'TEST 5 FALLÓ: la PO debería volver a "recibida_parcial", es %', v_po_status;
  end if;

  raise notice 'TEST 5 OK: corrección 10->8 crea movimiento compensatorio -2 (sin borrar historial), ON HAND 8, INCOMING 2, PO recibida_parcial';
end $$;

-- =========================================================================
-- TEST 6 (ejemplo obligatorio): reejecutar la misma recepción (8) NO
-- genera otro movimiento — idempotente.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_movement_count_before integer;
  v_movement_count_after integer;
begin
  select count(*) into v_movement_count_before from inventory_movements where purchase_order_item_id = v_poi_id;
  perform rpc_receive_purchase_order_item(v_poi_id, 8, v_warehouse_id);
  select count(*) into v_movement_count_after from inventory_movements where purchase_order_item_id = v_poi_id;

  if v_movement_count_after <> v_movement_count_before then
    raise exception 'TEST 6 FALLÓ: reejecutar la misma recepción no debería generar movimiento (antes %, después %)',
      v_movement_count_before, v_movement_count_after;
  end if;

  raise notice 'TEST 6 OK: reejecutar la misma recepción es idempotente — sin movimientos duplicados';
end $$;

-- =========================================================================
-- TEST 7: no se puede cambiar el almacén de recepción de una partida ya
-- iniciada.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0036_id')::uuid;
  v_warehouse2_id uuid := current_setting('test.warehouse0036b_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 8, v_warehouse2_id);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se esperaba rechazo al cambiar de almacén';
  end if;
  if v_msg not ilike '%otro almacén%' then
    raise exception 'TEST 7 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 7 OK: el almacén de recepción de una partida queda fijo tras el primer movimiento';
end $$;

-- =========================================================================
-- TEST 8: movimientos manuales — entrada/salida ADMIN, VENDEDOR bloqueado,
-- salida que dejaría ON HAND negativo rechazada, ajustes funcionan.
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_on_hand integer;
  v_movement inventory_movements;
  v_failed boolean := false;
begin
  select * into v_movement from rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 5, 'reference', 'Conteo físico')
  );
  if v_movement.quantity_delta <> 5 then
    raise exception 'TEST 8 FALLÓ: entrada manual debería registrar delta +5';
  end if;

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 13 then
    raise exception 'TEST 8 FALLÓ: ON HAND debería ser 13 (8+5), es %', v_on_hand;
  end if;

  begin
    perform rpc_create_inventory_movement(
      gen_random_uuid(),
      jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'salida_manual', 'quantity', 999)
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 8 FALLÓ: una salida que deja ON HAND negativo debería rechazarse';
  end if;

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'ajuste_negativo', 'quantity', 3)
  );
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  if v_on_hand <> 10 then
    raise exception 'TEST 8 FALLÓ: ON HAND debería ser 10 tras ajuste_negativo de 3, es %', v_on_hand;
  end if;

  raise notice 'TEST 8 OK: entrada/ajuste manual funcionan, salida que deja stock negativo rechazada';
end $$;

select test_set_user(:'vendedor1');
do $$
declare
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_create_inventory_movement(
      gen_random_uuid(),
      jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 1)
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 8b FALLÓ: VENDEDOR no debería poder registrar movimientos manuales';
  end if;
  if v_msg not ilike '%administrador%' then
    raise exception 'TEST 8b FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 8b OK: VENDEDOR bloqueado al crear movimientos manuales';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 9: cross-org — producto/almacén de otra organización rechazados en
-- movimientos manuales.
-- =========================================================================
do $$
declare
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_create_inventory_movement(
      gen_random_uuid(),
      jsonb_build_object(
        'product_id', '60000000-0000-0000-0000-00000000000b', 'warehouse_id', v_warehouse_id,
        'movement_type', 'entrada_manual', 'quantity', 1
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 9 FALLÓ: producto de otra organización debería rechazarse';
  end if;
  raise notice 'TEST 9 OK: cross-org rechazado en movimientos manuales';
end $$;

-- =========================================================================
-- TEST 10: rpc_inventory_incoming_detail — trazabilidad completa (PO,
-- proveedor, Pedido origen, cantidad pendiente).
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_order_id uuid := current_setting('test.order0036_id')::uuid;
  v_po_id uuid := current_setting('test.po0036_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0036_id')::uuid;
  v_detail record;
begin
  select * into v_detail from rpc_inventory_incoming_detail(v_product_id);
  if v_detail.purchase_order_id <> v_po_id or v_detail.order_id <> v_order_id
     or v_detail.supplier_id <> v_supplier_id or v_detail.quantity_pending <> 2 then
    raise exception 'TEST 10 FALLÓ: detalle de incoming incompleto o incorrecto (po=%, order=%, supplier=%, pendiente=%)',
      v_detail.purchase_order_id, v_detail.order_id, v_detail.supplier_id, v_detail.quantity_pending;
  end if;
  raise notice 'TEST 10 OK: rpc_inventory_incoming_detail resuelve PO/proveedor/Pedido origen/cantidad pendiente correctamente';
end $$;

-- =========================================================================
-- TEST 11: VENDEDOR ve el mismo ON HAND/INCOMING que ADMIN (Inventory es
-- de organización, no de Pedido propio) — a diferencia de Purchase Orders.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_product_id uuid := current_setting('test.product0036_id')::uuid;
  v_on_hand integer;
  v_incoming integer;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select incoming into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if v_on_hand <> 10 or v_incoming <> 2 then
    raise exception 'TEST 11 FALLÓ: VENDEDOR2 (no dueño del Pedido) debería ver ON HAND=10/INCOMING=2 igual que ADMIN, vio %/%',
      v_on_hand, v_incoming;
  end if;
  raise notice 'TEST 11 OK: VENDEDOR ve el mismo ON HAND/INCOMING de organización, sin importar de quién es el Pedido origen';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 12: no se puede recibir mercancía de una PO en borrador ni
-- cancelada (regresión del guard de 0035, ahora con almacén incluido).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0036_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0036_id')::uuid;
  v_order_item_id uuid := current_setting('test.orderitem0036_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0036_id')::uuid;
  v_po purchase_orders;
  v_poi purchase_order_items;
  v_failed boolean := false;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 1))
  );
  select * into v_poi from purchase_order_items where purchase_order_id = v_po.id;

  begin
    perform rpc_receive_purchase_order_item(v_poi.id, 1, v_warehouse_id);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 12 FALLÓ: no debería poder recibirse mercancía de una PO en borrador';
  end if;

  perform rpc_update_purchase_order_status(v_po.id, 'cancelada');
  v_failed := false;
  begin
    perform rpc_receive_purchase_order_item(v_poi.id, 1, v_warehouse_id);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 12 FALLÓ: no debería poder recibirse mercancía de una PO cancelada';
  end if;

  raise notice 'TEST 12 OK: recepción sigue bloqueada en borrador/cancelada';
end $$;

select 'TESTS 1-12 (0036 Inventory MVP, Fase 6M) PASARON' as resultado;

rollback;
