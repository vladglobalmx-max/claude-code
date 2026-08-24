-- THÖREN Quote Catalog Operational Fields + Enforcement DB (0031) —
-- pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0031 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible.
--
-- Complementa quote_catalog_integration_tests.sql (Fase 6D, capa de
-- aplicación + fundamento RLS) con lo específico de 0031: warranty/unit/
-- customer_requirements realmente persistidos por rpc_create_quote/
-- rpc_update_quote, y el enforcement DB nuevo de catalog_product_id
-- (fn_check_quote_item_catalog_product) — organización, activo, Business
-- Unit — vía RPC directo, sin pasar por cotizaciones/actions.ts.

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
  select :'org1'::uuid as org1, :'bu_fresh'::uuid as bu_fresh, :'bu_led'::uuid as bu_led,
         :'customer1'::uuid as customer1,
         -- Org B (fixtures.sql, requisito de este archivo) — id fijo conocido, nunca
         -- visible vía SELECT para el admin de Org A (organizations_select_member
         -- solo deja ver la propia organización) por eso NO se resuelve con \gset.
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1;

-- =========================================================================
-- Fixtures de catálogo para esta suite.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_orgb uuid; v_bu_led uuid;
begin
  select org1, orgb, bu_led into v_org1, v_orgb, v_bu_led from _ids;

  insert into product_catalog (id, organization_id, sku, name, unit, default_price_mxn, default_price_usd, active)
  values
    ('b0000000-0000-0000-0000-00000000b001', v_org1, 'TP-0031-TODAS', 'Producto compartido con todas las BU', 'pza', 1000, 60, true),
    ('b0000000-0000-0000-0000-00000000b002', v_org1, 'TP-0031-LED', 'Producto exclusivo Thunder LED Lights', 'pza', 2000, 120, true),
    ('b0000000-0000-0000-0000-00000000b003', v_org1, 'TP-0031-INACTIVO', 'Producto desactivado', 'pza', 500, 30, false);

  insert into product_business_units (product_id, business_unit_id)
  values ('b0000000-0000-0000-0000-00000000b002', v_bu_led);

  -- Producto de Org B — para el TEST cross-org (creado con el ADMIN real de esa org más abajo, ver TEST 9).
end $$;

select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, default_price_mxn, active)
  values ('b0000000-0000-0000-0000-00000000b0b1', v_orgb, 'TP-0031-ORGB', 'Producto de Org B', 500, true)
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 1) warranty + línea manual (catalog_product_id NULL) — create.
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
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text,
      'warranty', '1 año por defectos de fabricación'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', null, 'model', 'Servicio de instalación', 'description', 'Instalación en sitio',
        'quantity', 1, 'unit_price', 500, 'line_discount_percent', 0
      )
    )
  );

  if v_quote.warranty <> '1 año por defectos de fabricación' then
    raise exception 'TEST 1 FALLÓ: warranty no se guardó (valor=%)', v_quote.warranty;
  end if;

  select * into v_item from quote_items where quote_id = v_quote.id;
  if v_item.catalog_product_id is not null then
    raise exception 'TEST 1 FALLÓ: línea manual no debería tener catalog_product_id';
  end if;

  perform set_config('test.quote0031_id', v_quote.id::text, false);
  raise notice 'TEST 1 OK: warranty create + línea manual (catalog_product_id NULL) permitida';
end $$;

-- =========================================================================
-- 2) warranty — update.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0031_id')::uuid;
  v_customer1 uuid;
  v_quote record;
begin
  select customer1 into v_customer1 from _ids;

  select * into v_quote from rpc_update_quote(
    v_quote_id,
    jsonb_build_object(
      'customer_id', v_customer1, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 20)::text, 'warranty', '2 años por defectos de fabricación'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', null, 'model', 'Servicio de instalación', 'description', 'Instalación en sitio',
        'quantity', 1, 'unit_price', 500, 'line_discount_percent', 0
      )
    )
  );

  if v_quote.warranty <> '2 años por defectos de fabricación' then
    raise exception 'TEST 2 FALLÓ: warranty no se actualizó (valor=%)', v_quote.warranty;
  end if;
  raise notice 'TEST 2 OK: warranty update aplicado correctamente';
end $$;

