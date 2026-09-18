-- THÖREN — Comisiones: vista propia de solo lectura para VENDEDOR
-- (0083_commission_own_view.sql) — pruebas funcionales contra Postgres
-- real. Fixtures 100% autocontenidas — no depende de la cadena de
-- fixtures de fases anteriores (mismo criterio que 0073). Todo el script
-- corre en una transacción que se revierte al final (rollback).
--
-- Diseño final (ajuste post-review): commission_records_select NO tiene
-- ninguna rama de dueño-vendedor — se queda EXACTAMENTE como 0073 la
-- dejó. La única vía de lectura para un vendedor con
-- can_view_own_commissions son los RPCs SECURITY DEFINER
-- rpc_list_own_commissions()/rpc_get_own_commission(uuid), cuyo
-- `returns table` ni siquiera declara columnas financieras/administrativas
-- restringidas — no es una omisión de la app, es que esas columnas no
-- existen en el contrato de la función.

begin;

\set admin '00000000-0000-0000-0000-000000000101'
\set director_user '00000000-0000-0000-0000-000000000102'
\set vendedor_cap '00000000-0000-0000-0000-000000000103'
\set vendedor_nocap '00000000-0000-0000-0000-000000000104'
\set org_a '00000000-0000-0000-0000-000000008301'
\set sp1 '00000000-0000-0000-0000-000000008311'
\set sp2 '00000000-0000-0000-0000-000000008312'
\set sp_director '00000000-0000-0000-0000-000000008316'
\set c1 '00000000-0000-0000-0000-000000008321'

insert into auth.users (id, email) values
  (:'admin', 'admin-83@test.local'),
  (:'director_user', 'director-83@test.local'),
  (:'vendedor_cap', 'vendedor-cap-83@test.local'),
  (:'vendedor_nocap', 'vendedor-nocap-83@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 83', 'test-org-83');

insert into user_profiles (user_id, name, role, active) values
  (:'admin', 'Admin Test 83', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp1', :'org_a', 'Vend Cap 83', 'VC83', true),
  (:'sp2', :'org_a', 'Vend NoCap 83', 'VN83', true),
  (:'sp_director', :'org_a', 'Director Placeholder 83', 'DR83', true);

-- director_user: SOLO can_manage_commissions — Dirección General, mismo
-- criterio que 0073. Se usa para el camino de regresión: la autoridad de
-- gestión existente sigue viendo TODO tras esta migración.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'director_user', 'Director Test 83', 'vendedor', :'sp_director', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'director_user', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'director_user', 'can_manage_commissions', :'admin');

-- vendedor_cap: dueño comercial de la comisión sp1, CON can_view_own_commissions.
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_cap', 'Vendedor Cap 83', 'vendedor', :'sp1', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_cap', 'vendedor', true);
insert into user_capabilities (organization_id, user_id, capability, granted_by_user_id) values
  (:'org_a', :'vendedor_cap', 'can_view_own_commissions', :'admin');

-- vendedor_nocap: dueño comercial de la comisión sp2, SIN la capability
-- nueva — representa al vendedor todavía no habilitado (o cualquier
-- vendedor antes del bootstrap de la sección 4 de la migración).
insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_nocap', 'Vendedor NoCap 83', 'vendedor', :'sp2', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_nocap', 'vendedor', true);

insert into customers (id, organization_id, name, active) values
  (:'c1', :'org_a', 'Cliente Test 83', true);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- Setup — una Sales Order confirmada con comisión SPLIT entre sp1 y sp2
-- (mismo mecanismo que 0073 TEST 12: commission_records.salesperson_id es
-- independiente del salesperson_id de la Sales Order) — permite probar
-- aislamiento cross-vendedor sin necesitar una segunda Sales Order.
-- =========================================================================
set role authenticated;
select test_set_user(:'admin');

do $$
begin
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-000000008331',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-000000008321', 'salesperson_id', '00000000-0000-0000-0000-000000008311', 'currency', 'MXN', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-83-E1', 'quantity', 10, 'unit_price', 100.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-000000008331', 'confirmed');

  -- SO_USD (e2): segunda Sales Order, en USD, confirmada — mismo vendedor
  -- dueño (sp1) que SO_MAIN, para probar que rpc_list_own_commissions()/
  -- rpc_get_own_commission() devuelven la moneda REAL de cada Sales Order
  -- origen (ajuste post-review: currency ahora es parte del contrato).
  perform rpc_create_sales_order(
    '00000000-0000-0000-0000-000000008332',
    jsonb_build_object('customer_id', '00000000-0000-0000-0000-000000008321', 'salesperson_id', '00000000-0000-0000-0000-000000008311', 'currency', 'USD', 'payment_terms_type', 'cash'),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'sku_snapshot', 'FREE-83-USD', 'quantity', 1, 'unit_price', 200.00))
  );
  perform rpc_update_sales_order_status('00000000-0000-0000-0000-000000008332', 'confirmed');
