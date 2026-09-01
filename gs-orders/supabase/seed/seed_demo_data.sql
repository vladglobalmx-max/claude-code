-- GS Orders (THÖREN) — datos de arranque SOLO para desarrollo local.
-- Ficticios de principio a fin: ningún nombre, correo, RFC o teléfono real
-- de cliente/proveedor/empleado. NUNCA correr esto contra un proyecto real
-- (staging/producción) — crea usuarios de auth.users con password en texto
-- plano conocido, es exclusivamente para el stack de Docker local.
--
-- Cuentas de login que deja listas (todas con password "Thoren2026!"):
--   admin@thoren.local     -> ADMIN (acceso total)
--   vladimir@thoren.local  -> VENDEDOR (vendedor "Vladimir Peña", VPT)
--   karla@thoren.local     -> VENDEDOR (vendedor "Karla Saucedo", KST)
do $$
declare
  v_org_id uuid;
  v_bu_thunder_id uuid;
  v_admin_user_id uuid := gen_random_uuid();
  v_admin_person_id uuid := gen_random_uuid();
  v_vladimir_user_id uuid := gen_random_uuid();
  v_vladimir_person_id uuid := gen_random_uuid();
  v_vladimir_salesperson_id uuid := gen_random_uuid();
  v_karla_user_id uuid := gen_random_uuid();
  v_karla_person_id uuid := gen_random_uuid();
  v_karla_salesperson_id uuid := gen_random_uuid();
  v_warehouse_id uuid := gen_random_uuid();
  v_supplier_id uuid := gen_random_uuid();
  v_password text := extensions.crypt('Thoren2026!', extensions.gen_salt('bf'));
