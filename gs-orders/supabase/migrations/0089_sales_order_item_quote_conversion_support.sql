-- THÖREN — Ticket A2 de la transición orders -> sales_orders: completa
-- `sales_order_items` con lo que falta para recibir una Cotización sin
-- pérdida de datos, como prerrequisito de B1 (rpc_create_sales_order_from_quote).
--
-- =========================================================================
-- AUDITORÍA PREVIA — qué ya existe vs qué falta (quote_items / order_items
-- / sales_order_items)
-- =========================================================================
-- quote_items (0020/0028/0086) tiene: catalog_product_id, model,
-- description, quantity, unit_price, line_discount_percent, line_subtotal,
-- unit, customer_requirements, customer_requirements_visible_in_pdf.
--
-- sales_order_items (0067) YA tiene equivalente directo y reutilizable
-- para casi todo:
--   quote_items.catalog_product_id  -> sales_order_items.catalog_product_id
--   quote_items.model               -> sales_order_items.sku_snapshot
--   quote_items.description         -> sales_order_items.description_snapshot
--   quote_items.unit                -> sales_order_items.uom_snapshot
--   quote_items.quantity            -> sales_order_items.quantity
--   quote_items.unit_price          -> sales_order_items.unit_price
--   quote_items.line_discount_percent -> sales_order_items.discount
-- Ninguna de estas requiere columna nueva — se reutilizan tal cual
-- (mismo mapeo que usará B1, sin inventar nombres nuevos).
--
-- sales_order_items.tax (0067) no tiene equivalente en quote_items (Quotes
-- solo tiene un `tax_rate` ÚNICO a nivel de encabezado, nunca por partida)
-- — B1 copiará `quotes.tax_rate` a cada línea, sin requerir ningún cambio
-- de esquema aquí (es un mapeo de datos, no un hueco de columnas).
--
-- ÚNICO HUECO REAL DE ESQUEMA: `customer_requirements` /
-- `customer_requirements_visible_in_pdf` NO existen en `sales_order_items`
-- — sin esto, convertir una Cotización a Pedido oficial perdería los
-- requisitos del cliente por partida (dato comercial real, ya en
-- producción desde 0028/0086). Se agregan aquí, carácter por carácter el
-- mismo patrón que 0086 usó para `quote_items` (mismo tipo de columna,
-- mismo default, mismo guardia `fn_check_rich_text_safety` ya existente —
-- NO se crea una segunda función, se reutiliza la de 0086).
--
-- `order_items.customer_requirements` (0029) es texto plano, no HTML — no
-- es la referencia aquí; la referencia correcta es `quote_items` (0086),
-- que ya es HTML sanitizado, porque es la fuente real que B1 copiará.
--
-- Campos de instalación/proyección de `order_items` (0006/0007: power,
-- lens_type, installation_*, surface_*) NO se agregan — son específicos
-- del flujo físico de Pedidos verticales (Thunder LED Lights) y
-- `quote_items` nunca los tuvo; agregarlos aquí sería un campo
-- especulativo sin ningún dato de origen que copiar. Fuera de alcance a
-- propósito.
--
-- =========================================================================
-- CUSTOM FIELDS A NIVEL DE PARTIDA
-- =========================================================================
-- `custom_field_definitions`/`custom_field_values` (0055) solo soportan
-- `entity_type in ('product', 'quote_item', 'order_item')` — sin
-- 'sales_order_item', cualquier custom field de una Cotización NUNCA
-- podría copiarse a su Pedido oficial. Se extiende el CHECK de ambas
-- tablas (reemplazo del constraint autogenerado, confirmado por nombre
-- real en Postgres: `custom_field_definitions_entity_type_check` /
-- `custom_field_values_entity_type_check`).
--
-- Además de el CHECK, el motor de autoridad (lectura/escritura) de
-- `custom_field_values` resuelve el permiso POR entity_type vía dos
-- funciones `case`-driven (`current_user_organization_for_custom_field_entity`
-- / `current_user_can_write_custom_field_value`, ambas 0055) — sin una
-- rama para 'sales_order_item', su `else null`/`else false` dejaría
-- cualquier valor de ese entity_type ilegible/imposible de escribir bajo
-- RLS aunque el CHECK ya lo permitiera (hallazgo de esta auditoría, no
-- documentado en el plan previo). Se agrega la rama con la MISMA autoridad
-- que ya protege `sales_orders` (`is_organization_admin` o
-- `salesperson_id = current_user_salesperson_id()`, igual criterio que
-- 'order_item'/'quote_item').
--
-- =========================================================================
-- RPCs — rpc_create_sales_order / rpc_update_sales_order: reemplazo
-- forward-only, mismas firmas
-- =========================================================================
-- Última versión vigente de cada una: rpc_create_sales_order (0077),
-- rpc_update_sales_order (0068). Se reemplazan con `create or replace`
-- (firma idéntica) — el único cambio real en cada una: el INSERT a
-- `sales_order_items` ahora incluye `customer_requirements`/
-- `customer_requirements_visible_in_pdf`, leídos de
-- `p_items[].customer_requirements`/`customer_requirements_visible_in_pdf`
-- con el mismo `nullif`/`coalesce(..., true)` que usa 0086, y se agrega la
-- llamada a `fn_check_rich_text_safety` en el mismo loop de validación que
-- ya corre el chequeo cross-org de `catalog_product_id` — antes de
-- cualquier insert, mismo criterio exacto que 0086 aplicó a
-- `rpc_create_quote`/`rpc_update_quote`. El resto de cada función es
-- carácter por carácter idéntico a su versión anterior.
--
-- Fuera de alcance a propósito (instrucción explícita del ticket): ningún
-- RPC de conversión Cotización -> Sales Order (eso es B1), ninguna UI,
-- ningún cambio a procurement/inventario/fulfillment/facturación/
-- comisiones.
--
-- Como el resto del proyecto: idempotente donde aplica y corre completa en
-- una transacción (begin/commit).

