import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EditQuoteSequenceForm } from "./edit-sequence-form";
import { updateQuoteSequence } from "../../actions";
import type { SalespersonQuoteSequence } from "@/types/domain";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

export default async function EditarFolioCotizacionPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("salesperson_quote_sequences")
    .select("*, salespeople(name), business_units(name)")
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  const row = data as unknown as SalespersonQuoteSequence & {
    salespeople: { name: string } | OneOrMany<{ name: string }> | null;
    business_units: { name: string } | OneOrMany<{ name: string }> | null;
  };
  const salesperson = one(row.salespeople);
  const businessUnit = one(row.business_units);
  const action = updateQuoteSequence.bind(null, row.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar configuración de folio" />
      <Card>
        <CardHeader>
          <CardTitle>{row.quote_prefix}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditQuoteSequenceForm
            action={action}
            sequence={row}
            salespersonName={salesperson?.name ?? "—"}
            businessUnitName={businessUnit?.name ?? "—"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
