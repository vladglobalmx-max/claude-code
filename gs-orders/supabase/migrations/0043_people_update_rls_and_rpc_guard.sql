-- =========================================================================
-- THÖREN — Fix: falta política RLS de UPDATE en `people` + guarda
-- fail-loud en rpc_create_person_for_user (0042 post-deploy)
-- =========================================================================
-- CAUSA RAÍZ CONFIRMADA (auditoría 0042 post-deploy, reproducida en local
-- bajo `set role authenticated`, NO solo como dueño de las tablas):
--
-- `people` nunca tuvo política de UPDATE. 0016 lo documentó explícito al
-- crear people_insert_admin: "agrega policy INSERT admin-scoped. SELECT
-- sin cambios (ver 0015). Sin UPDATE/DELETE." — válido en ese momento
-- porque rpc_create_person_for_user (0016) solo hacía INSERT.
--
-- 0042 agregó la PRIMERA sentencia UPDATE contra `people` en toda la
-- historia del proyecto (rama de reutilización: completar
-- people.email cuando era NULL). insertProfileAndMembershipOrCompensate
-- (src/lib/user-access.ts) invoca la RPC vía createSupabaseServerClient()
-- (anon key + cookies de sesión) — RLS se aplica de verdad. Como
-- rpc_create_person_for_user es SECURITY INVOKER (deliberado, sin
-- cambios), ese UPDATE corre con los privilegios/RLS del admin
-- autenticado, no de un superusuario. Sin política de UPDATE, Postgres
-- deniega por defecto: el UPDATE afecta 0 filas, EN SILENCIO, sin
-- excepción (mismo comportamiento ya documentado en 0041 para
-- USING-clause-false). La función no comprobaba row_count en esa línea
-- (a diferencia de las otras dos escrituras de user_profiles en la misma
-- función, que sí lo hacen) — el fallo quedaba invisible: la función
-- seguía hasta vincular user_profiles.person_id (esa sí tiene política de
-- UPDATE, 0011) y retornaba sin error. Resultado observado en Cloud:
-- person_id/salesperson_id correctos, cero excepción, people.email
-- permanece NULL para siempre.
--
-- Confirmado además que 0042_functional_tests.sql TEST 3 tenía un bug de
-- comparación NULL independiente (`v_final_email <> 'esperado'` — en SQL
-- de tres valores, si v_final_email es NULL esa comparación es NULL/
-- desconocido, nunca TRUE, así que el IF nunca disparaba la excepción y
-- el test reportaba "OK" sin importar el resultado real). Verificado
-- reproduciendo el escenario exacto de TEST 2/3 a mano bajo
-- `set role authenticated`: el UPDATE de esta función SÍ afecta 0 filas
-- localmente también — el test nunca lo habría detectado por ese bug de
-- comparación. Se corrige en 0043_functional_tests.sql (y se repara el
-- mismo defecto en 0042_functional_tests.sql como parte de la regresión).
--
-- =========================================================================
-- FIX — dos partes, ambas necesarias
-- =========================================================================
-- 1) Política de UPDATE en `people`, admin-scoped, espejo exacto de
--    people_insert_admin (0016): permite UPDATE únicamente cuando el
--    usuario actual es admin ACTIVO de la organización a la que
--    pertenece la fila — is_organization_admin() ya verifica
--    organization_members.active = true (0013), así que no hace falta
--    duplicar ese chequeo aparte.
--    USING se evalúa contra la fila VIEJA (organization_id actual) y
--    WITH CHECK contra la fila NUEVA (organization_id resultante) — al
--    usar la misma expresión en ambos, un intento de mover
--    organization_id hacia otra organización falla en WITH CHECK (el
--    admin no es admin de la organización destino), sin importar que
--    USING haya permitido ver la fila original.
--    Deliberadamente NO se usa can_view_all_sales (0041, capacidad de
--    LECTURA) como permiso de escritura, y NO se convierte la función a
--    SECURITY DEFINER como atajo — se mantiene SECURITY INVOKER.
--
-- 2) Defensa en profundidad en rpc_create_person_for_user: tras el UPDATE
--    de people.email en la rama de reutilización, GET DIAGNOSTICS +
--    excepción explícita si row_count <> 1. Si esto ocurre, la función
--    NO continúa hacia el UPDATE de user_profiles.person_id — la
--    operación completa de alta se revierte (mismo criterio de siempre:
--    esta función no atrapa excepciones) e
--    insertProfileAndMembershipOrCompensate ejecuta su compensación
--    normal. Se conservan sin cambios: email NULL -> completar; email
--    igual -> permitido; email distinto -> excepción; cross-org ->
--    excepción; reutilización de Person existente; creación de Person
--    nueva cuando corresponde.
-- =========================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Política de UPDATE en people
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'people'
      and policyname = 'people_update_admin'
  ) then
    create policy "people_update_admin" on people
      for update
      using (is_organization_admin(organization_id))
      with check (is_organization_admin(organization_id));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) rpc_create_person_for_user — misma firma, SECURITY INVOKER sin
