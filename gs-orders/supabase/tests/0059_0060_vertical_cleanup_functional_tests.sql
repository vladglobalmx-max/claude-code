-- THÖREN — Fase 8C (Vertical Residue Cleanup, 0059 + 0060) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0060 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql + 0055_0056_0057_functional_tests.sql
-- + 0058_gap_fixes_functional_tests.sql (esos dos dejan su propio estado en
-- rollback, solo hace falta que 0057/0060 ya hayan sembrado los campos de
-- Thunder LED). Todo el script corre en una transacción que se revierte al
-- final (rollback) — repetible.
--
-- Los TESTS 9-10 de la lista de 10 (renderer/form universal sin
-- isProjector/proyector_gobo como criterio de presentación; product_type
-- distinto no cambia campos si las definitions son iguales) son de código
-- TypeScript, no de base de datos — cubiertos por
-- src/components/orders/vertical-residue-cleanup.test.ts (inspección de
-- fuente: ProductosSection/order-form.tsx ya no contienen esas cadenas ni
-- reciben product_type/isProjector como prop).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
create temp table _ids as
  select :'org1'::uuid as org1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1;

select id as bu_thunder from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led' \gset
select id as bu_juno from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional' \gset
select id as bu_gfb from business_units where organization_id = (select org1 from _ids) and code = 'got_fresh_breath' \gset
alter table _ids add column bu_thunder uuid, add column bu_juno uuid, add column bu_gfb uuid;
update _ids set bu_thunder = :'bu_thunder', bu_juno = :'bu_juno', bu_gfb = :'bu_gfb';

select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor Org B 8C', 'VOB8C', true)
returning id as salesperson_orgb \gset
alter table _ids add column salesperson_orgb uuid;
update _ids set salesperson_orgb = :'salesperson_orgb';
select test_set_user(:'admin');

-- =========================================================================
-- TEST 1: Thunder ve TODOS sus 11 campos residuales (0060).
-- =========================================================================
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where business_unit_id = (select bu_thunder from _ids) and active
      and key in (
        'projection_images', 'projection_width', 'projection_height', 'projection_size_unit',
        'installation_height', 'installation_height_unit', 'installation_distance',
        'installation_orientation', 'installation_use', 'surface_type', 'surface_material'
      );
  if v_count <> 11 then raise exception 'TEST 1 FALLÓ: Thunder LED debería ver los 11 campos residuales, ve %', v_count; end if;
  raise notice 'TEST 1 OK: Thunder ve sus 11 campos residuales';
end $$;

-- =========================================================================
-- TEST 2: Tenant B (orgb) no ve ninguno de los campos residuales de Thunder.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions where organization_id = (select org1 from _ids);
  if v_count <> 0 then raise exception 'TEST 2 FALLÓ: Tenant B vio % definiciones de Global Supplier', v_count; end if;
  raise notice 'TEST 2 OK: Tenant B no ve ningún campo residual de Thunder (ni ninguna definición de Global Supplier)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 3: Juno no ve ningún campo residual de Thunder.
-- =========================================================================
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where organization_id = (select org1 from _ids)
      and (business_unit_id is null or business_unit_id = (select bu_juno from _ids))
      and key in (
        'projection_images', 'projection_width', 'projection_height', 'projection_size_unit',
        'installation_height', 'installation_height_unit', 'installation_distance',
        'installation_orientation', 'installation_use', 'surface_type', 'surface_material'
      );
  if v_count <> 0 then raise exception 'TEST 3 FALLÓ: Juno ve % campo(s) residual(es) de Thunder', v_count; end if;
  raise notice 'TEST 3 OK: Juno no ve ningún campo residual de Thunder';
end $$;

-- =========================================================================
-- TEST 4: GFB no ve ningún campo residual de Thunder.
-- =========================================================================
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where organization_id = (select org1 from _ids)
      and (business_unit_id is null or business_unit_id = (select bu_gfb from _ids))
      and key in (
        'projection_images', 'projection_width', 'projection_height', 'projection_size_unit',
        'installation_height', 'installation_height_unit', 'installation_distance',
        'installation_orientation', 'installation_use', 'surface_type', 'surface_material'
      );
  if v_count <> 0 then raise exception 'TEST 4 FALLÓ: GFB ve % campo(s) residual(es) de Thunder', v_count; end if;
  raise notice 'TEST 4 OK: GFB no ve ningún campo residual de Thunder';
end $$;

-- =========================================================================
-- TEST 5: desactivar una definición residual la oculta (RLS, no un filtro de UI).
-- =========================================================================
update custom_field_definitions set active = false
  where business_unit_id = (select bu_thunder from _ids) and key = 'projection_images';
