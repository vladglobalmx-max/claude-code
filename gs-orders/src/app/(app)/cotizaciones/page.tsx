import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { isQuoteExpired } from "@/lib/quote-expiry";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Quote, Salesperson } from "@/types/domain";
import { QuoteFilters } from "./quote-filters";
import { DeleteQuoteButton } from "./delete-quote-button";

export const dynamic = "force-dynamic";

/**
 * Lista de Cotizaciones. Sin joins: folio/customer_name/salesperson_name/
 * business_unit_name ya son snapshots de la propia Quote (ver
 * 0020_core_quotes.sql), así que una sola consulta a `quotes` basta.
 * Visibilidad por rol la impone RLS (quotes_select_own_or_admin) — ADMIN ve
 * todas las de su organización, VENDEDOR solo las suyas; sin filtro extra
 * aquí (casos de prueba 21/22).
 */
export default async function CotizacionesPage({
  searchParams,
}: {
  searchParams: { q?: string; vendedor?: string; estado?: string };
}) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const { data: salespeopleData } = await supabase.from("salespeople").select("*").order("name");
  const salespeople = (salespeopleData ?? []) as Salesperson[];

  let query = supabase.from("quotes").select("*").order("created_at", { ascending: false });

  if (searchParams.vendedor) query = query.eq("salesperson_id", searchParams.vendedor);
  if (searchParams.estado) query = query.eq("status", searchParams.estado);
  if (searchParams.q) {
    const q = searchParams.q.trim();
    query = query.or(`folio.ilike.%${q}%,customer_name.ilike.%${q}%,salesperson_name.ilike.%${q}%`);
  }

  const { data } = await query.limit(200);
  const quotes = (data ?? []) as Quote[];

  const isAdmin = profile?.role === "admin";
  let quoteIdsWithOrder = new Set<string>();
  if (isAdmin) {
    const { data: ordersData } = await supabase
      .from("orders")
      .select("source_quote_id")
      .not("source_quote_id", "is", null);
    quoteIdsWithOrder = new Set((ordersData ?? []).map((o) => o.source_quote_id as string));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Cotizaciones"
        description="Cotizaciones de Comercial."
        actions={
          <Link href="/cotizaciones/nueva">
            <Button>
              <Plus className="h-4 w-4" />
              Nueva cotización
            </Button>
          </Link>
        }
      />

      <QuoteFilters salespeople={salespeople} showSalespersonFilter={profile?.role === "admin"} />

      {quotes.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No hay cotizaciones que coincidan"
            description="Ajusta la búsqueda o los filtros, o crea una nueva cotización."
            action={
              <Link href="/cotizaciones/nueva">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nueva cotización
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {quotes.map((quote) => (
              <Card key={quote.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/cotizaciones/${quote.id}`} className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-accent">{quote.folio}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">{quote.customer_name}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isQuoteExpired(quote) && <Badge variant="warning">Vencida</Badge>}
                    <StatusBadge status={quote.status} labels={QUOTE_STATUS_LABELS} variants={QUOTE_STATUS_BADGE} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {quote.salesperson_name} · {formatDateShort(quote.quote_date)}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{formatMoneyByCurrency(quote.total, quote.currency)}</p>
                <div className="mt-3 flex items-center gap-3 border-t border-border pt-2 text-sm">
                  <Link href={`/cotizaciones/${quote.id}`} className="text-ink-soft hover:text-accent">
                    Ver
                  </Link>
                  {quote.status === "borrador" && (
                    <Link href={`/cotizaciones/${quote.id}/editar`} className="text-ink-soft hover:text-accent">
                      Editar
                    </Link>
                  )}
                  {isAdmin && !quoteIdsWithOrder.has(quote.id) && (
                    <DeleteQuoteButton
                      quoteId={quote.id}
                      folio={quote.folio}
                      customerName={quote.customer_name}
                      className="text-ink-soft hover:text-danger"
                    />
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Fecha</Th>
                  <Th>Vendedor</Th>
                  <Th>Cliente</Th>
                  <Th>Business Unit</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {quotes.map((quote) => (
                  <Tr key={quote.id}>
                    <Td>
                      <Link
                        href={`/cotizaciones/${quote.id}`}
                        className="font-mono text-sm font-medium text-accent hover:underline"
                      >
                        {quote.folio}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{formatDateShort(quote.quote_date)}</Td>
                    <Td className="text-ink-soft">{quote.salesperson_name}</Td>
                    <Td>{quote.customer_name}</Td>
                    <Td className="text-ink-soft">{quote.business_unit_name}</Td>
                    <Td className="text-ink-soft">{formatMoneyByCurrency(quote.total, quote.currency)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {isQuoteExpired(quote) && <Badge variant="warning">Vencida</Badge>}
                        <StatusBadge status={quote.status} labels={QUOTE_STATUS_LABELS} variants={QUOTE_STATUS_BADGE} />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3 text-sm">
                        <Link href={`/cotizaciones/${quote.id}`} className="text-ink-soft hover:text-accent">
                          Ver
                        </Link>
                        {quote.status === "borrador" && (
                          <Link href={`/cotizaciones/${quote.id}/editar`} className="text-ink-soft hover:text-accent">
                            Editar
                          </Link>
                        )}
                        {isAdmin && !quoteIdsWithOrder.has(quote.id) && (
                          <DeleteQuoteButton
                            quoteId={quote.id}
                            folio={quote.folio}
                            customerName={quote.customer_name}
                            className="text-ink-soft hover:text-danger"
                          />
                        )}
                      </div>
                    </Td>
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
