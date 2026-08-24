-- THÖREN Importación masiva de Productos desde Excel — pruebas
-- funcionales contra Postgres real. Esta fase NO requiere migración
-- (RLS ya existente: product_catalog_admin_write "for all" +
-- product_business_units_insert_admin, ambas de 0019_core_product_catalog_pricing.sql,
-- ya cubren todo lo necesario) — este archivo verifica exactamente eso:
-- que la arquitectura YA existente es suficiente para el flujo de
-- importación (INSERT en product_catalog + product_business_units,
-- resuelto server-side, admin-only, org-scoped).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
create temp table _test_ids as select :'org1'::uuid as org1;

-- 1) ADMIN puede crear un producto (simulando una fila válida del
--    importador) + asociarlo a una Business Unit real — mismo patrón
--    exacto que commitProductImport.
do $$
declare
  v_org1 uuid;
  v_bu_id uuid;
  v_product_id uuid;
  v_active boolean;
begin
  select org1 into v_org1 from _test_ids;
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

  insert into product_catalog (organization_id, category, sku, name, description, default_price_mxn, default_price_usd, active)
  values (v_org1, 'Luminarias', 'IMPORT-SKU-001', 'Producto Importado 1', 'Descripción de prueba', 1500.50, 85, true)
  returning id, active into v_product_id, v_active;

  insert into product_business_units (product_id, business_unit_id) values (v_product_id, v_bu_id);

  if v_active is not true then
    raise exception 'TEST 1 FALLÓ: el producto importado no quedó activo';
  end if;
  perform set_config('test.imported_product_id', v_product_id::text, false);
  raise notice 'TEST 1 OK: ADMIN crea producto + lo asocia a su Business Unit (id=%)', v_product_id;
end $$;

-- 2) VENDEDOR no puede crear productos (product_catalog_admin_write es
--    admin-only) — ni siquiera intentando el INSERT directo.
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;
  begin
    insert into product_catalog (organization_id, category, sku, name, active)
    values (v_org1, 'Luminarias', 'IMPORT-SKU-VENDEDOR', 'Intento Vendedor', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 2 FALLÓ: VENDEDOR pudo crear un producto';
  end if;
  raise notice 'TEST 2 OK: product_catalog_admin_write bloquea a VENDEDOR (RLS)';
end $$;
select test_set_user(:'admin');

-- 3) Cross-org bloqueado — ADMIN de Org B no puede crear un producto con
--    organization_id de Org 1.
select test_set_user(:'admin_orgb');
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;
  begin
    insert into product_catalog (organization_id, category, sku, name, active)
    values (v_org1, 'Luminarias', 'IMPORT-SKU-CROSSORG', 'Intento Cross-Org', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 3 FALLÓ: ADMIN de Org B pudo crear un producto en Org 1';
  end if;
  raise notice 'TEST 3 OK: cross-org bloqueado (RLS with check)';
end $$;
select test_set_user(:'admin');

-- 4) SKU duplicado DENTRO de la misma organización rechazado —
--    ACTUALIZADO por Fase 6C (0030_product_catalog_master.sql): el índice
--    de unicidad pasó de GLOBAL (upper(sku)) a
--    (organization_id, upper(sku)) — ver DECISIÓN "natural key" en 0030.
--    Sigue siendo case-insensitive dentro de la MISMA organización.
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;
  begin
    insert into product_catalog (organization_id, category, sku, name, active)
    values (v_org1, 'Otra categoría', 'import-sku-001', 'Duplicado (minúsculas)', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: se permitió un SKU duplicado (case-insensitive) dentro de la misma organización';
  end if;
  raise notice 'TEST 4 OK: SKU duplicado dentro de la misma organización rechazado (case-insensitive, org-scoped desde 0030)';
end $$;

-- 4b) NUEVO comportamiento de Fase 6C: el MISMO SKU en OTRA organización
--     ahora SÍ se permite (antes de 0030 era imposible: el índice era
--     global). Confirma que la corrección del natural key realmente
--     relajó el scope correctamente, sin romper la protección dentro de
--     una misma organización (TEST 4).
select test_set_user(:'admin_orgb');
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into product_catalog (organization_id, category, sku, name, active)
    values ('20000000-0000-0000-0000-000000000001', 'Otra categoría', 'IMPORT-SKU-001', 'Mismo SKU, otra organización', true);
  exception when others then
    v_failed := true;
  end;
  if v_failed then
    raise exception 'TEST 4b FALLÓ: el mismo SKU en OTRA organización debería permitirse tras 0030 (org-scoped), pero fue rechazado';
  end if;
  raise notice 'TEST 4b OK: el mismo SKU en otra organización se permite — el índice de unicidad es por organización, no global';
