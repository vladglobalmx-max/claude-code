# Matriz de trazabilidad — Epic 9 (Professional Print Engine)

> Creada en Fase 9.5 (Hardening & Golden Tests), sección 2 del enunciado de esta fase. Cubre requisito → implementación → tests → documentación → estado, para cada capacidad del Print Engine construida en Fases 9.1-9.4. **Regla de honestidad**: un requisito nunca se marca `complete` si solo existe el tipo/la interfaz pero no funciona de extremo a extremo con evidencia real (test que lo ejercita, no solo que compila).

**Estados posibles**: `complete` (funciona de extremo a extremo, con test y documentación real) · `partially-supported` (funciona para el caso común, con una limitación honesta y documentada para el resto) · `intentionally-deferred` (decisión de producto explícita de no construirlo todavía, documentada) · `not-supported` (fuera de alcance declarado de la épica) · `failed` (se intentó y no funciona / regresión conocida sin corregir).

---

## Motor (`packages/print-engine`)

| Requisito | Implementación | Tests | Documentación | Estado |
|---|---|---|---|---|
| `PrintJob` (modelo versionado, efímero) | `printJob.ts` (`createPrintJob`), `types.ts` | `printJob.test.ts` (10) | ADR-0021 | `complete` |
| Unidades físicas (mm/in/px canónico/puntos PDF/PPI) | `units.ts` (`toPixels`/`physicalToPixels`/`unitToPoints`/`convertUnit`) | `units.test.ts` (19) | ADR-0021 §"El modelo de coordenadas" | `complete` |
| Boxes físicas (Trim/Bleed/Media/Crop/SafeArea) | `boxes.ts` (`computeBoxes`), `pdf/pageBoxes.ts` (`computePdfPageBoxes`) | `boxes.test.ts` (18), `pdf/pageBoxes.test.ts` (8) | ADR-0021/0023 | `complete` |
| PDF aplanado (single) | `raster/exportPrintJobToPdf.ts` | `exportPrintJobToPdf.test.ts` (22) | ADR-0022 | `complete` |
| PNG físico multipágina (single) | `raster/exportPrintJobToPng.ts` | `exportPrintJobToPng.test.ts` (16) | ADR-0022 | `complete` |
| PDF imposicionado | `raster/exportImpositionToPdf.ts` | `exportImpositionToPdf.test.ts` (18) | ADR-0024 | `complete` |
| PNG imposicionado | `raster/exportImpositionToPng.ts` | `exportImpositionToPng.test.ts` (15) | ADR-0024 | `complete` |
| Multipágina (orden estable, N páginas) | `renderPrintJob.ts` (generador async) | `renderPrintJob.test.ts` (10), fixture `goldenMultiPage` | ADR-0022 | `complete` |
| Bleed (simétrico y asimétrico) | `boxes.ts` | fixture `goldenForAsymmetricBleed`, `boxes.test.ts` | ADR-0021 | `complete` |
| Safe Area (ayuda de preview, nunca en el archivo) | `safearea/safeAreaRect.ts`/`safeAreaCheck.ts` | `safeAreaRect.test.ts` (4), `safeAreaCheck.test.ts` (10) | ADR-0023 | `complete` (falsos positivos conservadores documentados como comportamiento esperado, no bug) |
| Crop marks vectoriales | `marks/cropMarksGeometry.ts` | `cropMarksGeometry.test.ts` (10) | ADR-0023 | `complete` |
| Cut paths — Rectangle/Ellipse (offset exacto) | `cutpath/cutGeometry.ts`/`cutGeometryOffset.ts` | `cutGeometry.test.ts` (11), `cutGeometryOffset.test.ts` (8) | ADR-0023 | `complete` |
| Cut paths — Path cerrado arbitrario, offset ≠ 0 | `cutpath/cutGeometryOffset.ts` (`"unsupported"` honesto) | `cutGeometryOffset.test.ts` | ADR-0023, Technical Debt | `intentionally-deferred` (sin dependencia de offset de curvas, decisión explícita) |
| Kiss-cut / Die-cut (V1 semántico) | `types.ts` (`CutPathSpec.mode`, `logicalLayerName`) | `cutPathChecks.test.ts` | ADR-0023 | `complete` (para lo que promete: metadata/color/semántica) |
| Optional Content Group (OCG) real | — no implementado | — | ADR-0023, Technical Debt | `intentionally-deferred` |
| Imposición — grid automático/fijo | `imposition/impositionLayout.ts` y módulos hermanos | `impositionLayout.test.ts` (19) + 5 archivos más de `imposition/` | ADR-0024 | `complete` |
| Imposición — nesting irregular | — no implementado | — | ADR-0024, Technical Debt | `intentionally-deferred` (fuera de alcance de Epic 9 explícito) |
| Reutilización de raster (1 render por pieza) | `raster/pieceRasterCache.ts` | `pieceRasterCache.test.ts` (6), `impositionPerformance.test.ts` | ADR-0024 | `complete` (verificado a escala real: 500 piezas/10 hojas, 1 render) |
| Perfiles de impresión (motor) | `profiles.ts` (`PRINT_PROFILES`, 4 perfiles) | cubiertos indirectamente vía `createPrintJob`/exportadores | ADR-0025 (enmienda Fase 9.5) | `complete` |
| Preflight — 44 códigos totales | `preflight/*Checks.ts`, `runPreflight.ts` | 1 archivo de test por familia (ver detalle abajo) | ADR-0021/0023/0024 | `complete` (wireado y cubierto; tabla formal código-por-código pendiente, ver Pendientes) |
| Resolución/PPI (`targetPpi`/`warnBelowPpi`) | `types.ts`, `preflight/runPreflight.ts` (`resolution_insufficient`/`resolution_borderline`) | `runPreflight.test.ts` (37) | ADR-0021 | `complete` |
| Verificación de fuentes | `preflight/fonts.ts` (`browserFontChecker`) | `fonts` cubierto dentro de `runPreflight.test.ts` | ADR-0021/0022 | `partially-supported` — `document.fonts.check()` es una señal más débil de lo esperado (confirmado: `true` incluso para una fuente inventada en Chromium real); el chequeo existe y funciona según el contrato de la API del navegador, pero esa API misma es limitada (documentado, no oculto) |
| Cancelación (`AbortSignal`) | Puntos `throwIfAborted` en todo el pipeline | Tests dedicados en `exportPrintJobToPdf.test.ts`/`exportImpositionToPdf.test.ts` (escenarios de cancelación) | ADR-0022 | `complete` (endurecimiento exhaustivo de TODOS los puntos cooperativos es tarea de hardening pendiente, ver Pendientes) |
| Progreso (`onProgress`, etapas) | `progress.ts` (`emitProgress`) | Cubierto en tests de exportadores | ADR-0022 | `complete` |
| Naming determinista de archivos | `naming.ts` (`buildPrintFilename`, param `label`) | `naming.test.ts` (11) | ADR-0022/0024 | `complete` |
| Presupuesto de memoria (estimación) | `memory.ts` (`estimateMemoryBytes`) | `memory.test.ts` (12) | ADR-0021/0022 | `partially-supported` — el modelo (factor 2.5x, umbrales) nunca se midió empíricamente contra dispositivos/navegadores reales de usuarios |
| Determinismo de exportación (bytes/estructura estables entre corridas) | — (las funciones son puras por construcción, pero nunca se verificó con un test de repetición) | — no existe todavía un test de "exportar N veces, comparar" | — | `partially-supported` — determinismo estructural por diseño (sin estado global, sin `Math.random`/`Date.now()` no inyectado), pero sin verificación empírica repetida todavía (ver Pendientes) |
| Golden fixtures (documentos canónicos) | `testUtils/goldenFixtures.ts` — 10 de 10 (Fase 9.5 agregó Circular Sticker, Closed Path Sticker, Sticker Sheet, Font Fallback disponible/no-disponible, 3 Failure Cases) | `goldenFixtures.test.ts` (13) | ADR-0022 | `complete` |
| Golden outputs (PNG hash/PDF estructura, con tolerancia) | — no existe infraestructura dedicada todavía | — | — | `not-supported` todavía (ver Pendientes — sección 3/4 del enunciado de Fase 9.5) |
| Regresión visual (diff con umbral/artefactos) | — no existe todavía | — | — | `not-supported` todavía (ver Pendientes) |
| Property-based / generative tests | — no existen todavía | — | — | `not-supported` todavía (ver Pendientes) |

