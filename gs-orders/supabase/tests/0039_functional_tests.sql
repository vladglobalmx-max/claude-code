-- THÖREN — Fase 6P: Entregas e Instalaciones (0039) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0039 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible. NO repite regresión de
-- Purchasing/Inventory/Reservas/Surtido (0035-0038) — esta fase no tocó
-- esa lógica.

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
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- Fixtures:
-- - order0039 / product0039: Pedido 30, ON HAND 30, surtido COMPLETO (30).
--   Usado en TEST 1,2,6,7,8 (entregas parciales -> completitud automática).
-- - order0039partial / product0039partial: Pedido 30, ON HAND 20, surtido
--   PARCIAL (20). Usado en TEST 3,4 (rechazo por exceso, tope real).
-- - order0039cancel / product0039cancel: Pedido 10, surtido 10. Usado en
--   TEST 9 (cancelación no suma) y TEST 13 (no doble conteo al reintentar).
-- - Producto/almacén de Org B para TEST 10 (cross-org).
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, active)
  values ('60000000-0000-0000-0000-00000000003b', v_orgb, 'SKU-ORGB-6P', 'Producto Org B 6P', true)
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_product product_catalog;
  v_warehouse warehouses;
  v_reservation inventory_reservations;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  insert into warehouses (organization_id, name, code, location)
  values (v_org1, 'Almacén 6P', 'ALM-6P-1', 'Monterrey')
  returning * into v_warehouse;
  perform set_config('test.warehouse0039_id', v_warehouse.id::text, false);

  -- --- order0039 / product0039: Pedido 30, surtido COMPLETO (30) ---
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6P', 'quantity', 30, 'unit', 'pza'))
  );
  perform set_config('test.order0039_id', v_order.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6P-001', 'Proyector 6P', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0039_id', v_product.id::text, false);
  update order_items set catalog_product_id = v_product.id where order_id = v_order.id;

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 30)
  );
  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order.id, v_product.id, v_warehouse.id, 30);
  perform rpc_fulfill_inventory_reservation(v_reservation.id, 30);

  -- --- order0039partial / product0039partial: Pedido 30, surtido PARCIAL (20) ---
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'y',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6P-PARCIAL', 'quantity', 30, 'unit', 'pza'))
  );
  perform set_config('test.orderpartial0039_id', v_order.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6P-002', 'Proyector 6P Parcial', 'pza', true)
  returning * into v_product;
  perform set_config('test.productpartial0039_id', v_product.id::text, false);
  update order_items set catalog_product_id = v_product.id where order_id = v_order.id;

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 20)
  );
  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order.id, v_product.id, v_warehouse.id, 20);
  perform rpc_fulfill_inventory_reservation(v_reservation.id, 20);

  -- --- order0039cancel / product0039cancel: Pedido 10, surtido 10 ---
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'z',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6P-CANCEL', 'quantity', 10, 'unit', 'pza'))
  );
  perform set_config('test.ordercancel0039_id', v_order.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6P-003', 'Proyector 6P Cancel', 'pza', true)
  returning * into v_product;
  perform set_config('test.productcancel0039_id', v_product.id::text, false);
  update order_items set catalog_product_id = v_product.id where order_id = v_order.id;

  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse.id, 'movement_type', 'entrada_manual', 'quantity', 10)
  );
  select * into v_reservation from rpc_reserve_inventory(gen_random_uuid(), v_order.id, v_product.id, v_warehouse.id, 10);
  perform rpc_fulfill_inventory_reservation(v_reservation.id, 10);

  raise notice 'SETUP OK: order0039 (30/30 surtido), orderpartial0039 (30/20 surtido), ordercancel0039 (10/10 surtido)';
end $$;

