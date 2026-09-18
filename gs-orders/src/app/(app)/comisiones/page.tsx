import Link from "next/link";
import { Percent } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { canManageCommissions, canViewOwnCommissions } from "@/lib/auth/logistics";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { IncludeTestDataToggle } from "@/components/ui/include-test-data-toggle";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { COMMISSION_RECORD_STATUS_BADGE, COMMISSION_RECORD_STATUS_LABELS } from "@/types/domain";
import type { CommissionRecord, CommissionRecordStatus, SalesOrderCurrency } from "@/types/domain";
import { refreshCommissionEligibility } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Listado de Comisiones (THÖREN Comisiones privadas de Dirección MVP,
 * 0073; vista propia de vendedor, 0083). middleware.ts YA bloquea
 * /comisiones a nivel de ruta para cualquiera sin can_manage_commissions
 * NI can_view_own_commissions.
 *
 * DOS ramas completamente separadas: `canManage` conserva EXACTO el
 * comportamiento de 0073 (SELECT directo sobre commission_records, Tasa/
 * Elegible/Pagado, refresh de elegibilidad) — commission_records_select
 * NO tiene rama de dueño-vendedor (ajuste post-review de 0083), así que
 * un vendedor NUNCA podría llegar aquí vía SELECT directo aunque lo
 * intentara. La rama de vendedor (`canManage` false, `canViewOwn` true)
 * consume ÚNICAMENTE rpc_list_own_commissions() (SECURITY DEFINER,
 * 0083) — nunca toca la tabla commission_records directamente, ni ninguna
 * otra tabla: el RPC ya trae folio/cliente resueltos, así que esta rama
 * no hace ninguna query adicional a sales_orders/customers.
 */
