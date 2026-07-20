# Changelog — @impulso/print-engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.2.0] — Epic 9 / Fase 9.2: Raster Pipeline & PDF Backend

### Agregado
- `raster/coordinates.ts`: `computeCanonicalPageGeometry` — implementa la matemática exacta de la sección 5 (`canonicalScale = targetPpi/96`, cada lado de trim/bleed convertido directamente a su propia unidad sin encadenar conversiones, raster = `round(canónico × canonicalScale)`). Política `Page.unit === "px"` (sección 24) verificada con el ejemplo exacto del enunciado: página de 960px (=10in) a 300 PPI = 3000px de raster.
- `raster/objectFilters.ts`: `ShouldRenderObject`/`defaultShouldRenderObject` (excluye `metadata.role === "die-line"`)/`combineShouldRenderObject` — predicado más flexible que un solo `excludeMetadataRole`, coherente en groups mixtos.
- `raster/assetImageCache.ts`: `createAssetImageCache` — cache de imágenes decodificadas de una sola exportación (single-flight por `AssetId`), nunca decodifica la misma imagen N veces, revoca todas las object URLs incluso si la decodificación falla a mitad de camino, `dispose()` idempotente. Nunca sustituye silenciosamente un Asset faltante — lanza `asset-resolution-failed`.
- `raster/renderPrintPage.ts`: `renderPrintPage` — UNA página física completa (Stage offscreen del tamaño del BleedBox, contenido desplazado por el sangrado real, `PrintJob.scale` aplicado vía el nuevo `contentScale` de `renderer-konva`, die-lines excluidas) → `HTMLCanvasElement` + dimensiones + geometría canónica.
- `raster/renderPrintJob.ts`: `renderPrintJob` — corre Preflight primero (aborta con `preflight-blocked` si hay bloqueantes), espera `document.fonts.ready` cuando existe y es razonable, expone las páginas como **generador asíncrono** — nunca dos Stages offscreen ni dos canvases de página completos vivos a la vez.
- `raster/exportPrintJobToPng.ts`: `exportPrintJobToPng` — PNG físico multipágina, una imagen por página, naming determinista con numeración estable (`page-01`, `page-02`...; nombre simple si es una sola página), nunca inventa un contenedor multipágina — el caller recibe una colección ordenada.
- `raster/exportPrintJobToPdf.ts`: `exportPrintJobToPdf` — PDF aplanado de alta resolución, un solo archivo, una página PDF por página del `PrintJob`, raster cubriendo exactamente el `MediaBox`, boxes físicos correctos, cancelable en los puntos mínimos incluyendo antes/después de `save()`.
- `pdf/pdfBackend.ts` + `pdf/pdfLibBackend.ts`: `PdfBackend`/`PdfBackendDocument` sin ningún tipo de `pdf-lib` en su firma pública (solo primitivas y boxes en puntos); `pdf-lib` queda completamente aislado — único módulo del paquete que la importa, inyectable para tests de dominio.
- `pdf/pageBoxes.ts`: `computePdfPageBoxes` — TrimBox/BleedBox/MediaBox/CropBox en puntos PDF; `MediaBox = BleedBox` y `CropBox = MediaBox` por decisión explícita de esta fase (sin espacio de marcas todavía).
- `errors.ts`: `PrintEngineError`/`PrintEngineErrorCode` — 11 códigos tipados (`invalid-print-job`, `preflight-blocked`, `memory-budget-exceeded`, `asset-resolution-failed`, `font-unavailable`, `render-failed`, `raster-encoding-failed`, `pdf-backend-failed`, `aborted`, `unsupported-output`, `internal-cleanup-failed`); `throwIfAborted` centraliza los puntos mínimos de cancelación.
- `progress.ts`: `PrintExportStage`/`emitProgress` — progreso por etapas nunca inventadas (`validating → preparing-assets → rendering-page → encoding-page|assembling-pdf → finalizing → completed`); un error del callback del caller nunca corrompe la exportación.
- `memory.ts`: `MemoryRiskLevel` (recommended/warning/blocking) y `cachedImageBytes` agregados de forma aditiva a `estimateMemoryBytes`.
- `@impulso/renderer-konva`: extensión aditiva de `renderPageToStage` — `canvasSizePx`/`contentOffsetPx` (viewport extendido al BleedBox, contenido desplazado sin mover los objects reales), `contentScale` (aplica `PrintJob.scale` anclado en el origen del TrimBox), `shouldRenderObject` (predicado de filtrado, reemplaza la necesidad de un solo `excludeMetadataRole`). Sin cambios de comportamiento cuando no se usan las opciones nuevas.
- `testUtils/goldenFixtures.ts`: 6 fixtures canónicos nombrados (texto+shape, imagen, transparencia, object cruzando el trim, bleed asimétrico, multipágina — sección 22).
- Verificación en Chromium real (temporal, no producto): `apps/sticker-builder/print-engine-harness.html` + `src/printEngineHarness.ts` + `e2e/print-engine.spec.ts` — 12 escenarios (sección 21) sin ningún mock del pipeline real.
- 183 tests propios (96 → 183); cobertura ≥90%/90%/90%/85% mantenida.
- [ADR-0022](../../docs/adr/0022-print-engine-raster-pipeline.md): documenta el pipeline completo, la selección/aislamiento del backend `pdf-lib`, y la verificación en Chromium real.

