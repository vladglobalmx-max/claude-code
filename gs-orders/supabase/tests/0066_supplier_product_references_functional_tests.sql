-- THÖREN — Supplier Product References (0066_supplier_product_references.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback) —
-- repetible. Todo con usuario ADMIN (current_user_is_admin() satisface
-- cualquier rama de autoridad) — las pruebas de capability/permiso de
-- Purchase Orders ya están cubiertas en 0045_functional_tests.sql; aquí
-- el foco es exclusivamente la lógica NUEVA (maestro, snapshot, bloqueo).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c2 '00000000-0000-0000-0000-0000000000c2'
\set c3 '00000000-0000-0000-0000-0000000000c3'
\set sup1 '00000000-0000-0000-0000-0000000000f1'
\set sup2 '00000000-0000-0000-0000-0000000000f2'
\set sup_orgb '00000000-0000-0000-0000-0000000000f9'

insert into auth.users (id, email) values
  (:'admin', 'admin-66@test.local'),
  (:'admin_orgb', 'admin-orgb-66@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 66', 'test-org-66'),
  (:'org_b', 'Test Org 66B', 'test-org-66b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 66', 'admin', true),
  (:'admin_orgb', 'Admin Org B 66', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

set role authenticated;
select test_set_user(:'admin');

insert into salespeople (id, name, prefix, active) values (:'sp1', 'Vend Test 66', 'VT66', true);

insert into product_catalog (id, organization_id, name, sku, category, active) values
  (:'c1', :'org_a', 'Luz LED Grua Viajera Roja 66', 'TLLTPB140R-66', 'general', true),
  (:'c2', :'org_a', 'Producto sin referencia 66', 'SKU-C2-66', 'general', true),
  (:'c3', :'org_a', 'Producto con referencia inactiva 66', 'SKU-C3-66', 'general', true);

insert into suppliers (id, organization_id, name, active) values
  (:'sup1', :'org_a', 'Top Tree', true),
  (:'sup2', :'org_a', 'Proveedor B', true);

select test_set_user(:'admin_orgb');
insert into suppliers (id, organization_id, name, active) values (:'sup_orgb', :'org_b', 'Proveedor Org B', true);
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: insertar una referencia normal.
-- =========================================================================
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, preferred, active)
values (:'c1', :'sup1', 'P7075R', 'P7075R', true, true);
select 'TEST 1 OK: referencia normal insertada' as resultado;

-- =========================================================================
-- TEST 2: 1 producto -> N proveedores.
-- =========================================================================
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, active)
values (:'c1', :'sup2', 'ABC-140-R', 'ABC-140-R', true);
do $$
declare v_count integer;
begin
  select count(*) into v_count from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 2 then
    raise exception 'TEST 2 FALLO: se esperaban 2 proveedores para c1, hubo %', v_count;
  end if;
  raise notice 'TEST 2 OK: 1 producto -> 2 proveedores soportado (Top Tree + Proveedor B)';
end $$;

-- =========================================================================
-- TEST 3: UNIQUE (catalog_product_id, supplier_id).
-- =========================================================================
do $$
begin
  begin
    insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku)
      values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1', 'DUPLICADO');
    raise exception 'TEST 3 FALLO: debio rechazar un segundo (c1, sup1)';
  exception when unique_violation then
    raise notice 'TEST 3 OK: UNIQUE (catalog_product_id, supplier_id) rechaza duplicado';
  end;
end $$;

-- =========================================================================
-- TEST 4: CHECK has_reference — sin SKU ni modelo, falla.
-- =========================================================================
do $$
begin
  begin
    insert into supplier_product_references (catalog_product_id, supplier_id)
      values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'TEST 4 FALLO: debio rechazar una referencia sin SKU ni modelo';
  exception when check_violation then
    raise notice 'TEST 4 OK: CHECK has_reference rechaza una referencia vacia';
  end;
end $$;

-- =========================================================================
-- TEST 5: CHECK preferred_requires_active.
-- =========================================================================
do $$
begin
  begin
    insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, preferred, active)
      values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2', 'X', true, false);
    raise exception 'TEST 5 FALLO: debio rechazar preferred=true con active=false';
  exception when check_violation then
    raise notice 'TEST 5 OK: CHECK preferred_requires_active rechaza preferred sin active';
  end;