--    cambios; solo agrega el chequeo de row_count tras el UPDATE de
--    people.email en la rama de reutilización.
-- ---------------------------------------------------------------------
create or replace function rpc_create_person_for_user(
  p_user_id uuid,
  p_organization_id uuid,
  p_name text,
  p_email text,
  p_active boolean
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_salesperson_id uuid;
  v_existing_person_id uuid;
  v_existing_person_org uuid;
  v_existing_person_email text;
  v_person_id uuid;
  v_rows integer;
begin
  select salesperson_id into v_salesperson_id from user_profiles where user_id = p_user_id;

  if v_salesperson_id is not null then
    select person_id into v_existing_person_id from salespeople where id = v_salesperson_id;
  end if;

  if v_existing_person_id is not null then
    -- Reutilizar la Person histórica del salesperson — nunca crear una
    -- segunda para la misma persona real (ver DECISIÓN en 0042).
    select organization_id, email into v_existing_person_org, v_existing_person_email
      from people where id = v_existing_person_id;

    if v_existing_person_org is distinct from p_organization_id then
      raise exception
        'rpc_create_person_for_user: la Person existente (%) del salesperson % pertenece a la organización %, no a %. No se puede reutilizar entre organizaciones.',
        v_existing_person_id, v_salesperson_id, v_existing_person_org, p_organization_id;
    end if;

    if v_existing_person_email is not null and v_existing_person_email <> p_email then
      raise exception
        'rpc_create_person_for_user: la Person existente (%) del salesperson % ya tiene el email "%", distinto al del nuevo acceso ("%"). No se sobrescribe automáticamente — requiere revisión manual.',
        v_existing_person_id, v_salesperson_id, v_existing_person_email, p_email;
    end if;

    if v_existing_person_email is null then
      update people set email = p_email where id = v_existing_person_id;

      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception
          'rpc_create_person_for_user: no se pudo completar el email de la Person existente % (la actualización afectó % filas — posible bloqueo de RLS o la fila ya no existe). No se vincula user_profiles a una Person con email desactualizado.',
          v_existing_person_id, v_rows;
      end if;
    end if;

    update user_profiles set person_id = v_existing_person_id
      where user_id = p_user_id and person_id is null;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'rpc_create_person_for_user: no se pudo vincular la Person existente a user_profiles de % (perfil inexistente o ya tenía una Person vinculada).', p_user_id;
    end if;

    return;
  end if;

  -- Comportamiento original (0016), sin cambios: sin Person histórica que
  -- reutilizar -> crear una nueva.
  insert into people (organization_id, name, email, active)
  values (p_organization_id, p_name, p_email, p_active)
  returning id into v_person_id;

  update user_profiles set person_id = v_person_id
   where user_id = p_user_id and person_id is null;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'rpc_create_person_for_user: no se pudo vincular la Person a user_profiles de % (perfil inexistente o ya tenía una Person vinculada).', p_user_id;
  end if;
end;
$$;

commit;
