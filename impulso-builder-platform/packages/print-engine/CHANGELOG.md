# Changelog — @impulso/print-engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.3.0] — Epic 9 / Fase 9.3: Marks, Safe Area & Cut Paths

### Agregado
- `marks/cropMarksGeometry.ts`: `computeCropMarksGeometry` — geometría pura de 8 segmentos (2 por esquina) en espacio físico de `MediaBox`, siempre fuera del `BleedBox`, nunca invade el `TrimBox`, considera bleed asimétrico.
- `boxes.ts`/`pdf/pageBoxes.ts`: `computeBoxes`/`computePdfPageBoxes` expandidos para calcular el espacio real de marcas (`bleedOffsetWithinMedia`, `safeAreaOffsetWithinTrim`, `bleedPerSide`) — `MediaBox` deja de igualar `BleedBox` cuando hay marcas activas.
- `safearea/safeAreaRect.ts` + `safearea/safeAreaCheck.ts`: `computeSafeAreaCanonicalRect` (rect en px canónico, `undefined` si deshabilitado) + `checkSafeAreaInvasions` (política conservadora: todo object visible participa salvo die-lines/ocultos; `locked` no excluye; un `group` cuenta como una unidad; un object fuera del TrimBox nunca genera el issue).
- `cutpath/affine.ts`: módulo afín 2D puro (`applyAffine`/`composeAffine`/`composeAncestorChain`/`pivotOf`/`affineFromTransform`) + detección de similitud vs. shear (`isSimilarityTransform`/`decomposeSimilarity`), verificada contra las convenciones de pivote ya existentes en `renderer-konva`.
- `cutpath/objectTraversal.ts` + `cutpath/dieLineDetection.ts`: `traverseObjects`/`findObjectById` + `resolveDieLineSource` — busca objects con `metadata.role === "die-line"` a cualquier profundidad; nunca elige el primer candidato en silencio ante cero o múltiples resultados.
- `cutpath/cutGeometry.ts`: `normalizeCutGeometry` — `RectangleCutGeometry`/`EllipseCutGeometry`/`ClosedPathCutGeometry` uniforme en espacio global; Rectangle bajo shear real degrada exacto a 4 esquinas (`ClosedPath`); Ellipse bajo shear real bloquea (`transform-unsupported`) en vez de aproximar; Path abierto bloquea (`open-path`); tipo no soportado bloquea (`unsupported-object-type`).
- `cutpath/cutGeometryOffset.ts`: `applyCutGeometryOffset` — exacto para Rectangle/Ellipse (con validación de colapso); `"unsupported"` honesto (nunca simulado desplazando el stroke) para un Path cerrado arbitrario con offset != 0.
- `cutpath/cutGeometryToSegments.ts`: `cutGeometryToPathSegments` — uniforma cualquier `CutGeometry` a `PathSegment[]` (bezier kappa estándar 0.5522847498307936 para Ellipse), el único punto de conversión que necesita el backend PDF.
- `pdf/color.ts`: `parseHexColor` — el cut path/marcas exigen RGB hex real para el vector PDF (más estricto que el `Style.color` genérico del Document Schema).
- `pdf/canonicalToPdfPoints.ts` + `raster/canonicalToRasterPoints.ts`: conversiones canónico/físico → puntos PDF / píxeles de raster, reutilizadas por ambos exportadores para que PDF y PNG representen la MISMA geometría.
- `raster/composeCanvasOverlays.ts`: `createMediaCanvasWithContent` (canvas de `MediaBox` con el contenido compuesto en su offset, sin escalarlo) + `drawLineSegmentOnCanvas`/`drawPathSegmentsOnCanvas` (Canvas2D real) — un cut path SIEMPRE se cierra incondicionalmente (invariante del propio `CutGeometry`).
- `pdf/pdfBackend.ts`/`pdf/pdfLibBackend.ts`: `AddRasterPageOptions` extendido con `cropMarks?`/`cutPath?` opcionales (dentro de la MISMA llamada, nunca nuevas primitivas de dibujo independientes) — dibujados vía `drawSvgPath` real, después del raster de imagen.
- `raster/exportPrintJobToPdf.ts`/`raster/exportPrintJobToPng.ts`: componen marcas/cut path reales cuando el perfil los activa; `needsOverlayComposition` evita crear un segundo canvas cuando no hace falta (sección 25, performance).
- `preflight/`: 15 códigos nuevos (`crop_marks_invalid`, `crop_marks_outside_media_box`, `crop_marks_overlap_trim`, `insufficient_mark_space`, `safe_area_invalid`, `object_crosses_safe_area`, `cut_path_missing`, `cut_path_multiple_candidates`, `cut_path_unsupported_object`, `cut_path_open`, `cut_path_invalid_geometry`, `cut_path_offset_unsupported`, `cut_path_collapsed`, `cut_path_outside_media_box`, `cut_path_transform_unsupported`), orden determinista (job-level primero, luego por página).
- `types.ts`: `CropMarksSpec` gana `color`; `CutPathSpec` restructurado (`CutPathSource` discriminado, `stroke`, `color`, `logicalLayerName`); `PrintJob.offsetUnsupportedPolicy` (`"block"|"warn"|"use-original"`).
- Preview técnico mínimo (temporal, no producto): `apps/sticker-builder/print-preview-harness.html` + `src/printPreviewHarness.ts` — reutiliza las mismas funciones puras públicas que los exportadores, toggles accesibles por capa, resumen textual, zoom puramente visual, inmutabilidad verificada.
- Verificación en Chromium real: 15 escenarios nuevos sumados a los 12 de Fase 9.2 (27 en total, `e2e/print-engine.spec.ts`) + 4 tests del preview técnico (`e2e/print-preview.spec.ts`).
- 333 tests propios (183 → 333); cobertura ≥90%/90%/90%/85% mantenida.
- [ADR-0023](../../docs/adr/0023-print-engine-marks-safearea-cutpaths.md): documenta el modelo completo de marcas/safe area/cut paths y sus límites honestos.

