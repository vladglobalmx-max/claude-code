# Changelog — @impulso/export-engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased] — Epic 9 / Fase 9.5: Hardening (descargas)

### Corregido
- `browser/filename.ts` (`sanitizeFilename`), bug real de error injection: el truncado a 150 caracteres usaba `.slice()` sobre code units UTF-16 — un nombre con un emoji/par subrogado justo en esa posición podía partirlo a la mitad, produciendo un carácter corrupto al final del nombre de archivo. Corregido truncando por code point (`Array.from(...).slice(...).join("")`). Regresión: `filename.test.ts` (2 tests nuevos).

### Verificado sin hallazgos
- `browser/download.test.ts`: filename con Unicode/emoji se pasa sin alterar a `anchor.download`; dos descargas seguidas (mismo patrón que múltiples botones de descarga en un mismo resultado) no comparten ni pisan la object URL una de la otra; repetir la misma descarga dos veces crea anchors/URLs independientes.

## [0.1.1] — Aprobación formal del rasterizador PNG (condiciones del usuario)

### Agregado
- `PngRasterizer` (`png/pngRasterizer.ts`): interfaz/puerto de rasterización PNG, sin ninguna dependencia de Konva. `konvaPngRasterizer` (`png/konvaPngRasterizer.ts`) es la implementación por defecto, inyectada automáticamente.
- `exportProject` acepta un cuarto parámetro opcional `dependencies: { pngRasterizer? }` — permite sustituir el rasterizador PNG en el futuro sin cambiar `ExportOptions`/`ExportResult` ni ningún caller existente.
- 2 tests nuevos verificando la inyección (61 en total), cobertura mantenida ~99.6%.
- Ver ADR-0012, "Aprobación formal y condiciones" — documenta las 8 condiciones bajo las que el usuario aprobó reutilizar Konva vía Stage headless para PNG, el costo aceptado de esa dependencia, y la estrategia de sustitución futura.

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
