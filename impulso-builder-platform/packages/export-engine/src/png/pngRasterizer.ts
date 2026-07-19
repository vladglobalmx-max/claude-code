import type { Project } from "@impulso/document-schema";
import type { ExportAssetResolver, PngExportOptions } from "../types.js";
import type { RasterizePngResult } from "./rasterizeProjectToPng.js";

/**
 * Puerto de rasterización PNG: `exportProject` depende de ESTA interfaz,
 * no directamente de Konva. `konvaPngRasterizer` (`konvaPngRasterizer.ts`)
 * es la única implementación hoy, aprobada explícitamente reutilizando
 * `@impulso/renderer-konva` vía un Stage headless por fidelidad visual y
 * reutilización de código probado (ver ADR-0012, "Aprobación formal y
 * condiciones"). Un futuro rasterizador alternativo (otro motor de
 * canvas, WASM, rendering server-side) solo necesita implementar este
 * método e inyectarse en `exportProject({ pngRasterizer })` — sin tocar
 * `ExportOptions`, `ExportResult`, ni ningún consumidor existente (ver
 * ADR-0012, "Estrategia de sustitución futura").
 */
export interface PngRasterizer {
  rasterize(project: Project, resolver: ExportAssetResolver, options: PngExportOptions): Promise<RasterizePngResult>;
}
