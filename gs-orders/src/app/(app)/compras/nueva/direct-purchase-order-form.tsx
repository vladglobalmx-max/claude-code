"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import { filterEligibleCatalogProducts, searchCatalogProducts } from "@/lib/catalog/eligibility";
import { PURCHASE_ORDER_DIRECT_REASON_LABELS } from "@/types/domain";
import type { PurchaseOrderDirectReason } from "@/types/domain";
import type { PurchaseOrderActionResult } from "../actions";
import type { DirectPurchaseOrderPayload } from "@/lib/validations/purchase-order";

interface CatalogProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string | null;
  model: string | null;
  brand: string | null;
  businessUnitIds: string[];
}

/** Máximo de opciones renderizadas por línea — evita volcar miles de <option> al DOM; el catálogo completo ya está en memoria (fetchAllPages, page.tsx), esto solo acota lo que se pinta. */
const MAX_PRODUCT_OPTIONS = 50;

interface ItemDraft {
  key: string;
  catalogProductId: string | null;
  productQuery: string;
  description: string;
  unit: string;
  supplierSku: string;
  supplierModel: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
}

function emptyItem(): ItemDraft {
  return {
    key: crypto.randomUUID(),
    catalogProductId: null,
    productQuery: "",
    description: "",
    unit: "",
    supplierSku: "",
    supplierModel: "",
    quantity: "1",
    unitPrice: "",
    taxPercent: "0",
  };
}

function lineTotals(item: ItemDraft) {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.unitPrice) || 0;
  const tax = Number(item.taxPercent) || 0;
  const subtotal = qty * price;
  const taxAmount = Math.round(((subtotal * tax) / 100) * 100) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

/**
 * THÖREN — Orden de Compra Directa (0081). Flujo de una sola pantalla,
 * mismo criterio que SalesOrderForm/QuoteForm — sin Pedido/Sales
 * Order/Requisición/cliente que preexista: todos los campos se capturan
 * aquí. rpc_create_direct_purchase_order (0081) recalcula subtotal/
 * impuestos/total server-side — los totales de esta pantalla son
 * únicamente preview.
 */
