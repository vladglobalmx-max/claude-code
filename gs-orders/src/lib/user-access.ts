import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { mapDbError } from "@/lib/db-errors";
import type { CreateUserAccessPayload } from "@/lib/validations/user-access";
import type { Database } from "@/types/database.types";

/**
 * NO lleva "use server": estos helpers reciben los clientes de Supabase ya
 * creados por quien los llama (siempre configuracion/usuarios/actions.ts) y
 * no verifican autorización por su cuenta. Si vivieran en un archivo
 * "use server", cada función async exportada se vuelve automáticamente un
 * endpoint de Server Action invocable — exponer estos helpers así sería
 * exponer un compensating-delete y un insert de user_profiles sin el
 * requireAdmin() que su único llamador ya aplica.
 */

interface DeleteUserResult {
  error: { message: string } | null;
}

/**
 * Tipos de generateLink que esta pantalla sabe redimir — ver
 * buildSetPasswordLink() y set-password-form.tsx. Deliberadamente NO se usa
 * properties.action_link (el link GET de Supabase, /auth/v1/verify): ese
 * mecanismo depende de que el mismo navegador que abre el link haya
 * iniciado el flujo (PKCE code_verifier en localStorage), lo cual nunca es
 * cierto para un link generado server-side y compartido manualmente. En su
 * lugar construimos un link propio a /set-password con token_hash + type,
 * que el cliente redime con supabase.auth.verifyOtp() — autocontenido, sin
 * depender de PKCE.
 */
export const LINK_OTP_TYPES = ["invite", "recovery"] as const satisfies readonly EmailOtpType[];
export type LinkOtpType = (typeof LINK_OTP_TYPES)[number];

export function isLinkOtpType(value: string | null): value is LinkOtpType {
  return (LINK_OTP_TYPES as readonly string[]).includes(value ?? "");
}

/**
 * Construye la URL propia de /set-password que el ADMIN copia y comparte.
 * Usa URL/URLSearchParams (no concatenación de strings) para un encoding
 * correcto de token_hash.
 */
export function buildSetPasswordLink(siteUrl: string, tokenHash: string, type: LinkOtpType): string {
  const url = new URL("/set-password", siteUrl);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return url.toString();
}

export type SetPasswordRedemption =
  | { action: "verify"; params: { token_hash: string; type: LinkOtpType } }
  | { action: "invalid" };

/**
 * Decide, a partir de los search params de /set-password, si hay un
 * token_hash + type redimibles con verifyOtp() o si la pantalla debe
 * mostrar directamente el estado de enlace inválido. Separado de
 * set-password-form.tsx (componente cliente) para poder probarlo sin un
 * framework de testing de componentes.
 */
export function resolveSetPasswordRedemption(searchParams: {
  get(name: string): string | null;
}): SetPasswordRedemption {
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  if (!tokenHash || !isLinkOtpType(type)) return { action: "invalid" };
  return { action: "verify", params: { token_hash: tokenHash, type } };
}

interface AdminAuthClient {
  auth: {
    admin: {
      deleteUser(userId: string): Promise<DeleteUserResult>;
    };
  };
}

/**
 * Si role es "vendedor", confirma que salesperson_id no tenga ya OTRO
 * usuario asociado — el UNIQUE de user_profiles.salesperson_id (ver 0011)
 * es la garantía real, pero validarlo antes evita invitar/crear en Auth un
 * usuario que de todos modos no podría completarse.
 */
export async function preflightSalespersonTaken(
  supabase: SupabaseClient<Database>,
  salespersonId: string | null | undefined
): Promise<string | null> {
  if (!salespersonId) return null;
  const { data } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("salesperson_id", salespersonId)
    .maybeSingle();
  if (data) return "Este vendedor ya tiene un usuario asociado.";
  return null;
}

/**
 * Resuelve la organización del ADMIN que está actuando, vía
 * current_user_organization_id() (0013) — nunca confiar en un
 * organization_id que llegara del navegador. En CORE 1 solo existe una
 * organización real, así que esto siempre debería resolver a Global
 * Supplier MTY para cualquier admin ya bootstrapeado; se maneja
 * explícitamente el caso "sin organización" en vez de asumirlo imposible.
 */
export async function resolveCurrentOrganizationId(
  supabase: SupabaseClient<Database>
): Promise<{ organizationId: string } | { error: string }> {
  const { data, error } = await supabase.rpc("current_user_organization_id");
  if (error) {
    console.error("[usuarios] current_user_organization_id() falló", {
      message: error.message,
      code: error.code,
    });
    return { error: "No se pudo determinar tu organización. Contacta a soporte." };
  }
  if (!data) {
    return { error: "Tu usuario no tiene una organización asociada. Contacta a soporte." };
  }
  return { organizationId: data };
}

