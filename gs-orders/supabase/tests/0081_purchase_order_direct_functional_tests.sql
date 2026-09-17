-- THÖREN — Orden de Compra Directa (0081_purchase_order_direct.sql) —
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas.
-- Todo el script corre en una transacción que se revierte al final
-- (rollback) — repetible.

begin;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000081', 'admin-81@test.local'),
  ('10000000-0000-0000-0000-000000000181', 'preparador-81@test.local'),
  ('10000000-0000-0000-0000-000000000281', 'vendedor-81@test.local'),
  ('10000000-0000-0000-0000-000000000381', 'admin-orgb-81@test.local');

insert into organizations (id, name, slug) values
  ('20000000-0000-0000-0000-000000000081', 'Test Org 81', 'test-org-81'),
  ('20000000-0000-0000-0000-000000000181', 'Test Org 81B', 'test-org-81b');

insert into salespeople (id, organization_id, name, prefix, active) values
  ('30000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081', 'Vend Prep 81', 'VP81', true),
  ('30000000-0000-0000-0000-000000000181', '20000000-0000-0000-0000-000000000081', 'Vend Plano 81', 'VN81', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  ('10000000-0000-0000-0000-000000000081', 'Admin Test 81', 'admin', null, true),
  ('10000000-0000-0000-0000-000000000181', 'Preparador Test 81', 'vendedor', '30000000-0000-0000-0000-000000000081', true),
  ('10000000-0000-0000-0000-000000000281', 'Vendedor Plano 81', 'vendedor', '30000000-0000-0000-0000-000000000181', true),
  ('10000000-0000-0000-0000-000000000381', 'Admin Org B 81', 'admin', null, true);

insert into organization_members (organization_id, user_id, role, active) values
  ('20000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000081', 'admin', true),
  ('20000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000181', 'vendedor', true),
  ('20000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000281', 'vendedor', true),
  ('20000000-0000-0000-0000-000000000181', '10000000-0000-0000-0000-000000000381', 'admin', true);

-- Preparador de Compras — NO admin, pero con can_prepare_purchase_orders
-- explícito (para probar que el flujo funciona sin ser admin, y que la
-- extensión de purchase_orders_select lo deja ver de vuelta lo que crea).
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  ('20000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000181', 'can_prepare_purchase_orders', '10000000-0000-0000-0000-000000000081');

set role authenticated;
select test_set_user('10000000-0000-0000-0000-000000000081');

insert into business_units (id, organization_id, name, code, active) values
  ('40000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081', 'BU Ingles 81', 'bu_en_81', true),
  ('40000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000081', 'BU Sin Config 81', 'bu_sin_cfg_81', true),
  ('40000000-0000-0000-0000-000000000083', '20000000-0000-0000-0000-000000000081', 'BU Inactiva 81', 'bu_inactiva_81', false);

insert into business_unit_process_settings (organization_id, business_unit_id, provider_document_language) values
  ('20000000-0000-0000-0000-000000000081', '40000000-0000-0000-0000-000000000081', 'en');
-- bu_sin_cfg_81 deliberadamente SIN fila en business_unit_process_settings
-- — debe caer a 'es' por default.

insert into suppliers (id, organization_id, name, active) values
  ('60000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081', 'Proveedor Test 81', true),
  ('60000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000081', 'Proveedor Inactivo 81', false);

insert into warehouses (id, organization_id, name, code, active) values
  ('70000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081', 'Almacen Test 81', 'ALM81', true),
  ('70000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000081', 'Almacen Inactivo 81', 'ALM81X', false);

insert into product_catalog (id, organization_id, category, sku, name, unit, active) values
  ('80000000-0000-0000-0000-000000000081', '20000000-0000-0000-0000-000000000081', 'general', 'SKU-81', 'Producto Test 81', 'pza', true);

insert into supplier_product_references (catalog_product_id, supplier_id, supplier_sku, supplier_model, supplier_description, supplier_uom, active) values
  ('80000000-0000-0000-0000-000000000081', '60000000-0000-0000-0000-000000000081', 'PROV-SKU-81', 'PROV-MODEL-81', 'Descripcion proveedor 81', 'PZA', true);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: vendedor sin can_prepare_purchase_orders -> rechazado.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000281');
do $$
begin
  begin
    perform rpc_create_direct_purchase_order(
      gen_random_uuid(),
      jsonb_build_object(
        'business_unit_id', '40000000-0000-0000-0000-000000000081',
        'supplier_id', '60000000-0000-0000-0000-000000000081',
        'currency', 'MXN',
        'direct_purchase_reason', 'stock'
      ),
      jsonb_build_array(jsonb_build_object('description', 'Concepto libre', 'quantity_ordered', 1, 'unit_price', 100))
    );
    raise exception 'TEST 1 FALLO: un vendedor sin autoridad no debio poder crear una OC directa';
  exception when others then
    if sqlerrm like 'Solo un administrador%' then
      raise notice 'TEST 1 OK: rechazado sin autoridad (%).', sqlerrm;
    else
      raise exception 'TEST 1 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;
select test_set_user('10000000-0000-0000-0000-000000000081');

-- =========================================================================
-- TEST 2: preparador (NO admin, con can_prepare_purchase_orders) crea una
-- OC directa exitosa. Sin Pedido, sin Sales Order, sin Requisición, sin
-- cliente. Idioma resuelto del default de la BU (en). Una línea de
-- catálogo (con snapshot automático de supplier_product_references) + una
-- línea libre sin catálogo.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000181');
do $$
declare
  v_po_id uuid := gen_random_uuid();
  v_po purchase_orders;
  v_n_items integer;
begin
  v_po := rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object(
      'business_unit_id', '40000000-0000-0000-0000-000000000081',
      'supplier_id', '60000000-0000-0000-0000-000000000081',
      'destination_warehouse_id', '70000000-0000-0000-0000-000000000081',
      'currency', 'USD',
      'direct_purchase_reason', 'equipo',
      'payment_terms', '30 dias',
      'notes', 'Compra de prueba'
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000081', 'quantity_ordered', 2, 'unit_price', 100, 'tax_percent', 16),
      jsonb_build_object('description', 'Servicio de calibracion', 'quantity_ordered', 1, 'unit_price', 500, 'tax_percent', 16)
    )
  );

  if v_po.origin <> 'directa' then raise exception 'TEST 2 FALLO: origin esperado directa, obtuvo %', v_po.origin; end if;
  if v_po.order_id is not null then raise exception 'TEST 2 FALLO: order_id debio ser NULL'; end if;
  if v_po.business_unit_id <> '40000000-0000-0000-0000-000000000081' then raise exception 'TEST 2 FALLO: business_unit_id incorrecto'; end if;
  if v_po.document_language <> 'en' then raise exception 'TEST 2 FALLO: document_language esperado en (default de la BU), obtuvo %', v_po.document_language; end if;
  if v_po.currency <> 'USD' then raise exception 'TEST 2 FALLO: currency incorrecta'; end if;
  if v_po.direct_purchase_reason <> 'equipo' then raise exception 'TEST 2 FALLO: direct_purchase_reason incorrecto'; end if;
  if v_po.status <> 'borrador' then raise exception 'TEST 2 FALLO: status esperado borrador'; end if;

  -- Totales: (2*100*1.16) + (1*500*1.16) = 232 + 580 = 812; subtotal 600; tax 96; total 696... calculemos bien:
  -- linea1: subtotal=200, tax=32, total=232. linea2: subtotal=500, tax=80, total=580.
  -- header: subtotal=700, tax_total=112, total=812.
  if v_po.subtotal <> 700 then raise exception 'TEST 2 FALLO: subtotal esperado 700, obtuvo %', v_po.subtotal; end if;
  if v_po.tax_total <> 112 then raise exception 'TEST 2 FALLO: tax_total esperado 112, obtuvo %', v_po.tax_total; end if;
  if v_po.total <> 812 then raise exception 'TEST 2 FALLO: total esperado 812, obtuvo %', v_po.total; end if;

  select count(*) into v_n_items from purchase_order_items where purchase_order_id = v_po.id;
  if v_n_items <> 2 then raise exception 'TEST 2 FALLO: se esperaban 2 partidas, hubo %', v_n_items; end if;

  if not exists (
    select 1 from purchase_order_items
    where purchase_order_id = v_po.id and catalog_product_id = '80000000-0000-0000-0000-000000000081'
      and supplier_sku_snapshot = 'PROV-SKU-81' and supplier_model_snapshot = 'PROV-MODEL-81'
      and line_subtotal = 200 and line_total = 232
  ) then
    raise exception 'TEST 2 FALLO: la partida de catalogo no tiene el snapshot/monto esperado';
  end if;

  if not exists (
    select 1 from purchase_order_items
    where purchase_order_id = v_po.id and catalog_product_id is null
      and model = 'Servicio de calibracion' and line_subtotal = 500 and line_total = 580
  ) then
    raise exception 'TEST 2 FALLO: la partida libre (sin catalogo) no tiene el monto esperado';
  end if;

  raise notice 'TEST 2 OK: OC directa creada correctamente, sin Pedido/SO/Requisicion/cliente, totales exactos, snapshot automatico de supplier_product_references';
