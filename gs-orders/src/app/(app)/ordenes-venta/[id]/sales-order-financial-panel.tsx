"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import {
  SALES_ORDER_FINANCIAL_STATUS_BADGE,
  SALES_ORDER_FINANCIAL_STATUS_LABELS,
  SALES_ORDER_FULFILLMENT_RELEASE_STATUS_BADGE,
  SALES_ORDER_FULFILLMENT_RELEASE_STATUS_LABELS,
  SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS,
} from "@/types/domain";
import type { SalesOrder } from "@/types/domain";
import { approveSalesOrderCredit, registerSalesOrderPayment, releaseSalesOrder, setSalesOrderFinancialHold } from "../actions";

type DialogKind = "payment" | "credit" | "hold" | "release" | null;

/**
 * Bloque "Estado financiero" (THÖREN Financial Release, 0068). Las
 * acciones (Registrar pago/Aprobar crédito/Bloquear/Liberar) solo se
 * muestran si (a) canManageFinance — espejo de canManageSalesOrderFinance,
 * mismo guard que las RPCs — y (b) la Sales Order está en un status donde
 * las RPCs financieras aceptan operar (confirmed/in_progress/fulfilled;
 * NUNCA draft/cancelled/closed). La UI nunca decide si una acción
 * TERMINARÁ en éxito (p. ej. "Liberar" con pago insuficiente) — eso lo
 * decide exclusivamente la RPC/DB; aquí solo se ofrecen los controles
 * razonables y se traduce el error si el servidor rechaza.
 */