export default async function ComisionesPage({ searchParams }: { searchParams: { incluir_pruebas?: string } }) {
  const profile = await getCurrentProfile();
  const capabilities = await getCurrentCapabilities(profile?.userId);
  const canManage = canManageCommissions(profile, capabilities);
  const canViewOwn = !canManage && canViewOwnCommissions(profile, capabilities);
  const includeTest = searchParams.incluir_pruebas === "1";

  const supabase = createSupabaseServerClient();

  if (canManage) {
    await refreshCommissionEligibility();

    const { data } = await supabase.from("commission_records").select("*").order("created_at", { ascending: false }).limit(200);
    let records = (data ?? []) as CommissionRecord[];

    const salesOrderIds = Array.from(new Set(records.map((r) => r.sales_order_id)));
    const { data: soData } = salesOrderIds.length
      ? await supabase.from("sales_orders").select("id, order_number, customer_id, currency, is_test").in("id", salesOrderIds)
      : { data: [] };
    const soById = new Map((soData ?? []).map((so) => [so.id, { ...so, currency: so.currency as SalesOrderCurrency }]));

    // THÖREN 0077 — is_test se hereda de la Sales Order (join, sin columna
    // propia). Filtro en memoria, mismo criterio que el resto de la página.
    if (!includeTest) {
      records = records.filter((r) => !(soById.get(r.sales_order_id)?.is_test ?? false));
    }

    const customerIds = Array.from(new Set((soData ?? []).map((so) => so.customer_id)));
    const { data: customersData } = customerIds.length
      ? await supabase.from("customers").select("id, name").in("id", customerIds)
      : { data: [] };
    const customerNameById = new Map((customersData ?? []).map((c) => [c.id, c.name as string]));

    const salespersonIds = Array.from(new Set(records.map((r) => r.salesperson_id)));
    const { data: spData } = salespersonIds.length
      ? await supabase.from("salespeople").select("id, name").in("id", salespersonIds)
      : { data: [] };
    const salespersonNameById = new Map((spData ?? []).map((sp) => [sp.id, sp.name as string]));

    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <PageHeader
          title="Comisiones"
          description="Comisiones de venta — privado de Dirección General."
          actions={<IncludeTestDataToggle />}
        />

        {records.length === 0 ? (
          <Card>
            <EmptyState
              icon={Percent}
              title="No hay comisiones todavía"
              description="Créalas desde el detalle de una Sales Order confirmada."
            />
          </Card>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {records.map((r) => {
                const so = soById.get(r.sales_order_id);
                return (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/comisiones/${r.id}`} className="min-w-0">
                        <p className="truncate text-sm font-medium text-accent">{salespersonNameById.get(r.salesperson_id) ?? "—"}</p>
                        <p className="mt-0.5 truncate text-sm text-ink-faint">{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</p>
                      </Link>
                      <div className="flex items-center gap-2">
                        <TestOperationBadge isTest={so?.is_test ?? false} />
                        <StatusBadge status={r.status} labels={COMMISSION_RECORD_STATUS_LABELS} variants={COMMISSION_RECORD_STATUS_BADGE} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-ink-faint">{so?.order_number ?? "—"} · {formatDateShort(r.created_at)}</p>
                    <p className="mt-1 text-sm text-ink">
                      {formatMoneyByCurrency(r.paid_amount, so?.currency ?? "MXN")} pagado de {formatMoneyByCurrency(r.commission_amount, so?.currency ?? "MXN")}
                    </p>
                  </Card>
                );
              })}
            </div>

            <Card className="hidden overflow-hidden sm:block">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Vendedor</Th>
                    <Th>Sales Order</Th>
                    <Th>Cliente</Th>
                    <Th>Tasa</Th>
                    <Th>Comisión</Th>
                    <Th>Elegible</Th>
                    <Th>Pagado</Th>
                    <Th>Estado</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {records.map((r) => {
                    const so = soById.get(r.sales_order_id);
                    const currency = so?.currency ?? "MXN";
                    return (
                      <Tr key={r.id}>
                        <Td>
                          <Link href={`/comisiones/${r.id}`} className="text-sm font-medium text-accent hover:underline">
                            {salespersonNameById.get(r.salesperson_id) ?? "—"}
                          </Link>
                        </Td>
                        <Td className="text-ink-soft">
                          {so ? (
                            <Link href={`/ordenes-venta/${so.id}`} className="font-mono text-accent hover:underline">
                              {so.order_number}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>{so ? customerNameById.get(so.customer_id) ?? "—" : "—"}</Td>
                        <Td className="text-ink-soft">{r.commission_rate}%</Td>
                        <Td className="text-ink-soft">{formatMoneyByCurrency(r.commission_amount, currency)}</Td>
                        <Td className="text-ink-soft">{formatMoneyByCurrency(r.eligible_amount, currency)}</Td>
                        <Td className="font-medium text-ink">{formatMoneyByCurrency(r.paid_amount, currency)}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <TestOperationBadge isTest={so?.is_test ?? false} />
                            <StatusBadge status={r.status} labels={COMMISSION_RECORD_STATUS_LABELS} variants={COMMISSION_RECORD_STATUS_BADGE} />
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ===========================================================================
  // Rama de vendedor (0083, ajuste post-review) — canViewOwn true, canManage
  // false. Consume EXCLUSIVAMENTE rpc_list_own_commissions() (SECURITY
  // DEFINER): sin SELECT sobre commission_records ni ninguna otra tabla —
  // el RPC ya resuelve folio/cliente. Sin refresh de elegibilidad
  // (autoridad exclusiva de can_manage_commissions), sin columna Vendedor/
  // Tasa/Elegible/Pagado, sin filtro de "incluir pruebas" (el RPC no
  // expone is_test — no está en el contrato de campos aprobado).
  // ===========================================================================
  const { data: ownData } = canViewOwn ? await supabase.rpc("rpc_list_own_commissions") : { data: [] };
  const ownRecords = ownData ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Comisiones" description="Tus comisiones de venta — solo lectura." />

      {ownRecords.length === 0 ? (
        <Card>
          <EmptyState icon={Percent} title="No tienes comisiones todavía" description="Aparecerán aquí cuando Dirección registre una a tu nombre." />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {ownRecords.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/comisiones/${r.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-accent">{r.sales_order_folio}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-faint">{r.customer_name ?? "—"}</p>
                  </Link>
                  <StatusBadge status={r.status as CommissionRecordStatus} labels={COMMISSION_RECORD_STATUS_LABELS} variants={COMMISSION_RECORD_STATUS_BADGE} />
                </div>
                <p className="mt-2 text-xs text-ink-faint">{formatDateShort(r.created_at)}</p>
                <p className="mt-1 text-sm font-medium text-ink">{formatMoneyByCurrency(r.commission_amount, r.currency as SalesOrderCurrency)}</p>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Sales Order</Th>
                  <Th>Cliente</Th>
                  <Th>Comisión</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {ownRecords.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-ink-soft">
                      <Link href={`/comisiones/${r.id}`} className="font-mono text-accent hover:underline">
                        {r.sales_order_folio}
                      </Link>
                    </Td>
                    <Td>{r.customer_name ?? "—"}</Td>
                    <Td className="font-medium text-ink">{formatMoneyByCurrency(r.commission_amount, r.currency as SalesOrderCurrency)}</Td>
                    <Td className="text-ink-soft">{formatDateShort(r.created_at)}</Td>
                    <Td>
                      <StatusBadge status={r.status as CommissionRecordStatus} labels={COMMISSION_RECORD_STATUS_LABELS} variants={COMMISSION_RECORD_STATUS_BADGE} />
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
