-- THÖREN Eliminación de Cotizaciones (0027) — pruebas funcionales contra
-- Postgres real. Reutiliza las Quotes A-E de 0023_fixtures.sql: A y E
-- (aceptada), B (aceptada, sin convertir), C (borrador), D (rechazada).

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set vendedor2 '00000000-0000-0000-0000-000000000003'
\set admin_orgb '00000000-0000-0000-0000-000000000009'
\set quote_a '80000000-0000-0000-0000-00000000000a'
\set quote_b '80000000-0000-0000-0000-00000000000b'
\set quote_c '80000000-0000-0000-0000-00000000000c'
\set quote_d '80000000-0000-0000-0000-00000000000d'
\set quote_e '80000000-0000-0000-0000-00000000000e'

select test_set_user(:'admin');

-- 1) ADMIN elimina Quote borrador (Quote C) — sin Order, elimina limpio.
do $$
declare
  v_items_before int;
  v_rows int;
begin
  select count(*) into v_items_before from quote_items where quote_id = '80000000-0000-0000-0000-00000000000c';
  if v_items_before < 1 then
    raise exception 'TEST 1 FALLÓ (setup): Quote C debería tener al menos 1 item';
  end if;

  delete from quotes where id = '80000000-0000-0000-0000-00000000000c';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 1 FALLÓ: ADMIN no pudo eliminar la Quote C (borrador), filas afectadas=%', v_rows;
  end if;
  raise notice 'TEST 1 OK: ADMIN elimina Quote borrador (% items eliminados en cascada)', v_items_before;
end $$;

-- 2) ADMIN elimina Quote rechazada (Quote D).
do $$
declare
  v_rows int;
begin
  delete from quotes where id = '80000000-0000-0000-0000-00000000000d';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 2 FALLÓ: ADMIN no pudo eliminar la Quote D (rechazada), filas afectadas=%', v_rows;
  end if;
  raise notice 'TEST 2 OK: ADMIN elimina Quote rechazada';
end $$;

-- 3) ADMIN elimina Quote aceptada SIN Order asociado (Quote B).
do $$
declare
  v_order_count int;
  v_rows int;
begin
  select count(*) into v_order_count from orders where source_quote_id = '80000000-0000-0000-0000-00000000000b';
  if v_order_count <> 0 then
    raise exception 'TEST 3 FALLÓ (setup): Quote B no debería tener Order asociado todavía';
  end if;

  delete from quotes where id = '80000000-0000-0000-0000-00000000000b';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'TEST 3 FALLÓ: ADMIN no pudo eliminar la Quote B (aceptada, sin Order), filas afectadas=%', v_rows;
  end if;
  raise notice 'TEST 3 OK: ADMIN elimina Quote aceptada sin Order asociado';
end $$;

-- 4) ADMIN NO puede eliminar Quote con Order asociado (Quote A) — bloqueo
--    real por FK orders_source_quote_id_fkey, no por RLS ni por el
--    pre-chequeo de la app.
select test_set_user(:'vendedor1');
do $$
declare
  v_order orders;
begin
  select * into v_order from rpc_create_order_from_quote('80000000-0000-0000-0000-00000000000a', 'otro', current_date);
  raise notice 'Setup TEST 4: Order % creado a partir de Quote A', v_order.folio;
end $$;
select test_set_user(:'admin');
do $$
declare
  v_failed boolean := false;
  v_error text;
begin
  begin
    delete from quotes where id = '80000000-0000-0000-0000-00000000000a';
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error = message_text;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: se permitió eliminar una Quote con Order asociado';
  end if;
  if v_error not like '%orders_source_quote_id_fkey%' then
    raise exception 'TEST 4 FALLÓ: el bloqueo no vino del FK esperado: %', v_error;
  end if;
  raise notice 'TEST 4 OK: Quote con Order bloqueada por FK real (%)', v_error;
end $$;

-- 5) VENDEDOR no puede eliminar ninguna Quote (Quote E, ni siquiera la
--    suya propia) — quotes_delete_admin es estrictamente admin-only.
select test_set_user(:'vendedor1');
do $$
declare
  v_rows int;
begin
  delete from quotes where id = '80000000-0000-0000-0000-00000000000e';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 5 FALLÓ: VENDEDOR pudo eliminar una Quote (% filas)', v_rows;
  end if;
  raise notice 'TEST 5 OK: VENDEDOR bloqueado (0 filas afectadas), incluso sobre su propia Quote';
end $$;

-- 6) Cross-org bloqueado — ADMIN de Org B no puede eliminar una Quote de
--    Org 1 (Quote E sigue existiendo).
select test_set_user(:'admin_orgb');
do $$
declare
  v_rows int;
