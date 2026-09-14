-- THÖREN — Sales Order → Procurement (0069_sales_order_procurement.sql) —
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set compras_user '00000000-0000-0000-0000-000000000004'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_compras '00000000-0000-0000-0000-0000000000b3'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p2 '00000000-0000-0000-0000-0000000000d2'
\set p3 '00000000-0000-0000-0000-0000000000d3'
\set sup1 '00000000-0000-0000-0000-0000000000f1'
\set sup2 '00000000-0000-0000-0000-0000000000f2'
\set sup_orgb '00000000-0000-0000-0000-0000000000f9'
\set so_draft '00000000-0000-0000-0000-0000000000e1'
\set so_blocked '00000000-0000-0000-0000-0000000000e2'
\set so_released '00000000-0000-0000-0000-0000000000e3'
\set so_orgb '00000000-0000-0000-0000-0000000000e9'
\set req1 '00000000-0000-0000-0000-000000000021'
\set req2 '00000000-0000-0000-0000-000000000022'
\set po1 '00000000-0000-0000-0000-000000000031'
\set po2 '00000000-0000-0000-0000-000000000032'
\set po_rollback '00000000-0000-0000-0000-000000000033'

insert into auth.users (id, email) values
  (:'admin', 'admin-69@test.local'),
  (:'compras_user', 'compras-69@test.local'),
  (:'admin_orgb', 'admin-orgb-69@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 69', 'test-org-69'),
  (:'org_b', 'Test Org 69B', 'test-org-69b');

-- Bootstrap corre TODAVÍA como superusuario (antes de `set role
-- authenticated`) — mismo criterio que 0067/0068.
insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 69', 'admin', true),
  (:'admin_orgb', 'Admin Org B 69', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 69', 'VT69', true),
  (:'sp_compras', :'org_a', 'Compras Placeholder 69', 'CP69', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 69', 'VB69', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'compras_user', 'Compras User Test 69', 'vendedor', :'sp_compras', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'compras_user', 'vendedor', true);

-- compras_user recibe can_prepare_purchase_orders — otorgado por ADMIN.
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'compras_user', 'can_prepare_purchase_orders', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 69', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 69', true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Con Referencia 69', 'SKU-P1-69', 'general', 'pza', true),
  (:'p2', :'org_a', 'Producto Con Referencia Inactiva 69', 'SKU-P2-69', 'general', 'pza', true),
  -- Exclusivo de TEST 20: nunca referenciado por ninguna Purchase Order en
  -- este archivo, para que rpc_inventory_incoming_by_product() (usada por
  -- fn_order_product_shortage) nunca cuente "incoming" para él y el
  -- shortage del Pedido de ese test sea siempre real.
  (:'p3', :'org_a', 'Producto Exclusivo Test 20 69', 'SKU-P3-69', 'general', 'pza', true);

insert into suppliers (id, organization_id, name, active) values
  (:'sup1', :'org_a', 'Proveedor Uno 69', true),
  (:'sup2', :'org_a', 'Proveedor Dos 69', true),
  (:'sup_orgb', :'org_b', 'Proveedor Org B 69', true);

-- p1 tiene una referencia ACTIVA + PREFERRED a sup1 (debe sugerirse sola).
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, preferred, active) values
  (:'p1', :'sup1', 'REF-P1-SUP1', 'MODEL-P1-SUP1', true, true);

-- p2 SOLO tiene una referencia INACTIVA (preferred=false porque preferred
-- exige active, ver 0066) — nunca debe sugerirse automáticamente.
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, preferred, active) values
  (:'p2', :'sup2', 'REF-P2-SUP2-INACTIVA', 'MODEL-P2-SUP2', false, false);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Sales Orders (draft / blocked / released) + org B.
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
  -- 2 líneas: A (catálogo, qty 10) y B (línea libre, qty 5).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 10, 'unit_price', 100.00),
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-69', 'quantity', 5, 'unit_price', 50.00)
    )
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 1250.00);
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-ORGB-69', 'quantity', 1, 'unit_price', 10.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e9', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e9', 10.00);
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- Resuelve los sales_order_item_id reales de SO_RELEASED (A=catálogo, B=línea libre).
select id as item_a into temporary temp_item_a from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e3' and catalog_product_id = '00000000-0000-0000-0000-0000000000d1';
select id as item_b into temporary temp_item_b from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e3' and catalog_product_id is null;

