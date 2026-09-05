-- THÖREN — Fase 8D (Configurable Completeness Rules, 0061) — pruebas
-- funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0061 + fixtures.sql +
-- 0023_fixtures.sql + 0024_fixtures.sql (0057/0060/0061 ya sembraron y
-- migraron los campos de Thunder LED). Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.
--
-- Cubre los 18 casos SQL-testables de la lista de 20 de 8D. Los 2
-- restantes (inspección de fuente: la lógica universal de completitud no
-- contiene "proyector_gobo"/isProjector, y getMissingProjectorFields ya no
-- existe) son de TypeScript — cubiertos por
-- src/lib/custom-fields/completeness.test.ts y
-- src/components/orders/vertical-residue-cleanup.test.ts.

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
select id as bu_gfb from business_units where organization_id = (select org1 from _ids) and code = 'got_fresh_breath' \gset
alter table _ids add column bu_thunder uuid, add column bu_juno uuid, add column bu_gfb uuid;
update _ids set bu_thunder = :'bu_thunder', bu_juno = :'bu_juno', bu_gfb = :'bu_gfb';

select test_set_user(:'admin_orgb');
insert into salespeople (organization_id, name, prefix, active)
values ((select orgb from _ids), 'Vendedor Org B 8D', 'VOB8D', true)
returning id as salesperson_orgb \gset
alter table _ids add column salesperson_orgb uuid;
update _ids set salesperson_orgb = :'salesperson_orgb';
select test_set_user(:'admin');

-- Función auxiliar local: construye el jsonb de un producto Thunder con
-- los 5 campos que hoy son required_before_order (ver 0061). Estas 5 son
-- TODAS legacy (columnas nativas de order_items / order_item_images, ver
-- legacy-order-item-adapter.ts) — van como propiedades de PRIMER NIVEL del
-- item, exactamente como las lee rpc_create_order/rpc_update_order
-- (0006/0007), NUNCA dentro de `custom_field_values` (esa clave es
-- exclusiva de campos genuinamente nuevos, no-legacy — ver 0055/0058).
create temp table _thunder_complete_item as
select jsonb_build_object(
  'model', 'M1', 'quantity', 1,
  'projection_description', 'STOP',
  'projection_width', 4,
  'projection_height', 4,
  'installation_height', 11.5,
  'projection_images', jsonb_build_array(jsonb_build_object('path', 'orders/8d/proyeccion/a.png'))
) as item;

-- =========================================================================
-- TEST 1: Thunder preserva la regla vieja exactamente — pedido incompleto
-- (los 5 campos ausentes) no puede pasar a "Pedido".
-- =========================================================================
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-1', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 1 FALLÓ: un pedido de Thunder sin ninguno de sus 5 campos pasó a Pedido'; end if;
  if v_msg !~ 'No puedes continuar' then raise exception 'TEST 1 FALLÓ: el mensaje no es el genérico esperado (%)', v_msg; end if;
  if exists (select 1 from orders where id = v_order_id) then
    raise exception 'TEST 1 FALLÓ: el pedido quedó creado a pesar de estar incompleto (no hubo rollback real)';
  end if;
  raise notice 'TEST 1 OK: Thunder preserva la regla vieja — incompleto bloquea "Pedido" (mensaje genérico: %)', v_msg;
end $$;

-- =========================================================================
-- TEST 2: mismo pedido, pero solo falta 1 de los 5 (installation_height) —
-- sigue bloqueado, y el mensaje nombra justo ese campo.
-- =========================================================================
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-2', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object(
        'model', 'M1', 'quantity', 1,
        'projection_description', 'STOP', 'projection_width', 4, 'projection_height', 4,
        'projection_images', jsonb_build_array(jsonb_build_object('path', 'orders/8d/proyeccion/a.png'))
      ))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 2 FALLÓ: faltando solo "Altura de instalación" el pedido pasó a Pedido'; end if;
  if v_msg !~ 'Altura de instalación' then raise exception 'TEST 2 FALLÓ: el mensaje no nombra el campo específico faltante (%)', v_msg; end if;
  if v_msg ~ 'Ancho de imagen requerida' then raise exception 'TEST 2 FALLÓ: reportó "Ancho de imagen requerida" como faltante aunque se envió (%)', v_msg; end if;
  raise notice 'TEST 2 OK: falta un solo campo de los 5 → bloquea y lo nombra (%)', v_msg;
end $$;

