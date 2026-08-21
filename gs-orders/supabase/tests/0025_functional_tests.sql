-- THÖREN Quote Commercial Terms (0025) — pruebas funcionales contra
-- Postgres real. Cubre los puntos DB-testables de la lista de 20 pruebas
-- obligatorias del ajuste ("THÖREN — Quote Commercial Terms + Ajuste
-- final Quote PDF Premium"). Los puntos de renderizado del PDF (huecos
-- vacíos, secciones condicionales) se verifican por inspección de código +
-- build, no aquí — mismo criterio de "sin navegador real disponible" ya
-- declarado en fases anteriores de esta sesión.
--
-- Reutiliza los fixtures ya cargados por fixtures.sql/0023_fixtures.sql/
-- 0024_fixtures.sql: salesperson 10000000-...-0001 (Vendedor Uno, VU1,
-- BU got_fresh_breath 88a42557-b179-4ea5-8796-6e3005ba1be0), customer
-- CEMEX (30000000-...-0001), admin org1 (00000000-...-0001), admin Org B
-- (00000000-...-0009).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set sp1 '10000000-0000-0000-0000-000000000001'
\set bu1 '88a42557-b179-4ea5-8796-6e3005ba1be0'
\set cemex '30000000-0000-0000-0000-000000000001'

select test_set_user(:'vendedor1');

-- 1) Crear Quote SIN condiciones comerciales (payload sin las 3 claves) —
--    deben quedar NULL, sin inventar default.
do $$
declare
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', '88a42557-b179-4ea5-8796-6e3005ba1be0',
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"model":"TLL200","quantity":2,"unit_price":1000,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.payment_terms is not null or v_quote.delivery_time is not null or v_quote.customer_notes is not null then
    raise exception 'TEST 1 FALLÓ: los 3 campos deberían quedar NULL sin payload, got %/%/%',
      v_quote.payment_terms, v_quote.delivery_time, v_quote.customer_notes;
  end if;
  raise notice 'TEST 1 OK: Quote % creada sin condiciones comerciales, los 3 campos quedan NULL', v_quote.folio;
end $$;

-- 2) Crear Quote CON los tres campos — deben persistirse exactamente.
do $$
declare
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', '88a42557-b179-4ea5-8796-6e3005ba1be0',
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text,
      'payment_terms', '50% anticipo, 50% contra entrega',
      'delivery_time', '15 días hábiles',
      'customer_notes', 'Precios sujetos a cambio sin previo aviso.'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.payment_terms <> '50% anticipo, 50% contra entrega'
     or v_quote.delivery_time <> '15 días hábiles'
     or v_quote.customer_notes <> 'Precios sujetos a cambio sin previo aviso.' then
    raise exception 'TEST 2 FALLÓ: los 3 campos no se persistieron correctamente: %/%/%',
      v_quote.payment_terms, v_quote.delivery_time, v_quote.customer_notes;
  end if;
  raise notice 'TEST 2 OK: Quote % creada con los 3 campos comerciales persistidos exactamente', v_quote.folio;
end $$;