-- =========================================================================
-- TEST 1: SO draft no puede generar requisición.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_purchase_requisition(
      '00000000-0000-0000-0000-0000000000aa',
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e1'),
      '[]'::jsonb
    );
    raise exception 'TEST 1 FALLO: no debió permitir requisición desde una SO en draft';
  exception when others then
    if sqlerrm like 'TEST 1 FALLO%' then raise; end if;
    raise notice 'TEST 1 OK: SO draft rechazada como origen (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 2: SO bloqueada financieramente no puede generar requisición.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_purchase_requisition(
      '00000000-0000-0000-0000-0000000000aa',
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e2'),
      '[]'::jsonb
    );
    raise exception 'TEST 2 FALLO: no debió permitir requisición desde una SO bloqueada financieramente';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
    raise notice 'TEST 2 OK: SO blocked rechazada como origen (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 3: SO released SÍ puede — crea la requisición con 2 líneas
-- (catálogo con referencia preferred+active, y línea libre — regla 7).
-- =========================================================================
do $$
declare
  v_req purchase_requisitions;
  v_count integer;
  v_item_a_pref_supplier uuid;
  v_item_a_ref uuid;
begin
  select * into v_req from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-000000000021',
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3', 'notes', 'Requisicion de prueba'),
    jsonb_build_array(
      jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_required', 6),
      jsonb_build_object('sales_order_item_id', (select item_b from temp_item_b), 'quantity_required', 5)
    )
  );

  if v_req.status <> 'draft' then
    raise exception 'TEST 3 FALLO: status esperado draft, fue %', v_req.status;
  end if;
  if v_req.requisition_number is null or btrim(v_req.requisition_number) = '' then
    raise exception 'TEST 3 FALLO: requisition_number no fue asignado';
  end if;

  select count(*) into v_count from purchase_requisition_items where purchase_requisition_id = v_req.id;
  if v_count <> 2 then
    raise exception 'TEST 3 FALLO: se esperaban 2 líneas, hubo %', v_count;
  end if;

  raise notice 'TEST 3 OK: SO released genera requisición (draft) con sus líneas';
end $$;

-- =========================================================================
-- TEST 4 (regla 7): línea libre soportada — el item de la línea libre
-- quedó guardado con catalog_product_id NULL y su propio sku como
-- description_snapshot.
-- =========================================================================
do $$
declare
  v_desc text;
  v_cat uuid;
begin
  select description_snapshot, catalog_product_id into v_desc, v_cat
    from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021'
      and sales_order_item_id = (select item_b from temp_item_b);

  if v_cat is not null or v_desc <> 'FREE-69' then
    raise exception 'TEST 4 FALLO: esperado (catalog_product_id NULL, description FREE-69), fue (%, %)', v_cat, v_desc;
  end if;
  raise notice 'TEST 4 OK: línea libre de Sales Order soportada en la requisición (catalog_product_id NULL, snapshot correcto)';
end $$;

-- =========================================================================
-- TEST 5 (regla 4): quantity_required > 0.
-- =========================================================================
do $$
begin
  begin
    perform rpc_update_purchase_requisition(
      '00000000-0000-0000-0000-000000000021',
      jsonb_build_object('notes', 'edit'),
      jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_required', 0))
    );
    raise exception 'TEST 5 FALLO: debió rechazar quantity_required = 0';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
    raise notice 'TEST 5 OK: quantity_required <= 0 rechazado (%)', sqlerrm;
  end;
end $$;

-- Restaura las 2 líneas válidas (el intento fallido de TEST 5 no debió
-- dejar la requisición sin líneas — se verifica de paso).
do $$
declare
  v_count integer;
