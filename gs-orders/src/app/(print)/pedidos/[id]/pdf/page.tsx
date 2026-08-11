import { getOrderDetail } from "@/components/orders/get-order-detail";
import { OrderDetailContent } from "@/components/orders/order-detail-content";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PedidoPdfPage({ params }: { params: { id: string } }) {
  const detail = await getOrderDetail(params.id);

  return (
    <div className="min-h-screen bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="no-print sticky top-0 z-10 mb-6 flex justify-center">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-8 shadow-card print:rounded-none print:border-0 print:shadow-none print:p-0">
        <header className="mb-8 border-b border-border pb-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink">Global Supplier MTY</p>
          <p className="text-xs uppercase tracking-wide text-ink-faint">
            Thunder Safety Solutions / Thunder LED Lights
          </p>
          <p className="mt-2 text-lg font-bold uppercase tracking-widest text-accent">Orden de Pedido</p>
        </header>

        <OrderDetailContent detail={detail} variant="print" />

        <footer className="mt-10 flex items-center justify-between border-t border-border pt-4 text-sm">
          <span className="text-ink-soft">
            Vendedor: <span className="font-medium text-ink">{detail.salesperson.name}</span>
          </span>
          <span className="font-mono font-semibold text-ink">Folio: {detail.order.folio}</span>
        </footer>
      </div>
    </div>
  );
}
