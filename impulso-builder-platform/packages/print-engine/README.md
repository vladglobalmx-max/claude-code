# @impulso/print-engine

> Print Engine de plataforma, nacido en la Épica 9 (Professional Print Engine). Produce salidas confiables para impresión digital, corte y producción comercial — modelo de `PrintJob`, unidades físicas, boxes de PDF (Trim/Bleed/Media/Safe Area), Preflight (44 códigos, tabla formal en `docs/platform/PREFLIGHT_CODES.md`), el pipeline real de raster (PNG físico multipágina y PDF aplanado de alta resolución), marcas de corte vectoriales/safe area verificable/cut paths reales (Fase 9.3), imposición/repetición en hojas con reutilización real de raster (Fase 9.4), y ahora (Fase 9.5) endurecido con golden tests, verificación de performance/memoria/resource-leaks en Chromium real, y cancelación cooperativa exhaustiva. Reutilizable por cualquier Builder futuro. Ver [ADR-0021](../../docs/adr/0021-print-engine-foundation.md) (Fase 9.1), [ADR-0022](../../docs/adr/0022-print-engine-raster-pipeline.md) (Fase 9.2), [ADR-0023](../../docs/adr/0023-print-engine-marks-safearea-cutpaths.md) (Fase 9.3), [ADR-0024](../../docs/adr/0024-print-engine-imposition.md) (Fase 9.4) y [ADR-0025](../../docs/adr/0025-production-export-workflow.md) (Fase 9.4/9.5, con 2 enmiendas de Fase 9.5).

**Estado:** Epic 9 completa (Fases 9.1-9.5), con su UI real de producto en `apps/sticker-builder`. Deliberadamente **sin** nesting irregular, sin optimización automática de desperdicio, sin tiling de gran formato, sin integración con RIP/plotter — fuera de alcance de esta épica, sin autorización todavía para una épica futura.

---

## 1. Qué es y qué no es

- **Sí hace:** modela un `PrintJob` completo y versionado (`createPrintJob`); calcula boxes físicas (`computeBoxes`, `computePdfPageBoxes`); convierte entre unidades físicas, puntos PDF y píxeles de raster a un PPI real (`units.ts`); corre Preflight estructural + de marcas/safe area/cut path + de imposición (`runPreflight`); **rasteriza páginas físicas reales** con sangrado (`renderPrintPage`/`renderPrintJob`, reutilizando `@impulso/renderer-konva` de forma aditiva); **exporta PNG físico multipágina** (`exportPrintJobToPng`) y **PDF aplanado de alta resolución** (`exportPrintJobToPdf`, con `pdf-lib` completamente encapsulado detrás de `PdfBackend`); soporta cancelación (`AbortSignal`) y progreso por etapas en todos los formatos; **dibuja marcas de corte vectoriales reales** (PDF y PNG) expandiendo el `MediaBox` para su espacio; **calcula Safe Area** como ayuda de validación/preview (verificado byte-idéntico al archivo final, nunca parte de él); **detecta y dibuja un cut path real** (Rectangle/Ellipse/Path cerrado, con offset exacto o bloqueo honesto según el tipo) para kiss-cut/die-cut V1 (semántico, sin OCG ni parámetros de hardware reales); **arma una imposición real** — `computeImpositionLayout` (geometría pura de grid, capacidad automática o fija, gaps/márgenes/alineación) + `exportImpositionToPdf`/`exportImpositionToPng` (una pieza rasterizada/embebida UNA sola vez, dibujada N veces por hoja, marcas `per-piece`/`per-sheet`, cut path normalizado una vez y trasladado por copia).
- **No hace todavía:** no soporta nesting irregular ni optimización automática de desperdicio (el grid es siempre rectangular uniforme); no soporta tiling de gran formato (rollos); no genera un Optional Content Group real para el cut path (documentado como deuda, ver sección 7); no soporta CMYK, perfiles ICC, ni Spot Colors certificados (el color del cut path es RGB visual, nunca certificado); no integra con un RIP/plotter real.

## 2. Árbol

