-- THÖREN — Fase 6R.1B-2A: Autoridad backend de Logística Cross-Sales
-- (0044) — pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0044 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final — repetible.
-- Bajo `set role authenticated` REAL (lección de 0043) — no se asume que
-- pasar como dueño de las tablas reproduce el comportamiento de Cloud.
--
-- NO usa el nombre real de Rodolfo — el usuario logístico sintético se
-- llama "logistics_user" en todo el archivo. Ninguna capability se asigna
-- a ningún usuario REAL aquí — 6R.1B-2C (fuera de este archivo) hará eso.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set logistics_user '00000000-0000-0000-0000-000000000044'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- FIXTURES
-- =========================================================================
-- - logistics_user: vendedor activo, CON su propio salesperson (para
--   probar regresión #21 — dueño de su propio registro, sin capability).
--   Sin ninguna capability al inicio; cada bloque de test le otorga
--   SOLO la capability necesaria justo antes de usarla y la revoca al
--   terminar, para que los tests sean independientes entre sí.
-- - Producto de catálogo con 200 ON HAND en un almacén de Org 1.
-- - Pedido AJENO (de vendedor1/salesperson1) con ese producto — este es el
--   Pedido sobre el que logistics_user intentará operar cross-sales.
-- - Cotización AJENA (de vendedor1) para las pruebas comerciales #19/#20.
-- - Proveedor + Purchase Order (Ordenada) sobre ese Pedido, para las
--   pruebas de recepción #13-17.
-- - Un vendedor de Org B con can_reserve_inventory otorgada EN ORG B, para
--   la prueba de aislamiento #18.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_logistics_sp_id uuid;
  v_order orders;
  v_ajeno_order_id uuid;
  v_product product_catalog;
  v_warehouse warehouses;
  v_quote quotes;
  v_bu1 uuid;
  v_person1 uuid;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  -- logistics_user: cuenta + salesperson propio (función comercial propia,
  -- ver auditoría 6R.1B-2 §8 — mantiene role='vendedor', SIN cambio de rol).
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Logistics User 0044', 'LU4', true)
  returning id into v_logistics_sp_id;
  perform set_config('test.logistics_sp0044_id', v_logistics_sp_id::text, false);

  insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000044', 'logistics-user-0044@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, '00000000-0000-0000-0000-000000000044', 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values ('00000000-0000-0000-0000-000000000044', 'Logistics User 0044', 'vendedor', v_logistics_sp_id, true);

  -- Producto + almacén + ON HAND (200 unidades).
  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-0044-001', 'Producto Logística 0044', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0044_id', v_product.id::text, false);

  insert into warehouses (organization_id, name, code)
  values (v_org1, 'Almacén 0044', 'ALM-0044')
  returning * into v_warehouse;
  perform set_config('test.warehouse0044_id', v_warehouse.id::text, false);

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 200)
  );

  -- Pedido AJENO (de vendedor1/salesperson1) — logistics_user NUNCA es dueño.
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'Cliente Ajeno 0044',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-0044', 'quantity', 50, 'unit', 'pza'))
  );
  v_ajeno_order_id := v_order.id;
  update order_items set catalog_product_id = v_product.id where order_id = v_ajeno_order_id and model = 'MODELO-0044';
  perform set_config('test.ajeno_order0044_id', v_ajeno_order_id::text, false);

  -- Cotización AJENA (de vendedor1) — solo para las pruebas comerciales.
  -- rpc_create_quote exige: business_unit_id real, salesperson1 con
  -- person_id resoluble a org1 (trg_check_quote_consistency, 0020), y una
  -- fila en salesperson_quote_sequences para salesperson1×bu1.
  select id into v_bu1 from business_units where organization_id = v_org1 and code = 'got_fresh_breath';

  select person_id into v_person1 from salespeople where id = v_salesperson1;
  if v_person1 is null then
    insert into people (organization_id, name, active)
    values (v_org1, 'Persona Vendedor Uno 0044', true)
    returning id into v_person1;
    update salespeople set person_id = v_person1 where id = v_salesperson1;
  end if;

  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values (v_org1, v_salesperson1, v_bu1, 'VU1Q44')
  on conflict do nothing;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu1, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
      'quote_date', current_date::text, 'valid_until', (current_date + 15)::text,
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0
    ),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'model', 'COT-0044', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0))
  );
  perform set_config('test.ajeno_quote0044_id', v_quote.id::text, false);

  raise notice 'SETUP OK: producto %, Pedido ajeno % (vendedor1), Cotización ajena % (vendedor1), logistics_user salesperson %',
    v_product.id, v_ajeno_order_id, v_quote.id, v_logistics_sp_id;
