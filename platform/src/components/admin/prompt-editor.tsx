"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { FormField, Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updatePromptAction, testPromptAction, type UpdatePromptState } from "@/app/(app)/admin/prompts/actions";
import type { Prompt } from "@/types/domain";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Guardar (crea nueva versión)
    </Button>
  );
}

export function PromptEditor({ prompt }: { prompt: Prompt }) {
  const [state, formAction] = useFormState<UpdatePromptState, FormData>(updatePromptAction, {});
  const [systemPrompt, setSystemPrompt] = useState(prompt.system_prompt);
  const [userTemplate, setUserTemplate] = useState(prompt.user_prompt_template);
  const [model, setModel] = useState(prompt.model);
  const [temperature, setTemperature] = useState(prompt.temperature);
  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (state.success) toast.success("Prompt guardado — la versión anterior quedó en el historial.");
    if (state.error) toast.error(state.error);
  }, [state]);

  async function handleTest() {
    setTesting(true);
    setTestOutput(null);
    const result = await testPromptAction({
      systemPrompt,
      userMessage: testInput || userTemplate,
      model,
      temperature,
    });
    setTesting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setTestOutput(result.output ?? "");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="promptId" value={prompt.id} />

        <FormField label="System prompt" htmlFor="system_prompt">
          <Textarea
            id="system_prompt"
            name="system_prompt"
            rows={10}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="font-mono text-xs"
          />
        </FormField>

        <FormField label="Plantilla del prompt de usuario (usa {{variable}})" htmlFor="user_prompt_template">
          <Textarea
            id="user_prompt_template"
            name="user_prompt_template"
            rows={6}
            value={userTemplate}
            onChange={(e) => setUserTemplate(e.target.value)}
            className="font-mono text-xs"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Modelo" htmlFor="model">
            <Input id="model" name="model" value={model} onChange={(e) => setModel(e.target.value)} />
          </FormField>
          <FormField label="Temperatura" htmlFor="temperature">
            <Input
              id="temperature"
              name="temperature"
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </FormField>
        </div>

        <div>
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            name="status"
            defaultValue={prompt.status}
            className="h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>

        <SaveButton />
      </form>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <FlaskConical className="h-4 w-4 text-accent" /> Probar prompt (no guarda cambios)
          </p>
          <Textarea
            placeholder="Mensaje de prueba (o deja vacío para usar la plantilla tal cual)"
            rows={4}
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
          />
          <Button variant="secondary" onClick={handleTest} loading={testing} type="button">
            Ejecutar prueba
          </Button>
          {testOutput !== null && (
            <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-ink-soft">
              <pre className="whitespace-pre-wrap font-mono">{testOutput}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
