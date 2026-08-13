import Link from "next/link";
import { FileText } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from "@/types/domain";
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
  salesperson: { name: string; prefix: string } | { name: string; prefix: string }[] | null;
}

function salespersonName(row: OrderRow) {
  if (!row.salesperson) return "—";
  return Array.isArray(row.salesperson) ? row.salesperson[0]?.name ?? "—" : row.salesperson.name;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: { q?: string; vendedor?: string; estado?: string; tipo?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [{ data: salespeopleData }, { data: productTypesData }] = await Promise.all([
    supabase.from("salespeople").select("*").order("name"),
    supabase.from("product_types").select("*").order("name"),
  ]);
  const salespeople = (salespeopleData ?? []) as Salesperson[];
  const productTypes = (productTypesData ?? []) as ProductTypeItem[];

  let query = supabase
    .from("orders")
    .select(
      "id, folio, order_date, client_name, product_type, product_type_name_snapshot, status, salesperson:salespeople(name, prefix)"
    )
    .order("created_at", { ascending: false });

  if (searchParams.vendedor) query = query.eq("salesperson_id", searchParams.vendedor);
  if (searchParams.estado) query = query.eq("status", searchParams.estado);
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
  const orders = (data ?? []) as unknown as OrderRow[];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Pedidos</h1>
          <p className="mt-0.5 text-sm text-ink-faint">Pedidos internos para Thunder Safety Solutions</p>
        </div>
      </div>

      <OrderFilters salespeople={salespeople} productTypes={productTypes} />

      {orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={FileText}
            title="No hay pedidos que coincidan"
            description="Ajusta la búsqueda o los filtros, o crea un nuevo pedido."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <Table>
            <Thead>
              <Tr>
                <Th>Folio</Th>
                <Th>Fecha</Th>
                <Th>Vendedor</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
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
                    <Badge variant={ORDER_STATUS_BADGE[order.status as keyof typeof ORDER_STATUS_BADGE]}>
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                    </Badge>
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
        </div>
      )}
    </div>
  );
}
