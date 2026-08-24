-- THÖREN Quote → Order Hardening (0029) — pruebas funcionales contra
-- Postgres real. Corre DESPUÉS de: local_harness_setup.sql + migraciones
-- 0001-0029 + fixtures.sql + 0023_fixtures.sql + 0024_fixtures.sql. Todo
-- el script corre en una transacción que se revierte al final —
-- repetible. Reutiliza org1/bu1(got_fresh_breath)/vendedor1/vendedor2/
-- admin/admin_orgb/customer1(CEMEX)/quote_e de 0023_fixtures.sql — quote_e
-- está 'aceptada' y NUNCA fue convertida de forma permanente (su única
-- conversión, en 0023_functional_tests.sql TEST 14, corre dentro de una
-- transacción que también se revierte), así que sigue disponible aquí.
--
-- Nota técnica: dentro de bloques `do $$ ... $$`, psql NO interpola
-- variables `:'nombre'` (son texto opaco dentro de dollar-quoting) — igual
-- que el resto de los archivos de prueba de este proyecto (0023/0027/0028),
-- los ids fijos de fixtures se escriben aquí como literales UUID directos
-- dentro de los bloques; solo org1/bu1 (generados dinámicamente por el
-- bootstrap de 0013) se resuelven vía tabla temporal `_ids`.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as bu1 from business_units where organization_id = :'org1' and code = 'got_fresh_breath' \gset
create temp table _ids as select :'org1'::uuid as org1, :'bu1'::uuid as bu1;

-- =========================================================================
-- 1) CotizIA bloqueada por RPC — INSERT directo de una Quote histórica
--    (source='cotizia', status='aceptada'), sin pasar por la UI que oculta
--    el botón. rpc_create_order_from_quote debe rechazarla y no debe
--    quedar ningún Order.
-- =========================================================================
do $$
declare
  v_org1 uuid; v_bu1 uuid;
  v_quote_id uuid;
  v_failed boolean := false;
  v_error_message text;
begin
  select org1, bu1 into v_org1, v_bu1 from _ids;

  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, valid_until,
    customer_name, business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    source, original_folio
  ) values (
    v_org1, v_bu1, '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
    'KST-TEST-0029-A', 1, '2026-08-21', 'aceptada', 'MXN', '2026-09-21',
    'Cliente histórico test 0029', 'Got Fresh Breath Mexico', 'got_fresh_breath', 'Karla Saucedo',
    1000, 0, 160, 1160,
    'cotizia', 'KSJ-TEST-0029-A'
  )
  returning id into v_quote_id;

  begin
    perform rpc_create_order_from_quote(v_quote_id, 'otro', current_date);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 1 FALLÓ: se permitió convertir una Quote histórica (source=cotizia) a Order.';
  end if;
  if v_error_message not ilike '%histórica%' then
    raise exception 'TEST 1 FALLÓ: el mensaje de error no menciona que la Quote es histórica: %', v_error_message;
  end if;
  if exists (select 1 from orders where source_quote_id = v_quote_id) then
    raise exception 'TEST 1 FALLÓ: se creó un Order pese al rechazo.';
  end if;

  raise notice 'TEST 1 OK: Quote histórica (source=cotizia, aceptada) rechazada por rpc_create_order_from_quote — 0 Orders creados. Mensaje: %', v_error_message;
end $$;

-- =========================================================================
-- 2) Preservación de datos operativos Quote → Order. Crea una Quote real
--    THÖREN con payment_terms/delivery_time/customer_notes (vía
--    rpc_create_quote, que sí los acepta desde 0025) + warranty y
--    quote_items.unit/customer_requirements (vía UPDATE directo mientras
--    está en 'borrador' — rpc_create_quote/rpc_update_quote NUNCA
--    aceptaron esos 2 campos de item, ni warranty de encabezado; hallazgo
--    reportado aparte, no es parte del alcance de 0029). Convierte y
--    verifica que los 6 campos lleguen exactos al Order/order_item.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_bu1 uuid;
  v_quote quotes;
  v_item_id uuid;
begin
  select bu1 into v_bu1 from _ids;

  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu1,
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text,
      'payment_terms', 'CONTADO',
      'delivery_time', '4 SEMANAS',
      'customer_notes', 'Entregar en almacén central, atención Ing. Rodríguez'
    ),
    '[{"catalog_product_id":null,"model":"Proyector 0029 preservación","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  update quotes set warranty = '1 año por defectos de fabricación' where id = v_quote.id;

  select id into v_item_id from quote_items where quote_id = v_quote.id;
  update quote_items set unit = 'pza', customer_requirements = 'Grabado láser en la parte frontal' where id = v_item_id;

  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  perform set_config('test.preserve_quote_id', v_quote.id::text, false);
