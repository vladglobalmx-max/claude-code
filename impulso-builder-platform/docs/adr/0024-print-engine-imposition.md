# ADR-0024 — Print Engine: Imposition & Sheet Repetition (Épica 9 / Fase 9.4, motor)

## Problema
Fases 9.1-9.3 (ADR-0021/0022/0023) producen un archivo print-ready para UNA pieza por página, sin repetición. En producción real de stickers, casi ningún pedido es "una copia" — un usuario pide 100/500/1000 copias de la misma pieza, que deben imponerse (repetirse) en tantas hojas físicas de un tamaño estándar como haga falta, con separación (`gap`) y márgenes reales, sin desperdiciar espacio ni prometer una capacidad que no cabe. Esta fase agrega ese modelo — junto con su exportación real (PDF/PNG) y su Preflight — como una nueva capa de imposición encima del motor ya construido, reutilizando toda su geometría/pipeline existentes, nunca reimplementándolos.

## Contexto
- La Revisión Previa de esta fase (modelo de `ImpositionSpec`, capacidad de grid automática vs. fija, gaps/márgenes, alineación del conjunto dentro del área útil, reutilización de raster, límites de producto, naming de archivos, Preflight de imposición) fue aprobada sin objeciones — autorización estándar de la épica, con el cierre explícito de no avanzar a Fase 9.5 (Hardening & Golden Tests) sin autorización separada.
- Alcance explícitamente EXCLUIDO de esta fase: nesting irregular (rotación automática por pieza para maximizar densidad), optimización automática de desperdicio, tiling de gran formato (rollos), integración con RIP/plotter, parámetros reales de cuchilla, CMYK/perfiles ICC/Spot Colors certificados, render en la nube, Marketplace, Mockup Engine, persistencia de un `PrintJob` como preset reutilizable (más allá de lo trivial ya existente en memoria durante el flujo).
- Fases 9.1-9.3 quedan cerradas como base estable — no se reabrieron salvo por las extensiones aditivas descritas abajo.

## Alternativas evaluadas

### ¿Cómo modelar "una pieza" vs. "una hoja imposicionada" en `PrintJob`?
- **A. Un campo booleano `imposed: boolean` + campos sueltos condicionales**: descartada — un booleano no comunica en el tipo qué campos son válidos juntos, y permitiría estados imposibles (ej. `gapX` con `imposed: false`).
- **B. `ImpositionSpec` como discriminated union explícito** (elegida): `{ mode: "single" } | GridImpositionSpec`. `"single"` es exactamente el comportamiento de Fases 9.1-9.3 sin cambios (una página, sin repetición) — el compilador impide leer `sheet`/`gapX`/`quantity` fuera de la rama `"grid"`. Deja además la puerta abierta a un futuro `"nesting"` sin romper el tipo existente.

### ¿Cómo calcular cuántas piezas caben en una hoja?
- **A. Aproximar con área total (área de hoja / área de pieza)**: descartada — ignora que una pieza rectangular no se puede "derretir" para llenar espacio; sobreestima la capacidad real de un grid.
- **B. Grid real fila×columna, con `placementMode` explícito** (elegida): `"automatic"` calcula la capacidad máxima real (`computeGridCapacity`) probando cuántas columnas/filas caben del footprint (pieza + gap) dentro del área útil (hoja menos márgenes); `"fixed-grid"` deja que el usuario fije `rows`/`columns` — si no caben, es un **error bloqueante explícito**, nunca una reducción silenciosa a lo que sí cabe (sección 7 del enunciado: el usuario pidió un número concreto, reducirlo sin aviso sería mentir sobre el resultado).

### ¿Qué pasa con la última hoja cuando `quantity` no es múltiplo exacto de la capacidad?
Se deja **parcialmente ocupada**, nunca se generan copias de más para "llenar" la hoja (sección 6) — `ImpositionLayout.lastSheetPieceCount`/`lastSheetEmptyCells` lo exponen explícitamente para que la UI lo muestre ("la última hoja tendrá Z piezas"), en vez de que el usuario lo descubra recién al ver el archivo.