-- =========================================================================
-- TEST 1 (ejemplo obligatorio parte 1): Pedido 30 / surtido 30, entregar
-- 20 -> pendiente 10. Sin cambio a ON HAND/COMMITTED/AVAILABLE/INCOMING.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_product_id uuid := current_setting('test.product0039_id')::uuid;
  v_on_hand_before integer;
  v_committed_before integer;
  v_incoming_before integer;
  v_on_hand_after integer;
  v_committed_after integer;
  v_incoming_after integer;
  v_delivery deliveries;
  v_progress record;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand_before from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed_before from rpc_inventory_committed_levels(v_product_id);
  select coalesce(incoming, 0) into v_incoming_before from rpc_inventory_incoming_by_product() where product_id = v_product_id;

  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 20))
  );
  perform set_config('test.delivery1_0039_id', v_delivery.id::text, false);

  if v_delivery.sequence_number <> 1 then
    raise exception 'TEST 1 FALLÓ: sequence_number debería ser 1, es %', v_delivery.sequence_number;
  end if;

  select * into v_progress from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress.delivered <> 20 or v_progress.pending_to_deliver <> 10 then
    raise exception 'TEST 1 FALLÓ: esperaba delivered=20/pending=10, vi %/%', v_progress.delivered, v_progress.pending_to_deliver;
  end if;

  select coalesce(sum(on_hand), 0) into v_on_hand_after from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed_after from rpc_inventory_committed_levels(v_product_id);
  select coalesce(incoming, 0) into v_incoming_after from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if v_on_hand_after <> v_on_hand_before or v_committed_after <> v_committed_before or v_incoming_after <> v_incoming_before then
    raise exception 'TEST 1 FALLÓ: la entrega NO debe tocar Inventory (on_hand %->%, committed %->%, incoming %->%)',
      v_on_hand_before, v_on_hand_after, v_committed_before, v_committed_after, v_incoming_before, v_incoming_after;
  end if;

  raise notice 'TEST 1 OK: entrega 1 de 20 -> pendiente 10, Inventory intacto';
end $$;

-- =========================================================================
-- TEST 2 (ejemplo obligatorio parte 2): segunda entrega de 10 -> pendiente 0.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_product_id uuid := current_setting('test.product0039_id')::uuid;
  v_delivery deliveries;
  v_progress record;
begin
  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 10))
  );
  perform set_config('test.delivery2_0039_id', v_delivery.id::text, false);

  if v_delivery.sequence_number <> 2 then
    raise exception 'TEST 2 FALLÓ: sequence_number debería ser 2, es %', v_delivery.sequence_number;
  end if;

  select * into v_progress from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress.delivered <> 30 or v_progress.pending_to_deliver <> 0 then
    raise exception 'TEST 2 FALLÓ: esperaba delivered=30/pending=0, vi %/%', v_progress.delivered, v_progress.pending_to_deliver;
  end if;

  raise notice 'TEST 2 OK: entrega 2 de 10 -> pendiente 0 (30/30 entregado)';
end $$;

-- =========================================================================
-- TEST 3: rechazo si intenta entregar más del surtido disponible.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.orderpartial0039_id')::uuid;
  v_product_id uuid := current_setting('test.productpartial0039_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 21))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 3 FALLÓ: se esperaba rechazo por entregar más de lo surtido (20 disponibles, pidió 21)'; end if;
  if v_msg not ilike '%surtido%' then raise exception 'TEST 3 FALLÓ: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 3 OK: no se puede entregar más de lo surtido disponible';
end $$;

-- =========================================================================
-- TEST 4: surtido parcial (20 de un Pedido de 30) -> máximo entregable es
-- 20 (el surtido, NUNCA la cantidad pedida). Entregar exactamente 20 SÍ
-- funciona.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.orderpartial0039_id')::uuid;
  v_product_id uuid := current_setting('test.productpartial0039_id')::uuid;
  v_progress_before record;
  v_delivery deliveries;
  v_progress_after record;
begin
  select * into v_progress_before from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress_before.ordered <> 30 or v_progress_before.fulfilled <> 20 or v_progress_before.pending_to_deliver <> 20 then
    raise exception 'TEST 4 FALLÓ (precondición): esperaba ordered=30/fulfilled=20/pending=20, vi %/%/%',
      v_progress_before.ordered, v_progress_before.fulfilled, v_progress_before.pending_to_deliver;
  end if;

  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 20))
  );

  select * into v_progress_after from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress_after.delivered <> 20 or v_progress_after.pending_to_deliver <> 0 then
    raise exception 'TEST 4 FALLÓ: esperaba delivered=20/pending=0, vi %/%', v_progress_after.delivered, v_progress_after.pending_to_deliver;
  end if;

  raise notice 'TEST 4 OK: máximo entregable = surtido (20), no la cantidad pedida (30)';
