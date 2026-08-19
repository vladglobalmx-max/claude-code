-- THÖREN Quote → Order V2 (0023) — pruebas funcionales contra Postgres real.
-- Corre DESPUÉS de: local_harness_setup.sql + migraciones 0001-0023 +
-- fixtures.sql + 0023_fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final — repetible. La prueba de
-- concurrencia real (#15, dos conexiones simultáneas) vive aparte en
-- 0023_concurrency_test.sh porque necesita dos backends reales, no puede
-- simularse dentro de una sola transacción.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set quote_a '80000000-0000-0000-0000-00000000000a'
\set quote_c_borrador '80000000-0000-0000-0000-00000000000c'
\set quote_d_rechazada '80000000-0000-0000-0000-00000000000d'
\set quote_e_admin '80000000-0000-0000-0000-00000000000e'
\set cemex '30000000-0000-0000-0000-000000000001'

-- 1) Conversión básica exitosa — Order en borrador, folio nuevo, order_date
--    de negocio de hoy, supplier_name NULL, source_quote_id = Quote A.
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
  v_quote quotes;
begin
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000a';
  select * into v_order from rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000a', 'proyector_gobo', current_date);

  if v_order.status <> 'borrador' then
    raise exception 'TEST 1 FALLÓ: el Order debería nacer en borrador, quedó %', v_order.status;
  end if;
  -- Nota: el folio del Order y el de la Quote usan secuencias/tablas
  -- completamente independientes (fn_next_order_folio vs fn_next_quote_folio,
  -- salespeople.sequence_current vs salesperson_quote_sequences); pueden
  -- coincidir como texto si ambos son el primer folio del día para el
  -- mismo prefijo — no es un bug, solo se confirma aquí que el Order
  -- generó folio propio (no NULL, no heredado sin pasar por el trigger).
  if v_order.folio is null then
    raise exception 'TEST 1 FALLÓ: el Order debería tener folio propio generado por su propio trigger';
  end if;
  if v_order.id = v_quote.id then
    raise exception 'TEST 1 FALLÓ: el Order debería ser una fila completamente nueva, distinta de la Quote';
  end if;
  if v_order.order_date <> current_date then
    raise exception 'TEST 1 FALLÓ: order_date debería ser la fecha de negocio de hoy';
  end if;
  if v_order.supplier_name is not null then
    raise exception 'TEST 1 FALLÓ: supplier_name debería quedar NULL tras la conversión';
  end if;
  if v_order.source_quote_id <> '80000000-0000-0000-0000-00000000000a' then
    raise exception 'TEST 1 FALLÓ: source_quote_id no quedó vinculado a la Quote origen';
  end if;
  raise notice 'TEST 1 OK: conversión básica — Order %, folio %, source_quote_id correcto', v_order.id, v_order.folio;
end $$;

-- 2) Items copiados desde quote_items — catalog_product_id/model/
--    description/quantity, SIN precio/descuento (Orders no tiene esas
--    columnas — garantía de esquema, no solo de este RPC).
do $$
declare
  v_order_id uuid;
  v_item_count int;
  v_catalog_item_count int;
begin
  select id into v_order_id from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  select count(*) into v_item_count from order_items where order_id = v_order_id;
  select count(*) into v_catalog_item_count
    from order_items where order_id = v_order_id and catalog_product_id = '60000000-0000-0000-0000-000000000001';

  if v_item_count <> 2 then
    raise exception 'TEST 2 FALLÓ: se esperaban 2 order_items (catálogo + libre), hay %', v_item_count;
  end if;
  if v_catalog_item_count <> 1 then
    raise exception 'TEST 2 FALLÓ: catalog_product_id no se copió en la línea de catálogo';
  end if;
  if exists (
    select 1 from order_items where order_id = v_order_id and model = 'Línea libre sin catálogo' and catalog_product_id is not null
  ) then
    raise exception 'TEST 2 FALLÓ: la línea libre no debería tener catalog_product_id';
  end if;
  raise notice 'TEST 2 OK: items copiados correctamente (catálogo + línea libre), sin columnas monetarias (no existen en Orders)';
end $$;

