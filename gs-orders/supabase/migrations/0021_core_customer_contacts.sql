-- GS Orders — Migración 0021: THÖREN Customer Contacts + alta atómica
--
-- Agrega `customer_contacts` (contactos múltiples por Customer) y
-- `rpc_create_customer_with_contacts` (alta atómica Customer + contactos),
-- aprobados en 3 rondas de diseño previas (ver "THÖREN — CUSTOMER IMPORT +
-- CONTACTS" discovery/diseño). Aditiva únicamente: no toca `customers`
-- (0018), `quotes`/`quote_items` (0020), `orders`, ni ningún RLS existente
-- fuera de esta tabla nueva.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `customer_contacts`: id, customer_id (FK customers, on delete
--    cascade — un contacto no tiene sentido sin su Customer), name,
--    email/phone (nullable), is_primary, active, created_at, updated_at.
--    Sin organization_id (se resuelve indirectamente vía
--    customer_id → customers.organization_id, igual que quote_items no
--    repite organization_id de quotes), sin puesto/departamento/notes/
--    metadata/business_unit_id — ninguno tiene consumidor real hoy (ver
--    ronda 2 de diseño).
-- 2) Índice único parcial: como máximo un contacto principal ACTIVO por
--    Customer (`is_primary and active`) — un Customer puede tener 0 o
--    varios contactos inactivos marcados históricamente como principal
--    (ver DECISIÓN abajo), pero nunca dos vigentes a la vez.
-- 3) Trigger `trg_customer_contacts_enforce_primary`: (a) un contacto que
--    se desactiva pierde automáticamente la marca de principal — el índice
--    único solo debe comparar contactos vigentes; (b) marcar un contacto
--    como principal activo degrada automáticamente a cualquier otro
--    contacto del mismo Customer que hoy la tenga, dentro de la MISMA
--    transacción — así "cambiar de contacto principal" es un solo UPDATE
--    atómico desde la app, sin necesitar una RPC dedicada ni dos pasos que
--    pudieran quedar a medias.
-- 4) RLS: SELECT/INSERT/UPDATE resuelven la organización del Customer
--    padre en la misma policy (sin helper SECURITY DEFINER nuevo — se
--    reutilizan is_organization_admin()/is_organization_member() de
--    0013). ADMIN: acceso total a los contactos de Customers de su
--    organización. VENDEDOR: solo contactos de Customers ACTIVOS de su
--    organización (igual que ya no puede ver/operar sobre Customers
--    inactivos — 0018). Sin policy de DELETE: no hay borrado físico,
--    "active=false" es el mecanismo (mismo patrón que customers).
-- 5) `rpc_create_customer_with_contacts(p_customer jsonb, p_contacts jsonb
--    default '[]'::jsonb) returns customers`: Customer + todos sus
--    contactos como una sola unidad transaccional — si cualquier contacto
--    falla (constraint, RLS), toda la función revierte, incluido el
--    Customer recién insertado. SECURITY INVOKER (default): RLS sigue
--    aplicando exactamente igual que si la app hiciera los inserts por
--    separado. organization_id se resuelve exclusivamente server-side vía
--    current_user_organization_id() (0013) — nunca se confía en un
--    organization_id enviado por el cliente. Si ningún contacto del
--    array viene marcado is_primary=true, el primero se vuelve principal
--    automáticamente (regla aprobada: alta con 1 contacto siempre queda
--    principal; con varios, el primero es la sugerencia inicial que la UI
--    de preview puede cambiar antes de confirmar).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca `customers` (0018): mismas columnas, misma RLS, sin cambios.
-- - NO toca `quotes`/`quote_items`/ningún RPC de Quotes — el diálogo de
--   alta inline de Cliente desde Nueva Cotización llama a esta RPC nueva
--   cuando hay contacto, pero el schema/RPC de Quotes en sí no cambia.
-- - NO toca Orders, Inventory, Purchasing, Orders V2 — fuera de alcance
--   explícito de esta noche.
-- - NO agrega organization_id directamente a customer_contacts — se
--   resuelve siempre indirectamente vía customer_id, igual que
--   quote_items no repite organization_id de su quote padre.
-- - NO crea ninguna RPC para "agregar un contacto a un Customer ya
--   existente" — eso es un INSERT simple de una sola fila, ya atómico por
--   sí mismo; envolverlo en una RPC sería una capa sin trabajo real que
--   justifique su existencia (mismo criterio que ya evitó una
--   rpc_duplicate_quote dedicada).
-- - NO crea policy de DELETE — sin borrado físico, igual que customers.
--
-- =========================================================================
-- DECISIÓN — un contacto inactivo puede conservar is_primary=true en su
-- historial sin romper el índice único:
-- =========================================================================
-- El índice único parcial solo exige unicidad entre filas con
-- is_primary=true AND active=true simultáneamente. Desactivar el contacto
-- principal actual (sin el trigger, quedaría "principal pero inactivo")
-- libera inmediatamente la posibilidad de marcar otro contacto como
-- principal — por eso el trigger además limpia is_primary al desactivar:
-- un contacto inactivo nunca debe mostrarse como "el principal" en la UI.
--
-- Como el resto del proyecto: idempotente (create table if not exists, do
-- $$ if not exists $$ para policies/triggers, create or replace para
-- funciones) y corre completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) customer_contacts
-- =========================================================================
create table if not exists customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  name text not null
    constraint customer_contacts_name_not_blank check (btrim(name) <> ''),
  email text,
  phone text,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx on customer_contacts (customer_id);

