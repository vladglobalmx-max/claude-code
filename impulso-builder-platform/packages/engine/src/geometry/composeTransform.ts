import type { Transform } from "@impulso/document-schema";

const DEG2RAD = Math.PI / 180;

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * "Hornea" el transform de un `parent` (ej. un Group) dentro del de uno de
 * sus `child` directos, produciendo el `Transform` equivalente que ese hijo
 * necesitaría para verse EXACTAMENTE igual si `parent` dejara de existir —
 * la operación central de `ungroupObject` (Editor Epic "Sticker Creation
 * Experience"). Función pura, sin Project ni dispatch, mismo estilo que
 * `computeResizedTransform`/`computeRotatedTransform`.
 *
 * El punto local del hijo se escala por el `scale` del padre, se rota por
 * su rotación, y se traslada por su posición — el mismo orden
 * escalar-rotar-trasladar que ya usa `localToParent` en
 * `@impulso/renderer-konva` para posicionar handles alrededor de un object
 * rotado, aplicado aquí a un `Transform` completo en vez de a un punto.
 */
export function composeChildTransformIntoParent(parent: Transform, child: Transform): Transform {
  const scaledX = child.x * parent.scaleX;
  const scaledY = child.y * parent.scaleY;

  const rad = parent.rotation * DEG2RAD;
  const rotatedX = scaledX * Math.cos(rad) - scaledY * Math.sin(rad);
  const rotatedY = scaledX * Math.sin(rad) + scaledY * Math.cos(rad);

  return {
    x: parent.x + rotatedX,
    y: parent.y + rotatedY,
    rotation: normalizeAngle(child.rotation + parent.rotation),
    scaleX: child.scaleX * parent.scaleX,
    scaleY: child.scaleY * parent.scaleY,
  };
}
