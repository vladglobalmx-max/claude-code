-- THÖREN — Fix de integridad: doble contabilización de cobro entre 0068 y
-- 0072 (0075_invoice_creation_amount_paid_double_count_fix.sql) — pruebas
-- funcionales contra Postgres real. Fixtures 100% autocontenidas — no
-- depende de la cadena de fixtures de fases anteriores. Todo el script
-- corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set finance_user '00000000-0000-0000-0000-000000000006'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_finance '00000000-0000-0000-0000-0000000000b6'
\set c1 '00000000-0000-0000-0000-0000000000c1'

insert into auth.users (id, email) values
  (:'admin', 'admin-75@test.local'),
  (:'finance_user', 'finance-75@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 75', 'test-org-75');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 75', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 75', 'VT75', true),
  (:'sp_finance', :'org_a', 'Finance Placeholder 75', 'FZ75', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'finance_user', 'Finance User Test 75', 'vendedor', :'sp_finance', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'finance_user', 'vendedor', true);
-- finance_user también recibe can_manage_commissions SOLO para poder
-- ejecutar TEST 1b (confirmar que la comisión lee el cobro correcto) —
-- 0073 dejó esa autoridad exclusiva de la capability, sin atajo de admin.
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'finance_user', 'can_manage_sales_order_finance', :'admin'),
  (:'org_a', :'finance_user', 'can_manage_commissions', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 75', true);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup: 4 Sales Orders (todas confirmadas, líneas libres):
--   e1 (SO-003 equivalente): total 8209.00, YA cobrada al 100% ANTES de
--     facturar — reproduce el bug reportado EXACTO.
--   e2: total 5000.00, SIN ningún cobro — flujo inverso (normal).
--   e3: total 1000.00, cobrada PARCIALMENTE (400.00) antes de facturar.
--   e4: total 100.00, SOBRE-cobrada (150.00) antes de facturar — simulada
--     vía UPDATE crudo (0076 ya rechaza este sobre-cobro por RPC; se
--     construye como dato heredado/corrupto) para el guard LEAST()
--     pedido explícitamente por el ticket.
-- =========================================================================
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-75-E1', 'quantity', 1, 'unit_price', 8209.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e1', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 8209.00);

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-75-E2', 'quantity', 1, 'unit_price', 5000.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-75-E3', 'quantity', 1, 'unit_price', 1000.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 400.00);

  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-75-E4', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');
end $$;

-- Sobre-cobro directo simulado vía UPDATE crudo (reset role) en vez de
-- rpc_register_sales_order_payment: desde 0076, ese RPC ya rechaza
-- cualquier pago que exceda sales_orders.total, así que este escenario ya
-- no es alcanzable por ningún camino normal de la app (RLS/RPC ya lo
-- impiden) — se construye aquí como si fuera un dato heredado/corrupto
-- (exactamente el tipo de caso que 0076 ahora previene hacia adelante, y
-- que motiva el script de reparación de datos ya dañados por el bug
-- original). Sigue sirviendo para probar el guard LEAST() defensivo de
-- 0075 en rpc_create_invoice.
reset role;
update sales_orders set amount_paid = 150.00 where id = '00000000-0000-0000-0000-0000000000e4';
set role authenticated;
select test_set_user('00000000-0000-0000-0000-000000000001');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1 (bug reproducido y corregido): SO-003 equivalente — total
-- 8209.00, cobrada al 100% ANTES de facturar. Al crear la factura:
--   - la factura nace DIRECTAMENTE reflejando el cobro (paid, 8209.00) sin
--     ninguna acción manual adicional.
--   - sales_orders.amount_paid permanece EXACTAMENTE en 8209.00 (nunca
--     16418.00) — el bug reportado.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so_amount_paid numeric(12,2);
  v_event_amount numeric(12,2);
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- finance_user

  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f01',
    '00000000-0000-0000-0000-0000000000e1',
    current_date + 30
  );

  if v_inv.total <> 8209.00 or v_inv.amount_paid <> 8209.00 or v_inv.status <> 'paid' then
    raise exception 'TEST 1 FALLO: la factura debió nacer reflejando el cobro existente (total=8209.00, amount_paid=8209.00, status=paid) — fue (total=%, amount_paid=%, status=%)',
      v_inv.total, v_inv.amount_paid, v_inv.status;
  end if;

  select amount_paid into v_so_amount_paid from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  if v_so_amount_paid <> 8209.00 then
    raise exception 'TEST 1 FALLO (BUG REPRODUCIDO): sales_orders.amount_paid debió permanecer en 8209.00, fue % (doble contabilización si es 16418.00)', v_so_amount_paid;
  end if;

  select amount into v_event_amount from invoice_events where invoice_id = v_inv.id and event_type = 'created';
  if v_event_amount <> 8209.00 then
    raise exception 'TEST 1 FALLO: el evento "created" debió auditar el monto importado (8209.00), fue %', v_event_amount;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 1 OK: factura creada sobre SO ya cobrada refleja el cobro sin duplicarlo — sales_orders.amount_paid permanece en 8209.00';
end $$;

-- =========================================================================
-- TEST 1b (comisión lee el valor correcto): una comisión sobre la MISMA
-- Sales Order (e1) debe leer eligible=commission_amount completo (cobro
-- 100%), nunca basado en un amount_paid duplicado.
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  select * into v_cr from rpc_create_commission_record(
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 10.00
  );
  if v_cr.commission_amount <> 820.90 or v_cr.eligible_amount <> 820.90 or v_cr.status <> 'eligible' then
    raise exception 'TEST 1b FALLO: comisión (10%% de 8209.00 = 820.90) debió nacer 100%% elegible, fue commission_amount=%, eligible=%, status=%',
      v_cr.commission_amount, v_cr.eligible_amount, v_cr.status;
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 1b OK: comisión lee el cobro correcto (8209.00 de 8209.00) — sin arrastrar la duplicación';
end $$;

