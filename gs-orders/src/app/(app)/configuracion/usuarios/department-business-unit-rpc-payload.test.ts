import { afterEach, describe, expect, it, vi } from "vitest";

/** Misma forma que CurrentProfile (@/lib/auth/profile) — duplicada aquí para no importar ese módulo ("server-only") desde un test. */
interface FakeCurrentProfile {
  userId: string;
  email: string | null;
  name: string;
  role: "admin" | "vendedor";
  salespersonId: string | null;
  active: boolean;
}

const getCurrentProfile = vi.fn();
const rpc = vi.fn(async () => ({ data: null, error: null }));
const maybeSingle = vi.fn(async () => ({ data: { person_id: "person-1" } }));
const createSupabaseServerClient = vi.fn(() => ({
  rpc,
  from: vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
  })),
}));

vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: () => getCurrentProfile() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// actions.ts también importa estos tres módulos a nivel de archivo (para las
// demás Server Actions que no se ejercitan aquí) y todos empiezan con
// `import "server-only"` — sin mockearlos, vitest aborta la carga del
// módulo entero con "This module cannot be imported from a Client
// Component module", antes de llegar a ninguna prueba.
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ getSiteUrl: vi.fn(() => "https://example.test") }));
vi.mock("@/lib/auth/capabilities", () => ({ getCurrentCapabilities: vi.fn(async () => new Set<string>()) }));

const { updateUserDepartments, updateUserBusinessUnits } = await import("./actions");

function adminProfile(overrides: Partial<FakeCurrentProfile> = {}): FakeCurrentProfile {
  return {
    userId: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    salespersonId: null,
    active: true,
    ...overrides,
  };
}

/**
 * THÖREN | ERROR REAL EN PRODUCCIÓN — DEPARTAMENTO INVÁLIDO. rpc_set_user_departments
 * (0093) valida p_departments contra las claves LARGAS de capability
 * ("can_access_ventas"), nunca contra las claves cortas de DepartmentKey
 * ("ventas") que usa el fieldset de la UI. updateUserDepartments reenviaba
 * esas claves cortas sin traducir, así que el RPC rechazaba toda asignación
 * real con "Departamento inválido." sin escribir ninguna fila. Esta prueba
 * fija el contrato exacto: el valor que SALE hacia el RPC, no solo que se
 * haya llamado con ese nombre.
 */
describe("updateUserDepartments — payload exacto enviado al RPC", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("traduce cada DepartmentKey corto a su capability key larga antes de llamar a rpc_set_user_departments", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());

    const result = await updateUserDepartments("user-2", ["ventas", "compras"]);

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("rpc_set_user_departments", {
      p_user_id: "user-2",
      p_departments: ["can_access_ventas", "can_access_compras"],
    });
  });

  it("lista vacía se traduce a arreglo vacío, nunca a claves cortas", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());

    await updateUserDepartments("user-2", []);

    expect(rpc).toHaveBeenCalledWith("rpc_set_user_departments", {
      p_user_id: "user-2",
      p_departments: [],
    });
  });

  it("una clave corta inválida se rechaza antes de llamar al RPC", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());

    const result = await updateUserDepartments("user-2", ["ventas", "no-existe"]);

    expect(result).toEqual({ error: "Departamento inválido." });
    expect(rpc).not.toHaveBeenCalled();
  });
});

/**
 * Confirma la asimetría documentada en el diagnóstico: Business Units NO
 * tiene un catálogo corto intermedio — los ids que llegan de la UI ya son
 * los UUID reales de `business_units`, así que deben reenviarse SIN
 * transformación a rpc_set_person_business_units.
 */
describe("updateUserBusinessUnits — los UUID se transmiten sin transformación", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reenvía los business_unit_id recibidos exactamente igual, sin ningún mapeo", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());
    const businessUnitIds = ["bu-juno-promotional-uuid", "bu-thunder-led-uuid"];

    const result = await updateUserBusinessUnits("user-2", businessUnitIds);

    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("rpc_set_person_business_units", {
      p_person_id: "person-1",
      p_business_unit_ids: businessUnitIds,
    });
  });
});
