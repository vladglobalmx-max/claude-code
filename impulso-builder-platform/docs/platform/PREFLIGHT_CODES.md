# Tabla de códigos de Preflight — Epic 9 (Professional Print Engine)

> Fase 9.5 (Hardening & Golden Tests), sección "Preflight hardening" del enunciado — tabla formal código-por-código de los 44 códigos de `PreflightCode` (`packages/print-engine/src/preflight/types.ts:13-61`), pedida como Pendiente #1 en `TRACEABILITY_MATRIX_EPIC9.md`. Fuente de verdad de "qué dispara cada código, si bloquea, y cómo se prueba" — si un código cambia de comportamiento, esta tabla se actualiza en el mismo commit.

## Manejo en UI (aplica a los 44 códigos por igual — no hay ramas específicas por código)

`productionExportDialog.ts` (`renderIssues()`) renderiza **todos** los issues agrupados solo por `severity` (error/warning/info) — nunca por `code` individual. Cada `PreflightIssue` se muestra como `${message} ${recommendation}`. Confirmado por búsqueda exhaustiva: no existe ningún `issue.code === "..."` en `productionExportDialog.ts` ni en `productionPreview.ts`. Esto es una decisión de diseño explícita (sección 36 del enunciado de Fase 9.4: "el motivo se muestra en texto, no solo color") — cada código es responsable de traer su propio `message`/`recommendation` accionable en texto plano, no de tener una UI dedicada. La tabla de abajo, por lo tanto, omite una columna "UI" redundante y en su lugar confirma que el texto de cada código es autoexplicativo.

**Severidad → bloqueo**: `error` siempre bloquea (`hasBlockingErrors: true`); `warning` requiere aceptación explícita en el paso "Advertencias" antes de exportar; `info` nunca bloquea ni requiere aceptación.

## Fundacionales (Fase 9.1)

| # | Código | Severidad | Bloquea | Disparador | Recomendación mostrada | Test |
|---|---|---|---|---|---|---|
| 1 | `document_not_normalized` | error | sí | `ProjectSchema.safeParse` falla | "Abre y vuelve a guardar el proyecto..." | `runPreflight.test.ts` |
| 2 | `page_not_found` | error | sí | un `pageId` de `printJob.pageIds` ya no existe en `document.pages` | "Quita esa página del Print Job..." | `runPreflight.test.ts` |
| 3 | `invalid_dimensions` | error | sí | `printJob.dimensions` no finito o ≤0 | "Corrige el ancho/alto..." | `runPreflight.test.ts` |
| 4 | `invalid_bleed` | error | sí | algún lado de `printJob.bleed` no finito o negativo | "Corrige el valor de sangrado..." | `runPreflight.test.ts` |
| 5 | `empty_page` | warning | no | página sin ningún object visible | "Confirma que sea intencional..." | `runPreflight.test.ts` |
| 6 | `extreme_scale` | error (si no finito/≤0) o warning (si <0.01 o >100) | solo la rama error | `printJob.scale` fuera de rango | "Corrige la escala..." / "Verifica el valor de escala..." | `runPreflight.test.ts` |
| 7 | `raster_too_large` | error | sí | `estimateMemoryBytes(...).withinBudget === false` | "Reduce la resolución objetivo o exporta por páginas separadas." | `runPreflight.test.ts` |
| 8 | `asset_reference_missing` | error | sí | `ImageObject.assetId` no existe en `document.assets` | "Reemplaza la imagen o elimina el object..." | `runPreflight.test.ts` |
| 9 | `asset_binary_missing` | error | sí | `resolver.resolve(assetId)` devuelve `undefined` **o rechaza** (Fase 9.5: antes un rechazo se propagaba crudo, ver CHANGELOG) | "Vuelve a subir la imagen..." | `runPreflight.test.ts` (incl. regresión de resolver que rechaza) |
| 10 | `resolution_insufficient` | warning | no | PPI efectivo < 50% de `warnBelowPpi` | "Usa una imagen de mayor resolución..." | `runPreflight.test.ts` |
| 11 | `resolution_borderline` | info | no | PPI efectivo < `warnBelowPpi` pero ≥ 50% de él | "Usa una imagen de mayor resolución..." | `runPreflight.test.ts` |
| 12 | `font_unavailable` | warning | no | `fontChecker.check(fontFamily) === "unavailable"` | "Revisa el preview visual..., o cambia la fuente..." | `runPreflight.test.ts` |
| 13 | `font_verification_uncertain` | info | no | `fontChecker.check(...) === "verification-uncertain"` (señal débil documentada de `document.fonts.check()`, ver matriz) | "Revisa el preview visual..." | `runPreflight.test.ts` |

