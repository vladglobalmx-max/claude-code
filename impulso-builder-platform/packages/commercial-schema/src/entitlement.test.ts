import { describe, expect, it } from "vitest";
import { createEntitlementFixture } from "./testUtils/fixtures.js";
import { parseEntitlement, safeParseEntitlement } from "./entitlement.js";

describe("entitlementSchema — round-trip de serialización", () => {
  it("un Entitlement válido sobrevive JSON.stringify -> JSON.parse -> parseEntitlement sin pérdida", () => {
    const original = createEntitlementFixture();
    const roundTripped = parseEntitlement(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });

  it("admite pago único: sin expiresAt, sin devicePolicy", () => {
    const oneTime = parseEntitlement({
      ...createEntitlementFixture(),
      expiresAt: undefined,
      devicePolicy: undefined,
    });
    expect(oneTime.expiresAt).toBeUndefined();
  });

  it("admite un trial con expiresAt corto y status 'expired'", () => {
    const trial = parseEntitlement({
      ...createEntitlementFixture(),
      status: "expired",
      expiresAt: "2026-01-08T00:00:00.000Z",
    });
    expect(trial.status).toBe("expired");
  });

  it("admite un bundle con múltiples featureIds bajo un solo entitlementId", () => {
    const bundle = parseEntitlement({
      ...createEntitlementFixture(),
      featureIds: ["sticker.core", "print.professional", "imposition.grid"],
    });
    expect(bundle.featureIds).toHaveLength(3);
  });

  it("admite origen promocional/interno", () => {
    const promo = parseEntitlement({ ...createEntitlementFixture(), source: "promotional" });
    expect(promo.source).toBe("promotional");
  });

  it("metadata por defecto es un objeto vacío cuando se omite", () => {
    const fixture = createEntitlementFixture();
    const withoutMetadata: Record<string, unknown> = { ...fixture };
    delete withoutMetadata.metadata;
    const parsed = parseEntitlement(withoutMetadata);
    expect(parsed.metadata).toEqual({});
  });
});

describe("entitlementSchema — validación", () => {
  it("rechaza un status fuera de la enumeración", () => {
    const result = safeParseEntitlement({
      ...createEntitlementFixture(),
      status: "made-up-status",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza issuedAt que no es un datetime ISO 8601 válido", () => {
    const result = safeParseEntitlement({
      ...createEntitlementFixture(),
      issuedAt: "no-es-una-fecha",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza subjectId vacío", () => {
    const result = safeParseEntitlement({ ...createEntitlementFixture(), subjectId: "" });
    expect(result.success).toBe(false);
  });

  it("rechaza featureIds ausente", () => {
    const fixture: Record<string, unknown> = { ...createEntitlementFixture() };
    delete fixture.featureIds;
    const result = safeParseEntitlement(fixture);
    expect(result.success).toBe(false);
  });
});
