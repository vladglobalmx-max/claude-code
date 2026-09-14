-- THÖREN — Fulfillment / Picking / Delivery MVP (0071_sales_fulfillment_mvp.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set fulfill_user '00000000-0000-0000-0000-000000000006'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_fulfill '00000000-0000-0000-0000-0000000000b6'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p2 '00000000-0000-0000-0000-0000000000d2'
\set w1 '00000000-0000-0000-0000-000000000071'
\set w2 '00000000-0000-0000-0000-000000000072'
\set w_orgb '00000000-0000-0000-0000-000000000079'

insert into auth.users (id, email) values
  (:'admin', 'admin-71@test.local'),
  (:'fulfill_user', 'fulfill-71@test.local'),
  (:'admin_orgb', 'admin-orgb-71@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 71', 'test-org-71'),
  (:'org_b', 'Test Org 71B', 'test-org-71b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 71', 'admin', true),
  (:'admin_orgb', 'Admin Org B 71', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 71', 'VT71', true),
  (:'sp_fulfill', :'org_a', 'Fulfill Placeholder 71', 'FP71', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 71', 'VB71', true);

-- fulfill_user: vendedor activo, SIN ser dueño de ninguna Sales Order,
-- SOLO can_manage_sales_fulfillment. Representa el rol de logística al que
-- apunta el ticket ("usuarios autorizados de almacén/logística").
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'fulfill_user', 'Fulfill User Test 71', 'vendedor', :'sp_fulfill', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'fulfill_user', 'vendedor', true);

insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'fulfill_user', 'can_manage_sales_fulfillment', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 71', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 71', true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Uno 71', 'SKU-P1-71', 'general', 'pza', true),
  (:'p2', :'org_a', 'Producto Bajo Stock 71', 'SKU-P2-71', 'general', 'pza', true);

set role authenticated;
select test_set_user(:'admin');

insert into warehouses (id, organization_id, name, code, active) values
  (:'w1', :'org_a', 'Almacén Uno 71', 'ALM-71-1', true),
  (:'w2', :'org_a', 'Almacén Dos 71', 'ALM-71-2', true);

select test_set_user(:'admin_orgb');
insert into warehouses (id, organization_id, name, code, active) values
  (:'w_orgb', :'org_b', 'Almacén Org B 71', 'ALM-71B', true);
select test_set_user(:'admin');

-- Stock inicial: p1 con 20 en w1 y 5 en w2 (para TEST 18, almacenes
-- independientes). p2 con SOLO 3 en w1 (para TEST 8/9, stock insuficiente).
select rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
  'product_id', '00000000-0000-0000-0000-0000000000d1', 'warehouse_id', '00000000-0000-0000-0000-000000000071',
  'movement_type', 'entrada_manual', 'quantity', 20
));
select rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
  'product_id', '00000000-0000-0000-0000-0000000000d1', 'warehouse_id', '00000000-0000-0000-0000-000000000072',
  'movement_type', 'entrada_manual', 'quantity', 5
));
select rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
  'product_id', '00000000-0000-0000-0000-0000000000d2', 'warehouse_id', '00000000-0000-0000-0000-000000000071',
  'movement_type', 'entrada_manual', 'quantity', 3
));

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Sales Orders (draft / blocked / released) + org B — mismo
-- patrón exacto que 0069.
-- =========================================================================
do $$
begin
  -- SO_DRAFT (e1): nunca se confirma.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 3, 'unit_price', 100.00))
  );

  -- SO_BLOCKED (e2): confirmada, contado, SIN pago -> queda blocked.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');

  -- SO_RELEASED (e3): confirmada, contado, pago completo -> released.
  -- 2 líneas: A (catálogo p1, qty 10) y B (línea libre, qty 5).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 10, 'unit_price', 100.00),
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-71', 'quantity', 5, 'unit_price', 50.00)
    )
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 1250.00);

  -- SO_LOWSTOCK (e4): confirmada, pagada, línea de p2 (solo 3 en stock) qty 5.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d2', 'quantity', 5, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e4', 500.00);
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-ORGB-71', 'quantity', 1, 'unit_price', 10.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e9', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e9', 10.00);
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- Resuelve los sales_order_item_id reales de SO_RELEASED (A=catálogo p1, B=línea libre).
select id as item_a into temporary temp_item_a from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e3' and catalog_product_id = '00000000-0000-0000-0000-0000000000d1';
select id as item_b into temporary temp_item_b from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e3' and catalog_product_id is null;