begin
  perform rpc_update_purchase_requisition(
    '00000000-0000-0000-0000-000000000021',
    jsonb_build_object('notes', 'Requisicion de prueba'),
    jsonb_build_array(
      jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_required', 6),
      jsonb_build_object('sales_order_item_id', (select item_b from temp_item_b), 'quantity_required', 5)
    )
  );
  select count(*) into v_count from purchase_requisition_items where purchase_requisition_id = '00000000-0000-0000-0000-000000000021';
  if v_count <> 2 then
    raise exception 'TEST 5b FALLO: se esperaban 2 líneas tras restaurar, hubo %', v_count;
  end if;
  raise notice 'TEST 5b OK: requisición draft editable (rpc_update_purchase_requisition reemplaza líneas atómicamente)';
end $$;

-- =========================================================================
-- TEST 6 (regla 6): no sobre-requisicionar una misma línea de SO. item_a
-- tiene quantity=10 en la SO; ya hay 6 requisicionados en g1 — un segundo
-- intento con 5 más (6+5=11 > 10) debe rechazarse.
-- =========================================================================
do $$
declare
  v_req2 purchase_requisitions;
begin
  begin
    select * into v_req2 from rpc_create_purchase_requisition(
      '00000000-0000-0000-0000-0000000000ab',
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e3'),
      jsonb_build_array(jsonb_build_object('sales_order_item_id', (select item_a from temp_item_a), 'quantity_required', 5))
    );
    raise exception 'TEST 6 FALLO: debió rechazar sobre-requisicionar la misma línea de SO (6+5=11 > 10)';
  exception when others then
    if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
    raise notice 'TEST 6 OK: sobre-requisición de la misma línea de SO rechazada (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 7 (regla 9): supplier reference inactive NUNCA se usa
-- automáticamente — item con p2 (solo tiene una referencia inactiva) debe
-- quedar sin proveedor sugerido.
-- =========================================================================
do $$
declare
  v_so2 sales_orders;
  v_so2_item_id uuid;
  v_req3 purchase_requisitions;
  v_pref uuid;
  v_ref uuid;
