import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { WarehouseForm } from "../../warehouse-form";
import { updateWarehouse } from "../../actions";
import type { Warehouse } from "@/types/domain";

/** ADMIN-only (ver warehouses_update_admin, 0036). */
export default async function EditarAlmacenPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/almacenes");
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("warehouses").select("*").eq("id", params.id).single();
  if (!data) notFound();

  const warehouse = data as Warehouse;
  const action = updateWarehouse.bind(null, warehouse.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar almacén" />
      <Card>
        <CardHeader>
          <CardTitle>{warehouse.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <WarehouseForm action={action} warehouse={warehouse} submitLabel="Guardar cambios" showActiveToggle />
        </CardContent>
      </Card>
    </div>
  );
}
