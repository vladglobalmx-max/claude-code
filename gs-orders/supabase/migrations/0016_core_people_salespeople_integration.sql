-- GS Orders — Migración 0016: THÖREN Core 2C — People ↔ Salespeople Integration
--
-- Cuarta pieza de THÖREN Core: conecta salespeople (identidad comercial que
-- controla folios) con people (identidad humana, CORE 2B), y cierra la
-- brecha diferida desde CORE 2B — el alta de un usuario nuevo ahora también
-- crea su Person y la vincula, dentro del mismo flujo compensado. SIN
-- rediseñar salespeople, SIN tocar folios/prefix/sequence_current/orders.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `salespeople.person_id` (nullable, UNIQUE cuando no es null, on
--    delete set null) — mismo patrón que user_profiles.person_id (0015).
-- 2) Backfill determinista (Caso A del Discovery Report de CORE 2C): todo
--    salesperson con user_profile cuyo person_id ya está resuelto (por el
--    propio bootstrap de 0015) hereda ese person_id directamente. Cero
--    matching por nombre.
-- 3) Backfill histórico explícito (Caso B, decisión de negocio autorizada):
--    todo salesperson SIN user_profile asociado se resuelve a Global
--    Supplier MTY (organización nombrada por slug, nunca UUID hardcodeado,
--    falla explícito si no existe), creando una Person nueva por cada uno
--    (copiando name/active de salespeople — email queda NULL, salespeople
--    no tiene columna email) y vinculando salespeople.person_id. Ningún
--    Auth User ni user_profiles se crea para ellos.
-- 4) Agrega policy INSERT (admin-scoped) en `people` — único cambio de RLS
--    de esta fase, reutilizando is_organization_admin() de 0013. SELECT no
--    cambia: sigue siendo solo-ADMIN (ver 0015), sin ampliar a VENDEDOR.
-- 5) rpc_create_person_for_user(): RPC SECURITY INVOKER que crea una Person
--    y vincula user_profiles.person_id en una sola transacción, para
--    cerrar la brecha de CORE 2B — el alta de un usuario nuevo
--    (createUserAccess/createUserAccessLink) ahora también obtiene su
--    Person, sin dejar estados parciales (ver justificación abajo).
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO modifica fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, prefix, sequence_current.
-- - NO modifica orders, order_items, ni ningún RPC de pedidos.
-- - NO modifica business_units (CORE 2A) ni organization_members (CORE 1).
-- - NO crea person_business_units — queda para CORE 2D.
-- - NO crea Auth User ni user_profiles para los salespeople históricos sin
--   login (Caso B) — solo Person + el vínculo salespeople.person_id.
-- - NO modifica createSalesperson/updateSalesperson (vendedores/actions.ts):
--   no existe hoy ningún flujo real que cree un salesperson y a la vez sepa
--   a qué Person vincularlo — ese vínculo siempre pasa por
--   user_profiles.salesperson_id, definido en Usuarios, no en Vendedores.
-- - NO crea ninguna pantalla ni UI.
--
-- =========================================================================
-- DECISIÓN — salespeople.person_id: nullable, UNIQUE, on delete set null:
-- =========================================================================
-- nullable porque no todo salesperson histórico será resoluble (aunque en
-- esta fase, con la decisión de negocio de abajo, todos lo son). UNIQUE
-- porque una Person no debe poder ser simultáneamente "la misma persona"
-- que dos salespeople distintos — mismo principio que
-- user_profiles.person_id/user_profiles.salesperson_id. on delete set null
-- — igual que los otros dos FK hacia/desde people — para que salespeople
-- (crítica para folios) nunca se vea afectada por una acción sobre people.
--
-- =========================================================================
-- DECISIÓN DE NEGOCIO AUTORIZADA — salespeople históricos sin user_profile
-- pertenecen a Global Supplier MTY:
-- =========================================================================
-- Autorizado explícitamente: los salespeople sin user_profile asociado que
-- correspondan a la operación actual (incluye RPT/VVT) pertenecen a Global
-- Supplier MTY (slug 'global-supplier-mty'). Se resuelve por slug (mismo
-- patrón que 0013/0014/0015), nunca por UUID hardcodeado, y la migración
-- falla explícito (rollback completo) si esa organización no existe. Sin
-- esta autorización explícita, esta migración NO habría inventado ninguna
-- organización para ellos (ver Discovery Report de CORE 2C).
--
-- =========================================================================
-- DECISIÓN — sin matching por nombre:
-- =========================================================================
-- El backfill determinista (Caso A) usa exclusivamente el join existente
-- user_profiles.salesperson_id → salespeople.id (UNIQUE desde 0011) más
-- user_profiles.person_id (0015) — nunca coincidencia de texto. El
-- backfill histórico (Caso B) NO intenta emparejar salespeople con ninguna
-- Person ya existente por nombre: siempre crea una Person nueva por cada
-- salesperson sin user_profile, evitando fusionar accidentalmente dos
-- identidades distintas que compartan nombre.
--
-- =========================================================================
-- DECISIÓN — RLS de people: se agrega SOLO una policy INSERT, admin-scoped:
-- =========================================================================
-- Reutiliza is_organization_admin() (0013) — ninguna función SECURITY
-- DEFINER nueva. SELECT sigue exactamente igual que 0015 (solo ADMIN, sin
-- VENDEDOR). Sin policy de UPDATE/DELETE: ningún consumidor real las
-- necesita todavía. El backfill histórico de esta migración corre como
-- dueño de la tabla (no depende de esta policy); la policy solo existe
-- para que rpc_create_person_for_user (SECURITY INVOKER, corre con la
-- sesión del ADMIN que da de alta un usuario) pueda insertar en tiempo de
-- ejecución.
--
-- =========================================================================
-- DECISIÓN — rpc_create_person_for_user: cierra la brecha de CORE 2B sin
-- dejar estados parciales:
-- =========================================================================
-- SECURITY INVOKER (no DEFINER) — se apoya en la nueva policy
-- people_insert_admin y en user_profiles_admin_write (0011) ya existentes,
-- mismo principio que admin_update_user_role_and_active (0013): no duplica
-- autorización propia. Hace INSERT people + UPDATE user_profiles.person_id
-- en una sola llamada = una sola transacción Postgres: o se crean/vinculan
-- ambas cosas, o ninguna. Se llama como TERCER paso dentro de
-- insertProfileAndMembershipOrCompensate() (lib/user-access.ts), después
-- de organization_members. Si falla, la compensación ya existente
-- (compensateOrphanedAuthUser: borra el Auth User) sigue siendo suficiente
-- sin ningún cambio: el cascade de auth.users limpia user_profiles/
-- organization_members, y como la transacción de esta RPC se revirtió
-- completa, NUNCA queda una Person huérfana (a diferencia de si se hicieran
-- dos escrituras sueltas de app). "0 filas actualizadas" en
-- user_profiles (perfil inexistente o ya tenía Person) se detecta con GET
-- DIAGNOSTICS y aborta con excepción explícita, igual que
-- admin_update_user_role_and_active.
--
-- Como el resto del proyecto: idempotente donde corresponde (backfills
-- basados en person_id is null, do $$ if not exists $$ para policies/
-- constraints) y corre completa en una sola transacción (begin/commit).

