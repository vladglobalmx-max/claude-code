import { AssetIdSchema, type ImageAsset } from "@impulso/document-schema";

export interface CreateImageAssetFromFileOptions {
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

export interface IngestedImageAsset {
  asset: ImageAsset;
  /** El propio `File`, listo para pasarle a `AssetBinaryStore.set`. */
  binary: Blob;
}

function loadImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("El archivo no es una imagen válida."));
    };
    image.src = url;
  });
}

/**
 * Único "ingestion helper" implementado en Asset Library v1 — construye un
 * `ImageAsset` (descriptor) + su `Blob` a partir de un `File` (PNG/SVG)
 * elegido por el usuario. Un futuro tipo de Asset (fuente, plantilla,
 * ícono, patrón...) agrega su propio `xxxIngestion.ts` con la misma forma
 * (recibe la fuente de datos que le corresponda, devuelve
 * `{ asset, binary }`) sin tocar este archivo ni `AssetBinaryStore` — ver
 * ADR de esta épica.
 */
export async function createImageAssetFromFile(
  file: File,
  options: CreateImageAssetFromFileOptions,
): Promise<IngestedImageAsset> {
  const { width, height } = await loadImageDimensions(file);
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  const asset: ImageAsset = {
    id: AssetIdSchema.parse(`asset_${generateId()}`),
    type: "image",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    width,
    height,
    metadata: { tags: [], visible: true, locked: false, createdAt: options.now, updatedAt: options.now },
    pluginData: {},
    customProperties: {},
  };
  return { asset, binary: file };
}
