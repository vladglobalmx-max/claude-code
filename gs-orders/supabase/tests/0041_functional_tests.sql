-- THÖREN — Fase 6R.1B-1: can_view_all_sales (0041) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0041 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible. Usuarios "Diana"/
-- "Karla" son usuarios de PRUEBA sintéticos (rol vendedor, sin cambio de
-- rol real) — la asignación real a las personas reales vive en un bloque
-- SEPARADO para Supabase Cloud, no en esta suite ni en la migración.

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
  select
    :'org1'::uuid as org1,
    :'customer1'::uuid as customer1,
    '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
    '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
    '20000000-0000-0000-0000-000000000001'::uuid as orgb,
    -- usuarios sintéticos de esta suite, fuera del rango de fixtures.sql:
    '00000000-0000-0000-0000-000000000041'::uuid as diana_id,
    '00000000-0000-0000-0000-000000000042'::uuid as karla_id,
    '00000000-0000-0000-0000-000000000043'::uuid as orgb_vendedor_id,
    '10000000-0000-0000-0000-000000000041'::uuid as diana_sp_id,
    '10000000-0000-0000-0000-000000000042'::uuid as karla_sp_id,
    '10000000-0000-0000-0000-000000000043'::uuid as orgb_vendedor_sp_id;

-- =========================================================================
-- FIXTURES
-- =========================================================================
do $$
declare
  v_org1 uuid; v_orgb uuid; v_customer1 uuid;
  v_salesperson1 uuid; v_diana_id uuid; v_karla_id uuid; v_orgb_vendedor_id uuid;
  v_diana_sp uuid; v_karla_sp uuid; v_orgb_vendedor_sp uuid;
  v_admin_id uuid := '00000000-0000-0000-0000-000000000001';
  v_admin_orgb_id uuid := '00000000-0000-0000-0000-000000000009';
begin
  select org1, orgb, customer1, salesperson1, diana_id, karla_id, orgb_vendedor_id, diana_sp_id, karla_sp_id, orgb_vendedor_sp_id
    into v_org1, v_orgb, v_customer1, v_salesperson1, v_diana_id, v_karla_id, v_orgb_vendedor_id, v_diana_sp, v_karla_sp, v_orgb_vendedor_sp
    from _ids;

  -- Diana/Karla: usuarios de PRUEBA, rol vendedor sin cambio (6R.1B-1 no
  -- cambia roles reales) — cada uno necesita salesperson_id propio por
  -- user_profiles_vendedor_requires_salesperson (0011), aunque en esta
  -- suite no se les crea ningún pedido/cotización propia (solo importa lo
  -- que ven de OTROS gracias a can_view_all_sales).
  insert into auth.users (id, email) values
    (v_diana_id, 'diana-test-0041@test.local'),
    (v_karla_id, 'karla-test-0041@test.local'),
    (v_orgb_vendedor_id, 'orgb-vendedor-test-0041@test.local')
  on conflict (id) do nothing;

  insert into salespeople (id, business_unit, name, prefix, active) values
    (v_diana_sp, 'thunder', 'Diana Test', 'DIA', true),
    (v_karla_sp, 'thunder', 'Karla Test', 'KAR', true),
    (v_orgb_vendedor_sp, 'thunder', 'Vendedor Org B Test', 'OBV', true)
  on conflict (id) do nothing;

  -- organization_members exige is_organization_admin(organization_id) DE
  -- ESA organización — 'admin' (org1) solo puede insertar las filas de
  -- org1 aquí; la fila de Org B se inserta más abajo como admin_orgb.
  insert into organization_members (organization_id, user_id, role, active) values
    (v_org1, v_diana_id, 'vendedor', true),
    (v_org1, v_karla_id, 'vendedor', true)
  on conflict (organization_id, user_id) do nothing;

  -- user_profiles no tiene organization_id (es global por usuario) — su
  -- policy de escritura es current_user_is_admin() sin scope de
  -- organización, así que las 3 filas se pueden crear aquí sin problema.
  insert into user_profiles (user_id, name, role, salesperson_id, active) values
    (v_diana_id, 'Diana Test', 'vendedor', v_diana_sp, true),
    (v_karla_id, 'Karla Test', 'vendedor', v_karla_sp, true),
    (v_orgb_vendedor_id, 'Vendedor Org B Test', 'vendedor', v_orgb_vendedor_sp, true)
  on conflict (user_id) do nothing;

  -- Quote/Order "ajenos" (propiedad de vendedor1/salesperson1) — lo que
  -- Diana/Karla NO podrían ver sin can_view_all_sales.
  perform set_config('test.customer0041_id', v_customer1::text, false);