-- =========================================================================
-- TEST 2: la factura ya 'paid' (TEST 1) rechaza cualquier intento
-- posterior de "volver a cobrarla" — el vector de duplicación queda
-- cerrado incluso si alguien lo intenta a mano.
-- =========================================================================
do $$
declare
  v_so_amount_paid_before numeric(12,2);
  v_so_amount_paid_after numeric(12,2);
begin
  select amount_paid into v_so_amount_paid_before from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';

  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_register_invoice_payment('00000000-0000-0000-0000-000000000f01', 8209.00);
    raise exception 'TEST 2 FALLO: no debió permitir registrar un pago sobre una factura ya reflejada como pagada';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  select amount_paid into v_so_amount_paid_after from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  if v_so_amount_paid_after <> v_so_amount_paid_before then
    raise exception 'TEST 2 FALLO: sales_orders.amount_paid no debió cambiar tras el intento rechazado (antes % después %)', v_so_amount_paid_before, v_so_amount_paid_after;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 2 OK: una factura que nació reflejando el cobro rechaza cualquier intento posterior de volver a registrarlo';
end $$;

-- =========================================================================
-- TEST 3 (flujo inverso, sin bug): SO sin ningún cobro -> crear factura
-- (nace pending/0, comportamiento IDÉNTICO a antes del fix) -> registrar
-- pago completo DESDE la factura -> sales_orders.amount_paid queda
-- sincronizado UNA sola vez.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f02',
    '00000000-0000-0000-0000-0000000000e2',
    current_date + 30
  );
  if v_inv.amount_paid <> 0 or v_inv.status <> 'pending' then
    raise exception 'TEST 3 FALLO: sin ningún cobro previo, la factura debió nacer pending/amount_paid=0 (sin cambio de comportamiento), fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_inv from rpc_register_invoice_payment(v_inv.id, 5000.00);
  if v_inv.status <> 'paid' or v_inv.amount_paid <> 5000.00 then
    raise exception 'TEST 3 FALLO: tras pagar 5000.00 desde la factura, esperado status=paid amount_paid=5000.00, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e2';
  if v_so.amount_paid <> 5000.00 then
    raise exception 'TEST 3 FALLO: sales_orders.amount_paid debió sincronizarse UNA sola vez en 5000.00, fue %', v_so.amount_paid;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 3 OK: flujo inverso (factura antes del cobro) sincroniza sales_orders.amount_paid exactamente una vez — comportamiento sin cambios';
end $$;

-- =========================================================================
-- TEST 4 (parcial pre-existente + pago posterior correcto): SO cobrada
-- 400.00 de 1000.00 ANTES de facturar. La factura nace partially_paid con
-- el 400.00 ya importado; un pago posterior de los 600.00 restantes (la
-- DIFERENCIA, nunca el monto ya importado) completa correctamente ambos
-- lados sin duplicar nada.
-- =========================================================================
do $$
declare
  v_inv invoices;
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f03',
    '00000000-0000-0000-0000-0000000000e3',
    current_date + 30
  );
  if v_inv.amount_paid <> 400.00 or v_inv.status <> 'partially_paid' then
    raise exception 'TEST 4 FALLO: con 400.00 ya cobrados de 1000.00, la factura debió nacer partially_paid/400.00, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_inv from rpc_register_invoice_payment(v_inv.id, 600.00);
  if v_inv.status <> 'paid' or v_inv.amount_paid <> 1000.00 then
    raise exception 'TEST 4 FALLO: tras pagar los 600.00 restantes, esperado status=paid amount_paid=1000.00, fue status=%, amount_paid=%', v_inv.status, v_inv.amount_paid;
  end if;

  select * into v_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e3';
  if v_so.amount_paid <> 1000.00 then
    raise exception 'TEST 4 FALLO: sales_orders.amount_paid debió quedar en 1000.00 (400 preexistente + 600 delegado), NO 1400.00, fue %', v_so.amount_paid;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 4 OK: cobro parcial preexistente importado correctamente — el pago posterior delega SOLO la diferencia (600.00), sin duplicar el 400.00 ya importado';
end $$;

-- =========================================================================
-- TEST 5 (guard LEAST — pregunta explícita del ticket): SO sobre-cobrada
-- (150.00 de 100.00) ANTES de facturar — 0068 no impide esto. La factura
-- debe nacer 'paid' con amount_paid = 100.00 (el máximo válido, NUNCA
-- 150.00) — sin violar invoices_amount_paid_not_exceed_total.
-- =========================================================================
do $$
declare
  v_inv invoices;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_inv from rpc_create_invoice(
    '00000000-0000-0000-0000-000000000f04',
    '00000000-0000-0000-0000-0000000000e4',
    current_date + 30
  );
  if v_inv.total <> 100.00 or v_inv.amount_paid <> 100.00 or v_inv.status <> 'paid' then
    raise exception 'TEST 5 FALLO: con la Sales Order sobre-cobrada (150.00/100.00), la factura debió acotar el importe a 100.00 (total) y nacer paid, fue total=%, amount_paid=%, status=%',
      v_inv.total, v_inv.amount_paid, v_inv.status;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 5 OK: guard LEAST — una Sales Order sobre-cobrada nunca produce un amount_paid de factura mayor a su total';
end $$;

select 'TODAS LAS PRUEBAS 0075 PASARON' as resultado;

rollback;
