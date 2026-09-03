-- THÖREN — Fase 7C: timezone por organización (0053) — pruebas funcionales
-- contra Postgres real. Corre DESPUÉS de: local_harness_setup.sql +
-- migraciones 0001-0053 + fixtures.sql. Todo el script corre en una
-- transacción que se revierte al final (rollback) — repetible.
--
-- org1 (Global Supplier)/admin/vendedor1/vendedor2/Org B (fixtures.sql) ya
-- existen. Este archivo prueba: (a) el DEFAULT/backfill de
-- organizations.timezone para organizaciones creadas ANTES de 0053, (b)
-- que una organización recién provisionada (0052) también recibe el
-- DEFAULT, (c) que HOY no existe ningún camino de escritura vía RLS para
-- que un admin de organización cambie su propio timezone (solo
-- service_role/migración puede — decisión deliberada de 7C, ver 0053), y
-- (d) que una vez fijado un timezone distinto (simulando el único camino
-- real hoy: un ajuste manual de pilot-onboarding vía service_role), la
-- lectura RLS-respetada que usa getCurrentOrganizationTimezone()
-- (current_user_organization_id() + select timezone from organizations)
-- resuelve el valor correcto por organización, sin fuga cross-tenant.
--
-- NOTA — bug conocido de psql: la sustitución `:'variable'` NO funciona
-- dentro de bloques `do $ ... $` — todo id usado DENTRO de un bloque `do
-- $$` se resuelve vía current_setting() (guardado antes con set_config) o
-- como literal UUID fijo, nunca `:'var'`.

set role authenticated;
begin;

\set admin '00000000-0000-0000-0000-000000000001'
\set vendedor1 '00000000-0000-0000-0000-000000000002'
\set orgb_admin '00000000-0000-0000-0000-000000000009'

select test_set_user(:'admin');
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
select set_config('test.org1_id', :'org1', false);

-- Org B: el admin de Global Supplier NO es miembro (organizations_select_
-- member, 0013) y no la vería bajo RLS — se resuelve con service_role
-- (bypassrls), igual criterio que 0052 para lecturas administrativas.
set role service_role;
select id as orgb from organizations where slug = 'org-b' \gset
set role authenticated;
select set_config('test.orgb_id', :'orgb', false);

-- =========================================================================
-- TEST 1: la columna existe, NOT NULL, con DEFAULT 'America/Monterrey'.
-- =========================================================================
do $$
declare v_default text; v_not_null boolean;
begin
  select column_default, (is_nullable = 'NO') into v_default, v_not_null
  from information_schema.columns
  where table_schema = 'public' and table_name = 'organizations' and column_name = 'timezone';

  if v_default is null or v_default not like '%America/Monterrey%' then
    raise exception 'TEST 1 FALLÓ: organizations.timezone no tiene DEFAULT ''America/Monterrey'' (actual: %)', v_default;
  end if;
  if not v_not_null then
    raise exception 'TEST 1 FALLÓ: organizations.timezone permite NULL';
  end if;
  raise notice 'TEST 1 OK: columna timezone existe, NOT NULL, DEFAULT America/Monterrey.';
end $$;

-- =========================================================================
-- TEST 2: backfill — organizaciones creadas ANTES de 0053 (Global Supplier
-- vía bootstrap de 0013, Org B vía fixtures.sql) quedan en
-- 'America/Monterrey', nunca NULL. Lectura cross-org vía service_role
-- (bypassrls) — esto verifica el dato real en la tabla, no RLS (eso es
-- TEST 5/6/7).
-- =========================================================================
set role service_role;
do $$
declare v_org1 uuid := current_setting('test.org1_id')::uuid; v_orgb uuid := current_setting('test.orgb_id')::uuid;
declare v_tz1 text; v_tzb text;
begin
  select timezone into v_tz1 from organizations where id = v_org1;
  select timezone into v_tzb from organizations where id = v_orgb;
  if v_tz1 is distinct from 'America/Monterrey' then
    raise exception 'TEST 2 FALLÓ: Global Supplier no quedó en America/Monterrey tras el backfill (actual: %)', v_tz1;
  end if;
  if v_tzb is distinct from 'America/Monterrey' then
    raise exception 'TEST 2 FALLÓ: Org B no quedó en America/Monterrey tras el backfill (actual: %)', v_tzb;
  end if;
  raise notice 'TEST 2 OK: backfill correcto para organizaciones preexistentes.';
end $$;
set role authenticated;

-- =========================================================================
-- TEST 3: una organización recién provisionada (rpc_provision_organization,
-- 0052 — sin parámetro de timezone) también recibe el DEFAULT.
-- =========================================================================
\set acme_admin '00000000-0000-0000-0000-0000000000c1'
insert into auth.users (id, email) values (:'acme_admin', 'jane@acme.example');

set role service_role;
select organization_id as acme_org_id
from rpc_provision_organization(
  'Acme Corp', 'acme-corp', :'acme_admin', 'Jane Doe', 'jane@acme.example', 'Acme Principal', 'acme_principal'
) \gset
select set_config('test.acme_org_id', :'acme_org_id', false);
set role authenticated;

