import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";

export const NOW = "2026-07-19T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

export function buildWorkspaceProject(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectIdSchema.parse(id),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse(`document_${id}`),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 50, height: 50 },
          unit: "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" as const },
          layers: [{ id: LayerIdSchema.parse("layer_1"), objects: [], metadata, pluginData: {}, customProperties: {} }],
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
    metadata: { ...metadata, name: "Proyecto de prueba" },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}
