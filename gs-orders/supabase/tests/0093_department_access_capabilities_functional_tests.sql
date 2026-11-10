-- THÖREN — Control de acceso por departamentos (0093_department_access_capabilities.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — mismo criterio que 0079/0083. Todo el script corre en una transacción
-- que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000201'
\set empleado '00000000-0000-0000-0000-000000000202'
\set otro_admin '00000000-0000-0000-0000-000000000203'
\set vendedor '00000000-0000-0000-0000-000000000204'
\set org_a '00000000-0000-0000-0000-000000009301'
\set org_b '00000000-0000-0000-0000-000000009302'
\set empleado_org_b '00000000-0000-0000-0000-000000000205'

insert into auth.users (id, email) values
  (:'admin', 'admin-93@test.local'),
  (:'empleado', 'empleado-93@test.local'),
  (:'otro_admin', 'otro-admin-93@test.local'),
  (:'vendedor', 'vendedor-93@test.local'),
  (:'empleado_org_b', 'empleado-org-b-93@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 93 A', 'test-org-93-a'),
  (:'org_b', 'Test Org 93 B', 'test-org-93-b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 93', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true);

insert into user_profiles (user_id, name, role, active) values
  (:'otro_admin', 'Otro Admin Test 93', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'otro_admin', 'admin', true);

\set sp_empleado '00000000-0000-0000-0000-000000009311'
\set sp_vendedor '00000000-0000-0000-0000-000000009312'
\set sp_empleado_org_b '00000000-0000-0000-0000-000000009321'

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_empleado', :'org_a', 'Empleado Test 93', 'EM93', true),
  (:'sp_vendedor', :'org_a', 'Vendedor Test 93', 'VE93', true),
  (:'sp_empleado_org_b', :'org_b', 'Empleado Org B 93', 'EB93', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'empleado', 'Empleado Test 93', 'vendedor', :'sp_empleado', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'empleado', 'vendedor', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor', 'Vendedor Test 93', 'vendedor', :'sp_vendedor', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor', 'vendedor', true);

-- empleado_org_b: pertenece a org_b, no a org_a — usado para el intento
-- cross-org del admin de org_a.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'empleado_org_b', 'Empleado Org B 93', 'vendedor', :'sp_empleado_org_b', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_b', :'empleado_org_b', 'vendedor', true);

select 'FIXTURES OK' as marker;

set role authenticated;

-- =========================================================================
-- TEST 1: admin no puede asignarse departamentos a sí mismo.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin

  begin
    perform rpc_set_user_departments('00000000-0000-0000-0000-000000000201', array['can_access_ventas']);
    raise exception 'TEST 1 FALLO: un admin no debió poder asignarse departamentos a sí mismo';
  exception when others then
    if sqlerrm like 'TEST 1 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 1 OK: auto-asignación bloqueada';
end $$;

-- =========================================================================
-- TEST 2: un no-admin (vendedor, incluso con can_manage_users si lo
-- tuviera) no puede asignar departamentos a otro usuario.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000204'); -- vendedor

  begin
    perform rpc_set_user_departments('00000000-0000-0000-0000-000000000202', array['can_access_ventas']);
    raise exception 'TEST 2 FALLO: un no-admin no debió poder asignar departamentos';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000201');
  raise notice 'TEST 2 OK: solo un admin puede asignar departamentos';
end $$;

-- =========================================================================
-- TEST 3: admin asigna Ventas+Compras a empleado — persisten exactamente
-- esas 2 capabilities activas, con granted_by/granted_at poblados.
-- =========================================================================
do $$
declare
  v_count int;
  v_granted_by uuid;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin

  perform rpc_set_user_departments('00000000-0000-0000-0000-000000000202', array['can_access_ventas', 'can_access_compras']);

  select count(*) into v_count from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202'
      and capability in ('can_access_ventas', 'can_access_compras')
      and active = true;
  if v_count <> 2 then
    raise exception 'TEST 3 FALLO: esperaba 2 capabilities de departamento activas, encontró %', v_count;
  end if;

  select granted_by_user_id into v_granted_by from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and capability = 'can_access_ventas';
  if v_granted_by <> '00000000-0000-0000-0000-000000000201' then
    raise exception 'TEST 3 FALLO: granted_by_user_id debió ser el admin que otorgó';
  end if;

  select count(*) into v_count from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202'
      and capability in ('can_access_almacen', 'can_access_logistica', 'can_access_administracion')
      and active = true;
  if v_count <> 0 then
    raise exception 'TEST 3 FALLO: ningún otro departamento debió activarse, encontró %', v_count;
  end if;

  raise notice 'TEST 3 OK: grant persiste con audit columns correctas, sin activar otros departamentos';
end $$;

-- =========================================================================
-- TEST 4: admin reemplaza la asignación por solo Almacén — Ventas/Compras
-- quedan revocados (active=false, revoked_by/revoked_at poblados), nunca
-- borrados (fila sigue existiendo).
-- =========================================================================
do $$
declare
  v_active boolean;
  v_revoked_by uuid;
  v_count_rows int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin

  perform rpc_set_user_departments('00000000-0000-0000-0000-000000000202', array['can_access_almacen']);

  select active, revoked_by_user_id into v_active, v_revoked_by from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and capability = 'can_access_ventas';
  if v_active <> false or v_revoked_by is null then
    raise exception 'TEST 4 FALLO: can_access_ventas debió quedar revocada (active=false, revoked_by poblado), active=%, revoked_by=%', v_active, v_revoked_by;
  end if;

  select count(*) into v_count_rows from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and capability = 'can_access_ventas';
  if v_count_rows <> 1 then
    raise exception 'TEST 4 FALLO: la fila de can_access_ventas no debió borrarse (DELETE), debió quedar como revocada';
  end if;

  select active into v_active from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and capability = 'can_access_almacen';
  if v_active <> true then
    raise exception 'TEST 4 FALLO: can_access_almacen debió quedar activa';
  end if;

  raise notice 'TEST 4 OK: revoke deja active=false + revoked_by/revoked_at, nunca DELETE';
end $$;

-- =========================================================================
-- TEST 5: re-otorgar Ventas tras haberla revocado — vuelve a quedar
-- activa, con nuevo granted_by/granted_at (no el original) y revoked_*
-- limpiados.
-- =========================================================================
do $$
declare
  v_active boolean;
  v_revoked_by uuid;
  v_revoked_at timestamptz;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin

  perform rpc_set_user_departments('00000000-0000-0000-0000-000000000202', array['can_access_almacen', 'can_access_ventas']);

  select active, revoked_by_user_id, revoked_at into v_active, v_revoked_by, v_revoked_at from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and capability = 'can_access_ventas';
  if v_active <> true or v_revoked_by is not null or v_revoked_at is not null then
    raise exception 'TEST 5 FALLO: re-otorgar debió reactivar y limpiar revoked_by/revoked_at (active=%, revoked_by=%, revoked_at=%)', v_active, v_revoked_by, v_revoked_at;
  end if;

  raise notice 'TEST 5 OK: re-grant tras revoke reactiva correctamente y limpia metadatos de revocación';
end $$;

-- =========================================================================
-- TEST 6: clave de departamento inválida es rechazada, sin modificar nada.
-- =========================================================================
do $$
declare
  v_count_before int;
  v_count_after int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin

  select count(*) into v_count_before from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and active = true;

  begin
    perform rpc_set_user_departments('00000000-0000-0000-0000-000000000202', array['can_access_ventas', 'departamento_invalido']);
    raise exception 'TEST 6 FALLO: una clave de departamento inválida debió rechazarse';
  exception when others then
    if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
  end;

  select count(*) into v_count_after from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000202' and active = true;
  if v_count_after <> v_count_before then
    raise exception 'TEST 6 FALLO: una llamada rechazada no debió modificar ninguna fila (antes=%, después=%)', v_count_before, v_count_after;
  end if;

  raise notice 'TEST 6 OK: clave inválida rechazada sin efectos secundarios';
end $$;

-- =========================================================================
-- TEST 7: un admin no puede asignar departamentos a un usuario de OTRA
-- organización (cross-org) — rechazado como "no encontrado".
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000201'); -- admin de org_a

  begin
    perform rpc_set_user_departments('00000000-0000-0000-0000-000000000205', array['can_access_ventas']); -- empleado_org_b
    raise exception 'TEST 7 FALLO: un admin no debió poder asignar departamentos a un usuario de otra organización';
  exception when others then
    if sqlerrm like 'TEST 7 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 7 OK: asignación cross-org rechazada';
end $$;

-- =========================================================================
-- TEST 8: un segundo admin de la MISMA organización también puede
-- administrar las asignaciones (no es exclusivo de un único admin) —
-- confirma que la autoridad es is_organization_admin(), no un usuario fijo.
-- =========================================================================
do $$
declare
  v_active boolean;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000203'); -- otro_admin

  perform rpc_set_user_departments('00000000-0000-0000-0000-000000000204', array['can_access_logistica']); -- vendedor

  select active into v_active from user_capabilities
    where user_id = '00000000-0000-0000-0000-000000000204' and capability = 'can_access_logistica';
  if v_active <> true then
    raise exception 'TEST 8 FALLO: otro_admin (admin de la misma organización) debió poder otorgar el departamento';
  end if;

  raise notice 'TEST 8 OK: cualquier admin de la organización puede administrar asignaciones';
end $$;

reset role;
rollback;
