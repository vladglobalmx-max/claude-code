-- THÖREN — Receiving + Inventory MVP (0070_receiving_inventory_mvp.sql) —
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set recibe_user '00000000-0000-0000-0000-000000000005'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_recibe '00000000-0000-0000-0000-0000000000b5'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p2 '00000000-0000-0000-0000-0000000000d2'
\set sup1 '00000000-0000-0000-0000-0000000000f1'
\set sup_orgb '00000000-0000-0000-0000-0000000000f9'
\set w1 '00000000-0000-0000-0000-000000000071'
\set w2 '00000000-0000-0000-0000-000000000072'
\set w_orgb '00000000-0000-0000-0000-000000000079'

insert into auth.users (id, email) values
  (:'admin', 'admin-70@test.local'),
  (:'recibe_user', 'recibe-70@test.local'),
  (:'admin_orgb', 'admin-orgb-70@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 70', 'test-org-70'),
  (:'org_b', 'Test Org 70B', 'test-org-70b');

-- Bootstrap corre TODAVÍA como superusuario (antes de `set role
-- authenticated`) — mismo criterio que 0067/0068/0069.
insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 70', 'admin', true),
  (:'admin_orgb', 'Admin Org B 70', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 70', 'VT70', true),
  (:'sp_recibe', :'org_a', 'Recibe Placeholder 70', 'RP70', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 70', 'VB70', true);

-- recibe_user: vendedor activo, SIN ser dueño de ningún Pedido/PO propio,
-- SIN can_view_all_sales/can_prepare_purchase_orders — SOLO
-- can_receive_inventory. Representa exactamente el rol al que apunta el
-- GAP encontrado en la auditoría (sección 10 de la migración).
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'recibe_user', 'Recibe User Test 70', 'vendedor', :'sp_recibe', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'recibe_user', 'vendedor', true);

insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'recibe_user', 'can_receive_inventory', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 70', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 70', true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Uno 70', 'SKU-P1-70', 'general', 'pza', true),
  (:'p2', :'org_a', 'Producto Dos 70', 'SKU-P2-70', 'general', 'pza', true);

insert into suppliers (id, organization_id, name, active) values
  (:'sup1', :'org_a', 'Proveedor Uno 70', true),
  (:'sup_orgb', :'org_b', 'Proveedor Org B 70', true);

-- rpc_update_purchase_order_status (0066) exige, para SALIR de 'borrador',
-- que toda partida con catalog_product_id ya tenga snapshot de referencia
-- de proveedor resuelto (rpc_create_purchase_order lo resuelve solo si
-- existe una referencia ACTIVA para el par producto+proveedor) — p1/p2
-- necesitan la suya hacia sup1 para que las POs de este archivo puedan
-- avanzar a 'ordenada'.
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, preferred, active) values
  (:'p1', :'sup1', 'REF-P1-SUP1-70', 'MODEL-P1-SUP1-70', true, true),
  (:'p2', :'sup1', 'REF-P2-SUP1-70', 'MODEL-P2-SUP1-70', true, true);

set role authenticated;
select test_set_user(:'admin');

-- Almacenes: se crean vía RPC/insert normal bajo RLS (ya autenticado como
-- admin) — sirve como TEST 1 en sí mismo (ver más abajo se re-verifica).
insert into warehouses (id, organization_id, name, code, active) values
  (:'w1', :'org_a', 'Almacén Uno 70', 'ALM-70-1', true),
  (:'w2', :'org_a', 'Almacén Dos 70', 'ALM-70-2', true);