end $$;

-- Org B: vendedor con can_reserve_inventory otorgada EN ORG B (aislamiento #18).
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid; v_vendedor_orgb_id uuid := '00000000-0000-0000-0000-000000000045'; v_sp_orgb_id uuid;
begin
  select orgb into v_orgb from _ids;
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor OrgB 0044', 'VOB', true)
  returning id into v_sp_orgb_id;
  insert into auth.users (id, email) values (v_vendedor_orgb_id, 'vendedor-orgb-0044@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_orgb, v_vendedor_orgb_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_vendedor_orgb_id, 'Vendedor OrgB 0044', 'vendedor', v_sp_orgb_id, true);
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values (v_orgb, v_vendedor_orgb_id, 'can_reserve_inventory', true, '00000000-0000-0000-0000-000000000009');
  perform set_config('test.vendedor_orgb0044_id', v_vendedor_orgb_id::text, false);
end $$;
select test_set_user(:'admin');

-- Helper: otorgar/revocar una capability a logistics_user en Org 1, sin
-- pasar por RLS (como haría el flujo real de asignación) — aquí basta
-- correr como admin (ya lo estamos) e insertar/desactivar directamente,
-- porque lo que se prueba es la AUTORIDAD resultante, no el flujo de
-- asignación (ya probado en 0040_functional_tests.sql).
do $$
declare v_org1 uuid; v_logistics_id uuid := '00000000-0000-0000-0000-000000000044';
begin
  select org1 into v_org1 from _ids;
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values
    (v_org1, v_logistics_id, 'can_reserve_inventory', false, '00000000-0000-0000-0000-000000000001'),
    (v_org1, v_logistics_id, 'can_fulfill_inventory', false, '00000000-0000-0000-0000-000000000001'),
    (v_org1, v_logistics_id, 'can_manage_deliveries', false, '00000000-0000-0000-0000-000000000001'),
    (v_org1, v_logistics_id, 'can_receive_inventory', false, '00000000-0000-0000-0000-000000000001')
  on conflict (organization_id, user_id, capability) do nothing;
end $$;

-- =========================================================================
-- RESERVAS
-- =========================================================================

-- TEST 1: logistics_user con SOLO can_reserve_inventory puede reservar en
-- el Pedido ajeno (vendedor1).
update user_capabilities set active = true where user_id = :'logistics_user' and capability = 'can_reserve_inventory';
select test_set_user(:'logistics_user');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 10);
  if v_reservation.quantity <> 10 then
    raise exception 'TEST 1 FALLÓ: cantidad reservada inesperada: %', v_reservation.quantity;
  end if;
  perform set_config('test.reservation0044_id', v_reservation.id::text, false);
  raise notice 'TEST 1 OK: logistics_user con can_reserve_inventory reserva en Pedido ajeno.';
end $$;

-- TEST 2: puede ajustar esa misma reserva.
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0044_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_adjust_inventory_reservation(v_reservation_id, 15);
  if v_reservation.quantity <> 15 then
    raise exception 'TEST 2 FALLÓ: cantidad ajustada inesperada: %', v_reservation.quantity;
  end if;
  raise notice 'TEST 2 OK: logistics_user ajusta la reserva ajena.';
end $$;

-- TEST 4 (antes de liberar, para no perder la reserva): NO puede surtir
-- sin can_fulfill_inventory (solo tiene can_reserve_inventory activa).
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0044_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_fulfill_inventory_reservation(v_reservation_id, 5);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: logistics_user sin can_fulfill_inventory no debía poder surtir';
  end if;
  raise notice 'TEST 4 OK: sin can_fulfill_inventory, NO puede surtir (aunque tenga can_reserve_inventory).';
end $$;

-- TEST 3: puede liberar la reserva.
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0044_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_release_inventory_reservation(v_reservation_id);
  if v_reservation.released_at is null then
    raise exception 'TEST 3 FALLÓ: la reserva debía quedar liberada';
  end if;
  raise notice 'TEST 3 OK: logistics_user libera la reserva ajena.';
end $$;

select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user' and capability = 'can_reserve_inventory';

-- =========================================================================
-- FULFILLMENT
-- =========================================================================

-- TEST 6 (primero, sin capability): can_view_all_sales sola NO puede surtir.
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'logistics_user', 'can_view_all_sales', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;
select test_set_user(:'logistics_user');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_reservation inventory_reservations;
  v_failed boolean := false;
begin
  -- Necesita una reserva activa para intentar surtir — la crea vía admin
  -- (fuera de este bloque) sería más limpio, pero como ya no tiene
  -- can_reserve_inventory, confirmamos primero que TAMPOCO puede reservar
  -- con solo can_view_all_sales (refuerza el mismo punto).
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 5);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6 FALLÓ (paso previo): can_view_all_sales sola no debía permitir reservar';
  end if;
  raise notice 'TEST 6 OK (paso previo confirmado): can_view_all_sales sola NO permite reservar.';
