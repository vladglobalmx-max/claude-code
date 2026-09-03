-- Fixtures para las pruebas 0021 (Customer Contacts + Excel Import).
-- org1 se resuelve dinámicamente (el bootstrap de CORE 1 genera su id con
-- gen_random_uuid(), nunca es estable entre corridas).
select id as org1 from organizations where slug = 'global-supplier-mty' \gset

-- Salespeople para vendedor1/vendedor2
-- THÖREN Fase 7A (0051) — organization_id explícito: este script corre sin
-- sesión de aplicación (sin test_set_user), así que el DEFAULT
-- current_user_organization_id() resolvería NULL aquí.
insert into salespeople (id, organization_id, business_unit, name, prefix, active)
values
  ('10000000-0000-0000-0000-000000000001', :'org1', 'thunder', 'Vendedor Uno', 'VU1', true),
  ('10000000-0000-0000-0000-000000000002', :'org1', 'thunder', 'Vendedor Dos', 'VU2', true);

insert into user_profiles (user_id, name, role, salesperson_id, active)
values
  ('00000000-0000-0000-0000-000000000002', 'Vendedor Uno', 'vendedor', '10000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000003', 'Vendedor Dos', 'vendedor', '10000000-0000-0000-0000-000000000002', true);

insert into organization_members (organization_id, user_id, role, active)
values
  (:'org1', '00000000-0000-0000-0000-000000000002', 'vendedor', true),
  (:'org1', '00000000-0000-0000-0000-000000000003', 'vendedor', true);

-- Segunda organización + admin, para las pruebas cross-org.
insert into organizations (id, name, slug) values
  ('20000000-0000-0000-0000-000000000001', 'Org B', 'org-b');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000009', 'admin-orgb@test.local');

insert into user_profiles (user_id, name, role, active)
values ('00000000-0000-0000-0000-000000000009', 'Admin Org B', 'admin', true);

insert into organization_members (organization_id, user_id, role, active)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'admin', true);

-- Customers de Org 1 para las pruebas de duplicados de importación.
insert into customers (id, organization_id, name, tax_id, active) values
  ('30000000-0000-0000-0000-000000000001', :'org1', 'CEMEX', 'CMX010101AB1', true),
  ('30000000-0000-0000-0000-000000000002', :'org1', 'Constructora Norte', null, true),
  ('30000000-0000-0000-0000-000000000003', :'org1', 'Cliente Inactivo SA', null, false);

insert into customer_contacts (id, customer_id, name, email, phone, is_primary, active) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Juan Pérez', 'juan@cemex.com', '8110000001', true, true);

-- Customer de Org B, para confirmar aislamiento cross-org.
insert into customers (id, organization_id, name, active) values
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'Cliente de Org B', true);
