import type { ObjectId } from "@impulso/document-schema";
import type { BoundingBox } from "./boundingBox.js";

/**
 * Punto de referencia de un eje: borde inicial (izquierda/arriba), centro,
 * borde final (derecha/abajo) — generalizado para X e Y. El orden de este
 * arreglo ES el desempate determinista de "punto de referencia" que exige
 * el modelo de Fase 7.3 (Assisted Placement): inicio < centro < fin.
 */
export type RefPoint = "start" | "center" | "end";
const REF_POINT_ORDER: readonly RefPoint[] = ["start", "center", "end"];

export type SnapAxis = "x" | "y";

/**
 * Un candidato de snap ya armado por quien llama (Renderer/App) — este
 * módulo nunca mide geometría, solo recibe números planos. `source`
 * codifica la prioridad: "page" > "object" siempre gana sobre "object"
 * cuando ambos están en tolerancia (ver `evaluateAxis`); "grid" no se pasa
 * aquí — se calcula analíticamente dentro del módulo (ver `SnapGridConfig`)
 * para no tener que enumerar una grilla infinita.
 */
export interface SnapCandidate {
  source: "page" | "object";
  axis: SnapAxis;
  /** Posición del candidato en espacio canónico (px). */
  value: number;
  refPoint: RefPoint;
  /** Presente solo en candidatos "object" — desempate determinista cuando
   * dos objects compiten a la misma distancia. */
  objectId?: ObjectId;
}

export interface SnapGridConfig {
  /** Tamaño de la grilla en espacio canónico (px) — mismo valor que
   * `Page.grid.size` (Document Schema), nunca convertido por `page.unit`. */
  size: number;
  snapEnabled: boolean;
}

interface ScoredCandidate {
  source: "page" | "object" | "grid";
  value: number;
  refPoint: RefPoint;
  objectId?: ObjectId;
  distance: number;
}

export interface AxisSnap {
  /** Posición final del punto de referencia una vez alineado. */
  value: number;
  refPoint: RefPoint;
  /** Cuánto sumar a la posición actual del object en este eje para lograr el alineamiento. */
  delta: number;
  source: "page" | "object" | "grid";
  objectId?: ObjectId;
}

export interface SnapResult {
  x?: AxisSnap;
  y?: AxisSnap;
}

export interface ComputeSnapInput {
  /** Caja actual del object en manipulación — YA con el delta crudo del
   * puntero aplicado (antes de cualquier ajuste de snap). */
  targetBox: BoundingBox;
  /** Candidatos de página + objects, ya armados (ver `SnapCandidate`). */
  candidates: readonly SnapCandidate[];
  /** Tolerancia YA normalizada por zoom, en espacio canónico (px) — ver
   * README del Engine: quien llama calcula `toleranciaPantalla / zoom`. */
  toleranceDocumentUnits: number;
  grid?: SnapGridConfig;
  /** Resultado del frame anterior del MISMO gesto — habilita hysteresis
   * (ver `evaluateAxis`). `undefined` al iniciar el gesto. */
  previousSnap?: SnapResult;
  /** Multiplicador de la tolerancia de SALIDA respecto de la de entrada —
   * default 1.5 (ver Fase 7.3, "hysteresis o estrategia equivalente"). */
  hysteresisMultiplier?: number;
  /** Puntos de referencia elegibles por eje — default los 3. Resize solo
   * pasa el borde que ese handle específico mueve (ej. handle "derecha" →
   * solo `end` en X), para no snapear un borde que el usuario no está
   * arrastrando. */
  eligibleRefPoints?: { x?: readonly RefPoint[]; y?: readonly RefPoint[] };
}

const DEFAULT_HYSTERESIS_MULTIPLIER = 1.5;
const DEFAULT_REF_POINTS: readonly RefPoint[] = REF_POINT_ORDER;

function targetRefValue(box: BoundingBox, axis: SnapAxis, refPoint: RefPoint): number {
  const [min, max] = axis === "x" ? [box.minX, box.maxX] : [box.minY, box.maxY];
  if (refPoint === "start") return min;
  if (refPoint === "end") return max;
  return (min + max) / 2;
}

/** Menor distancia gana; empate → por id de object (string compare); empate → por orden fijo del punto de referencia. */
function isBetterFit(candidate: ScoredCandidate, current: ScoredCandidate | undefined): boolean {
  if (!current) return true;
  if (candidate.distance !== current.distance) return candidate.distance < current.distance;
  const candidateId = candidate.objectId ?? "";
  const currentId = current.objectId ?? "";
  if (candidateId !== currentId) return candidateId < currentId;
  return REF_POINT_ORDER.indexOf(candidate.refPoint) < REF_POINT_ORDER.indexOf(current.refPoint);
}

function bestInPool(
  pool: readonly { value: number; refPoint: RefPoint; objectId?: ObjectId }[],
  source: "page" | "object" | "grid",
  targetBox: BoundingBox,
  axis: SnapAxis,
  refPoints: readonly RefPoint[],
  tolerance: number,
): ScoredCandidate | undefined {
  let best: ScoredCandidate | undefined;
  for (const refPoint of refPoints) {
    const currentValue = targetRefValue(targetBox, axis, refPoint);
    for (const item of pool) {
      const distance = Math.abs(item.value - currentValue);
      if (distance > tolerance) continue;
      const scored: ScoredCandidate = { source, value: item.value, refPoint, objectId: item.objectId, distance };
      if (isBetterFit(scored, best)) best = scored;
    }
  }
  return best;
}

function toAxisSnap(scored: ScoredCandidate, targetBox: BoundingBox, axis: SnapAxis): AxisSnap {
  const currentValue = targetRefValue(targetBox, axis, scored.refPoint);
  return {
    value: scored.value,
    refPoint: scored.refPoint,
    delta: scored.value - currentValue,
    source: scored.source,
    objectId: scored.objectId,
  };
}