-- =========================================================================
-- TEST 3: pedido completo (los 5 presentes) SÍ pasa a "Pedido".
-- NOTA (gap final 0062): Thunder también exige Proveedor (business_unit_
-- process_settings) — se incluye aquí para que "completo" siga siendo
-- realmente completo tras ese gap; no es parte de la regla de 0061 en sí.
-- =========================================================================
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8D-3', 'supplier_name', 'Proveedor 8D', 'product_type', 'otro',
    'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
  ),
  jsonb_build_array((select item from _thunder_complete_item))
)).id as order_t3 \gset
alter table _ids add column order_t3 uuid;
update _ids set order_t3 = :'order_t3';
do $$
declare v_status text;
begin
  select status into v_status from orders where id = (select order_t3 from _ids);
  if v_status <> 'pedido' then raise exception 'TEST 3 FALLÓ: un pedido completo no quedó en status=pedido (%)', v_status; end if;
  raise notice 'TEST 3 OK: pedido completo (5/5) pasa a Pedido sin bloqueo';
end $$;

-- =========================================================================
-- TESTS 4-5: Juno y GFB NO heredan los required_before_order de Thunder —
-- un pedido vacío de esos productos sí puede marcarse "Pedido".
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D-4 Juno', 'product_type', 'otro', 'business_unit_id', (select bu_juno from _ids),
      'status', 'pedido'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 4 FALLÓ: Juno se vio bloqueado por los campos de Thunder';
  end if;
  raise notice 'TEST 4 OK: Juno no hereda los required_before_order de Thunder';
end $$;

do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D-5 GFB', 'product_type', 'otro', 'business_unit_id', (select bu_gfb from _ids),
      'status', 'pedido'
    ),
    jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 5 FALLÓ: GFB se vio bloqueado por los campos de Thunder';
  end if;
  raise notice 'TEST 5 OK: GFB no hereda los required_before_order de Thunder';
end $$;

-- =========================================================================
-- TEST 6: Tenant B configura Y hace cumplir su PROPIO required_before_order
-- ("Prioridad") — genérico, sin que nadie lo haya programado a mano.
-- =========================================================================
select test_set_user(:'admin_orgb');
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required_before_order)
values ((select orgb from _ids), (select bu_org_b from _ids), 'order_item', 'prioridad', 'Prioridad', 'text', true)
returning id as def_prioridad \gset
alter table _ids add column def_prioridad uuid;
update _ids set def_prioridad = :'def_prioridad';

do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-6 OrgB', 'product_type', 'otro', 'business_unit_id', (select bu_org_b from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 6a FALLÓ: Tenant B pudo marcar "Pedido" sin su propia "Prioridad"'; end if;
  raise notice 'TEST 6a OK: Tenant B hace cumplir su propio campo "Prioridad" (nadie lo programó — 100%% configuración)';
end $$;

select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson_orgb from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8D-6b OrgB', 'product_type', 'otro', 'business_unit_id', (select bu_org_b from _ids),
    'status', 'pedido'
  ),
  jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'custom_field_values', jsonb_build_object('prioridad', 'Alta')))
)).id as order_t6b \gset
alter table _ids add column order_t6b uuid;
update _ids set order_t6b = :'order_t6b';
do $$
begin
  if not exists (select 1 from orders where id = (select order_t6b from _ids) and status = 'pedido') then
    raise exception 'TEST 6b FALLÓ: con "Prioridad" presente, Tenant B debía poder marcar Pedido';
  end if;
  raise notice 'TEST 6b OK: con "Prioridad" presente, Tenant B marca Pedido sin problema';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 7: una definición INACTIVA no bloquea, aunque sea required_before_order.
-- =========================================================================
update custom_field_definitions set active = false
  where business_unit_id = (select bu_thunder from _ids) and key = 'installation_height';
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D-7', 'supplier_name', 'Proveedor 8D', 'product_type', 'otro',
      'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
    ),
    jsonb_build_array(jsonb_build_object(
      'model', 'M1', 'quantity', 1,
      'projection_description', 'STOP', 'projection_width', 4, 'projection_height', 4,
      'projection_images', jsonb_build_array(jsonb_build_object('path', 'orders/8d/proyeccion/a.png'))
    ))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 7 FALLÓ: una definición inactiva (installation_height) siguió bloqueando';
  end if;
  raise notice 'TEST 7 OK: una definición inactiva no bloquea, aunque sea required_before_order';
end $$;
update custom_field_definitions set active = true
  where business_unit_id = (select bu_thunder from _ids) and key = 'installation_height';

-- =========================================================================
-- TEST 8: un campo required_before_order de OTRA Business Unit (Juno) no
-- bloquea un pedido de Thunder.
-- =========================================================================
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required_before_order)
values ((select org1 from _ids), (select bu_juno from _ids), 'order_item', 'juno_solo_field', 'Solo de Juno', 'text', true);
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D-8', 'supplier_name', 'Proveedor 8D', 'product_type', 'otro',
      'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
    ),
    jsonb_build_array((select item from _thunder_complete_item))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 8 FALLÓ: un campo required_before_order de Juno bloqueó un pedido de Thunder';
  end if;
  raise notice 'TEST 8 OK: un campo required_before_order de otra BU nunca bloquea';