create unique index if not exists customer_contacts_primary_unique
  on customer_contacts (customer_id)
  where is_primary and active;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_customer_contacts_updated_at') then
    create trigger trg_customer_contacts_updated_at
      before update on customer_contacts
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) trigger: un solo contacto principal ACTIVO por Customer, mantenido
--    automáticamente (ver DECISIÓN arriba).
-- =========================================================================
create or replace function trg_customer_contacts_enforce_primary()
returns trigger
language plpgsql
as $$
begin
  if not new.active then
    new.is_primary := false;
  end if;

  if new.is_primary and new.active then
    update customer_contacts
      set is_primary = false
      where customer_id = new.customer_id
        and id <> new.id
        and is_primary = true;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_customer_contacts_enforce_primary') then
    create trigger trg_customer_contacts_enforce_primary
      before insert or update on customer_contacts
      for each row execute function trg_customer_contacts_enforce_primary();
  end if;
end $$;

-- =========================================================================
-- 3) RLS — organización resuelta vía customer_id → customers.organization_id.
--    Sin helper SECURITY DEFINER nuevo: reutiliza is_organization_admin()/
--    is_organization_member() de 0013.
-- =========================================================================
alter table customer_contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_contacts'
      and policyname = 'customer_contacts_select_member'
  ) then
    create policy "customer_contacts_select_member" on customer_contacts
      for select using (
        exists (
          select 1 from customers c
          where c.id = customer_contacts.customer_id
            and (
              is_organization_admin(c.organization_id)
              or (is_organization_member(c.organization_id) and c.active)
            )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_contacts'
      and policyname = 'customer_contacts_insert_member'
  ) then
    create policy "customer_contacts_insert_member" on customer_contacts
      for insert with check (
        exists (
          select 1 from customers c
          where c.id = customer_contacts.customer_id
            and (
              is_organization_admin(c.organization_id)
              or (is_organization_member(c.organization_id) and c.active)
            )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customer_contacts'
      and policyname = 'customer_contacts_update_member'
  ) then
    create policy "customer_contacts_update_member" on customer_contacts
      for update using (
        exists (
          select 1 from customers c
          where c.id = customer_contacts.customer_id
            and (
              is_organization_admin(c.organization_id)
              or (is_organization_member(c.organization_id) and c.active)
            )
        )
      ) with check (
        exists (
          select 1 from customers c
          where c.id = customer_contacts.customer_id
            and (
              is_organization_admin(c.organization_id)
              or (is_organization_member(c.organization_id) and c.active)
            )
        )
      );
  end if;
end $$;

-- Sin policy de DELETE — sin borrado físico (ver ALCANCE arriba).

-- =========================================================================
-- 4) rpc_create_customer_with_contacts — Customer + contactos, unidad
--    transaccional. SECURITY INVOKER (default): RLS sigue aplicando.
-- =========================================================================
create or replace function rpc_create_customer_with_contacts(
  p_customer jsonb,
  p_contacts jsonb default '[]'::jsonb
)
returns customers
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer customers;
  v_organization_id uuid;
  v_contacts jsonb := coalesce(p_contacts, '[]'::jsonb);
  v_contact jsonb;
  v_is_primary boolean;
  v_has_primary boolean;
begin
  v_organization_id := current_user_organization_id();

  -- Si ningún contacto viene marcado como principal, el primero de la
  -- lista se vuelve principal por default (ver DECISIÓN de alcance
  -- arriba).
  select exists (
    select 1 from jsonb_array_elements(v_contacts) c
    where coalesce((c->>'is_primary')::boolean, false)
  ) into v_has_primary;

  if jsonb_array_length(v_contacts) > 0 and not v_has_primary then
    v_contacts := jsonb_set(v_contacts, '{0,is_primary}', 'true'::jsonb);
  end if;

  insert into customers (organization_id, name, legal_name, tax_id, email, phone)
  values (
    v_organization_id,
    p_customer->>'name',
    nullif(p_customer->>'legal_name', ''),
    nullif(p_customer->>'tax_id', ''),
    nullif(p_customer->>'email', ''),
    nullif(p_customer->>'phone', '')
  )
  returning * into v_customer;

  for v_contact in select * from jsonb_array_elements(v_contacts)
  loop
    v_is_primary := coalesce((v_contact->>'is_primary')::boolean, false);
    insert into customer_contacts (customer_id, name, email, phone, is_primary)
    values (
      v_customer.id,
      v_contact->>'name',
      nullif(v_contact->>'email', ''),
      nullif(v_contact->>'phone', ''),
      v_is_primary
    );
  end loop;

  return v_customer;
end;
$$;

commit;
