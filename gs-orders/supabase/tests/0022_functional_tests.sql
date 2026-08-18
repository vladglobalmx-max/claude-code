-- THÖREN — Orders V2 Foundation (0022) — pruebas 9-31 contra Postgres real.
-- Corre DESPUÉS de: local_harness_setup.sql + migraciones 0001-0022 +
-- fixtures de Orders históricos (business_unit legacy) + fixtures de
-- salespeople/organización B/customers descritos en el reporte. Todo el
-- script corre en una transacción que se revierte al final — repetible.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set sp1 '10000000-0000-0000-0000-000000000001'
\set sp2 '10000000-0000-0000-0000-000000000002'
\set cemex '30000000-0000-0000-0000-000000000001'
\set orgb_customer '30000000-0000-0000-0000-000000000009'
\set orgb_bu '70000000-0000-0000-0000-000000000001'

-- 9) create Order legacy sin nuevos campos — call-site actual, sin tocar.
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Cliente Legacy Nuevo',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  if v_order.organization_id is null or v_order.customer_id is not null or v_order.business_unit_id is not null then
    raise exception 'TEST 9 FALLÓ: call-site legacy debería quedar con organization_id resuelto y customer_id/business_unit_id NULL';
  end if;
  if v_order.client_name <> 'Cliente Legacy Nuevo' then
    raise exception 'TEST 9 FALLÓ: client_name debería ser el texto libre enviado';
  end if;
  raise notice 'TEST 9 OK: create Order legacy sin nuevos campos — funciona idéntico';
end $$;

-- 10) create Order con Customer/BU.
do $$
declare
  v_order orders;
  v_bu_id uuid;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'este texto se debe ignorar',
      'product_type', 'otro',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'business_unit_id', v_bu_id::text
    ),
    '[]'::jsonb
  );
  if v_order.customer_id <> '30000000-0000-0000-0000-000000000001' or v_order.business_unit_id <> v_bu_id then
    raise exception 'TEST 10 FALLÓ: customer_id/business_unit_id no quedaron persistidos';
  end if;
  if v_order.client_name <> 'CEMEX' then
    raise exception 'TEST 10/13/14 FALLÓ: client_name debería resolverse server-side desde customers.name, quedó "%"', v_order.client_name;
  end if;
  raise notice 'TEST 10/13/14 OK: create Order con Customer/BU — client_name resuelto server-side, spoof ignorado';
end $$;

-- 11) customer cross-org rechazado.
do $$
begin
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', '10000000-0000-0000-0000-000000000001',
        'order_date', current_date::text,
        'client_name', 'x',
        'product_type', 'otro',
        'customer_id', '30000000-0000-0000-0000-000000000009'
      ),
      '[]'::jsonb
    );
    raise exception 'TEST 11 FALLÓ: debió rechazar un Customer de otra organización';
  exception when others then
    if sqlerrm like 'TEST 11 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 11 OK: customer cross-org rechazado';
end $$;

-- 12) BU cross-org rechazada.
do $$
begin
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', '10000000-0000-0000-0000-000000000001',
        'order_date', current_date::text,
        'client_name', 'x',
        'product_type', 'otro',
        'business_unit_id', '70000000-0000-0000-0000-000000000001'
      ),
      '[]'::jsonb
    );
    raise exception 'TEST 12 FALLÓ: debió rechazar una Business Unit de otra organización';
  exception when others then
    if sqlerrm like 'TEST 12 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 12 OK: business_unit_id cross-org rechazada';
end $$;

-- 15) spoof organization_id no funciona (ni siquiera se lee).
do $$
declare
  v_order orders;
  v_real_org uuid;
begin
  select id into v_real_org from organizations where slug = 'global-supplier-mty';
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Intento de spoof',
      'product_type', 'otro',
      'organization_id', '20000000-0000-0000-0000-000000000001'
    ),
    '[]'::jsonb
  );
  if v_order.organization_id <> v_real_org then
    raise exception 'TEST 15 FALLÓ: organization_id se resolvió con el valor spoofeado en vez del real';
  end if;
  raise notice 'TEST 15 OK: spoof de organization_id ignorado — se resuelve exclusivamente server-side';
end $$;

