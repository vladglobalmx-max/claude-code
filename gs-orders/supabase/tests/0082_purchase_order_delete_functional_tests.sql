-- THÖREN — Eliminación segura de Orden de Compra
-- (0082_purchase_order_delete.sql) — pruebas funcionales contra Postgres
-- real. Fixtures 100% autocontenidas. Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000082', 'admin-82@test.local'),
  ('10000000-0000-0000-0000-000000000182', 'preparador-82@test.local'),
  ('10000000-0000-0000-0000-000000000282', 'vendedor-plano-82@test.local');

insert into organizations (id, name, slug) values
  ('20000000-0000-0000-0000-000000000082', 'Test Org 82', 'test-org-82');

insert into salespeople (id, organization_id, name, prefix, active) values
  ('30000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000082', 'Vend Prep 82', 'VP82', true),
  ('30000000-0000-0000-0000-000000000182', '20000000-0000-0000-0000-000000000082', 'Vend Plano 82', 'VN82', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  ('10000000-0000-0000-0000-000000000082', 'Admin Test 82', 'admin', null, true),
  ('10000000-0000-0000-0000-000000000182', 'Preparador Test 82', 'vendedor', '30000000-0000-0000-0000-000000000082', true),
  ('10000000-0000-0000-0000-000000000282', 'Vendedor Plano 82', 'vendedor', '30000000-0000-0000-0000-000000000182', true);

insert into organization_members (organization_id, user_id, role, active) values
  ('20000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000082', 'admin', true),
  ('20000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000182', 'vendedor', true),
  ('20000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000282', 'vendedor', true);

-- Preparador de Compras — NO admin, NO can_approve_purchase_orders, NO
-- can_receive_inventory — SOLO can_prepare_purchase_orders (para probar
-- exactamente la autoridad mínima que el ticket pide: "Admin o
-- can_prepare_purchase_orders"). Los pasos que requieren aprobar/recibir
-- (fuera de alcance de este ticket) los hace el admin en las fixtures.
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  ('20000000-0000-0000-0000-000000000082', '10000000-0000-0000-0000-000000000182', 'can_prepare_purchase_orders', '10000000-0000-0000-0000-000000000082');

set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000082');

insert into business_units (id, organization_id, name, code, active) values
  ('40000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000082', 'BU Test 82', 'bu_82', true);

insert into suppliers (id, organization_id, name, active) values
  ('60000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000082', 'Proveedor Test 82', true);

insert into warehouses (id, organization_id, name, code, active) values
  ('70000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000082', 'Almacen Test 82', 'ALM82', true);

insert into product_catalog (id, organization_id, category, sku, name, unit, active) values
  ('80000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000082', 'general', 'SKU-82', 'Producto Test 82', 'pza', true);

-- Requerida por rpc_update_purchase_order_status (0066) para poder sacar
-- una OC de borrador — sin esto, "Falta referencia del proveedor" bloquea
-- los tests que necesitan status 'ordenada' (4/5/6/7) antes de probar la
-- eliminación en sí.
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, supplier_description, supplier_uom, active) values
  ('80000000-0000-0000-0000-000000000082', '60000000-0000-0000-0000-000000000082', 'PROV-SKU-82', 'PROV-MODEL-82', 'Descripcion proveedor 82', 'PZA', true);

select 'FIXTURES OK' as marker;

select test_set_user('10000000-0000-0000-0000-000000000182');

-- =========================================================================
-- TEST 1: sin permiso -> bloquea. Un vendedor plano (sin can_prepare_
-- purchase_orders, sin ser admin) no puede eliminar ni siquiera una OC en
-- borrador sin ningún bloqueo de negocio.
-- =========================================================================
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform set_config('test.po1_id', v_po_id::text, false);
end $$;

select test_set_user('10000000-0000-0000-0000-000000000282');
do $$
begin
  begin
    perform rpc_delete_purchase_order(current_setting('test.po1_id')::uuid);
    raise exception 'TEST 1 FALLO: un vendedor plano sin autoridad no debio poder eliminar una Orden de Compra';
  exception when others then
    if sqlerrm like 'Solo un administrador%' then
      raise notice 'TEST 1 OK: rechazado sin autoridad (%).', sqlerrm;
    else
      raise exception 'TEST 1 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

select test_set_user('10000000-0000-0000-0000-000000000182');
do $$
begin
  if not exists (select 1 from purchase_orders where id = current_setting('test.po1_id')::uuid) then
    raise exception 'TEST 1 FALLO: la Orden de Compra NO debio eliminarse tras el intento sin autoridad';
  end if;
end $$;

-- =========================================================================
-- TEST 2: directa, borrador, sin recepción -> elimina. El preparador (con
-- can_prepare_purchase_orders, sin ser admin) puede eliminar su propia OC
-- en borrador. Partidas y encabezado desaparecen ambos.
-- =========================================================================
do $$
declare
  v_po_id uuid := gen_random_uuid();
  v_po purchase_orders;
  v_items_count integer;
begin
  v_po := rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  if v_po.origin <> 'directa' or v_po.status <> 'borrador' then
    raise exception 'TEST 2 FIXTURE FALLO: se esperaba origin=directa/status=borrador, fue origin=%/status=%', v_po.origin, v_po.status;
  end if;

  perform rpc_delete_purchase_order(v_po_id);

  if exists (select 1 from purchase_orders where id = v_po_id) then
    raise exception 'TEST 2 FALLO: el encabezado de la Orden de Compra debio eliminarse';
  end if;
  select count(*) into v_items_count from purchase_order_items where purchase_order_id = v_po_id;
  if v_items_count <> 0 then
    raise exception 'TEST 2 FALLO: las partidas debieron eliminarse junto con el encabezado (quedaron %)', v_items_count;
  end if;
  raise notice 'TEST 2 OK: OC directa en borrador sin recepción se elimina completa (encabezado + partidas)';
end $$;

-- =========================================================================
-- TEST 3: directa, cancelada, sin recepción -> elimina. Cancelar un
-- borrador SÍ es autoridad de preparación (0045/0066) — el mismo
-- preparador cancela y luego elimina.
-- =========================================================================
do $$
declare
  v_po_id uuid := gen_random_uuid();
  v_po purchase_orders;
begin
  v_po := rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform rpc_update_purchase_order_status(v_po_id, 'cancelada');

  select * into v_po from purchase_orders where id = v_po_id;
  if v_po.origin <> 'directa' or v_po.status <> 'cancelada' then
    raise exception 'TEST 3 FIXTURE FALLO: se esperaba origin=directa/status=cancelada, fue origin=%/status=%', v_po.origin, v_po.status;
  end if;

  perform rpc_delete_purchase_order(v_po_id);

  if exists (select 1 from purchase_orders where id = v_po_id) then
    raise exception 'TEST 3 FALLO: la Orden de Compra cancelada sin recepción debio poder eliminarse';
  end if;
  raise notice 'TEST 3 OK: OC directa cancelada sin recepción se elimina';
end $$;

-- =========================================================================
-- TEST 4: confirmada/ordenada -> bloquea. Sacar de borrador es autoridad
-- de aprobación (admin aquí) — una vez fuera de borrador, ningún status
-- distinto de 'cancelada' es eliminable.
-- =========================================================================
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform set_config('test.po4_id', v_po_id::text, false);
end $$;

select test_set_user('10000000-0000-0000-0000-000000000082');
do $$
begin
  perform rpc_update_purchase_order_status(current_setting('test.po4_id')::uuid, 'ordenada');
end $$;

select test_set_user('10000000-0000-0000-0000-000000000182');
do $$
begin
  begin
    perform rpc_delete_purchase_order(current_setting('test.po4_id')::uuid);
    raise exception 'TEST 4 FALLO: una OC en status ordenada NUNCA debio poder eliminarse';
  exception when others then
    if sqlerrm like 'Solo se puede eliminar una Orden de Compra en borrador o cancelada%' then
      raise notice 'TEST 4 OK: rechazado por status (%).', sqlerrm;
    else
      raise exception 'TEST 4 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
  if not exists (select 1 from purchase_orders where id = current_setting('test.po4_id')::uuid) then
    raise exception 'TEST 4 FALLO: la Orden de Compra NO debio eliminarse';
  end if;
end $$;

-- =========================================================================
-- TEST 5: con goods receipt (aunque siga en 'draft', sin postear) ->
-- bloquea. Se lleva la OC a 'ordenada' -> se crea una recepción DRAFT (NO
-- se postea, quantity_received sigue en 0) -> se cancela la OC (sí
-- permitido fuera de borrador, admin/can_approve) -> el intento de borrar
-- debe bloquearse por goods_receipts, NO por quantity_received (que sigue
-- en 0), demostrando que ambas reglas son independientes.
-- =========================================================================
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform set_config('test.po5_id', v_po_id::text, false);
end $$;

select test_set_user('10000000-0000-0000-0000-000000000082');
do $$
declare
  v_po_id uuid := current_setting('test.po5_id')::uuid;
  v_poi_id uuid;
  v_gr goods_receipts;
begin
  perform rpc_update_purchase_order_status(v_po_id, 'ordenada');

  select id into v_poi_id from purchase_order_items where purchase_order_id = v_po_id limit 1;

  select * into v_gr from rpc_create_goods_receipt(
    gen_random_uuid(),
    jsonb_build_object('purchase_order_id', v_po_id, 'warehouse_id', '70000000-0000-0000-0000-000000000082'),
    jsonb_build_array(jsonb_build_object('purchase_order_item_id', v_poi_id, 'quantity_received', 2))
  );
  if v_gr.status <> 'draft' then
    raise exception 'TEST 5 FIXTURE FALLO: la recepción debio quedar en draft (status=%)', v_gr.status;
  end if;

  perform rpc_update_purchase_order_status(v_po_id, 'cancelada');
end $$;

do $$
declare
  v_po_id uuid := current_setting('test.po5_id')::uuid;
  v_qty_received integer;
begin
  select coalesce(sum(quantity_received), 0) into v_qty_received from purchase_order_items where purchase_order_id = v_po_id;
  if v_qty_received <> 0 then
    raise exception 'TEST 5 FIXTURE FALLO: quantity_received debio seguir en 0 (una recepcion draft nunca la incrementa), fue %', v_qty_received;
  end if;

  begin
    perform rpc_delete_purchase_order(v_po_id);
    raise exception 'TEST 5 FALLO: una OC con una recepción asociada (aunque siga en draft) NUNCA debio poder eliminarse';
  exception when others then
    if sqlerrm like '%recepción(es) de mercancía asociada%' then
      raise notice 'TEST 5 OK: rechazado por goods_receipts asociado (%).', sqlerrm;
    else
      raise exception 'TEST 5 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

select test_set_user('10000000-0000-0000-0000-000000000182');

-- =========================================================================
-- TEST 6: con quantity_received > 0 -> bloquea, aislado (sin ninguna fila
-- en goods_receipts). En la práctica esto nunca ocurre así (ver DECISIÓN
-- 3 de la migración) — se fuerza el estado vía bypass de superusuario
-- (reset role) exclusivamente para probar esta regla de forma
-- independiente, no para simular un flujo real de la app.
-- =========================================================================
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform set_config('test.po6_id', v_po_id::text, false);
end $$;

select test_set_user('10000000-0000-0000-0000-000000000082');
do $$
begin
  perform rpc_update_purchase_order_status(current_setting('test.po6_id')::uuid, 'ordenada');
  perform rpc_update_purchase_order_status(current_setting('test.po6_id')::uuid, 'cancelada');
end $$;

reset role;
update purchase_order_items set quantity_received = 1 where purchase_order_id = current_setting('test.po6_id')::uuid;
set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000182');

do $$
declare
  v_po_id uuid := current_setting('test.po6_id')::uuid;
  v_gr_count integer;
begin
  select count(*) into v_gr_count from goods_receipts where purchase_order_id = v_po_id;
  if v_gr_count <> 0 then
    raise exception 'TEST 6 FIXTURE FALLO: este test debe aislar quantity_received SIN ningún goods_receipts (hubo %)', v_gr_count;
  end if;

  begin
    perform rpc_delete_purchase_order(v_po_id);
    raise exception 'TEST 6 FALLO: una OC con una partida con mercancía ya recibida NUNCA debio poder eliminarse';
  exception when others then
    if sqlerrm like '%mercancía ya recibida%' then
      raise notice 'TEST 6 OK: rechazado por quantity_received > 0 (%).', sqlerrm;
    else
      raise exception 'TEST 6 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 7 (extra, no pedido explícitamente en el ticket pero misma regla
-- codificada en el RPC — se prueba igual por completitud): con un
-- inventory_movement asociado -> bloquea, aislado de la misma forma
-- (bypass de superusuario, sin goods_receipts ni quantity_received).
-- =========================================================================
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000082', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000082', 'quantity_ordered', 5, 'unit_price', 100))
  );
  perform set_config('test.po7_id', v_po_id::text, false);
