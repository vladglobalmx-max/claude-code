import type { SceneObject } from "@impulso/document-schema";

/**
 * `transform.x/y` es la esquina superior izquierda para todo tipo EXCEPTO
 * Ellipse — no por el Document Schema en sí (que trata `x/y` como
 * top-left de forma uniforme), sino porque Konva.Ellipse posiciona su nodo
 * por el CENTRO, y el Renderer ya rota alrededor de ese mismo punto
 * (`x/y` es también el pivote de rotación de Konva). Para que un SVG
 * exportado rote una Ellipse alrededor del mismo punto que ve el usuario
 * en el canvas, el pivote debe coincidir exactamente — de ahí que el
 * cálculo del centro ocurra aquí y no en el elemento `<ellipse>` en sí
 * (ver `shapeMarkup.ts`, que dibuja la ellipse centrada en el origen local
 * que este `translate` ya estableció). Ver `@impulso/renderer-konva`'s
 * `coordinates.ts` para el mismo razonamiento aplicado a Konva.
 */
export function transformToSvgAttr(object: SceneObject): string {
  const { x, y, rotation, scaleX, scaleY } = object.transform;
  const anchor =
    object.type === "ellipse"
      ? { x: x + object.size.width / 2, y: y + object.size.height / 2 }
      : { x, y };
  return `translate(${anchor.x} ${anchor.y}) rotate(${rotation}) scale(${scaleX} ${scaleY})`;
}
