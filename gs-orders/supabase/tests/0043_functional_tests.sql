-- THÖREN — Fix "política UPDATE en people + guarda fail-loud en
-- rpc_create_person_for_user" (0043) — pruebas funcionales contra
-- Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0043 + fixtures mínimos de organización B / admin_orgb
-- (mismos que asume 0042_functional_tests.sql: org1 vía slug
-- 'global-supplier-mty', admin 00000000-...-0001, Org B
-- 20000000-...-0001, admin_orgb 00000000-...-0009). Todo el script corre
-- en una transacción que se revierte al final — repetible.
--
-- IMPORTANTE — bajo `set role authenticated` de verdad, no solo como
-- dueño de las tablas: la auditoría de 0042 post-deploy encontró que el
-- bug real (people.email nunca se actualizaba en Cloud) NO se reproducía
-- corriendo como el rol propietario de las tablas — hace falta el mismo
-- `set role authenticated;` que ya usan todos los demás archivos de este
-- proyecto (ver 0021+ en adelante) para que RLS se aplique de verdad. Los
-- TEST 1-4 de abajo validan la política nueva directamente con UPDATE
-- crudo (sin pasar por la RPC) para aislar la política de la función.
-- TEST 8 necesita acciones a nivel de propietario (DROP/CREATE POLICY)
-- que `authenticated` no tiene permiso de hacer — se usa `reset role;`
-- / `set role authenticated;` alrededor de esa sección, mismo patrón ya
-- usado en 0028/0029_functional_tests.sql.
--
-- Esta suite NO usa el nombre real de Diana — todo es sintético.

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
-- Fixture común: una Person de Org 1 con email NULL (equivalente al caso
-- histórico "Diana") y un vendedor de Org 1 (rol vendedor, sin acceso
-- admin) para las pruebas 1-4 de la política RLS pura.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_person_id uuid; v_vendedor_user_id uuid; v_sp_id uuid;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Person RLS 0043', null, true)
  returning id into v_person_id;
  perform set_config('test.person0043_id', v_person_id::text, false);

  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor RLS 0043', 'V430', true)
  returning id into v_sp_id;

  v_vendedor_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_vendedor_user_id, 'vendedor-rls-0043@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_vendedor_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_vendedor_user_id, 'Vendedor RLS 0043', 'vendedor', v_sp_id, true);
  perform set_config('test.vendedor0043_id', v_vendedor_user_id::text, false);
end $$;

-- =========================================================================
-- TEST 1: admin de la MISMA organización puede actualizar people.email
-- cuando estaba NULL (UPDATE crudo, sin pasar por la RPC).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_person_id uuid := current_setting('test.person0043_id')::uuid; v_rows int;
begin
  update people set email = 'admin-mismo-org-0043@test.local' where id = v_person_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 1 FALLÓ: el admin de la misma organización debía poder actualizar people.email (afectó % filas)', v_rows;
  end if;
  raise notice 'TEST 1 OK: admin misma organización puede actualizar people.email NULL.';
end $$;

-- =========================================================================
-- TEST 2: vendedor de la MISMA organización NO puede actualizar people
-- (política solo permite is_organization_admin, nunca vendedor).
-- =========================================================================
select test_set_user(current_setting('test.vendedor0043_id')::uuid);
do $$
declare v_person_id uuid := current_setting('test.person0043_id')::uuid; v_rows int;
begin
  update people set email = 'vendedor-no-deberia-0043@test.local' where id = v_person_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 2 FALLÓ: un vendedor NO debía poder actualizar people, afectó % filas', v_rows;
  end if;
  raise notice 'TEST 2 OK: vendedor misma organización NO puede actualizar people (0 filas afectadas).';
end $$;

-- =========================================================================
-- TEST 3: admin de OTRA organización NO puede actualizar la people de
-- Org 1.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_person_id uuid := current_setting('test.person0043_id')::uuid; v_rows int;
begin
  update people set email = 'admin-orgb-no-deberia-0043@test.local' where id = v_person_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 3 FALLÓ: un admin de otra organización NO debía poder actualizar esta people, afectó % filas', v_rows;
  end if;
  raise notice 'TEST 3 OK: admin de otra organización NO puede actualizar people de Org 1 (0 filas afectadas).';
end $$;

