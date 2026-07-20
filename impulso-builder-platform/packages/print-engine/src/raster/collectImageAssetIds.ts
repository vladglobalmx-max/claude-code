import type { AssetId, SceneObject } from "@impulso/document-schema";

/** Recorre recursivamente (incluyendo `group`s anidados) juntando los
 * `assetId` referenciados por cada `ImageObject` — mismo patrón que
 * `@impulso/export-engine` usa para su propio caso de un solo disparo
 * (`rasterizeProjectToPng.ts`), reimplementado aquí porque esa función es
 * privada de ese paquete. Deliberadamente recorre TODOS los objects de la
 * página (sin aplicar `shouldRenderObject`) — resolver algún asset de más
 * que termine excluido del raster final es inofensivo; complicar el
 * recorrido para evitarlo no lo es. */
export function collectImageAssetIds(objects: readonly SceneObject[], out: Set<AssetId>): void {
  for (const object of objects) {
    if (object.type === "image") out.add(object.assetId);
    else if (object.type === "group") collectImageAssetIds(object.children, out);
  }
}
