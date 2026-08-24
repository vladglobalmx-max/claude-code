-- THÖREN — Fase 6H: Flujo Operativo y Estados de Pedidos (0033) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0033 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible.

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
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
         :'admin'::uuid as admin,
         :'vendedor1'::uuid as vendedor1,
         :'vendedor2'::uuid as vendedor2,
         :'admin_orgb'::uuid as admin_orgb;

-- =========================================================================
-- 1) rpc_create_order: operational_status nace en 'pedido' + 1 fila de
--    historial (previous_status null, changed_by = quien crea).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_admin uuid;
  v_order orders;
  v_hist_count int;
  v_hist order_operational_status_history;
begin
  select customer1, salesperson1, admin into v_customer1, v_salesperson1, v_admin from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  );

  if v_order.operational_status <> 'pedido' then
    raise exception 'TEST 1a FALLÓ: operational_status debería nacer en pedido, es %', v_order.operational_status;
  end if;

  select count(*) into v_hist_count from order_operational_status_history where order_id = v_order.id;
  if v_hist_count <> 1 then
    raise exception 'TEST 1b FALLÓ: debería haber exactamente 1 fila de historial al crear, hay %', v_hist_count;
  end if;

  select * into v_hist from order_operational_status_history where order_id = v_order.id;
  if v_hist.previous_status is not null or v_hist.new_status <> 'pedido' or v_hist.changed_by_user_id <> v_admin then
    raise exception 'TEST 1c FALLÓ: fila de historial inicial mal formada';
  end if;

  perform set_config('test.order0033_id', v_order.id::text, false);
  raise notice 'TEST 1 OK: rpc_create_order — operational_status=pedido + 1 fila de historial correcta';
end $$;

-- =========================================================================
-- 2) Cambiar operational_status vía UPDATE directo (mismo patrón que
--    setOrderStatus hoy) agrega una fila de historial con previous/new/
--    changed_by/changed_by_name correctos.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_admin uuid;
  v_hist_count int;
  v_hist order_operational_status_history;
begin
  select admin into v_admin from _ids;
  update orders set operational_status = 'en_proceso' where id = v_order_id;

  select count(*) into v_hist_count from order_operational_status_history where order_id = v_order_id;
  if v_hist_count <> 2 then
    raise exception 'TEST 2a FALLÓ: debería haber 2 filas de historial tras el cambio, hay %', v_hist_count;
  end if;

  select * into v_hist from order_operational_status_history
    where order_id = v_order_id order by changed_at desc limit 1;
  if v_hist.previous_status <> 'pedido' or v_hist.new_status <> 'en_proceso'
     or v_hist.changed_by_user_id <> v_admin or v_hist.changed_by_name <> 'Administrador' then
    raise exception 'TEST 2b FALLÓ: fila de historial del cambio mal formada (prev=% new=% by=% name=%)',
      v_hist.previous_status, v_hist.new_status, v_hist.changed_by_user_id, v_hist.changed_by_name;
  end if;

  raise notice 'TEST 2 OK: cambio directo de operational_status registra historial con quién/cuándo correctos';
end $$;

-- =========================================================================
-- 3) Varios cambios seguidos: el historial se ACUMULA, nunca se sobreescribe
--    ni se borra (requisito explícito "no borrar historial").
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_hist_count int;
begin
  update orders set operational_status = 'ordenado_a_proveedor' where id = v_order_id;
  update orders set operational_status = 'en_transito' where id = v_order_id;
  update orders set operational_status = 'recibido' where id = v_order_id;

  select count(*) into v_hist_count from order_operational_status_history where order_id = v_order_id;
  if v_hist_count <> 5 then
    raise exception 'TEST 3 FALLÓ: deberían acumularse 5 filas de historial (1 inicial + 4 cambios), hay %', v_hist_count;
  end if;
  raise notice 'TEST 3 OK: historial se acumula sin borrar filas anteriores (% filas)', v_hist_count;