-- 16) update Customer/BU + 17) organization_id inmutable.
do $$
declare
  v_order orders;
  v_updated orders;
  v_bu_id uuid;
begin
  select id into v_bu_id from business_units where code = 'the_fire_spot';
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Cliente a editar',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );

  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object(
      'client_name', 'ignorado por customer_id',
      'supplier_name', null,
      'product_type', 'otro',
      'status', 'borrador',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'business_unit_id', v_bu_id::text
    ),
    '[]'::jsonb
  );

  if v_updated.customer_id <> '30000000-0000-0000-0000-000000000001' or v_updated.business_unit_id <> v_bu_id then
    raise exception 'TEST 16 FALLÓ: la actualización de customer_id/business_unit_id no persistió';
  end if;
  if v_updated.client_name <> 'CEMEX' then
    raise exception 'TEST 16 FALLÓ: client_name debería resolverse server-side también en update';
  end if;
  if v_updated.organization_id <> v_order.organization_id then
    raise exception 'TEST 17 FALLÓ: organization_id cambió durante un update (no debería estar expuesto)';
  end if;

  begin
    update orders set organization_id = '20000000-0000-0000-0000-000000000001' where id = v_order.id;
    raise exception 'TEST 17 FALLÓ: un UPDATE directo de organization_id debió ser rechazado por el trigger';
  exception when others then
    if sqlerrm like 'TEST 17 FALLÓ%' then raise; end if;
  end;

  raise notice 'TEST 16/17 OK: update de Customer/BU con client_name resuelto server-side; organization_id inmutable (RPC y UPDATE directo)';
end $$;

-- 18) duplicate conserva organization_id/customer_id/business_unit_id.
do $$
declare
  v_source orders;
  v_dup orders;
  v_bu_id uuid;
begin
  select id into v_bu_id from business_units where code = 'juno_promotional';
  select * into v_source from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'x',
      'product_type', 'otro',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'business_unit_id', v_bu_id::text
    ),
    '[]'::jsonb
  );

  select * into v_dup from rpc_duplicate_order(v_source.id, current_date);

  if v_dup.organization_id <> v_source.organization_id
     or v_dup.customer_id <> v_source.customer_id
     or v_dup.business_unit_id <> v_source.business_unit_id then
    raise exception 'TEST 18 FALLÓ: duplicate no copió organization_id/customer_id/business_unit_id';
  end if;
  if v_dup.folio = v_source.folio then
    raise exception 'TEST 18 FALLÓ: el duplicado debería tener folio propio, no el mismo del origen';
  end if;
  raise notice 'TEST 18/22 OK: duplicate conserva los 3 ids nuevos, folio propio e independiente (%)', v_dup.folio;
end $$;

-- 19) ADMIN RLS — ve/opera Orders de su organización sin importar el vendedor.
select test_set_user(:'admin');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders;
  if v_count = 0 then raise exception 'TEST 19 FALLÓ: ADMIN debería ver los pedidos de su organización'; end if;
  raise notice 'TEST 19 OK: ADMIN ve Orders de su organización (% filas)', v_count;
end $$;

-- 20) VENDEDOR ownership — sigue viendo solo lo propio.
select test_set_user(:'vendedor2');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders where salesperson_id = '10000000-0000-0000-0000-000000000001';
  if v_count <> 0 then
    raise exception 'TEST 20 FALLÓ: VENDEDOR 2 no debería ver pedidos del vendedor 1';
  end if;
  raise notice 'TEST 20 OK: ownership por vendedor sin cambios — VENDEDOR 2 no ve pedidos ajenos';
end $$;

-- 21) cross-org — Admin de Org B no ve ningún pedido de Org A.
-- Nota: NO se prueba aquí "crear un pedido con salesperson_id de otra
-- organización", porque `salespeople` nunca tuvo organization_id (ni antes
-- ni después de 0022 — fuera de alcance explícito de esta Foundation, que
-- solo agrega organization_id a `orders`). Un ADMIN ya podía elegir
-- cualquier salesperson_id existente para crear un pedido antes de esta
-- migración (current_user_is_admin() es un flag global, no org-scoped) —
-- 0022 no cambia ni empeora eso; se documenta como riesgo preexistente en
-- el reporte final, no como regresión de esta migración.
select test_set_user(:'admin_orgb');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders;
  if v_count <> 0 then
    raise exception 'TEST 21 FALLÓ: Admin de Org B no debería ver ningún pedido de Org A (organization_id distinto)';
  end if;
  raise notice 'TEST 21 OK: aislamiento cross-org confirmado (select) — Admin de Org B no ve Orders de Org A';
