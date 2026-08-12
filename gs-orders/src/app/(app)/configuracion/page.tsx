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
    </div>
  );
}
