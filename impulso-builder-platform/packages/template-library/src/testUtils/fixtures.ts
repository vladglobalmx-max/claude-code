import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";
import type { TemplateDescriptor } from "../types.js";

export const NOW = "2026-07-19T00:00:00.000Z";
const metadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

export function buildTemplateProject(overrides: Partial<Project> = {}): Project {
  return {
    id: ProjectIdSchema.parse("project_template_1"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_template_1"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_1"),
          size: { width: 50, height: 50 },
          unit: "mm",
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
    metadata: { ...metadata, name: "Plantilla de prueba" },
    pluginData: {},
    customProperties: {},
    ...overrides,
  };
}

export function buildTemplateDescriptor(id: string, overrides: Partial<TemplateDescriptor> = {}): TemplateDescriptor {
  return {
    id,
    moduleId: "sticker-builder",
    name: "Plantilla de prueba",
    tags: [],
    builtIn: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
