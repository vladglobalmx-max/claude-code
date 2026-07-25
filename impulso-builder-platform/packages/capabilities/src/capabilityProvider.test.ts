import { describe, expect, it } from "vitest";
import type { ProductManifest } from "@impulso/commercial-schema";
import { createManifestCapabilityProvider, createOpenCapabilityProvider } from "./capabilityProvider.js";

const baseManifest: ProductManifest = {
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

describe("createOpenCapabilityProvider", () => {
  it("concede cualquier capability, incluida una inventada", () => {
    const provider = createOpenCapabilityProvider();
    expect(provider.has("print.professional")).toEqual({ granted: true, reason: "included" });
    expect(provider.has("una-capability-que-no-existe")).toEqual({ granted: true, reason: "included" });
  });
});

describe("createManifestCapabilityProvider", () => {
  it("concede una capability presente en el manifest", () => {
    const provider = createManifestCapabilityProvider(baseManifest);
    expect(provider.has("sticker.core")).toEqual({ granted: true, reason: "included" });
    expect(provider.has("print.professional")).toEqual({ granted: true, reason: "included" });
  });

  it("rechaza una capability ausente del manifest, con reason 'not-entitled'", () => {
    const provider = createManifestCapabilityProvider(baseManifest);
    expect(provider.has("cloud-sync")).toEqual({ granted: false, reason: "not-entitled" });
  });

  it("un manifest con capabilities vacío rechaza todo", () => {
    const provider = createManifestCapabilityProvider({ ...baseManifest, capabilities: [] });
    expect(provider.has("sticker.core").granted).toBe(false);
  });
});