select test_set_user(:'admin_orgb');
insert into warehouses (id, organization_id, name, code, active) values
  (:'w_orgb', :'org_b', 'Almacén Org B 70', 'ALM-70B', true);
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Pedidos + Purchase Orders (PO1 ordenada con 2 líneas —
-- catálogo p1 qty 10 + línea libre qty 5 —, PO2 ordenada con p2 qty 20,
-- PO3 ordenada luego CANCELADA, PO4 dejada en borrador).
-- =========================================================================
do $$
declare
  v_order orders;
  v_order_item_a uuid;
  v_order_item_free uuid;
  v_po1 purchase_orders;
  v_poi_a uuid;
  v_poi_free uuid;
  v_order2 orders;
  v_order2_item uuid;
  v_po2 purchase_orders;
  v_poi2 uuid;
  v_order3 orders;
  v_order3_item uuid;
  v_po3 purchase_orders;
  v_order4 orders;
  v_order4_item uuid;
  v_po4 purchase_orders;
begin
  -- Pedido 1 + PO1 (2 líneas: catálogo p1 qty 10, libre qty 5).
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente PO1 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(
      jsonb_build_object('model', 'MODELO-P1-70', 'quantity', 10, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d1'),
      jsonb_build_object('model', 'FREE-70', 'quantity', 5, 'unit', 'pza')
    )
  );
  select id into v_order_item_a from order_items where order_id = v_order.id and model = 'MODELO-P1-70';
  select id into v_order_item_free from order_items where order_id = v_order.id and model = 'FREE-70';

  select * into v_po1 from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_order_item_a, 'quantity_ordered', 10),
      jsonb_build_object('order_item_id', v_order_item_free, 'quantity_ordered', 5)
    )
  );
  perform rpc_update_purchase_order_status(v_po1.id, 'ordenada');
  select id into v_poi_a from purchase_order_items where purchase_order_id = v_po1.id and model = 'MODELO-P1-70';
  select id into v_poi_free from purchase_order_items where purchase_order_id = v_po1.id and model = 'FREE-70';
  perform set_config('test.po1_id', v_po1.id::text, false);
  perform set_config('test.poi_a_id', v_poi_a::text, false);
  perform set_config('test.poi_free_id', v_poi_free::text, false);

  -- Pedido 2 + PO2 (1 línea catálogo p2 qty 20) — usado para el test de
  -- múltiples almacenes independientes.
  select * into v_order2 from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente PO2 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-P2-70', 'quantity', 20, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d2'))
  );
  select id into v_order2_item from order_items where order_id = v_order2.id and model = 'MODELO-P2-70';

  select * into v_po2 from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order2.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order2_item, 'quantity_ordered', 20))
  );
  perform rpc_update_purchase_order_status(v_po2.id, 'ordenada');
  select id into v_poi2 from purchase_order_items where purchase_order_id = v_po2.id and model = 'MODELO-P2-70';
  perform set_config('test.po2_id', v_po2.id::text, false);
  perform set_config('test.poi2_id', v_poi2::text, false);

  -- Pedido 3 + PO3 (catálogo p1 qty 5) -> CANCELADA.
  select * into v_order3 from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente PO3 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-P3-70', 'quantity', 5, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d1'))
  );
  select id into v_order3_item from order_items where order_id = v_order3.id and model = 'MODELO-P3-70';
  select * into v_po3 from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order3.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order3_item, 'quantity_ordered', 5))
  );
  perform rpc_update_purchase_order_status(v_po3.id, 'ordenada');
  perform rpc_update_purchase_order_status(v_po3.id, 'cancelada');
  perform set_config('test.po3_id', v_po3.id::text, false);

  -- Pedido 4 + PO4 (catálogo p1 qty 5) -> se deja en BORRADOR.
  select * into v_order4 from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente PO4 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-P4-70', 'quantity', 5, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d1'))
  );
  select id into v_order4_item from order_items where order_id = v_order4.id and model = 'MODELO-P4-70';
  select * into v_po4 from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order4.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order4_item, 'quantity_ordered', 5))
  );
  perform set_config('test.po4_id', v_po4.id::text, false);
end $$;