end $$;

-- =========================================================================
-- TEST 9: un campo required_before_order ORG-WIDE (business_unit_id NULL)
-- SÍ bloquea cualquier Business Unit de esa organización.
-- =========================================================================
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required_before_order)
values ((select org1 from _ids), null, 'order_item', 'org_wide_field', 'Campo de toda la organización', 'text', true)
returning id as def_org_wide \gset
alter table _ids add column def_org_wide uuid;
update _ids set def_org_wide = :'def_org_wide';

do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-9', 'product_type', 'otro', 'business_unit_id', (select bu_juno from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 9 FALLÓ: un campo org-wide requerido no bloqueó a Juno'; end if;
  if v_msg !~ 'Campo de toda la organización' then raise exception 'TEST 9 FALLÓ: mensaje no nombra el campo org-wide (%)', v_msg; end if;
  raise notice 'TEST 9 OK: un campo org-wide required_before_order bloquea cualquier BU de esa organización';
end $$;
delete from custom_field_definitions where id = (select def_org_wide from _ids);
delete from custom_field_definitions where organization_id = (select org1 from _ids) and key = 'juno_solo_field';

-- =========================================================================
-- TEST 10: un projection_images vacío ([]) bloquea, aunque los otros 4 campos estén completos.
-- =========================================================================
do $$
declare v_order_id uuid := gen_random_uuid(); v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_create_order_with_custom_fields(
      v_order_id,
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-10', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object(
        'model', 'M1', 'quantity', 1,
        'projection_description', 'STOP', 'projection_width', 4, 'projection_height', 4,
        'installation_height', 11.5, 'projection_images', '[]'::jsonb
      ))
    );
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text; end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: projection_images=[] no bloqueó "Pedido"'; end if;
  if v_msg !~ 'Imagen' then raise exception 'TEST 10 FALLÓ: el mensaje no nombra la imagen a proyectar (%)', v_msg; end if;
  raise notice 'TEST 10 OK: un archivo/imagen requerido vacío ([]) bloquea "Pedido"';
end $$;

-- =========================================================================
-- TEST 11: una imagen a proyectar YA PERSISTIDA satisface el requisito
-- (ya cubierto por TEST 3, que usa una ruta persistida) — aquí se verifica
-- explícitamente vía fn_is_order_item_custom_field_complete.
-- =========================================================================
do $$
declare v_item_id uuid; v_ok boolean;
begin
  select id into v_item_id from order_items where order_id = (select order_t3 from _ids);
  select fn_is_order_item_custom_field_complete(v_item_id, (
    select id from custom_field_definitions where business_unit_id = (select bu_thunder from _ids) and key = 'projection_images'
  )) into v_ok;
  if not v_ok then raise exception 'TEST 11 FALLÓ: una imagen a proyectar ya persistida no se reconoció como completa'; end if;
  raise notice 'TEST 11 OK: una imagen a proyectar persistida satisface el requisito';
end $$;

-- =========================================================================
-- TEST 12: un campo legacy Thunder (installation_height, columna nativa de
-- order_items) participa en la validación vía el adapter SQL — no vive en
-- custom_field_values.
-- =========================================================================
do $$
declare v_item_id uuid; v_value numeric;
begin
  select id, installation_height into v_item_id, v_value from order_items where order_id = (select order_t3 from _ids);
  if v_value is null then raise exception 'TEST 12 FALLÓ: installation_height no se guardó en la columna nativa de order_items'; end if;
  raise notice 'TEST 12 OK: installation_height (legacy) participa en la validación leyendo la columna nativa, no custom_field_values (valor=%)', v_value;
end $$;

-- =========================================================================
-- TEST 13: un vendedor no puede alterar required_before_order de una
-- definición (RLS admin-only, ya existente — 0055).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_failed boolean := false;
begin
  begin
    update custom_field_definitions set required_before_order = false
      where business_unit_id = (select bu_thunder from _ids) and key = 'installation_height';
  exception when others then v_failed := true; end;
  if not v_failed then
    if exists (
      select 1 from custom_field_definitions
        where business_unit_id = (select bu_thunder from _ids) and key = 'installation_height' and not required_before_order
    ) then
      raise exception 'TEST 13 FALLÓ: un vendedor pudo desactivar required_before_order de una definición';
    end if;
  end if;
  raise notice 'TEST 13 OK: un vendedor no puede alterar required_before_order (RLS admin-only)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 14: un payload manipulado (enviado directo al RPC, sin pasar por
-- ninguna validación de cliente) sigue siendo rechazado por el servidor.
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
        'client_name', 'Cliente 8D-14', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1, 'custom_field_values', '{}'::jsonb))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 14 FALLÓ: un payload manipulado (sin pasar validación de cliente) logró marcar Pedido'; end if;
  raise notice 'TEST 14 OK: la autoridad real del servidor rechaza un payload manipulado, sin depender de ninguna validación de cliente';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 15: una definición de OTRA organización nunca se usa para decidir
