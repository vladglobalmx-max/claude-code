"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuoteItemsSection } from "./quote-items-section";
import { CustomerInlineCreateDialog } from "./customer-inline-create-dialog";
import { computeQuoteTotals } from "@/lib/quote-totals";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import type { Customer, QuoteCurrency } from "@/types/domain";
import type { QuoteActionResult, QuoteWritePayload } from "@/app/(app)/cotizaciones/actions";
import type { QuoteCatalogProductOption, QuoteFormState } from "./types";

export interface EligibleQuotePair {
  salespersonId: string;
  salespersonName: string;
  businessUnitId: string;
  businessUnitName: string;
}

function buildPayload(state: QuoteFormState): QuoteWritePayload {
  return {
    business_unit_id: state.businessUnitId,
    salesperson_id: state.salespersonId,
    customer_id: state.customerId,
    currency: state.currency,
    tax_rate: Number(state.taxRate) || 0,
    global_discount_percent: Number(state.globalDiscountPercent) || 0,
    valid_until: state.validUntil,
    notes: state.notes || undefined,
    payment_terms: state.paymentTerms || undefined,
    delivery_time: state.deliveryTime || undefined,
    customer_notes: state.customerNotes || undefined,
    items: state.items
      .filter((item) => item.model.trim())
      .map((item) => ({
        catalog_product_id: item.catalogProductId,
        model: item.model,
        description: item.description || undefined,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice) || 0,
        line_discount_percent: Number(item.lineDiscountPercent) || 0,
      })),
  };
}

/**
 * Flujo continuo de una sola pantalla (Cards apiladas), no Tabs — a
 * diferencia de OrderForm: el dominio de una Quote es más simple (sin
 * imágenes/archivos/especificaciones técnicas por producto) y así lo pidió
 * el diseño aprobado. NUNCA muestra un preview del folio (AJUSTE 2 de la
 * aprobación de Q4): solo el aviso fijo "El folio se asignará al guardar."
 * hasta que el folio real exista (edición de una Quote ya guardada).
 */
