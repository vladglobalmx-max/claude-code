-- =========================================================================
-- THÖREN — Fase 6R.1B-4A: Administración Técnica de Cuentas — can_manage_users
-- =========================================================================
-- OBJETIVO: conectar la capability can_manage_users (sembrada sin uso desde
-- 0040) a la autoridad real de ADMINISTRACIÓN DE CUENTAS (ver/crear/activar/
-- desactivar usuarios no-admin de la propia organización, vincular su
-- salesperson, reenviar/restablecer su acceso) — SIN que eso implique
-- autoridad de negocio, capacidad de otorgar/revocar capabilities, ni
-- posibilidad de crear o tocar una cuenta admin. Ninguna capability nueva.
--
-- =========================================================================
-- DECISIÓN — user_capabilities NO se toca (ya está resuelto desde 0040)
-- =========================================================================
-- La auditoría 6R.1B-4 confirmó que INSERT/UPDATE/DELETE sobre
-- user_capabilities son escritura EXCLUSIVA de is_organization_admin() desde
-- el día 1 (0040) — nunca can_manage_users, nunca el propio usuario. Esta
-- migración no agrega ninguna policy nueva sobre esa tabla porque ya hace
-- exactamente lo pedido; se agregan tests explícitos (0046_functional_tests)
-- para dejarlo demostrado, no reforzado.
--
-- =========================================================================
-- DECISIÓN — dos protecciones estructurales SEPARADAS, ambas en DB, ambas
-- aplicadas a user_profiles Y organization_members (dual-write de role/
-- active desde 0013)
-- =========================================================================
-- 1) trg_prevent_non_admin_role_escalation: un actor que NO es admin pleno
--    (current_user_is_admin() = false — esto incluye a cualquier titular de
--    can_manage_users, sin excepción) nunca puede, vía INSERT o UPDATE:
--      - crear o dejar una fila con role = 'admin';
--      - tocar (de cualquier forma) una fila cuyo role YA es 'admin'.
--    Un admin pleno no se ve afectado — conserva autoridad total sobre
--    cualquier cuenta, incluidas otras admin.
-- 2) trg_prevent_last_admin_removal: NINGÚN actor — ni siquiera un admin
--    pleno — puede dejar a una organización sin ningún admin activo. Se
--    dispara solo cuando la fila que se está modificando ERA admin activo Y
--    el cambio la sacaría de esa condición (role≠admin o active=false), y
--    cuenta admins activos DISTINTOS de esa misma fila en la misma
--    organización antes de permitirlo.
-- Ambas viven en triggers (no solo en RLS) porque RLS no puede comparar
-- columna por columna contra el valor anterior de la fila (mismo criterio
-- ya usado en trg_prevent_purchase_order_folio_change, 0035, y
-- trg_prevent_approve_only_detail_edit, 0045) — "no depender de esconder un
-- select", tal como pide el enunciado.
--
-- =========================================================================
-- DECISIÓN — RLS aditiva y ACOTADA para can_manage_users, nunca la tabla
-- completa
-- =========================================================================
-- user_profiles/organization_members ya tenían una única policy de
-- escritura "ciega al valor" (*_admin_write, FOR ALL, is_organization_admin
-- únicamente) — NO se toca. Se agregan policies NUEVAS y ADITIVAS,
-- deliberadamente estrechas:
--   - SELECT: cualquier fila de la MISMA organización (siempre permitido,
--     incluidas cuentas admin — hace falta verlas para saber que no se
--     pueden tocar).
--   - INSERT: únicamente con role = 'vendedor'.
--   - UPDATE: únicamente cuando la fila (antes Y después) NO es admin, y
--     pertenece a la misma organización que el actor.
-- Los dos triggers de arriba son el backstop real ante cualquier intento de
-- burlar esto (incluida la vía admin_write si alguna vez se reutilizara mal).
--
-- =========================================================================
-- DECISIÓN — admin_update_user_role_and_active (0013) NO se modifica
-- =========================================================================
-- Es SECURITY INVOKER y nunca tuvo autorización propia — se apoya
-- enteramente en las policies de ambas tablas (documentado explícitamente
-- en su propio comentario de 0013). Con las policies nuevas de esta
-- migración, esa misma función RPC empieza a funcionar automáticamente para
-- can_manage_users, con las restricciones ya impuestas por RLS/triggers
-- (no puede asignar role='admin' ni tocar una cuenta admin) — cero cambios
-- de código en la función.
--
-- =========================================================================
-- DECISIÓN — admin_list_user_profiles() se amplía Y se acota a la vez
-- =========================================================================
-- Hoy es admin-only Y sin ningún filtro de organización (CORE 1 = una sola
-- organización real en producción, así que nunca fue observable). Al
-- abrirla a can_manage_users, agregar el filtro de organización deja de ser
-- opcional: sin él, un usuario técnico de una organización vería usuarios de
-- CUALQUIER organización. Se agrega aquí como parte necesaria de este mismo
-- cambio, no como limpieza aparte.
--
-- =========================================================================
-- 1) user_belongs_to_organization — helper SECURITY DEFINER para verificar
--    la organización de un usuario ARBITRARIO (no el propio, a diferencia
--    de is_organization_member()) sin sufrir compounding de RLS contra
--    organization_members (mismo patrón que is_organization_admin/
--    is_organization_member, 0013).
-- =========================================================================
-- Deliberadamente SIN filtro active = true: esto es scoping por
-- ORGANIZACIÓN, no una verificación de autoridad. Si exigiera membership
-- activa, admin_update_user_role_and_active se auto-bloquearía al
-- DESACTIVAR a alguien — actualiza organization_members.active = false y
-- LUEGO, en la misma transacción, intenta actualizar user_profiles bajo la
-- policy que usa este helper; con el filtro, la fila recién desactivada
-- dejaría de "pertenecer" a la organización a mitad de la propia operación
-- que la desactiva. El estado activo del actor ya se exige aparte via
-- current_user_active(); el del target es precisamente el campo que estas
-- policies necesitan poder escribir en ambas direcciones.
create or replace function user_belongs_to_organization(p_user_id uuid, p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where user_id = p_user_id and organization_id = p_organization_id
  );
