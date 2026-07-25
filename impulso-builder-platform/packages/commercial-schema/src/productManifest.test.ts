import { describe, expect, it } from "vitest";
import { createStickerBuilderManifestFixture } from "./testUtils/fixtures.js";
import {
  PRODUCT_MANIFEST_SCHEMA_VERSION,
  parseProductManifest,
  safeParseProductManifest,
} from "./productManifest.js";

describe("productManifestSchema — round-trip de serialización", () => {
  it("un ProductManifest válido sobrevive JSON.stringify -> JSON.parse -> parseProductManifest sin pérdida", () => {
    const original = createStickerBuilderManifestFixture();
    const roundTripped = parseProductManifest(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });

  it("admite support.email/docsUrl nulos", () => {
    const manifest = parseProductManifest({
      ...createStickerBuilderManifestFixture(),
      support: { email: null, docsUrl: null },
    });
    expect(manifest.support.email).toBeNull();
  });

  it("admite los 3 updateChannel válidos", () => {
    for (const updateChannel of ["stable", "beta", "internal"] as const) {
      const result = safeParseProductManifest({
        ...createStickerBuilderManifestFixture(),
        updateChannel,
      });
      expect(result.success).toBe(true);
    }
  });

  it("licensingMode admite un modo futuro no anticipado hoy (string abierto)", () => {
    const manifest = parseProductManifest({
      ...createStickerBuilderManifestFixture(),
      licensingMode: "account-bound",
    });
    expect(manifest.licensingMode).toBe("account-bound");
  });

  it("admite legal.*Path nulos (paquete sin documentos legales todavía)", () => {
    const manifest = parseProductManifest({
      ...createStickerBuilderManifestFixture(),
      legal: { eulaPath: null, privacyPath: null, thirdPartyLicensesPath: null },
    });
    expect(manifest.legal.eulaPath).toBeNull();
  });

  it("admite legal.*Path con rutas relativas reales dentro del paquete", () => {
    const manifest = parseProductManifest({
      ...createStickerBuilderManifestFixture(),
      legal: {
        eulaPath: "legal/EULA.md",
        privacyPath: "legal/PRIVACIDAD.md",
        thirdPartyLicensesPath: "legal/LICENCIAS-TERCEROS.md",
      },
    });
    expect(manifest.legal.eulaPath).toBe("legal/EULA.md");
  });

  it("admite buildMetadata.buildId y releaseMetadata reales", () => {
    const manifest = parseProductManifest({
      ...createStickerBuilderManifestFixture(),
      buildMetadata: { builtAt: "2026-07-25T00:00:00.000Z", commit: "abc1234", buildId: "build-0001" },
      releaseMetadata: { releaseDate: "2026-07-25", releaseNotesPath: "docs/RELEASE-NOTES.md" },
    });
    expect(manifest.buildMetadata.buildId).toBe("build-0001");
    expect(manifest.releaseMetadata.releaseNotesPath).toBe("docs/RELEASE-NOTES.md");
  });
});

describe("productManifestSchema — validación", () => {
  it("rechaza un schemaVersion distinto de la versión actual", () => {
    const result = safeParseProductManifest({
      ...createStickerBuilderManifestFixture(),
      schemaVersion: PRODUCT_MANIFEST_SCHEMA_VERSION + 1,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un updateChannel fuera de la enumeración", () => {
    const result = safeParseProductManifest({
      ...createStickerBuilderManifestFixture(),
      updateChannel: "nightly",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un support.email con formato inválido", () => {
    const result = safeParseProductManifest({
      ...createStickerBuilderManifestFixture(),
      support: { email: "no-es-un-email", docsUrl: null },
    });
    expect(result.success).toBe(false);
  });

  it("rechaza licensingMode vacío", () => {
    const result = safeParseProductManifest({
      ...createStickerBuilderManifestFixture(),
      licensingMode: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza branding ausente", () => {
    const fixture: Record<string, unknown> = { ...createStickerBuilderManifestFixture() };
    delete fixture.branding;
    const result = safeParseProductManifest(fixture);
    expect(result.success).toBe(false);
  });
});
