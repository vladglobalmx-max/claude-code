-- THÖREN — Fase 8D (gap final, 0062) — requisito CORE "Proveedor
-- obligatorio antes de Pedido", configurable por Business Unit. Pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0062 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql (0057/0060/0061/0062 ya
-- sembraron/migraron Thunder LED). Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
create temp table _ids as
  select :'org1'::uuid as org1,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '90000000-0000-0000-0000-000000000001'::uuid as bu_org_b;

select id as bu_thunder from business_units where organization_id = (select org1 from _ids) and code = 'thunder_led' \gset
select id as bu_juno from business_units where organization_id = (select org1 from _ids) and code = 'juno_promotional' \gset
alter table _ids add column bu_thunder uuid, add column bu_juno uuid;
update _ids set bu_thunder = :'bu_thunder', bu_juno = :'bu_juno';

select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor Org B 8D-2', 'V8D2', true)
returning id as salesperson_orgb \gset
alter table _ids add column salesperson_orgb uuid;
update _ids set salesperson_orgb = :'salesperson_orgb';
select test_set_user(:'admin');

-- Producto Thunder completo (los 5 required_before_order de 0061) — para
-- aislar el requisito CORE de Proveedor de los custom fields en los TESTS
-- 1-9 (excepto TEST 10, que los combina a propósito).
create temp table _thunder_complete_item as
select jsonb_build_object(
  'model', 'M1', 'quantity', 1,
  'projection_description', 'STOP', 'projection_width', 4, 'projection_height', 4,
  'installation_height', 11.5,
  'projection_images', jsonb_build_array(jsonb_build_object('path', 'orders/8d2/proyeccion/a.png'))
) as item;

-- =========================================================================
-- TEST 1: Thunder sin proveedor + resto completo → no avanza a "Pedido".
-- =========================================================================
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D2-1', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array((select item from _thunder_complete_item))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 1 FALLÓ: Thunder sin Proveedor pasó a Pedido'; end if;
  if v_msg !~ 'Proveedor' then raise exception 'TEST 1 FALLÓ: el mensaje no nombra "Proveedor" (%)', v_msg; end if;
  if exists (select 1 from orders where id = v_order_id) then
    raise exception 'TEST 1 FALLÓ: el pedido quedó creado a pesar de faltar Proveedor (no hubo rollback real)';
  end if;
  raise notice 'TEST 1 OK: Thunder sin Proveedor (resto completo) no avanza a Pedido (%)', v_msg;
end $$;

-- =========================================================================
-- TEST 2: Thunder CON proveedor → avanza.
-- =========================================================================
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8D2-2', 'supplier_name', 'Proveedor Real SA', 'product_type', 'otro',
    'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
  ),
  jsonb_build_array((select item from _thunder_complete_item))
)).id as order_t2 \gset
alter table _ids add column order_t2 uuid;
update _ids set order_t2 = :'order_t2';
do $$
begin
  if not exists (select 1 from orders where id = (select order_t2 from _ids) and status = 'pedido') then
    raise exception 'TEST 2 FALLÓ: Thunder con Proveedor no pudo avanzar a Pedido';
  end if;
end $$;
select 'TEST 2 OK: Thunder con Proveedor avanza a Pedido sin bloqueo' as resultado;

-- =========================================================================
-- TEST 3: Juno sin proveedor → NO bloquea por default (sin fila de
-- settings, o con require_supplier_before_order=false).
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D2-3', 'product_type', 'otro', 'business_unit_id', (select bu_juno from _ids),
      'status', 'pedido'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 3 FALLÓ: Juno (sin configurar) se bloqueó por Proveedor';
  end if;
  raise notice 'TEST 3 OK: Juno sin proveedor no bloquea por default (sin settings = false)';
end $$;

-- =========================================================================
-- TEST 4: Tenant B sin proveedor → NO bloquea por default.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D2-4 OrgB', 'product_type', 'otro', 'business_unit_id', (select bu_org_b from _ids),
      'status', 'pedido'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 4 FALLÓ: Tenant B (sin configurar) se bloqueó por Proveedor';
  end if;
  raise notice 'TEST 4 OK: Tenant B sin proveedor no bloquea por default';
end $$;

-- =========================================================================
-- TEST 5: Tenant B configura require_supplier_before_order=true → SÍ bloquea.
-- =========================================================================
insert into business_unit_process_settings (organization_id, business_unit_id, require_supplier_before_order)
values ((select orgb from _ids), (select bu_org_b from _ids), true)
on conflict (business_unit_id) do update set require_supplier_before_order = true;

do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D2-5 OrgB', 'product_type', 'otro', 'business_unit_id', (select bu_org_b from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 5 FALLÓ: Tenant B con require_supplier_before_order=true no bloqueó sin proveedor'; end if;
  raise notice 'TEST 5 OK: Tenant B configura y hace cumplir su propio requisito de Proveedor (nadie lo programó)';
