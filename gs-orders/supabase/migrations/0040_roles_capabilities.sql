-- =========================================================================
-- THÖREN — Fase 6R.1A: Infraestructura de Roles + Capacidades
-- =========================================================================
-- OBJETIVO: crear la infraestructura base de "rol + capacidades
-- combinables" propuesta en la auditoría 6R.1, 100% ADITIVA. Esta
-- migración NO cambia el comportamiento efectivo de ningún permiso
-- existente: ningún RLS/RPC de Orders/Quotes/Purchase Orders/Inventory/
-- Reservations/Fulfillment/Deliveries/Customers/Suppliers se toca. Vladimir
-- conserva exactamente el mismo acceso (bypass total vía
-- current_user_is_admin(), sin cambios); los vendedores existentes
-- conservan exactamente el mismo acceso (ningún check nuevo se conecta a
-- nada todavía). Ningún usuario gana ni pierde acceso funcional en esta
-- migración — activar el modelo nuevo es 6R.1B, un paso completamente
-- aparte.
--
-- =========================================================================
-- DECISIÓN — catálogo `capabilities` + tabla de otorgamiento
-- `user_capabilities`, en vez de ampliar el CHECK de `role` con más
-- valores por cada combinación
-- =========================================================================
-- El enunciado es explícito: "roles base + capacidades combinables", no un
-- rol por persona. Un catálogo (`capabilities`, referencial — evita typos
-- vía FK) + una tabla de otorgamiento por usuario+organización+capacidad
-- (`user_capabilities`) permite exactamente lo pedido: Alexandro puede
-- tener `can_manage_users` + `can_manage_system_settings` sobre su rol
-- `vendedor` normal, sin crear un rol "it_admin" ni "logistics_sales_user".
--
-- =========================================================================
-- DECISIÓN — `user_capabilities` es escribible ÚNICAMENTE por
-- is_organization_admin() — ni siquiera por alguien con can_manage_users
-- =========================================================================
-- Requisito explícito de seguridad (6R.1A §2): otorgar/retirar capacidades
-- o convertir a alguien en admin es autoridad EXCLUSIVA del Super Admin
-- empresarial actual. `can_manage_users` (cuando se conecte a algo en
-- 6R.1B) solo podrá administrar altas/bajas/edición de CUENTAS — nunca
-- capacidades. Esto se garantiza en la RLS de `user_capabilities` misma
-- (insert/update/delete exigen is_organization_admin(organization_id)),
-- NO en la UI ni por convención — un usuario con can_manage_users que
-- intente escribir aquí es rechazado por Postgres antes de que cualquier
-- código de aplicación se ejecute. Ver pruebas 0040_functional_tests.sql
-- TEST 1-6.
--
-- =========================================================================
-- DECISIÓN — current_user_has_capability() hace bypass total para
-- current_user_is_admin(), current_user_is_admin() NO se toca
-- =========================================================================
-- El enunciado pide explícitamente que current_user_is_admin() "se
-- mantenga compatible con todo el código existente" — no se modifica su
-- definición ni una coma. current_user_has_capability() es una función
-- NUEVA e independiente que:
--   1) devuelve true de inmediato si current_user_is_admin() (Super Admin
--      = bypass total, igual que hoy en cada RLS/RPC existente);
--   2) si no, exige current_user_active() y una organización actual
--      resoluble vía current_user_organization_id() (mismo helper de 0013
--      — mismo criterio de "una sola organización activa" que ya usa todo
--      el proyecto, cero lógica de resolución de organización duplicada);
--   3) busca una fila activa en user_capabilities para
--      (auth.uid(), esa organización, la capacidad pedida) — aislamiento
--      cross-org automático porque la organización viene del propio
--      usuario autenticado, nunca de un parámetro.
-- Esta función NO se conecta todavía a ningún RLS/RPC existente (6R.1A
-- §7) — hoy es pura infraestructura, invocable pero sin ningún efecto
-- observable en la aplicación.
--
-- =========================================================================
-- DECISIÓN — CHECK de `role` se amplía, usuarios reales NO se migran
-- =========================================================================
-- Se agregan 'sales_manager', 'partner', 'logistics' como valores
-- PERMITIDOS en el CHECK de user_profiles.role y organization_members.role
-- (mismo par de tablas, mismo criterio dual-write que 0013), pero NINGUNA
-- fila existente cambia de valor — Vladimir sigue 'admin', los vendedores
-- siguen 'vendedor'. La activación real (mover a Diana/Karla/Rodolfo a sus
-- nuevos roles + otorgarles capacidades) es 6R.1B, después de verificar
-- que ningún código depende de la enumeración exacta {admin, vendedor}
-- (la auditoría 6R.1 ya identificó ~80 puntos que sí dependen de esa
-- enumeración — cambiar el rol de una persona real sin antes conectar los
-- checks de capacidad correspondientes le quitaría acceso, no se lo
-- ampliaría, ya que hoy CUALQUIER rol que no sea exactamente 'admin' cae
-- en las ramas "vendedor" de cada RLS/RPC).
--
-- =========================================================================
-- CATÁLOGO DE CAPACIDADES (11, exactamente las aprobadas en 6R.1 §5) —
-- ninguna capacidad nueva agregada; can_view_costs queda preparada sin
-- ningún dato de costo/margen que gatear (Product Catalog no se toca).
-- =========================================================================

