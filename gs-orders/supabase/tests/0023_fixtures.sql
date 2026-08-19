-- THÖREN Quote → Order V2 (0023) — fixtures adicionales sobre fixtures.sql.
-- Corre DESPUÉS de: local_harness_setup.sql + migraciones 0001-0023 +
-- fixtures.sql (org1/vendedor1/vendedor2/admin_orgb/customers/sp1/sp2).
-- Agrega: people + person_id (sp1 resoluble a org1; sp2 "Vendedor Dos"
-- sigue sin person_id a propósito, límite conocido de 0022), un producto de
-- catálogo, y Quotes en distintos estados (aceptada con líneas
-- catálogo+libres, aceptada sin convertir para concurrencia, borrador,
-- rechazada, aceptada para el test de ADMIN) para cubrir las 27 pruebas de
-- 0023 sin volver a fabricar customers/salespeople/orgs desde cero.

select id as org1 from organizations where slug = 'global-supplier-mty' \gset

-- People + person_id: sp1 resoluble a org1 (Vendedor Uno), sp2 (Vendedor
-- Dos) queda SIN person_id a propósito (límite conocido documentado desde
-- 0022, sigue vigente en 0023 porque rpc_create_order_from_quote delega en
-- rpc_create_order, que es quien hace esta validación).
insert into people (id, organization_id, name, active) values
  ('50000000-0000-0000-0000-000000000001', :'org1', 'Vendedor Uno (persona)', true);

update salespeople set person_id = '50000000-0000-0000-0000-000000000001'
  where id = '10000000-0000-0000-0000-000000000001';

-- Nota: NO se fabrica aquí un salesperson "cross-org" para una Quote —
-- trg_check_quote_consistency (0020) ya exige, en el INSERT/UPDATE de
-- CUALQUIER Quote, que salesperson.person_id → people.organization_id
-- coincida exactamente con quotes.organization_id (junto con
-- business_unit/customer). Es estructuralmente imposible que exista una
-- Quote 'aceptada' cuyo salesperson_id resuelva a otra organización — así
-- que ese caso, que sí aplica a rpc_create_order (0022), no tiene
-- equivalente que probar aquí: nunca puede llegar una Quote inconsistente
-- a rpc_create_order_from_quote. Se documenta como hallazgo en el reporte
-- final, no como prueba.

-- Business unit / producto de catálogo de org1 para las líneas de Quote.
select id as bu1 from business_units where organization_id = :'org1' and code = 'got_fresh_breath' \gset

insert into product_catalog (id, organization_id, category, sku, name, active) values
  ('60000000-0000-0000-0000-000000000001', :'org1', 'proyectores', 'SKU-0023-TEST', 'Proyector de prueba 0023', true);

-- Secuencia de folio de Quotes para vendedor1 × bu1 (rpc_create_quote la exige).
insert into salesperson_quote_sequences (organization_id, salesperson_id, business_unit_id, quote_prefix)
values (:'org1', '10000000-0000-0000-0000-000000000001', :'bu1', 'VU1')
on conflict do nothing;

-- Quote A: aceptada, del vendedor1, con una línea de catálogo y una línea
-- libre (catalog_product_id null) — el caso principal de conversión.
select test_set_user('00000000-0000-0000-0000-000000000002');
select * into temp table _quote_a from rpc_create_quote(
  '80000000-0000-0000-0000-00000000000a',
  jsonb_build_object(
    'business_unit_id', :'bu1',
    'salesperson_id', '10000000-0000-0000-0000-000000000001',
    'customer_id', '30000000-0000-0000-0000-000000000001',
    'currency', 'MXN',
    'tax_rate', 16,
    'global_discount_percent', 0,
    'valid_until', (current_date + 15)::text
  ),
  '[
    {"catalog_product_id":"60000000-0000-0000-0000-000000000001","model":"Proyector de prueba 0023","quantity":2,"unit_price":1000,"line_discount_percent":0},
    {"catalog_product_id":null,"model":"Línea libre sin catálogo","quantity":1,"unit_price":250,"line_discount_percent":10}
  ]'::jsonb
);
update quotes set status = 'enviada' where id = '80000000-0000-0000-0000-00000000000a';
update quotes set status = 'aceptada' where id = '80000000-0000-0000-0000-00000000000a';

-- Quote B: aceptada, del vendedor1, SIN convertir todavía — usada para la
-- prueba de concurrencia (dos conversiones simultáneas sobre la misma Quote).
select * into temp table _quote_b from rpc_create_quote(
  '80000000-0000-0000-0000-00000000000b',
  jsonb_build_object(
    'business_unit_id', :'bu1',
    'salesperson_id', '10000000-0000-0000-0000-000000000001',
    'customer_id', '30000000-0000-0000-0000-000000000001',
    'currency', 'MXN',
    'tax_rate', 16,
    'global_discount_percent', 0,
    'valid_until', (current_date + 15)::text
  ),
  '[{"catalog_product_id":null,"model":"Quote B para concurrencia","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
);
update quotes set status = 'enviada' where id = '80000000-0000-0000-0000-00000000000b';
update quotes set status = 'aceptada' where id = '80000000-0000-0000-0000-00000000000b';

-- Quote C: borrador — nunca debe poder convertirse.
select * into temp table _quote_c from rpc_create_quote(
  '80000000-0000-0000-0000-00000000000c',
  jsonb_build_object(
    'business_unit_id', :'bu1',
    'salesperson_id', '10000000-0000-0000-0000-000000000001',
    'customer_id', '30000000-0000-0000-0000-000000000001',
    'currency', 'MXN',
    'tax_rate', 16,
    'global_discount_percent', 0,
    'valid_until', (current_date + 15)::text
  ),
  '[{"catalog_product_id":null,"model":"Quote C borrador","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
);

-- Quote D: rechazada — tampoco debe poder convertirse.
select * into temp table _quote_d from rpc_create_quote(
  '80000000-0000-0000-0000-00000000000d',
  jsonb_build_object(
    'business_unit_id', :'bu1',
    'salesperson_id', '10000000-0000-0000-0000-000000000001',
    'customer_id', '30000000-0000-0000-0000-000000000001',
    'currency', 'MXN',
    'tax_rate', 16,
    'global_discount_percent', 0,
    'valid_until', (current_date + 15)::text
  ),
  '[{"catalog_product_id":null,"model":"Quote D rechazada","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
);
update quotes set status = 'enviada' where id = '80000000-0000-0000-0000-00000000000d';
update quotes set status = 'rechazada' where id = '80000000-0000-0000-0000-00000000000d';

-- Quote E: aceptada, del vendedor1, para la prueba explícita #12 (ADMIN
-- convierte la Quote de un VENDEDOR — el Order resultante debe conservar
-- salesperson_id del vendedor1, nunca el del admin).
select * into temp table _quote_e from rpc_create_quote(
  '80000000-0000-0000-0000-00000000000e',
  jsonb_build_object(
    'business_unit_id', :'bu1',
    'salesperson_id', '10000000-0000-0000-0000-000000000001',
    'customer_id', '30000000-0000-0000-0000-000000000001',
    'currency', 'MXN',
    'tax_rate', 16,
    'global_discount_percent', 0,
    'valid_until', (current_date + 15)::text
  ),
  '[{"catalog_product_id":null,"model":"Quote E para test ADMIN","quantity":1,"unit_price":100,"line_discount_percent":0}]'::jsonb
);
update quotes set status = 'enviada' where id = '80000000-0000-0000-0000-00000000000e';
update quotes set status = 'aceptada' where id = '80000000-0000-0000-0000-00000000000e';