begin
  -- SO adicional solo para tener una línea con p2 (referencia inactiva).
  select * into v_so2 from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d2', 'quantity', 4, 'unit_price', 20.00))
  );
  perform rpc_update_sales_order_status(v_so2.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so2.id, 80.00);

  select id into v_so2_item_id from sales_order_items where sales_order_id = v_so2.id;

  select * into v_req3 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-0000000000ac',
    jsonb_build_object('sales_order_id', v_so2.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_so2_item_id, 'quantity_required', 4))
  );

  select preferred_supplier_id, supplier_product_reference_id into v_pref, v_ref
    from purchase_requisition_items where purchase_requisition_id = v_req3.id;

  if v_pref is not null or v_ref is not null then
    raise exception 'TEST 7 FALLO: una referencia inactiva NUNCA debió sugerirse (preferred=%, ref=%)', v_pref, v_ref;
  end if;
  raise notice 'TEST 7 OK: referencia de proveedor inactiva nunca se usa automáticamente';

  -- Además: seleccionarla EXPLÍCITAMENTE también debe rechazarse.
  begin
    perform rpc_update_purchase_requisition(
      v_req3.id,
      jsonb_build_object('notes', null),
      jsonb_build_array(jsonb_build_object(
        'sales_order_item_id', v_so2_item_id, 'quantity_required', 4,
        'supplier_product_reference_id', (select id from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000d2')
      ))
    );
    raise exception 'TEST 7b FALLO: no debió aceptar seleccionar explícitamente una referencia inactiva';
  exception when others then
    if sqlerrm like 'TEST 7b FALLO%' then raise; end if;
    raise notice 'TEST 7b OK: seleccionar explícitamente una referencia inactiva también es rechazado (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 8 (regla 8): preferred+active SÍ se sugiere correctamente
-- (item_a, producto p1, referencia a sup1).
-- =========================================================================
do $$
declare
  v_pref uuid;
  v_ref uuid;
begin
  select preferred_supplier_id, supplier_product_reference_id into v_pref, v_ref
    from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021'
      and sales_order_item_id = (select item_a from temp_item_a);

  if v_pref <> '00000000-0000-0000-0000-0000000000f1' then
    raise exception 'TEST 8 FALLO: preferred_supplier_id esperado sup1, fue %', v_pref;
  end if;
  if v_ref is null then
    raise exception 'TEST 8 FALLO: supplier_product_reference_id no fue sugerido';
  end if;
  raise notice 'TEST 8 OK: referencia preferred+active se sugiere automáticamente (proveedor %, referencia %)', v_pref, v_ref;
end $$;

-- =========================================================================
-- TEST 9: submit + "submitted no editable libremente".
-- =========================================================================
do $$
declare
  v_req purchase_requisitions;
begin
  select * into v_req from rpc_submit_purchase_requisition('00000000-0000-0000-0000-000000000021');
  if v_req.status <> 'submitted' then
    raise exception 'TEST 9 FALLO: status esperado submitted, fue %', v_req.status;
  end if;

  begin
    perform rpc_update_purchase_requisition(
      '00000000-0000-0000-0000-000000000021',
      jsonb_build_object('notes', 'intento'),
      '[]'::jsonb
    );
    raise exception 'TEST 9 FALLO: no debió permitir editar una requisición submitted vía rpc_update_purchase_requisition';
  exception when others then
    if sqlerrm like 'TEST 9 FALLO%' then raise; end if;
  end;

  begin
    update purchase_requisition_items set quantity_required = 1
      where purchase_requisition_id = '00000000-0000-0000-0000-000000000021' and sales_order_item_id = (select item_a from temp_item_a);
    raise exception 'TEST 9 FALLO: no debió permitir un UPDATE directo de quantity_required fuera de draft';
  exception when others then
    if sqlerrm like 'TEST 9 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 9 OK: submit funciona y una requisición submitted no es editable libremente (RPC ni UPDATE directo)';
end $$;

-- =========================================================================
-- TEST 10: convertir a PO crea una PO válida (línea A -> sup1, usando la
-- referencia sugerida).
-- =========================================================================
do $$
declare
  v_po purchase_orders;
  v_item_a_req_id uuid;
  v_poi purchase_order_items;
begin
  select id into v_item_a_req_id from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021' and sales_order_item_id = (select item_a from temp_item_a);

  select * into v_po from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-000000000031',
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-0000000000f1',
    array[v_item_a_req_id],
    '{}'::jsonb
  );

  if v_po.order_id is not null then
    raise exception 'TEST 10 FALLO: order_id debía ser NULL (PO originada en requisición), fue %', v_po.order_id;
  end if;
  if v_po.supplier_id <> '00000000-0000-0000-0000-0000000000f1' or v_po.status <> 'borrador' then
    raise exception 'TEST 10 FALLO: supplier_id/status esperados (sup1, borrador), fueron (%, %)', v_po.supplier_id, v_po.status;
  end if;

  select * into v_poi from purchase_order_items where purchase_order_id = v_po.id;
  if v_poi.purchase_requisition_item_id <> v_item_a_req_id or v_poi.quantity_ordered <> 6 then
    raise exception 'TEST 10 FALLO: vínculo/cantidad de la partida incorrectos (vínculo %, cantidad %)', v_poi.purchase_requisition_item_id, v_poi.quantity_ordered;
  end if;
  if v_poi.supplier_sku_snapshot <> 'REF-P1-SUP1' then
    raise exception 'TEST 10 FALLO: supplier_sku_snapshot esperado REF-P1-SUP1, fue %', v_poi.supplier_sku_snapshot;
  end if;

  raise notice 'TEST 10 OK: convertir a PO crea una Purchase Order válida (order_id NULL, vínculo a la requisición, snapshot de proveedor)';
end $$;

-- =========================================================================
-- TEST 11: quantity_ordered se actualiza correctamente en la requisición.
-- =========================================================================
do $$
declare
  v_ordered integer;