-- =========================================================================
-- 3) unit + customer_requirements por línea — create (producto de
--    catálogo TODAS, elegible para cualquier BU).
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
        'catalog_product_id', 'b0000000-0000-0000-0000-00000000b001', 'model', 'TP-0031-TODAS',
        'description', 'Producto compartido con todas las BU', 'quantity', 2, 'unit_price', 1000, 'line_discount_percent', 0,
        'unit', 'pza', 'customer_requirements', 'Color rojo, empaque individual'
      )
    )
  );

  select * into v_item from quote_items where quote_id = v_quote.id;
  if v_item.unit <> 'pza' or v_item.customer_requirements <> 'Color rojo, empaque individual' then
    raise exception 'TEST 3 FALLÓ: unit/customer_requirements no se guardaron (unit=%, customer_requirements=%)', v_item.unit, v_item.customer_requirements;
  end if;

  perform set_config('test.quote0031b_id', v_quote.id::text, false);
  perform set_config('test.quote0031b_item_id', v_item.id::text, false);
  raise notice 'TEST 3 OK: unit + customer_requirements por línea guardados correctamente (create)';
end $$;

-- =========================================================================
-- 4) unit + customer_requirements por línea — update.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0031b_id')::uuid;
  v_customer1 uuid;
  v_item record;
begin
  select customer1 into v_customer1 from _ids;

  perform rpc_update_quote(
    v_quote_id,
    jsonb_build_object(
      'customer_id', v_customer1, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'b0000000-0000-0000-0000-00000000b001', 'model', 'TP-0031-TODAS',
        'description', 'Producto compartido con todas las BU', 'quantity', 2, 'unit_price', 1000, 'line_discount_percent', 0,
        'unit', 'caja', 'customer_requirements', 'Cambió a empaque por caja'
      )
    )
  );

  select * into v_item from quote_items where quote_id = v_quote_id;
  if v_item.unit <> 'caja' or v_item.customer_requirements <> 'Cambió a empaque por caja' then
    raise exception 'TEST 4 FALLÓ: unit/customer_requirements no se actualizaron (unit=%, customer_requirements=%)', v_item.unit, v_item.customer_requirements;
  end if;
  raise notice 'TEST 4 OK: unit + customer_requirements por línea actualizados correctamente (update)';
end $$;

-- =========================================================================
-- 5) NULLs — omitir warranty/unit/customer_requirements deja NULL, nunca
--    "" ni un valor inventado.
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
        'catalog_product_id', null, 'model', 'Línea sin datos operativos', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0
      )
    )
  );

  if v_quote.warranty is not null then
    raise exception 'TEST 5 FALLÓ: warranty debería ser NULL cuando se omite (valor=%)', v_quote.warranty;
  end if;

  select * into v_item from quote_items where quote_id = v_quote.id;
  if v_item.unit is not null or v_item.customer_requirements is not null then
    raise exception 'TEST 5 FALLÓ: unit/customer_requirements deberían ser NULL cuando se omiten (unit=%, customer_requirements=%)', v_item.unit, v_item.customer_requirements;
  end if;

  raise notice 'TEST 5 OK: warranty/unit/customer_requirements omitidos quedan NULL, nunca inventados';
end $$;

-- =========================================================================
-- 6) Producto TODAS (0 filas en product_business_units) permitido para
--    cualquier Business Unit — vía RPC directo.
-- =========================================================================
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
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'b0000000-0000-0000-0000-00000000b001', 'model', 'TP-0031-TODAS',
        'quantity', 1, 'unit_price', 1000, 'line_discount_percent', 0
      )
    )
  );
  if v_quote.id is null then
    raise exception 'TEST 6 FALLÓ: producto TODAS debería permitirse en cualquier Business Unit';
  end if;
  raise notice 'TEST 6 OK: producto TODAS (0 filas en product_business_units) permitido';
end $$;

-- =========================================================================
-- 7) Producto de una Business Unit específica, coincidiendo con la BU de
--    la Quote — permitido.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_led uuid;
begin
  select customer1, salesperson1, bu_led into v_customer1, v_salesperson1, v_bu_led from _ids;

  -- bu_led no tiene configuración de folio activa — se crea una para esta prueba,
  -- prefijo distinto de VU1 (org-scoped unique) para no colisionar con el existente.
  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values ((select org1 from _ids), v_salesperson1, v_bu_led, 'LED')
  on conflict do nothing;

  perform rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_led, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1,
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'b0000000-0000-0000-0000-00000000b002', 'model', 'TP-0031-LED',
        'quantity', 1, 'unit_price', 2000, 'line_discount_percent', 0
      )
    )
  );
  raise notice 'TEST 7 OK: producto de Business Unit específica permitido cuando coincide con la BU de la Quote';
end $$;

