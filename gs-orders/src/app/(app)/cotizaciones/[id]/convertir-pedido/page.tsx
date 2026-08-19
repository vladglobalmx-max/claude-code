import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils/format";
import type { ProductTypeItem, Quote } from "@/types/domain";
import { ConvertQuoteForm } from "./convert-quote-form";

export const dynamic = "force-dynamic";

/**
 * THÖREN Quote → Order V2 (0023_quote_to_order.sql). Pantalla intermedia:
 * la app SOLO pide aquí el único dato operativo que la Quote no trae
 * (product_type) — organization_id/customer_id/business_unit_id/
 * salesperson_id/client_name/items los resuelve rpc_create_order_from_quote
 * server-side a partir de la Quote. No se piden datos de GOBO/Proyector
 * aquí: el Order nace en "borrador" y esos campos se completan después en
 * Editar Pedido, igual que cualquier Order manual en borrador.
 *
 * Si la Quote no está en "aceptada", o ya fue convertida (existe un Order
 * con source_quote_id = quote.id), no tiene sentido mostrar este formulario
 * — se redirige de vuelta al detalle de la Quote, que ya refleja el estado
 * correcto (botón "Convertir a Pedido" vs. "Ver Pedido <folio>").
 */
export default async function ConvertirPedidoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();

  const [{ data: quoteData }, { data: existingOrder }, { data: productTypesData }] = await Promise.all([
    supabase.from("quotes").select("*").eq("id", params.id).single(),
    supabase.from("orders").select("id").eq("source_quote_id", params.id).maybeSingle(),
    supabase.from("product_types").select("*").eq("active", true).order("name", { ascending: true }),
  ]);

  if (!quoteData) notFound();
  const quote = quoteData as Quote;

  if (existingOrder) redirect(`/pedidos/${existingOrder.id}`);
  if (quote.status !== "aceptada") redirect(`/cotizaciones/${quote.id}`);

  const productTypes = (productTypesData ?? []) as ProductTypeItem[];

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/cotizaciones/${quote.id}`}
          className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {quote.folio}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convertir a pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Cliente</p>
              <p className="text-ink">{quote.customer_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Vendedor</p>
              <p className="text-ink">{quote.salesperson_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Business Unit</p>
              <p className="text-ink">{quote.business_unit_name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-faint">Fecha de cotización</p>
              <p className="text-ink">{formatDateShort(quote.quote_date)}</p>
            </div>
          </div>

          <p className="text-sm text-ink-faint">
            El pedido se creará como borrador con folio nuevo. Precios, descuentos e IVA no se copian — Orders no
            maneja montos. Los datos de proyector/GOBO se capturan después, en Editar Pedido.
          </p>

          <ConvertQuoteForm quoteId={quote.id} productTypes={productTypes} />
        </CardContent>
      </Card>
    </div>
  );
}
