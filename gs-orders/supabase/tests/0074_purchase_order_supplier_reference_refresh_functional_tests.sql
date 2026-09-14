-- THÖREN — Fix puntual: refrescar snapshots de proveedor de una Purchase
-- Order sin pasar por "Reemplazar partidas"
-- (0074_purchase_order_supplier_reference_refresh.sql) — pruebas
-- funcionales contra Postgres real. Fixtures 100% autocontenidas — no
-- depende de la cadena de fixtures de fases anteriores. Todo el script
-- corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set prepare_user '00000000-0000-0000-0000-000000000004'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_prepare '00000000-0000-0000-0000-0000000000b4'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p2 '00000000-0000-0000-0000-0000000000d2'
\set p_free '00000000-0000-0000-0000-0000000000d3'
\set sup1 '00000000-0000-0000-0000-0000000000f1'
\set sup_orgb '00000000-0000-0000-0000-0000000000f9'

insert into auth.users (id, email) values
  (:'admin', 'admin-74@test.local'),
  (:'prepare_user', 'prepare-74@test.local'),
  (:'admin_orgb', 'admin-orgb-74@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 74', 'test-org-74'),
  (:'org_b', 'Test Org 74B', 'test-org-74b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 74', 'admin', true),
  (:'admin_orgb', 'Admin Org B 74', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 74', 'VT74', true),
  (:'sp_prepare', :'org_a', 'Prepare Placeholder 74', 'PP74', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 74', 'VB74', true);

-- prepare_user: SOLO can_prepare_purchase_orders, NO admin — el fix debe
-- funcionar para este rol real (no solo para admin), ver DECISIÓN de
-- SECURITY DEFINER en la migración.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'prepare_user', 'Prepare User Test 74', 'vendedor', :'sp_prepare', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'prepare_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'prepare_user', 'can_prepare_purchase_orders', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 74', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 74', true);

-- p1: SIN supplier_product_reference todavía al momento de crear la PO
-- (reproduce el bug real: OC-20261409-009). p2: para el caso "solo hay
-- referencia inactiva". p_free: nunca tiene catalog_product_id en la
-- línea (línea libre) — el refresh debe ignorarla sin error.
insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Sin Referencia 74', 'SKU-P1-74', 'general', 'pza', true),
  (:'p2', :'org_a', 'Producto Con Referencia Inactiva 74', 'SKU-P2-74', 'general', 'pza', true);

insert into suppliers (id, organization_id, name, active) values
  (:'sup1', :'org_a', 'Proveedor Uno 74', true),
  (:'sup_orgb', :'org_b', 'Proveedor Org B 74', true);

-- p2 solo tiene una referencia INACTIVA para sup1 — nunca debe usarse.
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, preferred, active) values
  (:'p2', :'sup1', 'REF-P2-SUP1-INACTIVA', 'MODEL-P2-SUP1', false, false);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup: 2 Sales Orders (e1 con p1, e2 con p2) -> Requisición -> convertir
-- a Purchase Order (po1/po2), ambas originadas en Requisición
-- (order_id IS NULL) — mismo camino real que produjo el bug en
-- producción. Ninguna de las dos tiene referencia ACTIVA para su
-- producto al momento de convertir, así que ambas nacen con snapshot
-- NULL (bug reproducido a propósito).
-- =========================================================================
do $$
declare
  v_req1 purchase_requisitions;
  v_req2 purchase_requisitions;
  v_item1_so_item_id uuid;
  v_item2_so_item_id uuid;
  v_pri1_id uuid;
  v_pri2_id uuid;
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 5, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e1', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 500.00);

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d2', 'quantity', 4, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e2', 400.00);

  select id into v_item1_so_item_id from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e1';
  select id into v_item2_so_item_id from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e2';

  select * into v_req1 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-000000000021',
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e1'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item1_so_item_id, 'quantity_required', 5))
  );
  perform rpc_submit_purchase_requisition(v_req1.id);

  select * into v_req2 from rpc_create_purchase_requisition(
    '00000000-0000-0000-0000-000000000022',
    jsonb_build_object('sales_order_id', '00000000-0000-0000-0000-0000000000e2'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item2_so_item_id, 'quantity_required', 4))
  );
  perform rpc_submit_purchase_requisition(v_req2.id);

  select id into v_pri1_id from purchase_requisition_items where purchase_requisition_id = v_req1.id;
  select id into v_pri2_id from purchase_requisition_items where purchase_requisition_id = v_req2.id;

  -- po1 (bug reproducido): p1 SIN referencia activa todavía.
  perform rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-000000000031',
    v_req1.id, '00000000-0000-0000-0000-0000000000f1', array[v_pri1_id], '{}'::jsonb
  );

  -- po2: p2 solo tiene referencia INACTIVA.
  perform rpc_convert_requisition_to_purchase_order(
    '00000000-0000-0000-0000-000000000032',
    v_req2.id, '00000000-0000-0000-0000-0000000000f1', array[v_pri2_id], '{}'::jsonb
  );
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-ORGB-74', 'quantity', 1, 'unit_price', 10.00))
  );
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: PO de requisición con snapshot faltante — reproduce el bug tal
-- cual (OC-20261409-009): po1 (order_id NULL, status borrador) tiene su
-- única línea con snapshot de proveedor completamente vacío.
-- =========================================================================
do $$
declare
  v_po purchase_orders;
  v_item purchase_order_items;
