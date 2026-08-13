import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { preflightSalespersonTaken, insertProfileOrCompensate } from "./user-access";
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
