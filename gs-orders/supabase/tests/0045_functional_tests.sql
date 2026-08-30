-- THÖREN — Fase 6R.1B-3A: Backend Purchase Orders — Preparar vs Aprobar
-- (0045) — pruebas funcionales contra Postgres real. Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0045 + fixtures.sql. Todo el
-- script corre en una transacción que se revierte al final — repetible.
-- Bajo `set role authenticated` REAL (lección de 0043) — no se asume que
-- pasar como dueño de las tablas reproduce el comportamiento de Cloud.
--
-- Usuarios sintéticos: "preparer" (can_prepare_purchase_orders) y
-- "approver" (can_approve_purchase_orders) — ninguna capability se asigna
-- aquí a ningún usuario REAL (Karla/Rodolfo, eso es 6R.1B-3C).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set preparer '00000000-0000-0000-0000-000000000045'
\set preparer_b '00000000-0000-0000-0000-000000000051'
\set approver '00000000-0000-0000-0000-000000000046'
\set receiver_only '00000000-0000-0000-0000-000000000047'
\set viewer_all_sales '00000000-0000-0000-0000-000000000048'
\set logistics_cap '00000000-0000-0000-0000-000000000049'
\set vendedor_normal '00000000-0000-0000-0000-000000000003'
\set technico '00000000-0000-0000-0000-000000000050'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- FIXTURES
-- =========================================================================
-- - preparer / approver / receiver_only / viewer_all_sales / logistics_cap
--   / technico: usuarios vendedor activos, cada uno con su propio
--   salesperson (nunca dueños del Pedido ajeno usado en las pruebas), SIN
--   ninguna capability al inicio. Cada bloque otorga solo la capability
--   necesaria justo antes de usarla.
-- - Pedido AJENO (de vendedor1/salesperson1) con 2 partidas de catálogo —
--   este es el Pedido sobre el que se preparan las Purchase Orders.
-- - Proveedor activo en Org 1.
-- - Un admin de Org B + su propio Pedido/proveedor, para las pruebas
--   cross-org (24-27).
-- =========================================================================
do $$
declare
  v_org1 uuid; v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_ajeno_order_id uuid;
  v_product1 product_catalog;
  v_product2 product_catalog;
  v_supplier_id uuid;
  v_sp_id uuid;
  v_user_id uuid;
  v_users uuid[] := array[
    '00000000-0000-0000-0000-000000000045'::uuid, -- preparer
    '00000000-0000-0000-0000-000000000046'::uuid, -- approver
    '00000000-0000-0000-0000-000000000047'::uuid, -- receiver_only
    '00000000-0000-0000-0000-000000000048'::uuid, -- viewer_all_sales
    '00000000-0000-0000-0000-000000000049'::uuid, -- logistics_cap
    '00000000-0000-0000-0000-000000000050'::uuid, -- technico
    '00000000-0000-0000-0000-000000000051'::uuid  -- preparer_b
  ];
  v_names text[] := array['Preparer 0045', 'Approver 0045', 'Receiver Only 0045', 'Viewer AllSales 0045', 'Logistics Cap 0045', 'Tecnico 0045', 'Preparer B 0045'];
  v_prefixes text[] := array['P45', 'A45', 'R45', 'V45', 'L45', 'T45', 'P4B'];
  i integer;
