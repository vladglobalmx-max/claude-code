import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SupplierForm } from "../supplier-form";
import { createSupplier } from "../actions";

/** ADMIN y VENDEDOR pueden crear proveedores (ver suppliers_insert_member, 0035). */
export default function NuevoProveedorPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nuevo proveedor" />
      <Card>
        <CardHeader>
          <CardTitle>Datos del proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm action={createSupplier} submitLabel="Crear proveedor" />
        </CardContent>
      </Card>
    </div>
  );
}
