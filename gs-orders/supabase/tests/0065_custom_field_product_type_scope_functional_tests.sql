-- THÖREN — Bug real: custom fields aplicados al Tipo de Producto incorrecto
-- (0065_custom_field_product_type_scope.sql) — pruebas funcionales contra
-- Postgres real. Fixtures 100% autocontenidas — no depende de la cadena de
-- fixtures de fases anteriores ni de los datos reales de Thunder LED
-- (global-supplier-mty) sembrados por 0057/0060. Todo el script corre en
-- una transacción que se revierte al final (rollback) — repetible.

begin;

\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set admin_a '00000000-0000-0000-0000-000000000001'
\set admin_b '00000000-0000-0000-0000-000000000009'
\set vendedor_a '00000000-0000-0000-0000-000000000002'
\set sp_a '00000000-0000-0000-0000-0000000000b1'
\set bu_a '00000000-0000-0000-0000-0000000000d1'
\set bu_b '00000000-0000-0000-0000-0000000000d9'
\set pt_proyector '00000000-0000-0000-0000-0000000000e1'
\set pt_luzgrua '00000000-0000-0000-0000-0000000000e2'
\set pt_orgb '00000000-0000-0000-0000-0000000000e9'
\set c_proyector '00000000-0000-0000-0000-0000000000c1'
\set c_luzgrua '00000000-0000-0000-0000-0000000000c2'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-65@test.local'),
  (:'admin_b', 'admin-orgb-65@test.local'),
  (:'vendedor_a', 'vendedor-65@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 65', 'test-org-65'),
  (:'org_b', 'Test Org 65B', 'test-org-65b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin Test 65', 'admin', true),
  (:'admin_b', 'Admin Org B 65', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true),
  (:'org_b', :'admin_b', 'admin', true);

set role authenticated;
select test_set_user(:'admin_a');

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor Test 65', 'VT65', true);
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor Test 65', 'vendedor', :'sp_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true);

insert into business_units (id, organization_id, name, code, active) values
  (:'bu_a', :'org_a', 'BU Test 65', 'bu_test_65', true);

-- Tipos de Producto: proyector_65 y luzgrua_65 en Org A, uno independiente
-- en Org B para el aislamiento cross-tenant (TEST 12/13).
insert into product_types (id, organization_id, code, name, active) values
  (:'pt_proyector', :'org_a', 'proyector_type_65', 'Proyector / GOBO 65', true),
  (:'pt_luzgrua', :'org_a', 'luzgrua_type_65', 'Luces Grua Viajera 65', true);
select test_set_user(:'admin_b');
insert into business_units (id, organization_id, name, code, active) values
  (:'bu_b', :'org_b', 'BU Test 65B', 'bu_test_65b', true);
insert into product_types (id, organization_id, code, name, active) values
  (:'pt_orgb', :'org_b', 'orgb_type_65', 'Tipo Org B 65', true);
select test_set_user(:'admin_a');

-- Productos de catálogo — la relación REAL Product Type -> Product es
-- product_catalog.product_type_id (0030), reutilizada aquí sin duplicar.
insert into product_catalog (id, organization_id, sku, model, name, product_type_id, active) values
  (:'c_proyector', :'org_a', 'PROY-CAT-65', 'PROY-65', 'Proyector Catalogo 65', :'pt_proyector', true),
  (:'c_luzgrua', :'org_a', 'LUZGRUA-CAT-65', 'LUZGRUA-65', 'Luz Grua Catalogo 65', :'pt_luzgrua', true);

-- custom_field_definitions — cuatro casos deliberados en Org A:
--   bu_wide_field_65        : business_unit_id=bu_a, product_type_id=NULL   -> aplica a AMBOS tipos.
--   proy_required_field_65  : product_type_id=proyector, required_before_order=true, active -> SOLO Proyector.
--   luzgrua_required_field_65: product_type_id=luzgrua, required_before_order=true, active  -> SOLO Luz Grua.
--   inactive_proy_field_65  : product_type_id=proyector, required_before_order=true, active=FALSE -> nunca aplica.
-- Mas una definition en Org B (orgb_field_65) para el aislamiento cross-org.
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, required_before_order, product_type_id)
values
  (:'org_a', :'bu_a', 'order_item', 'bu_wide_field_65', 'Campo BU-wide 65', 'text', false, true, false, null),
  (:'org_a', :'bu_a', 'order_item', 'proy_required_field_65', 'Campo obligatorio Proyector 65', 'text', false, true, true, :'pt_proyector'),
  (:'org_a', :'bu_a', 'order_item', 'luzgrua_required_field_65', 'Campo obligatorio Luz Grua 65', 'text', false, true, true, :'pt_luzgrua'),
  (:'org_a', :'bu_a', 'order_item', 'inactive_proy_field_65', 'Campo inactivo Proyector 65', 'text', false, false, true, :'pt_proyector');

