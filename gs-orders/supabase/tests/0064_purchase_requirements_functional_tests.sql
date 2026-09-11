-- THÖREN — Fase 9 / Block 1 (0064_purchase_requirements.sql), incluyendo
-- la aclaración de cierre (GAP 1: multi-almacén, GAP 2: procurement sync
-- visible/idempotente) — pruebas funcionales contra Postgres real.
-- Fixtures 100% autocontenidas en este archivo — no depende de la cadena
-- de fixtures de fases anteriores. Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

insert into auth.users (id, email) values
  (:'admin', 'admin-9@test.local'),
  (:'admin_orgb', 'admin-orgb-9@test.local');

insert into organizations (id, name, slug) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Org 9', 'test-org-9'),
  ('00000000-0000-0000-0000-0000000000a2', 'Test Org 9B', 'test-org-9b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test', 'admin', true),
  (:'admin_orgb', 'Admin Org B', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  ('00000000-0000-0000-0000-0000000000a1', :'admin', 'admin', true),
  ('00000000-0000-0000-0000-0000000000a2', :'admin_orgb', 'admin', true);

set role authenticated;
select test_set_user(:'admin');

insert into salespeople (id, name, prefix, active) values ('00000000-0000-0000-0000-0000000000b1', 'Vend Test 9', 'VT9', true);
insert into product_catalog (id, organization_id, name, sku, category, active) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Producto A', 'SKU-A9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Producto B', 'SKU-B9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'Producto C (8=4+4)', 'SKU-C9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000a1', 'Producto D (12=5+4+1)', 'SKU-D9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000a1', 'Producto E (reduce multi-wh)', 'SKU-E9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000a1', 'Producto F (cancel multi-wh)', 'SKU-F9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-0000000000a1', 'Producto G (cross-org warehouse)', 'SKU-G9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000a1', 'Producto H (sync fallido)', 'SKU-H9', 'general', true),
  ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000a1', 'Producto I (sync fallido / stock aparece)', 'SKU-I9', 'general', true),
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000a1', 'Producto J (stock desaparece)', 'SKU-J9', 'general', true);
insert into warehouses (id, organization_id, name, code, active) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Almacen 1', 'ALM19', true),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', 'Almacen 2', 'ALM29', true),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', 'Almacen 3', 'ALM39', true);
insert into suppliers (id, organization_id, name, active) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000a1', 'Proveedor X', true);

-- Segundo vendedor de Org A (no admin, no dueño de los pedidos de prueba)
-- para TEST G8: forzar un fallo REAL de permisos dentro de
-- rpc_sync_order_procurement (no simulado con un mock).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000002', 'vendedor2-9@test.local');
insert into salespeople (id, name, prefix, active) values ('00000000-0000-0000-0000-0000000000b2', 'Vend Dos 9', 'VT92', true);
insert into user_profiles (user_id, name, role, salesperson_id, active)
  values ('00000000-0000-0000-0000-000000000002', 'Vendedor Dos', 'vendedor', '00000000-0000-0000-0000-0000000000b2', true);
insert into organization_members (organization_id, user_id, role, active) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'vendedor', true);

select test_set_user(:'admin_orgb');
insert into salespeople (id, name, prefix, active) values ('00000000-0000-0000-0000-0000000000b9', 'Vend Org B', 'VOB9', true);
select test_set_user(:'admin');

-- =========================================================================
-- TEST 1: item sin catalog_product_id — el motor lo omite por completo
-- (nunca genera requirement, nunca lo cuenta como shortage).
-- =========================================================================
do $$
declare v_order_id uuid;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T1', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Pieza manual sin catalogo', 'quantity', 10))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  if exists (select 1 from fn_order_product_shortage(v_order_id)) then
    raise exception 'TEST 1 FALLO: un item sin catalog_product_id no deberia aparecer en fn_order_product_shortage';
  end if;

  perform rpc_sync_order_procurement(v_order_id);
  if exists (select 1 from purchase_requirements where order_id = v_order_id) then
    raise exception 'TEST 1 FALLO: no debio crearse ningun purchase_requirement para una partida sin catalogo';
  end if;
  raise notice 'TEST 1 OK: partida manual/no catalogada omitida por completo del motor de shortage';
end $$;

