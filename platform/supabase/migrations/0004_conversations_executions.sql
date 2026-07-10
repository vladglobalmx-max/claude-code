-- GAIOS Platform — Migración 0004: conversaciones (agentes) y ejecuciones (herramientas) = historial

create table conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_id uuid not null references agents(id),
  user_id uuid not null references users(id),
  client_id uuid references clients(id),
  opportunity_id uuid references opportunities(id),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table tool_executions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  business_unit_id uuid references business_units(id),
  tool_id uuid not null references tools(id),
  prompt_id uuid not null references prompts(id),
  prompt_version int not null,
  user_id uuid not null references users(id),
  client_id uuid references clients(id),
  opportunity_id uuid references opportunities(id),
  input jsonb not null,
  output jsonb,
  status text not null default 'success' check (status in ('success','error')),
  error_message text,
  tokens_input int,
  tokens_output int,
  cost_estimate numeric(10,4),
  duration_ms int,
  created_at timestamptz not null default now()
);

create index tool_executions_company_created_idx on tool_executions (company_id, created_at desc);
create index conversations_company_agent_idx on conversations (company_id, agent_id);
