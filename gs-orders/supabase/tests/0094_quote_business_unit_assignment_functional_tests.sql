-- THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — pruebas funcionales
-- contra Postgres real (0094_quote_business_unit_assignment.sql). Fixtures
-- 100% autocontenidas — mismo criterio que 0079/0083/0093. Todo el script
-- corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000301'
\set vendedor1 '00000000-0000-0000-0000-000000000302'
\set vendedor2 '00000000-0000-0000-0000-000000000303'
\set org_a '00000000-0000-0000-0000-000000009401'
\set org_b '00000000-0000-0000-0000-000000009402'
\set bu1 '00000000-0000-0000-0000-000000009411'
\set bu2 '00000000-0000-0000-0000-000000009412'
\set bu_org_b '00000000-0000-0000-0000-000000009413'
\set p1 '00000000-0000-0000-0000-000000009421'
\set p2 '00000000-0000-0000-0000-000000009422'
\set p_org_b '00000000-0000-0000-0000-000000009423'
\set sp1 '00000000-0000-0000-0000-000000009431'
\set sp2 '00000000-0000-0000-0000-000000009432'
\set c1 '00000000-0000-0000-0000-000000009441'

insert into auth.users (id, email) values
  (:'admin', 'admin-94@test.local'),
  (:'vendedor1', 'vendedor1-94@test.local'),
  (:'vendedor2', 'vendedor2-94@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 94 A', 'test-org-94-a'),
  (:'org_b', 'Test Org 94 B', 'test-org-94-b');

insert into business_units (id, organization_id, name, code, active) values
  (:'bu1', :'org_a', 'BU Uno 94', 'bu1_94', true),
  (:'bu2', :'org_a', 'BU Dos 94', 'bu2_94', true),
  (:'bu_org_b', :'org_b', 'BU Org B 94', 'buorgb_94', true);

insert into people (id, organization_id, name, active) values
  (:'p1', :'org_a', 'Persona Vendedor1 94', true),
  (:'p2', :'org_a', 'Persona Vendedor2 94', true),
  (:'p_org_b', :'org_b', 'Persona Org B 94', true);

insert into salespeople (id, organization_id, name, prefix, active, person_id) values
  (:'sp1', :'org_a', 'Vendedor Uno 94', 'VU94', true, :'p1'),
  (:'sp2', :'org_a', 'Vendedor Dos 94', 'VD94', true, :'p2');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 94', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true);

