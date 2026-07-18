# Changelog — @impulso/export-engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Epic 3: Export Engine Foundation

### Agregado
- `exportProject(project, resolver, options)`: punto de entrada único, produce PNG o SVG a partir de un `Project`.
- Núcleo SVG (`svg/`): `buildSvgDocument` — recorrido puro y determinista de `Document` a string SVG, sin ninguna dependencia de Konva. Preserva orden de capas/objetos, transform/opacidad/blend/sombra, grupos anidados, texto como `<text>` real, e imágenes embebidas como data URI.
- Adaptador PNG (`png/`): `rasterizeProjectToPng` — reutiliza `@impulso/renderer-konva` vía un Stage headless (`renderPageToStage`, nuevo en esa dependencia) para garantizar fidelidad pixel a pixel con el editor. Escala 1x-4x, fondo transparente o sólido.
- `ExportAssetResolver`: interfaz propia (no depende de `@impulso/asset-library`) para resolver el binario de un Asset.
- `ExportWarning`/`ExportError`: degradación controlada (Asset eliminado-pero-referenciado, binario ausente) vs. errores duros (`no_active_page`, `invalid_filename`, `out_of_memory`, `download_failed`) — nunca un fallo silencioso.
- `triggerBrowserDownload`/`sanitizeFilename` (`browser/`): adaptador DOM-only, reutilizable por futuros módulos.
- Paquete nuevo, nacido directamente reutilizable (no como módulo de app) por ser un pilar nombrado de Impulso Platform — ver ADR-0012.
- 59 tests, ~99% de cobertura, cero dependencias circulares.

### Fuera de alcance (deliberado)
PDF print-ready, línea de corte/sangrado ensamblados, detección de `font_unavailable`, deduplicación/compresión de Assets embebidos, exportación por lotes.
