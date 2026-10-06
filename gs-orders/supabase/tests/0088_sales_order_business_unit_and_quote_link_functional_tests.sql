-- THÖREN — Ticket A1 (0088_sales_order_business_unit_and_quote_link.sql):
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- (mismo criterio que 0083/0084/0085/0086/0087) — no depende de la cadena
-- de fixtures de fases anteriores. Todo el script corre en una transacción
-- que se revierte al final (rollback) — no deja rastro en la base.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` — todo id usado DENTRO de un bloque `do
-- $$` se resuelve como literal UUID fijo o vía variable plpgsql, nunca
-- `:'var'`.

begin;

\set admin_a '00000000-0000-0000-0000-000000008801'
\set vendedor_a '00000000-0000-0000-0000-000000008802'
\set org_a '00000000-0000-0000-0000-000000008810'
\set bu_a '00000000-0000-0000-0000-000000008820'
\set customer_a '00000000-0000-0000-0000-000000008830'
\set sp_a '00000000-0000-0000-0000-000000008840'
\set person_a '00000000-0000-0000-0000-000000008850'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-88a@test.local'),
  (:'vendedor_a', 'vendedor-88a@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 88 A', 'test-org-88-a');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 88', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true);

insert into business_units (id, organization_id, name, code) values
  (:'bu_a', :'org_a', 'BU Test 88 A', 'bu_test_88a');

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 88 A', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 88', 'VA88', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 88', 'vendedor', :'sp_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true);

insert into people (id, organization_id, name, active) values
  (:'person_a', :'org_a', 'Vendedor A Persona 88', true);
update salespeople set person_id = :'person_a' where id = :'sp_a';

insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_a', :'bu_a', 'QT88A');

-- Tabla temporal para pasar los ids de las Cotizaciones de fixture entre
-- bloques `do $$` (creada ANTES de cualquier bloque que pueda fallar, para
-- que un error dentro de un bloque posterior nunca la arrastre en su
-- rollback de subtransacción).
create temporary table test_scratch_88 (key text primary key, value text);
grant all on test_scratch_88 to authenticated;

set role authenticated;
select test_set_user(:'vendedor_a');

-- Dos Cotizaciones reales, vía rpc_create_quote (mismo RPC que usa la app),
-- para tener ids válidos de `quotes` que usar como source_quote_id en los
-- tests de abajo. No se aceptan ni convierten a nada — solo necesitamos
-- que existan como fila válida de `quotes`.
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008830';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008840';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008820';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LINEA LIBRE 88 QUOTE A', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0)
    )
  );
  insert into test_scratch_88 (key, value) values ('quote_a_id', v_quote.id::text);
end $$;

do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008830';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008840';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008820';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LINEA LIBRE 88 QUOTE B', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0)
    )
  );
  insert into test_scratch_88 (key, value) values ('quote_b_id', v_quote.id::text);
end $$;

reset role;

-- =========================================================================
-- TEST 0: migración aplicada correctamente — columnas, FKs e índice único
-- parcial existen con la forma esperada.
-- =========================================================================
do $$
declare
  v_bu_col_exists boolean;
  v_quote_col_exists boolean;
  v_unique_idx_def text;
begin
  select exists (
    select 1 from information_schema.columns
    where table_name = 'sales_orders' and column_name = 'business_unit_id' and is_nullable = 'YES'
  ) into v_bu_col_exists;
  if not v_bu_col_exists then
    raise exception 'TEST 0 FALLO: sales_orders.business_unit_id no existe o no es nullable.';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_name = 'sales_orders' and column_name = 'source_quote_id' and is_nullable = 'YES'
  ) into v_quote_col_exists;
  if not v_quote_col_exists then
    raise exception 'TEST 0 FALLO: sales_orders.source_quote_id no existe o no es nullable.';
  end if;

  select indexdef into v_unique_idx_def from pg_indexes
    where indexname = 'sales_orders_source_quote_id_unique';
  if v_unique_idx_def is null then
    raise exception 'TEST 0 FALLO: no existe el índice sales_orders_source_quote_id_unique.';
  end if;
  if v_unique_idx_def not ilike '%UNIQUE%' or v_unique_idx_def not ilike '%WHERE%source_quote_id IS NOT NULL%' then
    raise exception 'TEST 0 FALLO: sales_orders_source_quote_id_unique no es único/parcial como se esperaba (def: %)', v_unique_idx_def;
  end if;

  if not exists (select 1 from pg_indexes where indexname = 'sales_orders_business_unit_idx') then
    raise exception 'TEST 0 FALLO: no existe el índice sales_orders_business_unit_idx.';
  end if;

  raise notice 'TEST 0 OK: columnas e índices de 0088 existen con la forma esperada.';
end $$;

-- =========================================================================
-- TEST 1: sales_orders acepta business_unit_id válido.
-- =========================================================================
do $$
declare
  v_so_id uuid := gen_random_uuid();
  v_so sales_orders;
begin
  insert into sales_orders (id, organization_id, customer_id, salesperson_id, business_unit_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', '00000000-0000-0000-0000-000000008820', 'SO-TEST-88-1', 1, 'MXN', '00000000-0000-0000-0000-000000008801', true);

  select * into v_so from sales_orders where id = v_so_id;
  if v_so.business_unit_id is distinct from '00000000-0000-0000-0000-000000008820'::uuid then
    raise exception 'TEST 1 FALLO: business_unit_id no se guardó correctamente (actual: %)', v_so.business_unit_id;
  end if;

  raise notice 'TEST 1 OK: sales_orders acepta business_unit_id válido.';
end $$;

-- =========================================================================
-- TEST 2: rechaza business_unit_id inválido (fila inexistente en
-- business_units) — debe fallar específicamente por violación de FK
-- (23503), no por cualquier otro error.
-- =========================================================================
do $$
declare
  v_so_id uuid := gen_random_uuid();
begin
  begin
    insert into sales_orders (id, organization_id, customer_id, salesperson_id, business_unit_id, order_number, sequence_number, currency, created_by, is_test) values
      (v_so_id, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', '99999999-9999-9999-9999-999999999999', 'SO-TEST-88-2', 2, 'MXN', '00000000-0000-0000-0000-000000008801', true);
    raise exception 'TEST 2 FALLO: no debió permitir un business_unit_id que no existe en business_units.';
  exception
    when foreign_key_violation then
      raise notice 'TEST 2 OK: business_unit_id inválido rechazado por violación de FK (23503).';
    when others then
      if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
      raise exception 'TEST 2 FALLO: se esperaba foreign_key_violation, ocurrió otro error: % (%)', sqlerrm, sqlstate;
  end;
end $$;

-- =========================================================================
-- TEST 3: sales_orders acepta source_quote_id válido (apunta a una Quote
-- real existente).
-- =========================================================================
do $$
declare
  v_quote_a_id uuid;
  v_so_id uuid := gen_random_uuid();
  v_so sales_orders;
begin
  select value::uuid into v_quote_a_id from test_scratch_88 where key = 'quote_a_id';

  insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', v_quote_a_id, 'SO-TEST-88-3', 3, 'MXN', '00000000-0000-0000-0000-000000008801', true);

  select * into v_so from sales_orders where id = v_so_id;
  if v_so.source_quote_id is distinct from v_quote_a_id then
    raise exception 'TEST 3 FALLO: source_quote_id no se guardó correctamente (esperado: %, actual: %)', v_quote_a_id, v_so.source_quote_id;
  end if;

  raise notice 'TEST 3 OK: sales_orders acepta source_quote_id válido.';
end $$;

-- =========================================================================
-- TEST 4: rechaza source_quote_id inválido (fila inexistente en quotes) —
-- debe fallar específicamente por violación de FK (23503).
-- =========================================================================
do $$
declare
  v_so_id uuid := gen_random_uuid();
begin
  begin
    insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
      (v_so_id, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', '88888888-8888-8888-8888-888888888888', 'SO-TEST-88-4', 4, 'MXN', '00000000-0000-0000-0000-000000008801', true);
    raise exception 'TEST 4 FALLO: no debió permitir un source_quote_id que no existe en quotes.';
  exception
    when foreign_key_violation then
      raise notice 'TEST 4 OK: source_quote_id inválido rechazado por violación de FK (23503).';
    when others then
      if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
      raise exception 'TEST 4 FALLO: se esperaba foreign_key_violation, ocurrió otro error: % (%)', sqlerrm, sqlstate;
  end;
end $$;

-- =========================================================================
-- TEST 5: permite múltiples sales_orders con source_quote_id NULL (el
-- índice único parcial NUNCA debe aplicar a NULL — mismo comportamiento ya
-- probado en orders_source_quote_id_unique desde 0023).
-- =========================================================================
do $$
declare
  v_so_id_1 uuid := gen_random_uuid();
  v_so_id_2 uuid := gen_random_uuid();
begin
  insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id_1, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', null, 'SO-TEST-88-5A', 5, 'MXN', '00000000-0000-0000-0000-000000008801', true);
  insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id_2, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', null, 'SO-TEST-88-5B', 6, 'MXN', '00000000-0000-0000-0000-000000008801', true);

  if not exists (select 1 from sales_orders where id = v_so_id_1) or not exists (select 1 from sales_orders where id = v_so_id_2) then
    raise exception 'TEST 5 FALLO: ambos sales_orders con source_quote_id NULL debieron poder coexistir.';
  end if;

  raise notice 'TEST 5 OK: múltiples sales_orders con source_quote_id NULL coexisten sin conflicto.';
end $$;

-- =========================================================================
-- TEST 6: impide dos sales_orders con el mismo source_quote_id NO-null —
-- el índice único parcial sales_orders_source_quote_id_unique es la
-- protección real contra que una misma Cotización genere más de un
-- sales_order (misma razón de ser que orders_source_quote_id_unique).
-- =========================================================================
do $$
declare
  v_quote_b_id uuid;
  v_so_id_1 uuid := gen_random_uuid();
  v_so_id_2 uuid := gen_random_uuid();
begin
  select value::uuid into v_quote_b_id from test_scratch_88 where key = 'quote_b_id';

  insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id_1, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', v_quote_b_id, 'SO-TEST-88-6A', 7, 'MXN', '00000000-0000-0000-0000-000000008801', true);

  begin
    insert into sales_orders (id, organization_id, customer_id, salesperson_id, source_quote_id, order_number, sequence_number, currency, created_by, is_test) values
      (v_so_id_2, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', v_quote_b_id, 'SO-TEST-88-6B', 8, 'MXN', '00000000-0000-0000-0000-000000008801', true);
    raise exception 'TEST 6 FALLO: no debió permitir una segunda sales_order con el mismo source_quote_id no-null.';
  exception
    when unique_violation then
      raise notice 'TEST 6 OK: segunda sales_order con el mismo source_quote_id rechazada por violación de unicidad (23505).';
    when others then
      if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
      raise exception 'TEST 6 FALLO: se esperaba unique_violation, ocurrió otro error: % (%)', sqlerrm, sqlstate;
  end;
end $$;

-- =========================================================================
-- TEST 7: compatibilidad con los 3 sales_orders ya existentes en
-- producción — un INSERT que omite business_unit_id/source_quote_id por
-- completo (exactamente el mismo shape de columnas que se usaba ANTES de
-- esta migración, ver 0082_purchase_order_delete_functional_tests.sql)
-- debe seguir funcionando igual, con ambas columnas nuevas resolviendo a
-- NULL automáticamente.
-- =========================================================================
do $$
declare
  v_so_id uuid := gen_random_uuid();
  v_so sales_orders;
begin
  insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id, '00000000-0000-0000-0000-000000008810', '00000000-0000-0000-0000-000000008830', '00000000-0000-0000-0000-000000008840', 'SO-TEST-88-7', 9, 'MXN', '00000000-0000-0000-0000-000000008801', true);

  select * into v_so from sales_orders where id = v_so_id;
  if v_so.business_unit_id is not null or v_so.source_quote_id is not null then
    raise exception 'TEST 7 FALLO: un INSERT que no informa las columnas nuevas debió dejarlas en NULL (business_unit_id=%, source_quote_id=%)', v_so.business_unit_id, v_so.source_quote_id;
  end if;

  raise notice 'TEST 7 OK: shape de INSERT previo a 0088 sigue funcionando igual, ambas columnas nuevas quedan NULL (equivalente a los 3 sales_orders reales existentes).';
end $$;

do $$ begin raise notice '=== 0088: 8/8 TESTS OK (TEST 0 a TEST 7) ==='; end $$;

reset role;
rollback;
