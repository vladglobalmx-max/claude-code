-- THÖREN — Multiempresa real: datos de organización editables + módulos
-- habilitados por organización (0084).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- Ticket: crear una segunda organización independiente (empresa de la
-- esposa del usuario), sin mezclar datos con Global Supplier MTY, y poder
-- decidir qué módulos de la barra lateral están habilitados por
-- organización. Auditoría previa confirmó: `organizations`/
-- `organization_members`/RLS (0013) ya dan aislamiento multi-tenant real
-- y completo — NO se duplica ninguna tabla por empresa, se reutiliza tal
-- cual. `rpc_provision_organization()` (0052) ya resuelve "crear
-- organización + admin" de forma segura (SECURITY DEFINER, EXECUTE
-- revocado de public/authenticated/anon, otorgado solo a service_role) —
-- se extiende aquí, no se reinventa.
--
-- =========================================================================
-- DECISIÓN — organizations: NUEVAS columnas, SIN policy de UPDATE directa
-- =========================================================================
-- `trade_name`/`tax_id`/`currency` se agregan a `organizations` (0013 la
-- dejó de solo lectura a propósito — "sin superficie de escritura que
-- nadie usa todavía"). NO se agrega una policy de UPDATE genérica: eso
-- permitiría a un admin escribir CUALQUIER columna de su fila, incluidas
-- `active`/`slug`, que el ticket exige mantener reservadas a
-- plataforma/service_role. En su lugar, `rpc_update_organization_settings()`
-- (sección 3) es la ÚNICA vía de escritura — resuelve la organización
-- internamente vía `current_user_organization_id()` (nunca acepta
-- organization_id del cliente) y solo puede tocar
-- trade_name/tax_id/currency/timezone. `organizations` sigue sin ninguna
-- policy de INSERT/UPDATE/DELETE — exactamente como 0013 la dejó.
--
-- =========================================================================
-- DECISIÓN — organization_modules: tabla sparse, default-on, sin policy de
-- escritura directa (mismo criterio que arriba)
-- =========================================================================
-- Ausencia de fila = módulo habilitado (default-on) — así Global Supplier
-- MTY no necesita ninguna fila nueva para seguir funcionando exactamente
-- igual que hoy. Solo se inserta una fila cuando un módulo se DESHABILITA
-- explícitamente. `module_key` tiene un CHECK con la lista cerrada de
-- módulos TOGGLEABLES (ver auditoría, punto 3 del ticket aprobado) —
-- inicio/configuracion/unidades_negocio/personas/vendedores son
-- infraestructura administrativa y NUNCA pueden tener fila aquí, ni
-- siquiera por error de la RPC (el CHECK de la tabla es la última línea
-- de defensa, además de la validación explícita dentro de
-- `rpc_set_organization_module()`).
-- RLS: SOLO política de SELECT (`is_organization_member`) — cualquier
-- miembro activo necesita leer esto para armar su propio menú/pasar el
-- guard de middleware. Sin policy de INSERT/UPDATE/DELETE: la única
-- escritura posible es `rpc_set_organization_module()` (SECURITY DEFINER),
-- que exige `current_user_is_admin()` explícitamente — RLS jamás delega
-- esa autoridad a nadie más.
--
-- =========================================================================
-- DECISIÓN — reactivar un módulo BORRA la fila, no la deja en enabled=true
-- =========================================================================
-- Mantiene la tabla verdaderamente sparse (nunca acumula filas "enabled=
-- true" inertes) — reactivar vuelve exactamente al estado default-on
-- original, mismo comportamiento observable, menos filas que auditar con
-- el tiempo.
--
-- =========================================================================
-- DECISIÓN — rpc_provision_organization: reemplazo forward-only
-- =========================================================================
-- 0052 NUNCA se edita. Esta migración hace DROP de la firma vieja de 7
-- parámetros y CREATE de una nueva de 11 (agrega
-- trade_name/tax_id/currency/timezone) — un solo camino canónico hacia
-- adelante, sin dos firmas ambiguas coexistiendo. El cuerpo reutiliza
-- exactamente la misma lógica de 0052 (organización + user_profiles +
-- organization_members + Business Unit + Person, todo en una transacción,
-- SECURITY DEFINER, EXECUTE revocado de public/authenticated/anon y
-- otorgado solo a service_role) — el único cambio real es qué columnas
-- recibe `organizations` al crearse. NO se crea ningún concepto de
-- superadmin dentro de la aplicación: la única autoridad para crear una
-- organización sigue siendo tener la service_role key, exactamente como
-- hoy — un admin normal (incluso de Global Supplier) no tiene, ni tendrá,
-- ninguna vía para invocar esto.
--
-- Como el resto del proyecto: idempotente donde aplica (`add column if
-- not exists`, `create table if not exists`, `drop policy/function if
-- exists` antes de recrear) y corre completa en una transacción
-- (begin/commit).

begin;

-- =========================================================================
-- 1) organizations — columnas nuevas, editables únicamente vía
--    rpc_update_organization_settings() (sección 3).
-- =========================================================================
alter table organizations
  add column if not exists trade_name text,
  add column if not exists tax_id text,
  add column if not exists currency text not null default 'MXN'
    constraint organizations_currency_check check (currency in ('MXN', 'USD'));

-- =========================================================================
-- 2) organization_modules — sparse, default-on. Lista cerrada de módulos
--    TOGGLEABLES (ver DECISIÓN de cabecera) — inicio/configuracion/
--    unidades_negocio/personas/vendedores JAMÁS pueden aparecer aquí.
-- =========================================================================
create table if not exists organization_modules (
  organization_id uuid not null references organizations (id) on delete cascade,
  module_key text not null
    constraint organization_modules_module_key_check check (module_key in (
      'clientes', 'cotizaciones', 'ordenes_venta', 'ordenes_trabajo', 'entregas',
      'requisiciones', 'compras', 'recepciones', 'proveedores', 'inventario',
      'almacenes', 'surtidos', 'facturas', 'comisiones'
    )),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_modules_pk primary key (organization_id, module_key)
);