-- =========================================================================
-- TEST 2-7: caso obligatorio de la aclaracion previa — dos partidas del
-- MISMO producto (5 + 7 = 12), stock 4. Cubre: agregacion correcta (2),
-- stock compartido (3), shortage total (4), sin doble reserva/compra (5),
-- creacion idempotente (6), recalculo no duplica (7).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_shortage record;
  v_reservation_count integer;
  v_reservation_qty integer;
  v_requirement_count integer;
  v_requirement_id uuid;
  v_required_qty integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T2-7', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('model', 'Producto A', 'quantity', 5, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'),
      jsonb_build_object('model', 'Producto A', 'quantity', 7, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1')
    )
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
    'product_id', '00000000-0000-0000-0000-0000000000c1', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1',
    'movement_type', 'entrada_manual', 'quantity', 4
  ));

  select * into v_shortage from fn_order_product_shortage(v_order_id);
  if v_shortage.requested_qty <> 12 then raise exception 'TEST 2 FALLO: requested_qty deberia ser 12 (5+7), fue %', v_shortage.requested_qty; end if;
  if v_shortage.available_qty <> 4 then raise exception 'TEST 3 FALLO: available_qty deberia ser 4, fue %', v_shortage.available_qty; end if;
  if v_shortage.shortage_qty <> 8 then raise exception 'TEST 4 FALLO: shortage_qty deberia ser 8 (12-4), fue %', v_shortage.shortage_qty; end if;
  raise notice 'TEST 2 OK: requested_qty agregado correctamente = 12 (una sola fila, no una por partida)';
  raise notice 'TEST 3 OK: available_qty = 4, compartido entre ambas partidas (no contado dos veces)';
  raise notice 'TEST 4 OK: shortage_qty total = 8';

  perform rpc_sync_order_procurement(v_order_id);

  select count(*), sum(quantity) into v_reservation_count, v_reservation_qty
    from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_count <> 1 or v_reservation_qty <> 4 then
    raise exception 'TEST 5 FALLO: deberia existir UNA sola reserva de 4 (no una por partida), hubo % filas por % total', v_reservation_count, v_reservation_qty;
  end if;

  select count(*) into v_requirement_count from purchase_requirements where order_id = v_order_id;
  if v_requirement_count <> 1 then
    raise exception 'TEST 5 FALLO: deberia existir UN solo purchase_requirement (no uno por partida), hubo %', v_requirement_count;
  end if;
  select id, required_qty into v_requirement_id, v_required_qty from purchase_requirements where order_id = v_order_id;
  if v_required_qty <> 8 then
    raise exception 'TEST 5 FALLO: required_qty deberia ser 8, fue %', v_required_qty;
  end if;
  raise notice 'TEST 5 OK: una sola reserva (qty=4) y un solo requirement (qty=8) — cero doble compra';

  if (select count(*) from purchase_requirement_source_items where purchase_requirement_id = v_requirement_id) <> 2 then
    raise exception 'TEST 5 FALLO: deberian existir 2 filas de trazabilidad (una por partida origen)';
  end if;
  if (select sum(requested_qty) from purchase_requirement_source_items where purchase_requirement_id = v_requirement_id) <> 12 then
    raise exception 'TEST 5 FALLO: la suma de trazabilidad deberia ser 12 (5+7)';
  end if;

  perform rpc_sync_order_procurement(v_order_id);
  perform rpc_sync_order_procurement(v_order_id);

  select count(*), sum(quantity) into v_reservation_count, v_reservation_qty
    from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_count <> 1 or v_reservation_qty <> 4 then
    raise exception 'TEST 6 FALLO: recalcular no debe duplicar/ajustar la reserva (esperado 1 fila de 4, hubo % de %)', v_reservation_count, v_reservation_qty;
  end if;

  select count(*) into v_requirement_count from purchase_requirements where order_id = v_order_id;
  if v_requirement_count <> 1 then
    raise exception 'TEST 7 FALLO: recalcular no debe duplicar el purchase_requirement, hubo %', v_requirement_count;
  end if;
  if (select id from purchase_requirements where order_id = v_order_id) <> v_requirement_id then
    raise exception 'TEST 7 FALLO: recalcular deberia reutilizar el MISMO requirement_id, no crear uno nuevo';
  end if;
  raise notice 'TEST 6 OK: creacion de requirement/reserva es idempotente (2 recalculos extra, sin cambios)';
  raise notice 'TEST 7 OK: recalcular reutiliza el mismo requirement_id, nunca duplica';
