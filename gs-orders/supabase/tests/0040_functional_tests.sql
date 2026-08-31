-- THÖREN — Fase 6R.1A: Roles + Capacidades (0040) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0040 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible.
--
-- 6R.1A es infraestructura 100% aditiva sin conexión a ningún RLS/RPC
-- existente todavía — estas pruebas verifican EXCLUSIVAMENTE:
--   1) que user_capabilities está protegida como exige la fase (solo
--      is_organization_admin() puede escribir, nunca can_manage_users,
--      nunca el propio usuario);
--   2) que current_user_has_capability() resuelve correctamente
--      (organización actual, activo, aislamiento cross-org, bypass admin);
--   3) que los roles/capacidades actuales de Vladimir y los vendedores NO
--      cambiaron (regresión de comportamiento).
--
-- Nota técnica: dentro de un bloque `do $$ ... $$` la sustitución de
-- variables psql (`:'var'`) no es fiable (confirmado empíricamente) — por
-- eso, igual que 0039_functional_tests.sql, los ids se cargan una sola vez
-- en una tabla temporal (_ids) y cada bloque los lee a variables PL/pgSQL
-- locales.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set orgb '20000000-0000-0000-0000-000000000001'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset

create temp table _ids as
  select
    :'org1'::uuid as org1,
    :'orgb'::uuid as orgb,
    :'admin'::uuid as admin_id,
    :'vendedor1'::uuid as vendedor1_id,
    :'vendedor2'::uuid as vendedor2_id,
    :'admin_orgb'::uuid as admin_orgb_id;

-- =========================================================================
-- TEST 1 — usuario normal (vendedor1) NO puede otorgarse una capacidad a
-- sí mismo.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid; v_vendedor1 uuid;
begin
  select org1, vendedor1_id into v_org1, v_vendedor1 from _ids;
  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_org1, v_vendedor1, 'can_view_all_sales', v_vendedor1);
    raise exception 'TEST 1 FAILED: vendedor1 pudo otorgarse una capacidad a sí mismo';
  exception
    when insufficient_privilege or others then
      if sqlerrm like 'TEST 1 FAILED%' then raise; end if;
      raise notice 'TEST 1 OK: insert rechazado para vendedor1 (self-grant) — %', sqlerrm;
  end;
end $$;

select test_set_user(:'admin');
do $$
declare v_vendedor1 uuid;
begin
  select vendedor1_id into v_vendedor1 from _ids;
  if exists (select 1 from user_capabilities where user_id = v_vendedor1 and capability = 'can_view_all_sales') then
    raise exception 'TEST 1 FAILED: la fila de self-grant de vendedor1 sí quedó insertada';
  end if;
  raise notice 'TEST 1 OK: confirmado, ninguna fila insertada';
end $$;

-- =========================================================================
-- TEST 2 — usuario normal (vendedor1) NO puede otorgar una capacidad a
-- OTRO usuario (vendedor2).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid; v_vendedor1 uuid; v_vendedor2 uuid;
begin
  select org1, vendedor1_id, vendedor2_id into v_org1, v_vendedor1, v_vendedor2 from _ids;
  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_org1, v_vendedor2, 'can_view_all_sales', v_vendedor1);
    raise exception 'TEST 2 FAILED: vendedor1 pudo otorgar una capacidad a vendedor2';
  exception
    when insufficient_privilege or others then
      if sqlerrm like 'TEST 2 FAILED%' then raise; end if;
      raise notice 'TEST 2 OK: insert rechazado para vendedor1 -> vendedor2 — %', sqlerrm;
  end;
end $$;

-- =========================================================================
-- Fixture: admin otorga can_manage_users a vendedor1 (simula a Alexandro)
-- para las pruebas 3-5 — el ÚNICO camino de escritura válido es admin.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org1 uuid; v_admin uuid; v_vendedor1 uuid;
begin
  select org1, admin_id, vendedor1_id into v_org1, v_admin, v_vendedor1 from _ids;
  insert into user_capabilities (id, organization_id, user_id, capability, granted_by_user_id)
  values ('50000000-0000-0000-0000-000000000001', v_org1, v_vendedor1, 'can_manage_users', v_admin);

  if not exists (select 1 from user_capabilities where id = '50000000-0000-0000-0000-000000000001' and active) then
    raise exception 'Fixture inválido: admin no pudo otorgar can_manage_users a vendedor1';
  end if;
  raise notice 'Fixture OK: vendedor1 ahora tiene can_manage_users (otorgada por admin)';
end $$;