create index if not exists organization_modules_organization_idx on organization_modules (organization_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organization_modules_updated_at') then
    create trigger trg_organization_modules_updated_at
      before update on organization_modules
      for each row execute function set_updated_at();
  end if;
end $$;

alter table organization_modules enable row level security;

drop policy if exists "organization_modules_select_member" on organization_modules;
create policy "organization_modules_select_member" on organization_modules
  for select using (is_organization_member(organization_id));

-- =========================================================================
-- 3) rpc_update_organization_settings — única vía de escritura de
--    organizations. Resuelve organización/autoridad internamente, nunca
--    acepta organization_id del cliente. Solo admin (current_user_is_admin(),
--    0011) — nunca can_manage_users ni ninguna otra capability. NO puede
--    tocar active/slug/name — ni siquiera están en la lista de parámetros.
-- =========================================================================
create or replace function rpc_update_organization_settings(
  p_trade_name text,
  p_tax_id text,
  p_currency text,
  p_timezone text
)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_org organizations;
begin
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede editar la configuración de la organización.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'No se pudo resolver tu organización.';
  end if;

  if p_currency is null or p_currency not in ('MXN', 'USD') then
    raise exception 'Moneda inválida: debe ser MXN o USD.';
  end if;
  if p_timezone is null or btrim(p_timezone) = '' then
    raise exception 'La zona horaria es obligatoria.';
  end if;

  update organizations
  set trade_name = nullif(btrim(coalesce(p_trade_name, '')), ''),
      tax_id = nullif(btrim(coalesce(p_tax_id, '')), ''),
      currency = p_currency,
      timezone = btrim(p_timezone)
  where id = v_organization_id
  returning * into v_org;

  return v_org;
end;
$$;

