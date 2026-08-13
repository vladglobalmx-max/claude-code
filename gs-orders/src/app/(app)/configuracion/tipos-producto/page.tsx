import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { ProductTypeItem } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function TiposProductoPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("product_types").select("*").order("name", { ascending: true });

  const productTypes = (data ?? []) as ProductTypeItem[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Tipos de producto</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Se usan en &ldquo;Tipo de producto&rdquo; al crear un pedido. Desactivar uno no afecta pedidos ya creados.
          </p>
        </div>
        <Link href="/configuracion/tipos-producto/nuevo">
          <Button>
            <Plus className="h-4 w-4" />
            Tipo
          </Button>
        </Link>
      </div>

      {productTypes.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={Tags}
            title="Todavía no hay tipos de producto"
            description="Agrega el primer tipo para poder seleccionarlo al crear pedidos."
            action={
              <Link href="/configuracion/tipos-producto/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Tipo
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
                <Th>Código</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {productTypes.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="font-mono text-ink-soft">{t.code}</Td>
                  <Td>
                    <Badge variant={t.active ? "success" : "neutral"}>{t.active ? "Activo" : "Inactivo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/configuracion/tipos-producto/${t.id}/editar`}
                      className="text-sm text-accent hover:underline"
                    >
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