async function compensateOrphanedAuthUser(
  admin: AdminAuthClient,
  authUserId: string,
  failedStep: string,
  originalErrorMessage: string
): Promise<void> {
  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
  if (deleteError) {
    console.error("[usuarios] compensación fallida: no se pudo eliminar el usuario Auth huérfano", {
      authUserId,
      failedStep,
      originalErrorMessage,
      deleteError: deleteError.message,
    });
  } else {
    console.error("[usuarios] alta revertida en Auth tras fallo", {
      authUserId,
      failedStep,
      originalErrorMessage,
    });
  }
}

/**
 * Inserta user_profiles + organization_members, y crea/vincula la Person
 * del usuario, para un usuario de Auth recién creado (por invite o por
 * generateLink). Si cualquiera de los tres pasos falla, revierte el alta
 * completa eliminando el usuario de Auth (deleteUser) — authUserId debe ser
 * SIEMPRE el id que la llamada a Auth de esta misma operación acaba de
 * devolver, nunca un usuario preexistente.
 *
 * Si falla organization_members o rpc_create_person_for_user DESPUÉS de que
 * user_profiles ya se insertó, NO hace falta borrar user_profiles aparte:
 * organization_members.user_id y user_profiles.user_id referencian
 * auth.users con ON DELETE CASCADE (0011, 0013), así que eliminar el
 * usuario de Auth revierte ambas filas automáticamente. rpc_create_person_
 * for_user (0016) hace su INSERT en people + UPDATE de person_id en una
 * sola transacción Postgres: si falla, esa transacción se revierte
 * completa, así que nunca queda una Person huérfana pendiente de limpiar
 * aparte (no hay FK people → auth.users, así que no hay cascada que
 * pudiera limpiarla si se hubiera creado). La compensación en sí se
 * audita: si deleteUser también falla, queda registrado en logs
 * server-side en vez de fallar en silencio.
 */
export async function insertProfileAndMembershipOrCompensate(
  admin: AdminAuthClient,
  supabase: SupabaseClient<Database>,
  authUserId: string,
  organizationId: string,
  data: CreateUserAccessPayload
): Promise<{ error: string } | { ok: true }> {
  const { error: profileError } = await supabase.from("user_profiles").insert({
    user_id: authUserId,
    name: data.name,
    role: data.role,
    salesperson_id: data.role === "vendedor" ? data.salesperson_id ?? null : null,
    active: data.active,
  });

  if (profileError) {
    await compensateOrphanedAuthUser(admin, authUserId, "user_profiles", profileError.message);
    return { error: mapDbError(profileError, "No se pudo crear el perfil del usuario.") };
  }

  const { error: membershipError } = await supabase.from("organization_members").insert({
    organization_id: organizationId,
    user_id: authUserId,
    role: data.role,
    active: data.active,
  });

  if (membershipError) {
    await compensateOrphanedAuthUser(
      admin,
      authUserId,
      "organization_members (la cascada de ON DELETE también revierte user_profiles)",
      membershipError.message
    );
    return { error: mapDbError(membershipError, "No se pudo asociar el usuario a la organización.") };
  }

  const { error: personError } = await supabase.rpc("rpc_create_person_for_user", {
    p_user_id: authUserId,
    p_organization_id: organizationId,
    p_name: data.name,
    p_email: data.email,
    p_active: data.active,
  });

  if (personError) {
    await compensateOrphanedAuthUser(
      admin,
      authUserId,
      "rpc_create_person_for_user (la cascada de ON DELETE también revierte user_profiles/organization_members; la Person nunca llega a existir porque su propia transacción se revierte)",
      personError.message
    );
    return { error: mapDbError(personError, "No se pudo crear la identidad de persona del usuario.") };
  }

  return { ok: true };
}

/**
 * Actualiza role/active de un usuario ya existente de forma ATÓMICA en
 * user_profiles Y organization_members, vía admin_update_user_role_and_active()
 * (0013) — una sola llamada RPC, una sola transacción Postgres: o se
 * actualizan ambas filas o ninguna. Reemplaza el enfoque anterior de dos
 * escrituras separadas con compensación manual: como ambas tablas viven en
 * el mismo Postgres (a diferencia del alta, donde Auth participa y no
 * puede compartir transacción), la atomicidad real es posible y preferible
 * a reportar un drift ya ocurrido.
 */
export async function updateUserRoleAndActive(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: "admin" | "vendedor",
  active: boolean
): Promise<string | null> {
  const { error } = await supabase.rpc("admin_update_user_role_and_active", {
    p_user_id: userId,
    p_role: role,
    p_active: active,
  });

  if (error) {
    console.error("[usuarios] admin_update_user_role_and_active() falló", {
      userId,
      message: error.message,
      code: error.code,
    });
    return mapDbError(error, "No se pudieron guardar los cambios de rol/estado.");
  }

  return null;
}