end $$;

-- =========================================================================
-- TEST 8: reducir el Pedido ajusta el requirement hacia abajo.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item1_id uuid;
  v_required_before integer;
  v_required_after integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T8', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A', 'quantity', 20, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_sync_order_procurement(v_order_id);
  select required_qty into v_required_before from purchase_requirements where order_id = v_order_id;

  select id into v_item1_id from order_items where order_id = v_order_id limit 1;
  perform rpc_update_order(
    v_order_id,
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T8', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A', 'quantity', 6, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
  );

  perform rpc_sync_order_procurement(v_order_id);
  select required_qty into v_required_after from purchase_requirements where order_id = v_order_id;

  if v_required_after is not null and v_required_before is not null and v_required_after >= v_required_before then
    raise exception 'TEST 8 FALLO: reducir el Pedido (20->6) deberia reducir required_qty (antes %, despues %)', v_required_before, v_required_after;
  end if;
  raise notice 'TEST 8 OK: reducir el Pedido ajusta el requirement hacia abajo (antes %, despues %)', v_required_before, v_required_after;
end $$;

-- =========================================================================
-- TEST 9: cancelar el Pedido cancela sus requirements abiertos (nunca los
-- borra) y NO cancela ninguna PO ya creada. rpc_sync_order_procurement es
-- ahora el ÚNICO punto de entrada (reemplaza a
-- rpc_cancel_purchase_requirements_for_order).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_status text;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T9', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto B', 'quantity', 15, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_sync_order_procurement(v_order_id);
  if not exists (select 1 from purchase_requirements where order_id = v_order_id and status = 'open') then
    raise exception 'TEST 9 FALLO: precondicion — deberia existir un requirement open antes de cancelar';
  end if;

  update orders set status = 'cancelado' where id = v_order_id;
  perform rpc_sync_order_procurement(v_order_id);

  select status into v_status from purchase_requirements where order_id = v_order_id;
  if v_status <> 'cancelled' then
    raise exception 'TEST 9 FALLO: el requirement deberia quedar cancelled, quedo %', v_status;
  end if;
  if not exists (select 1 from purchase_requirements where order_id = v_order_id) then
    raise exception 'TEST 9 FALLO: cancelar NUNCA debe borrar la fila (se conserva para auditoria)';
  end if;
  raise notice 'TEST 9 OK: cancelar el Pedido deja el requirement en cancelled, sin borrarlo';
end $$;

-- =========================================================================
-- TEST 10: requirements de DOS Pedidos distintos hacia el MISMO proveedor
-- no pueden mezclarse en una sola PO (limitacion estructural aprobada).
-- =========================================================================
do $$
declare
  v_order_a uuid;
  v_order_b uuid;
  v_item_b uuid;
  v_failed boolean := false;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T10-A', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A', 'quantity', 3, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
  )).id into v_order_a;
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T10-B', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A', 'quantity', 4, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
  )).id into v_order_b;
  select id into v_item_b from order_items where order_id = v_order_b limit 1;

  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_a, 'supplier_id', '00000000-0000-0000-0000-0000000000f9', 'po_date', '2026-09-11'),
      jsonb_build_array(jsonb_build_object('order_item_id', v_item_b, 'quantity_ordered', 4))
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 10 FALLO: deberia rechazarse mezclar una partida del Pedido B en una PO del Pedido A';
  end if;
  raise notice 'TEST 10 OK: dos Pedidos del mismo proveedor NO pueden compartir una sola PO (requiere una PO por Pedido) — limitacion aprobada, confirmada por la propia RPC existente';
end $$;

