-- THÖREN — Fase 6N: Reservas de Inventario / COMMITTED (0037) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql
-- + migraciones 0001-0037 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible. NO repite regresión de
-- recepción/Incoming/Kardex (0035/0036) — esta fase no tocó esa lógica.

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
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- Fixtures: producto de catálogo con 80 ON HAND en un almacén, un Pedido
-- de vendedor1 con ese producto como partida, un segundo Pedido de
-- vendedor2 (para pruebas de permisos), y un producto/almacén de Org B
-- (cross-org).
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, active)
  values ('60000000-0000-0000-0000-00000000001b', v_orgb, 'SKU-ORGB-6N', 'Producto Org B 6N', true)
  on conflict (id) do nothing;
  insert into warehouses (id, organization_id, name, code)
  values ('70000000-0000-0000-0000-00000000001b', v_orgb, 'Almacén Org B 6N', 'ALB-6N')
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid; v_salesperson2 uuid;
  v_order orders;
  v_order2 orders;
  v_product product_catalog;
  v_other_product product_catalog;
  v_warehouse1 warehouses;
  v_warehouse2 warehouses;
begin
  select org1, customer1, salesperson1, salesperson2 into v_org1, v_customer1, v_salesperson1, v_salesperson2 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(
      jsonb_build_object('model', 'PROY-6N', 'quantity', 100, 'unit', 'pza'),
      jsonb_build_object('model', 'Instalación (sin catálogo)', 'quantity', 1)
    )
  );
  perform set_config('test.order0037_id', v_order.id::text, false);

  select * into v_order2 from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson2, 'order_date', current_date::text, 'client_name', 'y',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'PROY-6N', 'quantity', 5, 'unit', 'pza'))
  );
  perform set_config('test.order0037b_id', v_order2.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6N-001', 'Proyector 6N', 'pza', true)
  returning * into v_product;
  perform set_config('test.product0037_id', v_product.id::text, false);

  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-6N-002', 'Producto no vinculado 6N', 'pza', true)
  returning * into v_other_product;
  perform set_config('test.otherproduct0037_id', v_other_product.id::text, false);

  -- Reasocia la partida "PROY-6N" de cada Pedido al producto de catálogo
  -- real (mismo criterio que 0036 — el enforcement de BU ya está probado
  -- en 0032). La segunda partida de order0037 ("Instalación") se deja SIN
  -- catalog_product_id a propósito, para TEST 9.
  update order_items set catalog_product_id = v_product.id
    where order_id = v_order.id and model = 'PROY-6N';
  update order_items set catalog_product_id = v_product.id
    where order_id = v_order2.id and model = 'PROY-6N';

  insert into warehouses (organization_id, name, code, location)
  values (v_org1, 'Almacén 6N Principal', 'ALM-6N-1', 'Monterrey')
  returning * into v_warehouse1;
  perform set_config('test.warehouse0037_id', v_warehouse1.id::text, false);

  insert into warehouses (organization_id, name, code)
  values (v_org1, 'Almacén 6N Secundario', 'ALM-6N-2')
  returning * into v_warehouse2;
  perform set_config('test.warehouse0037b_id', v_warehouse2.id::text, false);

  -- ON HAND inicial: 80 unidades en el almacén principal (ejemplo
  -- obligatorio del enunciado empieza en ON HAND 80 / COMMITTED 0 / AVAILABLE 80).
  perform rpc_create_inventory_movement(
    gen_random_uuid(),
    jsonb_build_object('product_id', v_product.id, 'warehouse_id', v_warehouse1.id, 'movement_type', 'entrada_manual', 'quantity', 80)
  );

  raise notice 'SETUP OK: producto %, Pedido vendedor1 % (ON HAND 80), Pedido vendedor2 %',
    v_product.id, v_order.id, v_order2.id;
end $$;

-- =========================================================================
-- TEST 1 (ejemplo obligatorio): ON HAND 80 / COMMITTED 0 / AVAILABLE 80.
-- Reservar 30 -> COMMITTED 30 / AVAILABLE 50. ON HAND e INCOMING sin cambio.
-- VENDEDOR1 es dueño del Pedido origen.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_on_hand integer;
  v_committed integer;
  v_incoming integer;
  v_reservation inventory_reservations;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_on_hand <> 80 or v_committed <> 0 then
    raise exception 'TEST 1 FALLÓ (precondición): esperaba ON HAND=80/COMMITTED=0, vi %/%', v_on_hand, v_committed;
  end if;

  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 30
  );
  perform set_config('test.reservation0037_id', v_reservation.id::text, false);

  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  select coalesce(incoming, 0) into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;

  if v_on_hand <> 80 then
    raise exception 'TEST 1 FALLÓ: reservar NO debe modificar ON HAND (esperaba 80, es %)', v_on_hand;
  end if;
  if v_committed <> 30 then
    raise exception 'TEST 1 FALLÓ: COMMITTED debería ser 30, es %', v_committed;
  end if;
  if v_on_hand - v_committed <> 50 then
    raise exception 'TEST 1 FALLÓ: AVAILABLE debería ser 50, es %', v_on_hand - v_committed;
  end if;
  if coalesce(v_incoming, 0) <> 0 then
    raise exception 'TEST 1 FALLÓ: reservar NO debe modificar INCOMING (esperaba 0, es %)', v_incoming;
  end if;

  raise notice 'TEST 1 OK: reservar 30 -> ON HAND 80 / COMMITTED 30 / AVAILABLE 50, INCOMING sin cambio';