end $$;

-- =========================================================================
-- TEST 5: la entrega NUNCA cambia Inventory — verificación holística sobre
-- product0039partial también (además de TEST 1). ON HAND ya bajó a 0 por
-- el SURTIDO de 6O (20 entrada - 20 surtido); la entrega de TEST 4 NO debe
-- alterarlo ni una unidad más.
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.productpartial0039_id')::uuid;
  v_on_hand integer;
  v_committed integer;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_on_hand <> 0 then raise exception 'TEST 5 FALLÓ: ON HAND debería seguir en 0 (ya surtido por 6O), es %', v_on_hand; end if;
  if v_committed <> 0 then raise exception 'TEST 5 FALLÓ: COMMITTED debería seguir en 0 (reserva 100%% surtida), es %', v_committed; end if;
  raise notice 'TEST 5 OK: ON HAND (0, ya surtido) y COMMITTED (0) intactos tras registrar la entrega de TEST 4';
end $$;

-- =========================================================================
-- TEST 6: completar una entrega PARCIAL (20 de 30) NO marca el Pedido
-- como completado.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_delivery_id uuid := current_setting('test.delivery1_0039_id')::uuid;
  v_operational_status text;
begin
  perform rpc_update_delivery_status(v_delivery_id, 'completada');
  select operational_status into v_operational_status from orders where id = v_order_id;
  if v_operational_status = 'completado' then
    raise exception 'TEST 6 FALLÓ: completar una entrega parcial (20/30) NO debe marcar el Pedido como completado';
  end if;
  raise notice 'TEST 6 OK: entrega parcial completada, Pedido sigue en "%"', v_operational_status;
end $$;

-- =========================================================================
-- TEST 7 (ejemplo obligatorio): al completar la SEGUNDA entrega (10 de
-- 30, sumando 30/30/30) el Pedido pasa a operational_status = 'completado'
-- automáticamente, vía el mecanismo de historial existente (6H/0033).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_delivery_id uuid := current_setting('test.delivery2_0039_id')::uuid;
  v_operational_status text;
  v_history_count integer;
begin
  perform rpc_update_delivery_status(v_delivery_id, 'completada');
  select operational_status into v_operational_status from orders where id = v_order_id;
  if v_operational_status <> 'completado' then
    raise exception 'TEST 7 FALLÓ: 30 pedido = 30 surtido = 30 entregado debería completar el Pedido, quedó en "%"', v_operational_status;
  end if;

  select count(*) into v_history_count
    from order_operational_status_history
    where order_id = v_order_id and new_status = 'completado';
  if v_history_count <> 1 then
    raise exception 'TEST 7 FALLÓ: el cambio a completado debería quedar registrado en order_operational_status_history (0033), hay % filas', v_history_count;
  end if;

  raise notice 'TEST 7 OK: Pedido completado automáticamente y registrado en el historial de 0033';
end $$;

-- =========================================================================
-- TEST 8: la fecha real de entrega/cierre (actual_completion_date, campo
-- REAL de 0034) se registra al completar totalmente — sin columnas
-- duplicadas.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_actual_completion_date date;
begin
  select actual_completion_date into v_actual_completion_date from orders where id = v_order_id;
  if v_actual_completion_date is null or v_actual_completion_date <> current_date then
    raise exception 'TEST 8 FALLÓ: actual_completion_date debería ser hoy, es %', v_actual_completion_date;
  end if;
  raise notice 'TEST 8 OK: actual_completion_date = % (campo real de 0034, sin duplicar)', v_actual_completion_date;
