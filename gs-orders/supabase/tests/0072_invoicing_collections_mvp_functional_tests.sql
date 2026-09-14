-- THÖREN — Facturación + Cobranza básica MVP (0072_invoicing_collections_mvp.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor_user '00000000-0000-0000-0000-000000000002'
\set finance_user '00000000-0000-0000-0000-000000000006'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_finance '00000000-0000-0000-0000-0000000000b6'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'

insert into auth.users (id, email) values
  (:'admin', 'admin-72@test.local'),
  (:'vendedor_user', 'vendedor-72@test.local'),
  (:'finance_user', 'finance-72@test.local'),
  (:'admin_orgb', 'admin-orgb-72@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 72', 'test-org-72'),
  (:'org_b', 'Test Org 72B', 'test-org-72b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 72', 'admin', true),
  (:'admin_orgb', 'Admin Org B 72', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 72', 'VT72', true),
  (:'sp_finance', :'org_a', 'Finance Placeholder 72', 'FZ72', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 72', 'VB72', true);

-- vendedor_user: dueño de sus propias Sales Orders, SIN
-- can_manage_sales_order_finance — representa al vendedor que puede VER
-- (regla de visibilidad heredada de 0068) pero no gestionar facturación.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_user', 'Vendedor Test 72', 'vendedor', :'sp1', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_user', 'vendedor', true);

-- finance_user: SOLO can_manage_sales_order_finance (0068, reutilizada tal
-- cual — ver DECISIÓN de cabecera de 0072), NO admin, NO dueño de ninguna
-- Sales Order — representa al rol de Finanzas al que apunta el ticket.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'finance_user', 'Finance User Test 72', 'vendedor', :'sp_finance', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'finance_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'finance_user', 'can_manage_sales_order_finance', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 72', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 72', true);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Sales Orders — todas con líneas libres (sin catalog_product_id):
-- facturación/cobranza no toca inventario, así que no hace falta
-- product_catalog/warehouses en estas fixtures.
-- =========================================================================
set role authenticated;
select test_set_user(:'admin');

do $$
begin
  -- SO_DRAFT (e1): nunca se confirma.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E1', 'quantity', 1, 'unit_price', 100.00))
  );

  -- SO_CANCELLED (e2): confirmada y luego cancelada.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E2', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'cancelled');

  -- SO_MAIN (e3): confirmada, 2 líneas -> total 1000.00 (400 + 600).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E3A', 'quantity', 4, 'unit_price', 100.00),
      jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E3B', 'quantity', 6, 'unit_price', 100.00)
    )
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');

  -- SO_OVERDUE (e4): confirmada -> total 300.00.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'credit'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E4', 'quantity', 3, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');

  -- SO_CANCEL_TEST (e5): confirmada -> total 200.00.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e5',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E5', 'quantity', 2, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e5', 'confirmed');

  -- SO_ROLLBACK (e6): confirmada -> total 150.00.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e6',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-E6', 'quantity', 3, 'unit_price', 50.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e6', 'confirmed');
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  -- SO_ORGB (e9): confirmada en Org B -> total 100.00.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-72-ORGB', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e9', 'confirmed');
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: factura válida — crea desde SO_MAIN (total 1000.00), snapshot
-- correcto de encabezado + líneas, folio asignado, status inicial pending.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_item_count integer;
  v_lines_total numeric(12,2);
begin
  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f01',
    '00000000-0000-0000-0000-0000000000e3',
    current_date + 30
  );

  if v_inv.status <> 'pending' or v_inv.invoice_number is null or v_inv.total <> 1000.00 or v_inv.amount_paid <> 0 then
    raise exception 'TEST 1 FALLO: factura debió crearse pending, folio asignado, total 1000.00, amount_paid 0 (status=%, folio=%, total=%, amount_paid=%)',
      v_inv.status, v_inv.invoice_number, v_inv.total, v_inv.amount_paid;
  end if;
  if v_inv.subtotal <> 1000.00 or v_inv.tax_total <> 0 then
    raise exception 'TEST 1 FALLO: subtotal/tax_total debieron heredarse de la Sales Order (subtotal=%, tax_total=%)', v_inv.subtotal, v_inv.tax_total;
  end if;

  select count(*), coalesce(sum(line_total), 0) into v_item_count, v_lines_total
    from invoice_items where invoice_id = v_inv.id;
  if v_item_count <> 2 or v_lines_total <> 1000.00 then
    raise exception 'TEST 1 FALLO: se esperaban 2 líneas snapshot sumando 1000.00, hubo % sumando %', v_item_count, v_lines_total;
  end if;

  raise notice 'TEST 1 OK: factura válida creada con snapshot correcto (folio %)', v_inv.invoice_number;
