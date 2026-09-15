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
import { SalesOrderItemsSection } from "./sales-order-items-section";
import { computeSalesOrderTotals } from "@/lib/sales-order-totals";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import { SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS } from "@/types/domain";
import type { Customer, SalesOrderCurrency, SalesOrderPaymentTermsType } from "@/types/domain";
import type { SalesOrderActionResult, SalesOrderWritePayload } from "@/app/(app)/ordenes-venta/actions";
import type { SalesOrderCatalogProductOption, SalesOrderFormState } from "./types";

function buildPayload(state: SalesOrderFormState): SalesOrderWritePayload {
  return {
    customer_id: state.customerId,
    salesperson_id: state.salespersonId,
    currency: state.currency,
    exchange_rate: state.exchangeRate ? Number(state.exchangeRate) || undefined : undefined,
    payment_terms: state.paymentTerms || undefined,
    payment_terms_type: state.paymentTermsType,
    // Solo relevante para 'advance'/'custom' — el servidor ignora este
    // valor y lo fuerza para 'cash'/'credit' (ver rpc_create_sales_order/
    // rpc_update_sales_order, 0068), pero mandarlo siempre igual es
    // inocuo y evita una rama especial aquí.
    payment_required_amount: state.paymentRequiredAmount ? Number(state.paymentRequiredAmount) || undefined : undefined,
    requested_delivery_date: state.requestedDeliveryDate || undefined,
    commercial_notes: state.commercialNotes || undefined,
    internal_notes: state.internalNotes || undefined,
    is_test: state.isTest,
    items: state.items
      .filter((item) => item.catalogProductId || item.skuSnapshot.trim())
      .map((item) => ({
        catalog_product_id: item.catalogProductId,
        sku_snapshot: item.skuSnapshot || undefined,
        description_snapshot: item.descriptionSnapshot || undefined,
        uom_snapshot: item.uomSnapshot || undefined,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice) || 0,
        discount: Number(item.discount) || 0,
        tax: Number(item.tax) || 0,
      })),
  };
}

/**
 * Flujo continuo de una sola pantalla (Cards apiladas) — mismo criterio de
 * QuoteForm. NUNCA muestra un preview del order_number (mismo AJUSTE que
 * Quotes: se asigna al guardar, por riesgo de concurrencia) hasta que ya
 * es real (modo "edit").
 */
