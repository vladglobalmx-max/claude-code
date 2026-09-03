-- THÖREN — Fase 7A: Aislamiento multi-tenant real (0051) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0051 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final (rollback) —
-- repetible. Bajo `set role authenticated` REAL (lección de 0043).
--
-- org1/admin/vendedor1/vendedor2/admin_orgb/salesperson1/salesperson2 ya
-- existen (fixtures.sql). Este archivo agrega lo que falta para probar
-- aislamiento real: un vendedor NO-admin en Org B, un salesperson propio de
-- Org B (con el MISMO prefix que salesperson1 de Org A, a propósito), un
-- tipo de producto propio de cada organización, y un pedido en cada una
-- (para las pruebas de storage).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set user_manager_a '00000000-0000-0000-0000-000000000070'
\set vendedor_orgb '00000000-0000-0000-0000-000000000071'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
create temp table _ids as
  select :'org1'::uuid as org1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2;

-- =========================================================================
-- FIXTURES — user_manager_a (can_manage_users en Org A), vendedor_orgb +
-- su propio salesperson (mismo prefix "VU1" que salesperson1 de Org A, a
-- propósito, para TEST 8), tipos de producto propios por organización, y
-- un pedido en cada organización (para las pruebas de storage 19-22).
-- =========================================================================
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000070', 'user-manager-a-0051@test.local'),
  ('00000000-0000-0000-0000-000000000071', 'vendedor-orgb-0051@test.local');

-- Parte A (como :'admin', autoridad de Org A): user_manager_a + tipo de
-- producto de Org A. Cada INSERT bajo RLS exige is_organization_admin() de
-- LA ORGANIZACIÓN DE LA FILA (0051) — un fixture de Org B no puede armarse
-- mientras la sesión está en Org A.
do $$
declare
  v_org1 uuid := (select org1 from _ids);
  v_um_sp_id uuid;
  v_pt_a_id uuid;
begin
  insert into salespeople (organization_id, name, prefix, active)
  values (v_org1, 'User Manager 0051', 'UM51', true)
  returning id into v_um_sp_id;
  insert into organization_members (organization_id, user_id, role, active)
  values (v_org1, '00000000-0000-0000-0000-000000000070', 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000070', 'User Manager 0051', 'vendedor', v_um_sp_id, true);
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values (v_org1, '00000000-0000-0000-0000-000000000070', 'can_manage_users', true, '00000000-0000-0000-0000-000000000001');

  insert into product_types (organization_id, code, name, active)
  values (v_org1, 'tipo_test_0051_a', 'Tipo Test A 0051', true)
  returning id into v_pt_a_id;
  perform set_config('test.pt_a_id', v_pt_a_id::text, false);

  raise notice 'SETUP A OK: user_manager_a %, tipo A %', v_um_sp_id, v_pt_a_id;
end $$;

-- Parte B (como :'admin_orgb', autoridad de Org B): vendedor_orgb + su
-- propio salesperson (mismo prefix "VU1" que salesperson1 de Org A, a
-- propósito, para TEST 8) + tipo de producto de Org B.
select test_set_user(:'admin_orgb');
do $$
declare
  v_orgb uuid := (select orgb from _ids);
  v_orgb_sp_id uuid;
  v_pt_b_id uuid;
begin
  insert into salespeople (organization_id, name, prefix, active)
  values (v_orgb, 'Vendedor Org B', 'VU1', true)
  returning id into v_orgb_sp_id;
  insert into organization_members (organization_id, user_id, role, active)
  values (v_orgb, '00000000-0000-0000-0000-000000000071', 'vendedor', true);
  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000071', 'Vendedor Org B', 'vendedor', v_orgb_sp_id, true);
  perform set_config('test.orgb_salesperson_id', v_orgb_sp_id::text, false);

  insert into product_types (organization_id, code, name, active)
  values (v_orgb, 'tipo_test_0051_b', 'Tipo Test B 0051', true)
  returning id into v_pt_b_id;
  perform set_config('test.pt_b_id', v_pt_b_id::text, false);

  raise notice 'SETUP B OK: salesperson Org B % (prefix VU1), tipo B %', v_orgb_sp_id, v_pt_b_id;
end $$;
select test_set_user(:'admin');

-- Pedido de Org A (admin, salesperson1) — para storage.
do $$
declare v_order orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', (select salesperson1 from _ids), 'order_date', current_date::text, 'client_name', 'Cliente A 0051', 'product_type', 'otro')
  );
  perform set_config('test.order_a_id', v_order.id::text, false);
