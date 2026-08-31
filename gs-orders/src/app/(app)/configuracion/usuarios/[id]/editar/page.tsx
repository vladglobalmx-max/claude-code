import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/profile";
import { isFullAdmin } from "@/lib/auth/user-management";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UserAccessForm } from "../../user-form";
import { updateUserAccess } from "../../actions";
import { ADMIN_PROTECTED_ERROR } from "../../constants";
import type { UserAccessRow } from "@/types/domain";

interface OneOrMany<T> {
  [index: number]: T;
}
function one<T>(value: T | OneOrMany<T> | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : (value as T);
}

export default async function EditarUsuarioPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const [profile, { data: usersData }, { data: salespeopleData }, { data: personLink }] = await Promise.all([
    getCurrentProfile(),
    supabase.rpc("admin_list_user_profiles"),
    supabase.from("salespeople").select("id, name, prefix").order("name"),
    supabase.from("user_profiles").select("people(id, name)").eq("user_id", params.id).single(),
  ]);
  const admin = isFullAdmin(profile);

  const users = (usersData ?? []) as UserAccessRow[];
  const user = users.find((u) => u.user_id === params.id);
  if (!user) notFound();

  // THÖREN 6R.1B-4B — guard server-side obligatorio (sección 6 de la
  // autorización): un titular de can_manage_users que abre directamente la
  // URL de una cuenta admin nunca ve el formulario, ni siquiera en modo
  // lectura — se rebota al listado con un mensaje claro. El backend (0046)
  // ya rechazaría cualquier escritura sobre esta fila, pero no hay que
  // depender de eso: no renderizar es la barrera real de esta pantalla.
  if (!admin && user.role === "admin") {
    redirect(`/configuracion/usuarios?error=${ADMIN_PROTECTED_ERROR}`);
  }

  const canChooseRole = admin;

  const takenSalespersonIds = new Set(
    users.filter((u) => u.user_id !== user.user_id).map((u) => u.salesperson_id).filter((id): id is string => !!id)
  );
  const availableSalespeople = (salespeopleData ?? []).filter(
    (sp) => !takenSalespersonIds.has(sp.id) || sp.id === user.salesperson_id
  );
  const person = one((personLink as { people: { id: string; name: string } | { id: string; name: string }[] | null } | null)?.people);

  const action = updateUserAccess.bind(null, user.user_id);

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <PageHeader title="Editar usuario" />
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{user.name}</CardTitle>
            {person && (
              <Link href={`/personas/${person.id}`} className="text-xs text-accent hover:underline">
                Ver persona →
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <UserAccessForm
            action={action}
            user={user}
            availableSalespeople={availableSalespeople}
            submitLabel="Guardar cambios"
            canChooseRole={canChooseRole}
          />
        </CardContent>
      </Card>
    </div>
  );
}
