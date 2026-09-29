-- THÖREN — CotizIA: edición de cotizaciones con versionado
-- (0085_quote_versioning.sql) — pruebas funcionales contra Postgres real.
-- Fixtures 100% autocontenidas (mismo criterio que 0083/0084) — no depende
-- de la cadena de fixtures de fases anteriores. Todo el script corre en
-- una transacción que se revierte al final (rollback).
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` (dólar-quoted) — por eso todo id usado
-- DENTRO de un bloque `do $$` se resuelve como literal UUID fijo o vía
-- current_setting(), nunca `:'var'`.

begin;

\set admin_a '00000000-0000-0000-0000-000000000101'
\set vendedor_a '00000000-0000-0000-0000-000000000102'
\set vendedor_other_a '00000000-0000-0000-0000-000000000103'
\set admin_b '00000000-0000-0000-0000-000000000104'
\set org_a '00000000-0000-0000-0000-000000008501'
\set org_b '00000000-0000-0000-0000-000000008502'
\set sp_a '00000000-0000-0000-0000-000000008511'
\set sp_other_a '00000000-0000-0000-0000-000000008512'
\set sp_b '00000000-0000-0000-0000-000000008513'
\set bu_a '00000000-0000-0000-0000-000000008521'
\set bu_b '00000000-0000-0000-0000-000000008522'
\set customer_a '00000000-0000-0000-0000-000000008531'
\set customer_b '00000000-0000-0000-0000-000000008532'
\set person_a '00000000-0000-0000-0000-000000008541'
\set person_other_a '00000000-0000-0000-0000-000000008542'
\set person_b '00000000-0000-0000-0000-000000008543'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-85a@test.local'),
  (:'vendedor_a', 'vendedor-85a@test.local'),
  (:'vendedor_other_a', 'vendedor-other-85a@test.local'),
  (:'admin_b', 'admin-85b@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 85 A', 'test-org-85-a'),
  (:'org_b', 'Test Org 85 B', 'test-org-85-b');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 85', 'admin', true),
  (:'admin_b', 'Admin B Test 85', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true),
  (:'org_b', :'admin_b', 'admin', true);

insert into business_units (id, organization_id, name, code) values
  (:'bu_a', :'org_a', 'BU Test 85 A', 'bu_test_85a'),
  (:'bu_b', :'org_b', 'BU Test 85 B', 'bu_test_85b');

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 85 A', true),
  (:'customer_b', :'org_b', 'Cliente Test 85 B', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 85', 'VA85', true),
  (:'sp_other_a', :'org_a', 'Vendedor Other A 85', 'VO85', true),
  (:'sp_b', :'org_b', 'Vendedor B 85', 'VB85', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 85', 'vendedor', :'sp_a', true),
  (:'vendedor_other_a', 'Vendedor Other A Test 85', 'vendedor', :'sp_other_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true),
  (:'org_a', :'vendedor_other_a', 'vendedor', true);

-- Person por salesperson, sin filas en person_business_units a propósito
-- (fallback legacy de 0020: puede cotizar para cualquier BU activa de su
-- organización) — mismo criterio que el resto de la suite de Quotes.
insert into people (id, organization_id, name, active) values
  (:'person_a', :'org_a', 'Vendedor A Persona 85', true),
  (:'person_other_a', :'org_a', 'Vendedor Other A Persona 85', true),
  (:'person_b', :'org_b', 'Vendedor B Persona 85', true);
update salespeople set person_id = :'person_a' where id = :'sp_a';
update salespeople set person_id = :'person_other_a' where id = :'sp_other_a';
update salespeople set person_id = :'person_b' where id = :'sp_b';

insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_a', :'bu_a', 'QT85A'),
  (:'org_b', :'sp_b', :'bu_b', 'QT85B');

set role authenticated;

-- =========================================================================
-- TEST 1: rpc_create_quote_revision — el dueño (vendedor_a) crea una nueva
-- versión de su Quote 'enviada'. Archiva version=1 en quote_versions
-- (incluido customer_requirements de la línea), la Quote queda en
-- 'borrador' con version=2, folio intacto.
-- =========================================================================
select test_set_user(:'vendedor_a');

do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_quote quotes;
  v_revised quotes;
  v_version_row quote_versions;
  v_snapshot_items jsonb;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object(
      'business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a,
      'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 6, 'unit_price', 200,
        'line_discount_percent', 0, 'customer_requirements', '4 en color azul y 2 en color rosa'
      )
    )
  );
  perform set_config('test.quote85_id', v_quote.id::text, false);
  perform set_config('test.quote85_folio', v_quote.folio, false);

  if v_quote.version <> 1 then
    raise exception 'TEST 1 FALLÓ: una Quote recién creada debería nacer en version=1 (actual: %)', v_quote.version;
  end if;

  update quotes set status = 'enviada' where id = v_quote.id;

  select * into v_revised from rpc_create_quote_revision(
    v_quote.id,
    jsonb_build_object(
      'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 5,
      'valid_until', (current_date + 20)::text
    ),
    jsonb_build_array(
      jsonb_build_object(
        'catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 8, 'unit_price', 200,
        'line_discount_percent', 0, 'customer_requirements', '5 en azul, 3 en rosa (ajustado)'
      )
    )
  );

  if v_revised.status <> 'borrador' then
    raise exception 'TEST 1 FALLÓ: la nueva versión debería quedar en borrador (actual: %)', v_revised.status;
  end if;
  if v_revised.version <> 2 then
    raise exception 'TEST 1 FALLÓ: version debería ser 2 (actual: %)', v_revised.version;
  end if;
  if v_revised.folio <> v_quote.folio then
    raise exception 'TEST 1 FALLÓ: el folio cambió (original=% nuevo=%)', v_quote.folio, v_revised.folio;
  end if;
  if v_revised.global_discount_percent <> 5 then
    raise exception 'TEST 1 FALLÓ: el contenido no se actualizó (global_discount_percent=%)', v_revised.global_discount_percent;
  end if;

  select * into v_version_row from quote_versions where quote_id = v_quote.id and version = 1;
  if v_version_row.id is null then
    raise exception 'TEST 1 FALLÓ: no se archivó la version 1 en quote_versions';
  end if;
  if v_version_row.snapshot->'quote'->>'status' <> 'enviada' then
    raise exception 'TEST 1 FALLÓ: el snapshot archivado debería reflejar status=enviada (actual: %)', v_version_row.snapshot->'quote'->>'status';
  end if;
  v_snapshot_items := v_version_row.snapshot->'items';
  if jsonb_array_length(v_snapshot_items) <> 1
     or (v_snapshot_items->0->>'customer_requirements') <> '4 en color azul y 2 en color rosa' then
    raise exception 'TEST 1 FALLÓ: el snapshot no conservó customer_requirements de la versión 1 (items=%)', v_snapshot_items;
  end if;
  if v_version_row.created_by <> '00000000-0000-0000-0000-000000000102'::uuid
     or v_version_row.created_by_name <> 'Vendedor A Test 85' then
    raise exception 'TEST 1 FALLÓ: created_by/created_by_name incorrectos (by=% name=%)', v_version_row.created_by, v_version_row.created_by_name;
  end if;

  raise notice 'TEST 1 OK: revisión creada — archiva version 1 completa (incluido customer_requirements), Quote queda en borrador v2, folio intacto';
end $$;

-- =========================================================================
-- TEST 2: otro vendedor de la MISMA organización (no dueño) rechazado.
-- =========================================================================
select test_set_user(:'vendedor_a');
do $$
declare v_quote_id uuid := current_setting('test.quote85_id')::uuid;
begin
  update quotes set status = 'enviada' where id = v_quote_id;
end $$;

select test_set_user(:'vendedor_other_a');
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
begin
  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 2 FALLÓ: un vendedor que no es dueño de la Quote pudo crear una revisión';
  exception
    when others then
      if sqlerrm not like '%no tienes permiso%' then
        raise exception 'TEST 2 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 2 OK: vendedor no dueño rechazado';
end $$;

-- =========================================================================
-- TEST 3: admin_a (misma organización) SÍ puede crear la revisión.
-- =========================================================================
select test_set_user(:'admin_a');
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_revised quotes;
begin
  select * into v_revised from rpc_create_quote_revision(
    v_quote_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 8, 'unit_price', 200, 'line_discount_percent', 0))
  );
  if v_revised.version <> 3 then
    raise exception 'TEST 3 FALLÓ: version debería ser 3 tras la segunda revisión (actual: %)', v_revised.version;
  end if;
  if v_revised.folio <> current_setting('test.quote85_folio') then
    raise exception 'TEST 3 FALLÓ: el folio cambió en la segunda revisión';
  end if;
  raise notice 'TEST 3 OK: admin de la organización puede crear la revisión; version=3, folio sigue intacto';
end $$;

-- =========================================================================
-- TEST 4: admin_b (otra organización) rechazado — aislamiento cross-org
-- real dentro del RPC (SECURITY DEFINER, no delega en RLS).
-- =========================================================================
select test_set_user(:'vendedor_a');
do $$
declare v_quote_id uuid := current_setting('test.quote85_id')::uuid;
begin
  update quotes set status = 'enviada' where id = v_quote_id;
end $$;

select test_set_user(:'admin_b');
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid;
  v_customer_b uuid := '00000000-0000-0000-0000-000000008532';
begin
  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_b, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 4 FALLÓ: un admin de otra organización pudo crear una revisión';
  exception
    when others then
      if sqlerrm not like '%no tienes permiso%' then
        raise exception 'TEST 4 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 4 OK: admin de otra organización rechazado';
end $$;

-- =========================================================================
-- TEST 5: rechazado si la Quote está en 'borrador' (debe usarse
-- rpc_update_quote, no esta RPC).
-- =========================================================================
select test_set_user(:'vendedor_a');
do $$
declare v_quote_id uuid := current_setting('test.quote85_id')::uuid;
begin
  update quotes set status = 'aceptada' where id = v_quote_id;
end $$;

select test_set_user(:'admin_a');
do $$
declare
  v_quote_id uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_quote quotes;
begin
  -- Quote nueva, independiente, para probar el estado 'borrador' sin
  -- interferir con la que ya se dejó en 'aceptada' arriba.
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );
  v_quote_id := v_quote.id;
  perform set_config('test.quote85_borrador_id', v_quote_id::text, false);

  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 5 FALLÓ: se pudo crear una revisión sobre una Quote en borrador';
  exception
    when others then
      if sqlerrm not like '%solo se puede crear una nueva versión%' then
        raise exception 'TEST 5 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 5 OK: rechazado sobre borrador (usa rpc_update_quote)';
end $$;

-- =========================================================================
-- TEST 6/7/8: rechazado sobre 'aceptada'/'rechazada'/'cancelada'.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid; -- ya quedó 'aceptada' arriba (TEST 5 setup)
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
begin
  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 6 FALLÓ: se pudo crear una revisión sobre una Quote aceptada';
  exception
    when others then
      if sqlerrm not like '%solo se puede crear una nueva versión%' then
        raise exception 'TEST 6 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 6 OK: rechazado sobre aceptada';
end $$;

do $$
declare
  v_quote_id uuid := current_setting('test.quote85_borrador_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
begin
  update quotes set status = 'enviada' where id = v_quote_id;
  update quotes set status = 'rechazada' where id = v_quote_id;

  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 7 FALLÓ: se pudo crear una revisión sobre una Quote rechazada';
  exception
    when others then
      if sqlerrm not like '%solo se puede crear una nueva versión%' then
        raise exception 'TEST 7 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 7 OK: rechazado sobre rechazada';
end $$;

do $$
declare
  v_quote_id uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );
  v_quote_id := v_quote.id;
  update quotes set status = 'cancelada' where id = v_quote_id;

  begin
    perform rpc_create_quote_revision(
      v_quote_id,
      jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
      '[]'::jsonb
    );
    raise exception 'TEST 8 FALLÓ: se pudo crear una revisión sobre una Quote cancelada';
  exception
    when others then
      if sqlerrm not like '%solo se puede crear una nueva versión%' then
        raise exception 'TEST 8 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 8 OK: rechazado sobre cancelada';
end $$;

-- =========================================================================
-- TEST 9: quote_versions — aislamiento cruzado real (RLS, no solo
-- convención): admin_b no ve ninguna fila del historial de org_a.
-- =========================================================================
select test_set_user(:'admin_b');
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from quote_versions where quote_id = v_quote_id;
  if v_count <> 0 then
    raise exception 'TEST 9 FALLÓ: admin de otra organización ve % filas del historial ajeno', v_count;
  end if;
  raise notice 'TEST 9 OK: aislamiento cruzado real en quote_versions (RLS)';
end $$;

-- =========================================================================
-- TEST 10: admin_a SÍ ve el historial completo de su propia organización
-- (2 versiones archivadas: la 1 y la 2, del TEST 1 y TEST 3).
-- =========================================================================
select test_set_user(:'admin_a');
do $$
declare
  v_quote_id uuid := current_setting('test.quote85_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from quote_versions where quote_id = v_quote_id;
  if v_count <> 2 then
    raise exception 'TEST 10 FALLÓ: deberían existir 2 versiones archivadas (actual: %)', v_count;
  end if;
  raise notice 'TEST 10 OK: admin ve el historial completo (2 versiones archivadas) de su organización';
end $$;

-- =========================================================================
-- TEST 11: regresión — la transición 'enviada' -> 'borrador' NO abre la
-- puerta a cambiar contenido comercial fuera de esa transición exacta: un
-- UPDATE directo que solo cambia valid_until (sin tocar status) sobre una
-- Quote 'enviada' sigue rechazado exactamente igual que antes de 0085.
-- (valid_until, no customer_id: cambiar customer_id dispara primero la
-- validación de consistencia cross-tabla de trg_check_quote_consistency,
-- que fallaría por una razón distinta a la que este test quiere probar.)
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_quote quotes;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );
  update quotes set status = 'enviada' where id = v_quote.id;

  begin
    update quotes set valid_until = valid_until + 1 where id = v_quote.id;
    raise exception 'TEST 11 FALLÓ: se pudo modificar contenido comercial de una Quote enviada sin pasar por rpc_create_quote_revision';
  exception
    when others then
      if sqlerrm not like '%No se puede modificar el contenido comercial%' then
        raise exception 'TEST 11 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;
  raise notice 'TEST 11 OK: el congelamiento de contenido comercial fuera de la transición sancionada sigue intacto (sin regresión)';
end $$;

-- =========================================================================
-- TEST 12: rpc_update_quote sobre una Quote en 'borrador' sigue exactamente
-- igual (sin versionar, sin tocar quote_versions/version) — regresión.
-- =========================================================================
do $$
declare
  v_quote_id uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_quote quotes;
  v_updated quotes;
  v_version_count integer;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );
  v_quote_id := v_quote.id;

  select * into v_updated from rpc_update_quote(
    v_quote_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'USD', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );

  if v_updated.version <> 1 then
    raise exception 'TEST 12 FALLÓ: editar en borrador nunca debe incrementar version (actual: %)', v_updated.version;
  end if;
  select count(*) into v_version_count from quote_versions where quote_id = v_quote_id;
  if v_version_count <> 0 then
    raise exception 'TEST 12 FALLÓ: editar en borrador nunca debe archivar nada en quote_versions (filas=%)', v_version_count;
  end if;
  if v_updated.currency <> 'USD' then
    raise exception 'TEST 12 FALLÓ: rpc_update_quote dejó de aplicar el cambio (currency=%)', v_updated.currency;
  end if;

  raise notice 'TEST 12 OK: editar en borrador sigue sin versionar (sin regresión en rpc_update_quote)';
end $$;

-- =========================================================================
-- TEST 13: INTEGRIDAD DB — un UPDATE directo que baja una Quote 'enviada'
-- a 'borrador' SIN pasar por rpc_create_quote_revision debe fallar. RLS
-- (quotes_update_own_or_admin) no restringe columnas, así que la única
-- protección real es que trg_quote_status_transition exige el GUC local
-- thoren.creating_quote_revision — nunca fijado por un UPDATE directo, sin
-- importar qué rol lo ejecute (se prueba con admin_a, autoridad máxima
-- dentro de su organización, para descartar que sea "solo" un tema de
-- permisos de fila).
-- =========================================================================
select test_set_user(:'admin_a');
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008531';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008521';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008511';
  v_quote quotes;
  v_status_after text;
  v_version_count integer;
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    '[]'::jsonb
  );
  update quotes set status = 'enviada' where id = v_quote.id;

  -- Todo este archivo corre en UNA sola transacción (begin;...rollback; al
  -- pie) y TEST 1/TEST 3 ya dejaron thoren.creating_quote_revision='true'
  -- (es local A LA TRANSACCIÓN, no a la llamada — se resetea solo al
  -- terminar la transacción, no entre sentencias). En producción esto no
  -- aplica: cada request a PostgREST/rpc() corre en su PROPIA transacción,
  -- así que el GUC nunca sobrevive de una llamada a la siguiente. Para que
  -- este test aísle exactamente lo que importa — "sin haber llamado a
  -- rpc_create_quote_revision en ESTA transacción, la transición está
  -- prohibida" — se resetea el GUC explícitamente antes del intento,
  -- simulando una transacción fresca real.
  perform set_config('thoren.creating_quote_revision', 'false', true);

  begin
    update quotes set status = 'borrador' where id = v_quote.id;
    raise exception 'TEST 13 FALLÓ: un UPDATE directo pudo bajar una Quote enviada a borrador sin pasar por rpc_create_quote_revision';
  exception
    when others then
      if sqlerrm not like '%Transición de status inválida%' then
        raise exception 'TEST 13 FALLÓ: error inesperado (%)', sqlerrm;
      end if;
  end;

  select status into v_status_after from quotes where id = v_quote.id;
  if v_status_after <> 'enviada' then
    raise exception 'TEST 13 FALLÓ: el status quedó alterado pese al rechazo (actual: %)', v_status_after;
  end if;
  select count(*) into v_version_count from quote_versions where quote_id = v_quote.id;
  if v_version_count <> 0 then
    raise exception 'TEST 13 FALLÓ: se archivó una versión sin que la transición ocurriera realmente (filas=%)', v_version_count;
  end if;

  raise notice 'TEST 13 OK: UPDATE directo enviada->borrador rechazado a nivel de trigger (RLS por sí sola no lo hubiera impedido) — status y quote_versions sin alterar';
end $$;

do $$ begin raise notice '=== 0085: 13/13 TESTS OK ==='; end $$;

reset role;
rollback;
