"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InvoiceStatus } from "@/types/domain";
import { registerInvoicePayment, cancelInvoice } from "../actions";

type ActionKind = "pay" | "cancel";

/**
 * Registrar pago / cancelar factura — pending/partially_paid/overdue
 * ofrecen ambas acciones; 'paid'/'cancelled' son terminales (ver
 * trg_invoice_status_transition, 0072). El límite real "no sobrepago" y
 * "no cancelar una factura pagada" lo impone el RPC — aquí solo se evita
 * ofrecer un botón que el backend rechazaría.
 */
export function InvoiceStatusActions({
  invoiceId,
  invoiceNumber,
  status,
  balance,
  canManage,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  balance: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentNotes, setPaymentNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  if (!canManage || status === "paid" || status === "cancelled") {
    return null;
  }

  function closeDialog() {
    setPending(null);
    setAmount("");
    setPaymentNotes("");
    setCancelReason("");
  }

  function handleConfirm() {
    if (pending === "pay") {
      const parsedAmount = Number(amount);
      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error("El monto del pago debe ser mayor a cero");
        return;
      }
      startTransition(async () => {
        const result = await registerInvoicePayment(invoiceId, {
          amount: parsedAmount,
          payment_date: paymentDate || undefined,
          notes: paymentNotes.trim() || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        closeDialog();
        toast.success("Pago registrado");
        router.refresh();
      });
      return;
    }

    if (!cancelReason.trim()) {
      toast.error("Indica el motivo de la cancelación");
      return;
    }
    startTransition(async () => {
      const result = await cancelInvoice(invoiceId, { reason: cancelReason.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      closeDialog();
      toast.success("Factura cancelada");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm" disabled={isPending} onClick={() => setPending("pay")}>
          Registrar pago
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={isPending} onClick={() => setPending("cancel")}>
          Cancelar factura
        </Button>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !isPending && closeDialog()}>
        <DialogContent>
          {pending === "pay" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago — {invoiceNumber}</DialogTitle>
                <DialogDescription>Saldo pendiente: {balance.toFixed(2)}. No se permite un pago que exceda el saldo.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="payment-amount">Monto</Label>
                  <Input id="payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="payment-date">Fecha de pago</Label>
                  <Input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="payment-notes">Notas (opcional)</Label>
                  <Textarea id="payment-notes" rows={2} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referencia, método, etc." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Volver
                </Button>
                <Button type="button" variant="primary" loading={isPending} disabled={isPending} onClick={handleConfirm}>
                  Confirmar pago
                </Button>
              </DialogFooter>
            </>
          )}
          {pending === "cancel" && (
            <>
              <DialogHeader>
                <DialogTitle>¿Cancelar la factura {invoiceNumber}?</DialogTitle>
                <DialogDescription>Es un estado terminal. El motivo es obligatorio y queda auditado.</DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="cancel-reason">Motivo</Label>
                <Textarea id="cancel-reason" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="¿Por qué se cancela esta factura?" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isPending} onClick={closeDialog}>
                  Volver
                </Button>
                <Button type="button" variant="danger" loading={isPending} disabled={isPending} onClick={handleConfirm}>
                  Confirmar cancelación
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
