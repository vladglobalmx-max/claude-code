-- THÖREN — Sales Orders MVP (0067_sales_orders_mvp.sql) — pruebas
-- funcionales contra Postgres real. Fixtures 100% autocontenidas — no
-- depende de la cadena de fixtures de fases anteriores. Todo el script
-- corre en una transacción que se revierte al final (rollback) — repetible.

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set p_orgb '00000000-0000-0000-0000-0000000000d9'
\set so1 '00000000-0000-0000-0000-0000000000e1'
\set so2 '00000000-0000-0000-0000-0000000000e2'
\set so3 '00000000-0000-0000-0000-0000000000e3'
\set so4 '00000000-0000-0000-0000-0000000000e4'
\set so5 '00000000-0000-0000-0000-0000000000e5'
\set so6 '00000000-0000-0000-0000-0000000000e6'
\set so7 '00000000-0000-0000-0000-0000000000e7'

insert into auth.users (id, email) values
  (:'admin', 'admin-67@test.local'),
  (:'vendedor', 'vendedor-67@test.local'),
  (:'admin_orgb', 'admin-orgb-67@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 67', 'test-org-67'),
  (:'org_b', 'Test Org 67B', 'test-org-67b');

-- Todo el bootstrap (user_profiles/organization_members/salespeople/
-- customers/product_catalog) corre TODAVÍA como superusuario (antes de
-- `set role authenticated`) — mismo orden que 0066_..._functional_tests.sql
-- — para no chocar con trg_prevent_non_admin_role_escalation ni con RLS
-- mientras se arma el fixture.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'admin', 'Admin Test 67', 'admin', null, true),
  (:'admin_orgb', 'Admin Org B 67', 'admin', null, true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 67', 'VT67', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 67', 'VB67', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor', 'Vendedor Test 67', 'vendedor', :'sp1', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor', 'vendedor', true);

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 67', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 67', true);

insert into customer_contacts (customer_id, name, email, phone, is_primary, active) values
  (:'c1', 'Contacto Principal 67', 'contacto67@test.local', '555-0067', true, true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Catálogo 67', 'SKU-P1-67', 'general', 'pza', true),
  (:'p_orgb', :'org_b', 'Producto Org B 67', 'SKU-PORGB-67', 'general', null, true);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: crear draft con producto de catálogo — snapshot correcto,
-- customer_contact_snapshot resuelto automáticamente, status = draft.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item sales_order_items;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object(
      'customer_id', '00000000-0000-0000-0000-0000000000c1',
      'salesperson_id', '00000000-0000-0000-0000-0000000000b1',
      'currency', 'MXN'
    ),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 100.00)
    )
  );

  if v_so.status <> 'draft' then
    raise exception 'TEST 1 FALLO: status esperado draft, fue %', v_so.status;
  end if;
  if v_so.order_number is null or btrim(v_so.order_number) = '' then
    raise exception 'TEST 1 FALLO: order_number no fue asignado';
  end if;
  if v_so.customer_contact_snapshot is null or v_so.customer_contact_snapshot not like '%Contacto Principal 67%' then
    raise exception 'TEST 1 FALLO: customer_contact_snapshot no se resolvió, fue %', v_so.customer_contact_snapshot;
  end if;

  select * into v_item from sales_order_items where sales_order_id = v_so.id;
  if v_item.sku_snapshot <> 'SKU-P1-67' then
    raise exception 'TEST 1 FALLO: sku_snapshot esperado SKU-P1-67, fue %', v_item.sku_snapshot;
  end if;
  if v_item.uom_snapshot <> 'pza' then
    raise exception 'TEST 1 FALLO: uom_snapshot esperado pza, fue %', v_item.uom_snapshot;
  end if;

  raise notice 'TEST 1 OK: draft con producto de catálogo creado, snapshot y customer_contact_snapshot correctos';
end $$;

