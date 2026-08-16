import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "../customer-form";
import { createCustomer } from "../actions";

/** ADMIN y VENDEDOR pueden crear clientes (ver customers_insert_member, 0018). */
export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nuevo cliente" />
      <Card>
        <CardHeader>
          <CardTitle>Datos del cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm action={createCustomer} submitLabel="Crear cliente" />
        </CardContent>
      </Card>
    </div>
  );
}
