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

  it("acepta acentos/Unicode normal sin alterarlos", () => {
    expect(sanitizeFilename("Piñata café")).toBe("Piñata café");
  });

  it("trunca por CODE POINT, nunca partiendo un emoji (par subrogado) a la mitad — regresión Fase 9.5 (error injection)", () => {
    // Cada "🎉" es un par subrogado (2 code units UTF-16, 1 code point) —
    // 200 repeticiones cruzan la posición 150 en code units. `.slice(0,
    // 150)` (bug real, ya corregido) partiría el emoji #75 a la mitad,
    // dejando un code unit huérfano (carácter inválido/mojibake) al
    // final del nombre resultante.
    const result = sanitizeFilename("🎉".repeat(200));
    const codePoints = Array.from(result);
    expect(codePoints).toHaveLength(150); // 150 code points reales (300 code units UTF-16)
    expect(codePoints.every((char) => char === "🎉")).toBe(true); // ningún code point partido/corrupto
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