end $$;

-- =========================================================================
-- TEST 2: SO draft no puede facturarse.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', current_date + 30);
    raise exception 'TEST 2 FALLO: no debió poder facturar una Sales Order en draft';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 2 OK: SO draft no puede facturarse';
end $$;

-- =========================================================================
-- TEST 3: SO cancelada no puede facturarse.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e2', current_date + 30);
    raise exception 'TEST 3 FALLO: no debió poder facturar una Sales Order cancelada';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 3 OK: SO cancelada no puede facturarse';
end $$;

-- =========================================================================
-- TEST 4: cross-org bloqueado — admin de Org A no puede facturar una Sales
-- Order de Org B.
-- =========================================================================
do $$
begin
  begin
    perform rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e9', current_date + 30);
    raise exception 'TEST 4 FALLO: no debió poder facturar una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 4 OK: cross-org bloqueado al crear factura';
end $$;

-- =========================================================================
-- TEST 5: pago parcial — 400.00 de 1000.00 sobre la factura de TEST 1.
-- Actualiza la factura Y, vía delegación a rpc_register_sales_order_payment
-- (0068), la propia Sales Order — sin reimplementar esa lógica.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so sales_orders;
begin
  select * into v_inv from rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 400.00);
  if v_inv.status <> 'partially_paid' or v_inv.amount_paid <> 400.00 then
    raise exception 'TEST 5 FALLO: tras pago parcial de 400.00, esperado status=partially_paid amount_paid=400.00 (status=%, amount_paid=%)', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_so.amount_paid <> 400.00 or v_so.financial_status <> 'partially_paid' then
    raise exception 'TEST 5 FALLO: la Sales Order debió reflejar el pago vía delegación a 0068 (amount_paid=%, financial_status=%)', v_so.amount_paid, v_so.financial_status;
  end if;

  raise notice 'TEST 5 OK: pago parcial actualiza factura Y Sales Order (delegación a rpc_register_sales_order_payment)';
end $$;

-- =========================================================================
-- TEST 6: pago completo — 600.00 más completa el saldo (1000.00 total).
-- La factura pasa a 'paid'; la Sales Order también refleja 'paid' (0068).
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so sales_orders;
begin
  select * into v_inv from rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 600.00);
  if v_inv.status <> 'paid' or v_inv.amount_paid <> 1000.00 then
    raise exception 'TEST 6 FALLO: tras completar el pago, esperado status=paid amount_paid=1000.00 (status=%, amount_paid=%)', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_so.financial_status <> 'paid' then
    raise exception 'TEST 6 FALLO: la Sales Order debió quedar financial_status=paid (fue %)', v_so.financial_status;
  end if;

  raise notice 'TEST 6 OK: pago completo marca la factura (y la Sales Order, vía 0068) como paid';
end $$;

-- =========================================================================
-- TEST 7: sobrepago rechazado — factura ya en 'paid' (saldo 0); cualquier
-- pago adicional se rechaza y ni la factura ni la Sales Order cambian.
-- =========================================================================
do $$
declare
  v_amount_paid_before numeric(12,2);
  v_amount_paid_after numeric(12,2);
  v_so_amount_paid_before numeric(12,2);
  v_so_amount_paid_after numeric(12,2);
