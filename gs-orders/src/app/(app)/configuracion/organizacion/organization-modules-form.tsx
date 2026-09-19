"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TOGGLEABLE_MODULE_KEYS, MODULE_KEY_LABELS, type ToggleableModuleKey } from "@/lib/organization-modules";
import { setOrganizationModule } from "./actions";

/**
 * THÖREN 0084 — checklist de los 14 módulos toggleables. Desmarcar
 * deshabilita el módulo (desaparece del sidebar y su URL redirige a
 * /inicio — ver middleware.ts); NUNCA borra datos y reactivarlo restaura
 * el acceso normal de inmediato. inicio/configuracion/unidades_negocio/
 * personas/vendedores NUNCA aparecen aquí — son infraestructura
 * administrativa siempre disponible (ver DECISIÓN en
 * src/lib/organization-modules.ts).
 */
export function OrganizationModulesForm({ initialDisabledModules }: { initialDisabledModules: ToggleableModuleKey[] }) {
  const [disabled, setDisabled] = useState(() => new Set(initialDisabledModules));
  const [pendingKey, setPendingKey] = useState<ToggleableModuleKey | null>(null);
  const [, startTransition] = useTransition();

  function handleToggle(moduleKey: ToggleableModuleKey, checked: boolean) {
    const previouslyDisabled = new Set(disabled);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
    setPendingKey(moduleKey);

    startTransition(async () => {
      const result = await setOrganizationModule(moduleKey, checked);
      setPendingKey(null);
      if (result.error) {
        toast.error(result.error);
        setDisabled(previouslyDisabled);
        return;
      }
      toast.success(checked ? `${MODULE_KEY_LABELS[moduleKey]} habilitado` : `${MODULE_KEY_LABELS[moduleKey]} deshabilitado`);
    });
  }

  return (
    <div className="space-y-2">
      {TOGGLEABLE_MODULE_KEYS.map((moduleKey) => {
        const enabled = !disabled.has(moduleKey);
        return (
          <label
            key={moduleKey}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm text-ink"
          >
            <span>{MODULE_KEY_LABELS[moduleKey]}</span>
            <input
              type="checkbox"
              checked={enabled}
              disabled={pendingKey === moduleKey}
              onChange={(e) => handleToggle(moduleKey, e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
            />
          </label>
        );
      })}
    </div>
  );
}