end $$;

-- =========================================================================
-- 4) rpc_update_order (editar el pedido) NUNCA toca operational_status ni
--    genera historial — no está en su lista explícita de columnas.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_hist_count_before int;
  v_hist_count_after int;
  v_status_before text;
  v_status_after text;
begin
  select operational_status into v_status_before from orders where id = v_order_id;
  select count(*) into v_hist_count_before from order_operational_status_history where order_id = v_order_id;

  perform rpc_update_order(
    v_order_id,
    jsonb_build_object(
      'client_name', 'Cliente editado 0033', 'product_type', 'otro'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1-editado', 'quantity', 2)),
    '[]'::jsonb,
    '[]'::jsonb
  );

  select operational_status into v_status_after from orders where id = v_order_id;
  select count(*) into v_hist_count_after from order_operational_status_history where order_id = v_order_id;

  if v_status_after <> v_status_before then
    raise exception 'TEST 4a FALLÓ: rpc_update_order cambió operational_status de % a %', v_status_before, v_status_after;
  end if;
  if v_hist_count_after <> v_hist_count_before then
    raise exception 'TEST 4b FALLÓ: rpc_update_order generó historial nuevo (% -> %)', v_hist_count_before, v_hist_count_after;
  end if;
  raise notice 'TEST 4 OK: rpc_update_order no toca operational_status ni genera historial';
end $$;

-- =========================================================================
-- 5) rpc_duplicate_order: el pedido duplicado nace fresco en 'pedido' con
--    SU PROPIA fila de historial — nunca hereda el operational_status ni el
--    historial del origen (que ya avanzó a 'recibido' con 5 filas, TEST 3).
-- =========================================================================
do $$
declare
  v_source_id uuid := current_setting('test.order0033_id')::uuid;
  v_dup record;
  v_dup_status text;
  v_dup_hist_count int;
begin
  select * into v_dup from rpc_duplicate_order(v_source_id, current_date);

  select operational_status into v_dup_status from orders where id = v_dup.id;
  select count(*) into v_dup_hist_count from order_operational_status_history where order_id = v_dup.id;

  if v_dup_status <> 'pedido' then
    raise exception 'TEST 5a FALLÓ: pedido duplicado debería nacer en pedido, es %', v_dup_status;
  end if;
  if v_dup_hist_count <> 1 then
    raise exception 'TEST 5b FALLÓ: pedido duplicado debería tener exactamente 1 fila de historial propia, tiene %', v_dup_hist_count;
  end if;
  raise notice 'TEST 5 OK: rpc_duplicate_order no hereda operational_status ni historial del origen';
end $$;

-- =========================================================================
-- 6) status legacy (borrador/pedido/cerrado/cancelado) y operational_status
--    son independientes — cambiar uno no toca el otro.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_operational_before text;
  v_operational_after text;
begin
  select operational_status into v_operational_before from orders where id = v_order_id;
  update orders set status = 'cancelado' where id = v_order_id;
  select operational_status into v_operational_after from orders where id = v_order_id;

  if v_operational_before <> v_operational_after then
    raise exception 'TEST 6 FALLÓ: cambiar status legacy tocó operational_status (% -> %)', v_operational_before, v_operational_after;
  end if;
  raise notice 'TEST 6 OK: status legacy y operational_status son independientes';
end $$;

-- =========================================================================
-- 7) Constraint: valor inválido de operational_status se rechaza.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update orders set operational_status = 'no_existe' where id = v_order_id;
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: debería rechazar un operational_status fuera del check constraint';
  end if;
  raise notice 'TEST 7 OK: check constraint rechaza valores inválidos';
end $$;

-- =========================================================================
-- 8) RLS de escritura: authenticated (incluido ADMIN) NO puede insertar,
--    actualizar ni borrar historial directamente — solo el trigger puede
--    (SECURITY DEFINER, sin pasar por RLS).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_hist_id uuid;
  v_status_before text;
  v_rows int;
