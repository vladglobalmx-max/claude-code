# @impulso/print-engine

> Print Engine de plataforma, nacido en la Épica 9 (Professional Print Engine). Construye la base para producir salidas confiables para impresión digital, corte y producción comercial — modelo de `PrintJob`, unidades físicas, boxes de PDF (Trim/Bleed/Media/Safe Area), naming determinista, estimación de memoria y un Preflight estructural. Reutilizable por cualquier Builder futuro. Ver [ADR-0021](../../docs/adr/0021-print-engine-foundation.md).

**Estado:** Fase 9.1 (Print Model, Coordinates, Units & Preflight Foundation). Deliberadamente **sin** PDF, sin raster de impresión, sin marcas de corte renderizadas, sin imposición ni UI de exportación todavía — eso son las Fases 9.2-9.5, cada una con su propia autorización explícita.

---

## 1. Qué es y qué no es

- **Sí hace:** modela un `PrintJob` completo y versionado (`createPrintJob`); calcula las boxes físicas de una página de impresión (`computeBoxes`: TrimBox/BleedBox/MediaBox/SafeAreaBox/CropBox); convierte entre unidades físicas, puntos PDF y píxeles de raster a un PPI real (`units.ts` — nunca el `toPixels` de 96 fijo de `document-schema`, que es de pantalla); estima el nombre de archivo determinista (`buildPrintFilename`) y el consumo de memoria de un raster antes de generarlo (`estimateMemoryBytes`, con overhead documentado, nunca `width×height×4` crudo); corre validaciones estructurales previas a exportar (`runPreflight`: dimensiones/bleed/escala inválidos, páginas faltantes/vacías, assets faltantes, resolución efectiva insuficiente, fuentes no disponibles/inciertas, presupuesto de memoria).
- **No hace todavía:** no genera PDF (pendiente de Fase 9.2, `pdf-lib` encapsulado detrás de un `PdfBackend` interno); no rasteriza contenido de impresión real (Fase 9.2); no dibuja marcas de corte ni cut paths (Fase 9.3); no arma una imposición/hoja con múltiples copias (Fase 9.4); no ofrece ninguna UI de exportación a producción (ninguna fase todavía la ha construido).

## 2. Árbol

```
packages/print-engine/
├── package.json / tsconfig.json / vitest.config.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                    # API pública
    ├── units.ts / units.test.ts    # unitToPoints, physicalToPixels, pixelRatioForPpi, convertUnit...
    ├── types.ts                    # PrintJob, BleedSpec, SafeAreaSpec, CropMarksSpec, CutPathSpec, ImpositionSpec...
    ├── boxes.ts / boxes.test.ts    # computeBoxes: TrimBox/BleedBox/MediaBox/SafeAreaBox/CropBox
    ├── printJob.ts / printJob.test.ts   # createPrintJob(profile, overrides) -> PrintJob completo
    ├── profiles.ts                 # 4 perfiles base: digital-png, print-pdf, sticker-sheet, web-preview
    ├── naming.ts / naming.test.ts  # buildPrintFilename — determinista
    ├── memory.ts / memory.test.ts  # estimateMemoryBytes — nunca width×height×4 crudo
    ├── preflight/
    │   ├── types.ts                # PreflightIssue/PreflightResult/PreflightSeverity/PreflightCode
    │   ├── fonts.ts                # FontChecker — 3 estados, degradación honesta
    │   ├── imageProbe.ts           # ImageDimensionsProbe — degrada a undefined, nunca finge
    │   └── runPreflight.ts / .test.ts   # orquestador — orden determinista
    └── testUtils/fixtures.ts

    (96 tests, cobertura ≥90%/90%/90%/85% líneas/statements/funciones/branches)
```

## 3. El modelo de coordenadas (lo más importante de esta fase — ver ADR-0021 para el detalle completo)

Tres espacios numéricos coexisten en Impulso y **nunca deben confundirse**:

1. **Px canónico** (`SceneObject.transform`/`SceneObject.size`) — un espacio CSS-96-DPI-equivalente, el mismo para cualquier `Project` sin importar `page.unit`. Es lo único que el Renderer lee directamente.
2. **Unidad física de página** (`Page.size`, interpretada por `Page.unit`) — un valor crudo en esa unidad (ej. literalmente `210` para una página de 210mm), convertido a px canónico solo al compararlo contra geometría de objects (`toPixels(page.size.width, page.unit)`).
3. **Resolución de impresión** (`PrintJob.resolution.targetPpi`) — un PPI real (150/300/600...), completamente independiente del `96` fijo de arriba.

Identidad verificada con test dedicado, base del pipeline de raster de Fase 9.2:
```
physicalToPixels(v, unit, targetPpi) === toPixels(v, unit) × (targetPpi / 96)
```