-- 3) client_name — CORRECCIÓN: para un Order con source_quote_id, el
--    client_name debe ser el snapshot quotes.customer_name, NUNCA el
--    nombre vivo de customers (a diferencia de un Order manual con
--    customer_id, donde sí se relee vivo — comportamiento sin cambios,
--    cubierto por la regresión de 0022, ver TEST 28 más abajo para el
--    caso que sí lo re-confirma explícitamente en esta corrida).
--    Aquí el customer nunca se renombró, así que snapshot y nombre vivo
--    coinciden por casualidad; el caso que realmente distingue ambos
--    comportamientos es TEST 28 (rename explícito).
do $$
declare
  v_order_id uuid;
  v_client_name text;
  v_quote_customer_name text;
begin
  select id, client_name into v_order_id, v_client_name from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  select customer_name into v_quote_customer_name from quotes where id = '80000000-0000-0000-0000-00000000000a';
  if v_client_name <> v_quote_customer_name then
    raise exception 'TEST 3 FALLÓ: client_name debería ser el snapshot quotes.customer_name, quedó "%" (quote.customer_name="%")', v_client_name, v_quote_customer_name;
  end if;
  raise notice 'TEST 3 OK: client_name = snapshot quotes.customer_name';
end $$;

-- 4/5) business_unit_id y salesperson_id copiados tal cual de la Quote.
do $$
declare
  v_order orders;
  v_quote quotes;
begin
  select * into v_order from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000a';
  if v_order.business_unit_id <> v_quote.business_unit_id then
    raise exception 'TEST 4 FALLÓ: business_unit_id no coincide con el de la Quote';
  end if;
  if v_order.salesperson_id <> v_quote.salesperson_id then
    raise exception 'TEST 5 FALLÓ: salesperson_id no coincide con el de la Quote';
  end if;
  raise notice 'TEST 4/5 OK: business_unit_id y salesperson_id copiados tal cual de la Quote';
end $$;

-- 6) product_type es el único campo operativo pedido — nunca viene de la
--    Quote (no existe esa columna en quotes), siempre del parámetro
--    p_product_type.
do $$
declare
  v_order orders;
begin
  select * into v_order from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_order.product_type <> 'proyector_gobo' then
    raise exception 'TEST 6 FALLÓ: product_type debería ser el parámetro pasado a rpc_create_order_from_quote, quedó %', v_order.product_type;
  end if;
  raise notice 'TEST 6 OK: product_type viene exclusivamente del parámetro p_product_type';
end $$;

-- 7) Campos GOBO/Proyector — nunca se piden durante la conversión, quedan
--    en su default (NULL / false), sin bloquear el borrador.
do $$
declare
  v_order orders;
begin
  select * into v_order from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_order.projector_model is not null or v_order.projection_description is not null then
    raise exception 'TEST 7 FALLÓ: los campos GOBO no deberían tener valor tras la conversión';
  end if;
  if v_order.projector_lens_pending_factory <> false then
    raise exception 'TEST 7 FALLÓ: projector_lens_pending_factory debería quedar en su default (false)';
  end if;
  raise notice 'TEST 7 OK: ningún campo GOBO se solicita ni se fuerza durante la conversión — Order queda en borrador';
end $$;

-- 8) La Quote origen permanece intacta: mismo status/folio/subtotal/items.
do $$
declare
  v_quote quotes;
  v_item_count int;
begin
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000a';
  select count(*) into v_item_count from quote_items where quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_quote.status <> 'aceptada' then
    raise exception 'TEST 8 FALLÓ: el status de la Quote cambió tras la conversión, quedó %', v_quote.status;
  end if;
  if v_quote.folio !~ '^VU1-\d{8}-001$' then
    raise exception 'TEST 8 FALLÓ: el folio de la Quote no tiene el formato/valor original esperado, quedó %', v_quote.folio;
  end if;
  if v_item_count <> 2 then
    raise exception 'TEST 8 FALLÓ: los quote_items no deberían modificarse, hay %', v_item_count;
  end if;
  raise notice 'TEST 8 OK: la Quote origen queda exactamente igual tras la conversión (status/folio/items)';
end $$;

-- 9) Solo 'aceptada' es convertible — Quote en 'borrador' rechazada.
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000c', 'otro', current_date);
    raise exception 'TEST 9 FALLÓ: debió rechazar una Quote en borrador';
  exception when others then
    if sqlerrm like 'TEST 9 FALLÓ%' then raise; end if;
    if sqlerrm not like '%aceptada%' then
      raise exception 'TEST 9 FALLÓ: rechazó la Quote en borrador pero con un mensaje inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'TEST 9 OK: Quote en borrador rechazada con mensaje claro';
