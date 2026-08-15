import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UserAccessForm } from "../../user-form";
import { updateUserAccess } from "../../actions";
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
  const [{ data: usersData }, { data: salespeopleData }, { data: personLink }] = await Promise.all([
    supabase.rpc("admin_list_user_profiles"),
    supabase.from("salespeople").select("id, name, prefix").order("name"),
    supabase.from("user_profiles").select("people(id, name)").eq("user_id", params.id).single(),
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
          <UserAccessForm action={action} user={user} availableSalespeople={availableSalespeople} submitLabel="Guardar cambios" />
        </CardContent>
      </Card>
    </div>
  );
}
