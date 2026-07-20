# ADR-0022 — Print Engine: Raster Pipeline & PDF Backend (Épica 9 / Fase 9.2)

## Problema
Fase 9.1 (ADR-0021) dejó el modelo de datos (`PrintJob`, boxes físicas, Preflight estructural) sin ningún raster real: sin PDF, sin PNG físico, sin backend de ensamblado. Esta fase construye el pipeline que efectivamente PRODUCE archivos — PNG físico multipágina y PDF aplanado de alta resolución — reutilizando de forma aditiva `@impulso/renderer-konva` (offscreen rendering) y encapsulando `pdf-lib` detrás de una interfaz propia.

## Contexto
- El usuario aprobó la Revisión Previa de esta fase (contrato de rasterización, contrato del backend PDF, estrategias de bleed/páginas múltiples/cancelación/memoria/determinismo) sin objeciones, autorizando implementar directamente.
- Alcance explícitamente EXCLUIDO de esta fase: crop marks visuales, safe area visual, cut paths exportados, kiss-cut/die-cut vectorial, imposición, Production Preview, flujo completo de UI, presets persistentes.
- Principio de compatibilidad exigido: `exportProject`/PNG rápido/SVG/thumbnails/Save as Template/export visual existentes debían seguir funcionando sin cambios de comportamiento — verificado (238 tests de `export-engine`+`renderer-konva`+`sticker-builder` sin ninguna expectativa modificada).

## Alternativas evaluadas

### ¿Cómo aplicar `PrintJob.scale` al contenido?
Durante la implementación se detectó que Preflight (Fase 9.1) ya validaba `printJob.scale` (`extreme_scale`) pero ningún código de esta fase lo aplicaba al raster — un usuario podía recibir la advertencia, ignorarla, exportar, y obtener exactamente el mismo archivo que con `scale=1`. Se evaluaron:
- **A. Escalar `canvasSizePx`** (el tamaño físico de la página): descartada — `scale` describe cuánto del DISEÑO cabe en un trim FIJO, no un cambio del tamaño de la página en sí (eso ya lo controla `PrintJob.dimensions`).
- **B. Escalar el contenido, anclado en el origen del TrimBox, sin tocar el tamaño del canvas** (elegida): un nuevo parámetro aditivo `contentScale` en `renderPageToStage` (`@impulso/renderer-konva`), aplicado al mismo Group que ya desplaza el contenido por el sangrado (`contentOffsetPx`) — Konva traslada primero, escala después, así que `contentScale` queda anclado exactamente en el punto donde empieza el TrimBox dentro del BleedBox. Verificado con test dedicado: un rect en `(10,10)` local con `contentOffsetPx=(8,8)` y `contentScale=2` termina en `(28,28)` absoluto — `8 + 10×2`.

### ¿Cómo excluir un die-line del contenido rasterizado?
Aprobado en la corrección de la Revisión Previa: no un único `excludeMetadataRole` string, sino un predicado (`shouldRenderObject(object, context): boolean`). Implementado como opción aditiva de `renderPageToStage` — recorre recursivamente `group`s, preserva el orden relativo de los hijos que sí pasan el filtro, y nunca agrega un `Konva.Group` vacío cuando todos sus hijos quedan excluidos. La política de contenido (`objectFilters.ts`, `defaultShouldRenderObject`) excluye siempre `metadata.role === "die-line"` del raster de contenido — combinable con un filtro adicional del caller vía AND lógico (`combineShouldRenderObject`).

### ¿Cómo estructurar el contrato de raster para que páginas múltiples nunca convivan en memoria?
- **A. `renderPrintJob` devuelve un array de páginas ya renderizadas**: descartada — mantendría N canvases completos en memoria simultáneamente, exactamente lo que la sección de memoria prohíbe.
- **B. `renderPrintJob` devuelve un generador asíncrono** (elegida): `for await (const page of result.pages)` — el caller decide cuándo consumir/descartar cada raster antes de pedir el siguiente; `renderPrintPage` destruye su propio Stage offscreen en un `finally` antes de que el loop pida la siguiente página (verificado con test: el conteo de `destroy()` tras consumir la primera página es exactamente 1, nunca 0 ni 2).

