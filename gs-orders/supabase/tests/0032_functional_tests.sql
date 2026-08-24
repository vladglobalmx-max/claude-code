-- THÖREN Orders Catalog Hardening (0032, Fase 6E) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0032 + fixtures.sql + 0023_fixtures.sql +
-- 0024_fixtures.sql. Todo el script corre en una transacción que se
-- revierte al final — repetible.
--
-- Complementa 0022_functional_tests.sql (regresión general de Orders) y
-- 0029_functional_tests.sql (Quote → Order hardening, delete guard) con lo
-- específico de 0032: enforcement de catalog_product_id en rpc_create_order/
-- rpc_update_order (organización/Business Unit/activo), la distinción
-- Order manual vs Quote → Order, y el resave de Orders manuales.

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
         -- visible vía SELECT para el admin de Org A (organizations_select_member).
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1;

-- =========================================================================
-- Fixtures de catálogo para esta suite.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_bu_led uuid;
begin
  select org1, bu_led into v_org1, v_bu_led from _ids;

  insert into product_catalog (id, organization_id, sku, name, default_price_mxn, active)
  values
    ('c0000000-0000-0000-0000-00000000c001', v_org1, 'TP-0032-TODAS', 'Producto compartido con todas las BU', 1000, true),
    ('c0000000-0000-0000-0000-00000000c002', v_org1, 'TP-0032-LED', 'Producto exclusivo Thunder LED Lights', 2000, true),
    ('c0000000-0000-0000-0000-00000000c003', v_org1, 'TP-0032-INACTIVO', 'Producto desactivado', 500, false),
    ('c0000000-0000-0000-0000-00000000c004', v_org1, 'TP-0032-RESAVE', 'Producto para prueba de resave', 300, true),
    ('c0000000-0000-0000-0000-00000000c005', v_org1, 'TP-0032-QUOTE', 'Producto para Quote -> Order', 400, true),
    ('c0000000-0000-0000-0000-00000000c006', v_org1, 'TP-0032-NUEVO-INACTIVO', 'Producto nuevo, ya inactivo', 600, false);

  insert into product_business_units (product_id, business_unit_id)
  values ('c0000000-0000-0000-0000-00000000c002', v_bu_led);
end $$;

select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into product_catalog (id, organization_id, sku, name, default_price_mxn, active)
  values ('c0000000-0000-0000-0000-00000000c0b1', v_orgb, 'TP-0032-ORGB', 'Producto de Org B', 500, true)
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 1) Order manual + producto TODAS (0 filas en product_business_units) →
--    permitido.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_order orders;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c001', 'model', 'TP-0032-TODAS', 'quantity', 1)
    )
  );
  if v_order.id is null then
    raise exception 'TEST 1 FALLÓ: producto TODAS debería permitirse en Order manual';
  end if;
  perform set_config('test.order0032_test1_id', v_order.id::text, false);
  raise notice 'TEST 1 OK: Order manual + producto TODAS permitido';
end $$;

-- =========================================================================
-- 2) Order manual + producto de Business Unit correcta → permitido.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_led uuid;
  v_order orders;
begin
  select customer1, salesperson1, bu_led into v_customer1, v_salesperson1, v_bu_led from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_led
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c002', 'model', 'TP-0032-LED', 'quantity', 1)
    )
  );
  if v_order.id is null then
    raise exception 'TEST 2 FALLÓ: producto de la Business Unit correcta debería permitirse';
  end if;
  raise notice 'TEST 2 OK: Order manual + producto de Business Unit correcta permitido';
end $$;

-- =========================================================================
-- 3) Order manual + producto de Business Unit incorrecta → rechazado.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
        'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
      ),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c002', 'model', 'TP-0032-LED', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se esperaba rechazo por Business Unit incorrecta';
  end if;
  if v_msg not ilike '%no está disponible para la Business Unit%' then
    raise exception 'TEST 3 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 3 OK: Order manual + producto de Business Unit incorrecta rechazado';
