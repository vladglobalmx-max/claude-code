import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  preflightSalespersonTaken,
  insertProfileAndMembershipOrCompensate,
  resolveCurrentOrganizationId,
  updateUserRoleAndActive,
  buildSetPasswordLink,
  resolveSetPasswordRedemption,
} from "./user-access";
import type { CreateUserAccessPayload } from "@/lib/validations/user-access";
import type { Database } from "@/types/database.types";

const basePayload: CreateUserAccessPayload = {
  name: "Rodolfo Peña",
  role: "vendedor",
  salesperson_id: "sp-rpt",
  active: true,
  email: "rpena@thunderledlights.mx",
};

const ORG_ID = "11111111-2222-3333-4444-555555555555";

function fakeSupabase(maybeSingleResult: { data: unknown }, insertResult: { error: unknown } = { error: null }) {
  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => maybeSingleResult),
        })),
      })),
      insert: vi.fn(async () => insertResult),
    })),
  };
  return client as unknown as SupabaseClient<Database>;
}

/**
 * Fake más fino para insertProfileAndMembershipOrCompensate: permite dar un
 * resultado DISTINTO al insert de user_profiles vs. al de
 * organization_members, y al RPC rpc_create_person_for_user (CORE 2C) que
 * crea/vincula la Person del usuario nuevo.
 */
function fakeSupabaseTwoTables(results: {
  user_profiles: { error: unknown };
  organization_members?: { error: unknown };
  rpc?: { error: unknown };
}) {
  const from = vi.fn((table: string) => ({
    insert: vi.fn(async () => {
      if (table === "user_profiles") return results.user_profiles;
      if (table === "organization_members") return results.organization_members ?? { error: null };
      throw new Error(`fakeSupabaseTwoTables: tabla no esperada en el test: ${table}`);
    }),
  }));
  const rpc = vi.fn(async () => results.rpc ?? { error: null });
  return { from, rpc } as unknown as SupabaseClient<Database>;
}

function fakeRpcSupabase(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(async () => rpcResult) } as unknown as SupabaseClient<Database>;
}


describe("preflightSalespersonTaken (CASO G)", () => {
  it("bloquea cuando el vendedor ya tiene un user_profile asociado", async () => {
    const supabase = fakeSupabase({ data: { user_id: "existing-user" } });
    const result = await preflightSalespersonTaken(supabase, "sp-kst");
    expect(result).toBe("Este vendedor ya tiene un usuario asociado.");
  });

  it("deja pasar cuando el vendedor no tiene usuario asociado", async () => {
    const supabase = fakeSupabase({ data: null });
    const result = await preflightSalespersonTaken(supabase, "sp-rpt");
    expect(result).toBeNull();
  });

  it("deja pasar sin consultar la base cuando no hay salesperson_id (ADMIN)", async () => {
    const supabase = fakeSupabase({ data: null });
    const result = await preflightSalespersonTaken(supabase, null);
    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("resolveCurrentOrganizationId (CORE 1)", () => {
  it("devuelve organizationId cuando el RPC resuelve una sola organización", async () => {
    const supabase = fakeRpcSupabase({ data: ORG_ID, error: null });
    const result = await resolveCurrentOrganizationId(supabase);
    expect(result).toEqual({ organizationId: ORG_ID });
  });

  it("devuelve error legible si el RPC falla (ej. current_user_organization_id() lanzó excepción por >1 membership)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = fakeRpcSupabase({ data: null, error: { message: "más de una organización", code: "P0001" } });
    const result = await resolveCurrentOrganizationId(supabase);
    expect(result).toEqual({ error: "No se pudo determinar tu organización. Contacta a soporte." });
    consoleSpy.mockRestore();
  });

  it("devuelve error explícito (no silencioso) si el usuario no tiene ninguna membership", async () => {
    const supabase = fakeRpcSupabase({ data: null, error: null });
    const result = await resolveCurrentOrganizationId(supabase);
    expect(result).toEqual({ error: "Tu usuario no tiene una organización asociada. Contacta a soporte." });
  });
});

describe("updateUserRoleAndActive (CORE 1 — RPC atómico admin_update_user_role_and_active)", () => {
  it("CASO F/G: sincroniza role (vendedor->admin y admin->vendedor) llamando al RPC atómico", async () => {
    const supabase = fakeRpcSupabase({ data: null, error: null });
    const result = await updateUserRoleAndActive(supabase, "u1", "admin", true);
    expect(result).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("admin_update_user_role_and_active", {
      p_user_id: "u1",
      p_role: "admin",
      p_active: true,
    });
  });

  it("CASO H/I: sincroniza active (desactivar y reactivar) llamando al RPC atómico", async () => {
    const supabase = fakeRpcSupabase({ data: null, error: null });
    expect(await updateUserRoleAndActive(supabase, "u1", "vendedor", false)).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("admin_update_user_role_and_active", {
      p_user_id: "u1",
      p_role: "vendedor",
      p_active: false,
    });
  });

  it("CASO J/K/L/M: si el RPC falla (rollback interno, target de otra org, no-admin, admin de otra org), devuelve el mensaje de la excepción de Postgres (P0001 pasa tal cual) y lo registra en logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pgMessage =
      "admin_update_user_role_and_active: no se encontró una membership de u1 en tu organización, o no tienes permiso para modificarla.";
    const supabase = fakeRpcSupabase({ data: null, error: { message: pgMessage, code: "P0001" } });

    const result = await updateUserRoleAndActive(supabase, "u1", "admin", true);

    expect(result).toBe(pgMessage);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usuarios] admin_update_user_role_and_active() falló",
      expect.objectContaining({ userId: "u1", message: pgMessage, code: "P0001" })
    );
    consoleSpy.mockRestore();
  });

  it("error desconocido (código no P0001) -> mensaje genérico de fallback, no expone detalle técnico", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase = fakeRpcSupabase({ data: null, error: { message: "connection reset", code: "XX000" } });

    const result = await updateUserRoleAndActive(supabase, "u1", "admin", true);

    expect(result).toBe("No se pudieron guardar los cambios de rol/estado.");
    consoleSpy.mockRestore();
  });
});

