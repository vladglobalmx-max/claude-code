import { describe, expect, it } from "vitest";
import {
  BUSINESS_UNIT_LOGO_MAX_SIZE_MB,
  businessUnitCreateSchema,
  businessUnitDetailsSchema,
  slugifyBusinessUnitCode,
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

describe("businessUnitCreateSchema", () => {
  it("acepta name/code/active válidos", () => {
    const result = businessUnitCreateSchema.safeParse({ name: "Nueva Marca Industrial", code: "nueva_marca_industrial", active: true });
    expect(result.success).toBe(true);
  });

  it("acepta codes reales existentes (got_fresh_breath, gtx_systems, etc.)", () => {
    for (const code of ["got_fresh_breath", "gtx_systems", "juno_promotional", "the_fire_spot", "thunder_led", "thunder_safety"]) {
      expect(businessUnitCreateSchema.safeParse({ name: "X", code, active: true }).success).toBe(true);
    }
  });

  it("rechaza name vacío", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "   ", code: "valido", active: true }).success).toBe(false);
  });

  it("rechaza code vacío", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "", active: true }).success).toBe(false);
  });

  it("rechaza code con mayúsculas", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "Nueva_Marca", active: true }).success).toBe(false);
  });

  it("rechaza code con espacios", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "nueva marca", active: true }).success).toBe(false);
  });

  it("rechaza code con acentos", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "márca", active: true }).success).toBe(false);
  });

  it("rechaza code que empieza con número", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "2026_division", active: true }).success).toBe(false);
  });

  it("acepta code con números después de la primera letra", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "industrial_2026", active: true }).success).toBe(true);
  });

  it("rechaza code de 1 solo caracter", () => {
    expect(businessUnitCreateSchema.safeParse({ name: "X", code: "a", active: true }).success).toBe(false);
  });
});

describe("slugifyBusinessUnitCode", () => {
  it("convierte nombre simple a snake_case", () => {
    expect(slugifyBusinessUnitCode("Nueva Marca Industrial")).toBe("nueva_marca_industrial");
  });

  it("quita acentos", () => {
    expect(slugifyBusinessUnitCode("Diseño Rápido")).toBe("diseno_rapido");
  });

  it("preserva números", () => {
    expect(slugifyBusinessUnitCode("Industrial 2026")).toBe("industrial_2026");
  });

  it("colapsa separadores repetidos y recorta guiones bajos en los extremos", () => {
    expect(slugifyBusinessUnitCode("  --Juno   Promotional!!  ")).toBe("juno_promotional");
  });

  it("el resultado siempre cumple el mismo patrón exigido por businessUnitCreateSchema (cuando empieza con letra)", () => {
    const slug = slugifyBusinessUnitCode("Got Fresh Breath");
    expect(businessUnitCreateSchema.safeParse({ name: "Got Fresh Breath", code: slug, active: true }).success).toBe(true);
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