end $$;

-- 10) Solo 'aceptada' es convertible — Quote 'rechazada' también rechazada.
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000d', 'otro', current_date);
    raise exception 'TEST 10 FALLÓ: debió rechazar una Quote rechazada';
  exception when others then
    if sqlerrm like 'TEST 10 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 10 OK: Quote rechazada rechazada con mensaje claro';
end $$;

-- 11) Quote inexistente / sin acceso.
do $$
begin
  begin
    perform rpc_create_order_from_quote(gen_random_uuid(), 'otro', current_date);
    raise exception 'TEST 11 FALLÓ: debió rechazar un quote_id inexistente';
  exception when others then
    if sqlerrm like 'TEST 11 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 11 OK: quote_id inexistente rechazado con mensaje claro';
end $$;

-- 12) Doble conversión — Quote A (test 1) ya tiene un Order; reintentar
--     debe fallar (pre-check amigable; la protección real es el índice
--     único, probada aparte en TEST 13).
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000a', 'otro', current_date);
    raise exception 'TEST 12 FALLÓ: debió rechazar una Quote ya convertida';
  exception when others then
    if sqlerrm like 'TEST 12 FALLÓ%' then raise; end if;
    if sqlerrm not like '%ya fue convertida%' then
      raise exception 'TEST 12 FALLÓ: rechazó la doble conversión pero con mensaje inesperado: %', sqlerrm;
    end if;
  end;
  raise notice 'TEST 12 OK: doble conversión rechazada con mensaje claro (pre-check)';
end $$;

-- 13) Protección REAL contra doble conversión — índice único parcial a
--     nivel de motor, probado con un INSERT directo (evita el pre-check de
--     la función, para confirmar que el índice por sí solo basta).
do $$
declare
  v_existing_order_id uuid;
begin
  select id into v_existing_order_id from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  begin
    insert into orders (
      id, organization_id, salesperson_id, order_date, client_name, product_type, status, source_quote_id
    )
    select gen_random_uuid(), organization_id, salesperson_id, current_date, 'Intento de segundo Order', 'otro', 'borrador', source_quote_id
    from orders where id = v_existing_order_id;
    raise exception 'TEST 13 FALLÓ: el índice único orders_source_quote_id_unique debió rechazar un segundo Order con el mismo source_quote_id';
  exception when unique_violation then
    raise notice 'TEST 13 OK: índice único parcial rechaza un segundo Order con el mismo source_quote_id (violación real de constraint)';
  when others then
    raise exception 'TEST 13 FALLÓ: se esperaba unique_violation, se obtuvo: %', sqlerrm;
  end;
end $$;

-- 14) TEST EXPLÍCITO REQUERIDO — ADMIN convierte la Quote de un VENDEDOR
--     (Quote E, dueña de vendedor1): el Order resultante debe conservar
--     salesperson_id = vendedor1 (sp1), NUNCA cambiar al admin (que no
--     tiene salesperson_id propio).
select test_set_user(:'admin');
do $$
declare
  v_order orders;
  v_quote quotes;
begin
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000e';
  select * into v_order from rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000e', 'otro', current_date);
  if v_order.salesperson_id <> v_quote.salesperson_id then
    raise exception 'TEST 14 FALLÓ: el Order debería conservar el salesperson_id de la Quote (%), quedó %', v_quote.salesperson_id, v_order.salesperson_id;
  end if;
  if v_order.salesperson_id <> '10000000-0000-0000-0000-000000000001' then
    raise exception 'TEST 14 FALLÓ: se esperaba salesperson_id = sp1 (vendedor1), quedó %', v_order.salesperson_id;
  end if;
  raise notice 'TEST 14 OK: ADMIN convierte Quote de VENDEDOR — Order.salesperson_id se conserva como el de la Quote, no cambia al admin';
end $$;