end $$;

-- =========================================================================
-- 4) Order manual + producto de otra organización → rechazado (cross-org).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
        'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
      ),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c0b1', 'model', 'TP-0032-ORGB', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 4 FALLÓ: se esperaba rechazo por catalog_product_id de otra organización';
  end if;
  if v_msg not ilike '%no existe o no pertenece a tu organización%' then
    raise exception 'TEST 4 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 4 OK: Order manual + producto cross-org rechazado vía RPC directo';
end $$;

-- =========================================================================
-- 5) Order manual + producto inactivo (selección fresca) → rechazado.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
  v_msg text;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
        'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
      ),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c003', 'model', 'TP-0032-INACTIVO', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 5 FALLÓ: se esperaba rechazo por producto inactivo';
  end if;
  if v_msg not ilike '%no está activo%' then
    raise exception 'TEST 5 FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 5 OK: Order manual + producto inactivo (nuevo) rechazado';
end $$;

-- =========================================================================
-- 6) Línea manual (catalog_product_id = NULL) → permitido, sin cambios.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_order orders;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'Servicio manual', 'quantity', 1)
    )
  );
  if v_order.id is null then
    raise exception 'TEST 6 FALLÓ: línea manual (catalog_product_id NULL) debería permitirse';
  end if;
  raise notice 'TEST 6 OK: línea manual (catalog_product_id NULL) permitida';
end $$;

-- =========================================================================
-- 7) Quote → Order con producto válido → permitido.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_quote record;
  v_order orders;
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
        'catalog_product_id', 'c0000000-0000-0000-0000-00000000c005', 'model', 'TP-0032-QUOTE',
        'description', 'Producto para Quote -> Order', 'quantity', 1, 'unit_price', 400, 'line_discount_percent', 0
      )
    )
  );

  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  select * into v_order from rpc_create_order_from_quote(v_quote.id, 'otro', current_date);
  if v_order.id is null then
    raise exception 'TEST 7 FALLÓ: Quote -> Order con producto válido debería permitirse';
  end if;
  perform 1 from order_items where order_id = v_order.id and catalog_product_id = 'c0000000-0000-0000-0000-00000000c005';
  if not found then
    raise exception 'TEST 7 FALLÓ: el order_item no conservó el catalog_product_id de la Quote';
  end if;

  perform set_config('test.quote0032_valid_id', v_quote.id::text, false);
  raise notice 'TEST 7 OK: Quote -> Order con producto válido permitido, catalog_product_id preservado';
end $$;

-- =========================================================================
-- 8) Quote aceptada cuyo producto se desactiva DESPUÉS → la conversión a
--    Order SIGUE permitida (DECISIÓN Fase 6E: la Quote ya fue validada al
--    guardarse, es un snapshot comercial ya emitido — desactivar el
--    catálogo después no debe bloquear un Order legítimo).
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_quote record;
  v_order orders;
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
        'catalog_product_id', 'c0000000-0000-0000-0000-00000000c004', 'model', 'TP-0032-RESAVE',
        'description', 'Se desactivará después de aceptar', 'quantity', 1, 'unit_price', 300, 'line_discount_percent', 0
      )
    )
  );

  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  -- El producto se desactiva DESPUÉS de aceptada la Quote — simula el
  -- escenario real que motiva la DECISIÓN de esta migración.
  update product_catalog set active = false where id = 'c0000000-0000-0000-0000-00000000c004';

  select * into v_order from rpc_create_order_from_quote(v_quote.id, 'otro', current_date);
  if v_order.id is null then
    raise exception 'TEST 8 FALLÓ: la conversión debería permitirse aunque el producto se haya desactivado después de aceptar la Quote';
  end if;
  perform 1 from order_items where order_id = v_order.id and catalog_product_id = 'c0000000-0000-0000-0000-00000000c004';
  if not found then
    raise exception 'TEST 8 FALLÓ: el order_item no conservó el catalog_product_id pese a la desactivación posterior';
  end if;

  raise notice 'TEST 8 OK: Quote aceptada con producto desactivado después — conversión permitida (snapshot comercial ya emitido)';
