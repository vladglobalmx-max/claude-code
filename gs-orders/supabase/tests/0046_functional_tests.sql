-- THÖREN — Fase 6R.1B-4A: Administración Técnica de Cuentas — can_manage_users
-- (0046) — pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0046 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final — repetible.
-- Bajo `set role authenticated` REAL (lección de 0043) — no se asume que
-- pasar como dueño de las tablas reproduce el comportamiento de Cloud.
--
-- Usuario sintético "user_manager" (can_manage_users, role='vendedor',
-- salesperson propio) — ningún usuario real (Alexandro) se toca aquí, eso
-- es 6R.1B-4C.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set user_manager '00000000-0000-0000-0000-000000000060'
\set second_admin '00000000-0000-0000-0000-000000000061'
\set new_hire '00000000-0000-0000-0000-000000000062'
\set new_hire2 '00000000-0000-0000-0000-000000000063'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
-- Org B es invisible por RLS para el admin de org1 (organizations_select_member
-- exige membresía) — se usa el UUID fijo y conocido de fixtures.sql en vez de
-- consultarlo bajo esta sesión con alcance restringido.
create temp table _ids as
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2;

-- =========================================================================
-- FIXTURES
-- =========================================================================
do $$
declare
  v_org1 uuid;
  v_um_sp_id uuid;
  v_second_admin_sp_id uuid;
  v_unclaimed_sp_id uuid;
begin
  select org1 into v_org1 from _ids;

  -- user_manager: vendedor activo con salesperson propio + can_manage_users.
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'User Manager 0046', 'UM6', true)
  returning id into v_um_sp_id;
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000060', 'user-manager-0046@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, '00000000-0000-0000-0000-000000000060', 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active) values ('00000000-0000-0000-0000-000000000060', 'User Manager 0046', 'vendedor', v_um_sp_id, true);
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values (v_org1, '00000000-0000-0000-0000-000000000060', 'can_manage_users', true, '00000000-0000-0000-0000-000000000001');

  -- second_admin: admin activo adicional en org1, para probar 12/13 sin
  -- arriesgar al admin real de la organización.
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Second Admin 0046', 'SA6', true)
  returning id into v_second_admin_sp_id;
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000061', 'second-admin-0046@test.local');
  insert into organization_members (organization_id, user_id, role, active) values (v_org1, '00000000-0000-0000-0000-000000000061', 'admin', true);
  -- salesperson_id propio (no null): user_profiles_vendedor_requires_salesperson
  -- exige uno en cuanto TEST 12 degrade a second_admin a role='vendedor'.
  insert into user_profiles (user_id, name, role, salesperson_id, active) values ('00000000-0000-0000-0000-000000000061', 'Second Admin 0046', 'admin', v_second_admin_sp_id, true);

  -- salesperson sin reclamar, para la prueba de vinculación (TEST 6).
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Sin Reclamar 0046', 'SR6', true)
  returning id into v_unclaimed_sp_id;
  perform set_config('test.unclaimed_sp0046_id', v_unclaimed_sp_id::text, false);

  raise notice 'SETUP OK: user_manager %, second_admin %, salesperson sin reclamar %', v_um_sp_id, v_second_admin_sp_id, v_unclaimed_sp_id;
end $$;

-- =========================================================================
-- TEST 1: can_manage_users ve usuarios de su misma organización.
-- =========================================================================
select test_set_user(:'user_manager');
do $$
declare
  v_rows record;
  v_count integer := 0;
  v_has_vendedor1 boolean := false;
  v_has_admin_orgb boolean := false;
begin
  for v_rows in select * from admin_list_user_profiles() loop
    v_count := v_count + 1;
    if v_rows.user_id = '00000000-0000-0000-0000-000000000002' then v_has_vendedor1 := true; end if;
    if v_rows.user_id = '00000000-0000-0000-0000-000000000009' then v_has_admin_orgb := true; end if;
  end loop;
  if v_count = 0 then
    raise exception 'TEST 1 FALLÓ: user_manager no vio ningún usuario de su organización';
  end if;
  if not v_has_vendedor1 then
    raise exception 'TEST 1 FALLÓ: user_manager no vio a vendedor1 (misma organización)';
  end if;
  if v_has_admin_orgb then
    raise exception 'TEST 1 FALLÓ: user_manager vio a admin_orgb (organización distinta) — filtro de organización roto';
  end if;
  raise notice 'TEST 1 OK: user_manager ve % usuarios de su organización, ninguno de Org B.', v_count;
end $$;

