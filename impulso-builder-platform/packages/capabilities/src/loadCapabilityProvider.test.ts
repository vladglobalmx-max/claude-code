import { describe, expect, it } from "vitest";
import { loadCapabilityProvider } from "./loadCapabilityProvider.js";

const validManifest = {
  schemaVersion: 1,
  productId: "impulso-sticker-builder",
  slug: "sticker-builder",
  productVersion: "1.0.0",
  edition: "professional",
  modules: ["sticker-builder"],
  capabilities: ["sticker.core", "print.professional"],
  branding: { displayName: "Impulso Sticker Builder Professional", shortName: "Impulso Sticker Builder" },
  support: { email: "soporte@example.com", docsUrl: null },
  updateChannel: "stable",
  licensingMode: "delivery-only",
  channel: "gumroad",
  termsReference: null,
  legal: { eulaPath: null, privacyPath: null, thirdPartyLicensesPath: null },
  buildMetadata: { builtAt: null, commit: null, buildId: null },
  releaseMetadata: { releaseDate: null, releaseNotesPath: null },
};

describe("loadCapabilityProvider — manifest válido", () => {
  it("devuelve el manifest parseado, un provider real, y diagnostics vacío", () => {
    const result = loadCapabilityProvider(validManifest);
    expect(result.manifest).not.toBeNull();
    expect(result.diagnostics).toEqual([]);
    expect(result.provider.has("print.professional")).toEqual({ granted: true, reason: "included" });
    expect(result.provider.has("cloud-sync")).toEqual({ granted: false, reason: "not-entitled" });
  });
});

describe("loadCapabilityProvider — manifest inválido, onInvalid por defecto ('open-fallback')", () => {
  it("un manifest sin productId cae a manifest:null + provider abierto + diagnostics no vacío", () => {
    const broken: Record<string, unknown> = { ...validManifest };
    delete broken.productId;
    const result = loadCapabilityProvider(broken);
    expect(result.manifest).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]).toContain("productId");
    // El fallback nunca es silencioso: concede todo (mismo comportamiento
    // que hoy sin gating), pero el llamador siempre puede saber que pasó.
    expect(result.provider.has("cualquier-cosa")).toEqual({ granted: true, reason: "included" });
  });

  it("JSON completamente ajeno al schema también cae a open-fallback con diagnostics", () => {
    const result = loadCapabilityProvider({ foo: "bar" });
    expect(result.manifest).toBeNull();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.provider.has("sticker.core").granted).toBe(true);
  });

  it("un valor que no es ni siquiera un objeto produce un diagnóstico a nivel raíz ('(raíz)')", () => {
    const result = loadCapabilityProvider(null);
    expect(result.manifest).toBeNull();
    expect(result.diagnostics[0]).toContain("(raíz)");
  });
});

describe("loadCapabilityProvider — onInvalid: 'throw'", () => {
  it("lanza con un mensaje diagnosticable en vez de caer a fallback", () => {
    const broken: Record<string, unknown> = { ...validManifest };
    delete broken.productId;
    expect(() => loadCapabilityProvider(broken, { onInvalid: "throw" })).toThrow(/productId/);
  });

  it("un manifest válido nunca lanza, incluso en modo 'throw'", () => {
    expect(() => loadCapabilityProvider(validManifest, { onInvalid: "throw" })).not.toThrow();
  });
});