end $$;

-- =========================================================================
-- TEST 6: Tenant B agrega proveedor → avanza.
-- =========================================================================
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8D2-6 OrgB', 'supplier_name', 'Proveedor OrgB', 'product_type', 'otro',
    'business_unit_id', (select bu_org_b from _ids), 'status', 'pedido'
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
)).id as order_t6 \gset
alter table _ids add column order_t6 uuid;
update _ids set order_t6 = :'order_t6';
do $$
begin
  if not exists (select 1 from orders where id = (select order_t6 from _ids) and status = 'pedido') then
    raise exception 'TEST 6 FALLÓ: Tenant B con Proveedor no pudo avanzar a Pedido';
  end if;
end $$;
select 'TEST 6 OK: Tenant B con Proveedor avanza a Pedido' as resultado;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 7: un setting de OTRA Business Unit no afecta — Thunder (con
-- proveedor) sigue avanzando aunque Juno tenga require_supplier_before_order.
-- =========================================================================
insert into business_unit_process_settings (organization_id, business_unit_id, require_supplier_before_order)
values ((select org1 from _ids), (select bu_juno from _ids), true)
on conflict (business_unit_id) do update set require_supplier_before_order = true;

do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D2-7', 'supplier_name', 'Proveedor Real SA', 'product_type', 'otro',
      'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
    ),
    jsonb_build_array((select item from _thunder_complete_item))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 7 FALLÓ: el setting de Juno afectó a un pedido de Thunder';
  end if;
  raise notice 'TEST 7 OK: el setting de otra Business Unit nunca afecta';
end $$;
delete from business_unit_process_settings where business_unit_id = (select bu_juno from _ids);

-- =========================================================================
-- TEST 8: un setting de OTRA organización nunca afecta (cross-org) —
-- Thunder no se ve afectado por el require_supplier_before_order=true que
-- Tenant B configuró para SU PROPIA business_unit_id en TEST 5 (BU distinta
-- de por sí, pero se confirma explícitamente el filtro por organization_id
-- en la función de autoridad).
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D2-8', 'supplier_name', 'Proveedor Real SA', 'product_type', 'otro',
      'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
    ),
    jsonb_build_array((select item from _thunder_complete_item))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 8 FALLÓ: un setting de Tenant B (otra organización) afectó a Global Supplier';
  end if;
  raise notice 'TEST 8 OK: un setting de otra organización nunca afecta (cross-org)';
end $$;

-- =========================================================================
-- TEST 9: un payload manipulado (enviado directo al RPC como vendedor, sin
-- pasar por ninguna validación de cliente) sigue siendo rechazado.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D2-9', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array((select item from _thunder_complete_item))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 9 FALLÓ: un payload manipulado sin Proveedor logró marcar Pedido'; end if;
  raise notice 'TEST 9 OK: la autoridad real del servidor rechaza un payload manipulado sin Proveedor';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 10: requisitos CORE (Proveedor) + custom required_before_order se
-- combinan en UNA sola respuesta de completitud — faltando ambos, ambos
-- aparecen juntos en el mismo arreglo.
-- =========================================================================
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D2-10', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: faltando Proveedor Y los custom fields, el pedido avanzó'; end if;
  if v_msg !~ 'Proveedor' then raise exception 'TEST 10 FALLÓ: el mensaje combinado no incluye "Proveedor" (%)', v_msg; end if;
  if v_msg !~ 'Imagen' then raise exception 'TEST 10 FALLÓ: el mensaje combinado no incluye los custom fields faltantes (%)', v_msg; end if;
  raise notice 'TEST 10 OK: requisito CORE (Proveedor) + custom required_before_order se combinan en una sola respuesta: %', v_msg;
end $$;

-- =========================================================================
-- Confirmaciones adicionales del brief:
-- =========================================================================
-- Vendedor/Cliente siguen cubiertos por integridad existente (NOT NULL) —
-- no se reintrodujo ninguna validación de negocio para ellos.
do $$
declare v_failed boolean := false;
begin
  begin
    insert into orders (organization_id, salesperson_id, order_date, client_name, product_type, status)
    values ((select org1 from _ids), null, '2026-08-11', 'Cliente', 'otro', 'borrador');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'CONFIRMACIÓN FALLÓ: se pudo insertar un pedido sin salesperson_id (debe seguir siendo NOT NULL)'; end if;
  raise notice 'CONFIRMACIÓN OK: salesperson_id sigue protegido por NOT NULL (sin relación con este gap)';
end $$;

select 'TODAS LAS PRUEBAS 0062 (8D gap final) PASARON' as resultado;

rollback;
