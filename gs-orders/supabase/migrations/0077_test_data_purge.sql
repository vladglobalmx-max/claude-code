-- THÖREN 0077 — Test Data / Purga de operaciones de prueba.
--
-- =========================================================================
-- OBJETIVO: permitir hacer pruebas completas de THÖREN (SO -> requisición
-- -> PO -> recepción -> inventario -> surtido -> factura -> comisión) sin
-- contaminar históricos, inventario, facturación, cobranza ni comisiones
-- oficiales — y poder purgar esa cadena de prueba por completo, dejando el
-- sistema exactamente como si nunca hubiera existido.
--
-- =========================================================================
-- DISEÑO — dónde vive is_test (derivar por relación cuando es seguro,
-- columna extra solo donde de verdad facilita integridad/consulta):
--
--   sales_orders.is_test        — FUENTE DE VERDAD. Solo se define al
--     crear (rpc_create_sales_order). Inmutable después (trigger
--     trg_prevent_sales_order_identity_change, extendido abajo).
--
--   purchase_orders.is_test     — snapshot tomado en el momento de crear
--     la PO (rpc_convert_requisition_to_purchase_order), leído de la
--     Sales Order de origen vía la requisición. Se agrega columna propia
--     (en vez de derivar por join) porque la relación real es de 3 saltos
--     (purchase_order_items -> purchase_requisition_items ->
--     purchase_requisitions -> sales_orders) y ambigua para POs que NO
--     vienen de una requisición (rpc_create_purchase_order, flujo
--     Pedidos/`orders`, fuera de alcance de este ticket — esas POs
--     siempre quedan is_test=false, nunca se tocan aquí). Inmutable
--     después de creada (nuevo trigger).
--
--   inventory_movements.is_test — snapshot tomado en el momento de
--     insertar cada movimiento (rpc_receive_purchase_order_item para
--     recepcion_compra/correccion_recepcion, rpc_dispatch_sales_fulfillment
--     para surtido_venta). Se agrega columna propia porque
--     inventory_movements es el ledger que "debe quedar exactamente como
--     si la prueba nunca hubiera existido" tras la purga, y porque es la
--     tabla más sensible a performance para reportes de inventario real —
--     filtrar por columna propia es muchísimo más barato que un join de
--     3-4 saltos en cada consulta de existencias. La tabla es append-only
--     (sin política de UPDATE, sin RPC que la actualice) así que no hace
--     falta trigger de inmutabilidad: nunca se modifica después de
--     insertada.
--
--   purchase_requisitions, goods_receipts, sales_fulfillments, invoices,
--   commission_records — TODAS tienen sales_order_id (o
--     purchase_order_id, para goods_receipts) directo, NOT NULL,
--     inmutable ya (triggers de identidad existentes). Un solo JOIN
--     barato y siempre seguro — NO se agrega columna is_test aquí, se
--     deriva en cada listado.
--
-- =========================================================================
-- RPC de purga (rpc_purge_test_sales_order) — SECURITY DEFINER: sales_orders
-- no tiene ninguna policy de DELETE (ninguna tabla del proyecto la tiene
-- hasta hoy — nunca se había necesitado un DELETE real), así que un
-- SECURITY INVOKER normal quedaría bloqueado por RLS en cada tabla. Toda
-- la autorización (organización, capability, is_test=true) se valida a
-- mano ANTES de cualquier escritura — exactamente el mismo criterio que ya
-- usa el resto del proyecto para RPCs SECURITY DEFINER (p.ej.
-- rpc_receive_purchase_order_item, rpc_dispatch_sales_fulfillment).
--
-- =========================================================================
-- Freeze triggers (invoice_items/sales_fulfillment_items/goods_receipt_items)
-- — AJUSTE post-review: la primera versión de este ticket desactivaba estos
-- tres triggers con ALTER TABLE ... DISABLE/ENABLE TRIGGER dentro de la
-- propia función. Eso funcionaba, pero es un candado DDL a nivel de tabla
-- — visible/afecta a CUALQUIER sesión que toque esas tablas mientras dura
-- la ventana (por corta que sea), no algo exclusivo de esta llamada. Se
-- reemplaza por una excepción controlada DENTRO de cada trigger, con TRES
-- capas de defensa, ninguna de las cuales requiere DDL ni afecta a nadie
-- fuera de esta transacción — LAS TRES son obligatorias, ninguna basta
-- por sí sola:
--   (a) un GUC LOCAL A LA TRANSACCIÓN (set_config(..., true) — se
--       autodestruye al terminar la transacción, commit o rollback, sin
--       necesidad de limpieza manual ni forma de que "se quede pegado").
--       rpc_purge_test_sales_order es la ÚNICA función que lo escribe,
--       únicamente DESPUÉS de haber pasado autoridad + organización +
--       is_test=true + guard de mezcla — nunca antes.
--   (b) cada trigger, al ver el GUC, vuelve a verificar por su cuenta
--       (una consulta real, nunca confía ciegamente en el GUC) que la fila
--       que se intenta borrar pertenece EXACTAMENTE a la Sales Order que
--       el GUC declara Y que esa Sales Order tiene is_test=true.
--   (c) la SESIÓN ACTUAL tiene autoridad de purga real (current_user_is_admin()
--       o current_user_has_capability('can_purge_test_operations')) —
--       imprescindible porque (a)+(b) por sí solas NO bastan: al menos una
--       policy de RLS (invoice_items_delete) admite DELETE a cualquier
--       can_manage_sales_order_finance sin exigir ningún status, así que
--       sin (c) alguien con esa capability (pero SIN autoridad de purga)
--       que de algún modo pusiera el GUC a mano, FUERA del RPC, podría
--       borrar líneas de una factura de prueba real sin pasar por el
--       guard de mezcla ni el resto de la purga atómica. (c) cierra ese
--       hueco exigiendo la MISMA autoridad que la propia RPC exige antes
--       de escribir nada — "falsear" el GUC sin también ser
--       admin/can_purge_test_operations nunca alcanza para borrar nada.
-- Si cualquiera de las tres capas falla, el trigger se comporta EXACTO que
-- antes (rechaza). Esto es lo que garantiza "nunca permite borrar
-- documentos oficiales" y "nunca permite un DELETE fuera de una purga
-- autorizada", incluso ante un intento deliberado de imitar el contexto de
-- purga: la fila en sí tiene que demostrar que es de prueba y de esa Sales
-- Order específica, Y quien ejecuta el DELETE tiene que demostrar
-- independientemente que tiene autoridad real de purga.
--
-- Consecuencia directa de (b): la re-verificación hace JOIN al documento
-- PADRE (invoices/sales_fulfillments/goods_receipts→purchase_orders), así
-- que ese padre debe seguir existiendo en el momento en que la línea se
-- borra — un DELETE del padre que dispare el borrado de sus líneas vía
-- CASCADE llegaría a la línea con el padre YA eliminado (invisible por
-- MVCC dentro del mismo comando), y el bypass fallaría siempre. Por eso
-- invoice_items/sales_fulfillment_items/goods_receipt_items se borran
-- EXPLÍCITAMENTE antes que su documento padre (ver Orden de borrado) en
-- vez de dejarlos al CASCADE — el resto de las tablas hijas (eventos, sin
-- freeze trigger) sigue vía CASCADE normal, sin este problema.
--
-- Orden de borrado (respeta cada FK ON DELETE RESTRICT del esquema real,
-- confirmado por introspección contra una base local con las 76
-- migraciones aplicadas):
--   1. inventory_movements  (recepcion_compra/correccion_recepcion de las
--      POs de esta cadena; surtido_venta de los surtidos de esta SO) —
--      RESTRICT hacia purchase_orders/purchase_order_items, debe ir antes.
--   2. goods_receipts       (goods_receipt_items EXPLÍCITO antes — ver
--      arriba —, events vía CASCADE) — RESTRICT hacia purchase_orders,
--      debe ir antes.
--   3. purchase_orders      (cascade -> purchase_order_items) — derivadas
--      SOLO vía purchase_order_items.purchase_requisition_item_id (las POs
--      de este feature nunca tienen order_id: vienen de una requisición,
--      nunca de un Pedido/`orders`).
--   4. sales_fulfillments   (sales_fulfillment_items EXPLÍCITO antes,
--      events vía CASCADE) — RESTRICT hacia sales_orders, debe ir antes
--      del paso 9.
--   5. invoice_payments     (de las facturas de esta SO) — RESTRICT hacia
--      invoices, debe ir antes del paso 6.
--   6. invoices             (invoice_items EXPLÍCITO antes, events vía
--      CASCADE) — RESTRICT hacia sales_orders, debe ir antes del paso 9.
--   7. commission_records   (cascade -> commission_events) — RESTRICT
--      hacia sales_orders, debe ir antes del paso 9.
--   8. purchase_requisitions (cascade -> purchase_requisition_items/events)
--      — RESTRICT hacia sales_orders, debe ir antes del paso 9.
--   9. sales_orders          (cascade -> sales_order_items,
--      sales_order_financial_events) — al final, ya sin nada que la
--      restrinja.
-- Los eventos/auditoría de cada documento (invoice_events, commission_events,
-- purchase_requisition_events, sales_fulfillment_events,
-- goods_receipt_events, sales_order_financial_events) son TODOS CASCADE
-- desde su documento padre — se eliminan automáticamente, exclusivamente
-- los de esta operación, sin sentencias DELETE adicionales.
--
-- Guard de mezcla (seguridad — "una operación oficial JAMÁS puede
-- eliminarse por esta función"): antes de borrar cualquier PO candidata,
-- se verifica que NINGUNA de sus líneas provenga de la requisición de OTRA
-- Sales Order (test o, sobre todo, oficial). Si una PO mezcla líneas de
-- más de una Sales Order, la purga completa aborta sin escribir nada —
-- caso fuera de diseño (rpc_convert_requisition_to_purchase_order siempre
-- crea una PO nueva por conversión, nunca mezcla dos requisiciones en la
-- misma llamada) pero se protege explícitamente por si algún día cambia.
--
-- Atomicidad: todo el cuerpo de la función es una sola transacción
-- implícita — cualquier excepción (incluida la del guard de mezcla) aborta
-- TODO lo ejecutado hasta ese punto, sin necesidad de BEGIN/EXCEPTION
-- explícito. "Rollback completo ante cualquier error" es una propiedad del
-- lenguaje, no algo que este código deba implementar aparte.
--
-- Como el resto del proyecto: idempotente (create or replace / drop if
-- exists) y corre completa en una transacción (begin/commit).

begin;

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas.
-- -----------------------------------------------------------------------------
alter table sales_orders add column is_test boolean not null default false;
alter table purchase_orders add column is_test boolean not null default false;
alter table inventory_movements add column is_test boolean not null default false;

comment on column sales_orders.is_test is 'THÖREN 0077 — fuente de verdad de si esta Sales Order es una operación de prueba. Solo se define al crear; inmutable después (trg_prevent_sales_order_identity_change).';
comment on column purchase_orders.is_test is 'THÖREN 0077 — snapshot tomado de la Sales Order de origen (vía requisición) al convertir. Siempre false para POs del flujo Pedidos/`orders`. Inmutable después de creada.';
comment on column inventory_movements.is_test is 'THÖREN 0077 — snapshot tomado al insertar el movimiento, de la PO (recepcion_compra/correccion_recepcion) o de la Sales Order del surtido (surtido_venta). Tabla append-only: nunca se actualiza después.';

-- -----------------------------------------------------------------------------
-- 2. Inmutabilidad de sales_orders.is_test — extiende el trigger de
--    identidad ya existente (0067), carácter por carácter igual salvo el
--    bloque nuevo al final.
-- -----------------------------------------------------------------------------
create or replace function trg_prevent_sales_order_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is distinct from old.order_number then
    raise exception 'El número de Sales Order no se puede modificar (%).', old.order_number;
  end if;
  if new.sequence_number is distinct from old.sequence_number then
    raise exception 'El consecutivo de una Sales Order no se puede modificar.';
  end if;
  if new.organization_id is distinct from old.organization_id then
    raise exception 'La organización de una Sales Order no se puede modificar.';
  end if;
  if new.salesperson_id is distinct from old.salesperson_id then
    raise exception 'El vendedor de una Sales Order no se puede cambiar.';
  end if;
  if new.is_test is distinct from old.is_test then
    raise exception 'is_test de una Sales Order no se puede modificar después de creada — una operación oficial nunca puede convertirse en prueba, ni viceversa.';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Inmutabilidad de purchase_orders.is_test — trigger nuevo y dedicado
--    (no se toca trg_prevent_purchase_order_folio_change, ya enviado en
--    0045, para no arriesgar su lógica existente).
-- -----------------------------------------------------------------------------
create or replace function trg_prevent_purchase_order_is_test_change()
returns trigger
language plpgsql
as $$
begin
  if new.is_test is distinct from old.is_test then
    raise exception 'is_test de una Purchase Order no se puede modificar después de creada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purchase_orders_prevent_is_test_change on purchase_orders;
create trigger trg_purchase_orders_prevent_is_test_change
  before update on purchase_orders
  for each row execute function trg_prevent_purchase_order_is_test_change();

-- -----------------------------------------------------------------------------
-- 4. rpc_create_sales_order — agrega p_sales_order->>'is_test' (default
--    false). Resto de la función carácter por carácter igual a la versión
--    vigente.
-- -----------------------------------------------------------------------------
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
      estimated_unit_cost, estimated_margin
    )
    values (
      v_so.id, v_position, v_catalog_product_id,
      v_sku_snapshot, v_description_snapshot, v_uom_snapshot,
      v_quantity, v_unit_price, v_discount, v_tax, v_line_subtotal, v_line_total,
      v_estimated_unit_cost, v_estimated_margin
    );

    v_position := v_position + 1;
  end loop;

  return v_so;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. rpc_convert_requisition_to_purchase_order — la PO nace con el
