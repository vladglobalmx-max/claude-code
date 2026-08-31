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
import { getCurrentCapabilities } from "@/lib/auth/capabilities";
import { isFullAdmin, canManageUsers } from "@/lib/auth/user-management";
import {
  preflightSalespersonTaken,
  insertProfileAndMembershipOrCompensate,
  resolveCurrentOrganizationId,
  updateUserRoleAndActive,
  buildSetPasswordLink,
} from "@/lib/user-access";

export type UserAccessFormState = { error?: string } | undefined;
export type GenerateLinkState = { error: string } | { ok: true; actionLink: string; email: string };

/**
 * THÖREN 6R.1B-4A — todas las acciones de este módulo son server-only
 * (archivo "use server") y vuelven a verificar aquí, en el servidor, quién
 * llama — nunca confiar en que la UI ya lo validó. `isFullAdmin` distingue
 * admin pleno (autoridad total, sin restricciones) de un titular de
 * can_manage_users (administración de CUENTAS únicamente — nunca
 * autorización de negocio, nunca puede tocar una cuenta admin ni crear una
 * nueva). Cada acción abajo decide POR SU CUENTA qué le exige a cada caso;
 * este helper nunca sustituye esas verificaciones específicas.
 *
 * createSupabaseAdminClient (service role) solo se usa DENTRO de estas
 * funciones, nunca se importa ni se referencia desde un componente cliente.
 * Es justo esa ruta (createUserAccess/createUserAccessLink) la que NO tiene
 * ningún respaldo de RLS — bypassa la base de datos por completo — así que
 * el chequeo explícito de `role` en cada acción que la usa NUNCA puede
 * omitirse ni delegarse solo a este helper (ver DECISIÓN en 0046).
 */
async function requireAdminOrUserManager(): Promise<
  { error: string } | { profile: CurrentProfile; isFullAdmin: boolean }
> {
  const profile = await getCurrentProfile();
  if (isFullAdmin(profile)) {
    return { profile: profile as CurrentProfile, isFullAdmin: true };
  }
  const capabilities = await getCurrentCapabilities(profile?.userId);
  if (!canManageUsers(profile, capabilities)) {
    return { error: "No tienes permiso para realizar esta acción." };
  }
  return { profile: profile as CurrentProfile, isFullAdmin: false };
}

/**
 * THÖREN 6R.1B-4A — reset/generateLink toman un email crudo (no un userId),
 * así que un titular de can_manage_users necesita resolver "¿este correo es
 * de una cuenta no-admin de mi propia organización?" antes de tocar Auth.
 * Reutiliza admin_list_user_profiles() (0046: ahora también acepta
 * can_manage_users y ya viene acotada a la organización del que llama) en
 * vez de inventar una consulta nueva — si el correo no aparece en esa
 * lista, ya sea porque no existe, es de otra organización, o el propio RLS
 * de la RPC lo excluyó, se rechaza igual, sin distinguir el motivo.
 */
