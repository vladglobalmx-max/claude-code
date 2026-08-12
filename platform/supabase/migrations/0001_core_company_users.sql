-- GAIOS Platform — Migración 0001: núcleo (empresas, unidades de negocio, roles, usuarios)

create extension if not exists "pgcrypto";

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table business_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text,
  created_at timestamptz not null default now(),
  unique (company_id, slug)
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade, -- null = rol de sistema, compartido entre empresas
  key text not null,          -- 'superadmin' | 'director_general' | 'director_comercial' | 'vendedor'
                               -- | 'marketing' | 'operaciones' | 'admin_ia'
  name text not null,
  description text,
  is_system boolean not null default false,
  unique (company_id, key)
);

-- users espeja a auth.users (Supabase Auth); el id es el mismo uid
create table users (
  id uuid primary key,        -- references auth.users(id), sin FK física entre esquemas
  company_id uuid not null references companies(id) on delete cascade,
  role_id uuid not null references roles(id),
  full_name text not null,
  email text not null,
  avatar_url text,
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now()
);
create unique index users_company_email_idx on users (company_id, email);

create table user_business_units (
  user_id uuid not null references users(id) on delete cascade,
  business_unit_id uuid not null references business_units(id) on delete cascade,
  primary key (user_id, business_unit_id)
);

comment on table companies is 'Tenant raíz. Toda tabla de negocio referencia company_id para aislamiento multiempresa.';
comment on table roles is 'is_system=true y company_id NULL para los 7 roles base definidos en la instrucción maestra.';
