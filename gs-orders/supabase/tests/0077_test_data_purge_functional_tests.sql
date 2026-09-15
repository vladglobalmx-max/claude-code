-- THÖREN 0077 — Test Data / Purga de operaciones de prueba
-- (0077_test_data_purge.sql) — pruebas funcionales contra Postgres real.
-- Fixtures 100% autocontenidas. Todo el script corre en una transacción
-- que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor_user '00000000-0000-0000-0000-000000000006'
\set director_user '00000000-0000-0000-0000-000000000007'
\set finance_spoof_user '00000000-0000-0000-0000-000000000008'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_vendedor '00000000-0000-0000-0000-0000000000b6'
\set sp_director '00000000-0000-0000-0000-0000000000b7'
\set sp_finance_spoof '00000000-0000-0000-0000-0000000000b8'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p2 '00000000-0000-0000-0000-0000000000d2'
\set w1 '00000000-0000-0000-0000-000000000077'
\set w_orgb '00000000-0000-0000-0000-000000000079'
\set sup1 '00000000-0000-0000-0000-0000000000f1'

insert into auth.users (id, email) values
  (:'admin', 'admin-77@test.local'),
  (:'vendedor_user', 'vendedor-77@test.local'),
  (:'director_user', 'director-77@test.local'),
  (:'finance_spoof_user', 'finance-spoof-77@test.local'),
  (:'admin_orgb', 'admin-orgb-77@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 77', 'test-org-77'),
  (:'org_b', 'Test Org 77B', 'test-org-77b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 77', 'admin', true),
  (:'admin_orgb', 'Admin Org B 77', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 77', 'VT77', true),
  (:'sp_vendedor', :'org_a', 'Vendedor Sin Capability 77', 'VS77', true),
  (:'sp_director', :'org_a', 'Direccion Test 77', 'DG77', true),
  (:'sp_finance_spoof', :'org_a', 'Finanzas Spoof 77', 'FS77', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 77', 'VB77', true);

-- vendedor_user: activo, sin NINGUNA capability especial — representa
-- "Vendedores, Compras, Logística y Finanzas no pueden purgar operaciones"
-- (basta probar el caso general: ningún capability especial -> rechazado).
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_user', 'Vendedor Test 77', 'vendedor', :'sp_vendedor', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_user', 'vendedor', true);

-- director_user: NO admin, ÚNICAMENTE can_purge_test_operations — prueba
-- el camino "Dirección recibe esa capability explícitamente", separado
-- del bypass de admin.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'director_user', 'Direccion Test 77', 'vendedor', :'sp_director', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'director_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'director_user', 'can_purge_test_operations', :'admin');

-- finance_spoof_user: NO admin, ÚNICAMENTE can_manage_sales_order_finance
-- (SIN can_purge_test_operations) — invoice_items_delete (RLS) admite
-- DELETE a cualquier can_manage_sales_order_finance sin exigir status
-- alguno, así que ESTE usuario SÍ llega hasta el trigger de invoice_items
-- si intenta borrar directo (a diferencia de vendedor_user, a quien RLS ya
-- detiene antes). Representa exactamente el caso que la capa (c) del
-- bypass (autoridad de purga real de la sesión) tiene que cerrar: alguien
-- con autoridad financiera legítima, pero SIN autoridad de purga, que de
-- algún modo intentara imitar el contexto de purga.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'finance_spoof_user', 'Finanzas Spoof Test 77', 'vendedor', :'sp_finance_spoof', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'finance_spoof_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'finance_spoof_user', 'can_manage_sales_order_finance', :'admin');

-- admin también recibe can_manage_commissions SOLO para poder crear el
-- commission_record de CADENA A — 0073 no da atajo de admin para
-- comisiones (autoridad EXCLUSIVA de la capability), sin relación con la
-- purga misma (que sí tiene atajo de admin, ver rpc_purge_test_sales_order).
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'admin', 'can_manage_commissions', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 77', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 77', true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Test 77', 'SKU-P1-77', 'general', 'pza', true),
  (:'p2', :'org_a', 'Producto Oficial Referencia 77', 'SKU-P2-77', 'general', 'pza', true);

insert into suppliers (id, organization_id, name, active) values
  (:'sup1', :'org_a', 'Proveedor Test 77', true);

insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_uom, active) values
  (:'p1', :'sup1', 'SUP-SKU-P1-77', 'pza', true),
  (:'p2', :'sup1', 'SUP-SKU-P2-77', 'pza', true);

