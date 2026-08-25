-- THÖREN — Fase 6L: Compras y Proveedores (0035) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0035 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as customer1 from customers where organization_id = :'org1' and name = 'CEMEX' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'customer1'::uuid as customer1,
         '10000000-0000-0000-0000-000000000001'::uuid as salesperson1,
         '10000000-0000-0000-0000-000000000002'::uuid as salesperson2,
         '20000000-0000-0000-0000-000000000001'::uuid as orgb;

-- =========================================================================
-- Fixtures: un proveedor Org B (para las pruebas cross-org) y el Pedido
-- base que usarán la mayoría de las pruebas (2 partidas).
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_orgb uuid;
begin
  select orgb into v_orgb from _ids;
  insert into suppliers (id, organization_id, name, active)
  values ('50000000-0000-0000-0000-00000000000b', v_orgb, 'Proveedor Org B', true)
  on conflict (id) do nothing;
end $$;
select test_set_user(:'admin');

do $$
declare
  v_customer1 uuid; v_salesperson1 uuid;
  v_order orders;
  v_supplier suppliers;
begin
  select customer1, salesperson1 into v_customer1, v_salesperson1 from _ids;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_salesperson1, 'order_date', current_date::text, 'client_name', 'x',
      'product_type', 'otro', 'customer_id', v_customer1
    ),
    jsonb_build_array(
      jsonb_build_object('model', 'PROY-100', 'quantity', 3, 'unit', 'pza', 'customer_requirements', 'IP65'),
      jsonb_build_object('model', 'CABLE-50M', 'quantity', 10, 'unit', 'rollo')
    )
  );
  perform set_config('test.order0035_id', v_order.id::text, false);

  insert into suppliers (organization_id, name, tax_id, contact_name, email, phone, preferred_currency, notes, active)
  values (v_order.organization_id, 'Proveedor Uno SA de CV', 'PUS010101ABC', 'Juan Pérez', 'compras@proveedor1.mx', '8110000000', 'MXN', 'Proveedor confiable', true)
  returning * into v_supplier;
  perform set_config('test.supplier0035_id', v_supplier.id::text, false);

  raise notice 'SETUP OK: Pedido % con 2 partidas, proveedor % creados', v_order.folio, v_supplier.name;
end $$;

-- THÖREN Fase 6M (0036) — rpc_receive_purchase_order_item ahora exige un
-- almacén; se agrega un almacén de fixture aquí para que las pruebas de
-- recepción de ESTA suite (0035) sigan siendo válidas como regresión tras
-- 0036, sin cambiar el alcance de lo que 0035 prueba (Compras/Proveedores).
do $$
declare
  v_org1 uuid; v_warehouse warehouses;
begin
  select org1 into v_org1 from _ids;
  insert into warehouses (organization_id, name, code)
  values (v_org1, 'Almacén de pruebas 0035', 'ALM-0035')
  returning * into v_warehouse;
  perform set_config('test.warehouse0035_id', v_warehouse.id::text, false);
end $$;

-- =========================================================================
-- TEST 1: suppliers — VENDEDOR puede crear (customers_insert_member,
-- mismo criterio que Customers), pero NO editar (solo ADMIN).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_org1 uuid;
  v_id uuid;
  v_rows integer;
begin
  select org1 into v_org1 from _ids;

  insert into suppliers (organization_id, name) values (v_org1, 'Proveedor creado por VENDEDOR')
    returning id into v_id;
  if v_id is null then
    raise exception 'TEST 1 FALLÓ: VENDEDOR debería poder crear un proveedor';
  end if;

  update suppliers set name = 'intento de VENDEDOR' where id = v_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 1 FALLÓ: VENDEDOR no debería poder editar un proveedor (RLS admin-only)';
  end if;

  raise notice 'TEST 1 OK: VENDEDOR crea proveedores, no puede editarlos (RLS)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 2: rpc_create_purchase_order (ADMIN) — folio correcto, snapshot
