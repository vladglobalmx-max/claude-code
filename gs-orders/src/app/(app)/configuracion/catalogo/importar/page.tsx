import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "./import-wizard";

export const dynamic = "force-dynamic";

/**
 * Importación Excel de Productos (THÖREN Importación masiva de Productos
 * desde Excel) — mismo patrón exacto que /clientes/importar. ADMIN-only
 * por herencia de middleware.ts (ADMIN_ONLY_PREFIXES incluye
 * "/configuracion" completo) — sin guard adicional aquí, mismo criterio
 * que el resto de /configuracion/catalogo.
 */
export default function ImportarProductosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Importar productos"
        description="Sube un Excel con la plantilla oficial para dar de alta varios productos del catálogo a la vez."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>0. Descarga la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-soft">
            Columnas: <strong>SKU</strong> (obligatorio, único por organización), <strong>Nombre</strong>{" "}
            (obligatorio), Descripción, <strong>Business Unit</strong> (obligatorio, debe existir y estar activa),{" "}
            <strong>Tipo de producto</strong> (obligatorio, debe existir y estar activo), Marca, Modelo, Unidad,{" "}
            <strong>Moneda</strong> (obligatorio, MXN o USD), Precio base, Activo.
          </p>
          <p className="text-sm text-ink-soft">
            <strong>Business Unit</strong> admite varias unidades separadas por{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">{" | "}</code> — ej.{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">
              Thunder LED Lights | Thunder Safety Solutions
            </code>
            . Para un producto compartido con todas las Business Units de la organización, escribe exactamente{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">TODAS</code>.
          </p>
          <p className="text-sm text-ink-soft">
            Si el SKU ya existe en el catálogo, la fila se trata como actualización — se muestra qué campos
            cambiarán antes de confirmar (incluidas altas/bajas de Business Units). Puedes reimportar el mismo
            archivo sin duplicar nada.
          </p>
          <a href="/plantillas/productos.xlsx" download>
            <Button type="button" variant="outline">
              <Download className="h-4 w-4" />
              Descargar plantilla (.xlsx)
            </Button>
          </a>
        </CardContent>
      </Card>

      <ImportWizard />

      <div className="mt-6">
        <Link href="/configuracion/catalogo" className="text-sm text-accent hover:underline">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
