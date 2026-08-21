import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSignedUrl } from "@/lib/storage";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { buildQuotePdfFilename } from "@/lib/utils/filename";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_BADGE, QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Quote, QuoteItem } from "@/types/domain";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * document.title de esta página — el navegador lo usa como nombre
 * sugerido al "Guardar como PDF" (window.print()). Antes siempre mostraba
 * "THÖREN" (metadata.title global del layout raíz); aquí se sobreescribe
 * por Quote con "{FOLIO} - {CLIENTE}". Solo cambia el título del
 * documento — el contenido/cálculos del PDF (OrderDetailContent-equivalente
 * de abajo) no se tocan.
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("quotes").select("folio, customer_name").eq("id", params.id).single();
  if (!data) return {};
  return { title: buildQuotePdfFilename(data.folio, data.customer_name) };
}

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

/**
 * PDF de una Quote — THÖREN Quotes Q6, rediseñado en "THÖREN — REDISEÑO
 * PREMIUM DE QUOTE PDF" (referencia conceptual CotizIA, sin copiar pixel
 * por pixel). Mismo patrón que (print)/pedidos/[id]/pdf: página HTML
 * optimizada para impresión (window.print() → "Guardar como PDF" del
 * navegador), sin librería de PDF nueva. Usa ÚNICAMENTE los snapshots ya
 * persistidos en `quotes`/`quote_items` (0020_core_quotes.sql) para todo
 * el contenido COMERCIAL/LEGAL (folio, cliente, razón social, RFC,
 * vendedor, items, totales) — nunca vuelve a leer customers/
 * product_catalog/business_units/salespeople actuales para esos campos,
 * así que el PDF de una Quote antigua siempre refleja lo que existía al
 * momento de crearla.
 *
 * Dos excepciones deliberadas, ambas de IDENTIDAD VISUAL — no
 * comercial/legal — resueltas en vivo en cada render, mismo criterio ya
 * usado para organizationName desde Q6 original:
 *   - organizationName: nombre de la organización dueña de la Quote.
 *   - signedLogoUrl: logo de la Business Unit (0024_business_unit_branding.sql
 *     → THÖREN Business Unit Branding → Quote PDF). Si la BU cambia su
 *     logo, un PDF impreso después debe reflejar el logo actual.
 * Todas las lecturas están sujetas a RLS — si algo no es visible o no
 * existe, la variable correspondiente queda null/"" y esa línea
 * simplemente no se imprime. El PDF nunca se rompe por falta de logo.
 *
 * Contacto/email/teléfono del cliente NO se consultan aquí — decisión
 * explícita de "THÖREN — Quote PDF Premium AJUSTE FINAL ANTES DE COMMIT":
 * una Quote es un documento comercial histórico, y esos datos NO están
 * snapshoteados en `quotes` (a diferencia de customer_name/
 * customer_legal_name/customer_tax_id, que sí lo están desde 0020). Un
 * lookup en vivo a customer_contacts/customers haría que reimprimir una
 * Quote antigua mostrara datos de contacto actuales, inconsistente con el
 * resto del snapshot. Ver "Quote Customer Contact Snapshot" más abajo.
 *
 * `notes` (nota interna, ver Q5) sigue sin imprimirse a propósito: Q5
 * documentó explícitamente que ese campo es "visible solo para tu equipo,
 * no forma parte del contenido comercial de la cotización". Desde
 * "THÖREN — Quote Commercial Terms" (0025_quote_commercial_terms.sql) SÍ
 * existe un campo distinto para observaciones dirigidas al cliente
 * (`customer_notes`, junto con `payment_terms`/`delivery_time`) — son las
 * únicas notas que esta página imprime; `notes` sigue sin tocarse.
 *
 * "Detalle de la cotización" (Número/Fecha/Vigencia/Moneda/Estado) se
 * eliminó en esta fase: duplicaba exactamente el header/badge de estado y
 * la barra de metadatos de arriba. "Información del cliente" pasó a ocupar
 * el ancho completo del documento en su lugar.
 *
 * Header con logo — decisión explícita de "THÖREN — Quote Commercial
 * Terms + Ajuste Final Quote PDF Premium": cuando existe signedLogoUrl, el
 * header muestra ÚNICAMENTE el logo, sin business_unit_name ni
 * organizationName debajo — el documento debe leerse como "generado POR
 * la Business Unit usando THÖREN", no como "de THÖREN con un logo
 * pegado". Ambos nombres NO desaparecen del documento: siguen en el
 * footer (trazabilidad textual). El fallback SIN logo conserva el bloque
 * de texto completo (THÖREN/organizationName/business_unit_name) — sigue
 * siendo el único caso donde el header necesita texto para identificar al
 * emisor, y usa datos reales, nunca nombres de Business Unit hardcodeados.
 *
 * Campos deliberadamente NO agregados en este rediseño (discovery A/B/C
 * del Quote PDF Premium, sin cambios en esta fase): RFC/dirección/
 * teléfono/web del EMISOR, unidad por línea, IVA por línea (el modelo
 * aplica IVA sobre subtotal − descuento global de TODA la Quote, nunca
 * por línea — ver lib/quote-totals.ts) — ninguno existe en
 * `quotes`/`quote_items`/`business_units`/`organizations` hoy. Forma de
 * pago y tiempo de entrega YA NO están en esta lista: 0025 los agregó
 * como campos reales, snapshot, opcionales.
 *
 * MEJORA FUTURA — "Quote Customer Contact Snapshot": para poder imprimir
 * contacto/email/teléfono del cliente de forma histórica y consistente
 * (igual que customer_name/customer_legal_name/customer_tax_id), habría
 * que agregar en una fase futura columnas snapshot a `quotes`
 * (customer_contact_name, customer_email, customer_phone) pobladas al
 * momento de crear la Quote — requiere su propia migración, fuera de
 * alcance de esta fase.
 */