select test_set_user(:'admin_b');
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required, active, required_before_order, product_type_id)
values
  (:'org_b', :'bu_b', 'order_item', 'orgb_field_65', 'Campo Org B 65', 'text', false, true, false, :'pt_orgb');
select test_set_user(:'admin_a');

-- =========================================================================
-- TEST 1: Proyector/GOBO — el campo especifico de Proyector (required) y
-- el campo BU-wide se aplican/almacenan a un item Proyector.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T1', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'valor-proy', 'bu_wide_field_65', 'valor-bu')
    ))
  )).id into v_order_id;

  select id into v_item_id from order_items where order_id = v_order_id;

  if not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'proy_required_field_65') then
    raise exception 'TEST 1 FALLO: proy_required_field_65 deberia haberse guardado para un item Proyector';
  end if;
  if not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'bu_wide_field_65') then
    raise exception 'TEST 1 FALLO: bu_wide_field_65 deberia haberse guardado (BU-wide aplica a Proyector tambien)';
  end if;
  raise notice 'TEST 1 OK: Proyector/GOBO muestra/almacena su campo especifico y el campo BU-wide';
end $$;

-- =========================================================================
-- TEST 2: Proyector incompleto bloquea Pedido (required_before_order).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_blocked boolean := false;
begin
  begin
    select (rpc_create_order_with_custom_fields(
      gen_random_uuid(),
      jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T2', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
      jsonb_build_array(jsonb_build_object('model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
    )).id into v_order_id;
  exception when others then
    if sqlerrm like '%proy_required_field_65%' or sqlerrm like '%Campo obligatorio Proyector 65%' then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'TEST 2 FALLO: un Proyector sin su campo required_before_order deberia bloquear el Pedido';
  end if;
  raise notice 'TEST 2 OK: Proyector incompleto bloquea el Pedido citando el campo faltante';
end $$;

-- =========================================================================
-- TEST 3: Proyector completo permite Pedido.
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T3', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'valor-proy')
    ))
  )).id into v_order_id;
  if v_order_id is null then
    raise exception 'TEST 3 FALLO: no se creo el Pedido';
  end if;
  raise notice 'TEST 3 OK: Proyector completo permite el Pedido sin bloqueo';
end $$;

-- =========================================================================
-- TEST 4: Luz Grua Viajera NO muestra/almacena campos de Proyector.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T4', 'product_type', 'luzgrua_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object(
      'model', 'LUZGRUA-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'no-deberia-guardarse', 'luzgrua_required_field_65', 'valor-luzgrua', 'bu_wide_field_65', 'valor-bu')
    ))
  )).id into v_order_id;

  select id into v_item_id from order_items where order_id = v_order_id;

  if exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'proy_required_field_65') then
    raise exception 'TEST 4 FALLO: proy_required_field_65 NO deberia haberse guardado para un item Luz Grua Viajera';
  end if;
  if not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'luzgrua_required_field_65') then
    raise exception 'TEST 4 FALLO: luzgrua_required_field_65 deberia haberse guardado (especifico de Luz Grua)';
  end if;
  if not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'bu_wide_field_65') then
    raise exception 'TEST 4 FALLO: bu_wide_field_65 deberia haberse guardado (BU-wide aplica a Luz Grua tambien)';
  end if;
  raise notice 'TEST 4 OK: Luz Grua Viajera NUNCA almacena campos de Proyector; si almacena los suyos y los BU-wide';
end $$;

