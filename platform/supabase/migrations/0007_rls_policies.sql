-- GAIOS Platform — Migración 0007: Row Level Security
-- Patrón único aplicado a toda tabla con company_id: un usuario solo ve/escribe filas de su propia empresa.
-- auth.uid() lo provee Supabase Auth; se resuelve contra users.company_id.

create or replace function fn_current_company_id()
returns uuid
language sql stable
as $$
  select company_id from users where id = auth.uid();
$$;

do $$
declare
  t text;
  tables text[] := array[
    'business_units','clients','contacts','opportunities','opportunity_stage_history',
    'followups','prompts','prompt_versions','agents','tools','conversations',
    'conversation_messages','tool_executions','documents','document_chunks','audit_log','users'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);

    -- SELECT: solo filas de la misma empresa que el usuario autenticado
    execute format($f$
      create policy "%1$s_select_own_company" on %1$I
      for select using (
        company_id = fn_current_company_id()
      );
    $f$, t);

    -- INSERT/UPDATE: exige que la fila pertenezca a la empresa del usuario
    execute format($f$
      create policy "%1$s_write_own_company" on %1$I
      for insert with check (company_id = fn_current_company_id());
    $f$, t);

    execute format($f$
      create policy "%1$s_update_own_company" on %1$I
      for update using (company_id = fn_current_company_id());
    $f$, t);
  end loop;
end $$;

-- Excepciones que requieren join (no tienen company_id propia, la heredan de su padre):
-- opportunity_stage_history y conversation_messages y document_chunks se filtran vía su tabla padre.
alter table opportunity_stage_history enable row level security;
create policy "osh_select_own_company" on opportunity_stage_history
  for select using (
    opportunity_id in (select id from opportunities where company_id = fn_current_company_id())
  );

alter table conversation_messages enable row level security;
create policy "cm_select_own_company" on conversation_messages
  for select using (
    conversation_id in (select id from conversations where company_id = fn_current_company_id())
  );

alter table document_chunks enable row level security;
create policy "dc_select_own_company" on document_chunks
  for select using (
    document_id in (select id from documents where company_id = fn_current_company_id())
  );

-- Nota: el rol "service_role" (usado exclusivamente en lib/supabase/admin.ts, server-only)
-- omite RLS por diseño de Supabase — se reserva para operaciones administrativas
-- (alta de empresa, alta de usuario, jobs de sistema) y nunca se expone al cliente.