begin;

-- =========================================================================
-- 1) salespeople.person_id
-- =========================================================================
alter table salespeople
  add column if not exists person_id uuid references people (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'salespeople_person_id_unique'
  ) then
    alter table salespeople
      add constraint salespeople_person_id_unique unique (person_id);
  end if;
end $$;

-- =========================================================================
-- 2) RLS de people — agrega policy INSERT admin-scoped. SELECT sin cambios
--    (ver 0015). Sin UPDATE/DELETE.
-- =========================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'people'
      and policyname = 'people_insert_admin'
  ) then
    create policy "people_insert_admin" on people
      for insert with check (is_organization_admin(organization_id));
  end if;
end $$;

-- =========================================================================
-- 3) rpc_create_person_for_user — ver justificación arriba.
-- =========================================================================
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
  v_person_id uuid;
  v_rows integer;
begin
  insert into people (organization_id, name, email, active)
  values (p_organization_id, p_name, p_email, p_active)
  returning id into v_person_id;

  update user_profiles
     set person_id = v_person_id
   where user_id = p_user_id
     and person_id is null;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'rpc_create_person_for_user: no se pudo vincular la Person a user_profiles de % (perfil inexistente o ya tenía una Person vinculada).', p_user_id;
  end if;
end;
$$;

-- =========================================================================
-- 4) Backfill Caso A — determinista, vía user_profiles ya vinculado a
--    Person (0015). Sin matching por nombre.
-- =========================================================================
do $$
declare
  v_linked_from_profile integer;
begin
  update salespeople sp
     set person_id = up.person_id
    from user_profiles up
   where up.salesperson_id = sp.id
     and up.person_id is not null
     and sp.person_id is null;

  get diagnostics v_linked_from_profile = row_count;

  raise notice 'CORE 2C backfill (Caso A): salespeople vinculados vía user_profiles.person_id existente=%', v_linked_from_profile;
end $$;

-- =========================================================================
-- 5) Backfill Caso B — decisión de negocio autorizada: salespeople sin
--    user_profile pertenecen a Global Supplier MTY. Resuelto por slug,
--    falla explícito si la organización no existe. Crea una Person nueva
--    por cada salesperson (nunca reutiliza/empareja una Person existente
--    por nombre) y vincula. Idempotente (solo sp.person_id is null).
-- =========================================================================
do $$
declare
  v_org_id uuid;
  v_row record;
  v_new_person_id uuid;
  v_created_from_history integer := 0;
  v_ambiguous_remaining integer;
begin
  select id into v_org_id from organizations where slug = 'global-supplier-mty';

  if v_org_id is null then
    raise exception 'CORE 2C: no se encontró la organización global-supplier-mty. Backfill histórico de salespeople abortado.';
  end if;

  for v_row in
    select sp.id, sp.name, sp.active
    from salespeople sp
    where sp.person_id is null
      and not exists (
        select 1 from user_profiles up where up.salesperson_id = sp.id
      )
  loop
    insert into people (organization_id, name, email, active)
    values (v_org_id, v_row.name, null, v_row.active)
    returning id into v_new_person_id;

    update salespeople set person_id = v_new_person_id where id = v_row.id;

    v_created_from_history := v_created_from_history + 1;
  end loop;

  -- Caso C: salespeople con user_profile, pero cuyo user_profiles.person_id
  -- sigue NULL (arrastrado de un caso ambiguo ya reportado por 0015 — sin
  -- organización resoluble o con múltiples). No se inventa ninguna
  -- relación aquí; se cuenta y se reporta, igual que 0015.
  select count(*)
    into v_ambiguous_remaining
  from salespeople sp
  where sp.person_id is null;

  raise notice 'CORE 2C backfill (Caso B): Person creadas para salespeople históricos sin user_profile (Global Supplier MTY)=%. Salespeople que permanecen sin person_id (Caso C, ambiguo, no resuelto)=%',
    v_created_from_history, v_ambiguous_remaining;
end $$;

commit;