end $$;

-- =========================================================================
-- TEST 6: UNIQUE parcial — a lo sumo un preferred por producto (c1 ya
-- tiene a sup1 como preferred desde TEST 1).
-- =========================================================================
do $$
begin
  begin
    update supplier_product_references set preferred = true
      where catalog_product_id = '00000000-0000-0000-0000-0000000000c1' and supplier_id = '00000000-0000-0000-0000-0000000000f2';
    raise exception 'TEST 6 FALLO: debio rechazar un segundo preferred=true para el mismo producto';
  exception when unique_violation then
    raise notice 'TEST 6 OK: indice unico parcial permite a lo sumo un preferred por producto';
  end;
end $$;

-- =========================================================================
-- TEST 7: cross-org bloqueado (trigger) — producto de Org A + proveedor
-- de Org B.
-- =========================================================================
do $$
begin
  begin
    insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku)
      values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f9', 'CROSS-ORG');
    raise exception 'TEST 7 FALLO: debio bloquear producto Org A + proveedor Org B';
  exception when others then
    if sqlerrm like '%organizaciones distintas%' then
      raise notice 'TEST 7 OK: trigger cross-org bloquea producto Org A + proveedor Org B';
    else
      raise;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 8: RLS aislamiento — Org B no ve las referencias de Org A.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare v_count integer;
begin
  select count(*) into v_count from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 0 then
    raise exception 'TEST 8 FALLO: Org B no deberia ver referencias de productos de Org A (vio %)', v_count;
  end if;
  raise notice 'TEST 8 OK: RLS aisla supplier_product_references entre organizaciones';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 9: referencia inactiva para c3+sup1 (usada en TEST 13 más abajo).
-- =========================================================================
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, active)
values (:'c3', :'sup1', 'INACTIVA-140', false);
select 'TEST 9 setup OK: referencia inactiva creada para c3' as marker;

-- =========================================================================
-- TEST 10/11: rpc_create_purchase_order llena el snapshot cuando existe
-- referencia activa (c1+sup1), y dos partidas mas (c2 sin referencia, c3
-- con referencia solo INACTIVA) quedan con snapshot NULL — la creacion
-- del borrador NO se bloquea por esto.
-- =========================================================================
do $$
declare
  v_order record;
  v_po record;
  v_item_c1 uuid;
  v_item_c2 uuid;
  v_item_c3 uuid;
  v_snap record;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente 66', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('model', 'TLLTPB140R', 'quantity', 5, 'unit', 'pza'),
      jsonb_build_object('model', 'SIN-REFERENCIA', 'quantity', 3, 'unit', 'pza'),
      jsonb_build_object('model', 'REFERENCIA-INACTIVA', 'quantity', 2, 'unit', 'pza')
    )
  );
  update order_items set catalog_product_id = '00000000-0000-0000-0000-0000000000c1' where order_id = v_order.id and model = 'TLLTPB140R';
  update order_items set catalog_product_id = '00000000-0000-0000-0000-0000000000c2' where order_id = v_order.id and model = 'SIN-REFERENCIA';
  update order_items set catalog_product_id = '00000000-0000-0000-0000-0000000000c3' where order_id = v_order.id and model = 'REFERENCIA-INACTIVA';

  select id into v_item_c1 from order_items where order_id = v_order.id and model = 'TLLTPB140R';
  select id into v_item_c2 from order_items where order_id = v_order.id and model = 'SIN-REFERENCIA';
  select id into v_item_c3 from order_items where order_id = v_order.id and model = 'REFERENCIA-INACTIVA';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_c1, 'quantity_ordered', 5),
      jsonb_build_object('order_item_id', v_item_c2, 'quantity_ordered', 3),
      jsonb_build_object('order_item_id', v_item_c3, 'quantity_ordered', 2)
    )
  );

  if v_po.status <> 'borrador' then
    raise exception 'TEST 10/11 FALLO: el borrador debio crearse aunque falten referencias, quedo en %', v_po.status;
  end if;
  raise notice 'TEST 11 OK: crear el borrador NUNCA se bloquea por falta de referencia del proveedor';

  select supplier_sku_snapshot, supplier_model_snapshot into v_snap
    from purchase_order_items where purchase_order_id = v_po.id and order_item_id = v_item_c1;
  if v_snap.supplier_sku_snapshot <> 'P7075R' or v_snap.supplier_model_snapshot <> 'P7075R' then
    raise exception 'TEST 10 FALLO: snapshot de c1 deberia ser P7075R/P7075R, fue %/%', v_snap.supplier_sku_snapshot, v_snap.supplier_model_snapshot;
  end if;
  raise notice 'TEST 10 OK: snapshot se llena correctamente al crear la PO (referencia activa)';

  select supplier_sku_snapshot, supplier_model_snapshot into v_snap
    from purchase_order_items where purchase_order_id = v_po.id and order_item_id = v_item_c2;
  if v_snap.supplier_sku_snapshot is not null or v_snap.supplier_model_snapshot is not null then
    raise exception 'TEST 10b FALLO: snapshot de c2 (sin referencia) deberia quedar NULL';
  end if;
  raise notice 'TEST 10b OK: snapshot queda NULL cuando no existe ninguna referencia (nunca cae al modelo interno)';

  select supplier_sku_snapshot, supplier_model_snapshot into v_snap
    from purchase_order_items where purchase_order_id = v_po.id and order_item_id = v_item_c3;
  if v_snap.supplier_sku_snapshot is not null or v_snap.supplier_model_snapshot is not null then
    raise exception 'TEST 13 FALLO: snapshot de c3 (referencia SOLO inactiva) deberia quedar NULL';
  end if;
  raise notice 'TEST 13 OK: una referencia inactiva nunca se usa para resolver el snapshot';

  perform set_config('test.po66_missing_id', v_po.id::text, false);
  perform set_config('test.order66_missing_id', v_order.id::text, false);
  perform set_config('test.item66_c2_id', v_item_c2::text, false);
