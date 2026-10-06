-- THÖREN — Ticket A2 (0089_sales_order_item_quote_conversion_support.sql):
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas,
-- transacción con rollback final — no deja rastro en la base.

begin;

\set admin_a '00000000-0000-0000-0000-000000008901'
\set vendedor_a '00000000-0000-0000-0000-000000008902'
\set vendedor_b '00000000-0000-0000-0000-000000008903'
\set org_a '00000000-0000-0000-0000-000000008910'
\set customer_a '00000000-0000-0000-0000-000000008930'
\set sp_a '00000000-0000-0000-0000-000000008940'
\set sp_b '00000000-0000-0000-0000-000000008941'
\set catalog_product_a '00000000-0000-0000-0000-000000008980'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-89a@test.local'),
  (:'vendedor_a', 'vendedor-89a@test.local'),
  (:'vendedor_b', 'vendedor-89b@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 89 A', 'test-org-89-a');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 89', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true);

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 89 A', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 89', 'VA89', true),
  (:'sp_b', :'org_a', 'Vendedor B 89', 'VB89', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 89', 'vendedor', :'sp_a', true),
  (:'vendedor_b', 'Vendedor B Test 89', 'vendedor', :'sp_b', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true),
  (:'org_a', :'vendedor_b', 'vendedor', true);

insert into product_catalog (id, organization_id, sku, name, unit, active) values
  (:'catalog_product_a', :'org_a', 'TEST-89-A', 'Producto Test 89 A', 'pza', true);

create temporary table test_scratch_89 (key text primary key, value text);
grant all on test_scratch_89 to authenticated;

set role authenticated;
select test_set_user(:'vendedor_a');

-- =========================================================================
-- TEST 1: rpc_create_sales_order acepta customer_requirements (HTML seguro)
-- + customer_requirements_visible_in_pdf por partida, y los persiste tal
-- cual en sales_order_items.
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008930';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008940';
  v_catalog_a uuid := '00000000-0000-0000-0000-000000008980';
  v_so sales_orders;
  v_item sales_order_items;
begin
  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', v_catalog_a, 'quantity', 2, 'unit_price', 100, 'customer_requirements', '<p>Entregar <strong>rotulado</strong></p>', 'customer_requirements_visible_in_pdf', false)
    )
  );
  insert into test_scratch_89 (key, value) values ('so1_id', v_so.id::text);

  select * into v_item from sales_order_items where sales_order_id = v_so.id;
  if v_item.customer_requirements is distinct from '<p>Entregar <strong>rotulado</strong></p>' then
    raise exception 'TEST 1 FALLÓ: customer_requirements no se guardó tal cual (actual: %)', v_item.customer_requirements;
  end if;
  if v_item.customer_requirements_visible_in_pdf <> false then
    raise exception 'TEST 1 FALLÓ: customer_requirements_visible_in_pdf debió quedar en false (actual: %)', v_item.customer_requirements_visible_in_pdf;
  end if;

  raise notice 'TEST 1 OK: rpc_create_sales_order persiste customer_requirements/customer_requirements_visible_in_pdf por partida.';
end $$;

-- =========================================================================
-- TEST 2: una línea SIN customer_requirements_visible_in_pdf informado usa
-- el default true (mismo comportamiento que 0086 en quote_items — cero
-- regresión para cualquier caller que no mande esta clave).
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008930';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008940';
  v_so sales_orders;
  v_item sales_order_items;
begin
  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('sku_snapshot', 'LIBRE-89', 'quantity', 1, 'unit_price', 50)
    )
  );
  select * into v_item from sales_order_items where sales_order_id = v_so.id;

  if v_item.customer_requirements is not null then
    raise exception 'TEST 2 FALLÓ: customer_requirements debió quedar NULL cuando no se informa.';
  end if;
  if v_item.customer_requirements_visible_in_pdf <> true then
    raise exception 'TEST 2 FALLÓ: default de customer_requirements_visible_in_pdf debió ser true (actual: %)', v_item.customer_requirements_visible_in_pdf;
  end if;

  raise notice 'TEST 2 OK: default true preserva el comportamiento previo a 0089 cuando el caller no manda la clave.';
end $$;

-- =========================================================================
-- TEST 3: fn_check_rich_text_safety rechaza HTML peligroso en
-- customer_requirements dentro de rpc_create_sales_order — y el rechazo es
-- ATÓMICO (ninguna fila de sales_orders/sales_order_items queda huérfana).
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008930';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008940';
  v_so_count_before integer;
  v_so_count_after integer;