-- operativo preservado exactamente desde order_items.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0035_id')::uuid;
  v_order_item_id uuid;
  v_po purchase_orders;
  v_poi purchase_order_items;
begin
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'PROY-100';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object(
      'order_id', v_order_id, 'supplier_id', v_supplier_id, 'po_date', current_date::text,
      'supplier_commitment_date', (current_date + 10)::text,
      'estimated_reception_date', (current_date + 15)::text,
      'supplier_reference', 'PO-PROVEEDOR-001', 'notes', 'Urgente'
    ),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 3))
  );

  if v_po.folio !~ '^OC-[0-9]{8}-[0-9]{3}$' then
    raise exception 'TEST 2 FALLÓ: folio con formato inesperado: %', v_po.folio;
  end if;
  if v_po.status <> 'borrador' then
    raise exception 'TEST 2 FALLÓ: una PO recién creada debe nacer en borrador, es %', v_po.status;
  end if;

  select * into v_poi from purchase_order_items where purchase_order_id = v_po.id;
  if v_poi.model <> 'PROY-100' or v_poi.quantity_ordered <> 3 or v_poi.unit <> 'pza'
     or v_poi.customer_requirements <> 'IP65' or v_poi.quantity_received <> 0 then
    raise exception 'TEST 2 FALLÓ: snapshot de la partida no coincide (% % % % %)',
      v_poi.model, v_poi.quantity_ordered, v_poi.unit, v_poi.customer_requirements, v_poi.quantity_received;
  end if;

  perform set_config('test.po0035_id', v_po.id::text, false);
  perform set_config('test.poi0035_id', v_poi.id::text, false);
  raise notice 'TEST 2 OK: rpc_create_purchase_order — folio %, snapshot correcto', v_po.folio;
end $$;

-- =========================================================================
-- TEST 3: rpc_create_purchase_order rechaza proveedor de otra organización.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_order_item_id uuid;
  v_failed boolean := false;
  v_msg text;
begin
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'PROY-100';
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'supplier_id', '50000000-0000-0000-0000-00000000000b'),
      jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 1))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se esperaba rechazo por proveedor de otra organización';
  end if;
  if v_msg not ilike '%proveedor%' then
    raise exception 'TEST 3 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 3 OK: proveedor cross-org rechazado';
end $$;

-- =========================================================================
-- TEST 4: rpc_create_purchase_order rechaza una partida que no pertenece
-- al Pedido de origen indicado.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0035_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id),
      jsonb_build_array(jsonb_build_object('order_item_id', gen_random_uuid(), 'quantity_ordered', 1))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: se esperaba rechazo por partida que no pertenece al Pedido';
  end if;
  if v_msg not ilike '%no pertenece al Pedido de origen%' then
    raise exception 'TEST 4 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 4 OK: partida ajena al Pedido de origen rechazada';
end $$;

-- =========================================================================
-- TEST 5: VENDEDOR no puede crear una Purchase Order (solo ADMIN gestiona).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0035_id')::uuid;
  v_order_item_id uuid;
  v_failed boolean := false;
  v_msg text;
begin
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'CABLE-50M';
  begin
    perform rpc_create_purchase_order(
      gen_random_uuid(),
      jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id),
      jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 5))
    );
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 5 FALLÓ: VENDEDOR no debería poder crear una Purchase Order';
  end if;
  if v_msg not ilike '%administrador%' then
    raise exception 'TEST 5 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 5 OK: VENDEDOR bloqueado al crear Purchase Order';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 6: VENDEDOR dueño del Pedido VE la Purchase Order; VENDEDOR2 (no
-- dueño) NO la ve — visibilidad heredada del Pedido origen, nunca un
-- acceso nuevo (join-inheritance, mismo patrón que 0033).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from purchase_orders where id = v_po_id;
  if v_count <> 1 then
    raise exception 'TEST 6 FALLÓ: VENDEDOR dueño del Pedido debería ver su Purchase Order';
  end if;
  raise notice 'TEST 6 OK (parte 1): VENDEDOR dueño ve la Purchase Order';