end $$;

-- =========================================================================
-- TEST 3: override manual de idioma (BU default es 'en', se fuerza 'es').
-- =========================================================================
do $$
declare v_po purchase_orders;
begin
  v_po := rpc_create_direct_purchase_order(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', '40000000-0000-0000-0000-000000000081',
      'supplier_id', '60000000-0000-0000-0000-000000000081',
      'currency', 'MXN',
      'direct_purchase_reason', 'muestras',
      'document_language', 'es'
    ),
    jsonb_build_array(jsonb_build_object('description', 'Muestra', 'quantity_ordered', 1, 'unit_price', 10))
  );
  if v_po.document_language <> 'es' then raise exception 'TEST 3 FALLO: override manual no funciono, quedo %', v_po.document_language; end if;
  raise notice 'TEST 3 OK: override manual de idioma funciona (es, aunque el default de la BU es en)';
end $$;

-- =========================================================================
-- TEST 4: BU sin fila en business_unit_process_settings -> cae a 'es'.
-- =========================================================================
do $$
declare v_po purchase_orders;
begin
  v_po := rpc_create_direct_purchase_order(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', '40000000-0000-0000-0000-000000000082',
      'supplier_id', '60000000-0000-0000-0000-000000000081',
      'currency', 'MXN',
      'direct_purchase_reason', 'interno'
    ),
    jsonb_build_array(jsonb_build_object('description', 'Insumo interno', 'quantity_ordered', 1, 'unit_price', 10))
  );
  if v_po.document_language <> 'es' then raise exception 'TEST 4 FALLO: sin configuracion de BU deberia caer a es, quedo %', v_po.document_language; end if;
  raise notice 'TEST 4 OK: BU sin business_unit_process_settings cae a es por default';
