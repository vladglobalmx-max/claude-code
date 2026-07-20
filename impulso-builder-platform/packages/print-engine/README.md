# @impulso/print-engine

> Print Engine de plataforma, nacido en la Épica 9 (Professional Print Engine). Produce salidas confiables para impresión digital, corte y producción comercial — modelo de `PrintJob`, unidades físicas, boxes de PDF (Trim/Bleed/Media/Safe Area), Preflight, y ahora (Fase 9.2) el pipeline real de raster: PNG físico multipágina y PDF aplanado de alta resolución. Reutilizable por cualquier Builder futuro. Ver [ADR-0021](../../docs/adr/0021-print-engine-foundation.md) (Fase 9.1) y [ADR-0022](../../docs/adr/0022-print-engine-raster-pipeline.md) (Fase 9.2).

**Estado:** Fase 9.2 (Raster Pipeline & PDF Backend) completa. Deliberadamente **sin** marcas de corte renderizadas, sin cut paths exportados, sin imposición ni UI de exportación todavía — eso son las Fases 9.3-9.5, cada una con su propia autorización explícita.

---

## 1. Qué es y qué no es

- **Sí hace:** modela un `PrintJob` completo y versionado (`createPrintJob`); calcula boxes físicas (`computeBoxes`, `computePdfPageBoxes`); convierte entre unidades físicas, puntos PDF y píxeles de raster a un PPI real (`units.ts`); corre Preflight estructural (`runPreflight`); **rasteriza páginas físicas reales** con sangrado (`renderPrintPage`/`renderPrintJob`, reutilizando `@impulso/renderer-konva` de forma aditiva); **exporta PNG físico multipágina** (`exportPrintJobToPng`) y **PDF aplanado de alta resolución** (`exportPrintJobToPdf`, con `pdf-lib` completamente encapsulado detrás de `PdfBackend`); soporta cancelación (`AbortSignal`) y progreso por etapas en ambos formatos.
- **No hace todavía:** no dibuja marcas de corte ni safe area visual (Fase 9.3); no exporta cut paths ni soporta kiss-cut/die-cut real (Fase 9.3); no arma una imposición/hoja con múltiples copias (Fase 9.4); no ofrece ninguna UI de exportación a producción (existe un harness *temporal* de verificación en Chromium, ver sección 8 — no es producto).

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
    ├── preflight/                   # runPreflight, fonts.ts, imageProbe.ts (Fase 9.1)
    ├── raster/
    │   ├── coordinates.ts           # computeCanonicalPageGeometry — px canónico -> raster físico
    │   ├── objectFilters.ts         # defaultShouldRenderObject (excluye die-line), combineShouldRenderObject
    │   ├── collectImageAssetIds.ts  # recorrido recursivo de Image dentro de group
    │   ├── assetImageCache.ts       # cache de imágenes decodificadas de UNA exportación (single-flight)
    │   ├── renderPrintPage.ts       # UNA página -> HTMLCanvasElement físico
    │   ├── renderPrintJob.ts        # orquesta TODAS las páginas — generador async, nunca N en memoria a la vez
    │   ├── exportPrintJobToPng.ts   # PNG físico multipágina
    │   └── exportPrintJobToPdf.ts   # PDF aplanado de alta resolución
    ├── pdf/
    │   ├── pdfBackend.ts            # PdfBackend/PdfBackendDocument — CERO tipos de pdf-lib
    │   ├── pdfLibBackend.ts         # ÚNICO módulo del paquete que importa pdf-lib
    │   └── pageBoxes.ts             # computePdfPageBoxes — Trim/Bleed/Media/Crop en puntos
    └── testUtils/
        ├── fixtures.ts              # builders de dominio (Fase 9.1)
        └── goldenFixtures.ts        # 6 escenarios canónicos (sección 22, Fase 9.2)

    (183 tests, cobertura ≥90%/90%/90%/85% líneas/statements/funciones/branches)
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
UN solo archivo, una página PDF por página del `PrintJob`, cada una con el raster de contenido cubriendo exactamente el `MediaBox` (= `BleedBox` en esta fase — sin espacio de marcas todavía) y los 4 boxes físicos correctos (`Trim`/`Bleed`/`Media`/`Crop`). El backend `pdf-lib` queda completamente aislado detrás de `PdfBackend` — nunca importado directamente por este módulo ni por ningún caller.

