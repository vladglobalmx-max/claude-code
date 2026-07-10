"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function asPlainText(output: Record<string, unknown>): string {
  return Object.entries(output)
    .map(([key, value]) => `${humanizeKey(key)}:\n${Array.isArray(value) ? value.map((v) => `- ${v}`).join("\n") : value}`)
    .join("\n\n");
}

export function StructuredResultView({ output }: { output: unknown }) {
  if (typeof output !== "object" || output === null) {
    return <p className="text-sm text-ink-soft">{String(output)}</p>;
  }
  const entries = Object.entries(output as Record<string, unknown>);

  function handleCopy() {
    navigator.clipboard.writeText(asPlainText(output as Record<string, unknown>));
    toast.success("Resultado copiado");
  }

  function handleDownload() {
    const blob = new Blob([asPlainText(output as Record<string, unknown>)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resultado-gaios.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" /> Descargar
          </Button>
        </div>

        {entries.map(([key, value]) => (
          <div key={key}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{humanizeKey(key)}</p>
            <ResultValue value={value} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ResultValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-soft">
        {value.map((item, i) => (
          <li key={i}>{String(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "number") {
    return (
      <p className="mt-1.5">
        <Badge tone="accent">{value}</Badge>
      </p>
    );
  }
  if (typeof value === "string" && ["bajo", "medio", "alto"].includes(value)) {
    const tone = value === "alto" ? "danger" : value === "medio" ? "warning" : "success";
    return (
      <p className="mt-1.5">
        <Badge tone={tone}>{value}</Badge>
      </p>
    );
  }
  return <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">{String(value)}</p>;
}
