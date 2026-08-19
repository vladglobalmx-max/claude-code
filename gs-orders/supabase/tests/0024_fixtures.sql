-- THÖREN Business Unit Branding (0024) — fixtures adicionales sobre
-- fixtures.sql (org1/vendedor1/vendedor2/admin_orgb ya existen). Agrega
-- una Business Unit de Org B para la prueba de aislamiento cross-org.

insert into business_units (id, organization_id, name, code, active) values
  ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'BU de Org B', 'bu_org_b', true);

-- person_id de vendedor1 → org1, requerido por trg_check_salesperson_quote_sequence_valid
-- (0020) para las pruebas de regresión de Quotes/Quote→Order de este script.
select id as org1 from organizations where slug = 'global-supplier-mty' \gset
insert into people (id, organization_id, name, active) values
  ('50000000-0000-0000-0000-000000000001', :'org1', 'Vendedor Uno (persona)', true)
on conflict (id) do nothing;
update salespeople set person_id = '50000000-0000-0000-0000-000000000001'
  where id = '10000000-0000-0000-0000-000000000001';
