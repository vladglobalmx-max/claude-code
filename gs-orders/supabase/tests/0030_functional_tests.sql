-- THÖREN Catálogo Maestro de Productos (0030) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0030 + fixtures.sql + 0023_fixtures.sql +
-- 0024_fixtures.sql. Todo el script corre en una transacción que se
-- revierte al final — repetible. Complementa
-- product_import_functional_tests.sql (RLS/cross-org del INSERT directo
-- del formulario manual, ya actualizado por 0030) con lo específico de
-- rpc_import_product_catalog: atomicidad, INSERT/UPDATE en una sola
-- llamada, mapeo de moneda, y enforcement de rol/organización dentro del
-- propio RPC.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set admin_orgb '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select id as bu1 from business_units where organization_id = :'org1' and code = 'got_fresh_breath' \gset
select id as bu2 from business_units where organization_id = :'org1' and code = 'thunder_led' \gset
select id as bu3 from business_units where organization_id = :'org1' and code = 'juno_promotional' \gset
select id as pt1 from product_types where code = 'proyector_gobo' \gset
create temp table _ids as
  select :'org1'::uuid as org1, :'bu1'::uuid as bu1, :'bu2'::uuid as bu2, :'bu3'::uuid as bu3, :'pt1'::uuid as pt1;

-- =========================================================================
-- 1) INSERT vía rpc_import_product_catalog — mapea Moneda=USD a
--    default_price_usd (default_price_mxn queda NULL), asigna la Business
--    Unit resuelta (1 elemento en business_unit_ids), product_type_id,
--    brand/model/unit.
-- =========================================================================
do $$
declare
  v_bu1 uuid; v_pt1 uuid;
  v_row record;
  v_product_id uuid;
begin
  select bu1, pt1 into v_bu1, v_pt1 from _ids;

  select * into v_row from rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'insert', 'sku', 'TP-0030-001', 'name', 'Proyector señalización LED dual',
        'description', 'Proyector LED 400W', 'business_unit_ids', jsonb_build_array(v_bu1::text), 'product_type_id', v_pt1::text,
        'brand', 'Thunder LED Lights', 'model', 'RT40076-2', 'unit', 'pza',
        'currency', 'USD', 'base_price', 2341.00, 'active', true
      )
    )
  );

  if v_row.action <> 'insert' or v_row.sku <> 'TP-0030-001' then
    raise exception 'TEST 1 FALLÓ: resultado inesperado action=%, sku=%', v_row.action, v_row.sku;
  end if;
  v_product_id := v_row.product_id;

  perform 1 from product_catalog
    where id = v_product_id and sku = 'TP-0030-001' and brand = 'Thunder LED Lights' and model = 'RT40076-2'
      and unit = 'pza' and product_type_id = v_pt1 and default_price_usd = 2341.00 and default_price_mxn is null
      and active = true and category is null;
  if not found then
    raise exception 'TEST 1 FALLÓ: el producto insertado no tiene los campos/mapeo de moneda esperados';
  end if;

  if (select count(*) from product_business_units where product_id = v_product_id) <> 1 then
    raise exception 'TEST 1 FALLÓ: se esperaba exactamente 1 Business Unit asociada';
  end if;
  perform 1 from product_business_units where product_id = v_product_id and business_unit_id = v_bu1;
  if not found then
    raise exception 'TEST 1 FALLÓ: no se asoció la Business Unit';
  end if;

  perform set_config('test.product_0030_id', v_product_id::text, false);
  raise notice 'TEST 1 OK: INSERT vía RPC — mapeo de Moneda=USD, 1 Business Unit y campos nuevos correctos, category NULL (no inventada)';
end $$;

-- =========================================================================
-- 2) UPDATE vía rpc_import_product_catalog — cambia Moneda a MXN (USD
--    debe quedar NULL), reemplaza las Business Units por "Todas"
--    (business_unit_ids: []), reemplaza product_type_id por NULL.
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product_0030_id')::uuid;
begin
  perform rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'update', 'id', v_product_id::text, 'sku', 'TP-0030-001', 'name', 'Proyector renombrado',
        'description', null, 'business_unit_ids', jsonb_build_array(), 'product_type_id', null,
        'brand', null, 'model', null, 'unit', null,
        'currency', 'MXN', 'base_price', 1999.99, 'active', false
      )
    )
  );

  perform 1 from product_catalog
    where id = v_product_id and name = 'Proyector renombrado' and default_price_mxn = 1999.99
      and default_price_usd is null and active = false and product_type_id is null
      and brand is null and model is null and unit is null;
  if not found then
    raise exception 'TEST 2 FALLÓ: el UPDATE no aplicó los cambios esperados';
  end if;

  if exists (select 1 from product_business_units where product_id = v_product_id) then
    raise exception 'TEST 2 FALLÓ: las Business Units deberían haberse limpiado (compartido con todas)';
  end if;

  raise notice 'TEST 2 OK: UPDATE vía RPC — cambio de moneda, limpieza de Business Units/tipo (TODAS), active=false';