end $$;

-- =========================================================================
-- TEST 2 (ejemplo obligatorio): aumentar reserva a 50 -> COMMITTED 50 /
-- AVAILABLE 30.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_committed integer;
begin
  perform rpc_adjust_inventory_reservation(v_reservation_id, 50);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_committed <> 50 then
    raise exception 'TEST 2 FALLÓ: COMMITTED debería ser 50, es %', v_committed;
  end if;
  raise notice 'TEST 2 OK: aumentar a 50 -> COMMITTED 50 / AVAILABLE 30';
end $$;

-- =========================================================================
-- TEST 3 (ejemplo obligatorio): reducir a 20 -> COMMITTED 20 / AVAILABLE 60.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_committed integer;
begin
  perform rpc_adjust_inventory_reservation(v_reservation_id, 20);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_committed <> 20 then
    raise exception 'TEST 3 FALLÓ: COMMITTED debería ser 20, es %', v_committed;
  end if;
  raise notice 'TEST 3 OK: reducir a 20 -> COMMITTED 20 / AVAILABLE 60';
end $$;

-- =========================================================================
-- TEST 4: reenviar la misma cantidad (20) es idempotente — no genera un
-- evento nuevo en el ledger.
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_events_before integer;
  v_events_after integer;
begin
  select count(*) into v_events_before from inventory_reservation_events where reservation_id = v_reservation_id;
  perform rpc_adjust_inventory_reservation(v_reservation_id, 20);
  select count(*) into v_events_after from inventory_reservation_events where reservation_id = v_reservation_id;
  if v_events_after <> v_events_before then
    raise exception 'TEST 4 FALLÓ: reenviar la misma cantidad no debería generar un evento nuevo (antes %, después %)',
      v_events_before, v_events_after;
  end if;
  raise notice 'TEST 4 OK: ajustar a la misma cantidad es idempotente';
end $$;

-- =========================================================================
-- TEST 5 (ejemplo obligatorio): liberar -> COMMITTED 0 / AVAILABLE 80. La
-- fila NO se borra (released_at queda set, trazabilidad).
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_committed integer;
  v_released_at timestamptz;
begin
  perform rpc_release_inventory_reservation(v_reservation_id);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_committed <> 0 then
    raise exception 'TEST 5 FALLÓ: COMMITTED debería volver a 0, es %', v_committed;
  end if;

  select released_at into v_released_at from inventory_reservations where id = v_reservation_id;
  if v_released_at is null then
    raise exception 'TEST 5 FALLÓ: la reserva liberada debería conservar released_at, no borrarse';
  end if;

  raise notice 'TEST 5 OK: liberar -> COMMITTED 0 / AVAILABLE 80, fila conservada como historial';