$$;

-- =========================================================================
-- 2) trg_prevent_non_admin_role_escalation — protección de role/admin.
--
--    AJUSTE — auth.uid() IS NULL queda exento: es el mismo límite de
--    confianza que Supabase ya usa para RLS (bypass total para service
--    role/superuser). Sin esta excepción, este trigger rompería el
--    bootstrap documentado del primer ADMIN (0011, sección 11 — un INSERT
--    directo en el SQL Editor, deliberadamente "sin depender de que ya
--    exista un ADMIN", corriendo sin ninguna sesión autenticada de
--    aplicación) y cualquier otra operación legítima de infraestructura
--    (compensación de Auth, migraciones futuras). Un usuario real de la
--    app SIEMPRE tiene auth.uid() resuelto — la restricción real de esta
--    fase (bloquear a un titular de can_manage_users) sigue aplicando
--    exactamente igual, porque ese actor sí tiene auth.uid() no nulo y
--    current_user_is_admin() = false.
-- =========================================================================
create or replace function trg_prevent_non_admin_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or current_user_is_admin() then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    if new.role = 'admin' then
      raise exception 'Solo un administrador puede crear una cuenta con rol admin.';
    end if;
    return new;
  end if;

  -- UPDATE: el actor no es admin pleno (puede ser can_manage_users o nadie).
  if old.role = 'admin' then
    raise exception 'Solo un administrador puede modificar una cuenta que ya es administrador.';
  end if;
  if new.role = 'admin' then
    raise exception 'Solo un administrador puede asignar el rol admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_prevent_role_escalation on user_profiles;
create trigger trg_user_profiles_prevent_role_escalation
  before insert or update on user_profiles
  for each row execute function trg_prevent_non_admin_role_escalation();

drop trigger if exists trg_organization_members_prevent_role_escalation on organization_members;
create trigger trg_organization_members_prevent_role_escalation
  before insert or update on organization_members
  for each row execute function trg_prevent_non_admin_role_escalation();

