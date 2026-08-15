-- GS Orders — Migración 0013: THÖREN Core 1 — Organizations + Membership
--
-- Primera pieza de THÖREN Core: introduce el concepto de organización
-- (tenant) y la relación N:M usuario↔organización, SIN cambiar el
-- comportamiento visible ni el modelo de acceso actual de GS Orders.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `organizations` (tenant) y siembra una sola fila: Global Supplier
--    MTY (el nombre ya se usa consistentemente en toda la app — login,
--    set-password, PDF, README, MVP_SPEC.md — se preserva tal cual).
-- 2) Crea `organization_members`, la tabla de membership N:M entre
--    auth.users y organizations, con `role` (admin/vendedor, mismo dominio
--    que user_profiles.role hoy).
-- 3) Helpers SECURITY DEFINER: is_organization_member(), is_organization_admin(),
--    current_user_organization_id() — mismo patrón que current_user_is_admin()
--    de 0011 (evitar RLS recursiva).
-- 4) RLS propia y autocontenida para las dos tablas nuevas — incluye la
--    corrección de la revisión de seguridad: un usuario desactivado no
--    puede leer ni su propia membership (antes solo se bloqueaba
--    organizations/orders, no organization_members mismo). organizations
--    queda SOLO de lectura (sin policy de insert/update/delete): least
--    privilege, sin superficie de escritura que nadie usa todavía.
-- 5) admin_update_user_role_and_active(): RPC atómica para el flujo de
--    EDICIÓN — sincroniza role/active entre user_profiles y
--    organization_members en una sola transacción (o ambas o ninguna).
-- 6) Bootstrap: siembra Global Supplier MTY y da de alta una membership para
--    CADA fila ya existente en user_profiles (mismo user_id/role/active),
--    para que ningún usuario actual quede sin organización.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO toca user_profiles (ni su esquema ni sus datos): sigue siendo la
--   fuente de verdad de rol/activo/vendedor que ya usan middleware, RLS de
--   orders/salespeople y admin_list_user_profiles(). organization_members
--   se introduce EN PARALELO, no en reemplazo.
-- - NO agrega organization_id a orders/order_items/salespeople/product_catalog/
--   product_types ni a ninguna tabla transaccional. El aislamiento
--   funcional actual (ADMIN ve todo, VENDEDOR ve lo propio) sigue
--   dependiendo exclusivamente de current_user_is_admin()/
--   current_user_salesperson_id(), sin cambios.
-- - NO toca salespeople, fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change ni ningún folio/sequence_current existente.
-- - NO toca business_unit (ni el enum, ni sus valores, ni su uso). Sigue
--   siendo una columna sin relación con organization — ver Architecture
--   Blueprint: son conceptos distintos, no deben confundirse.
-- - NO agrega roles/permissions/role_permissions/user_roles (RBAC
--   granular). organization_members.role reutiliza el mismo dominio
--   ('admin'/'vendedor') que user_profiles.role.
-- - NO agrega selector de organización en la UI ni pantallas de
--   organizations/membership. Fundación, no feature visible.
--
-- =========================================================================
-- DECISIÓN — user_profiles sigue siendo la fuente de verdad de `role` en
-- esta fase (Estrategia A del análisis, no B ni triggers bidireccionales):
-- =========================================================================
-- Toda la RLS existente (orders, salespeople, order_items, storage, etc.) y
-- el middleware ya leen exclusivamente user_profiles.role/active. Cambiar
-- esa fuente de verdad en CORE 1 sería el tipo de regresión que esta fase
-- explícitamente busca evitar. organization_members.role/active se
-- mantiene como espejo compatible: en el alta (invite/generateLink) se
-- inserta junto con user_profiles desde el mismo código de aplicación
-- (lib/user-access.ts); en la edición (cambiar role/active de un usuario
-- ya existente) se sincroniza de forma ATÓMICA vía
-- admin_update_user_role_and_active() (ver más abajo), para que nunca
-- quede una tabla actualizada y la otra no. organization_members.role NO
-- es consultado por ninguna policy de orders/salespeople/etc. en esta
-- fase — sí es consultado por la RLS PROPIA de organizations/
-- organization_members (is_organization_admin/is_organization_member),
-- porque esa es información que user_profiles no tiene (no sabe de
-- organizaciones) y es exactamente el tipo de aislamiento que esta fase
-- debe demostrar que funciona (ver pruebas multi-tenant A/B).
--
-- =========================================================================
-- DECISIÓN — current_user_organization_id() falla explícito, no adivina:
-- =========================================================================
-- Un usuario futuro con más de una membership activa NO puede resolverse
-- de forma segura con un LIMIT 1 arbitrario. La función devuelve NULL si
-- no hay membership, la organización si hay exactamente una, y lanza una
-- excepción explícita si hay más de una — nunca elige en silencio. Hoy
-- (una sola organización real) nunca dispara esa rama; queda como
-- guardarraíl para cuando exista membership múltiple real.
--
-- Como el resto del proyecto: crea/reemplaza todo de forma idempotente
-- (create table if not exists, do $$ if not exists $$ para policies/
-- triggers, on conflict do nothing en el bootstrap) y corre completa en
-- una sola transacción (begin/commit) — aprendido de 0011: si el bootstrap
-- falla, TODA la migración se revierte, nunca queda organizations sin su
-- membership correspondiente.

