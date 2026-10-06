-- THÖREN — Ticket B1 (0090_sales_order_from_quote.sql):
-- rpc_create_sales_order_from_quote — pruebas funcionales contra Postgres
-- real. Fixtures 100% autocontenidas, transacción con rollback final — no
-- deja rastro en la base.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` — todo id usado DENTRO de un bloque `do
-- $$` se resuelve como literal UUID fijo o vía variable plpgsql.

begin;

\set admin_a '00000000-0000-0000-0000-000000009001'
\set vendedor_a '00000000-0000-0000-0000-000000009002'
\set vendedor_b '00000000-0000-0000-0000-000000009003'
\set org_a '00000000-0000-0000-0000-000000009010'
\set org_b '00000000-0000-0000-0000-000000009011'
\set bu_a '00000000-0000-0000-0000-000000009020'
\set customer_a '00000000-0000-0000-0000-000000009030'
\set customer_b '00000000-0000-0000-0000-000000009031'
\set sp_a '00000000-0000-0000-0000-000000009040'
\set sp_b '00000000-0000-0000-0000-000000009041'
\set person_a '00000000-0000-0000-0000-000000009050'
\set person_b '00000000-0000-0000-0000-000000009051'
\set catalog_product_a '00000000-0000-0000-0000-000000009080'
\set catalog_product_bad '00000000-0000-0000-0000-000000009081'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-90a@test.local'),
  (:'vendedor_a', 'vendedor-90a@test.local'),
  (:'vendedor_b', 'vendedor-90b@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 90 A', 'test-org-90-a'),
  (:'org_b', 'Test Org 90 B', 'test-org-90-b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 90', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true);

insert into business_units (id, organization_id, name, code) values
  (:'bu_a', :'org_a', 'BU Test 90 A', 'bu_test_90a');

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 90 A', true),
  (:'customer_b', :'org_b', 'Cliente Test 90 B', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 90', 'VA90', true),
  (:'sp_b', :'org_b', 'Vendedor B 90', 'VB90', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 90', 'vendedor', :'sp_a', true),
  (:'vendedor_b', 'Vendedor B Test 90', 'vendedor', :'sp_b', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true),
  (:'org_b', :'vendedor_b', 'vendedor', true);

insert into people (id, organization_id, name, active) values
  (:'person_a', :'org_a', 'Vendedor A Persona 90', true),
  (:'person_b', :'org_b', 'Vendedor B Persona 90', true);
update salespeople set person_id = :'person_a' where id = :'sp_a';
update salespeople set person_id = :'person_b' where id = :'sp_b';

insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_a', :'bu_a', 'QT90A');

insert into product_catalog (id, organization_id, sku, name, unit, active) values
  (:'catalog_product_a', :'org_a', 'TEST-90-A', 'Producto Test 90 A', 'pza', true),
  (:'catalog_product_bad', :'org_a', 'TEST-90-BAD', 'Producto Test 90 BAD (para TEST 6)', 'pza', true);

create temporary table test_scratch_90 (key text primary key, value text);
grant all on test_scratch_90 to authenticated;

-- =========================================================================
-- Fixture: Quote aceptada normal (2 partidas: catálogo + libre, ambas con
-- customer_requirements) — usada por la mayoría de los tests.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_catalog_a uuid := '00000000-0000-0000-0000-000000009080';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text, 'payment_terms', '30 días', 'customer_notes', 'Entregar en horario de oficina', 'notes', 'Nota interna 90'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_catalog_a, 'model', 'TEST-90-A', 'quantity', 2, 'unit_price', 100, 'line_discount_percent', 10, 'customer_requirements', '<p>Entregar <strong>rotulado</strong></p>', 'customer_requirements_visible_in_pdf', false),
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90', 'quantity', 1, 'unit_price', 50, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;
  insert into test_scratch_90 (key, value) values ('quote_main_id', v_quote.id::text);
end $$;
reset role;

-- =========================================================================
-- TEST 1: Quote aceptada -> sales_order correcto (header), items copiados
-- correctamente, business_unit_id copiada, source_quote_id copiada,
-- customer_requirements copiadas.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_quote_id uuid;
  v_so sales_orders;
  v_item_cat sales_order_items;
  v_item_libre sales_order_items;
  v_item_count integer;
begin
  select value::uuid into v_quote_id from test_scratch_90 where key = 'quote_main_id';

  select * into v_so from rpc_create_sales_order_from_quote(v_quote_id);
  insert into test_scratch_90 (key, value) values ('so_main_id', v_so.id::text);

  if v_so.customer_id is distinct from '00000000-0000-0000-0000-000000009030'::uuid then
    raise exception 'TEST 1 FALLÓ: customer_id no coincide (actual: %)', v_so.customer_id;
  end if;
  if v_so.salesperson_id is distinct from '00000000-0000-0000-0000-000000009040'::uuid then
    raise exception 'TEST 1 FALLÓ: salesperson_id no coincide (actual: %)', v_so.salesperson_id;
  end if;
  if v_so.business_unit_id is distinct from '00000000-0000-0000-0000-000000009020'::uuid then
    raise exception 'TEST 1 FALLÓ: business_unit_id no se copió (actual: %)', v_so.business_unit_id;
  end if;
  if v_so.source_quote_id is distinct from v_quote_id then
    raise exception 'TEST 1 FALLÓ: source_quote_id no se copió (actual: %)', v_so.source_quote_id;
  end if;
  if v_so.currency <> 'MXN' then
    raise exception 'TEST 1 FALLÓ: currency no coincide (actual: %)', v_so.currency;
  end if;
  if v_so.payment_terms <> '30 días' then
    raise exception 'TEST 1 FALLÓ: payment_terms no se copió (actual: %)', v_so.payment_terms;
  end if;
  if v_so.commercial_notes <> 'Entregar en horario de oficina' then
    raise exception 'TEST 1 FALLÓ: commercial_notes (<- quote.customer_notes) no se copió (actual: %)', v_so.commercial_notes;
  end if;
  if v_so.internal_notes <> 'Nota interna 90' then
    raise exception 'TEST 1 FALLÓ: internal_notes (<- quote.notes) no se copió (actual: %)', v_so.internal_notes;
  end if;
  if v_so.status <> 'draft' then
    raise exception 'TEST 1 FALLÓ: la Sales Order nueva debió quedar en draft (actual: %)', v_so.status;
  end if;

  select count(*) into v_item_count from sales_order_items where sales_order_id = v_so.id;
  if v_item_count <> 2 then
    raise exception 'TEST 1 FALLÓ: se esperaban 2 partidas copiadas, hubo %', v_item_count;
  end if;

  select * into v_item_cat from sales_order_items where sales_order_id = v_so.id and sku_snapshot = 'TEST-90-A';
  if v_item_cat.catalog_product_id is distinct from '00000000-0000-0000-0000-000000009080'::uuid then
    raise exception 'TEST 1 FALLÓ: catalog_product_id de la línea de catálogo no coincide.';
  end if;
  if v_item_cat.quantity <> 2 or v_item_cat.unit_price <> 100 or v_item_cat.discount <> 10 then
    raise exception 'TEST 1 FALLÓ: cantidad/precio/descuento de la línea de catálogo no coinciden (qty=%, price=%, discount=%)', v_item_cat.quantity, v_item_cat.unit_price, v_item_cat.discount;
  end if;
  if v_item_cat.tax <> 16 then
    raise exception 'TEST 1 FALLÓ: tax de la línea debió copiarse desde quote.tax_rate (16), actual: %', v_item_cat.tax;
  end if;
  if v_item_cat.customer_requirements is distinct from '<p>Entregar <strong>rotulado</strong></p>' then
    raise exception 'TEST 1 FALLÓ: customer_requirements de la línea de catálogo no se copió (actual: %)', v_item_cat.customer_requirements;
  end if;
  if v_item_cat.customer_requirements_visible_in_pdf <> false then
    raise exception 'TEST 1 FALLÓ: customer_requirements_visible_in_pdf debió copiarse en false (actual: %)', v_item_cat.customer_requirements_visible_in_pdf;
  end if;

  select * into v_item_libre from sales_order_items where sales_order_id = v_so.id and sku_snapshot = 'LIBRE-90';
  if v_item_libre.catalog_product_id is not null then
    raise exception 'TEST 1 FALLÓ: la línea libre no debió tener catalog_product_id.';
  end if;
  if v_item_libre.quantity <> 1 or v_item_libre.unit_price <> 50 then
    raise exception 'TEST 1 FALLÓ: cantidad/precio de la línea libre no coinciden.';
  end if;

  raise notice 'TEST 1 OK: Quote aceptada -> sales_order correcto, items/business_unit/source_quote_id/customer_requirements copiados.';
end $$;
reset role;

-- =========================================================================
-- TEST 2: segunda conversión de la MISMA quote rechazada (idempotencia).
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_quote_id uuid;
  v_so_count_before integer;
  v_so_count_after integer;
begin
  select value::uuid into v_quote_id from test_scratch_90 where key = 'quote_main_id';
  select count(*) into v_so_count_before from sales_orders;

  begin
    perform rpc_create_sales_order_from_quote(v_quote_id);
    raise exception 'TEST 2 FALLÓ: una segunda conversión de la misma cotización NO debió permitirse.';
  exception
    when others then
      if sqlerrm like 'TEST 2 FALLÓ%' then raise; end if;
      if sqlerrm not like '%ya fue convertida a una Sales Order%' then
        raise exception 'TEST 2 FALLÓ: se esperaba el mensaje de idempotencia, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  select count(*) into v_so_count_after from sales_orders;
  if v_so_count_after <> v_so_count_before then
    raise exception 'TEST 2 FALLÓ: el rechazo debió ser atómico, no debió crearse ninguna sales_order adicional.';
  end if;

  raise notice 'TEST 2 OK: segunda conversión de la misma cotización rechazada (idempotencia + mensaje claro).';
end $$;
reset role;

-- =========================================================================
-- TEST 3: quote que YA tiene un order legado rechazada (anti-pipeline-doble).
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_quote quotes;
  v_order orders;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90-LEGACY', 'quantity', 1, 'unit_price', 10, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  select * into v_order from rpc_create_order_from_quote(v_quote.id, 'otro', current_date);

  begin
    perform rpc_create_sales_order_from_quote(v_quote.id);
    raise exception 'TEST 3 FALLÓ: una cotización que ya generó un order legado NO debió poder convertirse también a sales_order.';
  exception
    when others then
      if sqlerrm like 'TEST 3 FALLÓ%' then raise; end if;
      if sqlerrm not like '%pipeline histórico%' then
        raise exception 'TEST 3 FALLÓ: se esperaba el mensaje de conflicto de pipeline doble, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  if exists (select 1 from sales_orders where source_quote_id = v_quote.id) then
    raise exception 'TEST 3 FALLÓ: no debió crearse ninguna sales_order para una cotización con order legado.';
  end if;

  raise notice 'TEST 3 OK: cotización con order legado rechazada con el conflicto explícito, sin crear sales_order.';
end $$;
reset role;

-- =========================================================================
-- TEST 4: quote NO aceptada (borrador) rechazada.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90-BORRADOR', 'quantity', 1, 'unit_price', 10, 'line_discount_percent', 0)
    )
  );
  -- Queda en 'borrador' (default), nunca se envía ni se acepta.

  begin
    perform rpc_create_sales_order_from_quote(v_quote.id);
    raise exception 'TEST 4 FALLÓ: una cotización en borrador NO debió poder convertirse.';
  exception
    when others then
      if sqlerrm like 'TEST 4 FALLÓ%' then raise; end if;
      if sqlerrm not like '%cotización aceptada%' then
        raise exception 'TEST 4 FALLÓ: se esperaba el mensaje de status, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  raise notice 'TEST 4 OK: cotización no aceptada (borrador) rechazada.';
end $$;
reset role;

-- =========================================================================
-- TEST 5: cross-organization rechazado — un vendedor de la Org B no puede
-- convertir una cotización de la Org A (ni siquiera la ENCUENTRA, por RLS).
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_b');
do $$
declare
  v_quote_main_id uuid;
begin
  select value::uuid into v_quote_main_id from test_scratch_90 where key = 'quote_main_id';

  begin
    perform rpc_create_sales_order_from_quote(v_quote_main_id);
    raise exception 'TEST 5 FALLÓ: un vendedor de otra organización NO debió poder convertir esta cotización.';
  exception
    when others then
      if sqlerrm like 'TEST 5 FALLÓ%' then raise; end if;
      if sqlerrm not like '%Cotización no encontrada o sin acceso%' then
        raise exception 'TEST 5 FALLÓ: se esperaba el mensaje de no encontrada/sin acceso (RLS), ocurrió otro error: %', sqlerrm;
      end if;
  end;

  raise notice 'TEST 5 OK: cross-organization rechazado — la cotización de otra organización es invisible por RLS.';
end $$;
reset role;

-- =========================================================================
-- TEST 6: rollback completo si falla una partida — una Quote con 2
-- líneas (una libre válida + una de catálogo) donde el producto de
-- catálogo de la segunda línea deja de pertenecer a la organización justo
-- antes de la conversión (forzado como superusuario — mover un producto de
-- organización no viola ningún CHECK, a diferencia de un precio negativo,
-- que quote_items ya rechaza en su propio esquema). rpc_create_sales_order
-- debe rechazar esa partida en su loop de validación cross-org, ANTES de
-- insertar nada, y no debe dejar ninguna sales_order/sales_order_item
-- huérfana.
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_catalog_bad uuid := '00000000-0000-0000-0000-000000009081';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90-OK', 'quantity', 1, 'unit_price', 10, 'line_discount_percent', 0),
      jsonb_build_object('catalog_product_id', v_catalog_bad, 'model', 'TEST-90-BAD', 'quantity', 1, 'unit_price', 1, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;
  insert into test_scratch_90 (key, value) values ('quote_bad_item_id', v_quote.id::text);
end $$;
reset role;

-- Mueve el producto de catálogo de la segunda línea a OTRA organización,
-- como superusuario (bypass de RLS a propósito) — simula una partida que
-- se vuelve inválida (producto ya no pertenece a la organización) entre la
-- creación de la Quote y su conversión, sin violar ningún CHECK de
-- quote_items.
update product_catalog set organization_id = '00000000-0000-0000-0000-000000009011'
  where id = '00000000-0000-0000-0000-000000009081';

set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_quote_id uuid;
  v_so_count_before integer;
  v_so_item_count_before integer;
  v_so_count_after integer;
  v_so_item_count_after integer;
begin
  select value::uuid into v_quote_id from test_scratch_90 where key = 'quote_bad_item_id';

  select count(*) into v_so_count_before from sales_orders;
  select count(*) into v_so_item_count_before from sales_order_items;

  begin
    perform rpc_create_sales_order_from_quote(v_quote_id);
    raise exception 'TEST 6 FALLÓ: una cotización con una partida cuyo producto ya no pertenece a la organización NO debió poder convertirse.';
  exception
    when others then
      if sqlerrm like 'TEST 6 FALLÓ%' then raise; end if;
      -- El producto movido a otra organización deja de ser visible bajo
      -- RLS para el vendedor convirtiendo la cotización — rpc_create_sales_order
      -- lo reporta como "no encontrado" (nunca llega a comparar
      -- organization_id, porque la fila ya es invisible antes de eso).
      if sqlerrm not like '%producto de catálogo%no encontrado%' then
        raise exception 'TEST 6 FALLÓ: se esperaba el rechazo del producto ya no visible/perteneciente a la organización, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  select count(*) into v_so_count_after from sales_orders;
  select count(*) into v_so_item_count_after from sales_order_items;

  if v_so_count_after <> v_so_count_before or v_so_item_count_after <> v_so_item_count_before then
    raise exception 'TEST 6 FALLÓ: el rechazo de una partida inválida debió ser atómico (sales_orders antes=%, después=%; items antes=%, después=%)',
      v_so_count_before, v_so_count_after, v_so_item_count_before, v_so_item_count_after;
  end if;

  if exists (select 1 from sales_orders where source_quote_id = v_quote_id) then
    raise exception 'TEST 6 FALLÓ: no debió quedar ninguna sales_order asociada a la cotización con la partida inválida.';
  end if;

  raise notice 'TEST 6 OK: rollback completo — ninguna sales_order/sales_order_item huérfana cuando una partida es inválida.';
end $$;
reset role;

-- =========================================================================
-- TEST 7: descuento global de la Quote bloquea la conversión explícitamente
-- (en vez de perderlo en silencio).
-- =========================================================================
set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 5, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90-GD', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  begin
    perform rpc_create_sales_order_from_quote(v_quote.id);
    raise exception 'TEST 7 FALLÓ: una cotización con descuento global NO debió poder convertirse automáticamente.';
  exception
    when others then
      if sqlerrm like 'TEST 7 FALLÓ%' then raise; end if;
      if sqlerrm not like '%descuento global%' then
        raise exception 'TEST 7 FALLÓ: se esperaba el mensaje de bloqueo por descuento global, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  raise notice 'TEST 7 OK: descuento global bloquea la conversión explícitamente, en vez de perderlo en silencio.';
end $$;
reset role;

-- =========================================================================
-- TEST 8: custom fields por partida se copian cuando existe una definición
-- de 'sales_order_item' con el MISMO key que la de 'quote_item' de origen.
-- =========================================================================
reset role;
do $$
declare
  v_def_quote_item_id uuid := gen_random_uuid();
  v_def_so_item_id uuid := gen_random_uuid();
begin
  insert into custom_field_definitions (id, organization_id, entity_type, key, label, field_type) values
    (v_def_quote_item_id, '00000000-0000-0000-0000-000000009010', 'quote_item', 'color_etiqueta_90', 'Color de etiqueta', 'text'),
    (v_def_so_item_id, '00000000-0000-0000-0000-000000009010', 'sales_order_item', 'color_etiqueta_90', 'Color de etiqueta', 'text');
  insert into test_scratch_90 (key, value) values
    ('def_quote_item_id', v_def_quote_item_id::text),
    ('def_so_item_id', v_def_so_item_id::text);
end $$;

set role authenticated;
select test_set_user(:'vendedor_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000009030';
  v_sp_a uuid := '00000000-0000-0000-0000-000000009040';
  v_bu_a uuid := '00000000-0000-0000-0000-000000009020';
  v_def_quote_item_id uuid;
  v_def_so_item_id uuid;
  v_quote quotes;
  v_quote_item_id uuid;
  v_so sales_orders;
  v_so_item_id uuid;
  v_copied_value text;
begin
  select value::uuid into v_def_quote_item_id from test_scratch_90 where key = 'def_quote_item_id';
  select value::uuid into v_def_so_item_id from test_scratch_90 where key = 'def_so_item_id';

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'LIBRE-90-CF', 'quantity', 1, 'unit_price', 10, 'line_discount_percent', 0)
    )
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  select id into v_quote_item_id from quote_items where quote_id = v_quote.id limit 1;
  insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_text) values
    ('00000000-0000-0000-0000-000000009010', v_def_quote_item_id, 'quote_item', v_quote_item_id, 'Rojo 90');

  select * into v_so from rpc_create_sales_order_from_quote(v_quote.id);
  select id into v_so_item_id from sales_order_items where sales_order_id = v_so.id limit 1;

  select value_text into v_copied_value from custom_field_values
    where entity_type = 'sales_order_item' and entity_id = v_so_item_id and definition_id = v_def_so_item_id;

  if v_copied_value is distinct from 'Rojo 90' then
    raise exception 'TEST 8 FALLÓ: el custom field de quote_item no se copió a sales_order_item (actual: %)', v_copied_value;
  end if;

  raise notice 'TEST 8 OK: custom field por partida copiado de quote_item a sales_order_item (mismo key, mismo scope).';
end $$;
reset role;

do $$ begin raise notice '=== 0090: 8/8 TESTS OK ==='; end $$;

rollback;
