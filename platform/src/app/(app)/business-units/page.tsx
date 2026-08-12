import Link from "next/link";
import { Building2 } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function BusinessUnitsPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: units } = user
    ? await supabase.from("business_units").select("id, name, slug, description, icon").eq("company_id", user.companyId).order("name")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Unidades de negocio</h1>
        <p className="text-sm text-ink-faint">Cada unidad tiene su propio catálogo de herramientas de IA.</p>
      </div>

      {!units || units.length === 0 ? (
        <EmptyState icon={Building2} title="Sin unidades de negocio configuradas" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <Link key={unit.id} href={`/business-units/${unit.slug}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardContent className="pt-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-accent/15 text-accent">
                    <Building2 className="h-4.5 w-4.5" />
                  </div>
                  <p className="font-medium text-ink">{unit.name}</p>
                  {unit.description && <p className="mt-1 text-sm text-ink-faint">{unit.description}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