-- =========================================================================
-- 4) rpc_set_organization_module — única vía de escritura de
--    organization_modules. Deshabilitar upsertea enabled=false; habilitar
--    BORRA la fila (ver DECISIÓN de cabecera — vuelve al default-on
--    sparse). Rechaza explícitamente cualquier module_key fuera de la
--    lista toggleable, como defensa en profundidad además del CHECK de la
--    tabla.
-- =========================================================================
create or replace function rpc_set_organization_module(
  p_module_key text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() then
    raise exception 'Solo un administrador puede configurar los módulos habilitados de la organización.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'No se pudo resolver tu organización.';
  end if;

  if p_module_key not in (
    'clientes', 'cotizaciones', 'ordenes_venta', 'ordenes_trabajo', 'entregas',
    'requisiciones', 'compras', 'recepciones', 'proveedores', 'inventario',
    'almacenes', 'surtidos', 'facturas', 'comisiones'
  ) then
    raise exception 'El módulo "%" no se puede deshabilitar — es infraestructura administrativa siempre disponible.', p_module_key;
  end if;

  if p_enabled then
    delete from organization_modules
    where organization_id = v_organization_id and module_key = p_module_key;
  else
    insert into organization_modules (organization_id, module_key, enabled)
    values (v_organization_id, p_module_key, false)
    on conflict (organization_id, module_key) do update set enabled = false;
  end if;
end;
$$;

-- =========================================================================
-- 5) rpc_provision_organization — reemplazo forward-only de 0052 (ver
--    DECISIÓN de cabecera). Misma autoridad exacta: SECURITY DEFINER,
--    EXECUTE revocado de public/authenticated/anon, otorgado solo a
--    service_role. Mismo cuerpo que 0052 carácter por carácter salvo las
--    columnas nuevas de organizations.
-- =========================================================================
drop function if exists rpc_provision_organization(text, text, uuid, text, text, text, text);

create or replace function rpc_provision_organization(
  p_organization_name text,
  p_organization_slug text,
  p_trade_name text,
  p_tax_id text,
  p_currency text,
  p_timezone text,
  p_admin_user_id uuid,
  p_admin_name text,
  p_admin_email text,
  p_business_unit_name text,
  p_business_unit_code text
)
returns table (organization_id uuid, business_unit_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_bu_id uuid;
begin
  insert into organizations (name, slug, trade_name, tax_id, currency, timezone)
  values (
    p_organization_name,
    p_organization_slug,
    nullif(btrim(coalesce(p_trade_name, '')), ''),
    nullif(btrim(coalesce(p_tax_id, '')), ''),
    coalesce(p_currency, 'MXN'),
    coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'America/Monterrey')
  )
  returning id into v_org_id;

  -- INSERT simple (sin on conflict): si p_admin_user_id ya tiene un perfil,
  -- esto falla con unique_violation y Postgres revierte TODA la función
  -- (incluida la organización recién creada) — nunca queda un tenant a
  -- medias ni un admin reasignado por accidente.
  insert into user_profiles (user_id, name, role, active)
  values (p_admin_user_id, p_admin_name, 'admin', true);

  insert into organization_members (organization_id, user_id, role, active)
  values (v_org_id, p_admin_user_id, 'admin', true);

  insert into business_units (organization_id, name, code)
  values (v_org_id, p_business_unit_name, p_business_unit_code)
  returning id into v_bu_id;

  perform rpc_create_person_for_user(p_admin_user_id, v_org_id, p_admin_name, p_admin_email, true);

  return query select v_org_id, v_bu_id;
end;
$$;

revoke all on function rpc_provision_organization(text, text, text, text, text, text, uuid, text, text, text, text) from public;
revoke all on function rpc_provision_organization(text, text, text, text, text, text, uuid, text, text, text, text) from authenticated;
revoke all on function rpc_provision_organization(text, text, text, text, text, text, uuid, text, text, text, text) from anon;
grant execute on function rpc_provision_organization(text, text, text, text, text, text, uuid, text, text, text, text) to service_role;

commit;
