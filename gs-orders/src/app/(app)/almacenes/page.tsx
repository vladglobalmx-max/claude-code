import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { Warehouse } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * THÖREN Fase 6M — catálogo de almacenes. A diferencia de /proveedores,
 * la creación también es ADMIN-only (ver warehouses_insert_admin, 0036).
 */
export default async function AlmacenesPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = createSupabaseServerClient();

  const { data } = await supabase.from("warehouses").select("*").order("name");
  const warehouses = (data ?? []) as Warehouse[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        title="Almacenes"
        description="Almacenes de la organización, para recepción de compras y movimientos de inventario."
        actions={
          isAdmin ? (
            <Link href="/almacenes/nuevo">
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo almacén
              </Button>
            </Link>
          ) : undefined
        }
      />

      {warehouses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No hay almacenes"
            description={isAdmin ? "Crea el primer almacén de tu organización." : "Todavía no hay almacenes registrados."}
            action={
              isAdmin ? (
                <Link href="/almacenes/nuevo">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Nuevo almacén
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {warehouses.map((w) => (
              <Card key={w.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                    <p className="font-mono text-xs text-ink-faint">{w.code}</p>
                  </div>
                  <ActiveBadge active={w.active} />
                </div>
                {w.location && <p className="mt-2 text-xs text-ink-faint">{w.location}</p>}
                {isAdmin && (
                  <div className="mt-3 border-t border-border pt-2">
                    <Link href={`/almacenes/${w.id}/editar`} className="text-sm text-accent hover:underline">
                      Editar
                    </Link>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Código</Th>
                  <Th>Ubicación</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th />}
                </Tr>
              </Thead>
              <Tbody>
                {warehouses.map((w) => (
                  <Tr key={w.id}>
                    <Td className="font-medium">{w.name}</Td>
                    <Td className="font-mono text-ink-soft">{w.code}</Td>
                    <Td className="text-ink-soft">{w.location ?? "—"}</Td>
                    <Td>
                      <ActiveBadge active={w.active} />
                    </Td>
                    {isAdmin && (
                      <Td className="text-right">
                        <Link href={`/almacenes/${w.id}/editar`} className="text-sm text-accent hover:underline">
                          Editar
                        </Link>
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