--    is_test de la Sales Order de origen (vía la requisición). Resto de
--    la función carácter por carácter igual a la versión vigente (0069).
-- -----------------------------------------------------------------------------
create or replace function rpc_convert_requisition_to_purchase_order(
  p_purchase_order_id uuid,
  p_requisition_id uuid,
  p_supplier_id uuid,
  p_requisition_item_ids uuid[],
  p_purchase_order jsonb default '{}'::jsonb
)
returns purchase_orders
language plpgsql
set search_path = public
as $$
declare
  v_req purchase_requisitions;
  v_so_is_test boolean;
  v_organization_id uuid;
  v_po purchase_orders;
  v_po_date date := coalesce(nullif(p_purchase_order->>'po_date', '')::date, current_date);
  v_folio_result record;
  v_item_id uuid;
  v_pri purchase_requisition_items;
  v_remaining integer;
  v_position integer := 0;
  v_ref_sku text;
  v_ref_model text;
  v_ref_description text;
  v_ref_uom text;
  v_total_required integer;
  v_total_ordered integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede convertir una requisición en Purchase Order.';
  end if;

  select * into v_req from purchase_requisitions where id = p_requisition_id for update;
  if v_req.id is null then
    raise exception 'rpc_convert_requisition_to_purchase_order: Requisición % no encontrada.', p_requisition_id;
  end if;
  v_organization_id := current_user_organization_id();
  if v_req.organization_id <> v_organization_id then
    raise exception 'Esta requisición no pertenece a tu organización.';
  end if;
  if v_req.status not in ('submitted', 'partially_ordered') then
    raise exception 'Solo se puede convertir a Purchase Order una requisición submitted o partially_ordered (status actual: %).', v_req.status;
  end if;

  -- THÖREN 0077 — snapshot de is_test tomado de la Sales Order de origen.
  select is_test into v_so_is_test from sales_orders where id = v_req.sales_order_id;

  if not exists (select 1 from suppliers where id = p_supplier_id and organization_id = v_organization_id and active = true) then
    raise exception 'El proveedor seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if p_requisition_item_ids is null or array_length(p_requisition_item_ids, 1) is null then
    raise exception 'Debes seleccionar al menos una línea de la requisición para convertir.';
  end if;

  select * into v_folio_result from fn_next_purchase_order_folio(v_organization_id, v_po_date);

  insert into purchase_orders (
    id, organization_id, order_id, supplier_id, folio, sequence_number, po_date,
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status, is_test
  )
  values (
    p_purchase_order_id, v_organization_id, null, p_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador',
    coalesce(v_so_is_test, false)
  )
  returning * into v_po;

  foreach v_item_id in array p_requisition_item_ids
  loop
    select * into v_pri from purchase_requisition_items where id = v_item_id and purchase_requisition_id = p_requisition_id for update;
    if v_pri.id is null then
      raise exception 'La línea % no pertenece a esta requisición.', v_item_id;
    end if;

    v_remaining := v_pri.quantity_required - v_pri.quantity_ordered;
    if v_remaining <= 0 then
      raise exception 'La línea % de la requisición ya está completamente ordenada.', v_item_id;
    end if;

    v_ref_sku := null; v_ref_model := null; v_ref_description := null; v_ref_uom := null;
    if v_pri.catalog_product_id is not null then
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_ref_sku, v_ref_model, v_ref_description, v_ref_uom
        from supplier_product_references
        where catalog_product_id = v_pri.catalog_product_id and supplier_id = p_supplier_id and active = true
        limit 1;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, unit, quantity_ordered,
      purchase_requisition_item_id,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot
    )
    values (
      v_po.id, null, v_position, v_pri.catalog_product_id,
      v_pri.description_snapshot, null, v_pri.uom_snapshot, v_remaining,
      v_pri.id,
      v_ref_sku, v_ref_model, v_ref_description, v_ref_uom
    );

    update purchase_requisition_items set quantity_ordered = quantity_ordered + v_remaining where id = v_pri.id;

    v_position := v_position + 1;
  end loop;

  select sum(quantity_required), sum(quantity_ordered) into v_total_required, v_total_ordered
    from purchase_requisition_items where purchase_requisition_id = p_requisition_id;

  update purchase_requisitions
    set status = case when v_total_ordered >= v_total_required then 'ordered' else 'partially_ordered' end
    where id = p_requisition_id;

  insert into purchase_requisition_events (purchase_requisition_id, event_type, purchase_order_id, created_by)
    values (p_requisition_id, 'converted_to_po', v_po.id, auth.uid());

  return v_po;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. rpc_receive_purchase_order_item — el movimiento hereda is_test de la
