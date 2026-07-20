# @impulso/print-engine

> Print Engine de plataforma, nacido en la Épica 9 (Professional Print Engine). Produce salidas confiables para impresión digital, corte y producción comercial — modelo de `PrintJob`, unidades físicas, boxes de PDF (Trim/Bleed/Media/Safe Area), Preflight, el pipeline real de raster (PNG físico multipágina y PDF aplanado de alta resolución), y ahora (Fase 9.3) marcas de corte vectoriales, safe area verificable, y cut paths reales (kiss-cut/die-cut V1). Reutilizable por cualquier Builder futuro. Ver [ADR-0021](../../docs/adr/0021-print-engine-foundation.md) (Fase 9.1), [ADR-0022](../../docs/adr/0022-print-engine-raster-pipeline.md) (Fase 9.2) y [ADR-0023](../../docs/adr/0023-print-engine-marks-safearea-cutpaths.md) (Fase 9.3).

**Estado:** Fase 9.3 (Marks, Safe Area & Cut Paths) completa. Deliberadamente **sin** imposición/repetición en hojas, sin Production Preview definitivo, sin UI de exportación final todavía — eso es la Fase 9.4, con su propia autorización explícita.

---

## 1. Qué es y qué no es

- **Sí hace:** modela un `PrintJob` completo y versionado (`createPrintJob`); calcula boxes físicas (`computeBoxes`, `computePdfPageBoxes`); convierte entre unidades físicas, puntos PDF y píxeles de raster a un PPI real (`units.ts`); corre Preflight estructural + de marcas/safe area/cut path (`runPreflight`); **rasteriza páginas físicas reales** con sangrado (`renderPrintPage`/`renderPrintJob`, reutilizando `@impulso/renderer-konva` de forma aditiva); **exporta PNG físico multipágina** (`exportPrintJobToPng`) y **PDF aplanado de alta resolución** (`exportPrintJobToPdf`, con `pdf-lib` completamente encapsulado detrás de `PdfBackend`); soporta cancelación (`AbortSignal`) y progreso por etapas en ambos formatos; **dibuja marcas de corte vectoriales reales** (PDF y PNG) expandiendo el `MediaBox` para su espacio; **calcula Safe Area** como ayuda de validación/preview (verificado byte-idéntico al archivo final, nunca parte de él); **detecta y dibuja un cut path real** (Rectangle/Ellipse/Path cerrado, con offset exacto o bloqueo honesto según el tipo) para kiss-cut/die-cut V1 (semántico, sin OCG ni parámetros de hardware reales).
- **No hace todavía:** no arma una imposición/hoja con múltiples copias, gaps, ni grid de producción (Fase 9.4); no ofrece ninguna UI de exportación a producción final (existen dos harnesses *temporales* de verificación en Chromium, ver sección 5 — no son producto); no genera un Optional Content Group real para el cut path (documentado como deuda, ver sección 7); no soporta CMYK, perfiles ICC, ni Spot Colors certificados (el color del cut path es RGB visual, nunca certificado).

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
    ├── preflight/                   # runPreflight, fonts.ts, imageProbe.ts (Fase 9.1) + cropMarksChecks/safeAreaChecks/cutPathChecks (Fase 9.3)
    ├── raster/
    │   ├── coordinates.ts           # computeCanonicalPageGeometry — px canónico -> raster físico
    │   ├── objectFilters.ts         # defaultShouldRenderObject (excluye die-line), combineShouldRenderObject
    │   ├── collectImageAssetIds.ts  # recorrido recursivo de Image dentro de group
    │   ├── assetImageCache.ts       # cache de imágenes decodificadas de UNA exportación (single-flight)
    │   ├── renderPrintPage.ts       # UNA página -> HTMLCanvasElement físico
    │   ├── renderPrintJob.ts        # orquesta TODAS las páginas — generador async, nunca N en memoria a la vez
    │   ├── canonicalToRasterPoints.ts  # conversiones canónico/físico -> raster px (marcas y cut path)
    │   ├── composeCanvasOverlays.ts     # createMediaCanvasWithContent + dibujo de marcas/cut path en Canvas2D
    │   ├── exportPrintJobToPng.ts   # PNG físico multipágina, con overlays compuestos cuando aplica
    │   └── exportPrintJobToPdf.ts   # PDF aplanado de alta resolución, con marcas/cut path vectoriales
    ├── pdf/
    │   ├── pdfBackend.ts            # PdfBackend/PdfBackendDocument — CERO tipos de pdf-lib
    │   ├── pdfLibBackend.ts         # ÚNICO módulo del paquete que importa pdf-lib
    │   ├── pageBoxes.ts             # computePdfPageBoxes — Trim/Bleed/Media/Crop en puntos, con espacio de marcas
    │   ├── color.ts                 # parseHexColor — el cut path/marcas exigen RGB hex, nunca Spot Color
    │   └── canonicalToPdfPoints.ts  # conversiones canónico/físico -> puntos PDF (marcas y cut path)
    └── testUtils/
        ├── fixtures.ts              # builders de dominio (Fase 9.1) + Rectangle/Ellipse/Path (Fase 9.3)
        ├── goldenFixtures.ts        # 6 escenarios canónicos (sección 22, Fase 9.2)
        ├── fakeCanvasContext2D.ts   # stub de CanvasRenderingContext2D para jsdom (gap de entorno, no de producción)
        └── pdfContentInspection.ts  # inspección mínima del content stream real de un PDF (sección 30, Fase 9.3)

    (333 tests, cobertura ≥90%/90%/90%/85% líneas/statements/funciones/branches)
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
`AbortSignal` chequeado antes/después de CADA operación asíncrona del pipeline (Preflight, resolver assets, cada página, componer overlays, incrustar en PDF, `save()`) — auditado explícitamente en Fase 9.3 para las nuevas etapas de overlay. Progreso por etapas (`validating → preparing-assets → rendering-page → encoding-page|assembling-pdf → finalizing → completed`) vía `onProgress`, con errores del propio callback nunca corrompiendo la exportación. `PrintEngineError` con 11 códigos tipados (`errors.ts`) — nunca un string libre que la UI futura tenga que inspeccionar.

