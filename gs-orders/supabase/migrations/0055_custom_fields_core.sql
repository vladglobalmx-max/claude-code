-- =========================================================================
-- THÖREN — Fase 8B: Tenant/Business Unit Customization Core
-- =========================================================================
-- OBJETIVO: separar THÖREN CORE (estructural, igual para cualquier
-- organización) de campos verticales específicos de una Organization o de
-- una Business Unit puntual (ej. los campos de proyector/GOBO que hoy solo
-- tienen sentido para Thunder LED Lights, o los que Juno/GFB/un tenant
-- nuevo necesiten). Motor mínimo, sin form-builder visual, sin fórmulas,
-- sin conditional logic — solo definición + valor tipado, scoped a
-- organización y opcionalmente a una Business Unit.
--
-- entity_type inicial: 'product', 'quote_item', 'order_item' — ninguna
-- otra entidad todavía (0056/futuras fases pueden ampliar).
--
-- =========================================================================
-- DECISIÓN — business_unit_id nullable, NO un booleano "es organization-wide"
-- =========================================================================
-- NULL = campo visible a nivel de toda la organización, en todas sus BU.
-- Un uuid real = exclusivo de ESA Business Unit. Nunca se infiere ni se
-- hardcodea ningún nombre de organización/BU en la lógica de render — eso
-- vive enteramente en los datos (qué filas existen), nunca en código.
--
-- =========================================================================
-- DECISIÓN — custom_field_values con columnas tipadas, no un jsonb único
-- =========================================================================
-- value_text/value_number/value_boolean/value_date, una por field_type —
-- permite filtrar/exportar/validar tipos sin parsear JSON. value_json
-- queda reservada para un futuro tipo compuesto, NO se usa todavía por
-- ninguno de los 6 field_types soportados hoy.
--
-- =========================================================================
-- DECISIÓN — autoridad de custom_field_values: "según la entidad padre"
-- =========================================================================
-- No se inventa un nuevo modelo de permisos: current_user_can_write_
-- custom_field_value() resuelve, por entity_type, la MISMA autoridad que
-- ya protege la entidad padre (order_item -> su order, quote_item -> su
-- quote, product -> product_catalog, todas ya con is_organization_admin/
-- is_organization_member + ownership de salesperson donde aplica). Es
-- SECURITY DEFINER porque necesita atravesar el join hasta el padre bajo
-- la sesión de un VENDEDOR (mismo criterio ya usado en
-- current_user_can_view_order_storage, 0051).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración
-- =========================================================================
-- No toca order_items/quote_items/product_catalog (columnas existentes
-- intactas). No borra ni migra datos legacy — eso es 0056 (solo relaja el
-- CHECK/DEFAULT de business_unit, nunca DROP COLUMN). No crea UI — vive en
-- código de aplicación (Server Actions + CustomFieldsRenderer).

begin;

create table custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  business_unit_id uuid references business_units (id) on delete cascade,
  entity_type text not null check (entity_type in ('product', 'quote_item', 'order_item')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,49}$'),
  label text not null check (char_length(label) between 1 and 200),
  field_type text not null check (field_type in ('text', 'textarea', 'number', 'select', 'checkbox', 'date')),
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  placeholder text,
  help_text text,
  -- Solo relevante para field_type='select' — validado también en el
  -- Server Action (nunca confiar solo en el CHECK): debe ser un array de
  -- strings no vacío cuando field_type='select'.
  options jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, business_unit_id, entity_type, key)
);

create index custom_field_definitions_org_idx on custom_field_definitions (organization_id);
create index custom_field_definitions_lookup_idx
  on custom_field_definitions (organization_id, entity_type, business_unit_id) where active = true;

-- business_unit_id, si viene, debe pertenecer a la MISMA organización —
-- nunca una BU de otra organización coleccionando un campo "propio".
create or replace function trg_check_custom_field_definition_bu_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_bu_org uuid;
begin
  if new.business_unit_id is not null then
    select organization_id into v_bu_org from business_units where id = new.business_unit_id;
    if v_bu_org is distinct from new.organization_id then
      raise exception
        'custom_field_definitions: la Business Unit % pertenece a otra organización (%), no a %.',
        new.business_unit_id, v_bu_org, new.organization_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_custom_field_definitions_bu_org
  before insert or update of organization_id, business_unit_id on custom_field_definitions
  for each row execute function trg_check_custom_field_definition_bu_org();

create trigger trg_custom_field_definitions_updated_at
  before update on custom_field_definitions
  for each row execute function set_updated_at();

alter table custom_field_definitions enable row level security;

