-- THÖREN — rpc_bulk_deactivate_catalog_products_by_filters
-- (0078_catalog_bulk_deactivate_by_filters.sql) — pruebas funcionales
-- contra Postgres real. Fixtures 100% autocontenidas. Todo el script corre
-- en una transacción que se revierte al final (rollback) — repetible.

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set bu_juno '00000000-0000-0000-0000-0000000000b1'
\set bu_otra '00000000-0000-0000-0000-0000000000b2'
\set bu_orgb '00000000-0000-0000-0000-0000000000b9'
\set tipo_proyector '00000000-0000-0000-0000-0000000000d1'
\set tipo_luz '00000000-0000-0000-0000-0000000000d2'
\set sp_vendedor '00000000-0000-0000-0000-0000000000f1'

insert into auth.users (id, email) values
  (:'admin', 'admin-78@test.local'),
  (:'vendedor', 'vendedor-78@test.local'),
  (:'admin_orgb', 'admin-orgb-78@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 78', 'test-org-78'),
  (:'org_b', 'Test Org 78B', 'test-org-78b');

insert into salespeople (id, organization_id, name, prefix, active) values (:'sp_vendedor', :'org_a', 'Vend Test 78', 'VT78', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'admin', 'Admin Test 78', 'admin', null, true),
  (:'vendedor', 'Vendedor Test 78', 'vendedor', :'sp_vendedor', true),
  (:'admin_orgb', 'Admin Org B 78', 'admin', null, true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_a', :'vendedor', 'vendedor', true),
  (:'org_b', :'admin_orgb', 'admin', true);

set role authenticated;
select test_set_user(:'admin');

insert into business_units (id, organization_id, name, code, active) values
  (:'bu_juno', :'org_a', 'Juno Promotional', 'juno_78', true),
  (:'bu_otra', :'org_a', 'Otra Business Unit', 'otra_78', true);

insert into product_types (id, organization_id, code, name, active) values
  (:'tipo_proyector', :'org_a', 'PROY-78', 'Proyector Gobo', true),
  (:'tipo_luz', :'org_a', 'LUZ-78', 'Luz Grua Viajera', true);

select test_set_user(:'admin_orgb');
insert into business_units (id, organization_id, name, code, active) values (:'bu_orgb', :'org_b', 'BU Org B', 'orgb_78', true);
select test_set_user(:'admin');

-- Cadena de productos org_a:
--   p1 -> BU Juno, tipo proyector, active=true
--   p2 -> BU Juno, tipo luz, active=true
--   p3 -> sin fila en product_business_units (compartido con todas), tipo proyector, active=true
--   p4 -> BU Otra (NO Juno), tipo proyector, active=true
--   p5 -> BU Juno, tipo proyector, YA active=false (no debe tocarse ni contarse)
--   p6 -> sin BU, sin tipo, active=true (universo "sin filtros")
insert into product_catalog (id, organization_id, category, sku, name, product_type_id, active) values
  ('00000000-0000-0000-0000-0000000000c1', :'org_a', 'general', 'SKU-P1-78', 'Producto 1', :'tipo_proyector', true),
  ('00000000-0000-0000-0000-0000000000c2', :'org_a', 'general', 'SKU-P2-78', 'Producto 2', :'tipo_luz', true),
  ('00000000-0000-0000-0000-0000000000c3', :'org_a', 'general', 'SKU-P3-78', 'Producto 3 (compartido)', :'tipo_proyector', true),
  ('00000000-0000-0000-0000-0000000000c4', :'org_a', 'general', 'SKU-P4-78', 'Producto 4 (otra BU)', :'tipo_proyector', true),
  ('00000000-0000-0000-0000-0000000000c5', :'org_a', 'general', 'SKU-P5-78', 'Producto 5 (ya inactivo)', :'tipo_proyector', false),
  ('00000000-0000-0000-0000-0000000000c6', :'org_a', 'general', 'SKU-P6-78', 'Producto 6 (universo total)', null, true);

insert into product_business_units (product_id, business_unit_id) values
  ('00000000-0000-0000-0000-0000000000c1', :'bu_juno'),
  ('00000000-0000-0000-0000-0000000000c2', :'bu_juno'),
  ('00000000-0000-0000-0000-0000000000c4', :'bu_otra'),
  ('00000000-0000-0000-0000-0000000000c5', :'bu_juno');
-- p3 y p6 deliberadamente SIN fila -> "compartido con todas".

-- Cadena de referencia en org_b — nunca debe verse afectada por nada de lo
-- que sigue, incluso con los MISMOS filtros (mismo p_tipo/p_bu por
-- coincidencia de valor no aplica aquí porque los ids son distintos, pero
-- se prueba explícitamente con su propia BU).
select test_set_user(:'admin_orgb');
insert into product_catalog (id, organization_id, category, sku, name, active) values
  ('00000000-0000-0000-0000-0000000000c9', :'org_b', 'general', 'SKU-ORGB-78', 'Producto Org B', true);
insert into product_business_units (product_id, business_unit_id) values
  ('00000000-0000-0000-0000-0000000000c9', :'bu_orgb');
select test_set_user(:'admin');

-- Referencia histórica — snapshot en una Sales Order (nunca debe cambiar
-- tras la desactivación de p1). Reutiliza el salesperson del fixture
-- (sp_vendedor) — ya existe, insertarlo de nuevo violaría la PK.
\set so1 '00000000-0000-0000-0000-0000000000e1'
insert into customers (id, organization_id, name, active) values ('00000000-0000-0000-0000-0000000000f2', :'org_a', 'Cliente Test 78', true);
insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, status, currency, payment_terms_type, subtotal, tax_total, total, created_by) values
  (:'so1', :'org_a', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'SO-TEST-78', 1, 'draft', 'MXN', 'cash', 100, 0, 100, :'admin');
