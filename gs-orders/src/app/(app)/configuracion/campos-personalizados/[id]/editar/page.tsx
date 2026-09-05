import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomFieldDefinitionById } from "@/lib/custom-fields/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldForm } from "../../custom-field-form";
import { updateCustomFieldDefinition } from "../../actions";

export default async function EditarCampoPersonalizadoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [definition, { data: businessUnitsData }] = await Promise.all([
    getCustomFieldDefinitionById(supabase, params.id),
    supabase.from("business_units").select("id, name").order("name", { ascending: true }),
  ]);

  if (!definition) notFound();

  const action = updateCustomFieldDefinition.bind(null, definition.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Editar campo personalizado</h1>
      <Card>
        <CardHeader>
          <CardTitle>{definition.label}</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldForm
            action={action}
            definition={definition}
            businessUnits={businessUnitsData ?? []}
            submitLabel="Guardar cambios"
          />
        </CardContent>
      </Card>
    </div>
  );
}
