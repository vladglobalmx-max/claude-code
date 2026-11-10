-- THÖREN | CORRECCIÓN 0095 — pruebas funcionales contra Postgres real.
-- Fixtures 100% autocontenidas, mismo criterio que 0093/0094. Transacción
-- única con rollback al final.

begin;

\set org_a '00000000-0000-0000-0000-000000009601'
\set org_b '00000000-0000-0000-0000-000000009602'

\set bu_juno '00000000-0000-0000-0000-000000009611'
\set bu_otra '00000000-0000-0000-0000-000000009612'
\set bu_org_b '00000000-0000-0000-0000-000000009613'

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 95 A', 'test-org-95-a'),
  (:'org_b', 'Test Org 95 B', 'test-org-95-b');

insert into business_units (id, organization_id, name, code, active) values
  (:'bu_juno', :'org_a', 'Juno Promotional', 'juno95', true),
  (:'bu_otra', :'org_a', 'Otra Business Unit', 'otra95', true),
  (:'bu_org_b', :'org_b', 'BU de otra organización', 'otraorg95', true);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1 (el fallo real reportado, ahora corregido): vendedor creado por el
-- flujo de la interfaz real — /vendedores/nuevo (sin person_id) + invitar
-- un usuario vinculado (rpc_create_person_for_user crea una Person nueva,
-- vinculada SOLO a user_profiles.person_id). Antes de 0095 esto permitía
-- CUALQUIER Business Unit; ahora debe RESPETAR la asignación real.
-- =========================================================================
do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000501';
  v_sp_id uuid := '00000000-0000-0000-0000-000000009621';
  v_person_id uuid;
  v_permitida boolean;
  v_denegada boolean;
begin
  insert into auth.users (id, email) values (v_user_id, 'vendedor-ui-real-95@test.local');
  insert into salespeople (id, organization_id, name, prefix, active)
    values (v_sp_id, '00000000-0000-0000-0000-000000009601', 'Vendedor UI Real 95', 'VR95', true); -- SIN person_id, igual que /vendedores/nuevo
  insert into user_profiles (user_id, name, role, salesperson_id, active)
    values (v_user_id, 'Vendedor UI Real 95', 'vendedor', v_sp_id, true);
  insert into organization_members (organization_id, user_id, role, active)
    values ('00000000-0000-0000-0000-000000009601', v_user_id, 'vendedor', true);

  insert into people (organization_id, name, email, active)
    values ('00000000-0000-0000-0000-000000009601', 'Vendedor UI Real 95', 'vendedor-ui-real-95@test.local', true)
    returning id into v_person_id;
  update user_profiles set person_id = v_person_id where user_id = v_user_id; -- equivalente a rpc_create_person_for_user

  insert into person_business_units (person_id, business_unit_id, active)
    values (v_person_id, '00000000-0000-0000-0000-000000009611', true); -- Juno asignada, vía user_profiles.person_id

  v_permitida := fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009611'); -- Juno
  v_denegada := fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009612'); -- Otra, NO asignada

  if v_permitida is distinct from true then
    raise exception 'TEST 1 FALLO: la Business Unit asignada (Juno) debió permitirse';
  end if;
  if v_denegada is distinct from false then
    raise exception 'TEST 1 FALLO: la Business Unit NO asignada debió rechazarse — la brecha original sigue sin corregirse (devolvió %)', v_denegada;
  end if;

  raise notice 'TEST 1 OK: vendedor creado por el flujo real de la UI — Juno permitida, Otra BU correctamente denegada (brecha cerrada)';
end $$;

-- =========================================================================
-- TEST 2: identidad ausente — salesperson sin person_id propio y sin
-- ningún user_profiles vinculado (caso histórico/legítimo) -> fallback
-- heredado: permitido, sin restricción (requisito 4).
-- =========================================================================
do $$
declare
  v_sp_id uuid := '00000000-0000-0000-0000-000000009622';
  v_resultado boolean;
begin
  insert into salespeople (id, organization_id, name, prefix, active)
    values (v_sp_id, '00000000-0000-0000-0000-000000009601', 'Vendedor Sin Identidad 95', 'VS95', true);

  v_resultado := fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009612');

  if v_resultado is distinct from true then
    raise exception 'TEST 2 FALLO: sin ninguna Person resoluble, debió aplicarse el fallback heredado (permitido)';
  end if;

  raise notice 'TEST 2 OK: identidad ausente -> fallback heredado (permitido), sin restricción inventada';
end $$;

-- =========================================================================
-- TEST 3: identidad ambigua — salespeople.person_id y el person_id
-- resuelto vía user_profiles.salesperson_id existen y son DISTINTOS ->
-- debe rechazarse con excepción explícita (requisito 3), nunca elegir uno
-- al azar ni permitir por default.
-- =========================================================================
do $$
declare
  v_user_id uuid := '00000000-0000-0000-0000-000000000502';
  v_sp_id uuid := '00000000-0000-0000-0000-000000009623';
  v_person_a uuid;
  v_person_b uuid;
