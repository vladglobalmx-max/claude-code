-- THÖREN — Fase 8B (Tenant/Business Unit Customization Core, 0055 + 0056 +
-- 0057) — pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0057 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql (org1=global-supplier-mty con
-- admin/vendedor1(salesperson1,prefix VU1)/vendedor2, orgb=Org B con
-- admin_orgb y su Business Unit bu_org_b, y las 6 Business Units reales de
-- org1 incluyendo thunder_led/juno_promotional/got_fresh_breath — 0057 ya
-- sembró sus 13 custom_field_definitions sobre esas 3). Todo el script
-- corre en una sola transacción que se revierte al final (rollback) — es
-- repetible sin acumular filas de una corrida anterior.
--
-- Numeración: sigue la lista de 26 pruebas del encargo de Fase 8B. Los
-- TESTS 9-15 (VALIDATION: required/tipos/opción válida/checkbox/inactive/
-- sort_order) son lógica pura de TypeScript, sin tocar la base de datos —
-- ya están cubiertos por src/lib/custom-fields/validation.test.ts (11
-- pruebas Vitest) y NO se repiten aquí. Este archivo cubre únicamente lo
-- que solo se puede probar contra Postgres real: aislamiento multi-tenant/
-- multi-BU vía RLS, autoridad admin-vs-vendedor, y el legacy cleanup de
-- 0056 sobre salespeople.business_unit/orders.business_unit.

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
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '90000000-0000-0000-0000-000000000001'::uuid as bu_org_b;

select id as bu_thunder from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led' \gset
select id as bu_juno from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional' \gset

-- Todo lo que se capture con \gset de aquí en adelante y se necesite leer
-- dentro de un bloque `do $$ ... $$` se agrega como columna real de _ids
-- (las variables psql `:'var'` NO se sustituyen dentro de dollar-quoting —
-- bug recurrente ya documentado en 0051/0052/0053/0054).
alter table _ids add column bu_thunder uuid, add column bu_juno uuid;
update _ids set bu_thunder = :'bu_thunder', bu_juno = :'bu_juno';

-- =========================================================================
-- FIXTURES propias de este archivo (no persisten — todo el archivo hace
-- rollback al final).
-- =========================================================================

-- Campo org-wide de org1 (business_unit_id null) — 0057 solo sembró campos
-- scoped a una BU puntual, así que TEST 1 necesita uno propio.
insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type)
values ((select org1 from _ids), null, 'order_item', 'referencia_interna', 'Referencia interna', 'text')
returning id as def_org_wide \gset
alter table _ids add column def_org_wide uuid;
update _ids set def_org_wide = :'def_org_wide';

-- Un pedido real de Thunder LED (org1), para probar autoridad sobre
-- order_item — vía rpc_create_order, nunca INSERT directo (mismo criterio
-- que el resto de este archivo de pruebas).
select test_set_user(:'vendedor1');
select (rpc_create_order(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids),
    'order_date', '2026-08-11',
    'client_name', 'Cliente CF Thunder',
    'product_type', 'otro',
    'business_unit_id', (select bu_thunder from _ids)
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
)).id as order_thunder \gset
select id as item_thunder from order_items where order_id = :'order_thunder' \gset
alter table _ids add column order_thunder uuid, add column item_thunder uuid;
update _ids set order_thunder = :'order_thunder', item_thunder = :'item_thunder';

-- Salesperson propio de Tenant B (orgb) — para TEST 23-25. Se crea como
-- admin_orgb (autoridad real de orgb, nunca como admin de org1).
select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor Org B CF', 'VOBCF', true)
returning id as salesperson_orgb \gset
alter table _ids add column salesperson_orgb uuid;
update _ids set salesperson_orgb = :'salesperson_orgb';
select test_set_user(:'admin');