end $$;

-- =========================================================================
-- TEST 5-11: validaciones — cada una debe rechazar sin crear nada.
-- =========================================================================
do $$
declare v_failed boolean;
begin
  -- TEST 5: sin business_unit_id.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'Business Unit' then raise exception 'TEST 5 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 5 FALLO: debio rechazar sin business_unit_id'; end if;
  raise notice 'TEST 5 OK: rechazado sin business_unit_id';

  -- TEST 6: Business Unit inactiva (misma organizacion) -> rechazada igual que "no pertenece".
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000083', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'Business Unit' then raise exception 'TEST 6 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 6 FALLO: debio rechazar Business Unit inactiva'; end if;
  raise notice 'TEST 6 OK: rechazado con Business Unit inactiva (bu_inactiva_81)';

  -- TEST 7: proveedor inactivo.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000082', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'proveedor' then raise exception 'TEST 7 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 7 FALLO: debio rechazar proveedor inactivo'; end if;
  raise notice 'TEST 7 OK: rechazado con proveedor inactivo';

  -- TEST 8: moneda invalida.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'EUR', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'moneda' then raise exception 'TEST 8 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 8 FALLO: debio rechazar moneda invalida'; end if;
  raise notice 'TEST 8 OK: rechazado con moneda invalida';

  -- TEST 9: tipo/motivo de compra invalido.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'otro_invalido'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'motivo' then raise exception 'TEST 9 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 9 FALLO: debio rechazar motivo invalido'; end if;
  raise notice 'TEST 9 OK: rechazado con tipo/motivo de compra invalido';

  -- TEST 10: linea sin catalogo y sin descripcion.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'descripción' then raise exception 'TEST 10 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 10 FALLO: debio rechazar linea sin catalogo ni descripcion'; end if;
  raise notice 'TEST 10 OK: rechazado con linea sin catalogo ni descripcion';

  -- TEST 11: cantidad cero.
  v_failed := false;
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 0, 'unit_price', 1)));
  exception when others then v_failed := true;
    if sqlerrm !~ 'cantidad' then raise exception 'TEST 11 FALLO: mensaje inesperado: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 11 FALLO: debio rechazar cantidad cero'; end if;
  raise notice 'TEST 11 OK: rechazado con cantidad cero';