-- =========================================================================
-- TEST 4: no se puede mover organization_id hacia otra organización —
-- USING permite ver la fila (admin de Org 1, fila de Org 1), pero
-- WITH CHECK evalúa la fila NUEVA (organization_id = Org B) y el admin
-- actual no es admin de Org B -> Postgres lanza excepción explícita
-- (violación de RLS en WITH CHECK, no un silencioso 0 filas).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_person_id uuid := current_setting('test.person0043_id')::uuid;
  v_orgb uuid; v_failed boolean := false; v_org_after uuid;
begin
  select orgb into v_orgb from _ids;

  begin
    update people set organization_id = v_orgb where id = v_person_id;
  exception when others then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 4 FALLÓ: mover organization_id hacia otra organización debía bloquearse'; end if;

  select organization_id into v_org_after from people where id = v_person_id;
  if v_org_after = v_orgb then
    raise exception 'TEST 4 FALLÓ: organization_id cambió a pesar de la excepción';
  end if;
  raise notice 'TEST 4 OK: mover people.organization_id hacia otra organización está bloqueado (USING ve la fila vieja, WITH CHECK rechaza la fila nueva).';
end $$;

-- =========================================================================
-- TEST 5/9/10: RPC reutiliza la Person histórica y AHORA SÍ completa el
-- email NULL (fix real de 0043 — antes de esta migración, este mismo
-- escenario dejaba people.email en NULL sin ninguna excepción).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid;
  v_people_before int; v_people_after int; v_final_email text; v_linked_person_id uuid;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedora Histórica 0043-5', null, true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedora Histórica 0043-5', 'V435', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'historica-0043-5@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedora Histórica 0043-5', 'vendedor', v_sp_id, true);

  select count(*) into v_people_before from people;
  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedora Histórica 0043-5', 'historica-0043-5@test.local', true);
  select count(*) into v_people_after from people;

  -- TEST 9: no crea una segunda Person.
  if v_people_after <> v_people_before then
    raise exception 'TEST 9 FALLÓ: NO debía crearse una Person nueva (before=% after=%)', v_people_before, v_people_after;
  end if;
  raise notice 'TEST 9 OK: 0 Person duplicadas (before=after=%).', v_people_after;

  -- TEST 5: el email NULL AHORA SÍ se completa (fix real).
  select email into v_final_email from people where id = v_person_id;
  if v_final_email is distinct from 'historica-0043-5@test.local' then
    raise exception 'TEST 5 FALLÓ: el email NULL debía completarse con el del login (fix 0043), quedó "%"', v_final_email;
  end if;
  raise notice 'TEST 5 OK: RPC reutiliza la Person histórica y completa people.email NULL (fix real de 0043).';

  -- TEST 10: salespeople.person_id = user_profiles.person_id.
  select person_id into v_linked_person_id from salespeople where id = v_sp_id;
  if v_linked_person_id <> v_person_id then
    raise exception 'TEST 10 FALLÓ: salespeople.person_id cambió inesperadamente';
  end if;
  select person_id into v_linked_person_id from user_profiles where user_id = v_user_id;
  if v_linked_person_id <> v_person_id then
    raise exception 'TEST 10 FALLÓ: user_profiles.person_id (%) debe ser igual a salespeople.person_id (%)', v_linked_person_id, v_person_id;
  end if;
  raise notice 'TEST 10 OK: salespeople.person_id = user_profiles.person_id tras la reutilización.';
end $$;

-- =========================================================================
-- TEST 6: RPC con email ya igual -> permitido, sin error, sin duplicar.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid; v_final_email text;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedor Email Igual 0043-6', 'email-igual-0043-6@test.local', true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedor Email Igual 0043-6', 'V436', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'email-igual-0043-6@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Email Igual 0043-6', 'vendedor', v_sp_id, true);

  perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Email Igual 0043-6', 'email-igual-0043-6@test.local', true);

  select email into v_final_email from people where id = v_person_id;
  if v_final_email is distinct from 'email-igual-0043-6@test.local' then
    raise exception 'TEST 6 FALLÓ: el email debía mantenerse igual, quedó "%"', v_final_email;
  end if;
  raise notice 'TEST 6 OK: email ya igual -> permitido, sin duplicar, sin sobrescribir innecesariamente.';
end $$;