begin;

-- =========================================================================
-- 1) organizations
-- =========================================================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_unique on organizations (slug);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organizations_updated_at') then
    create trigger trg_organizations_updated_at
      before update on organizations
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) organization_members — membership N:M entre auth.users y organizations.
--    user_id referencia auth.users con ON DELETE CASCADE (igual que
--    user_profiles.user_id en 0011): si se elimina un usuario de Auth como
--    parte de una compensación de alta fallida, su membership se limpia
--    automáticamente sin necesidad de un delete explícito aparte.
-- =========================================================================
create table if not exists organization_members (
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'vendedor',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_pk primary key (organization_id, user_id),
  constraint organization_members_role_check check (role in ('admin', 'vendedor'))
);

create index if not exists organization_members_user_idx on organization_members (user_id);
create index if not exists organization_members_org_idx on organization_members (organization_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organization_members_updated_at') then
    create trigger trg_organization_members_updated_at
      before update on organization_members
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 3) Helper functions — SECURITY DEFINER, search_path fijo, mismo patrón
--    que current_user_is_admin() (0011) para evitar RLS recursiva.
-- =========================================================================
create or replace function is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

-- Ver nota de diseño arriba: NULL sin membership, el id si hay exactamente
-- una activa, excepción explícita si hay más de una — nunca adivina.
-- Nota técnica: se usa array_agg() en vez de min(organization_id) — uuid no
-- tiene una función agregada min()/max() nativa en Postgres.
create or replace function current_user_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org_ids uuid[];
begin
  select array_agg(organization_id)
    into v_org_ids
  from organization_members
  where user_id = auth.uid() and active = true;

  if v_org_ids is null or array_length(v_org_ids, 1) = 0 then
    return null;
  elsif array_length(v_org_ids, 1) > 1 then
    raise exception 'current_user_organization_id(): el usuario pertenece a más de una organización activa; se requiere selector explícito de organización (no implementado en CORE 1).';
  end if;

  return v_org_ids[1];
end;
$$;