begin
  select * into v_po from purchase_orders where id = '00000000-0000-0000-0000-000000000031';
  if v_po.order_id is not null or v_po.status <> 'borrador' then
    raise exception 'TEST 1 FALLO (setup): po1 debía tener order_id NULL y status borrador (order_id=%, status=%)', v_po.order_id, v_po.status;
  end if;

  select * into v_item from purchase_order_items where purchase_order_id = v_po.id;
  if v_item.supplier_sku_snapshot is not null or v_item.supplier_model_snapshot is not null then
    raise exception 'TEST 1 FALLO: el snapshot debía nacer vacío (bug reproducido), sku=%, model=%', v_item.supplier_sku_snapshot, v_item.supplier_model_snapshot;
  end if;

  raise notice 'TEST 1 OK: PO de requisición con snapshot de proveedor faltante reproducida';
end $$;

-- =========================================================================
-- TEST 2: agregar referencia activa y refrescar — prepare_user (SOLO
-- can_prepare_purchase_orders, NO admin) agrega la referencia en Catálogo
-- y llama rpc_refresh_purchase_order_supplier_references; el snapshot
-- aparece correctamente.
-- =========================================================================
do $$
declare
  v_item purchase_order_items;
  v_item_id_before uuid;
  v_quantity_before integer;
  v_catalog_before uuid;
  v_pri_before uuid;
  v_model_before text;
  v_description_before text;
  v_position_before integer;
begin
  insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, supplier_description, supplier_uom, active) values
    ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1', 'REF-P1-SUP1', 'MODEL-P1-SUP1', 'Descripcion del proveedor', 'PZA-PROV', true);

  select id, quantity_ordered, catalog_product_id, purchase_requisition_item_id, model, description, position
    into v_item_id_before, v_quantity_before, v_catalog_before, v_pri_before, v_model_before, v_description_before, v_position_before
    from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000031';

  perform test_set_user('00000000-0000-0000-0000-000000000004'); -- prepare_user
  perform rpc_refresh_purchase_order_supplier_references('00000000-0000-0000-0000-000000000031');
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  select * into v_item from purchase_order_items where id = v_item_id_before;
  if v_item.supplier_sku_snapshot <> 'REF-P1-SUP1' or v_item.supplier_model_snapshot <> 'MODEL-P1-SUP1'
     or v_item.supplier_description_snapshot <> 'Descripcion del proveedor' or v_item.supplier_uom_snapshot <> 'PZA-PROV' then
    raise exception 'TEST 2 FALLO: snapshot esperado (REF-P1-SUP1/MODEL-P1-SUP1/Descripcion del proveedor/PZA-PROV), fue (%, %, %, %)',
      v_item.supplier_sku_snapshot, v_item.supplier_model_snapshot, v_item.supplier_description_snapshot, v_item.supplier_uom_snapshot;
  end if;

  -- TEST 4 (no cambia cantidad/línea/proveedor) verificado aquí mismo: el
  -- refresh de un preparador no-admin no debe tocar NADA más de la línea.
  if v_item.id <> v_item_id_before or v_item.quantity_ordered <> v_quantity_before or v_item.catalog_product_id <> v_catalog_before
     or v_item.purchase_requisition_item_id <> v_pri_before or v_item.model <> v_model_before
     or v_item.description <> v_description_before or v_item.position <> v_position_before then
    raise exception 'TEST 4 FALLO: el refresh alteró identidad/cantidad/vínculo de la línea (id %, qty %, catalog %, pri %)',
      v_item.id, v_item.quantity_ordered, v_item.catalog_product_id, v_item.purchase_requisition_item_id;
  end if;
  if (select supplier_id from purchase_orders where id = '00000000-0000-0000-0000-000000000031') <> '00000000-0000-0000-0000-0000000000f1' then
    raise exception 'TEST 4 FALLO: el proveedor de la PO no debió cambiar';
  end if;

  raise notice 'TEST 2 OK: referencia activa agregada y refrescada por un preparador no-admin — snapshot correcto';
  raise notice 'TEST 4 OK: cantidad/línea/vínculo/proveedor permanecen exactamente iguales tras el refresh';
