-- THÖREN — Fix "reutilizar Person para salesperson existente" (0042) —
-- pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0042 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final — repetible.
--
-- Caso real que motiva este fix: Diana Ochoa (salesperson DOJ, Person
-- histórica con email NULL desde el backfill 0016) — el flujo normal de
-- alta de usuario NO debe crearle una segunda Person. Este archivo NO usa
-- el nombre real de Diana — todo es sintético.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset

create temp table _ids as
  select
    :'org1'::uuid as org1,
    '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- TEST 1: salesperson SIN Person histórica -> crea una Person NUEVA
-- (comportamiento original de 0016, sin cambios).
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_user_id uuid; v_people_before int; v_people_after int; v_person_id uuid;
begin
  select org1 into v_org1 from _ids;

  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor Nuevo 0042-1', 'V421', true)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'nuevo-0042-1@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Nuevo 0042-1', 'vendedor', v_sp_id, true);

  select count(*) into v_people_before from people;
  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Nuevo 0042-1', 'nuevo-0042-1@test.local', true);
  select count(*) into v_people_after from people;

  if v_people_after <> v_people_before + 1 then
    raise exception 'TEST 1 FALLÓ: se esperaba +1 Person nueva, before=% after=%', v_people_before, v_people_after;
  end if;

  select person_id into v_person_id from user_profiles where user_id = v_user_id;
  if v_person_id is null then raise exception 'TEST 1 FALLÓ: user_profiles.person_id no quedó vinculado'; end if;

  raise notice 'TEST 1 OK: salesperson sin Person histórica -> crea una Person nueva (comportamiento sin cambios).';
end $$;

-- =========================================================================
-- TEST 2/6/7: salesperson CON Person histórica (email NULL, caso Diana) ->
-- REUTILIZA esa Person, NO crea una segunda, y salespeople.person_id =
-- user_profiles.person_id al final. TEST 3: el email NULL se completa.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid;
  v_people_before int; v_people_after int; v_linked_person_id uuid; v_final_email text;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedora Histórica 0042-2', null, true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedora Histórica 0042-2', 'V422', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'historica-0042-2@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedora Histórica 0042-2', 'vendedor', v_sp_id, true);

  select count(*) into v_people_before from people;
  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedora Histórica 0042-2', 'historica-0042-2@test.local', true);
  select count(*) into v_people_after from people;

  if v_people_after <> v_people_before then
    raise exception 'TEST 2 FALLÓ: NO debía crearse una Person nueva (before=% after=%)', v_people_before, v_people_after;
  end if;

  select person_id into v_linked_person_id from user_profiles where user_id = v_user_id;
  if v_linked_person_id <> v_person_id then
    raise exception 'TEST 2 FALLÓ: user_profiles.person_id (%) debía ser la Person histórica (%)', v_linked_person_id, v_person_id;
  end if;
  raise notice 'TEST 2 OK: reutiliza la Person histórica, sin crear una segunda.';

  select email into v_final_email from people where id = v_person_id;
  -- NOTA (corrección 0043): `<>` con un v_final_email NULL evalúa a
  -- NULL/desconocido en SQL, nunca a TRUE — un IF con esa condición NUNCA
  -- dispara, así que esta comparación original habría reportado "OK" sin
  -- importar el resultado real. Se usa `is distinct from` (NULL-safe).
  if v_final_email is distinct from 'historica-0042-2@test.local' then
    raise exception 'TEST 3 FALLÓ: el email NULL debía completarse con el del login, quedó "%"', v_final_email;
  end if;
  raise notice 'TEST 3 OK: people.email NULL se completó con el email del nuevo login.';

  select person_id into v_linked_person_id from salespeople where id = v_sp_id;
  if v_linked_person_id <> v_person_id then
    raise exception 'TEST 7 FALLÓ: salespeople.person_id cambió inesperadamente (era %, es %)', v_person_id, v_linked_person_id;
  end if;
  select person_id into v_linked_person_id from user_profiles where user_id = v_user_id;
  if v_linked_person_id <> v_person_id then
    raise exception 'TEST 7 FALLÓ: user_profiles.person_id (%) debe ser igual a salespeople.person_id (%)', v_linked_person_id, v_person_id;
  end if;
  raise notice 'TEST 7 OK: salespeople.person_id = user_profiles.person_id tras la reutilización.';

  raise notice 'TEST 6 OK: 0 Person duplicadas (before=after=%).', v_people_after;
