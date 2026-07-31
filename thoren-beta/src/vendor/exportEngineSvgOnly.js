// Shim de integración (vive en thoren-beta, no en el monorepo) que
// sustituye a "@impulso/export-engine" para el bundle de navegador.
//
// El paquete real reexporta, desde el mismo índice, tanto
// `buildSvgDocument` (independiente de Konva) como `exportProject`/
// `konvaPngRasterizer` (que arrastran @impulso/renderer-konva -> Konva).
// @impulso/creative-engine#exportar.ts solo necesita `buildSvgDocument` —
// este shim resuelve exactamente esa función desde su propio archivo
// fuente, evitando que Konva entre al bundle del navegador sin tocar ni
// un archivo del paquete congelado.
export { buildSvgDocument } from "../../../impulso-builder-platform/packages/export-engine/src/svg/buildSvgDocument.ts";