insert into sales_order_items (sales_order_id, position, catalog_product_id, sku_snapshot, description_snapshot, quantity, unit_price, line_subtotal, line_total) values
  (:'so1', 0, '00000000-0000-0000-0000-0000000000c1', 'SKU-P1-78', 'Producto 1 (snapshot)', 1, 100, 100, 100);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: vendedor (no admin) -> rechazado, nada se toca.
-- =========================================================================
select test_set_user(:'vendedor');
do $$
begin
  begin
    perform rpc_bulk_deactivate_catalog_products_by_filters(null, null);
    raise exception 'TEST 1 FALLO: un vendedor no debio poder ejecutar la funcion';
  exception when others then
    if sqlerrm like 'Solo un administrador%' then
      raise notice 'TEST 1 OK: vendedor rechazado (%).', sqlerrm;
    else
      raise exception 'TEST 1 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;
select test_set_user(:'admin');

do $$
declare v_active boolean;
begin
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c1';
  if v_active <> true then
    raise exception 'TEST 1b FALLO: p1 no debio tocarse tras el rechazo, active=%', v_active;
  end if;
  raise notice 'TEST 1b OK: ningun producto se toco tras el intento sin autoridad';
end $$;

-- =========================================================================
-- TEST 2: filtro por Tipo de Producto (proyector) -> p1, p3, p4 (activos,
-- tipo proyector); p5 ya inactivo no cuenta aunque sea tipo proyector; p2
-- (tipo luz) y p6 (sin tipo) no coinciden.
-- =========================================================================
do $$
declare v_count integer;
begin
  v_count := rpc_bulk_deactivate_catalog_products_by_filters(null, '00000000-0000-0000-0000-0000000000d1');
  if v_count <> 3 then
    raise exception 'TEST 2 FALLO: se esperaban 3 productos desactivados por tipo, hubo %', v_count;
  end if;
  raise notice 'TEST 2 OK: 3 productos desactivados por Tipo de Producto (p1, p3, p4)';
end $$;

do $$
declare v_active boolean;
begin
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c1';
  if v_active <> false then raise exception 'TEST 2b FALLO: p1 debio quedar inactivo'; end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c3';
  if v_active <> false then raise exception 'TEST 2b FALLO: p3 debio quedar inactivo'; end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c4';
  if v_active <> false then raise exception 'TEST 2b FALLO: p4 debio quedar inactivo'; end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c2';
  if v_active <> true then raise exception 'TEST 2b FALLO: p2 (tipo luz) NO debio tocarse'; end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c6';
  if v_active <> true then raise exception 'TEST 2b FALLO: p6 (sin tipo) NO debio tocarse'; end if;
  raise notice 'TEST 2b OK: exactamente p1/p3/p4 quedaron inactivos, p2/p6 intactos';
