-- THÖREN Business Unit Branding (0024) — pruebas funcionales contra
-- Postgres real. Corre DESPUÉS de: local_harness_setup.sql + migraciones
-- 0001-0024 + fixtures.sql + 0024_fixtures.sql. Todo el script corre en
-- una transacción que se revierte al final — repetible.
--
-- Nota técnica: psql NO sustituye variables `:'nombre'` dentro de bloques
-- `do $$ ... $$` (son opacos a su interpolación), así que los ids se
-- resuelven UNA vez en una tabla temporal (_test_ids) visible durante
-- toda la transacción sin importar qué rol esté activo después — evita
-- depender de la RLS de business_units para resolver el id de una BU de
-- otra organización en las pruebas cross-org.
--
-- Nota de alcance: RLS en storage.objects no conoce el CONTENIDO de un
-- archivo (tamaño/MIME) — eso se valida en la Server Action
-- (validateBusinessUnitLogoFile), probado aparte con Vitest. Acá se
-- prueba la superficie que sí vive en Postgres: RLS de business_units,
-- el trigger de inmutabilidad, y RLS de storage.objects (quién puede
-- insert/update/delete/select una fila de este bucket).

-- Resuelto ANTES de `set role authenticated` — como superuser, sin RLS,
-- para poder cruzar business_units de AMBAS organizaciones en un solo
-- SELECT (org1 y Org B). Los tests de abajo sí corren bajo RLS real.
create temp table _test_ids as
select
  bu1.id as bu1_id,
  bu1.organization_id as org1_id,
  (bu1.organization_id::text || '/' || bu1.id::text || '/logo.png') as bu1_logo_png_path,
  (bu1.organization_id::text || '/' || bu1.id::text || '/logo.webp') as bu1_logo_webp_path,
  buorgb.id as bu_orgb_id,
  buorgb.organization_id as orgb_id,
  (buorgb.organization_id::text || '/' || bu1.id::text || '/logo.png') as cross_org_path
from
  (select id, organization_id from business_units where code = 'juno_promotional') bu1,
  (select id, organization_id from business_units where code = 'bu_org_b') buorgb;

grant select on _test_ids to authenticated;

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');

-- 1) ADMIN misma organización puede editar name.
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_name text;
begin
  update business_units set name = 'Juno Promotional Renombrada' where id = v_bu_id;
  select name into v_name from business_units where id = v_bu_id;
  if v_name <> 'Juno Promotional Renombrada' then
    raise exception 'TEST 1 FALLÓ: ADMIN no pudo editar name';
  end if;
  raise notice 'TEST 1 OK: ADMIN edita name';
end $$;

-- 2) ADMIN puede cambiar active.
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_active boolean;
begin
  update business_units set active = false where id = v_bu_id;
  select active into v_active from business_units where id = v_bu_id;
  if v_active <> false then
    raise exception 'TEST 2 FALLÓ: ADMIN no pudo cambiar active';
  end if;
  update business_units set active = true where id = v_bu_id;
  raise notice 'TEST 2 OK: ADMIN edita active';
end $$;

-- 3/12) ADMIN puede subir logo (simulado: RLS de storage.objects permite
--        el INSERT con path {org}/{bu}/logo.png para el admin de esa
--        organización) + logo_path queda correcto en business_units.
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_path text := (select bu1_logo_png_path from _test_ids);
begin
  insert into storage.objects (bucket_id, name, owner) values ('business-unit-assets', v_path, current_setting('app.test_user_id')::uuid);
  update business_units set logo_path = v_path where id = v_bu_id;

  if (select logo_path from business_units where id = v_bu_id) <> v_path then
    raise exception 'TEST 3/12 FALLÓ: logo_path no quedó correcto tras subir logo';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'business-unit-assets' and name = v_path) then
    raise exception 'TEST 3/12 FALLÓ: el objeto no quedó insertado en storage.objects';
  end if;
  raise notice 'TEST 3/12 OK: ADMIN sube logo, logo_path correcto';
end $$;

-- 4/13) ADMIN puede reemplazar logo con cambio de extensión, sin dejar
--       referencia rota — secuencia real: 1) insertar nuevo, 2) actualizar
--       logo_path, 3) recién después borrar el viejo.
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_old_path text := (select bu1_logo_png_path from _test_ids);
  v_new_path text := (select bu1_logo_webp_path from _test_ids);
