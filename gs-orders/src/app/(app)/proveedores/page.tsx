import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { Supplier } from "@/types/domain";
import { SupplierFilters } from "./supplier-filters";

export const dynamic = "force-dynamic";

/**
 * THÖREN Fase 6L — catálogo de proveedores. Mismo patrón que /clientes:
 * ADMIN y VENDEDOR pueden crear (suppliers_insert_member), solo ADMIN edita
 * (suppliers_update_admin) — RLS ya filtra inactivos para no-admin.
 */
export default async function ProveedoresPage({ searchParams }: { searchParams: { q?: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const isAdmin = profile?.role === "admin";

  let query = supabase.from("suppliers").select("*").order("name");

  if (searchParams.q) {
    const q = searchParams.q.trim();
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,contact_name.ilike.%${q}%`);
  }

  const { data } = await query;
  const suppliers = (data ?? []) as Supplier[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Proveedores"
        description="Proveedores de la organización, para generar Purchase Orders desde los Pedidos."
        actions={
          <Link href="/proveedores/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo proveedor
            </Button>
          </Link>
        }
      />

      <SupplierFilters />

      {suppliers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Truck}
            title="No hay proveedores que coincidan"
            description="Ajusta la búsqueda, o crea el primer proveedor."
            action={
              <Link href="/proveedores/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo proveedor
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {suppliers.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                    {s.contact_name && <p className="truncate text-xs text-ink-faint">{s.contact_name}</p>}
                  </div>
                  <ActiveBadge active={s.active} />
                </div>
                <p className="mt-2 text-xs text-ink-faint">{s.email ?? s.phone ?? "—"}</p>
                {isAdmin && (
                  <div className="mt-3 border-t border-border pt-2">
                    <Link href={`/proveedores/${s.id}/editar`} className="text-sm text-accent hover:underline">
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
                  <Th>Contacto</Th>
                  <Th>Email</Th>
                  <Th>Teléfono</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th />}
                </Tr>
              </Thead>
              <Tbody>
                {suppliers.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium">{s.name}</Td>
                    <Td className="text-ink-soft">{s.contact_name ?? "—"}</Td>
                    <Td className="text-ink-soft">{s.email ?? "—"}</Td>
                    <Td className="text-ink-soft">{s.phone ?? "—"}</Td>
                    <Td>
                      <ActiveBadge active={s.active} />
                    </Td>
                    {isAdmin && (
                      <Td className="text-right">
                        <Link href={`/proveedores/${s.id}/editar`} className="text-sm text-accent hover:underline">
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
