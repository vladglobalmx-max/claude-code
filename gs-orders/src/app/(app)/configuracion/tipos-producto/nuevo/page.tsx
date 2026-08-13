import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductTypeForm } from "../product-type-form";
import { createProductType } from "../actions";

export default function NuevoTipoProductoPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Nuevo tipo de producto</h1>
      <Card>
        <CardHeader>
          <CardTitle>Datos del tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductTypeForm action={createProductType} submitLabel="Crear tipo" />
        </CardContent>
      </Card>
    </div>
  );
}
