-- THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — opción B (filtrar
-- también la creación real de Cotizaciones, no solo el selector visual).
--
-- =========================================================================
-- CONTEXTO
-- =========================================================================
-- `person_business_units` (0017) ya existe: relación N:M people↔business_units,
-- con columna `active`, trigger de integridad cross-org — pero sin ninguna
-- vía de ESCRITURA (solo policy SELECT, admin-only) desde que se creó. Hoy
-- solo tiene UN consumidor real: `trg_check_salesperson_quote_sequence_valid`
-- (0020/0054), que gatea qué Business Unit puede un ADMIN *configurar* como
-- folio de Cotización — nunca qué Business Unit puede un vendedor elegir al
-- cotizar. Esta migración agrega la administración explícita que 0020 ya
-- anticipaba ("cuando se implemente, el fallback legacy debe behave igual
-- para quien no tenga asignaciones") y, a petición explícita del ticket
-- (Opción B), también filtra la creación real de Cotizaciones — no solo el
-- selector — reutilizando exactamente la misma regla fallback-safe.
--
-- 100% aditivo: no se toca `trg_check_salesperson_quote_sequence_valid` ni
-- `salesperson_quote_sequences` (requisito 9: una Business Unit asignada NO
-- autoriza por sí sola la generación de folios — ese control sigue siendo
-- exclusivamente la fila activa de `salesperson_quote_sequences`, sin
-- cambios). `rpc_update_quote`/`rpc_create_quote_revision` tampoco se tocan:
-- ninguno de los dos acepta/cambia `business_unit_id`/`salesperson_id` (son
-- inmutables después de creada la Quote), así que el único punto de
-- creación real es `rpc_create_quote` — ver DECISIÓN abajo.
--
-- =========================================================================
-- DECISIÓN — rpc_set_person_business_units(), mismo patrón EXACTO que
-- rpc_set_user_departments (0093)
-- =========================================================================
-- SECURITY DEFINER para poder resolver la organización de la Person
-- DESTINO internamente y exigir is_organization_admin() sobre ESA
-- organización — "autorización exclusiva para administradores" (requisito
-- 2 del ticket), mismo criterio que 0093: nunca can_manage_users. Reemplaza
-- por completo la asignación previa en una sola llamada: BU presente en
-- el array → activa (se re-otorga si estaba inactiva); BU ausente pero con
-- fila existente → se desactiva (active=false, NUNCA DELETE — las vistas
-- de /personas ya muestran filas inactivas con un badge distinto, 0017,
-- así que borrar perdería ese historial visual sin necesidad). Solo
-- itera sobre las Business Units REALES de la organización de la Person
-- (nunca inserta una fila "false" para una BU que nunca se tocó).
--
-- =========================================================================
-- DECISIÓN — rpc_list_own_business_units(), mismo patrón EXACTO que
-- rpc_list_own_commissions (0083)
-- =========================================================================
-- La RLS de person_business_units (0017) es SELECT admin-only — un
-- vendedor no puede leer ni su propia fila. Para que el selector de
-- Cotización pueda filtrarse correctamente para un vendedor (requisito 6),
-- sin ampliar esa RLS (mismo criterio de 0083: preferir un RPC de "vista
-- propia" sobre ensanchar una policy existente), se agrega este RPC
-- SECURITY DEFINER, SIN PARÁMETROS: resuelve auth.uid() → user_profiles.
-- person_id → person_business_units internamente — nunca acepta un
-- person_id del cliente, así que es imposible pedir la asignación de otra
-- Persona a través de él.
--
-- =========================================================================
-- DECISIÓN — fn_check_business_unit_assigned_to_salesperson(), SECURITY
-- DEFINER, mismo motivo EXACTO que rpc_list_own_business_units
-- =========================================================================
-- `rpc_create_quote` es SECURITY INVOKER a propósito (ver comentario
-- original de 0020: "la RLS real se aplica sobre las escrituras internas,
-- esta función no bypassa autorización") — y eso NO se toca. Pero por
-- eso mismo, una lectura INLINE de `person_business_units` dentro de
-- rpc_create_quote hereda la RLS del INVOKER (admin-only, 0017): para un
-- VENDEDOR normal, cualquier SELECT directo sobre esa tabla devuelve 0
-- filas sin importar los datos reales — el chequeo nunca podría rechazar
-- nada. Esta función SECURITY DEFINER aísla EXCLUSIVAMENTE la lectura
-- (nunca escribe, nunca decide autorización de ESCRITURA — eso sigue
-- siendo rpc_set_person_business_units/is_organization_admin), para que
-- la regla fallback-safe se evalúe sobre los datos reales sin importar
-- quién llama. Devuelve `true` (permitido) también cuando el salesperson
-- no tiene Person vinculada — mismo criterio exacto que el fallback de
-- 0054 para ese caso.
--
-- =========================================================================
-- DECISIÓN — el nuevo chequeo en rpc_create_quote bypassa por completo
-- para ADMIN (actor), igual que isModuleAllowedForDepartments
-- =========================================================================
-- "Dirección con rol admin conserva acceso completo" (requisito 8) se
-- interpreta aquí EXACTAMENTE igual que en el módulo de Departamentos
-- (isModuleAllowedForDepartments, 0093): si quien EJECUTA el RPC es admin
-- (current_user_is_admin()), el chequeo nuevo se omite por completo, sin
-- importar las asignaciones del salesperson destino — un ADMIN sigue
-- pudiendo cotizar en nombre de cualquier vendedor para cualquier Business
-- Unit (flujo real y frecuente: el formulario de Cotizaciones permite a
-- un ADMIN elegir cualquier salesperson). Para un VENDEDOR normal (no
-- admin), la restricción se evalúa sobre su PROPIO salesperson_id — un
-- vendedor no puede pasar el salesperson_id de otro vendedor de todas
-- formas (ver `createQuote` en cotizaciones/actions.ts, sin cambios), así
-- que en la práctica el chequeo para un no-admin siempre termina
-- evaluando sus propias asignaciones. "Asignaciones ACTIVAS" (requisito
-- 6/7, wording literal del ticket): el chequeo nuevo filtra
-- EXPLÍCITAMENTE por `active = true` — a diferencia de
-- `trg_check_salesperson_quote_sequence_valid`, que no filtra por `active`
-- en absoluto (quirk preexistente, fuera de alcance, no se toca aquí).
-- VALIDACIÓN "acceso directo mediante RPC" (ticket): un VENDEDOR que
-- invoque rpc_create_quote directamente, sin pasar por el selector visual,
-- sigue bloqueado igual — el bypass es EXCLUSIVO del actor admin.
--
-- Copia completa de rpc_create_quote (vigente desde 0086, última
-- redefinición real) con el único cambio: el bloque nuevo entre la
-- resolución del salesperson y la generación del folio. Forward-only: esta
-- migración NUNCA edita 0020/0025/0031/0086, solo vuelve a redefinir la
-- función vía CREATE OR REPLACE, mismo patrón que 0047 con
-- admin_list_user_profiles().
--
-- Idempotente, transacción única.

begin;

-- =========================================================================
-- 1) rpc_set_person_business_units — ver DECISIÓN arriba.
-- =========================================================================
create or replace function rpc_set_person_business_units(p_person_id uuid, p_business_unit_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_requested uuid[];
  v_valid_count integer;
  v_bu_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  select organization_id into v_organization_id from people where id = p_person_id;
  if v_organization_id is null or not is_organization_admin(v_organization_id) then
    raise exception 'Persona no encontrada o no tienes autoridad de administrador sobre su organización.';
  end if;

  select array_agg(distinct d) into v_requested
    from unnest(coalesce(p_business_unit_ids, array[]::uuid[])) as d;
  v_requested := coalesce(v_requested, array[]::uuid[]);

  if array_length(v_requested, 1) > 0 then
    select count(*) into v_valid_count
      from business_units
      where id = any(v_requested) and organization_id = v_organization_id;
    if v_valid_count <> array_length(v_requested, 1) then
      raise exception 'Business Unit inválida o de otra organización.';
    end if;
  end if;

  for v_bu_id in select id from business_units where organization_id = v_organization_id loop
    if v_bu_id = any(v_requested) then
      insert into person_business_units (person_id, business_unit_id, active)
        values (p_person_id, v_bu_id, true)
      on conflict (person_id, business_unit_id) do update set active = true;
    else
      update person_business_units
        set active = false
        where person_id = p_person_id and business_unit_id = v_bu_id and active = true;
    end if;
  end loop;
end;
$$;

-- =========================================================================
-- 2) rpc_list_own_business_units — ver DECISIÓN arriba.
-- =========================================================================
create or replace function rpc_list_own_business_units()
returns table (business_unit_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  if not current_user_active() then
    return;
  end if;

  select person_id into v_person_id from user_profiles where user_id = auth.uid();
  if v_person_id is null then
    return;
  end if;

  return query
    select pbu.business_unit_id from person_business_units pbu
    where pbu.person_id = v_person_id and pbu.active = true;
end;
$$;

-- =========================================================================
-- 3) fn_check_business_unit_assigned_to_salesperson — ver DECISIÓN arriba.
--    Única lectura "cruda" de person_business_units en este chequeo —
--    SECURITY DEFINER precisamente para no heredar la RLS admin-only del
--    INVOKER real de rpc_create_quote (un vendedor).
-- =========================================================================
create or replace function fn_check_business_unit_assigned_to_salesperson(p_salesperson_id uuid, p_business_unit_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
  v_assigned_count integer;
  v_matching_count integer;
begin
  select person_id into v_person_id from salespeople where id = p_salesperson_id;
  if v_person_id is null then
    return true;
  end if;

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

-- =========================================================================
-- 4) rpc_create_quote — redefinición completa (vigente desde 0086), con el
--    único bloque nuevo señalado abajo.
-- =========================================================================
create or replace function rpc_create_quote(
  p_quote_id uuid,
  p_quote jsonb,
  p_items jsonb default '[]'::jsonb
)
returns quotes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quote quotes;
  v_business_unit_id uuid := (p_quote->>'business_unit_id')::uuid;
  v_salesperson_id uuid := (p_quote->>'salesperson_id')::uuid;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_quote_date date := coalesce((p_quote->>'quote_date')::date, current_date);
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := coalesce((p_quote->>'valid_until')::date, (coalesce((p_quote->>'quote_date')::date, current_date) + 15));
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');
  v_warranty text := nullif(p_quote->>'warranty', '');

  v_organization_id uuid;
  v_bu_name text;
  v_bu_code text;
  v_sp_name text;
  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_folio_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_discount_percent numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := 0;
  v_global_discount_amount numeric(12,2);
  v_taxable_base numeric(12,2);
  v_tax_total numeric(12,2);
  v_total numeric(12,2);
begin
  select organization_id, name, code into v_organization_id, v_bu_name, v_bu_code
    from business_units where id = v_business_unit_id;
  if v_organization_id is null then
    raise exception 'rpc_create_quote: business unit % no encontrada.', v_business_unit_id;
  end if;

  select name into v_sp_name from salespeople where id = v_salesperson_id;
  if v_sp_name is null then
    raise exception 'rpc_create_quote: salesperson % no encontrado.', v_salesperson_id;
  end if;

  -- THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — único bloque nuevo.
  -- Bypass total si el ACTOR es admin (ver DECISIÓN de cabecera —
  -- "Dirección conserva acceso completo"). La lectura real de
  -- person_business_units vive en fn_check_business_unit_assigned_to_salesperson
  -- (SECURITY DEFINER) — nunca inline aquí, porque rpc_create_quote sigue
  -- siendo SECURITY INVOKER y un SELECT directo heredaría la RLS
  -- admin-only de esa tabla (0017), dando siempre "0 asignaciones" para
  -- un vendedor sin importar los datos reales. Esa función ya aplica el
  -- fallback-safe (requisito 7) y el caso sin Person vinculada (0054).
  if not current_user_is_admin() then
    if not fn_check_business_unit_assigned_to_salesperson(v_salesperson_id, v_business_unit_id) then
      raise exception
        'rpc_create_quote: el vendedor % no tiene asignada la Business Unit % — solo puede cotizar para sus Business Units asignadas.',
        v_salesperson_id, v_business_unit_id;
    end if;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote: customer % no encontrado.', v_customer_id;
  end if;

  select * into v_folio_result from fn_next_quote_folio(v_salesperson_id, v_business_unit_id, v_quote_date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is not null then
      perform fn_check_quote_item_catalog_product(v_catalog_product_id, v_organization_id, v_business_unit_id);
    end if;
    perform fn_check_rich_text_safety(v_item->>'customer_requirements');

    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_discount_total := v_discount_total + v_line_discount_amount;
  end loop;

  v_global_discount_amount := round(v_subtotal * v_global_discount_percent / 100, 2);
  v_discount_total := v_discount_total + v_global_discount_amount;
  v_taxable_base := v_subtotal - v_global_discount_amount;
  v_tax_total := round(v_taxable_base * v_tax_rate / 100, 2);
  v_total := v_taxable_base + v_tax_total;

  insert into quotes (
    id, organization_id, business_unit_id, salesperson_id, customer_id,
    folio, sequence_number, quote_date, status,
    currency, tax_rate, global_discount_percent, valid_until,
    customer_name, customer_legal_name, customer_tax_id,
    business_unit_name, business_unit_code, salesperson_name,
    subtotal, discount_total, tax_total, total, notes,
    payment_terms, delivery_time, customer_notes, warranty
  )
  values (
    p_quote_id, v_organization_id, v_business_unit_id, v_salesperson_id, v_customer_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_quote_date, 'borrador',
    v_currency, v_tax_rate, v_global_discount_percent, v_valid_until,
    v_customer_name, v_customer_legal_name, v_customer_tax_id,
    v_bu_name, v_bu_code, v_sp_name,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_notes,
    v_payment_terms, v_delivery_time, v_customer_notes, v_warranty
  )
  returning * into v_quote;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_line_discount_percent := coalesce((v_item->>'line_discount_percent')::numeric, 0);
    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_line_discount_percent / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;

    insert into quote_items (
      quote_id, position, catalog_product_id, model, description, quantity, unit_price,
      line_discount_percent, line_subtotal, unit, customer_requirements,
      customer_requirements_visible_in_pdf
    )
    values (
      v_quote.id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal,
      nullif(v_item->>'unit', ''), nullif(v_item->>'customer_requirements', ''),
      coalesce((v_item->>'customer_requirements_visible_in_pdf')::boolean, true)
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

commit;