end $$;

-- Restaura p1/p3/p4 para las pruebas siguientes de BU (aislamiento entre tests).
update product_catalog set active = true where id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000c4'
);

-- =========================================================================
-- TEST 3: filtro por Business Unit (Juno) -> p1 (BU Juno), p3 (compartido,
-- 0 filas). NO p2 (aunque es BU Juno, ya está incluido -> en realidad SÍ
-- coincide, se prueba aparte). NO p4 (BU Otra, sin fila para Juno). NO p5
-- (ya inactivo). NO p6 en este caso porque test 3 aisla solo tipo=null,
-- bu=Juno: p6 es compartido (0 filas) así que SÍ coincide con cualquier BU
-- — se cuenta también.
-- =========================================================================
do $$
declare v_count integer;
begin
  v_count := rpc_bulk_deactivate_catalog_products_by_filters('00000000-0000-0000-0000-0000000000b1', null);
  -- Coinciden: p1 (BU Juno), p2 (BU Juno), p3 (compartido), p6 (compartido). NO p4 (BU Otra), NO p5 (ya inactivo).
  if v_count <> 4 then
    raise exception 'TEST 3 FALLO: se esperaban 4 productos desactivados por BU, hubo %', v_count;
  end if;
  raise notice 'TEST 3 OK: 4 productos desactivados por Business Unit (p1, p2, p3, p6) — incluye compartidos, respeta la regla "0 filas = todas"';
end $$;

do $$
declare v_active boolean;
begin
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c4';
  if v_active <> true then raise exception 'TEST 3b FALLO: p4 (BU Otra) NO debio tocarse'; end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c5';
  if v_active <> false then raise exception 'TEST 3b FALLO: p5 (ya inactivo antes) debio seguir inactivo, sin volver a contarse'; end if;
  raise notice 'TEST 3b OK: p4 (otra BU) intacto, p5 (ya inactivo) sin cambios';
end $$;

-- Restaura para la siguiente prueba.
update product_catalog set active = true where id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000c6'
);

-- =========================================================================
-- TEST 4: combinación BU (Juno) + Tipo (proyector) -> solo p1 (Juno +
-- proyector) y p3 (compartido + proyector). NO p2 (Juno pero tipo luz).
-- =========================================================================
do $$
declare v_count integer;
begin
  v_count := rpc_bulk_deactivate_catalog_products_by_filters('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');
  if v_count <> 2 then
    raise exception 'TEST 4 FALLO: se esperaban 2 productos (BU+Tipo combinados), hubo %', v_count;
  end if;
  raise notice 'TEST 4 OK: combinación BU + Tipo funciona como AND (p1, p3)';
end $$;

do $$
declare v_active boolean;
begin
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c2';
  if v_active <> true then raise exception 'TEST 4b FALLO: p2 (Juno pero tipo luz) NO debio tocarse'; end if;
  raise notice 'TEST 4b OK: p2 intacto (BU coincide pero Tipo no)';
end $$;

update product_catalog set active = true where id in (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000c3'
);

-- =========================================================================
-- TEST 5: sin filtros (p_bu null, p_tipo null) -> TODOS los activos de la
-- organización, exactamente (p1..p4, p6 — 5 productos; p5 ya inactivo no
-- cuenta).
-- =========================================================================
do $$
declare v_count integer;
begin
  v_count := rpc_bulk_deactivate_catalog_products_by_filters(null, null);
  if v_count <> 5 then
    raise exception 'TEST 5 FALLO: se esperaban 5 productos activos desactivados, hubo %', v_count;
  end if;
  raise notice 'TEST 5 OK: sin filtros desactiva exactamente los 5 productos activos de la organizacion';
end $$;