### ¿Cómo evitar rasterizar la misma pieza N veces (una por copia)?
- **A. Renderizar cada copia individualmente con Konva**: descartada de inmediato — con 500 copias, 500 renders offscreen sería un desperdicio de CPU/memoria sin ninguna ganancia (todas las copias son geométricamente idénticas).
- **B. Rasterizar UNA sola vez por página de origen, reutilizar el mismo raster/imagen embebida N veces** (elegida): `createPieceRasterCache` (nuevo, análogo a `assetImageCache` de Fase 9.2 pero para la pieza completa, no assets individuales) — un único `HTMLCanvasElement` por página de origen, compuesto/dibujado tantas veces como copias tenga esa página en todas sus hojas. Verificado explícitamente a escala real (no solo con 2-3 piezas de juguete): `renderPageToStageMock` se llama **exactamente una vez** incluso con 500 piezas/10 hojas (ver sección de Verificación).

### ¿Cómo tratar marcas de corte en una hoja imposicionada?
- **A. Solo marcas por pieza**: descartada como única opción — para una hoja con decenas de piezas, marcas repetidas en cada footprint pueden ser ruido visual innecesario si el objetivo es cortar la hoja completa con una guillotina, no cada pieza individualmente.
- **B. `marksMode: "none" | "per-piece" | "per-sheet"` explícito** (elegida) — `"per-piece"` dibuja las 8 marcas de la pieza (relativas a su propio footprint, calculadas UNA vez y trasladadas por copia); `"per-sheet"` dibuja un único contorno de 8 marcas alrededor del área útil general de la hoja (`buildRectPrintBoxes` + `computeCropMarksGeometry` reutilizada, tratando el área útil como un "trim" sintético) — documentado explícitamente como "un contorno de producción, NUNCA una guía de corte individual por pieza" para que nadie lo confunda con el die-line real de cada copia.

### ¿Cómo tratar el cut path (die-line) de cada copia?
Igual que las marcas: el cut path se normaliza/offsetea **UNA sola vez por página de origen** (`buildBaseCutPathSegments`, reutilizando `resolveDieLineSource`/`normalizeCutGeometry`/`applyCutGeometryOffset`/`cutGeometryToPathSegments` de Fase 9.3 sin cambios) y se **traslada** (nunca se recalcula) a la posición de cada copia colocada (`placedCutPathToPdf`/su equivalente PNG) — sección 17 del enunciado: "nunca re-derivar por copia, solo trasladar". Evita recomputar geometría de similitud/shear cientos de veces por una operación que es pura aritmética de traslación.

### ¿Cómo alinear un grid que no llena el área útil por completo?
`computeAlignmentOffset` (nuevo, geometría pura) — `ImpositionAlignment` (`"top-left"`/`"top-center"`/`"top-right"`/`"center-left"`/`"center"`/`"center-right"`/`"bottom-left"`/`"bottom-center"`/`"bottom-right"`, 9 valores) desplaza el conjunto completo del grid dentro del área útil, **nunca altera** `gap`/escala/tamaño de pieza (sección 11) — es puramente un offset del bloque entero, con `"center"` como default recomendado del perfil.

### ¿Dónde viven los límites de producto (cuántas piezas/hojas es razonable)?
`MAX_IMPOSITION_SHEETS = 200` y `MAX_IMPOSITION_PIECES = 2000` (`imposition/impositionLayout.ts`) — deliberadamente **un orden de magnitud por encima** del rango verificado empíricamente en performance (500 piezas/10 hojas, ver sección de Verificación), nunca un número arbitrario: suficiente margen para uso real sin arriesgar que una `quantity` mal tipeada (un cero de más) congele el navegador construyendo miles de posiciones. Exceder cualquiera de los dos es un resultado explícito (`excessive_piece_count`/`excessive_sheet_count`) de `ImpositionLayoutResult`, nunca un cuelgue silencioso.

## Decisión tomada