-- =========================================================================
-- TEST 1: SO draft no puede crear fulfillment.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_fulfillment(
      gen_random_uuid(),
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e1', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      '[]'::jsonb
    );
    raise exception 'TEST 1 FALLO: no debió poder crear un surtido de una Sales Order en draft';
  exception when others then
    if sqlerrm like 'TEST 1 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 1 OK: SO draft no puede crear fulfillment';
end $$;

-- =========================================================================
-- TEST 2: SO bloqueada financieramente no puede crear fulfillment.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_fulfillment(
      gen_random_uuid(),
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e2', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      '[]'::jsonb
    );
    raise exception 'TEST 2 FALLO: no debió poder crear un surtido de una Sales Order bloqueada financieramente';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 2 OK: SO bloqueada financieramente no puede crear fulfillment';
end $$;

-- =========================================================================
-- TEST 3: SO released SÍ puede — crea el primer fulfillment (item A, 4 de 10).
-- =========================================================================
do $$
declare
  v_sf sales_fulfillments;
begin
  select * into v_sf from rpc_create_sales_fulfillment(
    '00000000-0000-0000-0000-0000000000a1',
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_requested', 4))
  );
  if v_sf.status <> 'draft' or v_sf.fulfillment_number is null then
    raise exception 'TEST 3 FALLO: el surtido debió crearse en draft con folio asignado (status=%, folio=%)', v_sf.status, v_sf.fulfillment_number;
  end if;
  raise notice 'TEST 3 OK: SO released SÍ puede crear fulfillment (folio %)', v_sf.fulfillment_number;
end $$;

-- =========================================================================
-- TEST 4: cross-org bloqueado — admin de Org A no puede crear un surtido
-- para una Sales Order de Org B.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_fulfillment(
      gen_random_uuid(),
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e9', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      '[]'::jsonb
    );
    raise exception 'TEST 4 FALLO: no debió poder crear un surtido para una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 4 OK: cross-org bloqueado al crear fulfillment';
end $$;

-- =========================================================================
-- TEST 5: draft no afecta inventario.
-- =========================================================================
do $$
declare v_on_hand integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand <> 20 then
    raise exception 'TEST 5 FALLO: un fulfillment draft NO debe afectar inventario (on_hand esperado 20, fue %)', v_on_hand;
  end if;
  raise notice 'TEST 5 OK: un fulfillment draft no afecta el inventario';
end $$;

-- =========================================================================
-- TEST 6/7: preparar + despachar reduce stock y crea el movimiento OUT
-- correcto (surtido_venta, -4).
-- =========================================================================
do $$
declare
  v_on_hand integer;
  v_movement_count integer;
  v_poi purchase_order_items%rowtype; -- unused placeholder type avoidance
begin
  perform rpc_mark_sales_fulfillment_ready('00000000-0000-0000-0000-0000000000a1');
  perform rpc_dispatch_sales_fulfillment('00000000-0000-0000-0000-0000000000a1');

  select coalesce(sum(quantity_delta), 0) into v_on_hand from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand <> 16 then
    raise exception 'TEST 6 FALLO: on_hand esperado 16 (20-4) tras despachar, fue %', v_on_hand;
  end if;
  raise notice 'TEST 6 OK: despachar un surtido reduce el stock correctamente (-4)';

  select count(*) into v_movement_count from inventory_movements
    where sales_fulfillment_id = '00000000-0000-0000-0000-0000000000a1'
      and movement_type = 'surtido_venta' and quantity_delta = -4;
  if v_movement_count <> 1 then
    raise exception 'TEST 7 FALLO: se esperaba exactamente 1 movimiento surtido_venta de -4, hubo %', v_movement_count;
  end if;
  raise notice 'TEST 7 OK: se crea el movimiento OUT correcto (surtido_venta, -4, trazable al fulfillment/línea)';
end $$;

