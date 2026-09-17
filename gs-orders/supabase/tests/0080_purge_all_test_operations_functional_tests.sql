-- THÖREN — rpc_preview_purge_all_test_operations / rpc_purge_all_test_operations
-- (0080_purge_all_test_operations.sql) — pruebas funcionales contra
-- Postgres real. Fixtures 100% autocontenidas. Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.

begin;

-- ---------------------------------------------------------------------------
-- Usuarios / organizaciones
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000080', 'admin-80@test.local'),
  ('10000000-0000-0000-0000-000000000180', 'vendedor-80@test.local'),
  ('10000000-0000-0000-0000-000000000280', 'admin-orgb-80@test.local');

insert into organizations (id, name, slug) values
  ('20000000-0000-0000-0000-000000000080', 'Test Org 80', 'test-org-80'),
  ('20000000-0000-0000-0000-000000000180', 'Test Org 80B', 'test-org-80b');

insert into salespeople (id, organization_id, name, prefix, active, sequence_current) values
  ('30000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'Vend Test 80', 'VT80', true, 5),
  ('30000000-0000-0000-0000-000000000180', '20000000-0000-0000-0000-000000000180', 'Vend OrgB 80', 'VOB80', true, 3);

-- Person vinculada — requerida por trg_check_salesperson_quote_sequence_valid
-- (0020) para poder configurar salesperson_quote_sequences más abajo.
insert into people (id, organization_id, name, active) values
  ('35000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'Persona Vend Test 80', true);
update salespeople set person_id = '35000000-0000-0000-0000-000000000080' where id = '30000000-0000-0000-0000-000000000080';

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  ('10000000-0000-0000-0000-000000000080', 'Admin Test 80', 'admin', null, true),
  ('10000000-0000-0000-0000-000000000180', 'Vendedor Test 80', 'vendedor', '30000000-0000-0000-0000-000000000080', true),
  ('10000000-0000-0000-0000-000000000280', 'Admin Org B 80', 'admin', null, true);

insert into organization_members (organization_id, user_id, role, active) values
  ('20000000-0000-0000-0000-000000000080', '10000000-0000-0000-0000-000000000080', 'admin', true),
  ('20000000-0000-0000-0000-000000000080', '10000000-0000-0000-0000-000000000180', 'vendedor', true),
  ('20000000-0000-0000-0000-000000000180', '10000000-0000-0000-0000-000000000280', 'admin', true);

set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000080');

insert into business_units (id, organization_id, name, code, active) values
  ('40000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'BU Test 80', 'bu_80', true);

insert into customers (id, organization_id, name, active) values
  ('50000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'Cliente Test 80', true);

insert into suppliers (id, organization_id, name, active) values
  ('60000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'Proveedor Test 80', true);

insert into warehouses (id, organization_id, name, code, active) values
  ('70000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'Almacen Test 80', 'ALM80', true);

insert into product_catalog (id, organization_id, category, sku, name, active) values
  ('80000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'general', 'SKU-80', 'Producto Test 80', true);

insert into custom_field_definitions (id, organization_id, entity_type, key, label, field_type) values
  ('90000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', 'order_item', 'nota_80', 'Nota 80', 'text'),
  ('90000000-0000-0000-0000-000000000180', '20000000-0000-0000-0000-000000000080', 'quote_item', 'req_80', 'Requisito 80', 'text');

-- ---------------------------------------------------------------------------
-- PROTEGIDO — Quote histórica de CotizIA + el Pedido derivado de ella.
-- Ninguno de los dos debe tocarse, pase lo que pase.
-- ---------------------------------------------------------------------------
insert into quotes (
  id, organization_id, business_unit_id, salesperson_id, customer_id,
  folio, sequence_number, quote_date, currency, valid_until,
  customer_name, business_unit_name, business_unit_code, salesperson_name,
  source, original_folio
) values (
  'a0000000-0000-0000-0000-000000000080', '20000000-0000-0000-0000-000000000080', '40000000-0000-0000-0000-000000000080',
  '30000000-0000-0000-0000-000000000080', '50000000-0000-0000-0000-000000000080',
  'Q-COTIZIA-80', 1, current_date, 'MXN', current_date + 30,
  'Cliente Test 80', 'BU Test 80', 'bu_80', 'Vend Test 80',
  'cotizia', 'KSJ-ORIG-80'
);
insert into quote_items (quote_id, model, quantity, unit_price, line_subtotal) values
  ('a0000000-0000-0000-0000-000000000080', 'Modelo protegido', 1, 100, 100);

insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status, source_quote_id) values
  ('a0000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente protegido 80', 'otro', 'borrador', 'a0000000-0000-0000-0000-000000000080');

-- ---------------------------------------------------------------------------
-- UAT — Quote normal (source='thoren' default), sin Pedido derivado. Debe
-- purgarse.
-- ---------------------------------------------------------------------------
insert into quotes (
  id, organization_id, business_unit_id, salesperson_id, customer_id,
  folio, sequence_number, quote_date, currency, valid_until,
  customer_name, business_unit_name, business_unit_code, salesperson_name
) values (
  'a0000000-0000-0000-0000-000000000090', '20000000-0000-0000-0000-000000000080', '40000000-0000-0000-0000-000000000080',
  '30000000-0000-0000-0000-000000000080', '50000000-0000-0000-0000-000000000080',
  'Q-UAT-80', 2, current_date, 'MXN', current_date + 30,
  'Cliente Test 80', 'BU Test 80', 'bu_80', 'Vend Test 80'
);
insert into quote_items (id, quote_id, model, quantity, unit_price, line_subtotal) values
  ('a0000000-0000-0000-0000-000000000091', 'a0000000-0000-0000-0000-000000000090', 'Modelo UAT', 2, 50, 100);
insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_text) values
  ('20000000-0000-0000-0000-000000000080', '90000000-0000-0000-0000-000000000180', 'quote_item', 'a0000000-0000-0000-0000-000000000091', 'requisito de prueba');

-- ---------------------------------------------------------------------------
-- Pedido A — plano, con order_item + custom_field_value + historial de
-- estado. Debe purgarse por completo.
-- ---------------------------------------------------------------------------
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente A 80', 'otro', 'pedido');
insert into order_items (id, order_id, model, quantity) values
  ('b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Modelo A', 1);
insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_text) values
  ('20000000-0000-0000-0000-000000000080', '90000000-0000-0000-0000-000000000080', 'order_item', 'b0000000-0000-0000-0000-000000000002', 'nota de prueba');
-- order_operational_status_history no tiene policy de INSERT directo (solo
-- vía trigger SECURITY DEFINER al cambiar status) — su borrado en cascada
-- desde `orders` está garantizado por FK y no requiere fixture aparte.

-- ---------------------------------------------------------------------------
-- Pedido B — con Purchase Order directa (order_id) + recepción de
-- mercancía completa (inventory_movements + goods_receipts). Debe
-- purgarse por completo.
-- ---------------------------------------------------------------------------
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('b0000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente B 80', 'otro', 'pedido');
insert into purchase_orders (id, organization_id, order_id, supplier_id, folio, sequence_number, status) values
  ('b0000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000080', 'b0000000-0000-0000-0000-000000000010',
   '60000000-0000-0000-0000-000000000080', 'PO-TEST-80-B', 1, 'ordenada');
insert into purchase_order_items (id, purchase_order_id, catalog_product_id, model, quantity_ordered) values
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000080', 'Modelo B', 10);

-- inventory_movements no tiene NINGUNA policy de insert/update/delete para
-- `authenticated` (0036 — solo lo escriben funciones SECURITY DEFINER);
-- inventory_reservations y purchase_requirements tampoco tienen policy de
-- INSERT propia. reset role (mismo patrón ya usado en 0064/0028/0029/0043)
-- para construir estas filas de fixture directo, sin pasar por las RPCs de
-- negocio (fuera de alcance de esta prueba: solo importa que la purga las
-- encuentre y las borre correctamente).
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, purchase_order_id, purchase_order_item_id, created_by_user_id, created_by_name) values
  ('20000000-0000-0000-0000-000000000080', '80000000-0000-0000-0000-000000000080', '70000000-0000-0000-0000-000000000080',
   10, 'recepcion_compra', 'b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000012',
   '10000000-0000-0000-0000-000000000080', 'Admin Test 80');
insert into goods_receipts (id, organization_id, receipt_number, sequence_number, purchase_order_id, warehouse_id, received_by) values
  ('b0000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000080', 'GR-TEST-80-B', 1,
   'b0000000-0000-0000-0000-000000000011', '70000000-0000-0000-0000-000000000080', '10000000-0000-0000-0000-000000000080');
insert into goods_receipt_items (goods_receipt_id, purchase_order_item_id, catalog_product_id, description_snapshot, quantity_received) values
  ('b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000080', 'Modelo B', 10);

-- ---------------------------------------------------------------------------
-- Pedido C — con reserva de inventario + salida por surtido de Pedido
-- (movement_type='surtido_pedido', ligado a order_id + reservation_id
-- directo, sin ninguna Purchase Order). Debe purgarse por completo.
-- ---------------------------------------------------------------------------
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('b0000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente C 80', 'otro', 'pedido');
insert into inventory_reservations (id, organization_id, order_id, product_id, warehouse_id, quantity, created_by_user_id, created_by_name) values
  ('b0000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000080', 'b0000000-0000-0000-0000-000000000020',
   '80000000-0000-0000-0000-000000000080', '70000000-0000-0000-0000-000000000080', 3,
   '10000000-0000-0000-0000-000000000080', 'Admin Test 80');
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, order_id, inventory_reservation_id, created_by_user_id, created_by_name) values
  ('20000000-0000-0000-0000-000000000080', '80000000-0000-0000-0000-000000000080', '70000000-0000-0000-0000-000000000080',
   -3, 'surtido_pedido', 'b0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000021',
   '10000000-0000-0000-0000-000000000080', 'Admin Test 80');

-- ---------------------------------------------------------------------------
-- Pedido D — con una Entrega. Debe purgarse por completo.
-- ---------------------------------------------------------------------------
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('b0000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente D 80', 'otro', 'pedido');
insert into deliveries (id, organization_id, order_id, sequence_number, delivery_type, created_by_user_id, created_by_name) values
  ('b0000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000080', 'b0000000-0000-0000-0000-000000000030',
   1, 'entrega', '10000000-0000-0000-0000-000000000080', 'Admin Test 80');

-- ---------------------------------------------------------------------------
-- Pedido E — con una Purchase Requirement (motor Order->Inventory->PR->PO,
-- 0064), sin PO todavía. Debe purgarse por completo.
-- ---------------------------------------------------------------------------
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('b0000000-0000-0000-0000-000000000040', '20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080',
   current_date, 'Cliente E 80', 'otro', 'pedido');
insert into purchase_requirements (id, organization_id, order_id, catalog_product_id, required_qty) values
  ('b0000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000080', 'b0000000-0000-0000-0000-000000000040',
   '80000000-0000-0000-0000-000000000080', 4);

-- ---------------------------------------------------------------------------
-- Sales Orders — una real (is_test=false, NUNCA se toca) y una de prueba
-- (is_test=true, debe purgarse vía rpc_purge_test_sales_order reutilizado).
-- ---------------------------------------------------------------------------
insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by, is_test) values
  ('c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000080', '50000000-0000-0000-0000-000000000080',
   '30000000-0000-0000-0000-000000000080', 'SO-TEST-80-REAL', 1, 'MXN', '10000000-0000-0000-0000-000000000080', false),
  ('c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000080', '50000000-0000-0000-0000-000000000080',
   '30000000-0000-0000-0000-000000000080', 'SO-TEST-80-PRUEBA', 2, 'MXN', '10000000-0000-0000-0000-000000000080', true);
insert into sales_order_items (sales_order_id, sku_snapshot, quantity, unit_price, line_subtotal, line_total) values
  ('c0000000-0000-0000-0000-000000000001', 'SKU-80', 1, 100, 100, 100),
  ('c0000000-0000-0000-0000-000000000002', 'SKU-80', 1, 100, 100, 100);

-- ---------------------------------------------------------------------------
-- Contadores/folios de org_a a reiniciar.
-- ---------------------------------------------------------------------------
insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix, sequence_current) values
  ('20000000-0000-0000-0000-000000000080', '30000000-0000-0000-0000-000000000080', '40000000-0000-0000-0000-000000000080', 'QSEQ80', 4);
