import Link from "next/link";
import { ChevronRight, Hash, Package, SlidersHorizontal, Tags, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isFullAdmin } from "@/lib/auth/user-management";

/**
 * THÖREN 6R.1B-4B — un titular de can_manage_users llega hasta aquí (el
 * layout padre ya lo permite) pero NUNCA debe ver Catálogo/Tipos de
 * producto/Folios de Cotización: son autoridad de negocio, fuera del
 * alcance de 0046. Esta página filtra sus propias tarjetas en vez de
 * confiar en que el usuario simplemente no encuentre esos enlaces — es la
 * misma autorización real que ya protege cada subruta por su cuenta
 * (layout.tsx de catalogo/tipos-producto/folios-cotizaciones), solo que
 * aplicada aquí para no mostrar ni siquiera el enlace.
 */
export default async function ConfiguracionPage() {
  const profile = await getCurrentProfile();
  const admin = isFullAdmin(profile);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader
        title="Configuración"
        description={
          admin
            ? "Catálogo, tipos de producto, folios de cotización y usuarios de THÖREN."
            : "Administración de usuarios de THÖREN."
        }
      />

      {admin && (
        <>
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
              <CardTitle>Folios de Cotización</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/configuracion/folios-cotizaciones"
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-ink-faint" />
                  Prefijo y consecutivo de folio de cada vendedor, por Business Unit
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </Link>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Campos personalizados</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/configuracion/campos-personalizados"
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-ink-faint" />
                  Agrega campos propios de tu organización o de una Business Unit
                </span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </Link>
            </CardContent>
          </Card>
        </>
      )}

      <Card className={admin ? "mt-4" : undefined}>
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