```
packages/print-engine/
├── package.json / tsconfig.json / vitest.config.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                     # API pública
    ├── units.ts / boxes.ts / types.ts / printJob.ts / profiles.ts / naming.ts / memory.ts
    ├── errors.ts                    # PrintEngineError — 11 códigos tipados
    ├── progress.ts                  # PrintExportStage, emitProgress (nunca deja que el callback del caller corrompa la exportación)
    ├── marks/
    │   └── cropMarksGeometry.ts     # computeCropMarksGeometry — geometría pura de marcas (8 segmentos, MediaBox-space)
    ├── safearea/
    │   ├── safeAreaRect.ts          # computeSafeAreaCanonicalRect — rect canónico, undefined si deshabilitado
    │   └── safeAreaCheck.ts         # checkSafeAreaInvasions — objects que cruzan el borde (política conservadora)
    ├── cutpath/
    │   ├── affine.ts                # afín 2D puro + composición de ancestros + detección de similitud/shear
    │   ├── objectTraversal.ts       # traverseObjects/findObjectById — recorrido recursivo con cadena de ancestros
    │   ├── dieLineDetection.ts      # resolveDieLineSource — nunca elige el primer candidato en silencio
    │   ├── cutGeometry.ts           # normalizeCutGeometry — Rectangle|Ellipse|ClosedPath uniforme, en espacio global
    │   ├── cutGeometryOffset.ts     # applyCutGeometryOffset — exacto (Rect/Ellipse) u honesto ("unsupported")
    │   └── cutGeometryToSegments.ts # cutGeometryToPathSegments — PathSegment[] uniforme (bezier kappa para Ellipse)
    ├── imposition/                  # (Fase 9.4) geometría pura de imposición — sin Canvas/PDF/Konva/UI
    │   ├── pieceFootprint.ts        # footprint físico de una pieza (= su BleedBox), convertido a la unidad de la hoja
    │   ├── sheetGeometry.ts         # área útil de la hoja tras aplicar márgenes
    │   ├── gridCapacity.ts          # computeGridCapacity — columnas/filas automáticas o fijas
    │   ├── alignment.ts             # computeAlignmentOffset — desplaza el bloque del grid, nunca altera gap/escala
    │   ├── validateLayoutGeometry.ts # invariantes geométricas de un ImpositionLayout ya calculado
    │   └── impositionLayout.ts      # computeImpositionLayout — función central, orden determinista obligatorio
    ├── preflight/                   # runPreflight, fonts.ts, imageProbe.ts (Fase 9.1) + cropMarksChecks/safeAreaChecks/cutPathChecks (Fase 9.3) + impositionChecks (Fase 9.4)
    ├── raster/
    │   ├── coordinates.ts           # computeCanonicalPageGeometry — px canónico -> raster físico
    │   ├── objectFilters.ts         # defaultShouldRenderObject (excluye die-line), combineShouldRenderObject
    │   ├── collectImageAssetIds.ts  # recorrido recursivo de Image dentro de group
    │   ├── assetImageCache.ts       # cache de imágenes decodificadas de UNA exportación (single-flight)
    │   ├── pieceRasterCache.ts      # (Fase 9.4) cache de UNA pieza rasterizada por página de origen — reutilizada N veces
    │   ├── renderPrintPage.ts       # UNA página -> HTMLCanvasElement físico
    │   ├── renderPrintJob.ts        # orquesta TODAS las páginas — generador async, nunca N en memoria a la vez
    │   ├── canonicalToRasterPoints.ts  # conversiones canónico/físico -> raster px (marcas y cut path)
    │   ├── composeCanvasOverlays.ts     # createBlankCanvas + createMediaCanvasWithContent + dibujo de marcas/cut path en Canvas2D
    │   ├── exportPrintJobToPng.ts   # PNG físico multipágina, con overlays compuestos cuando aplica
    │   ├── exportPrintJobToPdf.ts   # PDF aplanado de alta resolución, con marcas/cut path vectoriales
    │   ├── exportImpositionToPdf.ts # (Fase 9.4) PDF imposicionado — una pieza embebida una vez, dibujada N veces
    │   └── exportImpositionToPng.ts # (Fase 9.4) PNG imposicionado — una hoja por archivo, numerada sheet-01/sheet-02...
    ├── pdf/
    │   ├── pdfBackend.ts            # PdfBackend/PdfBackendDocument — CERO tipos de pdf-lib (+ addImposedSheetPage, Fase 9.4)
    │   ├── pdfLibBackend.ts         # ÚNICO módulo del paquete que importa pdf-lib
    │   ├── pageBoxes.ts             # computePdfPageBoxes — Trim/Bleed/Media/Crop en puntos, con espacio de marcas
    │   ├── color.ts                 # parseHexColor — el cut path/marcas exigen RGB hex, nunca Spot Color
    │   └── canonicalToPdfPoints.ts  # conversiones canónico/físico -> puntos PDF (marcas y cut path)
    └── testUtils/
        ├── fixtures.ts              # builders de dominio (Fase 9.1) + Rectangle/Ellipse/Path (Fase 9.3) + PrintJob de imposición (Fase 9.4)
        ├── goldenFixtures.ts        # 6 escenarios canónicos (sección 22, Fase 9.2)
        ├── fakeCanvasContext2D.ts   # stub de CanvasRenderingContext2D para jsdom (gap de entorno, no de producción)
        └── pdfContentInspection.ts  # inspección mínima del content stream real de un PDF (sección 30, Fase 9.3)

    (tests exhaustivos por módulo, incluyendo imposición/preflight/performance de Fase 9.4; cobertura ≥90%/90%/90%/85% líneas/statements/funciones/branches mantenida)
```

