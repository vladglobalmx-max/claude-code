import { ObjectIdSchema, toPixels, type AssetId, type ImageAsset, type Page } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import { createImageAssetFromFile, type AssetBinaryStore } from "@impulso/asset-library";
import { loadImageElement, type ResolvedAssetCache } from "./assetResolution.js";

const DEFAULT_TEXT_WIDTH = 160;
const DEFAULT_TEXT_HEIGHT = 40;
const MAX_IMAGE_DIMENSION = 200;
const OFFSET_STEP = 24;
const OFFSET_CYCLE = 5;

/** Calcula dónde insertar un object nuevo: centrado en la página, con un
 * desplazamiento en cascada que se repite cada `OFFSET_CYCLE` inserciones
 * (para que objects consecutivos no queden perfectamente apilados uno
 * sobre otro, sin necesitar "colocar con un click" — ver ADR-0010). */
export function computeInsertPosition(
  pageWidth: number,
  pageHeight: number,
  width: number,
  height: number,
  offsetIndex: number,
): { x: number; y: number } {
  const offset = (offsetIndex % OFFSET_CYCLE) * OFFSET_STEP;
  return { x: pageWidth / 2 - width / 2 + offset, y: pageHeight / 2 - height / 2 + offset };
}

function scaleToFit(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return { width: width * scale, height: height * scale };
}

export interface ToolsController {
  insertText(): void;
  /** Sube un archivo a la Biblioteca de Assets (binario + descriptor) SIN
   * insertarlo en el canvas — usado por el panel de Assets ("Subir
   * imagen"). */
  uploadAsset(file: File): Promise<void>;
  /** Sube un archivo nuevo: lo registra en la Asset Library y lo inserta
   * de inmediato como un `ImageObject` — usado por la tools-bar/atajo "I". */
  insertImage(file: File): Promise<void>;
  /** Inserta un `ImageObject` que reutiliza un Asset YA existente en la
   * Biblioteca (ver `assetsPanel.ts`) — sin subir nada de nuevo. */
  insertImageFromAsset(assetId: AssetId): void;
}

export interface CreateToolsControllerOptions {
  engine: Engine;
  binaryStore: AssetBinaryStore;
  resolvedCache: ResolvedAssetCache;
  now?: () => string;
  generateId?: () => string;
}

function firstPageAndLayer(engine: Engine) {
  const project = engine.getProject();
  const page = project.document.pages[0];
  const layer = page?.layers[0];
  if (!page || !layer) {
    throw new Error("El Project no tiene ninguna Page/Layer donde insertar.");
  }
  return { page, layer };
}

/**
 * Bug real encontrado en la validación de comprador en vivo de RC1: `Page.size`
 * vive SIEMPRE en la unidad física cruda de la página (`Page.unit` — casi
 * siempre "mm" en proyectos reales), mientras que `Transform`/`size` de
 * cualquier object insertado (texto, imagen, línea de corte) viven SIEMPRE
 * en píxeles canónicos (ver comentario de `createProjectFromSize` en
 * `projectPresets.ts` y ADR de Fase 9.1) — el mismo espacio numérico que
 * `DEFAULT_TEXT_WIDTH`/`MAX_IMAGE_DIMENSION` de este archivo. Insertar un
 * object usando `page.size.width/height` sin convertir (como hacía este
 * código antes) mezcla ambas unidades: en un sticker de 50mm reales
 * (≈189 px canónicos), la posición/tamaño calculados terminaban fuera de la
 * página casi por completo. Debe convertirse SIEMPRE con `toPixels` antes
 * de combinarlo con cualquier valor de object.
 */
function pageSizeInCanonicalPx(page: Page): { width: number; height: number } {
  return { width: toPixels(page.size.width, page.unit), height: toPixels(page.size.height, page.unit) };
}

/**
 * Acciones "Agregar texto"/"Agregar imágenes SVG/PNG" (ver Épica: Sticker
 * Creation Experience). Ambas insertan un object ya centrado en la página
 * (en vez de exigir "elegir la herramienta y luego hacer click en el
 * canvas para colocarlo", que requeriría traducir coordenadas de pantalla
 * a través del zoom CSS hasta el Stage de Konva) — el usuario lo arrastra
 * a su posición final con la interacción de mover ya existente. Decisión
 * de UX documentada en ADR-0010.
 */
