"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateQuoteNotes } from "../actions";

/**
 * "Nota interna" — editable en cualquier status (ver updateQuoteNotes en
 * actions.ts): notes está explícitamente fuera del congelamiento comercial
 * de trg_quote_status_transition (0020). El copy deja claro que es una
 * anotación de equipo, nunca contenido comercial/legal de la cotización.
 */
export function QuoteNotesEditor({
  quoteId,
  initialNotes,
  canWrite,
}: {
  quoteId: string;
  initialNotes: string;
  canWrite: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialNotes);
  const [savedValue, setSavedValue] = useState(initialNotes);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateQuoteNotes(quoteId, value);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      setSavedValue(value);
      setIsEditing(false);
      toast.success("Nota interna guardada");
    });
  }

  function handleCancel() {
    setValue(savedValue);
    setIsEditing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Nota interna</p>
        {!isEditing && canWrite && (
          <button type="button" onClick={() => setIsEditing(true)} className="text-xs text-accent hover:underline">
            {savedValue ? "Editar" : "Agregar nota"}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Visible solo para tu equipo — no forma parte del contenido comercial de la cotización.
      </p>

      {isEditing && canWrite ? (
        <div className="mt-2 space-y-2">
          <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <Button type="button" size="sm" loading={isPending} disabled={isPending} onClick={handleSave}>
              Guardar
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{savedValue || "Sin nota interna."}</p>
      )}
    </div>
  );
}
