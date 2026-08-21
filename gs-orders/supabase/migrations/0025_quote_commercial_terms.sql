-- GS Orders — Migración 0025: THÖREN Quote Commercial Terms
--
-- Agrega a `quotes` tres campos comerciales dirigidos al CLIENTE —
-- forma de pago, tiempo de entrega, observaciones — que el Quote PDF
-- Premium (fase anterior) necesita para su nueva sección "Condiciones
-- comerciales"/"Observaciones", sin inventar ningún dato: hoy esos tres
-- conceptos simplemente no existen en el modelo. Implementa exactamente
-- lo aprobado en "THÖREN — Quote Commercial Terms + Ajuste final Quote
-- PDF Premium" de esta misma sesión.
--
-- =========================================================================
-- ALCANCE — qué SÍ hace esta migración
-- =========================================================================
-- 1) Agrega `quotes.payment_terms`, `quotes.delivery_time`,
--    `quotes.customer_notes` — los tres nullable/opcionales, sin default
--    (nunca se inventa un valor para Quotes existentes; quedan NULL).
--    Nombres alineados con la convención ya usada en esta tabla
--    (customer_name/customer_legal_name/customer_tax_id son snapshots
--    "sobre o para el cliente"; customer_notes sigue el mismo prefijo
--    porque es contenido DIRIGIDO al cliente — a diferencia de `notes`,
--    que es la anotación interna del equipo, nunca impresa, y que esta
--    migración NO toca ni reutiliza).
-- 2) Actualiza rpc_create_quote/rpc_update_quote (CREATE OR REPLACE, misma
--    firma) para leer las tres claves opcionales del jsonb `p_quote` y
--    persistirlas exactamente igual que el resto del contenido comercial
--    — server-side, en la misma transacción, sin RPC nueva. Un payload
--    que no incluya esas claves simplemente las guarda NULL (p_quote->>
--    sobre una clave ausente ya es NULL en jsonb, mismo comportamiento
--    que el resto de campos opcionales de este RPC).
-- 3) Actualiza trg_quote_status_transition (CREATE OR REPLACE, mismo
--    trigger ya existente) para incluir payment_terms/delivery_time/
--    customer_notes en el congelamiento de contenido comercial fuera de
--    "borrador" — mismo criterio que customer_tax_id/business_unit_name/
--    etc.: son condiciones comerciales con las que la Quote fue emitida,
--    no deben poder cambiar una vez enviada/aceptada/rechazada/cancelada.
--    `notes` (interna) sigue exenta de este congelamiento — sin cambios
--    ahí.
--
-- =========================================================================
-- ALCANCE — qué NO hace esta migración (deliberadamente)
-- =========================================================================
-- - NO agrega RLS nueva: las policies existentes de `quotes`
--   (quotes_select_own_or_admin/quotes_insert_own_or_admin/
--   quotes_update_own_or_admin, 0020) son por FILA, no por columna — ya
--   cubren estas tres columnas nuevas exactamente igual que cualquier otra
--   columna de la tabla. Ninguna policy se reemplaza ni se relaja.
-- - NO crea ninguna función SECURITY DEFINER nueva.
-- - NO toca `quote_items`, `orders`, `order_items`, `rpc_create_order`,
--   `rpc_create_order_from_quote` (0023) — ese RPC arma su propio jsonb
--   explícito de columnas para Orders (salesperson_id/order_date/
--   client_name/product_type/customer_id/business_unit_id/
--   source_quote_id) y jamás lee columnas nuevas de `quotes` por nombre;
--   como internamente hace `select * into v_quote from quotes ...`, el
--   tipo `v_quote` gana las tres columnas nuevas automáticamente, pero
--   ningún código las lee ni las usa — cero impacto funcional en
--   Quote → Order.
-- - NO toca `quote.notes` (nota interna, ver 0020/Q5) — sigue siendo
--   exclusivamente interna, nunca impresa, sin cambios de columna ni de
--   semántica.
-- - NO agrega columnas a `quote_items` (sin "unidad" por línea, sin IVA
--   por línea — fuera de alcance, ver discovery del Quote PDF Premium).
-- - NO toca datos fiscales del emisor (Organization/Business Unit), QR,
--   Order PDF, Inventory, Purchasing.
--
-- Como el resto del proyecto: idempotente (add column if not exists,
-- create or replace para funciones) y corre completa en una sola
-- transacción (begin/commit). Quotes existentes: los tres campos nuevos
-- quedan NULL, sin ningún backfill.

begin;

-- =========================================================================
-- 1) quotes.payment_terms / delivery_time / customer_notes
-- =========================================================================
alter table quotes
  add column if not exists payment_terms text,
  add column if not exists delivery_time text,
  add column if not exists customer_notes text;

-- =========================================================================
-- 2) rpc_create_quote — agrega lectura/persistencia de los 3 campos
--    nuevos, resto de la función sin cambios de comportamiento.
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

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_create_quote: customer % no encontrado.', v_customer_id;
  end if;

  select * into v_folio_result from fn_next_quote_folio(v_salesperson_id, v_business_unit_id, v_quote_date);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
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
    payment_terms, delivery_time, customer_notes
  )
  values (
    p_quote_id, v_organization_id, v_business_unit_id, v_salesperson_id, v_customer_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_quote_date, 'borrador',
    v_currency, v_tax_rate, v_global_discount_percent, v_valid_until,
    v_customer_name, v_customer_legal_name, v_customer_tax_id,
    v_bu_name, v_bu_code, v_sp_name,
    v_subtotal, v_discount_total, v_tax_total, v_total, v_notes,
    v_payment_terms, v_delivery_time, v_customer_notes
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
      line_discount_percent, line_subtotal
    )
    values (
      v_quote.id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 3) rpc_update_quote — mismo criterio: agrega los 3 campos nuevos al