-- =========================================================================
-- TEST 8/9: stock insuficiente rechazado — SO_LOWSTOCK (p2, solo 3 en
-- stock), intento de surtir 5 -> rechazado; nunca queda stock negativo.
-- =========================================================================
do $$
declare
  v_sf sales_fulfillments;
  v_item_id uuid;
  v_on_hand_before integer;
  v_on_hand_after integer;
begin
  select id into v_item_id from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e4';

  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e4', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item_id, 'quantity_requested', 5))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);

  select coalesce(sum(quantity_delta), 0) into v_on_hand_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d2' and warehouse_id = '00000000-0000-0000-0000-000000000071';

  begin
    perform rpc_dispatch_sales_fulfillment(v_sf.id);
    raise exception 'TEST 8 FALLO: no debió permitir despachar más de lo disponible en stock (5 solicitados, 3 disponibles)';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 8 OK: stock insuficiente rechazado al despachar';

  select coalesce(sum(quantity_delta), 0) into v_on_hand_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d2' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand_after <> v_on_hand_before or v_on_hand_after < 0 then
    raise exception 'TEST 9 FALLO: el stock no debió cambiar (ni volverse negativo) tras el intento rechazado (antes % después %)', v_on_hand_before, v_on_hand_after;
  end if;
  raise notice 'TEST 9 OK: el stock nunca queda negativo — permanece intacto (%) tras el intento rechazado', v_on_hand_after;
end $$;

-- =========================================================================
-- TEST 10/11: entrega parcial + segunda entrega completa el saldo de la
-- MISMA línea (item A: 4 ya surtidos en TEST 6/7, 6 más ahora -> 10 de 10).
-- =========================================================================
do $$
declare
  v_sf sales_fulfillments;
  v_item_a_fulfilled integer;
begin
  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_requested', 6))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  select coalesce(sum(sfi.quantity_fulfilled), 0) into v_item_a_fulfilled
    from sales_fulfillment_items sfi
    join sales_fulfillments sf on sf.id = sfi.sales_fulfillment_id
    where sfi.sales_order_item_id = (select item_a from temp_item_a) and sf.status <> 'cancelled';

  if v_item_a_fulfilled <> 10 then
    raise exception 'TEST 11 FALLO: acumulado surtido de la línea A esperado 10 (4+6), fue %', v_item_a_fulfilled;
  end if;
  raise notice 'TEST 10 OK: entrega parcial funciona (primeros 4 de 10, ver TEST 6/7)';
  raise notice 'TEST 11 OK: la segunda entrega completa el saldo de la línea (10 de 10)';
end $$;

-- =========================================================================
-- TEST 12: over-fulfillment rechazado — la línea A ya está 100% surtida
-- (10 de 10); cualquier intento de comprometer más se rechaza al crear el
-- draft.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_fulfillment(
      gen_random_uuid(),
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
      jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_requested', 1))
    );
    raise exception 'TEST 12 FALLO: no debió permitir crear una línea de surtido que exceda lo vendido';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 12 OK: over-fulfillment rechazado (acumulado no puede exceder cantidad vendida)';
end $$;

-- =========================================================================
-- TEST 13: línea libre no mueve inventario — la línea B (FREE-71, sin
-- catalog_product_id) se surte completa (5 de 5) y actualiza
-- quantity_fulfilled, pero NUNCA genera un inventory_movement. Con AMBAS
-- líneas de SO_RELEASED completas, fulfillment_release_status pasa a
-- 'fulfilled' (TEST 17).
-- =========================================================================
do $$
declare
  v_sf sales_fulfillments;
  v_item sales_fulfillment_items;
  v_movement_count integer;
begin
  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3', 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_b from temp_item_b), 'quantity_requested', 5))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  select * into v_item from sales_fulfillment_items where sales_fulfillment_id = v_sf.id;
  if v_item.quantity_fulfilled <> 5 then
    raise exception 'TEST 13 FALLO: la línea libre debió registrar quantity_fulfilled=5, fue %', v_item.quantity_fulfilled;
  end if;

  select count(*) into v_movement_count from inventory_movements where sales_fulfillment_item_id = v_item.id;
  if v_movement_count <> 0 then
    raise exception 'TEST 13 FALLO: una línea libre (sin catalog_product_id) NUNCA debe generar inventory_movements, se encontraron %', v_movement_count;
  end if;

  raise notice 'TEST 13 OK: una línea libre se surte operativamente sin generar movimiento de inventario';
