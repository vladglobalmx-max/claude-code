import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrderDetail } from "@/components/orders/get-order-detail";
import { OrderDetailContent } from "@/components/orders/order-detail-content";
import { DuplicateButton } from "../duplicate-button";
import { OrderStatusQuickActions } from "./status-quick-actions";

export const dynamic = "force-dynamic";

/**
 * "Origen: Cotización" (THÖREN Quote → Order V2, 0023) se resuelve aquí con
 * un fetch adicional: source_quote_id ya viene incluido en detail.order
 * (columna real de orders, select("*")); solo falta el folio de la Quote,
 * que se resuelve con un segundo query bajo RLS. El PDF ((print)/pedidos/
 * [id]/pdf) desde Fase 6G ya no comparte OrderDetailContent con esta
 * página — tiene su propia resolución de sourceQuoteFolio, así que este
 * fetch es exclusivo de la vista en pantalla.
 */
export default async function VerPedidoPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);

  let sourceQuoteFolio: string | null = null;
  if (detail.order.source_quote_id) {
    const supabase = createSupabaseServerClient();
    const { data: sourceQuote } = await supabase
      .from("quotes")
      .select("folio")
      .eq("id", detail.order.source_quote_id)
      .maybeSingle();
    sourceQuoteFolio = sourceQuote?.folio ?? null;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/pedidos" className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          Pedidos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusQuickActions order={detail.order} />
          <DuplicateButton
            orderId={detail.order.id}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          />
          <Link href={`/pedidos/${detail.order.id}/editar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Link>
          <Link href={`/pedidos/${detail.order.id}/pdf`} target="_blank" className={cn(buttonVariants({ size: "sm" }))}>
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Link>
        </div>
      </div>

      {detail.order.source_quote_id && (
        <p className="no-print mb-4 text-sm text-ink-faint">
          Origen: Cotización{" "}
          {sourceQuoteFolio ? (
            <Link href={`/cotizaciones/${detail.order.source_quote_id}`} className="font-mono text-accent hover:underline">
              {sourceQuoteFolio}
            </Link>
          ) : (
            "—"
          )}
        </p>
      )}

      <Card>
        <CardContent className="p-6">
          <OrderDetailContent detail={detail} />
        </CardContent>
      </Card>
    </div>
  );
}
