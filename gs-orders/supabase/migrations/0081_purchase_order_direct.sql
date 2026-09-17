-- THÖREN — Nuevo flujo operativo: Orden de Compra Directa.
--
-- =========================================================================
-- CONTEXTO (auditoría previa, aprobada)
-- =========================================================================
-- `purchase_orders`/`purchase_order_items` YA soportan, a nivel de FK, una
-- PO sin Pedido/Requisición/Sales Order/cliente (order_id nullable desde
-- 0069; nunca existió columna de cliente ni de Sales Order). El bloqueo
-- real no era de esquema: `rpc_create_purchase_order` (0045/0066) exige
-- `order_id` + un `order_item_id` real por línea, y relee todo desde
-- `order_items` — no admite líneas libres. Esta migración NO toca esa
-- función salvo un campo aditivo (`origin`), ni `rpc_convert_requisition_
-- to_purchase_order` — ambas siguen produciendo exactamente las mismas POs
-- de siempre. Se agrega `rpc_create_direct_purchase_order`, un RPC nuevo,
-- sobre las MISMAS dos tablas (nunca una segunda tabla de Purchase Orders).
--
-- Igual de real: `purchase_order_items` nunca tuvo columna monetaria
-- (ni unit_price, ni tax, ni subtotal/total) — es puramente logística. Una
-- OC directa sí necesita ese dato comercial, así que se agrega aquí,
-- aditivo y nullable/default, sin afectar ninguna PO existente (Pedido o
-- Requisición), que jamás tuvieron ni necesitan este dato.
--
-- =========================================================================
-- DECISIONES (aprobadas explícitamente antes de escribir esta migración)
-- =========================================================================
-- 1) Idioma: se reutiliza `business_unit_process_settings.
--    provider_document_language` (0063, ya existente, ya configurable por
--    Business Unit) como default — NO se crea un segundo campo de idioma
--    en `business_units`. El snapshot vive en `purchase_orders.
--    document_language`, resuelto al crear (override manual si se manda
--    explícito), inmutable después — un cambio posterior a la
--    configuración de la BU nunca altera una OC ya emitida.
-- 2) `required_date` es un concepto propio, distinto de
--    `supplier_commitment_date` (compromiso confirmado por el proveedor)
--    y `estimated_reception_date` (estimación de recepción) — columna
--    nueva dedicada, nunca se reutiliza ninguna de las otras dos.
-- 3) `purchase_orders_select`/`purchase_order_items_select` (vigentes desde
--    0070) se extienden, ADITIVAMENTE, con
--    `current_user_has_capability('can_prepare_purchase_orders')` — sin
--    quitar ninguna rama existente (admin / dueño vía Pedido / can_view_
--    all_sales). Necesario porque una OC directa no tiene Pedido padre del
--    que derivar "dueño", así que sin esto un preparador no-admin no vería
--    de vuelta lo que él mismo crea.
-- 4) `origin` — nueva columna en `purchase_orders`, valores 'pedido' |
--    'requisicion' | 'directa', inmutable después de crear (mismo patrón
--    que `is_test`, 0077). Se agrega EXPLÍCITAMENTE a los 3 INSERT que
--    hoy crean una purchase_orders (rpc_create_purchase_order ->
--    'pedido', rpc_convert_requisition_to_purchase_order -> 'requisicion',
--    rpc_create_direct_purchase_order -> 'directa') — nunca se confía
--    solo en el DEFAULT de la columna para las dos funciones existentes,
--    aunque el resultado sería el mismo: ser explícito es el criterio ya
--    establecido en este proyecto (ver is_test, 0077).
-- 5) `business_unit_id`/`document_language` también se protegen como
--    identidad inmutable (mismo trigger que folio/organization_id/
--    order_id/supplier_id, 0035) — son snapshot, no configuración viva.
--
-- =========================================================================
-- Orden de esta migración
-- =========================================================================
--  1. Columnas nuevas en purchase_orders (todas aditivas/nullable o con
--     default — cero impacto en filas existentes).
--  2. Columnas nuevas en purchase_order_items (ídem).
--  3. Trigger de identidad extendido (origin/business_unit_id/
--     document_language, además de lo que ya protegía).
--  4. rpc_create_purchase_order — re-declarada, carácter por carácter
--     igual a la versión vigente (0066) salvo agregar origin='pedido' al
--     INSERT.
--  5. rpc_convert_requisition_to_purchase_order — re-declarada, carácter
--     por carácter igual a la versión vigente (0077) salvo agregar
--     origin='requisicion' al INSERT.
--  6. rpc_create_direct_purchase_order — nueva.
--  7. RLS — purchase_orders_select / purchase_order_items_select
--     extendidas (aditiva).
-- =========================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) purchase_orders — columnas nuevas.
-- -----------------------------------------------------------------------------
alter table purchase_orders
  add column if not exists origin text not null default 'pedido'
    constraint purchase_orders_origin_check check (origin in ('pedido', 'requisicion', 'directa')),
  add column if not exists business_unit_id uuid references business_units (id) on delete restrict,
  add column if not exists document_language text not null default 'es'
    constraint purchase_orders_document_language_check check (document_language in ('es', 'en')),
  add column if not exists currency text
    constraint purchase_orders_currency_check check (currency is null or currency in ('MXN', 'USD')),
  add column if not exists destination_warehouse_id uuid references warehouses (id) on delete restrict,
  add column if not exists direct_purchase_reason text
    constraint purchase_orders_direct_purchase_reason_check check (
      direct_purchase_reason is null or direct_purchase_reason in (
        'stock', 'interno', 'muestras', 'refaccion_mantenimiento', 'equipo', 'proyecto_especial'
      )
    ),
  add column if not exists payment_terms text,
  add column if not exists required_date date,
  add column if not exists subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  add column if not exists tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  add column if not exists total numeric(12,2) not null default 0 check (total >= 0);

