-- THÖREN — 0021 Customer Contacts + Excel Import — pruebas funcionales
-- contra Postgres real. Cada bloque hace RAISE EXCEPTION si algo no
-- cumple lo esperado; si el script entero corre sin errores, todas las
-- pruebas pasaron. Corre después de local_harness_setup.sql + las 21
-- migraciones + fixtures.sql.

-- CRÍTICO: sin esto, al conectar como superusuario (postgres) TODAS las
-- políticas RLS se ignoran silenciosamente (BYPASSRLS implícito de
-- superusuario) y las pruebas "pasarían" aunque RLS estuviera rota.
set role authenticated;

-- Todo el script corre en una sola transacción que se revierte al final
-- (ver ROLLBACK al pie) — así puede volver a correrse las veces que haga
-- falta contra el mismo fixture sin acumular filas de una corrida anterior.
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set cemex '30000000-0000-0000-0000-000000000001'
\set norte '30000000-0000-0000-0000-000000000002'
\set inactivo '30000000-0000-0000-0000-000000000003'
\set orgb_customer '30000000-0000-0000-0000-000000000009'
\set juan_contact '40000000-0000-0000-0000-000000000001'

-- 2) RLS ADMIN: ve/crea/edita contactos de cualquier customer de su org.
select test_set_user(:'admin');
do $$
begin
  if (select count(*) from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'TEST 2 FALLÓ: ADMIN debería ver el contacto seed de CEMEX';
  end if;
  insert into customer_contacts (customer_id, name, email) values ('30000000-0000-0000-0000-000000000003', 'Contacto Admin', 'a@x.com');
  update customer_contacts set phone = '8110000099' where id = '40000000-0000-0000-0000-000000000001';
  raise notice 'TEST 2 OK: RLS ADMIN — select/insert/update libres dentro de su organización';
end $$;

-- 3) RLS VENDEDOR: ve/crea/edita contactos de customers ACTIVOS; bloqueado en inactivos.
select test_set_user(:'vendedor1');
do $$
begin
  if (select count(*) from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'TEST 3a FALLÓ: VENDEDOR debería ver contactos de un customer activo';
  end if;
  insert into customer_contacts (customer_id, name) values ('30000000-0000-0000-0000-000000000002', 'Contacto Vendedor');
  raise notice 'TEST 3a OK: VENDEDOR puede insertar contacto en customer activo';
exception when insufficient_privilege then
  raise exception 'TEST 3a FALLÓ: no debería bloquear insert en customer activo';
end $$;

do $$
declare
  v_count int;
begin
  begin
    insert into customer_contacts (customer_id, name) values ('30000000-0000-0000-0000-000000000003', 'No debería crearse');
  exception when insufficient_privilege then
    null; -- esperado
  end;
  select count(*) into v_count from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000003' and name = 'No debería crearse';
  if v_count <> 0 then
    raise exception 'TEST 3b FALLÓ: VENDEDOR no debería poder insertar contacto en customer INACTIVO';
  end if;
  raise notice 'TEST 3b OK: RLS VENDEDOR bloquea insert en customer inactivo';
end $$;

-- 4) Cross-org: vendedor1 (org1) no ve/crea contactos de un customer de Org B.
select test_set_user(:'vendedor1');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000009';
  if v_count <> 0 then
    raise exception 'TEST 4a FALLÓ: no debería ver contactos de un customer de otra organización';
  end if;
  begin
    insert into customer_contacts (customer_id, name) values ('30000000-0000-0000-0000-000000000009', 'Cross org intento');
    raise exception 'TEST 4b FALLÓ: no debería poder insertar en un customer de otra organización';
  exception when insufficient_privilege then
    null; -- esperado
  end;
  raise notice 'TEST 4 OK: aislamiento cross-org confirmado (select e insert)';
end $$;

-- 5) Contacto principal único: marcar uno nuevo como principal degrada al anterior.
select test_set_user(:'admin');
do $$
declare
  v_new_id uuid;
  v_primary_count int;
begin
  insert into customer_contacts (customer_id, name, is_primary, active)
    values ('30000000-0000-0000-0000-000000000001', 'Segundo Principal', true, true)
    returning id into v_new_id;

  select count(*) into v_primary_count
    from customer_contacts
    where customer_id = '30000000-0000-0000-0000-000000000001' and is_primary and active;

  if v_primary_count <> 1 then
    raise exception 'TEST 5 FALLÓ: debería haber exactamente 1 contacto principal activo, hay %', v_primary_count;
  end if;

  if not (select is_primary from customer_contacts where id = v_new_id) then
    raise exception 'TEST 5 FALLÓ: el contacto recién marcado debería quedar principal';
  end if;

  if (select is_primary from customer_contacts where id = '40000000-0000-0000-0000-000000000001') then
    raise exception 'TEST 5 FALLÓ: el contacto original (Juan Pérez) debería haber sido degradado';
  end if;

  raise notice 'TEST 5 OK: solo un contacto principal activo por Customer, degradación automática por trigger';
end $$;

-- 6) Desactivar principal permite crear otro sin violar el índice único.
do $$
declare
  v_primary_id uuid;