insert into purchase_order_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);
insert into sales_order_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);
insert into purchase_requisition_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);
insert into goods_receipt_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);
insert into sales_fulfillment_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);
insert into invoice_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000080', 2);

-- ---------------------------------------------------------------------------
-- Org B — control cross-org. Nada de esto debe verse afectado jamás por
-- una limpieza ejecutada desde org_a.
-- ---------------------------------------------------------------------------
select test_set_user('10000000-0000-0000-0000-000000000280');
insert into customers (id, organization_id, name, active) values
  ('50000000-0000-0000-0000-000000000180', '20000000-0000-0000-0000-000000000180', 'Cliente OrgB 80', true);
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  ('d0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000180', '30000000-0000-0000-0000-000000000180',
   current_date, 'Cliente OrgB 80', 'otro', 'pedido');
insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by, is_test) values
  ('d0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000180', '50000000-0000-0000-0000-000000000180',
   '30000000-0000-0000-0000-000000000180', 'SO-TEST-80-ORGB', 1, 'MXN', '10000000-0000-0000-0000-000000000280', true);
insert into sales_order_items (sales_order_id, sku_snapshot, quantity, unit_price, line_subtotal, line_total) values
  ('d0000000-0000-0000-0000-000000000002', 'SKU-ORGB', 1, 50, 50, 50);