end $$;

do $$
declare
  v_quote_id uuid := current_setting('test.preserve_quote_id')::uuid;
  v_order orders;
  v_order_item order_items;
begin
  select * into v_order from rpc_create_order_from_quote(v_quote_id, 'otro', current_date);

  if v_order.payment_terms is distinct from 'CONTADO' then
    raise exception 'TEST 2 FALLÓ: payment_terms no se preservó, quedó %', v_order.payment_terms;
  end if;
  if v_order.delivery_time is distinct from '4 SEMANAS' then
    raise exception 'TEST 2 FALLÓ: delivery_time no se preservó, quedó %', v_order.delivery_time;
  end if;
  if v_order.warranty is distinct from '1 año por defectos de fabricación' then
    raise exception 'TEST 2 FALLÓ: warranty no se preservó, quedó %', v_order.warranty;
  end if;
  if v_order.customer_notes is distinct from 'Entregar en almacén central, atención Ing. Rodríguez' then
    raise exception 'TEST 2 FALLÓ: customer_notes no se preservó, quedó %', v_order.customer_notes;
  end if;

  select * into v_order_item from order_items where order_id = v_order.id limit 1;
  if v_order_item.unit is distinct from 'pza' then
    raise exception 'TEST 2 FALLÓ: unit no se preservó por item, quedó %', v_order_item.unit;
  end if;
  if v_order_item.customer_requirements is distinct from 'Grabado láser en la parte frontal' then
    raise exception 'TEST 2 FALLÓ: customer_requirements no se preservó por item, quedó %', v_order_item.customer_requirements;
  end if;

  perform set_config('test.preserve_order_id', v_order.id::text, false);
  raise notice 'TEST 2 OK: payment_terms/delivery_time/warranty/customer_notes (Order) y unit/customer_requirements (order_item) preservados exactos desde la Quote';
end $$;

-- =========================================================================
-- 3a) Regla de negocio (0031_quote_catalog_operational_fields.sql):
--     warranty es una condición comercial emitida al cliente, igual que
--     payment_terms/delivery_time/customer_notes — trg_quote_status_
--     transition (0025, extendido por 0031) la congela fuera de
--     "borrador". Se prueba en el camino REAL (rol authenticated, RLS y
--     trigger activos, sin bypass de ningún tipo): el intento debe
--     rechazarse.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.preserve_quote_id')::uuid;
  v_failed boolean := false;
  v_msg text;
begin
  begin
    update quotes set warranty = 'GARANTÍA MODIFICADA DESPUÉS DE CONVERTIR' where id = v_quote_id;
  exception when others then
    v_failed := true;
    get stacked diagnostics v_msg = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 3a FALLÓ: se esperaba que warranty quedara congelada fuera de "borrador" (Quote en estado aceptada)';
  end if;
  if v_msg not ilike '%no se puede modificar el contenido comercial%' then
    raise exception 'TEST 3a FALLÓ: mensaje de error inesperado: %', v_msg;
  end if;

  raise notice 'TEST 3a OK: warranty congelada fuera de "borrador" — mismo criterio que payment_terms/delivery_time/customer_notes';
end $$;

-- =========================================================================
-- 3b) Snapshot inmutable — prueba de independencia real del Order,
--     SIN debilitar la regla de negocio de 3a: el camino de producción
--     (rol authenticated) sigue rechazando cualquier cambio a warranty
--     fuera de "borrador" sin excepción. Para verificar que el Order de
--     verdad no relee la Quote (y no solo que el trigger lo impide), esta
--     prueba deshabilita trg_quotes_status_transition ÚNICAMENTE dentro de
--     esta transacción de prueba (que además termina en ROLLBACK al final
--     del archivo, sin dejar rastro) — nunca una operación disponible en
--     ningún camino de la aplicación real. Requiere el rol dueño de la
--     tabla (reset role, mismo patrón ya usado en 0028_functional_tests.sql
--     para simular el contexto de un script de datos con RLS bypaseada).
-- =========================================================================
reset role;
alter table quotes disable trigger trg_quotes_status_transition;

do $$
declare
  v_quote_id uuid := current_setting('test.preserve_quote_id')::uuid;
  v_order_id uuid := current_setting('test.preserve_order_id')::uuid;
  v_order_warranty_after text;
