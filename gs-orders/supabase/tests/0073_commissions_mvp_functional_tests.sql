-- THÖREN — Comisiones privadas de Dirección MVP (0073_commissions_mvp.sql)
-- — pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas
-- — no depende de la cadena de fixtures de fases anteriores. Todo el
-- script corre en una transacción que se revierte al final (rollback).

begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor_user '00000000-0000-0000-0000-000000000002'
\set director_user '00000000-0000-0000-0000-000000000006'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set org_a '00000000-0000-0000-0000-0000000000a1'
\set org_b '00000000-0000-0000-0000-0000000000a2'
\set sp1 '00000000-0000-0000-0000-0000000000b1'
\set sp2 '00000000-0000-0000-0000-0000000000b2'
\set sp_director '00000000-0000-0000-0000-0000000000b6'
\set sp_orgb '00000000-0000-0000-0000-0000000000b9'
\set c1 '00000000-0000-0000-0000-0000000000c1'
\set c_orgb '00000000-0000-0000-0000-0000000000c9'

insert into auth.users (id, email) values
  (:'admin', 'admin-73@test.local'),
  (:'vendedor_user', 'vendedor-73@test.local'),
  (:'director_user', 'director-73@test.local'),
  (:'admin_orgb', 'admin-orgb-73@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 73', 'test-org-73'),
  (:'org_b', 'Test Org 73B', 'test-org-73b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 73', 'admin', true),
  (:'admin_orgb', 'Admin Org B 73', 'admin', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Test 73', 'VT73', true),
  (:'sp2', :'org_a', 'Vend Referido 73', 'VR73', true),
  (:'sp_director', :'org_a', 'Director Placeholder 73', 'DR73', true),
  (:'sp_orgb', :'org_b', 'Vend Org B 73', 'VB73', true);

-- vendedor_user: dueño comercial de SO_MAIN vía sp1, SIN
-- can_manage_commissions — representa al vendedor que el ticket dice que
-- NUNCA debe poder ver montos/porcentajes/pagos de su propia comisión.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_user', 'Vendedor Test 73', 'vendedor', :'sp1', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_user', 'vendedor', true);

-- director_user: SOLO can_manage_commissions (NO admin, NO dueño de
-- ninguna Sales Order) — representa a Dirección General. Se usa para el
-- camino positivo, probando que la capability por sí sola basta (no hace
-- falta ser admin).
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'director_user', 'Director Test 73', 'vendedor', :'sp_director', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'director_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'director_user', 'can_manage_commissions', :'admin');

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 73', true),
  (:'c_orgb', :'org_b', 'Cliente Org B 73', true);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup de Sales Orders — líneas libres (sin catalog_product_id):
-- comisiones no toca inventario.
-- =========================================================================
set role authenticated;
select test_set_user(:'admin');

do $$
begin
  -- SO_DRAFT (e1): nunca se confirma.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e1',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E1', 'quantity', 1, 'unit_price', 100.00))
  );

  -- SO_CANCELLED (e2): confirmada y luego cancelada.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e2',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E2', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'confirmed');
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e2', 'cancelled');

  -- SO_MAIN (e3): confirmada -> total 1000.00, sin pagos todavía.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e3',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'credit'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E3', 'quantity', 10, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e3', 'confirmed');

  -- SO_SPLIT (e4): confirmada -> total 500.00, ya cobrada al 100% desde el
  -- inicio (para que el split nazca elegible de una vez).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e4',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E4', 'quantity', 5, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e4', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e4', 500.00);

  -- SO_ROLLBACK (e5): confirmada -> total 200.00, cobrada al 100%.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e5',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E5', 'quantity', 2, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e5', 'confirmed');
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e5', 200.00);

  -- SO_CANCEL_TEST (e6): confirmada -> total 300.00, sin pagos.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e6',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E6', 'quantity', 3, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e6', 'confirmed');

  -- SO_AUTH_TEST (e7): confirmada -> total 100.00, sin pagos. Dedicada a
  -- la matriz de autoridad (TEST 16) — necesita una comisión en un
  -- estado limpio (pending, sin pagos) para que un intento de escritura
  -- rechazado se deba INEQUÍVOCAMENTE a falta de autoridad, no a una
  -- regla de negocio (p.ej. "ya pagada").
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e7',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c1', 'salesperson_id', '00000000-0000-0000-0000-0000000000b1', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-E7', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e7', 'confirmed');
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  -- SO_ORGB (e9): confirmada en Org B -> total 100.00.
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-0000000000e9',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-0000000000c9', 'salesperson_id', '00000000-0000-0000-0000-0000000000b9', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-73-ORGB', 'quantity', 1, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-0000000000e9', 'confirmed');
end $$;
select test_set_user(:'admin');