## 3. El modelo de coordenadas (ver ADR-0021 para el detalle completo)

Tres espacios numéricos coexisten en Impulso y **nunca deben confundirse**: px canónico (`SceneObject.transform`/`size`), unidad física de página (`Page.size`/`Page.unit`), y resolución de impresión (`PrintJob.resolution.targetPpi`). Identidad base: `physicalToPixels(v, unit, targetPpi) === toPixels(v, unit) × (targetPpi / 96)`.

**Política `Page.unit === "px"` (Fase 9.2, sección 24)**: los px canónicos equivalen a 96px/pulgada — una página de 960px son 10 pulgadas físicas; `targetPpi` decide cuántos píxeles de RASTER se generan (960px → 3000px a 300 PPI), nunca cambia el tamaño físico base. `PrintJob.scale` sí lo cambia deliberadamente: escala el CONTENIDO respecto al trim (nunca el tamaño de la página), anclado en el origen del TrimBox dentro del BleedBox.

## 4. El pipeline de raster (Fase 9.2 — ver ADR-0022 para el detalle completo)

### 4.1 `renderPrintPage`/`renderPrintJob`
`renderPrintPage` construye un Stage offscreen del tamaño del **BleedBox** (no solo el TrimBox — ver ADR-0021, ausencia de clipping confirmada), con el contenido desplazado por el sangrado y escalado por `PrintJob.scale`, excluye die-lines (`combineShouldRenderObject`), y pide un único `pixelRatio = canonicalScale` a Konva. `renderPrintJob` corre Preflight primero (aborta si hay errores bloqueantes) y expone las páginas como un **generador asíncrono** — nunca dos Stages offscreen vivos a la vez; el cache de imágenes de la exportación se libera automáticamente al terminar de iterar (incluso ante un `break` o una excepción).

### 4.2 `exportPrintJobToPng` — PNG físico multipágina
Una imagen por página, con naming determinista y numeración estable (`page-01`, `page-02`...) — nunca inventa un contenedor multipágina, el caller recibe una colección.

### 4.3 `exportPrintJobToPdf` — PDF aplanado de alta resolución
UN solo archivo, una página PDF por página del `PrintJob`, cada una con el raster de contenido cubriendo exactamente el `BleedBox` (posicionado dentro de un `MediaBox` que puede ser MÁS GRANDE cuando hay marcas de corte — nunca escalado, solo desplazado) y los 4 boxes físicos correctos (`Trim`/`Bleed`/`Media`/`Crop`). Las marcas de corte y el cut path se dibujan DESPUÉS del raster, como vectores reales. El backend `pdf-lib` queda completamente aislado detrás de `PdfBackend` — nunca importado directamente por este módulo ni por ningún caller.

