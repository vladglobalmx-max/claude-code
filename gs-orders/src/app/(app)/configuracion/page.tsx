import Link from "next/link";
import { ChevronRight, Package, Tags, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader title="Configuración" description="Catálogo, tipos de producto y usuarios de THÖREN." />

      <Card>
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Usuarios y accesos</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/configuracion/usuarios"
            className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-faint" />
              Administra quién puede ingresar a THÖREN y qué permisos tiene
            </span>
            <ChevronRight className="h-4 w-4 text-ink-faint" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
