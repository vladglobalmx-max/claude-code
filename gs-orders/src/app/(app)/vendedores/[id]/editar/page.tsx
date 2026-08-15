import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SalespersonForm } from "../../salesperson-form";
import { updateSalesperson } from "../../actions";
import type { Salesperson } from "@/types/domain";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

export default async function EditarVendedorPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salespeople")
    .select("*, people(id, name)")
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const { people: personLink, ...salesperson } = data as Salesperson & {
    people: { id: string; name: string } | OneOrMany<{ id: string; name: string }> | null;
  };
  const person = one(personLink);
  const action = updateSalesperson.bind(null, salesperson.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar vendedor" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{salesperson.name}</CardTitle>
            {person && (
              <Link href={`/personas/${person.id}`} className="text-xs text-accent hover:underline">
                Ver persona →
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <SalespersonForm action={action} salesperson={salesperson} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