end $$;

select 'SETUP SO OK' as marker;

do $$
declare
  v_cr_sp1 commission_records;
  v_cr_sp2 commission_records;
  v_cr_sp1_usd commission_records;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000102'); -- director_user

  select * into v_cr_sp1 from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000008341',
    '00000000-0000-0000-0000-000000008331',
    '00000000-0000-0000-0000-000000008311', -- sp1
    10.00
  );
  select * into v_cr_sp2 from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000008342',
    '00000000-0000-0000-0000-000000008331',
    '00000000-0000-0000-0000-000000008312', -- sp2
    5.00
  );
  select * into v_cr_sp1_usd from rpc_create_commission_record(
    '00000000-0000-0000-0000-000000008344',
    '00000000-0000-0000-0000-000000008332', -- SO_USD
    '00000000-0000-0000-0000-000000008311', -- sp1
    8.00
  );

  if v_cr_sp1.commission_amount <> 100.00 or v_cr_sp2.commission_amount <> 50.00 then
    raise exception 'SETUP FALLO: montos de comisión split incorrectos (sp1=%, sp2=%)', v_cr_sp1.commission_amount, v_cr_sp2.commission_amount;
  end if;
  if v_cr_sp1_usd.commission_amount <> 16.00 then
    raise exception 'SETUP FALLO: monto de comisión USD incorrecto (esperado 16.00, fue %)', v_cr_sp1_usd.commission_amount;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
end $$;

select 'SETUP COMISIONES OK' as marker;

-- =========================================================================
-- TEST 1: vendedor_cap NO puede SELECT directo sobre commission_records —
-- ni siquiera su propia fila (sp1). commission_records_select NO tiene
-- rama de dueño-vendedor, sin cambios respecto a 0073: can_view_own_commissions
-- NO otorga SELECT directo sobre la tabla, por diseño.
-- =========================================================================
do $$
declare
  v_count_all int;
  v_count_own int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- vendedor_cap

  select count(*) into v_count_all from commission_records;
  select count(*) into v_count_own from commission_records where id = '00000000-0000-0000-0000-000000008341'; -- su propia comisión

  if v_count_all <> 0 then
    raise exception 'TEST 1 FALLO: vendedor con can_view_own_commissions no debió poder hacer SELECT directo sobre commission_records (vio % filas en total)', v_count_all;
  end if;
  if v_count_own <> 0 then
    raise exception 'TEST 1 FALLO: vendedor con can_view_own_commissions no debió poder hacer SELECT directo de su PROPIA comisión (id=8341), vio % filas', v_count_own;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 1 OK: can_view_own_commissions NO otorga SELECT directo sobre commission_records — 0 filas incluso para la propia comisión';
end $$;

-- =========================================================================
-- TEST 2: rpc_list_own_commissions() — vendedor_cap ve EXACTAMENTE sus DOS
-- comisiones propias (sp1, una en MXN sobre SO_MAIN y otra en USD sobre
-- SO_USD), cada una con folio/cliente/monto/MONEDA/estatus/fecha
-- correctos — la moneda REAL de su Sales Order origen, no un valor fijo —
-- y NO la de sp2.
-- =========================================================================
do $$
declare
  v_count int;
  v_row_mxn record;
  v_row_usd record;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- vendedor_cap

  select count(*) into v_count from rpc_list_own_commissions();
  if v_count <> 2 then
    raise exception 'TEST 2 FALLO: rpc_list_own_commissions() debió devolver EXACTAMENTE 2 filas (sp1 MXN + sp1 USD), devolvió %', v_count;
  end if;

  select * into v_row_mxn from rpc_list_own_commissions() where id = '00000000-0000-0000-0000-000000008341';
  if v_row_mxn.commission_amount <> 100.00 or v_row_mxn.currency <> 'MXN' then
    raise exception 'TEST 2 FALLO: comisión MXN incorrecta (monto=%, moneda=%, esperado 100.00/MXN)', v_row_mxn.commission_amount, v_row_mxn.currency;
  end if;
  if v_row_mxn.sales_order_folio is null or v_row_mxn.customer_name is null then
    raise exception 'TEST 2 FALLO: rpc_list_own_commissions() debió traer folio de Sales Order y nombre de cliente (folio=%, cliente=%)', v_row_mxn.sales_order_folio, v_row_mxn.customer_name;
  end if;
  if v_row_mxn.status is null or v_row_mxn.created_at is null then
    raise exception 'TEST 2 FALLO: rpc_list_own_commissions() debió traer estatus y fecha de generación';
  end if;

  select * into v_row_usd from rpc_list_own_commissions() where id = '00000000-0000-0000-0000-000000008344';
  if v_row_usd.commission_amount <> 16.00 or v_row_usd.currency <> 'USD' then
    raise exception 'TEST 2 FALLO: comisión USD incorrecta (monto=%, moneda=%, esperado 16.00/USD) — la moneda debe venir de la Sales Order origen, no un valor fijo', v_row_usd.commission_amount, v_row_usd.currency;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 2 OK: rpc_list_own_commissions() lista ambas comisiones propias, cada una con la moneda real de su Sales Order (MXN y USD)';
