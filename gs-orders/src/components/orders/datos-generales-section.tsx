"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PRODUCT_TYPE_LABELS } from "@/types/domain";
import type { Salesperson } from "@/types/domain";
import type { OrderFormState } from "./types";

export function DatosGeneralesSection({
  state,
  salespeople,
  onChange,
  folioPreview,
  locked = false,
}: {
  state: OrderFormState;
  salespeople: Salesperson[];
  onChange: (patch: Partial<OrderFormState>) => void;
  folioPreview: string | null;
  locked?: boolean;
}) {
  const currentSalesperson = salespeople.find((sp) => sp.id === state.salespersonId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="order_date">Fecha</Label>
          {locked ? (
            <p className="flex h-9 items-center text-sm text-ink-soft">{state.orderDate}</p>
          ) : (
            <Input
              id="order_date"
              type="date"
              value={state.orderDate}
              onChange={(e) => onChange({ orderDate: e.target.value })}
            />
          )}
        </div>

        <div>
          <Label htmlFor="salesperson">Vendedor</Label>
          {locked ? (
            <p className="flex h-9 items-center text-sm text-ink-soft">
              {currentSalesperson ? `${currentSalesperson.name} (${currentSalesperson.prefix})` : "—"}
            </p>
          ) : (
            <Select
              id="salesperson"
              value={state.salespersonId}
              onChange={(e) => onChange({ salespersonId: e.target.value })}
            >
              <option value="">Selecciona un vendedor…</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.prefix})
                </option>
              ))}
            </Select>
          )}
          {!locked && folioPreview && (
            <p className="mt-1 font-mono text-xs text-ink-faint">Folio estimado: {folioPreview}</p>
          )}
          {locked && <p className="mt-1 text-xs text-ink-faint">La fecha y el vendedor ya generaron el folio; no se pueden cambiar.</p>}
        </div>

        <div>
          <Label htmlFor="client_name">Cliente</Label>
          <Input
            id="client_name"
            value={state.clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
            placeholder="Nombre del cliente"
          />
        </div>

        <div>
          <Label htmlFor="supplier_name">Proveedor</Label>
          <Input
            id="supplier_name"
            value={state.supplierName}
            onChange={(e) => onChange({ supplierName: e.target.value })}
            placeholder="Fábrica / proveedor"
          />
        </div>

        <div>
          <Label htmlFor="product_type">Tipo de producto</Label>
          <Select
            id="product_type"
            value={state.productType}
            onChange={(e) => onChange({ productType: e.target.value as OrderFormState["productType"] })}
          >
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