begin
  select quantity_ordered into v_ordered from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021' and sales_order_item_id = (select item_a from temp_item_a);
  if v_ordered <> 6 then
    raise exception 'TEST 11 FALLO: quantity_ordered esperado 6, fue %', v_ordered;
  end if;
  raise notice 'TEST 11 OK: quantity_ordered de la línea convertida se actualizó correctamente (6)';
end $$;

-- =========================================================================
-- TEST 12: requisition pasa a partially_ordered (línea A cubierta, línea
-- B (libre, qty 5) todavía en 0).
-- =========================================================================
do $$
declare
  v_status text;
begin
  select status into v_status from purchase_requisitions where id = '00000000-0000-0000-0000-000000000021';
  if v_status <> 'partially_ordered' then
    raise exception 'TEST 12 FALLO: status esperado partially_ordered, fue %', v_status;
  end if;
  raise notice 'TEST 12 OK: requisición pasa a partially_ordered cuando solo parte de sus líneas está cubierta';
end $$;

-- =========================================================================
-- TEST 13: múltiples proveedores permiten múltiples POs — línea B (libre)
-- se convierte a sup2, en una PO SEPARADA.
-- =========================================================================
do $$
declare
  v_po2 purchase_orders;
  v_item_b_req_id uuid;
begin
  select id into v_item_b_req_id from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021' and sales_order_item_id = (select item_b from temp_item_b);

  select * into v_po2 from rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-000000000032',
    '00000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-0000000000f2',
    array[v_item_b_req_id],
    '{}'::jsonb
  );

  if v_po2.id = '00000000-0000-0000-0000-000000000031' or v_po2.supplier_id <> '00000000-0000-0000-0000-0000000000f2' then
    raise exception 'TEST 13 FALLO: se esperaba una PO NUEVA con supplier sup2, fue % / %', v_po2.id, v_po2.supplier_id;
  end if;
  raise notice 'TEST 13 OK: una misma requisición genera múltiples POs cuando sus líneas van a proveedores distintos';
end $$;

-- =========================================================================
-- TEST 14: requisition pasa a ordered cuando TODO queda cubierto.
-- =========================================================================
do $$
declare
  v_status text;
begin
  select status into v_status from purchase_requisitions where id = '00000000-0000-0000-0000-000000000021';
  if v_status <> 'ordered' then
    raise exception 'TEST 14 FALLO: status esperado ordered, fue %', v_status;
  end if;
  raise notice 'TEST 14 OK: requisición pasa a ordered cuando la cobertura total se completa';
end $$;

-- =========================================================================
-- TEST 15: rollback de conversión conserva la requisición intacta si la
-- PO falla — se arma una requisición nueva (g2) con 1 línea de 4
-- unidades y se intenta convertir la MISMA línea dos veces en la misma
-- llamada (duplicado en el array): la primera pasada la cubre por
-- completo, la segunda pasada encuentra "ya está completamente ordenada"
-- y debe abortar TODO, incluida la PO recién insertada.
-- =========================================================================
do $$
declare
  v_so_rb sales_orders;
  v_so2_item_id uuid;
  v_req2 purchase_requisitions;
  v_req2_item_id uuid;
  v_po_count_before integer;
  v_po_count_after integer;
  v_ordered_before integer;
  v_ordered_after integer;
  v_status_before text;
  v_status_after text;