--    PO. Resto de la función carácter por carácter igual a la versión
--    vigente (0035/0036, con los ajustes acumulados hasta 0070).
-- -----------------------------------------------------------------------------
create or replace function rpc_receive_purchase_order_item(p_purchase_order_item_id uuid, p_quantity_received integer, p_warehouse_id uuid)
returns purchase_order_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item purchase_order_items;
  v_po_id uuid;
  v_po_status text;
  v_po_organization_id uuid;
  v_po_is_test boolean;
  v_quantity_ordered integer;
  v_previous_received integer;
  v_product_id uuid;
  v_delta integer;
  v_total_items integer;
  v_fully_received_items integer;
  v_any_received_items integer;
  v_existing_warehouse_id uuid;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_movement_type text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() and not current_user_has_capability('can_receive_inventory') then
    raise exception 'Solo un administrador o un usuario con autoridad de recepción de inventario puede registrar recepción de mercancía.';
  end if;

  select purchase_order_id, quantity_ordered, quantity_received, catalog_product_id
    into v_po_id, v_quantity_ordered, v_previous_received, v_product_id
    from purchase_order_items where id = p_purchase_order_item_id
    for update;
  if v_po_id is null then
    raise exception 'Partida de Purchase Order no encontrada: %', p_purchase_order_item_id;
  end if;

  select status, organization_id, is_test into v_po_status, v_po_organization_id, v_po_is_test from purchase_orders where id = v_po_id;
  if not is_organization_member(v_po_organization_id) then
    raise exception 'Esta Purchase Order no pertenece a tu organización.';
  end if;
  if v_po_status = 'borrador' then
    raise exception 'No se puede registrar recepción de una Purchase Order en borrador — primero debe marcarse como Ordenada.';
  end if;
  if v_po_status = 'cancelada' then
    raise exception 'No se puede registrar recepción de una Purchase Order cancelada.';
  end if;

  if p_quantity_received < 0 or p_quantity_received > v_quantity_ordered then
    raise exception 'La cantidad recibida (%) no puede ser negativa ni mayor a la cantidad ordenada (%).', p_quantity_received, v_quantity_ordered;
  end if;

  if v_product_id is not null then
    if p_warehouse_id is null or not exists (
      select 1 from warehouses where id = p_warehouse_id and organization_id = v_po_organization_id and active = true
    ) then
      raise exception 'Debes seleccionar un almacén activo de tu organización para registrar la recepción.';
    end if;

    select warehouse_id into v_existing_warehouse_id
      from inventory_movements where purchase_order_item_id = p_purchase_order_item_id limit 1;
    if v_existing_warehouse_id is not null and v_existing_warehouse_id <> p_warehouse_id then
      raise exception 'Esta partida ya se recibió en otro almacén; no se puede cambiar el almacén de recepción.';
    end if;

    v_delta := p_quantity_received - v_previous_received;

    if v_delta <> 0 then
      if v_delta < 0 then
        select coalesce(sum(quantity_delta), 0) into v_current_on_hand
          from inventory_movements where product_id = v_product_id and warehouse_id = p_warehouse_id;
        if v_current_on_hand + v_delta < 0 then
          raise exception 'La corrección dejaría On Hand negativo en ese almacén (actual: %, ajuste: %).', v_current_on_hand, v_delta;
        end if;
        v_movement_type := 'correccion_recepcion';
      else
        v_movement_type := 'recepcion_compra';
      end if;

      select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

      insert into inventory_movements (
        organization_id, product_id, warehouse_id, quantity_delta, movement_type,
        purchase_order_id, purchase_order_item_id, created_by_user_id, created_by_name, is_test
      ) values (
        v_po_organization_id, v_product_id, p_warehouse_id, v_delta, v_movement_type,
        v_po_id, p_purchase_order_item_id, v_user_id, coalesce(v_user_name, '—'), coalesce(v_po_is_test, false)
      );
    end if;
  end if;

  update purchase_order_items set quantity_received = p_quantity_received
    where id = p_purchase_order_item_id
    returning * into v_item;

  select
    count(*),
    count(*) filter (where quantity_received >= quantity_ordered),
    count(*) filter (where quantity_received > 0)
    into v_total_items, v_fully_received_items, v_any_received_items
    from purchase_order_items where purchase_order_id = v_po_id;

  if v_total_items > 0 and v_fully_received_items = v_total_items then
    update purchase_orders set status = 'recibida' where id = v_po_id;
  elsif v_any_received_items > 0 then
    update purchase_orders set status = 'recibida_parcial' where id = v_po_id;
  else
    update purchase_orders set status = pre_receiving_status where id = v_po_id;
  end if;

  return v_item;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. rpc_dispatch_sales_fulfillment — el movimiento hereda is_test de la
