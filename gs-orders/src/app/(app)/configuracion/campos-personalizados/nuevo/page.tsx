import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldForm } from "../custom-field-form";
import { createCustomFieldDefinition } from "../actions";

export default async function NuevoCampoPersonalizadoPage() {
  const supabase = createSupabaseServerClient();
  const { data: businessUnitsData } = await supabase
    .from("business_units")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Nuevo campo personalizado</h1>
      <Card>
        <CardHeader>
          <CardTitle>Datos del campo</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldForm
            action={createCustomFieldDefinition}
            businessUnits={businessUnitsData ?? []}
            submitLabel="Crear campo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
