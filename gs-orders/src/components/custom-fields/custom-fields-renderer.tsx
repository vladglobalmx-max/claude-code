"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiFileField } from "@/components/orders/multi-file-field";
import type { MediaDraft } from "@/components/orders/types";
import type { CustomFieldDefinition } from "@/lib/custom-fields/types";

/**
 * Renderer universal de campos personalizados (THÖREN 8B/8C). Solo conoce
 * `entityType`/`definitions`/`values`/`fileValues` — nunca el nombre de
 * una organización o Business Unit, ni "proyector_gobo" ni ningún
 * concepto vertical. Qué definiciones llegan aquí (org-wide + la BU
 * vigente, nunca otra) lo decide el caller (ver ProductosSection), no
 * este componente.
 *
 * "file"/"image" (8C) reutilizan MultiFileField/Storage tal cual: el
 * caller resuelve la subida real (uploadMediaFile) y las URLs de
 * previsualización — este componente solo arma la lista y dispara
 * onUploadFile/onRemoveFile con la `key` de la definición.
 */
export function CustomFieldsRenderer({
  definitions,
  values,
  onChange,
  fileValues = {},
  onUploadFile,
  onRemoveFile,
  idPrefix,
}: {
  definitions: CustomFieldDefinition[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Valores de las definiciones fieldType "file"/"image", por `key`. */
  fileValues?: Record<string, MediaDraft[]>;
  onUploadFile?: (key: string, file: File) => Promise<void>;
  onRemoveFile?: (key: string, fileKey: string) => void;
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

        if (def.fieldType === "file" || def.fieldType === "image") {
          const files = fileValues[def.key] ?? [];
          return (
            <div key={def.id} className="sm:col-span-2">
              <Label>
                {def.label}
                {!def.required && " (opcional)"}
              </Label>
              <MultiFileField
                items={files}
                variant={def.fieldType === "image" ? "photo" : "file"}
                accept={def.fieldType === "image" ? "image/jpeg,image/png,image/jpg" : undefined}
                onAdd={(file) => (onUploadFile ? onUploadFile(def.key, file) : Promise.resolve())}
                onRemove={(fileKey) => onRemoveFile?.(def.key, fileKey)}
              />
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