insert into purchase_order_sequences (organization_id, sequence_current) values ('20000000-0000-0000-0000-000000000180', 7);

-- Fin del bloque con privilegio elevado — de aquí en adelante, sesión
-- normal de `authenticated` para las pruebas reales del RPC.
set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000080');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: vendedor (sin can_purge_test_operations) -> preview rechazado.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000180');
do $$
begin
  begin
    perform rpc_preview_purge_all_test_operations();
    raise exception 'TEST 1 FALLO: un vendedor sin autoridad no debio poder previsualizar la limpieza';
  exception when others then
    if sqlerrm like 'Solo Dirección General%' then
      raise notice 'TEST 1 OK: preview rechazado para vendedor sin autoridad (%).', sqlerrm;
    else
      raise exception 'TEST 1 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 2: vendedor (sin autoridad) -> limpieza real rechazada, incluso con
-- p_confirm=true.
-- =========================================================================
do $$
begin
  begin
    perform rpc_purge_all_test_operations(true);
    raise exception 'TEST 2 FALLO: un vendedor sin autoridad no debio poder ejecutar la limpieza real';
  exception when others then
    if sqlerrm like 'Solo Dirección General%' then
      raise notice 'TEST 2 OK: limpieza real rechazada para vendedor sin autoridad (%).', sqlerrm;
    else
      raise exception 'TEST 2 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;
