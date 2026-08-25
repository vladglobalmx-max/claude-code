import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SupplierForm } from "../../supplier-form";
import { updateSupplier } from "../../actions";
import type { Supplier } from "@/types/domain";

/**
 * Editar es ADMIN-only (ver suppliers_update_admin, 0035) — VENDEDOR nunca
 * llega aquí: se redirige antes de renderizar el formulario, en vez de
 * mostrar un form que fallaría en el submit por RLS.
 */
export default async function EditarProveedorPage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/proveedores");
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("suppliers").select("*").eq("id", params.id).single();
  if (!data) notFound();

  const supplier = data as Supplier;
  const action = updateSupplier.bind(null, supplier.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar proveedor" />
      <Card>
        <CardHeader>
          <CardTitle>{supplier.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm action={action} supplier={supplier} submitLabel="Guardar cambios" showActiveToggle />
        </CardContent>
      </Card>
    </div>
  );
}