begin
  delete from quotes where id = '80000000-0000-0000-0000-00000000000e';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'TEST 6 FALLÓ: ADMIN de Org B pudo eliminar una Quote de Org 1 (% filas)', v_rows;
  end if;
  raise notice 'TEST 6 OK: cross-org bloqueado (0 filas afectadas)';
end $$;
select test_set_user(:'admin');

-- 7) quote_items sin huérfanos tras las eliminaciones de TEST 1-3.
do $$
declare
  v_orphans int;
begin
  select count(*) into v_orphans from quote_items where quote_id not in (select id from quotes);
  if v_orphans <> 0 then
    raise exception 'TEST 7 FALLÓ: quedaron % quote_items huérfanos', v_orphans;
  end if;
  raise notice 'TEST 7 OK: cero quote_items huérfanos';
end $$;

-- 8) Customer permanece intacto.
do $$
declare
  v_name text;
begin
  select name into v_name from customers where id = '30000000-0000-0000-0000-000000000001';
  if v_name <> 'CEMEX' then
    raise exception 'TEST 8 FALLÓ: el Customer CEMEX cambió o desapareció (%)', v_name;
  end if;
  raise notice 'TEST 8 OK: Customer CEMEX intacto';
end $$;

-- 9) Business Unit permanece intacta.
do $$
declare
  v_active boolean;
begin
  select active into v_active from business_units where code = 'got_fresh_breath';
  if v_active is not true then
    raise exception 'TEST 9 FALLÓ: la Business Unit got_fresh_breath cambió o desapareció';
  end if;
  raise notice 'TEST 9 OK: Business Unit got_fresh_breath intacta';
end $$;

-- 10) Orders permanecen intactos — el Order creado en TEST 4 (setup) sigue
--     existiendo y apuntando a la Quote A (que NO se pudo eliminar).
do $$
declare
  v_count int;
begin
  select count(*) into v_count from orders where source_quote_id = '80000000-0000-0000-0000-00000000000a';
  if v_count <> 1 then
    raise exception 'TEST 10 FALLÓ: el Order de la Quote A no sigue intacto (count=%)', v_count;
  end if;
  raise notice 'TEST 10 OK: Order de la Quote A intacto';
end $$;

-- 11) Otras Quotes (E, y A que no se pudo eliminar) intactas.
do $$
declare
  v_count int;
begin
  select count(*) into v_count from quotes where id in ('80000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-00000000000e');
  if v_count <> 2 then
    raise exception 'TEST 11 FALLÓ: Quotes A/E deberían seguir existiendo (count=%)', v_count;
  end if;
  raise notice 'TEST 11 OK: Quotes A y E intactas';
end $$;

-- 12) El folio eliminado (Quote C, borrador) NO se reutiliza — el motor
--     de folios (salesperson_quote_sequences.sequence_current) es un
--     contador independiente que nunca retrocede al eliminar una Quote.
select test_set_user(:'vendedor1');
do $$
declare
  v_bu_id uuid;
  v_seq_before int;
  v_seq_after int;
  v_new_quote quotes;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';
  select sequence_current into v_seq_before
    from salesperson_quote_sequences
    where business_unit_id = v_bu_id and salesperson_id = '10000000-0000-0000-0000-000000000001';

  select * into v_new_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_id,
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0,
      'valid_until', (current_date + 15)::text
    ),
    '[{"model":"TLL200","quantity":1,"unit_price":500,"line_discount_percent":0}]'::jsonb
  );

  select sequence_current into v_seq_after
    from salesperson_quote_sequences
    where business_unit_id = v_bu_id and salesperson_id = '10000000-0000-0000-0000-000000000001';

  if v_seq_after <> v_seq_before + 1 then
    raise exception 'TEST 12 FALLÓ: el consecutivo no avanzó normalmente tras eliminar una Quote (antes=%, después=%)', v_seq_before, v_seq_after;
  end if;
  if v_new_quote.sequence_number <= v_seq_before then
    raise exception 'TEST 12 FALLÓ: el nuevo folio (%) no es mayor al consecutivo previo (%) — parecería estar reutilizando numeración', v_new_quote.folio, v_seq_before;
  end if;
  raise notice 'TEST 12 OK: folio eliminado no se reutiliza — nueva Quote % (consecutivo % -> %), nunca retrocede', v_new_quote.folio, v_seq_before, v_seq_after;
end $$;

select 'TESTS Quote Delete (0027) 1-12 PASARON' as resultado;

rollback;