export function SalesOrderForm({
  mode,
  salesOrderId,
  orderNumber,
  isAdmin,
  salespeople,
  salespersonName,
  customers,
  catalogProducts,
  initialState,
  onSubmit,
}: {
  mode: "create" | "edit";
  salesOrderId: string;
  /** Presente solo en modo "edit" — el order_number ya es real, nunca un preview. */
  orderNumber?: string;
  isAdmin: boolean;
  /** Modo "create" + admin: lista completa de vendedores de la organización para elegir. */
  salespeople: { id: string; name: string }[];
  /** Modo "edit", o modo "create" sin ser admin: nombre ya fijo del vendedor dueño de la SO. */
  salespersonName?: string;
  customers: Customer[];
  catalogProducts: SalesOrderCatalogProductOption[];
  initialState: SalesOrderFormState;
  onSubmit: (salesOrderId: string, payload: SalesOrderWritePayload) => Promise<SalesOrderActionResult>;
}) {
  const router = useRouter();
  const [state, setState] = useState<SalesOrderFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function patch(p: Partial<SalesOrderFormState>) {
    setState((prev) => ({ ...prev, ...p }));
  }

  const totals = useMemo(
    () =>
      computeSalesOrderTotals(
        state.items.map((item) => ({
          quantity: item.quantity,
          unit_price: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          tax: Number(item.tax) || 0,
        }))
      ),
    [state.items]
  );

  const canPickSalesperson = mode === "create" && isAdmin && salespeople.length > 1;

  function handleSubmit() {
    if (!state.salespersonId) {
      toast.error("Selecciona un vendedor");
      return;
    }
    if (!state.customerId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (state.items.every((item) => !item.catalogProductId && !item.skuSnapshot.trim())) {
      toast.error("Agrega al menos una línea con SKU o producto del catálogo");
      return;
    }

    const payload = buildPayload(state);
    startTransition(async () => {
      const result = await onSubmit(salesOrderId, payload);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-6">
      {orderNumber ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">Número de Sales Order</span>
          <span className="font-mono text-base font-semibold text-ink">{orderNumber}</span>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/50 px-4 py-3 text-sm text-ink-faint">
          El número de Sales Order se asignará al guardar.
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
              {canPickSalesperson ? (
                <Select value={state.salespersonId} onChange={(e) => patch({ salespersonId: e.target.value })}>
                  <option value="" disabled>
                    Selecciona un vendedor…
                  </option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="mt-1.5 text-sm text-ink">{salespersonName ?? salespeople[0]?.name ?? "—"}</p>
              )}
            </div>

            <div>
              <Label htmlFor="customer">Cliente</Label>
              <Select id="customer" value={state.customerId} onChange={(e) => patch({ customerId: e.target.value })}>
                <option value="">Selecciona un cliente…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="currency">Moneda</Label>
              <Select
                id="currency"
                value={state.currency}
                onChange={(e) => patch({ currency: e.target.value as SalesOrderCurrency })}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="exchange-rate">Tipo de cambio (opcional)</Label>
              <Input
                id="exchange-rate"
                type="number"
                min={0}
                step="0.000001"
                value={state.exchangeRate}
                onChange={(e) => patch({ exchangeRate: e.target.value })}
                placeholder="Ej. 17.50"
              />
            </div>
            <div>
              <Label htmlFor="requested-delivery-date">Fecha requerida (opcional)</Label>
              <Input
                id="requested-delivery-date"
                type="date"
                value={state.requestedDeliveryDate}
                onChange={(e) => patch({ requestedDeliveryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="payment-terms-type">Tipo de condición de pago</Label>
              <Select
                id="payment-terms-type"
                value={state.paymentTermsType}
                onChange={(e) => patch({ paymentTermsType: e.target.value as SalesOrderPaymentTermsType })}
              >
                {(Object.keys(SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS) as SalesOrderPaymentTermsType[]).map((type) => (
                  <option key={type} value={type}>
                    {SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-ink-faint">
                Determina si esta Sales Order necesita pago previo (contado/anticipo) o aprobación de crédito antes de
                poder liberarse.
              </p>
            </div>
            <div>
              <Label htmlFor="payment-required-amount">Monto requerido antes de liberar</Label>
              {state.paymentTermsType === "cash" ? (
                <>
                  <Input id="payment-required-amount" value={formatMoneyByCurrency(totals.total, state.currency)} disabled />
                  <p className="mt-1 text-xs text-ink-faint">Contado siempre exige el total — el servidor lo calcula automáticamente.</p>
                </>
              ) : state.paymentTermsType === "credit" ? (
                <>
                  <Input id="payment-required-amount" value="No aplica (requiere aprobación de crédito)" disabled />
                  <p className="mt-1 text-xs text-ink-faint">Crédito se libera al aprobar el crédito, no por monto pagado.</p>
                </>
              ) : (
                <>
                  <Input
                    id="payment-required-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.paymentRequiredAmount}
                    onChange={(e) => patch({ paymentRequiredAmount: e.target.value })}
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-xs text-ink-faint">
                    Sin este monto, esta Sales Order nunca podrá liberarse automáticamente por pago.
                  </p>
                </>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="payment-terms">Leyenda de condición de pago (opcional)</Label>
            <Input
              id="payment-terms"
              value={state.paymentTerms}
              onChange={(e) => patch({ paymentTerms: e.target.value })}
              placeholder="Ej. 50% anticipo, 50% contra entrega"
            />
          </div>

          <div>
            <Label htmlFor="commercial-notes">Notas comerciales (opcional)</Label>
            <Textarea
              id="commercial-notes"
              rows={2}
              value={state.commercialNotes}
              onChange={(e) => patch({ commercialNotes: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="internal-notes">Notas internas (opcional)</Label>
            <Textarea
              id="internal-notes"
              rows={2}
              value={state.internalNotes}
              onChange={(e) => patch({ internalNotes: e.target.value })}
            />
            <p className="mt-1 text-xs text-ink-faint">
              Visible solo para tu equipo — sigue editable aunque la Sales Order ya no esté en borrador.
            </p>
          </div>

          {mode === "create" ? (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-3">
              <input
                id="is-test"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                checked={state.isTest}
                onChange={(e) => patch({ isTest: e.target.checked })}
              />
              <div>
                <Label htmlFor="is-test">Operación de prueba</Label>
                <p className="mt-1 text-xs text-ink-faint">
                  Marca esta Sales Order y toda su cadena derivada (requisición, Purchase Order, recepción, surtido,
                  factura, comisión) como prueba — quedan ocultas de los listados por defecto y pueden eliminarse por
                  completo más adelante. No se puede cambiar después de crear la Sales Order.
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <SalesOrderItemsSection
        currency={state.currency}
        items={state.items}
        catalogProducts={catalogProducts}
        lineSubtotals={totals.lineSubtotals}
        lineTotals={totals.lineTotals}
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
            <span className="text-ink-faint">Impuestos</span>
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
          {mode === "create" ? "Crear Sales Order" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
