import type { Point } from "@impulso/document-schema";

const DEG2RAD = Math.PI / 180;

/**
 * Envolvente alineada a los ejes (AABB), en el mismo espacio de coordenadas
 * que `Transform.x/y` de un object top-level (el espacio de la Page — hoy
 * `Layer` no tiene transform propio, así que ambos coinciden; ver
 * `layer/layer.ts`). No hay noción de rotación aquí: ya es el resultado
 * final de rotar una caja y tomar sus extremos.
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Entrada pura para calcular el AABB de un object rotado. Todos los campos
 * son números planos — ninguno depende de Konva ni del DOM. `width`/
 * `height` deben venir YA escalados (post `scaleX`/`scaleY`, como
 * `ManipulationBox.currentWidth/currentHeight` en `@impulso/renderer-konva`)
 * — este módulo no vuelve a aplicar escala.
 */
export interface RotatedBoxInput {
  /** Mismo punto que usa `Transform.x/y`: esquina superior izquierda para
   * la mayoría de los tipos, centro para Ellipse. Es también el origen/
   * pivote de la rotación — Konva rota alrededor de `(x, y)`, nunca
   * alrededor del centro geométrico de la caja, salvo que `originOffset`
   * ya sitúe el pivote ahí (caso Ellipse). */
  pivot: Point;
  /** Esquina superior izquierda de la caja, en espacio LOCAL (sin rotar),
   * relativa al pivote — `{0,0}` salvo Ellipse (ver
   * `renderer-konva/manipulation/boundingBox.ts`, mismo campo). */
  originOffset: Point;
  width: number;
  height: number;
  rotationDegrees: number;
}

/**
 * Rota las 4 esquinas de una caja alrededor de su pivote y devuelve el AABB
 * resultante en espacio "parent" (el mismo en el que viven los objects
 * top-level de una Page). Es la misma trigonometría que ya usa
 * `localToParent` en `@impulso/renderer-konva` para posicionar handles de
 * manipulación — se reimplementa aquí (en vez de importarla) porque esa
 * función vive acoplada a `ManipulationBox`, que a su vez requiere un
 * `Konva.Node` real para construirse; esta versión es una función pura de 5
 * números planos, sin esa dependencia, pensada para que Alignment (Epic 7 /
 * Fase 7.2) y futuros consumidores (Smart Guides, Snapping) no necesiten
 * Konva para calcular geometría.
 *
 * Precisión: aritmética de punto flotante estándar (`number`), sin
 * redondeo intermedio — el redondeo/tolerancia para decidir "esto no
 * cambió" es responsabilidad de quien consume el resultado (ver
 * `ALIGNMENT_EPSILON` en `alignment.ts`), no de este cálculo geométrico.
 */
export function computeRotatedBoundingBox(box: RotatedBoxInput): BoundingBox {
  const localCorners: Point[] = [
    { x: box.originOffset.x, y: box.originOffset.y },
    { x: box.originOffset.x + box.width, y: box.originOffset.y },
    { x: box.originOffset.x, y: box.originOffset.y + box.height },
    { x: box.originOffset.x + box.width, y: box.originOffset.y + box.height },
  ];

  const rad = box.rotationDegrees * DEG2RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const parentCorners = localCorners.map((corner) => ({
    x: box.pivot.x + corner.x * cos - corner.y * sin,
    y: box.pivot.y + corner.x * sin + corner.y * cos,
  }));

  const xs = parentCorners.map((p) => p.x);
  const ys = parentCorners.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Envolvente conjunta de N cajas — la "caja envolvente de la selección"
 * que usa Alignment como referencia para no hacer "saltar" la selección al
 * alinear (ver `alignment.ts`). Requiere al menos una caja: no hay una
 * envolvente conjunta significativa de cero objects, y quien llama siempre
 * tiene al menos un object seleccionado antes de invocar esto.
 */
export function unionBoundingBox(boxes: readonly BoundingBox[]): BoundingBox {
  const [first, ...rest] = boxes;
  if (!first) {
    throw new Error("unionBoundingBox requiere al menos una caja.");
  }
  return rest.reduce(
    (acc, box) => ({
      minX: Math.min(acc.minX, box.minX),
      minY: Math.min(acc.minY, box.minY),
      maxX: Math.max(acc.maxX, box.maxX),
      maxY: Math.max(acc.maxY, box.maxY),
    }),
    first,
  );
}
