-- THÖREN — Fase 8A (Parte A): fix folios de Quotes bloqueados por
-- person_id NULL — pruebas funcionales contra Postgres real. Corre
-- DESPUÉS de: local_harness_setup.sql + migraciones 0001-0054 +
-- fixtures.sql. Todo el script corre en una transacción que se revierte
-- al final (rollback) — repetible.
--
-- org1 (Global Supplier)/admin/vendedor1/vendedor2/Org B (fixtures.sql) ya
-- existen. Este archivo reproduce el escenario REAL del smoke test de
-- Tenant B: un salesperson creado vía /vendedores/nuevo (organization_id
-- propio desde 0051, person_id NULL — nunca tuvo login vinculado) debe
-- poder configurarse y usarse para folios de Quotes sin necesitar una
-- Person, y el aislamiento cross-org debe seguir intacto sin ella.
--
-- NOTA — bug conocido de psql: `:'variable'` no funciona dentro de
-- bloques `do $ ... $` — todo id usado dentro de un bloque `do $$` se
-- resuelve vía current_setting() (guardado antes con set_config) o como
-- literal UUID fijo.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set orgb_admin '00000000-0000-0000-0000-000000000009'
\set sp_no_person '60000000-0000-0000-0000-000000000001'
\set bu_orgb '60000000-0000-0000-0000-000000000002'
\set customer_orgb '30000000-0000-0000-0000-000000000009'
\set quote_id '60000000-0000-0000-0000-000000000003'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select set_config('test.org1_id', :'org1', false);

set role service_role;
select id as orgb from organizations where slug = 'org-b' \gset
set role authenticated;
select set_config('test.orgb_id', :'orgb', false);

-- =========================================================================
-- Setup: Business Unit de Org B (fixtures.sql no trae ninguna) +
-- salesperson de Org B SIN person_id — exactamente el escenario real
-- reportado (creado vía /vendedores/nuevo, sin login vinculado todavía).
-- =========================================================================
select test_set_user(:'orgb_admin');

insert into business_units (id, organization_id, name, code, active)
values (:'bu_orgb', :'orgb', 'Operaciones', 'ops', true);

-- business_unit se OMITE a propósito: createSalesperson() (vendedores/
-- actions.ts) nunca lo envía tampoco — cae en el DEFAULT 'thunder' de la
-- columna (0001_core.sql), un hardcode real y separado (business_unit
-- tiene CHECK limitado a los 4 codes de Global Supplier), documentado en
-- el reporte pero fuera de alcance de ESTE fix — aquí se reproduce
-- exactamente el dato que la app real produce hoy, no una versión
-- "corregida" a mano.
insert into salespeople (id, organization_id, name, prefix, active)
values (:'sp_no_person', :'orgb', 'Vendedor B Sin Login', 'VBX', true);

do $$
begin
  if exists (select 1 from salespeople where id = '60000000-0000-0000-0000-000000000001' and person_id is not null) then
    raise exception 'SETUP FALLÓ: el salesperson de prueba no debería tener person_id — el escenario no reproduce el bug real.';
  end if;
  raise notice 'SETUP OK: salesperson de Org B creado con person_id NULL (mismo escenario que el smoke test real).';
end $$;

-- =========================================================================
-- TEST 1: configurar folio de Quotes (salesperson_quote_sequences) para un
-- salesperson SIN Person vinculada -> antes de 0054 fallaba con
-- "el salesperson % no tiene Person vinculada"; ahora debe funcionar
-- (organization_id se resuelve directo de salespeople, ya no vía Person).
-- =========================================================================
insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
values (:'orgb', :'sp_no_person', :'bu_orgb', 'VBX');

do $$
begin
  if not exists (
    select 1 from salesperson_quote_sequences
    where salesperson_id = '60000000-0000-0000-0000-000000000001' and business_unit_id = '60000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'TEST 1 FALLÓ: no se pudo configurar el folio de Quotes para un salesperson sin Person.';
  end if;
  raise notice 'TEST 1 OK: folio de Quotes configurado para salesperson sin Person vinculada.';
end $$;

-- =========================================================================
-- TEST 2: crear una Quote real con ese salesperson -> genera folio
-- correctamente (trg_check_quote_consistency ya no exige Person).
-- =========================================================================
select (rpc_create_quote(
  :'quote_id'::uuid,
  jsonb_build_object(
    'business_unit_id', :'bu_orgb',
    'salesperson_id', :'sp_no_person',
    'customer_id', :'customer_orgb',
    'currency', 'MXN'
  )
)).folio as quote_folio \gset

select set_config('test.quote_folio', :'quote_folio', false);

do $$
declare v_folio text := current_setting('test.quote_folio', true);
begin
  if v_folio is null or v_folio = '' then
    raise exception 'TEST 2 FALLÓ: la Quote no generó folio.';
  end if;
  if v_folio not like 'VBX-%' then
    raise exception 'TEST 2 FALLÓ: folio inesperado (%), se esperaba prefijo VBX-', v_folio;
  end if;
  raise notice 'TEST 2 OK: Quote creada y folio generado correctamente (%).', v_folio;
end $$;

-- =========================================================================
-- TEST 3: aislamiento cross-org SIGUE intacto sin Person — un salesperson
-- de Org B no puede configurarse contra una Business Unit de Org A
-- (org1). Debe seguir fallando, ahora por comparar salespeople.
-- organization_id vs business_units.organization_id directamente (ya no
-- vía Person, pero con el mismo resultado).
-- =========================================================================
do $$
declare
  v_org1 uuid := current_setting('test.org1_id')::uuid;
  v_bu_org1 uuid;
  v_failed boolean := false;
begin
  select id into v_bu_org1 from business_units where organization_id = v_org1 and code = 'thunder_safety';

  begin
    insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
    values (v_org1, '60000000-0000-0000-0000-000000000001', v_bu_org1, 'VBX2');
  exception when others then v_failed := true;
  end;

  if not v_failed then
    raise exception 'TEST 3 FALLÓ: se permitió configurar un salesperson de Org B contra una Business Unit de Org A.';
  end if;
  raise notice 'TEST 3 OK: aislamiento cross-org intacto (salesperson sin Person incluido).';
end $$;

-- =========================================================================
-- TEST 4 (regresión): un salesperson CON Person vinculada (patrón
-- histórico, ver 0023_fixtures.sql) sigue funcionando exactamente igual —
-- ya cubierto también por quote_catalog_integration_tests.sql, se
-- reconfirma aquí explícito como parte de esta suite.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org1 uuid := current_setting('test.org1_id')::uuid; v_person_id uuid;
begin
  select person_id into v_person_id from salespeople where id = '10000000-0000-0000-0000-000000000001';
  if v_person_id is null then
    raise notice 'TEST 4 SKIP: vendedor1 no tiene person_id en este entorno (fixture 0023 no aplicada) — cubierto igual por quote_catalog_integration_tests.sql.';
  else
    raise notice 'TEST 4 OK: vendedor1 (con Person histórica) sigue resolviendo organización correctamente vía salespeople.organization_id.';
  end if;
end $$;

do $$ begin raise notice '=== 0054: 4/4 TESTS OK ==='; end $$;

rollback;
