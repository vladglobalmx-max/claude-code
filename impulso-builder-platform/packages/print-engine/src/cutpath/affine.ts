import type { Point, SceneObject, Transform } from "@impulso/document-schema";

const DEG2RAD = Math.PI / 180;
/** Tolerancia relativa para decidir "esto es una similitud" (rotación +
 * escala uniforme + traslación) contra "esto tiene shear real" — el
 * mismo criterio de tolerancia de punto flotante que ya usa
 * `alignment.ts` (`ALIGNMENT_EPSILON`), pero expresado como fracción del
 * propio tamaño de la matriz, no un valor absoluto (una matriz con
 * escalas muy grandes o muy chicas necesita una tolerancia proporcional). */
const SIMILARITY_RELATIVE_EPSILON = 1e-6;

/**
 * Afín 2D pura — `punto' = M · punto + t`, con `M = [[m00,m01],[m10,m11]]`.
 * Sin ningún tipo de Konva/Canvas/pdf-lib (Fase 9.3, sección 12): el único
 * modelo de composición de transforms anidados (Group dentro de Group,
 * rotación + escala no-uniforme combinadas) que usa el pipeline de cut
 * paths para llevar la geometría de un die-line a espacio global (px
 * canónico de página — el mismo que `SceneObject.transform`).
 */
export interface Affine2D {
  m00: number;
  m01: number;
  m10: number;
  m11: number;
  tx: number;
  ty: number;
}

export const IDENTITY_AFFINE: Affine2D = { m00: 1, m01: 0, m10: 0, m11: 1, tx: 0, ty: 0 };

export function applyAffine(a: Affine2D, point: Point): Point {
  return {
    x: a.m00 * point.x + a.m01 * point.y + a.tx,
    y: a.m10 * point.x + a.m11 * point.y + a.ty,
  };
}

/** `composeAffine(outer, inner)` — el afín que aplica `inner` PRIMERO y
 * `outer` DESPUÉS (composición de funciones `outer ∘ inner`). Es el mismo
 * orden en el que Konva anida transforms: el punto local de un object
 * pasa primero por su propio transform, luego por el de su Group padre,
 * luego por el del abuelo, etc. */
export function composeAffine(outer: Affine2D, inner: Affine2D): Affine2D {
  return {
    m00: outer.m00 * inner.m00 + outer.m01 * inner.m10,
    m01: outer.m00 * inner.m01 + outer.m01 * inner.m11,
    m10: outer.m10 * inner.m00 + outer.m11 * inner.m10,
    m11: outer.m10 * inner.m01 + outer.m11 * inner.m11,
    tx: outer.m00 * inner.tx + outer.m01 * inner.ty + outer.tx,
    ty: outer.m10 * inner.tx + outer.m11 * inner.ty + outer.ty,
  };
}

/** El pivote de rotación/escala de un `SceneObject` (Fase 9.1/Editor Epic
 * 1, ya establecido por `renderer-konva/coordinates.ts` y
 * `engine/geometry/boundingBox.ts`): la esquina superior izquierda para
 * todo tipo, salvo `Ellipse` — que usa el centro de su caja. Es el mismo
 * punto que Konva usa como posición/pivote real del node. */
export function pivotOf(object: SceneObject): Point {
  if (object.type === "ellipse") {
    return { x: object.transform.x + object.size.width / 2, y: object.transform.y + object.size.height / 2 };
  }
  return { x: object.transform.x, y: object.transform.y };
}

/** Afín de UN object/group hacia el espacio de SU padre —
 * `pivot + R(rotación) · diag(scaleX,scaleY) · puntoLocal`. */
export function affineFromTransform(transform: Transform, pivot: Point): Affine2D {
  const rad = transform.rotation * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    m00: cos * transform.scaleX,
    m01: -sin * transform.scaleY,
    m10: sin * transform.scaleX,
    m11: cos * transform.scaleY,
    tx: pivot.x,
    ty: pivot.y,
  };
}

/**
 * Composición de una cadena de transforms de ancestros (Fase 9.3, sección
 * 13) — `chain[0]` es el Group MÁS EXTERNO (el hijo directo de la Page,
 * sin transform propio adicional — "hoy Layer no tiene transform propio"),
 * `chain[chain.length - 1]` es el transform del OBJECT en sí (el más
 * interno). El resultado mapea un punto LOCAL del object (relativo a su
 * propio pivote, sin rotar/escalar) a espacio global de página.
 */
export function composeAncestorChain(chain: readonly Affine2D[]): Affine2D {
  if (chain.length === 0) return IDENTITY_AFFINE;
  let composed = chain[chain.length - 1]!;
  for (let i = chain.length - 2; i >= 0; i--) {
    composed = composeAffine(chain[i]!, composed);
  }
  return composed;
}

/**
 * `true` si la parte lineal de `a` (sin traslación) es una similitud —
 * rotación + escala UNIFORME (`scaleX === scaleY` efectivo, con o sin
 * reflexión) — es decir, preserva ángulos: un Rectangle/Ellipse local
 * sigue siendo un Rectangle/Ellipse en espacio global. `false` si hay
 * shear real (ej. escala no-uniforme combinada con una rotación en un
 * nivel DISTINTO del árbol) — un Rectangle se vuelve un paralelogramo, y
 * un Ellipse deja de poder representarse como `{center, radiusX, radiusY,
 * rotación}` sin aproximar (sección 13: se documenta o se bloquea, nunca
 * se aproxima en silencio).
 */
export function isSimilarityTransform(a: Affine2D): boolean {
  const col1 = { x: a.m00, y: a.m10 };
  const col2 = { x: a.m01, y: a.m11 };
  const len1sq = col1.x * col1.x + col1.y * col1.y;
  const len2sq = col2.x * col2.x + col2.y * col2.y;
  const scale = Math.max(len1sq, len2sq, 1e-12);
  const dot = col1.x * col2.x + col1.y * col2.y;
  const lengthsMatch = Math.abs(len1sq - len2sq) <= SIMILARITY_RELATIVE_EPSILON * scale;
  const orthogonal = Math.abs(dot) <= SIMILARITY_RELATIVE_EPSILON * scale;
  return lengthsMatch && orthogonal;
}

export interface SimilarityDecomposition {
  /** Factor de escala uniforme (siempre >= 0; una reflexión no lo vuelve negativo). */
  scale: number;
  rotationDegrees: number;
}

/** Descompone un afín YA confirmado como similitud (`isSimilarityTransform`)
 * en escala uniforme + rotación — nunca se llama sobre un afín con shear. */
export function decomposeSimilarity(a: Affine2D): SimilarityDecomposition {
  const scale = Math.sqrt(a.m00 * a.m00 + a.m10 * a.m10);
  const rotationDegrees = Math.atan2(a.m10, a.m00) / DEG2RAD;
  return { scale, rotationDegrees };
}
