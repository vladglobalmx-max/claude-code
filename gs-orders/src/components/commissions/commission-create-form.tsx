"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CommissionActionResult, CommissionWritePayload } from "@/app/(app)/comisiones/actions";

/**
 * Formulario mínimo de creación de comisión. Split de comisión: el
 * selector de vendedor NO está restringido al dueño comercial de la
 * Sales Order (viene precargado como default, pero Dirección puede
 * elegir cualquier otro vendedor activo de la organización) — así es
 * como 0073 soporta split sin motor de reparto.
 */
export function CommissionCreateForm({
  salesOrderId,
  defaultSalespersonId,
  defaultCommissionBase,
  salespeople,
  salespersonIdsWithActiveCommission,
  onSubmit,
}: {
  salesOrderId: string;
  defaultSalespersonId: string;
  defaultCommissionBase: number;
  salespeople: { id: string; name: string }[];
  salespersonIdsWithActiveCommission: string[];
  onSubmit: (payload: CommissionWritePayload) => Promise<CommissionActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [salespersonId, setSalespersonId] = useState(defaultSalespersonId);
  const [rate, setRate] = useState("");
  const [base, setBase] = useState(String(defaultCommissionBase));
  const [notes, setNotes] = useState("");

  const activeSet = new Set(salespersonIdsWithActiveCommission);

  function handleSubmit() {
    const parsedRate = Number(rate);
    if (!rate || Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      toast.error("El porcentaje debe estar entre 0 y 100");
      return;
    }
    if (!salespersonId) {
      toast.error("Selecciona el vendedor");
      return;
    }

    startTransition(async () => {
      const result = await onSubmit({
        sales_order_id: salesOrderId,
        salesperson_id: salespersonId,
        commission_rate: parsedRate,
        commission_base: base ? Number(base) : undefined,
        notes: notes.trim() || undefined,
      });
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="commission-salesperson">Vendedor</Label>
          <Select id="commission-salesperson" value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
            {salespeople.map((sp) => (
              <option key={sp.id} value={sp.id} disabled={activeSet.has(sp.id)}>
                {sp.name}
                {activeSet.has(sp.id) ? " (ya tiene comisión activa)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="commission-rate">Porcentaje de comisión</Label>
          <Input id="commission-rate" type="number" min="0" max="100" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej. 10" />
        </div>
        <div>
          <Label htmlFor="commission-base">Base de comisión</Label>
          <Input id="commission-base" type="number" min="0" step="0.01" value={base} onChange={(e) => setBase(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="commission-notes">Notas (opcional)</Label>
          <Textarea id="commission-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto de la regla aplicada, referido, etc." />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" variant="primary" loading={isPending} disabled={isPending} onClick={handleSubmit}>
            Crear comisión
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