### Geometría pura, cero dependencias de Canvas/PDF/Konva/UI
`imposition/` es un módulo nuevo, enteramente puro: `pieceFootprint.ts` (footprint físico de una pieza = su `BleedBox`, convertido a la unidad de la hoja), `sheetGeometry.ts` (área útil de la hoja tras aplicar márgenes), `gridCapacity.ts` (columnas/filas que caben, automático o fijo), `alignment.ts` (offset del bloque), `validateLayoutGeometry.ts` (invariantes geométricas), y `impositionLayout.ts` (`computeImpositionLayout`, la función central: orquesta las anteriores en un orden determinista obligatorio — hojas en orden, filas de arriba hacia abajo, columnas de izquierda a derecha, copias numeradas de forma estable vía `copyIndex` global — nunca un `Set`/`Map` sin orden garantizado).

### Reutilización de raster a escala real
`createPieceRasterCache` (`raster/pieceRasterCache.ts`) — cachea el `HTMLCanvasElement` rasterizado de una página de origen durante una única exportación (mismo ciclo de vida que `assetImageCache`, liberado en el `finally` del exportador). `exportImpositionToPdf`/`exportImpositionToPng` reutilizan ese único raster: en PDF, se embebe UNA sola vez (`PdfBackend.embedImage`) y se dibuja N veces (`addImposedSheetPage` recibe un array de `PlacedImage`, todas apuntando al mismo `embedded`); en PNG, se compone N veces sobre el canvas de cada hoja (`createBlankCanvas` + `drawImage` repetido).

### Exportación imposicionada — `exportImpositionToPdf`/`exportImpositionToPng`
Ambos exigen `printJob.imposition.mode === "grid"` (llamarlos con `"single"` es un error de programación del caller, no un caso de negocio — el caller ya sabe qué exportador usar según el modo, igual que `computeImpositionLayout`). Cada página de `printJob.pageIds` genera su **propio grupo de hojas independiente** (sección 24) — nunca mezcla diseños distintos en la misma hoja; sus hojas se concatenan en el mismo documento/colección en el orden de `pageIds`. `PdfBackend` gana una tercera operación (`addImposedSheetPage`, junto a `addRasterPage`/`save`) que recibe imágenes/marcas/cut paths ya posicionados en puntos PDF absolutos de la hoja — sigue sin exponer ningún tipo de `pdf-lib` en su firma.

### Numeración de archivos — `label: "page" | "sheet"`
`buildPrintFilename` (naming.ts) gana un parámetro opcional `label` (default `"page"`, compatibilidad total con Fases 9.1-9.3) — el PNG imposicionado numera sus archivos como `sheet-01`/`sheet-02` en vez de `page-01`/`page-02`, para que el nombre del archivo comunique correctamente qué representa cada uno (una hoja física con N copias, no "una página" del documento original).

### Preflight de imposición — 16 códigos nuevos
`preflight/impositionChecks.ts` — `checkImpositionConfig(printJob)` (validación escalar a nivel de job: gaps/márgenes finitos y no-negativos → `imposition_invalid`; gap más angosto que el stroke del cut path → `insufficient_gap`, advertencia) y `checkImpositionForPage(pageId, printJob, memoryBudgetBytes?)` (llama a `computeImpositionLayout` y traduce cada motivo de fallo `!ok` a un código Preflight del mismo nombre; luego geometría inválida de la propia `ImpositionLayout` — `piece_outside_sheet`/`crop_marks_overlap`/`cut_paths_overlap` — vía `mapImpositionLayoutGeometryIssues`, extraída como función independiente precisamente porque `computeImpositionLayout` nunca puede producir por construcción una `ImpositionLayout` inválida — solo es testable corrompiendo una manualmente; luego `sheet_memory_budget_exceeded` vía `estimateMemoryBytes` con `simultaneousPages: 1`; luego `partial_output_required`, informativo, cuando `lastSheetEmptyCells > 0`). Wireado en `runPreflight.ts`: config a nivel de job primero, luego por página en el orden de `pageIds`, antes del loop estructural heredado de Fase 9.1. Mismo patrón ya documentado en ADR-0022/0023: una vez wireado, el chequeo defensivo (`"imposition-does-not-fit"`, agregado a `PrintEngineErrorCode` como fallback) queda correctamente inalcanzable en el flujo normal — Preflight bloquea primero.