### 4.4 Backend PDF encapsulado
`pdf/pdfBackend.ts` define `PdfBackend`/`PdfBackendDocument` sin ningún tipo de `pdf-lib` en su firma (solo primitivas y boxes en puntos) — extendido en Fase 9.3 con dos campos OPCIONALES dentro de la misma llamada a `addRasterPage` (`cropMarks?`/`cutPath?`), nunca con nuevas primitivas de dibujo independientes (habría convertido el backend en una API gráfica general). `pdf/pdfLibBackend.ts` es el ÚNICO módulo de todo el paquete que importa `pdf-lib` — inyectable vía `exportPrintJobToPdf(..., { backend })` para tests de dominio que nunca necesitan conocerla (mismo patrón que `PngRasterizer` de `@impulso/export-engine`, ADR-0012).

**Comportamientos por-defecto de `pdf-lib` corregidos explícitamente** (no bugs de este código): `save()` agrega una página en blanco si el documento tiene 0 páginas (`addDefaultPage: false` forzado); `load()` sobrescribe `Producer`/`CreationDate` por defecto (`updateMetadata: false` al recargar en tests); `page.drawSvgPath` aplica SIEMPRE una matriz `cm` interna de `scale(1,-1)` — un número crudo del content stream NO es la posición final renderizada (corregido con un helper `negateY` que cancela el flip al construir el path).

### 4.5 Cancelación, progreso y errores tipados
`AbortSignal` chequeado antes/después de CADA operación asíncrona del pipeline (Preflight, resolver assets, cada página, componer overlays, incrustar en PDF, `save()`) — auditado explícitamente en Fase 9.3 para las nuevas etapas de overlay, y en Fase 9.5 se cerró el único gap real que quedaba: `runPreflight` mismo ahora acepta `signal` y chequea por página/por object (antes no tenía ningún punto de cancelación propio — un documento grande no podía cancelarse mientras Preflight corría). Progreso por etapas (`validating → preparing-assets → rendering-page → encoding-page|assembling-pdf → finalizing → completed`) vía `onProgress`, con errores del propio callback nunca corrompiendo la exportación. `PrintEngineError` con 7 códigos tipados (`errors.ts`) — nunca un string libre que la UI futura tenga que inspeccionar; 4 códigos sin ningún punto real que los lanzara (`invalid-print-job`/`font-unavailable`/`unsupported-output`/`internal-cleanup-failed`) se eliminaron en Fase 9.5 tras confirmarlo con búsqueda exhaustiva.

### 4.6 Marcas de corte, Safe Area y Cut Paths (Fase 9.3 — ver ADR-0023 para el detalle completo)

**Marcas de corte**: `computeCropMarksGeometry` (puro) produce 8 segmentos (2 por esquina) en el espacio físico de `MediaBox` — siempre fuera del `BleedBox`, nunca invaden el `TrimBox`. `computePdfPageBoxes` expande el `MediaBox` para darles espacio (`cropMarkStartDistance` = `max(bleedPerSide, offset) + length` por lado); el raster de contenido sigue siendo del tamaño del `BleedBox`, solo se reposiciona.

**Safe Area**: `computeSafeAreaCanonicalRect` (rect en px canónico, `undefined` si deshabilitado) + `checkSafeAreaInvasions` (qué objects lo cruzan) — es una ayuda de validación/preview, **NUNCA** parte del archivo final. Verificado empíricamente: el mismo `PrintJob` con `safeArea.enabled: true`/`false` produce un PNG byte-idéntico. Política conservadora: todo object visible participa salvo die-lines (nunca contenido) y ocultos; `locked` NO excluye; un `group` cuenta como una sola unidad (unión de bounding boxes); un object fuera del `TrimBox` nunca genera este issue. Puede generar falsos positivos sobre fondos decorativos grandes — documentado, no resuelto.

