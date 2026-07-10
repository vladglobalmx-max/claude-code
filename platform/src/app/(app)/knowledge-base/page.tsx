import { BookOpen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: documents } = user
    ? await supabase
        .from("documents")
        .select("id, name, category, tags, version, created_at, business_units(name)")
        .eq("company_id", user.companyId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Base de conocimiento</h1>
        <p className="text-sm text-ink-faint">
          Catálogos, fichas técnicas, políticas y SOPs. La IA solo consulta documentos autorizados para cada agente y usuario.
        </p>
      </div>

      {!documents || documents.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Todavía no hay documentos"
          description="La búsqueda semántica (embeddings) se activará en la Fase 2 sobre esta misma estructura."
        />
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>Documento</Th>
              <Th>Categoría</Th>
              <Th>Unidad de negocio</Th>
              <Th>Versión</Th>
              <Th>Fecha</Th>
            </tr>
          </Thead>
          <Tbody>
            {documents.map((doc) => (
              <Tr key={doc.id}>
                <Td className="font-medium text-ink">{doc.name}</Td>
                <Td>
                  <Badge tone="neutral">{doc.category ?? "Sin categoría"}</Badge>
                </Td>
                <Td>{(doc as any).business_units?.name ?? "Todas"}</Td>
                <Td>v{doc.version}</Td>
                <Td>{formatDate(doc.created_at)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
