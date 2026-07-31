/**
 * Contraste WCAG 2.1 — fórmula estándar de luminancia relativa y razón de
 * contraste. Solo soporta hex de 6 dígitos (`#rrggbb`): es el único
 * formato que produce el Intérprete (§ diccionario de color) y las
 * recetas de esta fase; un formato más amplio (rgba, nombres CSS) no
 * tiene todavía ningún productor real en el sistema.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Umbrales WCAG 2.1: 4.5:1 para texto normal, 3:1 para texto grande
 * (≥24px, el criterio 1.4.3) y 3:1 para elementos gráficos/de interfaz no
 * textuales (criterio 1.4.11) — un filete o marco decorativo no necesita
 * el mismo contraste que un bloque de texto para seguir siendo visible.
 */
export const CONTRAST_THRESHOLD_LARGE_TEXT = 3;
export const CONTRAST_THRESHOLD_NORMAL_TEXT = 4.5;
export const CONTRAST_THRESHOLD_GRAPHIC = 3;
const LARGE_TEXT_MIN_FONT_SIZE = 24;

export function requiredTextContrast(fontSize: number): number {
  return fontSize >= LARGE_TEXT_MIN_FONT_SIZE ? CONTRAST_THRESHOLD_LARGE_TEXT : CONTRAST_THRESHOLD_NORMAL_TEXT;
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = 1 - amount;
  const channel = (value: number) => Math.round(value * factor).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Ajusta `hex` oscureciéndolo en pasos pequeños hasta alcanzar `minRatio`
 * de contraste contra `background`, preservando su matiz — aplica, para el
 * color, la misma regla que `THOREN_CREATIVE_ENGINE.md` §14 ya establece
 * para el tamaño físico ("se resuelve en silencio ajustando... nunca se
 * expone al usuario el motivo técnico"): una señal explícita del usuario
 * ("en dorado") nunca debe romper la legibilidad ya validada de la
 * receta, y el sistema decide, no pregunta ni rechaza.
 *
 * Solo oscurece, nunca aclara — suficiente mientras la única receta de
 * esta fase tenga fondo claro (marfil). Una receta de fondo oscuro
 * necesitaría la dirección contraria; se resuelve cuando exista una
 * (Fase 4), no antes.
 */
export function ensureContrast(hex: string, background: string, minRatio: number): string {
  let candidate = hex;
  for (let i = 0; i < 20 && contrastRatio(candidate, background) < minRatio; i += 1) {
    candidate = darken(candidate, 0.08);
  }
  return candidate;
}
