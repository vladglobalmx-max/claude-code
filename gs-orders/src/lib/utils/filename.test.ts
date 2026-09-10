import { describe, it, expect } from "vitest";
import { sanitizeFilenamePart, buildQuotePdfFilename, buildOrderPdfFilename } from "./filename";

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

describe("buildOrderPdfFilename (THÖREN — bug de PDF con título 'THÖREN')", () => {
  it('arma "Pedido-{FOLIO}" para usarlo como document.title', () => {
    expect(buildOrderPdfFilename("KST-20261009-010")).toBe("Pedido-KST-20261009-010");
  });

  it("sanitiza el folio antes de usarlo", () => {
    expect(buildOrderPdfFilename('KST/2026"010')).toBe("Pedido-KST2026010");
  });

  it("cae a THÖREN si el folio queda vacío tras sanitizar — nunca al literal folio ausente", () => {
    expect(buildOrderPdfFilename("")).toBe("THÖREN");
  });

  it("el folio real nunca se reemplaza por el texto hardcodeado 'THÖREN'", () => {
    const filename = buildOrderPdfFilename("KST-20261009-010");
    expect(filename).toContain("KST-20261009-010");
    expect(filename).not.toBe("THÖREN");
  });

  it('en inglés (documento de Proveedor) arma "Purchase-Order-{FOLIO}", con el folio real visible', () => {
    const filename = buildOrderPdfFilename("KST-20261009-010", "en");
    expect(filename).toBe("Purchase-Order-KST-20261009-010");
    expect(filename).toContain("KST-20261009-010");
  });

  it('sin idioma (default) sigue siendo "Pedido-{FOLIO}" — el default no cambia comportamiento existente', () => {
    expect(buildOrderPdfFilename("KST-20261009-010")).toBe("Pedido-KST-20261009-010");
  });
});