begin
  -- Sales Order NUEVA e independiente, exclusiva de este test — nunca
  -- reutiliza una línea ya consumida por otra prueba (TEST 7 ya agotó por
  -- completo la línea de p2 usada ahí).
  select * into v_so_rb from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e6',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'ROLLBACK-69', 'quantity', 4, 'unit_price', 25.00))
  );
  perform rpc_update_sales_order_status(v_so_rb.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so_rb.id, 100.00);

  select id into v_so2_item_id from sales_order_items where sales_order_id = v_so_rb.id;

  select * into v_req2 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-000000000022',
    jsonb_build_object('sales_order_id', v_so_rb.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_so2_item_id, 'quantity_required', 4))
  );
  perform rpc_submit_purchase_requisition(v_req2.id);

  select id into v_req2_item_id from purchase_requisition_items where purchase_requisition_id = v_req2.id;

  select quantity_ordered into v_ordered_before from purchase_requisition_items where id = v_req2_item_id;
  select status into v_status_before from purchase_requisitions where id = v_req2.id;
  select count(*) into v_po_count_before from purchase_orders;

  begin
    perform rpc_convert_requisition_to_purchase_order(
      '00000000-0000-0000-0000-000000000033',
      v_req2.id,
      '00000000-0000-0000-0000-0000000000f1',
      array[v_req2_item_id, v_req2_item_id],
      '{}'::jsonb
    );
    raise exception 'TEST 15 FALLO: debió rechazar convertir la misma línea dos veces en la misma llamada';
  exception when others then
    if sqlerrm like 'TEST 15 FALLO%' then raise; end if;
  end;

  select quantity_ordered into v_ordered_after from purchase_requisition_items where id = v_req2_item_id;
  select status into v_status_after from purchase_requisitions where id = v_req2.id;
  select count(*) into v_po_count_after from purchase_orders;

  if v_ordered_before <> v_ordered_after or v_status_before <> v_status_after or v_po_count_before <> v_po_count_after
     or exists (select 1 from purchase_orders where id = '00000000-0000-0000-0000-000000000033') then
    raise exception 'TEST 15 FALLO: el estado cambió tras una conversión rechazada (ordered % -> %, status % -> %, POs % -> %)',
      v_ordered_before, v_ordered_after, v_status_before, v_status_after, v_po_count_before, v_po_count_after;
  end if;

  raise notice 'TEST 15 OK: rollback completo — la requisición (quantity_ordered/status) y el conteo de POs quedan exactamente igual tras una conversión fallida';
end $$;

-- =========================================================================
-- TEST 16: cross-org bloqueado — un admin de Org A no puede crear una
-- requisición para una Sales Order de Org B, ni convertir usando un
-- proveedor de Org B.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_purchase_requisition(
      '00000000-0000-0000-0000-0000000000ad',
      jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e9'),
      '[]'::jsonb
    );
    raise exception 'TEST 16 FALLO: no debió poder crear una requisición para una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_convert_requisition_to_purchase_order(
      '00000000-0000-0000-0000-000000000034',
      '00000000-0000-0000-0000-000000000021',
      '00000000-0000-0000-0000-0000000000f9',
      array[]::uuid[],
      '{}'::jsonb
    );
    raise exception 'TEST 16 FALLO: no debió poder convertir usando un proveedor de otra organización';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 16 OK: cross-org bloqueado (crear requisición y convertir a PO)';
end $$;

-- =========================================================================
-- TEST 17: RLS correcto — admin de Org B no ve requisiciones, líneas ni
-- eventos de Org A.
-- =========================================================================
do $$
declare
  v_count_req integer;
  v_count_items integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_count_req from purchase_requisitions where id = '00000000-0000-0000-0000-000000000021';
  select count(*) into v_count_items from purchase_requisition_items where purchase_requisition_id = '00000000-0000-0000-0000-000000000021';
  select count(*) into v_count_events from purchase_requisition_events where purchase_requisition_id = '00000000-0000-0000-0000-000000000021';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_req <> 0 or v_count_items <> 0 or v_count_events <> 0 then
    raise exception 'TEST 17 FALLO: admin de Org B pudo ver datos de una requisición de Org A (%/%/%)', v_count_req, v_count_items, v_count_events;
  end if;
  raise notice 'TEST 17 OK: aislamiento cross-org respetado por purchase_requisitions/items/events';
end $$;

-- =========================================================================
-- TEST 18 (bonus): compras_user (can_prepare_purchase_orders, NO admin,
-- NO dueño de la SO) puede crear/enviar/convertir una requisición —
-- confirma que la ampliación de visibilidad de sales_orders (sección 11
-- de 0069) funciona en la práctica.
-- =========================================================================
do $$
declare
  v_so3 sales_orders;
  v_so3_item_id uuid;
  v_req4 purchase_requisitions;
