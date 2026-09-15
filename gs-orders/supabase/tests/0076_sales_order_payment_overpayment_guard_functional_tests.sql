-- THÖREN — Fix de integridad: tope absoluto de cobranza en
-- rpc_register_sales_order_payment
-- (0076_sales_order_payment_overpayment_guard.sql) — pruebas funcionales
-- contra Postgres real. Fixtures 100% autocontenidas — no depende de la
-- cadena de fixtures de fases anteriores. Todo el script corre en una
-- transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set finance_user '00000000-0000-0000-0000-000000000006'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_finance '00000000-0000-0000-0000-0000000000b6'
\set c1 '00000000-0000-0000-0000-0000000000c1'

insert into auth.users (id, email) values
  (:'admin', 'admin-76@test.local'),
  (:'finance_user', 'finance-76@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 76', 'test-org-76');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 76', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 76', 'VT76', true),
  (:'sp_finance', :'org_a', 'Finance Placeholder 76', 'FZ76', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'finance_user', 'Finance User Test 76', 'vendedor', :'sp_finance', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'finance_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'finance_user', 'can_manage_sales_order_finance', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 76', true);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup: 3 Sales Orders confirmadas, líneas libres:
--   e1: total 100.00, cash (payment_required_amount se fuerza = total).
--   e2: total 100.00, 'advance' con payment_required_amount = 50.00
--     (anticipo) — el total sigue siendo 100.00.
--   e3: total 200.00, cash, sin ningún pago todavía — flujo desde factura.
-- =========================================================================
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-76-E1', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e1', 'confirmed');

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'advance', 'payment_required_amount', 50.00),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-76-E2', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-76-E3', 'quantity', 1, 'unit_price', 200.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');
end $$;

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: SO total 100.00 + pago 100.00 -> OK (financial_status paid).
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- finance_user
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 100.00);
  if v_so.amount_paid <> 100.00 or v_so.financial_status <> 'paid' then
    raise exception 'TEST 1 FALLO: esperado amount_paid=100.00 financial_status=paid, fue amount_paid=%, financial_status=%', v_so.amount_paid, v_so.financial_status;
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 1 OK: SO total 100.00 + pago 100.00 -> paid';
end $$;

-- =========================================================================
-- TEST 2: otro pago de 1.00 sobre la MISMA SO (ya en 100.00 de 100.00) ->
-- rechazado, atómico (ni amount_paid ni el historial cambian).
-- =========================================================================
do $$
declare
  v_amount_before numeric(12,2);
  v_events_before integer;
  v_amount_after numeric(12,2);
  v_events_after integer;
begin
  select amount_paid into v_amount_before from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  select count(*) into v_events_before from sales_order_financial_events where sales_order_id = '00000000-0000-0000-0000-0000000000e1';

  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 1.00);
    raise exception 'TEST 2 FALLO: no debió permitir un pago que exceda el total de la Sales Order (100.00 + 1.00 > 100.00)';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  select amount_paid into v_amount_after from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  select count(*) into v_events_after from sales_order_financial_events where sales_order_id = '00000000-0000-0000-0000-0000000000e1';
  if v_amount_after <> v_amount_before or v_events_after <> v_events_before then
    raise exception 'TEST 2 FALLO: el intento rechazado NO debió dejar ningún rastro (amount_paid antes=% después=%, eventos antes=% después=%)',
      v_amount_before, v_amount_after, v_events_before, v_events_after;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 2 OK: sobrepago rechazado de forma atómica — ni el monto ni el historial cambian';
end $$;

-- =========================================================================
-- TEST 3: anticipo requerido 50.00 / total 100.00 -> pagar el anticipo
-- libera (financial_status=paid, fulfillment_release_status=released) SIN
-- haber cubierto el total; puede cobrarse después el resto (otros 50.00)
-- hasta llegar exactamente a 100.00; un peso más se rechaza — el tope
-- absoluto es SIEMPRE el total, nunca payment_required_amount.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e2', 50.00);
  if v_so.amount_paid <> 50.00 or v_so.financial_status <> 'paid' or v_so.fulfillment_release_status <> 'released' then
    raise exception 'TEST 3 FALLO: el anticipo (50.00 de 100.00) debió liberar la Sales Order (paid/released) sin cubrir el total, fue amount_paid=%, financial_status=%, release=%',
      v_so.amount_paid, v_so.financial_status, v_so.fulfillment_release_status;
  end if;

  -- Puede seguir cobrándose el resto del total (payment_required_amount YA
  -- se cumplió — no es el tope, el total sí lo es).
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e2', 50.00);
  if v_so.amount_paid <> 100.00 or v_so.financial_status <> 'paid' then
    raise exception 'TEST 3 FALLO: debió poder cobrarse el resto (otros 50.00) hasta llegar a 100.00, fue amount_paid=%', v_so.amount_paid;
  end if;

  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e2', 1.00);
    raise exception 'TEST 3 FALLO: no debió permitir superar el total (100.00) aunque el anticipo ya estuviera cubierto hace tiempo';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 3 OK: anticipo libera sin cubrir el total; se puede seguir cobrando hasta el total exacto, nunca más allá';
end $$;

-- =========================================================================
-- TEST 4 (flujo desde factura sigue sincronizando una sola vez): SO total
-- 200.00 sin ningún pago -> crear factura (nace pending/0, 0075) ->
-- registrar el pago COMPLETO desde la factura -> sales_orders.amount_paid
-- queda en 200.00 exactos, UNA sola vez; un intento posterior DIRECTO
-- sobre la Sales Order (fuera de la factura) se rechaza igual por el
-- mismo tope (200.00 + 1.00 > 200.00) — el guard de 0076 protege ambos
-- caminos por igual.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f01',
    '00000000-0000-0000-0000-0000000000e3',
    current_date + 30
  );
  if v_inv.amount_paid <> 0 or v_inv.status <> 'pending' then
    raise exception 'TEST 4 FALLO (setup): sin ningún cobro previo la factura debió nacer pending/0, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_inv from rpc_register_invoice_payment(v_inv.id, 200.00);
  if v_inv.status <> 'paid' or v_inv.amount_paid <> 200.00 then
    raise exception 'TEST 4 FALLO: tras pagar 200.00 desde la factura, esperado status=paid amount_paid=200.00, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_so.amount_paid <> 200.00 then
    raise exception 'TEST 4 FALLO: sales_orders.amount_paid debió sincronizarse UNA sola vez en 200.00, fue %', v_so.amount_paid;
  end if;

  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 1.00);
    raise exception 'TEST 4 FALLO: un intento DIRECTO sobre la Sales Order (fuera de la factura) también debió rechazarse por exceder el total';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 4 OK: el flujo desde factura sincroniza una sola vez; el mismo tope protege también pagos directos posteriores sobre la Sales Order';
end $$;

select 'TODAS LAS PRUEBAS 0076 PASARON' as resultado;

rollback;