select 'SETUP OK' as marker;

-- =========================================================================
-- TEST 1: creación — director_user (SOLO can_manage_commissions, no admin)
-- crea una comisión sobre SO_MAIN (total 1000.00, sin pagos todavía):
-- snapshot correcto, base=subtotal por defecto, monto calculado, status
-- inicial pending (nada cobrado todavía).
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- director_user

  select * into v_cr from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000000f01',
    '00000000-0000-0000-0000-0000000000e3',
    '00000000-0000-0000-0000-0000000000b1',
    10.00
  );

  if v_cr.commission_base <> 1000.00 or v_cr.commission_rate <> 10.00 or v_cr.commission_amount <> 100.00 then
    raise exception 'TEST 1 FALLO: base/tasa/monto incorrectos (base=%, rate=%, amount=%)', v_cr.commission_base, v_cr.commission_rate, v_cr.commission_amount;
  end if;
  if v_cr.status <> 'pending' or v_cr.eligible_amount <> 0 or v_cr.paid_amount <> 0 then
    raise exception 'TEST 1 FALLO: sin cobro todavía, debió nacer pending/eligible=0/paid=0 (status=%, eligible=%, paid=%)', v_cr.status, v_cr.eligible_amount, v_cr.paid_amount;
  end if;
  if v_cr.commission_rule_snapshot is null then
    raise exception 'TEST 1 FALLO: commission_rule_snapshot no debió quedar null';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 1 OK: creación válida — Dirección (solo capability, sin ser admin) crea la comisión desde la Sales Order';
end $$;

-- =========================================================================
-- TEST 2: snapshot inmutable — identidad/base/tasa/monto/rule_snapshot no
-- se pueden modificar tras crear (mismo criterio que invoices, 0072).
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- director_user

  begin
    update commission_records set commission_rate = 50 where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 2 FALLO: no debió permitir modificar commission_rate';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  begin
    update commission_records set commission_base = 1.00 where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 2 FALLO: no debió permitir modificar commission_base';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  begin
    update commission_records set commission_amount = 1.00 where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 2 FALLO: no debió permitir modificar commission_amount';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  begin
    update commission_records set salesperson_id = '00000000-0000-0000-0000-0000000000b2' where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 2 FALLO: no debió permitir cambiar el vendedor de una comisión ya creada';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  begin
    update commission_records set commission_rule_snapshot = '{}'::jsonb where id = '00000000-0000-0000-0000-000000000f01';
    raise exception 'TEST 2 FALLO: no debió permitir modificar el snapshot de la regla';
  exception when others then
    if sqlerrm like 'TEST 2 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 2 OK: snapshot de regla/tasa/base/monto/vendedor inmutable tras crear';
end $$;

-- =========================================================================
-- TEST 3: SO draft no puede generar comisión.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 5.00);
    raise exception 'TEST 3 FALLO: no debió poder crear una comisión sobre una Sales Order en draft';
  exception when others then
    if sqlerrm like 'TEST 3 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 3 OK: SO draft no puede generar comisión';
end $$;

-- =========================================================================
-- TEST 4: SO cancelada no puede generar comisión.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b1', 5.00);
    raise exception 'TEST 4 FALLO: no debió poder crear una comisión sobre una Sales Order cancelada';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 4 OK: SO cancelada no puede generar comisión';
end $$;

-- =========================================================================
-- TEST 5: cross-org bloqueado al crear — director_user (Org A) no puede
-- crear una comisión sobre una Sales Order de Org B.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000b1', 5.00);
    raise exception 'TEST 5 FALLO: no debió poder crear una comisión sobre una Sales Order de otra organización';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 5 OK: cross-org bloqueado al crear comisión';
