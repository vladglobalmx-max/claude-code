-- THÖREN — Fase 7B: Provisioning de organización + primer admin (0052) —
-- pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0052 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final (rollback) —
-- repetible.
--
-- org1 (Global Supplier)/admin/vendedor1/vendedor2/Org B (fixtures.sql) ya
-- existen. Este archivo provisiona una TERCERA organización real (Acme
-- Corp) exclusivamente vía rpc_provision_organization() — nunca con INSERT
-- manual — y valida aislamiento cruzado contra las otras dos.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` (dólar-quoted) — por eso todo id usado
-- DENTRO de un bloque `do $$` se resuelve vía current_setting() (guardado
-- antes con set_config) o como literal UUID fijo, nunca `:'var'`.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set acme_admin '00000000-0000-0000-0000-0000000000c1'
\set acme_vendedor '00000000-0000-0000-0000-0000000000c2'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select set_config('test.org1_id', :'org1', false);

-- =========================================================================
-- TEST previo (autoridad): rpc_provision_organization NO es invocable por
-- ningún rol authenticated, ni siquiera un admin pleno — ver 0052 DECISIÓN
-- de autoridad. Se prueba ANTES de provisionar Acme para no depender de su
-- resultado.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_provision_organization('Intento No Autorizado', 'intento-no-autorizado', gen_random_uuid(), 'X', 'x@test.local', 'BU', 'bu');
  exception when insufficient_privilege then v_failed := true;
  end;
  if not v_failed then raise exception 'FALLÓ: un admin authenticated pudo ejecutar rpc_provision_organization()'; end if;
  raise notice 'OK (autoridad): admin authenticated NO puede ejecutar rpc_provision_organization (permission denied).';
end $$;

-- =========================================================================
-- Provisioning real de Acme Corp — como el script lo haría: el usuario de
-- Auth ya existe (simula el paso 1, GoTrue no está disponible aquí) y
-- rpc_provision_organization corre como service_role (paso 2).
-- =========================================================================
insert into auth.users (id, email) values (:'acme_admin', 'jane@acme.example');

set role service_role;
select organization_id as acme_org_id, business_unit_id as acme_bu_id
from rpc_provision_organization(
  'Acme Corp', 'acme-corp', :'acme_admin', 'Jane Doe', 'jane@acme.example', 'Acme Principal', 'acme_principal'
) \gset

select set_config('test.acme_org_id', :'acme_org_id', false);
select set_config('test.acme_bu_id', :'acme_bu_id', false);

set role authenticated;
-- TESTS 1/3/4/5/6/7 verifican datos DE Acme Corp — deben correr como el
-- propio admin de Acme (RLS: organizations_select_member/is_organization_
-- member exigen membership real; el admin de Global Supplier no es
-- miembro de Acme Corp y no vería nada, con o sin bug).
select test_set_user(:'acme_admin');

-- TEST 1: crea organization.
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid;
begin
  if not exists (select 1 from organizations where id = v_org_id and name = 'Acme Corp') then
    raise exception 'TEST 1 FALLÓ: no se creó la organización Acme Corp';
  end if;
  raise notice 'TEST 1 OK: crea organization.';
end $$;

-- TEST 2: slug único — un segundo intento con el mismo slug falla
-- (organizations_slug_unique, ya existente desde 0013).
set role service_role;
do $$
declare v_failed boolean := false; v_new_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_new_user, 'otro@acme.example');
  begin
    perform rpc_provision_organization('Acme Corp 2', 'acme-corp', v_new_user, 'Otro', 'otro@acme.example', 'BU2', 'bu2');
  exception when unique_violation then v_failed := true; end;
  if not v_failed then raise exception 'TEST 2 FALLÓ: se permitió un slug duplicado'; end if;
  raise notice 'TEST 2 OK: slug único (duplicado bloqueado).';
end $$;
set role authenticated;

-- TEST 3/4: crea primer admin, y ese admin pertenece a la organización
-- correcta (organization_members, no solo user_profiles.role).
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid;
begin
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'admin' and active) then
    raise exception 'TEST 3 FALLÓ: no se creó el primer admin de Acme Corp';
  end if;
  if not exists (
    select 1 from organization_members
    where organization_id = v_org_id and user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'admin' and active
  ) then
    raise exception 'TEST 4 FALLÓ: el admin de Acme Corp no pertenece a la organización correcta';
  end if;
  raise notice 'TEST 3/4 OK: primer admin creado y perteneciente a Acme Corp.';
end $$;

-- TEST 5: crea profile correcto (nombre correcto, sin salesperson_id —
-- un admin nunca requiere uno, ver 0011).
do $$
begin
  if not exists (
    select 1 from user_profiles
    where user_id = '00000000-0000-0000-0000-0000000000c1' and name = 'Jane Doe' and salesperson_id is null
  ) then
    raise exception 'TEST 5 FALLÓ: el profile del admin de Acme Corp no quedó correcto';
  end if;
  raise notice 'TEST 5 OK: profile correcto.';
end $$;

-- TEST 6: crea people correcto (organización + email correctos, vinculado
-- desde user_profiles.person_id).
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid; v_person_id uuid;
begin
  select person_id into v_person_id from user_profiles where user_id = '00000000-0000-0000-0000-0000000000c1';
  if v_person_id is null then
    raise exception 'TEST 6 FALLÓ: el admin de Acme Corp no quedó vinculado a ninguna Person';
  end if;
  if not exists (
    select 1 from people
    where id = v_person_id and organization_id = v_org_id and email = 'jane@acme.example' and active
  ) then
    raise exception 'TEST 6 FALLÓ: la Person del admin de Acme Corp no quedó correcta';
  end if;
  raise notice 'TEST 6 OK: people correcto.';
end $$;

-- TEST 7: crea Business Unit inicial (nombre/code parametrizados, sin
-- hardcode de Thunder/Global Supplier/Juno).
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid; v_bu_id uuid := current_setting('test.acme_bu_id')::uuid;
begin
  if not exists (
    select 1 from business_units
    where id = v_bu_id and organization_id = v_org_id and name = 'Acme Principal' and code = 'acme_principal'
  ) then
    raise exception 'TEST 7 FALLÓ: la Business Unit inicial de Acme Corp no quedó correcta';
  end if;
  raise notice 'TEST 7 OK: Business Unit inicial correcta (nombre configurable, sin hardcode).';
end $$;

-- TEST 8: rollback/compensación si falla a mitad — un segundo intento
-- reutilizando el MISMO admin (user_id ya con perfil) debe fallar sin dejar
-- una organización/BU huérfana (atomicidad real de la función PL/pgSQL:
-- todo o nada, en una sola transacción).
set role service_role;
do $$
declare
  v_org_count_before integer; v_org_count_after integer;
  v_bu_count_before integer; v_bu_count_after integer;
  v_failed boolean := false;
begin
  select count(*) into v_org_count_before from organizations;
  select count(*) into v_bu_count_before from business_units;
  begin
    perform rpc_provision_organization('Acme Duplicado', 'acme-duplicado', '00000000-0000-0000-0000-0000000000c1', 'Jane Otra Vez', 'jane2@acme.example', 'BU Duplicada', 'bu_dup');
  exception when unique_violation then v_failed := true; end;
  select count(*) into v_org_count_after from organizations;
  select count(*) into v_bu_count_after from business_units;
  if not v_failed then raise exception 'TEST 8 FALLÓ: se permitió reprovisionar un admin ya existente'; end if;
  if v_org_count_after <> v_org_count_before or v_bu_count_after <> v_bu_count_before then
    raise exception 'TEST 8 FALLÓ: quedó una organización/BU huérfana tras el fallo a mitad (orgs %->%, BUs %->%)',
      v_org_count_before, v_org_count_after, v_bu_count_before, v_bu_count_after;
  end if;
  raise notice 'TEST 8 OK: rollback/compensación real — CERO organización/BU huérfana tras fallo a mitad.';
end $$;
set role authenticated;

-- TEST 9: no crea admin huérfano — el admin de Acme Corp tiene AMBAS filas
-- (user_profiles Y organization_members), a diferencia del huérfano de 7A
-- (TEST 29/32, 0051) que solo tenía user_profiles. Se confirma además que
-- sí obtiene autoridad real (is_organization_admin de SU organización).
select test_set_user(:'acme_admin');
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid;
begin
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-0000000000c1')
     or not exists (select 1 from organization_members where user_id = '00000000-0000-0000-0000-0000000000c1') then
    raise exception 'TEST 9 FALLÓ: el admin de Acme Corp quedó huérfano (falta alguna de las dos filas)';
  end if;
  if not is_organization_admin(v_org_id) then
    raise exception 'TEST 9 FALLÓ: el admin de Acme Corp no obtuvo autoridad real sobre su propia organización';
  end if;
  raise notice 'TEST 9 OK: NO es un admin huérfano — tiene membership real y autoridad funcional sobre Acme Corp.';
end $$;

-- TEST 10: Tenant B (Acme Corp) no ve Tenant A (Global Supplier) — ni al
-- revés. Reconfirma exactamente el mismo aislamiento ya cerrado en 7A,
-- ahora también para una organización creada por el mecanismo de
-- provisioning (no solo por fixtures.sql).
do $$
declare v_org1_id uuid := current_setting('test.org1_id')::uuid;
begin
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000001')
     or exists (select 1 from salespeople where organization_id = v_org1_id)
     or exists (select 1 from business_units where organization_id = v_org1_id) then
    raise exception 'TEST 10 FALLÓ: el admin de Acme Corp ve datos de Global Supplier';
  end if;
  raise notice 'TEST 10 OK (parte 1): Acme Corp NO ve Global Supplier.';
end $$;

select test_set_user(:'admin');
do $$
declare v_acme_org_id uuid := current_setting('test.acme_org_id')::uuid;
begin
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-0000000000c1')
     or exists (select 1 from business_units where organization_id = v_acme_org_id) then
    raise exception 'TEST 10 FALLÓ: Global Supplier ve datos de Acme Corp';
  end if;
  raise notice 'TEST 10 OK (parte 2): Global Supplier NO ve Acme Corp.';
end $$;

-- TEST 11: invite posterior funciona — el admin de Acme Corp da de alta un
-- segundo usuario (vendedor) usando el flujo YA EXISTENTE
-- (insertProfileAndMembershipOrCompensate: profile + membership + person),
-- sin ningún cambio de código — confirma que 7B no rompió 7A ni el alta
-- normal para una organización nueva.
select test_set_user(:'acme_admin');
insert into auth.users (id, email) values (:'acme_vendedor', 'vendedor-acme@acme.example');
do $$
declare
  v_org_id uuid := current_setting('test.acme_org_id')::uuid;
  v_sp_id uuid;
  v_person_id uuid;
begin
  insert into salespeople (organization_id, name, prefix, active)
  values (v_org_id, 'Vendedor Acme', 'ACM', true)
  returning id into v_sp_id;

  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-0000000000c2', 'Vendedor Acme', 'vendedor', v_sp_id, true);
  insert into organization_members (organization_id, user_id, role, active)
  values (v_org_id, '00000000-0000-0000-0000-0000000000c2', 'vendedor', true);
  perform rpc_create_person_for_user('00000000-0000-0000-0000-0000000000c2', v_org_id, 'Vendedor Acme', 'vendedor-acme@acme.example', true);

  select person_id into v_person_id from user_profiles where user_id = '00000000-0000-0000-0000-0000000000c2';
  if v_person_id is null then
    raise exception 'TEST 11 FALLÓ: el alta posterior (vendedor) no completó correctamente';
  end if;
  raise notice 'TEST 11 OK: invite posterior (flujo existente) funciona para una organización creada por provisioning.';
end $$;

select test_set_user(:'admin');

do $$ begin raise notice '=== 0052: 11/11 TESTS OK ==='; end $$;

rollback;