begin;

-- =========================================================================
-- 1) capabilities — catálogo de referencia, global (no por organización:
--    la CAPACIDAD es un concepto del sistema, quién la tiene sí es por
--    organización, eso vive en user_capabilities). Sin policy de
--    INSERT/UPDATE/DELETE para `authenticated` — se mantiene solo vía
--    migración, igual criterio que purchase_order_sequences/business_units
--    (catálogos de solo lectura para la aplicación).
-- =========================================================================
create table if not exists capabilities (
  key text primary key,
  description text not null,
  created_at timestamptz not null default now()
);

alter table capabilities enable row level security;

drop policy if exists "capabilities_select_active_member" on capabilities;
create policy "capabilities_select_active_member" on capabilities
  for select using (current_user_active());

insert into capabilities (key, description) values
  ('can_view_all_sales', 'Ver clientes/cotizaciones/pedidos de todo el equipo, no solo los propios.'),
  ('can_view_costs', 'Ver costos de proveedor y márgenes futuros — preparada, sin dato que gatear todavía (Product Catalog no tiene columnas de costo).'),
  ('can_prepare_purchase_orders', 'Crear y editar Purchase Orders en estado de preparación.'),
  ('can_approve_purchase_orders', 'Aprobar/emitir una Purchase Order — única capacidad que la saca de estado de preparación.'),
  ('can_receive_inventory', 'Registrar recepciones de mercancía contra una Purchase Order.'),
  ('can_reserve_inventory', 'Reservar inventario para pedidos de cualquier vendedor, no solo propios.'),
  ('can_fulfill_inventory', 'Surtir reservas de inventario para pedidos de cualquier vendedor, no solo propios.'),
  ('can_manage_deliveries', 'Crear y gestionar Entregas/Instalaciones para pedidos de cualquier vendedor, no solo propios.'),
  ('can_manage_users', 'Administrar altas/bajas/edición de cuentas de usuario — NUNCA otorgar/retirar capacidades ni asignar el rol admin.'),
  ('can_manage_system_settings', 'Administrar catálogo, tipos de producto, unidades de negocio y folios.'),
  ('can_view_global_dashboard', 'Ver el Command Center en modo global/lectura en vez del Home personal.')
on conflict (key) do nothing;

-- =========================================================================
-- 2) user_capabilities — otorgamiento de una capacidad a un usuario dentro
--    de una organización. Escritura EXCLUSIVA de is_organization_admin()
--    — ver DECISIÓN arriba. `active` permite revocar sin perder el
--    historial de quién/cuándo otorgó y quién/cuándo revocó (mismo
--    criterio de auditoría que delivery_status_history/
--    order_operational_status_history).
-- =========================================================================
create table if not exists user_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  capability text not null references capabilities (key) on delete restrict,
  active boolean not null default true,
  granted_by_user_id uuid not null references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by_user_id uuid references auth.users (id) on delete restrict,
  revoked_at timestamptz,
  constraint user_capabilities_unique unique (organization_id, user_id, capability)
);

create index if not exists user_capabilities_lookup_idx on user_capabilities (organization_id, user_id, capability) where active;

alter table user_capabilities enable row level security;

-- SELECT: el propio usuario ve sus capacidades otorgadas (para que la app
-- pueda mostrarle qué puede hacer); is_organization_admin() ve las de
-- cualquiera en su organización (para administrarlas en 6R.1B).
drop policy if exists "user_capabilities_select_own_or_admin" on user_capabilities;
create policy "user_capabilities_select_own_or_admin" on user_capabilities
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (user_id = auth.uid() or is_organization_admin(organization_id))
  );