-- =========================================================================
-- TEST 6: nunca hard delete — las filas siguen existiendo, con
-- SKU/nombre/id intactos.
-- =========================================================================
do $$
declare v_count integer; v_sku text;
begin
  select count(*) into v_count from product_catalog where organization_id = '00000000-0000-0000-0000-0000000000a1';
  if v_count <> 6 then
    raise exception 'TEST 6 FALLO: deberian seguir existiendo las 6 filas de org_a, hay %', v_count;
  end if;
  select sku into v_sku from product_catalog where id = '00000000-0000-0000-0000-0000000000c1';
  if v_sku <> 'SKU-P1-78' then
    raise exception 'TEST 6 FALLO: SKU de p1 no debio cambiar, quedo %', v_sku;
  end if;
  raise notice 'TEST 6 OK: nunca hard delete — SKU/nombre/id de p1 intactos, 6 filas siguen existiendo';
end $$;

-- =========================================================================
-- TEST 7: la referencia histórica (snapshot en sales_order_items) sigue
-- intacta tras desactivar p1.
-- =========================================================================
do $$
declare v_sku_snapshot text; v_desc_snapshot text;
begin
  select sku_snapshot, description_snapshot into v_sku_snapshot, v_desc_snapshot
    from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e1';
  if v_sku_snapshot <> 'SKU-P1-78' or v_desc_snapshot <> 'Producto 1 (snapshot)' then
    raise exception 'TEST 7 FALLO: el snapshot historico cambio (sku=%, desc=%)', v_sku_snapshot, v_desc_snapshot;
  end if;
  raise notice 'TEST 7 OK: snapshot historico (sales_order_items) intacto tras la desactivacion';
end $$;

-- Restaura estado para el resto de pruebas (por si se agregan más abajo en el futuro).
update product_catalog set active = true where organization_id = '00000000-0000-0000-0000-0000000000a1' and id <> '00000000-0000-0000-0000-0000000000c5';

-- =========================================================================
-- TEST 8: cross-org — la organización SIEMPRE se resuelve del usuario que
-- llama (current_user_organization_id()), NUNCA de un parámetro, así que
-- ninguna combinación de filtros puede tocar una fila de otra
-- organización. Se invoca con el id de una BU que pertenece a org_b (no a
-- org_a): los productos de org_a "compartidos con todas" (p3, p6 — sin
-- fila propia en product_business_units) SÍ coinciden — exactamente el
-- mismo comportamiento que ya tiene filterCatalogRows en pantalla para
-- cualquier valor de `bu` que no corresponda a una fila real de un
-- producto (la regla es "0 filas = compartido", no "el id debe existir
-- realmente") — pero el producto de la OTRA organización (c9) nunca puede
-- verse afectado bajo ninguna circunstancia.
-- =========================================================================
do $$
declare v_count integer; v_active boolean;
begin
  v_count := rpc_bulk_deactivate_catalog_products_by_filters('00000000-0000-0000-0000-0000000000b9', null);
  if v_count <> 2 then
    raise exception 'TEST 8 FALLO: se esperaban 2 (los "compartidos con todas" de org_a: p3, p6), hubo %', v_count;
  end if;
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c9';
  if v_active <> true then
    raise exception 'TEST 8 FALLO: el producto de org_b nunca debio verse afectado';
  end if;
  raise notice 'TEST 8 OK: cross-org imposible — la organización se resuelve del usuario que llama, producto de org_b intacto pase lo que pase con los filtros';
end $$;

update product_catalog set active = true where id in (
  '00000000-0000-0000-0000-0000000000c3',
  '00000000-0000-0000-0000-0000000000c6'
);

select test_set_user(:'admin_orgb');
do $$
declare v_active boolean;
begin
  select active into v_active from product_catalog where id = '00000000-0000-0000-0000-0000000000c9';
  if v_active <> true then
    raise exception 'TEST 8b FALLO: producto de org_b debio seguir activo';
  end if;
  raise notice 'TEST 8b OK (verificado desde admin_orgb): producto de org_b nunca tocado por acciones en org_a';
end $$;
select test_set_user(:'admin');

select 'TODAS LAS PRUEBAS 0078 (bulk deactivate by filters) PASARON' as resultado;
rollback;
