-- THÖREN — CotizIA: "Requisitos del cliente" enriquecido + visibilidad en
-- PDF por partida (0086_quote_item_rich_text_requirements.sql) — pruebas
-- funcionales contra Postgres real. Fixtures 100% autocontenidas (mismo
-- criterio que 0083/0084/0085) — no depende de la cadena de fixtures de
-- fases anteriores. Todo el script corre en una transacción que se
-- revierte al final (rollback).
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` — todo id usado DENTRO de un bloque `do
-- $$` se resuelve como literal UUID fijo o vía current_setting(), nunca
-- `:'var'`.
--
-- sanitizeRichText (src/lib/rich-text.ts) corre en la capa de aplicación
-- (TypeScript/Vitest, ver src/lib/rich-text.test.ts) y estos RPC guardan
-- customer_requirements tal cual reciben el string cuando es seguro — TEST
-- 2/3/4 lo verifican. TEST 5/6/7 (agregados en la revisión de seguridad de
-- este mismo ticket) sí prueban SQL: confirman que fn_check_rich_text_safety
-- rechaza HTML peligroso enviado directamente al RPC (bypasseando la app y
-- su zod transform), sin persistir ninguna fila.

begin;

\set admin_a '00000000-0000-0000-0000-000000000101'
\set vendedor_a '00000000-0000-0000-0000-000000000102'
\set org_a '00000000-0000-0000-0000-000000008601'
\set sp_a '00000000-0000-0000-0000-000000008611'
\set bu_a '00000000-0000-0000-0000-000000008621'
\set customer_a '00000000-0000-0000-0000-000000008631'
\set person_a '00000000-0000-0000-0000-000000008641'

insert into auth.users (id, email) values
  (:'admin_a', 'admin-86a@test.local'),
  (:'vendedor_a', 'vendedor-86a@test.local');

insert into organizations (id, name, slug) values
  (:'org_a', 'Test Org 86 A', 'test-org-86-a');

insert into user_profiles (user_id, name, role, active) values
  (:'admin_a', 'Admin A Test 86', 'admin', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'admin_a', 'admin', true);

insert into business_units (id, organization_id, name, code) values
  (:'bu_a', :'org_a', 'BU Test 86 A', 'bu_test_86a');

insert into customers (id, organization_id, name, active) values
  (:'customer_a', :'org_a', 'Cliente Test 86 A', true);

insert into salespeople (id, organization_id, name, prefix, active) values
  (:'sp_a', :'org_a', 'Vendedor A 86', 'VA86', true);

insert into user_profiles (user_id, name, role, salesperson_id, active) values
  (:'vendedor_a', 'Vendedor A Test 86', 'vendedor', :'sp_a', true);
insert into organization_members (organization_id, user_id, role, active) values
  (:'org_a', :'vendedor_a', 'vendedor', true);

insert into people (id, organization_id, name, active) values
  (:'person_a', :'org_a', 'Vendedor A Persona 86', true);
update salespeople set person_id = :'person_a' where id = :'sp_a';

insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix) values
  (:'org_a', :'sp_a', :'bu_a', 'QT86A');

set role authenticated;
select test_set_user(:'vendedor_a');

-- =========================================================================
-- TEST 1: columna existe, NOT NULL, DEFAULT true.
-- =========================================================================
do $$
declare v_default text; v_not_null boolean;
begin
  select column_default, (is_nullable = 'NO') into v_default, v_not_null
  from information_schema.columns
  where table_schema = 'public' and table_name = 'quote_items' and column_name = 'customer_requirements_visible_in_pdf';

  if v_default is null or v_default not like '%true%' then
    raise exception 'TEST 1 FALLÓ: customer_requirements_visible_in_pdf no tiene DEFAULT true (actual: %)', v_default;
  end if;
  if not v_not_null then
    raise exception 'TEST 1 FALLÓ: customer_requirements_visible_in_pdf permite NULL';
  end if;
  raise notice 'TEST 1 OK: columna customer_requirements_visible_in_pdf existe, NOT NULL, DEFAULT true.';
end $$;

-- =========================================================================
-- TEST 2: rpc_create_quote — respeta el booleano cuando se manda (false) y
-- lo defaultea a true cuando se omite (cliente viejo que no conoce la
-- clave). Contenido HTML se guarda TAL CUAL, sin sanitizar en SQL.
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008611';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008621';
  v_quote quotes;
  v_item_hidden quote_items;
  v_item_default quote_items;
  v_html text := '<p>Color: <strong>Azul</strong></p><ul><li>Un logo</li><li>Un lado</li></ul>';
begin
  select * into v_quote from rpc_create_quote(
    gen_random_uuid(),
    jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', v_html, 'customer_requirements_visible_in_pdf', false),
      jsonb_build_object('catalog_product_id', null, 'model', 'SERVICIO DE GRABADO LASER', 'quantity', 1, 'unit_price', 50, 'line_discount_percent', 0, 'customer_requirements', 'PERSONALIZADO EN LASER')
    )
  );
  perform set_config('test.quote86_id', v_quote.id::text, false);

  select * into v_item_hidden from quote_items where quote_id = v_quote.id and model = 'TERMO DIMASH';
  if v_item_hidden.customer_requirements_visible_in_pdf <> false then
    raise exception 'TEST 2 FALLÓ: customer_requirements_visible_in_pdf debería ser false (mandado explícito)';
  end if;
  if v_item_hidden.customer_requirements <> v_html then
    raise exception 'TEST 2 FALLÓ: el HTML no se guardó tal cual (actual: %)', v_item_hidden.customer_requirements;
  end if;

  select * into v_item_default from quote_items where quote_id = v_quote.id and model = 'SERVICIO DE GRABADO LASER';
  if v_item_default.customer_requirements_visible_in_pdf <> true then
    raise exception 'TEST 2 FALLÓ: customer_requirements_visible_in_pdf debería defaultear a true cuando se omite';
  end if;

  raise notice 'TEST 2 OK: rpc_create_quote respeta el booleano explícito y defaultea a true cuando se omite; HTML se guarda tal cual';
end $$;

-- =========================================================================
-- TEST 3: rpc_update_quote (borrador) — puede alternar el booleano en
-- cualquier dirección.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote86_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_updated quotes;
  v_item quote_items;
begin
  select * into v_updated from rpc_update_quote(
    v_quote_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', '4 en azul y 2 en rosa', 'customer_requirements_visible_in_pdf', true)
    )
  );

  select * into v_item from quote_items where quote_id = v_quote_id and model = 'TERMO DIMASH';
  if v_item.customer_requirements_visible_in_pdf <> true then
    raise exception 'TEST 3 FALLÓ: rpc_update_quote no aplicó el cambio de false a true';
  end if;

  raise notice 'TEST 3 OK: rpc_update_quote alterna correctamente el booleano';
end $$;

-- =========================================================================
-- TEST 4: rpc_create_quote_revision — el snapshot archivado conserva EL
-- VALOR ORIGINAL de customer_requirements_visible_in_pdf de cada línea
-- (junto con el HTML), y la nueva versión persiste los valores nuevos.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote86_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_revised quotes;
  v_version_row quote_versions;
  v_snapshot_items jsonb;
  v_new_item quote_items;
begin
  update quotes set status = 'enviada' where id = v_quote_id;

  select * into v_revised from rpc_create_quote_revision(
    v_quote_id,
    jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
    jsonb_build_array(
      jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', 'Ajustado en v2', 'customer_requirements_visible_in_pdf', false)
    )
  );

  select * into v_version_row from quote_versions where quote_id = v_quote_id and version = 1;
  v_snapshot_items := v_version_row.snapshot->'items';
  if jsonb_array_length(v_snapshot_items) <> 1
     or (v_snapshot_items->0->>'customer_requirements_visible_in_pdf')::boolean <> true then
    raise exception 'TEST 4 FALLÓ: el snapshot archivado no conservó customer_requirements_visible_in_pdf=true de la versión 1 (items=%)', v_snapshot_items;
  end if;

  select * into v_new_item from quote_items where quote_id = v_quote_id and model = 'TERMO DIMASH';
  if v_new_item.customer_requirements_visible_in_pdf <> false then
    raise exception 'TEST 4 FALLÓ: la nueva versión no aplicó customer_requirements_visible_in_pdf=false';
  end if;
  if v_new_item.customer_requirements <> 'Ajustado en v2' then
    raise exception 'TEST 4 FALLÓ: la nueva versión no aplicó el nuevo customer_requirements';
  end if;

  raise notice 'TEST 4 OK: rpc_create_quote_revision archiva fielmente el valor anterior del booleano y aplica el nuevo en la versión vigente';
end $$;

-- =========================================================================
-- TEST 5: rpc_create_quote — rechaza HTML peligroso enviado directamente al
-- RPC (bypass de la UI/app/zod, vía supabase-js/PostgREST). Ninguno de los
-- 3 payloads del ticket de seguridad debe persistir ninguna fila.
-- =========================================================================
do $$
declare
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_sp_a uuid := '00000000-0000-0000-0000-000000008611';
  v_bu_a uuid := '00000000-0000-0000-0000-000000008621';
  v_payload text;
  v_rejected boolean;
  v_count_before integer;
  v_count_after integer;
begin
  foreach v_payload in array array[
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<p onclick="alert(1)">Texto</p>'
  ]
  loop
    v_rejected := false;
    select count(*) into v_count_before from quotes;
    begin
      perform rpc_create_quote(
        gen_random_uuid(),
        jsonb_build_object('business_unit_id', v_bu_a, 'salesperson_id', v_sp_a, 'customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
        jsonb_build_array(
          jsonb_build_object('catalog_product_id', null, 'model', 'X', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', v_payload)
        )
      );
    exception when others then
      v_rejected := true;
    end;
    select count(*) into v_count_after from quotes;

    if not v_rejected then
      raise exception 'TEST 5 FALLÓ: rpc_create_quote NO rechazó el payload peligroso: %', v_payload;
    end if;
    if v_count_after <> v_count_before then
      raise exception 'TEST 5 FALLÓ: se creó una Quote a pesar del rechazo (payload: %)', v_payload;
    end if;
  end loop;

  raise notice 'TEST 5 OK: rpc_create_quote rechaza los 3 payloads peligrosos directos, sin persistir ninguna fila.';
end $$;

-- =========================================================================
-- TEST 6: rpc_update_quote — mismo rechazo directo; el quote_item existente
-- no debe modificarse cuando el payload es rechazado.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote86_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_payload text;
  v_rejected boolean;
  v_before text;
  v_after text;
begin
  select customer_requirements into v_before from quote_items where quote_id = v_quote_id and model = 'TERMO DIMASH';

  foreach v_payload in array array[
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<p onclick="alert(1)">Texto</p>'
  ]
  loop
    v_rejected := false;
    begin
      perform rpc_update_quote(
        v_quote_id,
        jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
        jsonb_build_array(
          jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', v_payload)
        )
      );
    exception when others then
      v_rejected := true;
    end;

    if not v_rejected then
      raise exception 'TEST 6 FALLÓ: rpc_update_quote NO rechazó el payload peligroso: %', v_payload;
    end if;
  end loop;

  select customer_requirements into v_after from quote_items where quote_id = v_quote_id and model = 'TERMO DIMASH';
  if v_after is distinct from v_before then
    raise exception 'TEST 6 FALLÓ: customer_requirements cambió a pesar del rechazo (antes: %, después: %)', v_before, v_after;
  end if;

  raise notice 'TEST 6 OK: rpc_update_quote rechaza los 3 payloads peligrosos directos, sin modificar quote_items.';
end $$;

-- =========================================================================
-- TEST 7: rpc_create_quote_revision — mismo rechazo directo. Confirma
-- además que el insert previo a quote_versions (el archivado del snapshot,
-- que en el código corre ANTES del loop de validación) también se revierte
-- — Postgres deshace todo el trabajo de la función si la excepción se
-- propaga, así que no debe quedar ni version avanzada ni snapshot espurio.
-- =========================================================================
do $$
declare
  v_quote_id uuid := current_setting('test.quote86_id')::uuid;
  v_customer_a uuid := '00000000-0000-0000-0000-000000008631';
  v_payload text;
  v_rejected boolean;
  v_version_before integer;
  v_version_after integer;
  v_versions_count_before integer;
  v_versions_count_after integer;
begin
  update quotes set status = 'enviada' where id = v_quote_id;
  select version into v_version_before from quotes where id = v_quote_id;
  select count(*) into v_versions_count_before from quote_versions where quote_id = v_quote_id;

  foreach v_payload in array array[
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<p onclick="alert(1)">Texto</p>'
  ]
  loop
    v_rejected := false;
    begin
      perform rpc_create_quote_revision(
        v_quote_id,
        jsonb_build_object('customer_id', v_customer_a, 'currency', 'MXN', 'tax_rate', 16, 'global_discount_percent', 0, 'valid_until', (current_date + 15)::text),
        jsonb_build_array(
          jsonb_build_object('catalog_product_id', null, 'model', 'TERMO DIMASH', 'quantity', 1, 'unit_price', 100, 'line_discount_percent', 0, 'customer_requirements', v_payload)
        )
      );
    exception when others then
      v_rejected := true;
    end;

    if not v_rejected then
      raise exception 'TEST 7 FALLÓ: rpc_create_quote_revision NO rechazó el payload peligroso: %', v_payload;
    end if;
  end loop;

  select version into v_version_after from quotes where id = v_quote_id;
  select count(*) into v_versions_count_after from quote_versions where quote_id = v_quote_id;
  if v_version_after <> v_version_before then
    raise exception 'TEST 7 FALLÓ: version avanzó a pesar del rechazo (antes: %, después: %)', v_version_before, v_version_after;
  end if;
  if v_versions_count_after <> v_versions_count_before then
    raise exception 'TEST 7 FALLÓ: se archivó una versión en quote_versions a pesar del rechazo (antes: %, después: %)', v_versions_count_before, v_versions_count_after;
  end if;

  raise notice 'TEST 7 OK: rpc_create_quote_revision rechaza los 3 payloads peligrosos directos; ni version avanza ni queda snapshot espurio en quote_versions.';
end $$;

do $$ begin raise notice '=== 0086: 7/7 TESTS OK ==='; end $$;

reset role;
rollback;
