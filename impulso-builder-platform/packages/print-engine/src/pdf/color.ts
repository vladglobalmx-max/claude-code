/** Color RGB en [0,1] — la única forma que `pdf-lib` acepta para dibujar
 * un vector, a diferencia de `CanvasRenderingContext2D` (PNG) que entiende
 * cualquier color CSS válido directamente. Documentado como una
 * limitación real de PDF respecto de PNG (ver README, sección Riesgos):
 * `CropMarksSpec.color`/`CutPathSpec.color` deben ser un hex válido
 * (`#rgb`/`#rrggbb`) para poder dibujarse como vector en el PDF — Preflight
 * los valida (`crop_marks_invalid`) antes de llegar aquí. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseHexColor(color: string): RgbColor | undefined {
  const match = HEX_COLOR_RE.exec(color.trim());
  if (!match) return undefined;
  let hex = match[1]!;
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(hex, 16);
  return { r: ((num >> 16) & 0xff) / 255, g: ((num >> 8) & 0xff) / 255, b: (num & 0xff) / 255 };
}