**Cut Paths**: `resolveDieLineSource` busca objects con `metadata.role === "die-line"` (o selección manual por `objectId`) — nunca elige el primero en silencio ante cero o múltiples candidatos. `normalizeCutGeometry` compone la cadena de transforms (`cutpath/affine.ts`) a un `CutGeometry` uniforme (`Rectangle`/`Ellipse`/`ClosedPath`) en espacio global: un Rectangle bajo shear real se degrada EXACTO a 4 esquinas (`ClosedPath`); un Ellipse bajo shear real se bloquea (`transform-unsupported`) en vez de aproximar. `applyCutGeometryOffset` es exacto para Rectangle/Ellipse y honestamente `"unsupported"` (nunca simulado) para un Path cerrado arbitrario — la severidad de eso la decide `PrintJob.offsetUnsupportedPolicy` (`"block"|"warn"|"use-original"`), no la función pura. Kiss-cut/die-cut V1 se distinguen solo por `logicalLayerName`/color/metadata — nunca prometen configuración real de una máquina de corte; el color es siempre RGB visual, nunca un Spot Color certificado; no se genera un Optional Content Group real (documentado como deuda).

### 4.7 Imposición y repetición en hojas (Fase 9.4 — ver ADR-0024 para el detalle completo)

`ImpositionSpec` es un discriminated union explícito (`{ mode: "single" } | GridImpositionSpec`) — `"single"` es exactamente el comportamiento de Fases 9.1-9.3 sin ningún cambio. `computeImpositionLayout` (puro, `imposition/impositionLayout.ts`) calcula un `ImpositionLayout` completo: cuántas columnas/filas caben (`placementMode: "automatic"`, calculado; `"fixed-grid"`, bloquea con un error explícito si no cabe — nunca reduce en silencio), cuántas hojas hacen falta para `quantity` copias, y la posición exacta de cada copia en cada hoja, en un orden determinista (hojas en orden, filas arriba→abajo, columnas izquierda→derecha, `copyIndex` global estable). La última hoja puede quedar parcialmente ocupada — expuesto explícitamente (`lastSheetPieceCount`/`lastSheetEmptyCells`), nunca se generan copias de más para llenarla.

`exportImpositionToPdf`/`exportImpositionToPng` rasterizan/embeben la pieza de origen **UNA sola vez por página** (`raster/pieceRasterCache.ts`) y la dibujan/componen N veces por hoja — verificado a escala real (500 piezas/10 hojas, no solo con 2-3 piezas de juguete). Marcas de corte soportan `marksMode: "per-piece"` (por copia) o `"per-sheet"` (un único contorno de producción alrededor del área útil de la hoja — nunca una guía de corte individual); el cut path se normaliza/offsetea UNA sola vez por página de origen y solo se TRASLADA a la posición de cada copia, nunca se recalcula. Límites de producto explícitos (`MAX_IMPOSITION_SHEETS = 200`, `MAX_IMPOSITION_PIECES = 2000`) — exceder cualquiera es un resultado explícito de `ImpositionLayoutResult`, nunca un cuelgue silencioso.

Preflight de imposición (`preflight/impositionChecks.ts`, 16 códigos nuevos) valida la configuración a nivel de job (gaps/márgenes finitos y no negativos, gap más angosto que el stroke del cut path) y, por página, traduce cualquier motivo de `computeImpositionLayout` a un código Preflight, más geometría inválida (piezas fuera de la hoja, marcas/cut paths superpuestos), presupuesto de memoria excedido, y "salida parcial requerida" (informativo, cuando la última hoja queda incompleta).

### 4.8 Hardening (Fase 9.5 — ver `docs/platform/TRACEABILITY_MATRIX_EPIC9.md` para el detalle completo)

Fase de cierre de la épica, sin funciones nuevas fuera de endurecimiento. Piezas nuevas relevantes para consumidores de este paquete:

