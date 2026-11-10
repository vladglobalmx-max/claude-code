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
const revalidatePath = vi.fn();

// THÖREN | DIAGNÓSTICO FINAL DE PERSISTENCIA BUSINESS UNITS — updateUserBusinessUnits
// ahora relee person_business_units después de llamar al RPC y compara
// contra lo solicitado. `lastRpcArgs` captura lo que se mandó al RPC;
// `verifyOverride` permite que un test simule explícitamente una
// persistencia que NO coincide (el incidente real) o un error de lectura;
// por defecto (sin override) la relectura simula que SÍ persistió
// exactamente lo solicitado, para que las pruebas de payload que no les
// interesa esta verificación sigan pasando sin configurarla.
let lastRpcArgs: { p_person_id?: string; p_business_unit_ids?: string[] } | null = null;
let verifyOverride: { data: unknown; error: unknown } | null = null;

const rpc = vi.fn(async (_name: string, args?: Record<string, unknown>): Promise<{ data: null; error: { message: string; code?: string } | null }> => {
  lastRpcArgs = (args ?? null) as typeof lastRpcArgs;
  return { data: null, error: null };
});
const maybeSingle = vi.fn(async () => ({ data: { person_id: "person-1" } }));
const verifyPersonBusinessUnits = vi.fn(async () => {
  if (verifyOverride) return verifyOverride;
  const requestedIds = lastRpcArgs?.p_business_unit_ids ?? [];
  return { data: requestedIds.map((id) => ({ business_unit_id: id })), error: null };
});

const createSupabaseServerClient = vi.fn(() => ({
  rpc,
  from: vi.fn((table: string) => {
    if (table === "user_profiles") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) };
    }
    if (table === "person_business_units") {
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: verifyPersonBusinessUnits })) })) };
    }
    throw new Error(`mock sin configurar para la tabla: ${table}`);
  }),
}));

vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: () => getCurrentProfile() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
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

function resetSharedMockState() {
  vi.clearAllMocks();
  lastRpcArgs = null;
  verifyOverride = null;
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
  afterEach(resetSharedMockState);

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
  afterEach(resetSharedMockState);

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

/**
 * THÖREN | DIAGNÓSTICO FINAL DE PERSISTENCIA BUSINESS UNITS — un caso real
 * de producción mostró rpc_set_person_business_units devolviendo éxito
 * (sin excepción) sin que la asignación solicitada quedara realmente
 * activa en person_business_units (0 filas confirmadas directamente en la
 * tabla). Como los 3 únicos caminos de rechazo del RPC quedaron
 * descartados con evidencia (misma organización, Business Unit válida y
 * activa, admin activo) y una prueba de integración de React confirmó que
 * el UUID correcto SÍ se envía desde la UI, la causa exacta del caso real
 * sigue sin reproducirse — por eso esta corrección no "arregla" una causa
 * puntual, sino que hace imposible que una escritura omitida (por
 * cualquier motivo, incluso uno no identificado todavía) se reporte como
 * éxito al usuario.
 */
describe("updateUserBusinessUnits — verificación post-escritura (no reportar éxito si no persistió)", () => {
  afterEach(resetSharedMockState);

  it("asignación correcta: el RPC no falla y la relectura coincide exactamente con lo solicitado -> ok:true", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());

    const result = await updateUserBusinessUnits("user-2", ["bu-juno"]);

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/configuracion/usuarios/user-2/editar");
    expect(revalidatePath).toHaveBeenCalledWith("/configuracion/usuarios");
  });

  it("falta de persistencia (el incidente real): el RPC no lanza ninguna excepción pero la relectura queda vacía -> error explícito, nunca ok:true", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());
    verifyOverride = { data: [], error: null }; // simula exactamente lo confirmado en producción: 0 filas tras una llamada "exitosa"

    const result = await updateUserBusinessUnits("user-2", ["bu-juno"]);

    expect(result).toEqual({
      error:
        "La asignación de Business Units no quedó guardada como se esperaba. No se realizó ningún cambio visible — vuelve a intentarlo o contacta soporte.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revocación intencional: se solicita un arreglo vacío y la relectura también queda vacía -> ok:true, nunca se reporta como fallo", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());

    const result = await updateUserBusinessUnits("user-2", []);

    expect(result).toEqual({ ok: true });
  });

  it("error del RPC: rpc_set_person_business_units devuelve error -> se retorna ese error y NUNCA se llega a verificar la persistencia", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Business Unit inválida o de otra organización.", code: "P0001" } });

    const result = await updateUserBusinessUnits("user-2", ["bu-de-otra-org"]);

    expect(result).toEqual({ error: "Business Unit inválida o de otra organización." });
    expect(verifyPersonBusinessUnits).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("error al verificar la relectura (fallo de lectura, no de escritura): se retorna un error distinguible, nunca ok:true", async () => {
    getCurrentProfile.mockResolvedValue(adminProfile());
    verifyOverride = { data: null, error: { message: "timeout", code: "57014" } };

    const result = await updateUserBusinessUnits("user-2", ["bu-juno"]);

    expect(result).toEqual({ error: "No se pudo verificar si las Business Units quedaron guardadas." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
