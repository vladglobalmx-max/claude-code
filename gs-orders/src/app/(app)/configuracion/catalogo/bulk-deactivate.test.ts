import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentProfile = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: (...args: unknown[]) => getCurrentProfile(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { bulkDeactivateCatalogProducts } = await import("./actions");

type Filter = { method: string; args: unknown[] };

function createFakeSupabase(opts: {
  orgId?: string | null;
  orgError?: { message: string; code?: string } | null;
  selectResult: { data: unknown; error: unknown };
}) {
  const filters: Filter[] = [];
  const rpc = vi.fn(async () => ({ data: opts.orgId ?? null, error: opts.orgError ?? null }));
  const chain: any = {
    update: (payload: unknown) => {
      filters.push({ method: "update", args: [payload] });
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      filters.push({ method: "in", args: [col, vals] });
      return chain;
    },
    eq: (col: string, val: unknown) => {
      filters.push({ method: "eq", args: [col, val] });
      return chain;
    },
    select: async () => opts.selectResult,
  };
  const from = vi.fn((table: string) => {
    if (table !== "product_catalog") throw new Error(`unexpected table: ${table}`);
    return chain;
  });
  return { client: { rpc, from }, filters };
}

/**
 * Ajuste de cierre — selección múltiple + eliminación (soft-delete) del
 * Catálogo. Fija el contrato de bulkDeactivateCatalogProducts: autoridad
 * (mismo criterio que layout.tsx: profile.role === "admin", repetido aquí
 * porque una Server Action se puede invocar directo sin pasar por ese
 * guard), cross-org (defensa en profundidad .eq("organization_id", ...),
 * mismo patrón que bulkAssignProductType), y que la escritura sea
 * EXCLUSIVAMENTE `{ active: false }` — nunca borra ni toca otra
 * columna/tabla (garantiza SKU/nombre/snapshots históricos intactos).
 */
describe("bulkDeactivateCatalogProducts (ajuste de cierre — Catálogo)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lista vacía -> rechazado sin tocar el backend", async () => {
    const result = await bulkDeactivateCatalogProducts([]);
    expect(result).toEqual({ error: "Selecciona al menos un producto.", updatedCount: 0 });
    expect(getCurrentProfile).not.toHaveBeenCalled();
  });

  it("usuario sin permiso (no admin) -> rechazado, nunca llega a la base de datos", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "vendedor", active: true });
    const { client } = createFakeSupabase({ orgId: "org-1", selectResult: { data: [], error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(["p-1"]);

    expect(result.error).toBe("Solo un administrador puede eliminar productos del catálogo.");
    expect(result.updatedCount).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("usuario admin pero inactivo -> rechazado", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: false });

    const result = await bulkDeactivateCatalogProducts(["p-1"]);

    expect(result.error).toBe("Solo un administrador puede eliminar productos del catálogo.");
  });

  it("admin activo -> desactiva EXCLUSIVAMENTE active=false, con cross-org y not-already-inactive en el WHERE", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const { client, filters } = createFakeSupabase({
      orgId: "org-1",
      selectResult: { data: [{ id: "p-1" }, { id: "p-2" }], error: null },
    });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(["p-1", "p-2"]);

    expect(result).toEqual({ error: null, updatedCount: 2 });

    const updateCall = filters.find((f) => f.method === "update");
    expect(updateCall?.args[0]).toEqual({ active: false });

    const inCall = filters.find((f) => f.method === "in");
    expect(inCall?.args).toEqual(["id", ["p-1", "p-2"]]);

    const eqCalls = filters.filter((f) => f.method === "eq").map((f) => f.args);
    expect(eqCalls).toEqual(
      expect.arrayContaining([
        ["organization_id", "org-1"],
        ["active", true],
      ])
    );
  });

  it("cross-org: ids de otra organización quedan fuera de updatedCount (RLS + .eq('organization_id', ...) los excluye del UPDATE)", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    // Simula que, de los 2 ids pedidos, solo 1 pertenecía a la organización del usuario.
    const { client } = createFakeSupabase({ orgId: "org-1", selectResult: { data: [{ id: "p-1" }], error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(["p-1", "p-de-otra-org"]);

    expect(result).toEqual({ error: null, updatedCount: 1 });
  });

  it("organización no resoluble -> rechazado, mensaje de resolveCurrentOrganizationId", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const { client } = createFakeSupabase({ orgId: null, selectResult: { data: [], error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(["p-1"]);

    expect(result.error).toBe("Tu usuario no tiene una organización asociada. Contacta a soporte.");
    expect(result.updatedCount).toBe(0);
  });

  it("error de base de datos -> mensaje traducido, updatedCount 0", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const { client } = createFakeSupabase({
      orgId: "org-1",
      selectResult: { data: null, error: { code: "XXYYY", message: "boom" } },
    });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(["p-1"]);

    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });
});