--    Sales Order (ya cargada en v_so). Resto de la función carácter por
--    carácter igual a la versión vigente (0071).
-- -----------------------------------------------------------------------------
create or replace function rpc_dispatch_sales_fulfillment(p_fulfillment_id uuid)
returns sales_fulfillments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sf sales_fulfillments;
  v_so sales_orders;
  v_item sales_fulfillment_items;
  v_so_item sales_order_items;
  v_current_on_hand integer;
  v_user_id uuid := auth.uid();
  v_user_name text;
  v_total_required integer;
  v_total_fulfilled integer;
  v_new_release_status text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_manage_sales_fulfillment')) then
    raise exception 'Solo un administrador o un usuario con autoridad de surtido puede despachar un surtido de Sales Order.';
  end if;

  select * into v_sf from sales_fulfillments where id = p_fulfillment_id for update;
  if v_sf.id is null then
    raise exception 'rpc_dispatch_sales_fulfillment: Surtido % no encontrado.', p_fulfillment_id;
  end if;
  if not is_organization_member(v_sf.organization_id) then
    raise exception 'Este surtido no pertenece a tu organización.';
  end if;
  if v_sf.status <> 'ready' then
    raise exception 'Este surtido ya fue despachado o no está listo para despachar (status actual: %) — no se puede duplicar la salida.', v_sf.status;
  end if;

  select * into v_so from sales_orders where id = v_sf.sales_order_id for update;
  if v_so.id is null or v_so.organization_id <> v_sf.organization_id then
    raise exception 'La Sales Order de este surtido no existe o no pertenece a tu organización.';
  end if;
  if v_so.status = 'cancelled' then
    raise exception 'No se puede despachar un surtido de una Sales Order cancelada.';
  end if;
  if v_so.fulfillment_release_status not in ('released', 'partially_released', 'fulfilled') then
    raise exception 'No se puede despachar un surtido de una Sales Order que no esté liberada financieramente (estado actual: %).', v_so.fulfillment_release_status;
  end if;

  select coalesce(name, '—') into v_user_name from user_profiles where user_id = v_user_id;

  for v_item in select * from sales_fulfillment_items where sales_fulfillment_id = p_fulfillment_id order by created_at
  loop
    select * into v_so_item from sales_order_items where id = v_item.sales_order_item_id for update;

    if (
      select coalesce(sum(sfi.quantity_fulfilled), 0)
      from sales_fulfillment_items sfi
      where sfi.sales_order_item_id = v_item.sales_order_item_id
    ) + v_item.quantity_requested > v_so_item.quantity then
      raise exception
        'La línea de Sales Order % ya tiene % unidad(es) surtida(s) (de % vendidas) — no se puede surtir % más.',
        v_item.sales_order_item_id,
        (select coalesce(sum(sfi.quantity_fulfilled), 0) from sales_fulfillment_items sfi where sfi.sales_order_item_id = v_item.sales_order_item_id),
        v_so_item.quantity, v_item.quantity_requested;
    end if;

    if v_item.catalog_product_id is not null then
      select coalesce(sum(quantity_delta), 0) into v_current_on_hand
        from inventory_movements
        where product_id = v_item.catalog_product_id and warehouse_id = v_sf.warehouse_id;
      if v_current_on_hand - v_item.quantity_requested < 0 then
        raise exception 'No hay existencia suficiente de % en el almacén seleccionado para surtir % unidad(es) (disponible: %).',
          v_item.description_snapshot, v_item.quantity_requested, v_current_on_hand;
      end if;

      insert into inventory_movements (
        organization_id, product_id, warehouse_id, quantity_delta, movement_type,
        sales_fulfillment_id, sales_fulfillment_item_id, created_by_user_id, created_by_name, is_test
      ) values (
        v_sf.organization_id, v_item.catalog_product_id, v_sf.warehouse_id, -v_item.quantity_requested, 'surtido_venta',
        v_sf.id, v_item.id, v_user_id, coalesce(v_user_name, '—'), v_so.is_test
      );
    end if;

    update sales_fulfillment_items set quantity_fulfilled = quantity_requested where id = v_item.id;
  end loop;

  update sales_fulfillments set status = 'shipped', shipped_at = now()
    where id = p_fulfillment_id
    returning * into v_sf;

  insert into sales_fulfillment_events (sales_fulfillment_id, event_type, previous_status, new_status, created_by)
    values (p_fulfillment_id, 'shipped', 'ready', 'shipped', auth.uid());

  select coalesce(sum(soi.quantity), 0) into v_total_required
    from sales_order_items soi where soi.sales_order_id = v_so.id;
  select coalesce(sum(sfi.quantity_fulfilled), 0) into v_total_fulfilled
    from sales_fulfillment_items sfi
    join sales_fulfillments sf on sf.id = sfi.sales_fulfillment_id
    where sf.sales_order_id = v_so.id and sf.status <> 'cancelled';

  if v_total_required > 0 and v_total_fulfilled >= v_total_required then
    v_new_release_status := 'fulfilled';
  elsif v_total_fulfilled > 0 then
    v_new_release_status := 'partially_released';
  else
    v_new_release_status := v_so.fulfillment_release_status;
  end if;

  if v_new_release_status is distinct from v_so.fulfillment_release_status then
    update sales_orders set fulfillment_release_status = v_new_release_status where id = v_so.id;
  end if;

  return v_sf;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Freeze triggers — bypass controlado, ver sección "Freeze triggers"
