import { describe, expect, it } from "vitest";
import { buildPdfFilename, sanitizeFilenameSegment } from "./filename";

describe("sanitizeFilenameSegment (THÖREN 0078)", () => {
  it("conserva folios ya seguros tal cual", () => {
    expect(sanitizeFilenameSegment("SO-20261509-004")).toBe("SO-20261509-004");
  });

  it("quita acentos", () => {
    expect(sanitizeFilenameSegment("José Pérez Núñez")).toBe("Jose-Perez-Nunez");
  });

  it("reemplaza espacios y caracteres inseguros por guiones, sin duplicarlos", () => {
    expect(sanitizeFilenameSegment('Juan / "Comercial"  S.A.')).toBe("Juan-Comercial-S-A");
  });

  it("rechaza intentos de path traversal / caracteres de control", () => {
    expect(sanitizeFilenameSegment("../../etc/passwd")).not.toContain("..");
    expect(sanitizeFilenameSegment("../../etc/passwd")).not.toContain("/");
  });

  it("un segmento sin caracteres válidos sanitiza a vacío (buildPdfFilename decide el fallback)", () => {
    expect(sanitizeFilenameSegment("")).toBe("");
    expect(sanitizeFilenameSegment("***")).toBe("");
  });
});

describe("buildPdfFilename (THÖREN 0078)", () => {
  it("un solo folio -> {folio}.pdf", () => {
    expect(buildPdfFilename(["SO-20261509-004"])).toBe("SO-20261509-004.pdf");
  });

  it("comisión: COMISION-<folio-SO>-<vendedor>.pdf, vendedor sanitizado", () => {
    expect(buildPdfFilename(["COMISION", "SO-20261509-004", "José Pérez"])).toBe("COMISION-SO-20261509-004-Jose-Perez.pdf");
  });

  it("ignora partes que sanitizan a vacío en vez de dejar un guion suelto", () => {
    expect(buildPdfFilename(["OC-001", "", "***"])).toBe("OC-001.pdf");
  });

  it("si TODAS las partes sanitizan a vacío, cae a 'documento.pdf' — nunca un archivo sin nombre", () => {
    expect(buildPdfFilename(["", "***"])).toBe("documento.pdf");
  });
});