end $$;

select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid; v_orgb_vendedor_id uuid;
begin
  select orgb, orgb_vendedor_id into v_orgb, v_orgb_vendedor_id from _ids;
  insert into organization_members (organization_id, user_id, role, active) values
    (v_orgb, v_orgb_vendedor_id, 'vendedor', true)
  on conflict (organization_id, user_id) do nothing;
end $$;

-- Vuelve a admin de org1 (el bloque anterior corrió como admin_orgb): la
-- Quote/Order resultantes son "de vendedor1" por su salesperson_id, sin
-- importar qué rol ejecutó el INSERT/RPC (mismo criterio que 0021 TEST 22,
-- que crea la Quote de regresión como admin). Además, la tabla `people`
-- (usada por el trigger de integridad de salesperson_quote_sequences) es
-- de SELECT admin-only — vendedor1 no podría resolverla.
select test_set_user(:'admin');
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid;
  v_quote quotes;
  v_order orders;
  v_bu_id uuid;
  v_org_id uuid;
begin
  select customer1, salesperson1 into v_customer1, v_salesperson1 from _ids;
  select id, organization_id into v_bu_id, v_org_id from business_units where code = 'thunder_safety';

  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values (v_org_id, v_salesperson1, v_bu_id, 'V41')
  on conflict do nothing;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":1000,"line_discount_percent":0}]'::jsonb
  );
  perform set_config('test.quote0041_id', v_quote.id::text, false);

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'Cliente 0041',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-0041', 'quantity', 10, 'unit', 'pza'))
  );
  perform set_config('test.order0041_id', v_order.id::text, false);

  raise notice 'SETUP OK: Quote % y Order % de vendedor1 (ajenos a Diana/Karla)', v_quote.folio, v_order.folio;
end $$;

select test_set_user(:'admin');
do $$
declare
  v_org1 uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_order_item_id uuid;
  v_supplier suppliers;
  v_po purchase_orders;
  v_warehouse warehouses;
  v_product product_catalog;
  v_reservation inventory_reservations;
  v_delivery deliveries;
  v_order_image_id uuid;
  v_order_file_id uuid;
  v_order_item_image_id uuid;
  v_poi_id uuid;
  v_reservation_event_id uuid;
  v_delivery_item_id uuid;
  v_status_history_count int;
begin
  select org1 into v_org1 from _ids;
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'PROY-0041';

  insert into suppliers (organization_id, name, active)
  values (v_org1, 'Proveedor 0041', true) returning * into v_supplier;

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object(
      'order_id', v_order_id, 'supplier_id', v_supplier.id, 'po_date', current_date::text,
      'supplier_commitment_date', (current_date + 10)::text, 'estimated_reception_date', (current_date + 15)::text
    ),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 10))
  );
  perform set_config('test.po0041_id', v_po.id::text, false);

  insert into warehouses (organization_id, name, code)
  values (v_org1, 'Almacén 0041', 'ALM-0041') returning * into v_warehouse;

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-0041', 'Producto 0041', 'pza', true) returning * into v_product;

  update order_items set catalog_product_id = v_product.id where id = v_order_item_id;

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 10)
  );

  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product.id, v_warehouse.id, 5);
  perform set_config('test.reservation0041_id', v_reservation.id::text, false);
  perform rpc_fulfill_inventory_reservation(v_reservation.id, 5);

  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product.id, 'quantity_delivered', 5))
  );
  perform set_config('test.delivery0041_id', v_delivery.id::text, false);

  -- order_images/order_files/order_item_images: fixtures adicionales para
  -- probar las 3 policies nuevas (FOR ALL -> nueva policy SELECT separada).
  insert into order_images (order_id, storage_path) values (v_order_id, 'order-media/0041-imagen.jpg')
    returning id into v_order_image_id;
  perform set_config('test.orderimage0041_id', v_order_image_id::text, false);

  insert into order_files (order_id, storage_path, file_name) values (v_order_id, 'order-files/0041-archivo.pdf', '0041-archivo.pdf')
    returning id into v_order_file_id;
  perform set_config('test.orderfile0041_id', v_order_file_id::text, false);

  insert into order_item_images (order_item_id, kind, storage_path) values (v_order_item_id, 'reference', 'order-media/0041-item.jpg')
    returning id into v_order_item_image_id;
  perform set_config('test.orderitemimage0041_id', v_order_item_image_id::text, false);

  select id into v_poi_id from purchase_order_items where purchase_order_id = v_po.id;
  perform set_config('test.poi0041_id', v_poi_id::text, false);

  select id into v_reservation_event_id from inventory_reservation_events where reservation_id = v_reservation.id order by changed_at asc limit 1;
  perform set_config('test.reservationevent0041_id', v_reservation_event_id::text, false);

  select id into v_delivery_item_id from delivery_items where delivery_id = v_delivery.id;
  perform set_config('test.deliveryitem0041_id', v_delivery_item_id::text, false);

  select count(*) into v_status_history_count from delivery_status_history where delivery_id = v_delivery.id;
  if v_status_history_count = 0 then
    raise exception 'SETUP FALLÓ: se esperaba al menos 1 fila en delivery_status_history para la entrega recién creada';
  end if;

  raise notice 'SETUP OK: PO %, reserva %, entrega % (todos ajenos a Diana/Karla)', v_po.folio, v_reservation.id, v_delivery.id;
