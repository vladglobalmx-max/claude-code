import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalespersonForm } from "../salesperson-form";
import { createSalesperson } from "../actions";

export default function NuevoVendedorPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Nuevo vendedor</h1>
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