### Corregido (bugs/gaps reales encontrados durante esta fase)
- `PrintJob.scale` era validado por Preflight (`extreme_scale`) pero nunca se aplicaba a ninguna salida — el raster y el PDF ignoraban por completo el campo. Corregido con el nuevo `contentScale` de `renderer-konva`, anclado en el origen del TrimBox dentro del BleedBox.
- `pdf-lib`: `PDFDocument.save()` agrega una página en blanco por defecto (`addDefaultPage: true`) si el documento tiene 0 páginas al momento de guardar — corregido forzando `{ addDefaultPage: false }` en `PdfLibBackendDocument.save()`; el número de páginas final lo decide únicamente `PrintJob.pageIds`.
- `pdf-lib`: `PDFDocument.load()` sobrescribe `Producer`/`CreationDate` por defecto (`updateMetadata: true`) — no es un bug de este código, pero los tests que verifican metadata inyectada deben pasar `{ updateMetadata: false }` al recargar; documentado para evitar redescubrirlo.

### Hallazgo documentado (no es un bug, es un límite real de la plataforma)
- `document.fonts.check()` devuelve **siempre `true`** en el Chromium real usado para la verificación, incluso para un nombre de fuente completamente inventado — confirmado empíricamente (no asumido). Valida por qué Fase 9.1 prohibió tratar esa API como garantía absoluta; el harness y ADR-0022 documentan el hallazgo con detalle.

### Fuera de alcance (deliberado — fases futuras de la misma épica, cada una con su propia autorización)
Marcas de corte visuales finales, safe area visual, cut paths exportados, kiss-cut/die-cut vectorial, imposición, Production Preview final, flujo completo de UI de exportación, presets persistentes, marketplace, PDF vectorial editable.

## [0.1.0] — Epic 9 / Fase 9.1: Print Model, Coordinates, Units & Preflight Foundation

### Agregado
- Paquete nuevo, nacido directamente reutilizable por cualquier Builder futuro — único paquete nuevo de la Épica 9 (Preflight vive dentro de él, no separado). Depende solo de `@impulso/document-schema` y `@impulso/export-engine` (reutilización aditiva); sin dependencia de `apps/sticker-builder`.
- `units.ts`: `unitToPoints`/`pointsToUnit` (físico ↔ puntos PDF), `physicalToPixels`/`pixelsToPhysical` (físico ↔ píxeles de raster a un PPI real, nunca 96 fijo), `pixelRatioForPpi`, `convertUnit`, conveniencias mm/in/pt directas.
- `boxes.ts`: `computeBoxes` — TrimBox/BleedBox/MediaBox/SafeAreaBox/CropBox sin ambigüedad (CropBox = MediaBox por decisión explícita; ArtBox no usado en V1); `cropMarkStartDistance`.
- `types.ts`: modelo completo de `PrintJob` (efímero, versionado — `PRINT_JOB_SCHEMA_VERSION = 1`), `BleedSpec`/`SafeAreaSpec`/`CropMarksSpec`/`CutPathSpec`/`ImpositionSpec` con soporte por-lado desde el día uno.
- `printJob.ts`: `createPrintJob(profile, overrides)` — fusiona los defaults del perfil con overrides explícitos, siempre produce un `PrintJob` completo.
- `profiles.ts`: 4 perfiles base — `digital-png`, `print-pdf`, `sticker-sheet`, `web-preview`.
- `naming.ts`: `buildPrintFilename` — determinista, reutiliza `sanitizeFilename` de `@impulso/export-engine`.
- `memory.ts`: `estimateMemoryBytes` — nunca usa `width×height×4` crudo como presupuesto total; aplica `MEMORY_OVERHEAD_FACTOR = 2.5` documentado sobre esa base.
- `preflight/`: `runPreflight` — validaciones estructurales (documento no normalizado, dimensiones/bleed/escala inválidos, página inexistente/vacía, assets faltantes, resolución efectiva insuficiente, fuentes no disponibles/inciertas, presupuesto de memoria), orden determinista, resolución/fuente NUNCA bloqueantes. `FontChecker`/`ImageDimensionsProbe` inyectables, con implementaciones reales (`browserFontChecker`/`browserImageDimensionsProbe`) que degradan honestamente (nunca fingen éxito) cuando la API del navegador no está disponible.
- 96 tests propios; cobertura ≥90%/90%/90%/85% (líneas/statements/funciones/branches).
- [ADR-0021](../../docs/adr/0021-print-engine-foundation.md): documenta el modelo de coordenadas verificado (px canónico / unidad física de página / PPI de impresión), el modelo de boxes, y la ausencia de clipping en el Renderer confirmada para Fase 9.2.

### Corregido (bugs reales encontrados durante esta fase, no parte del alcance original)
- `apps/sticker-builder/src/projectPresets.ts`: el die-line del preset "Sticker circular (5×5cm)" guardaba su tamaño en mm crudos en vez de px canónico — cubría solo ~26.5% de la página en la esquina superior-izquierda. Corregido con `toPixels()`.
- `createPrintJob` devolvía por referencia los objetos anidados de `PRINT_PROFILES` (bleed/safeArea/cropMarks/cutPath/imposition/resolution/background) — mutar un campo de un `PrintJob` corrompía permanentemente el preset compartido para todo `PrintJob` construido después a partir del mismo perfil. Corregido con `structuredClone` sobre el resultado completo.
- `@impulso/renderer-konva`: 4 tests nuevos en `offscreenRenderer.test.ts` confirman que ni el Stage, ni el Layer, ni ningún Group aplican `clip`/`clipFunc` — la región rasterizada depende únicamente del `width`/`height` del `Konva.Stage`. Sin cambio de comportamiento, solo verificación (requerida antes de que Fase 9.2 extienda el Stage al MediaBox).

### Fuera de alcance (deliberado — fases futuras de la misma épica, cada una con su propia autorización)
`pdf-lib`/`PdfBackend`, raster de impresión real, marcas de corte y cut paths renderizados, imposición visual, diálogo completo de exportación, descarga de archivos, validez de cut path en Preflight, invasión de safe area en Preflight, fondo insuficiente para el bleed en Preflight.