export function createToolsController(options: CreateToolsControllerOptions): ToolsController {
  const { engine, binaryStore, resolvedCache } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const generateId = options.generateId ?? (() => crypto.randomUUID());
  let insertCount = 0;

  function baseMetadata(): {
    tags: string[];
    visible: boolean;
    locked: boolean;
    createdAt: string;
    updatedAt: string;
  } {
    const timestamp = now();
    return { tags: [], visible: true, locked: false, createdAt: timestamp, updatedAt: timestamp };
  }

  function insertText(): void {
    const { page, layer } = firstPageAndLayer(engine);
    const pagePx = pageSizeInCanonicalPx(page);
    const position = computeInsertPosition(pagePx.width, pagePx.height, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT, insertCount++);
    engine.dispatch({
      type: "addObject",
      pageId: page.id,
      layerId: layer.id,
      object: {
        id: ObjectIdSchema.parse(`object_${generateId()}`),
        type: "text",
        transform: { x: position.x, y: position.y, rotation: 0, scaleX: 1, scaleY: 1 },
        content: "Texto",
        fontFamily: "sans-serif",
        fontSize: 24,
        fontWeight: 400,
        textAlign: "left",
        lineHeight: 1.2,
        style: { fill: "#000000", strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata: baseMetadata(),
        pluginData: {},
        customProperties: {},
      },
    });
  }

  function insertImageObject(
    assetId: AssetId,
    size: { width: number; height: number },
    id: string,
    timestamp: string,
    insertIndex: number,
  ): void {
    const { page, layer } = firstPageAndLayer(engine);
    // Bug real encontrado en la validación de comprador en vivo de RC1 (ver
    // `pageSizeInCanonicalPx`): el tope de tamaño y el centrado deben
    // calcularse en píxeles canónicos, la misma unidad que `size`/`transform`
    // de cualquier object — nunca en la unidad física cruda de `page.size`.
    // Además, el tope siempre debe ser relativo al tamaño real de la página
    // (nunca solo un absoluto fijo): en un sticker pequeño, una imagen
    // importada sin este límite relativo terminaba más grande que la propia
    // página.
    const pagePx = pageSizeInCanonicalPx(page);
    const maxDimension = Math.min(MAX_IMAGE_DIMENSION, Math.min(pagePx.width, pagePx.height) * 0.8);
    const fitSize = scaleToFit(size.width, size.height, maxDimension);
    const position = computeInsertPosition(pagePx.width, pagePx.height, fitSize.width, fitSize.height, insertIndex);
    engine.dispatch({
      type: "addObject",
      pageId: page.id,
      layerId: layer.id,
      object: {
        id: ObjectIdSchema.parse(id),
        type: "image",
        assetId,
        transform: { x: position.x, y: position.y, rotation: 0, scaleX: 1, scaleY: 1 },
        size: fitSize,
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata: { tags: [], visible: true, locked: false, createdAt: timestamp, updatedAt: timestamp },
        pluginData: {},
        customProperties: {},
      },
    });
  }

  /** Ingesta compartida por `uploadAsset` (solo Biblioteca) e `insertImage`
   * (Biblioteca + inserción inmediata): decodifica el archivo, guarda su
   * binario, resuelve el cache sincrónico del Renderer, y registra el
   * descriptor en `document.assets`. */
  async function ingestAndRegister(file: File): Promise<ImageAsset> {
    const timestamp = now();
    const { asset, binary } = await createImageAssetFromFile(file, { now: timestamp, generateId });
    await binaryStore.set(asset.id, binary);
    const { image, objectUrl } = await loadImageElement(binary);
    resolvedCache.set(asset.id, image, objectUrl);
    engine.dispatch({ type: "addAsset", asset });
    return asset;
  }

  async function uploadAsset(file: File): Promise<void> {
    await ingestAndRegister(file);
  }

  async function insertImage(file: File): Promise<void> {
    const asset = await ingestAndRegister(file);
    insertImageObject(asset.id, { width: asset.width, height: asset.height }, `object_${generateId()}`, now(), insertCount++);
  }

  function insertImageFromAsset(assetId: AssetId): void {
    const asset = engine.getProject().document.assets.find((candidate) => candidate.id === assetId);
    if (!asset || asset.type !== "image") return;
    insertImageObject(assetId, { width: asset.width, height: asset.height }, `object_${generateId()}`, now(), insertCount++);
  }

  return { insertText, uploadAsset, insertImage, insertImageFromAsset };
}

export interface ToolButtons {
  /** Abre el selector de archivos nativo — expuesto para que el atajo de
   * teclado "I" (ver `keyboardShortcuts.ts`) dispare el mismo picker que el
   * botón, sin duplicar el `<input type="file">`. */
  openFilePicker(): void;
  destroy(): void;
}

/** Cablea 2 botones de la Toolbar ("Texto"/"Imagen") sobre un
 * `ToolsController` — separado de este último para poder testear la
 * lógica de inserción sin simular un `<input type="file">` real. */
export function mountToolButtons(container: HTMLElement, controller: ToolsController): ToolButtons {
  const textButton = document.createElement("button");
  textButton.type = "button";
  textButton.className = "tool-text";
  textButton.textContent = "Texto";
  textButton.title = "Agregar texto (T)";
  textButton.addEventListener("click", () => controller.insertText());

  const imageButton = document.createElement("button");
  imageButton.type = "button";
  imageButton.className = "tool-image";
  imageButton.textContent = "Imagen";
  imageButton.title = "Agregar imagen SVG/PNG (I)";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.className = "tool-image-input";
  fileInput.accept = "image/png,image/svg+xml";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (file) void controller.insertImage(file);
  });

  imageButton.addEventListener("click", () => fileInput.click());

  container.appendChild(textButton);
  container.appendChild(imageButton);
  container.appendChild(fileInput);

  return {
    openFilePicker: () => fileInput.click(),
    destroy: () => {
      textButton.remove();
      imageButton.remove();
      fileInput.remove();
    },
  };
}
