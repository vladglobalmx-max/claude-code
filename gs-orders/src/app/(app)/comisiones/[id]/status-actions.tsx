"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CommissionRecordStatus } from "@/types/domain";
import { registerCommissionPayment, cancelCommissionRecord } from "../actions";

type ActionKind = "pay" | "cancel";

/**
 * Registrar pago / cancelar comisión — pending/eligible/partially_paid
 * ofrecen ambas acciones; 'paid'/'cancelled' son terminales. El límite
 * real ("no pagar más de lo liberado por cobro real") lo impone el RPC —
 * aquí solo se evita ofrecer un botón que el backend rechazaría.
 */
export function CommissionStatusActions({
  commissionRecordId,
  status,
  remainingEligible,
  canManage,
}: {
  commissionRecordId: string;
  status: CommissionRecordStatus;
  remainingEligible: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [amount, setAmount] = useState("");
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
        const result = await registerCommissionPayment(commissionRecordId, {
          amount: parsedAmount,
          notes: paymentNotes.trim() || undefined,
        });
        if (result.error) {
          toast.error(result.error);
          return;
        }
        closeDialog();
        toast.success("Pago de comisión registrado");
        router.refresh();
      });
      return;
    }

    if (!cancelReason.trim()) {
      toast.error("Indica el motivo de la cancelación");
      return;
    }
    startTransition(async () => {
      const result = await cancelCommissionRecord(commissionRecordId, { reason: cancelReason.trim() });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      closeDialog();
      toast.success("Comisión cancelada");
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
          Cancelar comisión
        </Button>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !isPending && closeDialog()}>
        <DialogContent>
          {pending === "pay" && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago de comisión</DialogTitle>
                <DialogDescription>Saldo elegible pendiente (liberado por cobro real): {remainingEligible.toFixed(2)}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="commission-payment-amount">Monto</Label>
                  <Input id="commission-payment-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="commission-payment-notes">Notas (opcional)</Label>
                  <Textarea id="commission-payment-notes" rows={2} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Referencia, método, etc." />
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
                <DialogTitle>¿Cancelar esta comisión?</DialogTitle>
                <DialogDescription>Es un estado terminal. El motivo es obligatorio y queda auditado.</DialogDescription>
              </DialogHeader>
              <div>
                <Label htmlFor="commission-cancel-reason">Motivo</Label>
                <Textarea id="commission-cancel-reason" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="¿Por qué se cancela esta comisión?" />
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
