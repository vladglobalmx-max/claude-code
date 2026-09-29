import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { RichTextView } from "@/components/ui/rich-text-view";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import type { Quote, QuoteItem, QuoteVersion } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * THÖREN 0085 — vista de solo lectura de una versión superada de una
 * Quote (archivada por rpc_create_quote_revision antes de reemplazarla).
 * Lee `quote_versions.snapshot` — nunca `quotes`/`quote_items` en vivo —
 * así que reconstruye fielmente el contenido comercial tal como estaba en
 * el momento en que esa versión fue reemplazada, sin importar cambios
 * posteriores. RLS de `quote_versions` (mismo scoping que la Quote padre)
 * ya decide si el usuario puede verla; sin guard adicional aquí.
 *
 * Sin acciones (editar/duplicar/cambiar status/PDF): una versión histórica
 * nunca es editable ni tiene PDF propio (ver DECISIÓN 0085 — snapshot
 * jsonb es suficiente, sin binario por versión). Tampoco resuelve
 * imágenes de catálogo en vivo — mostrar la imagen ACTUAL de un producto
 * sería inconsistente con "fielmente esa versión" si el catálogo cambió
 * desde entonces.
 *
 * THÖREN 0086 — customer_requirements dentro del snapshot puede ser HTML
 * (versiones creadas después de 0086) o texto plano (versiones archivadas
 * antes) — RichTextView renderiza ambos correctamente. Se muestra siempre,
 * sin importar `customer_requirements_visible_in_pdf`: esta vista es un
 * registro administrativo interno, no una réplica del PDF que vio el
 * cliente (mismo criterio que el detalle vigente de la Quote).
 */
export default async function QuoteVersionPage({ params }: { params: { id: string; version: string } }) {
  const versionNumber = Number(params.version);
  if (!Number.isInteger(versionNumber)) notFound();

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", params.id)
    .eq("version", versionNumber)
    .maybeSingle();

  if (!data) notFound();
  const quoteVersion = data as unknown as QuoteVersion;
  const quote = quoteVersion.snapshot.quote as Quote;
  const items = (quoteVersion.snapshot.items ?? []) as QuoteItem[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/cotizaciones/${params.id}`}
          className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la cotización vigente
        </Link>
        <Badge variant="neutral">
          <History className="h-3 w-3" />
          Versión histórica · solo lectura
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-mono text-base">{quote.folio}</CardTitle>
            <p className="mt-1 text-sm text-ink-faint">{quote.customer_name}</p>
          </div>
          <Badge variant="neutral">Versión {quoteVersion.version} — Reemplazada</Badge>
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
              <p className="text-xs uppercase tracking-wide text-ink-faint">Vigencia</p>
              <p className="text-ink">{formatDateShort(quote.valid_until)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Moneda</p>
              <p className="text-ink">{quote.currency}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Reemplazada el</p>
              <p className="text-ink">{formatDateShort(quoteVersion.created_at)}</p>
            </div>
            {quoteVersion.created_by_name && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-faint">Editada por</p>
                <p className="text-ink">{quoteVersion.created_by_name}</p>
              </div>
            )}
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
                    <div className="mt-1 text-xs text-ink-faint">
                      <span className="font-medium">Requisitos del cliente:</span>
                      <RichTextView html={item.customer_requirements} />
                    </div>
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
                          <div className="mt-0.5 text-xs text-ink-faint">
                            <span className="font-medium">Requisitos del cliente:</span>
                            <RichTextView html={item.customer_requirements} />
                          </div>
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
