import type { SupabaseClient } from "@supabase/supabase-js";
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
