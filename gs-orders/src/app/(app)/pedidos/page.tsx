import Link from "next/link";
import { Copy, Eye, FileText, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { AttentionLevelIndicator } from "@/components/ui/attention-level-indicator";
import { cn } from "@/lib/utils/cn";
import { formatDateShort } from "@/lib/utils/format";
import {
  ACTIVE_OPERATIONAL_STATUSES,
  buildLatestChangeMap,
  calculateDaysInStatus,
  classifyAttentionLevel,
  type AttentionLevel,
} from "@/lib/dashboard/attention-queue";
import { ORDER_OPERATIONAL_STATUS_BADGE, ORDER_OPERATIONAL_STATUS_LABELS, ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from "@/types/domain";
import type { ProductTypeItem, Salesperson } from "@/types/domain";
import { OrderFilters } from "./order-filters";
import { DuplicateButton } from "./duplicate-button";
import { DeleteButton } from "./delete-button";

export const dynamic = "force-dynamic";

interface OrderRow {
  id: string;
  folio: string;
  order_date: string;
  client_name: string;
  product_type: string;
  product_type_name_snapshot: string | null;
  status: string;
  operational_status: string;
  salesperson: { name: string; prefix: string } | { name: string; prefix: string }[] | null;
  /** THÖREN Fase 6J — solo se calcula para operational_status activo (ver ACTIVE_OPERATIONAL_STATUSES); undefined para completado/cancelado, que nunca se consideran atrasados. */
  attentionLevel?: AttentionLevel;
  daysInStatus?: number;
}

function salespersonName(row: OrderRow) {
  if (!row.salesperson) return "—";
  return Array.isArray(row.salesperson) ? row.salesperson[0]?.name ?? "—" : row.salesperson.name;
}

const iconLinkClass = cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8");
const iconButtonClass = cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-ink-soft hover:text-danger");

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    vendedor?: string;
    estado?: string;
    seguimiento?: string;
    bu?: string;
    tipo?: string;
    atencion?: string;
  };
}) {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const [{ data: salespeopleData }, { data: productTypesData }, { data: businessUnitsData }] = await Promise.all([
    supabase.from("salespeople").select("*").order("name"),
    supabase.from("product_types").select("*").order("name"),
    // THÖREN Fase 6I — para el filtro por Business Unit. RLS ya limita a
    // las de la organización del usuario, sin filtro adicional aquí.
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
  ]);
  const salespeople = (salespeopleData ?? []) as Salesperson[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];

  let query = supabase
    .from("orders")
    .select(
      "id, folio, order_date, client_name, product_type, product_type_name_snapshot, status, operational_status, salesperson:salespeople(name, prefix)"
    )
    .order("created_at", { ascending: false });

  if (searchParams.vendedor) query = query.eq("salesperson_id", searchParams.vendedor);
  if (searchParams.estado) query = query.eq("status", searchParams.estado);
  if (searchParams.seguimiento) query = query.eq("operational_status", searchParams.seguimiento);
  if (searchParams.bu) query = query.eq("business_unit_id", searchParams.bu);
  if (searchParams.tipo) query = query.eq("product_type", searchParams.tipo);

  if (searchParams.q) {
    const q = searchParams.q.trim();
    const matchingSalespeople = salespeople.filter((sp) =>
      sp.name.toLowerCase().includes(q.toLowerCase())
    );
    const orConditions = [`folio.ilike.%${q}%`, `client_name.ilike.%${q}%`];
    if (matchingSalespeople.length > 0) {
      orConditions.push(`salesperson_id.in.(${matchingSalespeople.map((sp) => sp.id).join(",")})`);
    }
    query = query.or(orConditions.join(","));
  }

  const { data } = await query.limit(200);
  let orders = (data ?? []) as unknown as OrderRow[];

  // THÖREN Fase 6J — antigüedad/semáforo para la columna Seguimiento y el
  // filtro de atención. Reutiliza exactamente la misma lógica del
  // Dashboard (lib/dashboard/attention-queue.ts) — nunca se reimplementa.
  // Solo se calcula para pedidos con operational_status activo:
  // completado/cancelado nunca se consideran atrasados (§1).
  const activeOrderIds = orders
    .filter((o) => (ACTIVE_OPERATIONAL_STATUSES as string[]).includes(o.operational_status))
    .map((o) => o.id);
  if (activeOrderIds.length > 0) {
    const { data: historyRows } = await supabase
      .from("order_operational_status_history")
      .select("order_id, changed_at")
      .in("order_id", activeOrderIds)
      .order("changed_at", { ascending: false });

    const latestChangeByOrder = buildLatestChangeMap((historyRows ?? []) as { order_id: string; changed_at: string }[]);
    const now = new Date();
    orders = orders.map((order) => {
      const lastChangedAt = latestChangeByOrder.get(order.id);
      if (!lastChangedAt) return order;
      const daysInStatus = calculateDaysInStatus(lastChangedAt, now);
      return { ...order, daysInStatus, attentionLevel: classifyAttentionLevel(daysInStatus) };
    });
  }

  if (searchParams.atencion) {
    orders = orders.filter((order) => order.attentionLevel === searchParams.atencion);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader
        title="Pedidos"
        description="Pedidos internos para Thunder Safety Solutions"
        actions={
          <Link href="/pedidos/nuevo">
            <Button>
              <Plus className="h-4 w-4" />
              Nuevo pedido
            </Button>
          </Link>
        }
      />

      <OrderFilters
        salespeople={salespeople}
        productTypes={productTypes}
        businessUnits={businessUnits}
        showSalespersonFilter={profile?.role === "admin"}
      />

      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="No hay pedidos que coincidan"
            description="Ajusta la búsqueda o los filtros, o crea un nuevo pedido."
          />
        </Card>
      ) : (
        <>
          {/* Mobile: lista de tarjetas — la tabla completa no cabe sin scroll horizontal forzado. */}
          <div className="space-y-3 sm:hidden">
            {orders.map((order) => (
              <Card key={order.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/pedidos/${order.id}`} className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-accent">{order.folio}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">{order.client_name}</p>
                  </Link>
                  <StatusBadge status={order.status as keyof typeof ORDER_STATUS_LABELS} labels={ORDER_STATUS_LABELS} variants={ORDER_STATUS_BADGE} />
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {salespersonName(order)} · {formatDateShort(order.order_date)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    status={order.operational_status as keyof typeof ORDER_OPERATIONAL_STATUS_LABELS}
                    labels={ORDER_OPERATIONAL_STATUS_LABELS}
                    variants={ORDER_OPERATIONAL_STATUS_BADGE}
                  />
                  {order.attentionLevel && order.daysInStatus !== undefined && (
                    <AttentionLevelIndicator level={order.attentionLevel} daysInStatus={order.daysInStatus} />
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-border pt-2">
                  <Link href={`/pedidos/${order.id}`} className={iconLinkClass} aria-label="Ver pedido">
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Link href={`/pedidos/${order.id}/editar`} className={iconLinkClass} aria-label="Editar pedido">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <DuplicateButton orderId={order.id} className={iconLinkClass} aria-label="Duplicar pedido">
                    <Copy className="h-4 w-4" />
                  </DuplicateButton>
                  <Link href={`/pedidos/${order.id}/pdf`} target="_blank" className={iconLinkClass} aria-label="Ver PDF">
                    <Printer className="h-4 w-4" />
                  </Link>
                  <DeleteButton orderId={order.id} folio={order.folio} className={iconButtonClass} aria-label="Eliminar pedido">
                    <Trash2 className="h-4 w-4" />
                  </DeleteButton>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop/tablet: tabla completa. */}
          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Folio</Th>
                  <Th>Fecha</Th>
                  <Th>Vendedor</Th>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th>Estado</Th>
                  <Th>Seguimiento</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/pedidos/${order.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                        {order.folio}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{formatDateShort(order.order_date)}</Td>
                    <Td className="text-ink-soft">{salespersonName(order)}</Td>
                    <Td>{order.client_name}</Td>
                    <Td className="text-ink-soft">{order.product_type_name_snapshot ?? order.product_type}</Td>
                    <Td>
                      <StatusBadge status={order.status as keyof typeof ORDER_STATUS_LABELS} labels={ORDER_STATUS_LABELS} variants={ORDER_STATUS_BADGE} />
                    </Td>
                    <Td>
                      <StatusBadge
                        status={order.operational_status as keyof typeof ORDER_OPERATIONAL_STATUS_LABELS}
                        labels={ORDER_OPERATIONAL_STATUS_LABELS}
                        variants={ORDER_OPERATIONAL_STATUS_BADGE}
                      />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-3 text-sm">
                        <Link href={`/pedidos/${order.id}`} className="text-ink-soft hover:text-accent">
                          Ver
                        </Link>
                        <Link href={`/pedidos/${order.id}/editar`} className="text-ink-soft hover:text-accent">
                          Editar
                        </Link>
                        <DuplicateButton orderId={order.id} className="text-ink-soft hover:text-accent" />
                        <Link href={`/pedidos/${order.id}/pdf`} className="text-ink-soft hover:text-accent">
                          PDF
                        </Link>
                        <DeleteButton orderId={order.id} folio={order.folio} className="text-ink-soft hover:text-danger" />
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