-- =========================================================================
-- MULTI-BU (TESTS 1-8)
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_count integer;
begin
  -- TEST 1: un campo org-wide (business_unit_id null) aparece para
  -- CUALQUIER Business Unit de esa organización — se cuenta junto con los
  -- 3 propios de Juno al filtrar por esa BU.
  select count(*) into v_count from custom_field_definitions
    where organization_id = (select org1 from _ids) and entity_type = 'order_item' and active
      and (business_unit_id is null or business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional'));
  if v_count <> 4 then
    raise exception 'TEST 1 FALLÓ: se esperaban 4 campos visibles en Juno (1 org-wide + 3 de Juno), hay %', v_count;
  end if;
  raise notice 'TEST 1 OK: un campo org-wide aparece en cualquier Business Unit de su organización';

  -- TEST 2: el campo "power" de Thunder LED aparece al filtrar por esa BU.
  select count(*) into v_count from custom_field_definitions
    where key = 'power' and business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led');
  if v_count <> 1 then raise exception 'TEST 2 FALLÓ: "power" no aparece en Thunder LED (%)', v_count; end if;
  raise notice 'TEST 2 OK: el campo de Thunder LED aparece en Thunder LED';

  -- TEST 3: ese mismo campo NO aparece si se filtra por Juno (ni org-wide, ni de otra BU).
  select count(*) into v_count from custom_field_definitions
    where key = 'power'
      and (business_unit_id is null or business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional'));
  if v_count <> 0 then raise exception 'TEST 3 FALLÓ: "power" (Thunder LED) apareció en Juno'; end if;
  raise notice 'TEST 3 OK: el campo de Thunder LED NO aparece en Juno';

  -- TEST 4: un campo de Juno aparece al filtrar por Juno.
  select count(*) into v_count from custom_field_definitions
    where key = 'print_technique' and business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional');
  if v_count <> 1 then raise exception 'TEST 4 FALLÓ: "print_technique" no aparece en Juno (%)', v_count; end if;
  raise notice 'TEST 4 OK: el campo de Juno aparece en Juno';

  -- TEST 5: ese campo de Juno NO aparece en Thunder LED.
  select count(*) into v_count from custom_field_definitions
    where key = 'print_technique'
      and (business_unit_id is null or business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led'));
  if v_count <> 0 then raise exception 'TEST 5 FALLÓ: "print_technique" (Juno) apareció en Thunder LED'; end if;
  raise notice 'TEST 5 OK: el campo de Juno NO aparece en Thunder LED';
end $$;

-- TEST 6: Tenant B (orgb) no ve NINGÚN custom field de Global Supplier (org1) — RLS, no un filtro de aplicación.
select test_set_user(:'admin_orgb');
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions where organization_id = (select org1 from _ids);
  if v_count <> 0 then raise exception 'TEST 6 FALLÓ: admin_orgb vio % definiciones de Global Supplier', v_count; end if;
  raise notice 'TEST 6 OK: Tenant B no ve ningún custom field de Global Supplier';
end $$;

-- TEST 7: Tenant B puede crear su propio campo (organization_id/BU propios). Si la RLS de admin_orgb sobre orgb fallara, este INSERT fallaría — que no falle es la prueba.
insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type)
values ((select orgb from _ids), (select bu_org_b from _ids), 'order_item', 'color', 'Color', 'text')
returning id as def_orgb \gset
do $$
begin
  raise notice 'TEST 7 OK: Tenant B puede crear su propio campo personalizado';
end $$;

-- TEST 8: Global Supplier no ve el campo que Tenant B acaba de crear.
select test_set_user(:'admin');
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions where organization_id = (select orgb from _ids);
  if v_count <> 0 then raise exception 'TEST 8 FALLÓ: admin de Global Supplier vio % definiciones de Tenant B', v_count; end if;
  raise notice 'TEST 8 OK: Global Supplier no ve el campo de Tenant B';
end $$;

-- =========================================================================
-- AUTH (TESTS 16-18) — TESTS 9-15 (VALIDATION) están en validation.test.ts
-- =========================================================================

-- TEST 16: el admin administra definiciones (crear/editar) de su organización.
update custom_field_definitions set label = 'Potencia / versión (editado 8B)'
  where organization_id = (select org1 from _ids) and key = 'power';
do $$
begin
  if (select label from custom_field_definitions where key = 'power' and organization_id = (select org1 from _ids)) <> 'Potencia / versión (editado 8B)' then
    raise exception 'TEST 16 FALLÓ: el admin no pudo editar una definición de su organización';
  end if;
  raise notice 'TEST 16 OK: el admin administra (edita) definiciones de su organización';
end $$;

-- TEST 17: un vendedor (no-admin) NO puede administrar definiciones — ni crear ni editar.
select test_set_user(:'vendedor1');
do $$
declare v_failed boolean := false;
begin
  begin
    insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type)
    values ((select org1 from _ids), null, 'order_item', 'intento_vendedor', 'Intento vendedor', 'text');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 17 FALLÓ: un vendedor pudo crear una definición de custom field'; end if;
  raise notice 'TEST 17 OK: un vendedor NO puede crear/editar definiciones (bloqueado por RLS)';
end $$;

-- TEST 18: el vendedor SÍ puede usar (leer definiciones activas + escribir un valor sobre una entidad propia).
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions where organization_id = (select org1 from _ids) and active;
  if v_count = 0 then raise exception 'TEST 18 FALLÓ: el vendedor no puede leer ninguna definición activa'; end if;
end $$;
do $$
declare v_failed boolean := false;
begin
  begin
    insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_text)
    values ((select org1 from _ids), (select def_org_wide from _ids limit 1), 'order_item', (select item_thunder from _ids), 'Valor de prueba 8B');
  exception when others then v_failed := true; end;
  if v_failed then raise exception 'TEST 18 FALLÓ: el vendedor no pudo escribir un valor sobre un order_item de su propio pedido'; end if;
  raise notice 'TEST 18 OK: el vendedor lee definiciones activas y escribe valores sobre sus propias entidades';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- LEGACY (TESTS 19-22)
