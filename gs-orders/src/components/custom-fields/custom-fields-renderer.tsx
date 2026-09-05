"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";

/**
 * Renderer universal de campos personalizados (THÖREN 8B). Solo conoce
 * `entityType`/`definitions`/`values` — nunca el nombre de una
 * organización o Business Unit. Qué definiciones llegan aquí (org-wide +
 * la BU vigente, nunca otra) lo decide el caller (ver ProductosSection),
 * no este componente.
 */
export function CustomFieldsRenderer({
  definitions,
  values,
  onChange,
  idPrefix,
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  idPrefix: string;
}) {
  if (definitions.length === 0) return null;

  return (
    <>
      {definitions.map((def) => {
        const domId = `${idPrefix}-${def.key}`;
        const value = values[def.key] ?? "";

        if (def.fieldType === "checkbox") {
          return (
            <div key={def.id}>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  id={domId}
                  checked={value === "on"}
                  onChange={(e) => onChange(def.key, e.target.checked ? "on" : "")}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                />
                {def.label}
              </label>
              {def.helpText && <p className="mt-1 text-xs text-ink-faint">{def.helpText}</p>}
            </div>
          );
        }

        return (
          <div key={def.id} className={def.fieldType === "textarea" ? "sm:col-span-2" : undefined}>
            <Label htmlFor={domId}>
              {def.label}
              {!def.required && " (opcional)"}
            </Label>
            {def.fieldType === "textarea" ? (
              <Textarea
                id={domId}
                rows={2}
                value={value}
                placeholder={def.placeholder ?? undefined}
                onChange={(e) => onChange(def.key, e.target.value)}
              />
            ) : def.fieldType === "select" ? (
              <Select id={domId} value={value} onChange={(e) => onChange(def.key, e.target.value)}>
                <option value="">Selecciona…</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={domId}
                type={def.fieldType === "number" ? "number" : def.fieldType === "date" ? "date" : "text"}
                value={value}
                placeholder={def.placeholder ?? undefined}
                onChange={(e) => onChange(def.key, e.target.value)}
              />
            )}
            {def.helpText && <p className="mt-1 text-xs text-ink-faint">{def.helpText}</p>}
          </div>
        );
      })}
    </>
  );
}