-- =========================================================================
-- TEST 3 — can_manage_users NO puede otorgarse OTRA capacidad a sí mismo.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_org1 uuid; v_vendedor1 uuid;
begin
  select org1, vendedor1_id into v_org1, v_vendedor1 from _ids;
  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_org1, v_vendedor1, 'can_view_costs', v_vendedor1);
    raise exception 'TEST 3 FAILED: vendedor1 (con can_manage_users) pudo otorgarse can_view_costs';
  exception
    when insufficient_privilege or others then
      if sqlerrm like 'TEST 3 FAILED%' then raise; end if;
      raise notice 'TEST 3 OK: can_manage_users no habilita self-grant — %', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 4 — can_manage_users NO puede otorgar una capacidad a un tercero
-- (vendedor2).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_org1 uuid; v_vendedor1 uuid; v_vendedor2 uuid;
begin
  select org1, vendedor1_id, vendedor2_id into v_org1, v_vendedor1, v_vendedor2 from _ids;
  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_org1, v_vendedor2, 'can_view_all_sales', v_vendedor1);
    raise exception 'TEST 4 FAILED: vendedor1 (con can_manage_users) pudo otorgar capacidad a vendedor2';
  exception
    when insufficient_privilege or others then
      if sqlerrm like 'TEST 4 FAILED%' then raise; end if;
      raise notice 'TEST 4 OK: can_manage_users no habilita otorgar a terceros — %', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 5 — can_manage_users NO puede convertir a un usuario (ni a sí
-- mismo) en admin. Antes de 0046 (THÖREN 6R.1B-4A), la RLS de
-- user_profiles era admin-only exclusivo y un UPDATE que no cumplía
-- current_user_is_admin() simplemente no afectaba ninguna fila (0 rows,
-- sin excepción). Desde 0046, trg_prevent_non_admin_role_escalation
-- bloquea la misma escalación con una excepción explícita ANTES de que
-- importe si alguna policy de UPDATE hubiera dejado pasar la fila —
-- protección estrictamente más fuerte, no una regresión: se acepta
-- cualquiera de las dos formas de bloqueo.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_vendedor1 uuid; v_blocked boolean := false;
begin
  select vendedor1_id into v_vendedor1 from _ids;
  begin
    update user_profiles set role = 'admin' where user_id = v_vendedor1;
    if not found then v_blocked := true; end if;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 5 FAILED: vendedor1 (con can_manage_users) pudo convertirse en admin';
  end if;
  raise notice 'TEST 5 OK: la escalación fue bloqueada (RLS de 0 filas o excepción del trigger de 0046).';
end $$;

select test_set_user(:'admin');
do $$
declare v_vendedor1 uuid;
begin
  select vendedor1_id into v_vendedor1 from _ids;
  if (select role from user_profiles where user_id = v_vendedor1) = 'admin' then
    raise exception 'TEST 5 FAILED: vendedor1 quedó como admin en la tabla';
  end if;
  raise notice 'TEST 5 OK: confirmado, vendedor1 sigue vendedor';
end $$;

-- =========================================================================
-- Limpieza: revocar can_manage_users de vendedor1 (solo admin puede) antes
-- de continuar, para no interferir con pruebas de current_user_has_capability
-- más abajo que usan vendedor1 como "usuario sin capacidades".
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_admin uuid;
begin
  select admin_id into v_admin from _ids;
  update user_capabilities set active = false, revoked_by_user_id = v_admin, revoked_at = now()
    where id = '50000000-0000-0000-0000-000000000001';
end $$;

-- =========================================================================
-- TEST 6 — cross-org capability injection bloqueada, en sus DOS formas:
-- (a) admin_orgb (admin de Org B) no puede escribir con organization_id =
--     Org 1 (RLS: no es admin ahí);
-- (b) admin_orgb SÍ es admin de Org B (pasaría RLS), pero no puede
--     otorgar la capacidad a vendedor1, que no pertenece a Org B — lo
--     bloquea el trigger de integridad "mismo org", no RLS.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_org1 uuid; v_orgb uuid; v_vendedor1 uuid; v_admin_orgb uuid;
begin
  select org1, orgb, vendedor1_id, admin_orgb_id into v_org1, v_orgb, v_vendedor1, v_admin_orgb from _ids;

  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_org1, v_vendedor1, 'can_view_all_sales', v_admin_orgb);
    raise exception 'TEST 6 FAILED: admin_orgb pudo otorgar una capacidad en Org 1 (no es admin ahí)';
  exception
    when insufficient_privilege or others then
      if sqlerrm like 'TEST 6 FAILED%' then raise; end if;
      raise notice 'TEST 6a OK: admin_orgb no puede escribir en user_capabilities de Org 1 (RLS) — %', sqlerrm;
  end;

  begin
    insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id)
    values (v_orgb, v_vendedor1, 'can_view_all_sales', v_admin_orgb);
    raise exception 'TEST 6 FAILED: admin_orgb pudo otorgar una capacidad de Org B a un usuario que no pertenece ahí';
  exception
    when others then
      if sqlerrm like 'TEST 6 FAILED%' then raise; end if;
      raise notice 'TEST 6b OK: trigger de integridad "mismo org" bloqueó la inyección cruzada — %', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 7 — capability válida puede consultarse correctamente vía