-- =========================================================================
-- 3) trg_prevent_last_admin_removal — protección de "último admin",
--    aplica a CUALQUIER actor, incluido un admin pleno. user_profiles no
--    tiene organization_id propio, así que en esa tabla resuelve la
--    organización vía organization_members; en organization_members ya la
--    tiene directamente. SECURITY DEFINER porque el conteo de "otros
--    admins" debe ser correcto sin importar la RLS del actor que dispara el
--    trigger (mismo criterio que is_organization_admin/is_organization_member).
-- =========================================================================
create or replace function trg_prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_would_demote boolean;
  v_other_admins integer;
begin
  v_would_demote := old.role = 'admin' and old.active = true
    and (new.role is distinct from 'admin' or new.active = false);

  if not v_would_demote then
    return new;
  end if;

  if TG_TABLE_NAME = 'organization_members' then
    v_organization_id := old.organization_id;

    select count(*) into v_other_admins
      from organization_members
      where organization_id = v_organization_id
        and role = 'admin'
        and active = true
        and user_id <> old.user_id;
  else
    select om.organization_id into v_organization_id
      from organization_members om
      where om.user_id = old.user_id
      limit 1;

    if v_organization_id is null then
      return new;
    end if;

    select count(*) into v_other_admins
      from organization_members om
      join user_profiles up on up.user_id = om.user_id
      where om.organization_id = v_organization_id
        and up.role = 'admin'
        and up.active = true
        and om.user_id <> old.user_id;
  end if;

  if v_other_admins = 0 then
    raise exception 'No se puede modificar a este usuario: es el último administrador activo de la organización. Debe existir al menos un administrador activo en todo momento.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_prevent_last_admin on user_profiles;
create trigger trg_user_profiles_prevent_last_admin
  before update on user_profiles
  for each row execute function trg_prevent_last_admin_removal();

drop trigger if exists trg_organization_members_prevent_last_admin on organization_members;
create trigger trg_organization_members_prevent_last_admin
  before update on organization_members
  for each row execute function trg_prevent_last_admin_removal();

-- =========================================================================
-- 4) RLS aditiva — user_profiles: SELECT/INSERT/UPDATE acotados para
--    can_manage_users. Las policies *_admin_write existentes quedan
--    intactas.
-- =========================================================================
drop policy if exists "user_profiles_select_user_manager" on user_profiles;
create policy "user_profiles_select_user_manager" on user_profiles
  for select using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and user_belongs_to_organization(user_profiles.user_id, current_user_organization_id())
  );

drop policy if exists "user_profiles_insert_user_manager" on user_profiles;
create policy "user_profiles_insert_user_manager" on user_profiles
  for insert with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role = 'vendedor'
  );

drop policy if exists "user_profiles_update_user_manager" on user_profiles;
create policy "user_profiles_update_user_manager" on user_profiles
  for update using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role <> 'admin'
    and user_belongs_to_organization(user_profiles.user_id, current_user_organization_id())
  )
  with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role <> 'admin'
    and user_belongs_to_organization(user_profiles.user_id, current_user_organization_id())
  );

-- =========================================================================
-- 5) RLS aditiva — organization_members: INSERT/UPDATE/SELECT acotados.
--    La SELECT es obligatoria pese a que ningún flujo de TypeScript lee esta
--    tabla directamente: Postgres exige que una fila sea visible por SELECT
--    policy, ADEMÁS de pasar la USING de UPDATE, para que una fila sea
--    candidata a UPDATE (comportamiento verificado con EXPLAIN — el plan
--    combina ambas quals con AND). Sin esto, admin_update_user_role_and_active
--    (SECURITY INVOKER) actualiza 0 filas para cualquier usuario que no sea
--    el propio actor, aunque la policy de UPDATE por sí sola sea correcta.
-- =========================================================================
drop policy if exists "organization_members_select_user_manager" on organization_members;
create policy "organization_members_select_user_manager" on organization_members
  for select using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  );

drop policy if exists "organization_members_insert_user_manager" on organization_members;
create policy "organization_members_insert_user_manager" on organization_members
  for insert with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role = 'vendedor'
    and organization_id = current_user_organization_id()
  );

