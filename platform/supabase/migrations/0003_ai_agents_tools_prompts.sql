-- GAIOS Platform — Migración 0003: prompts (con versionado), agentes, herramientas

create table prompts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid references business_units(id),
  name text not null,
  code text not null,
  objective text,
  system_prompt text not null,           -- nunca se expone al cliente
  user_prompt_template text not null,    -- placeholders {{variable}}
  variables jsonb not null default '[]',
  output_schema jsonb not null,
  model text not null default 'claude-sonnet-5',
  temperature numeric(3,2) not null default 0.40,
  version int not null default 1,
  status text not null default 'active' check (status in ('active','inactive','draft')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code, version)
);

create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts(id) on delete cascade,
  version int not null,
  system_prompt text not null,
  user_prompt_template text not null,
  variables jsonb not null,
  output_schema jsonb not null,
  model text not null,
  temperature numeric(3,2) not null,
  change_note text,
  changed_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid references business_units(id),
  name text not null,
  slug text not null,
  description text,
  icon text,
  objective text,
  system_prompt_id uuid not null references prompts(id),
  model text not null default 'claude-sonnet-5',
  temperature numeric(3,2) not null default 0.50,
  tool_ids uuid[] not null default '{}',
  allowed_roles text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (company_id, slug)
);

create table tools (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid references business_units(id),
  name text not null,
  slug text not null,
  description text,
  category text,
  agent_id uuid references agents(id),
  input_schema jsonb not null,
  output_schema jsonb not null,
  prompt_id uuid not null references prompts(id),
  allowed_roles text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive')),
  version int not null default 1,
  unique (company_id, slug)
);

-- Trigger: impide sobrescribir un prompt sin antes conservar la versión anterior en prompt_versions.
create or replace function fn_snapshot_prompt_version()
returns trigger as $$
begin
  if (old.system_prompt is distinct from new.system_prompt)
     or (old.user_prompt_template is distinct from new.user_prompt_template)
     or (old.output_schema is distinct from new.output_schema) then
    insert into prompt_versions (
      prompt_id, version, system_prompt, user_prompt_template,
      variables, output_schema, model, temperature, changed_by
    ) values (
      old.id, old.version, old.system_prompt, old.user_prompt_template,
      old.variables, old.output_schema, old.model, old.temperature, new.created_by
    );
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_snapshot_prompt_version
  before update on prompts
  for each row execute function fn_snapshot_prompt_version();
