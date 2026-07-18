import { AssetIdSchema, type AssetId, type Project, type SceneObject } from "@impulso/document-schema";

/**
 * Sticker Creation Experience necesita "Agregar imágenes SVG/PNG" sin que
 * exista todavía una Asset Library (ver ADR-0010 y
 * `docs/product/05-Technical-Debt.md`) — el `assetId` que exige
 * `ImageObject` no está respaldado por ningún registro real; el data URL
 * de la imagen se embebe directamente en `customProperties` del propio
 * object, y este módulo es quien lo resuelve hacia un `HTMLImageElement`
 * en memoria para que `resolveAssetSource` (ya un punto de extensión
 * existente de `@impulso/renderer-konva` desde Foundation 3) lo dibuje.
 */
export const IMAGE_DATA_URL_PROPERTY = "impulsoImageDataUrl";

export interface LoadedImage {
  assetId: AssetId;
  dataUrl: string;
  image: HTMLImageElement;
  width: number;
  height: number;
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("El archivo no es una imagen válida."));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/** Lee un `File` (PNG o SVG) elegido por el usuario y lo prepara para
 * insertarse como un `ImageObject` nuevo — el `assetId` es sintético
 * (`crypto.randomUUID()`), sin relación con ningún registro persistido. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(dataUrl);
  return {
    assetId: AssetIdSchema.parse(`asset_${crypto.randomUUID()}`),
    dataUrl,
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export interface ImageAssetCache {
  set(assetId: AssetId, image: HTMLImageElement): void;
  /** Pasado tal cual a `KonvaRendererOptions.resolveAssetSource`. */
  resolve(assetId: AssetId): HTMLImageElement | undefined;
  clear(): void;
}

export function createImageAssetCache(): ImageAssetCache {
  const images = new Map<AssetId, HTMLImageElement>();
  return {
    set(assetId, image) {
      images.set(assetId, image);
    },
    resolve(assetId) {
      return images.get(assetId);
    },
    clear() {
      images.clear();
    },
  };
}

function collectImageObjects(objects: readonly SceneObject[], out: SceneObject[]): void {
  for (const object of objects) {
    if (object.type === "image") out.push(object);
    if (object.type === "group") collectImageObjects(object.children, out);
  }
}

/**
 * Recorre un Project recién cargado (ej. desde `localStorage`, ver
 * `persistence.ts`) y precarga en `cache` cada `ImageObject` cuyo data URL
 * quedó embebido en `customProperties[IMAGE_DATA_URL_PROPERTY]` al
 * guardarlo — así el Renderer puede resolverlas desde el primer render,
 * sin un "parpadeo" de placeholder mientras cada imagen carga.
 */
export async function preloadProjectImages(project: Project, cache: ImageAssetCache): Promise<void> {
  const imageObjects: SceneObject[] = [];
  for (const page of project.document.pages) {
    for (const layer of page.layers) {
      collectImageObjects(layer.objects, imageObjects);
    }
  }

  await Promise.all(
    imageObjects.map(async (object) => {
      if (object.type !== "image") return;
      const dataUrl = object.customProperties[IMAGE_DATA_URL_PROPERTY];
      if (typeof dataUrl !== "string") return;
      const image = await loadImageElement(dataUrl);
      cache.set(object.assetId, image);
    }),
  );
}
