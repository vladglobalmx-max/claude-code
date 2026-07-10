import Link from "next/link";
import { LayoutGrid, Target } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { StageBadge } from "@/components/opportunities/stage-badge";
import { formatCurrency, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: opportunities } = user
    ? await supabase
        .from("opportunities")
        .select("id, name, stage, estimated_value, probability, expected_close_date, clients(legal_name, trade_name)")
        .eq("company_id", user.companyId)
        .order("updated_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Oportunidades</h1>
          <p className="text-sm text-ink-faint">Pipeline comercial de las 5 unidades de negocio.</p>
        </div>
        <Link href="/opportunities/kanban">
          <Button variant="secondary">
            <LayoutGrid className="h-4 w-4" /> Vista Kanban
          </Button>
        </Link>
      </div>

      {!opportunities || opportunities.length === 0 ? (
        <EmptyState icon={Target} title="Sin oportunidades todavía" />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Oportunidad</Th>
              <Th>Cliente</Th>
              <Th>Etapa</Th>
              <Th>Valor</Th>
              <Th>Probabilidad</Th>
              <Th>Cierre estimado</Th>
            </tr>
          </Thead>
          <Tbody>
            {opportunities.map((o) => (
              <Tr key={o.id}>
                <Td>
                  <Link href={`/opportunities/${o.id}`} className="font-medium text-ink hover:text-accent">
                    {o.name}
                  </Link>
                </Td>
                <Td>{(o as any).clients?.trade_name || (o as any).clients?.legal_name || "—"}</Td>
                <Td>
                  <StageBadge stage={o.stage} />
                </Td>
                <Td>{formatCurrency(o.estimated_value)}</Td>
                <Td>{o.probability}%</Td>
                <Td>{formatDate(o.expected_close_date)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