set role authenticated;
select test_set_user(:'admin');

insert into warehouses (id, organization_id, name, code, active) values
  (:'w1', :'org_a', 'Almacén Test 77', 'ALM-77', true);

select test_set_user(:'admin_orgb');
insert into warehouses (id, organization_id, name, code, active) values
  (:'w_orgb', :'org_b', 'Almacén Org B 77', 'ALM-77B', true);
select test_set_user(:'admin');

-- Baseline OFICIAL de inventario (entrada_manual, is_test SIEMPRE false —
-- nunca pasa por los caminos que 0077 modifica): 50 unidades de p1 en w1,
-- para poder probar después que la purga deja el inventario EXACTAMENTE
-- como estaba antes de la prueba (no solo "en cero").
select rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
  'product_id', '00000000-0000-0000-0000-0000000000d1', 'warehouse_id', '00000000-0000-0000-0000-000000000077',
  'movement_type', 'entrada_manual', 'quantity', 50
));

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: crear SO SIN indicar is_test -> default false (flag oficial).
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e0',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'OFICIAL-77', 'quantity', 1, 'unit_price', 500.00))
  );
  if v_so.is_test is distinct from false then
    raise exception 'TEST 1 FALLO: is_test debió tomar el default false cuando no se indica, fue %', v_so.is_test;
  end if;
  raise notice 'TEST 1 OK: is_test default false cuando no se especifica';
end $$;

-- =========================================================================
-- TEST 2: crear SO con is_test=true -> queda marcada como prueba.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000e00a',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'PRUEBA-77', 'quantity', 1, 'unit_price', 500.00))
  );
  if v_so.is_test is distinct from true then
    raise exception 'TEST 2 FALLO: is_test debió quedar true, fue %', v_so.is_test;
  end if;
  raise notice 'TEST 2 OK: is_test=true se respeta al crear';
end $$;

-- =========================================================================
-- TEST 3: no se puede convertir una SO oficial -> prueba (ni viceversa)
-- después de creada — el trigger de identidad lo bloquea SIEMPRE, sin
-- importar el rol.
-- =========================================================================
do $$
begin
  begin
    update sales_orders set is_test = true where id = '00000000-0000-0000-0000-0000000000e0';
    raise exception 'TEST 3 FALLO: no debió permitir cambiar is_test de una SO oficial ya creada';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;
  begin
    update sales_orders set is_test = false where id = '00000000-0000-0000-0000-00000000e00a';
    raise exception 'TEST 3 FALLO: no debió permitir cambiar is_test de una SO de prueba ya creada (inversa)';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 3 OK: is_test es inmutable después de crear la Sales Order (ambos sentidos)';
end $$;