--    arriba. Los tres se reemplazan completos (create or replace); el
--    resto de cada cuerpo queda carácter por carácter igual a la versión
--    ya enviada (0072 para invoice_items, 0071 para
--    sales_fulfillment_items, 0070 para goods_receipt_items) salvo el
--    bloque nuevo, claramente delimitado, dentro de la rama DELETE.
-- -----------------------------------------------------------------------------
create or replace function trg_prevent_invoice_item_change()
returns trigger
language plpgsql
as $$
declare
  v_purge_so_id uuid;
begin
  if tg_op = 'DELETE' then
    -- THÖREN 0077 — bypass controlado, TRES condiciones, TODAS
    -- obligatorias (ninguna basta por sí sola):
    --   (a) rpc_purge_test_sales_order dejó el GUC local puesto para ESTA
    --       Sales Order;
    --   (b) la línea que se intenta borrar de verdad pertenece a una
    --       factura de esa Sales Order Y esa Sales Order es is_test=true
    --       (re-verificado aquí con una consulta real — nunca se confía
    --       en el GUC solo);
    --   (c) LA SESIÓN ACTUAL tiene autoridad de purga (admin o
    --       can_purge_test_operations) — sin esto, invoice_items_delete
    --       (RLS) por sí sola YA deja pasar a cualquier
    --       can_manage_sales_order_finance sin exigir status alguno, así
    --       que sin (c) alguien con esa capability (pero SIN autoridad de
    --       purga) que de alguna forma pusiera el GUC a mano (fuera del
    --       RPC) podría borrar líneas de factura de prueba sin pasar por
    --       el guard de mezcla ni el resto de la purga atómica. (c) cierra
    --       ese hueco exactamente igual que la propia RPC lo exige antes
    --       de escribir nada.
    v_purge_so_id := nullif(current_setting('thoren.purge_test_sales_order_id', true), '')::uuid;
    if v_purge_so_id is not null
      and (current_user_is_admin() or current_user_has_capability('can_purge_test_operations'))
      and exists (
        select 1
        from invoices inv
        join sales_orders so on so.id = inv.sales_order_id
        where inv.id = old.invoice_id
          and inv.sales_order_id = v_purge_so_id
          and so.is_test = true
      )
    then
      return old;
    end if;
    raise exception 'No se puede eliminar una línea de factura.';
  end if;
  raise exception 'No se puede modificar una línea de factura — es un snapshot congelado.';