-- Una OC directa siempre debe tener BU/moneda/motivo — nunca se confía
-- solo en que el RPC los exija; blindado también en DB (mismo criterio que
-- sales_orders_release_requires_non_draft, 0068).
alter table purchase_orders
  add constraint purchase_orders_direct_requires_fields check (
    origin <> 'directa'
    or (business_unit_id is not null and currency is not null and direct_purchase_reason is not null)
  );

comment on column purchase_orders.origin is 'THÖREN — Orden de Compra Directa. Fuente real del origen de la PO: pedido (rpc_create_purchase_order) | requisicion (rpc_convert_requisition_to_purchase_order) | directa (rpc_create_direct_purchase_order). Inmutable tras crear.';
comment on column purchase_orders.document_language is 'THÖREN — snapshot del idioma del documento (es/en), resuelto al crear desde business_unit_process_settings.provider_document_language salvo override manual. Inmutable tras crear — un cambio posterior a la configuración de la BU nunca reescribe una OC ya emitida.';

-- -----------------------------------------------------------------------------
-- 2) purchase_order_items — columnas monetarias nuevas. Nunca existieron:
--    esta tabla era puramente logística (cantidades). Nullable/default —
--    ninguna PO existente (Pedido/Requisición) las necesita ni las tendrá
--    pobladas retroactivamente.
-- -----------------------------------------------------------------------------
alter table purchase_order_items
  add column if not exists unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  add column if not exists tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  add column if not exists line_subtotal numeric(12,2) check (line_subtotal is null or line_subtotal >= 0),
  add column if not exists line_total numeric(12,2) check (line_total is null or line_total >= 0);

-- -----------------------------------------------------------------------------
-- 3) Trigger de identidad — extiende trg_prevent_purchase_order_folio_change
--    (0035) carácter por carácter salvo el bloque nuevo al final.
-- -----------------------------------------------------------------------------
create or replace function trg_prevent_purchase_order_folio_change()
returns trigger
language plpgsql
as $$
begin
  if new.folio is distinct from old.folio
     or new.sequence_number is distinct from old.sequence_number
     or new.organization_id is distinct from old.organization_id
     or new.order_id is distinct from old.order_id
     or new.supplier_id is distinct from old.supplier_id then
    raise exception 'No se puede modificar el folio, la organización, el Pedido origen o el proveedor de una Purchase Order ya creada.';
  end if;
  if new.origin is distinct from old.origin then
    raise exception 'El origen de una Purchase Order no se puede modificar después de creada.';
  end if;
  if new.business_unit_id is distinct from old.business_unit_id then
    raise exception 'La Business Unit de una Purchase Order no se puede modificar después de creada.';
  end if;
  if new.document_language is distinct from old.document_language then
    raise exception 'El idioma del documento de una Purchase Order no se puede modificar después de creada.';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) rpc_create_purchase_order — re-declarada, carácter por carácter igual