end $$;

-- =========================================================================
-- 3) Atomicidad — un batch de 2 filas donde la segunda es inválida
--    (product_type_id inexistente) NO debe escribir NINGUNA de las 2.
-- =========================================================================
do $$
declare
  v_failed boolean := false;
  v_count integer;
begin
  begin
    perform rpc_import_product_catalog(
      jsonb_build_array(
        jsonb_build_object('action', 'insert', 'sku', 'TP-0030-ATOMIC-1', 'name', 'Atomic 1', 'currency', 'MXN', 'base_price', 10, 'active', true),
        jsonb_build_object('action', 'insert', 'sku', 'TP-0030-ATOMIC-2', 'name', 'Atomic 2', 'currency', 'MXN', 'base_price', 10, 'active', true, 'product_type_id', '00000000-0000-0000-0000-000000000000')
      )
    );
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se esperaba una excepción por product_type_id inexistente';
  end if;

  select count(*) into v_count from product_catalog where sku in ('TP-0030-ATOMIC-1', 'TP-0030-ATOMIC-2');
  if v_count <> 0 then
    raise exception 'TEST 3 FALLÓ: se escribieron % filas pese al error — la importación no fue atómica', v_count;
  end if;

  raise notice 'TEST 3 OK: fila inválida aborta TODO el batch — 0 escrituras parciales';
end $$;

-- =========================================================================
-- 3B) Atomicidad — un batch de 2 filas donde la segunda trae un
--     business_unit_id inexistente dentro de la lista NO debe escribir
--     NINGUNA de las 2 (ni el producto NUEVO de la primera fila, que sí era
--     válida por sí sola).
-- =========================================================================
do $$
declare
  v_failed boolean := false;
  v_count integer;
begin
  begin
    perform rpc_import_product_catalog(
      jsonb_build_array(
        jsonb_build_object('action', 'insert', 'sku', 'TP-0030-ATOMIC-BU-1', 'name', 'Atomic BU 1', 'currency', 'MXN', 'base_price', 10, 'active', true),
        jsonb_build_object('action', 'insert', 'sku', 'TP-0030-ATOMIC-BU-2', 'name', 'Atomic BU 2', 'currency', 'MXN', 'base_price', 10, 'active', true,
          'business_unit_ids', jsonb_build_array('00000000-0000-0000-0000-000000000000'))
      )
    );
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 3B FALLÓ: se esperaba una excepción por business_unit_id inexistente';
  end if;

  select count(*) into v_count from product_catalog where sku in ('TP-0030-ATOMIC-BU-1', 'TP-0030-ATOMIC-BU-2');
  if v_count <> 0 then
    raise exception 'TEST 3B FALLÓ: se escribieron % filas pese al error — la importación no fue atómica', v_count;
  end if;

  raise notice 'TEST 3B OK: Business Unit inexistente dentro de la lista aborta TODO el batch — 0 escrituras parciales';
end $$;

-- =========================================================================
-- 4) VENDEDOR bloqueado — rpc_import_product_catalog es SECURITY INVOKER,
--    sujeto a product_catalog_admin_write (ADMIN-only, 0019).
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare
  v_failed boolean := false;