-- =========================================================================
-- TEST 7: RPC con email DISTINTO al histórico -> BLOQUEADO (excepción
-- explícita, nunca sobrescribe en silencio).
-- =========================================================================
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid; v_failed boolean := false; v_email_after text;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedor Email Distinto 0043-7', 'email-original-0043-7@test.local', true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedor Email Distinto 0043-7', 'V437', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'email-nuevo-0043-7@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedor Email Distinto 0043-7', 'vendedor', v_sp_id, true);

  begin
    perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedor Email Distinto 0043-7', 'email-nuevo-0043-7@test.local', true);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then raise exception 'TEST 7 FALLÓ: debía bloquear un email distinto, no lo hizo'; end if;

  select email into v_email_after from people where id = v_person_id;
  if v_email_after is distinct from 'email-original-0043-7@test.local' then
    raise exception 'TEST 7 FALLÓ: el email original NO debía cambiar, quedó "%"', v_email_after;
  end if;
  raise notice 'TEST 7 OK: email distinto -> bloqueado, email original intacto.';
end $$;

-- =========================================================================
-- TEST 8: la RPC falla (fail-loud) si el UPDATE de people.email esperado
-- afecta 0 filas, en vez de continuar en silencio como en 0042. Se
-- simula el escenario "sin política de UPDATE" quitando people_update_admin
-- temporalmente (requiere privilegios de propietario -> reset role) y
-- confirmando que la RPC ahora SÍ lanza excepción y NO deja
-- user_profiles.person_id vinculado. Se restaura la política de
-- inmediato para el resto de la suite; todo esto vive dentro de la misma
-- transacción que se revierte al final, así que el DROP/CREATE POLICY
-- nunca persiste.
-- =========================================================================
reset role;
drop policy "people_update_admin" on people;
set role authenticated;

select test_set_user(:'admin');
do $$
declare
  v_org1 uuid; v_sp_id uuid; v_person_id uuid; v_user_id uuid;
  v_failed boolean := false; v_final_email text; v_linked_person_id uuid;
begin
  select org1 into v_org1 from _ids;

  insert into people (organization_id, name, email, active)
  values (v_org1, 'Vendedora Sin Politica 0043-8', null, true)
  returning id into v_person_id;

  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Vendedora Sin Politica 0043-8', 'V438', true, v_person_id)
  returning id into v_sp_id;

  v_user_id := gen_random_uuid();
  insert into auth.users (id, email) values (v_user_id, 'sin-politica-0043-8@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, 'Vendedora Sin Politica 0043-8', 'vendedor', v_sp_id, true);

  begin
    perform rpc_create_person_for_user(v_user_id, v_org1, 'Vendedora Sin Politica 0043-8', 'sin-politica-0043-8@test.local', true);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 8 FALLÓ: sin política de UPDATE en people, la RPC debía lanzar excepción (guarda fail-loud) en vez de continuar en silencio';
  end if;

  -- El email debe seguir NULL (el UPDATE nunca persistió, como en el bug
  -- real de Cloud) Y, a diferencia de 0042, user_profiles.person_id NO
  -- debe haber quedado vinculado -- la función abortó ANTES de llegar a
  -- esa escritura.
  select email into v_final_email from people where id = v_person_id;
  if v_final_email is not null then
    raise exception 'TEST 8 FALLÓ: people.email no debía haberse completado, quedó "%"', v_final_email;
  end if;

  select person_id into v_linked_person_id from user_profiles where user_id = v_user_id;
  if v_linked_person_id is not null then
    raise exception 'TEST 8 FALLÓ: user_profiles.person_id NO debía quedar vinculado cuando la RPC aborta por el guard fail-loud';
  end if;

  raise notice 'TEST 8 OK: sin política de UPDATE en people, la RPC lanza excepción explícita (guarda fail-loud) y NO deja person_id vinculado a medias.';
end $$;

reset role;
create policy "people_update_admin" on people
  for update
  using (is_organization_admin(organization_id))
  with check (is_organization_admin(organization_id));
set role authenticated;

-- =========================================================================
-- TEST 11: regresión 0042 (0042_functional_tests.sql corregido — ver nota
-- de NULL-safety en ese archivo) se ejecuta como archivo aparte, ver
-- README de esta suite / reporte de cierre. No se re-embebe aquí para no
-- duplicar 400+ líneas; se corre como script independiente en la misma
-- sesión de validación.
-- =========================================================================

select test_set_user(:'admin');

rollback;