-- =========================================================================
-- 4) RLS de organizations / organization_members — autocontenida, no
--    depende de current_user_is_admin() (que es global y no sabe de
--    organizaciones): así el aislamiento entre tenants se sostiene por sí
--    mismo incluso si en el futuro existiera más de una organización real.
--
--    organizations: SOLO lectura desde authenticated en CORE 1 (least
--    privilege). No existe policy de insert/update/delete a propósito — no
--    hay UI ni flujo real que las necesite todavía, y un FOR ALL abriría
--    una superficie de escritura (incluido DELETE, que arrastraría en
--    cascada todas las memberships de esa organización) sin ningún
--    consumidor real. La única fila de esta fase (Global Supplier MTY) la
--    crea exclusivamente el bootstrap de abajo, que corre como dueño de la
--    tabla y por lo tanto no depende de ninguna policy. Cuando exista
--    administración real de organizations, se diseñarán las acciones
--    server-side y las policies de escritura correspondientes en esa fase.
-- =========================================================================
alter table organizations enable row level security;
alter table organization_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations'
      and policyname = 'organizations_select_member'
  ) then
    create policy "organizations_select_member" on organizations
      for select using (is_organization_member(id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_members'
      and policyname = 'organization_members_select_own_or_org_admin'
  ) then
    -- "own row" exige active = true: un usuario desactivado no debe poder
    -- leer ni siquiera su propia membership (hallazgo de la revisión de
    -- seguridad de CORE 1 — con la condición anterior, un usuario
    -- desactivado sí veía su propia fila, aunque nunca la de otros).
    create policy "organization_members_select_own_or_org_admin" on organization_members
      for select using (
        (user_id = auth.uid() and active = true) or is_organization_admin(organization_id)
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'organization_members'
      and policyname = 'organization_members_admin_write'
  ) then
    -- Único camino de escritura: el admin de ESA organización. Un usuario
    -- sin membership admin no tiene ninguna policy de insert/update/delete,
    -- así que no puede auto-asignarse admin ni crear memberships arbitrarias
    -- bajo ninguna circunstancia (mismo principio que user_profiles_admin_write
    -- en 0011).
    create policy "organization_members_admin_write" on organization_members
      for all using (is_organization_admin(organization_id)) with check (is_organization_admin(organization_id));
  end if;
end $$;

-- =========================================================================
-- 5) admin_update_user_role_and_active — actualización ATÓMICA de
--    role/active en user_profiles Y organization_members, para el flujo de
--    EDICIÓN de un usuario ya existente (updateUserAccess en
--    configuracion/usuarios/actions.ts). O se actualizan ambas filas o
--    ninguna — una sola llamada de función es una sola transacción
--    implícita en Postgres.
--
--    SECURITY INVOKER a propósito (no DEFINER): no duplica autorización
--    propia, se apoya en las policies *_admin_write ya existentes de
--    ambas tablas. Si quien llama no es admin (global para user_profiles,
--    de la organización para organization_members), esos UPDATE afectan 0
--    filas bajo RLS — la función lo detecta con GET DIAGNOSTICS y aborta
--    con una excepción explícita en vez de devolver éxito silencioso.
--
--    No recibe organization_id como parámetro: siempre se resuelve
--    server-side vía current_user_organization_id(), nunca se confía en
--    lo que mandara el navegador. "Más de una fila afectada" es
--    estructuralmente imposible (organization_members_pk y la PK de
--    user_profiles garantizan como máximo una fila por user_id), así que
--    no hace falta comprobarlo en runtime — la única ambigüedad real
--    posible es "0 filas" (sin permiso o sin membership en tu
--    organización), que sí se comprueba y rechaza explícitamente.
-- =========================================================================
create or replace function admin_update_user_role_and_active(
  p_user_id uuid,
  p_role text,
  p_active boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_membership_rows integer;
  v_profile_rows integer;
begin
  if p_role not in ('admin', 'vendedor') then
    raise exception 'admin_update_user_role_and_active: role inválido: %', p_role;
  end if;

  v_organization_id := current_user_organization_id();

  if v_organization_id is null then
    raise exception 'admin_update_user_role_and_active: tu usuario no tiene una organización activa.';
  end if;

  update organization_members
     set role = p_role, active = p_active
   where organization_id = v_organization_id
     and user_id = p_user_id;

  get diagnostics v_membership_rows = row_count;

  if v_membership_rows = 0 then
    raise exception 'admin_update_user_role_and_active: no se encontró una membership de % en tu organización, o no tienes permiso para modificarla.', p_user_id;
  end if;

  update user_profiles
     set role = p_role, active = p_active
   where user_id = p_user_id;

  get diagnostics v_profile_rows = row_count;

  if v_profile_rows = 0 then
    raise exception 'admin_update_user_role_and_active: no se encontró el perfil de % o no tienes permiso para modificarlo.', p_user_id;
  end if;
end;
$$;

-- =========================================================================
-- 6) Bootstrap: Global Supplier MTY + membership para cada user_profiles
--    existente. Idempotente (on conflict do nothing en ambos inserts) y
--    verificable (raise notice con el conteo). Si algo falla aquí, todo el
--    begin/commit de esta migración se revierte — nunca queda
--    organizations sin su membership correspondiente.
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_members_before integer;
  v_members_after integer;
begin
  insert into organizations (name, slug)
  values ('Global Supplier MTY', 'global-supplier-mty')
  on conflict (slug) do nothing;

  select id into v_org_id from organizations where slug = 'global-supplier-mty';

  if v_org_id is null then
    raise exception 'CORE 1: no se pudo crear ni encontrar la organización global-supplier-mty. Bootstrap abortado.';
  end if;

  select count(*) into v_members_before from organization_members where organization_id = v_org_id;

  insert into organization_members (organization_id, user_id, role, active)
  select v_org_id, up.user_id, up.role, up.active
  from user_profiles up
  on conflict (organization_id, user_id) do nothing;

  select count(*) into v_members_after from organization_members where organization_id = v_org_id;

  raise notice 'CORE 1 bootstrap: organization_id=%, memberships antes=%, memberships después=%',
    v_org_id, v_members_before, v_members_after;
end $$;

commit;
