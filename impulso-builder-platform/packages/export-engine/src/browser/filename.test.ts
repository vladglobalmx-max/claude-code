import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./filename.js";
import { ExportError } from "../errors.js";

describe("sanitizeFilename", () => {
  it("acepta un nombre simple sin cambios", () => {
    expect(sanitizeFilename("mi-sticker")).toBe("mi-sticker");
  });

  it("recorta espacios en blanco", () => {
    expect(sanitizeFilename("  sticker  ")).toBe("sticker");
  });

  it("reemplaza caracteres ilegales por _", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("lanza invalid_filename si está vacío", () => {
    expect(() => sanitizeFilename("")).toThrow(ExportError);
    expect(() => sanitizeFilename("   ")).toThrow(ExportError);
  });

  it("caracteres ilegales se sustituyen por _, nunca se descartan (no puede vaciar el nombre)", () => {
    expect(sanitizeFilename("///")).toBe("___");
  });

  it("acota a 150 caracteres", () => {
    const long = "a".repeat(300);
    expect(sanitizeFilename(long)).toHaveLength(150);
  });

  it("el error tiene code invalid_filename", () => {
    try {
      sanitizeFilename("");
      expect.unreachable();
    } catch (error) {
      expect((error as ExportError).code).toBe("invalid_filename");
    }
  });
});