end $$;

-- =========================================================================
-- TEST 14: aprobacion bloqueada — la PO de arriba tiene 2 partidas
-- catalogadas sin snapshot (c2, c3); sacarla de borrador debe fallar.
-- =========================================================================
do $$
declare v_po_id uuid := current_setting('test.po66_missing_id')::uuid;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'ordenada');
    raise exception 'TEST 14 FALLO: debio bloquear la aprobacion por falta de referencia';
  exception when others then
    if sqlerrm like '%Falta referencia del proveedor%' then
      raise notice 'TEST 14 OK: aprobacion bloqueada citando la falta de referencia — %', sqlerrm;
    else
      raise;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 12: rpc_replace_purchase_order_items re-resuelve el snapshot con
-- la referencia ACTUAL — se agrega la referencia faltante de c2+sup1 y se
-- reemplazan las mismas partidas; ahora c2 SI debe traer snapshot.
-- =========================================================================
insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model)
values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f1', 'NUEVA-REF-C2', 'NUEVA-REF-C2');

do $$
declare
  v_po_id uuid := current_setting('test.po66_missing_id')::uuid;
  v_order_id uuid := current_setting('test.order66_missing_id')::uuid;
  v_item_c1 uuid;
  v_item_c2 uuid := current_setting('test.item66_c2_id')::uuid;
  v_item_c3 uuid;
  v_snap record;
begin
  select id into v_item_c1 from order_items where order_id = v_order_id and model = 'TLLTPB140R';
  select id into v_item_c3 from order_items where order_id = v_order_id and model = 'REFERENCIA-INACTIVA';

  perform rpc_replace_purchase_order_items(
    v_po_id,
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_c1, 'quantity_ordered', 5),
      jsonb_build_object('order_item_id', v_item_c2, 'quantity_ordered', 3),
      jsonb_build_object('order_item_id', v_item_c3, 'quantity_ordered', 2)
    )
  );

  select supplier_sku_snapshot, supplier_model_snapshot into v_snap
    from purchase_order_items where purchase_order_id = v_po_id and order_item_id = v_item_c2;
  if v_snap.supplier_sku_snapshot <> 'NUEVA-REF-C2' then
    raise exception 'TEST 12 FALLO: rpc_replace_purchase_order_items debio resolver la referencia nueva de c2, obtuvo %', v_snap.supplier_sku_snapshot;
  end if;
  raise notice 'TEST 12 OK: rpc_replace_purchase_order_items re-resuelve snapshots con la referencia ACTUAL del maestro';