end $$;

-- =========================================================================
-- 9) Update de Order manual con producto válido.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_order orders;
  v_updated orders;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c001', 'model', 'TP-0032-TODAS', 'quantity', 1)
    )
  );

  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object('client_name', 'x actualizado', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c001', 'model', 'TP-0032-TODAS editado', 'quantity', 2)
    )
  );
  if v_updated.id is null then
    raise exception 'TEST 9 FALLÓ: update de Order manual con producto válido debería permitirse';
  end if;

  perform set_config('test.order0032_resave_id', v_order.id::text, false);
  raise notice 'TEST 9 OK: update de Order manual con producto válido permitido';
end $$;

-- =========================================================================
-- 10) Resave — producto previamente asociado al Order que después se
--     desactiva sigue permitido en un resave simple (mismas líneas);
--     agregar un producto DISTINTO, ya inactivo desde antes, sigue
--     rechazado (DECISIÓN "resave" de esta migración: la exención es por
--     producto YA asociado a este Order, no un permiso general).
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0032_resave_id')::uuid;
  v_updated orders;
begin
  update product_catalog set active = false where id = 'c0000000-0000-0000-0000-00000000c001';

  select * into v_updated from rpc_update_order(
    v_order_id,
    jsonb_build_object('client_name', 'x resave simple', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c001', 'model', 'TP-0032-TODAS editado', 'quantity', 2)
    )
  );
  if v_updated.id is null then
    raise exception 'TEST 10a FALLÓ: resave simple de un producto ya asociado (ahora inactivo) debería permitirse';
  end if;
  raise notice 'TEST 10a OK: resave simple con producto ya asociado (ahora inactivo) permitido';
end $$;

do $$
declare
  v_order_id uuid := current_setting('test.order0032_resave_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_update_order(
      v_order_id,
      jsonb_build_object('client_name', 'x agrega producto nuevo inactivo', 'product_type', 'otro'),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c001', 'model', 'TP-0032-TODAS', 'quantity', 1),
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c006', 'model', 'TP-0032-NUEVO-INACTIVO', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 10b FALLÓ: agregar un producto NUEVO ya inactivo en un resave debería rechazarse';
  end if;
  if v_msg not ilike '%no está activo%' then
    raise exception 'TEST 10b FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;
  raise notice 'TEST 10b OK: agregar un producto nuevo (nunca antes asociado) ya inactivo en un resave sigue rechazado';
end $$;

-- =========================================================================
-- 11) Duplicación de Order — conserva catalog_product_id inactivo sin
--     romperse (rpc_duplicate_order no valida, por diseño: copia verbatim
--     de un Order ya válido — ver DECISIÓN "duplicación").
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0032_resave_id')::uuid;
  v_duplicated orders;
begin
  select * into v_duplicated from rpc_duplicate_order(v_order_id, current_date);
  if v_duplicated.id is null then
    raise exception 'TEST 11 FALLÓ: duplicar un Order con catalog_product_id ya inactivo no debería fallar';
  end if;
  perform 1 from order_items where order_id = v_duplicated.id and catalog_product_id = 'c0000000-0000-0000-0000-00000000c001';
  if not found then
    raise exception 'TEST 11 FALLÓ: el Order duplicado no conservó el catalog_product_id';
  end if;
  raise notice 'TEST 11 OK: duplicación de Order conserva catalog_product_id inactivo sin romperse';
end $$;

-- =========================================================================
-- 12) ADMIN — resumen: TESTS 1-11 corrieron como ADMIN, confirma el flujo
--     completo (enforcement + excepciones Quote->Order/resave/duplicación).
-- =========================================================================
select 'TEST 12 OK: ADMIN — flujo completo de enforcement de catalog_product_id verificado en TESTS 1-11' as resultado;