end $$;

select test_set_user('10000000-0000-0000-0000-000000000082');
do $$
begin
  perform rpc_update_purchase_order_status(current_setting('test.po7_id')::uuid, 'ordenada');
  perform rpc_update_purchase_order_status(current_setting('test.po7_id')::uuid, 'cancelada');
end $$;

reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, purchase_order_id, purchase_order_item_id, created_by_user_id, created_by_name)
  select
    '20000000-0000-0000-0000-000000000082',
    '80000000-0000-0000-0000-000000000082',
    '70000000-0000-0000-0000-000000000082',
    1,
    'recepcion_compra',
    poi.purchase_order_id,
    poi.id,
    '10000000-0000-0000-0000-000000000082',
    'Admin Test 82'
  from purchase_order_items poi
  where poi.purchase_order_id = current_setting('test.po7_id')::uuid
  limit 1;
set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000182');

do $$
declare v_po_id uuid := current_setting('test.po7_id')::uuid;
begin
  begin
    perform rpc_delete_purchase_order(v_po_id);
    raise exception 'TEST 7 FALLO: una OC con un movimiento de inventario asociado NUNCA debio poder eliminarse';
  exception when others then
    if sqlerrm like '%movimiento(s) de inventario asociado%' then
      raise notice 'TEST 7 OK: rechazado por inventory_movements asociado (%).', sqlerrm;
    else
      raise exception 'TEST 7 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 8: OC de Requisición de Compra -> SIEMPRE bloqueada, sin importar
