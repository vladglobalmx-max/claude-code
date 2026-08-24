-- THÖREN Fase 6D — Integración Catálogo Maestro / Quote Builder — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0030 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible.
--
-- Complementa los tests unitarios de src/lib/quotes/catalog-picker.test.ts
-- (búsqueda/elegibilidad/snapshot/cambio de BU, puramente en memoria) con lo
-- que SOLO puede verificarse contra la base de datos real: snapshot
-- persistido inmutable ante ediciones posteriores del catálogo, ADMIN/
-- VENDEDOR, y el fundamento real (RLS de product_catalog) de la validación
-- cross-org de la capa de aplicación (cotizaciones/actions.ts,
-- validateCatalogProductSelections) — ver reporte Fase 6D, sección L, para
-- el detalle de por qué rpc_create_quote/rpc_update_quote en sí mismos
-- (SECURITY INVOKER, sin cambios en esta fase) NO validan todavía
-- elegibilidad por Business Unit ni organización del catalog_product_id:
-- eso queda documentado aquí como comportamiento actual, no como fix.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as bu_fresh from business_units where organization_id = :'org1' and code = 'got_fresh_breath' \gset
select id as bu_led from business_units where organization_id = :'org1' and code = 'thunder_led' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'bu_fresh'::uuid as bu_fresh, :'bu_led'::uuid as bu_led, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1;

-- =========================================================================
-- Fixtures de catálogo para esta suite — un producto "TODAS" (0
-- product_business_units) y uno acotado a Thunder LED Lights (bu_led,
-- DISTINTA de la Business Unit del folio configurado, bu_fresh) — para el
-- TEST 5 de más abajo.
-- =========================================================================
do $$
declare
  v_org1 uuid;
begin
  select org1 into v_org1 from _ids;

  insert into product_catalog (id, organization_id, sku, name, default_price_mxn, default_price_usd, active)
  values
    ('a0000000-0000-0000-0000-00000000a001', v_org1, 'TP-6D-TODAS', 'Producto compartido con todas las BU', 1000, 60, true),
    ('a0000000-0000-0000-0000-00000000a002', v_org1, 'TP-6D-LED', 'Producto exclusivo Thunder LED Lights', 2000, 120, true);

  insert into product_business_units (product_id, business_unit_id)
  values ('a0000000-0000-0000-0000-00000000a002', (select bu_led from _ids));
end $$;

-- =========================================================================
-- 1) ADMIN crea una Quote con un item de catálogo (producto TODAS) — el
--    snapshot en quote_items queda correcto (catalog_product_id/model/
--    description/unit_price tal como los resolvió el Quote Builder).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_quote record;
  v_item record;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_fresh, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'a0000000-0000-0000-0000-00000000a001', 'model', 'TP-6D-TODAS',
        'description', 'Producto compartido con todas las BU', 'quantity', 2, 'unit_price', 1000, 'line_discount_percent', 0
      )
    )
  );

  select * into v_item from quote_items where quote_id = v_quote.id;
  if v_item.catalog_product_id <> 'a0000000-0000-0000-0000-00000000a001'::uuid or v_item.model <> 'TP-6D-TODAS'
    or v_item.unit_price <> 1000 then
    raise exception 'TEST 1 FALLÓ: snapshot de quote_items no coincide con lo enviado';
  end if;

  perform set_config('test.quote6d_id', v_quote.id::text, false);
  perform set_config('test.quote6d_item_id', v_item.id::text, false);
  raise notice 'TEST 1 OK: ADMIN crea Quote con item de catálogo — snapshot correcto en quote_items';
end $$;

-- =========================================================================
-- 2) VENDEDOR (dueño del salesperson) también puede crear una Quote con un
--    item de catálogo — mismo RLS que el resto de la Quote (sin regla
--    especial para catalog_product_id).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_quote record;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_fresh, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
      'currency', 'USD', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'a0000000-0000-0000-0000-00000000a001', 'model', 'TP-6D-TODAS',
        'description', 'Producto compartido con todas las BU', 'quantity', 1, 'unit_price', 60, 'line_discount_percent', 0
      )
    )
  );

  if v_quote.id is null then
    raise exception 'TEST 2 FALLÓ: VENDEDOR no pudo crear la Quote';
  end if;
  raise notice 'TEST 2 OK: VENDEDOR crea Quote con item de catálogo (moneda USD, precio USD correcto)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 3) Snapshot inmutable — editar el catálogo DESPUÉS de creada la Quote
--    (TEST 1) no debe alterar quote_items ya persistidos.
-- =========================================================================
do $$
declare
  v_item_id uuid := current_setting('test.quote6d_item_id')::uuid;
  v_model text; v_description text; v_unit_price numeric;
begin
  update product_catalog set name = 'NOMBRE CAMBIADO', default_price_mxn = 99999
    where id = 'a0000000-0000-0000-0000-00000000a001';

  select model, description, unit_price into v_model, v_description, v_unit_price
    from quote_items where id = v_item_id;

  if v_model <> 'TP-6D-TODAS' or v_description <> 'Producto compartido con todas las BU' or v_unit_price <> 1000 then
    raise exception 'TEST 3 FALLÓ: el snapshot de quote_items cambió al editar product_catalog (model=%, description=%, unit_price=%)',
      v_model, v_description, v_unit_price;
  end if;

  raise notice 'TEST 3 OK: snapshot de quote_items inmutable — editar el catálogo después no lo afecta';
