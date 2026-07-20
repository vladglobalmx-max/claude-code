export interface StageSize {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Recorta la distancia de `anchor` a `desiredPoint` a lo largo del MISMO
 * vector dirección, para que el punto resultante nunca caiga fuera del
 * rectángulo interactivo del Stage (ADR-0018 — "Handle de rotación cerca del
 * borde"). Un `<canvas>` HTML nunca renderiza ni recibe hit-testing fuera de
 * sus propias dimensiones (`stage.width()/height()`) — un handle dibujado a
 * Y negativa, por ejemplo, queda invisible e inalcanzable con el mouse (ver
 * Technical Debt, Fase 7.3.5, bug de severidad alta).
 *
 * Es un recorte de rayo contra rectángulo (ray-vs-box clipping): funciona
 * para CUALQUIER ángulo de `desiredPoint` respecto de `anchor`, no solo el
 * caso sin rotación — a diferencia de un simple `Math.max(y, 0)`, que solo
 * es correcto cuando "arriba" coincide exactamente con el eje -Y de
 * pantalla. `anchor` (el borde real del object/de la selección) se asume
 * SIEMPRE fijo — nunca se mueve, solo se acerca el handle a él cuando no hay
 * espacio para el offset completo. El handle nunca se oculta: en el peor
 * caso (offset recortado a 0) queda exactamente sobre `anchor`, visible e
 * interactivo.
 *
 * `padding` es el radio/mitad del propio handle (ej. `HANDLE_SIZE / 2`) —
 * sin él, el CENTRO del handle podría quedar justo en el borde del Stage,
 * dejando la mitad de su área de hit-test fuera igualmente.
 *
 * Caso límite documentado (no resuelto, y no resoluble sin agrandar el
 * Stage — ver ADR-0018, "Riesgos"): si `anchor` mismo ya cae fuera del
 * rectángulo interactivo (el object entero está fuera de los límites del
 * Stage), no hay ninguna distancia que recortar — se devuelve `anchor` sin
 * cambios, nunca un valor inconsistente o `NaN`.
 */
export function clampPointToStageBounds(
  anchor: Point,
  desiredPoint: Point,
  stage: StageSize,
  padding: number,
): Point {
  const dx = desiredPoint.x - anchor.x;
  const dy = desiredPoint.y - anchor.y;
  const minX = padding;
  const maxX = stage.width - padding;
  const minY = padding;
  const maxY = stage.height - padding;

  // t=1 representa "usar desiredPoint tal cual" — nunca se extiende más
  // allá del punto deseado, solo se acerca a `anchor` si hace falta.
  let t = 1;
  if (dx !== 0) {
    t = Math.min(t, dx > 0 ? (maxX - anchor.x) / dx : (minX - anchor.x) / dx);
  }
  if (dy !== 0) {
    t = Math.min(t, dy > 0 ? (maxY - anchor.y) / dy : (minY - anchor.y) / dy);
  }
  t = Math.max(0, t);

  return { x: anchor.x + dx * t, y: anchor.y + dy * t };
}