-- =========================================================================
-- TEST 11: mismo Pedido + mismo proveedor SI puede agrupar varias
-- necesidades (productos distintos) en una sola PO.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_a uuid;
  v_item_b uuid;
  v_po_id uuid;
  v_item_count integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T11', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('model', 'Producto A', 'quantity', 3, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'),
      jsonb_build_object('model', 'Producto B', 'quantity', 2, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c2')
    )
  )).id into v_order_id;
  select id into v_item_a from order_items where order_id = v_order_id and catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  select id into v_item_b from order_items where order_id = v_order_id and catalog_product_id = '00000000-0000-0000-0000-0000000000c2';

  select (rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', '00000000-0000-0000-0000-0000000000f9', 'po_date', '2026-09-11'),
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_a, 'quantity_ordered', 3),
      jsonb_build_object('order_item_id', v_item_b, 'quantity_ordered', 2)
    )
  )).id into v_po_id;

  select count(*) into v_item_count from purchase_order_items where purchase_order_id = v_po_id;
  if v_item_count <> 2 then
    raise exception 'TEST 11 FALLO: la PO deberia agrupar las 2 necesidades (productos distintos) del mismo Pedido, tuvo %', v_item_count;
  end if;
  raise notice 'TEST 11 OK: mismo Pedido + mismo proveedor agrupa varias necesidades en una sola PO';
end $$;

-- =========================================================================
-- TEST 12: cross-org isolation — el admin de Org B no ve ni puede
-- manipular los purchase_requirements/reservations de Org A.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_requirement_id uuid;
  v_visible_count integer;
  v_failed boolean := false;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'T12', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A', 'quantity', 9, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c1'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;
  perform rpc_sync_order_procurement(v_order_id);
  select id into v_requirement_id from purchase_requirements where order_id = v_order_id;

  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_visible_count from purchase_requirements where id = v_requirement_id;
  if v_visible_count <> 0 then
    raise exception 'TEST 12 FALLO: el admin de Org B no deberia poder ver un purchase_requirement de Org A (RLS)';
  end if;

  begin
    perform rpc_allocate_purchase_requirement(v_requirement_id, gen_random_uuid(), 1);
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 12 FALLO: el admin de Org B no deberia poder asignar un requirement de Org A';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 12 OK: aislamiento cross-org — Org B no ve ni puede manipular requirements de Org A';
end $$;

-- =========================================================================
-- TEST 13: suppliers.preferred_document_language (Parte H) — CHECK
-- constraint solo admite es/en/null, mismo criterio que 0063.
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    insert into suppliers (organization_id, name, preferred_document_language)
      values ('00000000-0000-0000-0000-0000000000a1', 'Proveedor idioma invalido', 'fr');
  exception when others then v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 13 FALLO: el CHECK deberia rechazar un idioma distinto de es/en';
  end if;

  update suppliers set preferred_document_language = 'en' where id = '00000000-0000-0000-0000-0000000000f9';
  if (select preferred_document_language from suppliers where id = '00000000-0000-0000-0000-0000000000f9') <> 'en' then
    raise exception 'TEST 13 FALLO: preferred_document_language=en deberia aceptarse';
  end if;
  raise notice 'TEST 13 OK: suppliers.preferred_document_language solo admite es/en/null';
end $$;

-- =========================================================================
-- GAP 1 — TEST G1: Pedido 8, WH A=4 + WH B=4 → reserve 8 en 2 filas,
-- shortage 0, sin purchase requirement (caso obligatorio de la
-- aclaración de cierre).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_reservation_count integer;
  v_reservation_total integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G1', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto C', 'quantity', 8, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c3'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c3', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1', 'movement_type', 'entrada_manual', 'quantity', 4));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c3', 'warehouse_id', '00000000-0000-0000-0000-0000000000d2', 'movement_type', 'entrada_manual', 'quantity', 4));

  perform rpc_sync_order_procurement(v_order_id);

  select count(*), coalesce(sum(quantity), 0) into v_reservation_count, v_reservation_total
    from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_count <> 2 or v_reservation_total <> 8 then
    raise exception 'TEST G1 FALLO: esperaba 2 filas de reserva sumando 8 (uno por almacen), hubo % filas por % total', v_reservation_count, v_reservation_total;
  end if;
  if exists (select 1 from purchase_requirements where order_id = v_order_id) then
    raise exception 'TEST G1 FALLO: 4+4=8 cubre exactamente el Pedido de 8 — no deberia existir ningun purchase_requirement';
  end if;
  raise notice 'TEST G1 OK: Pedido 8 con stock fragmentado 4+4 se reserva completo entre 2 almacenes, shortage 0';
end $$;