end $$;

-- =========================================================================
-- TEST 6: liberación por cobro — SO_MAIN recibe un pago de 500.00 (de
-- 1000.00). rpc_refresh_commission_eligibility recalcula
-- eligible_amount = round(100 × 500/1000, 2) = 50.00 y el status pasa a
-- 'eligible' — proporcional al cobro real, tal como pide el ticket.
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 500.00);

  perform test_set_user('00000000-0000-0000-0000-000000000006');
  perform rpc_refresh_commission_eligibility('00000000-0000-0000-0000-0000000000a1');

  select * into v_cr from commission_records where id = '00000000-0000-0000-0000-000000000f01';
  if v_cr.status <> 'eligible' or v_cr.eligible_amount <> 50.00 then
    raise exception 'TEST 6 FALLO: tras cobrar 50%% del total, esperado status=eligible eligible_amount=50.00 (status=%, eligible=%)', v_cr.status, v_cr.eligible_amount;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 6 OK: liberación por cobro — comisión proporcional al pago parcial del cliente (50.00 de 100.00)';
end $$;

-- =========================================================================
-- TEST 7: pago parcial de comisión — se paga 30.00 de los 50.00 ya
-- elegibles; status pasa a partially_paid.
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  select * into v_cr from rpc_register_commission_payment('00000000-0000-0000-0000-000000000f01', 30.00);
  if v_cr.status <> 'partially_paid' or v_cr.paid_amount <> 30.00 then
    raise exception 'TEST 7 FALLO: tras pagar 30.00, esperado status=partially_paid paid_amount=30.00 (status=%, paid=%)', v_cr.status, v_cr.paid_amount;
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 7 OK: pago parcial de comisión aplicado correctamente';
end $$;

-- =========================================================================
-- TEST 8: sobrepago rechazado CONTRA LO ELEGIBLE (no solo contra el
-- monto total) — quedan 20.00 elegibles pendientes (50.00 - 30.00); un
-- intento de pagar 25.00 se rechaza aunque 25.00 < commission_amount
-- (100.00) — es la regla real: "liberación ligada a cobro real".
-- =========================================================================
do $$
declare
  v_paid_before numeric(12,2);
begin
  select paid_amount into v_paid_before from commission_records where id = '00000000-0000-0000-0000-000000000f01';

  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_register_commission_payment('00000000-0000-0000-0000-000000000f01', 25.00);
    raise exception 'TEST 8 FALLO: no debió permitir pagar 25.00 cuando solo hay 20.00 elegibles pendientes (aunque 25.00 < comisión total)';
  exception when others then
    if sqlerrm like 'TEST 8 FALLO%' then raise; end if;
  end;

  if (select paid_amount from commission_records where id = '00000000-0000-0000-0000-000000000f01') <> v_paid_before then
    raise exception 'TEST 8 FALLO: paid_amount no debió cambiar tras el intento rechazado';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 8 OK: sobrepago rechazado contra el saldo elegible real, no solo contra el tope nominal';
end $$;

-- =========================================================================
-- TEST 9: pago completo — SO_MAIN se termina de cobrar (500.00 más, total
-- 1000.00 pagado); el pago de comisión de los 70.00 restantes (100.00 -
-- 30.00) se acepta porque rpc_register_commission_payment recalcula
-- eligible_amount EN VIVO (ya no depende de un refresh previo) — la
-- comisión queda 'paid'.
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform rpc_register_sales_order_payment('00000000-0000-0000-0000-0000000000e3', 500.00);

  perform test_set_user('00000000-0000-0000-0000-000000000006');
  select * into v_cr from rpc_register_commission_payment('00000000-0000-0000-0000-000000000f01', 70.00);
  if v_cr.status <> 'paid' or v_cr.paid_amount <> 100.00 or v_cr.eligible_amount <> 100.00 then
    raise exception 'TEST 9 FALLO: tras completar el cobro y pagar el resto, esperado status=paid paid=100.00 eligible=100.00 (status=%, paid=%, eligible=%)', v_cr.status, v_cr.paid_amount, v_cr.eligible_amount;
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 9 OK: pago completo — comisión totalmente liberada y pagada';
end $$;

