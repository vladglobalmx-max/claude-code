"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ObservacionesSection({
  value,
  onChange,
  valueEn,
  onChangeEn,
}: {
  value: string;
  onChange: (value: string) => void;
  valueEn: string;
  onChangeEn: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Observaciones para proveedor / fábrica</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="vendor-notes">Observaciones</Label>
          <p className="mb-2 text-xs text-ink-faint">Este texto aparece de forma clara en el PDF del pedido.</p>
          <Textarea
            id="vendor-notes"
            rows={6}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Indicaciones especiales, tiempos de entrega, condiciones acordadas…"
          />
        </div>
        <div>
          <Label htmlFor="vendor-notes-en">Texto para proveedor (inglés)</Label>
          <Textarea
            id="vendor-notes-en"
            rows={6}
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-faint">Opcional. Se usa en el PDF para fábrica; si se deja vacío, se usa el texto en español.</p>
        </div>
      </CardContent>
    </Card>
  );
}