-- =========================================================================
-- GAP 1 — TEST G2: Pedido 12, WH A=5 + WH B=4 + WH C=1 (total 10) →
-- reserve 10 en 3 filas, shortage 2 (caso obligatorio de la aclaración).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_reservation_count integer;
  v_reservation_total integer;
  v_required_qty integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G2', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto D', 'quantity', 12, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c4'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c4', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1', 'movement_type', 'entrada_manual', 'quantity', 5));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c4', 'warehouse_id', '00000000-0000-0000-0000-0000000000d2', 'movement_type', 'entrada_manual', 'quantity', 4));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c4', 'warehouse_id', '00000000-0000-0000-0000-0000000000d3', 'movement_type', 'entrada_manual', 'quantity', 1));

  perform rpc_sync_order_procurement(v_order_id);

  select count(*), coalesce(sum(quantity), 0) into v_reservation_count, v_reservation_total
    from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_count <> 3 or v_reservation_total <> 10 then
    raise exception 'TEST G2 FALLO: esperaba 3 filas de reserva sumando 10 (5+4+1), hubo % filas por % total', v_reservation_count, v_reservation_total;
  end if;
  select required_qty into v_required_qty from purchase_requirements where order_id = v_order_id;
  if v_required_qty <> 2 then
    raise exception 'TEST G2 FALLO: shortage/required_qty esperado 2 (12-10), fue %', v_required_qty;
  end if;
  raise notice 'TEST G2 OK: Pedido 12 con stock fragmentado 5+4+1=10 reserva 10 entre 3 almacenes, shortage 2 (nunca 7 por elegir solo el mejor)';

  -- G3: recalcular no duplica las reservas multi-almacen.
  perform rpc_sync_order_procurement(v_order_id);
  select count(*), coalesce(sum(quantity), 0) into v_reservation_count, v_reservation_total
    from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_count <> 3 or v_reservation_total <> 10 then
    raise exception 'TEST G3 FALLO: recalcular no debe duplicar reservas multi-almacen, quedo en % filas por % total', v_reservation_count, v_reservation_total;
  end if;
  raise notice 'TEST G3 OK: recalcular no duplica reservas cuando hay varios almacenes involucrados';
end $$;

-- =========================================================================
-- GAP 1 — TEST G4: reducir la demanda del Pedido libera el exceso
-- correctamente cuando la reserva estaba repartida entre VARIOS
-- almacenes.
--
-- NOTA DE DISEÑO: rpc_update_order (0049, fase cerrada, no se toca) YA
-- bloquea explícitamente bajar order_items.quantity por debajo de lo que
-- ese producto tiene reservado ("libera o ajusta la reserva antes de
-- bajar la cantidad") — comprobado al escribir este test. Eso significa
-- que hoy NO existe un camino de aplicación real para que
-- rpc_sync_order_procurement necesite encoger una reserva ya hecha vía
-- edición de Pedido (0049 obliga a liberar la reserva ANTES, momento en
-- el cual ya no habría nada que encoger). El motor de "shrink" de
-- rpc_sync_order_procurement sigue siendo código defensivo correcto (por
-- si 0049 cambia, o por otro camino futuro) — este test lo ejercita
-- directamente vía un UPDATE crudo de order_items.quantity (bypass
-- deliberado de rpc_update_order, que es exactamente la única pieza que
-- bloquearía este escenario) para probar el ALGORITMO en sí mismo, sin
-- pretender que hoy exista un botón de UI que llegue aquí así.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_item_id uuid;
  v_reservation_total integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G4', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto E', 'quantity', 10, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c5'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c5', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1', 'movement_type', 'entrada_manual', 'quantity', 5));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c5', 'warehouse_id', '00000000-0000-0000-0000-0000000000d2', 'movement_type', 'entrada_manual', 'quantity', 4));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c5', 'warehouse_id', '00000000-0000-0000-0000-0000000000d3', 'movement_type', 'entrada_manual', 'quantity', 1));

  perform rpc_sync_order_procurement(v_order_id);
  select coalesce(sum(quantity), 0) into v_reservation_total from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_total <> 10 then
    raise exception 'TEST G4 FALLO: precondicion — deberia haber reservado 10 (5+4+1) antes de reducir, hubo %', v_reservation_total;
  end if;

  select id into v_item_id from order_items where order_id = v_order_id limit 1;
  update order_items set quantity = 3 where id = v_item_id;
  perform rpc_sync_order_procurement(v_order_id);

  select coalesce(sum(quantity), 0) into v_reservation_total from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_total <> 3 then
    raise exception 'TEST G4 FALLO: reducir la demanda (10->3) deberia dejar exactamente 3 reservados en total (a traves de los almacenes que sea), quedo en %', v_reservation_total;
  end if;
  if exists (select 1 from purchase_requirements where order_id = v_order_id and status <> 'cancelled') then
    raise exception 'TEST G4 FALLO: 3 <= 10 de on_hand — no deberia quedar ningun requirement abierto';
  end if;
  raise notice 'TEST G4 OK: reducir la demanda libera el exceso correctamente a traves de multiples almacenes (10 -> 3)';
