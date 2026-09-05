-- THÖREN — Fase 8B, GAP FIXES (post-aprobación del modelo general) —
-- pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0058 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql + 0055_0056_0057_functional_tests.sql
-- (ese archivo deja su propio estado en rollback, así que no deja nada
-- persistente — solo hace falta que 0057 ya haya sembrado los campos de
-- Thunder LED). Todo el script corre en una transacción que se revierte al
-- final (rollback) — repetible.
--
-- GAP 1 (desacople de "proyector_gobo" del renderer universal): la lógica
-- de qué se muestra ahora vive enteramente en custom_field_definitions y
-- ya se probó en 0055_0056_0057_functional_tests.sql (TESTS 1-5, mismo
-- scoping que usa ProductosSection). Este archivo agrega el único caso
-- nuevo que requiere Postgres real: TEST G1-5, desactivar una definición
-- la vuelve invisible para un vendedor vía RLS (no un filtro de
-- aplicación).
--
-- GAP 2 (guardado atómico): prueba rpc_create_order_with_custom_fields /
-- rpc_update_order_with_custom_fields (0058) — TESTS G2-9 a G2-17.

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
alter table _ids add column bu_thunder uuid;
update _ids set bu_thunder = :'bu_thunder';

-- Fixtures propias de este archivo — no persisten (rollback al final).
insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type, required)
values ((select org1 from _ids), (select bu_thunder from _ids), 'order_item', 'gap2_required_field', 'Campo requerido de prueba', 'text', true)
returning id as def_required \gset
alter table _ids add column def_required uuid;
update _ids set def_required = :'def_required';

insert into custom_field_definitions (organization_id, business_unit_id, entity_type, key, label, field_type, options)
values ((select org1 from _ids), (select bu_thunder from _ids), 'order_item', 'gap2_select_field', 'Selección de prueba', 'select', '["A", "B"]'::jsonb)
returning id as def_select \gset
alter table _ids add column def_select uuid;
update _ids set def_select = :'def_select';

select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor Org B Gap2', 'VOBG2', true)
returning id as salesperson_orgb \gset
alter table _ids add column salesperson_orgb uuid;
update _ids set salesperson_orgb = :'salesperson_orgb';
select test_set_user(:'admin');

-- =========================================================================
-- GAP 1 — TEST G1-5: desactivar una definición Thunder la oculta vía RLS
-- (no un filtro de aplicación) — el renderer universal jamás llega a
-- recibirla desde el servidor.
-- =========================================================================
update custom_field_definitions set active = false where organization_id = (select org1 from _ids) and key = 'power';
select test_set_user(:'vendedor1');
do $$
declare v_count integer;
begin
  select count(*) into v_count from custom_field_definitions
    where organization_id = (select org1 from _ids) and key = 'power' and active;
  if v_count <> 0 then raise exception 'TEST G1-5 FALLÓ: vendedor1 sigue viendo "power" después de desactivarlo'; end if;
  raise notice 'TEST G1-5 OK: al desactivar una definición, un vendedor deja de verla (RLS, no un filtro de UI)';
end $$;
select test_set_user(:'admin');
update custom_field_definitions set active = true where organization_id = (select org1 from _ids) and key = 'power';

-- =========================================================================
-- GAP 2 — guardado atómico (0058)
-- =========================================================================

-- TEST G2-9: create order + custom field válido (incluye el requerido) → todo persiste junto.
select test_set_user(:'vendedor1');
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids),
    'order_date', '2026-08-11',
    'client_name', 'Cliente Gap2-9',
    'product_type', 'otro',
    'business_unit_id', (select bu_thunder from _ids)
  ),
  jsonb_build_array(jsonb_build_object(
    'model', 'M1', 'quantity', 1,
    'custom_field_values', jsonb_build_object('gap2_required_field', 'valor válido')
  ))
)).id as order_g9 \gset
alter table _ids add column order_g9 uuid;
update _ids set order_g9 = :'order_g9';
do $$
declare v_item_id uuid; v_value text;
begin
  select id into v_item_id from order_items where order_id = (select order_g9 from _ids);
  select value_text into v_value from custom_field_values
    where entity_type = 'order_item' and entity_id = v_item_id and definition_id = (select def_required from _ids);
  if v_value is distinct from 'valor válido' then
    raise exception 'TEST G2-9 FALLÓ: el custom field no se guardó junto con el pedido (valor=%)', v_value;
  end if;
  raise notice 'TEST G2-9 OK: create atómico — pedido y custom field válido persisten juntos';
end $$;

-- TEST G2-10: required faltante → el pedido NO se crea (rollback completo, no solo el custom field).
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente Gap2-10', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'custom_field_values', '{}'::jsonb))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST G2-10 FALLÓ: se creó un pedido sin su campo requerido'; end if;
  if exists (select 1 from orders where id = v_order_id) then
    raise exception 'TEST G2-10 FALLÓ: el pedido quedó creado a pesar del error de validación (no hubo rollback real)';
  end if;
  raise notice 'TEST G2-10 OK: required faltante bloquea la creación completa del pedido (rollback real)';
end $$;