-- =========================================================================
-- TEST 5: Luz Grua Viajera NO es bloqueada por campos de proyeccion —
-- Pedido sin ningun custom_field_value pero CON su propio campo required
-- antes de "pedido" (luzgrua_required_field_65) satisfecho.
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T5', 'product_type', 'luzgrua_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
    jsonb_build_array(jsonb_build_object(
      'model', 'LUZGRUA-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2',
      'custom_field_values', jsonb_build_object('luzgrua_required_field_65', 'valor-luzgrua')
    ))
  )).id into v_order_id;
  if v_order_id is null then
    raise exception 'TEST 5 FALLO: no se creo el Pedido';
  end if;
  raise notice 'TEST 5 OK: Luz Grua Viajera con sus propios requisitos satisfechos NO es bloqueada por campos de Proyector (nunca se le exigen)';
end $$;

-- =========================================================================
-- TEST 6: campo BU-wide (product_type_id NULL) aparece/aplica en AMBOS
-- tipos de producto dentro de la misma Business Unit.
-- =========================================================================
do $$
declare
  v_order_proy uuid;
  v_order_luz uuid;
  v_item_proy uuid;
  v_item_luz uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T6-proy', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object('model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1', 'custom_field_values', jsonb_build_object('bu_wide_field_65', 'x')))
  )).id into v_order_proy;
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T6-luz', 'product_type', 'luzgrua_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object('model', 'LUZGRUA-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2', 'custom_field_values', jsonb_build_object('bu_wide_field_65', 'y')))
  )).id into v_order_luz;

  select id into v_item_proy from order_items where order_id = v_order_proy;
  select id into v_item_luz from order_items where order_id = v_order_luz;

  if not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_proy and d.key = 'bu_wide_field_65')
     or not exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_luz and d.key = 'bu_wide_field_65') then
    raise exception 'TEST 6 FALLO: bu_wide_field_65 (product_type_id NULL) deberia aplicar a ambos tipos de producto';
  end if;
  raise notice 'TEST 6 OK: un campo con product_type_id NULL aplica a ambos Tipos de Producto de la misma BU';
end $$;

-- =========================================================================
-- TEST 7: campo especifico de Luz Grua aparece SOLO ahi (no en Proyector).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T7', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'valor-proy', 'luzgrua_required_field_65', 'no-deberia-guardarse')
    ))
  )).id into v_order_id;
  select id into v_item_id from order_items where order_id = v_order_id;
  if exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'luzgrua_required_field_65') then
    raise exception 'TEST 7 FALLO: luzgrua_required_field_65 NO deberia aplicar/guardarse en un item Proyector';
  end if;
  raise notice 'TEST 7 OK: el campo especifico de Luz Grua nunca aparece/almacena en un item Proyector';
end $$;

-- =========================================================================
-- TEST 8: campo especifico de Proyector no aparece en Luz Grua (negativo
-- explicito, complementario al TEST 4).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T8', 'product_type', 'luzgrua_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object(
      'model', 'LUZGRUA-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'no-deberia-guardarse')
    ))
  )).id into v_order_id;
  select id into v_item_id from order_items where order_id = v_order_id;
  if exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'proy_required_field_65') then
    raise exception 'TEST 8 FALLO: proy_required_field_65 NO deberia aparecer/guardarse en un item Luz Grua Viajera';
  end if;
  raise notice 'TEST 8 OK: el campo especifico de Proyector nunca aparece en un item Luz Grua Viajera';
end $$;

-- =========================================================================
-- TEST 9: Pedido con DOS items de tipos distintos resuelve la
-- aplicabilidad POR ITEM — nunca tomando el tipo del primer item (o de
-- orders.product_type del header) para todo el Pedido. Item 1 = Luz Grua
-- (sin requisitos propios), Item 2 = Proyector SIN su campo obligatorio:
-- si el motor (incorrectamente) usara el tipo del item 1 o del header
-- para todo el Pedido, esto NO bloquearia — debe bloquear.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_blocked boolean := false;
begin
  begin
    select (rpc_create_order_with_custom_fields(
      gen_random_uuid(),
      jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T9', 'product_type', 'luzgrua_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
      jsonb_build_array(
        jsonb_build_object('model', 'LUZGRUA-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2', 'custom_field_values', jsonb_build_object('luzgrua_required_field_65', 'ok')),
        jsonb_build_object('model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1')
      )
    )).id into v_order_id;
  exception when others then
    if sqlerrm like '%proy_required_field_65%' or sqlerrm like '%Campo obligatorio Proyector 65%' then
      v_blocked := true;
    else
      raise;
    end if;
  end;
  if not v_blocked then
    raise exception 'TEST 9 FALLO: el item 2 (Proyector) sin su campo obligatorio debio bloquear el Pedido, sin importar que el item 1 sea Luz Grua';
  end if;
  raise notice 'TEST 9 OK: la aplicabilidad se resuelve por item real (catalog_product_id -> product_type_id), no por el primer item ni por el header';
