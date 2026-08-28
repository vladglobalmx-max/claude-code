-- =========================================================================
-- THÖREN — Fix: dar de alta un login para un salesperson operativo
-- YA EXISTENTE (con Person histórica) sin duplicar Person
-- =========================================================================
-- CASO REAL que motiva este fix: Diana Ochoa (prefijo DOJ) existe como
-- `salespeople` con historial comercial real (folios DOJ-*) y como
-- `people` (creada por el backfill "Caso B" de 0016_core_people_
-- salespeople_integration.sql — email NULL, vinculada vía
-- salespeople.person_id) — pero nunca tuvo login: sin auth.users, sin
-- user_profiles, sin organization_members. El flujo normal de alta
-- (configuracion/usuarios/nuevo -> createUserAccess ->
-- insertProfileAndMembershipOrCompensate, src/lib/user-access.ts) YA
-- permite elegirla del selector de vendedor (nunca fue reclamada por
-- ningún user_profiles.salesperson_id), pero rpc_create_person_for_user
-- (0016) SIEMPRE insertaba una Person nueva — dejando a Diana con DOS
-- filas `people` representando a la misma persona real.
--
-- =========================================================================
-- DECISIÓN — modificar rpc_create_person_for_user en el lugar, SIN cambiar
-- su firma ni el call-site en TypeScript
-- =========================================================================
-- La función ya recibe p_user_id, y para cuando se invoca (ver
-- insertProfileAndMembershipOrCompensate, user-access.ts:167-223) el
-- `user_profiles` del usuario YA fue insertado con su `salesperson_id`
-- (paso anterior en la misma operación). Esto es suficiente para resolver,
-- dentro de la propia función, si ese salesperson ya tiene una Person
-- histórica (`salespeople.person_id`) — sin necesidad de agregar un
-- parámetro nuevo ni tocar src/lib/user-access.ts/actions.ts en absoluto.
-- Cero cambios de TypeScript en este fix.
--
-- =========================================================================
-- COMPORTAMIENTO NUEVO
-- =========================================================================
-- Si el salesperson_id del user_profiles recién creado YA tiene
-- salespeople.person_id (Person histórica):
--   1) Verifica que esa Person pertenezca a la MISMA organización que se
--      está dando de alta — si no, aborta con excepción (nunca reutiliza
--      una Person de otra organización/persona). La transacción completa
--      de la operación de alta se revierte (mismo criterio que siempre:
--      esta función no atrapa excepciones), y
--      insertProfileAndMembershipOrCompensate ejecuta su compensación
--      normal (borra el Auth User recién creado) — sin cambios en esa
--      parte del flujo.
--   2) Si esa Person tiene email = NULL (caso histórico, como Diana):
--      se completa con el email real del nuevo login.
--   3) Si esa Person ya tiene un email DISTINTO al del nuevo login: aborta
--      con excepción explícita — NUNCA sobrescribe en silencio. Requiere
--      revisión manual (ver reporte del fix).
--   4) Si el email ya coincide exactamente: no se toca (permitido,
--      idempotente).
--   5) Vincula user_profiles.person_id a ESA Person existente — NUNCA
--      inserta una fila `people` nueva. salespeople.person_id queda
--      intacto (sigue apuntando a la misma Person).
--
-- Si el salesperson_id NO tiene Person histórica (o el usuario no tiene
-- salesperson_id, ej. un admin): comportamiento IDÉNTICO al de antes —
-- crea una Person nueva. Cero cambio de comportamiento para el caso ya
-- probado y en producción.
--
-- =========================================================================
-- INTEGRIDAD YA GARANTIZADA SIN TOCAR NADA MÁS (documentado, no
-- reimplementado aquí)
-- =========================================================================
-- - "un salesperson no puede ser reclamado por dos user_profiles":
--   user_profiles_salesperson_id_unique (0011) ya lo garantiza — el
--   INSERT de user_profiles falla ANTES de que esta función se ejecute
--   siquiera, si el salesperson_id ya está tomado.
-- - "cross-org bloqueado": is_organization_admin(organization_id) en la
--   RLS de organization_members (sin tocar) ya impide crear el alta en
--   una organización a la que el admin actual no pertenece; el chequeo
--   nuevo de esta función (punto 1 arriba) cubre el caso adicional de que
--   la Person histórica del salesperson elegido perteneciera a otra
--   organización (dato inconsistente que no debería existir, pero se
--   valida explícitamente de todas formas, mismo criterio de defensa en
--   profundidad que trg_check_person_business_unit_same_org, 0017).
-- =========================================================================

begin;

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
    -- segunda para la misma persona real (ver DECISIÓN arriba).
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
