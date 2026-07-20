# ADR-0021 — Print Engine Foundation (Épica 9 / Fase 9.1)

## Problema
Impulso puede diseñar, guardar y exportar PNG/SVG (ADR-0012) — pero no produce una salida confiable para **impresión física**: tamaño real, sangrado, marcas de corte, verificación previa a producción. La Épica 9 introduce un **Print Engine** de plataforma, reutilizable por cualquier Builder futuro (no un botón "exportar PDF" específico de Sticker Builder). Esta fase (9.1) sienta la base: modelo de unidades, `PrintJob`, boxes físicas, naming, estimación de memoria y un Preflight estructural — deliberadamente sin PDF, sin raster de impresión, sin marcas/cut paths renderizados, sin imposición ni UI final (eso son las Fases 9.2-9.5, cada una con su propia autorización).

## Contexto
- El usuario exigió, antes de escribir código, una Review Previa de 12 puntos (arquitectura, UX, auditoría del Export Engine actual, modelo de Print Job, modelo de unidades, estrategia de PDF/raster, bleed/safe area/cut paths, preflight, criterios de aceptación, riesgos) — entregada y aprobada con 10 correcciones obligatorias.
- Principio arquitectónico rector (dado por el usuario): la separación Document/Page/diseño editable nunca se mezcla con Print Job/configuración/validación/render/archivo — nunca se muta el `Document` para exportar; el motor nunca depende de la UI para producir un resultado válido; el mismo `PrintJob` + `Document` + Assets + perfil + versión del motor debe ser determinista.
- Corrección #3 del usuario (la más crítica de esta fase) exigió verificar el modelo real de coordenadas leyendo código, nunca asumiéndolo: *"No puede existir una fórmula que trate `transform.x=100` como 100mm únicamente porque `page.unit='mm'`."*

## El modelo real de coordenadas (verificado, no asumido)

Se leyó directamente `document-schema` (`primitives/geometry.ts`, `page/page.ts`, `page/unitConversion.ts`), `renderer-konva` (`renderer.ts`, `baseAttrs.ts`, `coordinates.ts`, `offscreenRenderer.ts`) y los puntos de uso en `apps/sticker-builder` (`inspector.ts`, `alignment.ts`, `assistedPlacement.ts`, `newProjectDialog.ts`), y se confirmó con un test empírico dedicado (creado, ejecutado y luego descartado por ser un diagnóstico puntual). Conclusión, con tres espacios numéricos que coexisten y **nunca deben confundirse**:

1. **Px canónico** — `SceneObject.transform.x/y` y `SceneObject.size` se guardan en un espacio CSS-96-DPI-equivalente, **el mismo para cualquier `Project` sin importar `page.unit`**. Es lo único que el Renderer lee directamente (`baseAttrs.ts`/`coordinates.ts`), sin ninguna conversión.
2. **Unidad física de página** — `Page.size.width/height` es un valor **crudo** en `page.unit` (ej. literalmente `210` para una página de 210mm). Se convierte a px canónico recién al compararlo contra geometría de objects, vía `toPixels(page.size.width, page.unit)` — patrón repetido idéntico en `renderer.ts`, `alignment.ts`, `assistedPlacement.ts`. El `Inspector` es el único límite de UI que hace esta conversión en ambos sentidos (`fromPixels`/`toPixels`) para mostrarle un valor al usuario en su unidad preferida.
3. **Resolución de impresión** (`PrintJob.resolution.targetPpi`) — un PPI real (150/300/600...), **completamente independiente** del 96 fijo de arriba. `document-schema`'s `toPixels` (resolución de pantalla) nunca debe reutilizarse para esto.

**Identidad verificada con test dedicado** (`units.test.ts`), la base de todo el pipeline de raster de Fase 9.2:
```
physicalToPixels(v, unit, targetPpi) === toPixels(v, unit) × (targetPpi / 96)
```
Esto permite que Fase 9.2 reutilice el mismo `Konva.Stage` ya construido en px canónico (96 implícito) pidiéndole solo un `pixelRatio = targetPpi / 96` a `stage.toCanvas()`, sin reconvertir la posición de cada object.

### Bug real encontrado durante esta verificación
`apps/sticker-builder/src/projectPresets.ts`: el preset "Sticker circular (5×5cm)" guardaba el `size` de su línea de corte (die-line) en mm crudos (`{ width: 50, height: 50 }`) en vez de convertirlo a px canónico — la línea de corte cubría solo ~26.5% de la página, en la esquina superior-izquierda, en vez de coincidir con el borde. Corregido con `toPixels()`; test de regresión agregado. Confirmado que era un bug real y no un caso ya cubierto por otro test (358 tests en sticker-builder, antes 357, todos verdes).

