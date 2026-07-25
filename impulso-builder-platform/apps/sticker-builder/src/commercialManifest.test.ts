import { describe, expect, it } from "vitest";
import { getCommercialManifest } from "./commercialManifest.js";

describe("getCommercialManifest", () => {
  it("carga el manifest real (commercial-product.json) sin diagnostics y con un provider que concede las capabilities reales", () => {
    const result = getCommercialManifest();
    expect(result.diagnostics).toEqual([]);
    expect(result.manifest?.productId).toBe("impulso-sticker-builder");
    expect(result.manifest?.edition).toBe("professional");
    expect(result.provider.has("print.professional")).toEqual({ granted: true, reason: "included" });
    expect(result.provider.has("sticker.core")).toEqual({ granted: true, reason: "included" });
  });

  it("no concede una capability que no está en el manifest real", () => {
    const result = getCommercialManifest();
    expect(result.provider.has("cloud-sync").granted).toBe(false);
  });

  it("memoiza el resultado — llamadas repetidas devuelven la misma referencia de provider", () => {
    const first = getCommercialManifest();
    const second = getCommercialManifest();
    expect(first.provider).toBe(second.provider);
  });
});