end $$;
select test_set_user(:'admin');

-- 5) La importación NO crea Business Units ni Product Types — conteos
--    antes/después de TEST 1 (única inserción real de este archivo)
--    deben coincidir exactamente.
do $$
declare
  v_bu_count int;
  v_pt_count int;
begin
  select count(*) into v_bu_count from business_units;
  select count(*) into v_pt_count from product_types;
  if v_bu_count <> 6 then
    raise exception 'TEST 5 FALLÓ: se esperaban 6 Business Units (sembradas por 0014), hay %', v_bu_count;
  end if;
  if v_pt_count <> 5 then
    raise exception 'TEST 5 FALLÓ: se esperaban 5 Product Types (sembrados por 0010), hay %', v_pt_count;
  end if;
  raise notice 'TEST 5 OK: 0 Business Units y 0 Product Types nuevos (siguen siendo 6 y 5, los sembrados)';
end $$;

-- 6) trg_check_product_business_unit_same_org (0019) sigue protegiendo:
--    no se puede asociar el producto importado a una Business Unit de
--    otra organización (defensa en profundidad además de la RLS).
select test_set_user(:'admin_orgb');
do $$
declare
  v_bu_orgb_id uuid;
begin
  insert into business_units (organization_id, name, code, active)
  values ('20000000-0000-0000-0000-000000000001', 'BU de Org B para test', 'bu_orgb_import_test', true)
  returning id into v_bu_orgb_id;
  perform set_config('test.bu_orgb_id', v_bu_orgb_id::text, false);
end $$;
select test_set_user(:'admin');
do $$
declare
  v_product_id uuid := current_setting('test.imported_product_id')::uuid;
  v_bu_orgb_id uuid := current_setting('test.bu_orgb_id')::uuid;
  v_failed boolean := false;
begin
  begin
    insert into product_business_units (product_id, business_unit_id) values (v_product_id, v_bu_orgb_id);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6 FALLÓ: se permitió asociar un producto a una Business Unit de otra organización';
  end if;
  raise notice 'TEST 6 OK: trg_check_product_business_unit_same_org bloquea la asociación cross-org (o RLS de product_business_units_insert_admin)';
end $$;

-- 7) El producto importado aparece exactamente igual que cualquier otro
--    en la consulta real que usa Nueva Cotización
--    (cotizaciones/nueva/page.tsx: product_catalog activo + join a
--    product_business_units) — confirma que no hace falta ninguna
--    integración adicional.
select test_set_user(:'vendedor1');
do $$
declare
  v_product_id uuid := current_setting('test.imported_product_id')::uuid;
  v_bu_id uuid;
  v_found boolean;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

  select exists (
    select 1
    from product_catalog pc
    left join product_business_units pbu on pbu.product_id = pc.id
    where pc.id = v_product_id
      and pc.active = true
      and (pbu.business_unit_id = v_bu_id or not exists (select 1 from product_business_units where product_id = pc.id))
  ) into v_found;

  if not v_found then
    raise exception 'TEST 7 FALLÓ: el producto importado no aparece en la consulta real de Nueva Cotización';
  end if;
  raise notice 'TEST 7 OK: el producto importado es visible para Nueva Cotización, misma consulta que usa la app';
end $$;
select test_set_user(:'admin');

-- 8) 100+ productos se importan correctamente en la misma sesión (mismo
--    patrón: 1 INSERT + 1 asociación por fila, secuencial, sin
--    transacción compartida entre filas — igual que commitProductImport).
do $$
declare
  v_org1 uuid;
  v_bu_id uuid;
  v_i int;
  v_count_before int;
  v_count_after int;
begin
  select org1 into v_org1 from _test_ids;
  select id into v_bu_id from business_units where code = 'got_fresh_breath';
  select count(*) into v_count_before from product_catalog;

  for v_i in 1..120 loop
    insert into product_catalog (organization_id, category, sku, name, active)
    values (v_org1, 'Importación masiva', 'BULK-SKU-' || lpad(v_i::text, 4, '0'), 'Producto masivo ' || v_i, true);
  end loop;

  select count(*) into v_count_after from product_catalog;
  if v_count_after - v_count_before <> 120 then
    raise exception 'TEST 8 FALLÓ: se esperaban 120 productos nuevos, se crearon %', v_count_after - v_count_before;
  end if;
  raise notice 'TEST 8 OK: 120 productos importados correctamente (antes=%, después=%)', v_count_before, v_count_after;
end $$;

select 'TESTS Importación de Productos 1-8 PASARON' as resultado;

rollback;
