import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageSalesOrderFinance } from "@/lib/auth/logistics";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import type { SalesOrder } from "@/types/domain";
import { InvoiceCreateForm } from "@/components/invoices/invoice-create-form";
import { createInvoice } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Requiere ?sales_order_id=<uuid> — el único punto de entrada es el botón
 * "Crear factura" en el detalle de una Sales Order (ver
 * ordenes-venta/[id]/page.tsx). A diferencia de Recepciones/Surtidos, NO
 * hay selección de líneas: rpc_create_invoice snapshotea SIEMPRE TODAS las
 * líneas de la Sales Order (MVP: una factura = la Sales Order completa) —
 * esta página solo captura la fecha de vencimiento y notas opcionales. La
 * elegibilidad REAL (SO no draft/cancelled, a lo sumo una factura activa)
 * la impone trg_check_invoice_eligible + el índice único parcial en DB —
 * esta página solo evita mostrar un formulario que fallaría al guardar.
 */
export default async function NuevaFacturaPage({ searchParams }: { searchParams: { sales_order_id?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageSalesOrderFinance(profile, capabilities);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva factura" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad financiera"
            description="Solo un administrador o un usuario con autoridad financiera puede crear facturas."
          />
        </Card>
      </div>
    );
  }

  const salesOrderId = searchParams.sales_order_id;
  if (!salesOrderId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva factura" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Falta la Sales Order de origen" description="Crea una factura desde el detalle de una Sales Order." />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: soData } = await supabase.from("sales_orders").select("*").eq("id", salesOrderId).maybeSingle();

  if (!soData) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva factura" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Sales Order no encontrada" description="No se encontró o no es visible para tu usuario." />
        </Card>
      </div>
    );
  }

  const salesOrder = soData as SalesOrder;

  if (salesOrder.status === "draft" || salesOrder.status === "cancelled") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva factura" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Sales Order no puede facturarse"
            description="Solo una Sales Order confirmada (no draft ni cancelada) puede generar una factura."
            action={
              <Link href={`/ordenes-venta/${salesOrder.id}`} className="text-sm text-accent hover:underline">
                Volver a la Sales Order
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("sales_order_id", salesOrder.id)
    .neq("status", "cancelled")
    .maybeSingle();

  if (existingInvoice) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva factura" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Sales Order ya tiene una factura activa"
            description={`Cancela la factura ${existingInvoice.invoice_number} antes de crear una nueva (a lo sumo una factura activa por Sales Order).`}
            action={
              <Link href={`/facturas/${existingInvoice.id}`} className="text-sm text-accent hover:underline">
                Ver factura {existingInvoice.invoice_number}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader title="Nueva factura" description={`Sales Order ${salesOrder.order_number} · Total ${formatMoneyByCurrency(salesOrder.total, salesOrder.currency)}`} />
      <InvoiceCreateForm salesOrderId={salesOrder.id} onSubmit={createInvoice} />
    </div>
  );
}