end $$;

-- =========================================================================
-- GAP 1 — TEST G5: cancelar el Pedido libera TODAS sus reservas activas,
-- sin importar en cuantos almacenes esten repartidas.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_active_count integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G5', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto F', 'quantity', 8, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c6'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c6', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1', 'movement_type', 'entrada_manual', 'quantity', 4));
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object('product_id', '00000000-0000-0000-0000-0000000000c6', 'warehouse_id', '00000000-0000-0000-0000-0000000000d2', 'movement_type', 'entrada_manual', 'quantity', 4));
  perform rpc_sync_order_procurement(v_order_id);

  if (select count(*) from inventory_reservations where order_id = v_order_id and released_at is null) <> 2 then
    raise exception 'TEST G5 FALLO: precondicion — deberian existir 2 reservas activas (una por almacen) antes de cancelar';
  end if;

  update orders set status = 'cancelado' where id = v_order_id;
  perform rpc_sync_order_procurement(v_order_id);

  select count(*) into v_active_count from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_active_count <> 0 then
    raise exception 'TEST G5 FALLO: cancelar deberia liberar TODAS las reservas activas (cualquier almacen), quedaron % activas', v_active_count;
  end if;
  raise notice 'TEST G5 OK: cancelar libera las reservas activas en TODOS los almacenes involucrados';
end $$;

-- =========================================================================
-- GAP 1 — TEST G6: un almacen de OTRA organizacion nunca participa en el
-- reparto, aunque (por error o corrupcion de datos) exista un movimiento
-- de inventario apuntando a el.
-- =========================================================================
\set orgb_warehouse '00000000-0000-0000-0000-00000000ee01'

-- Setup con privilegio elevado (reset role): tanto "un almacen de Org B"
-- como "un inventory_movement de Org A apuntando a un almacen de Org B"
-- no son alcanzables por ningun flujo normal de la app (RLS/RPCs ya lo
-- impiden en ambos sentidos) — se insertan directo para probar que,
-- incluso ante datos corruptos/inconsistentes, fn_order_product_shortage/
-- rpc_sync_order_procurement JAMAS usan un almacen fuera de la
-- organizacion del Pedido (el filtro w.organization_id = v_organization_id
-- es la unica defensa real en ese caso).
reset role;
insert into warehouses (id, organization_id, name, code, active)
  values (:'orgb_warehouse', '00000000-0000-0000-0000-0000000000a2', 'Almacen Org B', 'ALMB-ORGB', true);
insert into inventory_movements (organization_id, product_id, warehouse_id, quantity_delta, movement_type, created_by_user_id, created_by_name)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c7', :'orgb_warehouse', 100, 'entrada_manual', '00000000-0000-0000-0000-000000000001', 'Admin Test');
set role authenticated;
select test_set_user('00000000-0000-0000-0000-000000000001');

do $$
declare
  v_order_id uuid;
  v_shortage record;
  v_reservation_total integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G6', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto G', 'quantity', 5, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c7'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  select * into v_shortage from fn_order_product_shortage(v_order_id);
  if v_shortage.on_hand_qty <> 0 then
    raise exception 'TEST G6 FALLO: on_hand_qty no deberia contar stock de un almacen de OTRA organizacion, fue %', v_shortage.on_hand_qty;
  end if;
  if v_shortage.shortage_qty <> 5 then
    raise exception 'TEST G6 FALLO: shortage deberia ser 5 (el almacen de Org B no cuenta), fue %', v_shortage.shortage_qty;
  end if;

  perform rpc_sync_order_procurement(v_order_id);
  select coalesce(sum(quantity), 0) into v_reservation_total from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reservation_total <> 0 then
    raise exception 'TEST G6 FALLO: no deberia haberse reservado nada desde un almacen de otra organizacion, se reservo %', v_reservation_total;
  end if;
  raise notice 'TEST G6 OK: un almacen de otra organizacion nunca participa en disponibilidad ni reserva';
