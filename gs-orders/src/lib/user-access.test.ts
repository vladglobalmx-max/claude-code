import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  preflightSalespersonTaken,
  insertProfileOrCompensate,
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

describe("insertProfileOrCompensate (CASO D)", () => {
  it("éxito: inserta el perfil y NUNCA llama deleteUser", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabase({ data: null }, { error: null });

    const result = await insertProfileOrCompensate(admin, supabase, "new-auth-user-id", basePayload);

    expect(result).toEqual({ ok: true });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("falla el insert -> compensa eliminando SOLO el usuario Auth recién creado, no uno preexistente", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabase(
      { data: null },
      { error: { code: "23505", message: "duplicate key" } }
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileOrCompensate(admin, supabase, "brand-new-auth-id", basePayload);

    expect(result).toEqual({ error: "Ya existe un registro con esos datos." });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith("brand-new-auth-id");
    consoleSpy.mockRestore();
  });

  it("falla el insert Y falla la compensación -> el error queda documentado server-side, no en silencio", async () => {
    const deleteUser = vi.fn(async () => ({ error: { message: "network error" } }));
    const admin = { auth: { admin: { deleteUser } } };
    const supabase = fakeSupabase({ data: null }, { error: { code: "23514", message: "check violation" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await insertProfileOrCompensate(admin, supabase, "orphan-candidate-id", basePayload);

    expect("error" in result).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[usuarios] compensación fallida: no se pudo eliminar el usuario Auth huérfano",
      expect.objectContaining({ authUserId: "orphan-candidate-id" })
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