begin
  select amount_paid into v_amount_paid_before from invoices where id = '00000000-0000-0000-0000-000000000f01';
  select amount_paid into v_so_amount_paid_before from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';

  begin
    perform rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 50.00);
    raise exception 'TEST 7 FALLO: no debió permitir un pago sobre una factura ya pagada en su totalidad (sobrepago)';
  exception when others then
    if sqlerrm like 'TEST 7 FALLO%' then raise; end if;
  end;

  select amount_paid into v_amount_paid_after from invoices where id = '00000000-0000-0000-0000-000000000f01';
  select amount_paid into v_so_amount_paid_after from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_amount_paid_before <> v_amount_paid_after or v_so_amount_paid_before <> v_so_amount_paid_after then
    raise exception 'TEST 7 FALLO: ni la factura ni la Sales Order debieron cambiar tras el sobrepago rechazado';
  end if;

  raise notice 'TEST 7 OK: sobrepago rechazado — factura y Sales Order permanecen intactas';
end $$;

-- =========================================================================
-- TEST 8: pago sobre factura ya pagada explícitamente rechazado con su
-- propio mensaje (distinto del sobrepago genérico) — reconfirma la regla
-- "no permitir sobrepago" también para una factura exactamente saldada
-- (amount=cualquiera, incluso 0.01).
-- =========================================================================
do $$
begin
  begin
    perform rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 0.01);
    raise exception 'TEST 8 FALLO: no debió permitir registrar ningún pago sobre una factura ya pagada';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 8 OK: una factura pagada en su totalidad rechaza cualquier pago adicional, por mínimo que sea';
end $$;

-- =========================================================================
-- TEST 9: overdue derivado por fecha y saldo — factura de SO_OVERDUE
-- (total 300.00) creada con due_date en el pasado, sin pagar. Antes del
-- refresh permanece 'pending' (nada la recalcula sola); tras invocar
-- rpc_refresh_overdue_invoices pasa a 'overdue'.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_status_before text;
begin
  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f04',
    '00000000-0000-0000-0000-0000000000e4',
    current_date - 10
  );
  if v_inv.due_date <> current_date - 10 then
    raise exception 'TEST 9 FALLO: due_date debió aceptar una fecha pasada (captura tardía), fue %', v_inv.due_date;
  end if;

  select status into v_status_before from invoices where id = v_inv.id;
  if v_status_before <> 'pending' then
    raise exception 'TEST 9 FALLO: sin refresh, la factura debió permanecer pending (no hay cron en este entorno), fue %', v_status_before;
  end if;

  perform rpc_refresh_overdue_invoices('00000000-0000-0000-0000-0000000000a1');

  if (select status from invoices where id = v_inv.id) <> 'overdue' then
    raise exception 'TEST 9 FALLO: tras el refresh, la factura vencida y sin saldar debió pasar a overdue';
  end if;

  raise notice 'TEST 9 OK: overdue se deriva por fecha y saldo vía rpc_refresh_overdue_invoices (sin cron)';
end $$;

-- =========================================================================
-- TEST 10: un pago parcial sobre una factura YA overdue mantiene el status
-- 'overdue' (no regresa falsamente a 'partially_paid') mientras siga
-- vencida y con saldo pendiente.
-- =========================================================================
do $$
declare
  v_inv invoices;
begin
  select * into v_inv from rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f04', 100.00);
  if v_inv.status <> 'overdue' or v_inv.amount_paid <> 100.00 then
    raise exception 'TEST 10 FALLO: un pago parcial sobre una factura vencida debió mantener status=overdue (status=%, amount_paid=%)', v_inv.status, v_inv.amount_paid;
  end if;
  raise notice 'TEST 10 OK: un pago parcial no oculta falsamente que la factura sigue vencida';
end $$;

-- =========================================================================
-- TEST 11: cancelación explícita — motivo obligatorio, éxito con motivo,
-- y rechazo de cancelar una factura ya pagada en su totalidad.
-- =========================================================================
do $$
declare
  v_inv invoices;
begin
  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f05',
    '00000000-0000-0000-0000-0000000000e5',
    current_date + 15
  );

  begin
    perform rpc_cancel_invoice(v_inv.id, null);
    raise exception 'TEST 11 FALLO: no debió permitir cancelar sin motivo';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  select * into v_inv from rpc_cancel_invoice(v_inv.id, 'Cliente canceló el pedido.');
  if v_inv.status <> 'cancelled' or v_inv.cancellation_reason is distinct from 'Cliente canceló el pedido.' then
    raise exception 'TEST 11 FALLO: la factura debió quedar cancelled con el motivo registrado (status=%, motivo=%)', v_inv.status, v_inv.cancellation_reason;
  end if;

  begin
    perform rpc_cancel_invoice('00000000-0000-0000-0000-000000000f01', 'Intento sobre factura ya pagada.');
    raise exception 'TEST 11 FALLO: no debió permitir cancelar una factura ya pagada en su totalidad';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 11 OK: cancelación explícita — motivo obligatorio, éxito auditado, rechazo sobre factura pagada';
