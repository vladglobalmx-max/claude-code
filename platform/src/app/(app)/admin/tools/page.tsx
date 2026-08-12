import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { ToolStatusCell } from "@/components/admin/tool-status-cell";

export const dynamic = "force-dynamic";

export default async function AdminToolsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: tools } = user
    ? await supabase
        .from("tools")
        .select("id, name, slug, category, version, status, prompt_id, business_units(name)")
        .eq("company_id", user.companyId)
        .order("name")
    : { data: [] };

  return (
    <Table>
      <Thead>
        <tr>
          <Th>Herramienta</Th>
          <Th>Categoría</Th>
          <Th>Unidad</Th>
          <Th>Prompt</Th>
          <Th>Versión</Th>
          <Th>Estado</Th>
        </tr>
      </Thead>
      <Tbody>
        {(tools ?? []).map((tool) => (
          <Tr key={tool.id}>
            <Td className="font-medium text-ink">{tool.name}</Td>
            <Td>{tool.category}</Td>
            <Td>{(tool as any).business_units?.name ?? "Todas"}</Td>
            <Td>
              <Link href={`/admin/prompts/${tool.prompt_id}`} className="text-accent hover:underline">
                Ver prompt
              </Link>
            </Td>
            <Td>v{tool.version}</Td>
            <Td>
              <ToolStatusCell toolId={tool.id} status={tool.status} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