end $$;

-- =========================================================================
-- TEST 14b: tras corregir c2, sigue faltando c3 (referencia inactiva) —
-- la aprobacion SIGUE bloqueada citando solo lo que falta de verdad.
-- =========================================================================
do $$
declare v_po_id uuid := current_setting('test.po66_missing_id')::uuid;
begin
  begin
    perform rpc_update_purchase_order_status(v_po_id, 'ordenada');
    raise exception 'TEST 14b FALLO: debio seguir bloqueado por c3 (referencia inactiva)';
  exception when others then
    if sqlerrm like '%Falta referencia del proveedor%REFERENCIA-INACTIVA%' then
      raise notice 'TEST 14b OK: bloqueo sigue citando exactamente la partida pendiente (c3) tras corregir c2';
    else
      raise;
    end if;
  end;
end $$;

-- =========================================================================
-- TEST 15: linea libre (catalog_product_id NULL) nunca bloquea.
-- =========================================================================
do $$
declare
  v_order record;
  v_po record;
  v_item_c1 uuid;
  v_item_free uuid;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente 66 libre', 'product_type', 'otro'),
    jsonb_build_array(
      jsonb_build_object('model', 'TLLTPB140R', 'quantity', 1, 'unit', 'pza'),
      jsonb_build_object('model', 'Servicio manual sin catalogo', 'quantity', 1, 'unit', 'pza')
    )
  );
  update order_items set catalog_product_id = '00000000-0000-0000-0000-0000000000c1' where order_id = v_order.id and model = 'TLLTPB140R';
  -- la partida "Servicio manual sin catalogo" queda con catalog_product_id NULL a propósito.

  select id into v_item_c1 from order_items where order_id = v_order.id and model = 'TLLTPB140R';
  select id into v_item_free from order_items where order_id = v_order.id and model = 'Servicio manual sin catalogo';

  select * into v_po from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(
      jsonb_build_object('order_item_id', v_item_c1, 'quantity_ordered', 1),
      jsonb_build_object('order_item_id', v_item_free, 'quantity_ordered', 1)
    )
  );

  -- TEST 16 (combinado aqui): c1 SI tiene snapshot -> la unica partida
  -- catalogada esta resuelta, la libre nunca cuenta -> debe aprobar.
  perform rpc_update_purchase_order_status(v_po.id, 'ordenada');
  raise notice 'TEST 15/16 OK: linea libre (catalog_product_id NULL) nunca bloquea, y con snapshots completos la aprobacion SI procede';
end $$;

-- =========================================================================
-- TEST 17: POs historicas (ya fuera de borrador antes de esta migracion,
-- simulado) nunca se revalidan retroactivamente.
-- =========================================================================
do $$
declare
  v_order record;
  v_po_id uuid;
  v_item_c3 uuid;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'order_date', current_date::text, 'client_name', 'Cliente 66 historico', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'REFERENCIA-INACTIVA', 'quantity', 1, 'unit', 'pza'))
  );
  update order_items set catalog_product_id = '00000000-0000-0000-0000-0000000000c3' where order_id = v_order.id;
  select id into v_item_c3 from order_items where order_id = v_order.id;

  select id into v_po_id from rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order.id, 'supplier_id', '00000000-0000-0000-0000-0000000000f1', 'po_date', current_date::text),
    jsonb_build_array(jsonb_build_object('order_item_id', v_item_c3, 'quantity_ordered', 1))
  );

  -- Simula una PO "historica": ya aprobada ANTES de que existiera el
  -- bloqueo (bypass directo, nunca a traves de la RPC, exactamente igual
  -- que quedarian las POs reales que ya salieron de borrador antes de
  -- desplegar 0066).
  update purchase_orders set status = 'ordenada', pre_receiving_status = 'ordenada' where id = v_po_id;

  -- Una transicion posterior (ordenada -> confirmada) NO vuelve a pasar
  -- por la rama "sale de borrador" — nunca se revalida retroactivamente.
  perform rpc_update_purchase_order_status(v_po_id, 'confirmada');
  raise notice 'TEST 17 OK: una PO que ya salio de borrador nunca se revalida retroactivamente por snapshots faltantes';