-- =========================================================================
-- TEST 10: pago sobre comisión ya pagada rechazado.
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  begin
    perform rpc_register_commission_payment('00000000-0000-0000-0000-000000000f01', 0.01);
    raise exception 'TEST 10 FALLO: no debió permitir ningún pago sobre una comisión ya pagada en su totalidad';
  exception when others then
    if sqlerrm like 'TEST 10 FALLO%' then raise; end if;
  end;
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 10 OK: una comisión pagada en su totalidad rechaza cualquier pago adicional';
end $$;

-- =========================================================================
-- TEST 11: cancelación explícita — motivo obligatorio, éxito con motivo,
-- rechazo de cancelar una comisión ya pagada.
-- =========================================================================
do $$
declare
  v_cr commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_cr from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000000f06',
    '00000000-0000-0000-0000-0000000000e6',
    '00000000-0000-0000-0000-0000000000b1',
    5.00
  );

  begin
    perform rpc_cancel_commission_record(v_cr.id, null);
    raise exception 'TEST 11 FALLO: no debió permitir cancelar sin motivo';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  select * into v_cr from rpc_cancel_commission_record(v_cr.id, 'Sales Order anulada comercialmente.');
  if v_cr.status <> 'cancelled' or v_cr.cancellation_reason is distinct from 'Sales Order anulada comercialmente.' then
    raise exception 'TEST 11 FALLO: la comisión debió quedar cancelled con el motivo registrado (status=%, motivo=%)', v_cr.status, v_cr.cancellation_reason;
  end if;

  begin
    perform rpc_cancel_commission_record('00000000-0000-0000-0000-000000000f01', 'Intento sobre comisión ya pagada.');
    raise exception 'TEST 11 FALLO: no debió permitir cancelar una comisión ya pagada en su totalidad';
  exception when others then
    if sqlerrm like 'TEST 11 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 11 OK: cancelación explícita — motivo obligatorio, éxito auditado, rechazo sobre comisión pagada';
end $$;

-- =========================================================================
-- TEST 12: split de comisión — SO_SPLIT (ya 100%% cobrada) genera DOS
-- comisiones activas para DOS vendedores distintos (sp1 y sp2, aunque la
-- Sales Order solo tiene un salesperson_id "dueño") — ambas nacen
-- elegibles de inmediato. Un segundo intento para el MISMO vendedor sobre
-- la MISMA Sales Order se rechaza (a lo sumo una comisión activa por par
-- Sales Order/vendedor).
-- =========================================================================
do $$
declare
  v_cr_sp1 commission_records;
  v_cr_sp2 commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_cr_sp1 from rpc_create_commission_record(
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b1', 8.00
  );
  select * into v_cr_sp2 from rpc_create_commission_record(
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b2', 2.00
  );

  if v_cr_sp1.status <> 'eligible' or v_cr_sp1.commission_amount <> 40.00 then
    raise exception 'TEST 12 FALLO: comisión del vendedor dueño (8%% de 500.00) debió nacer eligible=40.00, fue status=%, amount=%', v_cr_sp1.status, v_cr_sp1.commission_amount;
  end if;
  if v_cr_sp2.status <> 'eligible' or v_cr_sp2.commission_amount <> 10.00 then
    raise exception 'TEST 12 FALLO: comisión del vendedor referido (2%% de 500.00) debió nacer eligible=10.00, fue status=%, amount=%', v_cr_sp2.status, v_cr_sp2.commission_amount;
  end if;

  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000b1', 3.00);
    raise exception 'TEST 12 FALLO: no debió permitir una segunda comisión activa para el MISMO vendedor sobre la MISMA Sales Order';
  exception when others then
    if sqlerrm like 'TEST 12 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 12 OK: split de comisión entre vendedores distintos funciona; duplicado para el mismo vendedor rechazado';
end $$;