end;
$$;

create or replace function trg_sales_fulfillment_item_freeze()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_purge_so_id uuid;
begin
  select status into v_status from sales_fulfillments where id = coalesce(new.sales_fulfillment_id, old.sales_fulfillment_id);
  if v_status <> 'draft' then
    if tg_op = 'DELETE' then
      -- THÖREN 0077 — mismo bypass controlado de tres condiciones que
      -- trg_prevent_invoice_item_change (GUC + re-verificación real +
      -- autoridad de purga de la sesión actual) — ver ese comentario para
      -- el detalle completo de por qué las tres son necesarias.
      v_purge_so_id := nullif(current_setting('thoren.purge_test_sales_order_id', true), '')::uuid;
      if v_purge_so_id is not null
        and (current_user_is_admin() or current_user_has_capability('can_purge_test_operations'))
        and exists (
          select 1
          from sales_fulfillments sf
          join sales_orders so on so.id = sf.sales_order_id
          where sf.id = old.sales_fulfillment_id
            and sf.sales_order_id = v_purge_so_id
            and so.is_test = true
        )
      then
        return old;
      end if;
      raise exception 'No se puede eliminar una línea de surtido fuera de status draft (actual: %).', v_status;
    end if;
    if new.sales_fulfillment_id is distinct from old.sales_fulfillment_id
      or new.sales_order_item_id is distinct from old.sales_order_item_id
      or new.catalog_product_id is distinct from old.catalog_product_id
      or new.description_snapshot is distinct from old.description_snapshot
      or new.uom_snapshot is distinct from old.uom_snapshot
      or new.quantity_requested is distinct from old.quantity_requested
    then
      raise exception 'No se puede modificar una línea de surtido fuera de status draft (actual: %) — solo quantity_fulfilled cambia, vía despacho.', v_status;
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function trg_goods_receipt_item_freeze()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_purge_so_id uuid;
begin
  select status into v_status from goods_receipts where id = coalesce(new.goods_receipt_id, old.goods_receipt_id);
  if v_status <> 'draft' then
    if tg_op = 'DELETE' then
      -- THÖREN 0077 — mismo bypass controlado de tres condiciones que
      -- trg_prevent_invoice_item_change (GUC + re-verificación real +
      -- autoridad de purga de la sesión actual) — ver ese comentario para
      -- el detalle completo. Aquí la re-verificación va vía PO -> la
      -- requisición -> la Sales Order, con la PO además marcada
      -- is_test=true (snapshot inmutable por sí solo, nunca true para una
      -- PO oficial) — cinturón-y-tirantes, nunca la única defensa.
      v_purge_so_id := nullif(current_setting('thoren.purge_test_sales_order_id', true), '')::uuid;
      if v_purge_so_id is not null
        and (current_user_is_admin() or current_user_has_capability('can_purge_test_operations'))
        and exists (
          select 1
          from goods_receipts gr
          join purchase_orders po on po.id = gr.purchase_order_id
          join purchase_order_items poi on poi.purchase_order_id = po.id
          join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
          join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
          where gr.id = old.goods_receipt_id
            and pr.sales_order_id = v_purge_so_id
            and po.is_test = true
        )
      then
        return old;
      end if;
    end if;
    raise exception 'No se puede modificar ni eliminar una línea de recepción de mercancía fuera de status draft (actual: %).', v_status;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Capability dedicada para la purga.