begin
  insert into storage.objects (bucket_id, name, owner) values ('business-unit-assets', v_new_path, current_setting('app.test_user_id')::uuid);
  update business_units set logo_path = v_new_path where id = v_bu_id;
  delete from storage.objects where bucket_id = 'business-unit-assets' and name = v_old_path;

  if (select logo_path from business_units where id = v_bu_id) <> v_new_path then
    raise exception 'TEST 4/13 FALLÓ: logo_path no apunta al archivo nuevo';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'business-unit-assets' and name = v_old_path) then
    raise exception 'TEST 4/13 FALLÓ: el archivo viejo debió borrarse';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'business-unit-assets' and name = v_new_path) then
    raise exception 'TEST 4/13 FALLÓ: business_units.logo_path apunta a un archivo que no existe — referencia rota';
  end if;
  raise notice 'TEST 4/13 OK: reemplazo con cambio de extensión, sin referencia rota';
end $$;

-- 5) ADMIN puede eliminar logo.
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_path text := (select bu1_logo_webp_path from _test_ids);
begin
  update business_units set logo_path = null where id = v_bu_id;
  delete from storage.objects where bucket_id = 'business-unit-assets' and name = v_path;

  if (select logo_path from business_units where id = v_bu_id) is not null then
    raise exception 'TEST 5 FALLÓ: logo_path debió quedar NULL';
  end if;
  raise notice 'TEST 5 OK: ADMIN elimina logo';
end $$;

-- 6) VENDEDOR puede consultar (SELECT sin cambios, RLS de 0014 intacta).
select test_set_user(:'vendedor1');
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_count int;
begin
  select count(*) into v_count from business_units where id = v_bu_id;
  if v_count <> 1 then
    raise exception 'TEST 6 FALLÓ: VENDEDOR debería poder ver la Business Unit activa';
  end if;
  raise notice 'TEST 6 OK: VENDEDOR consulta la Business Unit';
end $$;

-- 7) VENDEDOR no puede modificar (name/active/logo_path — misma policy).
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_name_before text;
  v_name_after text;
begin
  select name into v_name_before from business_units where id = v_bu_id;
  update business_units set name = 'Intento de VENDEDOR' where id = v_bu_id;
  select name into v_name_after from business_units where id = v_bu_id;
  if v_name_after <> v_name_before then
    raise exception 'TEST 7 FALLÓ: VENDEDOR no debería poder modificar business_units';
  end if;
  raise notice 'TEST 7 OK: VENDEDOR bloqueado en UPDATE (0 filas afectadas, RLS silenciosa)';
end $$;

-- 7b) VENDEDOR bloqueado también en Storage (insert).
do $$
declare
  v_path text := (select bu1_logo_png_path from _test_ids);
begin
  begin
    insert into storage.objects (bucket_id, name, owner) values ('business-unit-assets', v_path, current_setting('app.test_user_id')::uuid);
    raise exception 'TEST 7b FALLÓ: VENDEDOR no debería poder subir un logo';
  exception when others then
    if sqlerrm like 'TEST 7b FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 7b OK: VENDEDOR bloqueado en INSERT de storage.objects';
end $$;

-- 8) Cross-org bloqueado — Admin de Org B no ve ni puede modificar la BU de org1.
select test_set_user(:'admin_orgb');
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_count int;
begin
  select count(*) into v_count from business_units where id = v_bu_id;
  if v_count <> 0 then
    raise exception 'TEST 8 FALLÓ: Admin de Org B no debería ver la BU de org1';
  end if;
  update business_units set name = 'Hackeada' where id = v_bu_id;
  if exists (select 1 from business_units where id = v_bu_id and name = 'Hackeada') then
    raise exception 'TEST 8 FALLÓ: Admin de Org B no debería poder modificar la BU de org1';
  end if;
  raise notice 'TEST 8 OK: cross-org bloqueado en business_units (select y update)';
end $$;

-- 8b) Cross-org bloqueado en Storage: Admin de Org B no puede subir un
--     logo a la carpeta de una BU de org1, ni siquiera con el path
--     correcto (el bucket exige que la BU pertenezca a SU organización).
do $$
declare
  v_path text := (select bu1_logo_png_path from _test_ids);
begin
  begin
    insert into storage.objects (bucket_id, name, owner) values ('business-unit-assets', v_path, current_setting('app.test_user_id')::uuid);
    raise exception 'TEST 8b FALLÓ: Admin de Org B no debería poder subir un logo a una BU de org1';
  exception when others then
    if sqlerrm like 'TEST 8b FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 8b OK: cross-org bloqueado en storage.objects (insert)';
end $$;

-- 8c) Cross-org bloqueado también con path "mezclado" (organization_id de
--     org1 pero business_unit_id de la BU de Org B, o viceversa) —
--     confirma que la policy exige que AMBOS segmentos correspondan a la
--     MISMA fila real, no solo que cada uno exista en algún lado.
do $$
declare
  v_path text := (select cross_org_path from _test_ids); -- org_b_id / bu1_id (mezclado)
