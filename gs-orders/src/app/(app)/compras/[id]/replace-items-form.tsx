"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderItem, PurchaseOrderItem } from "@/types/domain";
import { replacePurchaseOrderItems } from "../actions";

interface SelectedItem {
  selected: boolean;
  quantity: number;
}

/**
 * THÖREN 6R.1B-3B — edición de partidas EN BORRADOR, vía
 * rpc_replace_purchase_order_items (0045). Solo se monta cuando la página
 * ya decidió `canPrepare && status === 'borrador'` — este componente no
 * repite ese chequeo, confía en el guard del padre (mismo criterio que
 * PurchaseOrderDetailsForm). El universo de partidas seleccionables es el
 * mismo que al crear la Purchase Order (`orderItems`, las líneas del
 * Pedido origen) — las ya incluidas en la OC vienen preseleccionadas con
 * su cantidad actual. El submit manda el conjunto COMPLETO al RPC (nunca
 * un delta) — reemplaza, no aplica un ajuste incremental.
 */
export function ReplaceItemsForm({
  purchaseOrderId,
  orderItems,
  currentItems,
}: {
  purchaseOrderId: string;
  orderItems: OrderItem[];
  currentItems: PurchaseOrderItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentByOrderItem = new Map(
    currentItems.filter((i) => i.order_item_id).map((i) => [i.order_item_id as string, i])
  );
  const [selection, setSelection] = useState<Record<string, SelectedItem>>(() =>
    Object.fromEntries(
      orderItems.map((item) => {
        const existing = currentByOrderItem.get(item.id);
        return [item.id, { selected: existing !== undefined, quantity: existing?.quantity_ordered ?? item.quantity }];
      })
    )
  );

  function toggleItem(itemId: string, selected: boolean) {
    setSelection((prev) => ({ ...prev, [itemId]: { selected, quantity: prev[itemId]?.quantity ?? 1 } }));
  }

  function setQuantity(itemId: string, quantity: number) {
    setSelection((prev) => ({ ...prev, [itemId]: { selected: prev[itemId]?.selected ?? false, quantity } }));
  }

  function handleSubmit() {
    const selectedItems = orderItems.filter((item) => selection[item.id]?.selected);
    if (selectedItems.length === 0) {
      toast.error("Debe incluir al menos una partida");
      return;
    }
    if (selectedItems.some((item) => !((selection[item.id]?.quantity ?? 0) > 0))) {
      toast.error("La cantidad ordenada de cada partida debe ser mayor a cero");
      return;
    }

    startTransition(async () => {
      const result = await replacePurchaseOrderItems(purchaseOrderId, {
        items: selectedItems.map((item) => ({
          order_item_id: item.id,
          quantity_ordered: selection[item.id]?.quantity ?? 0,
        })),
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Partidas actualizadas");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {orderItems.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
              checked={selection[item.id]?.selected ?? false}
              onChange={(e) => toggleItem(item.id, e.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.model}</p>
              {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
              <p className="text-xs text-ink-faint">
                Cantidad en el Pedido: {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </p>
            </div>
            <div className="w-24 shrink-0">
              <Label htmlFor={`replace-qty-${item.id}`} className="text-xs">
                A ordenar
              </Label>
              <Input
                id={`replace-qty-${item.id}`}
                type="number"
                min={1}
                value={selection[item.id]?.quantity ?? item.quantity}
                disabled={!selection[item.id]?.selected}
                onChange={(e) => setQuantity(item.id, Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" size="sm" loading={isPending} disabled={isPending} onClick={handleSubmit}>
        Guardar partidas
      </Button>
    </div>
  );
}