drop policy if exists "organization_members_update_user_manager" on organization_members;
create policy "organization_members_update_user_manager" on organization_members
  for update using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role <> 'admin'
    and organization_id = current_user_organization_id()
  )
  with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and role <> 'admin'
    and organization_id = current_user_organization_id()
  );

-- =========================================================================
-- 6) RLS aditiva — people: INSERT acotado, necesario para que
--    rpc_create_person_for_user (0016/0042, SECURITY INVOKER) siga
--    funcionando de punta a punta cuando quien da de alta es
--    can_manage_users en vez de admin. Ninguna otra policy de people se
--    toca — el flujo de alta nunca actualiza ni lee `people` directamente
--    fuera de esa RPC.
-- =========================================================================
drop policy if exists "people_insert_user_manager" on people;
create policy "people_insert_user_manager" on people
  for insert with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  );

-- SELECT scoped a la organización: necesaria para que el propio
-- `insert ... returning id` de rpc_create_person_for_user no falle — sin
-- policy de SELECT, Postgres evalúa la fila recién insertada contra las
-- policies de SELECT para el RETURNING y aborta con el mismo error
-- genérico de RLS aunque el WITH CHECK del INSERT haya pasado.
drop policy if exists "people_select_user_manager" on people;
create policy "people_select_user_manager" on people
  for select using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  );

-- UPDATE scoped a la organización: rpc_create_person_for_user (0042/0043)
-- completa el email de una Person histórica sin email cuando reutiliza el
-- salesperson de un nuevo usuario — sin esta policy, esa actualización
-- afecta 0 filas por RLS y el guard explícito de 0043 (para exactamente
-- este escenario) lo detecta y aborta la alta completa.
drop policy if exists "people_update_user_manager" on people;
create policy "people_update_user_manager" on people
  for update using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  )
  with check (
    current_user_active()
    and current_user_has_capability('can_manage_users')
    and organization_id = current_user_organization_id()
  );

-- =========================================================================
-- 6b) RLS aditiva — salespeople: SELECT para can_manage_users, necesaria
--     para que rpc_create_person_for_user pueda leer el person_id del
--     salesperson histórico del nuevo usuario (sin esto, salespeople_
--     select_own_or_admin oculta esa fila y la lógica de reutilización de
--     0042 no la ve — cae al branch de "crear Person nueva" y duplica).
--     salespeople no tiene columna organization_id (ni la policy admin
--     existente la usa: current_user_is_admin() ya es global) — esta
--     policy iguala exactamente ese alcance ya existente para admin, no lo
--     amplía.
-- =========================================================================
drop policy if exists "salespeople_select_user_manager" on salespeople;
create policy "salespeople_select_user_manager" on salespeople
  for select using (
    current_user_active()
    and current_user_has_capability('can_manage_users')
  );

-- =========================================================================
-- 7) admin_list_user_profiles() — reemplaza la versión VIGENTE (0011,
--    única definición). Único cambio real: el guard de autoridad (admin OR
--    can_manage_users) y el filtro de organización (necesario a partir de
--    ahora, ver DECISIÓN arriba) — el resto de la consulta, carácter por
--    carácter igual.
-- =========================================================================
create or replace function admin_list_user_profiles()
returns table (
  user_id uuid,
  email text,
  name text,
  role text,
  salesperson_id uuid,
  salesperson_name text,
  salesperson_prefix text,
  active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if not current_user_is_admin() and not current_user_has_capability('can_manage_users') then
    raise exception 'No tienes permiso para ver esta información';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización activa.';
  end if;

  return query
    select
      up.user_id, u.email, up.name, up.role, up.salesperson_id,
      sp.name as salesperson_name, sp.prefix as salesperson_prefix,
      up.active, up.created_at
    from user_profiles up
    join auth.users u on u.id = up.user_id
    join organization_members om on om.user_id = up.user_id and om.organization_id = v_organization_id
    left join salespeople sp on sp.id = up.salesperson_id
    order by up.name;
end;
$$;