end $$;

-- Grants: Diana y Karla reciben can_view_all_sales (Org 1); el vendedor de
-- Org B recibe can_view_all_sales EN SU PROPIA org (Org B) — nunca en Org 1.
do $$
declare v_org1 uuid; v_orgb uuid; v_diana_id uuid; v_karla_id uuid; v_orgb_vendedor_id uuid; v_admin_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  select org1, orgb, diana_id, karla_id, orgb_vendedor_id into v_org1, v_orgb, v_diana_id, v_karla_id, v_orgb_vendedor_id from _ids;
  insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
    (v_org1, v_diana_id, 'can_view_all_sales', v_admin_id),
    (v_org1, v_karla_id, 'can_view_all_sales', v_admin_id);
end $$;
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid; v_orgb_vendedor_id uuid; v_admin_orgb_id uuid := '00000000-0000-0000-0000-000000000009';
begin
  select orgb, orgb_vendedor_id into v_orgb, v_orgb_vendedor_id from _ids;
  insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
    (v_orgb, v_orgb_vendedor_id, 'can_view_all_sales', v_admin_orgb_id);
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 1: Diana ve la Quote ajena de vendedor1.
-- =========================================================================
select test_set_user((select diana_id from _ids));
do $$
declare v_quote_id uuid := current_setting('test.quote0041_id')::uuid; v_found boolean;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if not v_found then raise exception 'TEST 1 FALLÓ: Diana debería ver la Quote ajena con can_view_all_sales'; end if;
  raise notice 'TEST 1 OK: Diana ve la Quote ajena.';
end $$;

-- =========================================================================
-- TEST 2: Diana NO puede editar la Quote ajena (SOLO lectura).
-- =========================================================================
do $$
declare v_quote_id uuid := current_setting('test.quote0041_id')::uuid; v_rows int;
begin
  update quotes set notes = 'intento de Diana' where id = v_quote_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 2 FALLÓ: Diana NO debería poder editar una Quote ajena'; end if;
  raise notice 'TEST 2 OK: Diana no puede editar la Quote ajena (0 filas afectadas).';
end $$;

-- =========================================================================
-- TEST 3: Diana ve el Order ajeno de vendedor1.
-- =========================================================================
do $$
declare v_order_id uuid := current_setting('test.order0041_id')::uuid; v_found boolean;
begin
  select exists(select 1 from orders where id = v_order_id) into v_found;
  if not v_found then raise exception 'TEST 3 FALLÓ: Diana debería ver el Order ajeno con can_view_all_sales'; end if;
  raise notice 'TEST 3 OK: Diana ve el Order ajeno.';
end $$;

-- =========================================================================
-- TEST 4: Diana NO puede editar el Order ajeno.
-- =========================================================================
do $$
declare v_order_id uuid := current_setting('test.order0041_id')::uuid; v_rows int;
begin
  update orders set client_name = 'intento de Diana' where id = v_order_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 4 FALLÓ: Diana NO debería poder editar un Order ajeno'; end if;
  raise notice 'TEST 4 OK: Diana no puede editar el Order ajeno (0 filas afectadas).';