begin
  select * into v_so3 from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e5',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'COMPRAS-69', 'quantity', 2, 'unit_price', 10.00))
  );
  perform rpc_update_sales_order_status(v_so3.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so3.id, 20.00);

  perform test_set_user('00000000-0000-0000-0000-000000000004');

  select id into v_so3_item_id from sales_order_items where sales_order_id = v_so3.id;

  select * into v_req4 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-000000000023',
    jsonb_build_object('sales_order_id', v_so3.id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_so3_item_id, 'quantity_required', 2))
  );
  perform rpc_submit_purchase_requisition(v_req4.id);

  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_req4.organization_id <> '00000000-0000-0000-0000-0000000000a1' then
    raise exception 'TEST 18 FALLO: organization_id inesperado %', v_req4.organization_id;
  end if;
  raise notice 'TEST 18 OK: un usuario con can_prepare_purchase_orders (sin ser admin ni dueño de la SO) puede crear y enviar una requisición';
end $$;

-- =========================================================================
-- TEST 19 (regresión post-aprobación): rpc_replace_purchase_order_items
-- rechaza EXPLÍCITAMENTE editar partidas de una Purchase Order originada
-- en Requisición (order_id NULL, po1 de TEST 10) — antes del fix, el WHERE
-- `order_id = v_po.order_id` contra `order_items` nunca comparaba
-- verdadero con NULL, así que cualquier envío fallaba por un efecto
-- colateral ("no pertenece al Pedido de origen") DESPUÉS de ya haber
-- borrado las partidas reales (ligadas a la Requisición) — la transacción
-- se revertía igual, pero por el motivo equivocado. Ver DECISIÓN en la
-- migración, sección 19.
-- =========================================================================
do $$
begin
  begin
    perform rpc_replace_purchase_order_items(
      '00000000-0000-0000-0000-000000000031',
      jsonb_build_array(jsonb_build_object('order_item_id', gen_random_uuid(), 'quantity_ordered', 1))
    );
    raise exception 'TEST 19 FALLO: no debió permitir reemplazar partidas de una PO originada en Requisición';
  exception when others then
    if sqlerrm like 'TEST 19 FALLO%' then raise; end if;
    if sqlerrm not like '%proviene de una Requisición%' then
      raise exception 'TEST 19 FALLO: se esperaba el mensaje explícito del guard nuevo, se obtuvo: %', sqlerrm;
    end if;
  end;

  -- La PO originada en Requisición conserva sus partidas reales intactas
  -- (el guard rechaza ANTES del delete, a diferencia del comportamiento
  -- previo al fix).
  if not exists (select 1 from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000031') then
    raise exception 'TEST 19 FALLO: las partidas originales de po1 no debieron perderse';
  end if;

  raise notice 'TEST 19 OK: rpc_replace_purchase_order_items rechaza explícitamente (mensaje claro) editar partidas de una PO originada en Requisición, sin tocar sus partidas reales';
end $$;

-- =========================================================================
-- TEST 20 (regresión post-aprobación): rpc_allocate_purchase_requirement
-- ya NO permite en silencio asignar una necesidad de compra de un Pedido
-- (purchase_requirements, order_id siempre NOT NULL) a la partida de una
-- Purchase Order de origen TOTALMENTE distinto (Requisición, order_id
-- NULL) — antes del fix, `v_po.order_id <> v_req.order_id` con
-- v_po.order_id = NULL evaluaba a NULL (SQL de tres valores), un
-- `if NULL then` en PL/pgSQL se trata como FALSO, y la validación se
-- saltaba en silencio dejando pasar la asignación cruzada.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_requirement_id uuid;
  v_poi_id uuid;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'Test 0069 Regresion 20', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto Exclusivo Test 20 69', 'quantity', 3, 'catalog_product_id', '00000000-0000-0000-0000-0000000000d3'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_sync_order_procurement(v_order_id);

  select id into v_requirement_id from purchase_requirements
    where order_id = v_order_id and catalog_product_id = '00000000-0000-0000-0000-0000000000d3';
  if v_requirement_id is null then
    raise exception 'TEST 20 SETUP FALLO: no se generó la necesidad de compra esperada para el fixture del test';
  end if;

  -- Partida de po1 (TEST 10, PO originada en Requisición, order_id NULL) —
  -- producto DISTINTO (d1) a propósito: el fix de esta sección rechaza por
  -- order_id NULL ANTES de llegar siquiera a comparar producto (mismo
  -- orden de validación que la función original), así que sigue probando
  -- exactamente la regresión aunque los productos no coincidan.
  select id into v_poi_id from purchase_order_items
    where purchase_order_id = '00000000-0000-0000-0000-000000000031' and catalog_product_id = '00000000-0000-0000-0000-0000000000d1';
  if v_poi_id is null then
    raise exception 'TEST 20 SETUP FALLO: no se encontró la partida de po1 esperada';
  end if;

  begin
    perform rpc_allocate_purchase_requirement(v_requirement_id, v_poi_id, 1);
    raise exception 'TEST 20 FALLO: no debió permitir asignar una necesidad de un Pedido a la partida de una PO originada en Requisición (order_id NULL)';
  exception when others then
    if sqlerrm like 'TEST 20 FALLO%' then raise; end if;
    if sqlerrm not like '%Pedido distinto%' then
      raise exception 'TEST 20 FALLO: se esperaba el mensaje de "Pedido distinto", se obtuvo: %', sqlerrm;
    end if;
  end;

  raise notice 'TEST 20 OK: rpc_allocate_purchase_requirement rechaza correctamente una PO con order_id NULL en vez de saltarse la validación en silencio (fix post-auditoría)';
end $$;

-- =========================================================================
-- TEST 21 (auditoría de seguridad post-aprobación): las funciones puente
-- SECURITY DEFINER agregadas en 0069 (fn_purchase_order_requisition_owner_salesperson,
-- fn_requisition_item_owner_salesperson) NO filtran el salesperson_id de
-- Org A a un usuario de Org B que las invoque DIRECTAMENTE (no a través de
-- la policy que las usa, tal como podría hacerlo cualquier usuario
-- autenticado vía PostgREST — Postgres otorga EXECUTE a PUBLIC por
-- default) con el id de una PO/línea de Org A — deben devolver NULL, igual
-- que si el id no existiera, gracias al filtro
-- `organization_id = current_user_organization_id()` agregado en la
-- auditoría.
-- =========================================================================
do $$
declare
  v_org_a_req_item_id uuid;
  v_leak_po uuid;
  v_leak_item uuid;
begin
  select id into v_org_a_req_item_id from purchase_requisition_items
    where purchase_requisition_id = '00000000-0000-0000-0000-000000000021' limit 1;
  if v_org_a_req_item_id is null then
    raise exception 'TEST 21 SETUP FALLO: no se encontró una línea de requisición de Org A para el fixture del test';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb (Org B)

  select fn_purchase_order_requisition_owner_salesperson('00000000-0000-0000-0000-000000000031') into v_leak_po;
  select fn_requisition_item_owner_salesperson(v_org_a_req_item_id) into v_leak_item;

  perform test_set_user('00000000-0000-0000-0000-000000000001'); -- admin (Org A)

  if v_leak_po is not null or v_leak_item is not null then
    raise exception 'TEST 21 FALLO: un admin de Org B pudo leer el salesperson_id de Org A vía las funciones puente SECURITY DEFINER (po=%, item=%)', v_leak_po, v_leak_item;
  end if;

  raise notice 'TEST 21 OK: las funciones puente SECURITY DEFINER no filtran datos de otra organización aunque se invoquen directamente, fuera de la policy que las usa';
end $$;

select 'TODAS LAS PRUEBAS 0069 PASARON' as resultado;

rollback;