-- Lectura cross-org vía service_role (bypassrls) — el admin de Global
-- Supplier (sesión activa) no es miembro de Acme Corp.
set role service_role;
do $$
declare v_org_id uuid := current_setting('test.acme_org_id')::uuid; v_tz text;
begin
  select timezone into v_tz from organizations where id = v_org_id;
  if v_tz is distinct from 'America/Monterrey' then
    raise exception 'TEST 3 FALLÓ: Acme Corp (recién provisionada) no recibió el DEFAULT (actual: %)', v_tz;
  end if;
  raise notice 'TEST 3 OK: organización recién provisionada recibe el DEFAULT.';
end $$;
set role authenticated;

-- =========================================================================
-- TEST 4: HOY no existe ningún camino RLS de escritura para que un admin
-- de organización cambie su propio timezone — solo hay política SELECT
-- (organizations_select_member, 0013), ninguna de UPDATE. DECISIÓN
-- deliberada de 7C (cambio pequeño y coherente, sin UI de config nueva):
-- ajustar el timezone de un tenant piloto es, por ahora, una operación de
-- onboarding vía service_role, no una función self-service.
-- =========================================================================
select test_set_user(:'admin');
do $$
declare v_org_id uuid := current_setting('test.org1_id')::uuid;
begin
  update organizations set timezone = 'Asia/Tokyo' where id = v_org_id;
  if exists (select 1 from organizations where id = v_org_id and timezone = 'Asia/Tokyo') then
    raise exception 'TEST 4 FALLÓ: un admin authenticated pudo cambiar organizations.timezone (debería estar bloqueado por RLS: no hay política UPDATE)';
  end if;
  raise notice 'TEST 4 OK: ningún admin authenticated puede escribir organizations.timezone (RLS sin política UPDATE).';
end $$;

-- =========================================================================
-- TEST 5/6: fijamos Org B en un timezone distinto (Asia/Tokyo) simulando
-- el único camino real hoy (service_role, onboarding manual del piloto), y
-- confirmamos que la lectura RLS-respetada que usa
-- getCurrentOrganizationTimezone() (current_user_organization_id() +
-- select timezone from organizations where id = ...) resuelve el valor
-- correcto PARA CADA organización, sin fuga cross-tenant: el admin de Org B
-- ve Asia/Tokyo, el admin de Global Supplier (org1) sigue viendo
-- America/Monterrey en el mismo instante.
-- =========================================================================
set role service_role;
update organizations set timezone = 'Asia/Tokyo' where id = current_setting('test.orgb_id')::uuid;
set role authenticated;

do $$
declare v_org1 uuid := current_setting('test.org1_id')::uuid; v_orgb uuid := current_setting('test.orgb_id')::uuid;
declare v_resolved_org uuid; v_tz text;
begin
  -- Admin de Org B: current_user_organization_id() debe resolver Org B, y
  -- el timezone leído debe ser el recién fijado (Asia/Tokyo).
  perform test_set_user('00000000-0000-0000-0000-000000000009');
  select current_user_organization_id() into v_resolved_org;
  if v_resolved_org is distinct from v_orgb then
    raise exception 'TEST 5 FALLÓ: current_user_organization_id() del admin de Org B no resolvió Org B';
  end if;
  select timezone into v_tz from organizations where id = v_resolved_org;
  if v_tz is distinct from 'Asia/Tokyo' then
    raise exception 'TEST 5 FALLÓ: el admin de Org B no ve su propio timezone actualizado (actual: %)', v_tz;
  end if;
  raise notice 'TEST 5 OK: admin de Org B resuelve su propio timezone (Asia/Tokyo) vía el mismo mecanismo de getCurrentOrganizationTimezone().';

  -- Admin de Global Supplier (org1), MISMO instante lógico: sigue viendo
  -- America/Monterrey — el cambio de Org B no le afecta (no hay fuga
  -- cross-tenant).
  perform test_set_user('00000000-0000-0000-0000-000000000001');
  select current_user_organization_id() into v_resolved_org;
  if v_resolved_org is distinct from v_org1 then
    raise exception 'TEST 6 FALLÓ: current_user_organization_id() del admin de Global Supplier no resolvió org1';
  end if;
  select timezone into v_tz from organizations where id = v_resolved_org;
  if v_tz is distinct from 'America/Monterrey' then
    raise exception 'TEST 6 FALLÓ: Global Supplier se vio afectado por el cambio de timezone de Org B (actual: %)', v_tz;
  end if;
  raise notice 'TEST 6 OK: Global Supplier (org1) no se ve afectado por el timezone de Org B — sin fuga cross-tenant.';
end $$;

-- =========================================================================
-- TEST 7: un vendedor (no-admin) de Org 1 tampoco puede leer el timezone
-- de Org B (organizations_select_member sigue exigiendo membership real,
-- sin excepción para timezone) — RLS ya existente de 0013, sin regresión.
-- =========================================================================
select test_set_user(:'vendedor1');
do $$
declare v_orgb uuid := current_setting('test.orgb_id')::uuid;
begin
  if exists (select 1 from organizations where id = v_orgb) then
    raise exception 'TEST 7 FALLÓ: vendedor1 (Org 1) pudo leer la fila de Org B (aislamiento roto)';
  end if;
  raise notice 'TEST 7 OK: aislamiento cross-org sobre organizations sigue intacto (sin regresión de 0013).';
end $$;

select test_set_user(:'admin');

do $$ begin raise notice '=== 0053: 7/7 TESTS OK ==='; end $$;

rollback;
