-- =========================================================================
-- THÖREN — Fase 8A (Parte A): fix folios de Quotes bloqueados por
-- person_id NULL en un salesperson recién creado (smoke test Tenant B)
-- =========================================================================
-- SÍNTOMA REAL: al configurar "Vendedor × Business Unit" (folio de
-- Quotes) para un salesperson recién creado vía /vendedores/nuevo (sin
-- login todavía asociado), la operación fallaba con:
--   "salesperson_quote_sequences: el salesperson % no tiene Person
--   vinculada (person_id NULL). No se puede configurar folio de Quotes
--   hasta resolver ese vínculo."
--
-- CAUSA REAL (no es un bug de provisioning ni de multi-tenant): 0020
-- (creado ANTES de 0051) documenta explícitamente que "salespeople NO
-- tiene organization_id propio — la única forma de resolver su
-- organización es salesperson_id -> person_id -> people.organization_id"
-- — por eso ambos triggers de esta migración (trg_check_salesperson_quote_
-- sequence_valid, trg_check_quote_consistency) exigían una Person
-- vinculada SOLO para poder resolver la organización del salesperson.
--
-- Esa premisa ya NO es cierta: 0051 (Fase 7A) agregó `salespeople.
-- organization_id` como columna propia, NOT NULL, siempre poblada — el
-- companion fix a esos dos triggers específicos simplemente no se hizo en
-- 0051 (se corrigieron las policies de salespeople y las funciones de
-- storage, pero no estos dos triggers de Quotes). El resultado es un
-- bloqueo artificial: cualquier salesperson recién creado (vía
-- /vendedores/nuevo, sin login asociado todavía — flujo normal y ya
-- soportado, ver 0042/0043) no puede usarse para folios de Quotes hasta
-- que alguien complete el alta de un login vinculado, aunque su
-- organización ya sea perfectamente resoluble sin ninguna Person.
--
-- =========================================================================
-- FIX — usar salespeople.organization_id directo, sin tocar 0042/0043
-- =========================================================================
-- Ambos triggers se reescriben (create or replace function, misma firma,
-- mismos nombres, mismos disparadores — cero cambios de esquema/DDL más
-- allá del cuerpo de las funciones) para leer organization_id
-- DIRECTAMENTE de `salespeople`, en vez de vía people.organization_id.
-- person_id se sigue leyendo en trg_check_salesperson_quote_sequence_valid
-- (ya NO como bloqueo duro, solo para las reglas de person_business_units
-- que siguen abajo) — cuando person_id es NULL, `count(*) from
-- person_business_units where person_id = NULL` naturalmente da 0 (una
-- comparación con NULL nunca es true en SQL), así que un salesperson sin
-- Person cae automáticamente en el mismo "fallback legacy: cualquier
-- Business Unit activa de su organización" que ya aplicaba a una Person
-- sin asignaciones explícitas — no es una rama nueva, es el
-- comportamiento ya existente extendido a un caso que antes ni siquiera
-- llegaba a evaluarse (se rechazaba antes, con la excepción de arriba).
--
-- 0042/0043 (reutilización de Person para un salesperson histórico al
-- darle login) quedan completamente intactos — ese flujo sigue siendo la
-- forma correcta de vincular una Person real cuando corresponda; este fix
-- solo deja de EXIGIRLA como requisito previo para poder configurar/usar
-- folios cuando la organización ya es resoluble sin ella.
--
-- NO se modifica ninguna tabla, ninguna policy RLS, ningún dato existente.
-- Global Supplier MTY no se ve afectado: sus salespeople históricos ya
-- tienen person_id poblado (backfill de 0016), así que ambas rutas
-- (con o sin Person) llegan al mismo resultado para ellos.

begin;

create or replace function trg_check_salesperson_quote_sequence_valid()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_person_id uuid;
  v_sp_org uuid;
  v_bu_org uuid;
  v_bu_active boolean;
  v_assigned_count integer;
  v_matching_assignment integer;
begin
  select organization_id, person_id into v_sp_org, v_person_id from salespeople where id = new.salesperson_id;

  select organization_id, active into v_bu_org, v_bu_active from business_units where id = new.business_unit_id;

  if v_sp_org is distinct from v_bu_org then
    raise exception
      'salesperson_quote_sequences: el salesperson % (organización %) y la business unit % (organización %) no pertenecen a la misma organización.',
      new.salesperson_id, v_sp_org, new.business_unit_id, v_bu_org;
  end if;

  if new.organization_id is distinct from v_bu_org then
    raise exception
      'salesperson_quote_sequences: organization_id (%) no coincide con la organización real de la business unit (%).',
      new.organization_id, v_bu_org;
  end if;

  select count(*) into v_assigned_count from person_business_units where person_id = v_person_id;

  if v_assigned_count > 0 then
    select count(*) into v_matching_assignment
      from person_business_units
      where person_id = v_person_id and business_unit_id = new.business_unit_id;

    if v_matching_assignment = 0 then
      raise exception
        'salesperson_quote_sequences: la Person del salesperson % tiene asignaciones explícitas en person_business_units, pero ninguna corresponde a la business unit %. Solo puede configurarse para sus Business Units asignadas.',
        new.salesperson_id, new.business_unit_id;
    end if;
  else
    -- Fallback legacy temporal (ver DECISIÓN 0020): sin asignaciones
    -- explícitas (incluye el caso "sin Person en absoluto" — ver arriba),
    -- cualquier Business Unit ACTIVA de la misma organización es válida.
    if not v_bu_active then
      raise exception
        'salesperson_quote_sequences: fallback legacy (sin asignaciones explícitas en person_business_units) solo permite Business Units activas; % está inactiva.',
        new.business_unit_id;
    end if;
  end if;

  return new;
end;
$$;

create or replace function trg_check_quote_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bu_org uuid;
  v_customer_org uuid;
  v_sp_org uuid;
begin
  select organization_id into v_bu_org from business_units where id = new.business_unit_id;
  select organization_id into v_customer_org from customers where id = new.customer_id;
  select organization_id into v_sp_org from salespeople where id = new.salesperson_id;

  if new.organization_id is distinct from v_bu_org
     or new.organization_id is distinct from v_customer_org
     or new.organization_id is distinct from v_sp_org then
    raise exception
      'quotes: organization_id (%) no es consistente entre business_unit (%), customer (%) y salesperson (%).',
      new.organization_id, v_bu_org, v_customer_org, v_sp_org;
  end if;

  return new;
end;
$$;

commit;