end $$;

-- =========================================================================
-- TEST 6: tras liberar, se puede volver a reservar el mismo producto en el
-- mismo Pedido — crea una fila NUEVA (la anterior sigue existiendo,
-- liberada).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_reservation inventory_reservations;
  v_total_rows integer;
begin
  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 10
  );
  perform set_config('test.reservation0037b_id', v_reservation.id::text, false);

  select count(*) into v_total_rows from inventory_reservations where order_id = v_order_id and product_id = v_product_id;
  if v_total_rows <> 2 then
    raise exception 'TEST 6 FALLÓ: deberían existir 2 filas históricas (1 liberada + 1 activa), hay %', v_total_rows;
  end if;

  raise notice 'TEST 6 OK: re-reservar tras liberar crea una fila nueva, sin perder el historial anterior';
end $$;

-- =========================================================================
-- TEST 7: no se puede reservar (ni ajustar a) más que AVAILABLE. Se usa
-- rpc_adjust_inventory_reservation sobre la reserva activa del TEST 6
-- (order0037/product0037 ya tiene una reserva activa, así que
-- rpc_reserve_inventory rechazaría por duplicado antes de llegar a validar
-- disponibilidad — ver TEST 13).
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037b_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_adjust_inventory_reservation(v_reservation_id, 9999);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se esperaba rechazo por exceder AVAILABLE';
  end if;
  if v_msg not ilike '%disponible%' then
    raise exception 'TEST 7 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 7 OK: no se puede ajustar una reserva por encima de AVAILABLE';
end $$;

-- =========================================================================
-- TEST 8: no se permiten cantidades negativas ni cero, ni al reservar ni
-- al ajustar.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_reservation_id uuid := current_setting('test.reservation0037b_id')::uuid;
  v_other_product_id uuid := current_setting('test.otherproduct0037_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_other_product_id, v_warehouse_id, -5);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 8 FALLÓ: cantidad negativa al reservar debería rechazarse'; end if;

  v_failed := false;
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_other_product_id, v_warehouse_id, 0);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 8 FALLÓ: cantidad cero al reservar debería rechazarse'; end if;

  v_failed := false;
  begin
    perform rpc_adjust_inventory_reservation(v_reservation_id, -1);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 8 FALLÓ: cantidad negativa al ajustar debería rechazarse'; end if;

  raise notice 'TEST 8 OK: cantidades negativas/cero rechazadas al reservar y al ajustar';
end $$;