## Verificación en Chromium real
Los 19+ escenarios E2E de la UI de exportación (ver ADR-0025) ejercitan el flujo completo incluyendo Preflight de imposición real. El motor puro en sí se verifica exhaustivamente en `vitest` (unitarios de cada módulo de `imposition/`, integración de `exportImpositionToPdf.test.ts`/`exportImpositionToPng.test.ts`, y 29 tests dedicados de `impositionChecks.test.ts` cubriendo los 16 códigos).

### Performance a escala real (sección 38 del enunciado)
`raster/impositionPerformance.test.ts` — hoja 200×100mm / pieza 20×20mm / sin gaps/márgenes da una capacidad exacta y determinista (columnas=10, filas=5, capacidad=50/hoja); `quantity=500` → `sheetCount=10`; `quantity=100` → `sheetCount=2`. Verificado (no solo argumentado): `computeImpositionLayout` completa en <500ms con 500 piezas/10 hojas (geometría pura, sin cuadrático evidente); `exportImpositionToPdf`/`exportImpositionToPng` completos (mocks de render Konva, encoding real de pdf-lib/Canvas) completan en <10s; y — la garantía central de esta fase — `renderPageToStageMock` se llama **exactamente una vez** en ambos casos, confirmando la reutilización de raster a la escala real del requisito, no solo con 2-3 piezas de juguete como en los tests unitarios base.

**Fallo preexistente, no de esta fase**: `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando (confirmado corriendo la suite completa antes y después de todo el trabajo de esta fase) — sin relación con imposición; no investigado ni corregido aquí (ver Technical Debt).

## Consecuencias
- `@impulso/print-engine` sube a 0.4.0.
- Nuevo módulo `imposition/` (geometría pura: footprint, capacidad de grid, alineación, geometría de hoja, validación, y `computeImpositionLayout` como función central).
- Nuevos módulos de raster: `raster/pieceRasterCache.ts`, `raster/exportImpositionToPdf.ts`, `raster/exportImpositionToPng.ts`.
- `raster/composeCanvasOverlays.ts` gana `createBlankCanvas` (extraído, reutilizado por la composición de hojas imposicionadas y por `createMediaCanvasWithContent`).
- `naming.ts` gana el parámetro opcional `label`.
- `pdf/pdfBackend.ts` gana `addImposedSheetPage` (tercera operación pública, junto a `addRasterPage`/`save`).
- `preflight/impositionChecks.ts` (16 códigos nuevos) wireado en `runPreflight.ts`.
- `errors.ts` gana `"imposition-does-not-fit"` (fallback defensivo, correctamente inalcanzable en flujo normal).
- Ningún consumidor de Fases 9.1-9.3 cambia de comportamiento — todo lo anterior sigue operando exclusivamente bajo `imposition.mode === "single"`, sin ningún cambio de default.

## Riesgos
- **Sin nesting/optimización automática de desperdicio** — el grid es siempre rectangular uniforme; una pieza con mucho espacio negativo alrededor de su forma real desperdicia área de hoja. Documentado como decisión V1 explícita, no un descuido.
- **`fixed-grid` que no cabe bloquea con un error, nunca reduce en silencio** — un usuario que fije `rows`/`columns` mal deberá corregir el número él mismo; se prefirió la honestidad sobre la conveniencia de "adivinar" lo que sí cabría.
- **Marcas `"per-sheet"` son un contorno de producción, no una guía de corte por pieza** — riesgo de confusión de producto si la UI no lo aclara con suficiente énfasis (ver ADR-0025, UX Audit 0008).
- **Límites de producto (200 hojas / 2000 piezas) son heurísticos**, basados en el rango medido, no en una medición de memoria real de dispositivos de usuarios — revisar en Fase 9.5 si la evidencia real lo justifica.

## Compatibilidad futura
- Un futuro modo `"nesting"` de `ImpositionSpec` podría sumarse a la discriminated union sin romper `"single"`/`"grid"` existentes.
- Fase 9.5 (Hardening & Golden Tests) es el momento natural para revisar los límites de producto (200/2000) con evidencia empírica de dispositivos reales, y para sumar golden fixtures de imposición al conjunto ya existente de `testUtils/goldenFixtures.ts`.