end $$;

-- Pedido de Org B (admin_orgb, salesperson propio de Org B) — para storage.
select test_set_user(:'admin_orgb');
do $$
declare v_order orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', current_setting('test.orgb_salesperson_id'), 'order_date', current_date::text, 'client_name', 'Cliente B 0051', 'product_type', 'otro')
  );
  perform set_config('test.order_b_id', v_order.id::text, false);
end $$;
select test_set_user(:'admin');

do $$ begin raise notice 'PEDIDOS OK: A=%, B=%', current_setting('test.order_a_id'), current_setting('test.order_b_id'); end $$;

-- =========================================================================
-- USER PROFILES
-- =========================================================================

-- TEST 1: admin A ve usuarios de su organización.
do $$
begin
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 1 FALLÓ: admin A no ve a vendedor1 (misma organización)';
  end if;
  raise notice 'TEST 1 OK: admin A ve usuarios de su organización.';
end $$;

-- TEST 2: admin A NO ve usuarios de Org B (SELECT directo, sin RPC).
do $$
begin
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000009') then
    raise exception 'TEST 2 FALLÓ: admin A vio a admin_orgb (organización distinta) vía SELECT directo';
  end if;
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000071') then
    raise exception 'TEST 2 FALLÓ: admin A vio a vendedor_orgb (organización distinta) vía SELECT directo';
  end if;
  raise notice 'TEST 2 OK: admin A NO ve usuarios de Org B vía SELECT directo.';
end $$;

-- TEST 3: admin A NO edita usuario de Org B (UPDATE directo, sin RPC).
do $$
declare v_rows integer;
begin
  update user_profiles set name = 'HACKEADO 0051' where user_id = '00000000-0000-0000-0000-000000000009';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 3 FALLÓ: admin A pudo editar a admin_orgb (% filas)', v_rows;
  end if;
  raise notice 'TEST 3 OK: admin A NO edita usuario de Org B (0 filas afectadas por RLS).';
end $$;

-- TEST 4: admin B (admin_orgb) NO ve/edita usuario de Org A.
select test_set_user(:'admin_orgb');
do $$
declare v_rows integer;
begin
  if exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 4 FALLÓ: admin B vio a vendedor1 (Org A) vía SELECT directo';
  end if;
  update user_profiles set name = 'HACKEADO 0051' where user_id = '00000000-0000-0000-0000-000000000002';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 4 FALLÓ: admin B pudo editar a vendedor1 (Org A) (% filas)', v_rows;
  end if;
  raise notice 'TEST 4 OK: admin B NO ve/edita usuario de Org A.';
end $$;