end $$;

-- =========================================================================
-- GAP 2 — TEST G7: confirmacion normal deja procurement_sync_status='ok'
-- y crea el requirement correcto.
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_sync_status text;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G7', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto H', 'quantity', 6, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c8'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_sync_order_procurement(v_order_id);
  select procurement_sync_status into v_sync_status from orders where id = v_order_id;
  if v_sync_status <> 'ok' then
    raise exception 'TEST G7 FALLO: procurement_sync_status deberia ser ok tras una sincronizacion exitosa, fue %', v_sync_status;
  end if;
  if not exists (select 1 from purchase_requirements where order_id = v_order_id and required_qty = 6) then
    raise exception 'TEST G7 FALLO: deberia existir un requirement de 6 (sin stock)';
  end if;
  raise notice 'TEST G7 OK: confirmacion normal crea el requirement y deja procurement_sync_status=ok';
end $$;

-- =========================================================================
-- GAP 2 — TEST G8: un fallo REAL (no simulado con un mock) dentro de
-- rpc_sync_order_procurement no deja NADA a medias — la transaccion de
-- esa llamada se revierte por completo. Se fuerza con un usuario sin
-- permiso para reservar sobre este Pedido (vendedor2, no es dueno ni
-- admin ni tiene can_reserve_inventory).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_failed boolean := false;
  v_msg text;
  v_requirement_before_count integer;
  v_reservation_before_count integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G8', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto I', 'quantity', 4, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c9'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  select count(*) into v_requirement_before_count from purchase_requirements where order_id = v_order_id;
  select count(*) into v_reservation_before_count from inventory_reservations where order_id = v_order_id;

  perform test_set_user('00000000-0000-0000-0000-000000000002');
  begin
    perform rpc_sync_order_procurement(v_order_id);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if not v_failed then
    raise exception 'TEST G8 FALLO: un vendedor sin permiso sobre este Pedido no deberia poder sincronizar procurement';
  end if;
  if v_msg !~ 'permiso' then
    raise exception 'TEST G8 FALLO: el mensaje de error deberia mencionar el permiso denegado (%)', v_msg;
  end if;

  -- Nada debe haber quedado a medias: mismo estado que antes del intento.
  if (select count(*) from purchase_requirements where order_id = v_order_id) <> v_requirement_before_count then
    raise exception 'TEST G8 FALLO: no debe quedar ningun purchase_requirement parcial tras el fallo';
  end if;
  if (select count(*) from inventory_reservations where order_id = v_order_id) <> v_reservation_before_count then
    raise exception 'TEST G8 FALLO: no debe quedar ninguna reserva parcial tras el fallo';
  end if;
  raise notice 'TEST G8 OK: un fallo real dentro de rpc_sync_order_procurement revierte TODO (nada queda a medias, nada silencioso) — %', v_msg;

  -- =======================================================================
  -- GAP 2 — TEST G9/G10: reintentar (como el usuario correcto) corrige el
  -- Pedido, y reintentar de nuevo es idempotente.
  -- =======================================================================
  perform rpc_sync_order_procurement(v_order_id);
  if not exists (select 1 from purchase_requirements where order_id = v_order_id and required_qty = 4) then
    raise exception 'TEST G9 FALLO: el reintento como usuario correcto deberia crear el requirement de 4';
  end if;
  raise notice 'TEST G9 OK: reintentar (recalcular) como el usuario correcto corrige el Pedido tras el fallo';

  perform rpc_sync_order_procurement(v_order_id);
  if (select count(*) from purchase_requirements where order_id = v_order_id) <> 1 then
    raise exception 'TEST G10 FALLO: reintentar de nuevo no debe duplicar el requirement';
  end if;
  raise notice 'TEST G10 OK: el reintento/recalculo es idempotente';
end $$;