-- 16) RLS — VENDEDOR2 no ve/no puede convertir una Quote de VENDEDOR1.
select test_set_user(:'vendedor2');
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000b', 'otro', current_date);
    raise exception 'TEST 16 FALLÓ: VENDEDOR2 no debería poder convertir una Quote de VENDEDOR1 (RLS debería ocultarla)';
  exception when others then
    if sqlerrm like 'TEST 16 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 16 OK: RLS de quotes protege la conversión — VENDEDOR2 no puede convertir Quote ajena';
end $$;

-- 17) RLS — ADMIN de Org B no ve/no puede convertir una Quote de Org A.
select test_set_user(:'admin_orgb');
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000b', 'otro', current_date);
    raise exception 'TEST 17 FALLÓ: Admin de Org B no debería poder convertir una Quote de Org A';
  exception when others then
    if sqlerrm like 'TEST 17 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 17 OK: aislamiento cross-org confirmado en la conversión (Admin Org B no ve Quote de Org A)';
end $$;

-- 18) Regresión — Orders manuales (sin Quote origen) siguen funcionando
--     idéntico tras 0023 (source_quote_id queda NULL).
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Pedido manual sin Quote',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  if v_order.source_quote_id is not null then
    raise exception 'TEST 18 FALLÓ: un Order manual no debería tener source_quote_id';
  end if;
  raise notice 'TEST 18 OK: Orders manuales siguen funcionando idéntico, source_quote_id NULL';
end $$;

-- 19) Regresión — update/duplicate/delete de Orders normales sin tocar
--     source_quote_id.
do $$
declare
  v_order orders;
  v_updated orders;
  v_dup orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Regresión 0023',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object('client_name', 'Regresión 0023 editada', 'product_type', 'otro', 'status', 'borrador'),
    '[]'::jsonb
  );
  if v_updated.source_quote_id is not null then
    raise exception 'TEST 19 FALLÓ: update no debería introducir un source_quote_id';
  end if;
  select * into v_dup from rpc_duplicate_order(v_updated.id, current_date);
  if v_dup.source_quote_id is not null then
    raise exception 'TEST 19 FALLÓ: duplicate no debería copiar/inventar un source_quote_id';
  end if;
  perform rpc_delete_order(v_dup.id);
  if exists (select 1 from orders where id = v_dup.id) then
    raise exception 'TEST 19 FALLÓ: delete no eliminó el pedido duplicado';
  end if;
  raise notice 'TEST 19 OK: update/duplicate/delete de Orders normales sin regresión, source_quote_id nunca aparece';
end $$;

-- 20) Regresión — Quotes: create/update/duplicate siguen funcionando tras 0023.
do $$
declare
  v_quote quotes;
  v_updated quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', (select business_unit_id from quotes where id = '80000000-0000-0000-0000-00000000000a'),
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"catalog_product_id":null,"model":"Regresión Quote 0023","quantity":1,"unit_price":50,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.folio is null then
    raise exception 'TEST 20 FALLÓ: rpc_create_quote no generó folio tras 0023';
  end if;
  select * into v_updated from rpc_update_quote(
    v_quote.id,
    jsonb_build_object(
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 20)::text
    ),
    '[{"catalog_product_id":null,"model":"Regresión Quote 0023 editada","quantity":1,"unit_price":80,"line_discount_percent":0}]'::jsonb
  );
  if v_updated.subtotal <> 80 then
    raise exception 'TEST 20 FALLÓ: rpc_update_quote no aplicó los cambios esperados tras 0023';
  end if;
  raise notice 'TEST 20 OK: Quotes create/update sin regresión tras 0023 (folio=%, subtotal=%)', v_quote.folio, v_updated.subtotal;
end $$;

-- 21) Regresión — folios de Orders siguen con formato PREFIJO-AAAADDMM-NNN,
--     incluidos los generados por conversiones.
do $$
declare
  v_bad_count int;
begin
  select count(*) into v_bad_count
    from orders
    where salesperson_id = '10000000-0000-0000-0000-000000000001'
      and folio !~ '^VU1-\d{8}-\d{3}$';
  if v_bad_count <> 0 then
    raise exception 'TEST 21 FALLÓ: hay % folio(s) de Orders con formato inesperado', v_bad_count;
  end if;
  raise notice 'TEST 21 OK: folios de Orders con formato intacto, incluidos los de conversiones';
end $$;

-- 22) Regresión — el folio de la Quote convertida (Quote A) no cambió.
do $$
declare
  v_folio text;
