import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ClientStatusBadge } from "@/components/clients/status-badge";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: clients } = user
    ? await supabase
        .from("clients")
        .select("id, legal_name, trade_name, industry, city, status, business_units(name)")
        .eq("company_id", user.companyId)
        .order("legal_name")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Clientes</h1>
          <p className="text-sm text-ink-faint">Ficha 360° de cada cuenta: contactos, historial e inteligencia comercial.</p>
        </div>
        <Link href="/clients/new">
          <Button>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        </Link>
      </div>

      {!clients || clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no hay clientes"
          description="Crea el primero o carga los datos de demostración."
          action={
            <Link href="/clients/new">
              <Button size="sm">
                <Plus className="h-4 w-4" /> Nuevo cliente
              </Button>
            </Link>
          }
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Industria</Th>
              <Th>Ciudad</Th>
              <Th>Unidad de negocio</Th>
              <Th>Estatus</Th>
            </tr>
          </Thead>
          <Tbody>
            {clients.map((client) => (
              <Tr key={client.id}>
                <Td>
                  <Link href={`/clients/${client.id}`} className="font-medium text-ink hover:text-accent">
                    {client.trade_name || client.legal_name}
                  </Link>
                </Td>
                <Td>{client.industry ?? "—"}</Td>
                <Td>{client.city ?? "—"}</Td>
                <Td>{(client as any).business_units?.name ?? "—"}</Td>
                <Td>
                  <ClientStatusBadge status={client.status} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