-- =========================================================================
-- TEST 2/3: alta de usuario — user_manager completa profile+membership+
-- person para un usuario nuevo con role='vendedor' (simula lo que
-- createUserAccess hace después de que el service role ya creó el
-- auth.users — esa parte de Auth no es testeable aquí, se simula con un
-- INSERT directo como admin, fuera del alcance RLS que 4A modifica). El
-- salesperson NO lo crea createUserAccess — recibe un salesperson_id YA
-- EXISTENTE (preflightSalespersonTaken solo valida que no esté reclamado),
-- así que aquí también se prepara como admin, fuera de RLS.
-- =========================================================================
select test_set_user(:'admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000062', 'new-hire-0046@test.local');
do $$
declare v_new_sp_id uuid;
begin
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'New Hire 0046', 'NH6', true)
  returning id into v_new_sp_id;
  perform set_config('test.new_hire_sp0046_id', v_new_sp_id::text, false);
end $$;
select test_set_user(:'user_manager');
do $$
declare
  v_org1 uuid := (select org1 from _ids);
  v_new_sp_id uuid := current_setting('test.new_hire_sp0046_id')::uuid;
  v_person_id uuid;
begin
  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000062', 'New Hire 0046', 'vendedor', v_new_sp_id, true);

  insert into organization_members (organization_id, user_id, role, active)
  values (v_org1, '00000000-0000-0000-0000-000000000062', 'vendedor', true);

  perform rpc_create_person_for_user('00000000-0000-0000-0000-000000000062', v_org1, 'New Hire 0046', 'new-hire-0046@test.local', true);

  select person_id into v_person_id from user_profiles where user_id = '00000000-0000-0000-0000-000000000062';
  if v_person_id is null then
    raise exception 'TEST 2/3 FALLÓ: la Person no quedó vinculada al perfil nuevo';
  end if;
  raise notice 'TEST 2/3 OK: user_manager completa la alta (profile+membership+person) de un usuario role=vendedor.';
end $$;

-- =========================================================================
-- TEST 4: user_manager activa un usuario no-admin.
-- =========================================================================
select test_set_user(:'admin');
select admin_update_user_role_and_active(:'new_hire', 'vendedor', false);
select test_set_user(:'user_manager');
do $$
begin
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000062', 'vendedor', true);
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000062' and active = true) then
    raise exception 'TEST 4 FALLÓ: el usuario no quedó activo';
  end if;
  raise notice 'TEST 4 OK: user_manager activa un usuario no-admin.';
end $$;

-- =========================================================================
-- TEST 5: user_manager desactiva un usuario no-admin.
-- =========================================================================
do $$
begin
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000062', 'vendedor', false);
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000062' and active = true) then
    raise exception 'TEST 5 FALLÓ: el usuario debía quedar inactivo';
  end if;
  raise notice 'TEST 5 OK: user_manager desactiva un usuario no-admin.';
end $$;
select test_set_user(:'admin');
select admin_update_user_role_and_active(:'new_hire', 'vendedor', true);
select test_set_user(:'user_manager');

-- =========================================================================
-- TEST 6: user_manager vincula/cambia el salesperson de un usuario no-admin.
-- =========================================================================
do $$
declare v_unclaimed_id uuid := current_setting('test.unclaimed_sp0046_id')::uuid;
begin
  update user_profiles set salesperson_id = v_unclaimed_id where user_id = '00000000-0000-0000-0000-000000000062';
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000062' and salesperson_id = v_unclaimed_id) then
    raise exception 'TEST 6 FALLÓ: el salesperson_id no se actualizó';
  end if;
  raise notice 'TEST 6 OK: user_manager cambia el salesperson_id de un usuario no-admin.';
end $$;