end $$;

-- =========================================================================
-- TEST 4: people.email YA IGUAL al del nuevo login -> permitido, sin error,
-- sin duplicar, email se mantiene igual.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid; v_people_before int; v_people_after int; v_final_email text;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedor Email Igual 0042-4', 'email-igual-0042-4@test.local', true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedor Email Igual 0042-4', 'V424', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'email-igual-0042-4@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Email Igual 0042-4', 'vendedor', v_sp_id, true);

  select count(*) into v_people_before from people;
  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Email Igual 0042-4', 'email-igual-0042-4@test.local', true);
  select count(*) into v_people_after from people;

  if v_people_after <> v_people_before then
    raise exception 'TEST 4 FALLÓ: NO debía crearse una Person nueva';
  end if;
  select email into v_final_email from people where id = v_person_id;
  -- NULL-safe (ver nota de TEST 3 más arriba).
  if v_final_email is distinct from 'email-igual-0042-4@test.local' then
    raise exception 'TEST 4 FALLÓ: el email debía mantenerse igual, quedó "%"', v_final_email;
  end if;
  raise notice 'TEST 4 OK: email ya igual -> permitido, sin duplicar, sin sobrescribir innecesariamente.';
end $$;

-- =========================================================================
-- TEST 5: people.email DISTINTO al del nuevo login -> BLOQUEADO
-- (excepción explícita, nunca sobrescribe en silencio).
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid; v_failed boolean := false; v_email_after text;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedor Email Distinto 0042-5', 'email-original-0042-5@test.local', true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedor Email Distinto 0042-5', 'V425', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'email-nuevo-0042-5@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Email Distinto 0042-5', 'vendedor', v_sp_id, true);

  begin
    perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Email Distinto 0042-5', 'email-nuevo-0042-5@test.local', true);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 5 FALLÓ: debía bloquear un email distinto, no lo hizo'; end if;

  select email into v_email_after from people where id = v_person_id;
  -- NULL-safe (ver nota de TEST 3 más arriba).
  if v_email_after is distinct from 'email-original-0042-5@test.local' then
    raise exception 'TEST 5 FALLÓ: el email original NO debía cambiar, quedó "%"', v_email_after;
  end if;
  raise notice 'TEST 5 OK: email distinto -> bloqueado, email original intacto.';
end $$;

-- =========================================================================
-- TEST 8: salesperson ya reclamado por otro user_profiles -> rechazado
-- (ya garantizado por user_profiles_salesperson_id_unique, 0011 — sin
-- cambios en este fix; se confirma que sigue vigente).
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_user_id_a uuid; v_user_id_b uuid; v_failed boolean := false;
begin
  select org1 into v_org1 from _ids;

  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor Reclamado 0042-8', 'V428', true)
  returning id into v_sp_id;

  v_user_id_a := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id_a, 'reclamado-a-0042-8@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id_a, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id_a, 'Vendedor Reclamado 0042-8 A', 'vendedor', v_sp_id, true);

  v_user_id_b := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id_b, 'reclamado-b-0042-8@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id_b, 'vendedor', true);

  begin
    insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id_b, 'Vendedor Reclamado 0042-8 B', 'vendedor', v_sp_id, true);
  exception when unique_violation then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 8 FALLÓ: un segundo user_profiles no debía poder reclamar el mismo salesperson_id'; end if;
  raise notice 'TEST 8 OK: salesperson ya reclamado -> rechazado (user_profiles_salesperson_id_unique, sin cambios).';