begin
  select org1, customer1, salesperson1 into v_org1, v_customer1, v_salesperson1 from _ids;

  for i in 1..array_length(v_users, 1) loop
    v_user_id := v_users[i];
    insert into salespeople (id, business_unit, name, prefix, active)
    values (gen_random_uuid(), 'thunder', v_names[i], v_prefixes[i], true)
    returning id into v_sp_id;
    insert into auth.users (id, email) values (v_user_id, lower(v_prefixes[i]) || '-0045@test.local');
    insert into organization_members (organization_id, user_id, role, active) values (v_org1, v_user_id, 'vendedor', true);
    insert into user_profiles (user_id, name, role, salesperson_id, active) values (v_user_id, v_names[i], 'vendedor', v_sp_id, true);
  end loop;

  -- Proveedor activo.
  insert into suppliers (organization_id, name, active)
  values (v_org1, 'Proveedor 0045', true)
  returning id into v_supplier_id;
  perform set_config('test.supplier0045_id', v_supplier_id::text, false);

  -- Catálogo: 2 productos (para probar reemplazo de partidas con más de
  -- una línea).
  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-0045-A', 'Producto A 0045', 'pza', true)
  returning * into v_product1;
  insert into product_catalog (organization_id, sku, name, unit, active)
  values (v_org1, 'SKU-0045-B', 'Producto B 0045', 'pza', true)
  returning * into v_product2;
  perform set_config('test.product0045a_id', v_product1.id::text, false);
  perform set_config('test.product0045b_id', v_product2.id::text, false);

  -- Pedido AJENO (de vendedor1/salesperson1) con 2 partidas de catálogo.
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'Cliente Ajeno 0045',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(
      jsonb_build_object('model', 'MODELO-0045-A', 'quantity', 40, 'unit', 'pza'),
      jsonb_build_object('model', 'MODELO-0045-B', 'quantity', 20, 'unit', 'pza')
    )
  );
  v_ajeno_order_id := v_order.id;
  update order_items set catalog_product_id = v_product1.id where order_id = v_ajeno_order_id and model = 'MODELO-0045-A';
  update order_items set catalog_product_id = v_product2.id where order_id = v_ajeno_order_id and model = 'MODELO-0045-B';
  perform set_config('test.ajeno_order0045_id', v_ajeno_order_id::text, false);
  perform set_config('test.order_item_a_id', (select id::text from order_items where order_id = v_ajeno_order_id and model = 'MODELO-0045-A'), false);
  perform set_config('test.order_item_b_id', (select id::text from order_items where order_id = v_ajeno_order_id and model = 'MODELO-0045-B'), false);

  raise notice 'SETUP OK: Pedido ajeno % (vendedor1), proveedor %, productos % / %',
    v_ajeno_order_id, v_supplier_id, v_product1.id, v_product2.id;
end $$;

-- Org B: admin propio + Pedido + proveedor propios, para pruebas cross-org.
select test_set_user(:'admin_orgb');
do $$
declare
  v_orgb uuid; v_sp_orgb_id uuid; v_supplier_orgb_id uuid;
  v_customer_orgb_id uuid; v_order_orgb orders;
begin
  select orgb into v_orgb from _ids;
  insert into salespeople (id, business_unit, name, prefix, active)
  values (gen_random_uuid(), 'thunder', 'Vendedor OrgB 0045', 'VB5', true)
  returning id into v_sp_orgb_id;
  insert into customers (organization_id, name, active) values (v_orgb, 'Cliente OrgB 0045', true) returning id into v_customer_orgb_id;
  insert into suppliers (organization_id, name, active) values (v_orgb, 'Proveedor OrgB 0045', true) returning id into v_supplier_orgb_id;

  select * into v_order_orgb from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_sp_orgb_id, 'order_date', current_date::text, 'client_name', 'Cliente OrgB 0045',
      'product_type', 'otro', 'customer_id', v_customer_orgb_id
    ),
    jsonb_build_array(jsonb_build_object('model', 'MODELO-ORGB-0045', 'quantity', 10, 'unit', 'pza'))
  );
  perform set_config('test.orgb_order0045_id', v_order_orgb.id::text, false);
  perform set_config('test.orgb_supplier0045_id', v_supplier_orgb_id::text, false);
  perform set_config('test.orgb_order_item0045_id', (select id::text from order_items where order_id = v_order_orgb.id), false);

  -- PO real de Org B (para probar que preparer de Org 1 no puede tocarla).
  perform rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_orgb.id, 'supplier_id', v_supplier_orgb_id, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.orgb_order_item0045_id')::uuid, 'quantity_ordered', 5))
  );
  perform set_config('test.orgb_po0045_id', (select id::text from purchase_orders where order_id = v_order_orgb.id), false);
  raise notice 'SETUP ORG B OK: Pedido %, PO %', v_order_orgb.id, current_setting('test.orgb_po0045_id');
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- PREPARE (tests 1-5)
-- =========================================================================