--    UPDATE, resto de la función sin cambios de comportamiento. Sigue
--    rechazando cualquier escritura fuera de "borrador" (sin cambios ahí).
-- =========================================================================
create or replace function rpc_update_quote(
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
  v_current_status text;
  v_customer_id uuid := (p_quote->>'customer_id')::uuid;
  v_currency text := p_quote->>'currency';
  v_tax_rate numeric(5,2) := coalesce((p_quote->>'tax_rate')::numeric, 16.00);
  v_global_discount_percent numeric(5,2) := coalesce((p_quote->>'global_discount_percent')::numeric, 0);
  v_valid_until date := (p_quote->>'valid_until')::date;
  v_notes text := p_quote->>'notes';
  v_payment_terms text := nullif(p_quote->>'payment_terms', '');
  v_delivery_time text := nullif(p_quote->>'delivery_time', '');
  v_customer_notes text := nullif(p_quote->>'customer_notes', '');

  v_customer_name text;
  v_customer_legal_name text;
  v_customer_tax_id text;

  v_item jsonb;
  v_position integer;
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
  select status into v_current_status from quotes where id = p_quote_id;
  if v_current_status is null then
    raise exception 'rpc_update_quote: Quote % no encontrada.', p_quote_id;
  end if;
  if v_current_status <> 'borrador' then
    raise exception
      'rpc_update_quote: la Quote % no está en borrador (status actual: %); su contenido comercial no puede editarse.',
      p_quote_id, v_current_status;
  end if;

  select name, legal_name, tax_id into v_customer_name, v_customer_legal_name, v_customer_tax_id
    from customers where id = v_customer_id;
  if v_customer_name is null then
    raise exception 'rpc_update_quote: customer % no encontrado.', v_customer_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
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

  update quotes set
    customer_id = v_customer_id,
    currency = v_currency,
    tax_rate = v_tax_rate,
    global_discount_percent = v_global_discount_percent,
    valid_until = v_valid_until,
    customer_name = v_customer_name,
    customer_legal_name = v_customer_legal_name,
    customer_tax_id = v_customer_tax_id,
    subtotal = v_subtotal,
    discount_total = v_discount_total,
    tax_total = v_tax_total,
    total = v_total,
    notes = v_notes,
    payment_terms = v_payment_terms,
    delivery_time = v_delivery_time,
    customer_notes = v_customer_notes
  where id = p_quote_id
  returning * into v_quote;

  if not found then
    raise exception 'rpc_update_quote: Quote % no encontrada al actualizar.', p_quote_id;
  end if;

  delete from quote_items where quote_id = p_quote_id;
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
      line_discount_percent, line_subtotal
    )
    values (
      p_quote_id, v_position, nullif(v_item->>'catalog_product_id', '')::uuid,
      v_item->>'model', v_item->>'description', v_quantity, v_unit_price,
      v_line_discount_percent, v_line_subtotal
    );

    v_position := v_position + 1;
  end loop;

  return v_quote;
end;
$$;

-- =========================================================================
-- 4) trg_quote_status_transition — agrega los 3 campos nuevos al
--    congelamiento de contenido comercial fuera de "borrador". Mismo
--    trigger ya existente (trg_quotes_status_transition, 0020), solo se
--    reemplaza la función — sin crear un trigger nuevo.
-- =========================================================================
create or replace function trg_quote_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'borrador' and new.status in ('enviada', 'cancelada'))
      or (old.status = 'enviada' and new.status in ('aceptada', 'rechazada', 'cancelada'))
    ) then
      raise exception 'Transición de status inválida: % -> %.', old.status, new.status;
    end if;
  end if;

  if old.status <> 'borrador' then
    if new.customer_id is distinct from old.customer_id
      or new.currency is distinct from old.currency
      or new.tax_rate is distinct from old.tax_rate
      or new.global_discount_percent is distinct from old.global_discount_percent
      or new.valid_until is distinct from old.valid_until
      or new.subtotal is distinct from old.subtotal
      or new.discount_total is distinct from old.discount_total
      or new.tax_total is distinct from old.tax_total
      or new.total is distinct from old.total
      or new.customer_name is distinct from old.customer_name
      or new.customer_legal_name is distinct from old.customer_legal_name
      or new.customer_tax_id is distinct from old.customer_tax_id
      or new.business_unit_name is distinct from old.business_unit_name
      or new.business_unit_code is distinct from old.business_unit_code
      or new.salesperson_name is distinct from old.salesperson_name
      or new.payment_terms is distinct from old.payment_terms
      or new.delivery_time is distinct from old.delivery_time
      or new.customer_notes is distinct from old.customer_notes
    then
      raise exception 'No se puede modificar el contenido comercial de una Quote fuera de status borrador (actual: %).', old.status;
    end if;
  end if;

  return new;
end;
$$;

commit;
