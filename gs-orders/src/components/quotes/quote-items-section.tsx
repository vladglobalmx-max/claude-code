"use client";

import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuoteProductPicker } from "./quote-product-picker";
import { emptyQuoteItem, type QuoteCatalogProductOption, type QuoteItemDraft } from "./types";
import type { QuoteCurrency } from "@/types/domain";
import { formatMoneyByCurrency } from "@/lib/utils/format";

export function QuoteItemsSection({
  businessUnitId,
  currency,
  items,
  catalogProducts,
  lineSubtotals,
  onChange,
}: {
  businessUnitId: string;
  currency: QuoteCurrency;
  items: QuoteItemDraft[];
  catalogProducts: QuoteCatalogProductOption[];
  /** Preview de line_subtotal por línea, en el mismo orden — calculado por el padre vía computeQuoteTotals. */
  lineSubtotals: number[];
  onChange: (items: QuoteItemDraft[]) => void;
}) {
  function updateItem(key: string, patch: Partial<QuoteItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function addItem() {
    onChange([...items, emptyQuoteItem()]);
  }

  function removeItem(key: string) {
    onChange(items.filter((item) => item.key !== key));
  }

  function handleSelectProduct(key: string, product: QuoteCatalogProductOption) {
    const price = currency === "MXN" ? product.defaultPriceMxn : product.defaultPriceUsd;
    updateItem(key, {
      catalogProductId: product.id,
      model: product.sku,
      description: product.name,
      // Nunca 0 silencioso: si el producto no tiene precio en esta moneda,
      // el campo queda vacío para captura manual (ver caso de prueba 18).
      unitPrice: price != null ? String(price) : "",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!businessUnitId && (
          <p className="text-sm text-ink-faint">Selecciona una Business Unit para poder agregar productos.</p>
        )}

        {businessUnitId &&
          items.map((item, index) => (
            <div key={item.key} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Producto {index + 1}</span>
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
                <QuoteProductPicker
                  products={catalogProducts}
                  businessUnitId={businessUnitId}
                  onSelect={(product) => handleSelectProduct(item.key, product)}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`model-${item.key}`}>Modelo</Label>
                    <Input
                      id={`model-${item.key}`}
                      value={item.model}
                      onChange={(e) => updateItem(item.key, { model: e.target.value, catalogProductId: null })}
                      placeholder="Modelo o línea libre"
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
                    <Textarea
                      id={`description-${item.key}`}
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateItem(item.key, { description: e.target.value })}
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
                    <Label htmlFor={`line-discount-${item.key}`}>Descuento de línea %</Label>
                    <Input
                      id={`line-discount-${item.key}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={item.lineDiscountPercent}
                      onChange={(e) => updateItem(item.key, { lineDiscountPercent: e.target.value })}
                    />
                  </div>
                </div>

                <p className="text-right text-xs text-ink-faint">
                  Subtotal de línea:{" "}
                  <span className="font-medium text-ink">
                    {formatMoneyByCurrency(lineSubtotals[index] ?? 0, currency)}
                  </span>
                </p>
              </div>
            </div>
          ))}

        {businessUnitId && (
          <Button type="button" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Agregar producto
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