export function DirectPurchaseOrderForm({
  businessUnits,
  suppliers,
  warehouses,
  catalogProducts,
  onSubmit,
}: {
  businessUnits: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  catalogProducts: CatalogProductOption[];
  onSubmit: (purchaseOrderId: string, payload: DirectPurchaseOrderPayload) => Promise<PurchaseOrderActionResult>;
}) {
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [directPurchaseReason, setDirectPurchaseReason] = useState<PurchaseOrderDirectReason | "">("");
  const [poDate, setPoDate] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [currency, setCurrency] = useState<"MXN" | "USD">("MXN");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [documentLanguage, setDocumentLanguage] = useState<"" | "es" | "en">("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [isPending, startTransition] = useTransition();

  function patchItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function handleSelectProduct(key: string, productId: string) {
    if (!productId) {
      patchItem(key, { catalogProductId: null });
      return;
    }
    const product = catalogProducts.find((p) => p.id === productId);
    if (!product) return;
    patchItem(key, { catalogProductId: product.id, description: product.name, unit: product.unit ?? "" });
  }

  // Fix bug "selector de producto incompleto" — filtra por la Business Unit
  // de la OC (misma semántica que Orders/Quotes, lib/catalog/eligibility.ts:
  // 0 relaciones en product_business_units = compartido con TODAS las BU),
  // y solo si ya hay una BU elegida — antes de eso se ofrece el catálogo
  // completo de la organización, nunca un subconjunto arbitrario.
  const eligibleProducts = useMemo(
    () => (businessUnitId ? filterEligibleCatalogProducts(catalogProducts, businessUnitId) : catalogProducts),
    [catalogProducts, businessUnitId]
  );

  function productOptionsFor(item: ItemDraft) {
    const selected = item.catalogProductId ? catalogProducts.find((p) => p.id === item.catalogProductId) : undefined;
    const matches = searchCatalogProducts(eligibleProducts, item.productQuery);
    const withSelected = selected && !matches.some((p) => p.id === selected.id) ? [selected, ...matches] : matches;
    return withSelected.slice(0, MAX_PRODUCT_OPTIONS);
  }

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const t = lineTotals(item);
        return { subtotal: acc.subtotal + t.subtotal, taxTotal: acc.taxTotal + t.taxAmount, total: acc.total + t.total };
      },
      { subtotal: 0, taxTotal: 0, total: 0 }
    );
  }, [items]);

  function handleSubmit() {
    if (!businessUnitId) {
      toast.error("Selecciona una Business Unit");
      return;
    }
    if (!supplierId) {
      toast.error("Selecciona un proveedor");
      return;
    }
    if (!directPurchaseReason) {
      toast.error("Selecciona un tipo/motivo de compra");
      return;
    }
    if (items.some((item) => !item.catalogProductId && !item.description.trim())) {
      toast.error("Cada línea debe tener un producto de catálogo o una descripción");
      return;
    }
    if (items.some((item) => !item.unitPrice || Number(item.unitPrice) < 0)) {
      toast.error("Indica un precio unitario válido en cada línea");
      return;
    }

    const payload: DirectPurchaseOrderPayload = {
      business_unit_id: businessUnitId,
      supplier_id: supplierId,
      direct_purchase_reason: directPurchaseReason,
      po_date: poDate || undefined,
      required_date: requiredDate || undefined,
      currency,
      payment_terms: paymentTerms || undefined,
      destination_warehouse_id: destinationWarehouseId || undefined,
      document_language: documentLanguage || undefined,
      notes: notes || undefined,
      items: items.map((item) => ({
        catalog_product_id: item.catalogProductId ?? undefined,
        description: item.description || undefined,
        unit: item.unit || undefined,
        supplier_sku: item.supplierSku || undefined,
        supplier_model: item.supplierModel || undefined,
        quantity_ordered: Number(item.quantity) || 0,
        unit_price: Number(item.unitPrice) || 0,
        tax_percent: Number(item.taxPercent) || 0,
      })),
    };

    const purchaseOrderId = crypto.randomUUID();
    startTransition(async () => {
      const result = await onSubmit(purchaseOrderId, payload);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la Orden de Compra</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="business-unit">Business Unit</Label>
            <Select id="business-unit" value={businessUnitId} onChange={(e) => setBusinessUnitId(e.target.value)}>
              <option value="">Selecciona...</option>
              {businessUnits.map((bu) => (
                <option key={bu.id} value={bu.id}>
                  {bu.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="supplier">Proveedor</Label>
            <Select id="supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Selecciona...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Tipo / motivo de compra</Label>
            <Select id="reason" value={directPurchaseReason} onChange={(e) => setDirectPurchaseReason(e.target.value as PurchaseOrderDirectReason)}>
              <option value="">Selecciona...</option>
              {Object.entries(PURCHASE_ORDER_DIRECT_REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="currency">Moneda</Label>
            <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value as "MXN" | "USD")}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="po-date">Fecha</Label>
            <Input id="po-date" type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="required-date">Fecha requerida</Label>
            <Input id="required-date" type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="payment-terms">Condiciones de pago</Label>
            <Input
              id="payment-terms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="Ej. 30 días, contado"
            />
          </div>
          <div>
            <Label htmlFor="warehouse">Almacén destino (opcional)</Label>
            <Select id="warehouse" value={destinationWarehouseId} onChange={(e) => setDestinationWarehouseId(e.target.value)}>
              <option value="">Sin especificar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="language">Idioma del documento</Label>
            <Select id="language" value={documentLanguage} onChange={(e) => setDocumentLanguage(e.target.value as "" | "es" | "en")}>
              <option value="">Default de la Business Unit</option>
              <option value="es">Español</option>
              <option value="en">English</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.map((item, index) => {
            const t = lineTotals(item);
            return (
              <div key={item.key} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Línea {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                      className="flex items-center gap-1 text-xs text-ink-faint hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`product-search-${item.key}`}>Buscar en catálogo (SKU, nombre o modelo)</Label>
                    <Input
                      id={`product-search-${item.key}`}
                      value={item.productQuery}
                      onChange={(e) => patchItem(item.key, { productQuery: e.target.value })}
                      placeholder="Ej. LED-100, reflector, ABC-123"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`product-${item.key}`}>Producto del catálogo (opcional)</Label>
                    <Select id={`product-${item.key}`} value={item.catalogProductId ?? ""} onChange={(e) => handleSelectProduct(item.key, e.target.value)}>
                      <option value="">Sin producto de catálogo — servicio/refacción/muestra/otro</option>
                      {productOptionsFor(item).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                          {p.model ? ` (${p.model})` : ""}
                        </option>
                      ))}
                    </Select>
                    {eligibleProducts.length === 0 && (
                      <p className="mt-1 text-xs text-ink-faint">
                        No hay productos activos del catálogo disponibles{businessUnitId ? " para esta Business Unit" : ""}.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`description-${item.key}`}>Descripción</Label>
                      <Input
                        id={`description-${item.key}`}
                        value={item.description}
                        onChange={(e) => patchItem(item.key, { description: e.target.value })}
                        placeholder="Requerido si no hay producto de catálogo"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`supplier-sku-${item.key}`}>SKU / referencia proveedor</Label>
                      <Input id={`supplier-sku-${item.key}`} value={item.supplierSku} onChange={(e) => patchItem(item.key, { supplierSku: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`supplier-model-${item.key}`}>Modelo proveedor</Label>
                      <Input id={`supplier-model-${item.key}`} value={item.supplierModel} onChange={(e) => patchItem(item.key, { supplierModel: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor={`unit-${item.key}`}>Unidad</Label>
                      <Input id={`unit-${item.key}`} value={item.unit} onChange={(e) => patchItem(item.key, { unit: e.target.value })} placeholder="Ej. pza, servicio" />
                    </div>
                    <div>
                      <Label htmlFor={`quantity-${item.key}`}>Cantidad</Label>
                      <Input
                        id={`quantity-${item.key}`}
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => patchItem(item.key, { quantity: e.target.value })}
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
                        onChange={(e) => patchItem(item.key, { unitPrice: e.target.value })}
                        placeholder="0.00"
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
                        value={item.taxPercent}
                        onChange={(e) => patchItem(item.key, { taxPercent: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-ink-faint">
                    <span>
                      Subtotal de línea: <span className="font-medium text-ink">{formatMoneyByCurrency(t.subtotal, currency)}</span>
                    </span>
                    <span>
                      Total de línea: <span className="font-medium text-ink">{formatMoneyByCurrency(t.total, currency)}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          <Button type="button" variant="outline" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            <Plus className="h-4 w-4" />
            Agregar línea
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6">
            <span>
              Subtotal: <span className="font-medium text-ink">{formatMoneyByCurrency(totals.subtotal, currency)}</span>
            </span>
            <span>
              Impuestos: <span className="font-medium text-ink">{formatMoneyByCurrency(totals.taxTotal, currency)}</span>
            </span>
            <span>
              Total: <span className="font-semibold text-ink">{formatMoneyByCurrency(totals.total, currency)}</span>
            </span>
          </div>
          <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
            Crear Orden de Compra
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