-- =========================================================================
-- TEST 7: user_manager NO puede crear un usuario role='admin'.
-- =========================================================================
select test_set_user(:'admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000070', 'intento-admin-0046@test.local');
select test_set_user(:'user_manager');
do $$
declare v_failed boolean := false;
begin
  begin
    insert into user_profiles (user_id, name, role, active)
    values ('00000000-0000-0000-0000-000000000070', 'Intento Admin 0046', 'admin', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 7 FALLÓ: user_manager no debía poder crear una cuenta admin'; end if;
  raise notice 'TEST 7 OK: user_manager NO puede crear una cuenta admin.';
end $$;

-- =========================================================================
-- TEST 8: user_manager NO puede cambiarse a sí mismo a admin.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000060', 'admin', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 8 FALLÓ: user_manager no debía poder autopromoverse a admin'; end if;
  raise notice 'TEST 8 OK: user_manager NO puede cambiarse a sí mismo a admin.';
end $$;

-- =========================================================================
-- TEST 9: user_manager NO puede cambiar a OTRO usuario a admin.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000062', 'admin', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 9 FALLÓ: user_manager no debía poder promover a otro usuario a admin'; end if;
  raise notice 'TEST 9 OK: user_manager NO puede cambiar a otro usuario a admin.';
end $$;

-- =========================================================================
-- TEST 10: user_manager NO puede modificar un target que YA es admin
-- (cambio de role).
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000061', 'vendedor', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: user_manager no debía poder degradar a un admin existente'; end if;
  raise notice 'TEST 10 OK: user_manager NO puede modificar (cambiar role de) un target que ya es admin.';
end $$;

-- =========================================================================
-- TEST 11: user_manager NO puede desactivar a un admin (sin cambiar role).
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000061', 'admin', false);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 11 FALLÓ: user_manager no debía poder desactivar a un admin'; end if;
  raise notice 'TEST 11 OK: user_manager NO puede desactivar a un admin.';
end $$;

-- =========================================================================
-- TEST 12: admin pleno SÍ puede gestionar a otro admin si queda al menos
-- uno activo (degrada a second_admin; org1 conserva a :'admin' activo).
-- =========================================================================
select test_set_user(:'admin');
do $$
begin
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000061', 'vendedor', true);
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000061' and role = 'vendedor' and active = true) then
    raise exception 'TEST 12 FALLÓ: second_admin debía quedar como vendedor activo';
  end if;
  raise notice 'TEST 12 OK: admin pleno degrada a otro admin sin problema (queda al menos un admin activo).';
end $$;

-- =========================================================================
-- TEST 13: NO se puede desactivar/cambiar al ÚLTIMO admin activo de la
-- organización — ni siquiera el propio admin puede hacérselo a sí mismo
-- ahora que second_admin ya no es admin.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000001', 'vendedor', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 13 FALLÓ: no debía poder degradarse el último admin activo de la organización'; end if;

  v_failed := false;
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000001', 'admin', false);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 13 FALLÓ: no debía poder desactivarse el último admin activo de la organización'; end if;

  raise notice 'TEST 13 OK: protección de último admin activo — bloqueado incluso para el propio admin.';
end $$;

-- =========================================================================
-- TEST 14: cross-org bloqueado.
-- =========================================================================
select test_set_user(:'user_manager');
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000009', 'vendedor', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 14 FALLÓ: user_manager no debía poder tocar una cuenta de Org B'; end if;

  if exists (select 1 from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000009') then
    raise exception 'TEST 14 FALLÓ: admin_list_user_profiles() expuso una cuenta de Org B';
  end if;

  raise notice 'TEST 14 OK: cross-org bloqueado (escritura y lectura).';
end $$;

-- =========================================================================
-- TEST 15/16: can_manage_users NO puede insertar ni actualizar/revocar
-- user_capabilities — protección de 0040, sin ningún cambio en 4A.
-- =========================================================================
do $$
declare v_org1 uuid := (select org1 from _ids); v_failed boolean := false;
begin
  begin
    insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
    values (v_org1, '00000000-0000-0000-0000-000000000062', 'can_view_all_sales', true, '00000000-0000-0000-0000-000000000060');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 15 FALLÓ: user_manager no debía poder insertar user_capabilities'; end if;
  raise notice 'TEST 15 OK: user_manager NO puede insertar user_capabilities.';
end $$;

do $$
declare v_rows integer;
begin
  update user_capabilities set active = false where user_id = '00000000-0000-0000-0000-000000000060' and capability = 'can_manage_users';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 16 FALLÓ: user_manager pudo actualizar/revocar user_capabilities (% filas)', v_rows;
  end if;
  raise notice 'TEST 16 OK: user_manager NO puede actualizar/revocar user_capabilities (0 filas afectadas por RLS).';
end $$;

-- =========================================================================
-- FIXTURES DE NEGOCIO (para 17-19) — Pedido y Cotización AJENOS (de
-- vendedor1/salesperson1), mismo patrón que 0044/0045.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_bu1 uuid;
  v_person1 uuid;
  v_quote quotes;
  v_supplier_id uuid;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'Cliente Ajeno 0046', 'product_type', 'otro', 'customer_id', v_customer1),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-0046', 'quantity', 10, 'unit', 'pza'))
  );
  perform set_config('test.ajeno_order0046_id', v_order.id::text, false);

  select id into v_bu1 from business_units where organization_id = v_org1 and code = 'got_fresh_breath';
  select person_id into v_person1 from salespeople where id = v_salesperson1;
  if v_person1 is null then
    insert into people (organization_id, name, active) values (v_org1, 'Persona Vendedor Uno 0046', true) returning id into v_person1;
    update salespeople set person_id = v_person1 where id = v_salesperson1;
  end if;
  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values (v_org1, v_salesperson1, v_bu1, 'VU1Q46')
  on conflict do nothing;
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu1, 'salesperson_id', v_salesperson1, 'customer_id', v_customer1, 'quote_date', current_date::text, 'valid_until', (current_date + 15)::text, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'model', 'COT-0046', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0))
  );
  perform set_config('test.ajeno_quote0046_id', v_quote.id::text, false);

  insert into suppliers (organization_id, name, active) values (v_org1, 'Proveedor 0046', true) returning id into v_supplier_id;
  perform set_config('test.supplier0046_id', v_supplier_id::text, false);

  raise notice 'SETUP NEGOCIO OK: Pedido ajeno %, Cotización ajena %', v_order.id, v_quote.id;
