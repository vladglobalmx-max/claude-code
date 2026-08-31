import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isFullAdmin } from "@/lib/auth/user-management";
import { UserAccessForm } from "../user-form";
import { createUserAccess } from "../actions";
import type { UserAccessRow } from "@/types/domain";

export default async function NuevoUsuarioPage() {
  const supabase = createSupabaseServerClient();
  const [profile, { data: salespeopleData }, { data: usersData }] = await Promise.all([
    getCurrentProfile(),
    supabase.from("salespeople").select("id, name, prefix").order("name"),
    supabase.rpc("admin_list_user_profiles"),
  ]);
  // THÖREN 6R.1B-4B — un titular de can_manage_users siempre da de alta con
  // role='vendedor' fijo (ver DECISIÓN de 0046/actions.ts): sin selector de
  // rol, nunca ADMIN ni ningún otro role.
  const canChooseRole = isFullAdmin(profile);

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
          <UserAccessForm
            action={createUserAccess}
            availableSalespeople={availableSalespeople}
            submitLabel="Crear usuario"
            canChooseRole={canChooseRole}
          />
        </CardContent>
      </Card>
    </div>
  );
}