end $$;

-- =========================================================================
-- TEST 12: recepcion — linea CON catalogo genera inventory_movement; linea
-- SIN catalogo (servicio) NO genera inventory_movement. Mismo RPC de
-- siempre (rpc_receive_purchase_order_item), sin cambios. Corre como admin
-- (la transicion borrador->ordenada exige can_approve_purchase_orders,
-- autoridad ajena a este ticket — el preparador de los fixtures no la
-- tiene, ni debe tenerla).
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000081');
do $$
declare
  v_po_id uuid := gen_random_uuid();
  v_po purchase_orders;
  v_item_catalogo uuid;
  v_item_servicio uuid;
  v_n_movements integer;
begin
  v_po := rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object(
      'business_unit_id', '40000000-0000-0000-0000-000000000081',
      'supplier_id', '60000000-0000-0000-0000-000000000081',
      'currency', 'MXN', 'direct_purchase_reason', 'stock'
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '80000000-0000-0000-0000-000000000081', 'quantity_ordered', 5, 'unit_price', 20),
      jsonb_build_object('description', 'Servicio sin inventario', 'quantity_ordered', 1, 'unit_price', 50)
    )
  );

  select id into v_item_catalogo from purchase_order_items where purchase_order_id = v_po.id and catalog_product_id is not null;
  select id into v_item_servicio from purchase_order_items where purchase_order_id = v_po.id and catalog_product_id is null;

  update purchase_orders set status = 'ordenada' where id = v_po.id;

  perform rpc_receive_purchase_order_item(v_item_catalogo, 5, '70000000-0000-0000-0000-000000000081');
  perform rpc_receive_purchase_order_item(v_item_servicio, 1, null);

  select count(*) into v_n_movements from inventory_movements where purchase_order_item_id = v_item_catalogo;
  if v_n_movements <> 1 then raise exception 'TEST 12 FALLO: la linea con catalogo debio generar exactamente 1 inventory_movement, genero %', v_n_movements; end if;

  select count(*) into v_n_movements from inventory_movements where purchase_order_item_id = v_item_servicio;
  if v_n_movements <> 0 then raise exception 'TEST 12 FALLO: la linea de servicio (sin catalogo) NUNCA debio generar inventory_movement, genero %', v_n_movements; end if;

  if not exists (select 1 from purchase_order_items where id = v_item_servicio and quantity_received = 1) then
    raise exception 'TEST 12 FALLO: quantity_received de la linea de servicio debio actualizarse igual';
  end if;

  raise notice 'TEST 12 OK: recepcion reutiliza el flujo existente sin cambios — catalogo mueve inventario, servicio no';
end $$;

-- =========================================================================
-- TEST 13: inmutabilidad — origin/business_unit_id/document_language no
-- se pueden modificar despues de creada.
-- =========================================================================
do $$
declare
  v_po_id uuid := gen_random_uuid();
  v_po purchase_orders;
  v_failed boolean;
begin
  v_po := rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1))
  );

  v_failed := false;
  begin
    update purchase_orders set origin = 'pedido' where id = v_po.id;
  exception when others then v_failed := true;
    if sqlerrm !~ 'origen' then raise exception 'TEST 13 FALLO: mensaje inesperado al cambiar origin: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 13 FALLO: origin debio ser inmutable'; end if;

  v_failed := false;
  begin
    update purchase_orders set business_unit_id = '40000000-0000-0000-0000-000000000082' where id = v_po.id;
  exception when others then v_failed := true;
    if sqlerrm !~ 'Business Unit' then raise exception 'TEST 13 FALLO: mensaje inesperado al cambiar business_unit_id: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 13 FALLO: business_unit_id debio ser inmutable'; end if;

  v_failed := false;
  begin
    update purchase_orders set document_language = 'es' where id = v_po.id;
  exception when others then v_failed := true;
    if sqlerrm !~ 'idioma' then raise exception 'TEST 13 FALLO: mensaje inesperado al cambiar document_language: %', sqlerrm; end if;
  end;
  if not v_failed then raise exception 'TEST 13 FALLO: document_language debio ser inmutable'; end if;

  raise notice 'TEST 13 OK: origin/business_unit_id/document_language son inmutables tras crear';
