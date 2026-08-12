import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage() {
  const user = await getCurrentUser();
  const supabase = createSupabaseServerClient();

  const { data: businessUnits } = user
    ? await supabase.from("business_units").select("id, name").eq("company_id", user.companyId).order("name")
    : { data: [] };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Nuevo cliente</h1>
        <p className="text-sm text-ink-faint">Crea la ficha general — los contactos se agregan después desde el detalle.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm businessUnits={businessUnits ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
