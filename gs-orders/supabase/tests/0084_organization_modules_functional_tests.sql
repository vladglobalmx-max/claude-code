-- THÖREN — Multiempresa real: datos de organización editables + módulos
-- habilitados por organización (0084_organization_modules.sql) — pruebas
-- funcionales contra Postgres real. Fixtures 100% autocontenidas — no
-- depende de la cadena de fixtures de fases anteriores. Todo el script
-- corre en una transacción que se revierte al final (rollback).

begin;

\set admin_a '00000000-0000-0000-0000-000000000101'
\set vendedor_a '00000000-0000-0000-0000-000000000102'
\set admin_b '00000000-0000-0000-0000-000000000103'
\set org_a '00000000-0000-0000-0000-000000008401'
\set org_b '00000000-0000-0000-0000-000000008402'
\set sp_a '00000000-0000-0000-0000-000000008411'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-a-84@test.local'),
  (:'vendedor_a', 'vendedor-a-84@test.local'),
  (:'admin_b', 'admin-b-84@test.local');

insert into organizations (id, name, slug, currency, timezone) values
  (:'org_a', 'Test Org A 84', 'test-org-a-84', 'MXN', 'America/Monterrey'),
  (:'org_b', 'Test Org B 84', 'test-org-b-84', 'MXN', 'America/Monterrey');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 84', 'admin', true),
  (:'admin_b', 'Admin B Test 84', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true),
  (:'org_b', :'admin_b', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vend A 84', 'VA84', true);
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 84', 'vendedor', :'sp_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true);

select 'FIXTURES OK' as marker;

set role authenticated;

-- =========================================================================
-- TEST 1: rpc_update_organization_settings — admin A actualiza SU propia
-- organización (trade_name/tax_id/currency/timezone), sin tocar
-- active/slug/name (ni siquiera están en la firma de la función).
-- =========================================================================
do $$
declare
  v_org organizations;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a

  select * into v_org from rpc_update_organization_settings('Mi Empresa SA de CV', 'MEM010101AAA', 'USD', 'America/Mexico_City');

  if v_org.trade_name <> 'Mi Empresa SA de CV' or v_org.tax_id <> 'MEM010101AAA' or v_org.currency <> 'USD' or v_org.timezone <> 'America/Mexico_City' then
    raise exception 'TEST 1 FALLÓ: rpc_update_organization_settings no aplicó los valores correctos (trade_name=%, tax_id=%, currency=%, timezone=%)',
      v_org.trade_name, v_org.tax_id, v_org.currency, v_org.timezone;
  end if;
  if v_org.name <> 'Test Org A 84' or v_org.slug <> 'test-org-a-84' or v_org.active <> true then
    raise exception 'TEST 1 FALLÓ: name/slug/active NO debieron cambiar (name=%, slug=%, active=%)', v_org.name, v_org.slug, v_org.active;
  end if;

  raise notice 'TEST 1 OK: rpc_update_organization_settings actualiza trade_name/tax_id/currency/timezone, nunca name/slug/active';
end $$;

-- =========================================================================
-- TEST 2: vendedor (no-admin) NO puede llamar rpc_update_organization_settings.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000102'); -- vendedor_a

  begin
    perform rpc_update_organization_settings('Hackeo', null, 'MXN', 'America/Monterrey');
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 2 FALLÓ: un vendedor sin autoridad admin pudo editar la configuración de la organización';
  end if;

  raise notice 'TEST 2 OK: rpc_update_organization_settings exige admin — vendedor rechazado';
end $$;

-- =========================================================================
-- TEST 3: moneda inválida rechazada.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a

  begin
    perform rpc_update_organization_settings('X', null, 'EUR', 'America/Monterrey');
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se aceptó una moneda inválida (EUR)';
  end if;

  raise notice 'TEST 3 OK: moneda inválida rechazada';
end $$;

-- =========================================================================
-- TEST 4: rpc_set_organization_module — admin A deshabilita 'compras'.
-- =========================================================================
do $$
declare v_org_id uuid := '00000000-0000-0000-0000-000000008401';
begin
  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a

  perform rpc_set_organization_module('compras', false);

  if not exists (
    select 1 from organization_modules where organization_id = v_org_id and module_key = 'compras' and enabled = false
  ) then
    raise exception 'TEST 4 FALLÓ: deshabilitar compras no creó la fila esperada';
  end if;

  raise notice 'TEST 4 OK: rpc_set_organization_module deshabilita un módulo toggleable';
