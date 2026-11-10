-- THÖREN — Corrección 0095: resolución de identidad del vendedor para la
-- restricción de Business Units (0094).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- Diagnóstico confirmado (THÖREN | SEGUNDO FALLO EN PRODUCCIÓN — BUSINESS
-- UNITS NO PERSISTEN, ver supabase/tests/salesperson_person_link_business_
-- unit_gap_tests.sql): fn_check_business_unit_assigned_to_salesperson
-- (0094) resuelve la Person del vendedor EXCLUSIVAMENTE vía
-- salespeople.person_id. Ese campo nunca se vincula en el único flujo real
-- que la UI permite hoy — /vendedores/nuevo (createSalesperson,
-- vendedores/actions.ts) crea el salesperson SIN person_id, y al invitar
-- después un usuario vinculado a ese salesperson,
-- rpc_create_person_for_user (0016) crea una Person NUEVA e independiente,
-- vinculada únicamente a user_profiles.person_id — nunca a
-- salespeople.person_id. Resultado: el chequeo cae siempre en su propio
-- fallback "sin Person vinculada => permitido", para CUALQUIER Business
-- Unit, asignada o no — la restricción es un no-op para todo vendedor
-- creado por el flujo real.
--
-- =========================================================================
-- DECISIÓN — Opción B (autorizada explícitamente): ampliar la resolución
-- de identidad, NO el flujo de creación
-- =========================================================================
-- En vez de tocar rpc_create_person_for_user/createSalesperson (que
-- cambiaría el flujo de alta de usuarios, fuera del alcance autorizado),
-- esta migración redefine ÚNICAMENTE fn_check_business_unit_assigned_to_
-- salesperson (CREATE OR REPLACE, mismo patrón forward-only que 0094
-- redefinió rpc_create_quote sin editar 0086): añade una SEGUNDA fuente de
-- identidad, la vinculación YA EXISTENTE user_profiles.salesperson_id ->
-- user_profiles.person_id (poblada por el flujo real de invitación), que
-- se usa SOLO cuando salespeople.person_id es NULL.
--
-- rpc_create_quote (0094) NUNCA se toca aquí: sigue llamando a esta misma
-- función por nombre, así que el fix aplica automáticamente a su único
-- punto de uso real sin redefinir esa función ni su admin bypass (que vive
-- en rpc_create_quote, evaluado ANTES de llamar a esta función — un
-- vendedor nunca puede alcanzar ese bypass, sigue exclusivo del actor
-- admin, sin cambios).
--
-- =========================================================================
-- DECISIÓN — orden de prioridad: salespeople.person_id PRIMERO
-- =========================================================================
-- salespeople.person_id es la fuente "oficial" históricamente (backfill de
-- 0016, Casos A/B) y la más directa semánticamente (identidad del
-- vendedor comercial). user_profiles.person_id vía salesperson_id es el
-- fallback que cierra la brecha real de hoy. Si AMBAS existen y coinciden,
-- no hay ambigüedad. Si ambas existen y DIFIEREN, es una inconsistencia de
-- datos real (dos Person distintas reclamando ser el mismo vendedor) — se
-- rechaza explícitamente (requisito 3), nunca se elige una al azar, para
-- que una inconsistencia de datos nunca se traduzca en una forma de eludir
-- la restricción.
--
-- =========================================================================
-- DECISIÓN — por qué no hace falta deduplicar "múltiples user_profiles"
-- =========================================================================
-- user_profiles_salesperson_id_unique (0011) ya garantiza que, como máximo,
-- UN user_profiles puede tener un salesperson_id dado — así que la única
-- ambigüedad posible es "salespeople.person_id vs. ese único
-- user_profiles.person_id", nunca "varios candidatos del lado de
-- user_profiles". No se duplica esa validación aquí.
--
-- =========================================================================
-- DECISIÓN — requisito 2 (misma organización): se valida la Person
-- resuelta, sea cual sea la fuente
-- =========================================================================
-- salespeople.organization_id (0051, not null) es la referencia. Si la
-- Person resuelta (por cualquiera de las dos fuentes) pertenece a otra
-- organización, se rechaza explícitamente — defensa en profundidad incluso
-- aunque los triggers de integridad existentes (0017: person_business_units
-- misma org) ya deberían impedir que esto ocurra en la práctica.
--
-- =========================================================================
-- DECISIÓN — requisito 4 (comportamiento heredado): solo cuando NINGUNA
-- fuente resuelve una Person
-- =========================================================================
-- Si ninguna de las dos fuentes da una Person (salesperson inexistente, o
-- existente pero sin person_id propio NI usuario vinculado con person_id),
-- no hay ninguna asignación aplicable que evaluar — se mantiene el
-- fallback original: permitido, igual que el comportamiento previo a 0094
-- para cualquier vendedor sin Person resoluble.
--
-- =========================================================================
-- DECISIÓN — requisito 6 (cotizaciones existentes intactas)
-- =========================================================================
-- Esta función es STABLE y de solo lectura — nunca escribe en quotes,
-- quote_items ni ninguna otra tabla. Cambia únicamente la respuesta de una
-- verificación evaluada en el momento de CREAR una Quote nueva
-- (rpc_create_quote, sin cambios). Ninguna cotización ya existente ni su
-- propietario se tocan por esta migración.
--
-- Idempotente (create or replace function), transacción única.