-- status (ajuste de cierre). La primera versión de este RPC sí permitía
-- eliminar una PO de requisición en borrador, pero no podía revertir
-- quantity_ordered/status de la requisición de origen sin violar
-- trg_purchase_requisition_status_transition (0069, trinquete
-- estrictamente hacia adelante) — se bloquea por completo "por ahora" en
-- vez de dejar datos inconsistentes; diseñar la reversión correcta queda
-- fuera de alcance. Se prueba tanto en borrador como en cancelada (mismos
-- dos status que sí son eliminables para directa/pedido) para confirmar
-- que el bloqueo es por ORIGEN, no por status. Corre como admin
-- (autoridad financiera, trg_sales_order_financial_guard) — el preparador
-- de Compras no tiene por qué tener autoridad financiera de Ventas.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000082');
do $$
declare
  v_customer_id uuid := gen_random_uuid();
  v_so_id uuid := gen_random_uuid();
  v_so_item_id uuid := gen_random_uuid();
  v_req_id uuid := gen_random_uuid();
  v_req_item_id uuid := gen_random_uuid();
  v_po purchase_orders;
begin
  insert into customers (id, organization_id, name, active) values (v_customer_id, '20000000-0000-0000-0000-000000000082', 'Cliente SO 82', true);

  insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id, '20000000-0000-0000-0000-000000000082', v_customer_id, '30000000-0000-0000-0000-000000000082', 'SO-TEST-82', 1, 'MXN', '10000000-0000-0000-0000-000000000082', false);
  insert into sales_order_items (id, sales_order_id, catalog_product_id, sku_snapshot, quantity, unit_price, line_subtotal, line_total) values
    (v_so_item_id, v_so_id, '80000000-0000-0000-0000-000000000082', 'SKU-82', 4, 25, 100, 100);
  update sales_orders set payment_terms_type = 'credit' where id = v_so_id;
  update sales_orders set status = 'confirmed' where id = v_so_id;
  update sales_orders set financial_status = 'credit_approved', fulfillment_release_status = 'released' where id = v_so_id;

  insert into purchase_requisitions (id, organization_id, requisition_number, sequence_number, sales_order_id, requested_by) values
    (v_req_id, '20000000-0000-0000-0000-000000000082', 'REQ-TEST-82', 1, v_so_id, '10000000-0000-0000-0000-000000000082');
  insert into purchase_requisition_items (id, purchase_requisition_id, sales_order_item_id, catalog_product_id, description_snapshot, quantity_required) values
    (v_req_item_id, v_req_id, v_so_item_id, '80000000-0000-0000-0000-000000000082', 'Producto Test 82', 4);
  update purchase_requisitions set status = 'submitted' where id = v_req_id;

  v_po := rpc_convert_requisition_to_purchase_order(
    gen_random_uuid(), v_req_id, '60000000-0000-0000-0000-000000000082', array[v_req_item_id]
  );

  if v_po.status <> 'borrador' or v_po.origin <> 'requisicion' then
    raise exception 'TEST 8 FIXTURE FALLO: la PO de requisición debio nacer en borrador/origin=requisicion (status=%, origin=%)', v_po.status, v_po.origin;
  end if;

  begin
    perform rpc_delete_purchase_order(v_po.id);
    raise exception 'TEST 8 FALLO: una OC de requisición en borrador NUNCA debio poder eliminarse (bloqueo por origen)';
  exception when others then
    if sqlerrm like 'No se puede eliminar una Orden de Compra originada desde una requisición%' then
      raise notice 'TEST 8a OK: OC de requisición en borrador bloqueada por origen (%).', sqlerrm;
    else
      raise exception 'TEST 8 FALLO: excepcion inesperada en borrador: %', sqlerrm;
    end if;
  end;
  if not exists (select 1 from purchase_orders where id = v_po.id) then
    raise exception 'TEST 8 FALLO: la Orden de Compra de requisición NO debio eliminarse tras el intento bloqueado';
  end if;

  -- Mismo bloqueo también en 'cancelada' — confirma que es por origen, no
  -- por status (cancelar un borrador sigue siendo autoridad de admin aquí).
  perform rpc_update_purchase_order_status(v_po.id, 'cancelada');
  begin
    perform rpc_delete_purchase_order(v_po.id);
    raise exception 'TEST 8 FALLO: una OC de requisición cancelada NUNCA debio poder eliminarse (bloqueo por origen)';
  exception when others then
    if sqlerrm like 'No se puede eliminar una Orden de Compra originada desde una requisición%' then
      raise notice 'TEST 8b OK: OC de requisición cancelada también bloqueada por origen (%).', sqlerrm;
    else
      raise exception 'TEST 8 FALLO: excepcion inesperada en cancelada: %', sqlerrm;
    end if;
  end;
  if not exists (select 1 from purchase_orders where id = v_po.id) then
    raise exception 'TEST 8 FALLO: la Orden de Compra de requisición cancelada NO debio eliminarse tras el intento bloqueado';
  end if;
end $$;

select 'TODAS LAS PRUEBAS 0082 (Eliminación de Orden de Compra) PASARON' as resultado;
rollback;