end $$;

-- =========================================================================
-- TEST 17: user_manager NO obtiene autoridad sobre una Cotización ajena.
-- =========================================================================
select test_set_user(:'user_manager');
do $$
declare v_rows integer;
begin
  update quotes set notes = 'intento no autorizado 0046' where id = current_setting('test.ajeno_quote0046_id')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 17 FALLÓ: user_manager pudo escribir en una Cotización ajena (% filas)', v_rows;
  end if;
  raise notice 'TEST 17 OK: user_manager NO obtiene autoridad de escritura sobre una Cotización ajena (0 filas afectadas por RLS).';
end $$;

-- =========================================================================
-- TEST 18: user_manager NO obtiene autoridad sobre un Pedido ajeno.
-- =========================================================================
do $$
declare v_rows integer;
begin
  update orders set client_name = 'intento no autorizado 0046' where id = current_setting('test.ajeno_order0046_id')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 18 FALLÓ: user_manager pudo escribir en un Pedido ajeno (% filas)', v_rows;
  end if;
  raise notice 'TEST 18 OK: user_manager NO obtiene autoridad de escritura sobre un Pedido ajeno (0 filas afectadas por RLS).';
end $$;

-- =========================================================================
-- TEST 19: user_manager NO puede preparar/aprobar una Purchase Order por
-- tener can_manage_users.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.ajeno_order0046_id')::uuid, 'supplier_id', current_setting('test.supplier0046_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', (select id from order_items where order_id = current_setting('test.ajeno_order0046_id')::uuid limit 1), 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 19 FALLÓ: can_manage_users no debía poder preparar una Purchase Order'; end if;
  raise notice 'TEST 19 OK: user_manager (can_manage_users) NO puede preparar/aprobar una Purchase Order.';
end $$;

-- =========================================================================
-- TEST 20: vendedor normal sin capability no administra usuarios.
-- =========================================================================
select test_set_user(:'vendedor2');
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_list_user_profiles();
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 20 FALLÓ: un vendedor normal sin capability no debía poder listar usuarios'; end if;
  raise notice 'TEST 20 OK: vendedor normal sin capability NO administra usuarios.';
end $$;

-- =========================================================================
-- TEST 21: admin bypass conserva funcionamiento completo.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_count integer;
begin
  select count(*) into v_count from admin_list_user_profiles();
  if v_count = 0 then
    raise exception 'TEST 21 FALLÓ: admin no vio ningún usuario';
  end if;
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000062', 'vendedor', false);
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000062', 'vendedor', true);
  raise notice 'TEST 21 OK: admin conserva bypass total (% usuarios visibles, gestión normal intacta).', v_count;
end $$;

-- =========================================================================
-- TEST 22: creación con salesperson histórica NO duplica people (0042,
-- ahora también con user_manager como actor).
-- =========================================================================
do $$
declare
  v_org1 uuid := (select org1 from _ids);
  v_hist_sp_id uuid;
  v_hist_person_id uuid;
