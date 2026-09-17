-- THÖREN — Arranque limpio: limpieza controlada de TODA la operación
-- transaccional de prueba/UAT de una organización, de un solo golpe.
--
-- =========================================================================
-- CONTEXTO — por qué esto es distinto de 0077/0079
-- =========================================================================
-- 0077 ya resolvió, para el pipeline NUEVO (Sales Orders, desde 0067), un
-- mecanismo completo y probado: `sales_orders.is_test` como fuente de
-- verdad + `rpc_purge_test_sales_order(id)` que borra UNA Sales Order y
-- toda su cadena derivada. Este ticket NO reinventa esa lógica — la
-- REUTILIZA (llamada en bucle, una vez por Sales Order de prueba de la
-- organización).
--
-- El pipeline LEGADO (`orders`/`quotes`, Pedidos/Cotizaciones — sigue
-- activo hoy) nunca tuvo columna `is_test` ni mecanismo de purga: hoy,
-- según el usuario, el 100% de lo que existe ahí es UAT. Esta migración
-- agrega la purga de ESE pipeline (sin agregar ninguna columna `is_test`
-- nueva — no hace falta: se purga todo excepto lo explícitamente
-- protegido, ver GUARDAS).
--
-- A diferencia del pipeline nuevo, el pipeline legado NO tiene triggers de
-- inmutabilidad ("freeze") en ninguna de sus tablas hijas (confirmado por
-- introspección: order_items, quote_items, delivery_items,
-- purchase_order_items del flujo Pedidos no tienen ningún trigger que
-- bloquee DELETE) — un DELETE directo en el orden correcto basta, sin
-- necesidad del bypass de GUC + re-verificación que sí hizo falta en 0077.
--
-- =========================================================================
-- GUARDAS — qué NUNCA se toca, pase lo que pase
-- =========================================================================
--   - `quotes.source = 'cotizia'` — esquema para las cotizaciones
--     históricas reales de CotizIA (0028). El script de datos que las
--     carga corre APARTE de esta limpieza, probablemente después. Excluidas
--     SIEMPRE por diseño permanente, nunca "porque hoy no existen".
--   - Cualquier `orders.source_quote_id` que apunte a una Quote protegida
--     arriba — ya lo garantiza la propia FK RESTRICT, pero se excluye
--     también explícitamente del conjunto a purgar por claridad.
--   - Cualquier `sales_orders.is_test = false` — nunca entra al conjunto
--     que se pasa a `rpc_purge_test_sales_order` (que además la rechazaría
--     igual, es su propia primera validación).
--   - NINGÚN dato maestro: organizations, business_units, product_catalog,
--     product_types, customers, customer_contacts, suppliers,
--     supplier_product_references, people, salespeople (la fila — ver
--     abajo sobre su contador), user_profiles, warehouses,
--     custom_field_definitions, capabilities.
--   - Fuera de alcance DELIBERADO de este ticket: `rpc_create_purchase_order`
--     (flujo "Orden de Compra Directa" del pipeline Pedidos) no se toca ni
--     se modifica — esta migración solo BORRA filas ya existentes de
--     `purchase_orders`/`purchase_order_items` ligadas a Pedidos purgados,
--     nunca cambia cómo se crean.
--
-- =========================================================================
-- QUÉ SÍ SE REINICIA (nunca se borra la fila, solo el contador)
-- =========================================================================
-- `salespeople.sequence_current` (folio Pedidos), `salesperson_quote_sequences.
-- sequence_current` (folio Cotizaciones), y los 6 singletons por
-- organización: purchase_order_sequences, sales_order_sequences,
-- purchase_requisition_sequences, goods_receipt_sequences,
-- sales_fulfillment_sequences, invoice_sequences.
--
-- =========================================================================
-- ORDEN DE BORRADO — pipeline legado (confirmado por introspección real del
-- esquema; solo purchase_orders/inventory_movements tienen de verdad
-- ON DELETE RESTRICT hacia orders — inventory_reservations/deliveries/
-- purchase_requirements en realidad son ON DELETE CASCADE desde orders, así
-- que el paso 8 por sí solo ya las eliminaría; se borran explícitas ANTES
-- de todos modos, únicamente para poder reportar su conteo exacto vía GET
-- DIAGNOSTICS — nunca por necesidad de FK):
--   1. custom_field_values (entity_type in ('order_item','quote_item'), sin
--      FK real — se limpia a mano antes de que sus padres desaparezcan).
--   2. inventory_movements — RESTRICT real hacia purchase_orders
--      (recepcion_compra/correccion_recepcion) y hacia orders directo
--      (surtido_pedido, 0038) — este paso SÍ es obligatorio por FK.
--   3. goods_receipt_items (explícito, sin freeze trigger en este pipeline)
--      + goods_receipts — RESTRICT real hacia purchase_orders — obligatorio.
--   4. purchase_orders (cascade -> purchase_order_items) — RESTRICT real
--      hacia orders vía order_id — obligatorio.
--   5. purchase_requirements (cascade -> allocations/source_items) — YA es
--      CASCADE desde orders; se borra explícito solo para contar.
--   6. inventory_reservations (cascade -> events) — YA es CASCADE desde
--      orders; se borra explícito solo para contar.
--   7. deliveries (cascade -> items/files/status_history) — YA es CASCADE
--      desde orders; se borra explícito solo para contar.
--   8. orders (cascade -> order_items -> order_item_images, order_images,
--      order_files, order_operational_status_history) — ya sin nada que la
--      restrinja de verdad.
--   9. quotes (cascade -> quote_items) — DESPUÉS de orders (ninguna Quote
--      no protegida puede tener ya un Order restante apuntándole).
-- El pipeline nuevo (Sales Orders de prueba) se purga ANTES que nada, vía
-- `rpc_purge_test_sales_order` en bucle — es completamente independiente
-- del pipeline legado (no comparten `orders`/`quotes`).
--
-- =========================================================================
-- DOS FUNCIONES — preview (solo lectura) y ejecución real (requiere
-- confirmación explícita, parámetro obligatorio sin default):
--   rpc_preview_purge_all_test_operations()               -- dry-run
--   rpc_purge_all_test_operations(p_confirm boolean)       -- real, exige p_confirm = true
-- Ambas resuelven la organización del llamador internamente (nunca la
-- reciben como parámetro) y exigen can_purge_test_operations (0077 — ya
-- devuelve true para admin, ver current_user_has_capability).
-- =========================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Preview — SOLO LECTURA. Cuenta, por tabla/categoría, exactamente lo
--    que `rpc_purge_all_test_operations(true)` borraría/reiniciaría en este
--    momento. Nunca escribe nada.
-- -----------------------------------------------------------------------------
create or replace function rpc_preview_purge_all_test_operations()
returns table (category text, row_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_has_capability('can_purge_test_operations') then
    raise exception 'Solo Dirección General o un administrador autorizado puede previsualizar la limpieza de operaciones de prueba.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización asociada. Contacta a soporte.';
  end if;

  return query
  with protected_quotes as (
    select id from quotes where organization_id = v_organization_id and source = 'cotizia'
  ),
  purge_orders as (
    select o.id from orders o
    where o.organization_id = v_organization_id
      and (o.source_quote_id is null or o.source_quote_id not in (select id from protected_quotes))
  ),
  purge_quotes as (
    select id from quotes where organization_id = v_organization_id and source <> 'cotizia'
  ),
  purge_sales_orders as (
    select id from sales_orders where organization_id = v_organization_id and is_test = true
  ),
  so_requisitions as (
    select id from purchase_requisitions where sales_order_id in (select id from purge_sales_orders)
  ),
  so_fulfillments as (
    select id from sales_fulfillments where sales_order_id in (select id from purge_sales_orders)
  ),
  so_invoices as (
    select id from invoices where sales_order_id in (select id from purge_sales_orders)
  ),
  so_purchase_order_ids as (
    select distinct poi.purchase_order_id
    from purchase_order_items poi
    join purchase_requisition_items pri on pri.id = poi.purchase_requisition_item_id
    where pri.purchase_requisition_id in (select id from so_requisitions)
  ),
  legacy_purchase_order_ids as (
    select id from purchase_orders where order_id in (select id from purge_orders)
  )
  select 'sales_orders_prueba'::text, count(*)::integer from purge_sales_orders
  union all
  select 'sales_order_items_prueba', count(*)::integer from sales_order_items where sales_order_id in (select id from purge_sales_orders)
  union all
  select 'purchase_requisitions_prueba', count(*)::integer from so_requisitions
  union all
  select 'purchase_requisition_items_prueba', count(*)::integer from purchase_requisition_items where purchase_requisition_id in (select id from so_requisitions)
  union all
  select 'commission_records_prueba', count(*)::integer from commission_records where sales_order_id in (select id from purge_sales_orders)
  union all
  select 'invoices_prueba', count(*)::integer from so_invoices
  union all
  select 'invoice_items_prueba', count(*)::integer from invoice_items where invoice_id in (select id from so_invoices)
  union all
  select 'invoice_payments_prueba', count(*)::integer from invoice_payments where invoice_id in (select id from so_invoices)
  union all
  select 'sales_fulfillments_prueba', count(*)::integer from so_fulfillments
  union all
  select 'sales_fulfillment_items_prueba', count(*)::integer from sales_fulfillment_items where sales_fulfillment_id in (select id from so_fulfillments)
  union all
  select 'purchase_orders_prueba', count(*)::integer from purchase_orders where id in (select purchase_order_id from so_purchase_order_ids)
  union all
  select 'goods_receipts_prueba', count(*)::integer from goods_receipts where purchase_order_id in (select purchase_order_id from so_purchase_order_ids)
  union all
  select 'inventory_movements_prueba', count(*)::integer from inventory_movements
    where (movement_type in ('recepcion_compra', 'correccion_recepcion') and purchase_order_id in (select purchase_order_id from so_purchase_order_ids))
       or (movement_type = 'surtido_venta' and sales_fulfillment_id in (select id from so_fulfillments))
  union all
  select 'pedidos_legado', count(*)::integer from purge_orders
  union all
  select 'pedido_items_legado', count(*)::integer from order_items where order_id in (select id from purge_orders)
  union all
  select 'cotizaciones_legado', count(*)::integer from purge_quotes
  union all
  select 'cotizacion_items_legado', count(*)::integer from quote_items where quote_id in (select id from purge_quotes)
  union all
  select 'custom_field_values_legado', count(*)::integer from custom_field_values
    where (entity_type = 'order_item' and entity_id in (select id from order_items where order_id in (select id from purge_orders)))
       or (entity_type = 'quote_item' and entity_id in (select id from quote_items where quote_id in (select id from purge_quotes)))
  union all
  select 'purchase_orders_legado', count(*)::integer from legacy_purchase_order_ids
  union all
  select 'goods_receipts_legado', count(*)::integer from goods_receipts where purchase_order_id in (select id from legacy_purchase_order_ids)
  union all
  select 'inventory_movements_legado', count(*)::integer from inventory_movements
    where purchase_order_id in (select id from legacy_purchase_order_ids)
       or order_id in (select id from purge_orders)
  union all
  select 'inventory_reservations_legado', count(*)::integer from inventory_reservations where order_id in (select id from purge_orders)
  union all
  select 'entregas_legado', count(*)::integer from deliveries where order_id in (select id from purge_orders)
  union all
  select 'purchase_requirements_legado', count(*)::integer from purchase_requirements where order_id in (select id from purge_orders)
  union all
  select 'contador_folio_vendedor_pedidos_a_reiniciar', count(*)::integer from salespeople where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_vendedor_cotizaciones_a_reiniciar', count(*)::integer from salesperson_quote_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_purchase_orders_a_reiniciar', count(*)::integer from purchase_order_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_sales_orders_a_reiniciar', count(*)::integer from sales_order_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_purchase_requisitions_a_reiniciar', count(*)::integer from purchase_requisition_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_goods_receipts_a_reiniciar', count(*)::integer from goods_receipt_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_sales_fulfillments_a_reiniciar', count(*)::integer from sales_fulfillment_sequences where organization_id = v_organization_id and sequence_current <> 0
  union all
  select 'contador_folio_invoices_a_reiniciar', count(*)::integer from invoice_sequences where organization_id = v_organization_id and sequence_current <> 0;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Ejecución real — exige p_confirm = true explícito (sin default: el
--    cliente SIEMPRE tiene que pasarlo a propósito, nunca por omisión).
--    Devuelve un resumen (categoría, filas afectadas) — para la cadena de
--    Sales Orders de prueba reutiliza rpc_purge_test_sales_order (0077) tal
--    cual, sin reimplementar su lógica; el detalle por sub-tabla de esa
--    cadena ya se mostró completo en el preview.
-- -----------------------------------------------------------------------------
create or replace function rpc_purge_all_test_operations(p_confirm boolean)
returns table (category text, deleted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_purge_sales_order_ids uuid[];
  v_purge_order_ids uuid[];
  v_purge_quote_ids uuid[];
  v_legacy_po_ids uuid[];
  v_so_id uuid;
  v_n integer;
  v_n_sales_orders integer := 0;
  v_n_orders integer;
  v_n_quotes integer;
  v_n_custom_field_values integer;
  v_n_inventory_movements_legacy integer;
  v_n_goods_receipts_legacy integer;
  v_n_purchase_orders_legacy integer;
  v_n_purchase_requirements integer;
  v_n_inventory_reservations integer;
  v_n_deliveries integer;
  v_n_sequences_reset integer := 0;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not current_user_has_capability('can_purge_test_operations') then
    raise exception 'Solo Dirección General o un administrador autorizado puede ejecutar la limpieza de operaciones de prueba.';
  end if;
  if p_confirm is distinct from true then
    raise exception 'Debes confirmar explícitamente (p_confirm = true) para ejecutar la limpieza real. Usa rpc_preview_purge_all_test_operations() primero para revisar los conteos.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización asociada. Contacta a soporte.';
  end if;

  -- Conjuntos objetivo — calculados UNA sola vez, idénticos a los del
  -- preview (mismas 4 condiciones exactas), nunca recalculados a mitad de
  -- la función.
  select coalesce(array_agg(id), array[]::uuid[]) into v_purge_sales_order_ids
    from sales_orders where organization_id = v_organization_id and is_test = true;

  select coalesce(array_agg(id), array[]::uuid[]) into v_purge_quote_ids
    from quotes where organization_id = v_organization_id and source <> 'cotizia';

  select coalesce(array_agg(o.id), array[]::uuid[]) into v_purge_order_ids
    from orders o
    where o.organization_id = v_organization_id
      and (
        o.source_quote_id is null
        or o.source_quote_id not in (select id from quotes where organization_id = v_organization_id and source = 'cotizia')
      );

  -- =====================================================================
  -- A) Sales Orders de prueba — reutiliza rpc_purge_test_sales_order tal
  --    cual, una vez por cada una. Esa función ya valida is_test=true,
  --    organización y autoridad por su cuenta.
  -- =====================================================================
  foreach v_so_id in array v_purge_sales_order_ids
  loop
    perform rpc_purge_test_sales_order(v_so_id);
    v_n_sales_orders := v_n_sales_orders + 1;
  end loop;

  -- =====================================================================
  -- B) Pipeline legado (Pedidos/Cotizaciones) — orden que respeta cada FK
  --    ON DELETE RESTRICT real (ver comentario de ORDEN DE BORRADO arriba).
  -- =====================================================================

  -- 1. custom_field_values (sin FK real, entity_id polimórfico).
  delete from custom_field_values
  where (entity_type = 'order_item' and entity_id in (select id from order_items where order_id = any(v_purge_order_ids)))
     or (entity_type = 'quote_item' and entity_id in (select id from quote_items where quote_id = any(v_purge_quote_ids)));
  get diagnostics v_n_custom_field_values = row_count;

  -- POs legadas (order_id no nulo) ligadas a los Pedidos a purgar.
  select coalesce(array_agg(id), array[]::uuid[]) into v_legacy_po_ids
    from purchase_orders where order_id = any(v_purge_order_ids);

  -- 2. inventory_movements — RESTRICT hacia purchase_orders (recepción) y
  --    hacia orders directo (surtido_pedido, 0038).
  delete from inventory_movements
  where purchase_order_id = any(v_legacy_po_ids)
     or order_id = any(v_purge_order_ids);
  get diagnostics v_n_inventory_movements_legacy = row_count;

  -- 3. goods_receipt_items (explícito) + goods_receipts — RESTRICT hacia
  --    purchase_orders.
  delete from goods_receipt_items
  where goods_receipt_id in (select id from goods_receipts where purchase_order_id = any(v_legacy_po_ids));
  delete from goods_receipts where purchase_order_id = any(v_legacy_po_ids);
  get diagnostics v_n_goods_receipts_legacy = row_count;

  -- 4. purchase_orders (cascade -> purchase_order_items) — RESTRICT hacia
  --    orders vía order_id.
  delete from purchase_orders where id = any(v_legacy_po_ids);
  get diagnostics v_n_purchase_orders_legacy = row_count;

  -- 5. purchase_requirements (cascade -> allocations/source_items) — ya es
  --    CASCADE desde orders; se borra explícito solo para contar.
  delete from purchase_requirements where order_id = any(v_purge_order_ids);
  get diagnostics v_n_purchase_requirements = row_count;

  -- 6. inventory_reservations (cascade -> events) — ya es CASCADE desde
  --    orders; se borra explícito solo para contar.
  delete from inventory_reservations where order_id = any(v_purge_order_ids);
  get diagnostics v_n_inventory_reservations = row_count;

  -- 7. deliveries (cascade -> items/files/status_history) — ya es CASCADE
  --    desde orders; se borra explícito solo para contar.
  delete from deliveries where order_id = any(v_purge_order_ids);
  get diagnostics v_n_deliveries = row_count;

  -- 8. orders (cascade -> order_items -> order_item_images, order_images,
  --    order_files, order_operational_status_history).
  delete from orders where id = any(v_purge_order_ids);
  get diagnostics v_n_orders = row_count;

  -- 9. quotes (cascade -> quote_items) — DESPUÉS de orders: ninguna Quote
  --    no protegida puede tener ya un Order apuntándole.
  delete from quotes where id = any(v_purge_quote_ids);
  get diagnostics v_n_quotes = row_count;

  -- =====================================================================
  -- C) Reinicio de contadores/folios — nunca se borra la fila, solo el
  --    contador vuelve a 0.
  -- =====================================================================
  update salespeople set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update salesperson_quote_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update purchase_order_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update sales_order_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update purchase_requisition_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update goods_receipt_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update sales_fulfillment_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  update invoice_sequences set sequence_current = 0 where organization_id = v_organization_id and sequence_current <> 0;
  get diagnostics v_n = row_count; v_n_sequences_reset := v_n_sequences_reset + v_n;

  return query
  select * from (values
    ('sales_orders_prueba', v_n_sales_orders),
    ('pedidos_legado', v_n_orders),
    ('cotizaciones_legado', v_n_quotes),
    ('custom_field_values_legado', v_n_custom_field_values),
    ('purchase_orders_legado', v_n_purchase_orders_legacy),
    ('goods_receipts_legado', v_n_goods_receipts_legacy),
    ('inventory_movements_legado', v_n_inventory_movements_legacy),
    ('inventory_reservations_legado', v_n_inventory_reservations),
    ('entregas_legado', v_n_deliveries),
    ('purchase_requirements_legado', v_n_purchase_requirements),
    ('contadores_de_folio_reiniciados', v_n_sequences_reset)
  ) as t(category, deleted_count);
end;
$$;

commit;