-- TEST 5: can_manage_users de Org A NO gestiona usuarios de Org B.
select test_set_user(:'user_manager_a');
do $$
declare v_rows integer;
begin
  if exists (select 1 from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000009') then
    raise exception 'TEST 5 FALLÓ: user_manager_a vio a admin_orgb en admin_list_user_profiles()';
  end if;
  update user_profiles set name = 'HACKEADO 0051' where user_id = '00000000-0000-0000-0000-000000000071';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 5 FALLÓ: user_manager_a pudo editar a vendedor_orgb (Org B) (% filas)', v_rows;
  end if;
  raise notice 'TEST 5 OK: can_manage_users de Org A NO gestiona usuarios de Org B.';
end $$;

-- =========================================================================
-- SALESPEOPLE
-- =========================================================================
select test_set_user(:'admin_orgb');

-- TEST 6: salesperson de Org A invisible/no mutable desde Org B.
do $$
declare v_rows integer; v_sp1 uuid := (select salesperson1 from _ids);
begin
  if exists (select 1 from salespeople where id = v_sp1) then
    raise exception 'TEST 6 FALLÓ: admin B ve el salesperson de Org A';
  end if;
  update salespeople set name = 'HACKEADO 0051' where id = v_sp1;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 6 FALLÓ: admin B pudo editar el salesperson de Org A (% filas)', v_rows;
  end if;
  raise notice 'TEST 6 OK: salesperson de Org A invisible/no mutable desde Org B.';
end $$;

select test_set_user(:'admin');

-- TEST 7: salesperson de Org B invisible/no mutable desde Org A.
do $$
declare v_rows integer; v_sp_orgb uuid := current_setting('test.orgb_salesperson_id')::uuid;
begin
  if exists (select 1 from salespeople where id = v_sp_orgb) then
    raise exception 'TEST 7 FALLÓ: admin A ve el salesperson de Org B';
  end if;
  update salespeople set name = 'HACKEADO 0051' where id = v_sp_orgb;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 7 FALLÓ: admin A pudo editar el salesperson de Org B (% filas)', v_rows;
  end if;
  raise notice 'TEST 7 OK: salesperson de Org B invisible/no mutable desde Org A.';
end $$;

-- TEST 8: mismo prefix ("VU1") permitido en Org A y Org B — ya lo probó el
-- SETUP (vendedor_orgb se creó con prefix VU1 sin error, siendo
-- salesperson1 de Org A también VU1). Se confirma aquí explícitamente,
-- cada fila desde la sesión que SÍ puede verla (RLS por organización, ya
-- probado en TEST 6/7 — no se reabre aquí, solo se verifica existencia).
do $$
begin
  if not exists (select 1 from salespeople where id = (select salesperson1 from _ids) and upper(prefix) = 'VU1') then
    raise exception 'TEST 8 FALLÓ: salesperson1 (Org A) ya no tiene prefix VU1';
  end if;
end $$;
select test_set_user(:'admin_orgb');
do $$
declare v_sp_orgb uuid := current_setting('test.orgb_salesperson_id')::uuid;
begin
  if not exists (select 1 from salespeople where id = v_sp_orgb and upper(prefix) = 'VU1') then
    raise exception 'TEST 8 FALLÓ: el salesperson de Org B con prefix VU1 no existe';
  end if;
  raise notice 'TEST 8 OK: mismo prefix (VU1) coexiste sin colisión en Org A y Org B.';
end $$;

-- TEST 9: duplicar el MISMO prefix DENTRO de la misma organización sí
-- sigue bloqueado (constraint por-org, no eliminado, solo re-scopeado).
select test_set_user(:'admin');
do $$
declare v_failed boolean := false;
begin
  begin
    insert into salespeople (organization_id, name, prefix, active)
    values ((select org1 from _ids), 'Duplicado 0051', 'VU1', true);
  exception when unique_violation then v_failed := true; end;
  if not v_failed then raise exception 'TEST 9 FALLÓ: se permitió un prefix VU1 duplicado dentro de Org A'; end if;
  raise notice 'TEST 9 OK: duplicado de prefix DENTRO de la misma organización sigue bloqueado.';
end $$;

-- =========================================================================
-- FOLIOS
-- =========================================================================

-- TEST 10: Org A genera folio correcto (formato + prefix propio). Sesión
-- admin (Org A) — orders es org-scoped (0022), así que cada folio solo se
-- puede leer desde la sesión de su propia organización.
do $$
declare v_folio text;
begin
  select folio into v_folio from orders where id = current_setting('test.order_a_id')::uuid;
  if v_folio is null or v_folio !~ '^VU1-\d{8}-\d{3}$' then
    raise exception 'TEST 10 FALLÓ: folio de Org A con formato inesperado: %', v_folio;
  end if;
  perform set_config('test.folio_a', v_folio, false);
  raise notice 'TEST 10 OK: Org A genera folio correcto (%).', v_folio;
end $$;

-- TEST 11: Org B genera folio correcto (formato + prefix propio, mismo
-- prefix "VU1" que Org A — ver TEST 12). Sesión admin_orgb, por la misma
-- razón de org-scoping de arriba.
select test_set_user(:'admin_orgb');
do $$
declare v_folio text;
begin
  select folio into v_folio from orders where id = current_setting('test.order_b_id')::uuid;
  if v_folio is null or v_folio !~ '^VU1-\d{8}-\d{3}$' then
    raise exception 'TEST 11 FALLÓ: folio de Org B con formato inesperado: %', v_folio;
  end if;
  perform set_config('test.folio_b', v_folio, false);
  raise notice 'TEST 11 OK: Org B genera folio correcto (%).', v_folio;
end $$;

-- TEST 12: mismo prefix entre organizaciones NO colisiona — ambos pedidos
-- (Org A y Org B) son el primero de su vendedor el mismo día, así que
-- ambos folios son TEXTUALMENTE IGUALES ("VU1-AAAADDMM-001"); antes de
-- 0051 esto habría violado orders_folio_unique (era global, TEST 10/11 ya
-- demostraron que AMBOS persistieron sin error). Ahora coexisten porque el
-- índice único es (organization_id, folio).
do $$
declare v_folio_a text := current_setting('test.folio_a'); v_folio_b text := current_setting('test.folio_b');
begin
  if v_folio_a <> v_folio_b then
    raise exception 'TEST 12 FALLÓ (setup inesperado): los folios deberían coincidir textualmente para probar la no-colisión (A=%, B=%)', v_folio_a, v_folio_b;
  end if;
  raise notice 'TEST 12 OK: mismo folio textual (%) coexiste en Org A y Org B sin colisión (unique por organización).', v_folio_a;
end $$;
select test_set_user(:'admin');

-- TEST 13: no se usa salesperson de otra organización para generar un
-- folio — rpc_create_order para admin_orgb con salesperson1 (Org A) debe
-- fallar (RLS de salespeople ya oculta esa fila, "Vendedor no encontrado").
select test_set_user(:'admin_orgb');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object('salesperson_id', (select salesperson1 from _ids), 'order_date', current_date::text, 'client_name', 'Intento cross-org 0051', 'product_type', 'otro')
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 13 FALLÓ: admin_orgb pudo generar un folio usando un salesperson de Org A'; end if;
  raise notice 'TEST 13 OK: ningún folio se genera usando un salesperson de otra organización.';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- PRODUCT TYPES
-- =========================================================================
select test_set_user(:'admin');

-- TEST 14: Org A ve sus propios tipos (incluye los 5 sembrados + el nuevo).
do $$
begin
  if not exists (select 1 from product_types where id = current_setting('test.pt_a_id')::uuid) then
    raise exception 'TEST 14 FALLÓ: admin A no ve su propio tipo de producto';
  end if;
  if not exists (select 1 from product_types where code = 'otro') then
    raise exception 'TEST 14 FALLÓ: admin A no ve los tipos históricos sembrados (code=otro)';
  end if;
  raise notice 'TEST 14 OK: Org A ve sus propios tipos de producto.';
end $$;

select test_set_user(:'admin_orgb');

-- TEST 15: Org B ve su propio tipo.
do $$
begin
  if not exists (select 1 from product_types where id = current_setting('test.pt_b_id')::uuid) then
    raise exception 'TEST 15 FALLÓ: admin B no ve su propio tipo de producto';
  end if;
  raise notice 'TEST 15 OK: Org B ve su propio tipo de producto.';
end $$;

-- TEST 16: Org B NO ve/modifica tipos de Org A (incluye los 5 históricos).
do $$
declare v_rows integer;
begin
  if exists (select 1 from product_types where id = current_setting('test.pt_a_id')::uuid) then
    raise exception 'TEST 16 FALLÓ: admin B ve el tipo de producto de Org A';
  end if;
  if exists (select 1 from product_types where code = 'otro') then
    raise exception 'TEST 16 FALLÓ: admin B ve los tipos históricos de Org A (code=otro)';
  end if;
  update product_types set name = 'HACKEADO 0051' where id = current_setting('test.pt_a_id')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 16 FALLÓ: admin B pudo editar el tipo de producto de Org A (% filas)', v_rows;
  end if;
  raise notice 'TEST 16 OK: Org B NO ve/modifica tipos de Org A.';
end $$;

select test_set_user(:'admin');

-- TEST 17: Org A NO ve/modifica el tipo de Org B.
do $$
declare v_rows integer;
begin
  if exists (select 1 from product_types where id = current_setting('test.pt_b_id')::uuid) then
    raise exception 'TEST 17 FALLÓ: admin A ve el tipo de producto de Org B';
  end if;
  update product_types set name = 'HACKEADO 0051' where id = current_setting('test.pt_b_id')::uuid;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 17 FALLÓ: admin A pudo editar el tipo de producto de Org B (% filas)', v_rows;
  end if;
  raise notice 'TEST 17 OK: Org A NO ve/modifica el tipo de producto de Org B.';
end $$;

-- TEST 18: referencias existentes de product_catalog (product_type_id,
-- FK por id desde 0030) siguen válidas — organization_id nuevo en
-- product_types no rompe esa FK (es uuid->uuid, nunca dependió de code).
do $$
declare v_pc_id uuid;
begin
  insert into product_catalog (organization_id, sku, name, category, product_type_id, active)
  values ((select org1 from _ids), 'SKU-TEST-0051', 'Producto Test 0051', 'Categoría Test', current_setting('test.pt_a_id')::uuid, true)
  returning id into v_pc_id;
  if not exists (select 1 from product_catalog where id = v_pc_id and product_type_id = current_setting('test.pt_a_id')::uuid) then
    raise exception 'TEST 18 FALLÓ: la referencia product_catalog.product_type_id no quedó vinculada correctamente';
  end if;
  raise notice 'TEST 18 OK: referencias existentes de product_catalog (product_type_id) siguen válidas.';
end $$;

-- =========================================================================
-- STORAGE (order-media / order-files)
-- =========================================================================

-- TEST 19: admin A accede (SELECT) a un archivo de su propio pedido (Org A).
insert into storage.buckets (id, name, public) values ('order-media', 'order-media', false) on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values ('order-media', current_setting('test.order_a_id') || '/foto1.jpg');
insert into storage.objects (bucket_id, name) values ('order-media', current_setting('test.order_b_id') || '/foto1.jpg');
do $$
begin
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'order-media' and name = current_setting('test.order_a_id') || '/foto1.jpg'
  ) then
    raise exception 'TEST 19 FALLÓ: admin A no pudo ver el archivo de su propio pedido (Org A)';
  end if;
  raise notice 'TEST 19 OK: admin/usuario de Org A accede al archivo de su propio pedido.';