### ¿Backend PDF: pdf-lib aislado tras qué interfaz?
Aprobado usar `pdf-lib`, encapsulado. Se definió `PdfBackend`/`PdfBackendDocument` (`pdf/pdfBackend.ts`) — únicamente primitivas (`number`, `Uint8Array`, `Date`) y boxes ya expresados en puntos (`PdfBoxPt`); CERO tipos de `pdf-lib` en la firma. `pdf/pdfLibBackend.ts` es el ÚNICO módulo de todo `@impulso/print-engine` (verificado por inspección: es el único archivo de `src/` no-test que contiene `from "pdf-lib"`) que importa la librería real. `createDocument()` es deliberadamente síncrono (a diferencia de `PDFDocument.create()`, que es async en `pdf-lib`) — la promesa de inicialización se crea inmediatamente y cada método (`addRasterPage`/`save`) la espera internamente, para no forzar un `await` extra al caller solo para obtener un documento vacío.

**Sin sistema de plugins**: un único backend real (`pdfLibBackend`), inyectable vía `exportPrintJobToPdf(..., { backend })` — mismo patrón que `PngRasterizer` en Export Engine (ADR-0012, condición 6) — sin ningún registro dinámico.

### Bugs reales de `pdf-lib` descubiertos durante la implementación (no de este código, de la librería)
1. **`PDFDocument.save()` agrega una página en blanco por defecto** (`addDefaultPage: true`) si el documento tiene 0 páginas — silenciosamente. `PdfLibBackendDocument.save()` pasa explícitamente `{ addDefaultPage: false }`: el número de páginas de un PDF de impresión lo decide ÚNICAMENTE `PrintJob.pageIds`, nunca un relleno implícito de la librería.
2. **`PDFDocument.load()` sobrescribe `Producer`/`CreationDate` por defecto** (`updateMetadata: true` implícito) — cualquier verificación de metadata inyectada debe pasar `{ updateMetadata: false }` al recargar (documentado en los tests de `pdfLibBackend.test.ts`, no es un bug de este backend).

## Decisión tomada

### Sistema de coordenadas del raster (sección 5 del enunciado)
Todo parte de px canónico (ADR-0021): `canonicalScale = targetPpi / 96`. Para cada lado del sangrado y el trim, se convierte DIRECTAMENTE desde su propia unidad a px canónico (`toPixels(valor, unidad)`) — nunca se encadena `px → mm → px`, evitando acumular error. `canvasCanonicalWidth = bleedCanonicalLeft + trimCanonicalWidth + bleedCanonicalRight`; el raster final es `round(canvasCanonicalWidth × canonicalScale)`. Verificado con la identidad exacta del enunciado: una página de 960px (= 10 pulgadas físicas) a 300 PPI produce exactamente 3000px de raster; `targetPpi` nunca cambia el tamaño físico base, solo cuántos píxeles se generan (sección 24 — política de `Page.unit === "px"`, con tests dedicados).

### Bleed real (sección 6)
El Stage offscreen se construye con las dimensiones del BleedBox (no solo el TrimBox), y el contenido se desplaza por `contentOffsetPx = (bleedCanonicalLeft, bleedCanonicalTop)` — confirmado en ADR-0021 que ningún nivel (Stage/Layer/Group) del Renderer aplica clipping, así que esto es puramente aditivo. Verificado con un test que coloca un rect deliberadamente fuera del trim y confirma, en Chromium real (no mockeado), que el píxel en la esquina del sangrado muestra el color del rect, no el fondo.

### Páginas múltiples y memoria (secciones 7, 14)
`renderPrintJob` procesa `printJob.pageIds` secuencialmente vía un generador asíncrono — nunca dos Stages offscreen vivos a la vez. El presupuesto de memoria se valida DENTRO de Preflight (`raster_too_large`, ya bloqueante desde Fase 9.1, usando el `MediaBox` de `boxes.ts` que siempre contiene o iguala al `BleedBox` real que esta fase rasteriza) — deliberadamente NO se repite un segundo chequeo de memoria en `renderPrintJob`: sería redundante (Preflight es al menos igual de sensible) y violaría el principio de simplicidad. `memory.ts` se amplía de forma aditiva con `cachedImageBytes` (bytes ya decodificados en el cache de la exportación en curso) y `riskLevel` (`"recommended"|"warning"|"blocking"`), sin cambiar el cálculo que Preflight de Fase 9.1 ya usaba.

