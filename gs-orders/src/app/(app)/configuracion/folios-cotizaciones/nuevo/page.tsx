import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewQuoteSequenceForm } from "../new-sequence-form";
import { createQuoteSequence } from "../actions";

export default async function NuevoFolioCotizacionPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: salespeopleData }, { data: buData }] = await Promise.all([
    supabase.from("salespeople").select("id, name").eq("active", true).order("name"),
    supabase.from("business_units").select("id, name").eq("active", true).order("name"),
  ]);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nueva configuración de folio" />
      <Card>
        <CardHeader>
          <CardTitle>Vendedor × Business Unit</CardTitle>
        </CardHeader>
        <CardContent>
          <NewQuoteSequenceForm
            action={createQuoteSequence}
            salespeople={salespeopleData ?? []}
            businessUnits={buData ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