-- =========================================================================
-- TEST 2: crear con línea libre (catalog_product_id NULL).
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item sales_order_items;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-01', 'description_snapshot', 'Servicio de instalación', 'quantity', 1, 'unit_price', 500.00)
    )
  );

  select * into v_item from sales_order_items where sales_order_id = v_so.id;
  if v_item.catalog_product_id is not null then
    raise exception 'TEST 2 FALLO: catalog_product_id debía ser NULL en línea libre';
  end if;
  if v_item.sku_snapshot <> 'LIBRE-01' then
    raise exception 'TEST 2 FALLO: sku_snapshot esperado LIBRE-01, fue %', v_item.sku_snapshot;
  end if;

  raise notice 'TEST 2 OK: línea libre (sin producto de catálogo) soportada';
end $$;

-- TEST 2b: línea libre SIN sku_snapshot debe rechazarse.
do $$
begin
  begin
    perform rpc_create_sales_order(
      '00000000-0000-0000-0000-0000000000e3',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'quantity', 1, 'unit_price', 10.00))
    );
    raise exception 'TEST 2b FALLO: debió rechazar línea libre sin sku_snapshot';
  exception when others then
    if sqlerrm like 'TEST 2b FALLO%' then raise; end if;
    raise notice 'TEST 2b OK: línea libre sin sku_snapshot rechazada (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 3: cross-org customer rechazado.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_order(
      '00000000-0000-0000-0000-0000000000e3',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
      '[]'::jsonb
    );
    raise exception 'TEST 3 FALLO: debió rechazar customer de otra organización';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
    raise notice 'TEST 3 OK: cross-org customer rechazado (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 4: cross-org salesperson rechazado.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_order(
      '00000000-0000-0000-0000-0000000000e3',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN'),
      '[]'::jsonb
    );
    raise exception 'TEST 4 FALLO: debió rechazar salesperson de otra organización';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
    raise notice 'TEST 4 OK: cross-org salesperson rechazado (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 5: cross-org product (línea) rechazado.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_sales_order(
      '00000000-0000-0000-0000-0000000000e3',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
      jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d9', 'quantity', 1, 'unit_price', 10.00))
    );
    raise exception 'TEST 5 FALLO: debió rechazar producto de otra organización';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
    raise notice 'TEST 5 OK: cross-org product rechazado (%)', sqlerrm;
  end;
end $$;

-- =========================================================================
-- TEST 6: cálculo correcto de subtotal/impuestos/total (2 líneas, con
-- descuento y con impuesto por línea).
-- Línea A: qty 2 x 100.00 = 200.00 gross; discount 10% = 20.00 -> subtotal 180.00; tax 16% = 28.80 -> total 208.80
-- Línea B: qty 1 x 50.00  = 50.00  gross; discount 0%       -> subtotal 50.00;  tax 0%          -> total 50.00
-- Header esperado: subtotal 230.00, tax_total 28.80, total 258.80
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 2, 'unit_price', 100.00, 'discount', 10, 'tax', 16),
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-B', 'quantity', 1, 'unit_price', 50.00)
    )
  );

  if v_so.subtotal <> 230.00 or v_so.tax_total <> 28.80 or v_so.total <> 258.80 then
    raise exception 'TEST 6 FALLO: totales esperados (230.00, 28.80, 258.80), fueron (%, %, %)', v_so.subtotal, v_so.tax_total, v_so.total;
  end if;

  raise notice 'TEST 6 OK: subtotal/tax_total/total calculados correctamente server-side';
end $$;

