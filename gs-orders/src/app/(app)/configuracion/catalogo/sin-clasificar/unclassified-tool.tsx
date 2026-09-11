"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BusinessUnitProductGroup } from "@/lib/products/unclassified";
import { bulkAssignProductType } from "../actions";

export function UnclassifiedProductsTool({
  groups,
  productTypes,
}: {
  groups: BusinessUnitProductGroup[];
  productTypes: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [productTypeId, setProductTypeId] = useState("");
  const [isPending, startTransition] = useTransition();

  const allUnclassifiedIds = useMemo(
    () => groups.flatMap((g) => g.unclassifiedProducts.map((p) => p.id)),
    [groups]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(groupIds: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of groupIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function handleAssign() {
    if (selected.size === 0) {
      toast.error("Selecciona al menos un producto.");
      return;
    }
    if (!productTypeId) {
      toast.error("Selecciona un Tipo de Producto.");
      return;
    }
    startTransition(async () => {
      const result = await bulkAssignProductType(Array.from(selected), productTypeId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.updatedCount} producto${result.updatedCount === 1 ? "" : "s"} clasificado${result.updatedCount === 1 ? "" : "s"}.`
      );
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Asignar Tipo de Producto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-soft">
            {selected.size} producto{selected.size === 1 ? "" : "s"} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <Select className="w-auto" value={productTypeId} onChange={(e) => setProductTypeId(e.target.value)}>
            <option value="">Selecciona un Tipo de Producto…</option>
            {productTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button type="button" loading={isPending} disabled={isPending || selected.size === 0} onClick={handleAssign}>
            Asignar
          </Button>
          {selected.size > 0 && (
            <button
              type="button"
              className="text-sm text-ink-faint hover:text-ink"
              onClick={() => setSelected(new Set())}
            >
              Quitar selección
            </button>
          )}
          {allUnclassifiedIds.length > 0 && selected.size !== allUnclassifiedIds.length && (
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() => setSelected(new Set(allUnclassifiedIds))}
            >
              Seleccionar todos ({allUnclassifiedIds.length})
            </button>
          )}
        </CardContent>
      </Card>

      {groups.map((group) => {
        const groupIds = group.unclassifiedProducts.map((p) => p.id);
        const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));

        return (
          <Card key={group.businessUnitId ?? "todas"}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{group.businessUnitName}</CardTitle>
                <div className="flex items-center gap-3 text-sm text-ink-faint">
                  <span>Productos: {group.totalActiveProducts}</span>
                  <Badge variant={group.unclassifiedProducts.length > 0 ? "warning" : "success"}>
                    Sin clasificar: {group.unclassifiedProducts.length}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {group.unclassifiedProducts.length > 0 && (
              <CardContent className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  <input
                    type="checkbox"
                    checked={allGroupSelected}
                    onChange={(e) => toggleGroup(groupIds, e.target.checked)}
                    className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                  />
                  Seleccionar todos los de esta Business Unit
                </label>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {group.unclassifiedProducts.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                      />
                      <span className="font-mono text-ink-soft">{p.sku}</span>
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.model && <span className="text-ink-faint">({p.model})</span>}
                    </label>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