begin
  begin
    insert into storage.objects (bucket_id, name, owner) values ('business-unit-assets', v_path, current_setting('app.test_user_id')::uuid);
    raise exception 'TEST 8c FALLÓ: un path con organization_id y business_unit_id de filas distintas no debió aceptarse';
  exception when others then
    if sqlerrm like 'TEST 8c FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 8c OK: path con segmentos mezclados (org/BU que no corresponden) rechazado';
end $$;

-- 9) organization_id no puede cambiarse (trigger, no solo RLS).
select test_set_user(:'admin');
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
  v_orgb_id uuid := (select orgb_id from _test_ids);
begin
  begin
    update business_units set organization_id = v_orgb_id where id = v_bu_id;
    raise exception 'TEST 9 FALLÓ: organization_id no debió poder cambiar';
  exception when others then
    if sqlerrm like 'TEST 9 FALLÓ%' then raise; end if;
    if sqlerrm not like '%organización%' then
      raise exception 'TEST 9 FALLÓ: se rechazó pero con mensaje inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'TEST 9 OK: organization_id inmutable (trigger)';
end $$;

-- 10) code no puede cambiarse (trigger, no solo RLS/UI).
do $$
declare
  v_bu_id uuid := (select bu1_id from _test_ids);
begin
  begin
    update business_units set code = 'codigo_hackeado' where id = v_bu_id;
    raise exception 'TEST 10 FALLÓ: code no debió poder cambiar';
  exception when others then
    if sqlerrm like 'TEST 10 FALLÓ%' then raise; end if;
    if sqlerrm not like '%código%' then
      raise exception 'TEST 10 FALLÓ: se rechazó pero con mensaje inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'TEST 10 OK: code inmutable (trigger)';
end $$;

-- 11) Business Unit sin logo sigue funcionando (select/update normales).
do $$
declare
  v_bu record;
begin
  select id, logo_path into v_bu from business_units where code = 'thunder_safety';
  if v_bu.logo_path is not null then
    raise exception 'TEST 11 FALLÓ (setup): se esperaba una BU sin logo para esta prueba';
  end if;
  update business_units set active = true where id = v_bu.id;
  raise notice 'TEST 11 OK: Business Unit sin logo sigue funcionando normalmente';
end $$;

-- 16/17/18) Regresión — Quotes/Orders/folios sin cambios (crear un Order y
--            una Quote normales, confirmar formato de folio intacto).
--            Admin: insertar salesperson_quote_sequences requiere leer
--            `people` (RLS admin-only, ver 0015/0016) dentro del trigger
--            trg_check_salesperson_quote_sequence_valid, que NO es
--            SECURITY DEFINER — igual que en 0022/0023_functional_tests.sql.
select test_set_user(:'admin');
do $$
declare
  v_order orders;
  v_quote quotes;
  v_bu_id uuid;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Regresión 0024',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  if v_order.folio !~ '^VU1-\d{8}-\d{3}$' then
    raise exception 'TEST 16/17/18 FALLÓ: folio de Order con formato inesperado (%)', v_order.folio;
  end if;

  select id into v_bu_id from business_units where code = 'got_fresh_breath';
  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  select organization_id, '10000000-0000-0000-0000-000000000001', v_bu_id, 'VU1' from business_units where id = v_bu_id
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
    '[{"catalog_product_id":null,"model":"Regresión 0024","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.folio !~ '^VU1-\d{8}-\d{3}$' then
    raise exception 'TEST 16/17/18 FALLÓ: folio de Quote con formato inesperado (%)', v_quote.folio;
  end if;

  raise notice 'TEST 16/17/18 OK: Orders/Quotes/folios sin regresión (Order folio=%, Quote folio=%)', v_order.folio, v_quote.folio;
end $$;

-- 19) Quote → Order (0023) intacto.
do $$
declare
  v_bu_id uuid;
  v_quote quotes;
  v_order orders;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

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
    '[{"catalog_product_id":null,"model":"Quote to Order 0024","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
  );
  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  select * into v_order from rpc_create_order_from_quote(v_quote.id, 'otro', current_date);
  if v_order.source_quote_id <> v_quote.id then
    raise exception 'TEST 19 FALLÓ: Quote → Order (0023) no funcionó tras 0024';
  end if;
  raise notice 'TEST 19 OK: Quote → Order (0023) intacto tras 0024 (Order %)', v_order.folio;
end $$;

select 'TESTS 1-19 (menos 14/15, cubiertos en Vitest) PASARON' as resultado;

rollback;