begin
  begin
    perform rpc_import_product_catalog(
      jsonb_build_array(
        jsonb_build_object('action', 'insert', 'sku', 'TP-0030-VENDEDOR', 'name', 'x', 'currency', 'MXN', 'base_price', 1, 'active', true)
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 4 FALLÓ: VENDEDOR pudo importar productos';
  end if;
  if exists (select 1 from product_catalog where sku = 'TP-0030-VENDEDOR') then
    raise exception 'TEST 4 FALLÓ: se escribió el producto pese al bloqueo esperado';
  end if;
  raise notice 'TEST 4 OK: VENDEDOR bloqueado por RLS dentro del RPC (sin excepción de rol para import)';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 5) Cross-org bloqueado — intentar UPDATE de un producto de Org 1 con la
--    sesión de ADMIN de Org B falla (el WHERE organization_id = ... del
--    RPC no encuentra la fila bajo esa organización).
-- =========================================================================
select test_set_user(:'admin_orgb');
do $$
declare
  v_product_id uuid := current_setting('test.product_0030_id')::uuid;
  v_failed boolean := false;
begin
  begin
    perform rpc_import_product_catalog(
      jsonb_build_array(
        jsonb_build_object('action', 'update', 'id', v_product_id::text, 'sku', 'TP-0030-001', 'name', 'Hackeado', 'currency', 'MXN', 'base_price', 1, 'active', true)
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'TEST 5 FALLÓ: ADMIN de Org B pudo actualizar un producto de Org 1';
  end if;

  perform 1 from product_catalog where id = v_product_id and name = 'Hackeado';
  if found then
    raise exception 'TEST 5 FALLÓ: el producto de Org 1 fue modificado por Org B';
  end if;

  raise notice 'TEST 5 OK: cross-org bloqueado — UPDATE de un producto de otra organización rechazado';
end $$;
select test_set_user(:'admin');

-- =========================================================================
-- 6) category nullable no rompe filas existentes (Luz LED Grúa Viajera,
--    sembradas por 0009, category NOT NULL en su momento) — siguen con su
--    valor intacto tras 0030.
-- =========================================================================
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from product_catalog where category = 'Luz LED Grúa Viajera';
  if v_count < 1 then
    raise exception 'TEST 6 FALLÓ: los productos sembrados de 0009 perdieron su category tras 0030';
  end if;
  raise notice 'TEST 6 OK: category nullable no afectó filas existentes (% con category intacta)', v_count;
end $$;

-- =========================================================================
-- 7) INSERT con 2 Business Units — ambas se asocian (soporte N:M real,
--    ajuste posterior a la aprobación conceptual de Fase 6C).
-- =========================================================================
do $$
declare
  v_bu1 uuid; v_bu2 uuid;
  v_row record;
  v_product_id uuid;
begin
  select bu1, bu2 into v_bu1, v_bu2 from _ids;

  select * into v_row from rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'insert', 'sku', 'TP-0030-2BU', 'name', 'Señalización 2 BU',
        'business_unit_ids', jsonb_build_array(v_bu1::text, v_bu2::text),
        'currency', 'MXN', 'base_price', 500, 'active', true
      )
    )
  );
  v_product_id := v_row.product_id;

  if (select count(*) from product_business_units where product_id = v_product_id) <> 2 then
    raise exception 'TEST 7 FALLÓ: se esperaban exactamente 2 Business Units asociadas';
  end if;
  perform 1 from product_business_units where product_id = v_product_id and business_unit_id in (v_bu1, v_bu2)
    having count(*) = 2;
  if not found then
    raise exception 'TEST 7 FALLÓ: las Business Units asociadas no son las 2 esperadas';
  end if;

  perform set_config('test.product_0030_2bu_id', v_product_id::text, false);
  raise notice 'TEST 7 OK: INSERT con 2 Business Units — ambas asociadas correctamente';
end $$;

-- =========================================================================
-- 8) INSERT con 3 Business Units — las 3 se asocian.
-- =========================================================================
do $$
declare
  v_bu1 uuid; v_bu2 uuid; v_bu3 uuid;
  v_row record;
  v_product_id uuid;
begin
  select bu1, bu2, bu3 into v_bu1, v_bu2, v_bu3 from _ids;

  select * into v_row from rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'insert', 'sku', 'TP-0030-3BU', 'name', 'Señalización 3 BU',
        'business_unit_ids', jsonb_build_array(v_bu1::text, v_bu2::text, v_bu3::text),
        'currency', 'MXN', 'base_price', 750, 'active', true
      )
    )
  );
  v_product_id := v_row.product_id;

  if (select count(*) from product_business_units where product_id = v_product_id) <> 3 then
    raise exception 'TEST 8 FALLÓ: se esperaban exactamente 3 Business Units asociadas';
  end if;

  raise notice 'TEST 8 OK: INSERT con 3 Business Units — las 3 asociadas correctamente';
end $$;

-- =========================================================================
-- 9) Transición TODAS → 2 Business Units — TP-0030-001 quedó en TODAS
--    (TEST 2, 0 filas); un UPDATE con business_unit_ids de 2 elementos debe
--    dejar exactamente esas 2 asociaciones (no acumula sobre las 0 previas).
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product_0030_id')::uuid;
  v_bu1 uuid; v_bu2 uuid;
