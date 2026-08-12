import { notFound } from "next/navigation";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function BusinessUnitPage({ params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  if (!user) notFound();
  const supabase = createSupabaseServerClient();

  const { data: unit } = await supabase
    .from("business_units")
    .select("id, name, description")
    .eq("slug", params.slug)
    .eq("company_id", user.companyId)
    .single();

  if (!unit) notFound();

  const { data: tools } = await supabase
    .from("tools")
    .select("id, name, slug, description, category")
    .eq("business_unit_id", unit.id)
    .eq("status", "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{unit.name}</h1>
        {unit.description && <p className="text-sm text-ink-faint">{unit.description}</p>}
      </div>

      {!tools || tools.length === 0 ? (
        <EmptyState icon={Wrench} title="Sin herramientas configuradas para esta unidad" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link key={tool.id} href={`/tools/${tool.slug}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardContent className="pt-5">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">{tool.category}</p>
                  <p className="mt-1 font-medium text-ink">{tool.name}</p>
                  {tool.description && <p className="mt-1 text-sm text-ink-faint">{tool.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
