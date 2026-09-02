-- THÖREN — Fase 6R.1B-4C (incidente post-despliegue): restaurar el cast
-- u.email::text en admin_list_user_profiles(), perdido por una REGRESIÓN
-- introducida en 0046.
--
-- HISTORIA REAL (confirmada leyendo el historial de migraciones, no
-- reconstruida de memoria):
--   - 0011_users_roles_rls.sql creó admin_list_user_profiles() con
--     `email text` en su RETURNS TABLE, seleccionando `u.email` SIN cast.
--   - 0012_fix_admin_user_profiles.sql corrigió exactamente eso: Postgres
--     exige que RETURN QUERY coincida tipo-por-tipo con el RETURNS TABLE
--     declarado, y auth.users.email es character varying(255) en
--     Supabase Cloud real (GoTrue) — no text. Sin el cast, la función
--     lanza 42804 "structure of query does not match function result
--     type" en cuanto se invoca de verdad.
--   - 0046_user_management_capability.sql (THÖREN 6R.1B-4A) reemplazó la
--     función para agregar el guard de can_manage_users y el filtro de
--     organización, pero su comentario decía "reemplaza la versión
--     VIGENTE (0011, única definición)" — un error de auditoría: la
--     versión vigente REAL era la de 0012 (con el cast), no la de 0011.
--     0046 copió el cuerpo de 0011 y con eso reintrodujo el 42804,
--     silenciosamente, porque el arnés de pruebas local nunca lo detectó
--     (su stub de auth.users usaba `email text`, no
--     `character varying(255)` — ver fix en
--     supabase/tests/local_harness_setup.sql de esta misma fase).
--   - Detectado en Supabase Cloud real el día de este despliegue:
--     Configuración → Usuarios mostraba "Todavía no hay usuarios" porque
--     page.tsx nunca revisa el `error` de la respuesta de la RPC
--     (`data ?? []`), así que el 42804 se veía como una lista vacía, no
--     como un error visible.
--
-- Esta migración es EXACTAMENTE la función de 0046 con el único cambio de
-- 0012 restaurado (u.email::text). Ningún guard, join, ni alcance de
-- autorización cambia — mismo comportamiento que 0046 pretendía tener.
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
      up.user_id, u.email::text, up.name, up.role, up.salesperson_id,
      sp.name as salesperson_name, sp.prefix as salesperson_prefix,
      up.active, up.created_at
    from user_profiles up
    join auth.users u on u.id = up.user_id
    join organization_members om on om.user_id = up.user_id and om.organization_id = v_organization_id
    left join salespeople sp on sp.id = up.salesperson_id
    order by up.name;
end;
$$;
