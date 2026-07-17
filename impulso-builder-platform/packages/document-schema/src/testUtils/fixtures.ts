import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
} from "../primitives/identifiers.js";
import type { Project } from "../project/project.js";
import type { Document } from "../document/document.js";
import { CURRENT_SCHEMA_VERSION } from "../version/constants.js";

/**
 * Fixtures compartidos entre archivos de test — no forman parte de la API
 * pública del paquete (no se re-exportan desde src/index.ts).
 */
export const NOW = "2026-07-17T00:00:00.000Z";

export function buildMinimalDocument(): Document {
  return {
    id: DocumentIdSchema.parse("document_1"),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    documentVersion: 1,
    pages: [
      {
        id: PageIdSchema.parse("page_1"),
        size: { width: 100, height: 150 },
        unit: "mm",
        layers: [
          {
            id: LayerIdSchema.parse("layer_1"),
            objects: [
              {
                id: ObjectIdSchema.parse("object_1"),
                type: "rectangle",
                transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                size: { width: 40, height: 40 },
                cornerRadius: 4,
                style: {
                  fill: "#ff0000",
                  strokeWidth: 0,
                  opacity: 1,
                  blendMode: "normal",
                },
                metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
                pluginData: {},
                customProperties: {},
              },
            ],
            metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
            pluginData: {},
            customProperties: {},
          },
        ],
        metadata: { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW },
        pluginData: {},
        customProperties: {},
      },
    ],
    metadata: {
      name: "Sticker de ejemplo",
      tags: [],
      visible: true,
      locked: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    history: { entries: [] },
    pluginData: {},
    customProperties: {},
  };
}

export function buildMinimalProject(): Project {
  return {
    id: ProjectIdSchema.parse("project_1"),
    moduleId: "sticker-builder",
    document: buildMinimalDocument(),
    metadata: {
      name: "Mi primer sticker",
      tags: [],
      visible: true,
      locked: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    pluginData: {},
    customProperties: {},
  };
}
