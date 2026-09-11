"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateSupplierProductReferences } from "./actions";

export interface SupplierOption {
  id: string;
  name: string;
}

interface ReferenceRowState {
  key: string;
  supplierId: string;
  supplierSku: string;
  supplierModel: string;
  supplierDescription: string;
  supplierUom: string;
  active: boolean;
}

export interface InitialSupplierReference {
  supplierId: string;
  supplierSku: string;
  supplierModel: string;
  supplierDescription: string;
  supplierUom: string;
  preferred: boolean;
  active: boolean;
}

function emptyRow(): ReferenceRowState {
  return {
    key: crypto.randomUUID(),
    supplierId: "",
    supplierSku: "",
    supplierModel: "",
    supplierDescription: "",
    supplierUom: "",
    active: true,
  };
}

/**
 * THÖREN — Supplier Product References (0066). "Proveedores /
 * Referencias" — deliberadamente su PROPIA tarjeta con su PROPIO botón de
 * guardado, nunca mezclada con el formulario de SKU/Modelo interno de
 * arriba (CatalogForm) — ver DECISIÓN "no mezclar visualmente" del
 * ticket. `preferred` se modela como radio EXCLUSIVO entre filas (nunca
 * checkboxes independientes): la exclusividad queda correcta por
 * construcción en la UI, antes incluso de que el servidor la valide
 * (supplier_product_references_preferred_unique, 0066).
 */
export function SupplierReferencesSection({
  catalogProductId,
  suppliers,
  initialReferences,
}: {
  catalogProductId: string;
  suppliers: SupplierOption[];
  initialReferences: InitialSupplierReference[];
}) {
  const [rows, setRows] = useState<ReferenceRowState[]>(
    initialReferences.length > 0
      ? initialReferences.map((r) => ({
          key: crypto.randomUUID(),
          supplierId: r.supplierId,
          supplierSku: r.supplierSku,
          supplierModel: r.supplierModel,
          supplierDescription: r.supplierDescription,
          supplierUom: r.supplierUom,
          active: r.active,
        }))
      : []
  );
  // Preferido: a lo sumo UNA key — "" = ninguno preferido.
  const [preferredKey, setPreferredKey] = useState<string>(
    () => rows.find((_, i) => initialReferences[i]?.preferred)?.key ?? ""
  );
  const [isPending, startTransition] = useTransition();

  function updateRow(key: string, patch: Partial<ReferenceRowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    if (preferredKey === key) setPreferredKey("");
  }

  function handleSave() {
    const usedSuppliers = new Set<string>();
    for (const row of rows) {
      if (!row.supplierId) {
        toast.error("Selecciona un proveedor en cada fila.");
        return;
      }
      if (usedSuppliers.has(row.supplierId)) {
        toast.error("No puedes repetir el mismo proveedor dos veces para este producto.");
        return;
      }
      usedSuppliers.add(row.supplierId);
      if (!row.supplierSku.trim() && !row.supplierModel.trim()) {
        toast.error("Cada referencia necesita al menos el SKU o el modelo del proveedor.");
        return;
      }
    }

    const payload = rows.map((row) => ({
      supplierId: row.supplierId,
      supplierSku: row.supplierSku.trim() || undefined,
      supplierModel: row.supplierModel.trim() || undefined,
      supplierDescription: row.supplierDescription.trim() || undefined,
      supplierUom: row.supplierUom.trim() || undefined,
      preferred: row.key === preferredKey,
      active: row.active,
    }));

    startTransition(async () => {
      const result = await updateSupplierProductReferences(catalogProductId, payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Referencias de proveedor guardadas.");
    });
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Proveedores / Referencias</CardTitle>
        <p className="text-xs text-ink-faint">
          El código con el que CADA proveedor identifica este producto — distinto del SKU/Modelo interno de arriba.
          Las Purchase Orders a ese proveedor usan esta referencia, nunca el SKU/Modelo interno.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 && (
          <p className="text-sm text-ink-faint">Todavía no hay proveedores con referencia para este producto.</p>
        )}

        {rows.map((row, index) => (
          <div key={row.key} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Proveedor {index + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`supplier-${row.key}`}>Proveedor</Label>
                <Select
                  id={`supplier-${row.key}`}
                  value={row.supplierId}
                  onChange={(e) => updateRow(row.key, { supplierId: e.target.value })}
                >
                  <option value="">Selecciona un proveedor…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`sku-${row.key}`}>SKU proveedor</Label>
                <Input
                  id={`sku-${row.key}`}
                  value={row.supplierSku}
                  onChange={(e) => updateRow(row.key, { supplierSku: e.target.value })}
                  placeholder="Ej. P7075R"
                />
              </div>
              <div>
                <Label htmlFor={`model-${row.key}`}>Modelo proveedor</Label>
                <Input
                  id={`model-${row.key}`}
                  value={row.supplierModel}
                  onChange={(e) => updateRow(row.key, { supplierModel: e.target.value })}
                  placeholder="Ej. P7075R"
                />
              </div>
              <div>
                <Label htmlFor={`uom-${row.key}`}>UdM proveedor (opcional)</Label>
                <Input
                  id={`uom-${row.key}`}
                  value={row.supplierUom}
                  onChange={(e) => updateRow(row.key, { supplierUom: e.target.value })}
                  placeholder="Ej. box, pza"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor={`desc-${row.key}`}>Descripción proveedor (opcional)</Label>
                <Input
                  id={`desc-${row.key}`}
                  value={row.supplierDescription}
                  onChange={(e) => updateRow(row.key, { supplierDescription: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="radio"
                  name="preferred-supplier-reference"
                  checked={preferredKey === row.key}
                  disabled={!row.active}
                  onChange={() => setPreferredKey(row.key)}
                  className="h-4 w-4 border-border text-accent focus:ring-accent/30"
                />
                Preferido
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(e) => {
                    const active = e.target.checked;
                    // THÖREN — 0066: una referencia inactiva nunca puede
                    // quedar preferida (CHECK preferred_requires_active) —
                    // al desactivarla, se quita también su "preferido" aquí
                    // mismo, nunca un estado intermedio inválido.
                    updateRow(row.key, { active });
                    if (!active && preferredKey === row.key) setPreferredKey("");
                  }}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                />
                Activo
              </label>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4" />
            Agregar proveedor
          </Button>
          <Button type="button" loading={isPending} disabled={isPending} onClick={handleSave}>
            Guardar referencias
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