## Crop marks (Fase 9.3)

| # | Código | Severidad | Bloquea | Disparador | Recomendación mostrada | Test |
|---|---|---|---|---|---|---|
| 14 | `crop_marks_invalid` | error | sí | `cropMarks.length`/`strokeWidth`/`offset`/`color` inválidos (4 checks distintos, mismo código) | "Corrige [el valor] de las marcas de corte..." | `cropMarksChecks.test.ts` |
| 15 | `crop_marks_outside_media_box` | error | sí | **defensivo** — geometría calculada cae fuera del MediaBox (matemáticamente inalcanzable con config válida) | "Reporta este problema — inconsistencia interna." | `cropMarksChecks.test.ts` (Fase 9.5: corrompiendo `computeCropMarksGeometry`, antes SIN cobertura) |
| 16 | `crop_marks_overlap_trim` | error | sí | **defensivo** — geometría calculada invade el TrimBox (igual, inalcanzable con config válida) | "Reporta este problema — inconsistencia interna." | `cropMarksChecks.test.ts` (Fase 9.5, mismo fix de cobertura) |
| 17 | `insufficient_mark_space` | error | sí | **defensivo** — `computeBoxes` produce un MediaBox más chico que el BleedBox (inalcanzable: `checkCropMarksConfig` ya garantiza `length>0`) | "Revisa la configuración de longitud/separación..." | `cropMarksChecks.test.ts` (Fase 9.5, mismo fix de cobertura) |

## Safe area (Fase 9.3)

| # | Código | Severidad | Bloquea | Disparador | Recomendación mostrada | Test |
|---|---|---|---|---|---|---|
| 18 | `safe_area_invalid` | error | sí | `safeArea.margin` inválido cuando `enabled` | — | `safeAreaChecks.test.ts` |
| 19 | `object_crosses_safe_area` | warning | no | un object invade el margen de safe area — **deliberadamente no bloquea** (sección 9: falsos positivos conservadores son comportamiento esperado, ver matriz) | — | `safeAreaChecks.test.ts` |

## Cut path (Fase 9.3)

| # | Código | Severidad | Bloquea | Disparador | Test |
|---|---|---|---|---|---|
| 20 | `cut_path_missing` | error | sí | `cutPath.mode !== "none"` y ningún object candidato encontrado | `cutPathChecks.test.ts` |
| 21 | `cut_path_multiple_candidates` | error | sí | más de un object candidato a die-line, ambiguo | `cutPathChecks.test.ts` |
| 22 | `cut_path_unsupported_object` | error | sí | el object candidato no es un tipo soportado como die-line | `cutPathChecks.test.ts` |
| 23 | `cut_path_open` | error | sí | el `PathObject` candidato no está cerrado | `cutPathChecks.test.ts` |
| 24 | `cut_path_transform_unsupported` | error | sí | transform del die-line no representable de forma exacta (ej. skew) | `cutPathChecks.test.ts` |
| 25 | `cut_path_invalid_geometry` | error | sí | geometría del die-line degenerada (tamaño 0, NaN) | `cutPathChecks.test.ts` |
| 26 | `cut_path_offset_unsupported` | **error o warning** — depende de `printJob.offsetUnsupportedPolicy` (`"block"` → error, `"warn"` → warning) | condicional | offset ≠0 sobre un `PathObject` cerrado (sin dependencia de offset de curvas, decisión explícita, ver Technical Debt) | `cutPathChecks.test.ts` |
| 27 | `cut_path_collapsed` | error | sí | el offset aplicado colapsa la geometría a área ~0 | `cutPathChecks.test.ts` |
| 28 | `cut_path_outside_media_box` | warning | no | el cut path calculado cae fuera del MediaBox | `cutPathChecks.test.ts` |

## Imposición (Fase 9.4)