-- 3) Crear Quote base para las pruebas de edición (TEST 3-6), luego editar
--    Forma de pago vía rpc_update_quote (payload completo, como manda el
--    Quote Builder real).
do $$
declare
  v_quote quotes;
  v_updated quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', '88a42557-b179-4ea5-8796-6e3005ba1be0',
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text, 'notes', 'nota interna original'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  select * into v_updated from rpc_update_quote(
    v_quote.id,
    jsonb_build_object(
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text, 'notes', 'nota interna original',
      'payment_terms', 'Pago de contado'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  if v_updated.payment_terms <> 'Pago de contado' then
    raise exception 'TEST 3 FALLÓ: forma de pago no se actualizó: %', v_updated.payment_terms;
  end if;
  if v_updated.delivery_time is not null or v_updated.customer_notes is not null then
    raise exception 'TEST 3 FALLÓ: delivery_time/customer_notes deberían seguir NULL (no enviados)';
  end if;
  raise notice 'TEST 3 OK: Forma de pago editada correctamente vía rpc_update_quote (%)', v_updated.payment_terms;

  -- Guarda el id para TEST 4/5/6 vía temp table (createda antes de begin no aplica aquí,
  -- pero al ser el mismo bloque transaccional basta una variable de sesión).
  perform set_config('test.quote_edit_id', v_quote.id::text, false);
end $$;

-- 4) Editar Tiempo de entrega sobre la misma Quote — payment_terms ya
--    fijado en TEST 3 debe preservarse solo si se reenvía (mismo criterio
--    que el Quote Builder real: cada guardado manda el estado completo).
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_updated quotes;
begin
  select * into v_updated from rpc_update_quote(
    v_quote_id,
    jsonb_build_object(
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text, 'notes', 'nota interna original',
      'payment_terms', 'Pago de contado', 'delivery_time', '10 días hábiles'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );
  if v_updated.delivery_time <> '10 días hábiles' or v_updated.payment_terms <> 'Pago de contado' then
    raise exception 'TEST 4 FALLÓ: tiempo de entrega no se actualizó o payment_terms se perdió: %/%',
      v_updated.delivery_time, v_updated.payment_terms;
  end if;
  raise notice 'TEST 4 OK: Tiempo de entrega editado (%), forma de pago previa preservada (%)',
    v_updated.delivery_time, v_updated.payment_terms;
end $$;

-- 5) Editar Observaciones para el cliente sobre la misma Quote.
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_updated quotes;
begin
  select * into v_updated from rpc_update_quote(
    v_quote_id,
    jsonb_build_object(
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text, 'notes', 'nota interna original',
      'payment_terms', 'Pago de contado', 'delivery_time', '10 días hábiles',
      'customer_notes', 'Instalación incluida en el precio.'
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );
  if v_updated.customer_notes <> 'Instalación incluida en el precio.' then
    raise exception 'TEST 5 FALLÓ: observaciones para el cliente no se actualizaron: %', v_updated.customer_notes;
  end if;
  raise notice 'TEST 5 OK: Observaciones para el cliente editadas (%)', v_updated.customer_notes;
end $$;

-- 6) quote.notes sigue completamente separado: las 3 ediciones anteriores
--    (TEST 3-5), todas vía rpc_update_quote, nunca tocaron `notes`.
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_notes text;
begin
  select notes into v_notes from quotes where id = v_quote_id;
  if v_notes <> 'nota interna original' then
    raise exception 'TEST 6 FALLÓ: notes cambió inesperadamente tras editar condiciones comerciales: %', v_notes;
  end if;
  raise notice 'TEST 6 OK: quote.notes sigue intacta ("%") — separada de las condiciones comerciales', v_notes;
end $$;

-- 7) Quote existente ANTERIOR a 0025 (creada por 0023_fixtures.sql, antes
--    de que estas columnas existieran en esta sesión de pruebas) sigue
--    funcionando: los 3 campos nuevos son NULL, sin romper nada.
do $$
declare
  v_quote quotes;
begin
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000a';
  if v_quote.folio is null or v_quote.total is null then
    raise exception 'TEST 7 FALLÓ: la Quote preexistente no se pudo leer correctamente';
  end if;
  if v_quote.payment_terms is not null or v_quote.delivery_time is not null or v_quote.customer_notes is not null then
    raise exception 'TEST 7 FALLÓ: una Quote preexistente a 0025 no debería tener estos campos poblados';
  end if;
  raise notice 'TEST 7 OK: Quote preexistente % sigue funcionando, campos nuevos NULL sin backfill', v_quote.folio;
end $$;

-- 8) Duplicar Quote conserva las condiciones comerciales — simula
--    exactamente la lógica de duplicateQuote() (actions.ts): lee la Quote
--    origen + items, llama rpc_create_quote con el mismo payload
--    (incluyendo payment_terms/delivery_time/customer_notes), id y
--    vigencia nuevos.
do $$
declare
  v_source quotes;
  v_duplicate quotes;
begin
  select * into v_source from quotes where id = current_setting('test.quote_edit_id')::uuid;

  select * into v_duplicate from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_source.business_unit_id,
      'salesperson_id', v_source.salesperson_id,
      'customer_id', v_source.customer_id,
      'currency', v_source.currency, 'tax_rate', v_source.tax_rate,
      'global_discount_percent', v_source.global_discount_percent,
      'valid_until', (current_date + 15)::text,
      'notes', v_source.notes,
      'payment_terms', v_source.payment_terms,
      'delivery_time', v_source.delivery_time,
      'customer_notes', v_source.customer_notes
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  if v_duplicate.payment_terms is distinct from v_source.payment_terms
     or v_duplicate.delivery_time is distinct from v_source.delivery_time
     or v_duplicate.customer_notes is distinct from v_source.customer_notes then
    raise exception 'TEST 8 FALLÓ: la duplicación no conservó las condiciones comerciales: origen %/%/% vs duplicado %/%/%',
      v_source.payment_terms, v_source.delivery_time, v_source.customer_notes,
      v_duplicate.payment_terms, v_duplicate.delivery_time, v_duplicate.customer_notes;
  end if;
  if v_duplicate.folio = v_source.folio then
    raise exception 'TEST 8 FALLÓ: el duplicado debería tener folio nuevo';
  end if;
  raise notice 'TEST 8 OK: Quote % duplicada como % conserva payment_terms=%, delivery_time=%, customer_notes=%',
    v_source.folio, v_duplicate.folio, v_duplicate.payment_terms, v_duplicate.delivery_time, v_duplicate.customer_notes;
end $$;

