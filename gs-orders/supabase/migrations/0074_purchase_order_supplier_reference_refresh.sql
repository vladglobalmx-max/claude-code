-- THÖREN 0074 — Fix puntual: refrescar snapshots de proveedor en una
-- Purchase Order en borrador SIN pasar por "Reemplazar partidas".
--
-- =========================================================================
-- BUG (producción): OC-20261409-009 se creó desde una Requisición cuando
-- el producto todavía no tenía supplier_product_reference. Se agregó la
-- referencia en Catálogo después, pero el snapshot de la PO sigue vacío —
-- la única vía existente para refrescarlo es rpc_replace_purchase_order_items
-- ("Reemplazar partidas"), que 0069 (sección 19) rechaza EXPLÍCITAMENTE
-- para cualquier PO originada en Requisición (`v_po.order_id is null`) —
-- por diseño: esa vía reconstruye líneas completas desde order_items, que
-- una PO de Requisición nunca tuvo. La UI (compras/[id]/page.tsx) además
-- oculta el formulario de reemplazo para estas POs (`canEditItems` exige
-- `order !== null`) pero el aviso de "falta referencia" seguía sugiriendo
-- "usa Reemplazar partidas" sin distinguir el origen — instrucción
-- imposible de seguir. Callejón sin salida real para el usuario.
--
-- =========================================================================
-- FIX (puntual, no refactor general): UN solo RPC nuevo,
-- rpc_refresh_purchase_order_supplier_references, que hace EXACTAMENTE lo
-- que su nombre dice y nada más — resuelve de nuevo
-- supplier_product_references (activa) por línea catalogada y actualiza
-- ÚNICAMENTE sus 4 columnas de snapshot (supplier_sku_snapshot/
-- supplier_model_snapshot/supplier_description_snapshot/
-- supplier_uom_snapshot), vía UPDATE fila-por-fila que preserva el id de
-- cada purchase_order_items (nunca DELETE+INSERT como
-- rpc_replace_purchase_order_items — recrear filas cambiaría su id y
-- rompería cualquier FK futura desde goods_receipt_items/
-- inventory_movements, además de reordenar posiciones sin necesidad).
-- Ningún otro campo de la línea (quantity_ordered, catalog_product_id,
-- model, description, color, unit, customer_requirements,
-- purchase_requisition_item_id, order_item_id, position) se toca jamás —
-- ni la propia sentencia UPDATE los menciona.
--
-- =========================================================================
-- DECISIÓN — el RPC NO distingue origen (Requisición vs Pedido): la
-- operación en sí (resolver snapshot por catalog_product_id + supplier_id
-- de la PO) es idéntica para ambos y ya es un subconjunto estricto de lo
-- que "Reemplazar partidas" hace hoy para POs de Pedido (esa vía YA
-- recalcula el mismo snapshot, además de reconstruir líneas) — no hay
-- superficie nueva que proteger agregando un guard de origen aquí. Quien
-- decide DÓNDE se ofrece el botón es la UI (solo se muestra para POs de
-- Requisición, ver DECISIÓN de UI más abajo): una PO de Pedido sigue
-- teniendo "Reemplazar partidas" como su única vía en la práctica.
--
-- =========================================================================
-- DECISIÓN — SECURITY DEFINER (a diferencia de rpc_replace_purchase_order_items,
-- que es INVOKER): esa función nunca necesitó DEFINER porque solo hace
-- DELETE + INSERT sobre purchase_order_items, cubiertos por
-- purchase_order_items_delete_borrador/_insert_prepare (0045, ambas
-- admin-OR-can_prepare_purchase_orders). Pero la única policy de UPDATE
-- sobre esa tabla, purchase_order_items_update_admin (0035), es
-- ADMIN-ONLY — sin rama para can_prepare_purchase_orders (confirmado
-- leyendo la migración: el comentario de esa policy dice explícitamente
-- que en esa fase el único UPDATE real era canReceive sobre
-- quantity_received, nunca se pensó para snapshots). Como este fix
-- necesita reescribir sus 4 columnas vía UPDATE preservando el id (ver
-- arriba) y debe funcionar para un preparador NO-admin (no solo para
-- admin), SECURITY DEFINER es necesario — mismo criterio ya usado en
-- 0035/0036/0038/0070/0071 para RPCs que escriben en una tabla sin policy
-- para la capability real. La autorización real sigue siendo el chequeo
-- explícito de admin-OR-can_prepare_purchase_orders al inicio del cuerpo,
-- nunca la policy — DEFINER solo permite que la escritura YA autorizada
-- llegue a la tabla. No se amplía purchase_order_items_update_admin (eso
-- sí sería un cambio de alcance general, fuera de "fix puntual").
--
-- =========================================================================
-- DECISIÓN — solo 'borrador' (regla explícita del ticket): fuera de
-- borrador, purchase_order_items ya está congelada por el resto del
-- sistema (recepción/inventario dependen de que no cambie), y el propio
-- aviso de "falta referencia" en la UI ya deja de mostrarse fuera de
-- borrador (ver compras/[id]/page.tsx) — no hay caso de uso real fuera de
-- ese status.
--
-- =========================================================================
-- DECISIÓN — referencia inactiva NUNCA se usa (regla explícita del
-- ticket): mismo criterio EXACTO que rpc_create_purchase_order/
-- rpc_replace_purchase_order_items/rpc_convert_requisition_to_purchase_order
-- (0066/0069) — el filtro `active = true` es el único filtro; si la única
-- referencia existente está inactiva, el snapshot queda/vuelve a NULL
-- (nunca cae al modelo interno como sustituto). Esto también CORRIGE
-- snapshots que quedaron obsoletos si la referencia se desactivó después
-- de haberse resuelto una vez — el refresh es una recomputación completa,
-- no un parche que solo llena huecos.
--
-- Como el resto del proyecto: idempotente (create or replace) y corre
-- completa en una transacción (begin/commit).