end $$;

-- =========================================================================
-- TEST 5: org B (que nunca deshabilitó nada) NO ve la fila de org A —
-- aislamiento cruzado real, no solo por convención de la app.
-- =========================================================================
do $$
declare v_count int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- admin_b

  select count(*) into v_count from organization_modules where module_key = 'compras';
  if v_count <> 0 then
    raise exception 'TEST 5 FALLÓ: admin de Org B vio la fila de organization_modules de Org A (RLS rota)';
  end if;

  raise notice 'TEST 5 OK: aislamiento cruzado real en organization_modules (RLS, no solo convención)';
end $$;

-- =========================================================================
-- TEST 6: reactivar 'compras' BORRA la fila (vuelve al default-on sparse,
-- no la deja como enabled=true) — ver DECISIÓN de la migración.
-- =========================================================================
do $$
declare v_org_id uuid := '00000000-0000-0000-0000-000000008401';
begin
  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a

  perform rpc_set_organization_module('compras', true);

  if exists (select 1 from organization_modules where organization_id = v_org_id and module_key = 'compras') then
    raise exception 'TEST 6 FALLÓ: reactivar compras debió BORRAR la fila, no dejarla como enabled=true';
  end if;

  raise notice 'TEST 6 OK: reactivar un módulo borra la fila — vuelve al default-on sparse';
end $$;

-- =========================================================================
-- TEST 7: un módulo siempre-disponible (inicio/configuracion/
-- unidades_negocio/personas/vendedores) NUNCA se puede deshabilitar —
-- rechazado explícitamente, no silenciosamente ignorado.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a

  begin
    perform rpc_set_organization_module('inicio', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió deshabilitar "inicio" (módulo siempre-disponible)';
  end if;

  v_failed := false;
  begin
    perform rpc_set_organization_module('configuracion', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió deshabilitar "configuracion" (módulo siempre-disponible)';
  end if;

  v_failed := false;
  begin
    perform rpc_set_organization_module('personas', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió deshabilitar "personas" (módulo siempre-disponible)';
  end if;

  v_failed := false;
  begin
    perform rpc_set_organization_module('vendedores', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió deshabilitar "vendedores" (módulo siempre-disponible)';
  end if;

  v_failed := false;
  begin
    perform rpc_set_organization_module('unidades_negocio', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió deshabilitar "unidades_negocio" (módulo siempre-disponible)';
  end if;

  raise notice 'TEST 7 OK: los 5 módulos siempre-disponibles nunca se pueden deshabilitar';
end $$;

-- =========================================================================
-- TEST 8: vendedor (no-admin) NO puede llamar rpc_set_organization_module.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000102'); -- vendedor_a

  begin
    perform rpc_set_organization_module('facturas', false);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 8 FALLÓ: un vendedor sin autoridad admin pudo deshabilitar un módulo';
  end if;

  raise notice 'TEST 8 OK: rpc_set_organization_module exige admin — vendedor rechazado';
end $$;

-- =========================================================================
-- TEST 9: aislamiento cruzado también al ESCRIBIR — admin B deshabilita
-- 'facturas' en SU organización; org A no se ve afectada (sigue
-- default-on, sin fila).
-- =========================================================================
do $$
declare
  v_org_a_id uuid := '00000000-0000-0000-0000-000000008401';
  v_org_b_id uuid := '00000000-0000-0000-0000-000000008402';
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- admin_b

  perform rpc_set_organization_module('facturas', false);

  if not exists (select 1 from organization_modules where organization_id = v_org_b_id and module_key = 'facturas' and enabled = false) then
    raise exception 'TEST 9 FALLÓ: no se deshabilitó facturas para Org B';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101'); -- admin_a
  if exists (select 1 from organization_modules where organization_id = v_org_a_id and module_key = 'facturas') then
    raise exception 'TEST 9 FALLÓ: deshabilitar facturas en Org B afectó a Org A';
  end if;

  raise notice 'TEST 9 OK: deshabilitar un módulo en una organización nunca afecta a otra';
end $$;

reset role;
rollback;