**Por qué no reutilizamos `toPixels` de `document-schema` para impresión**: esa función fija 96 DPI (la resolución de pantalla/CSS) — usarla para imprimir produciría siempre una imagen de calidad de pantalla sin importar el PPI configurado. `physicalToPixels`/`pixelsToPhysical` (este paquete) son las únicas conversiones que aceptan un PPI real como parámetro.

## 4. Decisiones clave (ver ADR-0021 para el detalle completo)

### 4.1 Boxes de PDF sin ambigüedad
TrimBox = tamaño final. BleedBox = trim + sangrado (nunca incluye espacio de marcas). MediaBox = superficie TOTAL del PDF (bleed + espacio de marcas si están activadas). CropBox = MediaBox por decisión explícita (un archivo de impresión debe mostrar sus propias marcas/bleed a quien lo abra). ArtBox no se usa en V1 (sin necesidad clara identificada).

### 4.2 `PrintJob` es efímero, versionado y siempre un valor propio del llamador
`createPrintJob` nunca devuelve una referencia compartida con los presets de `PRINT_PROFILES` ni con los `overrides` recibidos — el resultado completo pasa por `structuredClone`. Esto existe porque un `PrintJob` está pensado para mutarse (la UI ajustando bleed/resolución antes de exportar); sin ese clon, mutar un campo corrompería el preset compartido para todo `PrintJob` futuro construido a partir del mismo perfil.

### 4.3 Preflight nunca bloquea por resolución insuficiente ni por fuente no disponible
Ambos casos son advertencias (o info, si la incertidumbre es real) — nunca un error. Solo bloquean: documento no normalizado, dimensiones/bleed/escala inválidos, página referenciada inexistente, asset faltante (referencia o binario), y presupuesto de memoria excedido.

### 4.4 Estimación de memoria con overhead documentado, nunca el raster crudo
`estimateMemoryBytes` usa `width × height × 4` como base y aplica `MEMORY_OVERHEAD_FACTOR = 2.5` — cubre el canvas de composición final, buffers de codificación/decodificación y overhead no determinístico del navegador. Documentado como aproximación deliberada, ajustable en Fase 9.5 (Hardening) con evidencia real.

### 4.5 Ausencia de clipping en el Renderer, confirmada empíricamente
`@impulso/renderer-konva` no aplica ningún `clip`/`clipFunc` en Stage, Layer ni Group — la única frontera de la región rasterizada hoy es el propio `width`/`height` del `Konva.Stage` (dimensionado al TrimBox). Esto significa que extender el sangrado en Fase 9.2 es aditivo: construir el Stage offscreen con las dimensiones del MediaBox y trasladar el contenido, sin desactivar ningún clip porque ninguno existe. Ver tests en `packages/renderer-konva/src/offscreenRenderer.test.ts` (sección "corrección 7").

## 5. Desarrollo

```bash
pnpm --filter @impulso/print-engine build
pnpm --filter @impulso/print-engine test
pnpm --filter @impulso/print-engine typecheck
```

## 6. Riesgos y limitaciones conocidas

- **`pdf-lib` todavía no se ha integrado** — aprobado para Fase 9.2, detrás de un `PdfBackend` interno (sin tipos de pdf-lib en la API pública de este paquete).
- **`browserImageDimensionsProbe`/`browserFontChecker` degradan silenciosamente en entornos sin las APIs reales** (jsdom, algunos navegadores antiguos) — nunca fingen éxito, pero su cobertura real en producción solo se conocerá con uso real.
- **El presupuesto de memoria (256MB, factor 2.5x) es un punto de partida documentado, no una medición empírica** de este proyecto — ajustable en Fase 9.5 si la evidencia real lo justifica.
- **La reutilización de una pieza rasterizada N veces en una imposición no está implementada** — el modelo de memoria ya la anticipa (`simultaneousPages`), la lógica real es Fase 9.4.

## 7. Mejoras futuras (fases ya planificadas de la Épica 9)

- **Fase 9.2** — Raster Pipeline & PDF Backend: extensión aditiva del offscreen renderer para bleed, filtros de objects por rol, backend `pdf-lib` encapsulado, PDF y PNG físicos, cancelación por etapas.
- **Fase 9.3** — Marcas, Safe Area & Cut Paths: crop marks vectoriales, safe area, die-line, kiss-cut/die-cut, Preflight correspondiente.
- **Fase 9.4** — Imposición & Production Preview: hoja, repetición, grid, preview, flujo de UI, advertencias y exportación explícita.
- **Fase 9.5** — Hardening & Golden Tests: presupuestos, memoria, determinismo, golden files, validación programática de PDF, E2E completo.