- **Golden outputs**: `testUtils/pdfStructuralSnapshot.ts` (`describePdfStructure`) produce un snapshot ESTRUCTURAL pequeño de un PDF ya generado (páginas, boxes, cantidad de operadores de imagen/vectores, alpha) — nunca compara bytes crudos. `raster/goldenOutputs.test.ts` lo ejercita contra los 10 fixtures canónicos de `testUtils/goldenFixtures.ts` a través del pipeline real.
- **Precisión física y determinismo**: `precisionAndDeterminism.test.ts` confirma programáticamente (no solo argumenta) la precisión de unidades en casos físicos mínimos (A4/Letter/bleed en pulgadas y mm/PPI variable/pixelRatio fraccional) y el determinismo ESTRUCTURAL de 20 exportaciones repetidas del mismo fixture (nunca reclama igualdad byte-a-byte de `pdf-lib`, documentado como no reclamado).
- **Preflight — tabla formal de 44 códigos**: `docs/platform/PREFLIGHT_CODES.md` — severidad, bloqueo, disparador, recomendación mostrada, test; confirma 44/44 con al menos un test que los dispara (3 códigos defensivos de crop marks estaban sin cobertura y se corrigieron esta fase).
- **Error injection real**: un `resolver.resolve()` que RECHAZA (no solo devuelve `undefined`) dentro de `runPreflight` ahora se reporta como el mismo `asset_binary_missing` estructurado, en vez de propagar un rechazo crudo (bug real encontrado y corregido). El `try/finally` de limpieza de caches en los exportadores de imposición se verificó bajo una falla REAL inyectada a mitad de un loop (backend que falla en la hoja 2 de 2), no solo se argumentó.
- **Performance/memoria/resource-leaks verificados en Chromium real** (no solo con Konva mockeado en `vitest`): un ciclo completo del wizard con 200 copias imposicionadas en 526ms; heap observado (`performance.memory`) sin crecimiento desbocado tras 5 ciclos; object URLs/canvases balanceados tras ciclos repetidos de éxito y de cancelación — datos en `docs/PERFORMANCE_BUDGET.md` (filas 27-30), explícitamente distinguidos de estimaciones teóricas.

## 5. Verificación en Chromium real (ver ADR-0022/ADR-0023/ADR-0025)

`apps/sticker-builder/print-engine-harness.html` + `src/printEngineHarness.ts` ejercitan el pipeline COMPLETO en un navegador real, sin ningún mock (Konva real, Canvas/Image reales, `pdf-lib` real) — **27 escenarios** (`e2e/print-engine.spec.ts`): los 12 de Fase 9.2 (raster/PDF/PNG base) más 15 de Fase 9.3 (marcas nunca invaden el trim, safe area byte-idéntica al archivo final, die-line Ellipse/Path, die-line ausente del raster, cut path como vector real en el content stream, path abierto/múltiples die-lines bloquean, offset preserva dimensiones exactas, multipágina con overlays independientes, inmutabilidad/cancelación con overlays activos). Un segundo harness (`print-preview-harness.html` + `src/printPreviewHarness.ts`, `e2e/print-preview.spec.ts`, 4 tests) verifica el preview técnico mínimo de Fase 9.3: geometría idéntica a la de exportación, toggles accesibles, resumen textual, zoom puramente visual. El flujo real de exportación a producción de Fase 9.4 (imposición incluida) se verifica en `apps/sticker-builder/e2e/production-export.spec.ts` (19 escenarios) — ver ADR-0025 y el README de `apps/sticker-builder`.

Hallazgo confirmado en Fase 9.2 y aún vigente: `document.fonts.check()` devuelve **siempre `true`** en el Chromium usado, incluso para un nombre de fuente inventado — validando por qué Fase 9.1 prohibió tratar esa API como garantía absoluta. Los dos harnesses de este paquete siguen sin ser producto — ninguna pantalla de la app navega a ellos; la UI real de exportación de Fase 9.4 vive en `apps/sticker-builder`, no en estos harnesses.

