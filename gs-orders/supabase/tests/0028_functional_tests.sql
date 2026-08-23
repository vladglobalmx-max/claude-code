-- THÖREN Quotes Historical Import — Esquema (0028) — pruebas funcionales
-- contra Postgres real. Reutiliza fixtures de 0023_fixtures.sql (bu1=
-- got_fresh_breath, salesperson VU1, customer CEMEX) para las Quotes de
-- control; no depende de las 61 cotizaciones reales (todavía no
-- importadas).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set salesperson_vu1 '10000000-0000-0000-0000-000000000001'
\set customer1 '30000000-0000-0000-0000-000000000001'
\set quote_a '80000000-0000-0000-0000-00000000000a'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as bu1 from business_units where organization_id = :'org1' and code = 'got_fresh_breath' \gset
create temp table _test_ids as
  select :'org1'::uuid as org1, :'bu1'::uuid as bu1,
    :'salesperson_vu1'::uuid as salesperson_vu1, :'customer1'::uuid as customer1;

-- 1) Regresión: Quote ya existente (quote_a, creada antes de 0028) tiene
--    source='thoren' y original_folio NULL por default — sin backfill
--    manual, el ALTER TABLE con DEFAULT ya lo resolvió.
do $$
declare
  v_source text;
  v_original_folio text;
begin
  select source, original_folio into v_source, v_original_folio
    from quotes where id = '80000000-0000-0000-0000-00000000000a';
  if v_source <> 'thoren' or v_original_folio is not null then
    raise exception 'TEST 1 FALLÓ: Quote preexistente debería tener source=thoren/original_folio=NULL, tiene source=%, original_folio=%', v_source, v_original_folio;
  end if;
  raise notice 'TEST 1 OK: Quote preexistente (quote_a) source=thoren, original_folio=NULL sin backfill manual';
end $$;

-- 2) INSERT directo de una Quote histórica válida (source=cotizia,
--    original_folio poblado, folio corregido) — simula exactamente lo que
--    hará el script de datos, sin pasar por fn_next_quote_folio/rpc_create_quote.
do $$
declare
  v_org1 uuid; v_bu1 uuid; v_salesperson uuid; v_customer uuid; v_id uuid;
begin
  select org1, bu1, salesperson_vu1, customer1 into v_org1, v_bu1, v_salesperson, v_customer from _test_ids;
  insert into quotes (
    organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status, currency, valid_until,
    customer_name, business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total,
    source, original_folio, warranty
  ) values (
    v_org1, v_bu1, v_salesperson, v_customer,
    'KST-TEST-001', 1, '2026-08-21', 'aceptada', 'MXN', '2026-09-21',
    'Cliente histórico test', 'Got Fresh Breath Mexico', 'got_fresh_breath', 'Karla Saucedo',
    1000, 0, 160, 1160,
    'cotizia', 'KSJ-TEST-001', '1 año por defectos de fabricación'
  )
  returning id into v_id;
  perform set_config('test.historical_quote_id', v_id::text, false);
  raise notice 'TEST 2 OK: INSERT directo de Quote histórica exitoso (id=%)', v_id;
end $$;

-- 3) CHECK constraint: source=cotizia con original_folio NULL → rechazado.
do $$
declare
  v_org1 uuid; v_bu1 uuid; v_salesperson uuid; v_customer uuid; v_failed boolean := false;
begin
  select org1, bu1, salesperson_vu1, customer1 into v_org1, v_bu1, v_salesperson, v_customer from _test_ids;
  begin
    insert into quotes (
      organization_id, business_unit_id, salesperson_id, customer_id,
      folio, sequence_number, quote_date, status, currency, valid_until,
      customer_name, business_unit_name, business_unit_code, salesperson_name,
      subtotal, discount_total, tax_total, total, source, original_folio
    ) values (
      v_org1, v_bu1, v_salesperson, v_customer,
      'KST-TEST-002', 2, '2026-08-21', 'aceptada', 'MXN', '2026-09-21',
      'x', 'x', 'x', 'x', 0, 0, 0, 0, 'cotizia', null
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se permitió source=cotizia con original_folio NULL';
  end if;
  raise notice 'TEST 3 OK: CHECK quotes_source_original_folio_consistent bloquea cotizia sin original_folio';
end $$;

-- 4) CHECK constraint: source=thoren con original_folio poblado → rechazado.
do $$
declare
  v_org1 uuid; v_bu1 uuid; v_salesperson uuid; v_customer uuid; v_failed boolean := false;