end $$;

-- =========================================================================
-- TEST 9: cancelar una entrega NO suma hacia "ya entregado" — se puede
-- volver a entregar la misma cantidad después de cancelar.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.ordercancel0039_id')::uuid;
  v_product_id uuid := current_setting('test.productcancel0039_id')::uuid;
  v_delivery deliveries;
  v_progress record;
begin
  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 10))
  );
  select * into v_progress from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress.delivered <> 10 or v_progress.pending_to_deliver <> 0 then
    raise exception 'TEST 9 FALLÓ (precondición): esperaba delivered=10/pending=0 antes de cancelar';
  end if;

  perform rpc_update_delivery_status(v_delivery.id, 'cancelada');

  select * into v_progress from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress.delivered <> 0 or v_progress.pending_to_deliver <> 10 then
    raise exception 'TEST 9 FALLÓ: cancelar debería devolver delivered=0/pending=10, vi %/%', v_progress.delivered, v_progress.pending_to_deliver;
  end if;

  -- Se puede volver a entregar la misma cantidad sin problema.
  perform rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 10))
  );
  select * into v_progress from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_progress.delivered <> 10 or v_progress.pending_to_deliver <> 0 then
    raise exception 'TEST 9 FALLÓ: tras re-entregar debería quedar delivered=10/pending=0, vi %/%', v_progress.delivered, v_progress.pending_to_deliver;
  end if;

  raise notice 'TEST 9 OK: cancelar una entrega libera la cantidad; no suma hacia lo ya entregado';
end $$;

-- =========================================================================
-- TEST 10: cross-org — Org B no puede crear ni ver entregas del Pedido de
-- Org 1.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_product_id uuid := current_setting('test.product0039_id')::uuid;
  v_delivery_id uuid := current_setting('test.delivery1_0039_id')::uuid;
  v_failed boolean := false;
  v_count integer;
begin
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: Org B no debería poder crear una entrega sobre un Pedido de Org 1'; end if;

  select count(*) into v_count from deliveries where id = v_delivery_id;
  if v_count <> 0 then
    raise exception 'TEST 10 FALLÓ: Org B no debería poder VER la entrega de Org 1 (RLS)';
  end if;

  raise notice 'TEST 10 OK: cross-org rechazado al crear y al leer entregas';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 11: permisos — VENDEDOR2 (no dueño del Pedido) bloqueado; ADMIN
-- puede crear entregas sobre cualquier Pedido de su organización.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_order_id uuid := current_setting('test.ordercancel0039_id')::uuid;
  v_product_id uuid := current_setting('test.productcancel0039_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 11 FALLÓ: VENDEDOR2 no debería poder crear una entrega sobre un Pedido ajeno'; end if;
  if v_msg not ilike '%permiso%' then raise exception 'TEST 11 FALLÓ: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 11 OK: VENDEDOR2 bloqueado sobre un Pedido que no le pertenece';
end $$;
select test_set_user(:'admin');
do $$
declare
  v_order_id uuid := current_setting('test.orderpartial0039_id')::uuid;
  v_product_id uuid := current_setting('test.productpartial0039_id')::uuid;
  v_delivery deliveries;
begin
  -- orderpartial0039 pertenece a vendedor1 (salesperson1); ADMIN puede
  -- gestionar entregas de cualquier Pedido de su organización. Queda
  -- disponible 20-20=0 unidades para entregar más (TEST 4 ya consumió
  -- todo el surtido), así que se registra una entrega de tipo instalación
  -- sin partidas de producto adicionales no aplica — en su lugar se
  -- ajusta la reserva y se surte 1 unidad más para probar el permiso con
  -- una partida real.
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object(
      'product_id', v_product_id,
      'warehouse_id', current_setting('test.warehouse0039_id')::uuid,
      'movement_type', 'entrada_manual', 'quantity', 1
    )
  );
  perform rpc_adjust_inventory_reservation(
    (select id from inventory_reservations where order_id = v_order_id and product_id = v_product_id),
    21
  );
  perform rpc_fulfill_inventory_reservation(
    (select id from inventory_reservations where order_id = v_order_id and product_id = v_product_id),
    21
  );

  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
  );
  if v_delivery.id is null then
    raise exception 'TEST 11 FALLÓ: ADMIN debería poder crear una entrega sobre cualquier Pedido de su organización';
  end if;
  raise notice 'TEST 11 OK: ADMIN crea entregas sobre cualquier Pedido de su organización';
