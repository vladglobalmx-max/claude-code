import {
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  CURRENT_SCHEMA_VERSION,
  type Project,
} from "@impulso/document-schema";

const NOW = new Date().toISOString();

const baseMetadata = { tags: [], visible: true, locked: false, createdAt: NOW, updatedAt: NOW };

/**
 * Project de demostración para el Canvas Runtime. No proviene de ningún
 * origen externo (no existe Persistence ni Biblioteca de Assets todavía,
 * ver ADR-0005) — es un Project construido en código, tan válido y tan
 * "real" para el pipeline como cualquier otro: pasa por
 * `ProjectSchema.parse` exactamente igual (createEngine lo valida al
 * construirse).
 *
 * Incluye un rectangle, un ellipse y un text para demostrar que el
 * Renderer traduce más de un tipo de SceneObject en el mismo documento.
 */
export function createDemoProject(): Project {
  return {
    id: ProjectIdSchema.parse("demo_project"),
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("demo_document"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("demo_page"),
          size: { width: 320, height: 320 },
          unit: "px",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [
            {
              id: LayerIdSchema.parse("demo_layer"),
              objects: [
                {
                  id: ObjectIdSchema.parse("background"),
                  type: "rectangle",
                  transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: 280, height: 280 },
                  cornerRadius: 24,
                  style: { fill: "#fef08a", strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...baseMetadata, name: "Fondo" },
                  pluginData: {},
                  customProperties: {},
                },
                {
                  id: ObjectIdSchema.parse("badge"),
                  type: "ellipse",
                  transform: { x: 60, y: 60, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: 200, height: 200 },
                  style: {
                    fill: "#f97316",
                    stroke: "#7c2d12",
                    strokeWidth: 4,
                    opacity: 1,
                    blendMode: "normal",
                  },
                  metadata: { ...baseMetadata, name: "Insignia" },
                  pluginData: {},
                  customProperties: {},
                },
                {
                  id: ObjectIdSchema.parse("label"),
                  type: "text",
                  transform: { x: 90, y: 145, rotation: 0, scaleX: 1, scaleY: 1 },
                  content: "Impulso",
                  fontFamily: "sans-serif",
                  fontSize: 28,
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.2,
                  size: { width: 140, height: 40 },
                  style: { fill: "#1c1917", strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: { ...baseMetadata, name: "Texto" },
                  pluginData: {},
                  customProperties: {},
                },
              ],
              metadata: { ...baseMetadata, name: "Capa principal" },
              pluginData: {},
              customProperties: {},
            },
          ],
          metadata: { ...baseMetadata, name: "Página 1" },
          pluginData: {},
          customProperties: {},
        },
      ],
      assets: [],
      metadata: { ...baseMetadata, name: "Documento de demostración" },
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
    metadata: { ...baseMetadata, name: "Canvas Runtime demo" },
    pluginData: {},
    customProperties: {},
  };
}
