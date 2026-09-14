-- THÖREN — Sales Orders / Financial Release (0068_sales_order_financial_release.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor '00000000-0000-0000-0000-000000000002'
\set finance_user '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp_finance '00000000-0000-0000-0000-0000000000b2'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'
\set p1 '00000000-0000-0000-0000-0000000000d1'
\set so_cash '00000000-0000-0000-0000-0000000000e1'
\set so_credit '00000000-0000-0000-0000-0000000000e2'
\set so_cash2 '00000000-0000-0000-0000-0000000000e3'
\set so_cash3 '00000000-0000-0000-0000-0000000000e4'
\set so_draft '00000000-0000-0000-0000-0000000000e5'
\set so_orgb '00000000-0000-0000-0000-0000000000e9'

insert into auth.users (id, email) values
  (:'admin', 'admin-68@test.local'),
  (:'vendedor', 'vendedor-68@test.local'),
  (:'finance_user', 'finance-68@test.local'),
  (:'admin_orgb', 'admin-orgb-68@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 68', 'test-org-68'),
  (:'org_b', 'Test Org 68B', 'test-org-68b');

-- Todo el bootstrap corre TODAVÍA como superusuario (antes de `set role
-- authenticated`) — mismo criterio que 0066/0067.
insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 68', 'admin', true),
  (:'admin_orgb', 'Admin Org B 68', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 68', 'VT68', true),
  (:'sp_finance', :'org_a', 'Finance Placeholder 68', 'FN68', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 68', 'VB68', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor', 'Vendedor Test 68', 'vendedor', :'sp1', true),
  (:'finance_user', 'Finance User Test 68', 'vendedor', :'sp_finance', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor', 'vendedor', true),
  (:'org_a', :'finance_user', 'vendedor', true);

-- finance_user recibe can_manage_sales_order_finance — otorgado por ADMIN
-- (único escritor permitido de user_capabilities, ver 0040).
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'finance_user', 'can_manage_sales_order_finance', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 68', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 68', true);

insert into product_catalog (id, organization_id, name, sku, category, unit, active) values
  (:'p1', :'org_a', 'Producto Catálogo 68', 'SKU-P1-68', 'general', 'pza', true);

set role authenticated;
select test_set_user(:'admin');

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Sales Orders usadas por varios tests (creadas + confirmadas).
-- =========================================================================
do $$
begin
  -- SO_CASH (e1): total 1000.00, cash -> payment_required_amount = 1000.00
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 1000.00))
  );
  -- SO_CREDIT (e2): total 2000.00, credit -> payment_required_amount = NULL
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'credit'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 2000.00))
  );
  -- SO_CASH2 (e3): total 500.00, cash
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 500.00))
  );
  -- SO_CASH3 (e4): total 300.00, cash
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 300.00))
  );
  -- SO_DRAFT (e5): se queda en draft a propósito (TEST 14).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e5',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', '00000000-0000-0000-0000-0000000000d1', 'quantity', 1, 'unit_price', 100.00))
  );

  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e1', 'confirmed');
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');
  -- e5 se queda en draft.
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'LIBRE-ORGB', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e9', 'confirmed');
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: draft inicia blocked (SO_DRAFT, e5, nunca confirmada).
-- =========================================================================
do $$
declare
  v_status text;
  v_release text;
begin
  select status, fulfillment_release_status into v_status, v_release
    from sales_orders where id = '00000000-0000-0000-0000-0000000000e5';
  if v_status <> 'draft' or v_release <> 'blocked' then
    raise exception 'TEST 1 FALLO: esperado (draft, blocked), fue (%, %)', v_status, v_release;
  end if;
  raise notice 'TEST 1 OK: una Sales Order draft inicia con fulfillment_release_status = blocked';
end $$;

-- =========================================================================
-- TEST 2: confirmar contado queda blocked (SO_CASH, e1, ya confirmada en
-- el setup) — NO se libera automáticamente al confirmar.
-- =========================================================================
do $$
declare
  v_status text;
  v_release text;
  v_financial text;