end $$;
select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user' and capability = 'can_view_all_sales';

-- Fixture: admin crea una reserva y la surte parcialmente, para que TEST 5
-- tenga una reserva activa con pendiente por surtir.
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 20);
  perform set_config('test.reservation0044b_id', v_reservation.id::text, false);
end $$;

-- TEST 5: logistics_user con can_fulfill_inventory puede surtir la reserva ajena.
update user_capabilities set active = true where user_id = :'logistics_user' and capability = 'can_fulfill_inventory';
select test_set_user(:'logistics_user');
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0044b_id')::uuid;
  v_reservation inventory_reservations;
begin
  select * into v_reservation from rpc_fulfill_inventory_reservation(v_reservation_id, 8);
  if v_reservation.fulfilled_quantity <> 8 then
    raise exception 'TEST 5 FALLÓ: fulfilled_quantity inesperado: %', v_reservation.fulfilled_quantity;
  end if;
  raise notice 'TEST 5 OK: logistics_user con can_fulfill_inventory surte reserva ajena.';
end $$;
select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user' and capability = 'can_fulfill_inventory';

-- =========================================================================
-- ENTREGAS
-- =========================================================================

-- TEST 12 (primero, sin capability): can_view_all_sales sola NO puede
-- operar entrega (crear).
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'logistics_user', 'can_view_all_sales', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;
select test_set_user(:'logistics_user');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', current_setting('test.product0044_id'), 'quantity_delivered', 1))
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 12 FALLÓ: can_view_all_sales sola no debía permitir crear entrega';
  end if;
  raise notice 'TEST 12 OK: can_view_all_sales sola NO puede operar entrega.';
end $$;
select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user' and capability = 'can_view_all_sales';

-- TEST 7-11: con can_manage_deliveries, logistics_user crea/edita/cambia
-- estado/agrega y quita evidencia sobre el Pedido ajeno.
--
-- HALLAZGO (ver reporte de cierre §Entregas): el INSERT/DELETE directo
-- sobre delivery_files (attachDeliveryFile/removeDeliveryFile — NO pasan
-- por una RPC security definer, a diferencia de crear/editar/cambiar
-- estado) evalúa su policy bajo la RLS NORMAL del usuario, y esa policy
-- hace JOIN contra `deliveries`/`orders` — cuyo propio SELECT RLS NO
-- reconoce can_manage_deliveries (solo ownership/admin/can_view_all_sales,
-- 0041). Por eso ese JOIN es invisible para un usuario que SOLO tiene
-- can_manage_deliveries, y el INSERT/DELETE de evidencia falla aunque la
-- policy de delivery_files sí incluya el OR-branch correcto. Se otorga
-- también can_view_all_sales aquí porque así es como debe aprovisionarse
-- en la realidad (ver auditoría 6R.1B-2 §3: "Rodolfo puede necesitar A +
-- B" — nunca se pensó que operar logística sin visibilidad cross-sales
-- fuera un caso de uso real).
update user_capabilities set active = true
  where user_id = :'logistics_user' and capability in ('can_manage_deliveries', 'can_view_all_sales');
select test_set_user(:'logistics_user');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_delivery deliveries;
  v_file_id uuid;
  v_rows int;
