import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canWriteRecord } from "@/lib/auth/ownership";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { isQuoteExpired } from "@/lib/quote-expiry";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Quote, QuoteItem } from "@/types/domain";
import { QuoteStatusActions } from "./quote-status-actions";
import { DuplicateQuoteButton } from "./duplicate-quote-button";
import { QuoteNotesEditor } from "./quote-notes-editor";
import { DeleteQuoteButton } from "../delete-quote-button";

export const dynamic = "force-dynamic";

export default async function VerCotizacionPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const [{ data: quoteData }, { data: itemsData }, { data: linkedOrder }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", params.id).order("position"),
    supabase.from("orders").select("id, folio").eq("source_quote_id", params.id).maybeSingle(),
  ]);

  if (!quoteData) notFound();
  const quote = quoteData as Quote;
  const items = (itemsData ?? []) as QuoteItem[];
  const expired = isQuoteExpired(quote);
  const isAdmin = profile?.role === "admin";
  // VIEW != WRITE (THÖREN 6R.1B-1 UX fix): can_view_all_sales (0041) amplió
  // qué cotizaciones puede VER un vendedor, pero canWriteRecord nunca
  // conoce esa capacidad — ver src/lib/auth/ownership.ts. RLS sigue siendo
  // la autoridad final; esto solo evita ofrecer en la UI un control que el
  // backend rechazaría en silencio.
  const canWrite = canWriteRecord(profile, quote.salesperson_id);
  const isHistorical = quote.source === "cotizia";
  const historicalPdfUrl = quote.historical_pdf_path
    ? await getSignedUrl("quote-archive", quote.historical_pdf_path)
    : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/cotizaciones" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Cotizaciones
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && <QuoteStatusActions quote={quote} />}
          <DuplicateQuoteButton quoteId={quote.id} />
          {linkedOrder ? (
            <Link
              href={`/pedidos/${linkedOrder.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Ver pedido {linkedOrder.folio}
            </Link>
          ) : (
            !isHistorical &&
            quote.status === "aceptada" && (
              <Link
                href={`/cotizaciones/${quote.id}/convertir-pedido`}
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              >
                Convertir a pedido
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )
          )}
          <Link
            href={`/cotizaciones/${quote.id}/pdf`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-3.5 w-3.5" />
            Descargar PDF
          </Link>
          {historicalPdfUrl && (
            <a
              href={historicalPdfUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileText className="h-3.5 w-3.5" />
              Ver PDF original de CotizIA
            </a>
          )}
          {quote.status === "borrador" && canWrite && (
            <Link
              href={`/cotizaciones/${quote.id}/editar`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          )}
          {isAdmin && !linkedOrder && (
            <DeleteQuoteButton
              quoteId={quote.id}
              folio={quote.folio}
              customerName={quote.customer_name}
              redirectAfterDelete
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hover:border-danger hover:text-danger")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </DeleteQuoteButton>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-mono text-base">{quote.folio}</CardTitle>
            <p className="mt-1 text-sm text-ink-faint">{quote.customer_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {isHistorical && <Badge variant="neutral">Histórica · CotizIA</Badge>}
            {expired && <Badge variant="warning">Vencida</Badge>}
            <StatusBadge status={quote.status} labels={QUOTE_STATUS_LABELS} variants={QUOTE_STATUS_BADGE} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Cliente</p>
              <p className="text-ink">{quote.customer_name}</p>
            </div>
            {quote.customer_legal_name && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Razón social</p>
                <p className="text-ink">{quote.customer_legal_name}</p>
              </div>
            )}
            {quote.customer_tax_id && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">RFC</p>
                <p className="font-mono text-ink">{quote.customer_tax_id}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Vendedor</p>
              <p className="text-ink">{quote.salesperson_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Business Unit</p>
              <p className="text-ink">{quote.business_unit_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Fecha</p>
              <p className="text-ink">{formatDateShort(quote.quote_date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Vigencia</p>
              <p className={expired ? "text-warning" : "text-ink"}>{formatDateShort(quote.valid_until)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Moneda</p>
              <p className="text-ink">{quote.currency}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">IVA</p>
              <p className="text-ink">{quote.tax_rate}%</p>
            </div>
          </div>

          {(quote.payment_terms || quote.delivery_time || quote.warranty || quote.customer_notes) && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Condiciones comerciales</p>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                {quote.payment_terms && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Forma de pago</p>
                    <p className="text-ink">{quote.payment_terms}</p>
                  </div>
                )}
                {quote.delivery_time && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Tiempo de entrega</p>
                    <p className="text-ink">{quote.delivery_time}</p>
                  </div>
                )}
                {quote.warranty && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-faint">Garantía</p>
                    <p className="text-ink">{quote.warranty}</p>
                  </div>
                )}
              </div>
              {quote.customer_notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Observaciones para el cliente</p>
                  <p className="whitespace-pre-wrap text-sm text-ink">{quote.customer_notes}</p>
                </div>
              )}
            </div>
          )}

          <QuoteNotesEditor quoteId={quote.id} initialNotes={quote.notes ?? ""} canWrite={canWrite} />

          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Productos</p>

            <div className="space-y-2 sm:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-ink">{item.model}</p>
                  {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                  <p className="mt-1 text-xs text-ink-faint">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""} × {formatMoneyByCurrency(item.unit_price, quote.currency)}
                    {item.line_discount_percent > 0 ? ` · -${item.line_discount_percent}%` : ""}
                  </p>
                  {item.customer_requirements && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-ink-faint">
                      Requisitos del cliente: {item.customer_requirements}
                    </p>
                  )}
                  <p className="mt-1 text-right text-sm font-medium text-ink">
                    {formatMoneyByCurrency(item.line_subtotal, quote.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Modelo</Th>
                    <Th>Cantidad</Th>
                    <Th>Precio unitario</Th>
                    <Th>Descuento</Th>
                    <Th>Subtotal</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {items.map((item) => (
                    <Tr key={item.id}>
                      <Td>
                        <p className="font-medium text-ink">{item.model}</p>
                        {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                        {item.customer_requirements && (
                          <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-faint">
                            Requisitos del cliente: {item.customer_requirements}
                          </p>
                        )}
                      </Td>
                      <Td className="text-ink-soft">
                        {item.quantity}
                        {item.unit ? ` ${item.unit}` : ""}
                      </Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(item.unit_price, quote.currency)}</Td>
                      <Td className="text-ink-soft">{item.line_discount_percent}%</Td>
                      <Td className="text-ink-soft">{formatMoneyByCurrency(item.line_subtotal, quote.currency)}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Subtotal</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Descuento</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.discount_total, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">IVA</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.tax_total, quote.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