end $$;

-- =========================================================================
-- TEST 18: rpc_replace_supplier_product_references — reemplazo VALIDO
-- completo (A y B reemplazadas por un set nuevo de 2 filas distintas).
-- =========================================================================
do $$
declare
  v_count integer;
begin
  perform rpc_replace_supplier_product_references(
    '00000000-0000-0000-0000-0000000000c1',
    jsonb_build_array(
      jsonb_build_object('supplier_id', '00000000-0000-0000-0000-0000000000f1', 'supplier_sku', 'P7075R-V2', 'preferred', true, 'active', true),
      jsonb_build_object('supplier_id', '00000000-0000-0000-0000-0000000000f2', 'supplier_model', 'ABC-140-R-V2', 'preferred', false, 'active', true)
    )
  );
  select count(*) into v_count from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count <> 2 then
    raise exception 'TEST 18 FALLO: se esperaban 2 referencias tras el reemplazo valido, hubo %', v_count;
  end if;
  if not exists (
    select 1 from supplier_product_references
    where catalog_product_id = '00000000-0000-0000-0000-0000000000c1' and supplier_sku = 'P7075R-V2' and preferred = true
  ) then
    raise exception 'TEST 18 FALLO: el nuevo set no reemplazo correctamente los valores anteriores';
  end if;
  raise notice 'TEST 18 OK: reemplazo valido completo (delete+insert) funciona correctamente vía la RPC';
end $$;

-- =========================================================================
-- TEST 19: ATOMICIDAD — reemplazo que intenta violar una constraint
-- (dos filas del MISMO proveedor) debe fallar Y dejar el set anterior
-- (del TEST 18) EXACTAMENTE intacto — nunca vacio, nunca a medias. Esto
-- es lo que hacia FALTA cuando la Server Action usaba .delete() + .insert()
-- como dos llamadas PostgREST separadas (dos transacciones distintas):
-- un INSERT fallido despues de un DELETE exitoso dejaba CERO referencias.
-- =========================================================================
do $$
declare
  v_count_before integer;
  v_count_after integer;
  v_sku_before text;
begin
  select count(*) into v_count_before from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  select supplier_sku into v_sku_before from supplier_product_references
    where catalog_product_id = '00000000-0000-0000-0000-0000000000c1' and preferred = true;

  begin
    perform rpc_replace_supplier_product_references(
      '00000000-0000-0000-0000-0000000000c1',
      jsonb_build_array(
        jsonb_build_object('supplier_id', '00000000-0000-0000-0000-0000000000f1', 'supplier_sku', 'INVALIDO-1', 'active', true),
        jsonb_build_object('supplier_id', '00000000-0000-0000-0000-0000000000f1', 'supplier_sku', 'INVALIDO-2', 'active', true)
      )
    );
    raise exception 'TEST 19 FALLO: debio rechazar un set con el mismo proveedor repetido';
  exception when others then
    if sqlerrm not like '%mismo proveedor%' then
      raise;
    end if;
  end;

  select count(*) into v_count_after from supplier_product_references where catalog_product_id = '00000000-0000-0000-0000-0000000000c1';
  if v_count_after <> v_count_before then
    raise exception 'TEST 19 FALLO: el conteo cambio tras un reemplazo rechazado (antes %, despues %) — NO fue atomico', v_count_before, v_count_after;
  end if;
  if not exists (
    select 1 from supplier_product_references
    where catalog_product_id = '00000000-0000-0000-0000-0000000000c1' and supplier_sku = v_sku_before and preferred = true
  ) then
    raise exception 'TEST 19 FALLO: el set anterior (del TEST 18) ya no esta intacto tras el intento fallido';
  end if;
  raise notice 'TEST 19 OK: ATOMICIDAD confirmada — un reemplazo invalido no deja ningun rastro, el set anterior (A/B) permanece EXACTAMENTE intacto';
end $$;

rollback;