begin
  -- TEST 7: crear entrega sobre Pedido ajeno (usa lo ya surtido en TEST 5: 8 unidades).
  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 5))
  );
  perform set_config('test.delivery0044_id', v_delivery.id::text, false);
  raise notice 'TEST 7 OK: logistics_user crea entrega sobre Pedido ajeno.';

  -- TEST 8: actualizar detalles. Se verifica sobre el valor DEVUELTO por la
  -- RPC (security definer), no con un SELECT aparte bajo la RLS propia de
  -- logistics_user — leer `deliveries` de un Pedido ajeno requiere
  -- can_view_all_sales (0041), una capability DISTINTA de
  -- can_manage_deliveries (autoridad de escritura); esta prueba es sobre
  -- autoridad de escritura, no de lectura — ver auditoría 6R.1B-2 §3
  -- ("Rodolfo puede necesitar A + B", nunca una sola capability
  -- sustituyendo a la otra).
  declare v_d2 deliveries;
  begin
    select * into v_d2 from rpc_update_delivery_details(v_delivery.id, jsonb_build_object('address', 'Calle Falsa 123', 'contact_name', 'Contacto 0044'));
    if v_d2.address <> 'Calle Falsa 123' then
      raise exception 'TEST 8 FALLÓ: el detalle no se actualizó (address devuelto: %)', v_d2.address;
    end if;
  end;
  raise notice 'TEST 8 OK: logistics_user actualiza detalles de la entrega ajena.';

  -- TEST 9: cambiar estado. Mismo criterio: se verifica sobre el retorno
  -- de la RPC, no con un SELECT aparte.
  declare v_d3 deliveries;
  begin
    select * into v_d3 from rpc_update_delivery_status(v_delivery.id, 'en_proceso');
    if v_d3.status <> 'en_proceso' then
      raise exception 'TEST 9 FALLÓ: el estado no cambió (status devuelto: %)', v_d3.status;
    end if;
  end;
  raise notice 'TEST 9 OK: logistics_user cambia el estado de la entrega ajena.';

  -- TEST 10: agregar evidencia (INSERT directo en delivery_files — mismo
  -- camino que attachDeliveryFile en la app real).
  insert into delivery_files (delivery_id, kind, storage_path, file_name)
  values (v_delivery.id, 'documento', v_order_id || '/evidencia-0044.pdf', 'evidencia-0044.pdf')
  returning id into v_file_id;
  perform set_config('test.deliveryfile0044_id', v_file_id::text, false);
  raise notice 'TEST 10 OK: logistics_user agrega evidencia a la entrega ajena.';

  -- TEST 11: quitar esa evidencia.
  delete from delivery_files where id = v_file_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 11 FALLÓ: no se pudo quitar la evidencia (% filas)', v_rows;
  end if;
  raise notice 'TEST 11 OK: logistics_user quita evidencia de la entrega ajena.';
end $$;
select test_set_user(:'admin');
update user_capabilities set active = false
  where user_id = :'logistics_user' and capability in ('can_manage_deliveries', 'can_view_all_sales');

-- =========================================================================
-- RECEPCIÓN
-- =========================================================================

-- Fixture: proveedor + PO "ordenada" sobre el Pedido ajeno.
do $$
declare
  v_org1 uuid; v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_supplier_id uuid;
  v_order_item_id uuid;
  v_po purchase_orders;
begin
  select org1 into v_org1 from _ids;
  insert into suppliers (organization_id, name, active)
  values (v_org1, 'Proveedor 0044', true)
  returning id into v_supplier_id;
  perform set_config('test.supplier0044_id', v_supplier_id::text, false);

  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'MODELO-0044';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 30))
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  perform set_config('test.po0044_id', v_po.id::text, false);
  perform set_config('test.poi0044_id', (select id::text from purchase_order_items where purchase_order_id = v_po.id), false);
  raise notice 'SETUP RECEPCIÓN OK: PO % ordenada, partida %', v_po.folio, current_setting('test.poi0044_id');
end $$;