-- =========================================================================
-- CADENA A (completa): SO prueba -> requisición -> PO -> recepción ->
-- inventario -> surtido -> factura -> pago -> comisión. Se purga al final
-- por ADMIN (bypass), verificando que TODO desaparece y el inventario
-- vuelve EXACTAMENTE al baseline oficial (50).
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_req purchase_requisitions;
  v_po purchase_orders;
  v_poi_id uuid;
  v_soi_id uuid;
  v_gr goods_receipts;
  v_inv invoices;
  v_sf sales_fulfillments;
  v_cr commission_records;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000ea01',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 10, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  select id into v_soi_id from sales_order_items where sales_order_id = v_so.id limit 1;

  -- Factura + pago ANTES de la requisición: trg_check_purchase_requisition_eligible
  -- exige que la Sales Order ya esté liberada (released/partially_released)
  -- para poder originar una requisición — con esto además se obtiene una
  -- fila real de invoice_payments para poder probar después que
  -- desaparece con la purga.
  select * into v_inv from rpc_create_invoice('00000000-0000-0000-0000-00000000ea05', v_so.id, current_date + 30);
  if v_inv.status <> 'pending' or v_inv.amount_paid <> 0 then
    raise exception 'CADENA A FALLO (setup): la factura debió nacer pending/0, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;
  perform rpc_register_invoice_payment(v_inv.id, 1000.00);

  select * into v_req from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-00000000ea02',
    jsonb_build_object('sales_order_id', v_so.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi_id, 'quantity_required', 10))
  );
  perform rpc_submit_purchase_requisition(v_req.id);

  select * into v_po from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-00000000ea03',
    v_req.id,
    '00000000-0000-0000-0000-0000000000f1',
    (select array_agg(id) from purchase_requisition_items where purchase_requisition_id = v_req.id),
    '{}'::jsonb
  );
  if v_po.is_test is distinct from true then
    raise exception 'CADENA A FALLO: la PO derivada de una requisición de SO de prueba debió nacer is_test=true, fue %', v_po.is_test;
  end if;
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  select id into v_poi_id from purchase_order_items where purchase_order_id = v_po.id limit 1;

  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-00000000ea04',
    jsonb_build_object('purchase_order_id', v_po.id, 'warehouse_id', '00000000-0000-0000-0000-000000000077', 'supplier_document_number', 'FAC-77'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi_id, 'quantity_received', 10))
  );
  perform rpc_post_goods_receipt(v_gr.id);

  if not exists (
    select 1 from inventory_movements
    where purchase_order_id = v_po.id and movement_type = 'recepcion_compra' and is_test = true
  ) then
    raise exception 'CADENA A FALLO: el movimiento de recepción debió quedar is_test=true';
  end if;

  select * into v_sf from rpc_create_sales_fulfillment(
    '00000000-0000-0000-0000-00000000ea06',
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000077'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi_id, 'quantity_requested', 10))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  if not exists (
    select 1 from inventory_movements
    where sales_fulfillment_id = v_sf.id and movement_type = 'surtido_venta' and is_test = true
  ) then
    raise exception 'CADENA A FALLO: el movimiento de surtido debió quedar is_test=true';
  end if;

  select * into v_cr from rpc_create_commission_record('00000000-0000-0000-0000-00000000ea07', v_so.id, '00000000-0000-0000-0000-0000000000b1', 10.00);

  raise notice 'CADENA A OK: SO -> requisición -> PO -> recepción -> inventario -> factura -> pago -> surtido -> inventario -> comisión, construida completa (PO/movimientos is_test=true confirmado)';
end $$;