begin
  select id into v_primary_id from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000001' and is_primary and active;
  update customer_contacts set active = false where id = v_primary_id;

  if (select is_primary from customer_contacts where id = v_primary_id) then
    raise exception 'TEST 6 FALLÓ: desactivar el principal debería limpiar is_primary automáticamente';
  end if;

  insert into customer_contacts (customer_id, name, is_primary, active) values ('30000000-0000-0000-0000-000000000001', 'Tercer Principal', true, true);
  raise notice 'TEST 6 OK: desactivar el principal libera el índice único, nuevo principal se crea sin error';
end $$;

-- 7/9/10/11) rpc_create_customer_with_contacts — atómico, sin/con 1/con varios contactos.
select test_set_user(:'admin');
do $$
declare
  v_customer customers;
begin
  -- 9) sin contacto
  select * into v_customer from rpc_create_customer_with_contacts('{"name":"Cliente Sin Contacto"}'::jsonb, '[]'::jsonb);
  if v_customer.id is null then raise exception 'TEST 9 FALLÓ: no se creó el customer'; end if;
  if exists (select 1 from customer_contacts where customer_id = v_customer.id) then
    raise exception 'TEST 9 FALLÓ: no debería haber contactos';
  end if;
  raise notice 'TEST 9 OK: Customer sin contacto';

  -- 10) 1 contacto, sin is_primary explícito -> se vuelve principal automáticamente
  select * into v_customer from rpc_create_customer_with_contacts(
    '{"name":"Cliente Un Contacto"}'::jsonb,
    '[{"name":"Contacto Solo","email":"solo@x.com"}]'::jsonb
  );
  if (select count(*) from customer_contacts where customer_id = v_customer.id) <> 1 then
    raise exception 'TEST 10 FALLÓ: debería haber exactamente 1 contacto';
  end if;
  if not (select is_primary from customer_contacts where customer_id = v_customer.id) then
    raise exception 'TEST 10 FALLÓ: el único contacto debería quedar principal automáticamente';
  end if;
  raise notice 'TEST 10 OK: Customer con 1 contacto queda principal automáticamente';

  -- 11) varios contactos, ninguno marcado -> el primero se vuelve principal
  select * into v_customer from rpc_create_customer_with_contacts(
    '{"name":"Cliente Varios Contactos"}'::jsonb,
    '[{"name":"Primero"},{"name":"Segundo"},{"name":"Tercero"}]'::jsonb
  );
  if (select count(*) from customer_contacts where customer_id = v_customer.id) <> 3 then
    raise exception 'TEST 11a FALLÓ: deberían crearse 3 contactos';
  end if;
  if (select count(*) from customer_contacts where customer_id = v_customer.id and is_primary) <> 1 then
    raise exception 'TEST 11b FALLÓ: exactamente 1 debería quedar principal';
  end if;
  if (select name from customer_contacts where customer_id = v_customer.id and is_primary) <> 'Primero' then
    raise exception 'TEST 11c FALLÓ: el primero de la lista debería ser el sugerido como principal';
  end if;
  raise notice 'TEST 11 OK: Customer con varios contactos — el primero queda principal por default';
end $$;

-- 7/8) atómico + rollback si un contacto falla (name en blanco viola el check).
do $$
declare
  v_count_before int;
begin
  select count(*) into v_count_before from customers;
  begin
    perform rpc_create_customer_with_contacts(
      '{"name":"Cliente Debe Revertirse"}'::jsonb,
      '[{"name":"Contacto Válido"},{"name":"   "}]'::jsonb
    );
    raise exception 'TEST 8 FALLÓ: se esperaba que la función lanzara una excepción';
  exception when others then
    if sqlerrm like 'TEST 8 FALLÓ%' then raise; end if;
    -- excepción esperada (violación del check customer_contacts_name_not_blank)
  end;
  if (select count(*) from customers) <> v_count_before then
    raise exception 'TEST 8 FALLÓ: el Customer no debió haber quedado creado (rollback esperado)';
  end if;
  if exists (select 1 from customers where name = 'Cliente Debe Revertirse') then
    raise exception 'TEST 8 FALLÓ: no debería existir ningún rastro del Customer';
  end if;
  raise notice 'TEST 7/8 OK: Customer + contactos es atómico — un contacto inválido revierte todo, incluido el Customer';
end $$;

-- 14/19) mismo nombre, RFC distinto (o sin RFC) -> Customers separados; "crear homónimo" también.
do $$
declare
  v_c1 customers;
  v_c2 customers;
begin
  select * into v_c1 from rpc_create_customer_with_contacts('{"name":"Constructora Norte","tax_id":"CNO010101AB1"}'::jsonb);
  select * into v_c2 from rpc_create_customer_with_contacts('{"name":"Constructora Norte","tax_id":"CNO020202CD2"}'::jsonb);
  if v_c1.id = v_c2.id then
    raise exception 'TEST 14 FALLÓ: deberían ser dos Customers distintos';
  end if;
  if (select count(*) from customers where name = 'Constructora Norte') < 3 then -- incluye el del fixture
    raise exception 'TEST 14/19 FALLÓ: deberían coexistir varios Customers homónimos sin bloqueo de unicidad';
  end if;
  raise notice 'TEST 14/19 OK: mismo nombre con RFC distinto (o "crear de todos modos") no se fusiona ni se bloquea';
