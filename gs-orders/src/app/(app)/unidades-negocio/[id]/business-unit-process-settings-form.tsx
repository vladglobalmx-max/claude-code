"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateBusinessUnitProcessSettings } from "./actions";

type ProviderDocumentLanguage = "es" | "en";

/**
 * THÖREN 8D (gap final) — requisitos CORE de esta Business Unit antes de
 * "Pedido" (0062_business_unit_process_settings.sql). Hoy Proveedor +
 * idioma del PDF de Pedido para Proveedor; diseñado para agregar más
 * ajustes CORE aquí sin rediseñar la pantalla.
 *
 * IDIOMA PARA PROVEEDOR (Adenda PDF Pedido, 0063): selector Español/
 * English para `provider_document_language` — configuración por Business
 * Unit, nunca un nombre de Business Unit hardcodeado en el código. Afecta
 * únicamente el PDF de Pedido/Orden de Compra que se genera para
 * Proveedor; la app y la captura de datos internos siguen siempre en
 * español.
 */
export function BusinessUnitProcessSettingsForm({
  businessUnitId,
  initialRequireSupplierBeforeOrder,
  initialProviderDocumentLanguage,
  canEdit,
}: {
  businessUnitId: string;
  initialRequireSupplierBeforeOrder: boolean;
  initialProviderDocumentLanguage: ProviderDocumentLanguage;
  canEdit: boolean;
}) {
  const [requireSupplier, setRequireSupplier] = useState(initialRequireSupplierBeforeOrder);
  const [providerDocumentLanguage, setProviderDocumentLanguage] = useState<ProviderDocumentLanguage>(
    initialProviderDocumentLanguage
  );
  const [isPending, startTransition] = useTransition();

  const dirty =
    requireSupplier !== initialRequireSupplierBeforeOrder ||
    providerDocumentLanguage !== initialProviderDocumentLanguage;

  function handleSave() {
    startTransition(async () => {
      const result = await updateBusinessUnitProcessSettings(businessUnitId, {
        requireSupplierBeforeOrder: requireSupplier,
        providerDocumentLanguage,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cambios guardados");
    });
  }

  if (!canEdit) {
    return (
      <div className="space-y-1 text-sm text-ink">
        <p>
          {initialRequireSupplierBeforeOrder
            ? "Requiere Proveedor antes de convertir a Orden de Trabajo."
            : "No requiere Proveedor antes de convertir a Orden de Trabajo."}
        </p>
        <p>
          Idioma del PDF de Orden de Trabajo para Proveedor:{" "}
          {initialProviderDocumentLanguage === "en" ? "English" : "Español"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={requireSupplier}
          onChange={(e) => setRequireSupplier(e.target.checked)}
          className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
        />
        Requerir proveedor antes de convertir a Orden de Trabajo
      </label>

      <div className="space-y-1.5">
        <label htmlFor="provider-document-language" className="block text-sm text-ink-soft">
          Idioma del PDF de Orden de Trabajo para Proveedor
        </label>
        <select
          id="provider-document-language"
          value={providerDocumentLanguage}
          onChange={(e) => setProviderDocumentLanguage(e.target.value as ProviderDocumentLanguage)}
          className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <p className="text-xs text-ink-faint">
          Solo afecta el documento generado para Proveedor — la app y la captura de datos siguen en español.
        </p>
      </div>

      <Button type="button" size="sm" loading={isPending} disabled={isPending || !dirty} onClick={handleSave}>
        Guardar cambios
      </Button>
    </div>
  );
}
