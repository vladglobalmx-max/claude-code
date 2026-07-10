-- GAIOS Platform — Migración 0006: auditoría

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references users(id),
  action text not null,             -- login | create_user | edit_prompt | change_stage | run_tool | ...
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index audit_log_company_created_idx on audit_log (company_id, created_at desc);
