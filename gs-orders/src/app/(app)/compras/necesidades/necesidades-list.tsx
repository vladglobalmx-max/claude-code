"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { OpenPurchaseRequirement } from "@/lib/purchasing/purchase-requirements";
import type { Supplier } from "@/types/domain";
import { createPurchaseOrdersFromRequirements } from "./actions";

type RequirementRow = OpenPurchaseRequirement & { representativeOrderItemId: string };

/**
 * THÖREN Fase 9 / Block 1 — selección + cantidades + un proveedor único
 * por envío (Parte F: "seleccionar proveedor, seleccionar uno o varios
 * requirements, escoger cantidades, crear PO draft"). La cantidad por
 * defecto es `remainingQty` (lo que YA falta cubrir), nunca `requiredQty`
 * a secas — evita pre-cargar una compra mayor a lo que en verdad hace
 * falta si parte del requirement ya tiene una PO parcial.
 */
export function NecesidadesList({ requirements, suppliers }: { requirements: RequirementRow[]; suppliers: Supplier[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(requirements.map((r) => [r.id, r.remainingQty]))
  );
  const [supplierId, setSupplierId] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedRequirements = useMemo(() => requirements.filter((r) => selected[r.id]), [requirements, selected]);
  const orderCount = useMemo(() => new Set(selectedRequirements.map((r) => r.orderId)).size, [selectedRequirements]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCreate() {
    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (selectedRequirements.length === 0) {
      toast.error("Selecciona al menos una necesidad de compra");
      return;
    }

    startTransition(async () => {
      const result = await createPurchaseOrdersFromRequirements(
        supplierId,
        selectedRequirements.map((r) => ({
          requirementId: r.id,
          orderId: r.orderId,
          orderItemId: r.representativeOrderItemId,
          quantity: quantities[r.id] ?? r.remainingQty,
        }))
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.message) toast.info(result.message);
      toast.success(
        result.purchaseOrderIds.length === 1 ? "Purchase Order creada" : `${result.purchaseOrderIds.length} Purchase Orders creadas`
      );
      router.push(`/compras/${result.purchaseOrderIds[0]}`);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs">
          <Label htmlFor="supplierId">Proveedor</Label>
          <Select id="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Selecciona un proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3">
          {orderCount > 1 && (
            <p className="text-xs text-ink-faint">
              Se crearán {orderCount} Purchase Orders porque actualmente cada PO pertenece a un solo Pedido.
            </p>
          )}
          <Button type="button" loading={isPending} disabled={isPending} onClick={handleCreate}>
            Crear Purchase Order
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <Thead>
            <Tr>
              <Th />
              <Th>Pedido</Th>
              <Th>Producto</Th>
              <Th>Proveedor sugerido</Th>
              <Th>Falta cubrir</Th>
              <Th>Cantidad a comprar</Th>
              <Th>Estado</Th>
            </Tr>
          </Thead>
          <Tbody>
            {requirements.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                  />
                </Td>
                <Td className="font-mono text-sm text-accent">{r.orderFolio}</Td>
                <Td>{r.productName}</Td>
                <Td className="text-ink-soft">{r.supplierName ?? "—"}</Td>
                <Td>{r.remainingQty}</Td>
                <Td>
                  <Input
                    type="number"
                    min={1}
                    max={r.remainingQty}
                    className="w-24"
                    value={quantities[r.id] ?? r.remainingQty}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [r.id]: Number(e.target.value) }))}
                  />
                </Td>
                <Td className="text-ink-soft">{r.status === "partially_allocated" ? "Parcialmente asignada" : "Abierta"}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