end $$;

-- =========================================================================
-- Bonus: Diana ve la Inventory Reservation ajena (lectura) — extiende la
-- cobertura mínima pedida a las 5 tablas tocadas por 0041.
-- =========================================================================
do $$
declare v_reservation_id uuid := current_setting('test.reservation0041_id')::uuid; v_found boolean;
begin
  select exists(select 1 from inventory_reservations where id = v_reservation_id) into v_found;
  if not v_found then raise exception 'BONUS FALLÓ: Diana debería ver la Reservation ajena con can_view_all_sales'; end if;
  raise notice 'BONUS OK: Diana ve la Inventory Reservation ajena.';
end $$;

-- =========================================================================
-- TEST 5: Karla ve la Quote ajena.
-- TEST 6: Karla ve el Order ajeno.
-- TEST 7: Karla ve la Purchase Order relacionada en lectura.
-- TEST 8: Karla NO puede modificar la PO.
-- =========================================================================
select test_set_user((select karla_id from _ids));
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_po_id uuid := current_setting('test.po0041_id')::uuid;
  v_delivery_id uuid := current_setting('test.delivery0041_id')::uuid;
  v_found boolean;
  v_rows int;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if not v_found then raise exception 'TEST 5 FALLÓ: Karla debería ver la Quote ajena'; end if;
  raise notice 'TEST 5 OK: Karla ve la Quote ajena.';

  select exists(select 1 from orders where id = v_order_id) into v_found;
  if not v_found then raise exception 'TEST 6 FALLÓ: Karla debería ver el Order ajeno'; end if;
  raise notice 'TEST 6 OK: Karla ve el Order ajeno.';

  select exists(select 1 from purchase_orders where id = v_po_id) into v_found;
  if not v_found then raise exception 'TEST 7 FALLÓ: Karla debería ver la Purchase Order relacionada'; end if;
  raise notice 'TEST 7 OK: Karla ve la Purchase Order en lectura.';

  update purchase_orders set notes = 'intento de Karla' where id = v_po_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 8 FALLÓ: Karla NO debería poder modificar la PO'; end if;
  raise notice 'TEST 8 OK: Karla no puede modificar la PO (0 filas afectadas).';

  select exists(select 1 from deliveries where id = v_delivery_id) into v_found;
  if not v_found then raise exception 'BONUS FALLÓ: Karla debería ver la Delivery ajena con can_view_all_sales'; end if;
  raise notice 'BONUS OK: Karla ve la Delivery ajena.';
end $$;

