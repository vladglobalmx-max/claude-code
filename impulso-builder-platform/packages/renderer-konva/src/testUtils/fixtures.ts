import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type Document,
  type Page,
  type Layer,
  type SceneObject,
  type RectangleObject,
  type EllipseObject,
  type GroupObject,
  type TextObject,
  type PathObject,
  type ImageObject,
} from "@impulso/document-schema";

/** Fixtures compartidos entre tests de este paquete — no forman parte de la API pública. */
export const NOW = "2026-07-17T00:00:00.000Z";

const baseMetadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

export function buildRectangle(id: string, overrides: Partial<RectangleObject> = {}): RectangleObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildEllipse(id: string, overrides: Partial<EllipseObject> = {}): EllipseObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "ellipse",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 20, height: 10 },
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildText(id: string, overrides: Partial<TextObject> = {}): TextObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "text",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    content: "hola",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: 400,
    textAlign: "left",
    lineHeight: 1.2,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildPath(id: string, overrides: Partial<PathObject> = {}): PathObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "path",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    segments: [
      { type: "moveTo", point: { x: 0, y: 0 } },
      { type: "lineTo", point: { x: 10, y: 0 } },
    ],
    closed: false,
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildImage(id: string, overrides: Partial<ImageObject> = {}): ImageObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "image",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    assetId: AssetIdSchema.parse("asset_1"),
    size: { width: 30, height: 30 },
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildGroup(id: string, children: SceneObject[], overrides: Partial<GroupObject> = {}): GroupObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "group",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    children,
    ...overrides,
  };
}

export function buildLayer(id: string, objects: SceneObject[] = [], overrides: Partial<Layer> = {}): Layer {
  return {
    id: LayerIdSchema.parse(id),
    objects,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildPage(id: string, layers: Layer[] = [], overrides: Partial<Page> = {}): Page {
  return {
    id: PageIdSchema.parse(id),
    size: { width: 100, height: 100 },
    unit: "px",
    grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
    layers,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildDocument(pages: Page[] = [buildPage("page_1")], overrides: Partial<Document> = {}): Document {
  return {
    id: DocumentIdSchema.parse("document_1"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    documentVersion: 1,
    pages,
    assets: [],
    metadata: { ...baseMetadata, name: "Documento de prueba" },
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: buildDocument(),
    metadata: { ...baseMetadata, name: "Proyecto de prueba" },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}
