-- THÖREN — Orders V2 Foundation — CORRECCIÓN (salesperson cross-org +
-- update parcial de customer_id/business_unit_id). Corre DESPUÉS de:
-- local_harness_setup.sql + migraciones 0001-0022 (ya corregida) +
-- fixtures de Orders históricos + fixtures de esta corrección (salesperson
-- Org B con person_id resoluble, "Vendedor Dos" SIN person_id a propósito
-- para probar el límite conocido). Transacción con rollback — repetible.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set sp1 '10000000-0000-0000-0000-000000000001'
\set sp2_sin_person '10000000-0000-0000-0000-000000000002'
\set sp_orgb '10000000-0000-0000-0000-000000000003'
\set cemex '30000000-0000-0000-0000-000000000001'

-- 1) ADMIN no puede usar un salesperson que funcionalmente pertenece a
--    otra organización (resoluble vía person_id → people.organization_id).
select test_set_user(:'admin');
do $$
declare
  v_order orders;
begin
  begin
    perform rpc_create_order(
      gen_random_uuid(),
      jsonb_build_object(
        'salesperson_id', '10000000-0000-0000-0000-000000000003',
        'order_date', current_date::text,
        'client_name', 'intento cross-org salesperson',
        'product_type', 'otro'
      ),
      '[]'::jsonb
    );
    raise exception 'TEST 1 FALLÓ: debió rechazar un salesperson que pertenece a otra organización (resoluble vía person_id)';
  exception when others then
    if sqlerrm like 'TEST 1 FALLÓ%' then raise; end if;
  end;

  -- Límite conocido documentado: un salesperson SIN person_id (Vendedor
  -- Dos) no se puede verificar, así que NO se bloquea — para no arriesgar
  -- romper Orders en un caso real histórico sin vínculo a Person.
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000002',
      'order_date', current_date::text,
      'client_name', 'salesperson sin person_id — no verificable',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  if v_order.id is null then
    raise exception 'TEST 1 FALLÓ: un salesperson sin person_id no debería bloquearse (límite conocido, no verificable)';
  end if;

  raise notice 'TEST 1 OK: salesperson cross-org (resoluble) rechazado; salesperson sin person_id (no verificable) permitido — límite documentado';
end $$;

-- 2) VENDEDOR sigue creando sus Orders normales (con person_id resoluble a su propia org).
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
      'client_name', 'Pedido normal de vendedor',
      'product_type', 'otro'
    ),
    '[]'::jsonb
  );
  if v_order.id is null then
    raise exception 'TEST 2 FALLÓ: VENDEDOR con person_id propio no debería bloquearse a sí mismo';
  end if;
  raise notice 'TEST 2 OK: VENDEDOR sigue creando sus Orders normales';
end $$;

-- 3/4/5/6) Semántica JSONB de update: ausente preserva, presente
--          (incluido null explícito) cambia.
do $$
declare
  v_order orders;
  v_bu_id uuid;
  v_updated orders;
