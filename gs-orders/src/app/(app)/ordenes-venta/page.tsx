import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { canWriteRecord } from "@/lib/auth/ownership";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestOperationBadge } from "@/components/ui/test-operation-badge";
import { IncludeTestDataToggle } from "@/components/ui/include-test-data-toggle";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateShort, formatMoneyByCurrency } from "@/lib/utils/format";
import { SALES_ORDER_STATUS_BADGE, SALES_ORDER_STATUS_LABELS } from "@/types/domain";
import type { SalesOrder } from "@/types/domain";

export const dynamic = "force-dynamic";

/**
 * Lista de Sales Orders (THÖREN Sales Orders MVP, 0067). Sin joins:
 * customer_id/salesperson_id se resuelven client-side con un mapa (los
 * nombres NO son snapshot en el encabezado de sales_orders — a diferencia
 * de Quotes — así que se traen aparte). Visibilidad por rol la impone RLS
 * (sales_orders_select_own_or_admin) — ADMIN ve todas las de su
 * organización, VENDEDOR solo las suyas (o todas con can_view_all_sales).
 */
export default async function OrdenesVentaPage({ searchParams }: { searchParams: { incluir_pruebas?: string } }) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();
  const includeTest = searchParams.incluir_pruebas === "1";

  let soQuery = supabase.from("sales_orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (!includeTest) soQuery = soQuery.eq("is_test", false);
  const { data } = await soQuery;
  const salesOrders = (data ?? []) as SalesOrder[];

  const customerIds = Array.from(new Set(salesOrders.map((so) => so.customer_id)));
  const salespersonIds = Array.from(new Set(salesOrders.map((so) => so.salesperson_id)));

  const [{ data: customersData }, { data: salespeopleData }] = await Promise.all([
    customerIds.length ? supabase.from("customers").select("id, name").in("id", customerIds) : Promise.resolve({ data: [] }),
    salespersonIds.length
      ? supabase.from("salespeople").select("id, name").in("id", salespersonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const customerNameById = new Map((customersData ?? []).map((c) => [c.id, c.name as string]));
  const salespersonNameById = new Map((salespeopleData ?? []).map((s) => [s.id, s.name as string]));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Órdenes de Venta"
        description="Sales Orders de Comercial."
        actions={
          <div className="flex items-center gap-3">
            <IncludeTestDataToggle />
            <Link href="/ordenes-venta/nueva">
              <Button>
                <Plus className="h-4 w-4" />
                Nueva Sales Order
              </Button>
            </Link>
          </div>
        }
      />

      {salesOrders.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No hay Sales Orders todavía"
            description="Crea la primera Sales Order para empezar a registrar ventas."
            action={
              <Link href="/ordenes-venta/nueva">
                <Button>
                  <Plus className="h-4 w-4" />
                  Nueva Sales Order
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {salesOrders.map((so) => (
              <Card key={so.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/ordenes-venta/${so.id}`} className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-accent">{so.order_number}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">{customerNameById.get(so.customer_id) ?? "—"}</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <TestOperationBadge isTest={so.is_test} />
                    <StatusBadge status={so.status} labels={SALES_ORDER_STATUS_LABELS} variants={SALES_ORDER_STATUS_BADGE} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {salespersonNameById.get(so.salesperson_id) ?? "—"} · {formatDateShort(so.created_at)}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{formatMoneyByCurrency(so.total, so.currency)}</p>
                <div className="mt-3 flex items-center gap-3 border-t border-border pt-2 text-sm">
                  <Link href={`/ordenes-venta/${so.id}`} className="text-ink-soft hover:text-accent">
                    Ver
                  </Link>
                  {so.status === "draft" && canWriteRecord(profile, so.salesperson_id) && (
                    <Link href={`/ordenes-venta/${so.id}/editar`} className="text-ink-soft hover:text-accent">
                      Editar
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Número</Th>
                  <Th>Fecha</Th>
                  <Th>Vendedor</Th>
                  <Th>Cliente</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {salesOrders.map((so) => (
                  <Tr key={so.id}>
                    <Td>
                      <Link
                        href={`/ordenes-venta/${so.id}`}
                        className="font-mono text-sm font-medium text-accent hover:underline"
                      >
                        {so.order_number}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{formatDateShort(so.created_at)}</Td>
                    <Td className="text-ink-soft">{salespersonNameById.get(so.salesperson_id) ?? "—"}</Td>
                    <Td>{customerNameById.get(so.customer_id) ?? "—"}</Td>
                    <Td className="text-ink-soft">{formatMoneyByCurrency(so.total, so.currency)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <TestOperationBadge isTest={so.is_test} />
                        <StatusBadge status={so.status} labels={SALES_ORDER_STATUS_LABELS} variants={SALES_ORDER_STATUS_BADGE} />
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3 text-sm">
                        <Link href={`/ordenes-venta/${so.id}`} className="text-ink-soft hover:text-accent">
                          Ver
                        </Link>
                        {so.status === "draft" && canWriteRecord(profile, so.salesperson_id) && (
                          <Link href={`/ordenes-venta/${so.id}/editar`} className="text-ink-soft hover:text-accent">
                            Editar
                          </Link>
                        )}
                      </div>
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