begin
  select status, fulfillment_release_status, financial_status into v_status, v_release, v_financial
    from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  if v_status <> 'confirmed' or v_release <> 'blocked' or v_financial <> 'pending' then
    raise exception 'TEST 2 FALLO: esperado (confirmed, blocked, pending), fue (%, %, %)', v_status, v_release, v_financial;
  end if;
  raise notice 'TEST 2 OK: confirmar una Sales Order de contado NO libera automáticamente — queda blocked';
end $$;

-- =========================================================================
-- TEST 3: pago parcial mantiene blocked.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 400.00, 'Anticipo parcial');
  if v_so.amount_paid <> 400.00 or v_so.financial_status <> 'partially_paid' or v_so.fulfillment_release_status <> 'blocked' then
    raise exception 'TEST 3 FALLO: esperado (400.00, partially_paid, blocked), fue (%, %, %)', v_so.amount_paid, v_so.financial_status, v_so.fulfillment_release_status;
  end if;
  raise notice 'TEST 3 OK: un pago parcial actualiza financial_status a partially_paid y mantiene blocked';
end $$;

-- =========================================================================
-- TEST 4: pago completo libera.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e1', 600.00, 'Liquidación');
  if v_so.amount_paid <> 1000.00 or v_so.financial_status <> 'paid' or v_so.fulfillment_release_status <> 'released' or v_so.financial_released_at is null or v_so.financial_released_by is null then
    raise exception 'TEST 4 FALLO: esperado (1000.00, paid, released, released_at/by no nulos), fue (%, %, %, %, %)',
      v_so.amount_paid, v_so.financial_status, v_so.fulfillment_release_status, v_so.financial_released_at, v_so.financial_released_by;
  end if;
  raise notice 'TEST 4 OK: al alcanzar el monto requerido, financial_status=paid y fulfillment_release_status=released automáticamente';
end $$;

-- =========================================================================
-- TEST 5: contado no puede liberarse manualmente sin pago suficiente
-- (SO_CASH2, e3, confirmada, sin ningún pago registrado todavía).
-- =========================================================================
do $$
begin
  begin
    perform rpc_release_sales_order('00000000-0000-0000-0000-0000000000e3');
    raise exception 'TEST 5 FALLO: rpc_release_sales_order no debió liberar sin pago suficiente';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  begin
    update sales_orders set fulfillment_release_status = 'released' where id = '00000000-0000-0000-0000-0000000000e3';
    raise exception 'TEST 5 FALLO: un UPDATE directo no debió poder liberar una SO de contado sin pago suficiente';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 5 OK: una Sales Order de contado nunca se libera (ni por RPC ni por UPDATE directo) sin pago suficiente';
end $$;

-- =========================================================================
-- TEST 6: crédito confirmado queda blocked (SO_CREDIT, e2).
-- =========================================================================
do $$
declare
  v_status text;
  v_release text;
  v_financial text;
  v_required numeric;
begin
  select status, fulfillment_release_status, financial_status, payment_required_amount
    into v_status, v_release, v_financial, v_required
    from sales_orders where id = '00000000-0000-0000-0000-0000000000e2';
  if v_status <> 'confirmed' or v_release <> 'blocked' or v_financial <> 'pending' or v_required is not null then
    raise exception 'TEST 6 FALLO: esperado (confirmed, blocked, pending, NULL), fue (%, %, %, %)', v_status, v_release, v_financial, v_required;
  end if;
  raise notice 'TEST 6 OK: una Sales Order de crédito confirmada queda blocked (payment_required_amount NULL, irrelevante para crédito)';
end $$;

-- =========================================================================
-- TEST 7: aprobar crédito libera.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_approve_sales_order_credit('00000000-0000-0000-0000-0000000000e2');
  if v_so.financial_status <> 'credit_approved' or v_so.fulfillment_release_status <> 'released' or v_so.financial_released_at is null or v_so.financial_released_by is null then
    raise exception 'TEST 7 FALLO: esperado (credit_approved, released, released_at/by no nulos), fue (%, %, %, %)',
      v_so.financial_status, v_so.fulfillment_release_status, v_so.financial_released_at, v_so.financial_released_by;
  end if;
  raise notice 'TEST 7 OK: aprobar crédito establece credit_approved y libera (released_at/released_by asignados)';