-- =========================================================================
-- 8) Producto de Business Unit específica, la Quote es de OTRA BU —
--    rechazado (fn_check_quote_item_catalog_product).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
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
          'catalog_product_id', 'b0000000-0000-0000-0000-00000000b002', 'model', 'TP-0031-LED',
          'quantity', 1, 'unit_price', 2000, 'line_discount_percent', 0
        )
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 8 FALLÓ: se esperaba rechazo por Business Unit incorrecta';
  end if;
  if v_msg not ilike '%no está disponible para la Business Unit%' then
    raise exception 'TEST 8 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 8 OK: producto de Business Unit incorrecta rechazado con mensaje claro';
end $$;

-- =========================================================================
-- 9) Producto de OTRA organización — rechazado vía RPC directo (sin pasar
--    por cotizaciones/actions.ts). Confirma que RLS + el chequeo explícito
--    de organización cierran el cross-org también a nivel RPC.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
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
          'catalog_product_id', 'b0000000-0000-0000-0000-00000000b0b1', 'model', 'TP-0031-ORGB',
          'quantity', 1, 'unit_price', 500, 'line_discount_percent', 0
        )
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 9 FALLÓ: se esperaba rechazo por catalog_product_id de otra organización';
  end if;
  if v_msg not ilike '%no existe o no pertenece a tu organización%' then
    raise exception 'TEST 9 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 9 OK: catalog_product_id de otra organización rechazado vía RPC directo (cross-org cerrado a nivel DB)';
end $$;

-- =========================================================================
-- 10) Producto manual (catalog_product_id = NULL) sigue permitido —
--     confirmado explícitamente aparte de TEST 1 (checklist §8).
-- =========================================================================
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
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'Servicio especial', 'quantity', 1, 'unit_price', 300, 'line_discount_percent', 0)
    )
  );
  if v_quote.id is null then
    raise exception 'TEST 10 FALLÓ: línea manual (catalog_product_id NULL) debería permitirse';
  end if;
  raise notice 'TEST 10 OK: producto manual (catalog_product_id NULL) sigue permitido';
end $$;

-- =========================================================================
-- 11) Producto INACTIVO — rechazado (DECISIÓN documentada en 0031: mismo
--     tratamiento que organización/Business Unit). Se prueba como ADMIN
--     porque product_catalog_select SÍ le permite ver productos inactivos
--     de su propia organización (a diferencia de VENDEDOR, que ni
--     siquiera los vería) — es el caso donde el chequeo explícito de
--     `active` realmente importa.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
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
          'catalog_product_id', 'b0000000-0000-0000-0000-00000000b003', 'model', 'TP-0031-INACTIVO',
          'quantity', 1, 'unit_price', 500, 'line_discount_percent', 0
        )
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 11 FALLÓ: se esperaba rechazo por producto inactivo (decisión documentada en 0031)';
  end if;
  if v_msg not ilike '%no está activo%' then
    raise exception 'TEST 11 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 11 OK: producto inactivo rechazado (decisión documentada: mismo tratamiento que organización/Business Unit)';
end $$;

-- =========================================================================
-- 12) Snapshot inmutable — editar product_catalog.unit/name DESPUÉS de
--     creada la Quote (TEST 3) no debe alterar quote_items.unit/model ya
--     persistidos.
-- =========================================================================
do $$
declare
  v_item_id uuid := current_setting('test.quote0031b_item_id')::uuid;
  v_unit text;
begin
  update product_catalog set unit = 'CAMBIADO', name = 'NOMBRE CAMBIADO'
    where id = 'b0000000-0000-0000-0000-00000000b001';

  select unit into v_unit from quote_items where id = v_item_id;
  if v_unit <> 'caja' then -- valor dejado por TEST 4 (update)
    raise exception 'TEST 12 FALLÓ: el snapshot de quote_items.unit cambió al editar product_catalog (unit=%)', v_unit;
  end if;
  raise notice 'TEST 12 OK: snapshot de quote_items.unit inmutable — editar el catálogo después no lo afecta';
end $$;

-- =========================================================================
-- 13) ADMIN — resumen: todos los tests 1-12 corrieron como ADMIN, se
--     confirma explícitamente que el flujo completo (warranty/unit/
--     customer_requirements/enforcement) funciona para ese rol.
-- =========================================================================
select 'TEST 13 OK: ADMIN — flujo completo (warranty/unit/customer_requirements/enforcement) verificado en TESTS 1-12' as resultado;

