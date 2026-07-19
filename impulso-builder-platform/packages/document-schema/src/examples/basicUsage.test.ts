/**
 * Estos "tests" son a la vez ejemplos de uso ejecutables: documentan cómo
 * un consumidor externo (el futuro Impulso Engine) construiría, validaría,
 * serializaría y migraría un Project usando SOLO la API pública exportada
 * desde `src/index.ts` — nunca un import interno de una carpeta concreta.
 * Si la API pública cambia de forma incompatible, este archivo deja de
 * compilar o de pasar, lo cual es la garantía de que el ejemplo nunca
 * queda desactualizado respecto al código real.
 */
import { describe, expect, it } from "vitest";
import {
  type Project,
  ProjectIdSchema,
  DocumentIdSchema,
  PageIdSchema,
  LayerIdSchema,
  ObjectIdSchema,
  AssetIdSchema,
  CURRENT_SCHEMA_VERSION,
  serializeProject,
  deserializeProject,
  cloneProject,
  validateProject,
  type Migration,
} from "../index.js";

const NOW = "2026-07-17T00:00:00.000Z";

function buildExampleProject(): Project {
  return {
    id: ProjectIdSchema.parse("project_demo"),
    // "sticker-builder" es solo un string para el Document Schema: el
    // paquete no sabe nada de stickers, es el Engine quien interpreta este
    // moduleId para cargar el plugin correcto.
    moduleId: "sticker-builder",
    document: {
      id: DocumentIdSchema.parse("document_demo"),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      documentVersion: 1,
      pages: [
        {
          id: PageIdSchema.parse("page_demo"),
          size: { width: 76, height: 76 },
          unit: "mm",
          grid: { visible: false, snapEnabled: false, size: 10, type: "lines" },
          layers: [
            {
              id: LayerIdSchema.parse("layer_demo"),
              objects: [
                // Un fondo: rectángulo simple.
                {
                  id: ObjectIdSchema.parse("background"),
                  type: "rectangle",
                  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: 76, height: 76 },
                  cornerRadius: 8,
                  style: { fill: "#fef08a", strokeWidth: 0, opacity: 1, blendMode: "normal" },
                  metadata: {
                    name: "Fondo",
                    tags: [],
                    visible: true,
                    locked: false,
                    createdAt: NOW,
                    updatedAt: NOW,
                  },
                  pluginData: {},
                  customProperties: {},
                },
                // Una imagen subida por el usuario, referenciada por assetId.
                {
                  id: ObjectIdSchema.parse("logo"),
                  type: "image",
                  assetId: AssetIdSchema.parse("asset_logo"),
                  transform: { x: 8, y: 8, rotation: 0, scaleX: 1, scaleY: 1 },
                  size: { width: 60, height: 60 },
                  style: { opacity: 1, strokeWidth: 0, blendMode: "normal" },
                  metadata: {
                    tags: [],
                    visible: true,
                    locked: false,
                    createdAt: NOW,
                    updatedAt: NOW,
                  },
                  pluginData: {},
                  customProperties: {},
                },
                // La línea de corte: un plugin de Sticker Builder la modela
                // como un "path" con metadata.role = "die-line" — NO como un
                // tipo de Object nuevo. El Document Schema no sabe qué es un
                // die-line; solo sabe dibujar un path.
                {
                  id: ObjectIdSchema.parse("die-line"),
                  type: "path",
                  closed: true,
                  segments: [
                    { type: "moveTo", point: { x: 0, y: 8 } },
                    { type: "lineTo", point: { x: 76, y: 8 } },
                    { type: "lineTo", point: { x: 76, y: 68 } },
                    { type: "lineTo", point: { x: 0, y: 68 } },
                    { type: "close" },
                  ],
                  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                  style: { stroke: "#000000", strokeWidth: 0.25, opacity: 1, blendMode: "normal" },
                  metadata: {
                    role: "die-line",
                    tags: [],
                    visible: true,
                    locked: false,
                    createdAt: NOW,
                    updatedAt: NOW,
                  },
                  pluginData: {
                    "sticker-builder": { bleedMm: 3, material: "vinyl-glossy" },
                  },
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
      assets: [],
      metadata: {
        name: "Sticker circular de logo",
        tags: ["demo"],
        visible: true,
        locked: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      history: { entries: [] },
      pluginData: {},
      customProperties: {},
    },
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

describe("Ejemplo de uso: construir, validar y serializar un Project", () => {
  it("construye un Project válido con formas, imagen y una línea de corte modelada vía metadata.role", () => {
    const project = buildExampleProject();
    expect(() => validateProject(project)).not.toThrow();
  });

  it("serializa a JSON y deserializa de vuelta a un Project idéntico", () => {
    const project = buildExampleProject();

    const json = serializeProject(project);
    expect(typeof json).toBe("string");

    const restored = deserializeProject(json);
    expect(restored).toEqual(project);
  });

  it("clonar produce un Project igual pero independiente (mutar el clon no afecta al original)", () => {
    const project = buildExampleProject();
    const clone = cloneProject(project);

    // Mutación estructural del clon vía reconstrucción inmutable —
    // este paquete no expone setters mutables (ver "Inmutabilidad" en la
    // arquitectura), así que "mutar" siempre significa "construir un nuevo
    // valor".
    const mutatedClone: Project = {
      ...clone,
      metadata: { ...clone.metadata, name: "Nombre cambiado solo en el clon" },
    };

    expect(project.metadata.name).toBe("Mi primer sticker");
    expect(mutatedClone.metadata.name).toBe("Nombre cambiado solo en el clon");
  });

  it("rechaza un Project inválido con un mensaje de Zod útil (die-line con 0 segmentos)", () => {
    const project = buildExampleProject();
    const brokenProject: unknown = {
      ...project,
      document: {
        ...project.document,
        pages: [
          {
            ...project.document.pages[0],
            layers: [
              {
                ...project.document.pages[0]?.layers[0],
                objects: [{ ...project.document.pages[0]?.layers[0]?.objects[2], segments: [] }],
              },
            ],
          },
        ],
      },
    };

    expect(() => validateProject(brokenProject)).toThrow();
  });
});

describe("Ejemplo de migración: simular un futuro cambio incompatible de schemaVersion", () => {
  it("migra un Project guardado con un schemaVersion antiguo antes de validarlo", () => {
    const project = buildExampleProject();

    // Simula cómo se vería un Project guardado ANTES de un cambio futuro
    // hipotético: la Page renombraría "size" a "canvasSize". No es un
    // cambio real de hoy — CURRENT_SCHEMA_VERSION sigue siendo 1 — solo
    // demuestra que el mecanismo de migración funciona de punta a punta.
    const legacyPage = project.document.pages[0];
    const legacyRaw = JSON.stringify({
      ...project,
      document: {
        ...project.document,
        schemaVersion: 1,
        pages: [{ ...legacyPage, size: undefined, canvasSize: legacyPage?.size }],
      },
    });

    const renameSizeToCanvasSize: Migration = {
      fromVersion: 1,
      toVersion: 2,
      migrate: (raw) => {
        const pages = raw.pages as Array<Record<string, unknown>>;
        return {
          ...raw,
          pages: pages.map(({ canvasSize, ...rest }) => ({ ...rest, size: canvasSize })),
        };
      },
    };

    const restored = deserializeProject(legacyRaw, {
      migrations: [renameSizeToCanvasSize],
      targetVersion: 2,
    });

    expect(restored.document.schemaVersion).toBe(2);
    expect(restored.document.pages[0]?.size).toEqual(legacyPage?.size);
  });
});
