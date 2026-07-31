// Shim de integración que sustituye a "@impulso/export-engine" para el
// bundle de navegador.
//
// El paquete real reexporta, desde el mismo índice, tanto
// `buildSvgDocument` (independiente de Konva) como `exportProject`/
// `konvaPngRasterizer` (que arrastran @impulso/renderer-konva -> Konva).
// @impulso/creative-engine#exportar.ts solo necesita `buildSvgDocument` —
// este shim resuelve exactamente esa función desde una copia vendorizada
// (ver src/vendor/engine/, "instantánea congelada" del paquete aprobado
// en Fase 1/2 de docs/product/THOREN_IMPLEMENTATION_PLAN.md), evitando que
// Konva entre al bundle del navegador. thoren-beta ya no depende de ningún
// archivo fuera de este repositorio para construir.
export { buildSvgDocument } from "./engine/export-engine-svg/svg/buildSvgDocument.ts";