end $$;

-- =========================================================================
-- TEST 3: rpc_get_own_commission() — vendedor_cap SÍ obtiene el detalle de
-- cada una de sus comisiones propias (MXN y USD, con la moneda correcta
-- en cada caso), pero 0 filas (no excepción) para la comisión de otro
-- vendedor (sp2) — mismo criterio de no-disclosure que un 404 vía RLS.
-- =========================================================================
do $$
declare
  v_mxn record;
  v_usd record;
  v_count_other int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- vendedor_cap

  select * into v_mxn from rpc_get_own_commission('00000000-0000-0000-0000-000000008341');
  if v_mxn.id is null or v_mxn.currency <> 'MXN' then
    raise exception 'TEST 3 FALLO: rpc_get_own_commission() debió devolver la comisión MXN propia con currency=MXN, vio currency=%', v_mxn.currency;
  end if;

  select * into v_usd from rpc_get_own_commission('00000000-0000-0000-0000-000000008344');
  if v_usd.id is null or v_usd.currency <> 'USD' then
    raise exception 'TEST 3 FALLO: rpc_get_own_commission() debió devolver la comisión USD propia con currency=USD, vio currency=%', v_usd.currency;
  end if;

  select count(*) into v_count_other from rpc_get_own_commission('00000000-0000-0000-0000-000000008342'); -- comisión de sp2
  if v_count_other <> 0 then
    raise exception 'TEST 3 FALLO: rpc_get_own_commission() NO debió devolver la comisión de otro vendedor (sp2), devolvió % filas', v_count_other;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 3 OK: rpc_get_own_commission() trae la moneda real de cada comisión propia (MXN y USD) y nunca permite ver una comisión ajena';
end $$;

-- =========================================================================
-- TEST 4: vendedor_nocap (SIN can_view_own_commissions) — SELECT directo
-- sigue en 0 (regresión), Y además rpc_list_own_commissions()/
-- rpc_get_own_commission() rechazan con excepción explícita (autoridad
-- exclusiva de la capability, no de role='vendedor').
-- =========================================================================
do $$
declare
  v_count int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000104'); -- vendedor_nocap (sp2)

  select count(*) into v_count from commission_records;
  if v_count <> 0 then
    raise exception 'TEST 4 FALLO: vendedor SIN can_view_own_commissions no debió ver nada vía SELECT directo, vio % filas', v_count;
  end if;

  begin
    perform rpc_list_own_commissions();
    raise exception 'TEST 4 FALLO: rpc_list_own_commissions() no debió permitir a un vendedor sin can_view_own_commissions';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_get_own_commission('00000000-0000-0000-0000-000000008342');
    raise exception 'TEST 4 FALLO: rpc_get_own_commission() no debió permitir a un vendedor sin can_view_own_commissions, ni siquiera sobre su propia comisión';
  exception when others then
    if sqlerrm like 'TEST 4 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 4 OK: sin can_view_own_commissions, ni SELECT directo ni los RPCs funcionan — la capability es obligatoria, no basta con role=vendedor';
end $$;

-- =========================================================================
-- TEST 5: vendedor_cap no puede INSERT (crear comisión) ni UPDATE
-- (registrar pago / cancelar) — can_view_own_commissions es estrictamente
-- de lectura, la autoridad de escritura sigue siendo exclusiva de
-- can_manage_commissions (commission_records_insert/update, sin cambios).
-- =========================================================================
do $$
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- vendedor_cap

  begin
    perform rpc_create_commission_record(
      '00000000-0000-0000-0000-000000008343',
      '00000000-0000-0000-0000-000000008331',
      '00000000-0000-0000-0000-000000008311',
      1.00
    );
    raise exception 'TEST 5 FALLO: vendedor con can_view_own_commissions no debió poder crear una comisión';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_register_commission_payment('00000000-0000-0000-0000-000000008341', 10.00, null);
    raise exception 'TEST 5 FALLO: vendedor con can_view_own_commissions no debió poder registrar un pago de comisión';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  begin
    perform rpc_cancel_commission_record('00000000-0000-0000-0000-000000008341', 'intento no autorizado');
    raise exception 'TEST 5 FALLO: vendedor con can_view_own_commissions no debió poder cancelar una comisión';
  exception when others then
    if sqlerrm like 'TEST 5 FALLO%' then raise; end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 5 OK: can_view_own_commissions es estrictamente de lectura — crear/pagar/cancelar siguen bloqueados';
