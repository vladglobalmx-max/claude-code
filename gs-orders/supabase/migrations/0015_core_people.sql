-- GS Orders — Migración 0015: THÖREN Core 2B — People Foundation
--
-- Tercera pieza de THÖREN Core: introduce `people`, la identidad HUMANA
-- dentro de una organización — distinta de auth.users (cómo entra al
-- sistema), organization_members (a qué organización pertenece y con qué
-- rol) y salespeople (identidad comercial que hoy controla folios). SIN
-- tocar el modelo de acceso ni el comportamiento visible actual de GS
-- Orders.
--
-- =========================================================================
-- DISCOVERY — modelo de identidad encontrado antes de diseñar esto:
-- =========================================================================
-- AUTH USER (auth.users) → USER_PROFILE (user_profiles.user_id, 1:1) →
--   salesperson_id nullable → SALESPEOPLE (opcional, solo si role=vendedor,
--   unique — un salesperson tiene a lo más un user_profile).
-- AUTH USER → ORGANIZATION_MEMBER (organization_members.user_id, N:M,
--   aunque hoy en la práctica siempre 1:1 porque insertProfileAndMembership-
--   OrCompensate() crea ambas filas juntas y 0013 backfillió 1 por usuario).
-- No existe hoy ninguna tabla `people`, ni columna created_by/updated_by en
-- ninguna migración, ni ningún concepto de persona separado de
-- user_profiles/salespeople. name está duplicado hoy en tres lugares sin
-- sincronización: user_profiles.name, salespeople.name y
-- auth.users.raw_user_meta_data (no usado por la app). email vive
-- únicamente en auth.users (character varying(255)).
-- salespeople NO tiene organization_id (ver CORE 2A: deliberadamente fuera
-- de alcance) y NO tiene ninguna FK hacia auth.users/user_profiles — la
-- única relación es user_profiles.salesperson_id → salespeople.id, y es
-- opcional en ambos sentidos: un salesperson puede no tener ningún
-- user_profile (vendedor sin login, ej. históricos RPT/VVT mencionados en
-- el Discovery Report de CORE 2), y un user_profile ADMIN puede no tener
-- salesperson_id.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Crea `people`, organization-scoped, con el modelo mínimo: id,
--    organization_id, name, email (nullable), active, created_at,
--    updated_at. Ver decisiones de columnas más abajo.
-- 2) RLS propia, reutilizando is_organization_admin() de 0013 — NO se crea
--    ningún helper SECURITY DEFINER nuevo. Única policy: SELECT, y SOLO
--    para ADMIN de la organización (ver justificación de asimetría con
--    business_units más abajo). Sin policy de insert/update/delete.
-- 3) Agrega `user_profiles.person_id` (nullable, UNIQUE cuando no es null,
--    on delete set null) — ver justificación concreta más abajo: no es
--    decoración arquitectónica, es el mecanismo que hace el bootstrap de
--    abajo verificable e idempotente.
-- 4) Bootstrap: crea una Person por cada user_profiles con EXACTAMENTE una
--    organización (vía organization_members), copiando name/active desde
--    user_profiles y email desde auth.users, y enlaza person_id. Determinista,
--    idempotente (basado en person_id is null, nunca en coincidencia de
--    nombre), org-scoped por fila (nunca UUID hardcodeado, nunca LIMIT 1
--    silencioso), y reporta (no inventa) los casos que no puede resolver
--    con seguridad: usuarios sin ninguna organización, usuarios con más de
--    una, y salespeople sin usuario asociado.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO crea person_business_units (bridge many-to-many Persona↔BusinessUnit)
--   — CORE 2B es fundación, esa relación es CORE 2C o posterior.
-- - NO agrega salespeople.person_id. salespeople controla hoy elementos
--   críticos de GS Orders (fn_next_order_folio, prefix, sequence_current).
--   Vincularlo a people en esta misma fase aumentaría el blast radius sin
--   dar valor inmediato — la FK, y sobre todo el backfill de vendedores sin
--   login (RPT/VVT), quedan explícitamente para CORE 2C, que es además
--   donde ya se había anticipado ese backfill en el Discovery Report de
--   CORE 2.
-- - NO modifica orders, order_items, ni ningún RPC de pedidos.
-- - NO toca fn_next_order_folio(), trg_set_order_folio,
--   trg_prevent_folio_change, prefix, sequence_current.
-- - NO toca la columna legacy `business_unit` (text) de salespeople/orders.
-- - NO toca business_units (CORE 2A) — ninguna columna, RLS ni seed.
-- - NO toca createUserAccess/createUserAccessLink/updateUserAccess ni
--   ninguna Server Action: person_id no se referencia en ningún INSERT/
--   UPDATE de la app todavía, así que el alta de un usuario nuevo sigue
--   funcionando exactamente igual (person_id simplemente queda NULL para
--   cualquier usuario dado de alta después de esta migración — se reporta
--   como brecha conocida, no se resuelve aquí).
-- - NO crea ninguna pantalla ni UI de administración de people.
--
-- =========================================================================
-- DECISIÓN — people.name (no first_name/last_name):
-- =========================================================================
-- user_profiles.name y salespeople.name son ambos `text not null` sin
-- separación de nombre/apellido, y ningún flujo actual (PDF, formularios,
-- listados) separa nombre de apellido en ningún punto de la app. Partir
-- name en dos columnas ahora sería una normalización sin consumidor real.
-- Se usa `name text not null`, igual que las dos tablas de las que hoy se
-- copia el dato.
--
-- =========================================================================
-- DECISIÓN — people.email: existe, es NULLABLE, SIN unique constraint:
-- =========================================================================
-- Existe porque es la única forma de correlacionar en el futuro una Person
-- con su auth.users (que sí es la identidad de login real) sin adivinar por
-- nombre. Es nullable porque el propio diagrama objetivo de esta fase
-- contempla personas sin Auth User (empleados sin login) — exigir email
-- obligaría a inventar uno. Se decide NO agregar UNIQUE (ni global ni por
-- organización) en esta fase: (1) no existe ningún flujo real hoy que
-- busque una Person por email — el único consumidor de email hoy es
-- auth.users, que Supabase ya mantiene único a su manera; (2) esta
-- migración no tiene visibilidad de los datos reales de producción para
-- garantizar que agregar esa constraint no rompa el bootstrap si existiera
-- algún duplicado legítimo no verificado; (3) es exactamente el tipo de
-- restricción prematura ("por si acaso") que el proyecto evita agregar sin
-- un consumidor concreto. Si en el futuro surge un flujo real de búsqueda
-- por email, esa es la fase correcta para agregar la constraint,
-- auditando primero los datos reales existentes en ese momento.
--
-- =========================================================================
-- DECISIÓN — identidad propia, NO auth.users.id como PK:
-- =========================================================================
-- people.id es un uuid propio (gen_random_uuid()), nunca igual a
-- auth.users.id. Una Person puede existir sin Auth User (el diagrama
-- objetivo la marca como "opcional"), así que atar su identidad primaria a
-- una tabla de la que puede no formar parte sería estructuralmente
-- incorrecto y bloquearía ese caso desde el diseño.
--
-- =========================================================================
-- DECISIÓN — user_profiles.person_id SÍ se agrega ahora (con una razón
-- concreta, no por elegancia arquitectónica):
-- =========================================================================
-- people no tiene ninguna clave de negocio natural (name no es único,
-- email es nullable y sin constraint) sobre la que apoyar un ON CONFLICT
-- para hacer el bootstrap idempotente. Sin una columna de enlace, la única
-- forma de detectar en una segunda ejecución "esta Person ya fue creada
-- para este usuario" sería adivinar por nombre — exactamente lo que este
-- proyecto prohíbe. user_profiles.person_id resuelve esto de forma
-- estructural: el bootstrap de abajo solo considera user_profiles con
-- person_id is null, así que una segunda ejecución no encuentra candidatos
-- y no crea nada — idempotencia real, no por coincidencia de datos. Es
-- nullable (un usuario sin Person vinculada aún sigue siendo un
-- user_profiles válido) y UNIQUE cuando no es null (mismo patrón que
-- user_profiles.salesperson_id en 0011: a lo más un user_profile por
-- Person). on delete set null — igual que salesperson_id — para que la
-- fila de user_profiles nunca se destruya por una acción sobre people. No
-- se referencia en createUserAccess/createUserAccessLink/updateUserAccess:
-- el INSERT de user_profiles que ya existe sigue funcionando exactamente
-- igual (la columna nueva simplemente queda NULL por defecto).
--
-- =========================================================================
-- DECISIÓN — RLS de people: SOLO ADMIN, ni siquiera VENDEDOR activo (a
-- diferencia de business_units en CORE 2A):
-- =========================================================================
-- Se evaluó reproducir el patrón de business_units (ADMIN ve todo,
-- VENDEDOR ve solo activas) pero se descarta: (1) hoy no existe NINGÚN
-- consumidor real que necesite que un VENDEDOR lea `people` — no hay UI, no
-- hay flujo, a diferencia de business_units que ya se proyecta como catálogo
-- de selección; (2) `people` expone email, un dato más sensible que un
-- catálogo de unidades de negocio, y ampliar su visibilidad sin un
-- consumidor real violaría el principio de mínimo privilegio explícito de
-- esta fase. Por tanto la única policy es SELECT para ADMIN de la propia
-- organización (activas e inactivas, igual que business_units, porque el
-- ADMIN sí necesita poder auditar/administrar en el futuro). Un usuario no-
-- admin (vendedor) no tiene ninguna policy que le aplique → 0 filas, sin
-- excepción. Un ADMIN con membership inactiva tampoco: is_organization_admin()
-- (0013) ya exige active = true en la membership. Sin policy de insert/
-- update/delete — el bootstrap corre como dueño de la tabla.
--
-- =========================================================================
-- DECISIÓN — bootstrap: qué persona se resuelve y cuál se reporta sin
-- inventar:
-- =========================================================================
-- Fuente de organización: organization_members (única fuente confiable de
-- organization_id para una persona hoy — salespeople no tiene
-- organization_id). Para cada user_profiles con person_id is null, se
-- cuentan sus organization_members DISTINCT (array_agg, mismo patrón que
-- current_user_organization_id() en 0013 — uuid no tiene min()/max()
-- nativo): si son 0, se omite y se reporta (usuario sin organización
-- resoluble, no se inventa una); si son más de 1, se omite y se reporta
-- (mismo caso límite que current_user_organization_id() ya trata con una
-- excepción explícita en tiempo de ejecución — aquí, en un bootstrap
-- masivo, se omite esa fila puntual en vez de abortar toda la migración,
-- y se reporta el conteo); si es exactamente 1, se crea la Person y se
-- vincula. salespeople sin ningún user_profile asociado (vendedores sin
-- login, ej. RPT/VVT) NO reciben Person en esta fase — no hay ninguna
-- fuente confiable de organization_id para ellos hoy (ver ALCANCE arriba);
-- se cuentan y reportan, nunca se les asigna una organización adivinada.
--
-- Como el resto del proyecto: crea/reemplaza todo de forma idempotente
-- (create table if not exists, do $$ if not exists $$ para policies/
-- constraints, bootstrap basado en person_id is null) y corre completa en
-- una sola transacción (begin/commit) — si algo falla, TODA la migración
-- se revierte, nunca queda people o person_id parcialmente sembrada.

