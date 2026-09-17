-- THÖREN — rpc_delete_salesperson (0079_salesperson_hard_delete.sql) —
-- pruebas funcionales contra Postgres real. Fixtures 100% autocontenidas.
-- Todo el script corre en una transacción que se revierte al final
-- (rollback) — repetible.

begin;

\set admin '10000000-0000-0000-0000-000000000079'
\set vendedor_user '10000000-0000-0000-0000-000000000179'
\set admin_orgb '10000000-0000-0000-0000-000000000279'
\set admin_hybrid '10000000-0000-0000-0000-000000000379'

\set org_a '20000000-0000-0000-0000-000000000079'
\set org_b '20000000-0000-0000-0000-000000000179'

\set bu1 '30000000-0000-0000-0000-000000000079'

\set customer1 '40000000-0000-0000-0000-000000000079'

\set person1 '50000000-0000-0000-0000-000000000079'

\set sp_clean '60000000-0000-0000-0000-000000000079'
\set sp_orders '60000000-0000-0000-0000-000000000179'
\set sp_quotes '60000000-0000-0000-0000-000000000279'
\set sp_seq '60000000-0000-0000-0000-000000000379'
\set sp_so '60000000-0000-0000-0000-000000000479'
\set sp_helper '60000000-0000-0000-0000-000000000579'
\set sp_comm '60000000-0000-0000-0000-000000000679'
\set sp_user '60000000-0000-0000-0000-000000000779'
\set sp_admin_user '60000000-0000-0000-0000-000000000879'
\set sp_multi '60000000-0000-0000-0000-000000000979'
\set sp_person '60000000-0000-0000-0000-000000000a79'
\set sp_orgb '60000000-0000-0000-0000-000000000b79'

\set order_sp_orders '70000000-0000-0000-0000-000000000079'
\set order_sp_multi '70000000-0000-0000-0000-000000000179'

\set quote_sp_quotes '80000000-0000-0000-0000-000000000079'
\set quote_sp_multi '80000000-0000-0000-0000-000000000179'

\set so_sp_so '90000000-0000-0000-0000-000000000079'
\set so_helper '90000000-0000-0000-0000-000000000179'

insert into auth.users (id, email) values
  (:'admin', 'admin-79@test.local'),
  (:'vendedor_user', 'vendedor-79@test.local'),
  (:'admin_orgb', 'admin-orgb-79@test.local'),
  (:'admin_hybrid', 'admin-hybrid-79@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 79', 'test-org-79'),
  (:'org_b', 'Test Org 79B', 'test-org-79b');

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_clean', :'org_a', 'Vend Clean 79', 'SPA79', true),
  (:'sp_orders', :'org_a', 'Vend Orders 79', 'SPB79', true),
  (:'sp_quotes', :'org_a', 'Vend Quotes 79', 'SPC79', true),
  (:'sp_seq', :'org_a', 'Vend Seq 79', 'SPD79', true),
  (:'sp_so', :'org_a', 'Vend SO 79', 'SPE79', true),
  (:'sp_helper', :'org_a', 'Vend Helper 79', 'SPF79', true),
  (:'sp_comm', :'org_a', 'Vend Comm 79', 'SPG79', true),
  (:'sp_user', :'org_a', 'Vend User 79', 'SPH79', true),
  (:'sp_admin_user', :'org_a', 'Vend AdminUser 79', 'SPI79', true),
  (:'sp_multi', :'org_a', 'Vend Multi 79', 'SPJ79', true),
  (:'sp_person', :'org_a', 'Vend Person 79', 'SPK79', true),
  (:'sp_orgb', :'org_b', 'Vend OrgB 79', 'SPZ79', true);

insert into people (id, organization_id, name, active) values
  (:'person1', :'org_a', 'Persona Test 79', true);

update salespeople set person_id = :'person1' where id = :'sp_person';

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'admin', 'Admin Test 79', 'admin', null, true),
  (:'vendedor_user', 'Vendedor Test 79', 'vendedor', :'sp_user', true),
  (:'admin_orgb', 'Admin Org B 79', 'admin', null, true),
  (:'admin_hybrid', 'Admin Hibrido 79', 'admin', :'sp_admin_user', true);

insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin', 'admin', true),
  (:'org_a', :'vendedor_user', 'vendedor', true),
  (:'org_a', :'admin_hybrid', 'admin', true),
  (:'org_b', :'admin_orgb', 'admin', true);