-- TEST G2-11 / G2-15: opción de select inválida → el pedido NO se crea.
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente Gap2-11', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
      ),
      jsonb_build_array(jsonb_build_object(
        'model', 'M1', 'quantity', 1,
        'custom_field_values', jsonb_build_object('gap2_required_field', 'ok', 'gap2_select_field', 'Z')
      ))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST G2-11/15 FALLÓ: se creó un pedido con una opción de select inválida'; end if;
  if exists (select 1 from orders where id = v_order_id) then
    raise exception 'TEST G2-11/15 FALLÓ: el pedido quedó creado a pesar del valor inválido (no hubo rollback real)';
  end if;
  raise notice 'TEST G2-11/15 OK: un valor inválido (select fuera de sus opciones) bloquea la creación completa del pedido';
end $$;

-- TEST G2-13 / G2-14: update de un pedido existente + custom fields, válido y luego inválido.
select rpc_update_order_with_custom_fields(
  (select order_g9 from _ids),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente Gap2-9 editado', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
  ),
  jsonb_build_array(jsonb_build_object(
    'model', 'M1', 'quantity', 2,
    'custom_field_values', jsonb_build_object('gap2_required_field', 'valor editado')
  ))
);
do $$
declare v_item_id uuid; v_value text; v_client_name text;
begin
  select client_name into v_client_name from orders where id = (select order_g9 from _ids);
  select id into v_item_id from order_items where order_id = (select order_g9 from _ids);
  select value_text into v_value from custom_field_values
    where entity_type = 'order_item' and entity_id = v_item_id and definition_id = (select def_required from _ids);
  if v_client_name <> 'Cliente Gap2-9 editado' or v_value is distinct from 'valor editado' then
    raise exception 'TEST G2-13 FALLÓ: update atómico no actualizó pedido (%) y/o custom field (%) juntos', v_client_name, v_value;
  end if;
  raise notice 'TEST G2-13 OK: update atómico — pedido y custom field cambian juntos';
end $$;

do $$
declare v_client_name_before text; v_client_name_after text; v_failed boolean := false;
begin
  select client_name into v_client_name_before from orders where id = (select order_g9 from _ids);
  begin
    perform rpc_update_order_with_custom_fields(
      (select order_g9 from _ids),
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente Gap2-9 update inválido', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 2, 'custom_field_values', '{}'::jsonb))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST G2-14 FALLÓ: un update sin el campo requerido tuvo éxito'; end if;
  select client_name into v_client_name_after from orders where id = (select order_g9 from _ids);
  if v_client_name_after <> v_client_name_before then
    raise exception 'TEST G2-14 FALLÓ: el pedido cambió (%) a pesar de que el update debía revertirse completo', v_client_name_after;
  end if;
  raise notice 'TEST G2-14 OK: un update inválido no cambia ni el pedido ni sus custom fields (rollback completo)';
end $$;

-- TEST G2-17: escribir un valor no vacío sobre una definición inactiva se rechaza.
select test_set_user(:'admin');
update custom_field_definitions set active = false where id = (select def_select from _ids);
select test_set_user(:'vendedor1');
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente Gap2-17', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids)
      ),
      jsonb_build_array(jsonb_build_object(
        'model', 'M1', 'quantity', 1,
        'custom_field_values', jsonb_build_object('gap2_required_field', 'ok', 'gap2_select_field', 'A')
      ))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST G2-17 FALLÓ: se escribió un valor sobre una definición inactiva'; end if;
  if exists (select 1 from orders where id = v_order_id) then
    raise exception 'TEST G2-17 FALLÓ: el pedido quedó creado a pesar de escribir sobre una definición inactiva';
  end if;
  raise notice 'TEST G2-17 OK: escribir sobre una definición inactiva se rechaza (y revierte el pedido completo)';
end $$;
select test_set_user(:'admin');
update custom_field_definitions set active = true where id = (select def_select from _ids);

-- TEST G2-16: cross-org — Org B crea su propio pedido enviando la clave "power" (definición real, pero de Thunder/Org A); nunca debe escribirse en ninguna organización.
select test_set_user(:'admin_orgb');
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente Gap2-16 OrgB', 'product_type', 'otro', 'business_unit_id', (select bu_org_b from _ids)
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'custom_field_values', jsonb_build_object('power', '999W')))
)).id as order_g16 \gset
alter table _ids add column order_g16 uuid;
update _ids set order_g16 = :'order_g16';
do $$
declare v_count integer;
begin
  if not exists (select 1 from orders where id = (select order_g16 from _ids)) then
    raise exception 'TEST G2-16 FALLÓ: el pedido de Org B ni siquiera se creó (debía crearse; "power" solo debía ignorarse)';
  end if;
  select count(*) into v_count from custom_field_values
    where entity_type = 'order_item' and entity_id in (select id from order_items where order_id = (select order_g16 from _ids));
  if v_count <> 0 then
    raise exception 'TEST G2-16 FALLÓ: se escribió un custom_field_value cruzando organizaciones (%)', v_count;
  end if;
  raise notice 'TEST G2-16 OK: una clave de otra organización ("power" de Thunder) se ignora silenciosamente — nunca escribe cross-org';
end $$;
select test_set_user(:'admin');

rollback;