-- El preparer también necesita ver el Pedido ajeno para que las RPCs
-- (SECURITY INVOKER) puedan siquiera resolverlo — RLS compounding, ver
-- DECISIÓN de 0045: can_prepare_purchase_orders es ortogonal a
-- can_view_all_sales, así que se otorgan ambas explícitamente aquí, igual
-- que se anticipa para Karla/Rodolfo en 3C (mismo patrón que 0044).
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'preparer', unnest(array['can_prepare_purchase_orders', 'can_view_all_sales']), true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;

-- TEST 1: preparer crea OC borrador sobre Pedido ajeno.
select test_set_user(:'preparer');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0045_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0045_id')::uuid;
  v_item_a uuid := current_setting('test.order_item_a_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 15))
  );
  if v_po.status <> 'borrador' then
    raise exception 'TEST 1 FALLÓ: la PO debía nacer en borrador, quedó en %', v_po.status;
  end if;
  perform set_config('test.po0045_id', v_po.id::text, false);
  raise notice 'TEST 1 OK: preparer crea PO % en borrador.', v_po.folio;
end $$;

-- TEST 2: preparer edita detalles del borrador.
do $$
declare
  v_po_id uuid := current_setting('test.po0045_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_details(v_po_id, jsonb_build_object('notes', 'nota de preparación 0045', 'supplier_reference', 'REF-0045'));
  if v_po.notes <> 'nota de preparación 0045' or v_po.supplier_reference <> 'REF-0045' then
    raise exception 'TEST 2 FALLÓ: detalles no se guardaron correctamente';
  end if;
  raise notice 'TEST 2 OK: preparer edita detalles del borrador.';
end $$;

-- TEST 3: preparer reemplaza/edita partidas del borrador (agrega la
-- partida B, ajusta la cantidad de A).
do $$
declare
  v_po_id uuid := current_setting('test.po0045_id')::uuid;
  v_item_a uuid := current_setting('test.order_item_a_id')::uuid;
  v_item_b uuid := current_setting('test.order_item_b_id')::uuid;
  v_count integer;
  v_sum_a integer;
begin
  perform rpc_replace_purchase_order_items(
    v_po_id,
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 25),
      jsonb_build_object('order_item_id', v_item_b, 'quantity_ordered', 10)
    )
  );
  select count(*) into v_count from purchase_order_items where purchase_order_id = v_po_id;
  select quantity_ordered into v_sum_a from purchase_order_items where purchase_order_id = v_po_id and order_item_id = v_item_a;
  if v_count <> 2 then
    raise exception 'TEST 3 FALLÓ: se esperaban 2 partidas tras el reemplazo, hay %', v_count;
  end if;
  if v_sum_a <> 25 then
    raise exception 'TEST 3 FALLÓ: cantidad de la partida A no se actualizó (esperado 25, real %)', v_sum_a;
  end if;
  raise notice 'TEST 3 OK: preparer reemplaza partidas del borrador (2 partidas, A=25).';
end $$;

-- TEST 4: el reemplazo es atómico — un payload con una partida inválida
-- (order_item_id ajeno a este Pedido) no debe dejar NINGÚN cambio aplicado.
do $$
declare
  v_po_id uuid := current_setting('test.po0045_id')::uuid;
  v_item_a uuid := current_setting('test.order_item_a_id')::uuid;
  v_count_before integer;
  v_count_after integer;
  v_failed boolean := false;
