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
            Columnas: <strong>Business Unit</strong> (obligatorio, debe existir y estar activa),{" "}
            <strong>Categoría</strong> (obligatorio), <strong>Modelo / SKU</strong> (obligatorio, único),{" "}
            <strong>Nombre</strong> (obligatorio), Descripción, Precio MXN, Precio USD, Activo.
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