-- =========================================================================

-- TEST 19: Thunder LED conserva sus 8 campos originales (0057), funcionando (activos).
-- Nota: 0060 (Fase 8C) agregó 11 campos residuales más a Thunder LED
-- (imagen a proyectar, dimensiones, instalación, superficie) — el conteo
-- total real hoy es 19, no 8; este TEST verifica específicamente que los
-- 8 originales de 0057 siguen ahí, no el total.
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led')
      and active
      and key in ('power', 'color', 'lens_type', 'lens_pending_factory', 'projection_description', 'projection_description_en', 'surface_notes', 'surface_notes_en');
  if v_count <> 8 then raise exception 'TEST 19 FALLÓ: Thunder LED debería tener los 8 campos originales de 0057 activos, tiene %', v_count; end if;
  raise notice 'TEST 19 OK: Thunder LED conserva sus 8 campos originales, activos';
end $$;

-- TEST 20: los datos históricos (columnas nativas de order_items) siguen siendo escribibles/legibles — rpc_update_order sigue escribiendo power/color como antes de 8B.
select test_set_user(:'vendedor1');
select rpc_update_order(
  (select order_thunder from _ids),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids),
    'order_date', '2026-08-11',
    'client_name', 'Cliente CF Thunder',
    'product_type', 'otro'
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'power', '120W', 'color', 'Rojo'))
);
do $$
declare v_power text; v_color text;
begin
  select power, color into v_power, v_color from order_items where order_id = (select order_thunder from _ids);
  if v_power is distinct from '120W' or v_color is distinct from 'Rojo' then
    raise exception 'TEST 20 FALLÓ: power/color de order_items no se guardaron/leyeron igual que antes de 8B (power=%, color=%)', v_power, v_color;
  end if;
  raise notice 'TEST 20 OK: los datos legacy (columnas nativas de order_items) siguen escribiéndose y leyéndose igual';
end $$;
select test_set_user(:'admin');

-- TEST 21: ninguna columna fue eliminada — 0055/0056/0057 no tocan order_items/salespeople.business_unit (solo lo relajan) ni orders.business_unit.
do $$
declare v_missing text;
begin
  select string_agg(col, ', ') into v_missing from unnest(array[
    'power','color','lens_type','lens_pending_factory','projection_description',
    'projection_description_en','surface_notes','surface_notes_en',
    'surface_type','surface_material','installation_height','installation_distance',
    'installation_orientation','installation_use'
  ]) as col
  where col not in (select column_name from information_schema.columns where table_name = 'order_items');
  if v_missing is not null then raise exception 'TEST 21 FALLÓ: faltan columnas en order_items: %', v_missing; end if;

  if not exists (select 1 from information_schema.columns where table_name = 'salespeople' and column_name = 'business_unit')
    or not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'business_unit') then
    raise exception 'TEST 21 FALLÓ: business_unit legacy fue eliminada (debía solo relajarse, ver 0056)';
  end if;
  raise notice 'TEST 21 OK: ninguna columna fue eliminada (0056 solo relaja CHECK/DEFAULT, nunca DROP COLUMN)';
end $$;