-- =========================================================================
-- TEST 3b (falsear el contexto de purga, sin autoridad de purga real ->
-- rechazado incluso apuntando a una fila que SÍ es de prueba y SÍ
-- coincide exactamente con el GUC): finance_spoof_user tiene
-- can_manage_sales_order_finance (RLS de invoice_items_delete lo admite
-- SIN exigir ningún status — a diferencia de sales_fulfillment_items/
-- goods_receipt_items, cuyas policies de DELETE SÍ exigen status='draft' y
-- ya detienen a cualquiera antes de llegar al trigger). Aun así, sin
-- can_purge_test_operations ni ser admin, el bypass del trigger (capa "c")
-- debe rechazarlo — un GUC puesto a mano, fuera de
-- rpc_purge_test_sales_order, JAMÁS debe bastar por sí solo.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000008'); -- finance_spoof_user

  -- Falsea el GUC exactamente como lo haría rpc_purge_test_sales_order —
  -- apuntando a CADENA A, que en este punto SIGUE siendo real, is_test=true
  -- y sin purgar todavía.
  perform set_config('thoren.purge_test_sales_order_id', '00000000-0000-0000-0000-00000000ea01', true);

  begin
    delete from invoice_items where id = (select id from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ea05' limit 1);
    raise exception 'TEST 3b FALLO: finance_spoof_user (sin autoridad de purga) no debió poder borrar una línea de factura de prueba falseando el GUC';
  exception when others then
    if sqlerrm like 'TEST 3b FALLO%' then raise; end if;
  end;

  -- Limpieza: el GUC no debe quedar puesto para el resto del archivo.
  perform set_config('thoren.purge_test_sales_order_id', '', true);
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if not exists (select 1 from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ea05') then
    raise exception 'TEST 3b FALLO: la línea de factura de CADENA A no debió desaparecer';
  end if;

  raise notice 'TEST 3b OK: falsear el GUC de purga sin autoridad real (admin/can_purge_test_operations) sigue rechazado, incluso contra una fila genuinamente de prueba que coincide exactamente';
end $$;

-- =========================================================================
-- CADENA OFICIAL DE REFERENCIA (is_test=false): factura (cualquier status),
-- surtido NO-draft y recepción posted — construida UNA sola vez, se
-- reutiliza en TEST 5b y TEST 8b para confirmar que los tres freeze
-- triggers (invoice_items/sales_fulfillment_items/goods_receipt_items)
-- SIGUEN protegiendo datos oficiales normalmente después de una purga
-- (exitosa o abortada) — nunca quedan "destrabados" fuera de la ventana
-- exacta de una purga real.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_soi_id uuid;
  v_req purchase_requisitions;
  v_po purchase_orders;
  v_poi_id uuid;
  v_gr goods_receipts;
  v_inv invoices;
  v_sf sales_fulfillments;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000ef01',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d2', 'quantity', 3, 'unit_price', 100.00))
  );
  if v_so.is_test is distinct from false then
    raise exception 'CADENA OFICIAL FALLO: is_test debió ser false por defecto';
  end if;
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  select id into v_soi_id from sales_order_items where sales_order_id = v_so.id limit 1;

  select * into v_inv from rpc_create_invoice('00000000-0000-0000-0000-00000000ef05', v_so.id, current_date + 30);
  perform rpc_register_invoice_payment(v_inv.id, 300.00);

  select * into v_req from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-00000000ef02',
    jsonb_build_object('sales_order_id', v_so.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi_id, 'quantity_required', 3))
  );
  perform rpc_submit_purchase_requisition(v_req.id);
  select * into v_po from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-00000000ef03',
    v_req.id, '00000000-0000-0000-0000-0000000000f1',
    (select array_agg(id) from purchase_requisition_items where purchase_requisition_id = v_req.id), '{}'::jsonb
  );
  if v_po.is_test is distinct from false then
    raise exception 'CADENA OFICIAL FALLO: la PO debió heredar is_test=false de una SO oficial';
  end if;
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  select id into v_poi_id from purchase_order_items where purchase_order_id = v_po.id limit 1;

  select * into v_gr from rpc_create_goods_receipt(
    '00000000-0000-0000-0000-00000000ef04',
    jsonb_build_object('purchase_order_id', v_po.id, 'warehouse_id', '00000000-0000-0000-0000-000000000077', 'supplier_document_number', 'FAC-OFICIAL-77'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi_id, 'quantity_received', 3))
  );
  perform rpc_post_goods_receipt(v_gr.id); -- status 'posted' -> activa el freeze de sus líneas.

  select * into v_sf from rpc_create_sales_fulfillment(
    '00000000-0000-0000-0000-00000000ef06',
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000000077'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi_id, 'quantity_requested', 3))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id); -- status 'ready' (no draft) -> activa el freeze de sus líneas.

  raise notice 'CADENA OFICIAL DE REFERENCIA OK: factura/recepción posted/surtido ready listos para TEST 5b y TEST 8b';
end $$;

-- =========================================================================
-- TEST 4: usuario SIN capability (vendedor_user, ni admin ni
-- can_purge_test_operations) intenta purgar CADENA A -> rechazado. La
-- cadena sigue intacta.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_purge_test_sales_order('00000000-0000-0000-0000-00000000ea01');
    raise exception 'TEST 4 FALLO: un usuario sin capability no debió poder purgar';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  if not exists (select 1 from sales_orders where id = '00000000-0000-0000-0000-00000000ea01') then
    raise exception 'TEST 4 FALLO: el intento rechazado no debió dejar rastro — la Sales Order desapareció';
  end if;
  raise notice 'TEST 4 OK: usuario sin capability rechazado, cadena intacta';
end $$;

-- =========================================================================
-- TEST 5 (purga completa, ADMIN — bypass): purga CADENA A. Verifica que
-- TODO desaparece y el inventario de p1/w1 vuelve EXACTAMENTE a 50 (el
-- baseline oficial, no solo "cero").
-- =========================================================================
do $$
declare
  v_order_number text;
  v_on_hand integer;
begin
  select * into v_order_number from rpc_purge_test_sales_order('00000000-0000-0000-0000-00000000ea01');
  if v_order_number is null then
    raise exception 'TEST 5 FALLO: la purga debió devolver el order_number de la Sales Order eliminada';
  end if;

  if exists (select 1 from sales_orders where id = '00000000-0000-0000-0000-00000000ea01') then
    raise exception 'TEST 5 FALLO: la Sales Order de prueba debió desaparecer';
  end if;
  if exists (select 1 from purchase_requisitions where sales_order_id = '00000000-0000-0000-0000-00000000ea01') then
    raise exception 'TEST 5 FALLO: la requisición de prueba debió desaparecer';
  end if;
  if exists (select 1 from purchase_orders where id = '00000000-0000-0000-0000-00000000ea03') then
    raise exception 'TEST 5 FALLO: la Purchase Order de prueba debió desaparecer';
  end if;
  if exists (select 1 from goods_receipts where id = '00000000-0000-0000-0000-00000000ea04') then
    raise exception 'TEST 5 FALLO: la recepción de prueba debió desaparecer';
  end if;
  if exists (select 1 from sales_fulfillments where id = '00000000-0000-0000-0000-00000000ea06') then
    raise exception 'TEST 5 FALLO: el surtido de prueba debió desaparecer';
  end if;
  if exists (select 1 from invoices where id = '00000000-0000-0000-0000-00000000ea05') then
    raise exception 'TEST 5 FALLO: la factura de prueba debió desaparecer';
  end if;
  if exists (select 1 from invoice_payments where invoice_id = '00000000-0000-0000-0000-00000000ea05') then
    raise exception 'TEST 5 FALLO: no deben quedar invoice_payments de la prueba';
  end if;
  if exists (select 1 from invoice_events where invoice_id = '00000000-0000-0000-0000-00000000ea05') then
    raise exception 'TEST 5 FALLO: no deben quedar invoice_events de la prueba';
  end if;
  if exists (select 1 from commission_records where id = '00000000-0000-0000-0000-00000000ea07') then
    raise exception 'TEST 5 FALLO: no deben quedar commission_records de la prueba';
  end if;
  if exists (select 1 from commission_events where commission_record_id = '00000000-0000-0000-0000-00000000ea07') then
    raise exception 'TEST 5 FALLO: no deben quedar commission_events de la prueba';
  end if;
  if exists (select 1 from inventory_movements where is_test = true) then
    raise exception 'TEST 5 FALLO: no deben quedar inventory_movements de la prueba';
  end if;

  select coalesce(sum(quantity_delta), 0) into v_on_hand from inventory_movements
    where product_id = '00000000-0000-0000-0000-0000000000d1' and warehouse_id = '00000000-0000-0000-0000-000000000077';
  if v_on_hand <> 50 then
    raise exception 'TEST 5 FALLO: el inventario debió volver EXACTAMENTE al baseline oficial (50), quedó en %', v_on_hand;
  end if;

  raise notice 'TEST 5 OK: purga completa (admin) — toda la cadena desaparece, inventario vuelve exactamente a 50 (baseline oficial intacto)';
end $$;

-- =========================================================================
-- TEST 5b (triggers siguen activos DESPUÉS de una purga EXITOSA): sobre la
-- CADENA OFICIAL DE REFERENCIA (is_test=false, intacta — nunca purgada),
-- un intento de borrar una línea de factura/surtido/recepción FUERA de
-- rpc_purge_test_sales_order (sin el GUC de purga puesto) sigue rechazado
-- exactamente igual que antes de que CADENA A se purgara.
--
-- IMPORTANTE (hallazgo real durante la validación de este ajuste): para
-- sales_fulfillment_items/goods_receipt_items, RLS por sí sola YA filtra
-- en silencio (0 filas, sin error) cualquier DELETE intentado como rol
-- `authenticated` normal sobre una línea fuera de status draft — sus
-- únicas policies de DELETE exigen status='draft', así que ni admin llega
-- nunca al trigger por esa vía en el uso normal de la app. El freeze
-- trigger existe para el caso que sí importa: código que bypassa RLS
-- (SECURITY DEFINER/dueño de tabla — exactamente el contexto de
-- rpc_purge_test_sales_order). Por eso esta verificación usa `reset role`
-- (mismo bypass de RLS que un SECURITY DEFINER) para poner a prueba el
-- trigger en sí — no la policy de RLS que ya cubre al resto de la app.
-- =========================================================================
do $$
begin
  reset role;
  begin
    delete from invoice_items where id = (select id from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ef05' limit 1);
    raise exception 'TEST 5b FALLO: invoice_items debió seguir protegido tras una purga exitosa';
  exception when others then
    if sqlerrm like 'TEST 5b FALLO%' then raise; end if;
  end;
  begin
    delete from sales_fulfillment_items where id = (select id from sales_fulfillment_items where sales_fulfillment_id = '00000000-0000-0000-0000-00000000ef06' limit 1);
    raise exception 'TEST 5b FALLO: sales_fulfillment_items debió seguir protegido tras una purga exitosa';
  exception when others then
    if sqlerrm like 'TEST 5b FALLO%' then raise; end if;
  end;
  begin
    delete from goods_receipt_items where id = (select id from goods_receipt_items where goods_receipt_id = '00000000-0000-0000-0000-00000000ef04' limit 1);
    raise exception 'TEST 5b FALLO: goods_receipt_items debió seguir protegido tras una purga exitosa';
  exception when others then
    if sqlerrm like 'TEST 5b FALLO%' then raise; end if;
  end;
  set role authenticated;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  if not exists (select 1 from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ef05')
     or not exists (select 1 from sales_fulfillment_items where sales_fulfillment_id = '00000000-0000-0000-0000-00000000ef06')
     or not exists (select 1 from goods_receipt_items where goods_receipt_id = '00000000-0000-0000-0000-00000000ef04') then
    raise exception 'TEST 5b FALLO: la cadena oficial de referencia no debió perder ninguna línea';
  end if;
  raise notice 'TEST 5b OK: los tres freeze triggers siguen protegiendo datos oficiales normalmente después de una purga exitosa';
end $$;

-- =========================================================================
-- CADENA B (ligera, sin convertir a PO): SO prueba + requisición draft.
-- Se purga por DIRECTOR_USER (NO admin, únicamente can_purge_test_operations)
-- — prueba el camino de capability explícita, separado del bypass de admin.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_soi_id uuid;
  v_order_number text;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000eb01',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'PRUEBA-LIGERA-77', 'quantity', 1, 'unit_price', 10.00))
  );
  select id into v_soi_id from sales_order_items where sales_order_id = v_so.id limit 1;
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 10.00);
  perform rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-00000000eb02',
    jsonb_build_object('sales_order_id', v_so.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi_id, 'quantity_required', 1))
  );

  perform test_set_user('00000000-0000-0000-0000-000000000007'); -- director_user
  select * into v_order_number from rpc_purge_test_sales_order(v_so.id);
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if exists (select 1 from sales_orders where id = '00000000-0000-0000-0000-00000000eb01') then
    raise exception 'CADENA B FALLO: director_user (capability, no admin) debió poder purgar y no lo hizo';
  end if;
  if exists (select 1 from purchase_requisitions where id = '00000000-0000-0000-0000-00000000eb02') then
    raise exception 'CADENA B FALLO: la requisición draft debió desaparecer también';
  end if;
  raise notice 'CADENA B OK: director_user (can_purge_test_operations, SIN ser admin) purga correctamente una cadena ligera';