end $$;
select test_set_user(:'vendedor2');
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from purchase_orders where id = v_po_id;
  if v_count <> 0 then
    raise exception 'TEST 6 FALLÓ: VENDEDOR2 (no dueño del Pedido) NO debería ver esta Purchase Order';
  end if;
  raise notice 'TEST 6 OK (parte 2): VENDEDOR2 (no dueño) no ve la Purchase Order — sin fuga de acceso';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 7: DECISIÓN ESTRUCTURAL — editar el Pedido origen (rpc_update_order
-- borra y reinserta order_items) NO rompe ni borra la Purchase Order ya
-- creada; su snapshot permanece intacto aunque order_item_id ya no
-- coincida con ninguna fila real de order_items.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_poi_id uuid := current_setting('test.poi0035_id')::uuid;
  v_poi_before purchase_order_items;
  v_poi_after purchase_order_items;
  v_still_valid_fk boolean;
begin
  select * into v_poi_before from purchase_order_items where id = v_poi_id;

  perform rpc_update_order(
    v_order_id,
    jsonb_build_object('client_name', 'x editado', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('model', 'PROY-100', 'quantity', 3, 'unit', 'pza', 'customer_requirements', 'IP65'),
      jsonb_build_object('model', 'CABLE-50M', 'quantity', 10, 'unit', 'rollo')
    )
  );

  select * into v_poi_after from purchase_order_items where id = v_poi_id;
  if v_poi_after.id is null then
    raise exception 'TEST 7 FALLÓ: la partida de la Purchase Order desapareció al editar el Pedido';
  end if;
  if v_poi_after.model <> v_poi_before.model or v_poi_after.quantity_ordered <> v_poi_before.quantity_ordered
     or v_poi_after.unit <> v_poi_before.unit or v_poi_after.customer_requirements <> v_poi_before.customer_requirements then
    raise exception 'TEST 7 FALLÓ: el snapshot de la partida cambió tras editar el Pedido';
  end if;

  select exists(select 1 from order_items where id = v_poi_after.order_item_id) into v_still_valid_fk;
  if v_still_valid_fk then
    raise exception 'TEST 7 FALLÓ (setup): se esperaba que order_item_id ya NO correspondiera a ninguna fila real tras el borra-y-reinserta de rpc_update_order — si esto falla, revisar si rpc_update_order cambió su comportamiento';
  end if;

  raise notice 'TEST 7 OK: editar el Pedido no afecta la Purchase Order — snapshot intacto, order_item_id (informativo, sin FK) queda huérfano sin romper nada';
end $$;

-- =========================================================================
-- TEST 8: recepción — bloqueada mientras la PO está en 'borrador'.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0035_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 1, current_setting('test.warehouse0035_id')::uuid);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 8 FALLÓ: no debería poder recibirse mercancía de una PO en borrador';
  end if;
  if v_msg not ilike '%borrador%' then
    raise exception 'TEST 8 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 8 OK: recepción bloqueada en estado borrador';
end $$;

-- =========================================================================
-- TEST 9: rpc_update_purchase_order_status rechaza asignar manualmente
-- 'recibida'/'recibida_parcial' (solo el motor de recepción los asigna).
-- =========================================================================
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'recibida');
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 9 FALLÓ: no debería poder asignarse "recibida" manualmente';
  end if;
  if v_msg not ilike '%automáticamente%' then
    raise exception 'TEST 9 FALLÓ: mensaje inesperado: %', v_msg;
  end if;
  raise notice 'TEST 9 OK: "recibida"/"recibida_parcial" no son asignables a mano';
end $$;