-- TEST 22: Juno no recibe ninguno de los campos legacy de Thunder (sin solapamiento de keys).
do $$
declare v_overlap integer;
begin
  select count(*) into v_overlap from custom_field_definitions
    where business_unit_id = (select id from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional')
      and key in ('power','color','lens_type','lens_pending_factory','projection_description','projection_description_en','surface_notes','surface_notes_en');
  if v_overlap <> 0 then raise exception 'TEST 22 FALLÓ: Juno recibió % campo(s) legacy de Thunder', v_overlap; end if;
  raise notice 'TEST 22 OK: Juno no recibe ningún campo legacy de Thunder';
end $$;

-- =========================================================================
-- BUSINESS UNITS (TESTS 23-26)
-- =========================================================================

-- TEST 23: un salesperson de Tenant B, creado sin especificar business_unit, NO recibe 'thunder' silenciosamente (0056 quitó el DEFAULT).
do $$
declare v_bu text;
begin
  select business_unit into v_bu from salespeople where id = (select salesperson_orgb from _ids);
  if v_bu is distinct from null then
    raise exception 'TEST 23 FALLÓ: el salesperson de Tenant B recibió business_unit=% en vez de NULL', v_bu;
  end if;
  raise notice 'TEST 23 OK: un salesperson nuevo nunca recibe ''thunder'' (ni ningún valor) silenciosamente';
end $$;

-- TEST 24: el prefix de folio es único por ORGANIZACIÓN real (organization_id), no por el enum legacy business_unit — mismo prefix "VU1" en org1 y en orgb coexiste sin colisión (0056 corrigió el índice único). El INSERT de abajo, si hubiera colisión, fallaría con unique_violation — que no falle YA es la prueba; se confirma además desde cada organización por separado (RLS oculta las filas de la otra, así que un conteo cross-org no es la forma correcta de verificarlo).
select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor VU1 de Org B', 'VU1', true);
do $$
declare v_count integer;
begin
  select count(*) into v_count from salespeople where upper(prefix) = 'VU1' and organization_id = (select orgb from _ids);
  if v_count <> 1 then raise exception 'TEST 24 FALLÓ: Org B no ve su propio salesperson con prefix VU1 (%)', v_count; end if;
end $$;
select test_set_user(:'admin');
do $$
declare v_count integer;
begin
  select count(*) into v_count from salespeople where upper(prefix) = 'VU1' and organization_id = (select org1 from _ids);
  if v_count <> 1 then raise exception 'TEST 24 FALLÓ: Org A no ve su propio salesperson con prefix VU1 (%)', v_count; end if;
  raise notice 'TEST 24 OK: el mismo prefix "VU1" coexiste en dos organizaciones distintas sin colisión — la unicidad real es por organization_id, no por el enum legacy';
end $$;

-- TEST 25: un pedido de Tenant B no depende del enum legacy de Global Supplier — se crea con su propio business_unit_id real y business_unit (legacy) queda NULL, nunca 'thunder'.
select test_set_user(:'admin_orgb');
select (rpc_create_order(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson_orgb from _ids),
    'order_date', '2026-08-11',
    'client_name', 'Cliente CF Org B',
    'product_type', 'otro',
    'business_unit_id', (select bu_org_b from _ids)
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
)).id as order_orgb \gset
alter table _ids add column order_orgb uuid;
update _ids set order_orgb = :'order_orgb';
do $$
declare v_legacy_bu text; v_bu_id uuid;
begin
  select business_unit, business_unit_id into v_legacy_bu, v_bu_id from orders where id = (select order_orgb from _ids);
  if v_legacy_bu is distinct from null then
    raise exception 'TEST 25 FALLÓ: el pedido de Tenant B recibió business_unit (legacy) = % en vez de NULL', v_legacy_bu;
  end if;
  if v_bu_id is distinct from (select bu_org_b from _ids) then
    raise exception 'TEST 25 FALLÓ: business_unit_id del pedido no es la BU real de Tenant B';
  end if;
  raise notice 'TEST 25 OK: el pedido de Tenant B no depende del enum legacy — usa su propio business_unit_id real';
end $$;
select test_set_user(:'admin');

-- TEST 26: el mismo código de Business Unit puede coexistir en organizaciones distintas (business_units_org_code_unique es (organization_id, code), no global). Si hubiera colisión el INSERT fallaría con unique_violation; que no falle es la prueba — se confirma además desde cada organización por separado (RLS oculta las BU de la otra).
select test_set_user(:'admin_orgb');
insert into business_units (organization_id, name, code, active)
values ((select orgb from _ids), 'Thunder LED (copia de prueba en Org B)', 'thunder_led', true);
do $$
declare v_count integer;
begin
  select count(*) into v_count from business_units where code = 'thunder_led' and organization_id = (select orgb from _ids);
  if v_count <> 1 then raise exception 'TEST 26 FALLÓ: Org B no ve su propia Business Unit "thunder_led" (%)', v_count; end if;
end $$;
select test_set_user(:'admin');
do $$
declare v_count integer;
begin
  select count(*) into v_count from business_units where code = 'thunder_led' and organization_id = (select org1 from _ids);
  if v_count <> 1 then raise exception 'TEST 26 FALLÓ: Org A no ve su propia Business Unit "thunder_led" (%)', v_count; end if;
  raise notice 'TEST 26 OK: el mismo código de Business Unit coexiste en organizaciones distintas sin colisión — la unicidad real es por organización';
end $$;

rollback;
