-- GS Orders — Migración 0012: fix de admin_list_user_profiles() (error 42804)
--
-- Causa confirmada: auth.users.email es character varying(255), pero
-- admin_list_user_profiles() (ver 0011_users_roles_rls.sql) declara
-- `email text` en su RETURNS TABLE. RETURN QUERY exige coincidencia exacta
-- de tipo entre la consulta y la tabla de retorno declarada — varchar(255)
-- no es lo mismo que text ahí, aunque sean compatibles en un SELECT normal.
-- Postgres lanza 42804 "structure of query does not match function result
-- type" al intentar devolver esa columna.
--
-- Esta migración SOLO reemplaza esa función (cast explícito u.email::text).
-- No toca tablas, RLS, policies, roles ni el bootstrap de 0011 — 0011 ya
-- está ejecutada en producción y no se modifica.
--
-- Idempotente: CREATE OR REPLACE FUNCTION puede correr cualquier número de
-- veces sin error.

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
begin
  if not current_user_is_admin() then
    raise exception 'No tienes permiso para ver esta información';
  end if;

  return query
    select
      up.user_id, u.email::text, up.name, up.role, up.salesperson_id,
      sp.name as salesperson_name, sp.prefix as salesperson_prefix,
      up.active, up.created_at
    from user_profiles up
    join auth.users u on u.id = up.user_id
    left join salespeople sp on sp.id = up.salesperson_id
    order by up.name;
end;
$$;
