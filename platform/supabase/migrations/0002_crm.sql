-- GAIOS Platform — Migración 0002: CRM (clientes, contactos, oportunidades, seguimientos)

create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid not null references business_units(id),
  legal_name text not null,
  trade_name text,
  industry text,
  size text,
  employees_count int,
  website text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  status text not null default 'active' check (status in ('active','inactive','prospect')),
  source text,
  owner_id uuid references users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  position text,
  email text,
  phone text,
  whatsapp text,
  area text,
  decision_level text
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid not null references business_units(id),
  client_id uuid not null references clients(id),
  contact_id uuid references contacts(id),
  name text not null,
  owner_id uuid not null references users(id),
  estimated_value numeric(14,2),
  estimated_margin numeric(5,2),
  stage text not null default 'prospecto' check (stage in (
    'prospecto','contactado','calificado','diagnostico','propuesta',
    'negociacion','prueba_piloto','cierre_ganado','cierre_perdido','seguimiento_futuro'
  )),
  probability int not null default 10 check (probability between 0 and 100),
  expected_close_date date,
  last_activity_at timestamptz,
  next_activity_at timestamptz,
  competitors text[] default '{}',
  objections text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now()
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid not null references business_units(id),
  client_id uuid references clients(id),
  contact_id uuid references contacts(id),
  opportunity_id uuid references opportunities(id),
  user_id uuid not null references users(id),
  type text not null check (type in (
    'llamada','correo','whatsapp','visita','reunion','cotizacion','recordatorio','revision_tecnica'
  )),
  scheduled_at timestamptz not null,
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  status text not null default 'pendiente' check (status in ('pendiente','completado','vencido','cancelado')),
  description text,
  result text,
  next_action text,
  created_at timestamptz not null default now()
);

create index clients_company_bu_idx on clients (company_id, business_unit_id);
create index opportunities_company_stage_idx on opportunities (company_id, stage);
create index followups_company_scheduled_idx on followups (company_id, scheduled_at);
