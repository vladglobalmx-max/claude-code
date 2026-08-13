import Link from "next/link";
import { ChevronRight, Package, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUSINESS_UNIT_LABELS, type BusinessUnit } from "@/types/domain";

const UNITS: { key: BusinessUnit; active: boolean }[] = [
  { key: "thunder", active: true },
  { key: "juno_promotional", active: false },
  { key: "got_fresh_breath", active: false },
  { key: "the_fire_spot", active: false },
];

export default function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-lg font-semibold text-ink">Configuración</h1>
      <p className="mb-6 text-sm text-ink-faint">
        GS Orders está preparado para más unidades de negocio de Global Supplier MTY.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Unidades de negocio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {UNITS.map((unit) => (
            <div key={unit.key} className="flex items-center justify-between">
              <span className="text-sm text-ink">{BUSINESS_UNIT_LABELS[unit.key]}</span>
              <Badge variant={unit.active ? "success" : "neutral"}>
                {unit.active ? "Activa" : "Próximamente"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Catálogo de productos</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/configuracion/catalogo"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4 text-ink-faint" />
              Administrar productos (Luz LED Grúa Viajera y futuros modelos)
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Tipos de producto</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/configuracion/tipos-producto"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
          >
            <span className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-ink-faint" />
              Administrar el &ldquo;Tipo de producto&rdquo; de Nuevo Pedido
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