export default async function CotizacionPdfPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: quoteData }, { data: itemsData }] = await Promise.all([
    supabase.from("quotes").select("*, organizations(name)").eq("id", params.id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", params.id).order("position"),
  ]);

  if (!quoteData) notFound();

  const { organizations, ...quote } = quoteData as unknown as Quote & {
    organizations: { name: string } | OneOrMany<{ name: string }> | null;
  };
  const organizationName = one(organizations)?.name ?? "";
  const items = (itemsData ?? []) as QuoteItem[];

  const { data: businessUnit } = await supabase
    .from("business_units")
    .select("logo_path")
    .eq("id", quote.business_unit_id)
    .maybeSingle();
  const signedLogoUrl = businessUnit?.logo_path ? await getSignedUrl("business-unit-assets", businessUnit.logo_path) : null;
  const generatedOn = formatDateShort(new Date().toISOString());

  return (
    <div className="min-h-screen bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex justify-center">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-8 shadow-card print:rounded-none print:border-0 print:shadow-none print:p-0">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-border pb-6 break-inside-avoid">
          <div className="min-w-0">
            {signedLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signedLogoUrl}
                alt={quote.business_unit_name}
                className="max-h-16 max-w-[200px] object-contain object-left"
              />
            ) : (
              <>
                <p className="text-lg font-bold uppercase tracking-widest text-accent">THÖREN</p>
                {organizationName && <p className="text-sm text-ink-soft">{organizationName}</p>}
                <p className="text-xs uppercase tracking-wide text-ink-faint">{quote.business_unit_name}</p>
              </>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Cotización</p>
            <p className="font-mono text-2xl font-bold text-ink">{quote.folio}</p>
            <Badge variant={QUOTE_STATUS_BADGE[quote.status]} className="mt-1.5">
              {QUOTE_STATUS_LABELS[quote.status]}
            </Badge>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-surface-2/60 px-4 py-3 text-sm sm:grid-cols-4 break-inside-avoid">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Fecha</p>
            <p className="font-medium text-ink">{formatDateShort(quote.quote_date)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Vigencia</p>
            <p className="font-medium text-ink">{formatDateShort(quote.valid_until)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Moneda</p>
            <p className="font-medium text-ink">{quote.currency}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">Vendedor</p>
            <p className="font-medium text-ink">{quote.salesperson_name}</p>
          </div>
        </div>

        <div className="mb-6 break-inside-avoid">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Información del cliente</p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg border border-border px-4 py-3 text-sm sm:grid-cols-3">
            <p className="font-medium text-ink">{quote.customer_name}</p>
            {quote.customer_legal_name && <p className="text-ink-soft">{quote.customer_legal_name}</p>}
            {quote.customer_tax_id && <p className="font-mono text-xs text-ink-faint">RFC {quote.customer_tax_id}</p>}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="py-2">Descripción</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">Precio U.</th>
              <th className="py-2 text-right">Descuento</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border break-inside-avoid">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-ink">{item.description || item.model}</p>
                  {item.description && <p className="mt-0.5 text-xs text-ink-faint">{item.model}</p>}
                </td>
                <td className="py-2.5 text-right text-ink-soft">{item.quantity}</td>
                <td className="py-2.5 text-right text-ink-soft">{formatMoneyByCurrency(item.unit_price, quote.currency)}</td>
                <td className="py-2.5 text-right text-ink-soft">
                  {item.line_discount_percent > 0 ? `${item.line_discount_percent}%` : "—"}
                </td>
                <td className="py-2.5 text-right font-medium text-ink">
                  {formatMoneyByCurrency(item.line_subtotal, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 break-inside-avoid">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Condiciones comerciales</p>
          <dl className="space-y-1.5 rounded-lg border border-border px-4 py-3 text-sm">
            {quote.payment_terms && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Forma de pago</dt>
                <dd className="text-right text-ink">{quote.payment_terms}</dd>
              </div>
            )}
            {quote.delivery_time && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Tiempo de entrega</dt>
                <dd className="text-right text-ink">{quote.delivery_time}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-faint">Vigencia</dt>
              <dd className="text-right font-medium text-ink">{formatDateShort(quote.valid_until)}</dd>
            </div>
          </dl>
        </div>

        {quote.customer_notes && (
          <div className="mt-6 break-inside-avoid">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Observaciones</p>
            <p className="whitespace-pre-wrap rounded-lg border border-border px-4 py-3 text-sm text-ink-soft">
              {quote.customer_notes}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end break-inside-avoid">
          <div className="w-full max-w-xs rounded-lg border border-border bg-surface-2/50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Subtotal</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-ink-faint">Descuento</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.discount_total, quote.currency)}</span>
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-ink-faint">IVA ({quote.tax_rate}%)</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.tax_total, quote.currency)}</span>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2.5">
              <span className="text-base font-bold text-ink">Total</span>
              <span className="text-xl font-bold text-accent">{formatMoneyByCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-xs text-ink-faint break-inside-avoid">
          <div className="flex items-center justify-between">
            <span>
              {quote.business_unit_name}
              {organizationName ? ` · ${organizationName}` : ""}
            </span>
            <span>Cotización {quote.folio}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Generado el {generatedOn}</span>
            <span>Generado por THÖREN</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
