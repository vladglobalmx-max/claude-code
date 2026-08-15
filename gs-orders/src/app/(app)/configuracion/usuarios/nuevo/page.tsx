import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserAccessForm } from "../user-form";
import { createUserAccess } from "../actions";
import type { UserAccessRow } from "@/types/domain";

export default async function NuevoUsuarioPage() {
  const supabase = createSupabaseServerClient();
  const [{ data: salespeopleData }, { data: usersData }] = await Promise.all([
    supabase.from("salespeople").select("id, name, prefix").order("name"),
    supabase.rpc("admin_list_user_profiles"),
  ]);

  const takenSalespersonIds = new Set(
    ((usersData ?? []) as UserAccessRow[]).map((u) => u.salesperson_id).filter((id): id is string => !!id)
  );
  const availableSalespeople = (salespeopleData ?? []).filter((sp) => !takenSalespersonIds.has(sp.id));

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Nuevo usuario" />
      <Card>
        <CardHeader>
          <CardTitle>Datos de acceso</CardTitle>
        </CardHeader>
        <CardContent>
          <UserAccessForm action={createUserAccess} availableSalespeople={availableSalespeople} submitLabel="Crear usuario" />
        </CardContent>
      </Card>
    </div>
  );
}