-- 9) RLS sin cambios — VENDEDOR 2 no puede editar la Quote de VENDEDOR 1
--    (ni siquiera solo payment_terms): UPDATE directo bloqueado por
--    quotes_update_own_or_admin (0020), sin relación con 0025.
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_rows int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000003');
  update quotes set payment_terms = 'Intento no autorizado' where id = v_quote_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 9 FALLÓ: VENDEDOR 2 pudo modificar payment_terms de una Quote ajena (% filas)', v_rows;
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000002');
  raise notice 'TEST 9 OK: RLS sigue bloqueando a VENDEDOR 2 sobre una Quote ajena (0 filas afectadas)';
end $$;

-- 10) RLS — ADMIN de la organización SÍ puede actualizar las condiciones
--     comerciales de cualquier Quote de su organización (mismo criterio
--     que el resto del contenido de la Quote).
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_payment_terms text;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  update quotes set payment_terms = 'Actualizado por ADMIN' where id = v_quote_id;
  select payment_terms into v_payment_terms from quotes where id = v_quote_id;
  if v_payment_terms <> 'Actualizado por ADMIN' then
    raise exception 'TEST 10 FALLÓ: ADMIN no pudo actualizar payment_terms de una Quote de su organización';
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000002');
  raise notice 'TEST 10 OK: ADMIN de la organización puede actualizar condiciones comerciales (%)', v_payment_terms;
end $$;

-- 11) Aislamiento cross-org — ADMIN de Org B no ve la Quote de Org 1 en
--     absoluto (RLS por fila, sin relación con las columnas nuevas).
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_count int;
begin
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select count(*) into v_count from quotes where id = v_quote_id;
  perform test_set_user('00000000-0000-0000-0000-000000000002');
  if v_count <> 0 then
    raise exception 'TEST 11 FALLÓ: ADMIN de Org B pudo ver una Quote de Org 1 (% filas)', v_count;
  end if;
  raise notice 'TEST 11 OK: aislamiento cross-org intacto — ADMIN de Org B no ve la Quote de Org 1 (0 filas)';
end $$;

-- 12) Totales exactamente iguales — la Quote de TEST 2 (con los 3 campos
--     comerciales poblados) calcula el mismo total que calcularía sin
--     ellos: 1 x 500.00, IVA 16%, sin descuento -> subtotal 500.00,
--     tax_total 80.00, total 580.00.
do $$
declare
  v_quote quotes;
begin
  select * into v_quote from quotes
    where payment_terms = '50% anticipo, 50% contra entrega' and customer_notes = 'Precios sujetos a cambio sin previo aviso.';
  if v_quote.subtotal <> 500.00 or v_quote.discount_total <> 0.00 or v_quote.tax_total <> 80.00 or v_quote.total <> 580.00 then
    raise exception 'TEST 12 FALLÓ: totales incorrectos con condiciones comerciales pobladas: subtotal=% descuento=% iva=% total=%',
      v_quote.subtotal, v_quote.discount_total, v_quote.tax_total, v_quote.total;
  end if;
  raise notice 'TEST 12 OK: totales exactos con condiciones comerciales pobladas (subtotal=%, iva=%, total=%)',
    v_quote.subtotal, v_quote.tax_total, v_quote.total;
end $$;

-- 13) Congelamiento fuera de "borrador" — trg_quote_status_transition
--     (actualizado por 0025) debe rechazar un cambio directo de
--     payment_terms/delivery_time/customer_notes una vez la Quote deja de
--     estar en "borrador", igual que el resto del contenido comercial.
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_error text;
begin
  update quotes set status = 'enviada' where id = v_quote_id;

  begin
    update quotes set payment_terms = 'Cambio fuera de borrador' where id = v_quote_id;
    raise exception 'TEST 13 FALLÓ: se permitió modificar payment_terms fuera de status borrador';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error not like '%contenido comercial%' then
      raise exception 'TEST 13 FALLÓ: excepción inesperada: %', v_error;
    end if;
  end;
  raise notice 'TEST 13 OK: trg_quote_status_transition bloquea cambios a payment_terms fuera de borrador (%)', v_error;
end $$;

-- 14) Quote → Order no se rompe con condiciones comerciales pobladas —
--     rpc_create_order_from_quote (0023) sigue funcionando exactamente
--     igual; no lee ni copia payment_terms/delivery_time/customer_notes.
do $$
declare
  v_quote_id uuid := current_setting('test.quote_edit_id')::uuid;
  v_order orders;
begin
  update quotes set status = 'aceptada' where id = v_quote_id;

  select * into v_order from rpc_create_order_from_quote(v_quote_id, 'otro', current_date);
  if v_order.id is null or v_order.source_quote_id <> v_quote_id then
    raise exception 'TEST 14 FALLÓ: Quote → Order no generó un Order válido';
  end if;
  raise notice 'TEST 14 OK: Quote → Order sigue funcionando con condiciones comerciales pobladas (Order %)', v_order.folio;
end $$;

select 'TESTS Quote Commercial Terms (0025) 1-14 PASARON' as resultado;

rollback;