**Fallo preexistente, no de esta fase**: `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando (confirmado antes y después del trabajo de Fase 9.4) — sin relación con imposición ni con el resto del Print Engine, no investigado ni corregido aquí (ver Technical Debt).

## 6. Desarrollo

```bash
pnpm --filter @impulso/print-engine build
pnpm --filter @impulso/print-engine test
pnpm --filter @impulso/print-engine typecheck

# Verificación en Chromium real (desde apps/sticker-builder) — reconstruye
# dist/ primero, así que siempre corre contra el código actual:
pnpm --filter @impulso/sticker-builder test:e2e
```

## 7. Riesgos y limitaciones conocidas

- **`pdf-lib` es ahora una dependencia real** (Fase 9.2) — su riesgo de mantenimiento ya estaba registrado en Technical Debt desde Fase 9.1; confirmado con evidencia real (comportamientos por-defecto sorprendentes documentados arriba, incluido el flip de `drawSvgPath` descubierto en Fase 9.3).
- **`document.fonts.check()` puede ser una señal mucho más débil de lo esperado** — confirmado devolviendo `true` para un nombre de fuente inventado en Chromium real. El preview visual sigue siendo la verificación práctica real, más que nunca.
- **El presupuesto de memoria (256MB, factor 2.5x) sigue siendo un modelo teórico, no una medición de dispositivos reales de usuarios** — Fase 9.5 sí midió memoria observada (`performance.memory`) del wizard completo en Chromium (ver 4.8), pero esa es una señal aproximada y cuantizada de UN entorno de desarrollo, no una validación del modelo `estimateMemoryBytes` contra hardware/navegadores reales de usuarios finales.
- **Safe area conservador puede generar falsos positivos** sobre fondos decorativos grandes (Fase 9.3) — documentado, no resuelto.
- **Offset de un Path cerrado arbitrario sigue sin solución geométrica** (Fase 9.3) — un die-line que necesite offset real debe modelarse como Rectangle/Ellipse, o exportarse con offset 0. No se agregó una dependencia pesada de offset de curvas sin un ADR dedicado.
- **Sin Optional Content Group real para el cut path** (Fase 9.3) — es un vector RGB reconocible, no una capa PDF nativa separable por un RIP.
- **Ellipse bajo shear real bloquea la exportación** (`transform-unsupported`, Fase 9.3) en vez de aproximar — limitación V1 conocida.
- **Sin nesting irregular ni optimización automática de desperdicio** (Fase 9.4) — el grid de imposición es siempre rectangular uniforme; una pieza con mucho espacio negativo alrededor de su forma real desperdicia área de hoja. Decisión V1 explícita.
- **`fixed-grid` que no cabe bloquea con un error, nunca reduce en silencio** (Fase 9.4) — el usuario debe corregir `rows`/`columns` él mismo.
- **Límites de producto de imposición (200 hojas / 2000 piezas) son heurísticos** (Fase 9.4) — basados en el rango medido en performance, no en una medición de memoria real de dispositivos de usuarios.
- ~~Fallo preexistente en `e2e/assisted-placement.spec.ts`~~ (Smart Guides) — **corregido en Fase 9.5**: causa raíz confirmada (no relacionada con Print Engine), suite E2E completa verde.
- **Cross-browser (Firefox/WebKit) sigue sin verificar** — límite del entorno de desarrollo actual (solo Chromium instalado), no una decisión de producto; ver Technical Debt.
- **`ProductionExportController.cancelExport()` (en `apps/sticker-builder`) es un método público sin ninguna afordancia de UI real que lo dispare** — el único "Cancelar" visible usa el cierre completo (`close()`), que es seguro; documentado en Technical Debt en vez de agregarse una UI nueva durante hardening.

## 8. Épica 9 — cerrada (Fases 9.1-9.5)

Ver `docs/platform/TRACEABILITY_MATRIX_EPIC9.md` para el estado requisito-por-requisito de las 5 fases y el reporte ejecutivo final de Fase 9.5 para el cierre formal. No hay una fase 9.6 planificada — cualquier trabajo futuro sobre impresión (nesting irregular, tiling de gran formato, integración con RIP/plotter, Optional Content Group real) requeriría una épica nueva con su propia autorización explícita.