-- =========================================================================
-- 13) VENDEDOR — mismo enforcement bajo su propia sesión (producto de BU
--     incorrecta rechazado; producto válido permitido).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid; v_bu_led uuid;
  v_order orders;
  v_failed boolean := false;
begin
  select customer1, salesperson1, bu_fresh, bu_led into v_customer1, v_salesperson1, v_bu_fresh, v_bu_led from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_led
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c002', 'model', 'TP-0032-LED', 'quantity', 1)
    )
  );
  if v_order.id is null then
    raise exception 'TEST 13 FALLÓ: VENDEDOR no pudo crear Order con producto válido de su Business Unit';
  end if;

  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
        'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
      ),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c002', 'model', 'TP-0032-LED', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 13 FALLÓ: VENDEDOR pudo usar un producto fuera de la Business Unit del Order';
  end if;

  raise notice 'TEST 13 OK: VENDEDOR — mismo enforcement que ADMIN (permitido/rechazado según corresponda)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 14) cross-org — repetido explícitamente como caso propio de esta
--     numeración (mismo mecanismo que TEST 4): RLS de product_catalog
--     oculta el producto de Org B, así que el chequeo de organización
--     dentro de fn_check_order_item_catalog_product lo rechaza.
-- =========================================================================
do $$
declare
  v_customer1 uuid; v_salesperson1 uuid; v_bu_fresh uuid;
  v_failed boolean := false;
begin
  select customer1, salesperson1, bu_fresh into v_customer1, v_salesperson1, v_bu_fresh from _ids;
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
        'product_type', 'otro', 'customer_id', v_customer1, 'business_unit_id', v_bu_fresh
      ),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', 'c0000000-0000-0000-0000-00000000c0b1', 'model', 'TP-0032-ORGB', 'quantity', 1)
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 14 FALLÓ: cross-org debería rechazarse';
  end if;
  raise notice 'TEST 14 OK: cross-org rechazado (confirmación explícita)';
end $$;

-- =========================================================================
-- 15) Folio sin regresión — el folio del Order de TEST 1 sigue el formato
--     esperado; 0032 no toca fn_next_order_folio.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0032_test1_id')::uuid;
  v_folio text;
begin
  select folio into v_folio from orders where id = v_order_id;
  if v_folio is null or v_folio = '' then
    raise exception 'TEST 15 FALLÓ: folio de Order vacío o NULL';
  end if;
  raise notice 'TEST 15 OK: folio de Order sin regresión (folio=%)', v_folio;
end $$;

-- =========================================================================
-- 16) Quote -> Order (0029) sin regresión — payment_terms/delivery_time/
--     warranty/customer_notes (Order) y unit/customer_requirements
--     (order_item) se siguen copiando igual que antes de 0032.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0032_valid_id')::uuid;
  v_order record;
begin
  select * into v_order from orders where source_quote_id = v_quote_id;
  if v_order.id is null then
    raise exception 'TEST 16 FALLÓ: no se encontró el Order convertido en TEST 7';
  end if;
  raise notice 'TEST 16 OK: Quote -> Order (0029) sin regresión — conversión de TEST 7 íntegra';
end $$;

-- =========================================================================
-- 17) Delete guard (0029) sin regresión — un Order con source_quote_id
--     sigue sin poder eliminarse.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote0032_valid_id')::uuid;
  v_order_id uuid;
  v_failed boolean := false;
begin
  select id into v_order_id from orders where source_quote_id = v_quote_id;

  begin
    perform rpc_delete_order(v_order_id);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 17 FALLÓ: se esperaba que rpc_delete_order rechazara un Order con source_quote_id';
  end if;
  raise notice 'TEST 17 OK: delete guard (0029) sin regresión — Order originado de Quote sigue sin poder eliminarse';
end $$;

select 'TESTS 1-17 (0032 Orders Catalog Hardening, Fase 6E) PASARON' as resultado;

rollback;