begin
  update quotes set warranty = 'GARANTÍA MODIFICADA DESPUÉS DE CONVERTIR (solo prueba, trigger deshabilitado)' where id = v_quote_id;

  select warranty into v_order_warranty_after from orders where id = v_order_id;
  if v_order_warranty_after is distinct from '1 año por defectos de fabricación' then
    raise exception 'TEST 3b FALLÓ: el Order reflejó un cambio posterior de la Quote — warranty quedó "%", debería seguir siendo el snapshot original', v_order_warranty_after;
  end if;

  raise notice 'TEST 3b OK: snapshot inmutable — el Order no relee la Quote en vivo (verificado con el trigger deshabilitado solo en esta transacción de prueba, jamás en producción)';
end $$;

alter table quotes enable trigger trg_quotes_status_transition;
set role authenticated;
select test_set_user(:'admin');

-- =========================================================================
-- 4) Regresión — Quote sin campos operativos (quote_e, de 0023_fixtures,
--    payment_terms/delivery_time/warranty/customer_notes todos NULL)
--    convierte sin error, con los 4 campos NULL en el Order (nunca se
--    inventa un valor). También re-confirma salesperson security y
--    formato de folio sin regresión (ADMIN convierte la Quote de
--    vendedor1).
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_order orders;
begin
  select * into v_order from rpc_create_order_from_quote(
    '80000000-0000-0000-0000-00000000000e', 'otro', current_date
  );

  if v_order.payment_terms is not null or v_order.delivery_time is not null
     or v_order.warranty is not null or v_order.customer_notes is not null then
    raise exception 'TEST 4 FALLÓ: se inventó un valor para un campo operativo ausente en la Quote — payment_terms=%, delivery_time=%, warranty=%, customer_notes=%',
      v_order.payment_terms, v_order.delivery_time, v_order.warranty, v_order.customer_notes;
  end if;
  if v_order.salesperson_id <> '10000000-0000-0000-0000-000000000001' then
    raise exception 'TEST 4 FALLÓ (salesperson security): ADMIN convirtió y el Order debería conservar el salesperson de la Quote (vendedor1), quedó %', v_order.salesperson_id;
  end if;
  if v_order.folio !~ '^VU1-[0-9]{8}-[0-9]{3}$' then
    raise exception 'TEST 4 FALLÓ (folios sin regresión): formato de folio inesperado: %', v_order.folio;
  end if;

  perform set_config('test.quote_e_order_id', v_order.id::text, false);
  raise notice 'TEST 4 OK: Quote sin campos operativos convierte limpio (4 campos NULL, sin inventar); salesperson security y folio sin regresión — Order %, folio %', v_order.id, v_order.folio;
end $$;

-- =========================================================================
-- 5) Order proveniente de Quote NO eliminable — ADMIN intenta eliminar el
--    Order de TEST 4 (source_quote_id = quote_e). Debe rechazarse con el
--    mensaje exacto pedido, y el Order/vínculo deben quedar intactos.
-- =========================================================================
do $$
declare
  v_order_id uuid := current_setting('test.quote_e_order_id')::uuid;
  v_failed boolean := false;
  v_error_message text;
  v_still_linked uuid;
begin
  begin
    perform rpc_delete_order(v_order_id);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 5 FALLÓ: ADMIN pudo eliminar un Order con source_quote_id.';
  end if;
  if v_error_message <> 'Este pedido fue generado desde una cotización y no puede eliminarse.' then
    raise exception 'TEST 5 FALLÓ: mensaje de error inesperado: %', v_error_message;
  end if;

  select source_quote_id into v_still_linked from orders where id = v_order_id;
  if v_still_linked is distinct from '80000000-0000-0000-0000-00000000000e'::uuid then
    raise exception 'TEST 5 FALLÓ: el vínculo Quote → Order se perdió tras el intento fallido de DELETE.';
  end if;

  raise notice 'TEST 5 OK (ADMIN): DELETE de Order con source_quote_id rechazado con el mensaje exacto; vínculo a la Quote origen intacto.';
end $$;

-- =========================================================================
-- 6) Mismo candado para el VENDEDOR dueño del Order — la regla no depende
--    de rol, ni siquiera el dueño puede eliminarlo (RLS orders_delete_own_
--    or_admin sí lo dejaría pasar a nivel de fila; el candado real vive
--    dentro de rpc_delete_order).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := current_setting('test.quote_e_order_id')::uuid;
  v_failed boolean := false;
  v_error_message text;
