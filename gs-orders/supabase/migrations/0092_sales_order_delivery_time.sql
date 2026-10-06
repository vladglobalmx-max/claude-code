-- THÖREN — fix del gap documentado en 0090_sales_order_from_quote.sql
-- ("FUERA DE ALCANCE"): quotes.delivery_time (texto libre, ej. "3-4
-- Semanas") no se copiaba a sales_orders porque requested_delivery_date es
-- una FECHA real, no texto, y no son compatibles sin inventar un parseo.
--
-- =========================================================================
-- DISEÑO — solución mínima: columna de texto separada, nunca un parseo
-- =========================================================================
-- Se agrega `sales_orders.delivery_time text`, MISMO nombre y mismo tipo
-- que `quotes.delivery_time` (0025_quote_commercial_terms.sql) y
-- `orders.delivery_time` (0029_quote_order_hardening.sql) — mismo campo
-- semántico ("condición comercial de entrega tal como la escribió el
-- vendedor/cliente", nunca una fecha). NO se intenta convertir "3-4
-- Semanas" a una fecha: `requested_delivery_date` (date) queda exactamente
-- como estaba, sin tocar — sigue siendo el campo correcto para cuando
-- exista un compromiso de fecha concreta. Ambos campos coexisten, cada uno
-- con su propio significado, igual que ya coexisten en `orders` (0029)
-- `delivery_time` junto a `committed_delivery_date`/`committed_install_date`
-- (0034_order_commitment_dates.sql) — mismo patrón, no uno nuevo.
--
-- rpc_create_sales_order — acepta `delivery_time` del payload (mismo
-- patrón que `payment_terms`: texto libre, `nullif(..., '')`, sin
-- validación de formato) e inserta la columna.
--
-- rpc_create_sales_order_from_quote — agrega `quotes.delivery_time` al
-- payload que arma para rpc_create_sales_order. Cierra el gap documentado.
--
-- rpc_update_sales_order — DELIBERADAMENTE NO SE TOCA. Su UPDATE actual
-- (0089) nunca incluyó `delivery_time` en su lista de columnas porque la
-- columna no existía; al no agregarla tampoco ahora, el UPDATE sigue sin
-- tocar esa columna — mismo mecanismo con el que `business_unit_id`/
-- `source_quote_id` ya quedan preservados a través de cualquier edición
-- (ver DECISIÓN de 0090: "rpc_update_sales_order NO se toca ... agregarlo
-- sería alcance especulativo"). Es la solución mínima real: cero UI nueva,
-- cero riesgo de que una edición futura lo borre por accidente (no hay
-- ningún `SET delivery_time = ...` que pueda mandar NULL por un payload
-- incompleto), y punto 2 del ticket ("rpc_update_sales_order debe
-- preservarlo") queda satisfecho por construcción, no por código nuevo.
-- Esto es consistente con que, hoy, el único origen real de
-- `delivery_time` es la conversión de una Cotización (B1) — una Sales
-- Order creada manualmente nunca tuvo Cotización de origen, así que no hay
-- ningún flujo real que necesite editarlo después de creada.
--
-- UI — el detalle del Pedido (/ordenes-venta/[id]) lo muestra dentro de
-- "Condiciones comerciales", junto a Condición de pago — sin agregar
-- ningún control de edición (no fue pedido, y no hay flujo real que lo
-- escriba después de la conversión).
--
-- FUERA DE ALCANCE (sin cambios en este ticket): warranty (0 casos reales
-- confirmados en producción) y global_discount_percent (bloqueo existente
-- de rpc_create_sales_order_from_quote sin cambios).
--
-- Como el resto del proyecto: idempotente donde aplica, corre completa en
-- una transacción.

begin;

-- =========================================================================
-- 1) sales_orders.delivery_time — nullable, sin default, sin backfill (no
--    hay ningún dato de origen para las Sales Orders ya existentes: ninguna
--    de ellas tiene todavía source_quote_id poblado desde antes de 0088).
-- =========================================================================
alter table sales_orders
  add column if not exists delivery_time text;

-- =========================================================================
-- 2) rpc_create_sales_order — idéntica a la versión vigente (0090) salvo
--    `delivery_time`, leído del payload e incluido en el INSERT. Cualquier
--    caller que no mande esa clave (todo el código actual, salvo B1 más
--    abajo) se comporta exactamente igual que antes — queda NULL.
-- =========================================================================
create or replace function rpc_create_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
set search_path = public
as $$
declare
  v_so sales_orders;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_salesperson_id uuid := nullif(p_sales_order->>'salesperson_id', '')::uuid;
  v_business_unit_id uuid := nullif(p_sales_order->>'business_unit_id', '')::uuid;
  v_source_quote_id uuid := nullif(p_sales_order->>'source_quote_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_payment_terms_type text := coalesce(nullif(p_sales_order->>'payment_terms_type', ''), 'custom');
  v_payment_required_amount numeric(12,2) := nullif(p_sales_order->>'payment_required_amount', '')::numeric;
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  -- THÖREN 0092 — condición comercial de entrega en texto libre (ej. "3-4
  -- Semanas"), NUNCA parseada a fecha. Separado de requested_delivery_date.
  v_delivery_time text := nullif(p_sales_order->>'delivery_time', '');
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');
  -- THÖREN 0077 — flag explícito de operación de prueba, solo definible aquí.
  v_is_test boolean := coalesce((p_sales_order->>'is_test')::boolean, false);

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

  v_order_date date := current_date;
  v_number_result record;

  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_sku text;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_sku_snapshot text;
  v_description_snapshot text;
  v_uom_snapshot text;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_discount numeric(5,2);
  v_tax numeric(5,2);
  v_line_gross numeric(12,2);
  v_line_discount_amount numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_tax_amount numeric(12,2);
  v_line_total numeric(12,2);
  v_estimated_unit_cost numeric(12,2);
  v_estimated_margin numeric(12,2);

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  v_organization_id := current_user_organization_id();

  if not (
    current_user_is_admin()
    or (is_organization_member(v_organization_id) and v_salesperson_id = current_user_salesperson_id())
  ) then
    raise exception 'Solo puedes crear una Sales Order a tu propio nombre, salvo que seas administrador.';
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_create_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede crear una Sales Order para un cliente inactivo.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  if v_payment_terms_type not in ('cash', 'credit', 'advance', 'custom') then
    raise exception 'Tipo de condición de pago inválido: %.', v_payment_terms_type;
  end if;

  if v_business_unit_id is not null then
    if not exists (select 1 from business_units where id = v_business_unit_id and organization_id = v_organization_id) then
      raise exception 'rpc_create_sales_order: la Business Unit % no pertenece a tu organización.', v_business_unit_id;
    end if;
  end if;

  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

  select * into v_number_result from fn_next_sales_order_number(v_organization_id, v_order_date);

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    perform fn_check_rich_text_safety(v_item->>'customer_requirements');

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad de cada línea debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada línea es obligatorio y no puede ser negativo.';
    end if;

    if v_catalog_product_id is not null then
      select sku, name, unit, organization_id into v_cat_sku, v_cat_name, v_cat_unit, v_cat_org
        from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_create_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      v_sku_snapshot := nullif(v_item->>'sku_snapshot', '');
      if v_sku_snapshot is null then
        raise exception 'Una línea libre (sin producto de catálogo) debe indicar al menos un SKU/referencia.';
      end if;
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax_amount;
    v_total := v_total + v_line_total;
  end loop;

  if v_payment_terms_type = 'cash' then
    v_payment_required_amount := v_total;
  elsif v_payment_terms_type = 'credit' then
    v_payment_required_amount := null;
  end if;

  insert into sales_orders (
    id, organization_id, customer_id, salesperson_id, business_unit_id, source_quote_id,
    order_number, sequence_number, status,
    currency, exchange_rate, payment_terms, payment_terms_type, payment_required_amount,
    requested_delivery_date, delivery_time,
    billing_address_snapshot, shipping_address_snapshot, customer_contact_snapshot,
    commercial_notes, internal_notes,
    subtotal, tax_total, total, created_by, is_test
  )
  values (
    p_sales_order_id, v_organization_id, v_customer_id, v_salesperson_id, v_business_unit_id, v_source_quote_id,
    v_number_result.order_number, v_number_result.sequence_number, 'draft',
    v_currency, v_exchange_rate, v_payment_terms, v_payment_terms_type, v_payment_required_amount,
    v_requested_delivery_date, v_delivery_time,
    v_billing_address, v_shipping_address, v_customer_contact_snapshot,
    v_commercial_notes, v_internal_notes,
    v_subtotal, v_tax_total, v_total, auth.uid(), v_is_test
  )
  returning * into v_so;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);
    v_tax := coalesce(nullif(v_item->>'tax', '')::numeric, 0);
    v_estimated_unit_cost := nullif(v_item->>'estimated_unit_cost', '')::numeric;
    v_estimated_margin := nullif(v_item->>'estimated_margin', '')::numeric;

    if v_catalog_product_id is not null then
      select sku, name, unit into v_cat_sku, v_cat_name, v_cat_unit from product_catalog where id = v_catalog_product_id;
      v_sku_snapshot := v_cat_sku;
      v_description_snapshot := coalesce(nullif(v_item->>'description_snapshot', ''), v_cat_name);
      v_uom_snapshot := coalesce(nullif(v_item->>'uom_snapshot', ''), v_cat_unit);
    else
      v_sku_snapshot := v_item->>'sku_snapshot';
      v_description_snapshot := nullif(v_item->>'description_snapshot', '');
      v_uom_snapshot := nullif(v_item->>'uom_snapshot', '');
    end if;

    v_line_gross := v_quantity * v_unit_price;
    v_line_discount_amount := round(v_line_gross * v_discount / 100, 2);
    v_line_subtotal := v_line_gross - v_line_discount_amount;
    v_line_tax_amount := round(v_line_subtotal * v_tax / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax_amount;

    insert into sales_order_items (
      sales_order_id, position, catalog_product_id,
      sku_snapshot, description_snapshot, uom_snapshot,
      quantity, unit_price, discount, tax, line_subtotal, line_total,
      estimated_unit_cost, estimated_margin,
      customer_requirements, customer_requirements_visible_in_pdf
    )
    values (
      v_so.id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin,
      nullif(v_item->>'customer_requirements', ''),
      coalesce((v_item->>'customer_requirements_visible_in_pdf')::boolean, true)
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- =========================================================================
-- 3) rpc_create_sales_order_from_quote — idéntica a la versión vigente
--    (0090) salvo agregar `delivery_time` al payload de encabezado que arma
--    para rpc_create_sales_order. Cierra el gap documentado en 0090.
-- =========================================================================
create or replace function rpc_create_sales_order_from_quote(
  p_quote_id uuid
)
returns sales_orders
language plpgsql
set search_path = public
as $$
declare
  v_quote quotes;
  v_bu_org uuid;
  v_items_payload jsonb;
  v_so_payload jsonb;
  v_so sales_orders;
begin
  -- Lee la Quote bajo RLS del caller — si no existe o no tiene acceso
  -- (organización/ownership), simplemente no aparece. No se necesita
  -- ninguna comparación explícita de organization_id contra el caller: RLS
  -- ya es el control de acceso completo de esta lectura (mismo criterio
  -- que rpc_create_order_from_quote, 0023).
  select * into v_quote from quotes where id = p_quote_id;
  if not found then
    raise exception 'Cotización no encontrada o sin acceso: %', p_quote_id;
  end if;

  if v_quote.status <> 'aceptada' then
    raise exception 'Solo una cotización aceptada puede convertirse a Sales Order (status actual: %)', v_quote.status;
  end if;

  if v_quote.source <> 'thoren' then
    raise exception 'Esta cotización es histórica (origen: %) y no puede convertirse a Sales Order.', v_quote.source;
  end if;

  -- ANTI-PIPELINE-DOBLE: si esta Quote YA generó un Pedido en el pipeline
  -- legado (orders), se rechaza con el conflicto explícito — nunca ambos
  -- pipelines para la misma Cotización.
  if exists (select 1 from orders where source_quote_id = p_quote_id) then
    raise exception
      'Esta cotización ya fue convertida a un Pedido en el pipeline histórico (orders) — no puede generar también una Sales Order en el pipeline oficial. Conflicto de doble pipeline para la misma cotización.';
  end if;

  -- IDEMPOTENCIA — pre-chequeo amigable; la protección REAL contra doble
  -- conversión (incluida condición de carrera) es el índice único parcial
  -- sales_orders_source_quote_id_unique (0088).
  if exists (select 1 from sales_orders where source_quote_id = p_quote_id) then
    raise exception 'Esta cotización ya fue convertida a una Sales Order.';
  end if;

  -- Defensivo (requisito explícito del ticket): business_unit_id de la
  -- Quote debe pertenecer a la MISMA organización que la Quote — invariante
  -- ya garantizado por trg_quotes_consistency (0020), revalidado aquí.
  select organization_id into v_bu_org from business_units where id = v_quote.business_unit_id;
  if v_bu_org is distinct from v_quote.organization_id then
    raise exception
      'rpc_create_sales_order_from_quote: la Business Unit % de la cotización no pertenece a su organización.',
      v_quote.business_unit_id;
  end if;

  -- GLOBAL_DISCOUNT_PERCENT — ver "FUERA DE ALCANCE" (0090): sin un lugar
  -- no especulativo donde repartirlo, se bloquea en vez de perderlo en
  -- silencio. Sin cambios en 0092.
  if v_quote.global_discount_percent <> 0 then
    raise exception
      'Esta cotización tiene un descuento global (%.2f%%) que esta conversión todavía no puede preservar — sales_order_items solo soporta descuento por partida, no un descuento global de encabezado. Conviértela manualmente o contacta al equipo técnico.',
      v_quote.global_discount_percent;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'catalog_product_id', qi.catalog_product_id,
      'sku_snapshot', qi.model,
      'description_snapshot', qi.description,
      'uom_snapshot', qi.unit,
      'quantity', qi.quantity,
      'unit_price', qi.unit_price,
      'discount', qi.line_discount_percent,
      'tax', v_quote.tax_rate,
      'customer_requirements', qi.customer_requirements,
      'customer_requirements_visible_in_pdf', qi.customer_requirements_visible_in_pdf
    ) order by qi.position
  )
  into v_items_payload
  from quote_items qi
  where qi.quote_id = p_quote_id;

  v_so_payload := jsonb_build_object(
    'customer_id', v_quote.customer_id,
    'salesperson_id', v_quote.salesperson_id,
    'business_unit_id', v_quote.business_unit_id,
    'source_quote_id', p_quote_id,
    'currency', v_quote.currency,
    'payment_terms', v_quote.payment_terms,
    -- THÖREN 0092 — cierra el gap documentado en 0090 ("FUERA DE ALCANCE"):
    -- texto libre tal cual, NUNCA parseado a requested_delivery_date (date).
    'delivery_time', v_quote.delivery_time,
    'commercial_notes', v_quote.customer_notes,
    'internal_notes', v_quote.notes
  );

  select * into v_so from rpc_create_sales_order(
    gen_random_uuid(),
    v_so_payload,
    coalesce(v_items_payload, '[]'::jsonb)
  );

  -- CUSTOM FIELDS POR PARTIDA — copia solo donde existe una definición de
  -- 'sales_order_item' con el MISMO key (y mismo business_unit_id) que la
  -- de 'quote_item' de origen (ver DISEÑO en 0090). Empareja quote_items
  -- <-> sales_order_items por `position`, el mismo orden con el que ambas
  -- listas se generaron (quote_items ordenado por position arriba,
  -- sales_order_items insertado en ese mismo orden por rpc_create_sales_order).
  insert into custom_field_values (organization_id, definition_id, entity_type, entity_id, value_text, value_number, value_boolean, value_date, value_json)
  select
    v_quote.organization_id,
    def_so.id,
    'sales_order_item',
    soi.id,
    cfv.value_text, cfv.value_number, cfv.value_boolean, cfv.value_date, cfv.value_json
  from quote_items qi
  join sales_order_items soi on soi.sales_order_id = v_so.id and soi.position = qi.position
  join custom_field_values cfv on cfv.entity_type = 'quote_item' and cfv.entity_id = qi.id
  join custom_field_definitions def_quote on def_quote.id = cfv.definition_id
  join custom_field_definitions def_so
    on def_so.organization_id = def_quote.organization_id
   and def_so.entity_type = 'sales_order_item'
   and def_so.key = def_quote.key
   and def_so.business_unit_id is not distinct from def_quote.business_unit_id
  where qi.quote_id = p_quote_id;

  return v_so;
end;
$$;

commit;