### Corregido (bugs reales encontrados durante esta fase)
- `pdf-lib`: `page.drawSvgPath` aplica SIEMPRE una matriz `cm` interna de `scale(1,-1)` — un número crudo del content stream NO es la posición final renderizada (descubierto decodificando bytes reales de un PDF generado). Corregido con un helper `negateY` en producción; los tests usan composición real de matrices PDF (`testUtils/pdfContentInspection.ts`) en vez de comparar contra números crudos.
- `drawPathSegmentsOnCanvas` (compositor PNG) solo cerraba el path cuando encontraba un segmento `{ type: "close" }` explícito, pero un `ClosedPathCutGeometry` derivado de un `PathObject` sin ese segmento literal quedaba ABIERTO en el PNG mientras el backend PDF (que fuerza el cierre siempre) lo dibujaba correctamente CERRADO — la misma geometría debía verse igual en ambos formatos. Corregido cerrando el path incondicionalmente (un cut path siempre es una figura cerrada).
- Dos escenarios de verificación en Chromium (no de producción) tenían asunciones/cálculos incorrectos: el escenario de sangrado de Fase 9.2 asumía que el pixel `(0,0)` del PNG era la esquina del `BleedBox`, asunción rota por el nuevo default de marcas activas en "print-pdf"; un escenario nuevo de cut path en PNG tenía un cálculo de píxel incompleto (faltaba sumar el offset canónico del sangrado antes de escalar). Ambos corregidos.
- Tres tests que antes asertaban el `render-failed` DEFENSIVO de los exportadores (die-line ausente/múltiple) pasaron a asertar `preflight-blocked` una vez wireados los nuevos chequeos — confirmando que esos chequeos defensivos quedaron correctamente inalcanzables en el flujo normal (mismo patrón de ADR-0022).

### Hallazgo documentado (no es un bug de esta fase)
- `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando — confirmado sin relación con marcas/safe area/cut paths (corrido antes y después de todo el trabajo de esta fase); no investigado ni corregido aquí, ver Technical Debt.

### Fuera de alcance (deliberado — fases futuras de la misma épica, cada una con su propia autorización)
Optional Content Group real para el cut path, offset geométrico de un Path cerrado arbitrario, aproximación de Ellipse bajo shear, imposición, repetición en hojas, grid de producción, Production Preview definitivo, flujo completo de UI de exportación, nesting, integración con RIP, Spot Colors certificados, perfiles ICC, CMYK.

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
