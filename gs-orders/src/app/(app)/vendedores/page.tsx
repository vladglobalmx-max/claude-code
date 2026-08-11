import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { Salesperson } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salespeople")
    .select("*")
    .order("name", { ascending: true });

  const salespeople = (data ?? []) as Salesperson[];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Vendedores</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Cada vendedor tiene su propio prefijo y consecutivo de folios.
          </p>
        </div>
        <Link href="/vendedores/nuevo">
          <Button>
            <Plus className="h-4 w-4" />
            Vendedor
          </Button>
        </Link>
      </div>

      {salespeople.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Users}
            title="Todavía no hay vendedores"
            description="Agrega el primer vendedor para poder generar pedidos."
            action={
              <Link href="/vendedores/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Vendedor
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <Thead>
              <Tr>
                <Th>Nombre</Th>
                <Th>Prefijo</Th>
                <Th>Consecutivo actual</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {salespeople.map((sp) => (
                <Tr key={sp.id}>
                  <Td className="font-medium">{sp.name}</Td>
                  <Td className="font-mono text-ink-soft">{sp.prefix}</Td>
                  <Td className="text-ink-soft">{sp.sequence_current}</Td>
                  <Td>
                    <Badge variant={sp.active ? "success" : "neutral"}>
                      {sp.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/vendedores/${sp.id}/editar`} className="text-sm text-accent hover:underline">
                      Editar
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
