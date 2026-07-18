import { ObjectIdSchema } from "@impulso/document-schema";
import type { Engine } from "@impulso/engine";
import { loadImageFile, IMAGE_DATA_URL_PROPERTY, type ImageAssetCache } from "./imageAssets.js";

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
  insertImage(file: File): Promise<void>;
}

export interface CreateToolsControllerOptions {
  engine: Engine;
  imageCache: ImageAssetCache;
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
 * Acciones "Agregar texto"/"Agregar imágenes SVG/PNG" (ver Épica: Sticker
 * Creation Experience). Ambas insertan un object ya centrado en la página
 * (en vez de exigir "elegir la herramienta y luego hacer click en el
 * canvas para colocarlo", que requeriría traducir coordenadas de pantalla
 * a través del zoom CSS hasta el Stage de Konva) — el usuario lo arrastra
 * a su posición final con la interacción de mover ya existente. Decisión
 * de UX documentada en ADR-0010.
 */
export function createToolsController(options: CreateToolsControllerOptions): ToolsController {
  const { engine, imageCache } = options;
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
    const position = computeInsertPosition(
      page.size.width,
      page.size.height,
      DEFAULT_TEXT_WIDTH,
      DEFAULT_TEXT_HEIGHT,
      insertCount++,
    );
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

  async function insertImage(file: File): Promise<void> {
    const loaded = await loadImageFile(file);
    imageCache.set(loaded.assetId, loaded.image);

    const { page, layer } = firstPageAndLayer(engine);
    const size = scaleToFit(loaded.width, loaded.height, MAX_IMAGE_DIMENSION);
    const position = computeInsertPosition(page.size.width, page.size.height, size.width, size.height, insertCount++);
    engine.dispatch({
      type: "addObject",
      pageId: page.id,
      layerId: layer.id,
      object: {
        id: ObjectIdSchema.parse(`object_${generateId()}`),
        type: "image",
        assetId: loaded.assetId,
        transform: { x: position.x, y: position.y, rotation: 0, scaleX: 1, scaleY: 1 },
        size,
        style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
        metadata: baseMetadata(),
        pluginData: {},
        customProperties: { [IMAGE_DATA_URL_PROPERTY]: loaded.dataUrl },
      },
    });
  }

  return { insertText, insertImage };
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
