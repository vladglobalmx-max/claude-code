import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver, ExportOptions, ExportResult } from "./types.js";
import { buildSvgDocument } from "./svg/buildSvgDocument.js";
import { konvaPngRasterizer } from "./png/konvaPngRasterizer.js";
import type { PngRasterizer } from "./png/pngRasterizer.js";

export interface ExportProjectDependencies {
  /** Rasterizador PNG a usar — por defecto `konvaPngRasterizer` (Stage
   * headless de `@impulso/renderer-konva`). Inyectable para que un futuro
   * rasterizador alternativo se pueda sustituir sin cambiar esta firma ni
   * `ExportOptions`/`ExportResult` (ver ADR-0012, "Estrategia de
   * sustitución futura"). No aplica a `format: "svg"`, que no tiene
   * ningún rasterizador — es un exportador propio sobre Document Schema. */
  pngRasterizer?: PngRasterizer;
}

/**
 * Punto de entrada único del Export Engine: `Project -> archivo final`.
 * SVG usa el núcleo puro (`svg/`, sin Konva); PNG reutiliza
 * `@impulso/renderer-konva` vía un Stage headless, inyectado detrás del
 * puerto `PngRasterizer` (`png/`, ver ADR-0012). Ninguno de los dos lee
 * estado de edición (selección, handles, zoom) — ambos parten siempre de
 * `project.document`.
 */
export async function exportProject(
  project: Project,
  resolver: ExportAssetResolver,
  options: ExportOptions,
  dependencies: ExportProjectDependencies = {},
): Promise<ExportResult> {
  if (options.format === "svg") {
    const { svg, widthPx, heightPx, warnings } = await buildSvgDocument(project, resolver, { pageId: options.pageId });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    return { format: "svg", blob, width: widthPx, height: heightPx, byteSize: blob.size, warnings, svgString: svg };
  }

  const pngRasterizer = dependencies.pngRasterizer ?? konvaPngRasterizer;
  const { blob, width, height, warnings } = await pngRasterizer.rasterize(project, resolver, options);
  return { format: "png", blob, width, height, byteSize: blob.size, warnings };
}
