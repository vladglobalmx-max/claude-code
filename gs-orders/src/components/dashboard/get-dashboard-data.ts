import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBusinessMonthRange } from "@/lib/business-date";
import { getCurrentProfile } from "@/lib/auth/profile";
import type { OrderStatus } from "@/types/domain";

/**
 * Estados que cuentan como "pipeline abierto" — ver ORDER_STATUS_LABELS en
 * types/domain.ts. borrador/pedido todavía requieren trabajo; cerrado ya
 * se completó, cancelado ya no aplica. Decisión documentada en el reporte
 * de THÖREN Experience 1B, no inventada aquí.
 */
const OPEN_STATUSES: OrderStatus[] = ["borrador", "pedido"];

export interface RecentOrderRow {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  salespersonName: string;
}

export interface SalespersonBreakdownRow {
  salespersonId: string;
  salespersonName: string;
  count: number;
}

export interface DashboardData {
  role: "admin" | "vendedor";
  name: string;
  /** true si este usuario/organización no tiene NINGÚN pedido histórico — dispara el Empty State en vez de KPIs en cero. */
  hasAnyOrders: boolean;
  monthOrderCount: number;
  previousMonthOrderCount: number;
  activeOrderCount: number;
  closedThisMonthCount: number;
  distinctClientsThisMonth: number;
  statusBreakdown: Record<OrderStatus, number>;
  recentOrders: RecentOrderRow[];
  /** null para VENDEDOR — RLS ya limita sus datos a sus propios pedidos, un comparativo de 1 fila no aporta nada (ver reporte 1B). */
  salespersonBreakdown: SalespersonBreakdownRow[] | null;
  /** true si alguna consulta falló — la página muestra un error explícito en vez de datos parciales silenciosos. */
  hasError: boolean;
}

type MonthOrderRow = {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  created_at: string;
  salesperson_id: string;
  salesperson: { name: string } | { name: string }[] | null;
};

function salespersonName(row: MonthOrderRow | RecentSourceRow): string {
  const sp = row.salesperson;
  if (!sp) return "—";
  return Array.isArray(sp) ? sp[0]?.name ?? "—" : sp.name;
}

type RecentSourceRow = {
  id: string;
  folio: string;
  client_name: string;
  status: OrderStatus;
  order_date: string;
  salesperson: { name: string } | { name: string }[] | null;
};

export async function getDashboardData(): Promise<DashboardData> {
  const profile = await getCurrentProfile();
  const supabase = createSupabaseServerClient();

  const currentMonth = getBusinessMonthRange(0);
  const previousMonth = getBusinessMonthRange(1);

  const [
    { count: totalCount, error: totalError },
    { data: monthRows, error: monthError },
    { count: previousMonthCount, error: previousMonthError },
    { count: activeCount, error: activeError },
    { data: recentRows, error: recentError },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, folio, client_name, status, order_date, created_at, salesperson_id, salesperson:salespeople(name)")
      .gte("order_date", currentMonth.start)
      .lt("order_date", currentMonth.end),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("order_date", previousMonth.start)
      .lt("order_date", previousMonth.end),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", OPEN_STATUSES),
    supabase
      .from("orders")
      .select("id, folio, client_name, status, order_date, salesperson:salespeople(name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const hasError = Boolean(totalError || monthError || previousMonthError || activeError || recentError);

  const typedMonthRows = (monthRows ?? []) as unknown as MonthOrderRow[];

  const statusBreakdown: Record<OrderStatus, number> = {
    borrador: 0,
    pedido: 0,
    cerrado: 0,
    cancelado: 0,
  };
  const clientSet = new Set<string>();
  const salespersonCounts = new Map<string, SalespersonBreakdownRow>();

  for (const row of typedMonthRows) {
    statusBreakdown[row.status] = (statusBreakdown[row.status] ?? 0) + 1;
    clientSet.add(row.client_name.trim().toLowerCase());

    if (profile?.role === "admin") {
      const existing = salespersonCounts.get(row.salesperson_id);
      if (existing) {
        existing.count += 1;
      } else {
        salespersonCounts.set(row.salesperson_id, {
          salespersonId: row.salesperson_id,
          salespersonName: salespersonName(row),
          count: 1,
        });
      }
    }
  }

  const salespersonBreakdown =
    profile?.role === "admin"
      ? Array.from(salespersonCounts.values()).sort((a, b) => b.count - a.count)
      : null;

  const recentOrders: RecentOrderRow[] = ((recentRows ?? []) as unknown as RecentSourceRow[]).map((row) => ({
    id: row.id,
    folio: row.folio,
    client_name: row.client_name,
    status: row.status,
    order_date: row.order_date,
    salespersonName: salespersonName(row),
  }));

  return {
    role: (profile?.role ?? "vendedor") as "admin" | "vendedor",
    name: profile?.name ?? "",
    hasAnyOrders: (totalCount ?? 0) > 0,
    monthOrderCount: typedMonthRows.length,
    previousMonthOrderCount: previousMonthCount ?? 0,
    activeOrderCount: activeCount ?? 0,
    closedThisMonthCount: statusBreakdown.cerrado,
    distinctClientsThisMonth: clientSet.size,
    statusBreakdown,
    recentOrders,
    salespersonBreakdown,
    hasError,
  };
}