begin;

-- =========================================================================
-- rpc_refresh_purchase_order_supplier_references — ver DECISIONES arriba.
-- =========================================================================
create or replace function rpc_refresh_purchase_order_supplier_references(
  p_purchase_order_id uuid
)
returns setof purchase_order_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
  v_item purchase_order_items;
  v_snap_sku text;
  v_snap_model text;
  v_snap_description text;
  v_snap_uom text;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación puede actualizar las referencias de proveedor de una Purchase Order.';
  end if;

  select * into v_po from purchase_orders where id = p_purchase_order_id for update;
  if v_po.id is null then
    raise exception 'Purchase Order no encontrada: %', p_purchase_order_id;
  end if;
  if not is_organization_member(v_po.organization_id) then
    raise exception 'Esta Purchase Order no pertenece a tu organización.';
  end if;
  if v_po.status <> 'borrador' then
    raise exception 'Solo se pueden actualizar las referencias de proveedor de una Purchase Order mientras está en borrador.';
  end if;

  for v_item in
    select * from purchase_order_items
    where purchase_order_id = v_po.id and catalog_product_id is not null
    order by position
  loop
    v_snap_sku := null;
    v_snap_model := null;
    v_snap_description := null;
    v_snap_uom := null;

    select supplier_sku, supplier_model, supplier_description, supplier_uom
      into v_snap_sku, v_snap_model, v_snap_description, v_snap_uom
      from supplier_product_references
      where catalog_product_id = v_item.catalog_product_id
        and supplier_id = v_po.supplier_id
        and active = true;

    update purchase_order_items set
      supplier_sku_snapshot = v_snap_sku,
      supplier_model_snapshot = v_snap_model,
      supplier_description_snapshot = v_snap_description,
      supplier_uom_snapshot = v_snap_uom
    where id = v_item.id;
  end loop;

  return query select * from purchase_order_items where purchase_order_id = v_po.id order by position;
end;
$$;

commit;