## Producto (`apps/sticker-builder`)

| Requisito | Implementación | Tests | Documentación | Estado |
|---|---|---|---|---|
| Wizard de 7 pasos "Exportar para impresión" | `productionExportDialog.ts` | `productionExportDialog.test.ts` (13) | ADR-0025 | `complete` |
| Controller de estado (snapshot inmutable, invalidación) | `productionExportController.ts` | `productionExportController.test.ts` (20) | ADR-0025 | `complete` |
| Production Preview (real, data-driven) | `productionPreview.ts` | `productionPreview.test.ts` (16) | ADR-0025, UX Audit 0007 | `complete` |
| Selector de perfiles en el wizard | `productionExportDialog.ts` (`WIZARD_PROFILE_IDS`) | `productionExportDialog.test.ts` (3 tests nuevos, Fase 9.5) | ADR-0025 (enmienda Fase 9.5) | `complete` (3 de 4 perfiles expuestos; "Web Preview" `intentionally-deferred`, ver ADR) |
| Nombre de archivo editable | — no existe | — | UX Audit 0008, UX Backlog | `intentionally-deferred` |
| Localización de issues de Preflight en el preview | — no existe | — | UX Audit 0008, UX Backlog | `intentionally-deferred` |
| UI de asignación de die-line en el Inspector | — no existe | — | UX Audit 0008, Technical Debt | `intentionally-deferred` (brecha general del editor, no de esta fase) |
| Accesibilidad (foco atrapado, ARIA, teclado) | `productionExportDialog.ts` | `e2e/production-export.spec.ts` (varios escenarios) | ADR-0025 | `partially-supported` — lo verificado (foco atrapado, `aria-live`, navegación por teclado en los flujos principales) funciona; una pasada formal de auditoría (tab order exhaustivo, anuncios, diálogos anidados) es hardening pendiente (ver Pendientes) |
| Responsive | `index.html`/`productionExportDialog.ts` | `e2e/production-export.spec.ts` (4 viewports) | ADR-0025 | `partially-supported` — verificado en 1366×768/1440×900/1920×1080/360×740; faltan 1024×768 y un ancho de tablet explícito (ver Pendientes) |
| Descargas (PDF único, PNG múltiple) | `triggerBrowserDownload` (`@impulso/export-engine`) | Cubierto en `productionExportDialog.test.ts`/E2E | ADR-0025 | `complete` para el caso básico; "Descargar todos" (ZIP) `not-supported` (no evaluado como necesidad real todavía) |
| Cross-browser (Firefox/WebKit) | — solo Chromium hoy | — | — | `not-supported` todavía (ver Pendientes) |