-- =========================================================================
-- TEST 7: reemplazo de items atómico (rpc_update_sales_order) — reemplaza
-- el set completo de la SO del TEST 6 por uno distinto, recalcula totales.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_count integer;
begin
  select * into v_so from rpc_update_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'currency', 'MXN'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 300.00)
    )
  );

  select count(*) into v_count from sales_order_items where sales_order_id = v_so.id;
  if v_count <> 1 then
    raise exception 'TEST 7 FALLO: se esperaba 1 línea tras el reemplazo, hubo %', v_count;
  end if;
  if v_so.subtotal <> 300.00 or v_so.total <> 300.00 then
    raise exception 'TEST 7 FALLO: totales tras reemplazo esperados (300.00, 300.00), fueron (%, %)', v_so.subtotal, v_so.total;
  end if;

  raise notice 'TEST 7 OK: reemplazo completo de items atómico, totales recalculados';
end $$;

-- =========================================================================
-- TEST 8: rollback conserva items previos si falla el reemplazo — un
-- intento de reemplazo con una línea inválida (quantity <= 0) debe
-- revertir TODO, dejando exactamente el set del TEST 7 intacto.
-- =========================================================================
do $$
declare
  v_count_before integer;
  v_count_after integer;
  v_subtotal_before numeric(12,2);
  v_subtotal_after numeric(12,2);
begin
  select count(*), (select subtotal from sales_orders where id = '00000000-0000-0000-0000-0000000000e4')
    into v_count_before, v_subtotal_before
    from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e4';

  begin
    perform rpc_update_sales_order(
      '00000000-0000-0000-0000-0000000000e4',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'currency', 'MXN'),
      jsonb_build_array(
        jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 5, 'unit_price', 10.00),
        jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'INVALIDA', 'quantity', 0, 'unit_price', 10.00)
      )
    );
    raise exception 'TEST 8 FALLO: debió rechazar una línea con quantity <= 0';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;

  select count(*), (select subtotal from sales_orders where id = '00000000-0000-0000-0000-0000000000e4')
    into v_count_after, v_subtotal_after
    from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e4';

  if v_count_after <> v_count_before or v_subtotal_after <> v_subtotal_before then
    raise exception 'TEST 8 FALLO: el set de items o el subtotal cambiaron tras un reemplazo fallido (antes % items/subtotal %, despues % items/subtotal %)',
      v_count_before, v_subtotal_before, v_count_after, v_subtotal_after;
  end if;

  raise notice 'TEST 8 OK: rollback conservó el set de items previo intacto tras un reemplazo inválido';
end $$;

-- =========================================================================
-- TEST 9: confirmar guarda snapshots — confirma la SO del TEST 7/8, verifica
-- confirmed_at asignado y snapshot presente.
-- =========================================================================
do $$
declare
  v_so sales_orders;
  v_item sales_order_items;
begin
  select * into v_so from rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');

  if v_so.status <> 'confirmed' then
    raise exception 'TEST 9 FALLO: status esperado confirmed, fue %', v_so.status;
  end if;
  if v_so.confirmed_at is null then
    raise exception 'TEST 9 FALLO: confirmed_at no fue asignado al confirmar';
  end if;

  select * into v_item from sales_order_items where sales_order_id = v_so.id;
  if v_item.sku_snapshot is null or btrim(v_item.sku_snapshot) = '' then
    raise exception 'TEST 9 FALLO: la línea confirmada no tiene sku_snapshot completo';
  end if;

  raise notice 'TEST 9 OK: al confirmar, confirmed_at se asigna y las líneas ya tienen snapshot completo';
end $$;

-- =========================================================================
-- TEST 10: modificar el catálogo después NO altera los snapshots ya
-- confirmados (usa el producto d1, referenciado por la línea de TEST 7/9).
-- =========================================================================
do $$
declare
  v_snapshot_before text;
  v_snapshot_after text;
begin
  select sku_snapshot into v_snapshot_before
    from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e4';

  update product_catalog set sku = 'SKU-P1-67-RENOMBRADO' where id = '00000000-0000-0000-0000-0000000000d1';

  select sku_snapshot into v_snapshot_after
    from sales_order_items where sales_order_id = '00000000-0000-0000-0000-0000000000e4';

  if v_snapshot_before is distinct from v_snapshot_after then
    raise exception 'TEST 10 FALLO: el snapshot cambió tras renombrar el producto en el catálogo (antes %, despues %)', v_snapshot_before, v_snapshot_after;
  end if;

  raise notice 'TEST 10 OK: renombrar el producto en el catálogo NO alteró el snapshot ya guardado (%)', v_snapshot_after;