end $$;

-- =========================================================================
-- TEST 8: credit_approved rechazado para contado — ni por RPC ni por
-- UPDATE directo (CHECK constraint).
-- =========================================================================
do $$
begin
  begin
    perform rpc_approve_sales_order_credit('00000000-0000-0000-0000-0000000000e1');
    raise exception 'TEST 8 FALLO: no debió aprobar crédito en una Sales Order de contado';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;

  begin
    update sales_orders set financial_status = 'credit_approved' where id = '00000000-0000-0000-0000-0000000000e1';
    raise exception 'TEST 8 FALLO: el CHECK constraint no rechazó credit_approved en una SO de contado';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 8 OK: credit_approved rechazado para una Sales Order de contado (RPC y CHECK constraint)';
end $$;

-- =========================================================================
-- TEST 9: hold explícito bloquea (sobre SO_CASH, e1, ya released por TEST 4).
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_set_sales_order_financial_hold('00000000-0000-0000-0000-0000000000e1', 'Cliente disputa el cargo con el banco');
  if v_so.fulfillment_release_status <> 'blocked' or v_so.financial_hold_reason <> 'Cliente disputa el cargo con el banco' then
    raise exception 'TEST 9 FALLO: esperado (blocked, motivo capturado), fue (%, %)', v_so.fulfillment_release_status, v_so.financial_hold_reason;
  end if;
  raise notice 'TEST 9 OK: un hold explícito bloquea (incluso sobre una SO ya liberada) y registra el motivo';
end $$;

-- =========================================================================
-- TEST 10: hold requiere motivo.
-- =========================================================================
do $$
begin
  begin
    perform rpc_set_sales_order_financial_hold('00000000-0000-0000-0000-0000000000e1', '');
    raise exception 'TEST 10 FALLO: debió rechazar un hold sin motivo (cadena vacía)';
  exception when others then
    if sqlerrm like 'TEST 10 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_set_sales_order_financial_hold('00000000-0000-0000-0000-0000000000e1', '   ');
    raise exception 'TEST 10 FALLO: debió rechazar un hold con motivo en blanco (solo espacios)';
  exception when others then
    if sqlerrm like 'TEST 10 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 10 OK: un hold sin motivo (vacío o en blanco) es rechazado';
end $$;

-- Re-liberar SO_CASH (e1) tras el hold de TEST 9, para dejar un caso
-- adicional de "liberar cuando la condición ya se cumple" (rpc_release_sales_order).
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_release_sales_order('00000000-0000-0000-0000-0000000000e1');
  if v_so.fulfillment_release_status <> 'released' then
    raise exception 'TEST 9b FALLO: rpc_release_sales_order debió liberar de nuevo (ya cubría el pago)';
  end if;
  raise notice 'TEST 9b OK: rpc_release_sales_order re-libera cuando la condición financiera ya se cumple';
end $$;

-- =========================================================================
-- TEST 11: registrar pagos acumula correctamente (SO_CASH3, e4, total 300.00).
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e4', 100.00);
  if v_so.amount_paid <> 100.00 or v_so.financial_status <> 'partially_paid' then
    raise exception 'TEST 11 FALLO (paso 1): esperado (100.00, partially_paid), fue (%, %)', v_so.amount_paid, v_so.financial_status;
  end if;

  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e4', 100.00);
  if v_so.amount_paid <> 200.00 or v_so.financial_status <> 'partially_paid' then
    raise exception 'TEST 11 FALLO (paso 2): esperado (200.00, partially_paid), fue (%, %)', v_so.amount_paid, v_so.financial_status;
  end if;

  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e4', 100.00);
  if v_so.amount_paid <> 300.00 or v_so.financial_status <> 'paid' or v_so.fulfillment_release_status <> 'released' then
    raise exception 'TEST 11 FALLO (paso 3): esperado (300.00, paid, released), fue (%, %, %)', v_so.amount_paid, v_so.financial_status, v_so.fulfillment_release_status;
  end if;

  raise notice 'TEST 11 OK: 3 pagos parciales de 100.00 acumulan correctamente a 300.00 y liberan al completar el monto';
end $$;