select test_set_user(:'admin_orgb');
do $$
declare
  v_order orders;
  v_order_item uuid;
  v_po purchase_orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'order_date', current_date::text, 'client_name', 'Cliente Org B 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c9'),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-ORGB-70', 'quantity', 3, 'unit', 'pza'))
  );
  select id into v_order_item from order_items where order_id = v_order.id;
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f9', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item, 'quantity_ordered', 3))
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  perform set_config('test.po_orgb_id', v_po.id::text, false);
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: crear almacén — ya insertados en fixtures (w1/w2), se verifica
-- aquí que quedaron correctamente creados y visibles.
-- =========================================================================
do $$
declare v_count integer;
begin
  select count(*) into v_count from warehouses where organization_id = '00000000-0000-0000-0000-0000000000a1' and code in ('ALM-70-1', 'ALM-70-2');
  if v_count <> 2 then
    raise exception 'TEST 1 FALLO: se esperaban 2 almacenes creados para org_a, hubo %', v_count;
  end if;
  raise notice 'TEST 1 OK: crear almacén funciona correctamente';
end $$;

-- =========================================================================
-- TEST 2: cross-org warehouse bloqueado — admin de Org A no puede crear un
-- almacén para Org B.
-- =========================================================================
do $$
begin
  begin
    insert into warehouses (organization_id, name, code, active) values ('00000000-0000-0000-0000-0000000000a2', 'Almacén Intruso 70', 'ALM-70-X', true);
    raise exception 'TEST 2 FALLO: no debió poder crear un almacén para otra organización';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 2 OK: cross-org warehouse bloqueado (RLS warehouses_insert_admin)';
end $$;

-- =========================================================================
-- TEST 3: crear recepción draft.
-- =========================================================================
do $$
declare
  v_gr goods_receipts;
begin
  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-000000000081',
    jsonb_build_object('purchase_order_id', current_setting('test.po1_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071', 'supplier_document_number', 'FAC-001'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', current_setting('test.poi_a_id')::uuid, 'quantity_received', 4))
  );
  if v_gr.status <> 'draft' or v_gr.receipt_number is null then
    raise exception 'TEST 3 FALLO: la recepción debió crearse en draft con folio asignado (status=%, folio=%)', v_gr.status, v_gr.receipt_number;
  end if;
  raise notice 'TEST 3 OK: crear recepción draft funciona correctamente (folio %)', v_gr.receipt_number;
end $$;

-- =========================================================================
-- TEST 4: draft no cambia stock.
-- =========================================================================
do $$
declare v_on_hand integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand <> 0 then
    raise exception 'TEST 4 FALLO: una recepción draft NO debe afectar inventario (on_hand esperado 0, fue %)', v_on_hand;
  end if;
  raise notice 'TEST 4 OK: una recepción draft no afecta el inventario';
end $$;

-- =========================================================================
-- TEST 5/6/7: postear aumenta stock, crea movimiento de ledger, y funciona
-- como recepción PARCIAL (4 de 10) — PO1 pasa a recibida_parcial.
-- =========================================================================
do $$
declare
  v_on_hand integer;
  v_movement_count integer;
  v_po purchase_orders;
  v_poi purchase_order_items;
begin
  perform rpc_post_goods_receipt('00000000-0000-0000-0000-000000000081');

  select coalesce(sum(quantity_delta), 0) into v_on_hand from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand <> 4 then
    raise exception 'TEST 5 FALLO: on_hand esperado 4 tras postear, fue %', v_on_hand;
  end if;
  raise notice 'TEST 5 OK: postear una recepción aumenta el stock correctamente (+4)';

  select count(*) into v_movement_count from inventory_movements
    where purchase_order_id = current_setting('test.po1_id')::uuid
      and purchase_order_item_id = current_setting('test.poi_a_id')::uuid
      and movement_type = 'recepcion_compra' and quantity_delta = 4;
  if v_movement_count <> 1 then
    raise exception 'TEST 6 FALLO: se esperaba exactamente 1 movimiento de ledger recepcion_compra de +4, hubo %', v_movement_count;
  end if;
  raise notice 'TEST 6 OK: se crea el movimiento de ledger correcto (recepcion_compra, +4, trazable a PO/partida)';

  select * into v_poi from purchase_order_items where id = current_setting('test.poi_a_id')::uuid;
  select * into v_po from purchase_orders where id = current_setting('test.po1_id')::uuid;
  if v_poi.quantity_received <> 4 or v_po.status <> 'recibida_parcial' then
    raise exception 'TEST 7 FALLO: recepción parcial esperada (quantity_received=4, PO recibida_parcial), fue (%, %)', v_poi.quantity_received, v_po.status;
  end if;
  raise notice 'TEST 7 OK: recepción parcial funciona (4 de 10) — PO pasa a recibida_parcial';
end $$;

-- =========================================================================
-- TEST 8: segunda recepción completa el saldo de LA PARTIDA (6 más, de
-- 10). PO1 tiene una SEGUNDA partida (línea libre, todavía 0 de 5) — el
-- status agregado de la PO sigue siendo recibida_parcial hasta que TODAS
-- sus partidas se completen (eso ocurre en TEST 14) — comportamiento ya
-- existente de rpc_receive_purchase_order_item (0035/0036), reutilizado
-- tal cual, no modificado por 0070.
-- =========================================================================
do $$
declare
  v_gr goods_receipts;
  v_po purchase_orders;
  v_poi purchase_order_items;
begin
  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-000000000082',
    jsonb_build_object('purchase_order_id', current_setting('test.po1_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', current_setting('test.poi_a_id')::uuid, 'quantity_received', 6))
  );
  perform rpc_post_goods_receipt(v_gr.id);

  select * into v_poi from purchase_order_items where id = current_setting('test.poi_a_id')::uuid;
  select * into v_po from purchase_orders where id = current_setting('test.po1_id')::uuid;
  if v_poi.quantity_received <> 10 or v_po.status <> 'recibida_parcial' then
    raise exception 'TEST 8 FALLO: se esperaba saldo completo de la partida (quantity_received=10) y PO aún recibida_parcial (línea libre pendiente), fue (%, %)', v_poi.quantity_received, v_po.status;
  end if;
  raise notice 'TEST 8 OK: la segunda recepción completa el saldo de la partida (10 de 10) — PO sigue recibida_parcial hasta completar TODAS sus partidas';
