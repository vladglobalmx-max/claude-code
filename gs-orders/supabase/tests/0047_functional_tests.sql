-- THÖREN — Fase 6R.1B-4C (incidente post-despliegue): pruebas funcionales
-- de la regresión de admin_list_user_profiles() (0011 -> 0012 fix -> 0046
-- la perdió -> 0047 la restaura). Corre DESPUÉS de: local_harness_setup.sql
-- (con el email character varying(255) corregido en esta misma fase) +
-- migraciones 0001-0047 + fixtures.sql. Bajo `set role authenticated` real.
--
-- Objetivo específico de este archivo: probar que admin_list_user_profiles()
-- EJECUTA sin lanzar 42804 (structure of query does not match function
-- result type) — el bug real no se manifestaba al CREAR la función, solo
-- al INVOCARLA, así que "la migración corrió sin error" nunca fue
-- suficiente para detectarlo. Sin el fix del stub de auth.users (email
-- character varying(255) en vez de text), este archivo NO habría fallado
-- ni con la regresión de 0046 presente — por eso ese fix es parte
-- inseparable de esta prueba.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset

-- =========================================================================
-- FIXTURES: user_manager (can_manage_users, role=vendedor) para probar que
-- el fix también aplica a ese actor, no solo a admin.
-- =========================================================================
do $$
declare
  v_org1 uuid;
  v_sp_id uuid;
begin
  -- :'org1' (sustitución psql) NO funciona dentro de un bloque DO — se
  -- resuelve con una consulta real en su lugar (bug conocido de esta
  -- sesión, ver 0046_functional_tests.sql).
  select id into v_org1 from organizations where slug = 'global-supplier-mty';

  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'User Manager 0047', 'UM7', true)
  returning id into v_sp_id;
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000070', 'user-manager-0047@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, '00000000-0000-0000-0000-000000000070', 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values ('00000000-0000-0000-0000-000000000070', 'User Manager 0047', 'vendedor', v_sp_id, true);
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values (v_org1, '00000000-0000-0000-0000-000000000070', 'can_manage_users', true, '00000000-0000-0000-0000-000000000001');

  raise notice 'SETUP OK: user_manager 00000000-0000-0000-0000-000000000070';
end $$;

-- =========================================================================
-- TEST 1: admin invoca admin_list_user_profiles() SIN lanzar 42804 — la
-- regresión real ocurría exactamente aquí, al ejecutar, no al crear.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_count integer := 0; v_admin_email text;
begin
  select count(*) into v_count from admin_list_user_profiles();
  if v_count = 0 then
    raise exception 'TEST 1 FALLÓ: admin no vio ningún usuario (se esperaban al menos vendedor1 y el propio admin)';
  end if;

  select email into v_admin_email from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000001';
  if v_admin_email is null then
    raise exception 'TEST 1 FALLÓ: el email del propio admin vino NULL';
  end if;

  raise notice 'TEST 1 OK: admin_list_user_profiles() ejecuta sin 42804, % usuarios visibles, email admin=%', v_count, v_admin_email;
end $$;

-- =========================================================================
-- TEST 2: el email devuelto coincide EXACTO con auth.users.email
-- (confirma que el cast u.email::text no corrompe/trunca el valor).
-- =========================================================================
do $$
declare v_from_rpc text; v_from_auth text;
begin
  select email into v_from_rpc from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000002';
  select email into v_from_auth from auth.users where id = '00000000-0000-0000-0000-000000000002';
  if v_from_rpc is distinct from v_from_auth then
    raise exception 'TEST 2 FALLÓ: email de la RPC (%) no coincide con auth.users.email (%)', v_from_rpc, v_from_auth;
  end if;
  raise notice 'TEST 2 OK: email de la RPC coincide exacto con auth.users.email (%).', v_from_auth;
end $$;

-- =========================================================================
-- TEST 3: cross-org sigue intacto tras el fix — admin de org1 no ve al
-- admin de Org B (el fix del cast no debe aflojar el filtro de 0046).
-- =========================================================================
do $$
begin
  if exists (select 1 from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000009') then
    raise exception 'TEST 3 FALLÓ: admin de org1 vio una cuenta de Org B — el fix aflojó el scoping de organización';
  end if;
  raise notice 'TEST 3 OK: cross-org sigue bloqueado tras el fix.';
end $$;

-- =========================================================================
-- TEST 4: can_manage_users (no admin) también invoca la función sin 42804
-- y ve su propio email correctamente — el bug afectaba a CUALQUIER
-- invocación, no solo a admin.
-- =========================================================================
select test_set_user('00000000-0000-0000-0000-000000000070');
do $$
declare v_email text;
begin
  select email into v_email from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000070';
  if v_email is distinct from 'user-manager-0047@test.local' then
    raise exception 'TEST 4 FALLÓ: user_manager no vio su propio email correcto (obtuvo: %)', v_email;
  end if;
  raise notice 'TEST 4 OK: can_manage_users invoca admin_list_user_profiles() sin 42804, email correcto.';
end $$;

select test_set_user(:'admin');
do $$ begin raise notice '=== 0047: 4/4 TESTS OK ==='; end $$;
rollback;