end $$;

-- =========================================================================
-- TEST 12: evidencia (delivery_files) queda ligada a la entrega y visible
-- solo para quien puede ver esa entrega (propio o admin).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_delivery_id uuid := current_setting('test.delivery1_0039_id')::uuid;
  v_file_id uuid;
begin
  insert into delivery_files (delivery_id, kind, storage_path, file_name, file_type)
  values (v_delivery_id, 'foto', current_setting('test.order0039_id') || '/entregas/' || v_delivery_id || '/evidencia.jpg', 'evidencia.jpg', 'image/jpeg')
  returning id into v_file_id;
  perform set_config('test.deliveryfile0039_id', v_file_id::text, false);
  raise notice 'TEST 12 SETUP OK: evidencia % creada para la entrega %', v_file_id, v_delivery_id;
end $$;
do $$
declare
  v_file_id uuid := current_setting('test.deliveryfile0039_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from delivery_files where id = v_file_id;
  if v_count <> 1 then raise exception 'TEST 12 FALLÓ: el propietario del Pedido debería ver su propia evidencia'; end if;
  raise notice 'TEST 12 OK (parte 1): el propietario ve su evidencia';
end $$;
select test_set_user(:'vendedor2');
do $$
declare
  v_file_id uuid := current_setting('test.deliveryfile0039_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from delivery_files where id = v_file_id;
  if v_count <> 0 then raise exception 'TEST 12 FALLÓ: VENDEDOR2 no debería ver evidencia de un Pedido ajeno'; end if;
  raise notice 'TEST 12 OK (parte 2): VENDEDOR2 no ve evidencia de un Pedido ajeno';
end $$;
select test_set_user(:'admin');
do $$
declare
  v_file_id uuid := current_setting('test.deliveryfile0039_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from delivery_files where id = v_file_id;
  if v_count <> 1 then raise exception 'TEST 12 FALLÓ: ADMIN debería ver toda la evidencia de su organización'; end if;
  raise notice 'TEST 12 OK (parte 3): ADMIN ve la evidencia';
end $$;

-- =========================================================================
-- TEST 13: no hay doble conteo al reintentar rpc_create_delivery con el
-- MISMO id (network retry) — la clave primaria lo rechaza, sin duplicar
-- cantidades entregadas. Corre como ADMIN (necesita registrar movimientos
-- manuales de inventario para dar margen de surtido) — no es una prueba
-- de permisos.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.ordercancel0039_id')::uuid;
  v_product_id uuid := current_setting('test.productcancel0039_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0039_id')::uuid;
  v_reservation_id uuid;
  v_retry_id uuid := gen_random_uuid();
  v_delivered_before integer;
  v_delivered_after integer;
  v_failed boolean := false;
begin
  -- ordercancel0039 ya está 10/10 entregado (TEST 9); se agrega 1 unidad
  -- más de margen surtido para poder crear una entrega REAL y probar el
  -- reintento con el MISMO id (no una simple falta de stock).
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 1)
  );
  select id into v_reservation_id from inventory_reservations where order_id = v_order_id and product_id = v_product_id;
  perform rpc_adjust_inventory_reservation(v_reservation_id, 11);
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 11);

  select delivered into v_delivered_before from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;

  perform rpc_create_delivery(
    v_retry_id,
    jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
  );

  begin
    perform rpc_create_delivery(
      v_retry_id,
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 13 FALLÓ: reintentar con el MISMO id debería rechazarse (clave primaria duplicada)'; end if;

  select delivered into v_delivered_after from rpc_order_delivery_progress(v_order_id) where catalog_product_id = v_product_id;
  if v_delivered_after <> v_delivered_before + 1 then
    raise exception 'TEST 13 FALLÓ: delivered debería avanzar exactamente +1 (una sola entrega real), antes % después %', v_delivered_before, v_delivered_after;
  end if;

  raise notice 'TEST 13 OK: reintentar rpc_create_delivery con el mismo id no duplica la entrega ni el conteo (delivered %->%)', v_delivered_before, v_delivered_after;
end $$;

-- =========================================================================
-- TEST 14: integridad — cantidades negativas/cero y producto que no
-- corresponde al Pedido, ambas rechazadas (requisito #12).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0039_id')::uuid;
  v_product_id uuid := current_setting('test.product0039_id')::uuid;
  v_other_product_id uuid := current_setting('test.productpartial0039_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', -1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 14 FALLÓ: cantidad negativa debería rechazarse'; end if;

  v_failed := false;
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 0))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 14 FALLÓ: cantidad cero debería rechazarse'; end if;

  -- v_other_product_id (de orderpartial0039) no forma parte de order0039.
  v_failed := false;
  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_other_product_id, 'quantity_delivered', 1))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 14 FALLÓ: un producto que no corresponde al Pedido debería rechazarse'; end if;
  if v_msg not ilike '%no forma parte%' then raise exception 'TEST 14 FALLÓ: mensaje inesperado: %', v_msg; end if;

  raise notice 'TEST 14 OK: cantidades negativas/cero y producto ajeno al Pedido rechazados';