end $$;

-- =========================================================================
-- TEST 6: intento de borrar una SO OFICIAL (is_test=false) -> rechazado
-- SIEMPRE, incluso por admin.
-- =========================================================================
do $$
begin
  begin
    perform rpc_purge_test_sales_order('00000000-0000-0000-0000-0000000000e0');
    raise exception 'TEST 6 FALLO: no se debió poder purgar una Sales Order oficial';
  exception when others then
    if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
  end;
  if not exists (select 1 from sales_orders where id = '00000000-0000-0000-0000-0000000000e0') then
    raise exception 'TEST 6 FALLO: la Sales Order oficial no debió desaparecer';
  end if;
  raise notice 'TEST 6 OK: una Sales Order oficial nunca puede purgarse, ni siquiera por admin';
end $$;

-- =========================================================================
-- TEST 7: cross-org rechazado — admin de Org A no puede purgar una SO de
-- prueba de Org B.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000ec01',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'PRUEBA-ORGB-77', 'quantity', 1, 'unit_price', 10.00))
  );
  perform test_set_user('00000000-0000-0000-0000-000000000001'); -- admin de Org A

  begin
    perform rpc_purge_test_sales_order(v_so.id);
    raise exception 'TEST 7 FALLO: un admin de Org A no debió poder purgar una SO de prueba de Org B';
  exception when others then
    if sqlerrm like 'TEST 7 FALLO%' then raise; end if;
  end;

  -- Verificación con reset role (bypassa RLS): admin de Org A NUNCA podría
  -- ver esta fila vía RLS de todos modos (sales_orders_select_own_or_admin
  -- exige ser miembro/admin de esa organización) — comprobar "sigue
  -- existiendo" desde su propia sesión daría un falso negativo por RLS,
  -- no por la purga. Mismo patrón que 0064 (líneas ~559-572) para casos
  -- cross-org.
  reset role;
  if not exists (select 1 from sales_orders where id = v_so.id) then
    raise exception 'TEST 7 FALLO: la SO de prueba de Org B no debió desaparecer';
  end if;
  set role authenticated;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 7 OK: cross-org rechazado al purgar';