### 4.4 Backend PDF encapsulado
`pdf/pdfBackend.ts` define `PdfBackend`/`PdfBackendDocument` sin ningún tipo de `pdf-lib` en su firma (solo primitivas y boxes en puntos). `pdf/pdfLibBackend.ts` es el ÚNICO módulo de todo el paquete que importa `pdf-lib` — inyectable vía `exportPrintJobToPdf(..., { backend })` para tests de dominio que nunca necesitan conocerla (mismo patrón que `PngRasterizer` de `@impulso/export-engine`, ADR-0012).

**Dos comportamientos por-defecto de `pdf-lib` corregidos explícitamente** (no bugs de este código): `save()` agrega una página en blanco si el documento tiene 0 páginas (`addDefaultPage: false` forzado — el número de páginas lo decide únicamente `PrintJob.pageIds`); `load()` sobrescribe `Producer`/`CreationDate` por defecto (los tests que verifican metadata inyectada pasan `{ updateMetadata: false }` al recargar).

### 4.5 Cancelación, progreso y errores tipados
`AbortSignal` chequeado en los 10 puntos mínimos (antes/después de Preflight, de resolver assets, de cada página, de incrustar en PDF, de `save()`). Progreso por etapas (`validating → preparing-assets → rendering-page → encoding-page|assembling-pdf → finalizing → completed`) vía `onProgress`, con errores del propio callback nunca corrompiendo la exportación. `PrintEngineError` con 11 códigos tipados (`errors.ts`) — nunca un string libre que la UI futura tenga que inspeccionar.

## 5. Verificación en Chromium real (temporal — ver ADR-0022)

`apps/sticker-builder/print-engine-harness.html` + `src/printEngineHarness.ts` ejercitan el pipeline COMPLETO en un navegador real, sin ningún mock (Konva real, Canvas/Image reales, `pdf-lib` real) — 12 escenarios (`e2e/print-engine.spec.ts`), incluyendo lectura real de píxeles y estructura real de PDF. Hallazgo confirmado durante esta verificación: `document.fonts.check()` devuelve **siempre `true`** en el Chromium usado, incluso para un nombre de fuente inventado — validando por qué Fase 9.1 prohibió tratar esa API como garantía absoluta. Este harness no es producto — ninguna pantalla de la app navega a él; se retira o se transforma en la UI real de exportación en Fase 9.4.

## 6. Desarrollo

```bash
pnpm --filter @impulso/print-engine build
pnpm --filter @impulso/print-engine test
pnpm --filter @impulso/print-engine typecheck

# Verificación en Chromium real (desde apps/sticker-builder):
pnpm --filter @impulso/sticker-builder test:e2e
```

## 7. Riesgos y limitaciones conocidas

- **`pdf-lib` es ahora una dependencia real** (Fase 9.2) — su riesgo de mantenimiento ya estaba registrado en Technical Debt desde Fase 9.1; confirmado con evidencia real (dos comportamientos por-defecto sorprendentes documentados arriba).
- **`document.fonts.check()` puede ser una señal mucho más débil de lo esperado** — confirmado devolviendo `true` para un nombre de fuente inventado en Chromium real. El preview visual sigue siendo la verificación práctica real, más que nunca.
- **El presupuesto de memoria (256MB, factor 2.5x) sigue sin una medición empírica** de este proyecto — ajustable en Fase 9.5 si la evidencia real lo justifica.
- **La reutilización de una pieza rasterizada N veces en una imposición no está implementada** — el modelo (`simultaneousPages`) y el diseño de una-página-a-la-vez ya lo anticipan, la composición real es Fase 9.4.
- **El harness de Chromium es código temporal** — debe retirarse o transformarse en la UI real al construir Fase 9.4.

## 8. Mejoras futuras (fases ya planificadas de la Épica 9)

- **Fase 9.3** — Marcas, Safe Area & Cut Paths: crop marks vectoriales, safe area, die-line, kiss-cut/die-cut, expansión de `MediaBox` para el espacio de marcas, Preflight correspondiente.
- **Fase 9.4** — Imposición & Production Preview: hoja, repetición, grid, preview, flujo de UI real (reemplazando el harness), advertencias y exportación explícita.
- **Fase 9.5** — Hardening & Golden Tests: presupuestos, memoria, determinismo, infraestructura completa de golden files (sobre `testUtils/goldenFixtures.ts`), validación programática de PDF, E2E completo.
