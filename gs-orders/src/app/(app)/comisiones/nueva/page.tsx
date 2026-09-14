import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageCommissions } from "@/lib/auth/logistics";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoneyByCurrency } from "@/lib/utils/format";
import type { SalesOrder } from "@/types/domain";
import { CommissionCreateForm } from "@/components/commissions/commission-create-form";
import { createCommissionRecord } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Requiere ?sales_order_id=<uuid> — punto de entrada esperado: el detalle
 * de una Sales Order confirmada. La elegibilidad REAL (SO no draft/
 * cancelled, vendedor de la misma organización, a lo sumo una comisión
 * activa por par SO/vendedor) la valida rpc_create_commission_record
 * mismo + el índice único parcial en DB (0073) al guardar — esta página
 * solo evita mostrar un formulario que fallaría.
 */
export default async function NuevaComisionPage({ searchParams }: { searchParams: { sales_order_id?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageCommissions(profile, capabilities);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva comisión" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="No tienes autoridad de comisiones"
            description="Solo Dirección General o un usuario con autoridad de comisiones puede crear comisiones."
          />
        </Card>
      </div>
    );
  }

  const salesOrderId = searchParams.sales_order_id;
  if (!salesOrderId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva comisión" />
        <Card>
          <EmptyState icon={AlertTriangle} title="Falta la Sales Order de origen" description="Crea una comisión desde el detalle de una Sales Order." />
        </Card>
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: soData } = await supabase.from("sales_orders").select("*").eq("id", salesOrderId).maybeSingle();

  if (!soData) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <PageHeader title="Nueva comisión" />
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
        <PageHeader title="Nueva comisión" />
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Esta Sales Order no puede generar comisión"
            description="Solo una Sales Order confirmada (no draft ni cancelada) puede generar una comisión."
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

  const { data: salespeopleData } = await supabase.from("salespeople").select("id, name").eq("organization_id", salesOrder.organization_id).eq("active", true).order("name");
  const salespeople = salespeopleData ?? [];

  const { data: existingRecords } = await supabase
    .from("commission_records")
    .select("id, salesperson_id")
    .eq("sales_order_id", salesOrder.id)
    .neq("status", "cancelled");
  const salespersonIdsWithActiveCommission = new Set((existingRecords ?? []).map((r) => r.salesperson_id));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <PageHeader
        title="Nueva comisión"
        description={`Sales Order ${salesOrder.order_number} · Subtotal ${formatMoneyByCurrency(salesOrder.subtotal, salesOrder.currency)}`}
      />
      <CommissionCreateForm
        salesOrderId={salesOrder.id}
        defaultSalespersonId={salesOrder.salesperson_id}
        defaultCommissionBase={salesOrder.subtotal}
        salespeople={salespeople}
        salespersonIdsWithActiveCommission={Array.from(salespersonIdsWithActiveCommission)}
        onSubmit={createCommissionRecord}
      />
    </div>
  );
}