end $$;

-- =========================================================================
-- TEST 8 (rollback completo ante error — guard de mezcla): dos Sales
-- Orders de prueba INDEPENDIENTES (eE1, eE2), cada una con su propia
-- requisición y PO. Se simula (reset role, dato imposible por el flujo
-- normal ya que rpc_convert_requisition_to_purchase_order siempre crea
-- una PO nueva por conversión) que una línea de la PO de eE1 quedó
-- apuntando a una línea de la requisición de eE2 — el guard de mezcla
-- debe abortar la purga de eE1 ANTES de escribir nada. Verifica que
-- NINGUNA fila de la cadena de eE1 desapareció.
-- =========================================================================
do $$
declare
  v_so1 sales_orders;
  v_so2 sales_orders;
  v_soi1_id uuid;
  v_soi2_id uuid;
  v_req1 purchase_requisitions;
  v_req2 purchase_requisitions;
  v_po1 purchase_orders;
  v_po2 purchase_orders;
  v_poi1_id uuid;
  v_poi1b_id uuid;
  v_pri2_id uuid;
  v_soi1b_id uuid;
begin
  -- SO1 con DOS líneas (misma producto, dos posiciones) -> requisición con
  -- DOS partidas -> PO con DOS partidas. Así se puede rehacer SOLO una de
  -- ellas apuntando a eE2 y dejar la otra legítimamente en eE1 — si tuviera
  -- una sola partida, "mezclarla" la desconectaría por completo de eE1 en
  -- vez de mezclarla con eE1.
  select * into v_so1 from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000ed01',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 10.00),
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 10.00)
    )
  );
  perform rpc_update_sales_order_status(v_so1.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so1.id, 40.00);
  select id into v_soi1_id from sales_order_items where sales_order_id = v_so1.id order by position limit 1;
  select id into v_soi1b_id from sales_order_items where sales_order_id = v_so1.id order by position offset 1 limit 1;

  select * into v_so2 from rpc_create_sales_order(
    '00000000-0000-0000-0000-00000000ed02',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash', 'is_test', true),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 10.00))
  );
  perform rpc_update_sales_order_status(v_so2.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so2.id, 20.00);
  select id into v_soi2_id from sales_order_items where sales_order_id = v_so2.id limit 1;

  select * into v_req1 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-00000000ed03', jsonb_build_object('sales_order_id', v_so1.id),
    jsonb_build_array(
      jsonb_build_object('sales_order_item_id', v_soi1_id, 'quantity_required', 2),
      jsonb_build_object('sales_order_item_id', v_soi1b_id, 'quantity_required', 2)
    )
  );
  perform rpc_submit_purchase_requisition(v_req1.id);
  select * into v_po1 from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-00000000ed04', v_req1.id, '00000000-0000-0000-0000-0000000000f1',
    (select array_agg(id) from purchase_requisition_items where purchase_requisition_id = v_req1.id), '{}'::jsonb
  );
  select id into v_poi1_id from purchase_order_items where purchase_order_id = v_po1.id order by position limit 1;
  select id into v_poi1b_id from purchase_order_items where purchase_order_id = v_po1.id order by position offset 1 limit 1;

  select * into v_req2 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-00000000ed05', jsonb_build_object('sales_order_id', v_so2.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_soi2_id, 'quantity_required', 2))
  );
  perform rpc_submit_purchase_requisition(v_req2.id);
  select * into v_po2 from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-00000000ed06', v_req2.id, '00000000-0000-0000-0000-0000000000f1',
    (select array_agg(id) from purchase_requisition_items where purchase_requisition_id = v_req2.id), '{}'::jsonb
  );
  select id into v_pri2_id from purchase_requisition_items where purchase_requisition_id = v_req2.id limit 1;

  -- Dato imposible por el flujo normal, simulado a propósito (reset role):
  -- la línea de la PO de eE1 ahora "pertenece" también a la requisición de
  -- eE2.
  reset role;
  update purchase_order_items set purchase_requisition_item_id = v_pri2_id where id = v_poi1_id;
  set role authenticated;
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  begin
    perform rpc_purge_test_sales_order(v_so1.id);
    raise exception 'TEST 8 FALLO: el guard de mezcla debió abortar la purga de eE1';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;

  if not exists (select 1 from sales_orders where id = v_so1.id) then
    raise exception 'TEST 8 FALLO: rollback incompleto — la Sales Order eE1 desapareció pese al error';
  end if;
  if not exists (select 1 from purchase_orders where id = v_po1.id) then
    raise exception 'TEST 8 FALLO: rollback incompleto — la Purchase Order de eE1 desapareció pese al error';
  end if;
  if not exists (select 1 from purchase_requisitions where id = v_req1.id) then
    raise exception 'TEST 8 FALLO: rollback incompleto — la requisición de eE1 desapareció pese al error';
  end if;
  if not exists (select 1 from sales_orders where id = v_so2.id) then
    raise exception 'TEST 8 FALLO: eE2 (ajena, no involucrada en la purga solicitada) no debió tocarse';
  end if;

  raise notice 'TEST 8 OK: guard de mezcla aborta ANTES de escribir — rollback completo, ninguna fila de la cadena desapareció';
