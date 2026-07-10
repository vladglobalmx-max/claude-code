import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";
import { formatRelativeToNow } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: logs } = user
    ? await supabase
        .from("audit_log")
        .select("id, action, entity_type, created_at, users(full_name)")
        .eq("company_id", user.companyId)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  if (!logs || logs.length === 0) {
    return <EmptyState icon={ShieldCheck} title="Sin actividad registrada todavía" />;
  }

  return (
    <Table>
      <Thead>
        <tr>
          <Th>Acción</Th>
          <Th>Entidad</Th>
          <Th>Usuario</Th>
          <Th>Fecha</Th>
        </tr>
      </Thead>
      <Tbody>
        {logs.map((log) => (
          <Tr key={log.id}>
            <Td className="font-medium text-ink">{log.action}</Td>
            <Td>{log.entity_type ?? "—"}</Td>
            <Td>{(log as any).users?.full_name ?? "Sistema"}</Td>
            <Td>{formatRelativeToNow(log.created_at)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
