-- THÖREN — Eliminación segura de Orden de Compra.
--
-- =========================================================================
-- AUDITORÍA PREVIA (reportada antes de escribir esta migración)
-- =========================================================================
-- No existe ningún RPC de eliminación de Purchase Order hoy — se buscó
-- "delete_purchase_order"/"purge_purchase_order" en todas las migraciones y
-- en el código TS, sin resultados. Tampoco existe ninguna policy `for
-- delete` sobre `purchase_orders` (sí existe `purchase_order_items_delete_
-- borrador`, 0045, pero SOLO para "Reemplazar partidas" — nunca borra el
-- encabezado). Sin este RPC, un DELETE directo sobre `purchase_orders`
-- fallaría igual con un error genérico de Postgres en cuanto existiera
-- cualquier `goods_receipts`/`inventory_movements` (ambas FK `on delete
-- restrict` hacia `purchase_orders`/`purchase_order_items`, 0070/0036) — el
-- objetivo de este RPC es el mismo criterio que `rpc_delete_salesperson`
-- (0079): verificar cada bloqueo PRIMERO y dar un mensaje claro en español,
-- en vez de dejar que el usuario se tope con un error crudo de FK.
--
-- SECURITY DEFINER (mismo criterio que 0079/0080): no existe ninguna
-- policy de DELETE para `purchase_orders`, así que TODO hard delete pasa
-- obligatoriamente por aquí. Resuelve organización y autoridad
-- INTERNAMENTE (current_user_organization_id()/current_user_is_admin()/
-- current_user_has_capability, 0011/0013/0040) — nunca acepta
-- organization_id como parámetro del cliente. Una Purchase Order de otra
-- organización se trata como "no encontrada".
--
-- Reglas de negocio (todas verificadas ANTES de borrar nada):
--   1. Solo status 'borrador' o 'cancelada' — cualquier otro status
--      (ordenada/confirmada/en_transito/recibida_parcial/recibida) se
--      rechaza explícitamente.
--   2. Bloquea SIEMPRE si origin='requisicion' — ver DECISIÓN abajo. SÍ
--      permite origin='directa' y origin='pedido'.
--   3. Bloquea si existe CUALQUIER goods_receipts asociado, sin importar su
--      status (incluso 'draft'/'cancelled' — más estricto que exigir solo
--      'posted': una PO con papeleo de recepción en curso, aunque no esté
--      aplicado todavía, no se considera segura de eliminar).
--   4. Bloquea si alguna partida tiene quantity_received > 0 — en la
--      práctica esto siempre implica un goods_receipts 'posted' (ver 3,
--      rpc_cancel_goods_receipt SOLO cancela 'draft', que nunca incrementó
--      quantity_received), se deja como verificación independiente,
--      explícitamente pedida, por si acaso.
--   5. Bloquea si existen inventory_movements asociados (mismo criterio:
--      en la práctica implica 3/4, verificación independiente igual).
--   6. Borra primero purchase_order_items, después el encabezado
--      purchase_orders — ambos DELETE dentro de la MISMA función, que ya
--      es una única transacción implícita (si cualquier paso lanza
--      excepción, Postgres revierte todo). Nunca toca suppliers,
--      product_catalog, warehouses ni inventory_movements/inventory
--      (requisito explícito del ticket).
--
-- DECISIÓN — origin='requisicion' bloqueada por completo (ajuste de
-- cierre, descubierto al probar): la primera versión de este RPC sí
-- permitía eliminar una PO de requisición en borrador, pero no revertía
-- el quantity_ordered que la conversión había sumado en
-- purchase_requisition_items ni el status de la requisición de origen —
-- `trg_purchase_requisition_status_transition` (0069) es un trinquete
-- estrictamente hacia adelante (draft->submitted/cancelled->partially_
-- ordered/ordered->cancelled, JAMÁS hacia atrás), así que recalcular el
-- status tras revertir (p.ej. ordered -> submitted) siempre viola ese
-- trigger. En vez de dejar la requisición de origen con datos
-- inconsistentes (cantidad marcada "ya ordenada" sin ninguna PO real
-- detrás), se bloquea la eliminación por completo para este origen "por
-- ahora" — diseñar la reversión correcta de requisiciones queda
-- explícitamente fuera de alcance de este ajuste.
-- =========================================================================

begin;

create or replace function rpc_delete_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
  v_organization_id uuid;
  v_count integer;
begin
  if current_user_role() is null or not current_user_active() then
    raise exception 'Tu usuario no tiene acceso operativo en GS Orders. Contacta al administrador.';
  end if;
  if not (current_user_is_admin() or current_user_has_capability('can_prepare_purchase_orders')) then
    raise exception 'Solo un administrador o un usuario con autoridad de preparación de Compras puede eliminar una Orden de Compra.';
  end if;

  v_organization_id := current_user_organization_id();
  if v_organization_id is null then
    raise exception 'Tu usuario no tiene una organización asociada. Contacta a soporte.';
  end if;

  select * into v_po from purchase_orders
    where id = p_purchase_order_id and organization_id = v_organization_id
    for update;
  if v_po.id is null then
    raise exception 'Orden de Compra no encontrada.';
  end if;

  if v_po.status not in ('borrador', 'cancelada') then
    raise exception 'Solo se puede eliminar una Orden de Compra en borrador o cancelada (status actual: %).', v_po.status;
  end if;

  if v_po.origin = 'requisicion' then
    raise exception 'No se puede eliminar una Orden de Compra originada desde una requisición porque afectaría las cantidades ya ordenadas.';
  end if;

  select count(*) into v_count from goods_receipts where purchase_order_id = p_purchase_order_id;
  if v_count > 0 then
    raise exception 'No se puede eliminar: tiene % recepción(es) de mercancía asociada(s).', v_count;
  end if;

  select count(*) into v_count from purchase_order_items
    where purchase_order_id = p_purchase_order_id and quantity_received > 0;
  if v_count > 0 then
    raise exception 'No se puede eliminar: tiene partidas con mercancía ya recibida.';
  end if;

  select count(*) into v_count from inventory_movements where purchase_order_id = p_purchase_order_id;
  if v_count > 0 then
    raise exception 'No se puede eliminar: tiene % movimiento(s) de inventario asociado(s).', v_count;
  end if;

  -- Nunca toca purchase_requisitions/purchase_requisition_items — ver
  -- LIMITACIÓN CONOCIDA en el comentario de cabecera de esta migración.
  delete from purchase_order_items where purchase_order_id = p_purchase_order_id;
  delete from purchase_orders where id = p_purchase_order_id and organization_id = v_organization_id;
end;
$$;

commit;
