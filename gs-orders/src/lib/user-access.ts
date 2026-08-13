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
 * Inserta user_profiles para un usuario de Auth recién creado (por invite o
 * por generateLink). Si falla, revierte el alta en Auth (deleteUser) para no
 * dejar un usuario "fantasma" sin perfil. authUserId debe ser SIEMPRE el id
 * que la llamada a Auth de esta misma operación acaba de devolver — nunca un
 * usuario preexistente. La compensación en sí se audita: si deleteUser
 * también falla, queda registrado en logs server-side en vez de fallar en
 * silencio.
 */
export async function insertProfileOrCompensate(
  admin: AdminAuthClient,
  supabase: SupabaseClient<Database>,
  authUserId: string,
  data: CreateUserAccessPayload
): Promise<{ error: string } | { ok: true }> {
  const { error: profileError } = await supabase.from("user_profiles").insert({
    user_id: authUserId,
    name: data.name,
    role: data.role,
    salesperson_id: data.role === "vendedor" ? data.salesperson_id ?? null : null,
    active: data.active,
  });

  if (!profileError) return { ok: true };

  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
  if (deleteError) {
    console.error("[usuarios] compensación fallida: no se pudo eliminar el usuario Auth huérfano", {
      authUserId,
      profileError: profileError.message,
      deleteError: deleteError.message,
    });
  } else {
    console.error("[usuarios] user_profiles falló tras crear usuario en Auth; alta revertida en Auth", {
      authUserId,
      profileError: profileError.message,
    });
  }

  return { error: mapDbError(profileError, "No se pudo crear el perfil del usuario.") };
}