end $$;

-- =========================================================================
-- TEST 9: cross-org -> la Person histórica del salesperson pertenece a
-- Org B, el alta es para Org 1 -> BLOQUEADO.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid; v_person_id uuid; begin
  select orgb into v_orgb from _ids;
  insert into people (organization_id, name, email, active)
  values (v_orgb, 'Persona Org B 0042-9', null, true)
  returning id into v_person_id;
  perform set_config('test.personorgb0042_id', v_person_id::text, false);
end $$;
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid; v_person_id uuid := current_setting('test.personorgb0042_id')::uuid;
  v_sp_id uuid; v_user_id uuid; v_failed boolean := false;
begin
  select org1 into v_org1 from _ids;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedor Cross Org 0042-9', 'V429', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'crossorg-0042-9@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Cross Org 0042-9', 'vendedor', v_sp_id, true);

  begin
    perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Cross Org 0042-9', 'crossorg-0042-9@test.local', true);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 9 FALLÓ: debía bloquear reutilizar una Person de otra organización'; end if;
  raise notice 'TEST 9 OK: cross-org bloqueado (Person histórica de otra organización, no reutilizable).';
end $$;

-- =========================================================================
-- NOTA — TEST 10 (fallo posterior al invite -> compensación elimina Auth
-- User): es un comportamiento de src/lib/user-access.ts
-- (compensateOrphanedAuthUser), NO tocado por este fix — ya cubierto por
-- src/lib/user-access.test.ts (Vitest, mockeado), reconfirmado sin
-- cambios en la validación de este fix (ver reporte).
-- =========================================================================

-- =========================================================================
-- TEST 11: flujo normal SIN salesperson (ej. un admin) sigue funcionando
-- exactamente igual — crea una Person nueva.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_user_id uuid; v_people_before int; v_people_after int; v_person_id uuid;
begin
  select org1 into v_org1 from _ids;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'admin-sin-sp-0042-11@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'admin', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Admin Sin SP 0042-11', 'admin', null, true);

  select count(*) into v_people_before from people;
  perform rpc_create_person_for_user(v_user_id, v_org1, 'Admin Sin SP 0042-11', 'admin-sin-sp-0042-11@test.local', true);
  select count(*) into v_people_after from people;

  if v_people_after <> v_people_before + 1 then
    raise exception 'TEST 11 FALLÓ: un usuario sin salesperson_id debía crear una Person nueva, before=% after=%', v_people_before, v_people_after;
  end if;

  select person_id into v_person_id from user_profiles where user_id = v_user_id;
  if v_person_id is null then raise exception 'TEST 11 FALLÓ: user_profiles.person_id no quedó vinculado'; end if;
  raise notice 'TEST 11 OK: flujo normal sin salesperson sigue funcionando igual (crea Person nueva).';
end $$;

-- =========================================================================
-- TEST 12 (regresión): rpc_create_person_for_user con un user_profiles que
-- YA tiene person_id vinculada (double-call) sigue rechazado exactamente
-- como en 0016 — comportamiento preexistente, sin cambios.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_user_id uuid; v_failed boolean := false;
begin
  select org1 into v_org1 from _ids;

  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor Doble Llamada 0042-12', 'V4212', true)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'doble-0042-12@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Doble Llamada 0042-12', 'vendedor', v_sp_id, true);

  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Doble Llamada 0042-12', 'doble-0042-12@test.local', true);

  begin
    perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Doble Llamada 0042-12', 'doble-0042-12@test.local', true);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 12 FALLÓ: una segunda llamada para el mismo usuario ya vinculado debía fallar (regresión de 0016)'; end if;
  raise notice 'TEST 12 OK: regresión intacta — doble llamada sigue rechazada igual que en 0016.';
end $$;

rollback;
