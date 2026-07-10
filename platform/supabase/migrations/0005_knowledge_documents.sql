-- GAIOS Platform — Migración 0005: base de conocimiento (documents), preparado para búsqueda semántica

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid references business_units(id),
  name text not null,
  category text,
  description text,
  file_path text not null,          -- ruta en Supabase Storage
  file_type text,
  tags text[] not null default '{}',
  version int not null default 1,
  status text not null default 'active' check (status in ('active','archived')),
  allowed_roles text[] not null default '{}',
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- Preparado para Fase 2 (búsqueda semántica). Requiere `create extension if not exists vector;`
-- No se activa uso funcional en el MVP — la tabla existe para no requerir migración disruptiva después.
create extension if not exists vector;

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  chunk_index int not null
);

create index documents_company_bu_idx on documents (company_id, business_unit_id);
