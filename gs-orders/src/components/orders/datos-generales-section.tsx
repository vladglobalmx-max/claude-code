"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ProductTypeItem, Salesperson } from "@/types/domain";
import type { OrderFormState } from "./types";

export function DatosGeneralesSection({
  state,
  salespeople,
  businessUnits,
  productTypes,
  onChange,
  onBusinessUnitChange,
  folioPreview,
  locked = false,
  canChooseSalesperson = true,
}: {
  state: OrderFormState;
  salespeople: Salesperson[];
  /** Fase 6F — para el selector de Business Unit del Order. */
  businessUnits: { id: string; name: string }[];
  productTypes: ProductTypeItem[];
  onChange: (patch: Partial<OrderFormState>) => void;
  /**
   * Fase 6F — cambio de Business Unit pasa por el padre (OrderForm) en vez
   * de `onChange` directo: OrderForm debe poder bloquear el cambio si hay
   * líneas de catálogo que dejarían de ser válidas (§5), nunca eliminarlas
   * en silencio.
   */
  onBusinessUnitChange: (businessUnitId: string) => void;
  folioPreview: string | null;
  locked?: boolean;
  /** false para VENDEDOR: el vendedor del pedido siempre es él mismo, nunca un selector (ver Fase 3). */
  canChooseSalesperson?: boolean;
}) {
  const currentSalesperson = salespeople.find((sp) => sp.id === state.salespersonId);
  const salespersonReadOnly = locked || !canChooseSalesperson;

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
          {salespersonReadOnly ? (
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
          {!locked && !canChooseSalesperson && (
            <p className="mt-1 text-xs text-ink-faint">El pedido se genera a tu nombre automáticamente.</p>
          )}
        </div>

        <div>
          <Label htmlFor="business_unit">Business Unit</Label>
          <Select
            id="business_unit"
            value={state.businessUnitId}
            onChange={(e) => onBusinessUnitChange(e.target.value)}
          >
            <option value="">Sin elegir</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-ink-faint">
            Necesaria para poder buscar productos del Catálogo Maestro en la pestaña Productos.
          </p>
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
            onChange={(e) => onChange({ productType: e.target.value })}
          >
            {productTypes.map((t) => (
              <option key={t.id} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