end $$;

-- =========================================================================
-- TEST 9: over-receipt rechazado — la partida A (PO1) ya está 100%
-- recibida (10 de 10); cualquier intento de recibir más se rechaza, tanto
-- al armar el draft (trigger) como al postear.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_goods_receipt(
      '00000000-0000-0000-0000-000000000083',
      jsonb_build_object('purchase_order_id', current_setting('test.po1_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      jsonb_build_array(jsonb_build_object('purchase_order_item_id', current_setting('test.poi_a_id')::uuid, 'quantity_received', 1))
    );
    raise exception 'TEST 9 FALLO: no debió permitir crear una línea de recepción que exceda lo ordenado';
  exception when others then
    if sqlerrm like 'TEST 9 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 9 OK: over-receipt rechazado (acumulado no puede exceder cantidad ordenada)';
end $$;

-- =========================================================================
-- TEST 10: PO cancelada no puede recibirse.
-- =========================================================================
do $$
declare v_poi_po3 uuid;
begin
  select id into v_poi_po3 from purchase_order_items where purchase_order_id = current_setting('test.po3_id')::uuid;
  begin
    perform rpc_create_goods_receipt(
      '00000000-0000-0000-0000-000000000084',
      jsonb_build_object('purchase_order_id', current_setting('test.po3_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi_po3, 'quantity_received', 1))
    );
    raise exception 'TEST 10 FALLO: no debió permitir crear una recepción contra una PO cancelada';
  exception when others then
    if sqlerrm like 'TEST 10 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 10 OK: una Purchase Order cancelada no puede recibirse';
end $$;

-- =========================================================================
-- TEST 10b (bonus): PO en borrador tampoco puede recibirse (regla 1,
-- consistente con rpc_receive_purchase_order_item ya existente).
-- =========================================================================
do $$
declare v_poi_po4 uuid;
begin
  select id into v_poi_po4 from purchase_order_items where purchase_order_id = current_setting('test.po4_id')::uuid;
  begin
    perform rpc_create_goods_receipt(
      '00000000-0000-0000-0000-000000000085',
      jsonb_build_object('purchase_order_id', current_setting('test.po4_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi_po4, 'quantity_received', 1))
    );
    raise exception 'TEST 10b FALLO: no debió permitir crear una recepción contra una PO todavía en borrador';
  exception when others then
    if sqlerrm like 'TEST 10b FALLO%' then raise; end if;
  end;
  raise notice 'TEST 10b OK: una Purchase Order en borrador tampoco puede recibirse';
end $$;

-- =========================================================================
-- TEST 11: double post rechazado — la recepción 081 ya está posted.
-- =========================================================================
do $$
declare
  v_on_hand_before integer;
  v_on_hand_after integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';

  begin
    perform rpc_post_goods_receipt('00000000-0000-0000-0000-000000000081');
    raise exception 'TEST 11 FALLO: no debió permitir postear dos veces la misma recepción';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  select coalesce(sum(quantity_delta), 0) into v_on_hand_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand_before <> v_on_hand_after then
    raise exception 'TEST 11 FALLO: el segundo POST no debió alterar el inventario (antes % después %)', v_on_hand_before, v_on_hand_after;
  end if;
  raise notice 'TEST 11 OK: doble POST rechazado — idempotente respecto al inventario (nunca se duplica)';
end $$;

-- =========================================================================
-- TEST 12: posted inmutable — no se puede editar/cancelar/borrar líneas de
-- una recepción ya posteada.
-- =========================================================================
do $$
begin
  begin
    perform rpc_update_goods_receipt(
      '00000000-0000-0000-0000-000000000081',
      jsonb_build_object('purchase_order_id', current_setting('test.po1_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071', 'notes', 'intento de editar'),
      '[]'::jsonb
    );
    raise exception 'TEST 12 FALLO: no debió permitir editar una recepción ya posteada';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_cancel_goods_receipt('00000000-0000-0000-0000-000000000081');
    raise exception 'TEST 12 FALLO: no debió permitir cancelar una recepción ya posteada';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  begin
    update goods_receipt_items set quantity_received = 999 where goods_receipt_id = '00000000-0000-0000-0000-000000000081';
    raise exception 'TEST 12 FALLO: no debió permitir modificar directamente una línea de recepción posteada';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 12 OK: una recepción posted es inmutable (ni editar encabezado, ni cancelar, ni tocar sus líneas)';
end $$;

-- =========================================================================
-- TEST 13: rollback conserva balances y recepción si falla A MITAD DEL
-- POST -- una recepción con 2 líneas (2 productos/partidas distintas de
-- una PO dedicada): ambas líneas son individualmente válidas al armar el
-- draft, pero MIENTRAS sigue en draft otra recepción agota una de las dos
-- partidas -- al postear, una línea se procesa con éxito (mueve
-- inventario) y la otra falla por over-receipt; TODA la transacción debe
-- revertirse, incluidos los efectos YA aplicados de la línea válida.
-- =========================================================================
do $$
declare
  v_order orders;
  v_item1 uuid; v_item2 uuid;
  v_po purchase_orders;
  v_poi1 uuid; v_poi2 uuid;
  v_gr_drain goods_receipts;
  v_gr_rb goods_receipts;
  v_on_hand_p1_before integer; v_on_hand_p1_after integer;
  v_on_hand_p2_before integer; v_on_hand_p2_after integer;
  v_poi1_received_before integer; v_poi1_received_after integer;
  v_poi2_received_before integer; v_poi2_received_after integer;
  v_gr_rb_status text;
begin
  -- PO dedicada con 2 partidas: rb1 (p1, ordenado 6) y rb2 (p2, ordenado 5).
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente Rollback 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(
      jsonb_build_object('model', 'MODELO-RB1-70', 'quantity', 6, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d1'),
      jsonb_build_object('model', 'MODELO-RB2-70', 'quantity', 5, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d2')
    )
  );
  select id into v_item1 from order_items where order_id = v_order.id and model = 'MODELO-RB1-70';
  select id into v_item2 from order_items where order_id = v_order.id and model = 'MODELO-RB2-70';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item1, 'quantity_ordered', 6),
      jsonb_build_object('order_item_id', v_item2, 'quantity_ordered', 5)
    )
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  select id into v_poi1 from purchase_order_items where purchase_order_id = v_po.id and model = 'MODELO-RB1-70';
  select id into v_poi2 from purchase_order_items where purchase_order_id = v_po.id and model = 'MODELO-RB2-70';

  -- Recepción R_rb en DRAFT con AMBAS líneas al 100% -- individualmente
  -- válidas en este momento (nada se ha recibido todavía para ninguna).
  select * into v_gr_rb from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-000000000090',
    jsonb_build_object('purchase_order_id', v_po.id, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(
      jsonb_build_object('purchase_order_item_id', v_poi1, 'quantity_received', 6),
      jsonb_build_object('purchase_order_item_id', v_poi2, 'quantity_received', 5)
    )
  );

  -- MIENTRAS R_rb sigue en draft, otra recepción (R_drain) agota rb2 por
  -- completo (5 de 5) -- R_rb ya NO puede postearse tal cual quedó armada.
  select * into v_gr_drain from rpc_create_goods_receipt(
    gen_random_uuid(),
    jsonb_build_object('purchase_order_id', v_po.id, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi2, 'quantity_received', 5))
  );
  perform rpc_post_goods_receipt(v_gr_drain.id);

  select coalesce(sum(quantity_delta), 0) into v_on_hand_p1_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(quantity_delta), 0) into v_on_hand_p2_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d2' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select quantity_received into v_poi1_received_before from purchase_order_items where id = v_poi1;
  select quantity_received into v_poi2_received_before from purchase_order_items where id = v_poi2;

  -- Postear R_rb ahora: una de sus 2 líneas (rb2) fallará por over-receipt
  -- (5 ya recibidos + 5 de esta línea > 5 ordenados) -- sin importar cuál
  -- de las 2 líneas procese primero el loop, TODA la transacción debe
  -- revertirse, incluidos los efectos YA aplicados de la línea válida.
  begin
    perform rpc_post_goods_receipt('00000000-0000-0000-0000-000000000090');
    raise exception 'TEST 13 FALLO: no debió permitir postear una recepción con una línea que excede lo ordenado';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  select coalesce(sum(quantity_delta), 0) into v_on_hand_p1_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(quantity_delta), 0) into v_on_hand_p2_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d2' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select quantity_received into v_poi1_received_after from purchase_order_items where id = v_poi1;
  select quantity_received into v_poi2_received_after from purchase_order_items where id = v_poi2;
  select status into v_gr_rb_status from goods_receipts where id = '00000000-0000-0000-0000-000000000090';

  if v_on_hand_p1_before <> v_on_hand_p1_after or v_on_hand_p2_before <> v_on_hand_p2_after then
    raise exception 'TEST 13 FALLO: el on_hand debió quedar exactamente igual tras el POST fallido (p1 % -> %, p2 % -> %)',
      v_on_hand_p1_before, v_on_hand_p1_after, v_on_hand_p2_before, v_on_hand_p2_after;
  end if;
  if v_poi1_received_before <> v_poi1_received_after or v_poi2_received_before <> v_poi2_received_after then
    raise exception 'TEST 13 FALLO: quantity_received de las partidas debió quedar exactamente igual (rb1 % -> %, rb2 % -> %)',
      v_poi1_received_before, v_poi1_received_after, v_poi2_received_before, v_poi2_received_after;
  end if;
  if v_gr_rb_status <> 'draft' then
    raise exception 'TEST 13 FALLO: la recepción rechazada debió permanecer en draft (intacta), quedó en %', v_gr_rb_status;
  end if;

  raise notice 'TEST 13 OK: rollback completo al fallar a mitad del POST -- ni el balance ni la partida ya procesada en el loop quedan alterados, y la recepción permanece en draft';
end $$;

-- =========================================================================
-- TEST 14: línea libre no crea inventory balance — la partida libre de
-- PO1 (FREE-70, sin catalog_product_id) se recibe completa (5 de 5) y
-- actualiza quantity_received, pero NUNCA genera un inventory_movement.
-- =========================================================================
do $$
declare
  v_gr goods_receipts;
  v_poi purchase_order_items;
  v_movement_count integer;
begin
  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-000000000088',
    jsonb_build_object('purchase_order_id', current_setting('test.po1_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', current_setting('test.poi_free_id')::uuid, 'quantity_received', 5))
  );
  perform rpc_post_goods_receipt(v_gr.id);

  select * into v_poi from purchase_order_items where id = current_setting('test.poi_free_id')::uuid;
  if v_poi.quantity_received <> 5 then
    raise exception 'TEST 14 FALLO: la línea libre debió registrar quantity_received=5, fue %', v_poi.quantity_received;
  end if;

  select count(*) into v_movement_count from inventory_movements where purchase_order_item_id = current_setting('test.poi_free_id')::uuid;
  if v_movement_count <> 0 then
    raise exception 'TEST 14 FALLO: una línea libre (sin catalog_product_id) NUNCA debe generar inventory_movements, se encontraron %', v_movement_count;
  end if;

  -- Con la línea libre ahora también completa (5 de 5) y la partida de
  -- catálogo ya completa desde TEST 8, TODAS las partidas de PO1 están
  -- cubiertas — el status agregado por fin pasa a 'recibida' (confirma que
  -- el gap dejado abierto en TEST 8 se cierra correctamente).
  if (select status from purchase_orders where id = current_setting('test.po1_id')::uuid) <> 'recibida' then
    raise exception 'TEST 14 FALLO: con AMBAS partidas de PO1 completas, el status agregado debió pasar a recibida, fue %',
      (select status from purchase_orders where id = current_setting('test.po1_id')::uuid);
  end if;

  raise notice 'TEST 14 OK: una línea libre de PO se recibe operativamente sin generar stock de inventario, y al completarse junto con el resto, PO1 pasa a recibida';
end $$;

-- =========================================================================
-- TEST 15: múltiples almacenes mantienen balances independientes —
-- producto p1 ya tiene 10 en w1 (TEST 5-8); se recibe una PO adicional del
-- mismo producto hacia w2 y se confirma que los balances NO se mezclan.
-- =========================================================================
do $$
declare
  v_order orders;
  v_order_item uuid;
  v_po purchase_orders;
  v_poi uuid;
  v_gr goods_receipts;
  v_on_hand_w1 integer;
  v_on_hand_w2 integer;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente W2 70', 'product_type', 'otro', 'customer_id', '00000000-0000-0000-0000-0000000000c1'),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-W2-70', 'quantity', 3, 'unit', 'pza', 'catalog_product_id', '00000000-0000-0000-0000-0000000000d1'))
  );
  select id into v_order_item from order_items where order_id = v_order.id;
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item, 'quantity_ordered', 3))
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  select id into v_poi from purchase_order_items where purchase_order_id = v_po.id;

  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-000000000089',
    jsonb_build_object('purchase_order_id', v_po.id, 'warehouse_id', '00000000-0000-0000-0000-000000000072'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi, 'quantity_received', 3))
  );
  perform rpc_post_goods_receipt(v_gr.id);

  select coalesce(sum(quantity_delta), 0) into v_on_hand_w1 from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(quantity_delta), 0) into v_on_hand_w2 from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000072';

  if v_on_hand_w1 <> 10 or v_on_hand_w2 <> 3 then
    raise exception 'TEST 15 FALLO: balances independientes esperados (w1=10, w2=3), fueron (w1=%, w2=%)', v_on_hand_w1, v_on_hand_w2;
  end if;
  raise notice 'TEST 15 OK: múltiples almacenes mantienen balances independientes para el mismo producto (w1=10, w2=3)';
