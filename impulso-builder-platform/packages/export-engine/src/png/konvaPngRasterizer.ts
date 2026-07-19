import { rasterizeProjectToPng } from "./rasterizeProjectToPng.js";
import type { PngRasterizer } from "./pngRasterizer.js";

/**
 * Implementación por defecto (y única, hoy) de `PngRasterizer` — reutiliza
 * `@impulso/renderer-konva` vía un Stage headless (`renderPageToStage`).
 * Es el ÚNICO punto de todo `@impulso/export-engine` que depende de
 * Konva; el resto del paquete (núcleo SVG, orquestación, tipos) no lo
 * importa. Ver ADR-0012 para el costo aceptado de esta dependencia y la
 * estrategia de sustitución futura.
 */
export const konvaPngRasterizer: PngRasterizer = {
  rasterize: rasterizeProjectToPng,
};
