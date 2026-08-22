-- THÖREN Business Units — Crear nuevas (0026) — pruebas funcionales
-- contra Postgres real. Cubre RLS de INSERT (ADMIN mismo org / VENDEDOR
-- bloqueado / cross-org bloqueado), CHECK constraint de formato de code,
-- unicidad de code, inmutabilidad post-creación (organization_id/code,
-- reutilizando el trigger de 0024 sobre filas creadas por esta fase),
-- visibilidad activa/inactiva, y (TEST 10, ajuste final) que 0026 NO
-- automatiza el motor de folios: una BU recién creada no tiene ninguna
-- salesperson_quote_sequences activa, y la ya existente para otras BUs
-- queda intacta. El aviso "configura folios" en sí (UI, sin escritura a
-- DB) se prueba por inspección de código — ver
-- unidades-negocio/[id]/page.tsx.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset

-- org1 es un uuid generado dinámicamente por el bootstrap de 0013 (nunca
-- estable entre corridas) — :'org1' SÍ se sustituye en sentencias sueltas
-- de psql, pero NO dentro de bloques `do $$ ... $$` (opaco al escáner de
-- interpolación de psql, bug ya documentado en fases anteriores). Se
-- guarda en una tabla temporal, plana, para que cada bloque lo resuelva
-- con un SELECT normal en vez de depender de la sustitución de psql.
create temp table _test_ids as select :'org1'::uuid as org1;

-- 1) ADMIN crea BU activa sin logo — INSERT permitido, fila real,
--    organization_id = su propia organización.
do $$
declare
  v_org1 uuid;
  v_id uuid;
  v_active boolean;
  v_logo text;
begin
  select org1 into v_org1 from _test_ids;

  insert into business_units (organization_id, name, code, active)
  values (v_org1, 'Nueva Marca Industrial', 'nueva_marca_industrial', true)
  returning id, active, logo_path into v_id, v_active, v_logo;

  if v_active is not true or v_logo is not null then
    raise exception 'TEST 1 FALLÓ: BU creada no tiene active=true/logo_path=NULL correctos (active=%, logo=%)', v_active, v_logo;
  end if;
  perform set_config('test.bu_new_id', v_id::text, false);
  raise notice 'TEST 1 OK: ADMIN crea BU activa sin logo (id=%, active=%, logo_path=%)', v_id, v_active, v_logo;
end $$;

-- 2) Code inválido rechazado — mayúsculas, espacios, empieza con número.
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;

  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Mayúsculas', 'Nueva_Marca', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 2a FALLÓ: se permitió un code con mayúsculas';
  end if;

  v_failed := false;
  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Con espacio', 'nueva marca', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 2b FALLÓ: se permitió un code con espacios';
  end if;

  v_failed := false;
  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Empieza con número', '2026_division', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 2c FALLÓ: se permitió un code que empieza con número';
  end if;

  raise notice 'TEST 2 OK: business_units_code_format rechaza mayúsculas/espacios/code que empieza con número';
end $$;

-- 3) Code duplicado rechazado dentro de la misma organización (reutiliza
--    un code real ya sembrado por 0014).
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;

  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Duplicado', 'thunder_led', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se permitió un code duplicado (thunder_led) en la misma organización';
  end if;
  raise notice 'TEST 3 OK: code duplicado rechazado (business_units_org_code_unique)';
end $$;

-- 4) VENDEDOR no puede crear Business Units.
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;

  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Intento Vendedor', 'intento_vendedor', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: VENDEDOR pudo crear una Business Unit';
  end if;
  raise notice 'TEST 4 OK: business_units_insert_admin bloquea a VENDEDOR (RLS)';
end $$;
select test_set_user(:'admin');

-- 5) Cross-org bloqueado — ADMIN de Org B no puede crear una BU en Org 1,
--    y ADMIN de Org 1 no puede crear una BU en Org B.
select test_set_user(:'admin_orgb');
do $$
declare
  v_org1 uuid;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;

  begin
    insert into business_units (organization_id, name, code, active)
    values (v_org1, 'Cross-org desde Org B', 'cross_org_desde_orgb', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 5a FALLÓ: ADMIN de Org B pudo crear una BU en Org 1';
  end if;
  raise notice 'TEST 5a OK: ADMIN de Org B bloqueado al intentar crear en Org 1';
end $$;
select test_set_user(:'admin');
do $$
declare
  v_failed boolean := false;
begin
  begin
    insert into business_units (organization_id, name, code, active)
    values ('20000000-0000-0000-0000-000000000001'::uuid, 'Cross-org desde Org 1', 'cross_org_desde_org1', true);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 5b FALLÓ: ADMIN de Org 1 pudo crear una BU en Org B';
  end if;
  raise notice 'TEST 5b OK: ADMIN de Org 1 bloqueado al intentar crear en Org B (cross-org imposible en ambas direcciones)';
end $$;

-- 6) organization_id y code quedan inmutables en la fila recién creada por
--    esta fase (reutiliza trg_business_units_prevent_org_code_change, 0024
--    — confirma que también protege filas creadas por el nuevo INSERT).
do $$
declare
  v_id uuid := current_setting('test.bu_new_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update business_units set code = 'otro_code' where id = v_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6a FALLÓ: se permitió cambiar el code de una BU recién creada';
  end if;

  v_failed := false;
  begin
    update business_units set organization_id = '20000000-0000-0000-0000-000000000001'::uuid where id = v_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6b FALLÓ: se permitió cambiar el organization_id de una BU recién creada';
  end if;
  raise notice 'TEST 6 OK: code/organization_id inmutables también en filas creadas por 0026';
end $$;

-- 7) name/active SÍ editables (business_units_update_admin, 0024) sobre la
--    fila recién creada.
do $$
declare
  v_id uuid := current_setting('test.bu_new_id')::uuid;
  v_name text;
  v_active boolean;
