import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "../../customer-form";
import { updateCustomer } from "../../actions";
import { CustomerContactsManager } from "./customer-contacts-manager";
import type { Customer, CustomerContact } from "@/types/domain";

/**
 * Editar es ADMIN-only (ver customers_update_admin, 0018) — VENDEDOR nunca
 * llega aquí: se redirige antes de renderizar el formulario, en vez de
 * mostrar un form que fallaría en el submit por RLS.
 */
export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    redirect("/clientes");
  }

  const supabase = createSupabaseServerClient();
  const [{ data }, { data: contactsData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).single(),
    supabase.from("customer_contacts").select("*").eq("customer_id", params.id).order("name"),
  ]);
  if (!data) notFound();

  const customer = data as Customer;
  const contacts = (contactsData ?? []) as CustomerContact[];
  const action = updateCustomer.bind(null, customer.id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar cliente" />
      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm action={action} customer={customer} submitLabel="Guardar cambios" showActiveToggle />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Contactos</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerContactsManager customerId={customer.id} contacts={contacts} />
        </CardContent>
      </Card>
    </div>
  );
}
