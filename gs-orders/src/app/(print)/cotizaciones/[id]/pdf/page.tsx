import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { QUOTE_STATUS_LABELS } from "@/types/domain";
import type { Quote, QuoteItem } from "@/types/domain";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

/**
 * PDF de una Quote — THÖREN Quotes Q6, mismo patrón que
 * (print)/pedidos/[id]/pdf: página HTML optimizada para impresión
 * (window.print() → "Guardar como PDF" del navegador), sin librería de PDF
 * nueva. Usa ÚNICAMENTE los snapshots ya persistidos en `quotes`/
 * `quote_items` (0020_core_quotes.sql) — nunca vuelve a leer
 * customers/product_catalog/business_units/salespeople actuales, así que
 * el PDF de una Quote antigua siempre refleja lo que existía al momento de
 * crearla, aunque esas entidades se hayan editado o eliminado después.
 *
 * organization.name es la única excepción: no está snapshoteado en
 * `quotes` (Q3 no lo consideró necesario) y se resuelve aquí con un select
 * adicional, bajo RLS (organizations_select_member) — es solo el nombre de
 * la organización dueña de la Quote, no cambia con el tiempo en la
 * práctica.
 *
 * `notes` (nota interna, ver Q5) NO se imprime aquí a propósito: Q5
 * documentó explícitamente que ese campo es "visible solo para tu equipo,
 * no forma parte del contenido comercial de la cotización" — imprimirlo en
 * un documento que llega al cliente contradiría esa decisión y podría
 * filtrar información interna. Si se necesita un campo de notas que sí
 * aparezca en el PDF, es un campo nuevo (fuera de alcance de Q6).
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

  return (
    <div className="min-h-screen bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex justify-center">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-8 shadow-card print:rounded-none print:border-0 print:shadow-none print:p-0">
        <header className="mb-8 flex items-start justify-between border-b border-border pb-5">
          <div>
            <p className="text-lg font-bold uppercase tracking-widest text-accent">THÖREN</p>
            {organizationName && <p className="text-sm text-ink-soft">{organizationName}</p>}
            <p className="text-xs uppercase tracking-wide text-ink-faint">{quote.business_unit_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-faint">Cotización</p>
            <p className="font-mono text-base font-semibold text-ink">{quote.folio}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-ink-faint">{QUOTE_STATUS_LABELS[quote.status]}</p>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-faint">Fecha</p>
            <p className="text-ink">{formatDateShort(quote.quote_date)}</p>
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
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2">Modelo</th>
              <th className="py-2 text-right">Cantidad</th>
              <th className="py-2 text-right">Precio unitario</th>
              <th className="py-2 text-right">Descuento</th>
              <th className="py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="py-2">
                  <p className="font-medium text-ink">{item.model}</p>
                  {item.description && <p className="text-xs text-ink-faint">{item.description}</p>}
                </td>
                <td className="py-2 text-right text-ink-soft">{item.quantity}</td>
                <td className="py-2 text-right text-ink-soft">{formatMoneyByCurrency(item.unit_price, quote.currency)}</td>
                <td className="py-2 text-right text-ink-soft">{item.line_discount_percent}%</td>
                <td className="py-2 text-right text-ink-soft">{formatMoneyByCurrency(item.line_subtotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-faint">Subtotal</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Descuento</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.discount_total, quote.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">IVA ({quote.tax_rate}%)</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.tax_total, quote.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-ink">{formatMoneyByCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-ink-faint">
          Cotización generada por THÖREN — {quote.folio}
        </footer>
      </div>
    </div>
  );
}