begin
  -- 1) Organización + unidad de negocio -------------------------------------
  -- NO se crean: 0013/0014 ya bootstrapean la organización real
  -- "Global Supplier MTY" (slug global-supplier-mty) con sus unidades de
  -- negocio reales (thunder_led, thunder_safety, juno_promotional,
  -- got_fresh_breath, the_fire_spot, gtx_systems) como parte del esquema,
  -- no como datos de prueba — este seed solo cuelga gente/clientes/catálogo
  -- de prueba de esa organización real, no crea una paralela.
  select id into v_org_id from organizations where slug = 'global-supplier-mty';
  select id into v_bu_thunder_id from business_units where organization_id = v_org_id and code = 'thunder_safety';

  if v_org_id is null or v_bu_thunder_id is null then
    raise exception 'No se encontró la organización global-supplier-mty o su unidad thunder_safety — revisa que 0013/0014 se hayan aplicado antes que este seed.';
  end if;

  -- 2) Personas (staff interno) --------------------------------------------
  insert into people (id, organization_id, name, email, active)
  values
    (v_admin_person_id, v_org_id, 'Admin Demo', 'admin@thoren.local', true),
    (v_vladimir_person_id, v_org_id, 'Vladimir Peña (demo)', 'vladimir@thoren.local', true),
    (v_karla_person_id, v_org_id, 'Karla Saucedo (demo)', 'karla@thoren.local', true)
  on conflict do nothing;

  insert into person_business_units (person_id, business_unit_id, active)
  values
    (v_admin_person_id, v_bu_thunder_id, true),
    (v_vladimir_person_id, v_bu_thunder_id, true),
    (v_karla_person_id, v_bu_thunder_id, true)
  on conflict do nothing;

  -- 3) Vendedores (folios) --------------------------------------------------
  insert into salespeople (id, business_unit, name, prefix, sequence_current, active, person_id)
  values
    (v_vladimir_salesperson_id, 'thunder', 'Vladimir Peña (demo)', 'VPT', 0, true, v_vladimir_person_id),
    (v_karla_salesperson_id, 'thunder', 'Karla Saucedo (demo)', 'KST', 0, true, v_karla_person_id)
  on conflict do nothing;

  -- 4) Usuarios de auth (login local) ---------------------------------------
  -- Receta estándar de seed local de Supabase: auth.users + auth.identities
  -- a mano, con password ya hasheado (pgcrypto). Solo funciona porque este
  -- SQL corre directo contra Postgres (supabase db reset), sin pasar por la
  -- API de Auth — por eso NO respeta enable_signup/confirmaciones, y por eso
  -- mismo jamás debe correrse contra un proyecto real.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin_user_id, 'authenticated', 'authenticated',
     'admin@thoren.local', v_password, now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_vladimir_user_id, 'authenticated', 'authenticated',
     'vladimir@thoren.local', v_password, now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_karla_user_id, 'authenticated', 'authenticated',
     'karla@thoren.local', v_password, now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_admin_user_id::text, v_admin_user_id,
     jsonb_build_object('sub', v_admin_user_id::text, 'email', 'admin@thoren.local'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_vladimir_user_id::text, v_vladimir_user_id,
     jsonb_build_object('sub', v_vladimir_user_id::text, 'email', 'vladimir@thoren.local'), 'email', now(), now(), now()),
    (gen_random_uuid(), v_karla_user_id::text, v_karla_user_id,
     jsonb_build_object('sub', v_karla_user_id::text, 'email', 'karla@thoren.local'), 'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;

  -- 5) Membresía de organización (gate real de RLS — is_organization_member) -
  insert into organization_members (organization_id, user_id, role, active)
  values
    (v_org_id, v_admin_user_id, 'admin', true),
    (v_org_id, v_vladimir_user_id, 'vendedor', true),
    (v_org_id, v_karla_user_id, 'vendedor', true)
  on conflict (organization_id, user_id) do nothing;

  -- 6) Perfiles (rol legacy global — current_user_is_admin(), etc.) ---------
  insert into user_profiles (user_id, name, role, salesperson_id, person_id, active)
  values
    (v_admin_user_id, 'Admin Demo', 'admin', null, v_admin_person_id, true),
    (v_vladimir_user_id, 'Vladimir Peña (demo)', 'vendedor', v_vladimir_salesperson_id, v_vladimir_person_id, true),
    (v_karla_user_id, 'Karla Saucedo (demo)', 'vendedor', v_karla_salesperson_id, v_karla_person_id, true)
  on conflict (user_id) do nothing;

  -- 7) Almacén + proveedor ---------------------------------------------------
  insert into warehouses (id, organization_id, name, code, location, active)
  values (v_warehouse_id, v_org_id, 'Almacén Principal (demo)', 'principal', 'Monterrey, NL', true)
  on conflict (organization_id, code) do nothing;

  insert into suppliers (id, organization_id, name, contact_name, email, phone, preferred_currency, active)
  values (v_supplier_id, v_org_id, 'Proveedor Demo SA de CV', 'Contacto Demo', 'compras@proveedor-demo.local', '8180000000', 'MXN', true)
  on conflict do nothing;

  -- 8) Catálogo de producto ---------------------------------------------------
  -- Solo agrega 2 SKUs de prueba nuevos — 0019 ya trae catálogo real
  -- (TLLTPB140A/R, etc.), no se toca ni se duplica.
  insert into product_catalog (id, organization_id, sku, name, category, brand, model, unit, power, color, default_price_mxn, default_price_usd, active)
  select gen_random_uuid(), v_org_id, 'DEMO-LED-100', 'Lámpara LED 100W (demo)', 'Iluminación', 'Thunder', 'TL-100', 'pieza', '100W', 'Blanco frío', 850.00, 46.00, true
  where not exists (select 1 from product_catalog where organization_id = v_org_id and sku = 'DEMO-LED-100')
  union all
  select gen_random_uuid(), v_org_id, 'DEMO-REF-60', 'Reflector Solar 60W (demo)', 'Iluminación solar', 'Thunder', 'TR-60S', 'pieza', '60W', 'Blanco cálido', 620.00, 34.00, true
  where not exists (select 1 from product_catalog where organization_id = v_org_id and sku = 'DEMO-REF-60');

  insert into product_business_units (product_id, business_unit_id)
  select pc.id, v_bu_thunder_id
  from product_catalog pc
  where pc.organization_id = v_org_id and pc.sku in ('DEMO-LED-100', 'DEMO-REF-60')
  on conflict do nothing;

  -- 9) Clientes ----------------------------------------------------------------
  insert into customers (id, organization_id, name, legal_name, tax_id, email, phone, active)
  values
    (gen_random_uuid(), v_org_id, 'Constructora Demo SA de CV', 'Constructora Demo SA de CV', 'CDE010101AAA', 'compras@constructora-demo.local', '8110000001', true),
    (gen_random_uuid(), v_org_id, 'Ferretería Ejemplo', 'Ferretería Ejemplo SA de CV', 'FEJ020202BBB', 'contacto@ferreteria-ejemplo.local', '8110000002', true)
  on conflict do nothing;
end $$;
