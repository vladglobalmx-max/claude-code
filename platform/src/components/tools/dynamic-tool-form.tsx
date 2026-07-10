"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/input";
import type { ToolInputSchema } from "@/lib/validations/tool-input-schema";
import { StructuredResultView } from "@/components/tools/structured-result-view";

export function DynamicToolForm({
  toolSlug,
  inputSchema,
  presetValues = {},
  clientId,
  opportunityId,
}: {
  toolSlug: string;
  inputSchema: ToolInputSchema;
  presetValues?: Record<string, string>;
  clientId?: string;
  opportunityId?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(presetValues);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  function setValue(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/ai/tools/${toolSlug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: values, clientId, opportunityId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo generar el resultado.");
        return;
      }
      setResult(data.output);
      toast.success("Resultado generado");
    } catch {
      setError("No se pudo generar el resultado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4">
        {inputSchema.fields.map((field) => (
          <FormField key={field.name} label={field.label} htmlFor={field.name}>
            {field.type === "textarea" ? (
              <Textarea
                id={field.name}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                rows={3}
              />
            ) : field.type === "select" ? (
              <select
                id={field.name}
                required={field.required}
                value={values[field.name] ?? ""}
                onChange={(e) => setValue(field.name, e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Selecciona…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={field.name}
                type={field.type === "number" ? "number" : "text"}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) => setValue(field.name, e.target.value)}
              />
            )}
          </FormField>
        ))}

        <Button type="submit" loading={loading} className="w-full">
          Generar con IA
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      <div>
        {result ? (
          <StructuredResultView output={result} />
        ) : (
          <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-ink-faint">
            El resultado aparecerá aquí
          </div>
        )}
      </div>
    </div>
  );
}