-- Mismo patrón que product_types (0051): admin ve todo (activo+inactivo)
-- de su organización; cualquier miembro activo ve solo las definiciones
-- ACTIVAS — necesita leerlas para poder operar (llenar el formulario),
-- nunca para administrarlas.
create policy "custom_field_definitions_select" on custom_field_definitions
  for select using (
    is_organization_admin(organization_id)
    or (is_organization_member(organization_id) and active = true)
  );

create policy "custom_field_definitions_admin_write" on custom_field_definitions
  for all using (is_organization_admin(organization_id)) with check (is_organization_admin(organization_id));

-- =========================================================================
-- custom_field_values
-- =========================================================================
create table custom_field_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  definition_id uuid not null references custom_field_definitions (id) on delete cascade,
  entity_type text not null check (entity_type in ('product', 'quote_item', 'order_item')),
  entity_id uuid not null,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, entity_id)
);

create index custom_field_values_entity_idx on custom_field_values (entity_type, entity_id);
create index custom_field_values_org_idx on custom_field_values (organization_id);

create trigger trg_custom_field_values_updated_at
  before update on custom_field_values
  for each row execute function set_updated_at();

-- Resuelve la organización REAL de la entidad padre (order_item -> su
-- order, quote_item -> su quote, product -> product_catalog) — SECURITY
-- DEFINER porque necesita atravesar el join bajo sesión de VENDEDOR (que
-- no siempre tiene SELECT directo sobre la tabla padre completa, solo vía
-- su propia RLS ya existente).
create or replace function current_user_organization_for_custom_field_entity(p_entity_type text, p_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case p_entity_type
    when 'order_item' then (
      select o.organization_id from order_items oi join orders o on o.id = oi.order_id where oi.id = p_entity_id
    )
    when 'quote_item' then (
      select q.organization_id from quote_items qi join quotes q on q.id = qi.quote_id where qi.id = p_entity_id
    )
    when 'product' then (select pc.organization_id from product_catalog pc where pc.id = p_entity_id)
    else null
  end;
$$;

-- Autoridad real (lectura Y escritura, mismo criterio): reutiliza
-- EXACTAMENTE la misma condición que ya protege la entidad padre —
-- is_organization_admin siempre puede, el dueño (vendedor) de su propio
-- order/quote también, product_catalog es admin-only (0019/0030).
create or replace function current_user_can_write_custom_field_value(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_entity_type
    when 'order_item' then exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.id = p_entity_id
        and is_organization_member(o.organization_id)
        and (is_organization_admin(o.organization_id) or o.salesperson_id = current_user_salesperson_id())
    )
    when 'quote_item' then exists (
      select 1 from quote_items qi join quotes q on q.id = qi.quote_id
      where qi.id = p_entity_id
        and is_organization_member(q.organization_id)
        and (is_organization_admin(q.organization_id) or q.salesperson_id = current_user_salesperson_id())
    )
    when 'product' then exists (
      select 1 from product_catalog pc where pc.id = p_entity_id and is_organization_admin(pc.organization_id)
    )
    else false
  end;
$$;

alter table custom_field_values enable row level security;

create policy "custom_field_values_select" on custom_field_values
  for select using (current_user_can_write_custom_field_value(entity_type, entity_id));

create policy "custom_field_values_write" on custom_field_values
  for all using (current_user_can_write_custom_field_value(entity_type, entity_id))
  with check (
    current_user_can_write_custom_field_value(entity_type, entity_id)
    and organization_id = current_user_organization_for_custom_field_entity(entity_type, entity_id)
  );

-- definition_id debe pertenecer a la MISMA organización/entity_type que el
-- valor que se está guardando — nunca un valor de Org A usando una
-- definición de Org B (ni un product usando una definición de quote_item).
create or replace function trg_check_custom_field_value_definition_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_def_org uuid;
  v_def_entity_type text;
begin
  select organization_id, entity_type into v_def_org, v_def_entity_type
  from custom_field_definitions where id = new.definition_id;

  if v_def_org is distinct from new.organization_id then
    raise exception
      'custom_field_values: la definición % pertenece a otra organización (%), no a %.',
      new.definition_id, v_def_org, new.organization_id;
  end if;

  if v_def_entity_type is distinct from new.entity_type then
    raise exception
      'custom_field_values: la definición % es de entity_type %, no de %.',
      new.definition_id, v_def_entity_type, new.entity_type;
  end if;

  return new;
end;
$$;

create trigger trg_custom_field_values_definition_match
  before insert or update of definition_id, organization_id, entity_type on custom_field_values
  for each row execute function trg_check_custom_field_value_definition_match();

commit;
