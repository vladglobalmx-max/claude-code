/**
 * Generaliza el "apilado vertical centrado" que `serumFacialPremium.ts`
 * calculaba a mano (ver `THOREN_PILOT_TEMPLATE_STANDARD.md` §5) — la
 * composición base de THÖREN según `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.2:
 * "el eje único vertical centrado es la composición base de THÖREN" para
 * casi todas las familias de lenguaje visual (todas salvo la excepción
 * documentada de alineación izquierda en Técnico Funcional).
 */
export interface StackItem<TKey extends string = string> {
  key: TKey;
  height: number;
  /** Espacio (px) después de este elemento, antes del siguiente. Se
   * ignora en el último elemento (no hay "después" que separar). */
  gapAfter?: number;
}

export interface StackedPosition<TKey extends string = string> {
  key: TKey;
  y: number;
  height: number;
}

export interface VerticalStackResult<TKey extends string = string> {
  positions: StackedPosition<TKey>[];
  totalHeight: number;
}

/**
 * Calcula la posición `y` de cada elemento de `items`, apilados en orden
 * y centrados como bloque completo alrededor de `centerY` — nunca
 * coordenadas fijas a mano: si cambia el tamaño de fuente de un elemento,
 * todo el bloque se recalcula solo.
 */
export function stackVertically<TKey extends string = string>(
  items: readonly StackItem<TKey>[],
  centerY: number,
): VerticalStackResult<TKey> {
  const totalHeight = items.reduce(
    (sum, item, index) => sum + item.height + (index < items.length - 1 ? (item.gapAfter ?? 0) : 0),
    0,
  );

  const top = centerY - totalHeight / 2;
  let cursor = top;
  const positions: StackedPosition<TKey>[] = [];
  for (const item of items) {
    positions.push({ key: item.key, y: cursor, height: item.height });
    cursor += item.height + (item.gapAfter ?? 0);
  }

  return { positions, totalHeight };
}

/** Alto de línea de un `TextObject` en px, dado su `fontSize`/`lineHeight`
 * — la misma fórmula (`fontSize * lineHeight`) usada en el piloto para
 * calcular la altura de cada elemento antes de apilarlo. */
export function textLineHeight(fontSize: number, lineHeight = 1.2): number {
  return fontSize * lineHeight;
}