-- =========================================================================
-- GAP 2 — TEST G11: si aparece stock suficiente ANTES de crear la PO, el
-- requirement se reduce/cancela correctamente (allocated_qty=0 → se
-- borra, no queda "fantasma").
-- =========================================================================
do $$
declare
  v_order_id uuid;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G11', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto I extra', 'quantity', 4, 'catalog_product_id', '00000000-0000-0000-0000-0000000000c9'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_sync_order_procurement(v_order_id);
  if not exists (select 1 from purchase_requirements where order_id = v_order_id and status <> 'cancelled') then
    raise exception 'TEST G11 FALLO: precondicion — deberia existir un requirement abierto antes de recibir stock';
  end if;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
    'product_id', '00000000-0000-0000-0000-0000000000c9', 'warehouse_id', '00000000-0000-0000-0000-0000000000d1',
    'movement_type', 'entrada_manual', 'quantity', 4
  ));
  perform rpc_sync_order_procurement(v_order_id);

  if exists (select 1 from purchase_requirements where order_id = v_order_id and status <> 'cancelled') then
    raise exception 'TEST G11 FALLO: al aparecer stock suficiente, el requirement (sin allocated_qty) deberia desaparecer, no quedar abierto';
  end if;
  if (select coalesce(sum(quantity), 0) from inventory_reservations where order_id = v_order_id and released_at is null) <> 4 then
    raise exception 'TEST G11 FALLO: el Pedido deberia terminar con 4 reservados tras recibir el stock';
  end if;
  raise notice 'TEST G11 OK: stock suficiente aparecido antes de crear PO cancela/reduce el requirement correctamente';
end $$;

-- =========================================================================
-- GAP 2 — TEST G12: si el stock desaparece DESPUÉS de estar cubierto
-- (ajuste manual negativo), el requirement aumenta/aparece correctamente
-- — sin tocar la reserva ya hecha (esa sigue siendo un compromiso real).
-- =========================================================================
do $$
declare
  v_order_id uuid;
  v_reserved_before integer;
  v_reserved_after integer;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', '2026-09-11', 'client_name', 'G12', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Producto A extra', 'quantity', 10, 'catalog_product_id', '00000000-0000-0000-0000-0000000000ca'))
  )).id into v_order_id;
  update orders set status = 'pedido' where id = v_order_id;

  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
    'product_id', '00000000-0000-0000-0000-0000000000ca', 'warehouse_id', '00000000-0000-0000-0000-0000000000d3',
    'movement_type', 'entrada_manual', 'quantity', 10
  ));
  perform rpc_sync_order_procurement(v_order_id);
  if exists (select 1 from purchase_requirements where order_id = v_order_id and status <> 'cancelled') then
    raise exception 'TEST G12 FALLO: precondicion — con 10 de stock nuevo para 10 solicitados no deberia haber requirement';
  end if;
  select coalesce(sum(quantity), 0) into v_reserved_before from inventory_reservations where order_id = v_order_id and released_at is null;

  -- "Desaparece" stock: ajuste manual negativo (ej. mercancia dañada),
  -- SIN tocar la reserva ya hecha para este Pedido.
  perform rpc_create_inventory_movement(gen_random_uuid(), jsonb_build_object(
    'product_id', '00000000-0000-0000-0000-0000000000ca', 'warehouse_id', '00000000-0000-0000-0000-0000000000d3',
    'movement_type', 'ajuste_negativo', 'quantity', 4
  ));
  perform rpc_sync_order_procurement(v_order_id);

  if not exists (select 1 from purchase_requirements where order_id = v_order_id and status <> 'cancelled' and required_qty = 4) then
    raise exception 'TEST G12 FALLO: al desaparecer 4 unidades de stock, deberia aparecer un requirement de 4';
  end if;
  select coalesce(sum(quantity), 0) into v_reserved_after from inventory_reservations where order_id = v_order_id and released_at is null;
  if v_reserved_after <> v_reserved_before then
    raise exception 'TEST G12 FALLO: la reserva YA HECHA no debe tocarse solo porque el stock fisico bajo despues (antes %, despues %)', v_reserved_before, v_reserved_after;
  end if;
  raise notice 'TEST G12 OK: stock que desaparece despues genera un requirement nuevo sin tocar la reserva ya comprometida (antes % despues %)', v_reserved_before, v_reserved_after;
end $$;

select 'TODAS LAS PRUEBAS 0064 PASARON' as resultado;

rollback;