-- -----------------------------------------------------------------------------
insert into capabilities (key, description) values
  ('can_purge_test_operations', 'Eliminar permanentemente una operación de prueba (Sales Order is_test=true) y toda su cadena derivada — Dirección General/administrador autorizado exclusivamente. Nunca aplica a operaciones oficiales (is_test=false), rechazado siempre por rpc_purge_test_sales_order.')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 10. rpc_purge_test_sales_order — borrado transaccional de la cadena
--    completa de una operación de prueba. Ver DISEÑO arriba para el orden
--    de borrado y por qué respeta cada FK RESTRICT del esquema.
-- -----------------------------------------------------------------------------
create or replace function rpc_purge_test_sales_order(p_sales_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so sales_orders;
  v_order_number text;
begin
  -- 1) autoridad.
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_purge_test_operations')) then
    raise exception 'Solo Dirección General o un administrador autorizado puede eliminar una operación de prueba.';
  end if;

  select * into v_so from sales_orders where id = p_sales_order_id for update;
  if v_so.id is null then
    raise exception 'rpc_purge_test_sales_order: Sales Order % no encontrada.', p_sales_order_id;
  end if;

  -- 2) organización.
  if not is_organization_member(v_so.organization_id) then
    raise exception 'Esta Sales Order no pertenece a tu organización.';
  end if;

  -- 3) exige is_test=true — una operación oficial JAMÁS se puede purgar
  --    por esta función.
  if not v_so.is_test then
    raise exception 'Solo se pueden eliminar operaciones marcadas como prueba (is_test = true) — esta Sales Order es oficial y no puede purgarse.';
  end if;

  v_order_number := v_so.order_number;

  -- Guard de mezcla: ninguna Purchase Order candidata puede tener líneas
  -- que también provengan de la requisición de OTRA Sales Order. Si eso
  -- ocurre, aborta sin escribir nada — caso fuera de diseño normal, pero
  -- protegido explícitamente (ver DISEÑO arriba).
  if exists (
    select 1
    from purchase_order_items poi
    join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
    join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
    where poi.purchase_order_id in (
      select distinct poi2.purchase_order_id
      from purchase_order_items poi2
      join purchase_requisition_items pri2 on pri2.id = poi2.purchase_requisition_item_id
      join purchase_requisitions pr2 on pr2.id = pri2.purchase_requisition_id
      where pr2.sales_order_id = p_sales_order_id
    )
    and pr.sales_order_id <> p_sales_order_id
  ) then
    raise exception 'No se puede purgar: una o más Purchase Orders derivadas de esta Sales Order mezclan líneas de OTRA Sales Order — requiere revisión manual, no se modificó nada.';
  end if;

  -- THÖREN 0077 — autoriza el bypass controlado de los tres freeze
  -- triggers (invoice_items/sales_fulfillment_items/goods_receipt_items,
  -- ver sección "Freeze triggers" arriba) EXCLUSIVAMENTE para las filas
  -- que de verdad pertenecen a esta Sales Order. GUC LOCAL a la
  -- transacción (tercer argumento true) — nunca visible fuera de esta
  -- llamada, se descarta solo al terminar (commit o rollback), sin ALTER
  -- TABLE ni ventana global. Se pone recién AQUÍ, después de pasar
  -- autoridad + organización + is_test=true + guard de mezcla — nunca
  -- antes.
  perform set_config('thoren.purge_test_sales_order_id', p_sales_order_id::text, true);

  -- 1. inventory_movements.
  delete from inventory_movements
  where (
    movement_type in ('recepcion_compra', 'correccion_recepcion')
    and purchase_order_id in (
      select distinct poi.purchase_order_id
      from purchase_order_items poi
      join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
      join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
      where pr.sales_order_id = p_sales_order_id
    )
  )
  or (
    movement_type = 'surtido_venta'
    and sales_fulfillment_id in (select id from sales_fulfillments where sales_order_id = p_sales_order_id)
  );

  -- 2. goods_receipts. goods_receipt_items PRIMERO y EXPLÍCITO (nunca vía
  --    CASCADE): trg_goods_receipt_item_freeze re-verifica contra
  --    goods_receipts/purchase_orders — si se dejara el CASCADE de
  --    goods_receipts hacer el borrado, la fila padre ya estaría eliminada
  --    (invisible por MVCC dentro del mismo comando) cuando el trigger de
  --    la línea intenta re-verificarla, y el bypass fallaría siempre. Al
  --    borrar las líneas ANTES, el padre todavía existe para la
  --    re-verificación; goods_receipt_events sigue vía CASCADE normal (sin
  --    freeze trigger, sin este problema).
  delete from goods_receipt_items
  where goods_receipt_id in (
    select gr.id
    from goods_receipts gr
    where gr.purchase_order_id in (
      select distinct poi.purchase_order_id
      from purchase_order_items poi
      join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
      join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
      where pr.sales_order_id = p_sales_order_id
    )
  );
  delete from goods_receipts
  where purchase_order_id in (
    select distinct poi.purchase_order_id
    from purchase_order_items poi
    join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
    join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
    where pr.sales_order_id = p_sales_order_id
  );

  -- 3. purchase_orders (cascade -> purchase_order_items — sin freeze
  --    trigger, sin este problema).
  delete from purchase_orders
  where id in (
    select distinct poi.purchase_order_id
    from purchase_order_items poi
    join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
    join purchase_requisitions pr on pr.id = pri.purchase_requisition_id
    where pr.sales_order_id = p_sales_order_id
  );

  -- 4. sales_fulfillments. sales_fulfillment_items PRIMERO y EXPLÍCITO,
  --    mismo motivo que goods_receipt_items arriba (trg_sales_fulfillment_item_freeze
  --    re-verifica contra sales_fulfillments); sales_fulfillment_events
  --    sigue vía CASCADE normal.
  delete from sales_fulfillment_items
  where sales_fulfillment_id in (select id from sales_fulfillments where sales_order_id = p_sales_order_id);
  delete from sales_fulfillments where sales_order_id = p_sales_order_id;

  -- 5. invoice_payments.
  delete from invoice_payments where invoice_id in (select id from invoices where sales_order_id = p_sales_order_id);

  -- 6. invoices. invoice_items PRIMERO y EXPLÍCITO, mismo motivo
  --    (trg_prevent_invoice_item_change re-verifica contra invoices);
  --    invoice_events sigue vía CASCADE normal.
  delete from invoice_items
  where invoice_id in (select id from invoices where sales_order_id = p_sales_order_id);
  delete from invoices where sales_order_id = p_sales_order_id;

  -- 7. commission_records (cascade -> events).
  delete from commission_records where sales_order_id = p_sales_order_id;

  -- 8. purchase_requisitions (cascade -> items/events).
  delete from purchase_requisitions where sales_order_id = p_sales_order_id;

  -- 9. sales_orders (cascade -> sales_order_items, sales_order_financial_events).
  delete from sales_orders where id = p_sales_order_id;

  -- Cierra la ventana del bypass de inmediato (no es estrictamente
  -- necesario — el GUC local desaparece solo al terminar la transacción —
  -- pero deja explícito que la autorización dura el mínimo indispensable).
  perform set_config('thoren.purge_test_sales_order_id', '', true);

  return v_order_number;
end;
$$;

commit;
