import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { Salesperson } from "@/types/domain";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

interface SalespersonRow extends Salesperson {
  people: { id: string; name: string } | OneOrMany<{ id: string; name: string }> | null;
}

export default async function VendedoresPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salespeople")
    .select("*, people(id, name)")
    .order("name", { ascending: true });

  const salespeople = (data ?? []) as unknown as SalespersonRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Vendedores"
        description="Cada vendedor tiene su propio prefijo y consecutivo de folios."
        actions={
          <Link href="/vendedores/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Vendedor
            </Button>
          </Link>
        }
      />

      {salespeople.length === 0 ? (
        <Card>
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
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {salespeople.map((sp) => {
              const person = one(sp.people);
              return (
                <Card key={sp.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/vendedores/${sp.id}/editar`} className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{sp.name}</p>
                      <p className="font-mono text-xs text-ink-faint">{sp.prefix} · consecutivo {sp.sequence_current}</p>
                    </Link>
                    <ActiveBadge active={sp.active} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Persona:{" "}
                    {person ? (
                      <Link href={`/personas/${person.id}`} className="text-accent hover:underline">
                        {person.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Persona</Th>
                  <Th>Prefijo</Th>
                  <Th>Consecutivo actual</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {salespeople.map((sp) => {
                  const person = one(sp.people);
                  return (
                    <Tr key={sp.id}>
                      <Td className="font-medium">{sp.name}</Td>
                      <Td className="text-ink-soft">
                        {person ? (
                          <Link href={`/personas/${person.id}`} className="text-accent hover:underline">
                            {person.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="font-mono text-ink-soft">{sp.prefix}</Td>
                      <Td className="text-ink-soft">{sp.sequence_current}</Td>
                      <Td>
                        <ActiveBadge active={sp.active} />
                      </Td>
                      <Td className="text-right">
                        <Link href={`/vendedores/${sp.id}/editar`} className="text-sm text-accent hover:underline">
                          Editar
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