end $$;

-- =========================================================================
-- TEST 6: los RPCs NUNCA devuelven tasa/base/elegible/pagado — no es un
-- chequeo de valor, es un chequeo de CONTRATO: esas columnas no existen
-- en el `returns table` de rpc_list_own_commissions(), así que referenciarlas
-- falla con "column does not exist", incluso para el propio dueño.
-- =========================================================================
do $$
declare
  v_dummy numeric;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000103'); -- vendedor_cap

  begin
    execute 'select commission_rate from rpc_list_own_commissions() limit 1' into v_dummy;
    raise exception 'TEST 6 FALLO: commission_rate no debió existir en el contrato de rpc_list_own_commissions()';
  exception
    when undefined_column then
      null; -- esperado
    when others then
      if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
      raise exception 'TEST 6 FALLO: error inesperado probando commission_rate: %', sqlerrm;
  end;

  begin
    execute 'select commission_base from rpc_list_own_commissions() limit 1' into v_dummy;
    raise exception 'TEST 6 FALLO: commission_base no debió existir en el contrato de rpc_list_own_commissions()';
  exception
    when undefined_column then
      null;
    when others then
      if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
      raise exception 'TEST 6 FALLO: error inesperado probando commission_base: %', sqlerrm;
  end;

  begin
    execute 'select eligible_amount from rpc_list_own_commissions() limit 1' into v_dummy;
    raise exception 'TEST 6 FALLO: eligible_amount no debió existir en el contrato de rpc_list_own_commissions()';
  exception
    when undefined_column then
      null;
    when others then
      if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
      raise exception 'TEST 6 FALLO: error inesperado probando eligible_amount: %', sqlerrm;
  end;

  begin
    execute 'select paid_amount from rpc_list_own_commissions() limit 1' into v_dummy;
    raise exception 'TEST 6 FALLO: paid_amount no debió existir en el contrato de rpc_list_own_commissions()';
  exception
    when undefined_column then
      null;
    when others then
      if sqlerrm like 'TEST 6 FALLO%' then raise; end if;
      raise exception 'TEST 6 FALLO: error inesperado probando paid_amount: %', sqlerrm;
  end;

  -- Control positivo (ajuste post-review): `currency` SÍ existe en el
  -- contrato y trae un valor real — contraste directo con los 4 campos
  -- anteriores, que no existen. No es un descuido que currency funcione
  -- mientras los demás fallan: es exactamente el diseño aprobado.
  declare
    v_currency text;
  begin
    execute 'select currency from rpc_list_own_commissions() where id = ''00000000-0000-0000-0000-000000008341'' limit 1' into v_currency;
    if v_currency is distinct from 'MXN' then
      raise exception 'TEST 6 FALLO: currency SÍ debe existir en el contrato y traer el valor real (esperado MXN, vio %)', v_currency;
    end if;
  end;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 6 OK: commission_rate/commission_base/eligible_amount/paid_amount no existen en el contrato de rpc_list_own_commissions() (blindaje de tipo, no solo de UI) — currency sí existe y trae el valor real, por diseño';
end $$;

-- =========================================================================
-- TEST 7: regresión — director_user (can_manage_commissions) conserva
-- EXACTAMENTE la vista completa actual vía SELECT directo: sigue viendo
-- AMBAS comisiones (sp1 y sp2) de la Sales Order, con todas sus columnas,
-- sin cambios respecto a 0073.
-- =========================================================================
do $$
declare
  v_count int;
  v_rate_sp1 numeric;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000102'); -- director_user

  select count(*) into v_count
  from commission_records
  where id in ('00000000-0000-0000-0000-000000008341', '00000000-0000-0000-0000-000000008342');
  if v_count <> 2 then
    raise exception 'TEST 7 FALLO: can_manage_commissions debió seguir viendo AMBAS comisiones (sp1 y sp2), vio % filas', v_count;
  end if;

  select commission_rate into v_rate_sp1 from commission_records where id = '00000000-0000-0000-0000-000000008341';
  if v_rate_sp1 <> 10.00 then
    raise exception 'TEST 7 FALLO: can_manage_commissions debió seguir viendo commission_rate vía SELECT directo (esperado 10.00, vio %)', v_rate_sp1;
  end if;

  perform test_set_user('00000000-0000-0000-0000-000000000101');
  raise notice 'TEST 7 OK: can_manage_commissions conserva exactamente la vista completa de 0073 (SELECT directo, todas las columnas), sin regresión';
end $$;

reset role;
rollback;