end $$;

-- =========================================================================
-- TEST 11: solo draft editable — rpc_update_sales_order sobre la SO ya
-- confirmada (TEST 9) debe rechazarse; escritura directa de contenido
-- comercial también debe rechazarse (congelamiento vía trigger); insertar
-- una línea directo también debe rechazarse (RLS).
-- =========================================================================
do $$
begin
  begin
    perform rpc_update_sales_order(
      '00000000-0000-0000-0000-0000000000e4',
      jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'currency', 'MXN'),
      '[]'::jsonb
    );
    raise exception 'TEST 11 FALLO: debió rechazar editar una SO confirmada vía rpc_update_sales_order';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  begin
    update sales_orders set commercial_notes = 'intento directo' where id = '00000000-0000-0000-0000-0000000000e4';
    raise exception 'TEST 11 FALLO: debió rechazar un UPDATE directo de contenido comercial fuera de draft';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  begin
    insert into sales_order_items (sales_order_id, catalog_product_id, sku_snapshot, quantity, unit_price, line_subtotal, line_total)
      values ('00000000-0000-0000-0000-0000000000e4', null, 'INTENTO-DIRECTO', 1, 1, 1, 1);
    raise exception 'TEST 11 FALLO: debió rechazar un INSERT directo de línea fuera de draft';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 11 OK: solo draft es editable — RPC, UPDATE directo e INSERT de línea, los tres rechazados fuera de draft';
end $$;

-- =========================================================================
-- TEST 12: confirmed NUNCA vuelve a draft — ni vía RPC ni vía UPDATE directo.
-- =========================================================================
do $$
begin
  begin
    perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'draft');
    raise exception 'TEST 12 FALLO: rpc_update_sales_order_status no debió aceptar "draft" como destino';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  begin
    update sales_orders set status = 'draft' where id = '00000000-0000-0000-0000-0000000000e4';
    raise exception 'TEST 12 FALLO: un UPDATE directo no debió poder regresar la SO a draft';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 12 OK: una Sales Order confirmada nunca puede volver a draft, silenciosa ni explícitamente';
end $$;

-- =========================================================================
-- TEST 13: cancelación explícita — un draft nuevo se cancela solo mediante
-- una llamada explícita; una vez cancelada, es terminal (no admite más transiciones).
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e5',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN'),
    '[]'::jsonb
  );
  if v_so.status <> 'draft' then
    raise exception 'TEST 13 FALLO: la SO nueva debía nacer en draft';
  end if;

  select * into v_so from rpc_update_sales_order_status(v_so.id, 'cancelled');
  if v_so.status <> 'cancelled' then
    raise exception 'TEST 13 FALLO: status esperado cancelled, fue %', v_so.status;
  end if;

  begin
    perform rpc_update_sales_order_status(v_so.id, 'confirmed');
    raise exception 'TEST 13 FALLO: una SO cancelada no debió aceptar ninguna otra transición';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 13 OK: cancelación es explícita (nunca el default) y cancelled es terminal';
end $$;

-- =========================================================================
-- TEST 14: aislamiento cross-org en SELECT (RLS) — admin de Org B no ve
-- las Sales Orders de Org A.
-- =========================================================================
do $$
declare
  v_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_count from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  if v_count <> 0 then
    raise exception 'TEST 14 FALLO: admin de Org B pudo ver una Sales Order de Org A';
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 14 OK: aislamiento cross-org respetado por sales_orders_select_own_or_admin';
end $$;

select 'TODAS LAS PRUEBAS 0067 PASARON' as resultado;

rollback;