-- =========================================================================
-- TEST 13: vendedor sin acceso — vendedor_user (dueño comercial de
-- SO_MAIN vía sp1, SIN can_manage_commissions) NO puede ver NINGÚN dato
-- de comisión (ni siquiera la SUYA propia) ni llamar ningún RPC de
-- comisiones.
-- =========================================================================
do $$
declare
  v_visible_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000002'); -- vendedor_user

  select count(*) into v_visible_count from commission_records where id = '00000000-0000-0000-0000-000000000f01';
  if v_visible_count <> 0 then
    raise exception 'TEST 13 FALLO: el vendedor NO debió poder ver su propia comisión (montos/porcentajes/pagos son privados de Dirección)';
  end if;

  select count(*) into v_visible_count from commission_events where commission_record_id = '00000000-0000-0000-0000-000000000f01';
  if v_visible_count <> 0 then
    raise exception 'TEST 13 FALLO: el vendedor NO debió poder ver el historial de su propia comisión';
  end if;

  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000b1', 5.00);
    raise exception 'TEST 13 FALLO: un vendedor sin can_manage_commissions no debió poder crear una comisión';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_register_commission_payment('00000000-0000-0000-0000-000000000f01', 1.00);
    raise exception 'TEST 13 FALLO: un vendedor sin can_manage_commissions no debió poder registrar un pago de comisión';
  exception when others then
    if sqlerrm like 'TEST 13 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 13 OK: un vendedor (incluso el dueño comercial de la Sales Order) no ve ni gestiona comisiones sin can_manage_commissions';
end $$;

-- =========================================================================
-- TEST 14: RLS cross-org — admin de Org B no ve comisiones/eventos de
-- Org A.
-- =========================================================================
do $$
declare
  v_count_cr integer;
  v_count_events integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009'); -- admin_orgb
  select count(*) into v_count_cr from commission_records where id = '00000000-0000-0000-0000-000000000f01';
  select count(*) into v_count_events from commission_events where commission_record_id = '00000000-0000-0000-0000-000000000f01';
  perform test_set_user('00000000-0000-0000-0000-000000000001');

  if v_count_cr <> 0 or v_count_events <> 0 then
    raise exception 'TEST 14 FALLO: admin de Org B pudo ver datos de una comisión de Org A (%/%)', v_count_cr, v_count_events;
  end if;
  raise notice 'TEST 14 OK: aislamiento cross-org respetado por commission_records/commission_events';
end $$;

-- =========================================================================
-- TEST 15: rollback / sin escritura parcial — SO_ROLLBACK ya 100%% cobrada
-- (200.00 de 200.00); comisión de 50.00 creada y nace 'eligible' de
-- inmediato con eligible_amount=50.00. Un intento de pago de 999.00
-- (sobrepago extremo) se rechaza ANTES de cualquier escritura: ni
-- paid_amount/eligible_amount/status cambian NI se inserta ningún evento
-- nuevo en commission_events — la validación completa (incluyendo el
-- recálculo EN VIVO de elegibilidad) ocurre íntegramente antes del primer
-- UPDATE/INSERT, por lo que un rechazo nunca deja rastro parcial.
-- =========================================================================
do $$
declare
  v_cr commission_records;
  v_events_before integer;
  v_events_after integer;
  v_paid_after numeric(12,2);
  v_eligible_after numeric(12,2);
  v_status_after text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006');

  select * into v_cr from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000000f15',
    '00000000-0000-0000-0000-0000000000e5',
    '00000000-0000-0000-0000-0000000000b1',
    25.00
  );
  if v_cr.status <> 'eligible' or v_cr.eligible_amount <> 50.00 then
    raise exception 'TEST 15 FALLO (setup): esperado eligible=50.00 al nacer ya cobrada, fue status=%, eligible=%', v_cr.status, v_cr.eligible_amount;
  end if;

  select count(*) into v_events_before from commission_events where commission_record_id = v_cr.id;

  begin
    perform rpc_register_commission_payment(v_cr.id, 999.00);
    raise exception 'TEST 15 FALLO: no debió permitir un sobrepago extremo (999.00 sobre 50.00 elegibles)';
  exception when others then
    if sqlerrm like 'TEST 15 FALLO%' then raise; end if;
  end;

  select count(*) into v_events_after from commission_events where commission_record_id = v_cr.id;
  select paid_amount, eligible_amount, status into v_paid_after, v_eligible_after, v_status_after from commission_records where id = v_cr.id;

  if v_events_after <> v_events_before then
    raise exception 'TEST 15 FALLO: el intento rechazado NO debió insertar ningún evento nuevo (antes % después %)', v_events_before, v_events_after;
  end if;
  if v_paid_after <> 0 or v_eligible_after <> 50.00 or v_status_after <> 'eligible' then
    raise exception 'TEST 15 FALLO: la comisión debió quedar EXACTAMENTE como antes del intento (paid=%, eligible=%, status=%)', v_paid_after, v_eligible_after, v_status_after;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 15 OK: rollback — un pago rechazado no deja ningún rastro parcial (ni fila, ni cambio de estado)';