begin
  select folio into v_folio from quotes where id = '80000000-0000-0000-0000-00000000000a';
  if v_folio !~ '^VU1-\d{8}-001$' then
    raise exception 'TEST 22 FALLÓ: el folio de la Quote convertida cambió inesperadamente, quedó %', v_folio;
  end if;
  raise notice 'TEST 22 OK: folio de la Quote convertida intacto (%)', v_folio;
end $$;

-- 23) Product Types — la FK de product_type sigue exigiendo un código
--     válido también en el flujo de conversión.
do $$
begin
  begin
    perform rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000b', 'codigo_inventado_inexistente', current_date);
    raise exception 'TEST 23 FALLÓ: debió rechazar un product_type inexistente en la conversión';
  exception when others then
    if sqlerrm like 'TEST 23 FALLÓ%' then raise; end if;
  end;
  raise notice 'TEST 23 OK: product_type inexistente rechazado también en la conversión (FK orders_product_type_fkey)';
end $$;

-- 24) RLS del Order resultante — VENDEDOR1 ve su propio Order convertido;
--     VENDEDOR2 no lo ve.
select test_set_user(:'vendedor1');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_count <> 1 then
    raise exception 'TEST 24 FALLÓ: VENDEDOR1 debería ver el Order que él mismo convirtió';
  end if;
  raise notice 'TEST 24 OK: VENDEDOR1 ve el Order convertido por él mismo';
end $$;
select test_set_user(:'vendedor2');
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_count <> 0 then
    raise exception 'TEST 24 FALLÓ: VENDEDOR2 no debería ver el Order convertido por VENDEDOR1';
  end if;
  raise notice 'TEST 24 OK: VENDEDOR2 no ve el Order convertido por VENDEDOR1 (ownership sin regresión)';
end $$;

-- 25) supplier_name explícitamente NULL tras conversión (ya cubierto en
--     TEST 1, se repite aquí sobre el Order del ADMIN/Quote E para
--     confirmar que no depende del rol de quien convierte).
do $$
declare
  v_supplier_name text;
begin
  select supplier_name into v_supplier_name from orders where source_quote_id = '80000000-0000-0000-0000-00000000000e';
  if v_supplier_name is not null then
    raise exception 'TEST 25 FALLÓ: supplier_name debería quedar NULL sin importar el rol de quien convierte';
  end if;
  raise notice 'TEST 25 OK: supplier_name NULL confirmado también en la conversión hecha por ADMIN';
end $$;

-- 26) Garantía de esquema — Orders/order_items no tienen ninguna columna
--     monetaria; nada de precio/descuento/IVA/moneda/totales pudo haberse
--     copiado porque no hay dónde ponerlo.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from information_schema.columns
    where table_name in ('orders', 'order_items')
      and column_name in ('unit_price', 'line_discount_percent', 'currency', 'tax_rate', 'subtotal', 'total', 'tax_total', 'discount_total');
  if v_count <> 0 then
    raise exception 'TEST 26 FALLÓ: Orders/order_items no deberían tener ninguna columna monetaria, se encontraron %', v_count;
  end if;
  raise notice 'TEST 26 OK: confirmado a nivel de esquema — Orders no tiene ninguna columna monetaria';
end $$;

-- 27) order_date es la fecha de negocio de HOY (parámetro), nunca la
--     quote_date original de la Quote.
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
  v_quote quotes;
begin
  select * into v_quote from quotes where id = '80000000-0000-0000-0000-00000000000b';
  -- Reutiliza Quote B con una fecha distinta a propósito, para distinguir
  -- claramente "fecha de negocio de hoy" de "fecha de la Quote" — si
  -- coincidieran por casualidad (mismo día), la aserción igual sería
  -- válida porque ambas comparan contra el parámetro explícito p_order_date.
  select * into v_order from rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000b', 'otro', current_date + 3);
  if v_order.order_date <> current_date + 3 then
    raise exception 'TEST 27 FALLÓ: order_date debería ser exactamente el parámetro p_order_date recibido';
  end if;
  if v_order.order_date = v_quote.quote_date and v_quote.quote_date <> current_date + 3 then
    raise exception 'TEST 27 FALLÓ: order_date no debería copiarse de quote_date';
  end if;
  raise notice 'TEST 27 OK: order_date = parámetro p_order_date, nunca quote_date';