-- =========================================================================
-- TEST 9: solo productos de catálogo QUE FORMAN PARTE del Pedido pueden
-- reservarse — una línea manual sin catalog_product_id, o un producto no
-- referenciado en las partidas de este Pedido, se rechazan.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_other_product_id uuid := current_setting('test.otherproduct0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_other_product_id, v_warehouse_id, 1);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 9 FALLÓ: un producto que no está en las partidas del Pedido no debería poder reservarse';
  end if;
  if v_msg not ilike '%no forma parte%' then
    raise exception 'TEST 9 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 9 OK: solo productos realmente presentes en las partidas del Pedido pueden reservarse';
end $$;

-- =========================================================================
-- TEST 10: cross-org — producto/almacén de otra organización rechazados.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_reserve_inventory(
      gen_random_uuid(), v_order_id, '60000000-0000-0000-0000-00000000001b', v_warehouse_id, 1
    );
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 10 FALLÓ: producto de otra organización debería rechazarse';
  end if;

  v_failed := false;
  begin
    perform rpc_reserve_inventory(
      gen_random_uuid(), v_order_id, current_setting('test.product0037_id')::uuid,
      '70000000-0000-0000-0000-00000000001b', 1
    );
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 10 FALLÓ: almacén de otra organización debería rechazarse';
  end if;

  raise notice 'TEST 10 OK: cross-org rechazado (producto y almacén)';
end $$;

-- =========================================================================
-- TEST 11: VENDEDOR2 (no dueño de order0037) no puede reservar/ajustar/
-- liberar sobre ese Pedido — mismo criterio que orders_update_own_or_admin.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_reservation_id uuid := current_setting('test.reservation0037b_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 1);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 11 FALLÓ: VENDEDOR2 no debería poder reservar sobre un Pedido ajeno';
  end if;
  if v_msg not ilike '%permiso%' then
    raise exception 'TEST 11 FALLÓ: mensaje inesperado: %', v_msg;
  end if;

  v_failed := false;
  begin
    perform rpc_adjust_inventory_reservation(v_reservation_id, 5);
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 11 FALLÓ: VENDEDOR2 no debería poder ajustar una reserva de un Pedido ajeno';
  end if;

  v_failed := false;
  begin
    perform rpc_release_inventory_reservation(v_reservation_id);
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 11 FALLÓ: VENDEDOR2 no debería poder liberar una reserva de un Pedido ajeno';
  end if;

  raise notice 'TEST 11 OK: VENDEDOR2 bloqueado en reservar/ajustar/liberar sobre un Pedido que no le pertenece';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 12: ADMIN puede reservar/ajustar/liberar sobre CUALQUIER Pedido de
-- su organización, sin importar el vendedor dueño.
-- =========================================================================
do $$
declare
  v_order2_id uuid := current_setting('test.order0037b_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_reservation inventory_reservations;
  v_committed integer;
begin
  select * into v_reservation from rpc_reserve_inventory(
    gen_random_uuid(), v_order2_id, v_product_id, v_warehouse_id, 5
  );
  perform rpc_adjust_inventory_reservation(v_reservation.id, 8);
  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  -- 10 (TEST 6, order0037) + 8 (este Pedido) = 18
  if v_committed <> 18 then
    raise exception 'TEST 12 FALLÓ: COMMITTED total del producto debería ser 18 (10+8), es %', v_committed;
  end if;
  perform rpc_release_inventory_reservation(v_reservation.id);
  raise notice 'TEST 12 OK: ADMIN reserva/ajusta/libera sobre cualquier Pedido de su organización';
end $$;

-- =========================================================================
-- TEST 13: no se puede crear una segunda reserva ACTIVA para el mismo
-- (Pedido, producto) — hay que ajustar la existente.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_warehouse_id uuid := current_setting('test.warehouse0037_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_reserve_inventory(gen_random_uuid(), v_order_id, v_product_id, v_warehouse_id, 1);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 13 FALLÓ: no debería poder crearse una segunda reserva activa para el mismo Pedido+producto';
  end if;
  if v_msg not ilike '%ajústala%' then
    raise exception 'TEST 13 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 13 OK: una sola reserva activa por Pedido+producto (índice único parcial)';
end $$;

-- =========================================================================
-- TEST 14: ajustar/liberar una reserva inexistente o ya liberada falla.
-- =========================================================================
do $$
declare
  v_released_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_adjust_inventory_reservation(v_released_id, 5);
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 14 FALLÓ: ajustar una reserva ya liberada debería fallar';
  end if;

  v_failed := false;
  begin
    perform rpc_release_inventory_reservation(gen_random_uuid());
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'TEST 14 FALLÓ: liberar una reserva inexistente debería fallar';
  end if;

  raise notice 'TEST 14 OK: ajustar/liberar una reserva inexistente o ya liberada falla correctamente';
end $$;

-- =========================================================================
-- TEST 15: el ledger de eventos registra la secuencia completa
-- creada/aumentada/reducida/liberada con cantidades correctas (reserva del
-- TEST 1-5).
-- =========================================================================
do $$
declare
  v_reservation_id uuid := current_setting('test.reservation0037_id')::uuid;
  v_sequence text;
begin
  select string_agg(event_type || ':' || coalesce(previous_quantity::text, 'null') || '->' || new_quantity, ', ' order by changed_at)
    into v_sequence
    from inventory_reservation_events where reservation_id = v_reservation_id;
  if v_sequence <> 'creada:null->30, aumentada:30->50, reducida:50->20, liberada:20->20' then
    raise exception 'TEST 15 FALLÓ: secuencia de eventos inesperada: %', v_sequence;
  end if;
  raise notice 'TEST 15 OK: ledger de eventos completo y correcto: %', v_sequence;
end $$;

-- =========================================================================
-- TEST 16: ON HAND e INCOMING del producto siguen sin alterarse por
-- ninguna de las operaciones de reserva de esta prueba (16 tests después,
-- verificación holística final).
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_on_hand integer;
  v_incoming integer;
begin
  select coalesce(sum(on_hand), 0) into v_on_hand from rpc_inventory_stock_levels(v_product_id);
  select incoming into v_incoming from rpc_inventory_incoming_by_product() where product_id = v_product_id;
  if v_on_hand <> 80 then
    raise exception 'TEST 16 FALLÓ: ON HAND debería seguir en 80 (ninguna reserva lo toca), es %', v_on_hand;
  end if;
  if coalesce(v_incoming, 0) <> 0 then
    raise exception 'TEST 16 FALLÓ: INCOMING debería seguir en 0, es %', v_incoming;
  end if;
  raise notice 'TEST 16 OK: ON HAND (80) e INCOMING (0) intactos tras todas las operaciones de reserva';
end $$;

-- =========================================================================
-- TEST 17 (AJUSTE FINAL): editar el Pedido y quitar la partida del
-- producto reservado NO libera ni borra la reserva activa
-- (reservation0037b, producto0037, cantidad 10) — sigue contando para
-- COMMITTED, y se puede liberar normalmente después. rpc_update_order
-- borra/reinserta TODOS los order_items (0034) sin tocar
-- inventory_reservations en absoluto — esta prueba lo confirma end-to-end.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0037_id')::uuid;
  v_product_id uuid := current_setting('test.product0037_id')::uuid;
  v_reservation_id uuid := current_setting('test.reservation0037b_id')::uuid;
  v_still_linked boolean;
  v_released_at timestamptz;
  v_committed integer;
begin
  perform rpc_update_order(
    v_order_id,
    jsonb_build_object('product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Reemplazo sin catálogo', 'quantity', 1))
  );

  select exists(
    select 1 from order_items where order_id = v_order_id and catalog_product_id = v_product_id
  ) into v_still_linked;
  if v_still_linked then
    raise exception 'TEST 17 FALLÓ (precondición): el producto debería haber quedado fuera de las partidas del Pedido';
  end if;

  select released_at into v_released_at from inventory_reservations where id = v_reservation_id;
  if v_released_at is not null then
    raise exception 'TEST 17 FALLÓ: editar el Pedido no debe liberar la reserva automáticamente';
  end if;

  select coalesce(sum(committed), 0) into v_committed from rpc_inventory_committed_levels(v_product_id);
  if v_committed <> 10 then
    raise exception 'TEST 17 FALLÓ: COMMITTED debería seguir en 10 (reserva huérfana sigue activa), es %', v_committed;
  end if;

  -- Sigue pudiendo liberarse manualmente con total normalidad.
  perform rpc_release_inventory_reservation(v_reservation_id);
  select released_at into v_released_at from inventory_reservations where id = v_reservation_id;
  if v_released_at is null then
    raise exception 'TEST 17 FALLÓ: la reserva huérfana debería poder liberarse manualmente como cualquier otra';
  end if;

  raise notice 'TEST 17 OK: quitar la partida del Pedido NO libera/borra la reserva (queda huérfana, COMMITTED sigue en 10); se libera manualmente sin problema';
end $$;
select test_set_user(:'admin');

select 'TESTS 1-17 (0037 Reservas de Inventario, Fase 6N) PASARON' as resultado;

rollback;