/**
 * Evalúa un solo eje. Prioridad estricta por nivel — Página > Objects >
 * Grid: se evalúa un nivel completo (los 3 puntos de referencia elegibles
 * contra TODOS los candidatos de ese nivel) y, si algo calza dentro de
 * tolerancia, se usa ese resultado sin mirar los niveles siguientes.
 *
 * Hysteresis: si hubo un snap en el frame anterior de este mismo gesto,
 * primero se comprueba si sigue vigente (distancia actual <= tolerancia ×
 * `hysteresisMultiplier`, mayor que la de entrada) — evita que un
 * micro-movimiento del puntero haga oscilar el resultado entre dos
 * candidatos cercanos. Si sigue vigente, se recalcula solo el delta (la
 * posición ya podría haber cambiado dentro del gesto), sin re-evaluar
 * prioridades desde cero.
 */
function evaluateAxis(
  axis: SnapAxis,
  targetBox: BoundingBox,
  candidates: readonly SnapCandidate[],
  tolerance: number,
  grid: SnapGridConfig | undefined,
  previous: AxisSnap | undefined,
  hysteresisMultiplier: number,
  refPoints: readonly RefPoint[],
): AxisSnap | undefined {
  if (previous && refPoints.includes(previous.refPoint)) {
    const currentValue = targetRefValue(targetBox, axis, previous.refPoint);
    const distance = Math.abs(currentValue - previous.value);
    if (distance <= tolerance * hysteresisMultiplier) {
      return { ...previous, delta: previous.value - currentValue };
    }
  }

  const axisCandidates = candidates.filter((c) => c.axis === axis);
  const pagePool = axisCandidates.filter((c) => c.source === "page");
  const objectPool = axisCandidates.filter((c) => c.source === "object");

  const pageBest = bestInPool(pagePool, "page", targetBox, axis, refPoints, tolerance);
  if (pageBest) return toAxisSnap(pageBest, targetBox, axis);

  const objectBest = bestInPool(objectPool, "object", targetBox, axis, refPoints, tolerance);
  if (objectBest) return toAxisSnap(objectBest, targetBox, axis);

  if (grid?.snapEnabled) {
    const gridPool = refPoints.map((refPoint) => {
      const currentValue = targetRefValue(targetBox, axis, refPoint);
      return { value: Math.round(currentValue / grid.size) * grid.size, refPoint };
    });
    const gridBest = bestInPool(gridPool, "grid", targetBox, axis, refPoints, tolerance);
    if (gridBest) return toAxisSnap(gridBest, targetBox, axis);
  }

  return undefined;
}

/**
 * Función pura, sin Konva ni DOM (Epic 7 / Fase 7.3 — Assisted Placement):
 * calcula el ajuste de snap para X e Y de forma independiente. Ver
 * `evaluateAxis` para el modelo completo (prioridad, desempate, hysteresis).
 */
export function computeSnap(input: ComputeSnapInput): SnapResult {
  const hysteresisMultiplier = input.hysteresisMultiplier ?? DEFAULT_HYSTERESIS_MULTIPLIER;
  const xRefPoints = input.eligibleRefPoints?.x ?? DEFAULT_REF_POINTS;
  const yRefPoints = input.eligibleRefPoints?.y ?? DEFAULT_REF_POINTS;

  const x = evaluateAxis(
    "x",
    input.targetBox,
    input.candidates,
    input.toleranceDocumentUnits,
    input.grid,
    input.previousSnap?.x,
    hysteresisMultiplier,
    xRefPoints,
  );
  const y = evaluateAxis(
    "y",
    input.targetBox,
    input.candidates,
    input.toleranceDocumentUnits,
    input.grid,
    input.previousSnap?.y,
    hysteresisMultiplier,
    yRefPoints,
  );

  const result: SnapResult = {};
  if (x) result.x = x;
  if (y) result.y = y;
  return result;
}

/** Candidatos de Página (prioridad 1): borde inicial/centro/borde final, en
 * espacio canónico (px) — `pageWidth`/`pageHeight` ya deben venir
 * convertidos si `page.unit !== "px"` (mismo criterio que Alignment, ver
 * ADR-0015). */
export function buildPageSnapCandidates(pageWidth: number, pageHeight: number): SnapCandidate[] {
  return [
    { source: "page", axis: "x", value: 0, refPoint: "start" },
    { source: "page", axis: "x", value: pageWidth / 2, refPoint: "center" },
    { source: "page", axis: "x", value: pageWidth, refPoint: "end" },
    { source: "page", axis: "y", value: 0, refPoint: "start" },
    { source: "page", axis: "y", value: pageHeight / 2, refPoint: "center" },
    { source: "page", axis: "y", value: pageHeight, refPoint: "end" },
  ];
}

/** Candidatos de un object (prioridad 2): borde inicial/centro/borde final
 * de su AABB real (ver `computeObjectBoundingBox`, `renderer-konva`) en
 * ambos ejes. */
export function buildObjectSnapCandidates(objectId: ObjectId, box: BoundingBox): SnapCandidate[] {
  return [
    { source: "object", axis: "x", value: box.minX, refPoint: "start", objectId },
    { source: "object", axis: "x", value: (box.minX + box.maxX) / 2, refPoint: "center", objectId },
    { source: "object", axis: "x", value: box.maxX, refPoint: "end", objectId },
    { source: "object", axis: "y", value: box.minY, refPoint: "start", objectId },
    { source: "object", axis: "y", value: (box.minY + box.maxY) / 2, refPoint: "center", objectId },
    { source: "object", axis: "y", value: box.maxY, refPoint: "end", objectId },
  ];
}
