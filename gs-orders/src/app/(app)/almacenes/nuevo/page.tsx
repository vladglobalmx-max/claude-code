import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { WarehouseForm } from "../warehouse-form";
import { createWarehouse } from "../actions";

/** ADMIN-only (ver warehouses_insert_admin, 0036) — a diferencia de Proveedores/Clientes. */
export default async function NuevoAlmacenPage() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/almacenes");
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nuevo almacén" />
      <Card>
        <CardHeader>
          <CardTitle>Datos del almacén</CardTitle>
        </CardHeader>
        <CardContent>
          <WarehouseForm action={createWarehouse} submitLabel="Crear almacén" />
        </CardContent>
      </Card>
    </div>
  );
}
