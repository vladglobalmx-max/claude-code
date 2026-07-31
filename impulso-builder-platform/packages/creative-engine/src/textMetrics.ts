/**
 * Estimación de ancho de texto sin medición real de fuente — el paquete
 * corre en Node/jsdom, sin Canvas 2D disponible para medir glifos. Misma
 * clase de aproximación conservadora ya usada en
 * `apps/sticker-builder/src/catalogTemplates/kit/ringText.ts`
 * (`content.length * fontSize`), afinada aquí con un factor por densidad
 * tipográfica en vez de asumir el ancho de la letra más ancha para cada
 * carácter.
 */
export function estimateTextWidth(content: string, fontSize: number, factor = 0.58): number {
  return content.length * fontSize * factor;
}

/**
 * Reduce el tamaño de fuente lo mínimo necesario para que `content` quepa
 * en `maxWidth`, sin bajar de `minFontSize` — aplica la regla de
 * `THOREN_CREATIVE_ENGINE.md` §7: "se reduce la escala tipográfica dentro
 * de los límites de legibilidad de la receta... nunca se corta el nombre
 * del usuario". Nunca trunca ni modifica el contenido, solo su escala.
 */
export function fitFontSize(
  content: string,
  maxWidth: number,
  baseFontSize: number,
  minFontSize: number,
  factor = 0.58,
): number {
  const requiredWidth = estimateTextWidth(content, baseFontSize, factor);
  if (requiredWidth <= maxWidth) return baseFontSize;
  const scaled = (maxWidth / requiredWidth) * baseFontSize;
  return Math.max(minFontSize, scaled);
}