begin;

create or replace function fn_check_business_unit_assigned_to_salesperson(p_salesperson_id uuid, p_business_unit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sp_org uuid;
  v_sp_person_id uuid;
  v_profile_person_id uuid;
  v_person_id uuid;
  v_person_org uuid;
  v_assigned_count integer;
  v_matching_count integer;
begin
  select organization_id, person_id into v_sp_org, v_sp_person_id
    from salespeople where id = p_salesperson_id;

  if v_sp_org is null then
    -- salesperson inexistente: ninguna fuente puede resolver nada —
    -- comportamiento heredado (requisito 4).
    return true;
  end if;

  -- Fuente secundaria — se consulta SIEMPRE (no solo cuando la primaria es
  -- NULL): es la única forma de detectar una identidad ambigua cuando
  -- AMBAS fuentes existen y difieren (requisito 3). Solo se usa su valor
  -- como resultado final cuando la primaria es NULL (ver coalesce abajo).
  -- user_profiles_salesperson_id_unique (0011) garantiza como máximo una
  -- fila candidata.
  select person_id into v_profile_person_id
    from user_profiles
    where salesperson_id = p_salesperson_id and person_id is not null;

  -- Requisito 3 — identidad ambigua: ambas fuentes resuelven una Person y
  -- no coinciden. Se rechaza con excepción explícita, nunca se elige una
  -- al azar ni se permite por default.
  if v_sp_person_id is not null and v_profile_person_id is not null and v_sp_person_id <> v_profile_person_id then
    raise exception
      'fn_check_business_unit_assigned_to_salesperson: identidad ambigua para el salesperson % — salespeople.person_id (%) y user_profiles.person_id (%) no coinciden.',
      p_salesperson_id, v_sp_person_id, v_profile_person_id;
  end if;

  v_person_id := coalesce(v_sp_person_id, v_profile_person_id);

  if v_person_id is null then
    -- Ninguna fuente resuelve una Person — comportamiento heredado
    -- (requisito 4): sin Person, ninguna asignación es aplicable.
    return true;
  end if;

  -- Requisito 2 — la Person resuelta (por cualquiera de las dos fuentes)
  -- debe pertenecer a la misma organización que el salesperson.
  select organization_id into v_person_org from people where id = v_person_id;
  if v_person_org is distinct from v_sp_org then
    raise exception
      'fn_check_business_unit_assigned_to_salesperson: la Person resuelta (%) no pertenece a la misma organización que el salesperson % (% vs %).',
      v_person_id, p_salesperson_id, v_person_org, v_sp_org;
  end if;

  -- Resto: idéntico al criterio original (0094) — fallback-safe sobre
  -- asignaciones ACTIVAS.
  select count(*) into v_assigned_count from person_business_units
    where person_id = v_person_id and active = true;
  if v_assigned_count = 0 then
    return true;
  end if;

  select count(*) into v_matching_count from person_business_units
    where person_id = v_person_id and business_unit_id = p_business_unit_id and active = true;
  return v_matching_count > 0;
end;
$$;

commit;