end $$;

-- TEST 20: admin B NO accede (SELECT) al archivo del pedido de Org A.
select test_set_user(:'admin_orgb');
do $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'order-media' and name = current_setting('test.order_a_id') || '/foto1.jpg'
  ) then
    raise exception 'TEST 20 FALLÓ: admin B pudo ver el archivo del pedido de Org A';
  end if;
  raise notice 'TEST 20 OK: admin B NO accede al archivo de un pedido de Org A.';
end $$;

-- TEST 21: admin A NO accede (SELECT) al archivo del pedido de Org B.
select test_set_user(:'admin');
do $$
begin
  if exists (
    select 1 from storage.objects
    where bucket_id = 'order-media' and name = current_setting('test.order_b_id') || '/foto1.jpg'
  ) then
    raise exception 'TEST 21 FALLÓ: admin A pudo ver el archivo del pedido de Org B';
  end if;
  raise notice 'TEST 21 OK: admin A NO accede al archivo de un pedido de Org B.';
end $$;

-- TEST 22: UPDATE/DELETE mantienen ownership real de 0050 — admin B NO
-- puede borrar el archivo del pedido de Org A (0050:
-- current_user_can_manage_order_storage, ahora también org-scoped).
select test_set_user(:'admin_orgb');
do $$
declare v_rows integer;
begin
  delete from storage.objects
  where bucket_id = 'order-media' and name = current_setting('test.order_a_id') || '/foto1.jpg';
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    raise exception 'TEST 22 FALLÓ: admin B pudo borrar el archivo del pedido de Org A (% filas)', v_rows;
  end if;
  raise notice 'TEST 22 OK: UPDATE/DELETE de storage mantienen ownership real (admin B NO borra archivo de Org A).';