end $$;

-- =========================================================================
-- TEST 3: snapshot correcto (reafirmación explícita del ticket) + línea
-- libre ignorada sin error — agrega una línea libre (sin
-- catalog_product_id) a po1 vía UPDATE directo no aplica (las líneas ya
-- están congeladas fuera de creación/reemplazo); en vez de eso confirma
-- que el snapshot de la línea catalogada quedó persistido (no solo en el
-- valor de retorno) con una lectura fresca independiente.
-- =========================================================================
do $$
declare
  v_sku text;
begin
  select supplier_sku_snapshot into v_sku from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000031';
  if v_sku <> 'REF-P1-SUP1' then
    raise exception 'TEST 3 FALLO: el snapshot persistido no coincide (esperado REF-P1-SUP1, fue %)', v_sku;
  end if;
  raise notice 'TEST 3 OK: snapshot correcto y persistido de forma duradera (lectura fresca independiente)';
end $$;

-- =========================================================================
-- TEST 5: referencia inactiva NUNCA se usa — po2 (p2, solo referencia
-- inactiva) permanece con snapshot NULL después del refresh.
-- =========================================================================
do $$
declare
  v_item purchase_order_items;
begin
  perform rpc_refresh_purchase_order_supplier_references('00000000-0000-0000-0000-000000000032');

  select * into v_item from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000032';
  if v_item.supplier_sku_snapshot is not null or v_item.supplier_model_snapshot is not null then
    raise exception 'TEST 5 FALLO: una referencia INACTIVA nunca debió usarse (sku=%, model=%)', v_item.supplier_sku_snapshot, v_item.supplier_model_snapshot;
  end if;

  raise notice 'TEST 5 OK: una referencia inactiva nunca se usa — snapshot permanece vacío';
end $$;

-- =========================================================================
-- TEST 6: cross-org bloqueado — admin de Org B no puede refrescar
-- referencias de una Purchase Order de Org A.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  begin
    perform rpc_refresh_purchase_order_supplier_references('00000000-0000-0000-0000-000000000031');
    raise exception 'TEST 6 FALLO: no debió poder refrescar referencias de una Purchase Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 6 OK: cross-org bloqueado';
end $$;

-- =========================================================================
-- TEST 7: rollback — solo aplica a POs en 'borrador'. po1 ya tiene
-- snapshot completo (TEST 2), así que puede salir de borrador; se avanza
-- a 'ordenada' y el intento posterior de refrescar se rechaza SIN dejar
-- ningún rastro (snapshot/updated_at exactamente iguales a como quedaron
-- antes del intento) — la validación de status ocurre ANTES de cualquier
-- lectura/escritura sobre las líneas, así que un rechazo nunca deja un
-- cambio parcial.
-- =========================================================================
do $$
declare
  v_snapshot_before record;
  v_snapshot_after record;
begin
  perform rpc_update_purchase_order_status('00000000-0000-0000-0000-000000000031', 'ordenada');

  select supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot, updated_at
    into v_snapshot_before
    from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000031';

  begin
    perform rpc_refresh_purchase_order_supplier_references('00000000-0000-0000-0000-000000000031');
    raise exception 'TEST 7 FALLO: no debió permitir refrescar referencias de una Purchase Order fuera de borrador';
  exception when others then
    if sqlerrm like 'TEST 7 FALLO%' then raise; end if;
  end;

  select supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot, updated_at
    into v_snapshot_after
    from purchase_order_items where purchase_order_id = '00000000-0000-0000-0000-000000000031';

  if v_snapshot_before.supplier_sku_snapshot is distinct from v_snapshot_after.supplier_sku_snapshot
     or v_snapshot_before.updated_at is distinct from v_snapshot_after.updated_at then
    raise exception 'TEST 7 FALLO: el intento rechazado NO debió dejar ningún rastro (updated_at o snapshot cambiados)';
  end if;

  raise notice 'TEST 7 OK: rollback — fuera de borrador se rechaza sin dejar ningún rastro parcial';
end $$;

select 'TODAS LAS PRUEBAS 0074 PASARON' as resultado;

rollback;
