import { afterEach, describe, expect, it, vi } from "vitest";

const getCurrentProfile = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: (...args: unknown[]) => getCurrentProfile(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClient(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { bulkDeactivateCatalogProducts, bulkDeactivateAllMatchingCatalogProducts } = await import("./actions");

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

  /**
   * Fix de bug de cierre — segunda capa de defensa: aunque la UI ya no
   * debería poder acumular selección entre páginas (catalog-selection-table.tsx),
   * el backend nunca debe confiar únicamente en eso. Reproduce el caso
   * real de producción: un payload de 1,296 ids (acumulado por el bug de
   * selección) debe rechazarse con un mensaje legible, ANTES de intentar
   * ningún `.in("id", ids)` — eso es lo que producía el Bad Request
   * genérico (URL de PostgREST demasiado grande).
   */
  it("payload por encima del límite (ej. 1,296 ids del bug de selección) -> rechazado con mensaje legible, nunca llega a la base de datos", async () => {
    const tooManyIds = Array.from({ length: 1296 }, (_, i) => `p-${i}`);

    const result = await bulkDeactivateCatalogProducts(tooManyIds);

    expect(result.updatedCount).toBe(0);
    expect(result.error).toMatch(/no puedes eliminar más de \d+ productos a la vez/i);
    expect(getCurrentProfile).not.toHaveBeenCalled();
  });

  it("payload justo en el límite (100 ids) -> se acepta, no lo rechaza el guard de tamaño", async () => {
    const exactlyAtLimit = Array.from({ length: 100 }, (_, i) => `p-${i}`);
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const { client } = createFakeSupabase({
      orgId: "org-1",
      selectResult: { data: exactlyAtLimit.map((id) => ({ id })), error: null },
    });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateCatalogProducts(exactlyAtLimit);

    expect(result.error).toBeNull();
    expect(result.updatedCount).toBe(100);
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

/**
 * Ajuste operativo — "Seleccionar todos los que coinciden con los
 * filtros". bulkDeactivateAllMatchingCatalogProducts NUNCA recibe ni
 * construye una lista de ids — delega el conjunto completo a
 * rpc_bulk_deactivate_catalog_products_by_filters (0078), que resuelve
 * organización/autoridad admin/active=true/bu/tipo DENTRO de Postgres. La
 * seguridad real (cross-org, soft-delete, históricos intactos) se prueba
 * contra Postgres real en 0078_catalog_bulk_deactivate_by_filters_functional_tests.sql;
 * aquí solo se fija el contrato de la Server Action: qué llama, con qué
 * argumentos, y cómo traduce cada resultado posible del RPC.
 */
describe("bulkDeactivateAllMatchingCatalogProducts (ajuste operativo — seleccionar todos los que coinciden)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function createFakeSupabaseForRpc(opts: { rpcResult: { data: unknown; error: unknown } }) {
    const rpc = vi.fn(async () => opts.rpcResult);
    return { rpc };
  }

  it("usuario sin permiso (no admin) -> rechazado, nunca llama al RPC", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "vendedor", active: true });
    const client = createFakeSupabaseForRpc({ rpcResult: { data: 0, error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateAllMatchingCatalogProducts({ bu: "bu-juno" });

    expect(result).toEqual({ error: "Solo un administrador puede eliminar productos del catálogo.", updatedCount: 0 });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("usuario admin inactivo -> rechazado, nunca llama al RPC", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: false });
    const client = createFakeSupabaseForRpc({ rpcResult: { data: 0, error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateAllMatchingCatalogProducts({});

    expect(result.error).toBe("Solo un administrador puede eliminar productos del catálogo.");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("admin -> llama al RPC con p_bu/p_tipo tal cual, nunca con una lista de ids", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const client = createFakeSupabaseForRpc({ rpcResult: { data: 1296, error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateAllMatchingCatalogProducts({ bu: "bu-juno", tipo: "tipo-proyector" });

    expect(client.rpc).toHaveBeenCalledWith("rpc_bulk_deactivate_catalog_products_by_filters", {
      p_bu: "bu-juno",
      p_tipo: "tipo-proyector",
    });
    expect(result).toEqual({ error: null, updatedCount: 1296 });
  });

  it("filtros ausentes -> se envían como null (no undefined, no string vacío)", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const client = createFakeSupabaseForRpc({ rpcResult: { data: 5000, error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    await bulkDeactivateAllMatchingCatalogProducts({});

    expect(client.rpc).toHaveBeenCalledWith("rpc_bulk_deactivate_catalog_products_by_filters", { p_bu: null, p_tipo: null });
  });

  it("el resultado real del RPC (updatedCount) es lo que se devuelve, aunque haya cambiado desde que el usuario vio el conteo", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    // El usuario vio "1296" en pantalla, pero para cuando el RPC corrió, solo 1290 seguían activos coincidiendo con el filtro.
    const client = createFakeSupabaseForRpc({ rpcResult: { data: 1290, error: null } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateAllMatchingCatalogProducts({ bu: "bu-juno" });

    expect(result.updatedCount).toBe(1290);
  });

  it("error del RPC -> mensaje traducido, updatedCount 0", async () => {
    getCurrentProfile.mockResolvedValue({ userId: "u-1", role: "admin", active: true });
    const client = createFakeSupabaseForRpc({ rpcResult: { data: null, error: { code: "XXYYY", message: "boom" } } });
    createSupabaseServerClient.mockReturnValue(client);

    const result = await bulkDeactivateAllMatchingCatalogProducts({ bu: "bu-juno" });

    expect(result.updatedCount).toBe(0);
    expect(result.error).toBeTruthy();
  });
});