end $$;

-- =========================================================================
-- TEST 14: double dispatch rechazado — el fulfillment de TEST 3/6/7 ya
-- está shipped.
-- =========================================================================
do $$
declare
  v_on_hand_before integer;
  v_on_hand_after integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';

  begin
    perform rpc_dispatch_sales_fulfillment('00000000-0000-0000-0000-0000000000a1');
    raise exception 'TEST 14 FALLO: no debió permitir despachar dos veces el mismo surtido';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  select coalesce(sum(quantity_delta), 0) into v_on_hand_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  if v_on_hand_before <> v_on_hand_after then
    raise exception 'TEST 14 FALLO: el segundo despacho no debió alterar el inventario (antes % después %)', v_on_hand_before, v_on_hand_after;
  end if;
  raise notice 'TEST 14 OK: doble despacho rechazado — nunca se duplica la salida';
end $$;

-- =========================================================================
-- =========================================================================
-- TEST 15: rollback completo si falla una línea a mitad del despacho --
-- surtido con 2 líneas (2 productos distintos de una Sales Order
-- dedicada): ambas individualmente válidas al preparar (draft/ready), pero
-- MIENTRAS sigue en ready un ajuste manual de inventario (ajeno a este
-- surtido) agota el stock físico de UNO de los dos productos -- al
-- despachar, la línea del producto NO afectado se procesa con éxito (mueve
-- inventario) y la otra falla por stock insuficiente; TODA la transacción
-- debe revertirse, incluidos los efectos YA aplicados de la línea válida.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item1 uuid; v_item2 uuid;
  v_sf_rb sales_fulfillments;
  v_on_hand_p1_before integer; v_on_hand_p1_after integer;
  v_item1_fulfilled_before integer; v_item1_fulfilled_after integer;
  v_sf_rb_status text;
begin
  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 6, 'unit_price', 100.00),
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d2', 'quantity', 3, 'unit_price', 100.00)
    )
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 900.00);

  select id into v_item1 from sales_order_items where sales_order_id = v_so.id and catalog_product_id = '00000000-0000-0000-0000-0000000000d1';
  select id into v_item2 from sales_order_items where sales_order_id = v_so.id and catalog_product_id = '00000000-0000-0000-0000-0000000000d2';

  -- Surtido R_rb en DRAFT/READY con AMBAS líneas al 100% -- individualmente
  -- válidas: nada más compite por estas líneas (regla 3/4 no se toca aquí).
  select * into v_sf_rb from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(
      jsonb_build_object('sales_order_item_id', v_item1, 'quantity_requested', 6),
      jsonb_build_object('sales_order_item_id', v_item2, 'quantity_requested', 3)
    )
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf_rb.id);

  -- MIENTRAS R_rb sigue en ready, un ajuste manual AJENO (admin, fuera de
  -- este flujo) agota por completo el stock físico de p2 en el almacén
  -- (los 3 restantes desde TEST 8/9) -- el compromiso de venta (regla 4)
  -- de R_rb sigue siendo válido, pero el STOCK real (regla 6/7) ya no
  -- alcanza.
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
    'product_id', '00000000-0000-0000-0000-0000000000d2', 'warehouse_id', '00000000-0000-0000-0000-000000000071',
    'movement_type', 'salida_manual', 'quantity', 3
  ));

  select coalesce(sum(quantity_delta), 0) into v_on_hand_p1_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(sfi.quantity_fulfilled), 0) into v_item1_fulfilled_before
    from sales_fulfillment_items sfi where sfi.sales_order_item_id = v_item1;

  -- Despachar R_rb ahora: item2 fallará por stock insuficiente (0
  -- disponible, 3 solicitados) -- sin importar cuál de las 2 líneas
  -- procese primero el loop, TODA la transacción debe revertirse,
  -- incluidos los efectos YA aplicados de item1.
  begin
    perform rpc_dispatch_sales_fulfillment(v_sf_rb.id);
    raise exception 'TEST 15 FALLO: no debió permitir despachar un surtido con una línea sin stock suficiente';
  exception when others then
    if sqlerrm like 'TEST 15 FALLO%' then raise; end if;
  end;

  select coalesce(sum(quantity_delta), 0) into v_on_hand_p1_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(sfi.quantity_fulfilled), 0) into v_item1_fulfilled_after
    from sales_fulfillment_items sfi where sfi.sales_order_item_id = v_item1;
  select status into v_sf_rb_status from sales_fulfillments where id = v_sf_rb.id;

  if v_on_hand_p1_before <> v_on_hand_p1_after then
    raise exception 'TEST 15 FALLO: el on_hand de p1 debió quedar exactamente igual tras el despacho fallido (% -> %)', v_on_hand_p1_before, v_on_hand_p1_after;
  end if;
  if v_item1_fulfilled_before <> v_item1_fulfilled_after then
    raise exception 'TEST 15 FALLO: quantity_fulfilled de item1 debió quedar exactamente igual (% -> %)', v_item1_fulfilled_before, v_item1_fulfilled_after;
  end if;
  if v_sf_rb_status <> 'ready' then
    raise exception 'TEST 15 FALLO: el surtido rechazado debió permanecer en ready (intacto), quedó en %', v_sf_rb_status;
  end if;

  raise notice 'TEST 15 OK: rollback completo al fallar a mitad del despacho -- ni el stock ni la línea ya procesada en el loop quedan alterados';