begin
  insert into people (organization_id, name, active) values ('00000000-0000-0000-0000-000000009601', 'Person B (salespeople.person_id)', true)
    returning id into v_person_b;
  insert into salespeople (id, organization_id, name, prefix, active, person_id)
    values (v_sp_id, '00000000-0000-0000-0000-000000009601', 'Vendedor Identidad Ambigua 95', 'VA95', true, v_person_b);

  insert into auth.users (id, email) values (v_user_id, 'vendedor-ambiguo-95@test.local');
  insert into user_profiles (user_id, name, role, salesperson_id, active)
    values (v_user_id, 'Vendedor Identidad Ambigua 95', 'vendedor', v_sp_id, true);
  insert into organization_members (organization_id, user_id, role, active)
    values ('00000000-0000-0000-0000-000000009601', v_user_id, 'vendedor', true);

  insert into people (organization_id, name, email, active)
    values ('00000000-0000-0000-0000-000000009601', 'Person A (user_profiles.person_id)', 'vendedor-ambiguo-95@test.local', true)
    returning id into v_person_a;
  update user_profiles set person_id = v_person_a where user_id = v_user_id;

  if v_person_a = v_person_b then
    raise exception 'TEST 3 FALLO (fixture): Person A y B deben ser distintas para probar ambigüedad real';
  end if;

  begin
    perform fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009611');
    raise exception 'TEST 3 FALLO: una identidad ambigua (salespeople.person_id <> user_profiles.person_id) debió rechazarse con excepción';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 3 OK: identidad ambigua rechazada con excepción explícita, nunca resuelta al azar';
end $$;

-- =========================================================================
-- TEST 4: compatibilidad heredada — salespeople.person_id YA estaba
-- poblado directamente (caso histórico del backfill de 0016, o un
-- salesperson sin ningún usuario/login vinculado) -> debe comportarse
-- EXACTAMENTE igual que antes de esta corrección: fuente primaria
-- respetada, sin pasar por el fallback secundario.
-- =========================================================================
do $$
declare
  v_sp_id uuid := '00000000-0000-0000-0000-000000009624';
  v_person_id uuid;
  v_permitida boolean;
  v_denegada boolean;
begin
  insert into people (organization_id, name, active) values ('00000000-0000-0000-0000-000000009601', 'Vendedor Historico 95', true)
    returning id into v_person_id;
  insert into salespeople (id, organization_id, name, prefix, active, person_id)
    values (v_sp_id, '00000000-0000-0000-0000-000000009601', 'Vendedor Historico 95', 'VH95', true, v_person_id);
  -- Sin user_profiles vinculado en absoluto — mismo patrón que un
  -- salesperson histórico sin login (Caso B de 0016).

  insert into person_business_units (person_id, business_unit_id, active)
    values (v_person_id, '00000000-0000-0000-0000-000000009611', true); -- Juno asignada

  v_permitida := fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009611');
  v_denegada := fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009612');

  if v_permitida is distinct from true or v_denegada is distinct from false then
    raise exception 'TEST 4 FALLO: la fuente primaria (salespeople.person_id) debió seguir funcionando exactamente igual que antes de 0095 (permitida=%, denegada=%)', v_permitida, v_denegada;
  end if;

  raise notice 'TEST 4 OK: compatibilidad heredada intacta — salespeople.person_id directo sigue funcionando igual que antes de esta corrección';
end $$;

-- =========================================================================
-- TEST 5 (requisito 2): la Person resuelta debe pertenecer a la MISMA
-- organización que el salesperson — defensa en profundidad adicional.
-- =========================================================================
do $$
declare
  v_sp_id uuid := '00000000-0000-0000-0000-000000009625';
  v_person_otra_org uuid;
begin
  insert into people (organization_id, name, active) values ('00000000-0000-0000-0000-000000009602', 'Person de Org B', true)
    returning id into v_person_otra_org;
  insert into salespeople (id, organization_id, name, prefix, active, person_id)
    values (v_sp_id, '00000000-0000-0000-0000-000000009601', 'Vendedor Org A con Person de Org B', 'VX95', true, v_person_otra_org);

  begin
    perform fn_check_business_unit_assigned_to_salesperson(v_sp_id, '00000000-0000-0000-0000-000000009611');
    raise exception 'TEST 5 FALLO: una Person de otra organización debió rechazarse con excepción';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 5 OK: Person de otra organización rechazada explícitamente';
end $$;

-- =========================================================================
-- TEST 6: salesperson inexistente -> fallback heredado (permitido), sin
-- excepción — mismo comportamiento que la función original.
-- =========================================================================
do $$
declare
  v_resultado boolean;
begin
  v_resultado := fn_check_business_unit_assigned_to_salesperson(gen_random_uuid(), '00000000-0000-0000-0000-000000009611');
  if v_resultado is distinct from true then
    raise exception 'TEST 6 FALLO: un salesperson inexistente debió devolver el fallback heredado (permitido)';
  end if;
  raise notice 'TEST 6 OK: salesperson inexistente -> fallback heredado, sin excepción';
end $$;

rollback;