begin
  select bu1, bu2 into v_bu1, v_bu2 from _ids;

  perform rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'update', 'id', v_product_id::text, 'sku', 'TP-0030-001', 'name', 'Proyector renombrado',
        'business_unit_ids', jsonb_build_array(v_bu1::text, v_bu2::text),
        'currency', 'MXN', 'base_price', 1999.99, 'active', false
      )
    )
  );

  if (select count(*) from product_business_units where product_id = v_product_id) <> 2 then
    raise exception 'TEST 9 FALLÓ: se esperaban exactamente 2 Business Units tras la transición TODAS → 2 BU';
  end if;

  raise notice 'TEST 9 OK: transición TODAS → 2 Business Units aplicada correctamente';
end $$;

-- =========================================================================
-- 10) Transición 2 Business Units → 1 Business Unit — mismo producto de
--     TEST 9, ahora se reduce a solo bu1.
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product_0030_id')::uuid;
  v_bu1 uuid;
begin
  select bu1 into v_bu1 from _ids;

  perform rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'update', 'id', v_product_id::text, 'sku', 'TP-0030-001', 'name', 'Proyector renombrado',
        'business_unit_ids', jsonb_build_array(v_bu1::text),
        'currency', 'MXN', 'base_price', 1999.99, 'active', false
      )
    )
  );

  perform 1 from product_business_units where product_id = v_product_id and business_unit_id = v_bu1;
  if not found then
    raise exception 'TEST 10 FALLÓ: la Business Unit restante no es la esperada';
  end if;
  if (select count(*) from product_business_units where product_id = v_product_id) <> 1 then
    raise exception 'TEST 10 FALLÓ: se esperaba exactamente 1 Business Unit tras la transición 2 BU → 1 BU';
  end if;

  raise notice 'TEST 10 OK: transición 2 Business Units → 1 Business Unit aplicada correctamente';
end $$;

-- =========================================================================
-- 11) Transición 2 Business Units → TODAS — producto de TEST 7 (2 BU) pasa
--     a business_unit_ids: [] (compartido con todas).
-- =========================================================================
do $$
declare
  v_product_id uuid := current_setting('test.product_0030_2bu_id')::uuid;
begin
  perform rpc_import_product_catalog(
    jsonb_build_array(
      jsonb_build_object(
        'action', 'update', 'id', v_product_id::text, 'sku', 'TP-0030-2BU', 'name', 'Señalización 2 BU',
        'business_unit_ids', jsonb_build_array(),
        'currency', 'MXN', 'base_price', 500, 'active', true
      )
    )
  );

  if exists (select 1 from product_business_units where product_id = v_product_id) then
    raise exception 'TEST 11 FALLÓ: las Business Units deberían haberse limpiado (TODAS)';
  end if;

  raise notice 'TEST 11 OK: transición 2 Business Units → TODAS aplicada correctamente';
end $$;

-- =========================================================================
-- 12) Robustez — un business_unit_id repetido DENTRO de la misma fila
--     (no debería ocurrir nunca vía la capa JS, que normaliza y deduplica
--     antes de enviar al RPC, pero el RPC no debe escribir asociaciones
--     duplicadas ni datos parciales si de algún modo llegara duplicado:
--     la PK compuesta (product_id, business_unit_id) lo rechaza y, como
--     cualquier excepción no atrapada en este proyecto, aborta TODO el
--     batch — cero escritura parcial, ni siquiera el producto en sí).
-- =========================================================================
do $$
declare
  v_bu1 uuid;
  v_failed boolean := false;
begin
  select bu1 into v_bu1 from _ids;

  begin
    perform rpc_import_product_catalog(
      jsonb_build_array(
        jsonb_build_object(
          'action', 'insert', 'sku', 'TP-0030-DUP-BU', 'name', 'Duplicado defensivo',
          'business_unit_ids', jsonb_build_array(v_bu1::text, v_bu1::text),
          'currency', 'MXN', 'base_price', 10, 'active', true
        )
      )
    );
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 12 FALLÓ: se esperaba una excepción por Business Unit duplicada dentro de la fila';
  end if;
  if exists (select 1 from product_catalog where sku = 'TP-0030-DUP-BU') then
    raise exception 'TEST 12 FALLÓ: se escribió el producto pese al duplicado — no fue atómico';
  end if;

  raise notice 'TEST 12 OK: Business Unit duplicada dentro de la fila rechazada atómicamente (defensa en profundidad; la capa JS ya deduplica antes de llegar aquí)';
end $$;

select 'TESTS 1-12 (0030 Catálogo Maestro, incluye multi-Business-Unit) PASARON' as resultado;

rollback;