begin
  select count(*) into v_count_before from purchase_order_items where purchase_order_id = v_po_id;
  begin
    perform rpc_replace_purchase_order_items(
      v_po_id,
      jsonb_build_array(
        jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 99),
        jsonb_build_object('order_item_id', gen_random_uuid(), 'quantity_ordered', 5)
      )
    );
  exception when others then
    v_failed := true;
  end;
  select count(*) into v_count_after from purchase_order_items where purchase_order_id = v_po_id;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: el reemplazo con una partida inválida debía fallar';
  end if;
  if v_count_after <> v_count_before then
    raise exception 'TEST 4 FALLÓ: el reemplazo NO fue atómico — quedaron % partidas en vez de %', v_count_after, v_count_before;
  end if;
  raise notice 'TEST 4 OK: reemplazo atómico — payload inválido no deja cambios parciales (% partidas intactas).', v_count_after;
end $$;

-- TEST 5: preparer cancela su propio borrador.
do $$
declare
  v_po_id uuid := current_setting('test.po0045_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'cancelada');
  if v_po.status <> 'cancelada' then
    raise exception 'TEST 5 FALLÓ: la PO debía quedar cancelada';
  end if;
  raise notice 'TEST 5 OK: preparer cancela su propio borrador.';
end $$;

select test_set_user(:'admin');

-- =========================================================================
-- APPROVE BLOCKS (tests 6-12) — nueva PO fresca en borrador, preparada de
-- nuevo, para probar los bloqueos SIN depender de la cancelada del test 5.
-- =========================================================================
select test_set_user(:'preparer');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0045_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0045_id')::uuid;
  v_item_a uuid := current_setting('test.order_item_a_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 20))
  );
  perform set_config('test.po0045b_id', v_po.id::text, false);
  raise notice 'SETUP TEST 6-12 OK: PO % en borrador.', v_po.folio;
end $$;

-- TEST 6/7/8: preparer NO puede sacarla de borrador hacia ordenada/confirmada/en_transito.
do $$
declare v_po_id uuid := current_setting('test.po0045b_id')::uuid; v_failed boolean;
begin
  v_failed := false;
  begin perform rpc_update_purchase_order_status(v_po_id, 'ordenada'); exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 6 FALLÓ: preparer no debía poder hacer borrador -> ordenada'; end if;
  raise notice 'TEST 6 OK: preparer NO hace borrador -> ordenada.';

  v_failed := false;
  begin perform rpc_update_purchase_order_status(v_po_id, 'confirmada'); exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 7 FALLÓ: preparer no debía poder hacer borrador -> confirmada'; end if;
  raise notice 'TEST 7 OK: preparer NO hace borrador -> confirmada.';

  v_failed := false;
  begin perform rpc_update_purchase_order_status(v_po_id, 'en_transito'); exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 8 FALLÓ: preparer no debía poder hacer borrador -> en_transito'; end if;
  raise notice 'TEST 8 OK: preparer NO hace borrador -> en_transito.';
end $$;

select test_set_user(:'admin');
-- Admin aprueba la PO para dejarla fuera de borrador (para tests 9-11).
select * from rpc_update_purchase_order_status(current_setting('test.po0045b_id')::uuid, 'ordenada');
select test_set_user(:'preparer');

-- TEST 9: preparer NO modifica detalles después de salir de borrador.
do $$
declare v_po_id uuid := current_setting('test.po0045b_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_details(v_po_id, jsonb_build_object('notes', 'intento tras aprobación'));
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 9 FALLÓ: preparer no debía poder editar detalles tras salir de borrador'; end if;
  raise notice 'TEST 9 OK: preparer NO modifica detalles después de salir de borrador.';
end $$;

-- TEST 10: preparer NO modifica partidas después de salir de borrador.
do $$
declare v_po_id uuid := current_setting('test.po0045b_id')::uuid; v_item_a uuid := current_setting('test.order_item_a_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_replace_purchase_order_items(v_po_id, jsonb_build_array(jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 1)));
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 10 FALLÓ: preparer no debía poder reemplazar partidas tras salir de borrador'; end if;
  raise notice 'TEST 10 OK: preparer NO modifica partidas después de salir de borrador.';
end $$;

-- TEST 11: preparer NO cancela una OC ya aprobada (fuera de borrador).
do $$
declare v_po_id uuid := current_setting('test.po0045b_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'cancelada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 11 FALLÓ: preparer no debía poder cancelar una OC ya aprobada'; end if;
  raise notice 'TEST 11 OK: preparer NO cancela una OC ya aprobada.';
end $$;

-- TEST 12: preparer NO regresa ordenada -> borrador.
do $$
declare v_po_id uuid := current_setting('test.po0045b_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'borrador');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 12 FALLÓ: preparer no debía poder regresar la OC a borrador'; end if;
  raise notice 'TEST 12 OK: preparer NO regresa ordenada -> borrador (rechazado como estado no asignable).';
end $$;

select test_set_user(:'admin');

-- =========================================================================
-- APPROVE (tests 13-16)
-- =========================================================================
update user_capabilities set active = true where user_id = :'approver' and capability = 'can_approve_purchase_orders';
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'approver', 'can_approve_purchase_orders', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;
-- El approver también necesita ver el Pedido ajeno para poder resolver la
-- PO (RLS compounding, ver DECISIÓN de 0045) — se le otorga
-- can_view_all_sales igual que se anticipa para Karla/Rodolfo en 3C.
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'approver', 'can_view_all_sales', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;

-- Nueva PO fresca en borrador (preparada por admin) para las pruebas de aprobación.
do $$
declare v_po purchase_orders;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 8))
  );
  perform set_config('test.po0045c_id', v_po.id::text, false);
end $$;

select test_set_user(:'approver');

-- TEST 13: approver saca borrador -> ordenada.
do $$
declare v_po_id uuid := current_setting('test.po0045c_id')::uuid; v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'ordenada');
  if v_po.status <> 'ordenada' then
    raise exception 'TEST 13 FALLÓ: la PO debía quedar ordenada';
  end if;
  raise notice 'TEST 13 OK: approver saca la PO de borrador (ordenada).';
end $$;

-- TEST 14: approver administra transición posterior válida (ordenada -> en_transito).
do $$
declare v_po_id uuid := current_setting('test.po0045c_id')::uuid; v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'en_transito');
  if v_po.status <> 'en_transito' then
    raise exception 'TEST 14 FALLÓ: la PO debía quedar en_transito';
  end if;
  raise notice 'TEST 14 OK: approver administra transición posterior (en_transito).';