describe("insertProfileAndMembershipOrCompensate (CASO L/M/N/O)", () => {
  it("CASO L: éxito -> inserta user_profiles, organization_members Y crea/vincula la Person (RPC), nunca llama deleteUser", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabaseTwoTables({ user_profiles: { error: null }, organization_members: { error: null } });

    const result = await insertProfileAndMembershipOrCompensate(admin, supabase, "new-auth-user-id", ORG_ID, basePayload);

    expect(result).toEqual({ ok: true });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith("rpc_create_person_for_user", {
      p_user_id: "new-auth-user-id",
      p_organization_id: ORG_ID,
      p_name: basePayload.name,
      p_email: basePayload.email,
      p_active: basePayload.active,
    });
  });

  it("CASO M: falla user_profiles -> compensa eliminando SOLO el usuario Auth recién creado", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabaseTwoTables({ user_profiles: { error: { code: "23505", message: "duplicate key" } } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileAndMembershipOrCompensate(admin, supabase, "brand-new-auth-id", ORG_ID, basePayload);

    expect(result).toEqual({ error: "Ya existe un registro con esos datos." });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("brand-new-auth-id");
    consoleSpy.mockRestore();
  });

  it("CASO N: user_profiles OK pero falla organization_members -> compensa igual (la cascada revierte ambas filas)", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabaseTwoTables({
      user_profiles: { error: null },
      organization_members: { error: { code: "23503", message: "fk violation" } },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileAndMembershipOrCompensate(admin, supabase, "brand-new-auth-id-2", ORG_ID, basePayload);

    expect("error" in result).toBe(true);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("brand-new-auth-id-2");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usuarios] alta revertida en Auth tras fallo",
      expect.objectContaining({ authUserId: "brand-new-auth-id-2", failedStep: expect.stringContaining("organization_members") })
    );
    consoleSpy.mockRestore();
  });

  it("CASO N (compensación también falla): el error queda documentado server-side, no en silencio", async () => {
    const deleteUser = vi.fn(async () => ({ error: { message: "network error" } }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabaseTwoTables({
      user_profiles: { error: null },
      organization_members: { error: { code: "23514", message: "check violation" } },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileAndMembershipOrCompensate(admin, supabase, "orphan-candidate-id", ORG_ID, basePayload);

    expect("error" in result).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usuarios] compensación fallida: no se pudo eliminar el usuario Auth huérfano",
      expect.objectContaining({ authUserId: "orphan-candidate-id" })
    );
    consoleSpy.mockRestore();
  });

  it("CASO O (CORE 2C): user_profiles y organization_members OK pero falla rpc_create_person_for_user -> compensa igual (su propia transacción ya se revirtió, sin Person huérfana)", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabaseTwoTables({
      user_profiles: { error: null },
      organization_members: { error: null },
      rpc: { error: { code: "P0001", message: "rpc_create_person_for_user: no se pudo vincular la Person" } },
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileAndMembershipOrCompensate(admin, supabase, "brand-new-auth-id-3", ORG_ID, basePayload);

    expect("error" in result).toBe(true);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("brand-new-auth-id-3");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usuarios] alta revertida en Auth tras fallo",
      expect.objectContaining({ authUserId: "brand-new-auth-id-3", failedStep: expect.stringContaining("rpc_create_person_for_user") })
    );
    consoleSpy.mockRestore();
  });
});