insert into business_units (id, organization_id, name, code, active) values
  (:'bu1', :'org_a', 'Business Unit Test 79', 'bu_79', true);

insert into customers (id, organization_id, name, active) values
  (:'customer1', :'org_a', 'Cliente Test 79', true);

-- sp_orders: referenciado por un Pedido (orders, v1).
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  (:'order_sp_orders', :'org_a', :'sp_orders', current_date, 'Cliente Pedido 79', 'otro', 'borrador');

-- sp_quotes: referenciado por una Cotización.
insert into quotes (
  id, organization_id, business_unit_id, salesperson_id, customer_id,
  folio, sequence_number, quote_date, currency, valid_until,
  customer_name, business_unit_name, business_unit_code, salesperson_name
) values (
  :'quote_sp_quotes', :'org_a', :'bu1', :'sp_quotes', :'customer1',
  'Q-TEST-79-QUOTES', 1, current_date, 'MXN', current_date + 30,
  'Cliente Test 79', 'Business Unit Test 79', 'bu_79', 'Vend Quotes 79'
);

-- sp_seq: referenciado únicamente por una configuración de folio de
-- Cotizaciones (sin ninguna Cotización real todavía) — bloqueo independiente.
insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_seq', :'bu1', 'SEQ79');

-- sp_so: referenciado por una Orden de venta.
insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by) values
  (:'so_sp_so', :'org_a', :'customer1', :'sp_so', 'SO-TEST-79-A', 1, 'MXN', :'admin');

-- sp_helper: SOLO existe para satisfacer sales_orders.salesperson_id
-- (NOT NULL) de la Sales Order usada por la comisión de sp_comm — así el
-- bloqueo de sp_comm queda aislado exclusivamente a commission_records,
-- nunca mezclado con un bloqueo de sales_orders.
insert into sales_orders (id, organization_id, customer_id, salesperson_id, order_number, sequence_number, currency, created_by) values
  (:'so_helper', :'org_a', :'customer1', :'sp_helper', 'SO-TEST-79-B', 2, 'MXN', :'admin');

-- sp_comm: referenciado por una Comisión (sobre la Sales Order de sp_helper,
-- simulando un split de comisión hacia otro vendedor).
insert into commission_records (
  organization_id, sales_order_id, salesperson_id,
  commission_rule_snapshot, commission_base, commission_rate, commission_amount, created_by
) values (
  :'org_a', :'so_helper', :'sp_comm',
  '{}'::jsonb, 100, 10, 10, :'admin'
);

-- sp_multi: referenciado a la vez por un Pedido Y una Cotización (mensaje
-- debe listar ambos bloqueos juntos).
insert into orders (id, organization_id, salesperson_id, order_date, client_name, product_type, status) values
  (:'order_sp_multi', :'org_a', :'sp_multi', current_date, 'Cliente Multi 79', 'otro', 'borrador');
insert into quotes (
  id, organization_id, business_unit_id, salesperson_id, customer_id,
  folio, sequence_number, quote_date, currency, valid_until,
  customer_name, business_unit_name, business_unit_code, salesperson_name
) values (
  :'quote_sp_multi', :'org_a', :'bu1', :'sp_multi', :'customer1',
  'Q-TEST-79-MULTI', 2, current_date, 'MXN', current_date + 30,
  'Cliente Test 79', 'Business Unit Test 79', 'bu_79', 'Vend Multi 79'
);

select 'FIXTURES OK' as marker;

-- =========================================================================
-- TEST 1: vendedor (no admin) -> rechazado, nada se toca. El objetivo del
-- rechazo es el rol de quien llama, no el vendedor objetivo (se usa
-- sp_clean, que por lo demás sí sería eliminable).
-- =========================================================================
select test_set_user(:'vendedor_user');
do $$
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000079');
    raise exception 'TEST 1 FALLO: un vendedor no debio poder ejecutar la funcion';
  exception when others then
    if sqlerrm like 'Solo un administrador%' then
      raise notice 'TEST 1 OK: vendedor rechazado (%).', sqlerrm;
    else
      raise exception 'TEST 1 FALLO: excepcion inesperada: %', sqlerrm;
    end if;
  end;
end $$;
select test_set_user(:'admin');

do $$
begin
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000079') then
    raise exception 'TEST 1b FALLO: sp_clean no debio tocarse tras el rechazo';
  end if;
  raise notice 'TEST 1b OK: ningun vendedor se toco tras el intento sin autoridad';
end $$;