end $$;

-- TEST 15: approver cancela una OC ya fuera de borrador.
do $$
declare v_po_id uuid := current_setting('test.po0045c_id')::uuid; v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'cancelada');
  if v_po.status <> 'cancelada' then
    raise exception 'TEST 15 FALLÓ: la PO debía quedar cancelada';
  end if;
  raise notice 'TEST 15 OK: approver cancela una OC ya aprobada/emitida.';
end $$;

-- TEST 16: approver tampoco puede violar una transición estructuralmente
-- prohibida (regresar a borrador, ni siquiera sobre la que acaba de cancelar).
do $$
declare v_po_id uuid := current_setting('test.po0045c_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'borrador');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 16 FALLÓ: ni siquiera approver puede regresar a borrador'; end if;
  raise notice 'TEST 16 OK: approver NO puede violar la prohibición estructural de regresar a borrador.';
end $$;

select test_set_user(:'admin');

-- =========================================================================
-- SEPARACIÓN (tests 17-23)
-- =========================================================================

-- PO fresca en borrador (admin) + ordenada, para probar recepción vs
-- prepare/approve. El id se captura DIRECTO del retorno de la RPC — todo
-- este archivo corre dentro de una sola transacción (begin/rollback), así
-- que now()/created_at es EL MISMO valor congelado para todas las filas
-- creadas en todo el script; "order by created_at desc limit 1" sería
-- ambiguo entre varias Purchase Orders y podría devolver la equivocada.
do $$
declare v_po purchase_orders;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_b_id')::uuid, 'quantity_ordered', 6))
  );
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  perform set_config('test.po0045d_id', v_po.id::text, false);
  perform set_config('test.poi0045d_id', (select id::text from purchase_order_items where purchase_order_id = v_po.id), false);
