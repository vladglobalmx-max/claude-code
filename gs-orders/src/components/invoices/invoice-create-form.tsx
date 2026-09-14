"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InvoiceActionResult, InvoiceWritePayload } from "@/app/(app)/facturas/actions";

/**
 * Formulario mínimo de creación de factura — a diferencia de Recepciones/
 * Surtidos, NO hay selección de líneas (rpc_create_invoice snapshotea
 * SIEMPRE todas las líneas de la Sales Order, MVP: una factura = la Sales
 * Order completa). Solo captura fecha de vencimiento (obligatoria) y notas
 * opcionales.
 */
export function InvoiceCreateForm({
  salesOrderId,
  onSubmit,
}: {
  salesOrderId: string;
  onSubmit: (payload: InvoiceWritePayload) => Promise<InvoiceActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  function handleSubmit() {
    if (!dueDate) {
      toast.error("Indica la fecha de vencimiento");
      return;
    }

    startTransition(async () => {
      const result = await onSubmit({
        sales_order_id: salesOrderId,
        due_date: dueDate,
        notes: notes.trim() || undefined,
      });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="invoice-due-date">Fecha de vencimiento</Label>
          <Input id="invoice-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="invoice-notes">Notas (opcional)</Label>
          <Textarea id="invoice-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condiciones, referencias, etc." />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="primary" loading={isPending} disabled={isPending} onClick={handleSubmit}>
            Crear factura
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