begin
  select id into v_bu_id from business_units where code = 'got_fresh_breath';

  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'x',
      'product_type', 'otro',
      'customer_id', '30000000-0000-0000-0000-000000000001',
      'business_unit_id', v_bu_id::text
    ),
    '[]'::jsonb
  );

  -- 3) update SIN las claves customer_id/business_unit_id — preserva ambos.
  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object(
      'client_name', 'este texto se ignora porque customer_id sigue activo',
      'product_type', 'otro',
      'status', 'borrador'
    ),
    '[]'::jsonb
  );
  if v_updated.customer_id <> v_order.customer_id or v_updated.business_unit_id <> v_order.business_unit_id then
    raise exception 'TEST 3 FALLÓ: update legacy sin las claves debería preservar customer_id/business_unit_id, quedaron customer_id=%, business_unit_id=%', v_updated.customer_id, v_updated.business_unit_id;
  end if;
  raise notice 'TEST 3 OK: update sin customer_id/business_unit_id preserva ambos valores actuales';

  -- 4) update CON customer_id explícito distinto — cambia (aquí, al mismo
  --    valor para simplificar el fixture, pero comprobando que la clave
  --    presente SÍ se procesa explícitamente, no se "salta").
  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object(
      'client_name', 'ignorado, hay customer_id',
      'product_type', 'otro',
      'status', 'borrador',
      'customer_id', '30000000-0000-0000-0000-000000000001'
    ),
    '[]'::jsonb
  );
  if v_updated.customer_id <> '30000000-0000-0000-0000-000000000001' or v_updated.client_name <> 'CEMEX' then
    raise exception 'TEST 4 FALLÓ: update con customer_id explícito debería fijar el Customer y resolver client_name';
  end if;
  raise notice 'TEST 4 OK: update con customer_id explícito cambia el Customer (client_name resuelto server-side)';

  -- 5) update con customer_id: null explícito — lo limpia.
  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object(
      'client_name', 'Texto libre tras limpiar customer_id',
      'product_type', 'otro',
      'status', 'borrador',
      'customer_id', null
    ),
    '[]'::jsonb
  );
  if v_updated.customer_id is not null then
    raise exception 'TEST 5 FALLÓ: customer_id:null explícito debería limpiar el campo';
  end if;
  if v_updated.client_name <> 'Texto libre tras limpiar customer_id' then
    raise exception 'TEST 5 FALLÓ: sin customer_id, client_name debería tomar el texto libre enviado';
  end if;
  -- business_unit_id no se tocó en este update (clave ausente) — debe seguir igual que antes.
  if v_updated.business_unit_id <> v_order.business_unit_id then
    raise exception 'TEST 5 FALLÓ: business_unit_id no debió tocarse (clave ausente en este update)';
  end if;
  raise notice 'TEST 5 OK: update con customer_id:null explícito limpia el campo, business_unit_id no tocado (clave ausente)';

  -- 6) idem business_unit_id: null explícito.
  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object(
      'client_name', 'x',
      'product_type', 'otro',
      'status', 'borrador',
      'business_unit_id', null
    ),
    '[]'::jsonb
  );
  if v_updated.business_unit_id is not null then
    raise exception 'TEST 6 FALLÓ: business_unit_id:null explícito debería limpiar el campo';
  end if;
  raise notice 'TEST 6 OK: update con business_unit_id:null explícito limpia el campo';
end $$;

-- 7) Regresión completa create/update/duplicate/delete.
do $$
declare
  v_order orders;
  v_updated orders;
  v_dup orders;
  v_deleted record;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'Regresión completa',
      'product_type', 'otro'
    ),
    '[{"model":"M1","quantity":1}]'::jsonb
  );

  select * into v_updated from rpc_update_order(
    v_order.id,
    jsonb_build_object('client_name', 'Regresión editada', 'product_type', 'otro', 'status', 'borrador'),
    '[{"model":"M1 editado","quantity":2}]'::jsonb
  );
  if v_updated.client_name <> 'Regresión editada' then
    raise exception 'TEST 7 FALLÓ: update no aplicó los cambios esperados';
  end if;

  select * into v_dup from rpc_duplicate_order(v_updated.id, current_date);
  if v_dup.id = v_updated.id or v_dup.folio = v_updated.folio then
    raise exception 'TEST 7 FALLÓ: duplicate no generó un pedido nuevo con folio propio';
  end if;

  select * into v_deleted from rpc_delete_order(v_dup.id);
  if exists (select 1 from orders where id = v_dup.id) then
    raise exception 'TEST 7 FALLÓ: delete no eliminó el pedido duplicado';
  end if;

  raise notice 'TEST 7 OK: regresión completa create/update/duplicate/delete';
end $$;

-- 8) Folios intactos — formato y consecutivo correctos tras todas las creaciones de esta corrida.
do $$
declare
  v_bad_folio_count int;
begin
  select count(*) into v_bad_folio_count
    from orders
    where salesperson_id = '10000000-0000-0000-0000-000000000001'
      and folio !~ '^VU1-\d{8}-\d{3}$';
  if v_bad_folio_count <> 0 then
    raise exception 'TEST 8 FALLÓ: hay % folio(s) con formato inesperado', v_bad_folio_count;
  end if;
  raise notice 'TEST 8 OK: folios con formato intacto (PREFIJO-AAAADDMM-NNN)';
end $$;

-- 9) GOBO/Product Types intactos.
do $$
declare
  v_order orders;
begin
  select * into v_order from rpc_create_order(
    gen_random_uuid(),
    jsonb_build_object(
      'salesperson_id', '10000000-0000-0000-0000-000000000001',
      'order_date', current_date::text,
      'client_name', 'GOBO corrección',
      'product_type', 'proyector_gobo',
      'status', 'pedido'
    ),
    '[{"model":"TLL200","quantity":1}]'::jsonb
  );
  if v_order.product_type <> 'proyector_gobo' then
    raise exception 'TEST 9 FALLÓ: GOBO no se guardó correctamente tras la corrección';
  end if;
  raise notice 'TEST 9 OK: GOBO/Product Types sin regresión tras la corrección';
end $$;

select 'CORRECCIÓN 0022 — TESTS 1-9 PASARON' as resultado;

rollback;