export function QuoteForm({
  mode,
  quoteId,
  folio,
  eligiblePairs,
  businessUnitName,
  salespersonName,
  customers,
  catalogProducts,
  initialState,
  onSubmit,
}: {
  mode: "create" | "edit";
  quoteId: string;
  /** Presente solo en modo "edit" — el folio ya es real, nunca un preview. */
  folio?: string;
  /** Modo "create": pares Salesperson × Business Unit con configuración de folio activa (ver salesperson_quote_sequences). Siempre no vacío — la página bloquea antes de renderizar el form si está vacío. */
  eligiblePairs: EligibleQuotePair[];
  /** Modo "edit": nombres ya fijos (folio generado, inmutables — ver trg_prevent_quote_folio_change). */
  businessUnitName?: string;
  salespersonName?: string;
  customers: Customer[];
  catalogProducts: QuoteCatalogProductOption[];
  initialState: QuoteFormState;
  onSubmit: (quoteId: string, payload: QuoteWritePayload) => Promise<QuoteActionResult>;
}) {
  const router = useRouter();
  const [state, setState] = useState<QuoteFormState>(initialState);
  const [customerList, setCustomerList] = useState(customers);
  const [isPending, startTransition] = useTransition();

  function patch(p: Partial<QuoteFormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  const salespeople = useMemo(() => {
    const seen = new Map<string, string>();
    for (const pair of eligiblePairs) seen.set(pair.salespersonId, pair.salespersonName);
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [eligiblePairs]);

  const businessUnitsForSalesperson = useMemo(
    () => eligiblePairs.filter((p) => p.salespersonId === state.salespersonId),
    [eligiblePairs, state.salespersonId]
  );

  const totals = useMemo(
    () =>
      computeQuoteTotals({
        items: state.items.map((item) => ({
          quantity: item.quantity,
          unit_price: Number(item.unitPrice) || 0,
          line_discount_percent: Number(item.lineDiscountPercent) || 0,
        })),
        global_discount_percent: Number(state.globalDiscountPercent) || 0,
        tax_rate: Number(state.taxRate) || 0,
      }),
    [state.items, state.globalDiscountPercent, state.taxRate]
  );

  function handleSalespersonChange(salespersonId: string) {
    const firstPair = eligiblePairs.find((p) => p.salespersonId === salespersonId);
    patch({ salespersonId, businessUnitId: firstPair?.businessUnitId ?? "" });
  }

  function handleSubmit() {
    if (!state.businessUnitId) {
      toast.error("Selecciona una Business Unit");
      return;
    }
    if (!state.salespersonId) {
      toast.error("Selecciona un vendedor");
      return;
    }
    if (!state.customerId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!state.validUntil) {
      toast.error("Indica la vigencia de la cotización");
      return;
    }
    if (state.items.every((item) => !item.model.trim())) {
      toast.error("Agrega al menos un producto con modelo");
      return;
    }

    const payload = buildPayload(state);
    startTransition(async () => {
      const result = await onSubmit(quoteId, payload);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      {folio ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Folio</span>
          <span className="font-mono text-base font-semibold text-ink">{folio}</span>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/50 px-4 py-3 text-sm text-ink-faint">
          El folio se asignará al guardar.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Vendedor</Label>
              {mode === "edit" || salespeople.length <= 1 ? (
                <p className="mt-1.5 text-sm text-ink">
                  {mode === "edit" ? salespersonName : salespeople[0]?.name ?? "—"}
                </p>
              ) : (
                <Select value={state.salespersonId} onChange={(e) => handleSalespersonChange(e.target.value)}>
                  <option value="" disabled>
                    Selecciona un vendedor…
                  </option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div>
              <Label>Business Unit</Label>
              {mode === "edit" || businessUnitsForSalesperson.length <= 1 ? (
                <p className="mt-1.5 text-sm text-ink">
                  {mode === "edit" ? businessUnitName : businessUnitsForSalesperson[0]?.businessUnitName ?? "—"}
                </p>
              ) : (
                <Select value={state.businessUnitId} onChange={(e) => patch({ businessUnitId: e.target.value })}>
                  {businessUnitsForSalesperson.map((p) => (
                    <option key={p.businessUnitId} value={p.businessUnitId}>
                      {p.businessUnitName}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="customer">Cliente</Label>
              <CustomerInlineCreateDialog
                onCreated={(customer) => {
                  setCustomerList((prev) => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)));
                  patch({ customerId: customer.id });
                }}
              />
            </div>
            <Select id="customer" value={state.customerId} onChange={(e) => patch({ customerId: e.target.value })}>
              <option value="">Selecciona un cliente…</option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select
                id="currency"
                value={state.currency}
                onChange={(e) => patch({ currency: e.target.value as QuoteCurrency })}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="tax-rate">IVA %</Label>
              <Input
                id="tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={state.taxRate}
                onChange={(e) => patch({ taxRate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="global-discount">Descuento global %</Label>
              <Input
                id="global-discount"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={state.globalDiscountPercent}
                onChange={(e) => patch({ globalDiscountPercent: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="valid-until">Vigencia</Label>
            <Input
              id="valid-until"
              type="date"
              value={state.validUntil}
              onChange={(e) => patch({ validUntil: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas internas (opcional)</Label>
            <Textarea id="notes" rows={2} value={state.notes} onChange={(e) => patch({ notes: e.target.value })} />
            <p className="mt-1 text-xs text-ink-faint">Visible solo para tu equipo — no aparece en el PDF.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Condiciones comerciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payment-terms">Forma de pago (opcional)</Label>
              <Input
                id="payment-terms"
                value={state.paymentTerms}
                onChange={(e) => patch({ paymentTerms: e.target.value })}
                placeholder="Ej. 50% anticipo, 50% contra entrega"
              />
            </div>
            <div>
              <Label htmlFor="delivery-time">Tiempo de entrega (opcional)</Label>
              <Input
                id="delivery-time"
                value={state.deliveryTime}
                onChange={(e) => patch({ deliveryTime: e.target.value })}
                placeholder="Ej. 15 días hábiles"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="customer-notes">Observaciones para el cliente (opcional)</Label>
            <Textarea
              id="customer-notes"
              rows={3}
              value={state.customerNotes}
              onChange={(e) => patch({ customerNotes: e.target.value })}
            />
            <p className="mt-1 text-xs text-accent">Esta información SÍ aparecerá en el PDF de la cotización.</p>
          </div>
        </CardContent>
      </Card>

      <QuoteItemsSection
        businessUnitId={state.businessUnitId}
        currency={state.currency}
        items={state.items}
        catalogProducts={catalogProducts}
        lineSubtotals={totals.lineSubtotals}
        onChange={(items) => patch({ items })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-faint">Subtotal</span>
            <span className="text-ink">{formatMoneyByCurrency(totals.subtotal, state.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faint">Descuento</span>
            <span className="text-ink">{formatMoneyByCurrency(totals.discountTotal, state.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faint">IVA</span>
            <span className="text-ink">{formatMoneyByCurrency(totals.taxTotal, state.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span className="text-ink">Total</span>
            <span className="text-ink">{formatMoneyByCurrency(totals.total, state.currency)}</span>
          </div>
          <p className="pt-2 text-xs text-ink-faint">
            Este resumen es un preview — los totales definitivos los calcula el servidor al guardar.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" loading={isPending} disabled={isPending} onClick={handleSubmit}>
          {mode === "create" ? "Crear cotización" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
