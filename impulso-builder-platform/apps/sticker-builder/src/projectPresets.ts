import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";

export type StickerShape = "square" | "circle" | "rectangle";

export interface CreateProjectFromSizeOptions {
  widthMm: number;
  heightMm: number;
  shape: StickerShape | "custom";
  now: string;
  /** Inyectable para tests determinísticos; por defecto `crypto.randomUUID()`. */
  generateId?: () => string;
}

function defaultGenerateId(): string {
  return crypto.randomUUID();
}

/** Construye un Project completamente nuevo — un Page/Layer, y (solo para
 * `shape: "circle"`) un `EllipseObject` de fondo con la línea de corte ya
 * modelada. Cada llamada produce ids frescos, nunca reutiliza los de un
 * proyecto anterior. */
export function createProjectFromSize(options: CreateProjectFromSizeOptions): Project {
  const { widthMm, heightMm, shape, now } = options;
  const generateId = options.generateId ?? defaultGenerateId;
  const metadata = { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now };

  const objects =
    shape === "circle"
      ? [
          {
            id: ObjectIdSchema.parse(`object_${generateId()}`),
            type: "ellipse" as const,
            transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            size: { width: widthMm, height: heightMm },
            style: { fill: "#ffffff", strokeWidth: 0.5, stroke: "#cccccc", opacity: 1, blendMode: "normal" as const },
            metadata: { ...metadata, role: "die-line", name: "Línea de corte" },
            pluginData: {},
            customProperties: {},
          },
        ]
      : [];

  return {
    id: ProjectIdSchema.parse(`project_${generateId()}`),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(`document_${generateId()}`),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse(`page_${generateId()}`),
          size: { width: widthMm, height: heightMm },
          unit: "mm",
          layers: [
            {
              id: LayerIdSchema.parse(`layer_${generateId()}`),
              objects,
              metadata,
              pluginData: {},
              customProperties: {},
            },
          ],
          metadata,
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata,
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...metadata, name: "Sticker sin título" },
    pluginData: {},
    customProperties: {},
  };
}
