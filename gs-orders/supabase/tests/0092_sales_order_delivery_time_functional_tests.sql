-- THÖREN — 0092_sales_order_delivery_time.sql: pruebas funcionales contra
-- Postgres real. Fixtures 100% autocontenidas, transacción con rollback
-- final — no deja rastro en la base.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` — todo id usado DENTRO de un bloque `do
-- $$` se resuelve como literal UUID fijo o vía variable plpgsql.

begin;

\set admin_a '00000000-0000-0000-0000-000000009201'
\set vendedor_a '00000000-0000-0000-0000-000000009202'
\set org_a '00000000-0000-0000-0000-000000009210'
\set bu_a '00000000-0000-0000-0000-000000009220'
\set customer_a '00000000-0000-0000-0000-000000009230'
\set sp_a '00000000-0000-0000-0000-000000009240'
\set person_a '00000000-0000-0000-0000-000000009250'
\set catalog_product_a '00000000-0000-0000-0000-000000009280'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-92a@test.local'),
  (:'vendedor_a', 'vendedor-92a@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 92 A', 'test-org-92-a');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 92', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true);

insert into business_units (id, organization_id, name, code) values
  (:'bu_a', :'org_a', 'BU Test 92 A', 'bu_test_92a');

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 92 A', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 92', 'VA92', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 92', 'vendedor', :'sp_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true);

insert into people (id, organization_id, name, active) values
  (:'person_a', :'org_a', 'Vendedor A Persona 92', true);
update salespeople set person_id = :'person_a' where id = :'sp_a';

insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_a', :'bu_a', 'QT92A');

insert into product_catalog (id, organization_id, sku, name, unit, active) values
  (:'catalog_product_a', :'org_a', 'TEST-92-A', 'Producto Test 92 A', 'pza', true);

create temporary table test_scratch_92 (key text primary key, value text);
grant all on test_scratch_92 to authenticated;

-- =========================================================================
-- TEST 1: Quote aceptada con delivery_time = "3-4 Semanas" -> sales_order
-- la conserva EXACTAMENTE, y requested_delivery_date (date) queda NULL —
-- nunca se intenta parsear el texto a fecha.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009230';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009240';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009220';
  v_catalog_a uuid := '00000000-0000-0000-0000-000000009280';
  v_quote quotes;
  v_so sales_orders;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text, 'payment_terms', 'Contado', 'delivery_time', '3-4 Semanas'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_catalog_a, 'model', 'TEST-92-A', 'quantity', 2, 'unit_price', 100, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  select * into v_so from rpc_create_sales_order_from_quote(v_quote.id);
  insert into test_scratch_92 (key, value) values ('so_with_delivery_time_id', v_so.id::text);

  if v_so.delivery_time is distinct from '3-4 Semanas' then
    raise exception 'TEST 1 FALLÓ: delivery_time no se copió exacto desde la Quote (actual: %)', v_so.delivery_time;
  end if;
  if v_so.requested_delivery_date is not null then
    raise exception 'TEST 1 FALLÓ: requested_delivery_date debería quedar NULL (actual: %) — nunca se parsea delivery_time a fecha.', v_so.requested_delivery_date;
  end if;

  raise notice 'TEST 1 OK: delivery_time "3-4 Semanas" copiado exacto desde Quote, requested_delivery_date queda NULL.';
end $$;
reset role;

-- =========================================================================
-- TEST 2: Quote SIN delivery_time (NULL) -> sales_order.delivery_time
-- también NULL — NULL es un valor válido, la conversión no falla.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009230';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009240';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009220';
  v_catalog_a uuid := '00000000-0000-0000-0000-000000009280';
  v_quote quotes;
  v_so sales_orders;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text, 'payment_terms', 'Contado'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_catalog_a, 'model', 'TEST-92-A', 'quantity', 1, 'unit_price', 50, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  if v_quote.delivery_time is not null then
    raise exception 'TEST 2 FALLÓ (fixture): la Quote no debería tener delivery_time (actual: %)', v_quote.delivery_time;
  end if;

  select * into v_so from rpc_create_sales_order_from_quote(v_quote.id);

  if v_so.delivery_time is not null then
    raise exception 'TEST 2 FALLÓ: delivery_time debería quedar NULL (actual: %)', v_so.delivery_time;
  end if;

  raise notice 'TEST 2 OK: Quote sin delivery_time -> sales_order.delivery_time NULL, conversión no falla.';
end $$;
reset role;

-- =========================================================================
-- TEST 3: rpc_create_sales_order DIRECTO (creación manual, sin Quote de
-- origen) — con delivery_time en el payload lo guarda; SIN la clave (todo
-- el código existente antes de este ticket) queda NULL, sin romperse.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009230';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009240';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009220';
  v_catalog_a uuid := '00000000-0000-0000-0000-000000009280';
  v_so_with sales_orders;
  v_so_without sales_orders;
begin
  select * into v_so_with from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'business_unit_id', v_bu_a, 'currency', 'MXN', 'payment_terms_type', 'cash', 'delivery_time', '2 semanas'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_catalog_a, 'quantity', 1, 'unit_price', 10, 'discount', 0, 'tax', 0))
  );
  if v_so_with.delivery_time is distinct from '2 semanas' then
    raise exception 'TEST 3a FALLÓ: creación manual con delivery_time no lo guardó (actual: %)', v_so_with.delivery_time;
  end if;

  select * into v_so_without from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'business_unit_id', v_bu_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', v_catalog_a, 'quantity', 1, 'unit_price', 10, 'discount', 0, 'tax', 0))
  );
  insert into test_scratch_92 (key, value) values ('so_without_delivery_time_id', v_so_without.id::text);
  if v_so_without.delivery_time is not null then
    raise exception 'TEST 3b FALLÓ: creación manual SIN delivery_time debería quedar NULL (actual: %)', v_so_without.delivery_time;
  end if;

  raise notice 'TEST 3 OK: rpc_create_sales_order directo guarda delivery_time si viene, NULL si no viene — no rompe callers existentes.';
end $$;
reset role;

-- =========================================================================
-- TEST 4: rpc_update_sales_order NO borra delivery_time — una edición que
-- cambia otro campo (payment_terms) deja delivery_time intacto, porque el
-- UPDATE de rpc_update_sales_order nunca incluyó esa columna (preservado
-- por construcción, ver DISEÑO en 0092).
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_so_id uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000009230';
  v_so_after sales_orders;
  v_item_id uuid;
begin
  select value::uuid into v_so_id from test_scratch_92 where key = 'so_with_delivery_time_id';
  select id into v_item_id from sales_order_items where sales_order_id = v_so_id limit 1;

  select * into v_so_after from rpc_update_sales_order(
    v_so_id,
    -- payment_terms_type se mantiene 'custom' (el default con el que
    -- rpc_create_sales_order_from_quote creó esta Sales Order en TEST 1,
    -- ver DECISIÓN "payment_terms_type" en 0090) — cambiarlo a 'cash' aquí
    -- recalcularía payment_required_amount y dispararía
    -- trg_sales_order_financial_guard (0068), que exige autoridad
    -- financiera; ese guard es ortogonal a lo que este test valida.
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'payment_terms_type', 'custom', 'payment_terms', 'Contado editado'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-000000009280', 'quantity', 3, 'unit_price', 100, 'discount', 0, 'tax', 0))
  );

  if v_so_after.payment_terms is distinct from 'Contado editado' then
    raise exception 'TEST 4 FALLÓ (fixture): el update no aplicó el cambio esperado (payment_terms actual: %)', v_so_after.payment_terms;
  end if;
  if v_so_after.delivery_time is distinct from '3-4 Semanas' then
    raise exception 'TEST 4 FALLÓ: rpc_update_sales_order alteró delivery_time (actual: %, esperado: "3-4 Semanas")', v_so_after.delivery_time;
  end if;

  raise notice 'TEST 4 OK: rpc_update_sales_order preserva delivery_time intacto al editar otros campos.';
end $$;
reset role;

-- =========================================================================
-- TEST 5: delivery_time y requested_delivery_date son independientes —
-- fijar uno vía rpc_update_sales_order no afecta al otro, en ningún
-- sentido.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_so_id uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000009230';
  v_so_after sales_orders;
begin
  select value::uuid into v_so_id from test_scratch_92 where key = 'so_with_delivery_time_id';

  select * into v_so_after from rpc_update_sales_order(
    v_so_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'payment_terms_type', 'custom', 'requested_delivery_date', (current_date + 30)::text),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-000000009280', 'quantity', 3, 'unit_price', 100, 'discount', 0, 'tax', 0))
  );

  if v_so_after.requested_delivery_date is distinct from (current_date + 30) then
    raise exception 'TEST 5 FALLÓ: requested_delivery_date no se guardó (actual: %)', v_so_after.requested_delivery_date;
  end if;
  if v_so_after.delivery_time is distinct from '3-4 Semanas' then
    raise exception 'TEST 5 FALLÓ: fijar requested_delivery_date alteró delivery_time (actual: %)', v_so_after.delivery_time;
  end if;

  raise notice 'TEST 5 OK: delivery_time y requested_delivery_date son columnas independientes, ninguna pisa a la otra.';
end $$;
reset role;

-- =========================================================================
-- TEST 6: no rompe sales_orders existentes — la Sales Order creada en
-- TEST 3 SIN delivery_time (representa cualquier fila ya existente antes
-- de 0092, todas con la columna nueva en NULL por ADD COLUMN sin default)
-- sigue siendo legible/editable con normalidad después de la migración.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_so_id uuid;
  v_so sales_orders;
begin
  select value::uuid into v_so_id from test_scratch_92 where key = 'so_without_delivery_time_id';
  select * into v_so from sales_orders where id = v_so_id;

  if v_so.id is null then
    raise exception 'TEST 6 FALLÓ: la Sales Order previa a 0092 ya no es legible.';
  end if;
  if v_so.delivery_time is not null then
    raise exception 'TEST 6 FALLÓ: delivery_time debería seguir NULL en una fila sin origen de Quote (actual: %)', v_so.delivery_time;
  end if;

  raise notice 'TEST 6 OK: sales_orders sin delivery_time (equivalente a filas pre-0092) siguen legibles y con NULL, sin romperse.';
end $$;
reset role;

do $$ begin raise notice '=== 0092: 6/6 TESTS OK ==='; end $$;

rollback;
