import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SalespersonForm } from "../salesperson-form";
import { createSalesperson } from "../actions";

export default function NuevoVendedorPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nuevo vendedor" />
      <Card>
        <CardHeader>
          <CardTitle>Datos del vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <SalespersonForm action={createSalesperson} submitLabel="Crear vendedor" />
        </CardContent>
      </Card>
    </div>
  );
}
