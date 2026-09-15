import { describe, expect, it, vi } from "vitest";

// "server-only" siempre lanza fuera del bundler de Next (que lo sustituye
// por un no-op en bundles de servidor) — en Vitest (Node plano) hay que
// mockearlo para poder ejercitar branding.ts directamente.
vi.mock("server-only", () => ({}));

const { resolveBranding } = await import("./branding");

/**
 * THÖREN 0078 — branding con fallback. Ninguno de los 7 tipos de
 * documento tiene business_unit_id (Sales Orders y su cadena derivada no
 * tienen ese concepto, 0067) — en la práctica siempre se llama con
 * businessUnitId=null, así que el camino real hoy es SIEMPRE el fallback.
 * Estos tests fijan que ese camino nunca rompe la generación y que, si
 * algún día un tipo de documento sí resuelve una Business Unit, el logo se
 * firma con el cliente de sesión (RLS) — nunca con service role.
 */
function buildSupabaseStub(overrides: {
  organizationName?: string | null;
  businessUnit?: { name: string; logo_path: string | null } | null;
  signedUrl?: string | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "organizations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: overrides.organizationName != null ? { name: overrides.organizationName } : null }),
          }),
        }),
      };
    }
    if (table === "business_units") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: overrides.businessUnit ?? null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  const createSignedUrl = vi.fn(async () => ({ data: overrides.signedUrl ? { signedUrl: overrides.signedUrl } : null }));
  const storageFrom = vi.fn(() => ({ createSignedUrl }));

  return { from, storage: { from: storageFrom } } as unknown as Parameters<typeof resolveBranding>[0];
}

describe("resolveBranding (THÖREN 0078)", () => {
  it("sin businessUnitId -> fallback de texto, sin tocar Storage", async () => {
    const supabase = buildSupabaseStub({ organizationName: "GS Orders" });
    const branding = await resolveBranding(supabase, "org-1", null);

    expect(branding).toEqual({ logoUrl: null, organizationName: "GS Orders", businessUnitName: null });
    expect((supabase as any).storage.from).not.toHaveBeenCalled();
  });

  it("organización sin fila resoluble -> fallback 'THÖREN', nunca rompe la generación", async () => {
    const supabase = buildSupabaseStub({ organizationName: null });
    const branding = await resolveBranding(supabase, "org-inexistente", null);

    expect(branding.organizationName).toBe("THÖREN");
    expect(branding.logoUrl).toBeNull();
  });

  it("con businessUnitId pero sin logo_path -> nombre de BU, sin URL de logo", async () => {
    const supabase = buildSupabaseStub({
      organizationName: "GS Orders",
      businessUnit: { name: "Proyección", logo_path: null },
    });
    const branding = await resolveBranding(supabase, "org-1", "bu-1");

    expect(branding).toEqual({ logoUrl: null, organizationName: "GS Orders", businessUnitName: "Proyección" });
  });

  it("con logo_path -> firma la URL usando el cliente de SESIÓN recibido (nunca service role)", async () => {
    const supabase = buildSupabaseStub({
      organizationName: "GS Orders",
      businessUnit: { name: "Proyección", logo_path: "org-1/bu-1/logo.png" },
      signedUrl: "https://signed.example/logo.png",
    });
    const branding = await resolveBranding(supabase, "org-1", "bu-1");

    expect(branding.logoUrl).toBe("https://signed.example/logo.png");
    expect((supabase as any).storage.from).toHaveBeenCalledWith("business-unit-assets");
  });

  it("business_unit_id no resoluble (BU borrada/no pertenece) -> fallback sin romper", async () => {
    const supabase = buildSupabaseStub({ organizationName: "GS Orders", businessUnit: null });
    const branding = await resolveBranding(supabase, "org-1", "bu-inexistente");

    expect(branding).toEqual({ logoUrl: null, organizationName: "GS Orders", businessUnitName: null });
  });
});