select test_set_user('10000000-0000-0000-0000-000000000080');

-- =========================================================================
-- TEST 3: admin sin confirmar (p_confirm=false) -> rechazado, nada se toca.
-- =========================================================================
do $$
begin
  begin
    perform rpc_purge_all_test_operations(false);
    raise exception 'TEST 3 FALLO: sin p_confirm=true no debio ejecutarse la limpieza real';
  exception when others then
    if sqlerrm like 'Debes confirmar explícitamente%' then
      raise notice 'TEST 3 OK: limpieza real exige confirmación explícita (%).', sqlerrm;
    else
      raise exception 'TEST 3 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;

do $$
begin
  if not exists (select 1 from orders where id = 'b0000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 3b FALLO: no debio borrarse nada tras el intento sin confirmar';
  end if;
  raise notice 'TEST 3b OK: nada se toco tras el intento sin confirmar';
end $$;

-- =========================================================================
-- TEST 4: preview — conteos exactos por categoría, SIN BORRAR NADA.
-- =========================================================================
do $$
declare v_n integer;
begin
  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'pedidos_legado';
  if v_n <> 5 then raise exception 'TEST 4 FALLO: pedidos_legado esperado 5, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'cotizaciones_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: cotizaciones_legado esperado 1 (excluye la cotizia), obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'purchase_orders_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: purchase_orders_legado esperado 1, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'goods_receipts_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: goods_receipts_legado esperado 1, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'inventory_movements_legado';
  if v_n <> 2 then raise exception 'TEST 4 FALLO: inventory_movements_legado esperado 2 (recepcion + surtido_pedido), obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'inventory_reservations_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: inventory_reservations_legado esperado 1, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'entregas_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: entregas_legado esperado 1, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'purchase_requirements_legado';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: purchase_requirements_legado esperado 1, obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'custom_field_values_legado';
  if v_n <> 2 then raise exception 'TEST 4 FALLO: custom_field_values_legado esperado 2 (order_item + quote_item), obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'sales_orders_prueba';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: sales_orders_prueba esperado 1 (excluye la real), obtuvo %', v_n; end if;

  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'contador_folio_vendedor_pedidos_a_reiniciar';
  if v_n <> 1 then raise exception 'TEST 4 FALLO: contador_folio_vendedor_pedidos_a_reiniciar esperado 1, obtuvo %', v_n; end if;

  raise notice 'TEST 4 OK: preview devuelve conteos exactos por categoría, excluyendo lo protegido';
end $$;

do $$
begin
  if not exists (select 1 from orders where organization_id = '20000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 4c FALLO: el preview no debio borrar nada';
  end if;
  if (select count(*) from orders where organization_id = '20000000-0000-0000-0000-000000000080') <> 6 then
    raise exception 'TEST 4c FALLO: deberian seguir existiendo las 6 orders de org_a (5 a purgar + 1 protegida)';
  end if;
  raise notice 'TEST 4c OK: el preview no escribio nada — 6 pedidos de org_a siguen intactos';
end $$;

-- =========================================================================
-- TEST 5: ejecución real, con p_confirm=true -> éxito.
-- =========================================================================
do $$
declare v_n integer;
begin
  select deleted_count into v_n from rpc_purge_all_test_operations(true) where category = 'pedidos_legado';
  if v_n <> 5 then raise exception 'TEST 5 FALLO: pedidos_legado borrados esperado 5, obtuvo %', v_n; end if;
  raise notice 'TEST 5 OK: limpieza real ejecutada, 5 pedidos legado borrados';
end $$;

-- =========================================================================
-- TEST 6: lo protegido (Quote CotizIA + Pedido derivado de ella) sigue
-- intacto tras la limpieza real.
-- =========================================================================
do $$
begin
  if not exists (select 1 from quotes where id = 'a0000000-0000-0000-0000-000000000080' and source = 'cotizia') then
    raise exception 'TEST 6 FALLO: la Quote CotizIA NUNCA debio borrarse';
  end if;
  if not exists (select 1 from quote_items where quote_id = 'a0000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 6 FALLO: los items de la Quote CotizIA NUNCA debieron borrarse';
  end if;
  if not exists (select 1 from orders where id = 'a0000000-0000-0000-0000-000000000082') then
    raise exception 'TEST 6 FALLO: el Pedido derivado de la Quote CotizIA NUNCA debio borrarse';
  end if;
  raise notice 'TEST 6 OK: Quote CotizIA y su Pedido derivado permanecen intactos';
end $$;

-- =========================================================================
-- TEST 7: los 5 Pedidos UAT y TODA su cadena derivada desaparecieron.
-- =========================================================================
do $$
begin
  if exists (select 1 from orders where id in (
    'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000010',
    'b0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000030',
    'b0000000-0000-0000-0000-000000000040'
  )) then
    raise exception 'TEST 7 FALLO: uno o mas Pedidos UAT no se borraron';
  end if;
  if exists (select 1 from order_items where id = 'b0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 7 FALLO: order_items (cascade) no se borro';
  end if;
  if exists (select 1 from custom_field_values where entity_id = 'b0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 7 FALLO: custom_field_values del order_item no se borro';
  end if;
  if exists (select 1 from purchase_orders where id = 'b0000000-0000-0000-0000-000000000011') then
    raise exception 'TEST 7 FALLO: la Purchase Order legado no se borro';
  end if;
  if exists (select 1 from purchase_order_items where id = 'b0000000-0000-0000-0000-000000000012') then
    raise exception 'TEST 7 FALLO: purchase_order_items (cascade) no se borro';
  end if;
  if exists (select 1 from goods_receipts where id = 'b0000000-0000-0000-0000-000000000013') then
    raise exception 'TEST 7 FALLO: goods_receipts legado no se borro';
  end if;
  if exists (select 1 from inventory_movements where purchase_order_id = 'b0000000-0000-0000-0000-000000000011') then
    raise exception 'TEST 7 FALLO: inventory_movements (recepcion_compra) no se borro';
  end if;
  if exists (select 1 from inventory_movements where order_id = 'b0000000-0000-0000-0000-000000000020') then
    raise exception 'TEST 7 FALLO: inventory_movements (surtido_pedido) no se borro';
  end if;
  if exists (select 1 from inventory_reservations where id = 'b0000000-0000-0000-0000-000000000021') then
    raise exception 'TEST 7 FALLO: inventory_reservations no se borro';
  end if;
  if exists (select 1 from deliveries where id = 'b0000000-0000-0000-0000-000000000031') then
    raise exception 'TEST 7 FALLO: deliveries no se borro';
  end if;
  if exists (select 1 from purchase_requirements where id = 'b0000000-0000-0000-0000-000000000041') then
    raise exception 'TEST 7 FALLO: purchase_requirements no se borro';
  end if;
  raise notice 'TEST 7 OK: los 5 Pedidos UAT y TODA su cadena derivada desaparecieron por completo';
end $$;

-- =========================================================================
-- TEST 8: la Quote UAT (no protegida) y sus items desaparecieron.
-- =========================================================================
do $$
begin
  if exists (select 1 from quotes where id = 'a0000000-0000-0000-0000-000000000090') then
    raise exception 'TEST 8 FALLO: la Quote UAT debio borrarse';
  end if;
  if exists (select 1 from quote_items where id = 'a0000000-0000-0000-0000-000000000091') then
    raise exception 'TEST 8 FALLO: los items de la Quote UAT (cascade) debieron borrarse';
  end if;
  if exists (select 1 from custom_field_values where entity_id = 'a0000000-0000-0000-0000-000000000091') then
    raise exception 'TEST 8 FALLO: custom_field_values del quote_item UAT debio borrarse';
  end if;
  raise notice 'TEST 8 OK: Quote UAT y su cadena desaparecieron';
end $$;

-- =========================================================================
-- TEST 9: Sales Order real (is_test=false) intacta; Sales Order de prueba
-- (is_test=true) purgada vía rpc_purge_test_sales_order reutilizado.
-- =========================================================================
do $$
begin
  if not exists (select 1 from sales_orders where id = 'c0000000-0000-0000-0000-000000000001' and is_test = false) then
    raise exception 'TEST 9 FALLO: la Sales Order REAL no debio tocarse';
  end if;
  if not exists (select 1 from sales_order_items where sales_order_id = 'c0000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 9 FALLO: los items de la Sales Order REAL no debieron tocarse';
  end if;
  if exists (select 1 from sales_orders where id = 'c0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 9 FALLO: la Sales Order de PRUEBA debio purgarse';
  end if;
  if exists (select 1 from sales_order_items where sales_order_id = 'c0000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 9 FALLO: los items de la Sales Order de PRUEBA debieron purgarse';
  end if;
  raise notice 'TEST 9 OK: Sales Order real intacta, Sales Order de prueba purgada';
end $$;

-- =========================================================================
-- TEST 10: contadores/folios de org_a reiniciados a 0 — nunca se borró la
-- fila, solo el contador.
-- =========================================================================
do $$
declare v_seq integer;
begin
  select sequence_current into v_seq from salespeople where id = '30000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: salespeople.sequence_current debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from salesperson_quote_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: salesperson_quote_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from purchase_order_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: purchase_order_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from sales_order_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: sales_order_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from purchase_requisition_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: purchase_requisition_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from goods_receipt_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: goods_receipt_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from sales_fulfillment_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: sales_fulfillment_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  select sequence_current into v_seq from invoice_sequences where organization_id = '20000000-0000-0000-0000-000000000080';
  if v_seq <> 0 then raise exception 'TEST 10 FALLO: invoice_sequences debio reiniciarse a 0, quedo %', v_seq; end if;

  raise notice 'TEST 10 OK: los 8 contadores de folio de org_a quedaron en 0 (filas intactas, nunca borradas)';
end $$;

-- =========================================================================
-- TEST 11: maestros de org_a intactos.
-- =========================================================================
do $$
begin
  if not exists (select 1 from salespeople where id = '30000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: el vendedor (maestro) no debio borrarse';
  end if;
  if not exists (select 1 from customers where id = '50000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: el cliente (maestro) no debio borrarse';
  end if;
  if not exists (select 1 from suppliers where id = '60000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: el proveedor (maestro) no debio borrarse';
  end if;
  if not exists (select 1 from warehouses where id = '70000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: el almacen (maestro) no debio borrarse';
  end if;
  if not exists (select 1 from product_catalog where id = '80000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: el producto de catalogo (maestro) no debio borrarse';
  end if;
  if not exists (select 1 from business_units where id = '40000000-0000-0000-0000-000000000080') then
    raise exception 'TEST 11 FALLO: la Business Unit (maestro) no debio borrarse';
  end if;
  raise notice 'TEST 11 OK: todos los maestros de org_a permanecen intactos';
end $$;

-- =========================================================================
-- TEST 12: cross-org — nada de org_b se vio afectado por la limpieza de
-- org_a (ni Pedidos, ni Sales Orders de prueba, ni contadores).
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000280');
do $$
declare v_seq integer;
begin
  if not exists (select 1 from orders where id = 'd0000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 12 FALLO: el Pedido de org_b no debio tocarse por una limpieza de org_a';
  end if;
  if not exists (select 1 from sales_orders where id = 'd0000000-0000-0000-0000-000000000002' and is_test = true) then
    raise exception 'TEST 12 FALLO: la Sales Order de PRUEBA de org_b no debio tocarse por una limpieza de org_a';
  end if;
  select sequence_current into v_seq from purchase_order_sequences where organization_id = '20000000-0000-0000-0000-000000000180';
  if v_seq <> 7 then
    raise exception 'TEST 12 FALLO: el contador de org_b no debio reiniciarse (quedo %, esperado 7)', v_seq;
  end if;
  raise notice 'TEST 12 OK: org_b completamente intacta — Pedidos, Sales Orders de prueba y contadores propios, sin tocar';
end $$;
select test_set_user('10000000-0000-0000-0000-000000000080');

-- =========================================================================
-- TEST 13: correr el preview de nuevo tras la limpieza real -> todo en 0
-- (idempotente, nada queda por purgar).
-- =========================================================================
do $$
declare v_n integer;
begin
  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'pedidos_legado';
  if v_n <> 0 then raise exception 'TEST 13 FALLO: pedidos_legado deberia ser 0 tras la limpieza, obtuvo %', v_n; end if;
  select row_count into v_n from rpc_preview_purge_all_test_operations() where category = 'sales_orders_prueba';
  if v_n <> 0 then raise exception 'TEST 13 FALLO: sales_orders_prueba deberia ser 0 tras la limpieza, obtuvo %', v_n; end if;
  raise notice 'TEST 13 OK: el preview tras la limpieza muestra 0 en todo — idempotente, nada queda pendiente';
end $$;

select 'TODAS LAS PRUEBAS 0080 (purga masiva de operaciones de prueba) PASARON' as resultado;
rollback;
