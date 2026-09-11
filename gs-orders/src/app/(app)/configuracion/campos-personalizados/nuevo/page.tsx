import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldForm } from "../custom-field-form";
import { createCustomFieldDefinition } from "../actions";

export default async function NuevoCampoPersonalizadoPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: businessUnitsData }, { data: productTypesData }] = await Promise.all([
    supabase.from("business_units").select("id, name").order("name", { ascending: true }),
    // THÖREN — Bug real: custom fields aplicados al Tipo de Producto
    // incorrecto (0065). RLS (product_types_select) ya aísla por
    // organization_id — un admin de otro tenant nunca ve estos Tipos de
    // Producto, sin necesidad de un filtro explícito aquí.
    supabase.from("product_types").select("id, name").eq("active", true).order("name", { ascending: true }),
  ]);

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
            productTypes={productTypesData ?? []}
            submitLabel="Crear campo"
          />
        </CardContent>
      </Card>
    </div>
  );
}