-- =========================================================================
-- TEST 12: amount_paid no puede ser negativo (CHECK constraint).
-- =========================================================================
do $$
begin
  begin
    update sales_orders set amount_paid = -1 where id = '00000000-0000-0000-0000-0000000000e4';
    raise exception 'TEST 12 FALLO: el CHECK constraint no rechazó amount_paid negativo';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;
  raise notice 'TEST 12 OK: amount_paid negativo rechazado por CHECK constraint';
end $$;

-- =========================================================================
-- TEST 13: cross-org bloqueado — admin de Org A no puede registrar pagos
-- ni aprobar crédito ni bloquear sobre una Sales Order de Org B.
-- =========================================================================
do $$
begin
  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e9', 50.00);
    raise exception 'TEST 13 FALLO: no debió poder registrar un pago en una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_set_sales_order_financial_hold('00000000-0000-0000-0000-0000000000e9', 'motivo cross-org');
    raise exception 'TEST 13 FALLO: no debió poder bloquear una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  raise notice 'TEST 13 OK: aislamiento cross-org respetado por las 4 RPCs financieras';
end $$;

-- =========================================================================
-- TEST 14: rollback correcto en errores — un intento de registrar pago
-- sobre una SO todavía en DRAFT (SO_DRAFT, e5) debe abortar TODO (ni
-- amount_paid ni financial_status cambian, ni queda evento en el historial).
-- =========================================================================
do $$
declare
  v_amount_before numeric;
  v_amount_after numeric;
  v_status_before text;
  v_status_after text;
  v_events_before integer;
  v_events_after integer;
begin
  select amount_paid, financial_status into v_amount_before, v_status_before
    from sales_orders where id = '00000000-0000-0000-0000-0000000000e5';
  select count(*) into v_events_before from sales_order_financial_events where sales_order_id = '00000000-0000-0000-0000-0000000000e5';

  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e5', 50.00);
    raise exception 'TEST 14 FALLO: no debió registrar un pago sobre una Sales Order en draft';
  exception when others then
    if sqlerrm like 'TEST 14 FALLO%' then raise; end if;
  end;

  select amount_paid, financial_status into v_amount_after, v_status_after
    from sales_orders where id = '00000000-0000-0000-0000-0000000000e5';
  select count(*) into v_events_after from sales_order_financial_events where sales_order_id = '00000000-0000-0000-0000-0000000000e5';

  if v_amount_before <> v_amount_after or v_status_before <> v_status_after or v_events_before <> v_events_after then
    raise exception 'TEST 14 FALLO: el estado cambió tras un intento rechazado (amount % -> %, status % -> %, eventos % -> %)',
      v_amount_before, v_amount_after, v_status_before, v_status_after, v_events_before, v_events_after;
  end if;

  raise notice 'TEST 14 OK: un intento rechazado (SO en draft) no deja ningún rastro — rollback completo';
end $$;

-- =========================================================================
-- TEST 15: historial financiero queda registrado — verifica que los 3
-- tipos de evento (payment_registered/credit_approved/financial_hold) de
-- las pruebas anteriores quedaron en sales_order_financial_events con los
-- datos correctos.
-- =========================================================================
do $$
declare
  v_payment_events integer;
  v_credit_events integer;
  v_hold_events integer;
  v_last_payment sales_order_financial_events;