--    a la versión vigente (0066_supplier_product_references.sql) salvo
--    agregar `origin` (columna + valor 'pedido') al INSERT.
-- -----------------------------------------------------------------------------
create or replace function rpc_create_purchase_order(
  p_purchase_order_id uuid,
  p_purchase_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns purchase_orders
language plpgsql
as $$
declare
  v_po purchase_orders;
  v_organization_id uuid;
  v_order_id uuid;
  v_order_organization_id uuid;
  v_supplier_id uuid;
  v_po_date date;
  v_folio_result record;
  v_item jsonb;
  v_position integer;
  v_order_item_id uuid;
  v_quantity_ordered integer;
  v_src_model text;
  v_src_description text;
  v_src_catalog_product_id uuid;
  v_src_color text;
  v_src_unit text;
  v_src_customer_requirements text;
  v_snap_sku text;
  v_snap_model text;
  v_snap_description text;
  v_snap_uom text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;

  if not current_user_is_admin() and not current_user_has_capability('can_prepare_purchase_orders') then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede crear una Purchase Order.';
  end if;

  v_organization_id := current_user_organization_id();

  v_order_id := nullif(p_purchase_order->>'order_id', '')::uuid;
  if v_order_id is null then
    raise exception 'Debe indicarse el Pedido de origen.';
  end if;

  select organization_id into v_order_organization_id from orders where id = v_order_id;
  if v_order_organization_id is null or v_order_organization_id <> v_organization_id then
    raise exception 'El Pedido de origen no existe o no pertenece a tu organización.';
  end if;

  v_supplier_id := nullif(p_purchase_order->>'supplier_id', '')::uuid;
  if not exists (
    select 1 from suppliers where id = v_supplier_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El proveedor seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Debe incluir al menos una partida.';
  end if;

  v_po_date := coalesce(nullif(p_purchase_order->>'po_date', '')::date, current_date);

  select * into v_folio_result from fn_next_purchase_order_folio(v_organization_id, v_po_date);

  insert into purchase_orders (
    id, organization_id, order_id, supplier_id, folio, sequence_number, po_date,
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status, origin
  )
  values (
    p_purchase_order_id, v_organization_id, v_order_id, v_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador',
    'pedido'
  )
  returning * into v_po;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_order_item_id := nullif(v_item->>'order_item_id', '')::uuid;
    v_quantity_ordered := nullif(v_item->>'quantity_ordered', '')::integer;

    if v_order_item_id is null then
      raise exception 'Cada partida debe indicar de qué línea del Pedido proviene.';
    end if;
    if v_quantity_ordered is null or v_quantity_ordered <= 0 then
      raise exception 'La cantidad ordenada de cada partida debe ser mayor a cero.';
    end if;

    select model, description, catalog_product_id, color, unit, customer_requirements
      into v_src_model, v_src_description, v_src_catalog_product_id, v_src_color, v_src_unit, v_src_customer_requirements
      from order_items
      where id = v_order_item_id and order_id = v_order_id;

    if v_src_model is null then
      raise exception 'La partida % no pertenece al Pedido de origen.', v_order_item_id;
    end if;

    v_snap_sku := null;
    v_snap_model := null;
    v_snap_description := null;
    v_snap_uom := null;
    if v_src_catalog_product_id is not null then
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
        from supplier_product_references
        where catalog_product_id = v_src_catalog_product_id
          and supplier_id = v_supplier_id
          and active = true;
    end if;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, color, unit, customer_requirements, quantity_ordered,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot
    )
    values (
      v_po.id, v_order_item_id, v_position, v_src_catalog_product_id,
      v_src_model, v_src_description, v_src_color, v_src_unit, v_src_customer_requirements, v_quantity_ordered,
      v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
    );

    v_position := v_position + 1;
  end loop;

  return v_po;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) rpc_convert_requisition_to_purchase_order — re-declarada, carácter
