import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { AgentStatusCell } from "@/components/admin/agent-status-cell";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: agents } = user
    ? await supabase
        .from("agents")
        .select("id, name, slug, model, temperature, version, status, business_units(name)")
        .eq("company_id", user.companyId)
        .order("name")
    : { data: [] };

  return (
    <Table>
      <Thead>
        <tr>
          <Th>Agente</Th>
          <Th>Unidad</Th>
          <Th>Modelo</Th>
          <Th>Temp.</Th>
          <Th>Versión</Th>
          <Th>Estado</Th>
        </tr>
      </Thead>
      <Tbody>
        {(agents ?? []).map((agent) => (
          <Tr key={agent.id}>
            <Td className="font-medium text-ink">{agent.name}</Td>
            <Td>{(agent as any).business_units?.name ?? "Todas"}</Td>
            <Td className="font-mono text-xs">{agent.model}</Td>
            <Td>{agent.temperature}</Td>
            <Td>v{agent.version}</Td>
            <Td>
              <AgentStatusCell agentId={agent.id} status={agent.status} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