end $$;

-- =========================================================================
-- TEST 16: delivered inmutable -- surtido dedicado (Sales Order nueva,
-- independiente de TEST 15) despachado y marcado como entregado; después:
-- no se puede editar, cancelar, ni tocar sus líneas directamente -- salvo
-- las notas (regla 12), que SÍ pueden actualizarse incluso ya entregado.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item uuid;
  v_sf sales_fulfillments;
begin
  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 200.00);
  select id into v_item from sales_order_items where sales_order_id = v_so.id;

  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item, 'quantity_requested', 2))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);
  perform rpc_mark_sales_fulfillment_delivered(v_sf.id, 'Recibido por el cliente en mostrador.');

  begin
    perform rpc_update_sales_fulfillment(v_sf.id, jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000072'), '[]'::jsonb);
    raise exception 'TEST 16 FALLO: no debió permitir editar un surtido ya entregado';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_cancel_sales_fulfillment(v_sf.id);
    raise exception 'TEST 16 FALLO: no debió permitir cancelar un surtido ya entregado';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  begin
    update sales_fulfillment_items set quantity_requested = 999 where sales_fulfillment_id = v_sf.id;
    raise exception 'TEST 16 FALLO: no debió permitir modificar directamente una línea de un surtido entregado';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  perform rpc_update_sales_fulfillment_delivery_notes(v_sf.id, 'Nota corregida: recibió el hijo del cliente.');
  if (select delivery_notes from sales_fulfillments where id = v_sf.id) <> 'Nota corregida: recibió el hijo del cliente.' then
    raise exception 'TEST 16 FALLO: las notas SÍ deben poder actualizarse aunque el surtido ya esté entregado (regla 12)';
  end if;

  raise notice 'TEST 16 OK: un surtido entregado es inmutable salvo sus notas, que sí pueden actualizarse explícitamente';
end $$;

-- TEST 17: SO pasa a fulfilled cuando corresponde -- SO_RELEASED ya tiene
-- AMBAS líneas 100% surtidas (item A 10/10 desde TEST 6/7/10/11, línea
-- libre 5/5 desde TEST 13).
-- =========================================================================
do $$
declare v_release_status text;
begin
  select fulfillment_release_status into v_release_status from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_release_status <> 'fulfilled' then
    raise exception 'TEST 17 FALLO: con AMBAS líneas de SO_RELEASED completas, fulfillment_release_status debió pasar a fulfilled, fue %', v_release_status;
  end if;
  raise notice 'TEST 17 OK: la Sales Order pasa a fulfilled cuando todas sus líneas quedan completamente surtidas';
end $$;

-- =========================================================================
-- TEST 18: múltiples almacenes respetan stock separado -- p1 tiene 5 en w2
-- (nunca tocado hasta ahora); se surten 3 desde w2 y se confirma que w1 NO
-- se ve afectado (y viceversa).
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item uuid;
  v_sf sales_fulfillments;
  v_on_hand_w1_before integer; v_on_hand_w1_after integer;
  v_on_hand_w2_before integer; v_on_hand_w2_after integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand_w1_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(quantity_delta), 0) into v_on_hand_w2_before from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000072';

  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'customer_id', '00000000-0000-0000-0000-0000000000c1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 3, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 300.00);
  select id into v_item from sales_order_items where sales_order_id = v_so.id;

  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000072'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item, 'quantity_requested', 3))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  select coalesce(sum(quantity_delta), 0) into v_on_hand_w1_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000071';
  select coalesce(sum(quantity_delta), 0) into v_on_hand_w2_after from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000072';

  if v_on_hand_w1_after <> v_on_hand_w1_before then
    raise exception 'TEST 18 FALLO: despachar desde w2 no debió afectar el stock de w1 (% -> %)', v_on_hand_w1_before, v_on_hand_w1_after;
  end if;
  if v_on_hand_w2_after <> v_on_hand_w2_before - 3 then
    raise exception 'TEST 18 FALLO: el stock de w2 debió bajar exactamente 3 (% -> %)', v_on_hand_w2_before, v_on_hand_w2_after;
  end if;
  raise notice 'TEST 18 OK: múltiples almacenes mantienen balances independientes para el mismo producto';