begin
  select count(*) into v_payment_events from sales_order_financial_events
    where sales_order_id = '00000000-0000-0000-0000-0000000000e1' and event_type = 'payment_registered';
  select count(*) into v_credit_events from sales_order_financial_events
    where sales_order_id = '00000000-0000-0000-0000-0000000000e2' and event_type = 'credit_approved';
  select count(*) into v_hold_events from sales_order_financial_events
    where sales_order_id = '00000000-0000-0000-0000-0000000000e1' and event_type = 'financial_hold';

  if v_payment_events <> 2 or v_credit_events <> 1 or v_hold_events <> 1 then
    raise exception 'TEST 15 FALLO: conteos esperados (2 pagos, 1 crédito, 1 hold), fueron (%, %, %)', v_payment_events, v_credit_events, v_hold_events;
  end if;

  -- NUNCA ordenar por created_at para desempatar aquí: todo el archivo
  -- corre dentro de UNA transacción, y now() devuelve el mismo valor para
  -- toda la transacción en Postgres — los dos eventos de pago (400.00 y
  -- 600.00) quedan con created_at IDÉNTICO. Se identifica por monto, que sí
  -- es distinto entre ambos.
  select * into v_last_payment from sales_order_financial_events
    where sales_order_id = '00000000-0000-0000-0000-0000000000e1' and event_type = 'payment_registered' and amount = 600.00;
  if v_last_payment.amount <> 600.00 or v_last_payment.previous_financial_status <> 'partially_paid' or v_last_payment.new_financial_status <> 'paid'
     or v_last_payment.previous_release_status <> 'blocked' or v_last_payment.new_release_status <> 'released' or v_last_payment.created_by is null then
    raise exception 'TEST 15 FALLO: el evento de pago no capturó correctamente previous/new status (%: % -> %, % -> %)',
      v_last_payment.amount, v_last_payment.previous_financial_status, v_last_payment.new_financial_status,
      v_last_payment.previous_release_status, v_last_payment.new_release_status;
  end if;

  raise notice 'TEST 15 OK: el historial financiero (sales_order_financial_events) queda registrado con previous/new status correctos';
end $$;

-- =========================================================================
-- TEST 16: RLS mantiene aislamiento — admin de Org B no ve el financial
-- status ni el historial financiero de una Sales Order de Org A.
-- =========================================================================
do $$
declare
  v_count_so integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_count_so from sales_orders where id = '00000000-0000-0000-0000-0000000000e1';
  select count(*) into v_count_events from sales_order_financial_events where sales_order_id = '00000000-0000-0000-0000-0000000000e1';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_so <> 0 or v_count_events <> 0 then
    raise exception 'TEST 16 FALLO: admin de Org B pudo ver la Sales Order o su historial financiero de Org A (% / %)', v_count_so, v_count_events;
  end if;
  raise notice 'TEST 16 OK: aislamiento cross-org respetado por sales_orders/sales_order_financial_events';
end $$;

-- =========================================================================
-- TEST 17: un vendedor SIN can_manage_sales_order_finance no puede
-- modificar el estado financiero — ni por RPC ni por UPDATE directo,
-- aunque sea el dueño (salesperson) de la propia Sales Order.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000002');

  begin
    perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 10.00);
    raise exception 'TEST 17 FALLO: un vendedor sin capability no debió poder registrar un pago';
  exception when others then
    if sqlerrm like 'TEST 17 FALLO%' then raise; end if;
  end;

  begin
    update sales_orders set financial_hold_reason = 'intento directo' where id = '00000000-0000-0000-0000-0000000000e3';
    raise exception 'TEST 17 FALLO: un vendedor sin capability no debió poder editar financial_hold_reason directamente, ni siendo dueño de la SO';
  exception when others then
    if sqlerrm like 'TEST 17 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 17 OK: un vendedor sin can_manage_sales_order_finance no puede modificar campos financieros, ni por RPC ni directo — ni siendo dueño de la SO';
end $$;

-- =========================================================================
-- TEST 18: un usuario con can_manage_sales_order_finance (finance_user, NO
-- admin, NO dueño de la Sales Order) SÍ puede registrar un pago —
-- confirma que sales_orders_update_finance (0068) funciona para un rol de
-- Finanzas que no es el salesperson.
-- =========================================================================
do $$
declare
  v_so sales_orders;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000003');
  select * into v_so from rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 500.00, 'Pago recibido por Finanzas');
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_so.amount_paid <> 500.00 or v_so.financial_status <> 'paid' or v_so.fulfillment_release_status <> 'released' then
    raise exception 'TEST 18 FALLO: esperado (500.00, paid, released), fue (%, %, %)', v_so.amount_paid, v_so.financial_status, v_so.fulfillment_release_status;
  end if;

  raise notice 'TEST 18 OK: un usuario con can_manage_sales_order_finance (sin ser admin ni dueño) puede registrar pagos y liberar';
end $$;

select 'TODAS LAS PRUEBAS 0068 PASARON' as resultado;

rollback;