begin
  select org1, bu1, salesperson_vu1, customer1 into v_org1, v_bu1, v_salesperson, v_customer from _test_ids;
  begin
    insert into quotes (
      organization_id, business_unit_id, salesperson_id, customer_id,
      folio, sequence_number, quote_date, status, currency, valid_until,
      customer_name, business_unit_name, business_unit_code, salesperson_name,
      subtotal, discount_total, tax_total, total, source, original_folio
    ) values (
      v_org1, v_bu1, v_salesperson, v_customer,
      'VU1-TEST-003', 3, '2026-08-21', 'borrador', 'MXN', '2026-09-21',
      'x', 'x', 'x', 'x', 0, 0, 0, 0, 'thoren', 'algo'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: se permitió source=thoren con original_folio poblado';
  end if;
  raise notice 'TEST 4 OK: CHECK quotes_source_original_folio_consistent bloquea thoren con original_folio';
end $$;

-- 5) Índice único parcial: dos Quotes cotizia con el mismo original_folio
--    → la segunda rechazada (idempotencia real).
do $$
declare
  v_org1 uuid; v_bu1 uuid; v_salesperson uuid; v_customer uuid; v_failed boolean := false;
begin
  select org1, bu1, salesperson_vu1, customer1 into v_org1, v_bu1, v_salesperson, v_customer from _test_ids;
  begin
    insert into quotes (
      organization_id, business_unit_id, salesperson_id, customer_id,
      folio, sequence_number, quote_date, status, currency, valid_until,
      customer_name, business_unit_name, business_unit_code, salesperson_name,
      subtotal, discount_total, tax_total, total, source, original_folio
    ) values (
      v_org1, v_bu1, v_salesperson, v_customer,
      'KST-TEST-001-DUP', 1, '2026-08-21', 'aceptada', 'MXN', '2026-09-21',
      'x', 'x', 'x', 'x', 0, 0, 0, 0, 'cotizia', 'KSJ-TEST-001'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 5 FALLÓ: se permitió un original_folio duplicado (source=cotizia)';
  end if;
  raise notice 'TEST 5 OK: quotes_cotizia_original_folio_unique bloquea re-importación duplicada (idempotencia real)';
end $$;

-- 6) trg_prevent_quote_folio_change extendido: UPDATE de source/original_folio
--    sobre una Quote existente → rechazado.
do $$
declare
  v_quote_id uuid := current_setting('test.historical_quote_id')::uuid;
  v_failed boolean := false;
begin
  begin
    update quotes set source = 'thoren' where id = v_quote_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6a FALLÓ: se permitió cambiar source de una Quote existente';
  end if;

  v_failed := false;
  begin
    update quotes set original_folio = 'OTRO-FOLIO' where id = v_quote_id;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 6b FALLÓ: se permitió cambiar original_folio de una Quote existente';
  end if;
  raise notice 'TEST 6 OK: trg_prevent_quote_folio_change bloquea cambios a source/original_folio';
end $$;

-- 7) quote_items.unit/customer_requirements y quotes.warranty: texto
--    libre, nullable — nunca inventados.
--    HALLAZGO IMPORTANTE: quote_items_insert_borrador_own_or_admin (0020)
--    exige q.status = 'borrador' para CUALQUIER insert en quote_items,
--    incluso para ADMIN. La Quote histórica de TEST 2 quedó en 'aceptada'
--    (status real que tendrá en producción) — insertar sus items bajo una
--    sesión 'authenticated' normal sería bloqueado por esa misma RLS. El
--    script real de datos para las 61 Quotes debe correr con RLS bypaseada
--    (rol postgres/superusuario vía Supabase SQL Editor — el mismo
--    contexto ya usado para desplegar 0027), nunca como sesión autenticada
--    de la app. Replicamos ese contexto real aquí con reset role.
reset role;
do $$
declare
  v_quote_id uuid := current_setting('test.historical_quote_id')::uuid;
  v_item_con_datos uuid;
  v_item_sin_datos uuid;
  v_unit_leido text;
  v_req_leido text;
  v_warranty_leido text;