end $$;

-- =========================================================================
-- TEST 19: RLS correcto -- admin de Org B no ve surtidos/líneas/eventos de
-- Org A.
-- =========================================================================
do $$
declare
  v_count_sf integer;
  v_count_items integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  select count(*) into v_count_sf from sales_fulfillments where id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into v_count_items from sales_fulfillment_items where sales_fulfillment_id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into v_count_events from sales_fulfillment_events where sales_fulfillment_id = '00000000-0000-0000-0000-0000000000a1';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_sf <> 0 or v_count_items <> 0 or v_count_events <> 0 then
    raise exception 'TEST 19 FALLO: admin de Org B pudo ver datos de un surtido de Org A (%/%/%)', v_count_sf, v_count_items, v_count_events;
  end if;
  raise notice 'TEST 19 OK: aislamiento cross-org respetado por sales_fulfillments/items/events';
end $$;

-- =========================================================================
-- TEST 20 (SECURITY DEFINER audit): fn_next_sales_fulfillment_number
-- rechaza generar un folio para una organización ajena -- mismo patrón ya
-- probado y seguro de fn_next_purchase_order_folio/
-- fn_next_purchase_requisition_number/fn_next_goods_receipt_number.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  begin
    perform fn_next_sales_fulfillment_number('00000000-0000-0000-0000-0000000000a1', current_date);
    raise exception 'TEST 20 FALLO: no debió poder generar un folio de surtido para otra organización';
  exception when others then
    if sqlerrm like 'TEST 20 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 20 OK: fn_next_sales_fulfillment_number (SECURITY DEFINER) rechaza generar folios de otra organización';
end $$;

-- =========================================================================
-- TEST 21 (bonus, visibilidad): fulfill_user (SOLO
-- can_manage_sales_fulfillment, NO admin, NO dueño de la Sales Order) puede
-- VER y CREAR un surtido contra una Sales Order que no le pertenece
-- comercialmente -- confirma que la ampliación de visibilidad de
-- sales_orders (sección 11 de 0071) funciona en la práctica.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item uuid;
  v_visible_count integer;
  v_sf sales_fulfillments;
begin
  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'customer_id', '00000000-0000-0000-0000-0000000000c1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FULFILL-71', 'quantity', 2, 'unit_price', 10.00))
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 20.00);
  select id into v_item from sales_order_items where sales_order_id = v_so.id;

  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- fulfill_user

  select count(*) into v_visible_count from sales_orders where id = v_so.id;
  if v_visible_count <> 1 then
    raise exception 'TEST 21 FALLO: fulfill_user (can_manage_sales_fulfillment) debió poder VER la Sales Order, no la vio';
  end if;

  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000071'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item, 'quantity_requested', 2))
  );
  if v_sf.id is null then
    raise exception 'TEST 21 FALLO: fulfill_user debió poder crear un surtido (draft) contra una Sales Order que no le pertenece comercialmente';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 21 OK: un usuario con SOLO can_manage_sales_fulfillment puede ver y surtir cualquier Sales Order liberada de su organización';
end $$;

select 'TODAS LAS PRUEBAS 0071 PASARON' as resultado;

rollback;