### 4.6 Marcas de corte, Safe Area y Cut Paths (Fase 9.3 — ver ADR-0023 para el detalle completo)

**Marcas de corte**: `computeCropMarksGeometry` (puro) produce 8 segmentos (2 por esquina) en el espacio físico de `MediaBox` — siempre fuera del `BleedBox`, nunca invaden el `TrimBox`. `computePdfPageBoxes` expande el `MediaBox` para darles espacio (`cropMarkStartDistance` = `max(bleedPerSide, offset) + length` por lado); el raster de contenido sigue siendo del tamaño del `BleedBox`, solo se reposiciona.

**Safe Area**: `computeSafeAreaCanonicalRect` (rect en px canónico, `undefined` si deshabilitado) + `checkSafeAreaInvasions` (qué objects lo cruzan) — es una ayuda de validación/preview, **NUNCA** parte del archivo final. Verificado empíricamente: el mismo `PrintJob` con `safeArea.enabled: true`/`false` produce un PNG byte-idéntico. Política conservadora: todo object visible participa salvo die-lines (nunca contenido) y ocultos; `locked` NO excluye; un `group` cuenta como una sola unidad (unión de bounding boxes); un object fuera del `TrimBox` nunca genera este issue. Puede generar falsos positivos sobre fondos decorativos grandes — documentado, no resuelto.

**Cut Paths**: `resolveDieLineSource` busca objects con `metadata.role === "die-line"` (o selección manual por `objectId`) — nunca elige el primero en silencio ante cero o múltiples candidatos. `normalizeCutGeometry` compone la cadena de transforms (`cutpath/affine.ts`) a un `CutGeometry` uniforme (`Rectangle`/`Ellipse`/`ClosedPath`) en espacio global: un Rectangle bajo shear real se degrada EXACTO a 4 esquinas (`ClosedPath`); un Ellipse bajo shear real se bloquea (`transform-unsupported`) en vez de aproximar. `applyCutGeometryOffset` es exacto para Rectangle/Ellipse y honestamente `"unsupported"` (nunca simulado) para un Path cerrado arbitrario — la severidad de eso la decide `PrintJob.offsetUnsupportedPolicy` (`"block"|"warn"|"use-original"`), no la función pura. Kiss-cut/die-cut V1 se distinguen solo por `logicalLayerName`/color/metadata — nunca prometen configuración real de una máquina de corte; el color es siempre RGB visual, nunca un Spot Color certificado; no se genera un Optional Content Group real (documentado como deuda).

