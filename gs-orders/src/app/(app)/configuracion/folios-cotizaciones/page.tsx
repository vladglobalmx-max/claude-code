import Link from "next/link";
import { Plus, Hash } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ActiveBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import type { SalespersonQuoteSequence } from "@/types/domain";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

interface SequenceRow extends SalespersonQuoteSequence {
  salespeople: { name: string } | OneOrMany<{ name: string }> | null;
  business_units: { name: string } | OneOrMany<{ name: string }> | null;
}

/**
 * Administración mínima de salesperson_quote_sequences (motor de folios de
 * Quotes — ver 0020_core_quotes.sql), AJUSTE 1 de la aprobación de Q4.
 * ADMIN-only: RLS ya restringe INSERT/UPDATE/DELETE a ADMIN
 * (salesperson_quote_sequences_*_admin) y /configuracion es admin-only en
 * middleware — sin guard adicional aquí, mismo criterio que
 * /vendedores y /configuracion/catalogo.
 */
export default async function FoliosCotizacionesPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salesperson_quote_sequences")
    .select("*, salespeople(name), business_units(name)")
    .order("created_at", { ascending: false });

  const sequences = (data ?? []) as unknown as SequenceRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Folios de Cotización"
        description="Prefijo y consecutivo de folio de cada vendedor, por Business Unit. El consecutivo lo administra exclusivamente el motor de folios."
        actions={
          <Link href="/configuracion/folios-cotizaciones/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Configuración
            </Button>
          </Link>
        }
      />

      {sequences.length === 0 ? (
        <Card>
          <EmptyState
            icon={Hash}
            title="Todavía no hay configuraciones de folio"
            description="Crea la primera configuración Vendedor × Business Unit para poder generar Cotizaciones."
            action={
              <Link href="/configuracion/folios-cotizaciones/nuevo">
                <Button>
                  <Plus className="h-4 w-4" />
                  Configuración
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {sequences.map((seq) => {
              const salesperson = one(seq.salespeople);
              const businessUnit = one(seq.business_units);
              return (
                <Card key={seq.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/configuracion/folios-cotizaciones/${seq.id}/editar`} className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{salesperson?.name ?? "—"}</p>
                      <p className="truncate text-xs text-ink-faint">{businessUnit?.name ?? "—"}</p>
                    </Link>
                    <ActiveBadge active={seq.active} />
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink-faint">
                    {seq.quote_prefix} · consecutivo {seq.sequence_current}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Vendedor</Th>
                  <Th>Business Unit</Th>
                  <Th>Prefijo</Th>
                  <Th>Consecutivo actual</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {sequences.map((seq) => {
                  const salesperson = one(seq.salespeople);
                  const businessUnit = one(seq.business_units);
                  return (
                    <Tr key={seq.id}>
                      <Td className="font-medium">{salesperson?.name ?? "—"}</Td>
                      <Td className="text-ink-soft">{businessUnit?.name ?? "—"}</Td>
                      <Td className="font-mono text-ink-soft">{seq.quote_prefix}</Td>
                      <Td className="text-ink-soft">{seq.sequence_current}</Td>
                      <Td>
                        <ActiveBadge active={seq.active} />
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/configuracion/folios-cotizaciones/${seq.id}/editar`}
                          className="text-sm text-accent hover:underline"
                        >
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
