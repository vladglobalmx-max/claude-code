import { applyAffine, type Affine2D } from "./affine.js";
import type { CutGeometry } from "./cutGeometry.js";

export type CutGeometryOffsetResult =
  | { status: "ok"; geometry: CutGeometry }
  | { status: "collapsed" }
  /** El offset no pudo aplicarse — `geometry` es la ORIGINAL sin cambios
   * (nunca una simulación de offset moviendo el stroke, sección 14). La
   * severidad (bloquear/advertir/usar-original) es decisión del perfil,
   * NO de esta función pura — ver `PrintProfileDefaults.offsetUnsupportedPolicy`,
   * consumida por Preflight y por el exportador. */
  | { status: "unsupported"; geometry: CutGeometry };

const DEG2RAD = Math.PI / 180;

function rotationOnly(rotationDegrees: number): Affine2D {
  const rad = rotationDegrees * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { m00: cos, m01: -sin, m10: sin, m11: cos, tx: 0, ty: 0 };
}

/**
 * Offset físico de un `CutGeometry` ya normalizado a espacio global (Fase
 * 9.3, sección 14) — política honesta y explícita por tipo:
 *
 * - **Rectangle**: exacto — expande/contrae `width`/`height` en `2×offset`
 *   (offset positivo = expandir, negativo = contraer), manteniendo el
 *   CENTRO fijo (el pivote, que es la esquina superior izquierda en el eje
 *   LOCAL del rectángulo, se desplaza `-offset` en ambos ejes locales,
 *   rotado a espacio global).
 * - **Ellipse**: exacto — expande/contrae `radiusX`/`radiusY` en `offset`,
 *   el centro nunca se mueve.
 * - **ClosedPath**: SOLO `offset === 0` (usa el path original tal cual).
 *   Cualquier offset distinto de cero es `"unsupported"` — no existe una
 *   solución geométrica de offset confiable para curvas arbitrarias sin
 *   una dependencia pesada nueva (deliberadamente no agregada, sección
 *   14) — nunca se simula desplazando el stroke y llamándolo geometría
 *   real.
 * - Cualquier resultado con `width`/`height`/`radiusX`/`radiusY` <= 0 es
 *   `"collapsed"` (un offset negativo demasiado grande).
 */
export function applyCutGeometryOffset(geometry: CutGeometry, offsetCanonicalPx: number): CutGeometryOffsetResult {
  if (offsetCanonicalPx === 0) return { status: "ok", geometry };

  if (geometry.type === "rectangle") {
    const width = geometry.width + 2 * offsetCanonicalPx;
    const height = geometry.height + 2 * offsetCanonicalPx;
    if (width <= 0 || height <= 0) return { status: "collapsed" };
    const localShift = applyAffine(rotationOnly(geometry.rotationDegrees), { x: -offsetCanonicalPx, y: -offsetCanonicalPx });
    return {
      status: "ok",
      geometry: {
        type: "rectangle",
        pivot: { x: geometry.pivot.x + localShift.x, y: geometry.pivot.y + localShift.y },
        width,
        height,
        rotationDegrees: geometry.rotationDegrees,
      },
    };
  }

  if (geometry.type === "ellipse") {
    const radiusX = geometry.radiusX + offsetCanonicalPx;
    const radiusY = geometry.radiusY + offsetCanonicalPx;
    if (radiusX <= 0 || radiusY <= 0) return { status: "collapsed" };
    return { status: "ok", geometry: { ...geometry, radiusX, radiusY } };
  }

  return { status: "unsupported", geometry };
}