| # | Código | Severidad | Bloquea | Disparador | Test |
|---|---|---|---|---|---|
| 29 | `imposition_invalid` | error | sí | `gapX`/`gapY`/algún margen no finito o negativo | `impositionChecks.test.ts` |
| 30 | `sheet_size_invalid` | error | sí | `imposition.sheet.width`/`height` ≤0 | `impositionChecks.test.ts` |
| 31 | `sheet_area_collapsed` | error | sí | márgenes que colapsan el área útil de la hoja a 0 | `impositionChecks.test.ts` |
| 32 | `quantity_invalid` | error | sí | `imposition.quantity` no entero o ≤0 | `impositionChecks.test.ts` |
| 33 | `grid_rows_invalid` | error | sí | `placementMode: "fixed-grid"` sin `rows` | `impositionChecks.test.ts` |
| 34 | `grid_columns_invalid` | error | sí | `placementMode: "fixed-grid"` sin `columns` | `impositionChecks.test.ts` |
| 35 | `piece_does_not_fit` | error | sí | la pieza es más grande que el área útil de la hoja | `impositionChecks.test.ts` |
| 36 | `fixed_grid_does_not_fit` | error | sí | `rows × columns` pedidos no caben en el área útil | `impositionChecks.test.ts` |
| 37 | `insufficient_gap` | warning | no | el gap configurado es más angosto que el grosor del cut path | `impositionChecks.test.ts` |
| 38 | `excessive_sheet_count` | error | sí | `sheetCount` calculado excede `MAX_IMPOSITION_SHEETS` (límite de producto, ver ADR-0024) | `impositionChecks.test.ts` |
| 39 | `excessive_piece_count` | error | sí | `quantity` excede `MAX_IMPOSITION_PIECES` | `impositionChecks.test.ts` |
| 40 | `sheet_memory_budget_exceeded` | error | sí | el raster de la hoja completa excede el presupuesto de memoria | `impositionChecks.test.ts` |
| 41 | `cut_paths_overlap` | error | sí | **defensivo** — layout corrompido con cut paths solapados (inalcanzable con `computeImpositionLayout` real) | `impositionChecks.test.ts` ("layout corrompido manualmente") |
| 42 | `crop_marks_overlap` | error | sí | **defensivo** — layout corrompido con marcas solapadas (igual, inalcanzable) | `impositionChecks.test.ts` |
| 43 | `piece_outside_sheet` | error | sí | **defensivo** — layout corrompido con una pieza fuera de la hoja (igual, inalcanzable) | `impositionChecks.test.ts` |
| 44 | `partial_output_required` | info | no | la última hoja queda parcialmente ocupada (esperado, no un error) | `impositionChecks.test.ts` |

**Nota sobre #30-36 y #38-39** (`sheet_size_invalid`/`sheet_area_collapsed`/`quantity_invalid`/`grid_rows_invalid`/`grid_columns_invalid`/`piece_does_not_fit`/`fixed_grid_does_not_fit`/`excessive_sheet_count`/`excessive_piece_count`): las 9 se generan a través de una única rama genérica en `checkImpositionForPage` (`impositionChecks.ts:151-165`, `code: result.reason`) — el `code` de cada `PreflightIssue` SÍ es específico y programáticamente distinguible, pero el `message`/`recommendation` mostrado al usuario es el mismo texto genérico ("La imposición de esta página no es válida... Revisa el tamaño de hoja, la cantidad, los márgenes/gaps y el modo de colocación") para las 9. **Decisión evaluada y mantenida en esta fase**: dado que las 9 comparten el mismo camino de arreglo real (ajustar la configuración de imposición en el paso "config" del wizard), un mensaje específico por código no aportaría una acción distinta — se documenta aquí explícitamente en vez de tratarlo como un gap silencioso.

## Resumen de cobertura de tests (Fase 9.5)

- **44/44 códigos tienen al menos un test que los dispara** — confirmado exhaustivamente en esta fase.
- 3 códigos (#15-17, crop marks) y 3 códigos (#41-43, imposición) son **defensivos** — matemática/estructuralmente inalcanzables a través de cualquier `PrintJob`/`Project` válido construido por la UI real; se prueban corrompiendo deliberadamente el resultado de una dependencia interna (mismo patrón para ambos grupos, ya establecido antes de esta fase para el grupo de imposición y extendido en esta fase al grupo de crop marks).
- 1 código (#26, `cut_path_offset_unsupported`) tiene severidad condicional real (depende de `offsetUnsupportedPolicy`) — ambas ramas están cubiertas.
- 1 código (#6, `extreme_scale`) tiene dos triggers con severidades distintas — ambos cubiertos.

## Cómo se usa este documento

Se actualiza en el mismo commit que cualquier cambio a `PreflightCode`, a cualquier `severity`/condición de bloqueo, o a la cobertura de tests de un código. Es la fuente de verdad citada por `TRACEABILITY_MATRIX_EPIC9.md` para la fila "Preflight — 44 códigos totales".