async function assertUserManagerCanTargetEmail(email: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data: profiles, error } = await supabase.rpc("admin_list_user_profiles");
  if (error) {
    return "No tienes permiso para realizar esta acción.";
  }
  const target = (profiles ?? []).find((p) => p.email === email);
  if (!target || target.role === "admin") {
    return "No tienes permiso para restablecer el acceso de este usuario.";
  }
  return null;
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
  const guard = await requireAdminOrUserManager();
  if ("error" in guard) return { error: guard.error };

  const parsed = createUserAccessSchema.safeParse({
    ...parseFormFields(formData),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // THÖREN 6R.1B-4A — createUserAccess usa el service role (bypassa RLS por
  // completo, ver requireAdminOrUserManager arriba): este chequeo es el
  // ÚNICO respaldo real contra que un titular de can_manage_users cree una
  // cuenta admin. No delegar esto a RLS/trigger — aquí no hay ninguno.
  if (!guard.isFullAdmin && parsed.data.role !== "vendedor") {
    return { error: "Solo un administrador puede crear una cuenta con ese rol." };
  }

  const supabase = createSupabaseServerClient();
  const salespersonError = await preflightSalespersonTaken(supabase, parsed.data.salesperson_id);
  if (salespersonError) return { error: salespersonError };

  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

  const admin = createSupabaseAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl()}/set-password`,
  });

  if (inviteError || !invited?.user) {
    logAuthError("inviteUserByEmail falló", parsed.data.email, inviteError);
    return { error: mapAuthError(inviteError) };
  }

  const result = await insertProfileAndMembershipOrCompensate(
    admin,
    supabase,
    invited.user.id,
    orgResult.organizationId,
    parsed.data
  );
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
  const guard = await requireAdminOrUserManager();
  if ("error" in guard) return { error: guard.error };

  const parsed = createUserAccessSchema.safeParse({
    ...parseFormFields(formData),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Ver createUserAccess — mismo respaldo obligatorio (service role, sin RLS).
  if (!guard.isFullAdmin && parsed.data.role !== "vendedor") {
    return { error: "Solo un administrador puede crear una cuenta con ese rol." };
  }

  const supabase = createSupabaseServerClient();
  const salespersonError = await preflightSalespersonTaken(supabase, parsed.data.salesperson_id);
  if (salespersonError) return { error: salespersonError };

  const orgResult = await resolveCurrentOrganizationId(supabase);
  if ("error" in orgResult) return { error: orgResult.error };

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

  const result = await insertProfileAndMembershipOrCompensate(
    admin,
    supabase,
    linkData.user.id,
    orgResult.organizationId,
    parsed.data
  );
  if ("error" in result) return result;

  revalidatePath("/configuracion/usuarios");
  return {
    ok: true,
    actionLink: buildSetPasswordLink(getSiteUrl(), linkData.properties.hashed_token, "invite"),
    email: parsed.data.email,
  };
}

/**
 * Edita nombre/rol/vendedor/estado del perfil. No toca auth.users — el
 * email y la contraseña siguen siendo responsabilidad de Supabase Auth.
 *
 * role/active se actualizan PRIMERO y de forma atómica en user_profiles +
 * organization_members vía admin_update_user_role_and_active() (0013) — si
 * falla, no se toca nada más. name/salesperson_id (sin relación de
 * sincronización con organization_members) se guardan después, en una
 * escritura normal aparte.
 */
export async function updateUserAccess(
  userId: string,
  _prevState: UserAccessFormState,
  formData: FormData
): Promise<UserAccessFormState> {
  const guard = await requireAdminOrUserManager();
  if ("error" in guard) return { error: guard.error };

  const parsed = updateUserAccessSchema.safeParse(parseFormFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createSupabaseServerClient();

  // THÖREN 6R.1B-4A — updateUserRoleAndActive() sí tiene respaldo real de
  // RLS/triggers (0046: admin_update_user_role_and_active es SECURITY
  // INVOKER), pero se agrega este chequeo aquí para dar un error claro en
  // vez de depender del mensaje genérico de "0 filas afectadas" de la RPC.
  if (!guard.isFullAdmin) {
    if (parsed.data.role !== "vendedor") {
      return { error: "Solo un administrador puede asignar ese rol." };
    }
    const { data: targetProfile } = await supabase.from("user_profiles").select("role").eq("user_id", userId).maybeSingle();
    if (!targetProfile || targetProfile.role === "admin") {
      return { error: "No tienes permiso para modificar esta cuenta." };
    }
  }

  const roleActiveError = await updateUserRoleAndActive(supabase, userId, parsed.data.role, parsed.data.active);
  if (roleActiveError) {
    return { error: roleActiveError };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      name: parsed.data.name,
      salesperson_id: parsed.data.role === "vendedor" ? parsed.data.salesperson_id : null,
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
  const guard = await requireAdminOrUserManager();
  if ("error" in guard) return { error: guard.error };

  if (!guard.isFullAdmin) {
    const targetError = await assertUserManagerCanTargetEmail(email);
    if (targetError) return { error: targetError };
  }

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
  const guard = await requireAdminOrUserManager();
  if ("error" in guard) return { error: guard.error };

  if (!guard.isFullAdmin) {
    const targetError = await assertUserManagerCanTargetEmail(email);
    if (targetError) return { error: targetError };
  }

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
