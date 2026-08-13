"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ORDER_STATUS_LABELS, PRODUCT_TYPE_LABELS } from "@/types/domain";
import type { OrderStatus, Salesperson } from "@/types/domain";
import type { OrderFormState } from "./types";

export function RevisarSection({
  state,
  salespeople,
  missingFields,
  editableStatus = false,
  onStatusChange,
}: {
  state: OrderFormState;
  salespeople: Salesperson[];
  missingFields: string[];
  editableStatus?: boolean;
  onStatusChange?: (status: OrderStatus) => void;
}) {
  const salesperson = salespeople.find((sp) => sp.id === state.salespersonId);

  return (
    <div className="space-y-5">
      {editableStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Estado del pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="status">Estado</Label>
            <Select
              id="status"
              value={state.status}
              onChange={(e) => onStatusChange?.(e.target.value as OrderStatus)}
            >
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      {missingFields.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-ink">
              Falta información para enviar este pedido a fábrica
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-ink-soft">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-faint">
              Puedes guardar como Borrador y completarlo después.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Fecha" value={state.orderDate} />
          <Row label="Vendedor" value={salesperson ? `${salesperson.name} (${salesperson.prefix})` : "—"} />
          <Row label="Cliente" value={state.clientName || "—"} />
          <Row label="Proveedor" value={state.supplierName || "—"} />
          <Row label="Tipo de producto" value={PRODUCT_TYPE_LABELS[state.productType]} />
          <Row label="Productos" value={String(state.items.length)} />
          <Row label="Fotografías" value={String(state.images.length)} />
          <Row label="Archivos adjuntos" value={String(state.files.length)} />
        </CardContent>
      </Card>

      {state.productType === "proyector_gobo" && (
        <Card>
          <CardHeader>
            <CardTitle>Proyección por producto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {state.items.map((item, index) => (
              <Row
                key={item.key}
                label={item.model ? `Producto ${index + 1} (${item.model})` : `Producto ${index + 1}`}
                value={
                  item.projectionImages.length > 0 ? (
                    <Badge variant="success">{item.projectionImages.length} imagen(es) cargada(s)</Badge>
                  ) : (
                    <Badge variant="neutral">Sin cargar</Badge>
                  )
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-0">
      <span className="text-ink-faint">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