begin
  begin
    perform rpc_delete_order(v_order_id);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 6 FALLÓ: el VENDEDOR dueño pudo eliminar un Order con source_quote_id.';
  end if;
  if v_error_message <> 'Este pedido fue generado desde una cotización y no puede eliminarse.' then
    raise exception 'TEST 6 FALLÓ: mensaje de error inesperado: %', v_error_message;
  end if;

  raise notice 'TEST 6 OK (VENDEDOR dueño): mismo rechazo — la protección no depende del rol de quien intenta eliminar.';
end $$;

-- =========================================================================
-- 7) Doble conversión sigue bloqueada — tras los 2 intentos fallidos de
--    DELETE de arriba, reintentar convertir quote_e otra vez debe seguir
--    rechazado exactamente igual que antes de intentar borrar el Order.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare
  v_failed boolean := false;
  v_error_message text;
  v_order_count integer;
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000e', 'otro', current_date);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;

  if not v_failed then
    raise exception 'TEST 7 FALLÓ: se permitió reconvertir quote_e pese a ya tener un Order vinculado.';
  end if;
  if v_error_message <> 'Esta cotización ya fue convertida a un pedido.' then
    raise exception 'TEST 7 FALLÓ: mensaje de error inesperado: %', v_error_message;
  end if;

  select count(*) into v_order_count from orders where source_quote_id = '80000000-0000-0000-0000-00000000000e';
  if v_order_count <> 1 then
    raise exception 'TEST 7 FALLÓ: se esperaba exactamente 1 Order vinculado a quote_e, hay %', v_order_count;
  end if;

  raise notice 'TEST 7 OK: doble conversión sigue bloqueada tras los intentos fallidos de DELETE — exactamente 1 Order vinculado.';
end $$;

-- =========================================================================
-- 8) Order manual (sin Quote origen) sigue eliminándose normal — sujeto
--    únicamente a RLS/permisos de siempre, sin el candado nuevo.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_order_id uuid := gen_random_uuid();
  v_result record;
  v_still_exists boolean;
begin
  perform rpc_create_order(
    v_order_id,
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Cliente manual 0029',
      'product_type', 'otro',
      'status', 'borrador'
    ),
    '[]'::jsonb
  );

  select * into v_result from rpc_delete_order(v_order_id);

  select exists(select 1 from orders where id = v_order_id) into v_still_exists;
  if v_still_exists then
    raise exception 'TEST 8 FALLÓ: el Order manual debería haberse eliminado.';
  end if;

  raise notice 'TEST 8 OK: Order manual (source_quote_id NULL) se elimina normal, sin cambios de comportamiento.';
end $$;

-- =========================================================================
-- 9) Cross-org sigue bloqueado — ADMIN de Org B no ve ni puede convertir
--    ni eliminar nada de Org A (RLS filtra antes de llegar al candado
--    nuevo). Reutiliza el mismo criterio que TEST 17 de 0023 y TEST 6 de
--    0027, ahora contra las funciones ya modificadas por 0029.
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_failed boolean := false;
  v_error_message text;
  v_order_id uuid := current_setting('test.quote_e_order_id')::uuid;
begin
  -- 9a) Convertir una Quote de Org A desde Org B: RLS de quotes la oculta
  -- por completo, así que "no encontrada", nunca "histórica" ni "ya
  -- convertida" (aunque quote_e ya lo esté) — confirma que RLS sigue
  -- evaluándose antes que cualquier lógica de negocio de 0029.
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000e', 'otro', current_date);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;
  if not v_failed or v_error_message !~ 'no encontrada' then
    raise exception 'TEST 9a FALLÓ: Org B debería ver quote_e como no encontrada (RLS), obtuvo: failed=%, msg=%', v_failed, v_error_message;
  end if;

  -- 9b) Intentar eliminar un Order de Org A con source_quote_id desde Org
  -- B: RLS de orders lo oculta, "Pedido no encontrado" — nunca llega al
  -- candado nuevo (que solo dispara si la fila es visible).
  v_failed := false;
  begin
    perform rpc_delete_order(v_order_id);
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;
  if not v_failed or v_error_message !~ 'no encontrado' then
    raise exception 'TEST 9b FALLÓ: Org B debería ver el Order como no encontrado (RLS), obtuvo: failed=%, msg=%', v_failed, v_error_message;
  end if;

  raise notice 'TEST 9 OK: cross-org sigue bloqueado — RLS oculta Quote/Order de Org A antes de que 0029 aplique cualquier validación de negocio.';
end $$;

select 'TESTS 1-9 (0029 hardening) PASARON' as resultado;

rollback;
