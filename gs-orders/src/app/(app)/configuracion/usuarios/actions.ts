"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/profile";
import { getSiteUrl } from "@/lib/site-url";
import { createUserAccessSchema, updateUserAccessSchema } from "@/lib/validations/user-access";
import { mapDbError } from "@/lib/db-errors";

export type UserAccessFormState = { error?: string } | undefined;

/**
 * Todas las acciones de este módulo son server-only (archivo "use server")
 * y vuelven a verificar aquí, en el servidor, que quien llama es un ADMIN
 * activo — nunca confiar en que la UI ya lo validó. createSupabaseAdminClient
 * (service role) solo se usa DENTRO de estas funciones, nunca se importa ni
 * se referencia desde un componente cliente.
 */
async function requireAdmin(): Promise<{ error: string } | { profile: CurrentProfile }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.active || profile.role !== "admin") {
    return { error: "No tienes permiso para realizar esta acción." };
  }
  return { profile };
}

function mapAuthError(error: { message?: string } | null): string {
  const message = error?.message?.toLowerCase() ?? "";
  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return "Ya existe un usuario con ese correo.";
  }
  return "No se pudo crear el usuario. Intenta de nuevo.";
}

function parseFormFields(formData: FormData) {
  const role = formData.get("role");
  return {
    name: formData.get("name"),
    role,
    salesperson_id: role === "vendedor" ? formData.get("salesperson_id") || undefined : null,
    active: formData.get("active") === "on",
  };
}

/**
 * Crea el acceso: invita al usuario vía Supabase Auth (correo con enlace
 * seguro para que ÉL defina su propia contraseña — nunca se genera, guarda
 * ni muestra una contraseña temporal desde GS Orders) y crea su perfil.
 * Si el perfil falla, se revierte el alta en Auth para no dejar un usuario
 * "fantasma" sin perfil.
 */
export async function createUserAccess(
  _prevState: UserAccessFormState,
  formData: FormData
): Promise<UserAccessFormState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const parsed = createUserAccessSchema.safeParse({
    ...parseFormFields(formData),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const admin = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/set-password`,
  });

  if (inviteError || !invited?.user) {
    return { error: mapAuthError(inviteError) };
  }

  const supabase = createSupabaseServerClient();
  const { error: profileError } = await supabase.from("user_profiles").insert({
    user_id: invited.user.id,
    name: parsed.data.name,
    role: parsed.data.role,
    salesperson_id: parsed.data.role === "vendedor" ? parsed.data.salesperson_id : null,
    active: parsed.data.active,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: mapDbError(profileError, "No se pudo crear el perfil del usuario.") };
  }

  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}

/** Edita nombre/rol/vendedor/estado del perfil. No toca auth.users — el email y la contraseña siguen siendo responsabilidad de Supabase Auth. */
export async function updateUserAccess(
  userId: string,
  _prevState: UserAccessFormState,
  formData: FormData
): Promise<UserAccessFormState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const parsed = updateUserAccessSchema.safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      name: parsed.data.name,
      role: parsed.data.role,
      salesperson_id: parsed.data.role === "vendedor" ? parsed.data.salesperson_id : null,
      active: parsed.data.active,
    })
    .eq("user_id", userId);

  if (error) {
    return { error: mapDbError(error, "No se pudieron guardar los cambios.") };
  }

  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}

/**
 * "Restablecer contraseña": dispara el flujo estándar de recuperación de
 * Supabase Auth (correo con enlace a /set-password). El ADMIN nunca ve ni
 * define la contraseña — solo activa el mecanismo oficial de Supabase.
 */
export async function resetUserPassword(email: string): Promise<{ error: string } | { ok: true }> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/set-password`,
  });

  if (error) {
    return { error: "No se pudo enviar el correo de restablecimiento. Intenta de nuevo." };
  }
  return { ok: true };
}