end $$;

insert into warehouses (organization_id, name, code)
  select org1, 'Almacén 0045', 'ALM-0045' from _ids;

update user_capabilities set active = true where user_id = :'receiver_only' and capability = 'can_receive_inventory';
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'receiver_only', 'can_receive_inventory', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;

-- TEST 17: can_receive_inventory sola NO prepara.
select test_set_user(:'receiver_only');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 17 FALLÓ: can_receive_inventory sola no debía poder crear una PO'; end if;
  raise notice 'TEST 17 OK: can_receive_inventory sola NO prepara.';
end $$;

-- TEST 18: can_receive_inventory sola NO aprueba.
do $$
declare v_po_id uuid := current_setting('test.po0045d_id')::uuid; v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'confirmada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 18 FALLÓ: can_receive_inventory sola no debía poder aprobar/cambiar estado'; end if;
  raise notice 'TEST 18 OK: can_receive_inventory sola NO aprueba.';
end $$;

-- TEST 19: can_prepare sola NO recibe si no tiene can_receive_inventory.
select test_set_user(:'preparer');
do $$
declare
  v_poi_id uuid := current_setting('test.poi0045d_id')::uuid;
  v_wh_id uuid;
  v_failed boolean := false;
begin
  select id into v_wh_id from warehouses where name = 'Almacén 0045';
  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 3, v_wh_id);
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 19 FALLÓ: can_prepare_purchase_orders sola no debía poder recibir mercancía'; end if;
  raise notice 'TEST 19 OK: can_prepare sola NO recibe (sin can_receive_inventory).';
end $$;

-- TEST 20: can_view_all_sales sola NO prepara.
select test_set_user(:'admin');
update user_capabilities set active = true where user_id = :'viewer_all_sales' and capability = 'can_view_all_sales';
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'viewer_all_sales', 'can_view_all_sales', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;
select test_set_user(:'viewer_all_sales');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 20 FALLÓ: can_view_all_sales sola no debía poder crear una PO'; end if;
  raise notice 'TEST 20 OK: can_view_all_sales sola NO prepara (visibilidad != autoridad de escritura).';
end $$;

-- TEST 21: una capability logística (0044) sola NO prepara/aprueba.
select test_set_user(:'admin');
update user_capabilities set active = true where user_id = :'logistics_cap' and capability = 'can_manage_deliveries';
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'logistics_cap', 'can_manage_deliveries', true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;
select test_set_user(:'logistics_cap');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 21 FALLÓ: can_manage_deliveries sola no debía poder crear una PO'; end if;
  raise notice 'TEST 21 OK: capability logística (can_manage_deliveries) sola NO prepara/aprueba.';
end $$;

-- TEST 22: vendedor normal sin ninguna capability NO prepara OC ajena.
select test_set_user(:'admin');
select test_set_user(:'vendedor_normal');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 22 FALLÓ: vendedor normal sin capability no debía poder preparar OC ajena'; end if;
  raise notice 'TEST 22 OK: vendedor normal sin capability NO prepara OC ajena.';
end $$;

