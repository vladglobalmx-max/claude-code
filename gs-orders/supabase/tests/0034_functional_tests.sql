-- THÖREN — Fase 6K: Fechas Compromiso y Vencimientos de Pedidos (0034) —
-- pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0034 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final — repetible.
--
-- Alcance: solo lo NUEVO de 0034 (columnas de fecha + su paso a través de
-- rpc_create_order/rpc_update_order/rpc_duplicate_order). No repite
-- regresión de catalog hardening (0032) ni de operational_status (0033) —
-- esta migración no tocó esa lógica, solo agregó columnas a listas ya
-- existentes.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'

select test_set_user(:'admin');
select id as customer1 from customers where organization_id = (select id from organizations where slug = 'global-supplier-mty') and name = 'CEMEX' \gset
create temp table _ids as
  select :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1;

-- =========================================================================
-- 1) rpc_create_order persiste las 4 fechas nuevas.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
begin
  select customer1, salesperson1 into v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1,
      'supplier_commitment_date', '2026-09-01',
      'estimated_reception_date', '2026-09-10',
      'scheduled_delivery_date', '2026-09-20',
      'actual_completion_date', ''
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  );

  if v_order.supplier_commitment_date <> '2026-09-01'::date
     or v_order.estimated_reception_date <> '2026-09-10'::date
     or v_order.scheduled_delivery_date <> '2026-09-20'::date
     or v_order.actual_completion_date is not null then
    raise exception 'TEST 1 FALLÓ: rpc_create_order no persistió las fechas correctamente (% % % %)',
      v_order.supplier_commitment_date, v_order.estimated_reception_date, v_order.scheduled_delivery_date, v_order.actual_completion_date;
  end if;

  perform set_config('test.order0034_id', v_order.id::text, false);
  raise notice 'TEST 1 OK: rpc_create_order persiste supplier_commitment_date/estimated_reception_date/scheduled_delivery_date, actual_completion_date vacío -> null';
end $$;

-- =========================================================================
-- 2) rpc_create_order sin ninguna fecha en el payload -> las 4 quedan null
--    (nunca se inventa un valor).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
begin
  select customer1, salesperson1 into v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  );

  if v_order.supplier_commitment_date is not null or v_order.estimated_reception_date is not null
     or v_order.scheduled_delivery_date is not null or v_order.actual_completion_date is not null then
    raise exception 'TEST 2 FALLÓ: un pedido sin fechas en el payload no debería tener ninguna fecha capturada';
  end if;
  raise notice 'TEST 2 OK: sin fechas en el payload, las 4 columnas quedan null';
end $$;

-- =========================================================================
-- 3) rpc_update_order actualiza las fechas (sobreescritura directa) y
--    puede limpiarlas a null explícitamente.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0034_id')::uuid;
  v_order orders;
begin
  perform rpc_update_order(
    v_order_id,
    jsonb_build_object(
      'client_name', 'x', 'product_type', 'otro',
      'supplier_commitment_date', '2026-10-01',
      'estimated_reception_date', '',
      'scheduled_delivery_date', '2026-10-20',
      'actual_completion_date', '2026-10-25'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1)),
    '[]'::jsonb,
    '[]'::jsonb
  );

  select * into v_order from orders where id = v_order_id;

  if v_order.supplier_commitment_date <> '2026-10-01'::date
     or v_order.estimated_reception_date is not null
     or v_order.scheduled_delivery_date <> '2026-10-20'::date
     or v_order.actual_completion_date <> '2026-10-25'::date then
    raise exception 'TEST 3 FALLÓ: rpc_update_order no actualizó/limpió las fechas correctamente (% % % %)',
      v_order.supplier_commitment_date, v_order.estimated_reception_date, v_order.scheduled_delivery_date, v_order.actual_completion_date;
  end if;
  raise notice 'TEST 3 OK: rpc_update_order sobreescribe y limpia fechas (estimated_reception_date -> null)';
end $$;

-- =========================================================================
-- 4) rpc_duplicate_order NO hereda las fechas del origen — el duplicado es
--    un pedido nuevo, sus fechas todavía no se han vuelto a planificar.
-- =========================================================================
do $$
declare
  v_source_id uuid := current_setting('test.order0034_id')::uuid;
  v_dup record;
begin
  select * into v_dup from rpc_duplicate_order(v_source_id, current_date);

  if v_dup.supplier_commitment_date is not null or v_dup.estimated_reception_date is not null
     or v_dup.scheduled_delivery_date is not null or v_dup.actual_completion_date is not null then
    raise exception 'TEST 4 FALLÓ: rpc_duplicate_order no debería heredar ninguna fecha compromiso del origen';
  end if;
  raise notice 'TEST 4 OK: rpc_duplicate_order nace sin fechas compromiso (no hereda del origen)';
end $$;

-- =========================================================================
-- 5) Regresión rápida: rpc_update_order sigue aplicando correctamente el
--    resto de sus campos (no solo las fechas nuevas) — confirma que la
--    migración no rompió nada más de la función.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0034_id')::uuid;
  v_client_name text;
begin
  -- customer_id no vino en el payload de TEST 3 (ausente ≠ null, 0022): se
  -- preserva el de la creación (CEMEX) y client_name se re-resuelve desde
  -- customers.name, ignorando el 'x' literal del payload — comportamiento
  -- correcto y preexistente, no algo que 0034 deba cambiar.
  select client_name into v_client_name from orders where id = v_order_id;
  if v_client_name <> 'CEMEX' then
    raise exception 'TEST 5 FALLÓ: client_name debería seguir resolviéndose desde customer_id sin regresión, es %', v_client_name;
  end if;
  raise notice 'TEST 5 OK: rpc_update_order sigue actualizando el resto de sus campos sin regresión';
end $$;

-- =========================================================================
-- 6) CORRECCIÓN (Fase 6K — AJUSTE FINAL): rpc_update_order ya NO pierde
--    unit/customer_requirements de las líneas al editar un pedido (bug
--    preexistente desde 0032, corregido en esta misma migración).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_item order_items;
begin
  select customer1, salesperson1 into v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'unit', 'pza', 'customer_requirements', 'IP65'))
  );

  select * into v_item from order_items where order_id = v_order.id;
  if v_item.unit <> 'pza' or v_item.customer_requirements <> 'IP65' then
    raise exception 'TEST 6 FALLÓ (setup): rpc_create_order no guardó unit/customer_requirements';
  end if;

  -- Editar el pedido reenviando la MISMA línea con los mismos unit/customer_requirements.
  perform rpc_update_order(
    v_order.id,
    jsonb_build_object('client_name', 'x', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'unit', 'pza', 'customer_requirements', 'IP65')),
    '[]'::jsonb,
    '[]'::jsonb
  );

  select * into v_item from order_items where order_id = v_order.id;
  if v_item.unit is distinct from 'pza' or v_item.customer_requirements is distinct from 'IP65' then
    raise exception 'TEST 6 FALLÓ: unit/customer_requirements se perdieron al editar (unit=%, customer_requirements=%)',
      v_item.unit, v_item.customer_requirements;
  end if;
  raise notice 'TEST 6 OK: rpc_update_order preserva unit/customer_requirements de order_items al editar (bug de 0032 corregido)';
end $$;

rollback;