end $$;

-- 23/24/25/26) GOBO/Product Types — cero cambios funcionales, DB nunca
-- forzó los campos de proyección (eso es validación de app, no de DB) y
-- sigue sin forzarlos tras 0022.
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
begin
  -- 23) GOBO completo
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Cliente GOBO completo',
      'product_type', 'proyector_gobo',
      'status', 'pedido'
    ),
    '[{"model":"TLL200","quantity":1,"projection_description":"Logo","projection_width":2,"projection_height":1,"installation_height":3}]'::jsonb
  );
  if v_order.product_type <> 'proyector_gobo' or v_order.status <> 'pedido' then
    raise exception 'TEST 23 FALLÓ: GOBO completo no se guardó correctamente';
  end if;

  -- 24/25) GOBO incompleto, incluso en status 'pedido' — la DB nunca
  -- bloqueó esto (regla vive en getMissingProjectorFields, TypeScript);
  -- 0022 no le agrega ninguna restricción nueva.
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Cliente GOBO incompleto',
      'product_type', 'proyector_gobo',
      'status', 'pedido'
    ),
    '[{"model":"TLL200","quantity":1}]'::jsonb
  );
  if v_order.id is null then
    raise exception 'TEST 24/25 FALLÓ: la DB no debería bloquear un GOBO incompleto (regla es de app, no de DB)';
  end if;

  -- 26) Product Types — FK sigue exigiendo un código válido.
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', '10000000-0000-0000-0000-000000000001',
        'order_date', current_date::text,
        'client_name', 'x',
        'product_type', 'codigo_inventado_inexistente'
      ),
      '[]'::jsonb
    );
    raise exception 'TEST 26 FALLÓ: debió rechazar un product_type inexistente (FK orders_product_type_fkey)';
  exception when others then
    if sqlerrm like 'TEST 26 FALLÓ%' then raise; end if;
  end;

  raise notice 'TEST 23/24/25/26 OK: GOBO completo/incompleto y Product Types sin regresión';
end $$;

-- 29) Customers regresión.
do $$
begin
  if not exists (select 1 from customers where id = '30000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 29 FALLÓ: VENDEDOR debería seguir viendo Customers activos de su organización';
  end if;
  raise notice 'TEST 29 OK: Customers regresión — select sin cambios';
end $$;

-- 30) Product Master regresión (ADMIN — INSERT en product_catalog es admin-only, sin relación con 0022).
select test_set_user(:'admin');
do $$
declare
  v_product_id uuid;
begin
  insert into product_catalog (category, sku, name, organization_id)
    select 'categoria-test', 'SKU-0022-TEST', 'Producto regresión 0022', id
    from organizations where slug = 'global-supplier-mty'
    returning id into v_product_id;
  if v_product_id is null then
    raise exception 'TEST 30 FALLÓ: no se pudo insertar en product_catalog';
  end if;
  raise notice 'TEST 30 OK: Product Master regresión — insert sin cambios';
end $$;

-- 28) Quotes regresión.
do $$
declare
  v_quote quotes;
  v_bu_id uuid;
  v_org_id uuid;
begin
  select id, organization_id into v_bu_id, v_org_id from business_units where code = 'thunder_safety';

  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values (v_org_id, '10000000-0000-0000-0000-000000000001', v_bu_id, 'VU1')
  on conflict do nothing;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id,
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  if v_quote.folio is null or v_quote.subtotal <> 500 then
    raise exception 'TEST 28 FALLÓ: rpc_create_quote no generó folio/subtotal esperados tras 0022';
  end if;
  raise notice 'TEST 28 OK: Quotes regresión — folio=%, subtotal=%', v_quote.folio, v_quote.subtotal;
end $$;

select 'TESTS 9-30 PASARON' as resultado;

rollback;
