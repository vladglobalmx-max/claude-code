import { describe, it, expect } from "vitest";
import { sanitizeFilenamePart, buildQuotePdfFilename } from "./filename";

describe("sanitizeFilenamePart", () => {
  it("quita caracteres inválidos para nombre de archivo", () => {
    expect(sanitizeFilenamePart('Posco / MPPC: "Norte" <2026>')).toBe("Posco MPPC Norte 2026");
  });

  it("colapsa espacios repetidos y recorta extremos", () => {
    expect(sanitizeFilenamePart("  Cliente   Con   Espacios  ")).toBe("Cliente Con Espacios");
  });
});

describe("buildQuotePdfFilename", () => {
  it('arma "{FOLIO} - {CLIENTE}"', () => {
    expect(buildQuotePdfFilename("VPT-20261608-001", "Posco MPPC")).toBe("VPT-20261608-001 - Posco MPPC");
  });

  it("sanitiza ambas partes antes de unirlas", () => {
    expect(buildQuotePdfFilename("VPT-001", 'Cliente "Norte"/Sur')).toBe("VPT-001 - Cliente NorteSur");
  });

  it("cae a THÖREN si ambas partes quedan vacías", () => {
    expect(buildQuotePdfFilename("", "")).toBe("THÖREN");
  });
});
