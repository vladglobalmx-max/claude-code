import type { Unit } from "@impulso/document-schema";

/**
 * Modelo de unidades del Print Engine — ver ADR de Fase 9.1 para el
 * razonamiento completo. Tres espacios numéricos coexisten en Impulso, y
 * confundirlos es exactamente el bug que esta fase encontró y corrigió en
 * `projectPresets.ts` (ver CHANGELOG de `apps/sticker-builder`):
 *
 * 1. **px canónico** (`SceneObject.transform`/`SceneObject.size`): un
 *    espacio CSS-96-DPI-equivalente, el MISMO para cualquier `Project`
 *    independientemente de `page.unit`. Es lo que el Renderer usa
 *    directamente (`baseAttrs.ts`/`coordinates.ts`, `@impulso/renderer-konva`
 *    — verificado leyendo su código, nunca asumido) y lo que
 *    `Inspector`/`Alignment`/`Rulers` convierten desde/hacia `page.unit`
 *    vía `toPixels`/`fromPixels` (`@impulso/document-schema`, Fase 7.1) —
 *    NUNCA lo que se guarda directamente sin convertir.
 * 2. **Unidad física de página** (`Page.size`, interpretada por
 *    `Page.unit`): un valor CRUDO en esa unidad (ej. `210` para una página
 *    de 210mm) — se convierte a px canónico recién al usarlo contra
 *    geometría de objects (`toPixels(page.size.width, page.unit)`, el
 *    mismo patrón repetido en `renderer.ts`/`alignment.ts`/
 *    `assistedPlacement.ts`).
 * 3. **Resolución de impresión** (`PrintJob.resolution.targetPpi`): un
 *    PPI real (150/300/600...), completamente independiente del `96`
 *    fijo de arriba — `document-schema`'s `toPixels` NUNCA debe
 *    reutilizarse para esto; es la conversión de PANTALLA, no de
 *    impresión (ver README de este paquete, "Por qué no reutilizamos
 *    toPixels").
 *
 * La relación entre 1 y 3 es la siguiente identidad, verificada con un
 * test dedicado (`units.test.ts`, "el pixelRatio de un Stage a targetPpi
 * equivale a physicalToPixels a esa misma resolución"):
 *
 *   physicalToPixels(v, unit, targetPpi) === toPixels(v, unit) × (targetPpi / 96)
 *
 * Esto es lo que permite que el pipeline de raster de Fase 9.2 reutilice
 * el mismo Stage ya construido en px canónico (96 implícito) y solo le
 * pida un `pixelRatio = targetPpi / 96` a Konva — sin tener que reconvertir
 * la posición de cada object individualmente.
 */

const CSS_PIXELS_PER_INCH = 96;
const MM_PER_INCH = 25.4;
/** Constante fija del propio formato PDF — nunca configurable, a
 * diferencia de `targetPpi` (que sí varía por perfil). */
const POINTS_PER_INCH = 72;

function toInches(value: number, unit: Unit): number {
  switch (unit) {
    case "in":
      return value;
    case "mm":
      return value / MM_PER_INCH;
    case "px":
      return value / CSS_PIXELS_PER_INCH;
  }
}

function fromInches(inches: number, unit: Unit): number {
  switch (unit) {
    case "in":
      return inches;
    case "mm":
      return inches * MM_PER_INCH;
    case "px":
      return inches * CSS_PIXELS_PER_INCH;
  }
}

/** `value` (en `unit`) → puntos PDF (1pt = 1/72 in, fijo). Usado para
 * `MediaBox`/`TrimBox`/`BleedBox` — el formato PDF entero está expresado en
 * puntos, nunca en píxeles. */
export function unitToPoints(value: number, unit: Unit): number {
  return toInches(value, unit) * POINTS_PER_INCH;
}

/** Inversa de `unitToPoints` — para mostrarle al usuario, en `unit`, un
 * valor leído de vuelta de un PDF ya generado (verificación programática,
 * sección 25 del enunciado). */
export function pointsToUnit(points: number, unit: Unit): number {
  return fromInches(points / POINTS_PER_INCH, unit);
}

/** `value` (en `unit`) → píxeles RASTER a `ppi` — NUNCA usar `toPixels` de
 * `document-schema` para esto (esa función fija 96, la resolución de
 * pantalla). Redondeo: cada valor se calcula una sola vez desde su fuente
 * física — quien llama decide si redondear (`Math.round`) según lo que
 * necesite (tamaño de canvas siempre entero; verificación puede querer el
 * valor exacto antes de redondear). */
export function physicalToPixels(value: number, unit: Unit, ppi: number): number {
  return toInches(value, unit) * ppi;
}

/** Inversa de `physicalToPixels`. */
export function pixelsToPhysical(pixels: number, unit: Unit, ppi: number): number {
  return fromInches(pixels / ppi, unit);
}

/** Convierte un valor de una unidad física a otra directamente (ej. un
 * `BleedSpec` en pulgadas combinado con un `PrintJob.dimensions` en mm) —
 * usado por `boxes.ts` para normalizar antes de sumar/restar tamaños que
 * pueden llegar en unidades distintas entre sí. */
export function convertUnit(value: number, from: Unit, to: Unit): number {
  // Atajo deliberado: sin esto, incluso "convertir" mm -> mm hace un
  // viaje de ida y vuelta por pulgadas (`2 / 25.4 * 25.4`) que en punto
  // flotante NO siempre devuelve exactamente `2` (ver `boxes.test.ts`,
  // que encontró este error real al comparar offsets con `toEqual`) — el
  // caso más común (misma unidad en ambos lados) nunca debería pagar ese
  // costo de precisión.
  if (from === to) return value;
  return fromInches(toInches(value, from), to);
}

/**
 * Factor de escala (`Konva.Stage.toCanvas({ pixelRatio })`) para que un
 * Stage ya construido en px canónico (96 implícito, ver arriba) rasterice
 * a `targetPpi` — evita reconvertir la posición de cada object
 * individualmente (ver la identidad matemática documentada arriba del
 * archivo, probada en `units.test.ts`).
 */
export function pixelRatioForPpi(targetPpi: number): number {
  return targetPpi / CSS_PIXELS_PER_INCH;
}

// Conveniencias directas entre unidades físicas concretas (sin pasar por
// `Unit`) — para código que ya conoce la unidad exacta que tiene en mano
// (ej. presets de bleed en mm, mostrar un resultado en pulgadas).
export function mmToIn(mm: number): number {
  return mm / MM_PER_INCH;
}
export function inToMm(inches: number): number {
  return inches * MM_PER_INCH;
}
export function mmToPt(mm: number): number {
  return mmToIn(mm) * POINTS_PER_INCH;
}
export function ptToMm(pt: number): number {
  return (pt / POINTS_PER_INCH) * MM_PER_INCH;
}
export function inToPt(inches: number): number {
  return inches * POINTS_PER_INCH;
}
export function ptToIn(pt: number): number {
  return pt / POINTS_PER_INCH;
}