export function SalesOrderFinancialPanel({
  salesOrder,
  canManageFinance,
}: {
  salesOrder: SalesOrder;
  canManageFinance: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");

  const balance = salesOrder.payment_required_amount != null ? Math.max(0, salesOrder.payment_required_amount - salesOrder.amount_paid) : null;

  const financialActionsAvailable = ["confirmed", "in_progress", "fulfilled"].includes(salesOrder.status);
  const canRegisterPayment = canManageFinance && financialActionsAvailable && salesOrder.payment_terms_type !== "credit";
  const canApproveCredit = canManageFinance && financialActionsAvailable && salesOrder.payment_terms_type === "credit" && salesOrder.financial_status !== "credit_approved";
  const canHold = canManageFinance && financialActionsAvailable && salesOrder.fulfillment_release_status !== "blocked";
  const canRelease = canManageFinance && financialActionsAvailable && salesOrder.fulfillment_release_status === "blocked";

  function closeDialog() {
    if (isPending) return;
    setDialog(null);
    setAmount("");
    setNote("");
    setReason("");
  }

  function handleRegisterPayment() {
    const parsedAmount = Number(amount);
    if (!amount || !(parsedAmount > 0)) {
      toast.error("El monto del pago debe ser mayor a cero");
      return;
    }
    startTransition(async () => {
      const result = await registerSalesOrderPayment(salesOrder.id, { amount: parsedAmount, note: note || undefined });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Pago registrado");
      closeDialog();
      router.refresh();
    });
  }

  function handleApproveCredit() {
    startTransition(async () => {
      const result = await approveSalesOrderCredit(salesOrder.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Crédito aprobado");
      closeDialog();
      router.refresh();
    });
  }

  function handleHold() {
    if (!reason.trim()) {
      toast.error("Indica un motivo para bloquear financieramente esta Sales Order");
      return;
    }
    startTransition(async () => {
      const result = await setSalesOrderFinancialHold(salesOrder.id, { reason });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sales Order bloqueada financieramente");
      closeDialog();
      router.refresh();
    });
  }

  function handleRelease() {
    startTransition(async () => {
      const result = await releaseSalesOrder(salesOrder.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sales Order liberada");
      closeDialog();
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado financiero</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Condición de pago</p>
            <p className="text-ink">{SALES_ORDER_PAYMENT_TERMS_TYPE_LABELS[salesOrder.payment_terms_type]}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Total</p>
            <p className="text-ink">{formatMoneyByCurrency(salesOrder.total, salesOrder.currency)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Monto pagado</p>
            <p className="text-ink">{formatMoneyByCurrency(salesOrder.amount_paid, salesOrder.currency)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Saldo pendiente</p>
            <p className="text-ink">{balance != null ? formatMoneyByCurrency(balance, salesOrder.currency) : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Estado financiero</p>
            <StatusBadge
              status={salesOrder.financial_status}
              labels={SALES_ORDER_FINANCIAL_STATUS_LABELS}
              variants={SALES_ORDER_FINANCIAL_STATUS_BADGE}
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Liberación de surtido</p>
            <StatusBadge
              status={salesOrder.fulfillment_release_status}
              labels={SALES_ORDER_FULFILLMENT_RELEASE_STATUS_LABELS}
              variants={SALES_ORDER_FULFILLMENT_RELEASE_STATUS_BADGE}
            />
          </div>
        </div>

        {salesOrder.fulfillment_release_status === "blocked" && salesOrder.financial_hold_reason && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium">Motivo del bloqueo</p>
              <p className="text-ink-soft">{salesOrder.financial_hold_reason}</p>
            </div>
          </div>
        )}

        {salesOrder.financial_released_at && (
          <p className="text-xs text-ink-faint">Liberada por primera vez el {formatDateShort(salesOrder.financial_released_at)}.</p>
        )}

        {!financialActionsAvailable && salesOrder.status === "draft" && (
          <p className="text-xs text-ink-faint">
            Una Sales Order en borrador nunca puede liberarse para surtido — confírmala primero.
          </p>
        )}

        {(canRegisterPayment || canApproveCredit || canHold || canRelease) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {canRegisterPayment && (
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("payment")}>
                Registrar pago
              </Button>
            )}
            {canApproveCredit && (
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("credit")}>
                Aprobar crédito
              </Button>
            )}
            {canRelease && (
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("release")}>
                Liberar
              </Button>
            )}
            {canHold && (
              <Button type="button" variant="outline" size="sm" onClick={() => setDialog("hold")}>
                Bloquear
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          {dialog === "payment" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago</DialogTitle>
                <DialogDescription>
                  Se sumará al monto ya pagado ({formatMoneyByCurrency(salesOrder.amount_paid, salesOrder.currency)}). Si el
                  total pagado alcanza el monto requerido, esta Sales Order se liberará automáticamente.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-amount">Monto recibido</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="payment-note">Nota (opcional)</Label>
                  <Textarea id="payment-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="button" loading={isPending} disabled={isPending} onClick={handleRegisterPayment}>
                  Registrar pago
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === "credit" && (
            <>
              <DialogHeader>
                <DialogTitle>¿Aprobar crédito de {salesOrder.order_number}?</DialogTitle>
                <DialogDescription>
                  La Sales Order quedará liberada para surtido inmediatamente después de aprobar el crédito.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="button" loading={isPending} disabled={isPending} onClick={handleApproveCredit}>
                  Aprobar crédito
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === "hold" && (
            <>
              <DialogHeader>
                <DialogTitle>Bloquear financieramente {salesOrder.order_number}</DialogTitle>
                <DialogDescription>
                  Impide que esta Sales Order esté liberada para surtido hasta que se libere explícitamente de nuevo. El
                  motivo es obligatorio.
                </DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="hold-reason">Motivo</Label>
                <Textarea id="hold-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={handleHold}>
                  Bloquear
                </Button>
              </DialogFooter>
            </>
          )}

          {dialog === "release" && (
            <>
              <DialogHeader>
                <DialogTitle>¿Liberar {salesOrder.order_number}?</DialogTitle>
                <DialogDescription>
                  Solo tiene efecto si la condición financiera ya se cumple (crédito aprobado, o pago suficiente) — si
                  todavía falta, el servidor rechazará la operación.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Cancelar
                </Button>
                <Button type="button" loading={isPending} disabled={isPending} onClick={handleRelease}>
                  Liberar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