-- =========================================================================
-- TEST 2: admin elimina un vendedor SIN ninguna referencia real -> hard
-- delete exitoso.
-- =========================================================================
do $$
begin
  perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000079');
  if exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000079') then
    raise exception 'TEST 2 FALLO: sp_clean debio eliminarse definitivamente';
  end if;
  raise notice 'TEST 2 OK: vendedor sin referencias eliminado definitivamente';
end $$;

-- =========================================================================
-- TEST 3: bloqueo por Pedidos (orders).
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000179');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 3 FALLO: se permitio eliminar un vendedor con Pedidos'; end if;
  if v_msg !~ 'pedido' then raise exception 'TEST 3 FALLO: el mensaje no menciona pedido(s): %', v_msg; end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000179') then
    raise exception 'TEST 3 FALLO: sp_orders no debio eliminarse';
  end if;
  raise notice 'TEST 3 OK: bloqueado por Pedidos: %', v_msg;
end $$;

-- =========================================================================
-- TEST 4: bloqueo por Cotizaciones (quotes).
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000279');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 4 FALLO: se permitio eliminar un vendedor con Cotizaciones'; end if;
  if v_msg !~ 'cotizaci' then raise exception 'TEST 4 FALLO: el mensaje no menciona cotización(es): %', v_msg; end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000279') then
    raise exception 'TEST 4 FALLO: sp_quotes no debio eliminarse';
  end if;
  raise notice 'TEST 4 OK: bloqueado por Cotizaciones: %', v_msg;
end $$;

-- =========================================================================
-- TEST 5: bloqueo por configuración de folio de Cotizaciones
-- (salesperson_quote_sequences), incluso SIN ninguna Cotización real.
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000379');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 5 FALLO: se permitio eliminar un vendedor con folio de Cotizaciones configurado'; end if;
  if v_msg !~ 'folio de cotizaciones' then raise exception 'TEST 5 FALLO: el mensaje no menciona la configuracion de folio: %', v_msg; end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000379') then
    raise exception 'TEST 5 FALLO: sp_seq no debio eliminarse';
  end if;
  raise notice 'TEST 5 OK: bloqueado por configuración de folio de Cotizaciones: %', v_msg;
end $$;

-- =========================================================================
-- TEST 6: bloqueo por Órdenes de venta (sales_orders).
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000479');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 6 FALLO: se permitio eliminar un vendedor con Órdenes de venta'; end if;
  if v_msg !~ 'orden.*de venta' then raise exception 'TEST 6 FALLO: el mensaje no menciona orden(es) de venta: %', v_msg; end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000479') then
    raise exception 'TEST 6 FALLO: sp_so no debio eliminarse';
  end if;
  raise notice 'TEST 6 OK: bloqueado por Órdenes de venta: %', v_msg;
end $$;

-- =========================================================================
-- TEST 7: bloqueo por Comisiones (commission_records), aislado de
-- sales_orders (la Sales Order pertenece a sp_helper, no a sp_comm).
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000679');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 7 FALLO: se permitio eliminar un vendedor con Comisiones'; end if;
  if v_msg !~ 'comisi' then raise exception 'TEST 7 FALLO: el mensaje no menciona comisión(es): %', v_msg; end if;
  if v_msg ~ 'orden.*de venta' then raise exception 'TEST 7 FALLO: el bloqueo de sp_comm no debio mezclar Órdenes de venta: %', v_msg; end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000679') then
    raise exception 'TEST 7 FALLO: sp_comm no debio eliminarse';
  end if;
  raise notice 'TEST 7 OK: bloqueado por Comisiones (aislado de Órdenes de venta): %', v_msg;
end $$;

-- =========================================================================
-- TEST 8: bloqueo por usuario con rol "vendedor" ligado — NO se borra el
-- vendedor ni se toca su login.
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000779');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 8 FALLO: se permitio eliminar un vendedor con usuario "vendedor" ligado'; end if;
  if v_msg !~ 'Vendedor' or v_msg !~* 'reasign' then
    raise exception 'TEST 8 FALLO: el mensaje no explica claramente que debe reasignarse/cambiarse el rol: %', v_msg;
  end if;
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000779') then
    raise exception 'TEST 8 FALLO: sp_user no debio eliminarse';
  end if;
  if not exists (select 1 from user_profiles where user_id = '10000000-0000-0000-0000-000000000179' and salesperson_id = '60000000-0000-0000-0000-000000000779' and role = 'vendedor') then
    raise exception 'TEST 8 FALLO: el usuario/login vendedor_user no debio tocarse';
  end if;
  raise notice 'TEST 8 OK: bloqueado por usuario "vendedor" ligado, login intacto: %', v_msg;