## 5. Verificación en Chromium real (temporal — ver ADR-0022/ADR-0023)

`apps/sticker-builder/print-engine-harness.html` + `src/printEngineHarness.ts` ejercitan el pipeline COMPLETO en un navegador real, sin ningún mock (Konva real, Canvas/Image reales, `pdf-lib` real) — **27 escenarios** (`e2e/print-engine.spec.ts`): los 12 de Fase 9.2 (raster/PDF/PNG base) más 15 de Fase 9.3 (marcas nunca invaden el trim, safe area byte-idéntica al archivo final, die-line Ellipse/Path, die-line ausente del raster, cut path como vector real en el content stream, path abierto/múltiples die-lines bloquean, offset preserva dimensiones exactas, multipágina con overlays independientes, inmutabilidad/cancelación con overlays activos). Un segundo harness (`print-preview-harness.html` + `src/printPreviewHarness.ts`, `e2e/print-preview.spec.ts`, 4 tests) verifica el preview técnico mínimo: geometría idéntica a la de exportación, toggles accesibles, resumen textual, zoom puramente visual.

Hallazgo confirmado en Fase 9.2 y aún vigente: `document.fonts.check()` devuelve **siempre `true`** en el Chromium usado, incluso para un nombre de fuente inventado — validando por qué Fase 9.1 prohibió tratar esa API como garantía absoluta. Ninguno de estos harnesses es producto — ninguna pantalla de la app navega a ellos; se retiran o se transforman en la UI real de exportación en Fase 9.4.

**Fallo preexistente, no de esta fase**: `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando (confirmado antes y después del trabajo de Fase 9.3) — sin relación con marcas/safe area/cut paths, no investigado ni corregido aquí (ver Technical Debt).

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
- **El presupuesto de memoria (256MB, factor 2.5x) sigue sin una medición empírica** de este proyecto — ajustable en Fase 9.5 si la evidencia real lo justifica.
- **La reutilización de una pieza rasterizada N veces en una imposición no está implementada** — el modelo (`simultaneousPages`) y el diseño de una-página-a-la-vez ya lo anticipan, la composición real es Fase 9.4.
- **Safe area conservador puede generar falsos positivos** sobre fondos decorativos grandes (Fase 9.3) — documentado, no resuelto.
- **Offset de un Path cerrado arbitrario sigue sin solución geométrica** (Fase 9.3) — un die-line que necesite offset real debe modelarse como Rectangle/Ellipse, o exportarse con offset 0. No se agregó una dependencia pesada de offset de curvas sin un ADR dedicado.
- **Sin Optional Content Group real para el cut path** (Fase 9.3) — es un vector RGB reconocible, no una capa PDF nativa separable por un RIP.
- **Ellipse bajo shear real bloquea la exportación** (`transform-unsupported`, Fase 9.3) en vez de aproximar — limitación V1 conocida.
- **Los dos harnesses de Chromium son código temporal** — deben retirarse o transformarse en la UI real al construir Fase 9.4.
- **Fallo preexistente en `e2e/assisted-placement.spec.ts`** (Smart Guides) — confirmado no relacionado con esta fase, ver Technical Debt.

## 8. Mejoras futuras (fases ya planificadas de la Épica 9)

- **Fase 9.4** — Imposición & Production Preview: hoja, repetición, grid, preview definitivo, flujo de UI real (reemplazando ambos harnesses), advertencias y exportación explícita.
- **Fase 9.5** — Hardening & Golden Tests: presupuestos, memoria, determinismo, infraestructura completa de golden files (sobre `testUtils/goldenFixtures.ts`), validación programática de PDF, E2E completo.
