# Changelog — @impulso/print-engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