insert into user_profiles (user_id, name, role, salesperson_id, person_id, active) values
  (:'vendedor1', 'Vendedor Uno 94', 'vendedor', :'sp1', :'p1', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor1', 'vendedor', true);

insert into user_profiles (user_id, name, role, salesperson_id, person_id, active) values
  (:'vendedor2', 'Vendedor Dos 94', 'vendedor', :'sp2', :'p2', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor2', 'vendedor', true);

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 94', true);

-- Folios activos para sp1 en AMBAS BU (sp1xbu1 y sp1xbu2) y para sp2 en
-- bu1 — con esto, cualquier rechazo de rpc_create_quote en las pruebas de
-- abajo es EXCLUSIVAMENTE por person_business_units, nunca por falta de
-- configuración de folio (que ya está lista para las 3 combinaciones).
insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp1', :'bu1', 'VU94A'),
  (:'org_a', :'sp1', :'bu2', 'VU94B'),
  (:'org_a', :'sp2', :'bu1', 'VD94A');

select 'FIXTURES OK' as marker;

set role authenticated;

-- =========================================================================
-- TEST 1: admin asigna [bu1] a P1 — persiste activa, bu2 nunca se toca
-- (sin fila, no "false" innecesario).
-- =========================================================================
do $$
declare
  v_active boolean;
  v_bu2_exists boolean;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin

  perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009421', array['00000000-0000-0000-0000-000000009411']::uuid[]);

  select active into v_active from person_business_units
    where person_id = '00000000-0000-0000-0000-000000009421' and business_unit_id = '00000000-0000-0000-0000-000000009411';
  if v_active <> true then
    raise exception 'TEST 1 FALLÓ: bu1 debió quedar activa para P1';
  end if;

  select exists(select 1 from person_business_units where person_id = '00000000-0000-0000-0000-000000009421' and business_unit_id = '00000000-0000-0000-0000-000000009412') into v_bu2_exists;
  if v_bu2_exists then
    raise exception 'TEST 1 FALLÓ: bu2 no debió tener ninguna fila (nunca se asignó)';
  end if;

  raise notice 'TEST 1 OK: asignación inicial persiste correctamente, sin tocar BUs no asignadas';
end $$;

-- =========================================================================
-- TEST 2: un no-admin (vendedor1) no puede asignar Business Units —
-- "autorización exclusiva para administradores" (requisito 2).
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000302'); -- vendedor1

  begin
    perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009422', array['00000000-0000-0000-0000-000000009411']::uuid[]);
    raise exception 'TEST 2 FALLÓ: un no-admin no debió poder asignar Business Units';
  exception when others then
    if sqlerrm like 'TEST 2 FALLÓ%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 2 OK: solo un admin puede asignar Business Units';
end $$;

-- =========================================================================
-- TEST 3: cross-org — admin de org_a no puede asignar a una Persona de
-- org_b, ni asignar una Business Unit de org_b a una Persona de org_a.
-- Ninguna fila debe cambiar.
-- =========================================================================
do $$
declare
  v_count_before int;
  v_count_after int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin de org_a

  begin
    perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009423', array['00000000-0000-0000-0000-000000009411']::uuid[]); -- p_org_b
    raise exception 'TEST 3 FALLÓ: un admin de org_a no debió poder asignar a una Persona de org_b';
  exception when others then
    if sqlerrm like 'TEST 3 FALLÓ%' then raise; end if;
  end;

  select count(*) into v_count_before from person_business_units where person_id = '00000000-0000-0000-0000-000000009421' and active = true;

  begin
    perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009421', array['00000000-0000-0000-0000-000000009413']::uuid[]); -- bu_org_b a P1
    raise exception 'TEST 3 FALLÓ: no debió poder asignar una Business Unit de otra organización';
  exception when others then
    if sqlerrm like 'TEST 3 FALLÓ%' then raise; end if;
  end;

  select count(*) into v_count_after from person_business_units where person_id = '00000000-0000-0000-0000-000000009421' and active = true;
  if v_count_after <> v_count_before then
    raise exception 'TEST 3 FALLÓ: una llamada rechazada no debió modificar ninguna fila';
  end if;

  raise notice 'TEST 3 OK: asignación cross-org (Persona y Business Unit) rechazada en ambos sentidos, sin efectos secundarios';
end $$;

-- =========================================================================
-- TEST 4: reasignar P1 a [bu2] únicamente — bu1 queda DESACTIVADA
-- (active=false, fila sigue existiendo, nunca DELETE), bu2 queda activa.
-- =========================================================================
do $$
declare
  v_bu1_active boolean;
  v_bu1_exists boolean;
  v_bu2_active boolean;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin

  perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009421', array['00000000-0000-0000-0000-000000009412']::uuid[]);

  select active into v_bu1_active from person_business_units
    where person_id = '00000000-0000-0000-0000-000000009421' and business_unit_id = '00000000-0000-0000-0000-000000009411';
  select exists(select 1 from person_business_units where person_id = '00000000-0000-0000-0000-000000009421' and business_unit_id = '00000000-0000-0000-0000-000000009411') into v_bu1_exists;
  if v_bu1_active is distinct from false or v_bu1_exists is not true then
    raise exception 'TEST 4 FALLÓ: bu1 debió quedar desactivada (active=false) sin borrarse, vio active=%', v_bu1_active;
  end if;

  select active into v_bu2_active from person_business_units
    where person_id = '00000000-0000-0000-0000-000000009421' and business_unit_id = '00000000-0000-0000-0000-000000009412';
  if v_bu2_active <> true then
    raise exception 'TEST 4 FALLÓ: bu2 debió quedar activa';
  end if;

  raise notice 'TEST 4 OK: reasignación desactiva (nunca borra) la BU removida y activa la nueva';
end $$;

-- =========================================================================
-- TEST 5 ("vendedor con varias unidades"): reasignar P1 a [bu1, bu2] —
-- ambas activas (bu1 reactivada, bu2 sigue activa).
-- =========================================================================
do $$
declare
  v_count int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin

  perform rpc_set_person_business_units(
    '00000000-0000-0000-0000-000000009421',
    array['00000000-0000-0000-0000-000000009411', '00000000-0000-0000-0000-000000009412']::uuid[]
  );

  select count(*) into v_count from person_business_units
    where person_id = '00000000-0000-0000-0000-000000009421' and active = true;
  if v_count <> 2 then
    raise exception 'TEST 5 FALLÓ: P1 debió tener exactamente 2 BU activas, vio %', v_count;
  end if;

  raise notice 'TEST 5 OK: vendedor con varias Business Units asignadas correctamente';
end $$;

-- =========================================================================
-- TEST 6: vendedor1 (sp1, P1 con bu1+bu2 activas) crea Cotizaciones para
-- AMBAS BU exitosamente.
-- =========================================================================
do $$
declare
  v_folio1 text;
  v_folio2 text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000302'); -- vendedor1

  select (rpc_create_quote(
    '00000000-0000-0000-0000-000000009451'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009411', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  )).folio into v_folio1;
  if v_folio1 is null then
    raise exception 'TEST 6 FALLÓ: Cotización para bu1 (asignada) debió crearse';
  end if;

  select (rpc_create_quote(
    '00000000-0000-0000-0000-000000009452'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009412', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  )).folio into v_folio2;
  if v_folio2 is null then
    raise exception 'TEST 6 FALLÓ: Cotización para bu2 (asignada) debió crearse';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 6 OK: vendedor con varias BU asignadas puede cotizar en cualquiera de ellas';
end $$;

-- =========================================================================
-- TEST 7 ("vendedor con una unidad" + "acceso directo mediante RPC"):
-- admin reduce P1 a solo [bu1] — vendedor1 ya NO puede crear Cotización
-- para bu2 (aunque invoque el RPC directamente, sin pasar por el
-- selector), pero SÍ puede para bu1.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin
  perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009421', array['00000000-0000-0000-0000-000000009411']::uuid[]);

  perform test_set_user('00000000-0000-0000-0000-000000000302'); -- vendedor1

  begin
    perform rpc_create_quote(
      '00000000-0000-0000-0000-000000009453'::uuid,
      jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009412', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
    );
    raise exception 'TEST 7 FALLÓ: vendedor1 no debió poder crear una Cotización para bu2 (ya no asignada), ni por acceso directo al RPC';
  exception when others then
    if sqlerrm like 'TEST 7 FALLÓ%' then raise; end if;
  end;

  perform rpc_create_quote(
    '00000000-0000-0000-0000-000000009454'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009411', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  );

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 7 OK: vendedor con una sola Business Unit asignada queda bloqueado para las demás, incluso llamando al RPC directamente';
end $$;

-- =========================================================================
-- TEST 8 ("administrador"): admin crea una Cotización EN NOMBRE de sp1
-- para bu2 (NO asignada a sp1 en este punto) — SÍ se permite: Dirección
-- conserva acceso completo, el bypass es del actor, no del salesperson
-- destino.
-- =========================================================================
do $$
declare
  v_folio text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin

  select (rpc_create_quote(
    '00000000-0000-0000-0000-000000009455'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009412', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  )).folio into v_folio;
  if v_folio is null then
    raise exception 'TEST 8 FALLÓ: un admin debió poder crear la Cotización en nombre de sp1 para bu2 aunque no esté asignada';
  end if;

  raise notice 'TEST 8 OK: admin conserva acceso completo — bypass del chequeo nuevo para cualquier combinación salesperson/BU';
end $$;

-- =========================================================================
-- TEST 9 ("vendedor sin asignaciones"): sp2/P2 nunca tuvo asignaciones —
-- fallback legacy intacto, puede cotizar para bu1 (BU activa de su
-- organización) sin ninguna restricción nueva.
-- =========================================================================
do $$
declare
  v_folio text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000303'); -- vendedor2

  select (rpc_create_quote(
    '00000000-0000-0000-0000-000000009456'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009411', 'salesperson_id', '00000000-0000-0000-0000-000000009432', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  )).folio into v_folio;
  if v_folio is null then
    raise exception 'TEST 9 FALLÓ: vendedor sin asignaciones explícitas debió conservar su acceso actual (fallback)';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 9 OK: vendedor sin asignaciones explícitas conserva el comportamiento actual (fallback), sin restricción nueva';
end $$;

-- =========================================================================
-- TEST 10: rpc_list_own_business_units() — cada vendedor ve EXCLUSIVAMENTE
-- sus propias asignaciones activas, nunca las de otro.
-- =========================================================================
do $$
declare
  v_count_v1 int;
  v_count_v2 int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000302'); -- vendedor1 (bu1 activa únicamente, tras TEST 7)
  select count(*) into v_count_v1 from rpc_list_own_business_units() where business_unit_id = '00000000-0000-0000-0000-000000009411';
  if v_count_v1 <> 1 then
    raise exception 'TEST 10 FALLÓ: vendedor1 debió ver exactamente su propia asignación activa (bu1), vio %', v_count_v1;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000303'); -- vendedor2 (0 asignaciones siempre)
  select count(*) into v_count_v2 from rpc_list_own_business_units();
  if v_count_v2 <> 0 then
    raise exception 'TEST 10 FALLÓ: vendedor2 (sin asignaciones) debió ver 0 filas, vio %', v_count_v2;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 10 OK: rpc_list_own_business_units() está correctamente acotado a la propia Persona del que llama';
end $$;

-- =========================================================================
-- TEST 11: revocar TODAS las asignaciones de P1 — fallback legacy
-- restaurado, vendedor1 vuelve a poder cotizar para bu2 (comportamiento
-- previo a cualquier asignación explícita).
-- =========================================================================
do $$
declare
  v_folio text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000301'); -- admin
  perform rpc_set_person_business_units('00000000-0000-0000-0000-000000009421', array[]::uuid[]);

  perform test_set_user('00000000-0000-0000-0000-000000000302'); -- vendedor1

  select (rpc_create_quote(
    '00000000-0000-0000-0000-000000009457'::uuid,
    jsonb_build_object('business_unit_id', '00000000-0000-0000-0000-000000009412', 'salesperson_id', '00000000-0000-0000-0000-000000009431', 'customer_id', '00000000-0000-0000-0000-000000009441', 'currency', 'MXN')
  )).folio into v_folio;
  if v_folio is null then
    raise exception 'TEST 11 FALLÓ: al revocar todas las asignaciones, el fallback legacy debió restaurarse';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000301');
  raise notice 'TEST 11 OK: revocar todas las asignaciones restaura el fallback legacy (comportamiento previo)';
end $$;

reset role;
rollback;
