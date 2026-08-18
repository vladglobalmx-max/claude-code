import Link from "next/link";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ImportWizard } from "./import-wizard";

export const dynamic = "force-dynamic";

/**
 * Importación Excel de Clientes (§G-K de la implementación nocturna).
 * Todo el parseo/preview corre client-side (ImportWizard) — esta página
 * solo da el contexto y el link a la plantilla estática. ADMIN y VENDEDOR
 * pueden importar (misma RLS de alta de customers/customer_contacts que
 * ya permite a ambos roles, 0018/0021) — sin guard de rol aquí.
 */
export default function ImportarClientesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Importar clientes"
        description="Sube un Excel con la plantilla oficial para dar de alta varios clientes y sus contactos a la vez."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>0. Descarga la plantilla</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-soft">
            Columnas: <strong>Nombre Cliente</strong> (obligatorio), Contacto, Email, Teléfono, Razón Social, RFC. Si
            un cliente tiene varios contactos, repite el nombre del cliente (y el mismo RFC si lo tiene) en una fila
            por cada contacto.
          </p>
          <a href="/plantillas/clientes.xlsx" download>
            <Button type="button" variant="outline">
              <Download className="h-4 w-4" />
              Descargar plantilla (.xlsx)
            </Button>
          </a>
        </CardContent>
      </Card>

      <ImportWizard />

      <div className="mt-6">
        <Link href="/clientes" className="text-sm text-accent hover:underline">
          Volver a Clientes
        </Link>
      </div>
    </div>
  );
}
