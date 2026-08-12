import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_TONE = { active: "success", draft: "warning", inactive: "neutral" } as const;

export default async function AdminPromptsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: prompts } = user
    ? await supabase
        .from("prompts")
        .select("id, name, code, version, status, model, updated_at")
        .eq("company_id", user.companyId)
        .order("name")
    : { data: [] };

  return (
    <Table>
      <Thead>
        <tr>
          <Th>Prompt</Th>
          <Th>Código</Th>
          <Th>Modelo</Th>
          <Th>Versión</Th>
          <Th>Estado</Th>
        </tr>
      </Thead>
      <Tbody>
        {(prompts ?? []).map((prompt) => (
          <Tr key={prompt.id}>
            <Td>
              <Link href={`/admin/prompts/${prompt.id}`} className="font-medium text-ink hover:text-accent">
                {prompt.name}
              </Link>
            </Td>
            <Td className="font-mono text-xs">{prompt.code}</Td>
            <Td className="font-mono text-xs">{prompt.model}</Td>
            <Td>v{prompt.version}</Td>
            <Td>
              <Badge tone={STATUS_TONE[prompt.status as keyof typeof STATUS_TONE]}>{prompt.status}</Badge>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
