import type { Point, Size, Transform } from "@impulso/document-schema";

/**
 * Los 8 puntos de control de un bounding box. El anclaje (qué esquina/lado
 * NO se mueve durante el resize) es siempre el opuesto al handle arrastrado
 * — es la convención universal de cualquier editor de diseño.
 */
export const RESIZE_HANDLES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/** Debajo de este tamaño (en las mismas unidades que `intrinsicSize`) un resize se rechaza/clampa. */
export const MIN_RESIZE_SIZE = 1;

export interface ResizeGestureInput {
  /** Transform actual del object (antes de este gesto). */
  transform: Transform;
  /**
   * Tamaño "natural" del object a escala 1 (scaleX=scaleY=1) — lo único que
   * este módulo no puede calcular por sí mismo: para Rectangle/Ellipse/
   * Image coincide con `size`, pero para Path/Group requiere medir la
   * geometría real (Konva `getSelfRect()`), algo que solo el Renderer sabe
   * hacer. Se recibe como dato, nunca se calcula aquí.
   */
  intrinsicSize: Size;
  handle: ResizeHandle;
  /**
   * Delta del puntero desde que empezó el gesto, en el espacio del PADRE
   * (el mismo espacio que `transform.x/y`), SIN rotar — la rotación del
   * object se deshace internamente aquí, no es responsabilidad de quien
   * llama.
   */
  pointerDelta: Point;
  /** Si es true (ej. Shift presionado), preserva la proporción ancho/alto actual. */
  maintainAspectRatio?: boolean;
}

const DEG2RAD = Math.PI / 180;

function isLeftSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-left" || handle === "left" || handle === "bottom-left";
}

function isRightSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-right" || handle === "right" || handle === "bottom-right";
}

function isTopSideHandle(handle: ResizeHandle): boolean {
  return handle === "top-left" || handle === "top" || handle === "top-right";
}

function isBottomSideHandle(handle: ResizeHandle): boolean {
  return handle === "bottom-left" || handle === "bottom" || handle === "bottom-right";
}

/**
 * El resultado de arrastrar un handle: nuevo x/y/scaleX/scaleY, listo para
 * fusionarse como `Partial<Transform>` (la rotación no cambia por un
 * resize). Función pura — ni lee ni escribe el Project; el comando
 * `resizeObject` (commands/resizeObjectCommand.ts) es quien la conecta con
 * el Engine.
 */
export function computeResizedTransform(input: ResizeGestureInput): Partial<Transform> {
  const { transform, intrinsicSize, handle, pointerDelta, maintainAspectRatio } = input;

  // 1. Deshacer la rotación del object para razonar en su espacio local
  //    (no rotado) — un resize siempre "estira" en los ejes locales del
  //    object, nunca en los ejes de pantalla.
  const rad = -transform.rotation * DEG2RAD;
  const localDx = pointerDelta.x * Math.cos(rad) - pointerDelta.y * Math.sin(rad);
  const localDy = pointerDelta.x * Math.sin(rad) + pointerDelta.y * Math.cos(rad);

  // 2. Delta de ancho/alto crudo, según qué lado del handle se movió.
  const currentWidth = intrinsicSize.width * transform.scaleX;
  const currentHeight = intrinsicSize.height * transform.scaleY;

  let widthDelta = 0;
  if (isLeftSideHandle(handle)) widthDelta = -localDx;
  else if (isRightSideHandle(handle)) widthDelta = localDx;

  let heightDelta = 0;
  if (isTopSideHandle(handle)) heightDelta = -localDy;
  else if (isBottomSideHandle(handle)) heightDelta = localDy;

  let newWidth = currentWidth + widthDelta;
  let newHeight = currentHeight + heightDelta;

  // 3. Restricción de proporción (ej. Shift): el eje con mayor cambio
  //    relativo "domina"; el otro se recalcula para conservar la relación
  //    ancho/alto original.
  if (maintainAspectRatio && currentWidth > 0 && currentHeight > 0) {
    const aspectRatio = currentWidth / currentHeight;
    const widthChanged = widthDelta !== 0;
    const heightChanged = heightDelta !== 0;
    if (widthChanged && heightChanged) {
      if (Math.abs(widthDelta) / currentWidth > Math.abs(heightDelta) / currentHeight) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
    } else if (widthChanged) {
      newHeight = newWidth / aspectRatio;
    } else if (heightChanged) {
      newWidth = newHeight * aspectRatio;
    }
  }

  // 4. Restricción de tamaño mínimo — evita colapsar/invertir la forma.
  newWidth = Math.max(newWidth, MIN_RESIZE_SIZE);
  newHeight = Math.max(newHeight, MIN_RESIZE_SIZE);

  // 5. El anclaje (esquina/lado opuesto al handle) no se mueve. Se
  //    recalcula el desplazamiento del anclaje a partir del delta REAL
  //    aplicado (tras redondeos de aspecto/mínimo), no del delta crudo.
  const actualWidthDelta = newWidth - currentWidth;
  const actualHeightDelta = newHeight - currentHeight;
  const localXShift = isLeftSideHandle(handle) ? -actualWidthDelta : 0;
  const localYShift = isTopSideHandle(handle) ? -actualHeightDelta : 0;

  // 6. Volver a aplicar la rotación del object para llevar el
  //    desplazamiento del anclaje de vuelta al espacio del padre.
  const forwardRad = transform.rotation * DEG2RAD;
  const parentDx = localXShift * Math.cos(forwardRad) - localYShift * Math.sin(forwardRad);
  const parentDy = localXShift * Math.sin(forwardRad) + localYShift * Math.cos(forwardRad);

  return {
    x: transform.x + parentDx,
    y: transform.y + parentDy,
    scaleX: newWidth / intrinsicSize.width,
    scaleY: newHeight / intrinsicSize.height,
  };
}
