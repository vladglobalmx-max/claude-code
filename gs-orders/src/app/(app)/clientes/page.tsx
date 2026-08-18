import Link from "next/link";
import { Plus, Upload, Users as UsersIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { Customer } from "@/types/domain";
import { CustomerFilters } from "./customer-filters";

export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const isAdmin = profile?.role === "admin";

  let query = supabase.from("customers").select("*").order("name");

  if (searchParams.q) {
    const q = searchParams.q.trim();
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data } = await query;
  const customers = (data ?? []) as Customer[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Clientes"
        description="Clientes de la organización, compartidos entre Comercial."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/clientes/nuevo">
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </Link>
            <Link href="/clientes/importar">
              <Button variant="outline">
                <Upload className="h-4 w-4" />
                Importar Excel
              </Button>
            </Link>
          </div>
        }
      />

      <CustomerFilters />

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersIcon}
            title="No hay clientes que coincidan"
            description="Ajusta la búsqueda, o crea el primer cliente."
            action={
              <Link href="/clientes/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nuevo cliente
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {customers.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                    {c.email && <p className="truncate text-xs text-ink-faint">{c.email}</p>}
                  </div>
                  <ActiveBadge active={c.active} />
                </div>
                <p className="mt-2 text-xs text-ink-faint">{c.phone ?? "—"}</p>
                {isAdmin && (
                  <div className="mt-3 border-t border-border pt-2">
                    <Link href={`/clientes/${c.id}/editar`} className="text-sm text-accent hover:underline">
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
                  <Th>Email</Th>
                  <Th>Teléfono</Th>
                  <Th>Estado</Th>
                  {isAdmin && <Th />}
                </Tr>
              </Thead>
              <Tbody>
                {customers.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td className="text-ink-soft">{c.email ?? "—"}</Td>
                    <Td className="text-ink-soft">{c.phone ?? "—"}</Td>
                    <Td>
                      <ActiveBadge active={c.active} />
                    </Td>
                    {isAdmin && (
                      <Td className="text-right">
                        <Link href={`/clientes/${c.id}/editar`} className="text-sm text-accent hover:underline">
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