--    por carácter igual a la versión vigente (0077_test_data_purge.sql)
--    salvo agregar `origin` (columna + valor 'requisicion') al INSERT.
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
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status, is_test, origin
  )
  values (
    p_purchase_order_id, v_organization_id, null, p_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador',
    coalesce(v_so_is_test, false),
    'requisicion'
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
-- 6) rpc_create_direct_purchase_order — nueva. SECURITY INVOKER (mismo
--    criterio que rpc_create_purchase_order): la autorización real de
--    escritura la dan las policies ya existentes (purchase_orders_insert_
--    prepare / purchase_order_items_insert_prepare, 0045) — admin o
--    can_prepare_purchase_orders, sobre la organización del llamador,
--    status='borrador'. No requiere Pedido, Sales Order ni Requisición.
--    No requiere cliente (purchase_orders nunca tuvo esa columna).
-- -----------------------------------------------------------------------------
create or replace function rpc_create_direct_purchase_order(
  p_purchase_order_id uuid,
  p_purchase_order jsonb,
  p_items jsonb default '[]'::jsonb
)
returns purchase_orders
language plpgsql
set search_path = public
as $$
declare
  v_po purchase_orders;
  v_organization_id uuid;
  v_business_unit_id uuid;
  v_business_unit_org uuid;
  v_supplier_id uuid;
  v_destination_warehouse_id uuid;
  v_po_date date;
  v_required_date date;
  v_currency text;
  v_direct_purchase_reason text;
  v_payment_terms text;
  v_document_language text;
  v_bu_default_language text;
  v_folio_result record;
  v_item jsonb;
  v_position integer;
  v_catalog_product_id uuid;
  v_cat_name text;
  v_cat_unit text;
  v_cat_org uuid;
  v_model text;
  v_unit text;
  v_quantity_ordered integer;
  v_unit_price numeric(12,2);
  v_tax_percent numeric(5,2);
  v_line_subtotal numeric(12,2);
  v_line_tax numeric(12,2);
  v_line_total numeric(12,2);
  v_snap_sku text;
  v_snap_model text;
  v_snap_description text;
  v_snap_uom text;
  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_is_admin() and not current_user_has_capability('can_prepare_purchase_orders') then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede crear una Orden de Compra directa.';
  end if;

  v_organization_id := current_user_organization_id();

  v_business_unit_id := nullif(p_purchase_order->>'business_unit_id', '')::uuid;
  if v_business_unit_id is null then
    raise exception 'Debe indicarse la Business Unit de la Orden de Compra.';
  end if;
  select organization_id into v_business_unit_org from business_units
    where id = v_business_unit_id and active = true;
  if v_business_unit_org is null or v_business_unit_org <> v_organization_id then
    raise exception 'La Business Unit seleccionada no existe, no pertenece a tu organización, o está inactiva.';
  end if;

  v_supplier_id := nullif(p_purchase_order->>'supplier_id', '')::uuid;
  if not exists (
    select 1 from suppliers where id = v_supplier_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El proveedor seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  v_destination_warehouse_id := nullif(p_purchase_order->>'destination_warehouse_id', '')::uuid;
  if v_destination_warehouse_id is not null and not exists (
    select 1 from warehouses where id = v_destination_warehouse_id and organization_id = v_organization_id and active = true
  ) then
    raise exception 'El almacén destino seleccionado no existe, no pertenece a tu organización, o está inactivo.';
  end if;

  v_currency := nullif(p_purchase_order->>'currency', '');
  if v_currency is null or v_currency not in ('MXN', 'USD') then
    raise exception 'Selecciona una moneda válida (MXN o USD).';
  end if;

  v_direct_purchase_reason := nullif(p_purchase_order->>'direct_purchase_reason', '');
  if v_direct_purchase_reason is null or v_direct_purchase_reason not in (
    'stock', 'interno', 'muestras', 'refaccion_mantenimiento', 'equipo', 'proyecto_especial'
  ) then
    raise exception 'Selecciona un tipo/motivo de compra válido.';
  end if;

  v_po_date := coalesce(nullif(p_purchase_order->>'po_date', '')::date, current_date);
  v_required_date := nullif(p_purchase_order->>'required_date', '')::date;
  v_payment_terms := nullif(p_purchase_order->>'payment_terms', '');

  -- Idioma del documento — default de la Business Unit (0063), override
  -- manual si se manda explícito. Snapshot: nunca se vuelve a leer
  -- business_unit_process_settings después de esta línea.
  select provider_document_language into v_bu_default_language
    from business_unit_process_settings where business_unit_id = v_business_unit_id;

  v_document_language := nullif(p_purchase_order->>'document_language', '');
  if v_document_language is null then
    v_document_language := coalesce(v_bu_default_language, 'es');
  end if;
  if v_document_language not in ('es', 'en') then
    raise exception 'Idioma de documento inválido: %.', v_document_language;
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Debe incluir al menos una partida.';
  end if;

  -- Primer recorrido: valida y calcula los totales del encabezado ANTES de
  -- insertar nada (mismo patrón que rpc_create_sales_order) — evita un
  -- UPDATE posterior al header para fijar subtotal/tax_total/total.
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_quantity_ordered := nullif(v_item->>'quantity_ordered', '')::integer;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    v_tax_percent := coalesce(nullif(v_item->>'tax_percent', '')::numeric, 0);

    if v_quantity_ordered is null or v_quantity_ordered <= 0 then
      raise exception 'La cantidad ordenada de cada partida debe ser mayor a cero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'El precio unitario de cada partida es obligatorio y no puede ser negativo.';
    end if;
    if v_tax_percent < 0 or v_tax_percent > 100 then
      raise exception 'El porcentaje de impuesto de cada partida debe estar entre 0 y 100.';
    end if;

    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    if v_catalog_product_id is null and nullif(v_item->>'description', '') is null then
      raise exception 'Una línea sin producto de catálogo debe indicar al menos una descripción.';
    end if;

    v_line_subtotal := v_quantity_ordered * v_unit_price;
    v_line_tax := round(v_line_subtotal * v_tax_percent / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_total := v_tax_total + v_line_tax;
    v_total := v_total + v_line_total;
  end loop;

  select * into v_folio_result from fn_next_purchase_order_folio(v_organization_id, v_po_date);

  insert into purchase_orders (
    id, organization_id, order_id, supplier_id, folio, sequence_number, po_date,
    supplier_commitment_date, estimated_reception_date, supplier_reference, notes, status,
    origin, business_unit_id, document_language, currency, destination_warehouse_id,
    direct_purchase_reason, payment_terms, required_date,
    subtotal, tax_total, total
  )
  values (
    p_purchase_order_id, v_organization_id, null, v_supplier_id,
    v_folio_result.folio, v_folio_result.sequence_number, v_po_date,
    nullif(p_purchase_order->>'supplier_commitment_date', '')::date,
    nullif(p_purchase_order->>'estimated_reception_date', '')::date,
    nullif(p_purchase_order->>'supplier_reference', ''),
    nullif(p_purchase_order->>'notes', ''),
    'borrador',
    'directa', v_business_unit_id, v_document_language, v_currency, v_destination_warehouse_id,
    v_direct_purchase_reason, v_payment_terms, v_required_date,
    v_subtotal, v_tax_total, v_total
  )
  returning * into v_po;

  v_position := 0;
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_catalog_product_id := nullif(v_item->>'catalog_product_id', '')::uuid;
    v_quantity_ordered := (v_item->>'quantity_ordered')::integer;
    v_unit_price := (v_item->>'unit_price')::numeric;
    v_tax_percent := coalesce(nullif(v_item->>'tax_percent', '')::numeric, 0);

    v_snap_sku := null;
    v_snap_model := null;
    v_snap_description := null;
    v_snap_uom := null;

    if v_catalog_product_id is not null then
      select name, unit, organization_id into v_cat_name, v_cat_unit, v_cat_org
        from product_catalog where id = v_catalog_product_id;
      if v_cat_org is null then
        raise exception 'rpc_create_direct_purchase_order: producto de catálogo % no encontrado.', v_catalog_product_id;
      end if;
      if v_cat_org <> v_organization_id then
        raise exception 'Uno o más productos seleccionados no pertenecen a tu organización.';
      end if;
      v_model := coalesce(nullif(v_item->>'description', ''), v_cat_name);
      v_unit := coalesce(nullif(v_item->>'unit', ''), v_cat_unit);

      -- Snapshot automático de la referencia ACTIVA de este proveedor para
      -- este producto (mismo criterio que 0066) — si no existe, cae a lo
      -- que el usuario haya escrito manualmente para esta línea (si acaso).
      select supplier_sku, supplier_model, supplier_description, supplier_uom
        into v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
        from supplier_product_references
        where catalog_product_id = v_catalog_product_id and supplier_id = v_supplier_id and active = true;

      v_snap_sku := coalesce(v_snap_sku, nullif(v_item->>'supplier_sku', ''));
      v_snap_model := coalesce(v_snap_model, nullif(v_item->>'supplier_model', ''));
      v_snap_description := coalesce(v_snap_description, nullif(v_item->>'supplier_description', ''));
      v_snap_uom := coalesce(v_snap_uom, nullif(v_item->>'supplier_uom', ''));
    else
      -- Concepto sin producto de catálogo: servicio/refacción/muestra/otro
      -- — nunca genera inventario_movement al recibirse (rpc_receive_
      -- purchase_order_item ya sólo lo hace si catalog_product_id no es
      -- null, sin cambios aquí).
      v_model := nullif(v_item->>'description', '');
      v_unit := nullif(v_item->>'unit', '');
      v_snap_sku := nullif(v_item->>'supplier_sku', '');
      v_snap_model := nullif(v_item->>'supplier_model', '');
      v_snap_description := nullif(v_item->>'supplier_description', '');
      v_snap_uom := nullif(v_item->>'supplier_uom', '');
    end if;

    v_line_subtotal := v_quantity_ordered * v_unit_price;
    v_line_tax := round(v_line_subtotal * v_tax_percent / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax;

    insert into purchase_order_items (
      purchase_order_id, order_item_id, position, catalog_product_id,
      model, description, unit, quantity_ordered,
      purchase_requisition_item_id,
      supplier_sku_snapshot, supplier_model_snapshot, supplier_description_snapshot, supplier_uom_snapshot,
      unit_price, tax_percent, line_subtotal, line_total
    )
    values (
      v_po.id, null, v_position, v_catalog_product_id,
      v_model, nullif(v_item->>'description', ''), v_unit, v_quantity_ordered,
      null,
      v_snap_sku, v_snap_model, v_snap_description, v_snap_uom,
      v_unit_price, v_tax_percent, v_line_subtotal, v_line_total
    );

    v_position := v_position + 1;
  end loop;

  return v_po;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) RLS — purchase_orders_select / purchase_order_items_select: extensión
--    ADITIVA sobre la versión VIGENTE (0070 — no 0041/0035, que ya habían
--    quedado obsoletas: 0070 agregó las ramas can_receive_inventory y
--    fn_purchase_order_requisition_owner_salesperson/fn_requisition_item_
--    owner_salesperson, "dueño vía Sales Order" para el flujo de
--    Requisición). Re-declaradas carácter por carácter iguales a esa
--    versión salvo la única rama nueva: can_prepare_purchase_orders —
--    necesaria porque una OC directa no tiene Pedido/Requisición/Sales
--    Order del que derivar "dueño", así que sin esto un preparador no
--    vería de vuelta lo que él mismo crea.
-- -----------------------------------------------------------------------------
drop policy if exists "purchase_orders_select" on purchase_orders;
create policy "purchase_orders_select" on purchase_orders
  for select using (
    current_user_active()
    and is_organization_member(organization_id)
    and (
      current_user_is_admin()
      or exists (
        select 1 from orders o
        where o.id = purchase_orders.order_id
          and o.salesperson_id = current_user_salesperson_id()
      )
      or fn_purchase_order_requisition_owner_salesperson(purchase_orders.id) = current_user_salesperson_id()
      or current_user_has_capability('can_view_all_sales')
      or current_user_has_capability('can_receive_inventory')
      or current_user_has_capability('can_prepare_purchase_orders')
    )
  );

drop policy if exists "purchase_order_items_select" on purchase_order_items;
create policy "purchase_order_items_select" on purchase_order_items
  for select using (
    current_user_active() and exists (
      select 1 from purchase_orders po
      where po.id = purchase_order_items.purchase_order_id
        and is_organization_member(po.organization_id)
        and (
          current_user_is_admin()
          or exists (
            select 1 from orders o
            where o.id = po.order_id
              and o.salesperson_id = current_user_salesperson_id()
          )
          or fn_requisition_item_owner_salesperson(purchase_order_items.purchase_requisition_item_id) = current_user_salesperson_id()
          or current_user_has_capability('can_view_all_sales')
          or current_user_has_capability('can_receive_inventory')
          or current_user_has_capability('can_prepare_purchase_orders')
        )
    )
  );

commit;