-- INSERT/UPDATE/DELETE: EXCLUSIVAMENTE is_organization_admin() — nunca
-- can_manage_users, nunca el propio usuario. Tres policies explícitas (no
-- una sola FOR ALL) para que quede inequívoco en una auditoría futura que
-- cada operación de escritura individual está cerrada de la misma forma.
drop policy if exists "user_capabilities_insert_admin" on user_capabilities;
create policy "user_capabilities_insert_admin" on user_capabilities
  for insert with check (current_user_active() and is_organization_admin(organization_id));

drop policy if exists "user_capabilities_update_admin" on user_capabilities;
create policy "user_capabilities_update_admin" on user_capabilities
  for update using (current_user_active() and is_organization_admin(organization_id))
  with check (current_user_active() and is_organization_admin(organization_id));

drop policy if exists "user_capabilities_delete_admin" on user_capabilities;
create policy "user_capabilities_delete_admin" on user_capabilities
  for delete using (current_user_active() and is_organization_admin(organization_id));

-- =========================================================================
-- DECISIÓN — trigger de integridad "mismo org" en user_capabilities
-- =========================================================================
-- RLS por sí sola permite que un admin de Org B otorgue una fila con
-- organization_id = Org B a un user_id que en realidad pertenece a Org 1
-- (RLS solo exige que el OTORGANTE sea admin de esa organización, no que
-- el DESTINATARIO lo sea). Esa fila nunca sería explotable en lectura
-- (current_user_has_capability() siempre resuelve la organización desde
-- el propio usuario consultante, nunca desde un parámetro), pero es un
-- dato inconsistente que no debería poder existir — mismo criterio que
-- trg_check_person_business_unit_same_org (0017) y
-- trg_check_product_business_unit_same_org (0019/0030). Se bloquea en el
-- INSERT/UPDATE, no solo se confía en que sea inofensivo después.
create or replace function trg_check_user_capability_same_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from organization_members om
    where om.organization_id = new.organization_id and om.user_id = new.user_id
  ) then
    raise exception 'El usuario % no pertenece a la organización % — no se puede otorgar una capacidad cruzada.', new.user_id, new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_capabilities_same_org on user_capabilities;
create trigger trg_user_capabilities_same_org
  before insert or update on user_capabilities
  for each row execute function trg_check_user_capability_same_org();

-- =========================================================================
-- 3) current_user_has_capability(p_capability) — ver DECISIÓN arriba.
--    NO se invoca todavía desde ningún RLS/RPC existente (6R.1A §7).
-- =========================================================================
create or replace function current_user_has_capability(p_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if current_user_is_admin() then
    return true;
  end if;

  if not current_user_active() then
    return false;
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    return false;
  end if;

  return exists (
    select 1 from user_capabilities uc
    where uc.user_id = auth.uid()
      and uc.organization_id = v_organization_id
      and uc.capability = p_capability
      and uc.active = true
  );
end;
$$;

-- =========================================================================
-- 4) Ampliar el CHECK de `role` en user_profiles y organization_members —
--    ver DECISIÓN arriba. Ninguna fila existente cambia de valor.
-- =========================================================================
-- REQUISITO DE ACTIVACIÓN PARA 6R.1B (aprobado en 6R.1A, NO implementado
-- aquí): en la operación real, sales_manager/partner/logistics (Karla/
-- Diana/Rodolfo) también tienen función comercial propia y deberán
-- quedar asociados a un salesperson_id, igual que 'vendedor' hoy.
-- `user_profiles_vendedor_requires_salesperson` (0011) solo exige
-- salesperson_id para role = 'vendedor' literal — NO se amplía en 6R.1A
-- (la fase es infraestructura, no activación) — 6R.1B debe decidir si
-- ese CHECK se generaliza a estos 3 roles antes o al momento de migrar a
-- Karla/Diana/Rodolfo, para no dejarlos sin vendedor asociado por
-- descuido.
alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check
  check (role in ('admin', 'vendedor', 'sales_manager', 'partner', 'logistics'));

alter table organization_members drop constraint if exists organization_members_role_check;
alter table organization_members add constraint organization_members_role_check
  check (role in ('admin', 'vendedor', 'sales_manager', 'partner', 'logistics'));

commit;
