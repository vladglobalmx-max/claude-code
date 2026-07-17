import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
  type Document,
  type Page,
  type Layer,
  type SceneObject,
  type RectangleObject,
  type GroupObject,
} from "@impulso/document-schema";

/** Fixtures compartidos entre tests del Engine — no forman parte de la API pública. */
export const NOW = "2026-07-17T00:00:00.000Z";

export function buildRectangle(id: string, overrides: Partial<RectangleObject> = {}): RectangleObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "rectangle",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 10, height: 10 },
    cornerRadius: 0,
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
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
    style: { strokeWidth: 0, opacity: 1, blendMode: "normal" },
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
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
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
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
    layers,
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
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
    metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
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
    metadata: { name: "Proyecto de prueba", tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}