-- current_user_has_capability() una vez otorgada.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org1 uuid; v_admin uuid; v_vendedor2 uuid;
begin
  select org1, admin_id, vendedor2_id into v_org1, v_admin, v_vendedor2 from _ids;
  insert into user_capabilities (id, organization_id, user_id, capability, granted_by_user_id)
  values ('50000000-0000-0000-0000-000000000002', v_org1, v_vendedor2, 'can_view_all_sales', v_admin);
end $$;

select test_set_user(:'vendedor2');
do $$
begin
  if not current_user_has_capability('can_view_all_sales') then
    raise exception 'TEST 7 FAILED: vendedor2 debería tener can_view_all_sales activa';
  end if;
  raise notice 'TEST 7 OK: current_user_has_capability() resuelve true para capacidad otorgada';
end $$;

-- =========================================================================
-- TEST 8 — capacidad de OTRA organización no aplica: una fila de
-- user_capabilities de Org B es invisible para un usuario de Org 1 (SELECT
-- RLS) — refuerza que current_user_has_capability() nunca podría cruzarla.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid; v_admin_orgb uuid;
begin
  select orgb, admin_orgb_id into v_orgb, v_admin_orgb from _ids;
  insert into user_capabilities (id, organization_id, user_id, capability, granted_by_user_id)
  values ('50000000-0000-0000-0000-000000000003', v_orgb, v_admin_orgb, 'can_view_all_sales', v_admin_orgb);
end $$;

select test_set_user(:'vendedor2');
do $$
begin
  if exists (select 1 from user_capabilities where id = '50000000-0000-0000-0000-000000000003') then
    raise exception 'TEST 8 FAILED: vendedor2 (Org 1) puede leer una fila de user_capabilities de Org B';
  end if;
  raise notice 'TEST 8 OK: fila de Org B invisible para usuario de Org 1';
end $$;

-- =========================================================================
-- TEST 9 — usuario inactivo no obtiene la capacidad efectiva aunque la
-- fila exista y esté activa.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_vendedor2 uuid;
begin
  select vendedor2_id into v_vendedor2 from _ids;
  update user_profiles set active = false where user_id = v_vendedor2;
end $$;

select test_set_user(:'vendedor2');
do $$
begin
  if current_user_has_capability('can_view_all_sales') then
    raise exception 'TEST 9 FAILED: vendedor2 inactivo obtuvo la capacidad de todas formas';
  end if;
  raise notice 'TEST 9 OK: usuario inactivo no obtiene capacidad efectiva';
end $$;

select test_set_user(:'admin');
do $$
declare v_vendedor2 uuid;
begin
  select vendedor2_id into v_vendedor2 from _ids;
  update user_profiles set active = true where user_id = v_vendedor2;
end $$;

-- =========================================================================
-- TEST 10 — Vladimir/admin conserva bypass total en
-- current_user_has_capability(), incluso para una capacidad que NUNCA se
-- le otorgó explícitamente (ninguna fila en user_capabilities para admin)
-- e incluso para una clave que no existe en el catálogo.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_admin uuid;
begin
  select admin_id into v_admin from _ids;
  if exists (select 1 from user_capabilities where user_id = v_admin) then
    raise exception 'Fixture inválido para TEST 10: admin ya tiene una fila en user_capabilities';
  end if;
  if not current_user_has_capability('can_approve_purchase_orders') then
    raise exception 'TEST 10 FAILED: admin no tiene bypass total en current_user_has_capability()';
  end if;
  if not current_user_has_capability('capacidad_que_no_existe_en_el_catalogo') then
    raise exception 'TEST 10 FAILED: el bypass de admin debe aplicar incluso a claves no catalogadas';
  end if;
  raise notice 'TEST 10 OK: admin tiene bypass total, sin fila propia en user_capabilities';
end $$;