-- TEST 23: admin conserva bypass total (crear/editar/partidas/aprobar/cancelar).
select test_set_user(:'admin');
do $$
declare
  v_po purchase_orders;
  v_item_a uuid := current_setting('test.order_item_a_id')::uuid;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 2))
  );
  perform rpc_update_purchase_order_details(v_po.id, jsonb_build_object('notes', 'admin bypass'));
  perform rpc_replace_purchase_order_items(v_po.id, jsonb_build_array(jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 4)));
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  perform rpc_update_purchase_order_status(v_po.id, 'cancelada');
  raise notice 'TEST 23 OK: admin conserva bypass total en todo el ciclo.';
end $$;

-- =========================================================================
-- SEGURIDAD — CROSS-ORG (tests 24-27)
-- =========================================================================

-- El preparer (Org 1) intenta operar sobre el Pedido/PO de Org B.
select test_set_user(:'preparer');

-- TEST 24: cross-org create bloqueado (Pedido de Org B).
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', current_setting('test.orgb_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.orgb_order_item0045_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 24 FALLÓ: preparer de Org 1 no debía poder crear una PO sobre un Pedido de Org B'; end if;
  raise notice 'TEST 24 OK: cross-org create bloqueado.';
end $$;

-- TEST 25: cross-org update details bloqueado (PO real de Org B).
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_details(current_setting('test.orgb_po0045_id')::uuid, jsonb_build_object('notes', 'intento cross-org'));
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 25 FALLÓ: preparer de Org 1 no debía poder editar detalles de una PO de Org B'; end if;
  raise notice 'TEST 25 OK: cross-org update details bloqueado.';
end $$;

-- TEST 26: cross-org edit items bloqueado (PO real de Org B).
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_replace_purchase_order_items(
      current_setting('test.orgb_po0045_id')::uuid,
      jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.orgb_order_item0045_id')::uuid, 'quantity_ordered', 1))
    );
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 26 FALLÓ: preparer de Org 1 no debía poder reemplazar partidas de una PO de Org B'; end if;
  raise notice 'TEST 26 OK: cross-org edit items bloqueado.';
end $$;

-- TEST 27: cross-org status bloqueado (con approver, PO real de Org B).
select test_set_user(:'approver');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_update_purchase_order_status(current_setting('test.orgb_po0045_id')::uuid, 'ordenada');
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 27 FALLÓ: approver de Org 1 no debía poder cambiar el estado de una PO de Org B'; end if;
  raise notice 'TEST 27 OK: cross-org status bloqueado.';
end $$;

select test_set_user(:'admin');

-- =========================================================================
-- INTEGRIDAD (tests 28-30)
-- =========================================================================

-- TEST 28: el Pedido origen permanece intacto al crear una PO (preparer,
-- sin autoridad comercial general). test_set_user() se llama AFUERA del
-- do $$ ... $$ — la sustitución de variables psql `:'var'` no funciona
-- dentro de un bloque do (lección ya conocida de este proyecto).
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0045_id')::uuid;
begin
  perform set_config('test.order28_client_before', (select client_name from orders where id = v_order_id), false);
  perform set_config('test.order28_sp_before', (select salesperson_id::text from orders where id = v_order_id), false);
end $$;
select test_set_user(:'preparer');
select rpc_create_purchase_order(
  gen_random_uuid(),
  jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
  jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 1))
);
select test_set_user(:'admin');
do $$
declare
  v_order_id uuid := current_setting('test.ajeno_order0045_id')::uuid;
  v_client_before text := current_setting('test.order28_client_before');
  v_sp_before uuid := current_setting('test.order28_sp_before')::uuid;
  v_client_after text;
  v_salesperson_after uuid;
begin
  select client_name, salesperson_id into v_client_after, v_salesperson_after from orders where id = v_order_id;
  if v_client_before is distinct from v_client_after or v_sp_before is distinct from v_salesperson_after then
    raise exception 'TEST 28 FALLÓ: el Pedido origen cambió al crear una Purchase Order';
  end if;
  raise notice 'TEST 28 OK: el Pedido origen permanece intacto.';