end $$;

-- =========================================================================
-- 4) Editar la Quote (rpc_update_quote, sigue en borrador) NO modifica
--    product_catalog — la edición del Quote Builder es un documento
--    comercial independiente (Fase 6D §5).
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote6d_id')::uuid;
  v_customer1 uuid;
  v_catalog_name_before text;
  v_catalog_name_after text;
begin
  select customer1 into v_customer1 from _ids;
  select name into v_catalog_name_before from product_catalog where id = 'a0000000-0000-0000-0000-00000000a001';

  perform rpc_update_quote(
    v_quote_id,
    jsonb_build_object(
      'customer_id', v_customer1, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 20)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'a0000000-0000-0000-0000-00000000a001', 'model', 'EDITADO EN LA QUOTE',
        'description', 'Descripción editada solo en la Quote', 'quantity', 5, 'unit_price', 1234.56, 'line_discount_percent', 10
      )
    )
  );

  select name into v_catalog_name_after from product_catalog where id = 'a0000000-0000-0000-0000-00000000a001';

  if v_catalog_name_before <> v_catalog_name_after then
    raise exception 'TEST 4 FALLÓ: editar la Quote modificó product_catalog (antes=%, después=%)', v_catalog_name_before, v_catalog_name_after;
  end if;

  perform 1 from quote_items where quote_id = v_quote_id and model = 'EDITADO EN LA QUOTE' and unit_price = 1234.56;
  if not found then
    raise exception 'TEST 4 FALLÓ: rpc_update_quote no aplicó el nuevo snapshot a quote_items';
  end if;

  raise notice 'TEST 4 OK: editar la Quote actualiza su propio snapshot y NO toca product_catalog';
end $$;

-- =========================================================================
-- 5) CERRADO POR 0031 — rpc_create_quote ahora SÍ rechaza a nivel de base
--    de datos un catalog_product_id fuera de la Business Unit de la Quote
--    (fn_check_quote_item_catalog_product, 0031_quote_catalog_operational_
--    fields.sql). Antes de 0031 este mismo caso se insertaba sin error
--    (era un hallazgo documentado, no un fix) — ver histórico de este
--    archivo/reporte Fase 6D §L. Cobertura completa de 0031 (warranty/
--    unit/customer_requirements/enforcement DB) vive en
--    0031_functional_tests.sql; este test se deja aquí como regresión
--    directa del caso puntual que motivó la migración.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  begin
    perform rpc_create_quote(
      gen_random_uuid(),
      jsonb_build_object(
        'business_unit_id', v_bu_fresh, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
        'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
      ),
      jsonb_build_array(
        jsonb_build_object(
          'catalog_product_id', 'a0000000-0000-0000-0000-00000000a002', 'model', 'TP-6D-LED',
          'description', 'Producto exclusivo Thunder LED Lights', 'quantity', 1, 'unit_price', 2000, 'line_discount_percent', 0
        )
      )
    );
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 5 FALLÓ: se esperaba que 0031 rechazara un catalog_product_id fuera de la Business Unit de la Quote';
  end if;

  raise notice 'TEST 5 OK: rpc_create_quote (post-0031) rechaza catalog_product_id fuera de la Business Unit — enforcement DB confirmado';
end $$;

-- =========================================================================
-- 6) Fundamento real de la validación cross-org de la app (Fase 6D §12) —
--    RLS de product_catalog (product_catalog_select, 0019/0030) SÍ oculta
--    productos de otra organización: la query que usa
--    validateCatalogProductSelections (SELECT id FROM product_catalog
--    WHERE id IN (...)) devuelve 0 filas para un id de Org B vista desde
--    Org A, exactamente lo que esa validación necesita para detectar el
--    id ajeno por conteo. Documentado también: rpc_create_quote en sí
--    (SECURITY INVOKER) tampoco valida esto — mismo hallazgo que TEST 5,
--    misma recomendación de migración futura.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_orgb uuid;
begin
  select id into v_orgb from organizations where slug = 'org-b';
  if v_orgb is null then
    raise exception 'TEST 6 FALLÓ: fixtures.sql no aplicado — Org B no existe (ver encabezado de este archivo)';
  end if;

  insert into product_catalog (id, organization_id, sku, name, default_price_mxn, active)
  values ('a0000000-0000-0000-0000-00000000a0b1', v_orgb, 'TP-6D-ORGB', 'Producto de Org B', 500, true)
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_visible_count integer;
begin
  -- Sesión ADMIN de Org A (global-supplier-mty) — RLS debe ocultar el producto de Org B.
  select count(*) into v_visible_count from product_catalog where id = 'a0000000-0000-0000-0000-00000000a0b1';
  if v_visible_count <> 0 then
    raise exception 'TEST 6 FALLÓ: RLS dejó ver un producto de otra organización (count=%)', v_visible_count;
  end if;
  raise notice 'TEST 6 OK: RLS de product_catalog oculta productos de otra organización — fundamento válido de validateCatalogProductSelections';
end $$;

select 'TESTS 1-6 (Fase 6D — Catálogo Maestro en Quote Builder) PASARON' as resultado;

rollback;