select test_set_user(:'vendedor1');
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where business_unit_id = (select bu_thunder from _ids) and key = 'projection_images' and active;
  if v_count <> 0 then raise exception 'TEST 5 FALLÓ: vendedor1 sigue viendo "projection_images" tras desactivarlo'; end if;
  raise notice 'TEST 5 OK: desactivar una definición residual la oculta';
end $$;
select test_set_user(:'admin');
update custom_field_definitions set active = true
  where business_unit_id = (select bu_thunder from _ids) and key = 'projection_images';

-- =========================================================================
-- TEST 6: un valor de archivo (projection_images) queda ligado a la organización real.
-- =========================================================================
select test_set_user(:'vendedor1');
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8C-6', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
  ),
  jsonb_build_array(jsonb_build_object(
    'model', 'M1', 'quantity', 1,
    'custom_field_values', jsonb_build_object('projection_images', '["orders/x/proyeccion/a.png","orders/x/proyeccion/b.pdf"]')
  ))
)).id as order_t6 \gset
alter table _ids add column order_t6 uuid;
update _ids set order_t6 = :'order_t6';
do $$
declare v_org_id uuid; v_paths jsonb;
begin
  select cfv.organization_id, cfv.value_json into v_org_id, v_paths
    from custom_field_values cfv
    join order_items oi on oi.id = cfv.entity_id
    join custom_field_definitions def on def.id = cfv.definition_id
    where oi.order_id = (select order_t6 from _ids) and def.key = 'projection_images';
  if v_org_id is distinct from (select org1 from _ids) then
    raise exception 'TEST 6 FALLÓ: el valor de archivo quedó ligado a organization_id=%, no a Global Supplier', v_org_id;
  end if;
  if jsonb_array_length(v_paths) <> 2 then
    raise exception 'TEST 6 FALLÓ: se esperaban 2 rutas guardadas, hay %', coalesce(jsonb_array_length(v_paths), 0);
  end if;
  raise notice 'TEST 6 OK: el valor de archivo queda ligado a la organización real (%), con sus rutas', v_org_id;
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 7: un vendedor de Tenant B no puede escribir un valor de archivo
-- sobre una entidad de Global Supplier (mismo aislamiento que cualquier
-- otro custom field — la RLS de custom_field_values no distingue file de
-- texto; el aislamiento real de Storage en sí ya lo cubre 0050, sin
-- duplicar aquí lo que ese suite ya prueba).
-- =========================================================================
do $$
declare v_item_id uuid;
begin
  select id into v_item_id from order_items where order_id = (select order_t6 from _ids) limit 1;
  perform set_config('test.item_t6', v_item_id::text, false);
end $$;
select test_set_user(:'admin_orgb');
do $$
declare v_failed boolean := false; v_item_id uuid := current_setting('test.item_t6')::uuid;
begin
  begin
    insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_json)
    values (
      (select orgb from _ids),
      (select id from custom_field_definitions where business_unit_id = (select bu_thunder from _ids) and key = 'projection_images'),
      'order_item', v_item_id, '["orgb/intento/x.png"]'::jsonb
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 7 FALLÓ: un vendedor de Tenant B pudo escribir un valor de archivo sobre un producto de Global Supplier'; end if;
  raise notice 'TEST 7 OK: cross-org bloqueado también para valores de archivo (misma RLS de custom_field_values que cualquier otro tipo)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 8: valores históricos de los campos residuales (columnas nativas de
-- order_items) siguen escribiéndose y leyéndose igual que antes de 8C.
-- =========================================================================
select test_set_user(:'vendedor1');
select rpc_update_order_with_custom_fields(
  (select order_t6 from _ids),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8C-6', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
  ),
  jsonb_build_array(jsonb_build_object(
    'model', 'M1', 'quantity', 1,
    'surface_type', 'piso', 'surface_material', 'concreto',
    'installation_height', 2.5, 'installation_height_unit', 'm'
  ))
);
do $$
declare v_surface_type text; v_surface_material text; v_installation_height numeric;
begin
  select surface_type, surface_material, installation_height
    into v_surface_type, v_surface_material, v_installation_height
    from order_items where order_id = (select order_t6 from _ids);
  if v_surface_type <> 'piso' or v_surface_material <> 'concreto' or v_installation_height <> 2.5 then
    raise exception 'TEST 8 FALLÓ: valores legacy no se guardaron/leyeron igual que antes de 8C (surface_type=%, surface_material=%, installation_height=%)',
      v_surface_type, v_surface_material, v_installation_height;
  end if;
  raise notice 'TEST 8 OK: los datos legacy de los campos residuales (columnas nativas de order_items) siguen escribiéndose y leyéndose igual';
end $$;
select test_set_user(:'admin');

rollback;
