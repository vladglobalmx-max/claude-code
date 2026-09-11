import Link from "next/link";
import { Download } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
 *
 * THÖREN — Catálogo UX (Organization → BU → Product Type → Products):
 * businessUnits/productTypes se leen aquí (server) solo para poblar el
 * selector de "contexto" opcional del wizard (Business Unit/Tipo de
 * producto por defecto para filas sin esas columnas, ver import-parsing.ts)
 * — ImportWizard vuelve a pedir los candidatos actualizados vía
 * getProductImportCandidates() al momento de clasificar el archivo
 * (existingProducts necesita estar fresco), esta lectura es solo para
 * dibujar el selector antes de subir nada.
 */
export default async function ImportarProductosPage({
  searchParams,
}: {
  searchParams: { bu?: string; tipo?: string };
}) {
  const supabase = createSupabaseServerClient();
  const [{ data: buData }, { data: ptData }] = await Promise.all([
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    supabase.from("product_types").select("id, name").eq("active", true).order("name"),
  ]);
  const businessUnits = (buData ?? []) as { id: string; name: string }[];
  const productTypes = (ptData ?? []) as { id: string; name: string }[];
  const preselectedBusinessUnitId = businessUnits.some((bu) => bu.id === searchParams.bu) ? searchParams.bu! : "";
  const preselectedProductTypeId = productTypes.some((t) => t.id === searchParams.tipo) ? searchParams.tipo! : "";

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
          <p className="text-sm text-ink-soft">
            Si eliges una Business Unit y/o un Tipo de producto por defecto abajo, puedes dejar esas columnas vacías
            en el Excel para las filas que quieras que los hereden — una fila con su propio valor en el archivo
            siempre lo usa en vez del valor por defecto (la opción avanzada de un Excel con distintas Business
            Units/Tipos por fila sigue funcionando igual).
          </p>
          <a href="/plantillas/productos.xlsx" download>
            <Button type="button" variant="outline">
              <Download className="h-4 w-4" />
              Descargar plantilla (.xlsx)
            </Button>
          </a>
        </CardContent>
      </Card>

      <ImportWizard
        businessUnits={businessUnits}
        productTypes={productTypes}
        defaultBusinessUnitId={preselectedBusinessUnitId}
        defaultProductTypeId={preselectedProductTypeId}
      />

      <div className="mt-6">
        <Link href="/configuracion/catalogo" className="text-sm text-accent hover:underline">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