-- TEST 13: can_receive_inventory puede registrar recepción PARCIAL.
-- La verificación del status resultante de la PO se hace como admin — leer
-- `purchase_orders` de una OC ajena requiere can_view_all_sales (0041),
-- una capability DISTINTA de can_receive_inventory (autoridad de
-- escritura); esta prueba es sobre autoridad de escritura, la
-- confirmación del dato se hace desde una sesión que sí puede leerlo, sin
-- mezclar ambas capabilities en el escenario mínimo de esta prueba (a
-- diferencia de Entregas, aquí NO hace falta otorgar can_view_all_sales
-- porque rpc_receive_purchase_order_item ya devuelve todo lo necesario
-- para verificar quantity_received; el status de la PO se confirma aparte
-- por completitud, no porque la operación en sí lo requiera).
update user_capabilities set active = true where user_id = :'logistics_user' and capability = 'can_receive_inventory';
select test_set_user(:'logistics_user');
do $$
declare
  v_poi_id uuid := current_setting('test.poi0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_item purchase_order_items;
begin
  select * into v_item from rpc_receive_purchase_order_item(v_poi_id, 12, v_warehouse_id);
  if v_item.quantity_received <> 12 then
    raise exception 'TEST 13 FALLÓ: quantity_received inesperado: %', v_item.quantity_received;
  end if;
  raise notice 'TEST 13 OK: logistics_user registra recepción parcial (12/30).';
end $$;
select test_set_user(:'admin');
do $$
begin
  if not exists (select 1 from purchase_orders where id = current_setting('test.po0044_id')::uuid and status = 'recibida_parcial') then
    raise exception 'TEST 13 FALLÓ (verificación admin): la PO debía quedar recibida_parcial';
  end if;
  raise notice 'TEST 13 OK (verificación admin): PO recibida_parcial confirmado.';
end $$;
select test_set_user(:'logistics_user');

-- TEST 14: segunda recepción completa la cantidad restante (30 total).
do $$
declare
  v_poi_id uuid := current_setting('test.poi0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_item purchase_order_items;
begin
  select * into v_item from rpc_receive_purchase_order_item(v_poi_id, 30, v_warehouse_id);
  if v_item.quantity_received <> 30 then
    raise exception 'TEST 14 FALLÓ: quantity_received inesperado: %', v_item.quantity_received;
  end if;
  raise notice 'TEST 14 OK: segunda recepción completa la cantidad (30/30), PO recibida.';
end $$;
select test_set_user(:'admin');
do $$
begin
  if not exists (select 1 from purchase_orders where id = current_setting('test.po0044_id')::uuid and status = 'recibida') then
    raise exception 'TEST 14 FALLÓ (verificación admin): la PO debía quedar recibida (completa)';
  end if;
  raise notice 'TEST 14 OK (verificación admin): PO recibida (completa) confirmado.';
end $$;
select test_set_user(:'logistics_user');

-- TEST 15: el movimiento de inventario resultante conserva invariantes
-- (ON HAND aumentó exactamente 30 por la recepción, sin tocar COMMITTED).
do $$
declare
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_on_hand integer;
  v_received_sum integer;
begin
  select coalesce(sum(quantity_delta), 0) into v_on_hand
    from inventory_movements where product_id = v_product_id and warehouse_id = v_warehouse_id;
  select coalesce(sum(quantity_delta), 0) into v_received_sum
    from inventory_movements
    where product_id = v_product_id and warehouse_id = v_warehouse_id and movement_type = 'recepcion_compra';
  if v_received_sum <> 30 then
    raise exception 'TEST 15 FALLÓ: suma de movimientos recepcion_compra inesperada: %', v_received_sum;
  end if;
  -- ON HAND inicial 200 (setup) + 30 recibidos - 8 surtidos (TEST 5) = 222.
  if v_on_hand <> 222 then
    raise exception 'TEST 15 FALLÓ: ON HAND final inesperado: % (se esperaba 222)', v_on_hand;
  end if;
  raise notice 'TEST 15 OK: invariantes de inventario preservados (ON HAND = %).', v_on_hand;
end $$;

-- TEST 16: can_receive_inventory NO puede aprobar/cambiar estado de la OC.
do $$
declare v_po_id uuid := current_setting('test.po0044_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'cancelada');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'TEST 16 FALLÓ: can_receive_inventory no debía poder cambiar el estado de la OC'; end if;
  raise notice 'TEST 16 OK: can_receive_inventory NO puede aprobar/cambiar estado de OC.';
end $$;

-- TEST 17: can_receive_inventory NO puede editar comercialmente la OC.
do $$
declare v_po_id uuid := current_setting('test.po0044_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_details(v_po_id, jsonb_build_object('notes', 'intento no autorizado'));
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'TEST 17 FALLÓ: can_receive_inventory no debía poder editar la OC'; end if;
  raise notice 'TEST 17 OK: can_receive_inventory NO puede editar comercialmente la OC.';
end $$;

select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user' and capability = 'can_receive_inventory';

-- =========================================================================
-- AISLAMIENTO
-- =========================================================================

-- TEST 18: capability otorgada en Org B NO funciona contra un Pedido de Org 1.
select test_set_user(current_setting('test.vendedor_orgb0044_id')::uuid);
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 1);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 18 FALLÓ: capability de Org B no debía funcionar sobre un Pedido de Org 1';
  end if;
  raise notice 'TEST 18 OK: capability de otra organización NO funciona cross-org.';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- COMERCIAL
-- =========================================================================

-- TEST 19/20: con las 4 capabilities logísticas activas a la vez,
-- logistics_user NO puede editar comercialmente el Pedido ni la Cotización
-- ajenos (ni notas, ni cliente, ni vendedor, ni datos comerciales).
update user_capabilities set active = true
  where user_id = :'logistics_user'
    and capability in ('can_reserve_inventory', 'can_fulfill_inventory', 'can_manage_deliveries', 'can_receive_inventory');
select test_set_user(:'logistics_user');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_quote_id uuid := current_setting('test.ajeno_quote0044_id')::uuid;
  v_rows int;
begin
  -- TEST 19: Pedido comercial ajeno.
  update orders set client_name = 'Intento no autorizado 0044' where id = v_order_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 19 FALLÓ: capability logística no debía permitir editar datos comerciales del Pedido ajeno';
  end if;
  raise notice 'TEST 19 OK: capabilities logísticas (las 4 juntas) NO permiten editar Pedido comercial ajeno.';

  -- TEST 20: Cotización ajena.
  update quotes set notes = 'Intento no autorizado 0044' where id = v_quote_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 20 FALLÓ: capability logística no debía permitir editar la Cotización ajena';
  end if;
  raise notice 'TEST 20 OK: capabilities logísticas (las 4 juntas) NO permiten editar Cotización ajena.';
end $$;
select test_set_user(:'admin');
update user_capabilities set active = false where user_id = :'logistics_user';

-- =========================================================================
-- REGRESIÓN
-- =========================================================================

-- TEST 21: logistics_user, SIN ninguna capability activa, mantiene
-- autoridad normal (ownership) sobre SU PROPIO Pedido — regresión de que
-- nada de esto degradó el comportamiento "propio o admin" ya existente.
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid; v_customer1 uuid; v_logistics_sp_id uuid := current_setting('test.logistics_sp0044_id')::uuid;
  v_own_order orders;
begin
  select org1, customer1 into v_org1, v_customer1 from _ids;
  select * into v_own_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_logistics_sp_id, 'order_date', current_date::text, 'client_name', 'Cliente Propio 0044',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROPIO-0044', 'quantity', 1, 'unit', 'pza'))
  );
  perform set_config('test.own_order0044_id', v_own_order.id::text, false);
end $$;
select test_set_user(:'logistics_user');
do $$
declare v_own_order_id uuid := current_setting('test.own_order0044_id')::uuid; v_rows int;
begin
  update orders set client_name = 'Cliente Propio 0044 Editado' where id = v_own_order_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 21 FALLÓ: logistics_user debía poder editar su PROPIO Pedido sin ninguna capability (ownership normal)';
  end if;
  raise notice 'TEST 21 OK: logistics_user conserva autoridad normal sobre su propio Pedido, sin ninguna capability.';
end $$;

-- TEST 22: admin conserva bypass total (crea/edita/opera sin restricción,
-- ya cubierto implícitamente en el SETUP de este archivo — se reafirma
-- explícitamente aquí sobre el Pedido ajeno).
select test_set_user(:'admin');
do $$
declare v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid; v_rows int;
begin
  update orders set general_notes = 'Nota de admin 0044' where id = v_order_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 22 FALLÓ: admin debía poder editar cualquier Pedido';
  end if;
  raise notice 'TEST 22 OK: admin conserva bypass total.';
end $$;

-- TEST 23: vendedor2 (normal, SIN ninguna capability) NO gana autoridad
-- logística cross-sales sobre el Pedido ajeno de vendedor1.
select test_set_user(:'vendedor2');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0044_id')::uuid;
  v_product_id uuid := current_setting('test.product0044_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0044_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 1);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 23 FALLÓ: un vendedor normal sin capabilities no debía poder reservar sobre un Pedido ajeno';
  end if;
  raise notice 'TEST 23 OK: vendedor normal sin capabilities NO gana autoridad logística cross-sales.';
end $$;

select test_set_user(:'admin');

rollback;
