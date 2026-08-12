import Link from "next/link";
import { Wrench } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: tools } = user
    ? await supabase
        .from("tools")
        .select("id, slug, name, description, category")
        .eq("company_id", user.companyId)
        .eq("status", "active")
        .order("category")
    : { data: [] };

  const byCategory = new Map<string, typeof tools>();
  for (const tool of tools ?? []) {
    const key = tool.category ?? "General";
    byCategory.set(key, [...(byCategory.get(key) ?? []), tool]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Biblioteca de herramientas</h1>
        <p className="text-sm text-ink-faint">Formularios que ejecutan un prompt interno y devuelven un resultado estructurado.</p>
      </div>

      {!tools || tools.length === 0 ? (
        <EmptyState icon={Wrench} title="Sin herramientas activas" />
      ) : (
        Array.from(byCategory.entries()).map(([category, items]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{category}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(items ?? []).map((tool) => (
                <Link key={tool.id} href={`/tools/${tool.slug}`}>
                  <Card className="h-full transition-colors hover:border-accent">
                    <CardContent className="pt-5">
                      <p className="font-medium text-ink">{tool.name}</p>
                      {tool.description && <p className="mt-1 text-sm text-ink-faint">{tool.description}</p>}
                      <Badge tone="accent" className="mt-3">
                        IA
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
