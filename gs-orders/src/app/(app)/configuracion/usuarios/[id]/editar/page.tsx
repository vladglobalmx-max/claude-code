import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAccessForm } from "../../user-form";
import { updateUserAccess } from "../../actions";
import type { UserAccessRow } from "@/types/domain";

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [{ data: usersData }, { data: salespeopleData }] = await Promise.all([
    supabase.rpc("admin_list_user_profiles"),
    supabase.from("salespeople").select("id, name, prefix").order("name"),
  ]);

  const users = (usersData ?? []) as UserAccessRow[];
  const user = users.find((u) => u.user_id === params.id);
  if (!user) notFound();

  const takenSalespersonIds = new Set(
    users.filter((u) => u.user_id !== user.user_id).map((u) => u.salesperson_id).filter((id): id is string => !!id)
  );
  const availableSalespeople = (salespeopleData ?? []).filter(
    (sp) => !takenSalespersonIds.has(sp.id) || sp.id === user.salesperson_id
  );

  const action = updateUserAccess.bind(null, user.user_id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h1 className="mb-6 text-lg font-semibold text-ink">Editar usuario</h1>
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <UserAccessForm action={action} user={user} availableSalespeople={availableSalespeople} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