end $$;

-- =========================================================================
-- TEST 12: a lo sumo UNA factura activa por Sales Order (índice único
-- parcial) — un segundo intento sobre SO_MAIN (ya con una factura 'paid',
-- TEST 6) se rechaza; sobre SO_CANCEL_TEST (con una factura 'cancelled',
-- TEST 11) SÍ se permite una nueva porque la anterior liberó el cupo.
-- =========================================================================
do $$
declare
  v_inv invoices;
begin
  begin
    perform rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e3', current_date + 30);
    raise exception 'TEST 12 FALLO: no debió permitir una segunda factura activa sobre una Sales Order que ya tiene una (paid)';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  select * into v_inv from rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e5', current_date + 30);
  if v_inv.id is null then
    raise exception 'TEST 12 FALLO: SÍ debió poder crear una nueva factura tras cancelar la anterior de esa Sales Order';
  end if;

  raise notice 'TEST 12 OK: a lo sumo una factura activa por Sales Order — cancelar libera el cupo para una nueva';
end $$;

-- =========================================================================
-- TEST 13: rollback completo — se factura SO_ROLLBACK (total 150.00), y
-- ANTES de registrar el pago la propia Sales Order se cancela por otra vía
-- (admin, ajeno al flujo de cobranza). rpc_register_invoice_payment
-- delega a rpc_register_sales_order_payment (0068), que rechaza pagos
-- sobre una SO cancelada — la EXCEPCIÓN dentro de la delegación debe
-- revertir TAMBIÉN el insert en invoice_payments y el UPDATE de invoices
-- ya aplicados antes de esa llamada, en la MISMA transacción.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_payments_count_before integer;
  v_payments_count_after integer;
  v_amount_paid_after numeric(12,2);
  v_status_after text;
begin
  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f06',
    '00000000-0000-0000-0000-0000000000e6',
    current_date + 30
  );

  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e6', 'cancelled');

  select count(*) into v_payments_count_before from invoice_payments where invoice_id = v_inv.id;

  begin
    perform rpc_register_invoice_payment(v_inv.id, 50.00);
    raise exception 'TEST 13 FALLO: no debió permitir registrar el pago — la Sales Order subyacente ya está cancelada (0068 la rechaza al delegar)';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  select count(*) into v_payments_count_after from invoice_payments where invoice_id = v_inv.id;
  select amount_paid, status into v_amount_paid_after, v_status_after from invoices where id = v_inv.id;

  if v_payments_count_after <> v_payments_count_before then
    raise exception 'TEST 13 FALLO: el insert en invoice_payments debió revertirse por completo (antes % después %)', v_payments_count_before, v_payments_count_after;
  end if;
  if v_amount_paid_after <> 0 or v_status_after <> 'pending' then
    raise exception 'TEST 13 FALLO: la factura debió quedar exactamente como antes del intento (amount_paid=%, status=%)', v_amount_paid_after, v_status_after;
  end if;

  raise notice 'TEST 13 OK: rollback completo — un fallo en la delegación a 0068 revierte también los cambios ya aplicados a nivel de factura';
end $$;

-- =========================================================================
-- TEST 14: inmutabilidad — invoice_items congeladas (UPDATE/DELETE
-- rechazados) e invoices con identidad/montos congelados tras crear
-- (snapshot, "no editar montos históricos silenciosamente").
-- =========================================================================
do $$
declare
  v_item_id uuid;