-- =========================================================================
-- TEST 11 — roles actuales (admin/vendedor) siguen funcionando: el CHECK
-- ampliado no rompe los valores existentes, y los 3 roles nuevos son
-- asignables (infraestructura lista) sin que nadie real los use todavía.
-- =========================================================================
do $$
declare
  v_sales_manager_id uuid := '50000000-0000-0000-0000-0000000000aa';
  v_partner_id uuid := '50000000-0000-0000-0000-0000000000ab';
  v_logistics_id uuid := '50000000-0000-0000-0000-0000000000ac';
  v_invalid_id uuid := '50000000-0000-0000-0000-0000000000ad';
begin
  insert into auth.users (id, email) values
    (v_sales_manager_id, 'test-sales-manager-6r1a@test.local'),
    (v_partner_id, 'test-partner-6r1a@test.local'),
    (v_logistics_id, 'test-logistics-6r1a@test.local');

  insert into user_profiles (user_id, name, role, active) values (v_sales_manager_id, 'Test Sales Manager', 'sales_manager', true);
  insert into user_profiles (user_id, name, role, active) values (v_partner_id, 'Test Partner', 'partner', true);
  insert into user_profiles (user_id, name, role, active) values (v_logistics_id, 'Test Logistics', 'logistics', true);
  raise notice 'TEST 11 OK: sales_manager/partner/logistics son valores válidos de role';

  begin
    insert into auth.users (id, email) values (v_invalid_id, 'test-invalido-6r1a@test.local');
    insert into user_profiles (user_id, name, role, active) values (v_invalid_id, 'Test Invalido', 'gerente_supremo', true);
    raise exception 'TEST 11 FAILED: un valor de role fuera del catálogo fue aceptado';
  exception
    when check_violation then
      raise notice 'TEST 11 OK: el CHECK sigue rechazando valores fuera del catálogo (5 permitidos, no más)';
  end;
end $$;

-- Confirmar que admin/vendedor1/vendedor2 NO cambiaron de rol por nada de lo anterior.
do $$
declare v_admin uuid; v_vendedor1 uuid; v_vendedor2 uuid;
begin
  select admin_id, vendedor1_id, vendedor2_id into v_admin, v_vendedor1, v_vendedor2 from _ids;
  if (select role from user_profiles where user_id = v_admin) <> 'admin' then
    raise exception 'TEST 11 FAILED: admin ya no tiene role=admin';
  end if;
  if (select role from user_profiles where user_id = v_vendedor1) <> 'vendedor' then
    raise exception 'TEST 11 FAILED: vendedor1 ya no tiene role=vendedor';
  end if;
  if (select role from user_profiles where user_id = v_vendedor2) <> 'vendedor' then
    raise exception 'TEST 11 FAILED: vendedor2 ya no tiene role=vendedor';
  end if;
  raise notice 'TEST 11 OK: admin/vendedor1/vendedor2 conservan exactamente su rol original';
end $$;

-- =========================================================================
-- TEST 12 — regresión de permisos existentes intacta: Purchase Orders
-- sigue siendo admin-only para creación (sin cambios por 0040) incluso
-- sobre un Pedido real del propio vendedor.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid;
  v_customer1 uuid;
  v_order orders;
  v_supplier suppliers;
begin
  select org1 into v_org1 from _ids;
  select id into v_customer1 from customers where organization_id = v_org1 limit 1;

  -- salesperson_id de vendedor1 = 10000000-0000-0000-0000-000000000001 (ver fixtures.sql).
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001', 'order_date', current_date::text,
      'client_name', 'Cliente TEST12', 'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(jsonb_build_object('model', 'TEST12', 'quantity', 1, 'unit', 'pza'))
  );
  perform set_config('test.order_test12_id', v_order.id::text, false);

  insert into suppliers (organization_id, name) values (v_org1, 'Proveedor TEST12') returning * into v_supplier;
  perform set_config('test.supplier_test12_id', v_supplier.id::text, false);
end $$;

select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid;
  v_order_id uuid := current_setting('test.order_test12_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier_test12_id')::uuid;
begin
  select org1 into v_org1 from _ids;
  insert into purchase_orders (organization_id, order_id, supplier_id, folio, sequence_number, po_date)
  values (v_org1, v_order_id, v_supplier_id, 'PO-TEST12', 1, current_date);
  raise exception 'TEST 12 FAILED: vendedor1 pudo crear una Purchase Order (sigue siendo admin-only, sin cambios)';
exception
  when insufficient_privilege or others then
    if sqlerrm like 'TEST 12 FAILED%' then raise; end if;
    raise notice 'TEST 12 OK: purchase_orders sigue admin-only para vendedor1 tras 0040 — %', sqlerrm;
end $$;

rollback;