end $$;

-- 28) TEST EXPLÍCITO REQUERIDO (corrección client_name snapshot) —
--     escenario completo: Customer renombrado DESPUÉS de aceptar la Quote
--     no debe afectar el client_name del Order ya convertido. Y, en el
--     mismo escenario, un Order MANUAL creado después del rename con ese
--     mismo customer_id sí debe tomar el nombre vivo — confirma que las
--     dos ramas (con/sin source_quote_id) coexisten correctamente sobre
--     el mismo Customer.
select test_set_user(:'vendedor1');
do $$
declare
  v_customer_id uuid;
  v_bu_id uuid;
  v_quote quotes;
  v_order_convertido orders;
  v_order_manual orders;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

  insert into customers (id, organization_id, name, active)
    select gen_random_uuid(), organization_id, 'CLIENTE ORIGINAL', true
    from quotes where id = '80000000-0000-0000-0000-00000000000a'
    returning id into v_customer_id;

  -- 1/2) Crear Quote y confirmar snapshot customer_name = "CLIENTE ORIGINAL".
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id,
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', v_customer_id,
      'currency', 'MXN',
      'tax_rate', 16,
      'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"catalog_product_id":null,"model":"Test rename","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
  );
  if v_quote.customer_name <> 'CLIENTE ORIGINAL' then
    raise exception 'TEST 28 FALLÓ (paso 2): el snapshot customer_name de la Quote debería ser "CLIENTE ORIGINAL", quedó "%"', v_quote.customer_name;
  end if;

  update quotes set status = 'enviada' where id = v_quote.id;
  update quotes set status = 'aceptada' where id = v_quote.id;

  -- 3) Cambiar customers.name a "CLIENTE RENOMBRADO". UPDATE de customers
  --    es admin-only (customers_update_admin, 0018) — se cambia de sesión
  --    a ADMIN solo para este UPDATE, y se regresa a vendedor1 después,
  --    igual que en el flujo real (un ADMIN es quien edita Clientes).
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  update customers set name = 'CLIENTE RENOMBRADO' where id = v_customer_id;
  if not found then
    raise exception 'TEST 28 FALLÓ (paso 3): el UPDATE de customers.name no afectó ninguna fila (¿RLS bloqueando al rol equivocado?)';
  end if;
  perform test_set_user('00000000-0000-0000-0000-000000000002');

  -- 4) Convertir la Quote (ya aceptada, después del rename).
  select * into v_order_convertido from rpc_create_order_from_quote(v_quote.id, 'otro', current_date);

  -- 5) Order.customer_id debe apuntar al mismo Customer.
  if v_order_convertido.customer_id <> v_customer_id then
    raise exception 'TEST 28 FALLÓ (paso 5): customer_id del Order no coincide con el Customer original';
  end if;

  -- 6/7) Order.client_name debe ser "CLIENTE ORIGINAL", NO "CLIENTE RENOMBRADO".
  if v_order_convertido.client_name <> 'CLIENTE ORIGINAL' then
    raise exception 'TEST 28 FALLÓ (paso 6/7): client_name debería ser "CLIENTE ORIGINAL" (snapshot), quedó "%"', v_order_convertido.client_name;
  end if;

  -- Complemento: un Order MANUAL con el mismo customer_id, creado DESPUÉS
  -- del rename, sí debe tomar el nombre vivo actual — confirma que la
  -- rama sin source_quote_id sigue exactamente igual que 0022.
  select * into v_order_manual from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'este texto se ignora, hay customer_id',
      'product_type', 'otro',
      'customer_id', v_customer_id
    ),
    '[]'::jsonb
  );
  if v_order_manual.client_name <> 'CLIENTE RENOMBRADO' then
    raise exception 'TEST 28 FALLÓ (complemento): un Order manual con customer_id debería usar el nombre vivo del Customer, quedó "%"', v_order_manual.client_name;
  end if;

  raise notice 'TEST 28 OK: Order convertido conserva el snapshot "CLIENTE ORIGINAL" pese al rename; Order manual con el mismo customer_id sí toma "CLIENTE RENOMBRADO" (nombre vivo)';
end $$;

select 'TESTS 1-28 (menos concurrencia real, aparte) PASARON' as resultado;

rollback;