begin;

-- =========================================================================
-- 1) people
-- =========================================================================
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete restrict,
  name text not null,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_organization_idx on people (organization_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_people_updated_at') then
    create trigger trg_people_updated_at
      before update on people
      for each row execute function set_updated_at();
  end if;
end $$;

-- =========================================================================
-- 2) RLS de people — reutiliza is_organization_admin() de 0013. No se crea
--    ningún helper SECURITY DEFINER nuevo. Única policy: SELECT, solo
--    ADMIN de la organización (ver justificación arriba de por qué NO se
--    replica el acceso de VENDEDOR que sí tiene business_units). Sin
--    policy de insert/update/delete: el bootstrap corre como dueño de la
--    tabla.
-- =========================================================================
alter table people enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'people'
      and policyname = 'people_select_admin'
  ) then
    create policy "people_select_admin" on people
      for select using (is_organization_admin(organization_id));
  end if;
end $$;

-- =========================================================================
-- 3) user_profiles.person_id — nullable, UNIQUE cuando no es null (mismo
--    patrón que user_profiles.salesperson_id en 0011), on delete set null.
--    Ver justificación arriba: es el mecanismo de idempotencia del
--    bootstrap, no una adición "por si acaso". No se referencia en ningún
--    INSERT existente de la app, así que el alta de usuarios sigue
--    funcionando exactamente igual (persona_id queda NULL para usuarios
--    nuevos hasta una fase futura que la conecte).
-- =========================================================================
alter table user_profiles
  add column if not exists person_id uuid references people (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_person_id_unique'
  ) then
    alter table user_profiles
      add constraint user_profiles_person_id_unique unique (person_id);
  end if;