---

## Pendientes de esta fase (no bloquean el resto del hardening, pero deben resolverse antes del cierre de Epic 9)

1. Tabla formal código-por-código de los 44 códigos de Preflight (severidad/trigger/blocking/recommendation/test/UI handling).
2. Endurecimiento exhaustivo de cancelación en TODOS los puntos cooperativos (tabla de verificación, no solo cobertura general).
3. Test de determinismo empírico (N exportaciones repetidas del mismo fixture, comparación estructural + visual).
5. Infraestructura de golden outputs + regresión visual + normalización.
6. Property-based/generative tests con seed fija.
7. Medición empírica de memoria/performance con datos observados (actualizar `PERFORMANCE_BUDGET.md`).
8. Auditoría formal de accesibilidad (más allá de los escenarios ya verificados) + viewports adicionales (1024×768, tablet).
9. Smoke cross-browser (Firefox/WebKit) si el entorno lo permite.
10. UX Audit 0009 (validación final).

## Cómo se usa este documento

Se actualiza cada vez que un ítem de la lista de Pendientes se resuelve — cambiar su estado en la tabla correspondiente y mover la entrada fuera de la lista de Pendientes. Es la fuente de verdad de "qué realmente funciona de extremo a extremo" para el reporte ejecutivo final de Fase 9.5 — ningún ítem marcado `partially-supported`/`not-supported` aquí puede describirse como `complete` en ese reporte.