end $$;

-- =========================================================================
-- TEST 9: caso híbrido — usuario ADMIN ligado NO bloquea. Hard delete
-- exitoso; el login del admin híbrido permanece intacto, solo se
-- desvincula (salesperson_id -> null) vía ON DELETE SET NULL.
-- =========================================================================
do $$
begin
  perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000879');
  if exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000879') then
    raise exception 'TEST 9 FALLO: sp_admin_user debio eliminarse (usuario admin ligado no debe bloquear)';
  end if;
  if not exists (select 1 from user_profiles where user_id = '10000000-0000-0000-0000-000000000379' and role = 'admin' and active = true) then
    raise exception 'TEST 9 FALLO: el login admin_hybrid no debio borrarse ni desactivarse';
  end if;
  if exists (select 1 from user_profiles where user_id = '10000000-0000-0000-0000-000000000379' and salesperson_id is not null) then
    raise exception 'TEST 9 FALLO: user_profiles.salesperson_id debio quedar en null (ON DELETE SET NULL)';
  end if;
  raise notice 'TEST 9 OK: vendedor con usuario ADMIN ligado eliminado; login intacto y desvinculado';
end $$;

-- =========================================================================
-- TEST 10: bloqueo combinado — el mensaje debe listar TODAS las categorías
-- de referencia real que aplican, no solo la primera que encuentre.
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000979');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 10 FALLO: se permitio eliminar un vendedor con múltiples bloqueos'; end if;
  if v_msg !~ 'pedido' then raise exception 'TEST 10 FALLO: el mensaje combinado no incluye pedido(s): %', v_msg; end if;
  if v_msg !~ 'cotizaci' then raise exception 'TEST 10 FALLO: el mensaje combinado no incluye cotización(es): %', v_msg; end if;
  raise notice 'TEST 10 OK: mensaje combinado lista todos los bloqueos reales: %', v_msg;
end $$;

-- =========================================================================
-- TEST 11: NUNCA se borra la Persona vinculada — el hard delete del
-- vendedor debe dejar intacta la fila de `people`.
-- =========================================================================
do $$
begin
  perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000a79');
  if exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000a79') then
    raise exception 'TEST 11 FALLO: sp_person debio eliminarse (sin referencias operativas reales)';
  end if;
  if not exists (select 1 from people where id = '50000000-0000-0000-0000-000000000079' and name = 'Persona Test 79') then
    raise exception 'TEST 11 FALLO: la Persona vinculada NO debio borrarse ni modificarse';
  end if;
  raise notice 'TEST 11 OK: vendedor eliminado, Persona vinculada permanece intacta';
end $$;

-- =========================================================================
-- TEST 12: cross-org — un admin de org_a nunca puede ver ni eliminar un
-- vendedor de otra organización; se trata como "no encontrado".
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('60000000-0000-0000-0000-000000000b79');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 12 FALLO: se permitio eliminar un vendedor de OTRA organización'; end if;
  if v_msg !~ 'no encontrado' then raise exception 'TEST 12 FALLO: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 12 OK: vendedor de otra organización tratado como no encontrado: %', v_msg;
end $$;

select test_set_user(:'admin_orgb');
do $$
begin
  if not exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000b79') then
    raise exception 'TEST 12b FALLO: sp_orgb (org_b) debio seguir existiendo';
  end if;
  raise notice 'TEST 12b OK (verificado desde admin_orgb): vendedor de org_b nunca tocado por acciones en org_a';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- TEST 13: id inexistente -> mismo mensaje "no encontrado" (no revela
-- diferencia entre "no existe" y "existe en otra organización").
-- =========================================================================
do $$
declare v_failed boolean := false; v_msg text;
begin
  begin
    perform rpc_delete_salesperson('99999999-9999-9999-9999-999999999999');
  exception when others then v_failed := true; get stacked diagnostics v_msg = message_text;
  end;
  if not v_failed then raise exception 'TEST 13 FALLO: un id inexistente no debio poder "eliminarse"'; end if;
  if v_msg !~ 'no encontrado' then raise exception 'TEST 13 FALLO: mensaje inesperado: %', v_msg; end if;
  raise notice 'TEST 13 OK: id inexistente -> "no encontrado": %', v_msg;
end $$;

select 'TODAS LAS PRUEBAS 0079 (hard delete de vendedores) PASARON' as resultado;
rollback;
