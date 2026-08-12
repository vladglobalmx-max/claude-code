-- GS Orders — Migración 0001: esquema núcleo
-- Tablas: salespeople, orders, order_items, order_images, order_files.
-- business_unit queda listo desde el día uno (Thunder es la única activa hoy;
-- Juno Promotional / Got Fresh Breath / The Fire Spot se agregan después sin
-- tocar el esquema).

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- salespeople
-- =========================================================================
create table salespeople (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'thunder'
    check (business_unit in ('thunder', 'juno_promotional', 'got_fresh_breath', 'the_fire_spot')),
  name text not null,
  prefix text not null
    check (prefix = upper(prefix))
    check (char_length(prefix) between 2 and 5)
    check (prefix ~ '^[A-Z0-9]+$'),
  sequence_current integer not null default 0 check (sequence_current >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- El prefijo es único por unidad de negocio (Thunder es la única hoy, pero
-- así cada unidad futura podrá reutilizar prefijos sin chocar entre sí).
create unique index salespeople_prefix_unique_per_unit
  on salespeople (business_unit, upper(prefix));

create trigger trg_salespeople_updated_at
  before update on salespeople
  for each row execute function set_updated_at();

-- =========================================================================
-- orders
-- =========================================================================
create table orders (
  id uuid primary key default gen_random_uuid(),
  business_unit text not null default 'thunder'
    check (business_unit in ('thunder', 'juno_promotional', 'got_fresh_breath', 'the_fire_spot')),

  -- Folio: generado por trigger (ver 0002_folio.sql), nunca por el cliente.
  folio text not null,
  sequence_number integer not null,

  salesperson_id uuid not null references salespeople(id) on delete restrict,
  order_date date not null default current_date,

  client_name text not null,
  supplier_name text,

  product_type text not null
    check (product_type in ('proyector_gobo', 'luminaria', 'equipo_seguridad', 'refaccion_accesorio', 'otro')),
  status text not null default 'borrador'
    check (status in ('borrador', 'pedido', 'cerrado', 'cancelado')),

  general_notes text,
  vendor_notes text,

  -- --- Proyector / GOBO: especificaciones de proyección (solo aplica si product_type = 'proyector_gobo') ---
  projector_model text,
  projector_quantity integer check (projector_quantity is null or projector_quantity > 0),
  projector_power text,
  projector_lens_type text,
  projector_lens_pending_factory boolean not null default false,

  projection_description text,
  projection_file_path text,
  projection_file_name text,
  projection_file_type text,

  projection_width numeric(6,2),
  projection_height numeric(6,2),
  projection_size_unit text check (projection_size_unit in ('m', 'cm')),

  installation_height numeric(6,2),
  installation_height_unit text check (installation_height_unit in ('m', 'cm', 'pies')),
  installation_distance numeric(6,2),
  installation_orientation text
    check (installation_orientation in ('piso', 'pared', 'inclinado', 'otro')),
  installation_use text check (installation_use in ('interior', 'exterior', 'semi_exterior')),

  surface_type text
    check (surface_type in ('piso', 'pared', 'techo', 'equipo', 'rack', 'anden', 'pasillo', 'otro')),
  surface_material text
    check (surface_material in ('concreto', 'epoxico', 'asfalto', 'metal', 'pintura', 'otro')),
  surface_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_folio_unique on orders (folio);
create index orders_salesperson_idx on orders (salesperson_id);
create index orders_status_idx on orders (status);
create index orders_product_type_idx on orders (product_type);
create index orders_order_date_idx on orders (order_date desc);
create index orders_client_name_idx on orders (lower(client_name));

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- =========================================================================
-- order_items — productos del pedido
-- =========================================================================
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  position integer not null default 0,
  image_path text,
  model text not null,
  description text,
  quantity integer not null default 1 check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_items_order_idx on order_items (order_id);

create trigger trg_order_items_updated_at
  before update on order_items
  for each row execute function set_updated_at();

-- =========================================================================
-- order_images — fotografías del área de instalación
-- =========================================================================
create table order_images (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  position integer not null default 0,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index order_images_order_idx on order_images (order_id);

-- =========================================================================
-- order_files — archivos adjuntos (cotización, ficha técnica, arte, etc.)
-- =========================================================================
create table order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now()
);

create index order_files_order_idx on order_files (order_id);

-- =========================================================================
-- Row Level Security — MVP: cualquier usuario autenticado puede usar la app.
-- Queda preparado para acotar por rol/business_unit más adelante.
-- =========================================================================
alter table salespeople enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_images enable row level security;
alter table order_files enable row level security;

create policy "salespeople_all_authenticated" on salespeople
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "orders_all_authenticated" on orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "order_items_all_authenticated" on order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "order_images_all_authenticated" on order_images
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "order_files_all_authenticated" on order_files
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