end $$;

-- TEST 29: supplier permanece inmutable tras creación (trigger de 0035,
-- sigue aplicando sin excepción, incluso para admin).
do $$
declare
  v_po_id uuid := current_setting('test.po0045_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update purchase_orders set supplier_id = gen_random_uuid() where id = v_po_id;
  exception when others then v_failed := true; end;
  if not v_failed then raise exception 'TEST 29 FALLÓ: el proveedor no debía poder cambiarse tras la creación'; end if;
  raise notice 'TEST 29 OK: supplier permanece inmutable tras creación (trigger 0035 intacto).';
end $$;

-- TEST 30: regresión — la recepción de 0044 sigue funcionando sin cambios
-- (can_receive_inventory sola recibe, sin ninguna interacción con
-- prepare/approve).
select test_set_user(:'receiver_only');
do $$
declare
  v_poi_id uuid := current_setting('test.poi0045d_id')::uuid;
  v_wh_id uuid;
  v_item purchase_order_items;
begin
  select id into v_wh_id from warehouses where name = 'Almacén 0045';
  select * into v_item from rpc_receive_purchase_order_item(v_poi_id, 6, v_wh_id);
  if v_item.quantity_received <> 6 then
    raise exception 'TEST 30 FALLÓ: recepción no se registró correctamente (quantity_received = %)', v_item.quantity_received;
  end if;
  raise notice 'TEST 30 OK: recepción (0044) sigue funcionando sin regresión.';
end $$;

select test_set_user(:'admin');

-- =========================================================================
-- SIN OWNERSHIP DE PURCHASE ORDER (TEST 31) — ACLARACIÓN DE PRODUCTO
-- =========================================================================
-- can_prepare_purchase_orders NO depende de haber sido quien creó la PO.
-- Preparador A crea un borrador; Preparador B (mismo capability + misma
-- visibilidad, pero SIN relación con la creación de esa PO) la edita y la
-- cancela sin ningún problema — la autoridad es la capability + status,
-- nunca "quién la creó". Esto ya era el comportamiento real de 0045 (no
-- existe ninguna columna ni chequeo de creador/dueño de Purchase Order en
-- ningún RPC ni policy) — este test lo deja demostrado explícitamente.
insert into user_capabilities (organization_id, user_id, capability, active, granted_by_user_id)
  select org1, :'preparer_b', unnest(array['can_prepare_purchase_orders', 'can_view_all_sales']), true, :'admin' from _ids
  on conflict (organization_id, user_id, capability) do update set active = true;

select test_set_user(:'preparer');
do $$
declare v_po purchase_orders;
begin
  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', current_setting('test.ajeno_order0045_id')::uuid, 'supplier_id', current_setting('test.supplier0045_id')::uuid, 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', current_setting('test.order_item_a_id')::uuid, 'quantity_ordered', 3))
  );
  perform set_config('test.po0045_noownership_id', v_po.id::text, false);
end $$;

select test_set_user(:'preparer_b');
do $$
declare
  v_po_id uuid := current_setting('test.po0045_noownership_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_details(v_po_id, jsonb_build_object('notes', 'editado por preparer_b, ajeno a la creación'));
  if v_po.notes <> 'editado por preparer_b, ajeno a la creación' then
    raise exception 'TEST 31 FALLÓ: preparer_b no pudo editar el borrador de preparer_a';
  end if;

  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'cancelada');
  if v_po.status <> 'cancelada' then
    raise exception 'TEST 31 FALLÓ: preparer_b no pudo cancelar el borrador de preparer_a';
  end if;

  raise notice 'TEST 31 OK: preparer_b (sin relación de creación) edita y cancela el borrador de preparer_a — can_prepare_purchase_orders NO depende de ownership de la PO.';
end $$;

select test_set_user(:'admin');

do $$ begin raise notice '=== 0045: 31/31 TESTS OK ==='; end $$;

rollback;