begin
  select id, new_status into v_hist_id, v_status_before
    from order_operational_status_history where order_id = v_order_id limit 1;

  -- INSERT: sin ninguna policy de INSERT, Postgres exige WITH CHECK y no
  -- hay ninguno que pase -> RLS lo rechaza con una excepción real.
  begin
    insert into order_operational_status_history (order_id, new_status) values (v_order_id, 'completado');
    raise exception 'TEST 8a FALLÓ: INSERT directo a historial debería estar bloqueado por RLS';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  -- UPDATE/DELETE: sin policy de UPDATE/DELETE, la fila simplemente no es
  -- visible para esas operaciones bajo RLS -> 0 filas afectadas, sin
  -- excepción (comportamiento estándar de Postgres, verificado contra este
  -- Postgres real antes de escribir esta prueba) — se confirma por
  -- GET DIAGNOSTICS, no por excepción.
  update order_operational_status_history set new_status = 'completado' where id = v_hist_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 8b FALLÓ: UPDATE directo a historial debería afectar 0 filas bajo RLS, afectó %', v_rows;
  end if;

  delete from order_operational_status_history where id = v_hist_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 8c FALLÓ: DELETE directo de historial debería afectar 0 filas bajo RLS, afectó %', v_rows;
  end if;

  if (select new_status from order_operational_status_history where id = v_hist_id) <> v_status_before then
    raise exception 'TEST 8d FALLÓ: la fila de historial no debió modificarse';
  end if;

  raise notice 'TEST 8 OK: order_operational_status_history es de solo lectura para authenticated (incluido ADMIN)';
end $$;

-- =========================================================================
-- 9) RLS de lectura/escritura por VENDEDOR: ve y puede cambiar el estado de
--    SUS pedidos; no ve ni puede tocar los de otro vendedor.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_visible boolean;
begin
  select exists(select 1 from order_operational_status_history where order_id = v_order_id) into v_visible;
  if not v_visible then
    raise exception 'TEST 9a FALLÓ: VENDEDOR1 debería ver el historial de su propio pedido';
  end if;

  update orders set operational_status = 'programado_entrega_instalacion' where id = v_order_id;
  if (select operational_status from orders where id = v_order_id) <> 'programado_entrega_instalacion' then
    raise exception 'TEST 9b FALLÓ: VENDEDOR1 debería poder cambiar el estado de su propio pedido';
  end if;

  raise notice 'TEST 9a/9b OK: VENDEDOR1 ve/cambia el estado de su propio pedido';
end $$;

select test_set_user(:'vendedor2');
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_visible boolean;
begin
  select exists(select 1 from order_operational_status_history where order_id = v_order_id) into v_visible;
  if v_visible then
    raise exception 'TEST 9c FALLÓ: VENDEDOR2 no debería ver historial de un pedido ajeno';
  end if;
  if (select count(*) from orders where id = v_order_id) <> 0 then
    raise exception 'TEST 9d FALLÓ: VENDEDOR2 no debería ver siquiera el pedido ajeno (RLS de orders, sin cambios en esta fase)';
  end if;
  raise notice 'TEST 9c/9d OK: VENDEDOR2 no ve pedido ni historial ajenos';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 10) Aislamiento cross-organización: ADMIN de Org B no ve historial de un
--     pedido de Org A (herencia vía "exists (select ... from orders o
--     where is_organization_member(o.organization_id))").
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_order_id uuid := current_setting('test.order0033_id')::uuid;
  v_visible boolean;
begin
  select exists(select 1 from order_operational_status_history where order_id = v_order_id) into v_visible;
  if v_visible then
    raise exception 'TEST 10 FALLÓ: ADMIN de Org B no debería ver historial de un pedido de Org A';
  end if;
  raise notice 'TEST 10 OK: aislamiento por organización — historial de Order';
end $$;
select test_set_user(:'admin');

rollback;
