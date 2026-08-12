import { describe, expect, it } from "vitest";
import { computeFolioPreview } from "./folio-preview";

describe("computeFolioPreview", () => {
  it("usa AAAA + DD + MM, nunca AAAA + MM + DD", () => {
    // 11 de agosto de 2026 -> 2026 + 11 + 08
    expect(computeFolioPreview("VPT", 0, "2026-08-11")).toBe("VPT-20261108-001");
  });

  it("cambia el mes/día en el orden correcto para el día 12", () => {
    // 12 de agosto de 2026 -> 2026 + 12 + 08 (no 20260812)
    expect(computeFolioPreview("VPT", 2, "2026-08-12")).toBe("VPT-20261208-003");
  });

  it("rellena el consecutivo con ceros a la izquierda hasta 3 dígitos", () => {
    expect(computeFolioPreview("KST", 0, "2026-08-11")).toBe("KST-20261108-001");
    expect(computeFolioPreview("KST", 9, "2026-08-11")).toBe("KST-20261108-010");
    expect(computeFolioPreview("KST", 99, "2026-08-11")).toBe("KST-20261108-100");
  });

  it("cada vendedor mantiene su propio consecutivo de forma independiente", () => {
    expect(computeFolioPreview("VPT", 2, "2026-08-12")).toBe("VPT-20261208-003");
    expect(computeFolioPreview("KST", 1, "2026-08-12")).toBe("KST-20261208-002");
  });

  it("regresa null si falta el prefijo o la fecha", () => {
    expect(computeFolioPreview(null, 0, "2026-08-11")).toBeNull();
    expect(computeFolioPreview("VPT", 0, "")).toBeNull();
    expect(computeFolioPreview("VPT", 0, null)).toBeNull();
  });

  it("regresa null ante una fecha mal formada", () => {
    expect(computeFolioPreview("VPT", 0, "2026-8-1")).toBeNull();
  });
});
