export { createKonvaRenderer, resolveActivePage } from "./renderer.js";
export type { RendererAdapter, KonvaRendererOptions, NodeContext } from "./types.js";

// Rasterización headless (Export Engine, ver ADR-0012) — construye un
// Konva.Stage desacoplado del editor, nunca el Stage interactivo montado.
export { renderPageToStage } from "./offscreenRenderer.js";
export type { OffscreenRenderOptions, OffscreenRender } from "./offscreenRenderer.js";

// Utilidades de traducción expuestas por si un consumidor avanzado (o un
// futuro paquete hermano, ej. un exportador headless) necesita la misma
// lógica de mapeo sin pasar por el ciclo completo mount/render.
export { createSceneNode } from "./nodes/sceneNode.js";
export { segmentsToSvgPathData } from "./nodes/path.js";
export { toKonvaXY, fromKonvaXY } from "./coordinates.js";
export { toPixels } from "./unit.js";
export { toCanvasBlendMode } from "./style.js";
