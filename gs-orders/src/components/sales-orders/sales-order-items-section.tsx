"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import type { SalesOrderCurrency } from "@/types/domain";
import { emptySalesOrderItem, type SalesOrderCatalogProductOption, type SalesOrderItemDraft } from "./types";

/**
 * Sección de líneas del Sales Order Builder — deliberadamente más simple
 * que QuoteItemsSection (sin imagen/miniatura, sin filtrado por Business
 * Unit: Sales Orders no tiene ese concepto). Un <select> plano por línea:
 * "Línea libre" (catalogProductId = null, captura manual de
 * skuSnapshot/descriptionSnapshot/uomSnapshot) o un producto del catálogo
 * (autocompleta esos 3 campos + precio por defecto en la moneda elegida —
 * sigue editable después, mismo criterio que QuoteItemsSection).
 */
export function SalesOrderItemsSection({
  currency,
  items,
  catalogProducts,
  lineSubtotals,
  lineTotals,
  onChange,
}: {
  currency: SalesOrderCurrency;
  items: SalesOrderItemDraft[];
  catalogProducts: SalesOrderCatalogProductOption[];
  /** Preview de line_subtotal/line_total por línea, en el mismo orden — calculado por el padre vía computeSalesOrderTotals. */
  lineSubtotals: number[];
  lineTotals: number[];
  onChange: (items: SalesOrderItemDraft[]) => void;
}) {
  function updateItem(key: string, patch: Partial<SalesOrderItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, emptySalesOrderItem()]);
  }

  function removeItem(key: string) {
    onChange(items.filter((item) => item.key !== key));
  }

  function handleSelectProduct(key: string, productId: string) {
    if (!productId) {
      updateItem(key, { catalogProductId: null });
      return;
    }
    const product = catalogProducts.find((p) => p.id === productId);
    if (!product) return;
    const defaultPrice = currency === "MXN" ? product.defaultPriceMxn : product.defaultPriceUsd;
    updateItem(key, {
      catalogProductId: product.id,
      skuSnapshot: product.sku,
      descriptionSnapshot: product.name,
      uomSnapshot: product.unit ?? "",
      unitPrice: defaultPrice != null ? String(defaultPrice) : "",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos / líneas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {items.map((item, index) => (
          <div key={item.key} className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Línea {index + 1}</span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor={`product-${item.key}`}>Producto del catálogo (opcional)</Label>
                <Select
                  id={`product-${item.key}`}
                  value={item.catalogProductId ?? ""}
                  onChange={(e) => handleSelectProduct(item.key, e.target.value)}
                >
                  <option value="">Línea libre (sin producto de catálogo)</option>
                  {catalogProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`sku-${item.key}`}>SKU / referencia</Label>
                  <Input
                    id={`sku-${item.key}`}
                    value={item.skuSnapshot}
                    onChange={(e) => updateItem(item.key, { skuSnapshot: e.target.value })}
                    placeholder="Requerido en una línea libre"
                  />
                </div>
                <div>
                  <Label htmlFor={`quantity-${item.key}`}>Cantidad</Label>
                  <Input
                    id={`quantity-${item.key}`}
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: Number(e.target.value) || 1 })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor={`description-${item.key}`}>Descripción (opcional)</Label>
                  <Input
                    id={`description-${item.key}`}
                    value={item.descriptionSnapshot}
                    onChange={(e) => updateItem(item.key, { descriptionSnapshot: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor={`unit-price-${item.key}`}>Precio unitario ({currency})</Label>
                  <Input
                    id={`unit-price-${item.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.key, { unitPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor={`uom-${item.key}`}>Unidad (opcional)</Label>
                  <Input
                    id={`uom-${item.key}`}
                    value={item.uomSnapshot}
                    onChange={(e) => updateItem(item.key, { uomSnapshot: e.target.value })}
                    placeholder="Ej. pza, caja, servicio"
                  />
                </div>

                <div>
                  <Label htmlFor={`discount-${item.key}`}>Descuento %</Label>
                  <Input
                    id={`discount-${item.key}`}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={item.discount}
                    onChange={(e) => updateItem(item.key, { discount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`tax-${item.key}`}>Impuesto %</Label>
                  <Input
                    id={`tax-${item.key}`}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={item.tax}
                    onChange={(e) => updateItem(item.key, { tax: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-between text-xs text-ink-faint">
                <span>
                  Subtotal de línea:{" "}
                  <span className="font-medium text-ink">{formatMoneyByCurrency(lineSubtotals[index] ?? 0, currency)}</span>
                </span>
                <span>
                  Total de línea:{" "}
                  <span className="font-medium text-ink">{formatMoneyByCurrency(lineTotals[index] ?? 0, currency)}</span>
                </span>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addItem}>
          <Plus className="h-4 w-4" />
          Agregar línea
        </Button>
      </CardContent>
    </Card>
  );
}
