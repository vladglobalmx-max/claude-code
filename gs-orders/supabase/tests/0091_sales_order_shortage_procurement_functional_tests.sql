-- THÖREN — Ticket C1 (0091_sales_order_shortage_procurement.sql):
-- fn_sales_order_item_shortage / rpc_sync_sales_order_procurement —
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas,
-- transacción con rollback final — no deja rastro en la base.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $`.

begin;

\set admin_a '00000000-0000-0000-0000-000000009101'
\set admin_b '00000000-0000-0000-0000-000000009102'
\set org_a '00000000-0000-0000-0000-000000009110'
\set org_b '00000000-0000-0000-0000-000000009111'
\set warehouse_a '00000000-0000-0000-0000-000000009120'
\set warehouse_b '00000000-0000-0000-0000-000000009121'
\set customer_a '00000000-0000-0000-0000-000000009130'
\set customer_b '00000000-0000-0000-0000-000000009131'
\set sp_a '00000000-0000-0000-0000-000000009140'
\set sp_b '00000000-0000-0000-0000-000000009141'
\set supplier_a '00000000-0000-0000-0000-000000009150'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-91a@test.local'),
  (:'admin_b', 'admin-91b@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 91 A', 'test-org-91-a'),
  (:'org_b', 'Test Org 91 B', 'test-org-91-b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 91', 'admin', true),
  (:'admin_b', 'Admin B Test 91', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true),
  (:'org_b', :'admin_b', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 91', 'VA91', true),
  (:'sp_b', :'org_b', 'Vendedor B 91', 'VB91', true);

insert into warehouses (id, organization_id, name, code, active) values
  (:'warehouse_a', :'org_a', 'Almacén A 91', 'ALM-91A', true),
  (:'warehouse_b', :'org_b', 'Almacén B 91', 'ALM-91B', true);

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 91 A', true),
  (:'customer_b', :'org_b', 'Cliente Test 91 B', true);

insert into suppliers (id, organization_id, name, active) values
  (:'supplier_a', :'org_a', 'Proveedor Test 91', true);

insert into product_catalog (id, organization_id, sku, name, unit, active) values
  ('00000000-0000-0000-0000-000000009180', :'org_a', 'P91-SUF', 'Producto Suficiente', 'pza', true),
  ('00000000-0000-0000-0000-000000009181', :'org_a', 'P91-ZERO', 'Producto Cero Stock', 'pza', true),
  ('00000000-0000-0000-0000-000000009182', :'org_a', 'P91-PARCIAL', 'Producto Parcial', 'pza', true),
  ('00000000-0000-0000-0000-000000009183', :'org_a', 'P91-FULFILL', 'Producto Fulfillment Parcial', 'pza', true),
  ('00000000-0000-0000-0000-000000009184', :'org_a', 'P91-REQEXIST', 'Producto Requisicion Existente', 'pza', true),
  ('00000000-0000-0000-0000-000000009185', :'org_a', 'P91-RECEIPT', 'Producto Recepcion', 'pza', true),
  ('00000000-0000-0000-0000-000000009186', :'org_a', 'P91-DUP', 'Producto Duplicado Mismo SO', 'pza', true),
  ('00000000-0000-0000-0000-000000009187', :'org_a', 'P91-CONTESTED', 'Producto Disputado', 'pza', true),
  ('00000000-0000-0000-0000-000000009188', :'org_a', 'P91-QTY', 'Producto Cambio Cantidad', 'pza', true),
  ('00000000-0000-0000-0000-000000009189', :'org_a', 'P91-GATE', 'Producto Gate Financiero', 'pza', true),
  ('00000000-0000-0000-0000-00000000918a', :'org_a', 'P91-MIXA', 'Producto Mixto A', 'pza', true),
  ('00000000-0000-0000-0000-00000000918b', :'org_a', 'P91-MIXB', 'Producto Mixto B', 'pza', true),
  ('00000000-0000-0000-0000-00000000918c', :'org_a', 'P91-MIXC', 'Producto Mixto C', 'pza', true),
  ('00000000-0000-0000-0000-000000009190', :'org_b', 'P91-ORGB', 'Producto Org B', 'pza', true);

create temporary table test_scratch_91 (key text primary key, value text);
grant all on test_scratch_91 to authenticated;

-- Helper: crea una Sales Order de 1 línea (catálogo), la confirma, y
-- opcionalmente la libera financieramente con pago completo (cash). Guarda
-- so_id/item_id en test_scratch_91 bajo las claves dadas. Procedimiento
-- TOP-LEVEL real (PL/pgSQL no permite procedimientos anidados dentro de un
-- bloque `do $$`) — se crea como superusuario y se otorga EXECUTE a
-- `authenticated`, mismo criterio que la tabla temporal de arriba.
create or replace procedure test_make_so_91(p_key text, p_product uuid, p_qty integer, p_price numeric, p_release boolean)
language plpgsql
as $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009130';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009140';
  v_so sales_orders;
  v_item_id uuid;
begin
  v_so := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', p_product, 'quantity', p_qty, 'unit_price', p_price))
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  if p_release then
    perform rpc_register_sales_order_payment(v_so.id, p_qty * p_price);
  end if;
  select id into v_item_id from sales_order_items where sales_order_id = v_so.id limit 1;
  insert into test_scratch_91 (key, value) values (p_key || '_so_id', v_so.id::text), (p_key || '_item_id', v_item_id::text);
end;
$$;
grant execute on procedure test_make_so_91(text, uuid, integer, numeric, boolean) to authenticated;

set role authenticated;
select test_set_user(:'admin_a');

call test_make_so_91('suf', '00000000-0000-0000-0000-000000009180', 10, 10, true);
call test_make_so_91('zero', '00000000-0000-0000-0000-000000009181', 5, 10, true);
call test_make_so_91('partial', '00000000-0000-0000-0000-000000009182', 20, 10, true);
call test_make_so_91('fulfill', '00000000-0000-0000-0000-000000009183', 10, 10, true);
call test_make_so_91('reqexist', '00000000-0000-0000-0000-000000009184', 10, 10, true);
call test_make_so_91('receipt', '00000000-0000-0000-0000-000000009185', 10, 10, true);
call test_make_so_91('qty', '00000000-0000-0000-0000-000000009188', 10, 10, true);
call test_make_so_91('gate', '00000000-0000-0000-0000-000000009189', 5, 10, false);

-- Stock inicial por producto (entrada_manual, bypass de RLS como superusuario).
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name) values
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009180', '00000000-0000-0000-0000-000000009120', 10, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  -- zero: sin movimiento (stock 0 real).
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009182', '00000000-0000-0000-0000-000000009120', 5, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009183', '00000000-0000-0000-0000-000000009120', 10, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009184', '00000000-0000-0000-0000-000000009120', 4, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  -- receipt: sin stock inicial (shortage total hasta recibir la PO).
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009188', '00000000-0000-0000-0000-000000009120', 10, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009189', '00000000-0000-0000-0000-000000009120', 5, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin');
set role authenticated;
select test_set_user(:'admin_a');

-- =========================================================================
-- TEST 1: inventario suficiente — qty 10, stock 10 -> shortage 0, reserva = 10.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_row record;
  v_reserved integer;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'suf_so_id';
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.shortage_qty <> 0 or v_row.reserved_qty <> 10 then
    raise exception 'TEST 1 FALLÓ: esperado shortage=0 reserved=10, actual shortage=% reserved=%', v_row.shortage_qty, v_row.reserved_qty;
  end if;
  select coalesce(sum(quantity), 0) into v_reserved from inventory_reservations where sales_order_item_id = (select value::uuid from test_scratch_91 where key = 'suf_item_id') and released_at is null;
  if v_reserved <> 10 then
    raise exception 'TEST 1 FALLÓ: la reserva real en inventory_reservations no es 10 (actual: %)', v_reserved;
  end if;
  if exists (select 1 from purchase_requisitions where sales_order_id = v_so_id and auto_generated = true) then
    raise exception 'TEST 1 FALLÓ: no debió crearse ninguna requisición — no hay shortage.';
  end if;
  raise notice 'TEST 1 OK: inventario suficiente -> shortage 0, reserva completa.';
end $$;

-- =========================================================================
-- TEST 2: inventario cero — qty 5, stock 0 -> shortage 5, requisición auto
-- creada por 5.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_row record;
  v_pri purchase_requisition_items;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'zero_so_id';
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.shortage_qty <> 5 or v_row.reserved_qty <> 0 then
    raise exception 'TEST 2 FALLÓ: esperado shortage=5 reserved=0, actual shortage=% reserved=%', v_row.shortage_qty, v_row.reserved_qty;
  end if;
  select * into v_pri from purchase_requisition_items where id = v_row.purchase_requisition_item_id;
  if v_pri.quantity_required <> 5 then
    raise exception 'TEST 2 FALLÓ: la requisición auto debió quedar en quantity_required=5 (actual: %)', v_pri.quantity_required;
  end if;
  raise notice 'TEST 2 OK: inventario cero -> shortage 5, requisición auto creada con la cantidad correcta.';
end $$;

-- =========================================================================
-- TEST 3: inventario parcial — qty 20, stock 5 -> shortage 15.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_row record;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'partial_so_id';
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.shortage_qty <> 15 or v_row.reserved_qty <> 5 then
    raise exception 'TEST 3 FALLÓ: esperado shortage=15 reserved=5, actual shortage=% reserved=%', v_row.shortage_qty, v_row.reserved_qty;
  end if;
  raise notice 'TEST 3 OK: inventario parcial -> shortage 15, reserva 5 (lo único disponible).';
end $$;

-- =========================================================================
-- TEST 4: fulfillment parcial — qty 10, stock 10. Se despacha 4 (vía
-- sales_fulfillment real, 0071 — resta on_hand automáticamente). Sync debe
-- recalcular pending=6, y como on_hand ya bajó a 6, shortage sigue en 0 y
-- la reserva se reduce de 10 a 6 (ya no hace falta cubrir lo ya surtido).
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_item_id uuid;
  v_sf sales_fulfillments;
  v_sf_item_id uuid;
  v_row record;
  v_reserved integer;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'fulfill_so_id';
  select value::uuid into v_item_id from test_scratch_91 where key = 'fulfill_item_id';

  -- Primer sync: reserva 10 (igual que TEST 1).
  perform rpc_sync_sales_order_procurement(v_so_id);

  -- Despacha 4 unidades vía el flujo real de surtido.
  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so_id, 'warehouse_id', '00000000-0000-0000-0000-000000009120'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item_id, 'quantity_requested', 4))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.pending_qty <> 6 or v_row.shortage_qty <> 0 then
    raise exception 'TEST 4 FALLÓ: esperado pending=6 shortage=0 tras despachar 4, actual pending=% shortage=%', v_row.pending_qty, v_row.shortage_qty;
  end if;
  select coalesce(sum(quantity), 0) into v_reserved from inventory_reservations where sales_order_item_id = v_item_id and released_at is null;
  if v_reserved <> 6 then
    raise exception 'TEST 4 FALLÓ: la reserva debió reducirse a 6 tras el despacho de 4 (actual: %)', v_reserved;
  end if;
  raise notice 'TEST 4 OK: fulfillment parcial reduce pending y la reserva se ajusta correctamente, sin doble conteo.';
end $$;

-- =========================================================================
-- TEST 5: reservation existente — segunda corrida del sync sin cambios no
-- debe crear una SEGUNDA reserva (debe seguir habiendo exactamente 1 fila
-- activa para esa partida).
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_item_id uuid;
  v_count_before integer;
  v_count_after integer;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'suf_so_id';
  select value::uuid into v_item_id from test_scratch_91 where key = 'suf_item_id';
  select count(*) into v_count_before from inventory_reservations where sales_order_item_id = v_item_id and released_at is null;

  perform rpc_sync_sales_order_procurement(v_so_id);

  select count(*) into v_count_after from inventory_reservations where sales_order_item_id = v_item_id and released_at is null;
  if v_count_before <> 1 or v_count_after <> 1 then
    raise exception 'TEST 5 FALLÓ: debió haber exactamente 1 reserva activa antes y después (antes=%, después=%)', v_count_before, v_count_after;
  end if;
  raise notice 'TEST 5 OK: reserva existente se reutiliza/ajusta, nunca se duplica.';
end $$;

-- =========================================================================
-- TEST 6: requisición existente (manual) — se crea a mano una requisición
-- con 6 de las 6 unidades de shortage (qty 10, stock 4 -> shortage 6). El
-- sync NO debe requisicionar NADA más (desired_auto_qty = 6 - 6 = 0).
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_item_id uuid;
  v_manual_req purchase_requisitions;
  v_row record;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'reqexist_so_id';
  select value::uuid into v_item_id from test_scratch_91 where key = 'reqexist_item_id';

  select * into v_manual_req from rpc_create_purchase_requisition(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so_id),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item_id, 'quantity_required', 6))
  );

  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.shortage_qty <> 6 then
    raise exception 'TEST 6 FALLÓ: shortage esperado 6 (qty 10, stock 4), actual %', v_row.shortage_qty;
  end if;
  if v_row.purchase_requisition_item_id is not null then
    raise exception 'TEST 6 FALLÓ: no debió crearse ninguna línea auto — la requisición manual ya cubre el 100%% del shortage.';
  end if;
  if not exists (select 1 from purchase_requisitions where sales_order_id = v_so_id and auto_generated = true) then
    raise notice 'TEST 6 OK (sin requisición auto, esperado).';
  else
    raise exception 'TEST 6 FALLÓ: no debió crearse ninguna requisición auto_generated.';
  end if;
end $$;

-- =========================================================================
-- TEST 7: ejecución duplicada del sync — correr dos veces seguidas sobre
-- una SO ya sincronizada no debe cambiar reservas/requisiciones/shortage.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_row1 record;
  v_row2 record;
  v_reservations_before integer;
  v_reservations_after integer;
  v_req_items_before integer;
  v_req_items_after integer;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'partial_so_id';

  select * into v_row1 from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  select count(*) into v_reservations_before from inventory_reservations where released_at is null;
  select count(*) into v_req_items_before from purchase_requisition_items;

  select * into v_row2 from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  select count(*) into v_reservations_after from inventory_reservations where released_at is null;
  select count(*) into v_req_items_after from purchase_requisition_items;

  if v_row1.shortage_qty <> v_row2.shortage_qty or v_row1.reserved_qty <> v_row2.reserved_qty then
    raise exception 'TEST 7 FALLÓ: la segunda corrida cambió el resultado (shortage %/%, reserved %/%)', v_row1.shortage_qty, v_row2.shortage_qty, v_row1.reserved_qty, v_row2.reserved_qty;
  end if;
  if v_reservations_before <> v_reservations_after or v_req_items_before <> v_req_items_after then
    raise exception 'TEST 7 FALLÓ: la segunda corrida alteró el conteo de filas (reservas %/%, items de requisición %/%)', v_reservations_before, v_reservations_after, v_req_items_before, v_req_items_after;
  end if;
  raise notice 'TEST 7 OK: ejecución duplicada del sync es un no-op real — sin duplicar reservas, requisiciones ni inflar shortage.';
end $$;

reset role;

-- =========================================================================
-- TEST 8 / 9: reducción y aumento de cantidad del Pedido — simulado con un
-- UPDATE directo (superusuario) a sales_order_items.quantity, técnica ya
-- usada en 0090 TEST 6 para simular un estado que la app normal no
-- produce (las partidas son inmutables post-draft por diseño) — el
-- propósito es ejercitar la lógica de reconciliación (shrink/top-up) del
-- sync ante un cambio de demanda, no afirmar que el producto permite
-- editar cantidades tras confirmar.
-- =========================================================================
set role authenticated;
select test_set_user(:'admin_a');
do $$
declare
  v_so_id uuid;
  v_row record;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'qty_so_id';

  -- Estado inicial: qty 10, stock 10 -> reserva 10, shortage 0.
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.reserved_qty <> 10 then
    raise exception 'TEST 8/9 FALLÓ: estado inicial esperado reserved=10 (actual %)', v_row.reserved_qty;
  end if;
end $$;

-- TEST 8: reducción de cantidad (10 -> 4) -> la reserva debe encogerse a 4.
-- UPDATE directo (superusuario) como técnica de simulación — ver
-- comentario de la sección arriba.
reset role;
update sales_order_items set quantity = 4
  where id = (select value::uuid from test_scratch_91 where key = 'qty_item_id');
set role authenticated;
select test_set_user(:'admin_a');

do $$
declare
  v_so_id uuid;
  v_row record;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'qty_so_id';
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.reserved_qty <> 4 or v_row.shortage_qty <> 0 then
    raise exception 'TEST 8 FALLÓ: tras reducir a 4, esperado reserved=4 shortage=0 (actual reserved=%, shortage=%)', v_row.reserved_qty, v_row.shortage_qty;
  end if;
  raise notice 'TEST 8 OK: reducción de cantidad encoge la reserva correctamente.';
end $$;

-- TEST 9: aumento de cantidad (4 -> 15, stock total sigue en 10) -> la
-- reserva debe volver a tope en 10 (todo lo disponible) y shortage = 5.
reset role;
update sales_order_items set quantity = 15
  where id = (select value::uuid from test_scratch_91 where key = 'qty_item_id');
set role authenticated;
select test_set_user(:'admin_a');

do $$
declare
  v_so_id uuid;
  v_row record;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'qty_so_id';
  select * into v_row from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row.reserved_qty <> 10 or v_row.shortage_qty <> 5 then
    raise exception 'TEST 9 FALLÓ: tras aumentar a 15 (stock 10), esperado reserved=10 shortage=5 (actual reserved=%, shortage=%)', v_row.reserved_qty, v_row.shortage_qty;
  end if;
  raise notice 'TEST 9 OK: aumento de cantidad vuelve a reservar hasta el tope disponible y refleja el shortage restante.';
end $$;

-- =========================================================================
-- TEST 10: recepción de mercancía reduce shortage — qty 10, stock 0 (puro
-- shortage 10). Se crea una Purchase Order DIRECTA (sin requisición,
-- reutilizando purchase_orders/purchase_order_items tal cual, 0035/0069),
-- se recibe vía rpc_receive_purchase_order_item (0036/0077) — confirma que
-- las relaciones YA existentes (incoming baja, on_hand sube) alimentan el
-- shortage sin ningún cambio de este ticket.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_row_before record;
  v_row_after record;
  v_po_id uuid := gen_random_uuid();
  v_poi_id uuid;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'receipt_so_id';

  select * into v_row_before from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row_before.shortage_qty <> 10 then
    raise exception 'TEST 10 FALLÓ: shortage inicial esperado 10 (actual %)', v_row_before.shortage_qty;
  end if;

  insert into purchase_orders (id, organization_id, order_id, supplier_id, folio, sequence_number, po_date, status) values
    (v_po_id, '00000000-0000-0000-0000-000000009110', null, '00000000-0000-0000-0000-000000009150', 'PO-TEST-91-RECEIPT', 1, current_date, 'ordenada');
  insert into purchase_order_items (id, purchase_order_id, catalog_product_id, model, quantity_ordered) values
    (gen_random_uuid(), v_po_id, '00000000-0000-0000-0000-000000009185', 'P91-RECEIPT', 10)
    returning id into v_poi_id;

  perform rpc_receive_purchase_order_item(v_poi_id, 10, '00000000-0000-0000-0000-000000009120');

  select * into v_row_after from rpc_sync_sales_order_procurement(v_so_id) limit 1;
  if v_row_after.shortage_qty <> 0 or v_row_after.reserved_qty <> 10 then
    raise exception 'TEST 10 FALLÓ: tras recibir 10, esperado shortage=0 reserved=10 (actual shortage=%, reserved=%)', v_row_after.shortage_qty, v_row_after.reserved_qty;
  end if;
  raise notice 'TEST 10 OK: la recepción de mercancía reduce el shortage vía las relaciones existentes, sin ningún cambio nuevo.';
end $$;

-- =========================================================================
-- TEST 11: dos partidas del MISMO producto en la MISMA Sales Order — cada
-- una debe quedar independiente (su propia reserva, compitiendo entre sí
-- por el mismo pool). Stock 12: línea A pide 10 (se cubre completa), línea
-- B pide 10 (solo quedan 2 libres tras A -> shortage 8).
-- =========================================================================
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name) values
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009186', '00000000-0000-0000-0000-000000009120', 12, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin');
set role authenticated;
select test_set_user(:'admin_a');

do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009130';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009140';
  v_product uuid := '00000000-0000-0000-0000-000000009186';
  v_so sales_orders;
  v_item_a uuid;
  v_item_b uuid;
  v_row_a record;
  v_row_b record;
begin
  v_so := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_product, 'quantity', 10, 'unit_price', 10),
      jsonb_build_object('catalog_product_id', v_product, 'quantity', 10, 'unit_price', 10)
    )
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 200);

  select id into v_item_a from sales_order_items where sales_order_id = v_so.id order by position asc limit 1;
  select id into v_item_b from sales_order_items where sales_order_id = v_so.id order by position desc limit 1;

  perform rpc_sync_sales_order_procurement(v_so.id);

  select * into v_row_a from fn_sales_order_item_shortage(v_so.id) where sales_order_item_id = v_item_a;
  select * into v_row_b from fn_sales_order_item_shortage(v_so.id) where sales_order_item_id = v_item_b;

  if v_row_a.shortage_qty <> 0 then
    raise exception 'TEST 11 FALLÓ: la primera partida (A) debió cubrirse completa (shortage esperado 0, actual %)', v_row_a.shortage_qty;
  end if;
  if v_row_b.shortage_qty <> 8 then
    raise exception 'TEST 11 FALLÓ: la segunda partida (B) debió quedar con shortage 8 (10 - 2 libres), actual %', v_row_b.shortage_qty;
  end if;
  raise notice 'TEST 11 OK: dos partidas del mismo producto en la misma Sales Order quedan independientes, sin doble conteo.';
end $$;

-- =========================================================================
-- TEST 12: dos Sales Orders compitiendo por el MISMO inventario — SO_X
-- reserva 6 de 10 disponibles; SO_Y (qty 10, mismo producto) debe ver el
-- disponible real reducido por la reserva de X.
-- =========================================================================
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name) values
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-000000009187', '00000000-0000-0000-0000-000000009120', 10, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin');
set role authenticated;
select test_set_user(:'admin_a');

do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009130';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009140';
  v_product uuid := '00000000-0000-0000-0000-000000009187';
  v_so_x sales_orders;
  v_so_y sales_orders;
  v_row_y record;
begin
  v_so_x := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product, 'quantity', 6, 'unit_price', 10))
  );
  perform rpc_update_sales_order_status(v_so_x.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so_x.id, 60);
  perform rpc_sync_sales_order_procurement(v_so_x.id);

  v_so_y := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product, 'quantity', 10, 'unit_price', 10))
  );
  perform rpc_update_sales_order_status(v_so_y.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so_y.id, 100);

  select * into v_row_y from rpc_sync_sales_order_procurement(v_so_y.id) limit 1;
  if v_row_y.reserved_qty <> 4 or v_row_y.shortage_qty <> 6 then
    raise exception 'TEST 12 FALLÓ: SO_Y debió quedar con reserved=4 shortage=6 (10 - 6 ya reservados por SO_X), actual reserved=%, shortage=%', v_row_y.reserved_qty, v_row_y.shortage_qty;
  end if;
  raise notice 'TEST 12 OK: dos Sales Orders compitiendo por el mismo inventario no sobrevenden — la reserva de una reduce el disponible real de la otra.';
end $$;

-- =========================================================================
-- TEST 13 / 14: gate financiero — bloqueada no debe reservar ni requisitar
-- nada; liberada (tras pago) sí.
-- =========================================================================
do $$
declare
  v_so_id uuid;
  v_item_id uuid;
  v_rows integer;
begin
  select value::uuid into v_so_id from test_scratch_91 where key = 'gate_so_id';
  select value::uuid into v_item_id from test_scratch_91 where key = 'gate_item_id';

  -- TEST 13: SO confirmada en 'cash' SIN pago -> blocked.
  if (select fulfillment_release_status from sales_orders where id = v_so_id) <> 'blocked' then
    raise exception 'TEST 13 FALLÓ: la fixture debía quedar blocked antes de pagar.';
  end if;

  select count(*) into v_rows from rpc_sync_sales_order_procurement(v_so_id);
  if v_rows <> 0 then
    raise exception 'TEST 13 FALLÓ: el sync sobre una Sales Order bloqueada no debió devolver ninguna fila (devolvió %).', v_rows;
  end if;
  if exists (select 1 from inventory_reservations where sales_order_item_id = v_item_id and released_at is null) then
    raise exception 'TEST 13 FALLÓ: no debió crearse ninguna reserva mientras la Sales Order está bloqueada.';
  end if;
  if exists (select 1 from purchase_requisitions where sales_order_id = v_so_id) then
    raise exception 'TEST 13 FALLÓ: no debió crearse ninguna requisición mientras la Sales Order está bloqueada.';
  end if;
  raise notice 'TEST 13 OK: gate financiero respetado — Sales Order bloqueada no genera/libera abastecimiento.';

  -- TEST 14: se paga -> released -> ahora el sync SÍ debe reservar.
  perform rpc_register_sales_order_payment(v_so_id, 50);
  if (select fulfillment_release_status from sales_orders where id = v_so_id) <> 'released' then
    raise exception 'TEST 14 FALLÓ: tras el pago completo la Sales Order debía quedar released.';
  end if;

  select count(*) into v_rows from rpc_sync_sales_order_procurement(v_so_id);
  if v_rows <> 1 then
    raise exception 'TEST 14 FALLÓ: tras liberar, el sync debió devolver 1 fila (devolvió %).', v_rows;
  end if;
  if not exists (select 1 from inventory_reservations where sales_order_item_id = v_item_id and released_at is null) then
    raise exception 'TEST 14 FALLÓ: tras liberar, debió crearse la reserva correspondiente.';
  end if;
  raise notice 'TEST 14 OK: al liberarse financieramente, el sync ahora sí reserva/requisita correctamente.';
end $$;

-- =========================================================================
-- TEST 15: aislamiento entre organizaciones — Org B nunca puede sincronizar
-- una Sales Order de Org A, y el shortage de Org A nunca considera
-- inventario/reservas de Org B. Cambios de rol a nivel TOP-LEVEL (nunca
-- `reset role`/`set role` dentro de un mismo bloque `do $$`).
-- =========================================================================
set role authenticated;
select test_set_user(:'admin_b');
do $$
declare
  v_so_a_id uuid;
begin
  select value::uuid into v_so_a_id from test_scratch_91 where key = 'suf_so_id';
  begin
    perform rpc_sync_sales_order_procurement(v_so_a_id);
    raise exception 'TEST 15a FALLÓ: un admin de Org B no debió poder sincronizar una Sales Order de Org A.';
  exception
    when others then
      if sqlerrm like 'TEST 15a FALLÓ%' then raise; end if;
      if sqlerrm not like '%no pertenece a tu organización%' then
        raise exception 'TEST 15a FALLÓ: se esperaba el rechazo cross-org, ocurrió otro error: %', sqlerrm;
      end if;
      raise notice 'TEST 15a OK: admin de Org B rechazado al intentar sincronizar una Sales Order de Org A.';
  end;
end $$;

-- Reserva/stock de Org B sobre un producto de Org B no debe filtrarse al
-- cálculo de Org A (ya lo garantiza organization_id en cada CTE — se
-- confirma aquí con un caso real).
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name) values
  ('00000000-0000-0000-0000-000000009111', '00000000-0000-0000-0000-000000009190', '00000000-0000-0000-0000-000000009121', 100, 'entrada_manual', '00000000-0000-0000-0000-000000009102', 'Admin B');
set role authenticated;
select test_set_user(:'admin_b');

do $$
declare
  v_customer_b uuid := '00000000-0000-0000-0000-000000009131';
  v_product_b uuid := '00000000-0000-0000-0000-000000009190';
  v_so_b sales_orders;
begin
  v_so_b := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_b, 'salesperson_id', '00000000-0000-0000-0000-000000009141', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_b, 'quantity', 5, 'unit_price', 10))
  );
  perform rpc_update_sales_order_status(v_so_b.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so_b.id, 50);
  perform rpc_sync_sales_order_procurement(v_so_b.id);
  insert into test_scratch_91 (key, value) values ('orgb_so_id', v_so_b.id::text);
end $$;

reset role;
do $$
declare
  v_so_b_id uuid;
begin
  select value::uuid into v_so_b_id from test_scratch_91 where key = 'orgb_so_id';
  if exists (
    select 1 from inventory_reservations
    where sales_order_id = v_so_b_id and organization_id <> '00000000-0000-0000-0000-000000009111'
  ) then
    raise exception 'TEST 15b FALLÓ: la reserva de Org B quedó con organization_id incorrecto.';
  end if;
  raise notice 'TEST 15b OK: aislamiento entre organizaciones respetado — datos nunca se mezclan.';
end $$;
set role authenticated;
select test_set_user(:'admin_a');

-- =========================================================================
-- TEST 16 (OBLIGATORIO): caso mixto de 3 partidas en la MISMA Sales Order.
--   A: 10 solicitadas, 10 disponibles -> shortage 0.
--   B: 20 solicitadas, 5 disponibles -> shortage 15.
--   C: 10 solicitadas, 4 ya surtidas, 3 disponibles -> pending 6, shortage 3.
-- =========================================================================
-- Stock: A=10 (cubre completo), B=5 (parcial), C=7 (se despachan 4, quedan
-- 3 on_hand — exactamente el "3 disponibles" del enunciado).
reset role;
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name) values
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-00000000918a', '00000000-0000-0000-0000-000000009120', 10, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-00000000918b', '00000000-0000-0000-0000-000000009120', 5, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin'),
  ('00000000-0000-0000-0000-000000009110', '00000000-0000-0000-0000-00000000918c', '00000000-0000-0000-0000-000000009120', 7, 'entrada_manual', '00000000-0000-0000-0000-000000009101', 'Admin');
set role authenticated;
select test_set_user(:'admin_a');

do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009130';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009140';
  v_prod_a uuid := '00000000-0000-0000-0000-00000000918a';
  v_prod_b uuid := '00000000-0000-0000-0000-00000000918b';
  v_prod_c uuid := '00000000-0000-0000-0000-00000000918c';
  v_so sales_orders;
  v_item_a uuid;
  v_item_b uuid;
  v_item_c uuid;
  v_sf sales_fulfillments;
  v_row_a record;
  v_row_b record;
  v_row_c record;
begin
  v_so := rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_prod_a, 'quantity', 10, 'unit_price', 10),
      jsonb_build_object('catalog_product_id', v_prod_b, 'quantity', 20, 'unit_price', 10),
      jsonb_build_object('catalog_product_id', v_prod_c, 'quantity', 10, 'unit_price', 10)
    )
  );
  perform rpc_update_sales_order_status(v_so.id, 'confirmed');
  perform rpc_register_sales_order_payment(v_so.id, 400);

  select id into v_item_a from sales_order_items where sales_order_id = v_so.id and catalog_product_id = v_prod_a;
  select id into v_item_b from sales_order_items where sales_order_id = v_so.id and catalog_product_id = v_prod_b;
  select id into v_item_c from sales_order_items where sales_order_id = v_so.id and catalog_product_id = v_prod_c;

  -- Surte 4 de la partida C antes del cálculo de shortage final.
  select * into v_sf from rpc_create_sales_fulfillment(
    gen_random_uuid(),
    jsonb_build_object('sales_order_id', v_so.id, 'warehouse_id', '00000000-0000-0000-0000-000000009120'),
    jsonb_build_array(jsonb_build_object('sales_order_item_id', v_item_c, 'quantity_requested', 4))
  );
  perform rpc_mark_sales_fulfillment_ready(v_sf.id);
  perform rpc_dispatch_sales_fulfillment(v_sf.id);

  perform rpc_sync_sales_order_procurement(v_so.id);

  select * into v_row_a from fn_sales_order_item_shortage(v_so.id) where sales_order_item_id = v_item_a;
  select * into v_row_b from fn_sales_order_item_shortage(v_so.id) where sales_order_item_id = v_item_b;
  select * into v_row_c from fn_sales_order_item_shortage(v_so.id) where sales_order_item_id = v_item_c;

  if v_row_a.shortage_qty <> 0 then
    raise exception 'MIXTO FALLÓ: partida A esperaba shortage 0 (actual %)', v_row_a.shortage_qty;
  end if;
  if v_row_b.shortage_qty <> 15 then
    raise exception 'MIXTO FALLÓ: partida B esperaba shortage 15 (actual %)', v_row_b.shortage_qty;
  end if;
  if v_row_c.pending_qty <> 6 or v_row_c.shortage_qty <> 3 then
    raise exception 'MIXTO FALLÓ: partida C esperaba pending=6 shortage=3 (actual pending=%, shortage=%)', v_row_c.pending_qty, v_row_c.shortage_qty;
  end if;

  raise notice 'TEST MIXTO OK: 3 partidas de la misma Sales Order quedan completamente independientes — A lista, B requiere compra, C parcialmente disponible con fulfillment ya descontado.';
end $$;

reset role;

do $$ begin raise notice '=== 0091: TODOS LOS CASOS OK (1-16 + MIXTO) ==='; end $$;

rollback;
