import { buildSvgDocument, type ExportAssetResolver } from "@impulso/export-engine";
import { ProjectSchema, type Document, type Project } from "@impulso/document-schema";
import { nextProjectId } from "./ids.js";

/**
 * Ningún object de la Fase 1 referencia un Asset — este resolver nunca se
 * invoca en la práctica, pero `buildSvgDocument` lo exige por contrato.
 */
const noopResolver: ExportAssetResolver = {
  resolve: async () => undefined,
};

function toProject(document: Document): Project {
  const now = new Date().toISOString();
  return ProjectSchema.parse({
    id: nextProjectId(),
    moduleId: "creative-engine",
    document,
    metadata: { tags: [], visible: true, locked: false, createdAt: now, updatedAt: now },
    pluginData: {},
    customProperties: {},
  });
}

/**
 * Envuelve el Document en el Project mínimo que
 * `@impulso/export-engine#buildSvgDocument` exige, y devuelve el SVG ya
 * resuelto. Nunca importa `exportProject` (que arrastra
 * @impulso/renderer-konva/Konva) — solo el camino SVG, independiente de
 * Konva por diseño del propio Motor de Exportación.
 */
export async function exportarSVG(document: Document): Promise<string> {
  const project = toProject(document);
  const result = await buildSvgDocument(project, noopResolver);
  return result.svg;
}