## Alternativas evaluadas (Preflight — nivel de garantía sobre fuentes)
`document.fonts.check()` es la única API disponible sin DOM adicional, pero el usuario prohibió tratarla como garantía absoluta (corrección #6). Se evaluaron: (A) binario disponible/no-disponible: descartada, produce falsos "todo correcto"; (B) 3 estados (`available`/`unavailable`/`verification-uncertain`), con degradación honesta cuando la API no existe (nunca finge éxito): **elegida** — es la única que puede admitir su propia incertidumbre sin bloquear la exportación por eso.

## Decisión tomada

### Paquete nuevo: `@impulso/print-engine`
Único paquete nuevo (no uno separado para Preflight, per corrección de arquitectura), dependiente solo de `@impulso/document-schema` y `@impulso/export-engine` (para `ExportAssetResolver`/`sanitizeFilename` — reutilización aditiva, nunca reescritura). Sin dependencia de `apps/sticker-builder`, sin dependencias circulares.

```
packages/print-engine/src/
├── units.ts / units.test.ts            # unitToPoints, physicalToPixels, pixelRatioForPpi, convertUnit...
├── types.ts                            # PrintJob, BleedSpec, SafeAreaSpec, CropMarksSpec, CutPathSpec, ImpositionSpec...
├── boxes.ts / boxes.test.ts            # computeBoxes: TrimBox/BleedBox/MediaBox/SafeAreaBox/CropBox
├── printJob.ts / printJob.test.ts      # createPrintJob(profile, overrides) -> PrintJob completo
├── profiles.ts                         # 4 perfiles base: digital-png, print-pdf, sticker-sheet, web-preview
├── naming.ts / naming.test.ts          # buildPrintFilename — determinista
├── memory.ts / memory.test.ts          # estimateMemoryBytes — nunca width×height×4 crudo
├── preflight/
│   ├── types.ts                        # PreflightIssue/PreflightResult/PreflightSeverity/PreflightCode
│   ├── fonts.ts                         # FontChecker — 3 estados, degradación honesta
│   ├── imageProbe.ts                    # ImageDimensionsProbe — degrada a undefined, nunca finge
│   └── runPreflight.ts / .test.ts      # orquestador — orden determinista
├── testUtils/fixtures.ts
└── index.ts                            # barrel público
```

### Modelo de boxes PDF (corrección #4 — sin ambigüedad)
- **TrimBox**: tamaño final terminado — exactamente `PrintJob.dimensions`.
- **BleedBox**: trim + sangrado por lado — nunca incluye espacio de marcas.
- **MediaBox**: superficie TOTAL del PDF — bleed + espacio de marcas de corte si están activadas (nunca más chico que BleedBox).
- **SafeAreaBox**: vive dentro del trim, puramente informativo — nunca se exporta como contenido.
- **CropBox**: decisión explícita = MediaBox (no una omisión) — un archivo de impresión debe mostrar sus propias marcas/bleed a quien lo abra (operador de imprenta, el propio usuario), nunca ocultarlos con un CropBox recortado por defecto.
- **ArtBox**: no usado en V1 — sin necesidad clara identificada, documentado explícitamente.
- `cropMarkStartDistance(bleedOnSide, offset) = max(bleedOnSide, offset)` garantiza que una marca nunca invada el sangrado ni quede a menos del offset configurado del trim.

### `PrintJob` — efímero y versionado
`PRINT_JOB_SCHEMA_VERSION = 1`. Vive en memoria mientras dura el flujo de exportación; `createPrintJob(profile, overrides)` siempre produce un objeto completo (nunca un parcial que dependa de que la UI rellene el resto) fusionando los defaults de `PRINT_PROFILES[profile]` con overrides explícitos.

**Bug real encontrado y corregido durante esta fase**: `createPrintJob` devolvía por referencia los objetos anidados del perfil (`bleed`, `safeArea`, `cropMarks`, `cutPath`, `imposition`, `resolution`, `background`) — mutar un campo de un `PrintJob` (ej. la propia UI ajustando el sangrado) corrompía permanentemente el preset compartido `PRINT_PROFILES[profile]` para **todo** `PrintJob` construido después a partir del mismo perfil, incluso en procesos/sesiones distintas del mismo runtime. Se detectó por una suite de tests de Preflight que fallaba de forma no-determinista según el orden de ejecución (varios tests mutaban `printJob.bleed.left`/`.top` legítimamente, y tests posteriores heredaban esa corrupción). Corregido envolviendo el resultado completo de `createPrintJob` en `structuredClone` — ninguna referencia compartida sobrevive la construcción.

### Preflight (sección 13) — estructural, Fase 9.1
`runPreflight(project, printJob, options): Promise<PreflightResult>` — puro respecto a I/O real (recibe `resolver`/`fontChecker`/`imageProbe` inyectados, con defaults reales para producción y fakes deterministas para tests). Validaciones de esta fase: documento no normalizado (bloqueante, corta inmediatamente), dimensiones/bleed/escala inválidos, página referenciada inexistente, página vacía (objects invisibles no cuentan), asset faltante (referencia y binario — ERROR, más estricto que Export Engine por las apuestas mayores de un Print Job), resolución efectiva insuficiente (advertencia — sección 14 prohíbe bloquear por esto, NUNCA error), fuente no disponible o incierta (advertencia/info — nunca error, corrección #6), presupuesto de memoria excedido (error bloqueante). Deliberadamente diferido a fases futuras: validez de cut path (9.3), invasión de safe area (9.3), fondo insuficiente para el bleed (9.3), transparencia no soportada por el perfil (9.2), imposición que no cabe (9.4).

Orden determinista: `printJob.pageIds` en su propio orden; `layers`/`objects` en el orden natural del array — nunca `Set`/`Map` — el mismo input produce siempre la misma lista de issues en el mismo orden (verificado con test dedicado).

### Estimación de memoria (corrección #8)
`estimateMemoryBytes` nunca usa `width × height × 4` (RGBA crudo) como presupuesto total — lo usa como base y aplica `MEMORY_OVERHEAD_FACTOR = 2.5` (cubre canvas de composición final, buffers temporales de codificación/decodificación, overhead no determinístico del navegador), documentado como aproximación deliberada, no una medición exacta. `DEFAULT_MEMORY_BUDGET_BYTES = 256MB`. El aspecto de reutilización de una pieza rasterizada N veces en una imposición (evitar re-renderizar el mismo diseño) queda explícitamente para Fase 9.4 — el campo `simultaneousPages` de este modelo ya está preparado para no penalizarlo de más cuando llegue.

### Verificación del recorte por bleed (corrección #7)
Se auditó `renderer-konva` (Stage interactivo y `offscreenRenderer.ts`) buscando cualquier `clip`/`clipFunc`/`clipWidth` en Stage, Layer o Group — no existe ninguno, en ningún nivel. Lo único que define la región rasterizada hoy es el propio `width`/`height` del `Konva.Stage`, que ambos renderers dimensionan exactamente al TrimBox en px (`toPixels(page.size.width, page.unit)`). Se agregaron tests dedicados a `offscreenRenderer.test.ts` que confirman empíricamente: (a) ausencia estructural de clip en Stage/Layer/Group; (b) un object con coordenadas negativas conserva su posición absoluta sin recorte ni traslación al origen; (c) un object cuyo tamaño excede el trim conserva su tamaño íntegro; (d) un Rect agregado manualmente con las dimensiones del futuro MediaBox no es recortado por ningún nodo padre existente. **Conclusión para Fase 9.2**: extender el sangrado es aditivo — construir el Stage offscreen con las dimensiones del MediaBox (no el TrimBox) y trasladar el contenido por `trimOffsetWithinMedia` — sin necesidad de desactivar ningún clip, porque ninguno existe.

## Consecuencias
- `@impulso/print-engine` nace en 0.1.0, con 96 tests propios (units, boxes, printJob, profiles vía printJob, naming, memory, preflight) y cobertura ≥90%/90%/90%/85% (líneas/statements/funciones/branches).
- `@impulso/renderer-konva` gana 4 tests nuevos en `offscreenRenderer.test.ts` documentando la ausencia de clipping — sin cambios de comportamiento, solo verificación.
- `apps/sticker-builder/src/projectPresets.ts` corrige el bug real del die-line del preset circular — el resto del código de la app no cambia en esta fase (sin UI de exportación a producción todavía).
- Ningún paquete existente pierde compatibilidad — todas las adiciones son aditivas.

## Riesgos
- **`pdf-lib` (aprobado para Fase 9.2) no se ha integrado todavía** — su encapsulación detrás de un `PdfBackend` interno (corrección #1) y su riesgo de mantenimiento se abordan al iniciar esa fase, cuando exista código real que evaluar.
- **`browserImageDimensionsProbe`/`browserFontChecker` degradan de forma silenciosa en jsdom** (sin `createImageBitmap`/`document.fonts` reales) — cubierto con tests que fuerzan la ausencia de esas APIs, pero la cobertura real de "qué tan seguido ocurre en producción" solo se conocerá con uso real (navegadores modernos sí las tienen).
- **El presupuesto de memoria (256MB, factor 2.5x) es un punto de partida documentado, no una medición empírica de este proyecto** — declarado explícitamente ajustable en Fase 9.5 (Hardening) si la evidencia real lo justifica.
- **La imposición (reutilizar una pieza rasterizada N veces en vez de re-renderizar) no está implementada todavía** — el modelo de memoria ya lo anticipa (`simultaneousPages`), pero la lógica real de composición es Fase 9.4.

## Compatibilidad futura
- Fase 9.2 (Raster Pipeline & PDF Backend) construye directamente sobre `physicalToPixels`/`pixelRatioForPpi` (unidades), `computeBoxes` (MediaBox para el Stage offscreen extendido) y el hallazgo de este ADR sobre ausencia de clipping.
- Fase 9.3 (Marcas, Safe Area, Cut Paths) agrega los `PreflightCode` ya reservados pero no emitidos en esta fase (`safe_area_violation`, `cut_path_invalid`, etc. — nombres definitivos a confirmar al implementarlos).
- Fase 9.4 (Imposición) reutiliza `ImpositionSpec` (ya en `types.ts`, con default `NO_IMPOSITION` en los 3 perfiles no-sheet) y el campo `simultaneousPages` de `memory.ts`.
