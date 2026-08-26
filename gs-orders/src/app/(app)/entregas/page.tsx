import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { formatDateShort } from "@/lib/utils/format";
import { DELIVERY_STATUS_BADGE, DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "@/types/domain";
import type { Delivery } from "@/types/domain";
import { DeliveryFilters } from "./delivery-filters";

export const dynamic = "force-dynamic";

type OneOrMany<T> = T | T[];
function one<T>(value: OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

interface DeliveryRow extends Delivery {
  order: OneOrMany<{
    id: string;
    folio: string;
    client_name: string;
    business_unit_id: string | null;
    business_units: OneOrMany<{ name: string }> | null;
  }> | null;
}

/**
 * THÖREN Fase 6P §8 — listado principal de "Entregas". RLS
 * (deliveries_select_own_or_admin, 0039) ya limita: ADMIN ve todas las de
 * su organización, VENDEDOR solo las de Pedidos que le pertenecen —
 * visibilidad heredada, igual criterio que Pedidos/Compras.
 */
export default async function EntregasPage({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; bu?: string; responsable?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: businessUnitsData } = await supabase.from("business_units").select("id, name").eq("active", true).order("name");
  const businessUnits = (businessUnitsData ?? []) as { id: string; name: string }[];

  let query = supabase
    .from("deliveries")
    .select(
      searchParams.bu
        ? "*, order:orders!inner(id, folio, client_name, business_unit_id, business_units(name))"
        : "*, order:orders(id, folio, client_name, business_unit_id, business_units(name))"
    )
    .order("created_at", { ascending: false });

  if (searchParams.estado) query = query.eq("status", searchParams.estado);
  if (searchParams.bu) query = query.eq("order.business_unit_id", searchParams.bu);
  if (searchParams.responsable) query = query.ilike("responsible_name", `%${searchParams.responsable}%`);

  const { data } = await query.limit(200);
  let deliveries = (data ?? []) as unknown as DeliveryRow[];

  if (searchParams.q) {
    const q = searchParams.q.trim().toLowerCase();
    deliveries = deliveries.filter((d) => {
      const order = one(d.order);
      return (order?.folio ?? "").toLowerCase().includes(q) || (order?.client_name ?? "").toLowerCase().includes(q);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Entregas" description="Entregas e instalaciones registradas desde los Pedidos." />

      <DeliveryFilters businessUnits={businessUnits} />

      {deliveries.length === 0 ? (
        <Card>
          <EmptyState
            icon={PackageCheck}
            title="No hay entregas que coincidan"
            description="Ajusta la búsqueda o los filtros, o crea una desde el detalle de un Pedido."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {deliveries.map((d) => {
              const order = one(d.order);
              return (
                <Card key={d.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/entregas/${d.id}`} className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium text-accent">
                        {order?.folio ?? "—"}-E{d.sequence_number}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">{order?.client_name ?? "—"}</p>
                    </Link>
                    <StatusBadge status={d.status} labels={DELIVERY_STATUS_LABELS} variants={DELIVERY_STATUS_BADGE} />
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {DELIVERY_TYPE_LABELS[d.delivery_type]} · {one(order?.business_units)?.name ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Programada: {d.scheduled_date ? formatDateShort(d.scheduled_date) : "—"} · {d.responsible_name ?? "—"}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <Thead>
                <Tr>
                  <Th>Entrega</Th>
                  <Th>Pedido</Th>
                  <Th>Cliente</Th>
                  <Th>Business Unit</Th>
                  <Th>Tipo</Th>
                  <Th>Fecha programada</Th>
                  <Th>Estado</Th>
                  <Th>Responsable</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {deliveries.map((d) => {
                  const order = one(d.order);
                  return (
                    <Tr key={d.id}>
                      <Td>
                        <Link href={`/entregas/${d.id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                          {order?.folio ?? "—"}-E{d.sequence_number}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft">
                        {order ? (
                          <Link href={`/pedidos/${order.id}`} className="font-mono text-accent hover:underline">
                            {order.folio}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{order?.client_name ?? "—"}</Td>
                      <Td className="text-ink-soft">{one(order?.business_units)?.name ?? "—"}</Td>
                      <Td className="text-ink-soft">{DELIVERY_TYPE_LABELS[d.delivery_type]}</Td>
                      <Td className="text-ink-soft">{d.scheduled_date ? formatDateShort(d.scheduled_date) : "—"}</Td>
                      <Td>
                        <StatusBadge status={d.status} labels={DELIVERY_STATUS_LABELS} variants={DELIVERY_STATUS_BADGE} />
                      </Td>
                      <Td className="text-ink-soft">{d.responsible_name ?? "—"}</Td>
                      <Td className="text-right">
                        <Link href={`/entregas/${d.id}`} className="text-sm text-accent hover:underline">
                          Ver
                        </Link>
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