-- =========================================================================
-- TEST 10: transición manual válida borrador -> ordenada, y edición de
-- detalles (rpc_update_purchase_order_details).
-- =========================================================================
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_po purchase_orders;
begin
  select * into v_po from rpc_update_purchase_order_status(v_po_id, 'ordenada');
  if v_po.status <> 'ordenada' then
    raise exception 'TEST 10 FALLÓ: la PO debería quedar en "ordenada"';
  end if;

  select * into v_po from rpc_update_purchase_order_details(
    v_po_id,
    jsonb_build_object('supplier_reference', 'PO-PROVEEDOR-002', 'notes', 'Actualizado', 'estimated_reception_date', (current_date + 20)::text)
  );
  if v_po.supplier_reference <> 'PO-PROVEEDOR-002' or v_po.notes <> 'Actualizado' then
    raise exception 'TEST 10 FALLÓ: rpc_update_purchase_order_details no actualizó los campos';
  end if;

  raise notice 'TEST 10 OK: transición manual borrador -> ordenada y edición de detalles funcionan';
end $$;

-- =========================================================================
-- TEST 11: recepción parcial -> 'recibida_parcial'; recepción total de
-- todas las partidas -> 'recibida'. Nunca permite recibido > ordenado
-- (RPC y CHECK de la tabla, defensa en profundidad).
-- =========================================================================
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_poi_id uuid := current_setting('test.poi0035_id')::uuid;
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_poi2_id uuid;
  v_po purchase_orders;
  v_failed boolean := false;
