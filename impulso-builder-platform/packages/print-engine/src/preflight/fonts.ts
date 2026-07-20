export type FontAvailability = "available" | "unavailable" | "verification-uncertain";

export interface FontChecker {
  check(fontFamily: string): Promise<FontAvailability>;
}

/**
 * `document.fonts.check()` es una SEÑAL, nunca una garantía absoluta
 * (corrección 6 de Fase 9.1) — cualquier ausencia de la API o excepción se
 * trata como `"verification-uncertain"`, NUNCA como `"available"` por
 * defecto (eso sería fingir una certeza que no existe). Inyectable
 * (`RunPreflightOptions.fontChecker`) para que los tests no dependan de la
 * implementación real de fuentes de ningún navegador/jsdom.
 */
export const browserFontChecker: FontChecker = {
  async check(fontFamily) {
    try {
      if (typeof document === "undefined") return "verification-uncertain";
      const fonts = (document as { fonts?: { check?: (font: string) => boolean } }).fonts;
      if (!fonts || typeof fonts.check !== "function") return "verification-uncertain";
      return fonts.check(`12px "${fontFamily}"`) ? "available" : "unavailable";
    } catch {
      return "verification-uncertain";
    }
  },
};