end $$;

-- =========================================================================
-- TEST 16: cross-org receipt bloqueado — admin de Org B no puede crear una
-- recepción contra una PO de Org A (ni verla).
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb

  begin
    perform rpc_create_goods_receipt(
      gen_random_uuid(),
      jsonb_build_object('purchase_order_id', current_setting('test.po2_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000079'),
      '[]'::jsonb
    );
    raise exception 'TEST 16 FALLO: no debió poder crear una recepción contra una PO de otra organización';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001'); -- admin org_a
  raise notice 'TEST 16 OK: cross-org receipt bloqueado (la PO de Org A no es visible/aceptable para Org B)';
end $$;

-- =========================================================================
-- TEST 17: RLS correcto — admin de Org B no ve recepciones/líneas/eventos
-- de Org A.
-- =========================================================================
do $$
declare
  v_count_gr integer;
  v_count_items integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_count_gr from goods_receipts where id = '00000000-0000-0000-0000-000000000081';
  select count(*) into v_count_items from goods_receipt_items where goods_receipt_id = '00000000-0000-0000-0000-000000000081';
  select count(*) into v_count_events from goods_receipt_events where goods_receipt_id = '00000000-0000-0000-0000-000000000081';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_gr <> 0 or v_count_items <> 0 or v_count_events <> 0 then
    raise exception 'TEST 17 FALLO: admin de Org B pudo ver datos de una recepción de Org A (%/%/%)', v_count_gr, v_count_items, v_count_events;
  end if;
  raise notice 'TEST 17 OK: aislamiento cross-org respetado por goods_receipts/items/events';
end $$;

-- =========================================================================
-- TEST 18 (SECURITY DEFINER audit): fn_next_goods_receipt_number rechaza
-- generar un folio para una organización ajena — mismo patrón ya probado
-- y seguro de fn_next_purchase_order_folio/fn_next_purchase_requisition_number.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  begin
    perform fn_next_goods_receipt_number('00000000-0000-0000-0000-0000000000a1', current_date);
    raise exception 'TEST 18 FALLO: no debió poder generar un folio de recepción para otra organización';
  exception when others then
    if sqlerrm like 'TEST 18 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 18 OK: fn_next_goods_receipt_number (SECURITY DEFINER) rechaza generar folios de otra organización';
end $$;

-- =========================================================================
-- TEST 19 (bonus, GAP de visibilidad corregido en esta migración):
-- recibe_user (SOLO can_receive_inventory, NO admin, NO dueño del Pedido,
-- SIN can_view_all_sales/can_prepare_purchase_orders) puede VER y CREAR
-- una recepción contra PO2 — antes de esta migración, purchase_orders_select
-- no tenía ninguna rama para can_receive_inventory y esto habría fallado
-- con "no existe o no es visible".
-- =========================================================================
do $$
declare
  v_gr goods_receipts;
  v_visible_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000005'); -- recibe_user

  select count(*) into v_visible_count from purchase_orders where id = current_setting('test.po2_id')::uuid;
  if v_visible_count <> 1 then
    raise exception 'TEST 19 FALLO: recibe_user (can_receive_inventory) debió poder VER la Purchase Order, no la vio';
  end if;

  select * into v_gr from rpc_create_goods_receipt(
    gen_random_uuid(),
    jsonb_build_object('purchase_order_id', current_setting('test.po2_id')::uuid, 'warehouse_id', '00000000-0000-0000-0000-000000000072'),
    '[]'::jsonb
  );
  if v_gr.id is null then
    raise exception 'TEST 19 FALLO: recibe_user debió poder crear una recepción (draft) contra una PO que no le pertenece comercialmente';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 19 OK: un usuario con SOLO can_receive_inventory puede ver y recibir contra cualquier PO de su organización (gap de visibilidad corregido)';
end $$;

select 'TODAS LAS PRUEBAS 0070 PASARON' as resultado;

rollback;