begin
  -- Agregar una segunda partida a la misma PO no es parte del alcance de
  -- edición (fuera de esta fase); se usa una segunda Purchase Order propia
  -- para probar el caso "una sola partida, recepción total = recibida" sin
  -- ambigüedad, y la primera PO (con 1 sola partida) para "parcial".
  perform rpc_receive_purchase_order_item(v_poi_id, 1, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po_id;
  if v_po.status <> 'recibida_parcial' then
    raise exception 'TEST 11 FALLÓ: recepción parcial (1 de 3) debería dejar la PO en "recibida_parcial", es %', v_po.status;
  end if;

  begin
    perform rpc_receive_purchase_order_item(v_poi_id, 999, current_setting('test.warehouse0035_id')::uuid);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 11 FALLÓ: no debería permitirse recibir más de lo ordenado';
  end if;

  perform rpc_receive_purchase_order_item(v_poi_id, 3, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po_id;
  if v_po.status <> 'recibida' then
    raise exception 'TEST 11 FALLÓ: recepción total (3 de 3) debería dejar la PO en "recibida", es %', v_po.status;
  end if;

  raise notice 'TEST 11 OK: recepción parcial -> recibida_parcial, total -> recibida, sobre-recepción rechazada';
end $$;

-- =========================================================================
-- TEST 11b (AJUSTE FINAL): corregir la recepción de vuelta a 0 en TODAS
-- las partidas regresa automáticamente al estado operativo manual previo
-- (pre_receiving_status = 'ordenada', fijado en TEST 10) — nunca se queda
-- en 'recibida'/'recibida_parcial' con 0 recibido real, y no requiere
-- intervención manual de un ADMIN.
-- =========================================================================
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_poi_id uuid := current_setting('test.poi0035_id')::uuid;
  v_po purchase_orders;
begin
  -- Corrige un error: la partida en realidad no había llegado.
  perform rpc_receive_purchase_order_item(v_poi_id, 0, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po_id;
  if v_po.status <> 'ordenada' then
    raise exception 'TEST 11b FALLÓ: al corregir la recepción a 0 en todas las partidas, la PO debería volver a "ordenada" (su pre_receiving_status), es %', v_po.status;
  end if;

  -- Vuelve a recibir parcialmente, para que TESTS posteriores encuentren
  -- el mismo estado ("recibida") que antes de este ajuste.
  perform rpc_receive_purchase_order_item(v_poi_id, 3, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po_id;
  if v_po.status <> 'recibida' then
    raise exception 'TEST 11b FALLÓ: al volver a recibir el total, la PO debería quedar en "recibida" otra vez, es %', v_po.status;
  end if;

  raise notice 'TEST 11b OK: corregir recepción a 0 revierte automáticamente a pre_receiving_status (''ordenada''), sin ajuste manual';
end $$;

-- =========================================================================
-- TEST 12: el CHECK de la tabla (defensa en profundidad) rechaza un
-- UPDATE directo que deje quantity_received > quantity_ordered, incluso
-- saltándose la RPC.
-- =========================================================================
do $$
declare
  v_poi_id uuid := current_setting('test.poi0035_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update purchase_order_items set quantity_received = 999 where id = v_poi_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 12 FALLÓ: el CHECK de la tabla debería rechazar quantity_received > quantity_ordered';
  end if;
  raise notice 'TEST 12 OK: CHECK de la tabla rechaza sobre-recepción aunque se evite la RPC';
end $$;

-- =========================================================================
-- TEST 13: recepción y cambio de estado bloqueados en una PO cancelada.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0035_id')::uuid;
  v_order_item_id uuid;
  v_po purchase_orders;
  v_poi purchase_order_items;
  v_failed boolean := false;
begin
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'CABLE-50M';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 10))
  );
  select * into v_poi from purchase_order_items where purchase_order_id = v_po.id;

  perform rpc_update_purchase_order_status(v_po.id, 'cancelada');

  begin
    perform rpc_receive_purchase_order_item(v_poi.id, 1, current_setting('test.warehouse0035_id')::uuid);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 13 FALLÓ: no debería poder recibirse mercancía de una PO cancelada';
  end if;

  v_failed := false;
  begin
    perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 13 FALLÓ: una PO cancelada no debería admitir más cambios de estado (terminal)';
  end if;

  raise notice 'TEST 13 OK: PO cancelada es terminal — sin recepción ni cambios de estado';
end $$;

-- =========================================================================
-- TEST 13b (AJUSTE FINAL): rpc_update_purchase_order_status mantiene
-- pre_receiving_status sincronizado incluso al cambiar de estado MIENTRAS
-- la PO ya está en 'recibida_parcial' (corrección manual de un ADMIN) —
-- si después se corrige la recepción a 0, debe volver al estado manual
-- MÁS RECIENTE ('en_transito'), no al original ('ordenada').
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.order0035_id')::uuid;
  v_supplier_id uuid := current_setting('test.supplier0035_id')::uuid;
  v_order_item_id uuid;
  v_po purchase_orders;
  v_poi purchase_order_items;
begin
  select id into v_order_item_id from order_items where order_id = v_order_id and model = 'CABLE-50M';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', v_supplier_id),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 5))
  );
  select * into v_poi from purchase_order_items where purchase_order_id = v_po.id;

  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  perform rpc_receive_purchase_order_item(v_poi.id, 2, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po.id;
  if v_po.status <> 'recibida_parcial' then
    raise exception 'TEST 13b FALLÓ (setup): se esperaba recibida_parcial, es %', v_po.status;
  end if;

  -- Corrección manual del ADMIN mientras sigue en recibida_parcial.
  perform rpc_update_purchase_order_status(v_po.id, 'en_transito');

  -- Ahora se corrige la recepción a 0 (se detectó que aún no llegaba nada).
  perform rpc_receive_purchase_order_item(v_poi.id, 0, current_setting('test.warehouse0035_id')::uuid);
  select * into v_po from purchase_orders where id = v_po.id;
  if v_po.status <> 'en_transito' then
    raise exception 'TEST 13b FALLÓ: debería volver a "en_transito" (última transición manual), es %', v_po.status;
  end if;

  raise notice 'TEST 13b OK: pre_receiving_status sigue la transición manual más reciente, no solo la original';
end $$;

-- =========================================================================
-- TEST 14: folio/organización/Pedido origen/proveedor son inmutables.
-- =========================================================================
do $$
declare
  v_po_id uuid := current_setting('test.po0035_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update purchase_orders set folio = 'OTRO-FOLIO' where id = v_po_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 14 FALLÓ: el folio de una Purchase Order no debería poder modificarse';
  end if;
  raise notice 'TEST 14 OK: folio inmutable tras la creación';
end $$;

select 'TESTS 1-14 (0035 Compras y Proveedores, Fase 6L) PASARON' as resultado;

rollback;