-- =========================================================================
-- 14) VENDEDOR — mismo flujo completo (create + update con catálogo +
--     warranty/unit/customer_requirements) bajo su propia sesión.
-- =========================================================================
select test_set_user(:'vendedor1');
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
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text,
      'warranty', 'Garantía de fábrica'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', 'b0000000-0000-0000-0000-00000000b001', 'model', 'TP-0031-TODAS',
        'quantity', 1, 'unit_price', 1000, 'line_discount_percent', 0, 'unit', 'pza', 'customer_requirements', 'Entrega en obra'
      )
    )
  );

  if v_quote.warranty <> 'Garantía de fábrica' then
    raise exception 'TEST 14 FALLÓ: VENDEDOR no pudo guardar warranty';
  end if;
  select * into v_item from quote_items where quote_id = v_quote.id;
  if v_item.unit <> 'pza' or v_item.customer_requirements <> 'Entrega en obra' then
    raise exception 'TEST 14 FALLÓ: VENDEDOR no pudo guardar unit/customer_requirements';
  end if;

  perform set_config('test.quote0031_vendedor_id', v_quote.id::text, false);
  raise notice 'TEST 14 OK: VENDEDOR — flujo completo (warranty/unit/customer_requirements) funciona igual que ADMIN';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 15) Regresión Quote PDF — la página lee quotes/quote_items con
--     select("*"); confirma que las filas con warranty/unit/customer_
--     requirements poblados siguen siendo legibles sin error (no requirió
--     ningún cambio de código en (print)/cotizaciones/[id]/pdf).
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0031_vendedor_id')::uuid;
  v_row record;
begin
  select * into v_row from quotes where id = v_quote_id;
  if v_row.id is null then
    raise exception 'TEST 15 FALLÓ: no se pudo leer la Quote como lo hace el Quote PDF (select *)';
  end if;
  perform * from quote_items where quote_id = v_quote_id;
  raise notice 'TEST 15 OK: regresión Quote PDF — select("*") de quotes/quote_items sigue funcionando con los campos nuevos poblados';
end $$;

-- =========================================================================
-- 16) Regresión Quote → Order (0029) — convertir una Quote con warranty +
--     items con unit/customer_requirements ahora poblados de verdad (antes
--     de 0031 siempre eran NULL) debe copiarlos correctamente al Order/
--     order_items — rpc_create_order_from_quote (0029) YA los leía, solo
--     nunca había datos reales que copiar hasta esta migración.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0031_vendedor_id')::uuid;
  v_order record;
  v_order_item record;
begin
  update quotes set status = 'enviada' where id = v_quote_id;
  update quotes set status = 'aceptada' where id = v_quote_id;

  select * into v_order from rpc_create_order_from_quote(v_quote_id, 'otro', current_date);

  if v_order.warranty <> 'Garantía de fábrica' then
    raise exception 'TEST 16 FALLÓ: warranty no se copió de la Quote al Order (valor=%)', v_order.warranty;
  end if;

  select * into v_order_item from order_items where order_id = v_order.id;
  if v_order_item.unit <> 'pza' or v_order_item.customer_requirements <> 'Entrega en obra' then
    raise exception 'TEST 16 FALLÓ: unit/customer_requirements no se copiaron al order_item (unit=%, customer_requirements=%)',
      v_order_item.unit, v_order_item.customer_requirements;
  end if;

  raise notice 'TEST 16 OK: regresión Quote → Order (0029) — warranty/unit/customer_requirements ahora poblados se copian correctamente';
end $$;

-- =========================================================================
-- 17) Folios intactos — 0031 no toca fn_next_quote_folio/fn_next_order_folio;
--     confirma que el folio de la Quote convertida en TEST 16 sigue el
--     formato esperado y el Order resultante también tiene folio válido.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0031_vendedor_id')::uuid;
  v_quote_folio text;
  v_order_folio text;
begin
  select folio into v_quote_folio from quotes where id = v_quote_id;
  select folio into v_order_folio from orders where source_quote_id = v_quote_id;

  if v_quote_folio !~ '^[A-Z0-9]+-\d{8}-\d{3}$' then
    raise exception 'TEST 17 FALLÓ: folio de Quote con formato inesperado: %', v_quote_folio;
  end if;
  if v_order_folio !~ '^[A-Z0-9]+-\d{8}-\d{3}$' then
    raise exception 'TEST 17 FALLÓ: folio de Order con formato inesperado: %', v_order_folio;
  end if;

  raise notice 'TEST 17 OK: folios de Quote (%) y Order (%) intactos, formato sin cambios', v_quote_folio, v_order_folio;
end $$;

select 'TESTS 1-17 (0031 Quote Catalog Operational Fields + Enforcement DB) PASARON' as resultado;

rollback;