end $$;

-- =========================================================================
-- TEST 16: matriz de autoridad explícita (ajuste post-review) — la
-- autoridad de comisiones es EXCLUSIVAMENTE can_manage_commissions, ni
-- siquiera admin la tiene por defecto:
--   a) admin (org_a, SIN can_manage_commissions) -> SIN acceso: no ve la
--      comisión vía RLS, y las 3 RPCs de escritura lo rechazan.
--   b) director_user (can_manage_commissions, NO admin) -> SÍ acceso
--      (reafirma TEST 1/6/7/9, aquí en contraste directo con (a) sobre el
--      MISMO registro).
--   c) vendedor_user (dueño comercial de la Sales Order, SIN la
--      capability) -> SIN acceso — ya cubierto en TEST 13, referenciado
--      aquí para dejar constancia explícita junto al resto de la matriz.
--   d) admin_orgb (otra organización, TAMPOCO tiene la capability) -> SIN
--      acceso — ya cubierto en TEST 5/14, referenciado aquí igual.
-- =========================================================================
do $$
declare
  v_cr commission_records;
  v_visible_count integer;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000006'); -- director_user
  select * into v_cr from rpc_create_commission_record(
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000b1', 10.00
  );
  if v_cr.status <> 'pending' or v_cr.paid_amount <> 0 then
    raise exception 'TEST 16 FALLO (setup): la comisión de control debió nacer pending/paid=0 (status=%, paid=%)', v_cr.status, v_cr.paid_amount;
  end if;

  -- (a) admin SIN can_manage_commissions -> SIN acceso.
  perform test_set_user('00000000-0000-0000-0000-000000000001'); -- admin, org_a, sin la capability

  select count(*) into v_visible_count from commission_records where id = v_cr.id;
  if v_visible_count <> 0 then
    raise exception 'TEST 16 FALLO: un admin SIN can_manage_commissions NO debió poder ver la comisión (la autoridad es exclusiva de la capability)';
  end if;

  begin
    perform rpc_register_commission_payment(v_cr.id, 1.00);
    raise exception 'TEST 16 FALLO: un admin SIN can_manage_commissions no debió poder registrar un pago de comisión';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_create_commission_record(gen_random_uuid(), '00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000b2', 5.00);
    raise exception 'TEST 16 FALLO: un admin SIN can_manage_commissions no debió poder crear una comisión';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_cancel_commission_record(v_cr.id, 'Intento sin autoridad.');
    raise exception 'TEST 16 FALLO: un admin SIN can_manage_commissions no debió poder cancelar una comisión';
  exception when others then
    if sqlerrm like 'TEST 16 FALLO%' then raise; end if;
  end;

  -- (b) director_user CON can_manage_commissions -> SÍ acceso, mismo registro.
  perform test_set_user('00000000-0000-0000-0000-000000000006');
  select count(*) into v_visible_count from commission_records where id = v_cr.id;
  if v_visible_count <> 1 then
    raise exception 'TEST 16 FALLO: un usuario CON can_manage_commissions SÍ debió poder ver la comisión';
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000001');
  raise notice 'TEST 16 OK: matriz de autoridad — admin sin capability rechazado (a), capability sí permite (b), vendedor dueño rechazado (c, ver TEST 13), cross-org rechazado (d, ver TEST 5/14)';
end $$;

select 'TODAS LAS PRUEBAS 0073 PASARON' as resultado;

rollback;
