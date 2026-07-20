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
  type TextObject,
  type ImageObject,
  type ImageAsset,
} from "@impulso/document-schema";
import { createPrintJob } from "../printJob.js";
import type { PrintJob, PrintProfileId } from "../types.js";

export const NOW = "2026-07-20T00:00:00.000Z";
const baseMetadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };
const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

export function buildText(id: string, overrides: Partial<TextObject> = {}): TextObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "text",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    content: "Hola",
    fontFamily: "Arial",
    fontSize: 16,
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

export function buildImage(id: string, overrides: Partial<ImageObject> = {}): ImageObject {
  return {
    id: ObjectIdSchema.parse(id),
    type: "image",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    assetId: AssetIdSchema.parse("asset_1"),
    size: { width: 96, height: 96 },
    style: baseStyle,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildImageAsset(id: string, overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: AssetIdSchema.parse(id),
    type: "image",
    name: id,
    mimeType: "image/png",
    width: 96,
    height: 96,
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
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
    size: { width: 50, height: 50 },
    unit: "mm",
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
    metadata: baseMetadata,
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
    metadata: baseMetadata,
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

/** `PrintJob` de conveniencia para tests — apunta a la primera página del
 * `Project` dado, con el perfil `"print-pdf"` salvo que se indique otro. */
export function buildPrintJobFor(project: Project, profile: PrintProfileId = "print-pdf", overrides: Parameters<typeof createPrintJob>[0]["overrides"] = {}): PrintJob {
  const page = project.document.pages[0]!;
  return createPrintJob({
    documentId: project.document.id,
    pageIds: [page.id],
    dimensions: { width: page.size.width, height: page.size.height, unit: page.unit },
    profile,
    now: () => NOW,
    overrides,
  });
}