end $$;

-- =========================================================================
-- TEST 14: CHECK a nivel de DB — una fila origin='directa' sin
-- business_unit_id/currency/direct_purchase_reason es rechazada incluso
-- por un INSERT directo (defensa en profundidad, nunca solo el RPC).
-- =========================================================================
do $$
declare v_failed boolean := false;
begin
  begin
    insert into purchase_orders (organization_id, supplier_id, folio, sequence_number, status, origin)
    values ('20000000-0000-0000-0000-000000000081', '60000000-0000-0000-0000-000000000081', 'PO-DIRECTA-INVALIDA-81', 999, 'borrador', 'directa');
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'TEST 14 FALLO: el CHECK de DB debio rechazar una OC directa sin BU/moneda/motivo'; end if;
  raise notice 'TEST 14 OK: el CHECK purchase_orders_direct_requires_fields protege incluso ante un INSERT directo';
end $$;

-- =========================================================================
-- TEST 15: regresion — rpc_create_purchase_order (flujo Pedido legado)
-- sigue funcionando igual y ahora marca origin='pedido'.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000081');
do $$
declare
  v_order_id uuid;
  v_order_item_id uuid;
  v_po purchase_orders;
begin
  select (rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object('salesperson_id', '30000000-0000-0000-0000-000000000081', 'order_date', current_date, 'client_name', 'Cliente Legado 81', 'product_type', 'otro'),
    jsonb_build_array(jsonb_build_object('model', 'Pieza legado 81', 'quantity', 3))
  )).id into v_order_id;

  select id into v_order_item_id from order_items where order_id = v_order_id limit 1;

  v_po := rpc_create_purchase_order(
    gen_random_uuid(),
    jsonb_build_object('order_id', v_order_id, 'supplier_id', '60000000-0000-0000-0000-000000000081'),
    jsonb_build_array(jsonb_build_object('order_item_id', v_order_item_id, 'quantity_ordered', 3))
  );

  if v_po.origin <> 'pedido' then raise exception 'TEST 15 FALLO: origin esperado pedido, obtuvo %', v_po.origin; end if;
  if v_po.order_id <> v_order_id then raise exception 'TEST 15 FALLO: order_id no coincide, flujo legado se rompio'; end if;
  raise notice 'TEST 15 OK: rpc_create_purchase_order (Pedido legado) sigue funcionando, origin=pedido';
end $$;

-- =========================================================================
-- TEST 16: regresion — rpc_convert_requisition_to_purchase_order (flujo
-- Requisicion/Sales Order) sigue funcionando igual y ahora marca
-- origin='requisicion'.
-- =========================================================================
do $$
declare
  v_customer_id uuid := '50000000-0000-0000-0000-000000000081';
  v_so_id uuid := gen_random_uuid();
  v_so_item_id uuid := gen_random_uuid();
  v_req_id uuid := gen_random_uuid();
  v_req_item_id uuid := gen_random_uuid();
  v_po purchase_orders;