begin
  update business_units set name = 'Nueva Marca Industrial (editada)', active = false where id = v_id;
  select name, active into v_name, v_active from business_units where id = v_id;
  if v_name <> 'Nueva Marca Industrial (editada)' or v_active <> false then
    raise exception 'TEST 7 FALLÓ: name/active no se pudieron editar sobre la BU recién creada';
  end if;
  raise notice 'TEST 7 OK: name/active editables sobre la BU recién creada (name=%, active=%)', v_name, v_active;
end $$;

-- 8) Visibilidad activa/inactiva sin regresión — BU inactiva (recién
--    desactivada en TEST 7) invisible para VENDEDOR, visible para ADMIN.
do $$
declare
  v_id uuid := current_setting('test.bu_new_id')::uuid;
  v_count_admin int;
  v_count_vendedor int;
begin
  select count(*) into v_count_admin from business_units where id = v_id;

  perform test_set_user('00000000-0000-0000-0000-000000000002');
  select count(*) into v_count_vendedor from business_units where id = v_id;
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_admin <> 1 then
    raise exception 'TEST 8 FALLÓ: ADMIN debería ver la BU inactiva (got %)', v_count_admin;
  end if;
  if v_count_vendedor <> 0 then
    raise exception 'TEST 8 FALLÓ: VENDEDOR no debería ver una BU inactiva (got %)', v_count_vendedor;
  end if;
  raise notice 'TEST 8 OK: BU inactiva visible para ADMIN (%), invisible para VENDEDOR (%) — sin regresión de business_units_select_member', v_count_admin, v_count_vendedor;
end $$;

-- 9) Regresión ligera — Quotes/folios/0025 siguen funcionando después de
--    0026 (una creación exitosa completa, con condiciones comerciales).
select test_set_user(:'vendedor1');
do $$
declare
  v_bu_id uuid;
  v_quote quotes;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id,
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text,
      'payment_terms', '50% anticipo, 50% contra entrega'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.folio is null or v_quote.payment_terms <> '50% anticipo, 50% contra entrega' then
    raise exception 'TEST 9 FALLÓ: regresión en rpc_create_quote/0025 tras 0026';
  end if;
  raise notice 'TEST 9 OK: Quotes/0025 sin regresión tras 0026 (folio=%, payment_terms=%)', v_quote.folio, v_quote.payment_terms;
end $$;

-- 10) Aviso "configura folios" (ajuste final) — la BU recién creada en
--     TEST 1 no tiene ninguna salesperson_quote_sequences activa (0026 NO
--     crea ninguna automáticamente, NO inventa ningún prefijo), y la
--     secuencia real ya existente (VU1 × got_fresh_breath, de los
--     fixtures) sigue exactamente igual — sin alteración del motor de
--     folios.
select test_set_user(:'admin');
do $$
declare
  v_new_bu_id uuid := current_setting('test.bu_new_id')::uuid;
  v_existing_bu_id uuid;
  v_count_new int;
  v_count_existing int;
  v_prefix text;
  v_seq int;
begin
  select count(*) into v_count_new
    from salesperson_quote_sequences
    where business_unit_id = v_new_bu_id and active = true;
  if v_count_new <> 0 then
    raise exception 'TEST 10 FALLÓ: 0026 creó automáticamente una salesperson_quote_sequences para la BU nueva (% filas)', v_count_new;
  end if;

  select id into v_existing_bu_id from business_units where code = 'got_fresh_breath';
  select quote_prefix, sequence_current into v_prefix, v_seq
    from salesperson_quote_sequences
    where business_unit_id = v_existing_bu_id and salesperson_id = '10000000-0000-0000-0000-000000000001';
  select count(*) into v_count_existing
    from salesperson_quote_sequences
    where business_unit_id = v_existing_bu_id;

  if v_count_existing <> 1 or v_prefix <> 'VU1' then
    raise exception 'TEST 10 FALLÓ: la secuencia de folio ya existente (VU1 × got_fresh_breath) cambió tras 0026 (count=%, prefix=%)', v_count_existing, v_prefix;
  end if;

  raise notice 'TEST 10 OK: BU nueva sin secuencia activa (0 filas, ningún prefijo inventado); folio ya existente VU1 × got_fresh_breath intacto (prefix=%, sequence_current=%)', v_prefix, v_seq;
end $$;

select 'TESTS Business Unit Creation (0026) 1-10 PASARON' as resultado;

rollback;