begin;

-- =========================================================================
-- 1) sales_order_items.customer_requirements / customer_requirements_visible_in_pdf
-- =========================================================================
alter table sales_order_items
  add column if not exists customer_requirements text,
  add column if not exists customer_requirements_visible_in_pdf boolean not null default true;

-- =========================================================================
-- 2) custom_field_definitions / custom_field_values — agrega
--    'sales_order_item' al CHECK de entity_type.
-- =========================================================================
alter table custom_field_definitions drop constraint if exists custom_field_definitions_entity_type_check;
alter table custom_field_definitions add constraint custom_field_definitions_entity_type_check
  check (entity_type in ('product', 'quote_item', 'order_item', 'sales_order_item'));

alter table custom_field_values drop constraint if exists custom_field_values_entity_type_check;
alter table custom_field_values add constraint custom_field_values_entity_type_check
  check (entity_type in ('product', 'quote_item', 'order_item', 'sales_order_item'));

-- =========================================================================
-- 3) current_user_organization_for_custom_field_entity — agrega la rama
--    'sales_order_item' (sales_order_items -> su sales_order).
-- =========================================================================
create or replace function current_user_organization_for_custom_field_entity(p_entity_type text, p_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case p_entity_type
    when 'order_item' then (
      select o.organization_id from order_items oi join orders o on o.id = oi.order_id where oi.id = p_entity_id
    )
    when 'quote_item' then (
      select q.organization_id from quote_items qi join quotes q on q.id = qi.quote_id where qi.id = p_entity_id
    )
    when 'sales_order_item' then (
      select so.organization_id from sales_order_items soi join sales_orders so on so.id = soi.sales_order_id where soi.id = p_entity_id
    )
    when 'product' then (select pc.organization_id from product_catalog pc where pc.id = p_entity_id)
    else null
  end;
$$;

-- =========================================================================
-- 4) current_user_can_write_custom_field_value — agrega la rama
--    'sales_order_item', MISMA autoridad que ya protege `sales_orders`
--    (0067): admin de la organización, o el vendedor dueño de la Sales
--    Order.
-- =========================================================================
create or replace function current_user_can_write_custom_field_value(p_entity_type text, p_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case p_entity_type
    when 'order_item' then exists (
      select 1 from order_items oi join orders o on o.id = oi.order_id
      where oi.id = p_entity_id
        and is_organization_member(o.organization_id)
        and (is_organization_admin(o.organization_id) or o.salesperson_id = current_user_salesperson_id())
    )
    when 'quote_item' then exists (
      select 1 from quote_items qi join quotes q on q.id = qi.quote_id
      where qi.id = p_entity_id
        and is_organization_member(q.organization_id)
        and (is_organization_admin(q.organization_id) or q.salesperson_id = current_user_salesperson_id())
    )
    when 'sales_order_item' then exists (
      select 1 from sales_order_items soi join sales_orders so on so.id = soi.sales_order_id
      where soi.id = p_entity_id
        and is_organization_member(so.organization_id)
        and (is_organization_admin(so.organization_id) or so.salesperson_id = current_user_salesperson_id())
    )
    when 'product' then exists (
      select 1 from product_catalog pc where pc.id = p_entity_id and is_organization_admin(pc.organization_id)
    )
    else false
  end;
$$;

-- =========================================================================
-- 5) rpc_create_sales_order — idéntica a la versión vigente (0077) salvo
--    las 2 columnas nuevas en el INSERT de sales_order_items y la llamada
--    a fn_check_rich_text_safety (función ya existente desde 0086, no se
--    recrea).
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
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_payment_terms_type text := coalesce(nullif(p_sales_order->>'payment_terms_type', ''), 'custom');
  v_payment_required_amount numeric(12,2) := nullif(p_sales_order->>'payment_required_amount', '')::numeric;
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
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
    id, organization_id, customer_id, salesperson_id, order_number, sequence_number, status,
    currency, exchange_rate, payment_terms, payment_terms_type, payment_required_amount, requested_delivery_date,
    billing_address_snapshot, shipping_address_snapshot, customer_contact_snapshot,
    commercial_notes, internal_notes,
    subtotal, tax_total, total, created_by, is_test
  )
  values (
    p_sales_order_id, v_organization_id, v_customer_id, v_salesperson_id,
    v_number_result.order_number, v_number_result.sequence_number, 'draft',
    v_currency, v_exchange_rate, v_payment_terms, v_payment_terms_type, v_payment_required_amount, v_requested_delivery_date,
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
-- 6) rpc_update_sales_order — idéntica a la versión vigente (0068) salvo
--    las 2 columnas nuevas en el INSERT de sales_order_items y la llamada
--    a fn_check_rich_text_safety.
-- =========================================================================
create or replace function rpc_update_sales_order(
  p_sales_order_id uuid,
  p_sales_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns sales_orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_so sales_orders;
  v_current_status text;
  v_organization_id uuid;
  v_customer_id uuid := nullif(p_sales_order->>'customer_id', '')::uuid;
  v_currency text := p_sales_order->>'currency';
  v_exchange_rate numeric(12,6) := nullif(p_sales_order->>'exchange_rate', '')::numeric;
  v_payment_terms text := nullif(p_sales_order->>'payment_terms', '');
  v_payment_terms_type text := coalesce(nullif(p_sales_order->>'payment_terms_type', ''), 'custom');
  v_payment_required_amount numeric(12,2) := nullif(p_sales_order->>'payment_required_amount', '')::numeric;
  v_requested_delivery_date date := nullif(p_sales_order->>'requested_delivery_date', '')::date;
  v_billing_address text := nullif(p_sales_order->>'billing_address_snapshot', '');
  v_shipping_address text := nullif(p_sales_order->>'shipping_address_snapshot', '');
  v_commercial_notes text := nullif(p_sales_order->>'commercial_notes', '');
  v_internal_notes text := nullif(p_sales_order->>'internal_notes', '');

  v_customer_active boolean;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_customer_contact_snapshot text;

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
  select status, organization_id into v_current_status, v_organization_id
    from sales_orders where id = p_sales_order_id for update;
  if v_current_status is null then
    raise exception 'rpc_update_sales_order: Sales Order % no encontrada.', p_sales_order_id;
  end if;
  if not is_organization_member(v_organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;
  if v_current_status <> 'draft' then
    raise exception
      'rpc_update_sales_order: la Sales Order % no está en draft (status actual: %); su contenido no puede editarse.',
      p_sales_order_id, v_current_status;
  end if;

  select active into v_customer_active from customers where id = v_customer_id;
  if v_customer_active is null then
    raise exception 'rpc_update_sales_order: cliente % no encontrado.', v_customer_id;
  end if;
  if not v_customer_active then
    raise exception 'No se puede asignar un cliente inactivo a una Sales Order.';
  end if;

  if v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  if v_payment_terms_type not in ('cash', 'credit', 'advance', 'custom') then
    raise exception 'Tipo de condición de pago inválido: %.', v_payment_terms_type;
  end if;

  select name, email, phone into v_contact_name, v_contact_email, v_contact_phone
    from customer_contacts
    where customer_id = v_customer_id and is_primary = true and active = true
    limit 1;
  v_customer_contact_snapshot := nullif(btrim(concat_ws(' · ', v_contact_name, v_contact_email, v_contact_phone)), '');

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
      select organization_id into v_cat_org from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_update_sales_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
    else
      if nullif(v_item->>'sku_snapshot', '') is null then
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

  update sales_orders set
    customer_id = v_customer_id,
    currency = v_currency,
    exchange_rate = v_exchange_rate,
    payment_terms = v_payment_terms,
    payment_terms_type = v_payment_terms_type,
    payment_required_amount = v_payment_required_amount,
    requested_delivery_date = v_requested_delivery_date,
    billing_address_snapshot = v_billing_address,
    shipping_address_snapshot = v_shipping_address,
    customer_contact_snapshot = v_customer_contact_snapshot,
    commercial_notes = v_commercial_notes,
    internal_notes = v_internal_notes,
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total = v_total
  where id = p_sales_order_id
  returning * into v_so;

  delete from sales_order_items where sales_order_id = p_sales_order_id;

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
      p_sales_order_id, v_position, v_catalog_product_id,
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

commit;
