import { History as HistoryIcon } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatRelativeToNow } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  // Superadmin y Director General ven el historial de toda la empresa;
  // el resto solo el propio (Instrucción Maestra §17).
  const canViewAll = user ? roleHasPermission(user.role, "view_ai_usage") || user.role === "director_general" : false;

  let query = supabase
    .from("tool_executions")
    .select("id, status, created_at, tokens_input, tokens_output, cost_estimate, tools(name), users(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (user) {
    query = query.eq("company_id", user.companyId);
    if (!canViewAll) query = query.eq("user_id", user.id);
  }

  const { data: executions } = user ? await query : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Historial</h1>
        <p className="text-sm text-ink-faint">
          {canViewAll ? "Todas las ejecuciones de la empresa." : "Tus propias ejecuciones de herramientas de IA."}
        </p>
      </div>

      {!executions || executions.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Sin ejecuciones todavía" />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Herramienta</Th>
              {canViewAll && <Th>Usuario</Th>}
              <Th>Estado</Th>
              <Th>Tokens</Th>
              <Th>Costo est.</Th>
              <Th>Fecha</Th>
            </tr>
          </Thead>
          <Tbody>
            {executions.map((e) => (
              <Tr key={e.id}>
                <Td className="font-medium text-ink">{(e as any).tools?.name}</Td>
                {canViewAll && <Td>{(e as any).users?.full_name}</Td>}
                <Td>
                  <Badge tone={e.status === "success" ? "success" : "danger"}>{e.status}</Badge>
                </Td>
                <Td>{(e.tokens_input ?? 0) + (e.tokens_output ?? 0)}</Td>
                <Td>${Number(e.cost_estimate ?? 0).toFixed(4)}</Td>
                <Td>{formatRelativeToNow(e.created_at)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
