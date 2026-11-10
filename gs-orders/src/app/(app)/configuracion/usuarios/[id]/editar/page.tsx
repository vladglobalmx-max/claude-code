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
import { DEPARTMENT_CAPABILITY, resolveAssignedDepartments } from "@/lib/auth/departments";

interface BusinessUnitOption {
  id: string;
  name: string;
}

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

  // THÖREN | CONTROL DE ACCESO POR DEPARTAMENTOS — isFullAdmin pleno Y no
  // es la propia cuenta del que edita (auto-asignación bloqueada, ver
  // DECISIÓN en actions.ts/0093). Gateado también aquí (no solo en la UI)
  // para no disparar una consulta que la RLS de user_capabilities
  // (0040, select_own_or_admin) de todas formas respondería vacía para un
  // no-admin consultando a otro usuario.
  const canManageDepartments = admin && profile?.userId !== user.user_id;
  let assignedDepartments: ReturnType<typeof resolveAssignedDepartments> = [];
  if (canManageDepartments) {
    const { data: departmentCapabilities } = await supabase
      .from("user_capabilities")
      .select("capability")
      .eq("user_id", user.user_id)
      .in("capability", Object.values(DEPARTMENT_CAPABILITY))
      .eq("active", true);
    assignedDepartments = resolveAssignedDepartments((departmentCapabilities ?? []).map((row) => row.capability));
  }

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

  // THÖREN | ASIGNACIÓN DE BUSINESS UNITS A USUARIOS — mismo criterio
  // EXACTO que canManageDepartments arriba: isFullAdmin pleno Y no es la
  // propia cuenta del que edita (ver DECISIÓN en actions.ts/0094). Sin
  // `person` (usuario sin Persona vinculada, caso marginal — ver
  // diagnóstico) no hay a qué asignar Business Units: el fieldset queda
  // oculto en vez de romper la pantalla.
  const canManageBusinessUnits = admin && profile?.userId !== user.user_id && !!person;
  let assignedBusinessUnitIds: string[] = [];
  let availableBusinessUnits: BusinessUnitOption[] = [];
  if (canManageBusinessUnits && person) {
    const [{ data: businessUnitAssignments }, { data: businessUnitsData }] = await Promise.all([
      supabase.from("person_business_units").select("business_unit_id").eq("person_id", person.id).eq("active", true),
      supabase.from("business_units").select("id, name").eq("active", true).order("name"),
    ]);
    assignedBusinessUnitIds = (businessUnitAssignments ?? []).map((row) => row.business_unit_id);
    availableBusinessUnits = (businessUnitsData ?? []) as BusinessUnitOption[];
  }

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
            canManageDepartments={canManageDepartments}
            assignedDepartments={assignedDepartments}
            canManageBusinessUnits={canManageBusinessUnits}
            assignedBusinessUnitIds={assignedBusinessUnitIds}
            availableBusinessUnits={availableBusinessUnits}
          />
        </CardContent>
      </Card>
    </div>
  );
}