### Cache de Assets (sección 12)
`createAssetImageCache` decodifica cada imagen UNA sola vez por exportación (single-flight por `assetId`, incluso ante llamadas concurrentes) y se reutiliza a través de todas las páginas del mismo `PrintJob`. Un asset que desaparece entre Preflight y el render falla de forma controlada (`PrintEngineError("asset-resolution-failed")`, nunca un placeholder silencioso). `dispose()` revoca cada object URL — incluso los creados justo antes de que la decodificación fallara — y es idempotente.

### Fuentes (sección 13)
`waitForFontsReady()` espera `document.fonts.ready` una sola vez por exportación (no por página — es una propiedad global del documento), con degradación honesta (nunca bloquea si la promesa rechaza). **Hallazgo real confirmado en Chromium** (ver "Verificación en Chromium" abajo): `document.fonts.check()` devuelve SIEMPRE `true`, incluso para un nombre de fuente completamente inventado — validando exactamente la razón de la corrección 6 de Fase 9.1 ("nunca tratar esta API como garantía absoluta"). Documentado como límite real de la señal, no un defecto de esta implementación.

### Boxes PDF — decisión explícita de esta fase (sección 10)
`computePdfPageBoxes` (`pdf/pageBoxes.ts`) calcula, en puntos PDF: **MediaBox = BleedBox** (todavía sin espacio reservado para marcas de corte — eso es Fase 9.3); **CropBox = MediaBox** (decisión ya tomada en Fase 9.1, ADR-0021). El origen del PDF es la esquina INFERIOR-izquierda — el `TrimBox` se desplaza `bleedBottomPt` desde abajo (nunca `bleedTopPt`): con un sangrado asimétrico, confundir ambos desplazaría el trim al lado equivocado de la página. Verificado con bleed asimétrico (`top:2mm, bottom:10mm`) confirmando que el espacio remanente arriba del trim es menor al de abajo.

### Transparencia (sección 11)
Verificado empíricamente (no solo documentado): `pdf-lib` SÍ embebe un canal alfa real como `/SMask` del XObject de imagen cuando el PNG fuente tiene transparencia — confirmado leyendo la estructura interna del PDF generado (`page.node.Resources()` → `XObject` → `stream.dict.has(PDFName.of("SMask"))`), tanto en tests unitarios (bytes construidos a mano) como en Chromium real (harness). El perfil `print-pdf` usa fondo sólido blanco por defecto (más seguro para producción); `digital-png`/`web-preview` permiten transparencia real.

### PDF aplanado — contenido y nombre (sección 9)
Una imagen de alta resolución por página, cubriendo exactamente el `MediaBox` (`imageX=imageY=0`, `imageWidthPt=mediaWidthPt`, etc.) — nunca escalado ambiguo. Nombre de producto: **"PDF aplanado de alta resolución"** (ya usado en la descripción del perfil `print-pdf` desde Fase 9.1) — nunca "vectorial", "editable", "con texto seleccionable" ni "CMYK".

### Errores tipados (sección 19)
`PrintEngineError` (`errors.ts`) con 11 códigos: `invalid-print-job`, `preflight-blocked` (con `preflightIssues` adjuntos), `memory-budget-exceeded`, `asset-resolution-failed`, `font-unavailable`, `render-failed`, `raster-encoding-failed`, `pdf-backend-failed`, `aborted`, `unsupported-output`, `internal-cleanup-failed`. `throwIfAborted(signal, etapa)` centraliza el chequeo de cancelación en los 10 puntos mínimos exigidos (antes/después de Preflight, antes/después de resolver assets, antes de cada página, después de cada raster, antes/después de incrustar en PDF, antes/después de `save()`).

### Progreso por etapas (sección 17)
`PrintExportStage`: `validating → preparing-assets → rendering-page → encoding-page|assembling-pdf → finalizing → completed`. `emitProgress` traga cualquier excepción que el callback del caller lance — un error de la UI en su propio callback nunca corrompe una exportación que iba bien.

### Determinismo (sección 18)
`now: () => string` inyectable en `exportPrintJobToPng`/`exportPrintJobToPdf` (mismo patrón que `createPrintJob`) — controla tanto el naming (`buildPrintFilename`) como `CreationDate`/`ModificationDate` del PDF. Se acepta explícitamente que los bytes exactos de un PDF pueden variar (IDs de objeto internos de `pdf-lib`) — el determinismo se mide en dimensiones, boxes, orden de páginas, y contenido visual, nunca en igualdad binaria.