begin
  insert into customers (id, organization_id, name, active) values (v_customer_id, '20000000-0000-0000-0000-000000000081', 'Cliente SO 81', true);

  insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by, is_test) values
    (v_so_id, '20000000-0000-0000-0000-000000000081', v_customer_id, '30000000-0000-0000-0000-000000000081', 'SO-TEST-81', 1, 'MXN', '10000000-0000-0000-0000-000000000081', false);
  -- sales_order_items solo se puede insertar mientras la SO sigue en
  -- draft — se agrega ANTES de avanzar el status.
  insert into sales_order_items (id, sales_order_id, catalog_product_id, sku_snapshot, quantity, unit_price, line_subtotal, line_total) values
    (v_so_item_id, v_so_id, '80000000-0000-0000-0000-000000000081', 'SKU-81', 4, 25, 100, 100);
  -- rpc_check_purchase_requisition_eligible (0069) exige status<>'draft' y
  -- fulfillment_release_status in ('released','partially_released') — se
  -- avanza con UPDATEs admin separados (varias columnas de "contenido
  -- comercial" no pueden cambiar en el mismo UPDATE que el status).
  update sales_orders set payment_terms_type = 'credit' where id = v_so_id;
  update sales_orders set status = 'confirmed' where id = v_so_id;
  update sales_orders set financial_status = 'credit_approved', fulfillment_release_status = 'released' where id = v_so_id;

  insert into purchase_requisitions (id, organization_id, requisition_number, sequence_number, sales_order_id, requested_by) values
    (v_req_id, '20000000-0000-0000-0000-000000000081', 'REQ-TEST-81', 1, v_so_id, '10000000-0000-0000-0000-000000000081');
  insert into purchase_requisition_items (id, purchase_requisition_id, sales_order_item_id, catalog_product_id, description_snapshot, quantity_required) values
    (v_req_item_id, v_req_id, v_so_item_id, '80000000-0000-0000-0000-000000000081', 'Producto Test 81', 4);
  update purchase_requisitions set status = 'submitted' where id = v_req_id;

  v_po := rpc_convert_requisition_to_purchase_order(
    gen_random_uuid(), v_req_id, '60000000-0000-0000-0000-000000000081', array[v_req_item_id]
  );

  if v_po.origin <> 'requisicion' then raise exception 'TEST 16 FALLO: origin esperado requisicion, obtuvo %', v_po.origin; end if;
  if v_po.order_id is not null then raise exception 'TEST 16 FALLO: order_id debio ser NULL para una PO de requisicion'; end if;
  raise notice 'TEST 16 OK: rpc_convert_requisition_to_purchase_order (Requisicion/SO) sigue funcionando, origin=requisicion';
end $$;

-- =========================================================================
-- TEST 17: RLS — el preparador (no admin) SÍ ve de vuelta la OC directa
-- que el mismo creo; un vendedor plano (sin capability, sin ser dueño via
-- Pedido) NO la ve.
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000181');
do $$
declare v_po_id uuid := gen_random_uuid();
begin
  perform rpc_create_direct_purchase_order(
    v_po_id,
    jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
    jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1))
  );

  if not exists (select 1 from purchase_orders where id = v_po_id) then
    raise exception 'TEST 17 FALLO: el preparador debio poder ver la OC directa que el mismo creo';
  end if;
end $$;

select test_set_user('10000000-0000-0000-0000-000000000281');
do $$
begin
  if exists (select 1 from purchase_orders where organization_id = '20000000-0000-0000-0000-000000000081' and origin = 'directa') then
    raise exception 'TEST 17 FALLO: un vendedor plano sin capability NUNCA debio ver ninguna OC directa ajena';
  end if;
  raise notice 'TEST 17 OK: RLS extendida correctamente — preparador ve lo suyo, vendedor plano no ve nada ajeno';
end $$;
select test_set_user('10000000-0000-0000-0000-000000000081');

-- =========================================================================
-- TEST 18: cross-org — un admin de otra organizacion no puede usar la BU
-- ni el proveedor de org_a para crear una OC directa (aislamiento real).
-- =========================================================================
select test_set_user('10000000-0000-0000-0000-000000000381');
do $$
declare v_failed boolean := false;
begin
  begin
    perform rpc_create_direct_purchase_order(gen_random_uuid(),
      jsonb_build_object('business_unit_id', '40000000-0000-0000-0000-000000000081', 'supplier_id', '60000000-0000-0000-0000-000000000081', 'currency', 'MXN', 'direct_purchase_reason', 'stock'),
      jsonb_build_array(jsonb_build_object('description', 'X', 'quantity_ordered', 1, 'unit_price', 1)));
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'TEST 18 FALLO: un admin de otra organizacion NUNCA debio poder usar BU/proveedor de org_a'; end if;
  raise notice 'TEST 18 OK: aislamiento cross-organizacion — BU/proveedor de otra organizacion rechazados';
end $$;
select test_set_user('10000000-0000-0000-0000-000000000081');

select 'TODAS LAS PRUEBAS 0081 (Orden de Compra Directa) PASARON' as resultado;
rollback;