end $$;

-- =========================================================================
-- 4) Bootstrap: crea una Person por cada user_profiles resoluble a
--    EXACTAMENTE una organización y la vincula vía person_id. Idempotente
--    (solo considera person_id is null), determinista, sin adivinar
--    relaciones que no puede resolver con seguridad.
-- =========================================================================
do $$
declare
  v_row record;
  v_new_person_id uuid;
  v_people_created integer := 0;
  v_profiles_skipped_no_org integer := 0;
  v_profiles_skipped_multi_org integer := 0;
  v_salespeople_without_user integer := 0;
begin
  for v_row in
    select
      up.user_id,
      up.name,
      up.active,
      u.email,
      (
        select array_agg(distinct om.organization_id)
        from organization_members om
        where om.user_id = up.user_id
      ) as org_ids
    from user_profiles up
    join auth.users u on u.id = up.user_id
    where up.person_id is null
  loop
    if v_row.org_ids is null or array_length(v_row.org_ids, 1) = 0 then
      v_profiles_skipped_no_org := v_profiles_skipped_no_org + 1;
      continue;
    elsif array_length(v_row.org_ids, 1) > 1 then
      v_profiles_skipped_multi_org := v_profiles_skipped_multi_org + 1;
      continue;
    end if;

    insert into people (organization_id, name, email, active)
    values (v_row.org_ids[1], v_row.name, v_row.email, v_row.active)
    returning id into v_new_person_id;

    update user_profiles set person_id = v_new_person_id where user_id = v_row.user_id;

    v_people_created := v_people_created + 1;
  end loop;

  select count(*)
    into v_salespeople_without_user
  from salespeople sp
  where not exists (
    select 1 from user_profiles up where up.salesperson_id = sp.id
  );

  raise notice 'CORE 2B bootstrap: people creadas=%, user_profiles sin organización resoluble (omitidos)=%, user_profiles con múltiples organizaciones (omitidos)=%, salespeople sin usuario asociado (sin Person en esta fase)=%',
    v_people_created, v_profiles_skipped_no_org, v_profiles_skipped_multi_org, v_salespeople_without_user;
end $$;

commit;