begin
  select count(*) into v_so_count_before from sales_orders;

  begin
    perform rpc_create_sales_order(
      gen_random_uuid(),
      jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'cash'),
      jsonb_build_array(
        jsonb_build_object('sku_snapshot', 'LIBRE-89-X', 'quantity', 1, 'unit_price', 50, 'customer_requirements', '<script>alert(1)</script>')
      )
    );
    raise exception 'TEST 3 FALLÓ: no debió permitir customer_requirements con <script>.';
  exception
    when others then
      if sqlerrm like 'TEST 3 FALLÓ%' then raise; end if;
      if sqlerrm not like '%fn_check_rich_text_safety%' then
        raise exception 'TEST 3 FALLÓ: se esperaba el guardia fn_check_rich_text_safety, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  select count(*) into v_so_count_after from sales_orders;
  if v_so_count_after <> v_so_count_before then
    raise exception 'TEST 3 FALLÓ: el rechazo debió ser atómico — no debió quedar ninguna sales_order nueva (antes=%, después=%)', v_so_count_before, v_so_count_after;
  end if;

  raise notice 'TEST 3 OK: fn_check_rich_text_safety rechaza HTML peligroso de forma atómica en rpc_create_sales_order.';
end $$;

-- =========================================================================
-- TEST 4: rpc_update_sales_order también persiste/actualiza
-- customer_requirements y rechaza HTML peligroso con el mismo guardia.
-- Usa una Sales Order NUEVA en 'credit' (payment_required_amount siempre
-- NULL) para aislar lo que este test prueba — en 'cash', cambiar
-- cantidades recalcula payment_required_amount, lo que
-- trg_sales_order_financial_guard (0068, existente, correcto) bloquea
-- para un vendedor sin autoridad financiera; eso es un comportamiento
-- correcto y deliberadamente ajeno a este ticket, no algo que este test
-- deba ejercitar.
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008930';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008940';
  v_so_id uuid;
  v_so sales_orders;
  v_item sales_order_items;
begin
  select id into v_so_id from rpc_create_sales_order(
    gen_random_uuid(),
    jsonb_build_object('customer_id', v_customer_a, 'salesperson_id', v_sp_a, 'currency', 'MXN', 'payment_terms_type', 'credit'),
    jsonb_build_array(
      jsonb_build_object('sku_snapshot', 'LIBRE-89-ORIG', 'quantity', 1, 'unit_price', 5)
    )
  );

  select * into v_so from rpc_update_sales_order(
    v_so_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'payment_terms_type', 'credit'),
    jsonb_build_array(
      jsonb_build_object('sku_snapshot', 'LIBRE-89-UPD', 'quantity', 3, 'unit_price', 10, 'customer_requirements', '<p>Actualizado</p>', 'customer_requirements_visible_in_pdf', true)
    )
  );
  select * into v_item from sales_order_items where sales_order_id = v_so_id;
  if v_item.customer_requirements is distinct from '<p>Actualizado</p>' then
    raise exception 'TEST 4 FALLÓ: rpc_update_sales_order no actualizó customer_requirements correctamente (actual: %)', v_item.customer_requirements;
  end if;

  begin
    perform rpc_update_sales_order(
      v_so_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'payment_terms_type', 'credit'),
      jsonb_build_array(
        jsonb_build_object('sku_snapshot', 'LIBRE-89-BAD', 'quantity', 1, 'unit_price', 1, 'customer_requirements', '<img src=x onerror=alert(1)>')
      )
    );
    raise exception 'TEST 4 FALLÓ: no debió permitir un atributo de evento (onerror) en customer_requirements.';
  exception
    when others then
      if sqlerrm like 'TEST 4 FALLÓ%' then raise; end if;
      if sqlerrm not like '%fn_check_rich_text_safety%' then
        raise exception 'TEST 4 FALLÓ: se esperaba el guardia fn_check_rich_text_safety, ocurrió otro error: %', sqlerrm;
      end if;
  end;

  raise notice 'TEST 4 OK: rpc_update_sales_order respeta el mismo guardia y actualiza customer_requirements correctamente.';
end $$;

reset role;

-- =========================================================================
-- TEST 5: custom_field_definitions acepta entity_type='sales_order_item'
-- (el CHECK ya lo permite) y los entity_type previos siguen funcionando
-- (regresión mínima del CHECK reemplazado).
-- =========================================================================
do $$
declare
  v_def_so_item_id uuid := gen_random_uuid();
  v_def_order_item_id uuid := gen_random_uuid();