end $$;

-- =========================================================================
-- TEST 10: consistencia de scope entre fn_apply_order_item_custom_fields
-- (que decide que se ALMACENA) y fn_get_missing_required_before_order_fields
-- (que decide que BLOQUEA) — misma condicion exacta para el mismo item.
-- Un campo required_before_order de Luz Grua NUNCA debe bloquear ni
-- almacenarse para un item Proyector, aunque se envie su valor.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T10', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'ok', 'luzgrua_required_field_65', 'no-deberia-guardarse-ni-exigirse')
    ))
  )).id into v_order_id;
  select id into v_item_id from order_items where order_id = v_order_id;
  if exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'luzgrua_required_field_65') then
    raise exception 'TEST 10 FALLO: luzgrua_required_field_65 no deberia haberse almacenado para un item Proyector';
  end if;
  raise notice 'TEST 10 OK: la creacion exitosa del Pedido (sin bloqueo por luzgrua_required_field_65) y la ausencia de su valor almacenado prueban que fn_apply y fn_missing usan el mismo scope';
end $$;

-- =========================================================================
-- TEST 11: una definition INACTIVA nunca aplica, aunque tenga
-- required_before_order=true y su Tipo de Producto coincida.
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T11', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'pedido'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('proy_required_field_65', 'ok')
    ))
  )).id into v_order_id;
  if v_order_id is null then
    raise exception 'TEST 11 FALLO: no se creo el Pedido (inactive_proy_field_65 no deberia haber bloqueado)';
  end if;
  raise notice 'TEST 11 OK: una definition inactiva (aunque required_before_order=true y mismo Tipo de Producto) nunca bloquea ni aplica';
end $$;

-- =========================================================================
-- TEST 12: aislamiento cross-org — un campo de Org B nunca se
-- almacena/aplica a un item de Org A, aunque se envie su key/valor.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T12', 'product_type', 'proyector_type_65', 'business_unit_id', '00000000-0000-0000-0000-0000000000d1', 'status', 'borrador'),
    jsonb_build_array(jsonb_build_object(
      'model', 'PROY-65', 'quantity', 1, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1',
      'custom_field_values', jsonb_build_object('orgb_field_65', 'no-deberia-guardarse')
    ))
  )).id into v_order_id;
  select id into v_item_id from order_items where order_id = v_order_id;
  if exists (select 1 from custom_field_values cfv join custom_field_definitions d on d.id = cfv.definition_id where cfv.entity_id = v_item_id and d.key = 'orgb_field_65') then
    raise exception 'TEST 12 FALLO: un campo de Org B nunca deberia aplicar/almacenarse en un item de Org A';
  end if;
  raise notice 'TEST 12 OK: aislamiento cross-org respetado por fn_apply_order_item_custom_fields';
end $$;

-- =========================================================================
-- TEST 13: un admin de Tenant B no puede VER los Tipos de Producto ni las
-- custom_field_definitions de Org A (GS) — verificado via RLS real, no
-- via filtro de aplicacion.
-- =========================================================================
do $$
declare v_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');

  select count(*) into v_count from product_types where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
  if v_count <> 0 then
    raise exception 'TEST 13 FALLO: un admin de Org B no deberia poder ver los Tipos de Producto de Org A (vio %)', v_count;
  end if;

  select count(*) into v_count from custom_field_definitions where organization_id = '00000000-0000-0000-0000-0000000000a1';
  if v_count <> 0 then
    raise exception 'TEST 13 FALLO: un admin de Org B no deberia poder ver custom_field_definitions de Org A (vio %)', v_count;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 13 OK: RLS aisla Tipos de Producto y custom field definitions entre tenants';
end $$;

rollback;