end $$;

-- 18) Customer existente + agregar contacto (ruta "add_contacts" del import).
select test_set_user(:'vendedor1');
do $$
begin
  insert into customer_contacts (customer_id, name, email) values ('30000000-0000-0000-0000-000000000002', 'Contacto Agregado', 'agregado@norte.mx');
  if not exists (select 1 from customer_contacts where customer_id = '30000000-0000-0000-0000-000000000002' and name = 'Contacto Agregado') then
    raise exception 'TEST 18 FALLÓ: no se agregó el contacto al Customer existente';
  end if;
  raise notice 'TEST 18 OK: agregar contacto a un Customer existente (VENDEDOR, customer activo)';
end $$;

-- 20) Alta inline desde Cotizaciones: misma ruta que rpc_create_customer_with_contacts
-- con 1 contacto — ya probado en TEST 10. Verificación adicional: email/phone del
-- Customer quedan NULL cuando hay Contacto (semántica §E), y se llenan cuando no lo hay.
select test_set_user(:'admin');
do $$
declare
  v_with_contact customers;
  v_without_contact customers;
begin
  select * into v_with_contact from rpc_create_customer_with_contacts(
    '{"name":"Cliente Con Contacto Inline"}'::jsonb,
    '[{"name":"Contacto Inline","email":"contacto@inline.com","phone":"8110000077","is_primary":true}]'::jsonb
  );
  if v_with_contact.email is not null or v_with_contact.phone is not null then
    raise exception 'TEST 20a FALLÓ: con Contacto, el Customer NO debe llevar email/phone propios';
  end if;

  select * into v_without_contact from rpc_create_customer_with_contacts(
    '{"name":"Cliente Sin Contacto Inline","email":"directo@sincontacto.com","phone":"8110000088"}'::jsonb
  );
  if v_without_contact.email <> 'directo@sincontacto.com' or v_without_contact.phone <> '8110000088' then
    raise exception 'TEST 20b FALLÓ: sin Contacto, email/phone deben quedar en el Customer directamente';
  end if;

  raise notice 'TEST 20 OK: semántica Email/Teléfono según presencia de Contacto (§E), vía RPC igual que el diálogo inline';
end $$;

-- 22) Regresión Quotes: crear una Quote real tras 0021 sigue funcionando igual.
do $$
declare
  v_quote quotes;
  v_bu_id uuid;
  v_org_id uuid;
  v_sp_id uuid := '10000000-0000-0000-0000-000000000001';
  v_customer_id uuid := '30000000-0000-0000-0000-000000000001';
begin
  select id into v_bu_id from business_units where code = 'thunder_safety';
  select organization_id into v_org_id from business_units where code = 'thunder_safety';

  insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
  values (v_org_id, v_sp_id, v_bu_id, 'VU1')
  on conflict do nothing;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id,
      'salesperson_id', v_sp_id,
      'customer_id', v_customer_id,
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"model":"TLL200","quantity":2,"unit_price":1000,"line_discount_percent":0}]'::jsonb
  );

  if v_quote.folio is null or v_quote.subtotal <> 2000 or v_quote.total <= v_quote.subtotal then
    raise exception 'TEST 22 FALLÓ: rpc_create_quote no generó folio/subtotal/total esperados tras 0021 (subtotal=%, total=%)', v_quote.subtotal, v_quote.total;
  end if;
  raise notice 'TEST 22 OK: Quotes sigue funcionando idéntico tras 0021 (folio=%, subtotal=%, total=%)', v_quote.folio, v_quote.subtotal, v_quote.total;
end $$;

-- 23) Regresión Orders: crear un pedido real tras 0021 sigue funcionando igual (folio intacto).
do $$
declare
  v_order orders;
  v_sp_id uuid := '10000000-0000-0000-0000-000000000001';
  v_seq_before int;
  v_seq_after int;
begin
  select sequence_current into v_seq_before from salespeople where id = v_sp_id;

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', v_sp_id,
      'order_date', current_date::text,
      'client_name', 'Cliente de prueba regresión',
      'product_type', 'otro'
    ),
    '[{"model":"Producto X","quantity":1}]'::jsonb
  );

  select sequence_current into v_seq_after from salespeople where id = v_sp_id;

  if v_order.folio is null or v_order.folio !~ '^VU1-' then
    raise exception 'TEST 23 FALLÓ: folio de Order inesperado: %', v_order.folio;
  end if;
  if v_seq_after <> v_seq_before + 1 then
    raise exception 'TEST 23 FALLÓ: el consecutivo del vendedor no avanzó como se esperaba';
  end if;
  raise notice 'TEST 23 OK: Orders sigue funcionando idéntico tras 0021 (folio=%, consecutivo %->%)', v_order.folio, v_seq_before, v_seq_after;
end $$;

select 'TODAS LAS PRUEBAS 0021 PASARON' as resultado;

rollback;