begin
  insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_subtotal, unit, customer_requirements)
    values (v_quote_id, 0, 'MOD-001', 'Producto con unidad y requisitos', 5, 200, 1000, 'pza', 'Serigrafía, un logo, un tono, un lado')
    returning id into v_item_con_datos;
  insert into quote_items (quote_id, position, model, description, quantity, unit_price, line_subtotal)
    values (v_quote_id, 1, 'MOD-002', 'Producto sin unidad ni requisitos en el PDF', 1, 500, 500)
    returning id into v_item_sin_datos;

  select unit, customer_requirements into v_unit_leido, v_req_leido from quote_items where id = v_item_con_datos;
  if v_unit_leido <> 'pza' then
    raise exception 'TEST 7a FALLÓ: unit no se guardó correctamente (esperado pza, obtenido %)', v_unit_leido;
  end if;
  if v_req_leido <> 'Serigrafía, un logo, un tono, un lado' then
    raise exception 'TEST 7b FALLÓ: customer_requirements no se guardó correctamente, obtenido %', v_req_leido;
  end if;

  select unit, customer_requirements into v_unit_leido, v_req_leido from quote_items where id = v_item_sin_datos;
  if v_unit_leido is not null or v_req_leido is not null then
    raise exception 'TEST 7c FALLÓ: unit/customer_requirements deberían ser NULL cuando no se especifican, obtenido unit=%, customer_requirements=%', v_unit_leido, v_req_leido;
  end if;

  select warranty into v_warranty_leido from quotes where id = v_quote_id;
  if v_warranty_leido <> '1 año por defectos de fabricación' then
    raise exception 'TEST 7d FALLÓ: quotes.warranty no se guardó correctamente, obtenido %', v_warranty_leido;
  end if;

  raise notice 'TEST 7 OK: quote_items.unit/customer_requirements y quotes.warranty almacenan texto libre y permiten NULL sin inventar valor (bajo rol postgres, como correrá el script real)';
end $$;
set role authenticated;

-- 8) Bucket quote-archive existe y es privado.
do $$
declare
  v_public boolean;
begin
  select public into v_public from storage.buckets where id = 'quote-archive';
  if v_public is null then
    raise exception 'TEST 8 FALLÓ: bucket quote-archive no existe';
  end if;
  if v_public then
    raise exception 'TEST 8 FALLÓ: bucket quote-archive es público, debe ser privado';
  end if;
  raise notice 'TEST 8 OK: bucket quote-archive existe y es privado (public=false)';
end $$;

-- 9) Storage RLS: ADMIN inserta el PDF histórico de su propia Quote — éxito.
do $$
declare
  v_quote_id uuid := current_setting('test.historical_quote_id')::uuid;
  v_org1 uuid;
  v_path text;
begin
  select org1 into v_org1 from _test_ids;
  v_path := v_org1::text || '/' || v_quote_id::text || '/original.pdf';
  insert into storage.objects (bucket_id, name) values ('quote-archive', v_path);
  perform set_config('test.historical_pdf_path', v_path, false);
  raise notice 'TEST 9 OK: ADMIN sube el PDF histórico a quote-archive (path=%)', v_path;
end $$;

-- 10) VENDEDOR bloqueado al intentar subir un archivo a quote-archive
--     (policy de insert es admin-only, sin excepción por ownership de Quote).
select test_set_user(:'vendedor1');
do $$
declare
  v_quote_id uuid := current_setting('test.historical_quote_id')::uuid;
  v_org1 uuid;
  v_path text;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;
  v_path := v_org1::text || '/' || v_quote_id::text || '/vendedor-intento.pdf';
  begin
    insert into storage.objects (bucket_id, name) values ('quote-archive', v_path);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 10 FALLÓ: VENDEDOR pudo subir un archivo a quote-archive';
  end if;
  raise notice 'TEST 10 OK: quote_archive_insert_admin bloquea a VENDEDOR (RLS)';
