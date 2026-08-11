import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalespersonForm } from "../../salesperson-form";
import { updateSalesperson } from "../../actions";
import type { Salesperson } from "@/types/domain";

export default async function EditarVendedorPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("salespeople").select("*").eq("id", params.id).single();

  if (!data) notFound();

  const salesperson = data as Salesperson;
  const action = updateSalesperson.bind(null, salesperson.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Editar vendedor</h1>
      <Card>
        <CardHeader>
          <CardTitle>{salesperson.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonForm action={action} salesperson={salesperson} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
