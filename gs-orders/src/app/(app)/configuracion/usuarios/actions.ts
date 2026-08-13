"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth/profile";
import { getSiteUrl } from "@/lib/site-url";
import { createUserAccessSchema, updateUserAccessSchema } from "@/lib/validations/user-access";
import { mapDbError } from "@/lib/db-errors";
import { mapAuthError } from "@/lib/auth-errors";
import { preflightSalespersonTaken, insertProfileOrCompensate, buildSetPasswordLink } from "@/lib/user-access";

export type UserAccessFormState = { error?: string } | undefined;
export type GenerateLinkState = { error: string } | { ok: true; actionLink: string; email: string };

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

function logAuthError(context: string, email: string, error: { message?: string; status?: number; code?: string } | null) {
  console.error(`[usuarios] ${context}`, {
    email,
    status: error?.status,
    code: error?.code,
    message: error?.message,
  });
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
 * Crea el acceso enviando una invitación por correo (Supabase Auth genera y
 * envía el enlace). Sujeto al límite de tasa del servicio de correo de
 * Supabase — ver createUserAccessLink() para la alternativa sin envío de
 * correo cuando ese límite se alcanza.
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

  const supabase = createSupabaseServerClient();
  const salespersonError = await preflightSalespersonTaken(supabase, parsed.data.salesperson_id);
  if (salespersonError) return { error: salespersonError };

  const admin = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/set-password`,
  });

  if (inviteError || !invited?.user) {
    logAuthError("inviteUserByEmail falló", parsed.data.email, inviteError);
    return { error: mapAuthError(inviteError) };
  }

  const result = await insertProfileOrCompensate(admin, supabase, invited.user.id, parsed.data);
  if ("error" in result) return result;

  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}

/**
 * Crea el acceso SIN enviar correo: genera el usuario en Auth y un enlace de
 * activación de un solo uso (generateLink), que el ADMIN copia y comparte
 * manualmente (WhatsApp, correo, etc.). No depende del servicio de correo de
 * Supabase, así que funciona aunque el límite de invitaciones esté activo.
 * El enlace se devuelve una sola vez al ADMIN — GS Orders nunca lo guarda.
 */
export async function createUserAccessLink(formData: FormData): Promise<GenerateLinkState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const parsed = createUserAccessSchema.safeParse({
    ...parseFormFields(formData),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();
  const salespersonError = await preflightSalespersonTaken(supabase, parsed.data.salesperson_id);
  if (salespersonError) return { error: salespersonError };

  const admin = createSupabaseAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: { redirectTo: `${getSiteUrl()}/set-password` },
  });

  if (linkError || !linkData?.user || !linkData.properties) {
    logAuthError("generateLink falló", parsed.data.email, linkError);
    return { error: mapAuthError(linkError) };
  }

  const result = await insertProfileOrCompensate(admin, supabase, linkData.user.id, parsed.data);
  if ("error" in result) return result;

  revalidatePath("/configuracion/usuarios");
  return {
    ok: true,
    actionLink: buildSetPasswordLink(getSiteUrl(), linkData.properties.hashed_token, "invite"),
    email: parsed.data.email,
  };
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
    logAuthError("resetPasswordForEmail falló", email, error);
    return { error: mapAuthError(error) };
  }
  return { ok: true };
}

/**
 * Genera un enlace de restablecimiento de contraseña SIN enviar correo, para
 * un usuario que YA existe en Auth (p. ej. Karla: su invitación original
 * quedó inservible por el bug del redirect a localhost). No crea usuario ni
 * perfil nuevos — solo emite un enlace de recovery de un solo uso.
 */
export async function generatePasswordResetLink(email: string): Promise<GenerateLinkState> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const admin = createSupabaseAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${getSiteUrl()}/set-password` },
  });

  if (linkError || !linkData?.properties) {
    logAuthError("generateLink (recovery) falló", email, linkError);
    return { error: mapAuthError(linkError) };
  }

  return {
    ok: true,
    actionLink: buildSetPasswordLink(getSiteUrl(), linkData.properties.hashed_token, "recovery"),
    email,
  };
}