-- =========================================================================
-- TEST 9: vendedor normal (vendedor2, SIN can_view_all_sales) NO ve la
-- Quote ajena. TEST 10: NO ve el Order ajeno. TEST 11: NO gana acceso a
-- la PO ajena.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_po_id uuid := current_setting('test.po0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 9 FALLÓ: vendedor2 NO debería ver una Quote ajena (sin can_view_all_sales)'; end if;
  raise notice 'TEST 9 OK: vendedor2 no ve la Quote ajena.';

  select exists(select 1 from orders where id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 10 FALLÓ: vendedor2 NO debería ver un Order ajeno'; end if;
  raise notice 'TEST 10 OK: vendedor2 no ve el Order ajeno.';

  select exists(select 1 from purchase_orders where id = v_po_id) into v_found;
  if v_found then raise exception 'TEST 11 FALLÓ: vendedor2 NO debería ganar acceso a una PO ajena'; end if;
  raise notice 'TEST 11 OK: vendedor2 no gana acceso a la PO ajena — comportamiento sin cambios.';
end $$;

-- =========================================================================
-- TEST 12: admin mantiene acceso total (sin necesitar la capability).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_po_id uuid := current_setting('test.po0041_id')::uuid;
  v_reservation_id uuid := current_setting('test.reservation0041_id')::uuid;
  v_delivery_id uuid := current_setting('test.delivery0041_id')::uuid;
  v_count int;
begin
  select count(*) into v_count from quotes where id = v_quote_id;
  select count(*) + v_count into v_count from orders where id = v_order_id;
  select count(*) + v_count into v_count from purchase_orders where id = v_po_id;
  select count(*) + v_count into v_count from inventory_reservations where id = v_reservation_id;
  select count(*) + v_count into v_count from deliveries where id = v_delivery_id;
  if v_count <> 5 then raise exception 'TEST 12 FALLÓ: admin debería ver las 5 filas (Quote/Order/PO/Reservation/Delivery), vio %', v_count; end if;
  raise notice 'TEST 12 OK: admin mantiene acceso total, sin cambios.';
end $$;

-- =========================================================================
-- TEST 13: cross-org sigue bloqueado — vendedor de Org B (SIN capability
-- en Org 1) no ve la Quote/Order de Org 1.
-- =========================================================================
select test_set_user((select orgb_vendedor_id from _ids));
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 13 FALLÓ: vendedor de Org B no debería ver una Quote de Org 1'; end if;

  select exists(select 1 from orders where id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 13 FALLÓ: vendedor de Org B no debería ver un Order de Org 1'; end if;
  raise notice 'TEST 13 OK: cross-org sigue bloqueado (vendedor de Org B, sin capability en Org 1).';
end $$;

-- =========================================================================
-- TEST 14: can_view_all_sales otorgado en Org B NO aplica a datos de
-- Org 1 — mismo usuario que TEST 13, pero ahora CON la capability
-- (otorgada en Org B, ver fixtures arriba).
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 14 FALLÓ: can_view_all_sales de Org B no debería aplicar a una Quote de Org 1'; end if;

  select exists(select 1 from orders where id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 14 FALLÓ: can_view_all_sales de Org B no debería aplicar a un Order de Org 1'; end if;
  raise notice 'TEST 14 OK: can_view_all_sales de otra organización no aplica (aislamiento cross-org intacto).';
end $$;

-- =========================================================================
-- TEST 15: revocar la capability elimina INMEDIATAMENTE la visibilidad
-- global — Diana deja de ver la Quote/Order ajenos en cuanto se
-- desactiva su fila en user_capabilities (sin relogin, sin caché).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_diana_id uuid; begin
  select diana_id into v_diana_id from _ids;
  update user_capabilities set active = false, revoked_by_user_id = '00000000-0000-0000-0000-000000000001', revoked_at = now()
    where user_id = v_diana_id and capability = 'can_view_all_sales';
end $$;

select test_set_user((select diana_id from _ids));
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 15 FALLÓ: Diana NO debería seguir viendo la Quote ajena tras revocar can_view_all_sales'; end if;

  select exists(select 1 from orders where id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 15 FALLÓ: Diana NO debería seguir viendo el Order ajeno tras revocar can_view_all_sales'; end if;
  raise notice 'TEST 15 OK: revocar can_view_all_sales elimina la visibilidad global de inmediato.';
end $$;

-- =========================================================================
-- AJUSTE — coherencia encabezado -> detalle (mismo archivo 0041). Re-
-- otorga can_view_all_sales a Diana (se revocó en TEST 15) para poder
-- probar el detalle completo.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org1 uuid; v_diana_id uuid; begin
  select org1, diana_id into v_org1, v_diana_id from _ids;
  update user_capabilities set active = true, revoked_at = null, revoked_by_user_id = null
    where organization_id = v_org1 and user_id = v_diana_id and capability = 'can_view_all_sales';
end $$;

-- =========================================================================
-- TEST 16: Diana ve el detalle completo de la Reservation ajena (eventos).
-- TEST 17: Diana NO puede modificar la Reservation ni sus eventos (no hay
-- policy de escritura para `authenticated` en ninguna de las dos —
-- confirmado en la auditoría; se prueba igual por completitud).
-- =========================================================================
select test_set_user((select diana_id from _ids));
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0041_id')::uuid;
  v_event_id uuid := current_setting('test.reservationevent0041_id')::uuid;
  v_found boolean;
  v_rows int;
begin
  select exists(select 1 from inventory_reservations where id = v_reservation_id) into v_found;
  if not v_found then raise exception 'TEST 16 FALLÓ: Diana debería ver la Reservation ajena'; end if;
  select exists(select 1 from inventory_reservation_events where id = v_event_id) into v_found;
  if not v_found then raise exception 'TEST 16 FALLÓ: Diana debería ver los eventos de la Reservation ajena'; end if;
  raise notice 'TEST 16 OK: Diana ve la Reservation ajena y su detalle (eventos).';

  update inventory_reservations set quantity = 999 where id = v_reservation_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 17 FALLÓ: Diana NO debería poder modificar la Reservation ajena'; end if;
  raise notice 'TEST 17 OK: Diana no puede modificar la Reservation ajena (0 filas afectadas; sin policy de escritura para authenticated).';
end $$;

-- =========================================================================
-- TEST 18: Karla ve el detalle completo de la Delivery ajena (items +
-- status history). TEST 19: Karla NO puede modificar la Delivery ni sus
-- items (delivery_files_via_delivery es FOR ALL pero no se tocó; delivery/
-- delivery_items no tienen policy de escritura para authenticated).
-- =========================================================================
select test_set_user((select karla_id from _ids));
do $$
declare
  v_delivery_id uuid := current_setting('test.delivery0041_id')::uuid;
  v_delivery_item_id uuid := current_setting('test.deliveryitem0041_id')::uuid;
  v_found boolean;
  v_history_count int;
  v_rows int;
begin
  select exists(select 1 from delivery_items where id = v_delivery_item_id) into v_found;
  if not v_found then raise exception 'TEST 18 FALLÓ: Karla debería ver las partidas de la Delivery ajena'; end if;

  select count(*) into v_history_count from delivery_status_history where delivery_id = v_delivery_id;
  if v_history_count = 0 then raise exception 'TEST 18 FALLÓ: Karla debería ver el historial de estado de la Delivery ajena'; end if;
  raise notice 'TEST 18 OK: Karla ve la Delivery ajena y su detalle completo (items + historial de estado).';

  update delivery_items set quantity_delivered = 999 where id = v_delivery_item_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 19 FALLÓ: Karla NO debería poder modificar las partidas de la Delivery ajena'; end if;
  raise notice 'TEST 19 OK: Karla no puede modificar las partidas de la Delivery ajena (0 filas afectadas).';
end $$;

-- =========================================================================
-- TEST 20: Karla ve las partidas de la Purchase Order ajena.
-- TEST 21: Karla NO puede modificar las partidas de la PO.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0041_id')::uuid;
  v_found boolean;
  v_rows int;
begin
  select exists(select 1 from purchase_order_items where id = v_poi_id) into v_found;
  if not v_found then raise exception 'TEST 20 FALLÓ: Karla debería ver las partidas de la Purchase Order ajena'; end if;
  raise notice 'TEST 20 OK: Karla ve las partidas de la Purchase Order ajena.';

  update purchase_order_items set quantity_ordered = 999 where id = v_poi_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'TEST 21 FALLÓ: Karla NO debería poder modificar las partidas de la PO'; end if;
  raise notice 'TEST 21 OK: Karla no puede modificar las partidas de la PO (0 filas afectadas).';
end $$;

-- =========================================================================
-- TEST 22: Quote ajena renderizable COMPLETA para Diana (encabezado +
-- partidas, sin faltar ninguna de las 2 tablas involucradas).
-- =========================================================================
select test_set_user((select diana_id from _ids));
do $$
declare
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_header_found boolean;
  v_items_count int;
begin
  select exists(select 1 from quotes where id = v_quote_id) into v_header_found;
  select count(*) into v_items_count from quote_items where quote_id = v_quote_id;
  if not v_header_found or v_items_count = 0 then
    raise exception 'TEST 22 FALLÓ: Quote ajena debe ser renderizable completa (encabezado=%, partidas=%)', v_header_found, v_items_count;
  end if;
  raise notice 'TEST 22 OK: Quote ajena renderizable completa para Diana (encabezado + % partida(s)).', v_items_count;
end $$;

-- =========================================================================
-- TEST 23: Order ajeno renderizable COMPLETO para Karla (encabezado +
-- partidas + imágenes + archivos + imágenes de partida + historial
-- operativo — las 6 tablas que get-order-detail.ts realmente consulta).
-- =========================================================================
select test_set_user((select karla_id from _ids));
do $$
declare
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_order_image_id uuid := current_setting('test.orderimage0041_id')::uuid;
  v_order_file_id uuid := current_setting('test.orderfile0041_id')::uuid;
  v_order_item_image_id uuid := current_setting('test.orderitemimage0041_id')::uuid;
  v_header_found boolean;
  v_items_count int;
  v_image_found boolean;
  v_file_found boolean;
  v_item_image_found boolean;
begin
  select exists(select 1 from orders where id = v_order_id) into v_header_found;
  select count(*) into v_items_count from order_items where order_id = v_order_id;
  select exists(select 1 from order_images where id = v_order_image_id) into v_image_found;
  select exists(select 1 from order_files where id = v_order_file_id) into v_file_found;
  select exists(select 1 from order_item_images where id = v_order_item_image_id) into v_item_image_found;

  if not (v_header_found and v_items_count > 0 and v_image_found and v_file_found and v_item_image_found) then
    raise exception 'TEST 23 FALLÓ: Order ajeno debe ser renderizable completo (header=%, items=%, image=%, file=%, item_image=%)',
      v_header_found, v_items_count, v_image_found, v_file_found, v_item_image_found;
  end if;
  raise notice 'TEST 23 OK: Order ajeno renderizable completo para Karla (encabezado + partidas + imágenes + archivos).';
end $$;

-- =========================================================================
-- TEST 24: vendedor normal (vendedor2, SIN can_view_all_sales) sigue SIN
-- acceso al detalle ajeno (partidas de Order/PO, eventos de Reservation).
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_poi_id uuid := current_setting('test.poi0041_id')::uuid;
  v_event_id uuid := current_setting('test.reservationevent0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from order_items where order_id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 24 FALLÓ: vendedor2 NO debería ver las partidas de un Order ajeno'; end if;

  select exists(select 1 from purchase_order_items where id = v_poi_id) into v_found;
  if v_found then raise exception 'TEST 24 FALLÓ: vendedor2 NO debería ver las partidas de una PO ajena'; end if;

  select exists(select 1 from inventory_reservation_events where id = v_event_id) into v_found;
  if v_found then raise exception 'TEST 24 FALLÓ: vendedor2 NO debería ver eventos de una Reservation ajena'; end if;
  raise notice 'TEST 24 OK: vendedor normal sigue sin acceso al detalle ajeno.';
end $$;

-- =========================================================================
-- TEST 25: cross-org sigue bloqueado también a nivel de detalle —
-- vendedor de Org B (con can_view_all_sales EN ORG B) no ve las partidas
-- del Order/Quote de Org 1.
-- =========================================================================
select test_set_user((select orgb_vendedor_id from _ids));
do $$
declare
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from order_items where order_id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 25 FALLÓ: vendedor de Org B no debería ver partidas de un Order de Org 1'; end if;

  select exists(select 1 from quote_items where quote_id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 25 FALLÓ: vendedor de Org B no debería ver partidas de una Quote de Org 1'; end if;
  raise notice 'TEST 25 OK: cross-org sigue bloqueado a nivel de detalle (can_view_all_sales de Org B no aplica a Org 1).';
end $$;

-- =========================================================================
-- TEST 26: revocar can_view_all_sales elimina INMEDIATAMENTE la
-- visibilidad del detalle también (no solo del encabezado) — Diana pierde
-- acceso a las partidas de la Quote/Order en cuanto se revoca.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org1 uuid; v_diana_id uuid; begin
  select org1, diana_id into v_org1, v_diana_id from _ids;
  update user_capabilities set active = false, revoked_by_user_id = '00000000-0000-0000-0000-000000000001', revoked_at = now()
    where organization_id = v_org1 and user_id = v_diana_id and capability = 'can_view_all_sales';
end $$;

select test_set_user((select diana_id from _ids));
do $$
declare
  v_order_id uuid := current_setting('test.order0041_id')::uuid;
  v_quote_id uuid := current_setting('test.quote0041_id')::uuid;
  v_found boolean;
begin
  select exists(select 1 from order_items where order_id = v_order_id) into v_found;
  if v_found then raise exception 'TEST 26 FALLÓ: Diana NO debería seguir viendo partidas del Order ajeno tras revocar'; end if;

  select exists(select 1 from quote_items where quote_id = v_quote_id) into v_found;
  if v_found then raise exception 'TEST 26 FALLÓ: Diana NO debería seguir viendo partidas de la Quote ajena tras revocar'; end if;
  raise notice 'TEST 26 OK: revocar can_view_all_sales elimina encabezado + detalle de inmediato.';
end $$;

rollback;
