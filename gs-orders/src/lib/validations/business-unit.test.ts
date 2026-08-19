import { describe, expect, it } from "vitest";
import {
  BUSINESS_UNIT_LOGO_MAX_SIZE_MB,
  businessUnitDetailsSchema,
  validateBusinessUnitLogoFile,
} from "./business-unit";

function makeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], "logo", { type });
}

describe("businessUnitDetailsSchema", () => {
  it("acepta name/active válidos", () => {
    const result = businessUnitDetailsSchema.safeParse({ name: "Juno Promotional", active: true });
    expect(result.success).toBe(true);
  });

  it("rechaza name vacío", () => {
    const result = businessUnitDetailsSchema.safeParse({ name: "   ", active: true });
    expect(result.success).toBe(false);
  });
});

describe("validateBusinessUnitLogoFile — TEST 14 (formato inválido)", () => {
  it("acepta PNG/JPEG/WebP", () => {
    expect(validateBusinessUnitLogoFile(makeFile("image/png", 1024))).toEqual({ extension: "png" });
    expect(validateBusinessUnitLogoFile(makeFile("image/jpeg", 1024))).toEqual({ extension: "jpg" });
    expect(validateBusinessUnitLogoFile(makeFile("image/webp", 1024))).toEqual({ extension: "webp" });
  });

  it("rechaza SVG (riesgo de XSS almacenado vía signed URL)", () => {
    const result = validateBusinessUnitLogoFile(makeFile("image/svg+xml", 1024));
    expect("error" in result).toBe(true);
  });

  it("rechaza formatos no soportados (ej. PDF, GIF)", () => {
    expect("error" in validateBusinessUnitLogoFile(makeFile("application/pdf", 1024))).toBe(true);
    expect("error" in validateBusinessUnitLogoFile(makeFile("image/gif", 1024))).toBe(true);
  });
});

describe("validateBusinessUnitLogoFile — TEST 15 (tamaño máximo)", () => {
  it(`acepta hasta ${BUSINESS_UNIT_LOGO_MAX_SIZE_MB} MB`, () => {
    const result = validateBusinessUnitLogoFile(makeFile("image/png", BUSINESS_UNIT_LOGO_MAX_SIZE_MB * 1024 * 1024));
    expect(result).toEqual({ extension: "png" });
  });

  it(`rechaza más de ${BUSINESS_UNIT_LOGO_MAX_SIZE_MB} MB`, () => {
    const result = validateBusinessUnitLogoFile(
      makeFile("image/png", BUSINESS_UNIT_LOGO_MAX_SIZE_MB * 1024 * 1024 + 1)
    );
    expect("error" in result).toBe(true);
  });
});