end $$;

select test_set_user(:'admin');
do $$
declare v_rows integer;
begin
  -- Control positivo: admin A SÍ puede borrar el archivo de su propio pedido.
  delete from storage.objects
  where bucket_id = 'order-media' and name = current_setting('test.order_a_id') || '/foto1.jpg';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 22 FALLÓ (control positivo): admin A no pudo borrar el archivo de su propio pedido (% filas)', v_rows;
  end if;
  raise notice 'TEST 22 OK (control positivo): admin A SÍ borra el archivo de su propio pedido.';
end $$;

-- =========================================================================
-- REGRESIÓN
-- =========================================================================

-- TEST 23: Vladimir/admin actual sigue funcionando (bypass total dentro de
-- su propia organización, gestión normal intacta).
do $$
declare v_count integer;
begin
  select count(*) into v_count from admin_list_user_profiles();
  if v_count = 0 then raise exception 'TEST 23 FALLÓ: admin no ve ningún usuario'; end if;
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000003', 'vendedor', false);
  perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000003', 'vendedor', true);
  raise notice 'TEST 23 OK: admin (Vladimir) conserva bypass total y gestión normal intacta (% usuarios).', v_count;
end $$;

-- TEST 24: Alexandro-equivalente (can_manage_users) sigue funcionando
-- dentro de su propia organización (alta/gestión normal, ver 0046 TEST 1-6
-- ya cubiertos ahí; aquí solo se reconfirma que 0051 no lo rompió).
select test_set_user(:'user_manager_a');
do $$
declare v_count integer;
begin
  select count(*) into v_count from admin_list_user_profiles();
  if v_count = 0 then raise exception 'TEST 24 FALLÓ: user_manager_a no ve ningún usuario de su organización'; end if;
  if not exists (select 1 from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 24 FALLÓ: user_manager_a no ve a vendedor1 (misma organización)';
  end if;
  raise notice 'TEST 24 OK: can_manage_users (Alexandro-equivalente) sigue funcionando dentro de su organización.';
end $$;

-- TEST 25: Karla/Rodolfo-equivalente (can_view_all_sales/logística) siguen
-- funcionando — smoke test mínimo: la capability sigue resolviendo true
-- dentro de la propia organización tras 0051 (current_user_has_capability
-- no se modificó, solo su USO en el storage helper).
select test_set_user(:'admin');
do $$
begin
  insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  values ((select org1 from _ids), '00000000-0000-0000-0000-000000000003', 'can_view_all_sales', true, '00000000-0000-0000-0000-000000000001')
  on conflict (organization_id, user_id, capability) do update set active = true;
end $$;
select test_set_user(:'vendedor2');
do $$
begin
  if not current_user_has_capability('can_view_all_sales') then
    raise exception 'TEST 25 FALLÓ: can_view_all_sales dejó de resolver true tras 0051';
  end if;
  raise notice 'TEST 25 OK: capabilities (can_view_all_sales, Karla/Rodolfo-equivalente) siguen funcionando.';
end $$;

-- TEST 26: quotes/orders/purchase orders existentes no pierden acceso
-- correcto — admin ve el pedido de Org A que él mismo creó (control ya
-- implícito en TEST 19, se reconfirma explícito vía SELECT normal).
select test_set_user(:'admin');
do $$
begin
  if not exists (select 1 from orders where id = current_setting('test.order_a_id')::uuid) then
    raise exception 'TEST 26 FALLÓ: admin A no ve su propio pedido tras 0051';
  end if;
  raise notice 'TEST 26 OK: acceso correcto a pedidos existentes sin cambios.';
end $$;

-- TEST 27: Global Supplier conserva sus datos existentes (salespeople,
-- product_types, organización) — nada se perdió/reasignó en el backfill.
do $$
declare v_sp_count integer; v_pt_count integer;
begin
  select count(*) into v_sp_count from salespeople where organization_id = (select org1 from _ids);
  select count(*) into v_pt_count from product_types where organization_id = (select org1 from _ids);
  if v_sp_count < 3 then -- vendedor1, vendedor2, user_manager_a como mínimo
    raise exception 'TEST 27 FALLÓ: Global Supplier perdió salespeople (% encontrados)', v_sp_count;
  end if;
  if v_pt_count < 6 then -- 5 históricos + el de prueba
    raise exception 'TEST 27 FALLÓ: Global Supplier perdió product_types (% encontrados)', v_pt_count;
  end if;
  raise notice 'TEST 27 OK: Global Supplier conserva sus datos existentes (% salespeople, % product_types).', v_sp_count, v_pt_count;
end $$;

-- TEST 28: ningún folio histórico cambia — el folio del pedido de Org A ya
-- creado sigue siendo exactamente el mismo tras las operaciones de arriba
-- (trg_prevent_folio_change, 0002, sin tocar, sigue vigente).
do $$
declare v_folio text; v_failed boolean := false;
begin
  select folio into v_folio from orders where id = current_setting('test.order_a_id')::uuid;
  if v_folio !~ '^VU1-\d{8}-\d{3}$' then
    raise exception 'TEST 28 FALLÓ: el folio histórico cambió de formato inesperadamente: %', v_folio;
  end if;
  begin
    update orders set folio = 'OTRO-000' where id = current_setting('test.order_a_id')::uuid;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 28 FALLÓ: se permitió modificar un folio histórico'; end if;
  raise notice 'TEST 28 OK: ningún folio histórico cambia (inmutabilidad de 0002 intacta).';
end $$;

do $$ begin raise notice '=== 0051: 28/28 TESTS OK ==='; end $$;

-- =========================================================================
-- AJUSTE POST-IMPLEMENTACIÓN — user_profiles_admin_insert deja de depender
-- de current_user_is_admin() global, pasa a is_organization_admin(
-- current_user_organization_id()). TESTS 29-35: mínimo pedido.
-- =========================================================================
select test_set_user(:'admin');

-- TEST 29/32: admin A crea una fila user_profiles "huérfana" (role='admin',
-- SIN organization_members — el INSERT en sí no puede impedir esto, ver
-- DECISIÓN en 0051: el límite real de organización lo cierra la policy de
-- organization_members, no esta) y se confirma explícitamente que esa fila
-- NO otorga NINGUNA autoridad funcional real: is_organization_admin/
-- is_organization_member son false para TODAS las organizaciones (huérfano
-- sin membership no puede resolverse a ninguna), y no puede ver ninguna
-- fila de salespeople/product_types de NINGUNA organización.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000080', 'huerfano-a-0051@test.local');
insert into user_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000080', 'Huérfano A 0051', 'admin', true);

select test_set_user(:'admin_orgb');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000081', 'huerfano-b-0051@test.local');
insert into user_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000081', 'Huérfano B 0051', 'admin', true);

select test_set_user('00000000-0000-0000-0000-000000000080');
do $$
declare v_org1 uuid := (select org1 from _ids); v_orgb uuid := (select orgb from _ids);
begin
  if is_organization_admin(v_org1) or is_organization_admin(v_orgb) then
    raise exception 'TEST 29 FALLÓ: el huérfano de admin A resultó is_organization_admin() en alguna organización';
  end if;
  if is_organization_member(v_org1) or is_organization_member(v_orgb) then
    raise exception 'TEST 29 FALLÓ: el huérfano de admin A resultó is_organization_member() en alguna organización';
  end if;
  if exists (select 1 from salespeople) or exists (select 1 from product_types) then
    raise exception 'TEST 29 FALLÓ: el huérfano de admin A ve salespeople/product_types de alguna organización';
  end if;
  raise notice 'TEST 29 OK: admin A NO puede otorgar autoridad real vía INSERT directo (huérfano sin organization_members, cero acceso funcional).';
end $$;

select test_set_user('00000000-0000-0000-0000-000000000081');
do $$
declare v_org1 uuid := (select org1 from _ids); v_orgb uuid := (select orgb from _ids);
begin
  if is_organization_admin(v_org1) or is_organization_admin(v_orgb) then
    raise exception 'TEST 32 FALLÓ: el huérfano de admin B resultó is_organization_admin() en alguna organización';
  end if;
  if exists (select 1 from salespeople) or exists (select 1 from product_types) then
    raise exception 'TEST 32 FALLÓ: el huérfano de admin B ve salespeople/product_types de alguna organización';
  end if;
  raise notice 'TEST 32 OK: admin B tampoco puede otorgar autoridad real vía INSERT directo (mismo resultado).';
end $$;

-- TEST 30: vendedor (sin admin, sin can_manage_users) NO puede insertar en
-- user_profiles en absoluto — ninguna policy lo cubre.
select test_set_user(:'vendedor2');
do $$
declare v_failed boolean := false;
begin
  begin
    insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000082', 'intento-vendedor-0051@test.local');
    insert into user_profiles (user_id, name, role, active)
    values ('00000000-0000-0000-0000-000000000082', 'Intento Vendedor 0051', 'vendedor', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 30 FALLÓ: un vendedor sin capability pudo insertar en user_profiles'; end if;
  raise notice 'TEST 30 OK: vendedor sin autoridad NO puede insertar en user_profiles.';
end $$;

-- TEST 31: el flujo autorizado de alta server-side sigue siendo válido
-- (profile + membership + person, mismo patrón que 0046 TEST 2/3) — admin
-- pleno, org-aware ya con el ajuste de esta sección.
select test_set_user(:'admin');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000083', 'alta-valida-0051@test.local');
do $$
declare
  v_org1 uuid := (select org1 from _ids);
  v_sp_id uuid;
  v_person_id uuid;
begin
  insert into salespeople (organization_id, name, prefix, active)
  values (v_org1, 'Alta Válida 0051', 'AV51', true)
  returning id into v_sp_id;

  insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000083', 'Alta Válida 0051', 'vendedor', v_sp_id, true);
  insert into organization_members (organization_id, user_id, role, active)
  values (v_org1, '00000000-0000-0000-0000-000000000083', 'vendedor', true);
  perform rpc_create_person_for_user('00000000-0000-0000-0000-000000000083', v_org1, 'Alta Válida 0051', 'alta-valida-0051@test.local', true);

  select person_id into v_person_id from user_profiles where user_id = '00000000-0000-0000-0000-000000000083';
  if v_person_id is null then
    raise exception 'TEST 31 FALLÓ: el flujo autorizado de alta (profile+membership+person) no completó tras el ajuste';
  end if;
  raise notice 'TEST 31 OK: el flujo autorizado de alta server-side sigue siendo válido tras el ajuste.';
end $$;

-- TEST 33: user_profiles existentes siguen visibles/editables según org
-- (reconfirmación puntual — cobertura completa ya en TESTS 1-7).
do $$
begin
  if not exists (select 1 from user_profiles where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 33 FALLÓ: admin A dejó de ver a vendedor1 (misma organización) tras el ajuste';
  end if;
  raise notice 'TEST 33 OK: user_profiles existentes siguen visibles/editables según organización.';
end $$;

-- TEST 34: can_manage_users sigue funcionando tras el ajuste (reconfirmación
-- puntual — cobertura completa ya en TEST 5 y 0046).
select test_set_user(:'user_manager_a');
do $$
begin
  if not exists (select 1 from admin_list_user_profiles() where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'TEST 34 FALLÓ: can_manage_users dejó de ver usuarios de su organización tras el ajuste';
  end if;
  raise notice 'TEST 34 OK: can_manage_users sigue funcionando tras el ajuste.';
end $$;

-- TEST 35: último admin sigue protegido tras el ajuste (trg_prevent_last_
-- admin_removal, 0046, no se tocó — reconfirmación puntual).
select test_set_user(:'admin');
do $$
declare v_failed boolean := false;
begin
  begin
    perform admin_update_user_role_and_active('00000000-0000-0000-0000-000000000001', 'vendedor', true);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 35 FALLÓ: se permitió degradar al último admin activo de la organización'; end if;
  raise notice 'TEST 35 OK: protección de último admin activo sigue intacta tras el ajuste.';
end $$;

do $$ begin raise notice '=== 0051 (ajuste INSERT): 35/35 TESTS OK ==='; end $$;

rollback;