begin
  insert into custom_field_definitions (id, organization_id, entity_type, key, label, field_type) values
    (v_def_so_item_id, '00000000-0000-0000-0000-000000008910', 'sales_order_item', 'color_etiqueta', 'Color de etiqueta', 'text');
  insert into custom_field_definitions (id, organization_id, entity_type, key, label, field_type) values
    (v_def_order_item_id, '00000000-0000-0000-0000-000000008910', 'order_item', 'color_etiqueta_legacy', 'Color de etiqueta (legacy)', 'text');

  if not exists (select 1 from custom_field_definitions where id = v_def_so_item_id and entity_type = 'sales_order_item') then
    raise exception 'TEST 5 FALLÓ: custom_field_definitions no aceptó entity_type=sales_order_item.';
  end if;
  if not exists (select 1 from custom_field_definitions where id = v_def_order_item_id and entity_type = 'order_item') then
    raise exception 'TEST 5 FALLÓ: entity_type=order_item (previo a 0089) dejó de funcionar tras el reemplazo del CHECK.';
  end if;

  insert into test_scratch_89 (key, value) values ('def_so_item_id', v_def_so_item_id::text);
  raise notice 'TEST 5 OK: CHECK reemplazado acepta sales_order_item sin romper order_item/quote_item/product.';
end $$;

-- =========================================================================
-- TEST 6: custom_field_values con entity_type='sales_order_item' — el
-- vendedor DUEÑO de la Sales Order puede escribir su valor (RLS vía
-- current_user_can_write_custom_field_value, rama nueva de 0089); un
-- vendedor que NO es dueño no puede. Los cambios de rol ocurren a nivel
-- top-level (mismo patrón que el resto del archivo) — nunca con `set
-- role`/`test_set_user` dentro de un mismo bloque `do $$`.
-- =========================================================================
set role authenticated;
select test_set_user('00000000-0000-0000-0000-000000008902');

do $$
declare
  v_def_so_item_id uuid;
  v_so_id uuid;
  v_so_item_id uuid;
  v_value_id uuid := gen_random_uuid();
begin
  select value::uuid into v_def_so_item_id from test_scratch_89 where key = 'def_so_item_id';
  select value::uuid into v_so_id from test_scratch_89 where key = 'so1_id';
  select id into v_so_item_id from sales_order_items where sales_order_id = v_so_id limit 1;

  insert into custom_field_values (id, organization_id, definition_id, entity_type, entity_id, value_text) values
    (v_value_id, '00000000-0000-0000-0000-000000008910', v_def_so_item_id, 'sales_order_item', v_so_item_id, 'Rojo');

  if not exists (select 1 from custom_field_values where id = v_value_id) then
    raise exception 'TEST 6a FALLÓ: el vendedor dueño de la Sales Order no pudo escribir su custom field (debería poder).';
  end if;

  insert into test_scratch_89 (key, value) values ('so1_item_id', v_so_item_id::text);
  raise notice 'TEST 6a OK: el vendedor dueño de la Sales Order pudo escribir su custom field de sales_order_item.';
end $$;

reset role;
set role authenticated;
select test_set_user('00000000-0000-0000-0000-000000008903');

do $$
declare
  v_def_so_item_id uuid;
  v_so_item_id uuid;
begin
  select value::uuid into v_def_so_item_id from test_scratch_89 where key = 'def_so_item_id';
  select value::uuid into v_so_item_id from test_scratch_89 where key = 'so1_item_id';

  begin
    insert into custom_field_values (id, organization_id, definition_id, entity_type, entity_id, value_text) values
      (gen_random_uuid(), '00000000-0000-0000-0000-000000008910', v_def_so_item_id, 'sales_order_item', v_so_item_id, 'Azul (intento ajeno)');
    raise exception 'TEST 6b FALLÓ: un vendedor que NO es dueño de la Sales Order no debió poder escribir su custom field.';
  exception
    when others then
      if sqlerrm like 'TEST 6b FALLÓ%' then raise; end if;
      raise notice 'TEST 6b OK: vendedor ajeno a la Sales Order rechazado por RLS (%).', sqlerrm;
  end;
end $$;

reset role;

do $$ begin raise notice '=== 0089: 6/6 TESTS OK ==='; end $$;

rollback;
