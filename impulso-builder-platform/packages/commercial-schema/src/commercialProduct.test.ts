import { describe, expect, it } from "vitest";
import { createStickerBuilderProfessionalFixture } from "./testUtils/fixtures.js";
import {
  parseCommercialProduct,
  safeParseCommercialProduct,
} from "./commercialProduct.js";

describe("commercialProductSchema — round-trip de serialización", () => {
  it("un CommercialProduct válido sobrevive JSON.stringify -> JSON.parse -> parseCommercialProduct sin pérdida", () => {
    const original = createStickerBuilderProfessionalFixture();
    const roundTripped = parseCommercialProduct(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });

  it("admite un bundle con múltiples módulos incluidos", () => {
    const bundle = parseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      productType: "bundle",
      includedModules: ["sticker-builder", "planner-builder"],
    });
    expect(bundle.includedModules).toHaveLength(2);
  });

  it("admite un producto sin priceReference (informativo, opcional)", () => {
    const fixture: Record<string, unknown> = { ...createStickerBuilderProfessionalFixture() };
    delete fixture.priceReference;
    const parsed = parseCommercialProduct(fixture);
    expect(parsed.priceReference).toBeUndefined();
  });

  it("admite un asset-pack sin ningún módulo incluido", () => {
    const assetPack = parseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      productType: "asset-pack",
      includedModules: [],
    });
    expect(assetPack.includedModules).toEqual([]);
  });

  it("metadata por defecto es un objeto vacío cuando se omite", () => {
    const fixture: Record<string, unknown> = { ...createStickerBuilderProfessionalFixture() };
    delete fixture.metadata;
    const parsed = parseCommercialProduct(fixture);
    expect(parsed.metadata).toEqual({});
  });
});

describe("commercialProductSchema — validación", () => {
  it("rechaza un productType fuera de la enumeración", () => {
    const result = safeParseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      productType: "subscription-tier",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un edition fuera de la enumeración", () => {
    const result = safeParseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      edition: "ultimate",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza priceReference con currency que no tiene 3 letras (ISO 4217)", () => {
    const result = safeParseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      priceReference: [{ amount: 29, currency: "US", channel: "gumroad" }],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza priceReference con amount negativo", () => {
    const result = safeParseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      priceReference: [{ amount: -1, currency: "USD", channel: "gumroad" }],
    });
    expect(result.success).toBe(false);
  });

  it("rechaza productId vacío", () => {
    const result = safeParseCommercialProduct({
      ...createStickerBuilderProfessionalFixture(),
      productId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza entitlementRequirements ausente", () => {
    const fixture: Record<string, unknown> = { ...createStickerBuilderProfessionalFixture() };
    delete fixture.entitlementRequirements;
    const result = safeParseCommercialProduct(fixture);
    expect(result.success).toBe(false);
  });
});