begin
  insert into people (organization_id, name, active) values (v_org1, 'Persona Histórica 0046', true) returning id into v_hist_person_id;
  insert into salespeople (id, business_unit, name, prefix, active, person_id)
  values (gen_random_uuid(), 'thunder', 'Salesperson Histórico 0046', 'SH6', true, v_hist_person_id)
  returning id into v_hist_sp_id;
  perform set_config('test.hist_sp0046_id', v_hist_sp_id::text, false);
  perform set_config('test.hist_person0046_id', v_hist_person_id::text, false);
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000063', 'new-hire2-0046@test.local');
select test_set_user(:'user_manager');
do $$
declare
  v_org1 uuid := (select org1 from _ids);
  v_hist_sp_id uuid := current_setting('test.hist_sp0046_id')::uuid;
  v_hist_person_id uuid := current_setting('test.hist_person0046_id')::uuid;
  v_people_count_before integer;
  v_people_count_after integer;
  v_linked_person_id uuid;
begin
  select count(*) into v_people_count_before from people;

  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000063', 'New Hire 2 0046', 'vendedor', v_hist_sp_id, true);
  insert into organization_members (organization_id, user_id, role, active)
  values (v_org1, '00000000-0000-0000-0000-000000000063', 'vendedor', true);
  perform rpc_create_person_for_user('00000000-0000-0000-0000-000000000063', v_org1, 'New Hire 2 0046', 'new-hire2-0046@test.local', true);

  select count(*) into v_people_count_after from people;
  select person_id into v_linked_person_id from user_profiles where user_id = '00000000-0000-0000-0000-000000000063';

  if v_people_count_after <> v_people_count_before then
    raise exception 'TEST 22 FALLÓ: se creó una Person nueva en vez de reutilizar la histórica (antes=%, después=%)', v_people_count_before, v_people_count_after;
  end if;
  if v_linked_person_id <> v_hist_person_id then
    raise exception 'TEST 22 FALLÓ: el perfil nuevo no quedó vinculado a la Person histórica del salesperson';
  end if;
  raise notice 'TEST 22 OK: alta con salesperson histórica reutiliza la Person existente (sin duplicar), también con user_manager como actor.';
end $$;

-- =========================================================================
-- TEST 23: role permanece 'vendedor' para user_manager, pese a todos los
-- intentos de escalación de los tests anteriores.
-- =========================================================================
select test_set_user(:'admin');
do $$
begin
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000060' and role = 'vendedor') then
    raise exception 'TEST 23 FALLÓ: user_manager ya no tiene role=vendedor';
  end if;
  if not exists (select 1 from organization_members where user_id = '00000000-0000-0000-0000-000000000060' and role = 'vendedor') then
    raise exception 'TEST 23 FALLÓ: organization_members de user_manager ya no tiene role=vendedor';
  end if;
  raise notice 'TEST 23 OK: user_manager conserva role=vendedor intacto.';
end $$;

-- =========================================================================
-- TEST 24: reset/acceso — la fuente de datos que usa
-- assertUserManagerCanTargetEmail() (admin_list_user_profiles) respeta
-- target no-admin/misma org. No se puede probar el Server Action de
-- TypeScript aquí (requiere Supabase Auth real), pero sí su dependencia de
-- datos completa.
-- =========================================================================
select test_set_user(:'user_manager');
do $$
declare
  v_target record;
  v_admin_orgb_email text := 'admin-orgb@test.local';
  v_second_admin_email text := 'second-admin-0046@test.local';
begin
  -- Target no-admin, misma org: debe aparecer y no ser admin.
  select * into v_target from admin_list_user_profiles() where email = 'vendedor1@test.local';
  if v_target.user_id is null or v_target.role = 'admin' then
    raise exception 'TEST 24 FALLÓ: vendedor1 (no-admin, misma org) no resolvió correctamente como objetivo válido';
  end if;

  -- Target admin, misma org (second_admin ya es vendedor tras TEST 12 — se
  -- prueba en su lugar contra el admin real de la organización).
  select * into v_target from admin_list_user_profiles() where email = (select email from auth.users where id = '00000000-0000-0000-0000-000000000001');
  if v_target.user_id is not null and v_target.role <> 'admin' then
    raise exception 'TEST 24 FALLÓ: el admin de la organización no se reportó como admin';
  end if;

  -- Target cross-org: no debe aparecer en absoluto.
  select * into v_target from admin_list_user_profiles() where email = v_admin_orgb_email;
  if v_target.user_id is not null then
    raise exception 'TEST 24 FALLÓ: un usuario de Org B apareció en la lista de user_manager';
  end if;

  raise notice 'TEST 24 OK: la fuente de datos de reset/acceso distingue correctamente no-admin/admin/cross-org.';
end $$;

select test_set_user(:'admin');

do $$ begin raise notice '=== 0046: 24/24 TESTS OK ==='; end $$;

rollback;