describe("buildSetPasswordLink", () => {
  it("CASO A: usuario nuevo (invite) -> URL de nuestra app con token_hash y type, sin action_link", () => {
    const link = buildSetPasswordLink("https://gs-orders.vercel.app", "raw-token-abc123", "invite");
    const url = new URL(link);

    expect(url.origin + url.pathname).toBe("https://gs-orders.vercel.app/set-password");
    expect(url.searchParams.get("token_hash")).toBe("raw-token-abc123");
    expect(url.searchParams.get("type")).toBe("invite");
    expect(link).not.toContain("/auth/v1/verify");
  });

  it("CASO B: usuario existente (recovery) -> URL de nuestra app con token_hash y type", () => {
    const link = buildSetPasswordLink("https://gs-orders.vercel.app", "raw-token-xyz789", "recovery");
    const url = new URL(link);

    expect(url.origin + url.pathname).toBe("https://gs-orders.vercel.app/set-password");
    expect(url.searchParams.get("token_hash")).toBe("raw-token-xyz789");
    expect(url.searchParams.get("type")).toBe("recovery");
  });

  it("CASO C: token_hash con caracteres especiales queda correctamente URL-encoded", () => {
    const trickyToken = "abc+def/ghi=jkl&mno=pqr xyz";
    const link = buildSetPasswordLink("https://gs-orders.vercel.app", trickyToken, "recovery");

    // La URL cruda nunca debe contener el separador de query sin encodear
    // partiendo el token en dos parámetros falsos.
    expect(link).not.toContain("mno=pqr xyz&"); // habría partido el param si no se hubiera encodeado
    // Y el valor debe recuperarse intacto al des-parsear la URL.
    const url = new URL(link);
    expect(url.searchParams.get("token_hash")).toBe(trickyToken);
  });

  it("respeta NEXT_PUBLIC_SITE_URL/getSiteUrl() pasado como siteUrl, sin hardcodear el dominio", () => {
    const link = buildSetPasswordLink("https://otro-dominio.example", "tok", "invite");
    expect(link.startsWith("https://otro-dominio.example/set-password?")).toBe(true);
  });
});

describe("resolveSetPasswordRedemption", () => {
  const params = (entries: Record<string, string>) => ({
    get: (name: string) => entries[name] ?? null,
  });

  it("CASO E: type=invite válido -> acción verify con token_hash y type correctos", () => {
    const result = resolveSetPasswordRedemption(params({ token_hash: "tok-invite", type: "invite" }));
    expect(result).toEqual({ action: "verify", params: { token_hash: "tok-invite", type: "invite" } });
  });

  it("CASO F: type=recovery válido -> acción verify con token_hash y type correctos", () => {
    const result = resolveSetPasswordRedemption(params({ token_hash: "tok-recovery", type: "recovery" }));
    expect(result).toEqual({ action: "verify", params: { token_hash: "tok-recovery", type: "recovery" } });
  });

  it("CASO D: type no soportado (ej. magiclink, signup, basura) -> invalid", () => {
    expect(resolveSetPasswordRedemption(params({ token_hash: "tok", type: "magiclink" }))).toEqual({
      action: "invalid",
    });
    expect(resolveSetPasswordRedemption(params({ token_hash: "tok", type: "signup" }))).toEqual({
      action: "invalid",
    });
    expect(resolveSetPasswordRedemption(params({ token_hash: "tok", type: "algo-inventado" }))).toEqual({
      action: "invalid",
    });
  });

  it("CASO D: falta token_hash -> invalid aunque el type sea válido", () => {
    expect(resolveSetPasswordRedemption(params({ type: "recovery" }))).toEqual({ action: "invalid" });
  });

  it("CASO D: falta type -> invalid aunque haya token_hash", () => {
    expect(resolveSetPasswordRedemption(params({ token_hash: "tok" }))).toEqual({ action: "invalid" });
  });

  it("CASO D: sin ningún parámetro -> invalid", () => {
    expect(resolveSetPasswordRedemption(params({}))).toEqual({ action: "invalid" });
  });
});