end $$;
select test_set_user(:'admin');

-- 11) Cross-org bloqueado: ADMIN de Org B no puede subir un archivo bajo el
--     path de una Quote de Org 1.
select test_set_user(:'admin_orgb');
do $$
declare
  v_quote_id uuid := current_setting('test.historical_quote_id')::uuid;
  v_org1 uuid;
  v_path text;
  v_failed boolean := false;
begin
  select org1 into v_org1 from _test_ids;
  v_path := v_org1::text || '/' || v_quote_id::text || '/crossorg-intento.pdf';
  begin
    insert into storage.objects (bucket_id, name) values ('quote-archive', v_path);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 11 FALLÓ: ADMIN de Org B pudo subir un archivo bajo el path de una Quote de Org 1';
  end if;
  raise notice 'TEST 11 OK: cross-org bloqueado en quote-archive (RLS insert)';
end $$;
select test_set_user(:'admin');

-- 12) SELECT: VENDEDOR (dueño de la Quote histórica, mismo salesperson_id)
--     puede ver el objeto vía la policy de select.
select test_set_user(:'vendedor1');
do $$
declare
  v_path text := current_setting('test.historical_pdf_path');
  v_found boolean;
begin
  select exists (select 1 from storage.objects where bucket_id = 'quote-archive' and name = v_path) into v_found;
  if not v_found then
    raise exception 'TEST 12 FALLÓ: VENDEDOR dueño de la Quote no pudo ver el PDF histórico vía RLS';
  end if;
  raise notice 'TEST 12 OK: quote_archive_select_member permite ver el PDF al VENDEDOR dueño de la Quote';
end $$;
select test_set_user(:'admin');

-- 13) Regresión: rpc_create_quote sigue funcionando exactamente igual,
--     source/original_folio quedan en su default (thoren/NULL) sin que la
--     app los toque.
do $$
declare
  v_bu1 uuid;
  v_salesperson uuid;
  v_customer uuid;
  v_quote record;
  v_source text;
  v_original_folio text;
begin
  select bu1, salesperson_vu1, customer1 into v_bu1, v_salesperson, v_customer from _test_ids;
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu1,
      'salesperson_id', v_salesperson,
      'customer_id', v_customer,
      'currency', 'MXN'
    ),
    '[]'::jsonb
  );
  select source, original_folio into v_source, v_original_folio from quotes where id = v_quote.id;
  if v_source <> 'thoren' or v_original_folio is not null then
    raise exception 'TEST 13 FALLÓ: rpc_create_quote no debería tocar source/original_folio, obtuvo source=%, original_folio=%', v_source, v_original_folio;
  end if;
  raise notice 'TEST 13 OK: rpc_create_quote sin regresión — folio real %, source=thoren, original_folio=NULL', v_quote.folio;
end $$;

-- 14) Folios: sequence_current de salesperson_quote_sequences para
--     VU1×got_fresh_breath NO cambió por nada de este archivo salvo por el
--     único rpc_create_quote real del TEST 13 (que sí debe incrementar en
--     1, es una Quote real de THÖREN) — las Quotes históricas insertadas
--     directamente (TEST 2) NUNCA lo tocaron.
do $$
declare
  v_salesperson uuid;
  v_seq int;
begin
  select salesperson_vu1 into v_salesperson from _test_ids;
  select sequence_current into v_seq
    from salesperson_quote_sequences
    where salesperson_id = v_salesperson;
  raise notice 'TEST 14 INFO: sequence_current actual = % (debe reflejar solo Quotes reales creadas vía rpc_create_quote, nunca las históricas insertadas directo)', v_seq;
end $$;

select 'TESTS Quotes Historical Import Schema (0028) 1-14 PASARON' as resultado;

rollback;
