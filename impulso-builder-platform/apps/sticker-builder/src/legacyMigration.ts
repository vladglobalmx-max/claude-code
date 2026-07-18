import { AssetIdSchema, type Project, type SceneObject, type ImageAsset } from "@impulso/document-schema";
import type { AssetBinaryStore } from "@impulso/asset-library";

/** Clave usada por la versión anterior de esta épica (ver
 * `docs/adr/0010-sticker-creation-experience.md`) para embeber el data URL
 * de una imagen directamente en `customProperties`, antes de que existiera
 * una Asset Library real. Se conserva aquí únicamente para detectar y
 * migrar proyectos guardados con ese formato — nunca se vuelve a escribir. */
const LEGACY_IMAGE_DATA_URL_PROPERTY = "impulsoImageDataUrl";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",");
  const mimeType = /data:(.*);base64/.exec(header ?? "")?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export interface MigrateLegacyImagesOptions {
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

export interface MigrateLegacyImagesResult {
  project: Project;
  /** Cuántas imágenes se migraron — 0 significa que `project` es la misma
   * instancia recibida (nada que migrar). */
  migratedCount: number;
}

/**
 * Normaliza un Project guardado con el mecanismo de imágenes embebidas de
 * la versión anterior de esta épica hacia el modelo real de Asset Library:
 * por cada `ImageObject` con un data URL embebido, crea un `ImageAsset`
 * real, guarda su binario en `store`, y actualiza el object para que
 * referencie ese Asset — sin cambiar nada más del documento. Un Project ya
 * migrado (o creado ya en el formato nuevo) no sufre ningún cambio.
 */
export async function migrateLegacyEmbeddedImages(
  project: Project,
  store: AssetBinaryStore,
  options: MigrateLegacyImagesOptions,
): Promise<MigrateLegacyImagesResult> {
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const newAssets: ImageAsset[] = [];

  async function migrateObject(object: SceneObject): Promise<SceneObject> {
    if (object.type === "group") {
      const children = await Promise.all(object.children.map(migrateObject));
      return children.some((child, i) => child !== object.children[i]) ? { ...object, children } : object;
    }
    if (object.type !== "image") return object;
    const dataUrl = object.customProperties[LEGACY_IMAGE_DATA_URL_PROPERTY];
    if (typeof dataUrl !== "string") return object;

    const blob = dataUrlToBlob(dataUrl);
    const assetId = AssetIdSchema.parse(`asset_${generateId()}`);
    await store.set(assetId, blob);

    const { [LEGACY_IMAGE_DATA_URL_PROPERTY]: _legacyDataUrl, ...remainingCustomProperties } = object.customProperties;
    newAssets.push({
      id: assetId,
      type: "image",
      name: object.metadata.name ?? "Imagen",
      mimeType: blob.type || "application/octet-stream",
      width: object.size.width,
      height: object.size.height,
      metadata: { tags: [], visible: true, locked: false, createdAt: options.now, updatedAt: options.now },
      pluginData: {},
      customProperties: {},
    });
    return { ...object, assetId, customProperties: remainingCustomProperties };
  }

  const pages = await Promise.all(
    project.document.pages.map(async (page) => {
      const layers = await Promise.all(
        page.layers.map(async (layer) => {
          const objects = await Promise.all(layer.objects.map(migrateObject));
          const layerChanged = objects.some((object, i) => object !== layer.objects[i]);
          return layerChanged ? { ...layer, objects } : layer;
        }),
      );
      const pageChanged = layers.some((layer, i) => layer !== page.layers[i]);
      return pageChanged ? { ...page, layers } : page;
    }),
  );

  if (newAssets.length === 0) {
    return { project, migratedCount: 0 };
  }

  return {
    project: {
      ...project,
      document: { ...project.document, pages, assets: [...project.document.assets, ...newAssets] },
    },
    migratedCount: newAssets.length,
  };
}
