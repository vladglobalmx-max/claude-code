import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentOrganizationId } from "@/lib/auth/organization";
import { getAllCustomFieldDefinitions } from "@/lib/custom-fields/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "Producto",
  quote_item: "Producto de cotización",
  order_item: "Producto de pedido",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  textarea: "Texto largo",
  number: "Número",
  select: "Selección",
  checkbox: "Casilla",
  date: "Fecha",
};

export default async function CamposPersonalizadosPage() {
  const supabase = createSupabaseServerClient();
  const organizationId = await getCurrentOrganizationId();

  const [definitions, { data: businessUnitsData }] = await Promise.all([
    organizationId ? getAllCustomFieldDefinitions(supabase, organizationId) : Promise.resolve([]),
    supabase.from("business_units").select("id, name").order("name", { ascending: true }),
  ]);

  const businessUnitNamesById = new Map((businessUnitsData ?? []).map((bu) => [bu.id, bu.name]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Campos personalizados</h1>
          <p className="mt-0.5 text-sm text-ink-faint">
            Agrega campos propios de tu organización o de una Business Unit específica, sin depender de código.
          </p>
        </div>
        <Link href="/configuracion/campos-personalizados/nuevo">
          <Button>
            <Plus className="h-4 w-4" />
            Campo
          </Button>
        </Link>
      </div>

      {definitions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={SlidersHorizontal}
            title="Todavía no hay campos personalizados"
            description="Agrega el primero para capturarlo en Pedidos, Cotizaciones o el Catálogo."
            action={
              <Link href="/configuracion/campos-personalizados/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Campo
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
                <Th>Etiqueta</Th>
                <Th>Aplica a</Th>
                <Th>Alcance</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {definitions.map((def) => (
                <Tr key={def.id}>
                  <Td className="font-medium">
                    {def.label}
                    <span className="ml-1.5 font-mono text-xs text-ink-faint">({def.key})</span>
                  </Td>
                  <Td>{ENTITY_TYPE_LABELS[def.entityType] ?? def.entityType}</Td>
                  <Td>
                    {def.businessUnitId ? businessUnitNamesById.get(def.businessUnitId) ?? "—" : "Toda la organización"}
                  </Td>
                  <Td>{FIELD_TYPE_LABELS[def.fieldType] ?? def.fieldType}</Td>
                  <Td>
                    <Badge variant={def.active ? "success" : "neutral"}>{def.active ? "Activo" : "Inactivo"}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/configuracion/campos-personalizados/${def.id}/editar`}
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
