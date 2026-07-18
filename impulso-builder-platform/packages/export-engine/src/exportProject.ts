import type { ExportAssetResolver, ExportOptions, ExportResult } from "./types.js";
import { buildSvgDocument } from "./svg/buildSvgDocument.js";
import { rasterizeProjectToPng } from "./png/rasterizeProjectToPng.js";
import type { Project } from "@impulso/document-schema";

/**
 * Punto de entrada único del Export Engine: `Project -> archivo final`.
 * SVG usa el núcleo puro (`svg/`, sin Konva); PNG reutiliza
 * `@impulso/renderer-konva` vía un Stage headless (`png/`, ver ADR-0012).
 * Ninguno de los dos lee estado de edición (selección, handles, zoom) —
 * ambos parten siempre de `project.document`.
 */
export async function exportProject(
  project: Project,
  resolver: ExportAssetResolver,
  options: ExportOptions,
): Promise<ExportResult> {
  if (options.format === "svg") {
    const { svg, widthPx, heightPx, warnings } = await buildSvgDocument(project, resolver, { pageId: options.pageId });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    return { format: "svg", blob, width: widthPx, height: heightPx, byteSize: blob.size, warnings, svgString: svg };
  }

  const { blob, width, height, warnings } = await rasterizeProjectToPng(project, resolver, options);
  return { format: "png", blob, width, height, byteSize: blob.size, warnings };
}