end $$;

-- =========================================================================
-- TEST 8b (triggers siguen activos DESPUÉS de una purga FALLIDA/rollback):
-- misma verificación que TEST 5b (incluido el `reset role` — ver esa nota
-- para el porqué), ahora inmediatamente después de que el guard de mezcla
-- abortó TEST 8 — confirma que ni siquiera un intento de purga rechazado
-- deja el GUC de bypass "pegado" para nada más.
-- =========================================================================
do $$
begin
  reset role;
  begin
    delete from invoice_items where id = (select id from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ef05' limit 1);
    raise exception 'TEST 8b FALLO: invoice_items debió seguir protegido tras una purga fallida/rollback';
  exception when others then
    if sqlerrm like 'TEST 8b FALLO%' then raise; end if;
  end;
  begin
    delete from sales_fulfillment_items where id = (select id from sales_fulfillment_items where sales_fulfillment_id = '00000000-0000-0000-0000-00000000ef06' limit 1);
    raise exception 'TEST 8b FALLO: sales_fulfillment_items debió seguir protegido tras una purga fallida/rollback';
  exception when others then
    if sqlerrm like 'TEST 8b FALLO%' then raise; end if;
  end;
  begin
    delete from goods_receipt_items where id = (select id from goods_receipt_items where goods_receipt_id = '00000000-0000-0000-0000-00000000ef04' limit 1);
    raise exception 'TEST 8b FALLO: goods_receipt_items debió seguir protegido tras una purga fallida/rollback';
  exception when others then
    if sqlerrm like 'TEST 8b FALLO%' then raise; end if;
  end;
  set role authenticated;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  if not exists (select 1 from invoice_items where invoice_id = '00000000-0000-0000-0000-00000000ef05')
     or not exists (select 1 from sales_fulfillment_items where sales_fulfillment_id = '00000000-0000-0000-0000-00000000ef06')
     or not exists (select 1 from goods_receipt_items where goods_receipt_id = '00000000-0000-0000-0000-00000000ef04') then
    raise exception 'TEST 8b FALLO: la cadena oficial de referencia no debió perder ninguna línea';
  end if;
  raise notice 'TEST 8b OK: los tres freeze triggers siguen protegiendo datos oficiales normalmente después de una purga fallida/rollback';
end $$;

-- =========================================================================
-- TEST 9: listados oficiales excluyen prueba por defecto — verifica que
-- el flag soporta el patrón de filtro que usa la UI (WHERE is_test =
-- false por defecto, sin filtro = incluye pruebas).
-- =========================================================================
do $$
declare
  v_count_default integer;
  v_count_all integer;
begin
  select count(*) into v_count_default from sales_orders where organization_id = '00000000-0000-0000-0000-0000000000a1' and is_test = false;
  select count(*) into v_count_all from sales_orders where organization_id = '00000000-0000-0000-0000-0000000000a1';
  if v_count_all <= v_count_default then
    raise exception 'TEST 9 FALLO: debía haber al menos una Sales Order de prueba visible solo sin el filtro (default=%, total=%)', v_count_default, v_count_all;
  end if;
  raise notice 'TEST 9 OK: is_test soporta el filtro "ocultar prueba por defecto / incluir pruebas" (default=%, total=%)', v_count_default, v_count_all;
end $$;

select 'TODAS LAS PRUEBAS 0077 PASARON' as resultado;

rollback;