## Verificación en Chromium real
12 escenarios (sección 21 del enunciado) ejecutados en un harness temporal (`apps/sticker-builder/print-engine-harness.html` + `src/printEngineHarness.ts`, visitado por `e2e/print-engine.spec.ts`) que ejercita el pipeline COMPLETO sin ningún mock: Konva real, `Canvas`/`Image`/`createImageBitmap` reales, `pdf-lib` real. Todos pasan, incluyendo lectura real de píxeles (sangrado visible, fondo sólido exacto, transparencia con alpha=0 nunca convertida a negro) e inspección estructural real de un PDF generado (tamaño físico A4 exacto, 2 páginas). El hallazgo sobre `document.fonts.check()` (arriba) se descubrió precisamente en esta verificación, no en los tests unitarios (que mockean el Renderer).

Este harness es temporal — ninguna pantalla de la app navega a él; se retira o se transforma en la UI real de exportación a producción durante la Fase 9.4.

## Consecuencias
- `@impulso/print-engine` sube a 0.2.0: 183 tests (antes 96), cobertura 98.03%/93.77%/98.27%/98.03% (líneas/statements/funciones/branches), todos por encima del estándar 90/90/90/85.
- `@impulso/renderer-konva` gana `canvasSizePx`/`contentOffsetPx`/`contentScale`/`shouldRenderObject` en `renderPageToStage` — 100% aditivo, 27 tests propios de `offscreenRenderer.test.ts` (antes 15), sin cambiar el comportamiento por omisión de ningún caller existente (`@impulso/export-engine` sigue exactamente igual).
- `apps/sticker-builder` gana `@impulso/print-engine`/`pdf-lib` como devDependencies (solo para el harness E2E de esta fase — ningún flujo de producto los usa todavía) y un segundo entry point de Vite (`print-engine-harness.html`).
- Ningún consumidor existente (`exportProject`, PNG rápido, SVG, thumbnails, Save as Template) cambia de comportamiento — verificado corriendo su suite completa sin modificar ninguna expectativa.

## Riesgos
- **`pdf-lib` es ahora una dependencia real** (no solo anticipada, como en Fase 9.1) — su riesgo de mantenimiento ya está registrado en Technical Debt desde esa fase; se confirma con evidencia real (dos comportamientos por-defecto sorprendentes encontrados y documentados arriba).
- **`document.fonts.check()` puede ser una señal mucho más débil de lo esperado** — en el Chromium usado para esta verificación, devuelve `true` incluso para nombres de fuente inventados. El 3-estado (`available`/`unavailable`/`verification-uncertain`) de Fase 9.1 sigue siendo la respuesta correcta (nunca bloquear por esto), pero el caso real `"available"` puede ser menos confiable de lo que su nombre sugiere — el preview visual sigue siendo, más que nunca, la verificación práctica real.
- **El presupuesto de memoria sigue sin una medición empírica de ESTE proyecto** — 256MB/factor 2.5x, ajustable en Fase 9.5 con evidencia real.
- **La reutilización de una pieza rasterizada N veces en una imposición no está implementada** — el modelo (`simultaneousPages`) y el diseño de `renderPrintJob`/`renderPrintPage` (una página, un raster, un `dispose`) ya lo anticipan sin acoplarse a una página PDF completa, pero la composición real es Fase 9.4.
- **El harness de Chromium es código temporal** — vive en `apps/sticker-builder` sin ninguna ruta de producto que lo alcance; debe retirarse o transformarse explícitamente al construir la UI real en Fase 9.4, o quedará como deuda huérfana.

## Compatibilidad futura
- **Fase 9.3** (Marcas, Safe Area, Cut Paths) agrega los overlays vectoriales reales usando la misma infraestructura de `shouldRenderObject`/`combineShouldRenderObject` (para excluir cut paths del contenido rasterizado, igual que ya se hace con die-lines) y expande `MediaBox` para incluir el espacio de las marcas — el único cambio necesario en `computePdfPageBoxes` es dejar de igualar `mediaBox` a `bleedBox`.
- **Fase 9.4** (Imposición) reutiliza `simultaneousPages` de `memory.ts` y el diseño de `renderPrintPage` (una pieza, reutilizable) para componer una hoja sin re-renderizar el mismo diseño N veces — y reemplaza el harness temporal de esta fase por la UI real de exportación a producción.
- **Fase 9.5** (Hardening & Golden Tests) construye sobre `testUtils/goldenFixtures.ts` (los 6 escenarios canónicos ya nombrados y ejercitados en esta fase) para la infraestructura completa de golden files.