begin
  select id into v_item_id from invoice_items where invoice_id = '00000000-0000-0000-0000-000000000f01' limit 1;

  begin
    update invoice_items set quantity = 999 where id = v_item_id;
    raise exception 'TEST 14 FALLO: no debió permitir modificar una línea de factura (snapshot congelado)';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  begin
    delete from invoice_items where id = v_item_id;
    raise exception 'TEST 14 FALLO: no debió permitir eliminar una línea de factura';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  begin
    update invoices set total = 1.00 where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 14 FALLO: no debió permitir modificar el total de una factura ya creada';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  begin
    update invoices set sales_order_id = '00000000-0000-0000-0000-0000000000e5' where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 14 FALLO: no debió permitir cambiar la Sales Order de origen de una factura ya creada';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 14 OK: líneas e identidad/montos de una factura son inmutables tras crearse';
end $$;

-- =========================================================================
-- TEST 15: RLS correcto — admin de Org B no ve facturas/líneas/pagos/
-- eventos de Org A.
-- =========================================================================
do $$
declare
  v_count_inv integer;
  v_count_items integer;
  v_count_payments integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  select count(*) into v_count_inv from invoices where id = '00000000-0000-0000-0000-000000000f01';
  select count(*) into v_count_items from invoice_items where invoice_id = '00000000-0000-0000-0000-000000000f01';
  select count(*) into v_count_payments from invoice_payments where invoice_id = '00000000-0000-0000-0000-000000000f01';
  select count(*) into v_count_events from invoice_events where invoice_id = '00000000-0000-0000-0000-000000000f01';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_inv <> 0 or v_count_items <> 0 or v_count_payments <> 0 or v_count_events <> 0 then
    raise exception 'TEST 15 FALLO: admin de Org B pudo ver datos de una factura de Org A (%/%/%/%)', v_count_inv, v_count_items, v_count_payments, v_count_events;
  end if;
  raise notice 'TEST 15 OK: aislamiento cross-org respetado por invoices/items/payments/events';
end $$;

-- =========================================================================
-- TEST 16 (SECURITY DEFINER audit): fn_next_invoice_number rechaza generar
-- un folio para una organización ajena — mismo patrón ya probado y seguro
-- de fn_next_sales_fulfillment_number/fn_next_goods_receipt_number/etc.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  begin
    perform fn_next_invoice_number('00000000-0000-0000-0000-0000000000a1', current_date);
    raise exception 'TEST 16 FALLO: no debió poder generar un folio de factura para otra organización';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 16 OK: fn_next_invoice_number (SECURITY DEFINER) rechaza generar folios de otra organización';
end $$;

-- =========================================================================
-- TEST 17 (bonus, visibilidad): vendedor_user (dueño de SO_MAIN vía sp1,
-- SIN can_manage_sales_order_finance) puede VER la factura de su propia
-- Sales Order (regla de visibilidad heredada de 0068), pero NO puede
-- crear, pagar ni cancelar ninguna factura — esa autoridad es exclusiva de
-- admin/can_manage_sales_order_finance.
-- =========================================================================
do $$
declare
  v_visible_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000002'); -- vendedor_user

  select count(*) into v_visible_count from invoices where id = '00000000-0000-0000-0000-000000000f01';
  if v_visible_count <> 1 then
    raise exception 'TEST 17 FALLO: el vendedor dueño de la Sales Order debió poder VER su factura';
  end if;

  begin
    perform rpc_create_invoice(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e5', current_date + 30);
    raise exception 'TEST 17 FALLO: un vendedor sin can_manage_sales_order_finance no debió poder crear una factura';
  exception when others then
    if sqlerrm like 'TEST 17 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 1.00);
    raise exception 'TEST 17 FALLO: un vendedor sin can_manage_sales_order_finance no debió poder registrar un pago';
  exception when others then
    if sqlerrm like 'TEST 17 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_cancel_invoice('00000000-0000-0000-0000-000000000f01', 'Intento sin autoridad.');
    raise exception 'TEST 17 FALLO: un vendedor sin can_manage_sales_order_finance no debió poder cancelar una factura';
  exception when others then
    if sqlerrm like 'TEST 17 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 17 OK: el dueño de la Sales Order ve su factura pero solo Finanzas/admin puede crear/cobrar/cancelar';
end $$;

select 'TODAS LAS PRUEBAS 0072 PASARON' as resultado;

rollback;
