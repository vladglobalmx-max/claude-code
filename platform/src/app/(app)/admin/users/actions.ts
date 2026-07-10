"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role_id: z.string().uuid(),
});

export interface InviteUserState {
  error?: string;
  success?: boolean;
}

export async function inviteUserAction(_prev: InviteUserState, formData: FormData): Promise<InviteUserState> {
  const currentUser = await getCurrentUser();
  if (!currentUser || !roleHasPermission(currentUser.role, "manage_users")) {
    return { error: "No tienes permiso para invitar usuarios." };
  }

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Datos inválidos." };
  }

  // Alta en auth.users requiere el service role — es exactamente el caso de
  // uso legítimo de admin.ts: una acción que un usuario normal no podría
  // ejecutar aunque tuviera el rol correcto (crear identidad de acceso).
  const adminClient = createSupabaseAdminClient();

  const { data: authUser, error: authError } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email);

  if (authError || !authUser.user) {
    return { error: "No se pudo enviar la invitación. Verifica el correo." };
  }

  const { error: insertError } = await adminClient.from("users").insert({
    id: authUser.user.id,
    company_id: currentUser.companyId,
    role_id: parsed.data.role_id,
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    status: "invited",
  });

  if (insertError) {
    return { error: "El usuario se invitó pero no se pudo registrar su perfil. Contacta soporte técnico." };
  }

  const supabase = createSupabaseServerClient();
  await supabase.from("audit_log").insert({
    company_id: currentUser.companyId,
    user_id: currentUser.id,
    action: "create_user",
    entity_type: "users",
    entity_id: authUser.user.id,
    metadata: { email: parsed.data.email },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