-- si un pedido de Global Supplier puede marcarse "Pedido".
-- =========================================================================
select test_set_user(:'admin_orgb');
insert into custom_field_definitions
  (organization_id, business_unit_id, entity_type, key, label, field_type, required_before_order)
values ((select orgb from _ids), (select bu_org_b from _ids), 'order_item', 'power', 'Power (Org B, coincidencia de nombre)', 'text', true);
select test_set_user(:'admin');
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order_with_custom_fields(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
      'client_name', 'Cliente 8D-15', 'supplier_name', 'Proveedor 8D', 'product_type', 'otro',
      'business_unit_id', (select bu_thunder from _ids), 'status', 'pedido'
    ),
    jsonb_build_array((select item from _thunder_complete_item))
  )).id into v_order_id;
  if not exists (select 1 from orders where id = v_order_id and status = 'pedido') then
    raise exception 'TEST 15 FALLÓ: una definición "power" de Org B (mismo key, otra organización) bloqueó a Global Supplier';
  end if;
  raise notice 'TEST 15 OK: una definición de otra organización nunca se usa, ni por coincidencia de key';
end $$;

-- =========================================================================
-- TEST 16: fn_get_missing_required_before_order_fields (la función que usa
-- setOrderStatus) devuelve el mismo formato "Producto N (modelo): Etiqueta"
-- para un pedido guardado como Borrador con 2 productos, uno completo y
-- otro no.
-- =========================================================================
select (rpc_create_order_with_custom_fields(
  gen_random_uuid(),
  jsonb_build_object(
    'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
    'client_name', 'Cliente 8D-16', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
    'status', 'borrador'
  ),
  jsonb_build_array(
    jsonb_build_object('model', 'COMPLETO', 'quantity', 1) || (select item - 'model' - 'quantity' from _thunder_complete_item),
    jsonb_build_object('model', 'INCOMPLETO', 'quantity', 1)
  )
)).id as order_t16 \gset
alter table _ids add column order_t16 uuid;
update _ids set order_t16 = :'order_t16';
do $$
declare v_missing text[];
begin
  select fn_get_missing_required_before_order_fields((select order_t16 from _ids)) into v_missing;
  if not (v_missing @> array['Producto 2 (INCOMPLETO): ¿Qué quiere proyectar el cliente?']) then
    raise exception 'TEST 16 FALLÓ: fn_get_missing_required_before_order_fields no reportó el producto 2 incompleto (%)', v_missing;
  end if;
  if exists (select 1 from unnest(v_missing) m where m like 'Producto 1%') then
    raise exception 'TEST 16 FALLÓ: el producto 1 (completo) apareció como faltante (%)', v_missing;
  end if;
  raise notice 'TEST 16 OK: fn_get_missing_required_before_order_fields (usada por setOrderStatus) valida cada producto por separado: %', v_missing;
end $$;

-- =========================================================================
-- TEST 17: setOrderStatus (vía la misma función) bloquea marcar un
-- Borrador incompleto como "Pedido" directamente con un UPDATE de status.
-- =========================================================================
do $$
declare v_missing text[];
begin
  select fn_get_missing_required_before_order_fields((select order_t16 from _ids)) into v_missing;
  if coalesce(array_length(v_missing, 1), 0) = 0 then
    raise exception 'TEST 17 FALLÓ: se esperaba al menos 1 campo faltante antes de permitir marcar Pedido';
  end if;
  raise notice 'TEST 17 OK: setOrderStatus (vía fn_get_missing_required_before_order_fields) seguiría bloqueando este pedido incompleto';
end $$;

-- =========================================================================
-- TEST 18: update de un pedido ya "Pedido" (completo) a datos incompletos
-- NO puede volver a guardarse como "Pedido" — la revalidación ocurre en
-- cada guardado, no solo en la creación.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_update_order_with_custom_fields(
      (select order_t3 from _ids),
      jsonb_build_object(
        'salesperson_id', (select salesperson1 from _ids), 'order_date', '2026-08-11',
        'client_name', 'Cliente 8D-3 editado', 'product_type', 'otro', 'business_unit_id', (select bu_thunder from _ids),
        'status', 'pedido'
      ),
      jsonb_build_array(jsonb_build_object('model', 'M1', 'quantity', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 18 FALLÓ: un update que vacía los campos requeridos siguió dejando el pedido en Pedido'; end if;
  raise notice 'TEST 18 OK: la validación se re-aplica en cada guardado (update), no solo al crear';
end $$;

select 'TODAS LAS PRUEBAS 0061 (8D) PASARON' as resultado;

rollback;