end $$;

-- =========================================================================
-- TEST 15: los campos de instalación (installer_name/installation_datetime/
-- installation_notes) solo se aceptan para delivery_type
-- 'instalacion'/'entrega_instalacion' — CHECK a nivel de tabla.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.ordercancel0039_id')::uuid;
  v_product_id uuid := current_setting('test.productcancel0039_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0039_id')::uuid;
  v_reservation_id uuid;
  v_failed boolean := false;
  v_delivery deliveries;
begin
  -- Da 2 unidades más de margen surtido (una para cada intento de este
  -- TEST) — productcancel0039 quedó en 11/11 tras TEST 13.
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product_id, 'warehouse_id', v_warehouse_id, 'movement_type', 'entrada_manual', 'quantity', 2)
  );
  select id into v_reservation_id from inventory_reservations where order_id = v_order_id and product_id = v_product_id;
  perform rpc_adjust_inventory_reservation(v_reservation_id, 13);
  perform rpc_fulfill_inventory_reservation(v_reservation_id, 13);

  begin
    perform rpc_create_delivery(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'delivery_type', 'entrega', 'installer_name', 'Técnico X'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 15 FALLÓ: installer_name en una entrega tipo "entrega" (sin instalación) debería rechazarse por CHECK';
  end if;

  select * into v_delivery from rpc_create_delivery(
    gen_random_uuid(),
    jsonb_build_object(
      'order_id', v_order_id, 'delivery_type', 'entrega_instalacion',
      'installer_name', 'Técnico X', 'installation_notes', 'Instalación en fachada'
    ),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_product_id, 'quantity_delivered', 1))
  );
  if v_delivery.installer_name <> 'Técnico X' then
    raise exception 'TEST 15 FALLÓ: entrega_instalacion debería aceptar los campos de instalación';
  end if;

  raise notice 'TEST 15 OK: campos de instalación restringidos a delivery_type con instalación';
end $$;

select 'TESTS 1-15 (0039 Entregas e Instalaciones, Fase 6P) PASARON' as resultado;

rollback;
