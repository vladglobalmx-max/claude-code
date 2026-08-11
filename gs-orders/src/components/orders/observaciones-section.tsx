"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ObservacionesSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observaciones para proveedor / fábrica</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-ink-faint">Este texto aparece de forma clara en el PDF del pedido.</p>
        <Textarea
          rows={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Indicaciones especiales, tiempos de entrega, condiciones acordadas…"
        />
      </CardContent>
    </Card>
  );
}
