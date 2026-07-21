# Changelog — @impulso/sticker-builder

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.16.0] — Epic 9 / Fase 9.5: Hardening del wizard de exportación

Endurecimiento del flujo "Exportar para impresión" construido en Fase 9.4 — sin funciones nuevas fuera de hardening. Detalle completo (incluida la parte de `@impulso/print-engine`) en `packages/print-engine/CHANGELOG.md` [0.5.0]; resumen de lo que toca a esta app:

### Corregido (bugs reales)
- `productionExportController.ts`: `startExport()` no despachaba a los exportadores de página única (`exportPrintJobToPdf`/`Png`) para los perfiles sin imposición (Digital PNG/Print PDF) — el wizard quedaba colgado en "Preparando…" sin producir ningún archivo. Corregido despachando según `imposition.mode`.
- `productionExportDialog.ts`: el auto-avance del paso "warnings" (sin advertencias) nunca disparaba `startExport()` — mismo síntoma. Corregido.
- `productionExportDialog.ts`: un `Shift+Tab` justo después de cualquier cambio de paso (foco en el `<h2>`, `tabIndex=-1`) podía escapar el foco atrapado del diálogo. Corregido.
- `index.html`: `min-width: 0` agregado preventivamente a `.production-export-body fieldset` (mismo footgun ya corregido en `.inspector-section`).

### Verificado (Chromium real, sin mocks)
- Performance/memoria/resource-leaks: `e2e/production-export-hardening.spec.ts` (4 tests) — ciclo completo con 200 copias imposicionadas, heap observado, object URLs/canvases balanceados tras ciclos repetidos de éxito y cancelación.
- Los 3 perfiles del wizard (Digital PNG/Print PDF/Sticker Sheet) confirmados funcionando extremo a extremo hasta una descarga real.
- Accesibilidad: controles de la Production Preview 100% operables por teclado; foco tras "Cerrar" restaura al trigger.
- Responsive: 1024×768 y 810×1080 (tablet) agregados, sin overflow horizontal.
- Descargas: filename Unicode/emoji, descargas múltiples/repetidas sin interferencia.

### Documentación nueva
- `docs/platform/TRACEABILITY_MATRIX_EPIC9.md`: matriz completa de toda la Épica 9.
- `docs/platform/PREFLIGHT_CODES.md`: tabla formal de los 44 códigos de Preflight.
- ADR-0025: 2da enmienda documentando el bug de dispatch y su corrección.

## [0.15.0] — Epic 9 / Fase 9.4: Production Export Workflow (producto real)

### Agregado
- `productionPreview.ts`: Production Preview real, data-driven — reutiliza exactamente `computeImpositionLayout`/`renderPrintPage`/`computeCropMarksGeometry`/`resolveDieLineSource`+`normalizeCutGeometry`+`applyCutGeometryOffset`+`cutGeometryToPathSegments`/`cropMarkSegmentToRaster`/`canonicalPointToRasterPoint`/`cutPathSegmentsToRaster` de `@impulso/print-engine`, nunca una reimplementación aproximada. Renderiza a `PREVIEW_PPI = 72` (deliberadamente menor al `targetPpi` real), navega entre hojas/páginas, toggles de overlay (Sheet/Useful Area/Footprint/Trim/SafeArea/CropMarks/CutPath) diferenciados por `stroke-dasharray` además de color, resumen textual (`<dl>`) con disclaimer de PPI y el `message` de Preflight, zoom Fit/100%/slider.
- `productionExportController.ts`: `mountProductionExportController(options): ProductionExportController` — mismo patrón factory que `ProjectSaveCoordinator` (Epic 8). Dueño del estado del wizard de 7 pasos (`ExportStep`), foto inmutable de `Project`/`PrintJob` tomada en `open()` (`structuredClone`, nunca una lectura en vivo), `projectStale`/`refreshSnapshot` para cambios del `Project` en curso, invalidación de Preflight ante cualquier `updatePrintJob`, aceptación de advertencias por ejecución (nunca recordada), cancelación real vía `AbortController` propagado a `exportImpositionToPdf`/`Png`.
- `productionExportDialog.ts`: UI del wizard "Exportar para impresión" (perfil → configuración → preview → preflight → advertencias → progreso → resultados). Foco atrapado real (modelado sobre `unsavedChangesDialog.ts`), `role="dialog"`/`aria-modal="true"`/`aria-labelledby` apuntando al `<h2 tabIndex="-1">` de cada paso (foco movido ahí en cada cambio de paso), región de progreso `aria-live="polite"`/`role="status"`, issues de Preflight agrupados por severidad con encabezados de texto usando `issue.message`/`issue.recommendation` (nunca el `code` crudo), paso de advertencias auto-saltado cuando no hay ninguna, descargas por formato vía `triggerBrowserDownload(blob, filename)`, banner de staleness del proyecto.
- Nuevo punto de entrada de UI: `#production-export-btn` ("Exportar para impresión") en `index.html`, distinto de `#export-btn` ("Exportar", exportación rápida a pantalla, sin cambios); wireado en `app.ts`/`main.ts`, `AppElements` extendido, `productionExportDialog.destroy()` agregado a la limpieza de la app.
- `e2e/production-export.spec.ts`: 19 escenarios reales en Chromium, sin mocks — `role="dialog"`/`aria-modal`/título por paso; `Escape` cierra y restaura el foco; `Tab` nunca escapa del diálogo (foco atrapado real); el foco se mueve al `<h2>` de cada paso nuevo; Preflight bloquea "Siguiente" con el motivo en texto; layout responsivo sin overflow horizontal en 1366×768/1440×900/1920×1080/360×740; preview renderiza un canvas real; "Atrás" deshabilitado en el primer paso; "Cancelar" cierra desde cualquier paso; reapertura limpia tras cerrar; navegación completamente por teclado; `aria-live="polite"` verificado; errores de Preflight distinguidos por texto.
- `@impulso/print-engine` se mueve de `devDependencies` a `dependencies` — código de producto (no solo un harness de verificación) lo importa directamente por primera vez.
- [ADR-0025](../../docs/adr/0025-production-export-workflow.md): documenta la arquitectura de 3 piezas (preview/controller/dialog) y sus límites honestos.
- [UX Audit 0008](../../docs/ux-audits/0008-production-export-experience-fase-9-4.md): auditoría del flujo real construido en esta fase, con autocrítica explícita de sus limitaciones (nombre de archivo no editable, sin localización de issues en el preview, configuración avanzada parcial, un solo perfil, sin UI de asignación de die-line, "Ajustar" sin fallback visible).

### Corregido (bug real encontrado durante esta fase)
- `ProductionExportController.close()` no reseteaba `step` de vuelta a `"profile"` — reabrir el diálogo tras cancelar desde un paso intermedio mostraba el título obsoleto de ese paso con un `printJob` ya vacío. Detectado con un test real en Chromium (E2E de reapertura tras cancelar), corregido reseteando `step` explícitamente en `close()`, con una regresión equivalente agregada a `productionExportController.test.ts`.

### Hallazgo documentado (no es un bug de esta fase)
- `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando — confirmado sin relación con el flujo de exportación (corrido antes y después de todo el trabajo de esta fase); no investigado ni corregido aquí, ver Technical Debt.

### Fuera de alcance (deliberado — fases futuras, cada una con su propia autorización)
Nombre de archivo editable, localización de issues de Preflight en el preview, márgenes/cut path/PPI editables desde el wizard, múltiples perfiles imposicionables, UI de asignación de die-line en el Inspector, persistencia de un `PrintJob` como preset reutilizable, Fase 9.5 (Hardening & Golden Tests).

## [0.14.0] — Epic 9 / Fase 9.3: Print Engine — Marks, Safe Area & Cut Paths (verificación, no producto)

### Agregado
- `printEngineHarness.ts`: 15 escenarios nuevos (sección 29 del enunciado de Fase 9.3) sumados a los 12 de Fase 9.2 — 27 en total, mismo harness (`print-engine-harness.html`, `e2e/print-engine.spec.ts`), sin ningún mock. Cubren: `MediaBox` > `TrimBox` con marcas reales; marcas que nunca invaden el trim (lectura de píxeles real); Safe Area byte-idéntica al archivo final; die-line Ellipse; die-line ausente del raster aplanado (lectura de píxeles); cut path como vector real en el content stream del PDF; PNG incluye/excluye el cut path según configuración; path abierto y múltiples die-lines bloquean con el código exacto; offset de Rectangle preserva dimensiones físicas exactas; offset no soportado sobre Path genera el warning esperado; multipágina preserva overlays independientes por página; inmutabilidad/sin dirty-state con overlays activos; cancelación durante la composición de overlays limpia igual que antes.
- `print-preview-harness.html` + `src/printPreviewHarness.ts` + `e2e/print-preview.spec.ts` — segundo harness **temporal**, no de producto: preview técnico mínimo que renderiza contenido real y compone los 6 overlays (MediaBox/BleedBox/TrimBox/Safe Area/Crop Marks/Cut Path) reutilizando exactamente las mismas funciones puras públicas que los exportadores — nunca una reimplementación aproximada. Toggles por capa accesibles (`label`+`aria-controls`), resumen textual equivalente al canvas (marcado `aria-hidden`), zoom puramente visual vía CSS. 4 tests E2E.
- `vite.config.ts`: tercera entrada de build (`rollupOptions.input.printPreviewHarness`) — ninguna pantalla del producto navega a ella.

### Corregido
- Dos escenarios de verificación (no de producción) tenían asunciones/cálculos rotos, detectados al correr la suite completa en un navegador real: el escenario de sangrado de Fase 9.2 asumía que el pixel `(0,0)` del PNG era la esquina del `BleedBox` (asunción rota por el nuevo default de marcas activas en "print-pdf" — corregido desactivando marcas explícitamente, isolando el intento original del test); un escenario nuevo de cut path en PNG tenía un cálculo de píxel incompleto (corregido replicando la fórmula exacta de `canonicalPointToRasterPoint`).

### Hallazgo documentado (no es un bug de esta fase)
- `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando — confirmado corriendo la suite E2E completa antes y después de todo el trabajo de esta fase; sin relación con marcas/safe area/cut paths, no investigado ni corregido aquí (ver Technical Debt).

### Nota
Ningún flujo de usuario de este app cambió — Epic 9 / Fase 9.3 no toca ninguna pantalla existente. Ambos harnesses son código de verificación temporal, explícitamente documentados como tal en el propio HTML/TS y en ADR-0023.

## [0.13.0] — Epic 9 / Fase 9.2: Print Engine — Raster Pipeline & PDF Backend (verificación, no producto)

### Agregado
- `print-engine-harness.html` + `src/printEngineHarness.ts` + `e2e/print-engine.spec.ts` — harness **temporal**, no de producto: ejercita en Chromium real, sin ningún mock (Konva real, Canvas/Image reales, `pdf-lib` real), el pipeline completo de `@impulso/print-engine` recién construido (`renderPrintJob`/`exportPrintJobToPng`/`exportPrintJobToPdf`). 12 escenarios (sección 21 del enunciado de Fase 9.2): dimensiones exactas de PNG a 300 PPI, tamaño físico correcto de PDF/A4, conteo de páginas multipágina, geometría real de sangrado, fondo sólido/transparencia real, cancelación sin archivo entregado, presupuesto de memoria bloqueante, verificación de fuentes, Assets faltantes nunca sustituidos silenciosamente, inmutabilidad del Project, ausencia de dirty-state al exportar.
- `vite.config.ts`: segunda entrada de build (`rollupOptions.input.printEngineHarness`) — ninguna pantalla del producto navega a ella; se retira o se transforma en la UI real de exportación durante Fase 9.4.
- `@impulso/print-engine`/`pdf-lib` agregados como `devDependencies` — exclusivamente para este harness; ningún código de producto de esta app importa todavía `@impulso/print-engine`.
- **Hallazgo real confirmado durante esta verificación**: `document.fonts.check()` devuelve siempre `true` en el Chromium usado, incluso para un nombre de fuente inventado — documentado en el CHANGELOG/README de `print-engine` y en ADR-0022, no oculto.

### Nota
Ningún flujo de usuario de este app cambió — Epic 9 / Fase 9.2 no toca ninguna pantalla existente. Este harness es código de verificación temporal, explícitamente documentado como tal en el propio HTML/TS y en ADR-0022.

## [0.12.0] — Epic 8: Autosave, Recovery & Project Safety

### Agregado
- Autosave real: cualquier cambio de contenido confirmado (comando, batch, undo, redo) programa un guardado automático tras una pausa breve (debounce 1200ms) — nunca durante selección/zoom/pan/Smart Guides/previews efímeros, que nunca llegan a ensuciar el `ProjectSaveCoordinator` (`@impulso/project-library` 0.2.0, ver ADR-0019).
- Indicador de estado de guardado (`#save-status`, junto a "Guardar"): Guardado / Cambios sin guardar / Guardando… / Error al guardar / Recuperado — nunca solo color, con un botón "Reintentar" propio en estado de error. Un anuncio accesible independiente (`aria-live="polite"`, oculto visualmente) solo se activa en transiciones que valen la pena anunciar (error, recuperado, guardado confirmado), nunca en cada autosave.
- Salida segura del editor: "Nuevo" (interno), "Mis proyectos" y abrir/crear otro Project desde la Workspace intentan flushear cualquier guardado pendiente antes de reemplazar/destruir el editor; si falla, un diálogo propio con foco atrapado (`unsavedChangesDialog.ts`, nunca `window.confirm`) ofrece Reintentar/Permanecer en el editor/Salir sin guardar.
- `beforeunload` como última línea de defensa: solo advierte si de verdad hay cambios sin persistir (`App.hasUnsavedChanges()`); nunca es el mecanismo principal de guardado.
- Recovery: un cierre/recarga inesperados bien antes del autosave principal (~1200ms) siguen siendo recuperables gracias a un recovery rápido independiente (~400ms, sin thumbnail). La Workspace detecta recoveries más recientes que el último guardado (o de un Project nunca guardado) y ofrece un banner con Recuperar cambios / Abrir versión guardada / Descartar — nunca sobreescribe en automático. Ver ADR-0020.
- Guardar manual (Ctrl/Cmd+S, sin cambio de atajo) ahora delega enteramente en el `ProjectSaveCoordinator`: cancela/absorbe cualquier debounce pendiente, espera cualquier guardado ya en curso, persiste la revisión más reciente.
- 20 tests nuevos/actualizados en `app.test.ts`/`shell.test.ts`/`workspace.test.ts` (indicador, `requestClose`/`hasUnsavedChanges`, races, banner de recovery, `beforeunload`) + `e2e/autosave-recovery.spec.ts` (4 tests en Chromium real: autosave visible, refresh+recovery, guardado manual, Workspace/miniatura actualizada).

### Corregido
- **Bug real encontrado durante la verificación E2E de esta épica**: `workspace.ts`'s `refresh()` podía dispararse dos veces de forma concurrente al aterrizar en la Workspace (una desde `mountWorkspace` y otra desde `shell.ts`), duplicando tarjetas/filas del banner de recovery. Corregido con una guarda de "único vuelo" (mismo patrón que `ProjectSaveCoordinator.startSave()`). Ver `docs/PERFORMANCE_BUDGET.md` fila 20.
- `e2e/export-visual.spec.ts`: las 3 pruebas rotas por Workspace-first (ADR-0014) — dependían de navegar directamente al editor con `demoProject.ts`, algo que ya no es posible — se reescribieron para crear el Project vía la experiencia soportada (Workspace → Nuevo proyecto → Personalizado) y usar la técnica de imagen de color sólido + Inspector ya probada en `multi-selection.spec.ts`, preservando el intento de verificación original (fidelidad de color 1x/2x, fondo transparente).
- `test:e2e` ahora es `"vite build && playwright test"` (antes solo `"playwright test"`, que corría contra lo que hubiera en `dist/` sin reconstruirlo) — evita repetir el incidente de Fase 7.4 (E2E corriendo contra un build viejo).
- `vitest.setup.ts` ahora importa `fake-indexeddb/auto`: sin autosave, ningún test dejaba timers reales pendientes; con autosave, cualquier test que no inyectara su propio `projectStore` (memoria) pero ensuciara el `ProjectSaveCoordinator` dejaba un timer real que, al disparar más tarde contra un `indexedDB` inexistente en jsdom, producía corridas ocasionalmente inestables de `pnpm -r test` — mismo patrón ya usado en `project-library`/`asset-library`/`template-library`.

## [0.11.0] — Epic 7 / Fase 7.4: Professional Multi Selection

### Agregado
- Mover/redimensionar/rotar 2+ objects seleccionados se siente como una sola manipulación coherente (caja envolvente compartida + handles compartidos, `@impulso/renderer-konva` 0.9.0) — reemplaza el resaltado punteado simple por object que existía desde Editor 2. Arrastrar el cuerpo de cualquier object ya seleccionado, o la propia caja, mueve todo el conjunto; los 8 handles redimensionan el grupo preservando la posición/rotación relativa de cada member; el handle superior rota todo el grupo alrededor del centro de su caja envolvente.
- Un solo gesto produce una sola entrada de historial (un solo `Ctrl/Cmd+Z` revierte el movimiento/resize/rotación completos de todos los objects) — reutiliza `dispatchBatch` (sin comandos nuevos).
- `Escape` ahora cancela un gesto de manipulación grupal en curso (descarta el preview, sin dispatch) antes de limpiar la selección — antes solo limpiaba la selección.
- Snapping/Smart Guides funcionan durante el movimiento grupal (excluyendo la propia selección como candidato) y durante el resize grupal (sin la restricción de rotación que aplica al resize individual, porque la caja del grupo siempre es un AABB puro); la rotación grupal conserva el snap de 15° vía Shift.
- Política de objects bloqueados: un object bloqueado nunca es transformable (individual ni en grupo), pero conserva su propio indicador de selección para poder inspeccionarlo.
- **Bug corregido (severidad alta, detectado en Fase 7.3.5)**: el handle de rotación ya no queda fuera del área interactiva del canvas cuando el object/la selección está pegado al borde superior de la página — se recorta dinámicamente contra los límites del Stage en vez de dibujarse en coordenadas negativas (ver ADR-0018 en `@impulso/renderer-konva`). Aplica tanto a selección individual como múltiple.
- `nudge` (mover con flechas) ahora dispatcha un solo `dispatchBatch` para toda la selección — antes generaba una entrada de historial POR object movido, así que un solo `Ctrl/Cmd+Z` después de mover 3 objects con las flechas solo revertía el último.
- Adición pura de UX/comportamiento — no requiere ADR de cambio de API. Ver ADR-0017/ADR-0018 (`@impulso/renderer-konva`) para el razonamiento de arquitectura completo.
- 327 tests en total (2 nuevos: atomicidad de `nudge` grupal, cableado de `Escape`→cancelación), más `e2e/multi-selection.spec.ts` (2 tests nuevos en Chromium real) verificando el reenvío de drag y la cancelación real. Sin dependencias circulares (verificado con `madge`).

## [0.10.0] — Epic 7 / Fase 7.3: Assisted Placement

### Agregado
- `assistedPlacement.ts` (nuevo): Grid visual (CSS, `.grid-overlay`, detrás del canvas — nunca miles de nodos, el intervalo visual se adapta al zoom sin tocar `grid.size` real), Rulers (dos `<canvas>` DOM, DPR-aware, reflejan `page.unit`/zoom/scroll nativo del viewport), indicador de posición del puntero (`aria-hidden`, throttled vía `requestAnimationFrame`, sin `aria-live`), y controles de Grid/Snap (junto al zoom, no en el Inspector).
- Smart Guides + Snapping durante drag/resize: reutiliza `computeSnap` (`@impulso/engine` 0.9.0) y el `guidesLayer` (`@impulso/renderer-konva` 0.8.0) — snap a página/objects/grid con tolerancia normalizada por zoom, hysteresis contra jitter, Ctrl/Cmd para desactivar temporalmente.
- `updatePageGrid` expuesto en la UI: botones "Grid"/"Snap" y campo de tamaño (dispatcha en `change`, no por tecla) — un comando por intención de usuario, nunca uno por tick.
- Atajos nuevos "G" (mostrar/ocultar Grid) y "R" (mostrar/ocultar Rulers), sin modificador — verificados sin conflicto con ningún atajo existente.
- Token visual `--impulso-snap-guide-color`/`--impulso-grid-line-color` (`index.html`) — primer sistema de tokens CSS del proyecto.
- 323 tests en total (24 nuevos en `assistedPlacement.test.ts` + ajustes en `shell.test.ts`/`app.test.ts` por el nuevo `.grid-overlay`), cobertura mantenida (98.73% statements). 4 tests de Chromium/Playwright nuevos (`e2e/assisted-placement.spec.ts`): Grid/Snap toggle, Rulers, indicador de puntero, y un drag real con snap verificado por muestreo de píxeles.
- UX Audit 0004 (`docs/ux-audits/0004-assisted-placement-fase-7-3.md`).

### Fuera de alcance (deliberado, ver ADR-0016 e instrucción de la épica)
Selección múltiple profesional, resize/rotate de una selección conjunta, guías manuales arrastrables, márgenes, columnas, layouts automáticos, constraints — quedan para Fase 7.4 o fases futuras de Assisted Placement. Snapping de resize no cubre objects rotados ni Ellipse (ver Technical Debt/ADR-0016).

## [0.9.0] — Epic 7 / Fase 7.2: Batch Operations + Alignment

### Agregado
- Nueva sección "Alineación" en el Inspector (`alignment.ts`, nuevo): 0 objects seleccionados → nada; 1 → Centrar horizontal/vertical en página; 2+ → las 6 alineaciones (izquierda/centro/derecha, arriba/centro/abajo); 3+ → suma Distribuir horizontal/vertical. Cada botón: ícono SVG + `title` + `aria-label` + `aria-describedby` hacia un mensaje de error accesible (`role="alert"`) — nunca depende solo del ícono o del color.
- Todas las operaciones aplican con `engine.dispatchBatch` (`@impulso/engine` 0.8.0): un solo Ctrl/Cmd+Z revierte toda la operación sin importar cuántos objects movió, verificado en Chromium con 3 objects distribuidos.
- La caja de referencia para alinear/distribuir es la envolvente conjunta real de la selección (vía `computeObjectBoundingBox`, `@impulso/renderer-konva` 0.7.0) — correcto con objects rotados, escalados, de tamaños distintos, texto, imágenes y grupos.
- Rechazos (ej. sin Stage montado, "Centrar en página" con 2+ seleccionados) muestran un mensaje de texto accesible, nunca solo color; nunca dejan estado parcial ni tocan el historial.
- 297 tests en total (25 nuevos en `alignment.test.ts`), cobertura agregada 98.64%/92.65%/93.51%/98.64%.
- UX Audit 0003 (`docs/ux-audits/0003-alignment-fase-7-2.md`).

### Fuera de alcance (deliberado, ver ADR-0015 e instrucción de la épica)
Resize/rotate multi-object, caja envolvente manipulable, Smart Guides, Grid, Rulers, snapping — quedan para Fases 7.3/7.4. Sin atajos de teclado nuevos para las 8 operaciones (no hay convención clara todavía). Alignment/Distribution no consideran objects dentro de un `group` (solo top-level).

## [0.8.0] — Epic 7 / Fase 7.1: Inspector Honesto y Profesional

### Agregado
- `inspector.ts` reescrito: Tipografía/Tamaño/Alineación de un `TextObject` dejan de ser controles no-op (ver UX Review previa a esta fase) y disparan `updateTextStyle` (`@impulso/engine` 0.7.0) de verdad, con undo/redo y una entrada de historial por cambio.
- X/Y/Ancho/Alto se muestran y confirman en `page.unit` (mm/in/px) vía `fromPixels`/`toPixels` (`@impulso/document-schema` 0.3.0); Rotación y Tamaño de fuente muestran su unidad (`°`/`px`) — antes ningún campo numérico indicaba su unidad.
- Todo campo numérico acepta un valor absoluto o una expresión relativa de un paso (`+n`/`-n`/`*n`/`/n`, nunca `eval`; `numericExpression.ts`, nuevo) con vista previa mientras se escribe (debounced) y confirmación inmediata al perder foco o presionar Enter.
- Si el Engine rechaza un valor (ej. un `fontSize` resultante ≤ 0), el campo se marca inválido (`aria-invalid`, clase `inspector-field-invalid`) y no actualiza su valor confirmado — nunca se ve como si el cambio hubiera funcionado cuando no fue así. Perder el foco con una expresión inválida revierte al último valor válido.
- Rediseño visual del panel (`index.html`): secciones con encabezado tipo micro-label, campos con unidad visible, estado de error consistente; tooltips con atajo agregados a Deshacer/Rehacer/Guardar (cerraba la última brecha de descubribilidad de atajos en la Toolbar).
- 275 tests en total (14 nuevos en `numericExpression.test.ts`, `inspector.test.ts` reescrito con 32 tests), cobertura de `inspector.ts` 99.1%/94.25%/100%/99.1% (único gap: una rama defensiva ya documentada, no ejercitable en uso normal).
- UX Audit 0002 (`docs/ux-audits/0002-inspector-fase-7-1.md`).

### Fuera de alcance (deliberado, ver instrucción de la épica)
Selección múltiple avanzada, Alignment/Distribution, Smart Guides, Snapping, Grid, Rulers — quedan para Fases 7.2/7.3/7.4 de Epic 7. Sin selector de fuentes curado (Tipografía sigue siendo texto libre). Sin selector independiente de unidad (la unidad activa es siempre `page.unit`).

## [0.7.0] — Epic 5: Project Library / Workspace

### Agregado
- App Workspace-first (`shell.ts`, nuevo): la app aterriza en "Mis proyectos" (`workspace.ts`, nuevo) — el editor (`app.ts`) se monta solo al abrir un proyecto existente o crear uno (Template o Personalizado). "Mis proyectos" reemplaza al botón "Abrir"; Ctrl/Cmd+O ahora navega a la Workspace en vez de cargar el slot único legado.
- Workspace: grilla de proyectos con miniatura, nombre editable inline, "Editado [fecha]", Abrir/"Duplicar proyecto"/Eliminar (con confirmación), ordenados por última edición. "Nuevo proyecto" reutiliza la galería de Templates existente.
- Se apoya en `@impulso/project-library` (paquete nuevo, ver ADR-0014): `ProjectStore` (IndexedDB + memoria, contract-tested), `duplicateProject`.
- Migración transparente de una sola vez (`workspaceMigration.ts`, nuevo) del slot único legado de `localStorage` hacia el `ProjectStore` nuevo, incorporando la migración de imágenes embebidas (Epic 2) de paso.
- "Guardar" ahora persiste en `ProjectStore` con un thumbnail (reutilizando `createThumbnailGenerator`, Epic 4) — un fallo generando la miniatura nunca bloquea el guardado del proyecto en sí.
- `persistence.ts`: `saveProjectLocally` eliminado (sin llamadores tras esta épica).
- 253 tests en total (20 archivos), cobertura agregada 98.7%/92.83%/93.01%/98.7%.

### Fuera de alcance (deliberado)
Sin autosave, sin búsqueda/carpetas/colecciones en la Workspace, sin papelera de reciclaje, sin deduplicación de binarios de Asset al duplicar un proyecto — ver ADR-0014.

## [0.6.0] — Epic 4: Templates Foundation

### Agregado
- "Nuevo proyecto" pasa de una lista de radio buttons (`STICKER_SIZE_PRESETS`) a una **galería de tarjetas** (`newProjectDialog.ts`, rediseñado): un Template por tarjeta (miniatura + nombre, eliminable si no es built-in) + una tarjeta "Personalizado" con ancho/alto — reutilizable como el único punto de entrada para crear un proyecto en toda Impulso Platform (ver ADR-0013).
- 3 Templates built-in (`builtInTemplates.ts`): los tamaños anteriores de `STICKER_SIZE_PRESETS` (cuadrado 5×5, círculo 5×5, rectángulo 7×5), sembrados de forma perezosa e idempotente en el primer click real de "Nuevo".
- Botón "Guardar como plantilla" (`saveAsTemplateDialog.ts`, nuevo): formulario nombre+descripción, genera una miniatura vía `@impulso/export-engine` y guarda el proyecto actual como un Template propio (`builtIn: false`, siempre eliminable).
- Se apoya en `@impulso/template-library` (paquete nuevo, ver ADR-0013) y en `cloneProjectWithNewIds` (`@impulso/engine` 0.6.0).
- `STICKER_SIZE_PRESETS`/`SizePreset` eliminados de `projectPresets.ts` (consolidados en Templates); `createProjectFromSize`/`StickerShape` se conservan para la ruta "Personalizado".
- 220 tests en total (18 en `newProjectDialog.test.ts` reescritos, 10 nuevos en `saveAsTemplateDialog.test.ts`, 5 nuevos en `builtInTemplates.test.ts`), cobertura agregada 98.93%/93.89%/93.2%/98.93%.

### Fuera de alcance (deliberado)
Sin deduplicación de binarios de Asset al clonar un Template con imágenes, sin versionado/edición de un Template guardado, sin categorías/búsqueda en la galería — ver ADR-0013.

## [0.5.1] — Pruebas visuales del rasterizador PNG (condiciones de aprobación)

### Agregado
- `@playwright/test` como devDependency real (primera vez que Playwright se instala como parte del proyecto, en vez de verificarse ad-hoc). `pnpm test:e2e` corre `e2e/export-visual.spec.ts` contra `vite preview`, en un Chromium real.
- `e2e/export-visual.spec.ts`: compara píxeles del canvas interactivo del editor contra el PNG exportado (relleno de un rectángulo, relleno de una ellipse, fondo vacío) a 1x y 2x, y verifica alpha=0 con fondo transparente — la verificación repetible de la condición de fidelidad bajo la que se aprobó reutilizar Konva para PNG (ver ADR-0012).

## [0.5.0] — Epic 3: Export Engine Foundation

### Agregado
- Botón "Exportar" en la barra superior + `exportDialog.ts` (mismo patrón de overlay propio que `newProjectDialog.ts`, ver ADR-0010): formato PNG/SVG, fondo transparente/sólido+color y escala 1x-4x (PNG), dimensiones finales en vivo, nombre de archivo, estado de procesamiento, confirmación de descarga con tamaño del archivo, warnings de Assets no resueltos y errores claros sin descarga fallida silenciosa.
- Se apoya en `@impulso/export-engine` (paquete nuevo, ver ADR-0012): `exportProject`/`sanitizeFilename`/`triggerBrowserDownload`, adaptando `AssetBinaryStore.get` a `ExportAssetResolver` con una línea.
- 16 tests nuevos (202 en total), ~99.2%/93.7%/95%/~99.2% de cobertura.

### Fuera de alcance (deliberado)
PDF/línea de corte/sangrado, detección de fuente no disponible, exportación por lotes — ver README de `@impulso/export-engine`.

## [0.4.0] — Epic 2: Asset Library

### Agregado
- Panel "Assets" (`assetsPanel.ts`) en el Sidebar izquierdo, junto al panel de Capas (tabs) — grilla de miniaturas, botón "Subir imagen", click para insertar un Asset ya existente sin volver a subirlo, botón de eliminar por Asset.
- `assetResolution.ts`: `ResolvedAssetCache`, el puente síncrono entre el `AssetBinaryStore` (asíncrono) y el contrato síncrono `resolveAssetSource` del Renderer (Foundation 3) — gestiona el ciclo de vida de `HTMLImageElement` + Object URL. `preloadDocumentAssets` recorre `document.assets` y resuelve cada uno antes de montar/remontar el runtime.
- `legacyMigration.ts`: migración transparente y de una sola vez de proyectos guardados en el formato de Epic 1 (imagen embebida como data URL en `customProperties.impulsoImageDataUrl`) al nuevo modelo de Asset Library — convierte a `Blob`, lo guarda en el `AssetBinaryStore`, crea el `ImageAsset` real, limpia la `customProperty` legada. "Abrir" ejecuta la migración automáticamente y reporta cuántas imágenes se migraron.
- `tools.ts` gana `uploadAsset(file)` (solo sube a la biblioteca, sin insertar — usado por el panel Assets) e `insertImageFromAsset(assetId)` (inserta un Asset ya existente sin re-subir).
- `app.ts`: nuevas dependencias inyectables `binaryStore`/`keyboardTarget` (esta última resuelve un bug real de contaminación entre tests, ver abajo); tabs de Sidebar Layers/Assets; `doOpen()` ejecuta la migración legada antes de remontar.
- Se apoya en `@impulso/asset-library` (paquete nuevo, ver ADR-0011) y en `Document.assets`/`AssetSchema` (`@impulso/document-schema` 0.2.0) y en los comandos `addAsset`/`removeAsset`/`renameAsset` (`@impulso/engine` 0.5.0).
- 25 tests nuevos (186 en total), ~99.8%/94%/96%/~99.8% de cobertura.

### Eliminado
- `imageAssets.ts`/`imageAssets.test.ts` (hack de Epic 1: cache de imágenes en memoria sin Asset Library real) — reemplazados por `assetResolution.ts` + `@impulso/asset-library`.

### Corregido
- Bug de contaminación entre tests: instancias de `App` nunca destruidas entre tests permanecían suscritas a `window`'s `keydown`, provocando que un despacho de evento en un test tardío disparara `doOpen()` en instancias de tests ya completados (con sus stubs de `URL`/`Image` ya revertidos), causando un rechazo no manejado (`URL.revokeObjectURL is not a function`, ausente en el `URL` nativo de jsdom). Corregido agregando `keyboardTarget` como dependencia inyectable de `App` (default a `window` en producción), permitiendo que cada test use un `EventTarget` aislado.

### Fuera de alcance (deliberado)
Deduplicación de Assets, compresión, tipos de Asset más allá de `image` (fuentes, plantillas, íconos, etc. — el modelo ya los admite, ver ADR-0011), validación de Assets huérfanos (sin ninguna referencia), carga perezosa de Assets (`preloadDocumentAssets` resuelve todos al abrir/remontar).

## [0.3.0] — Epic 1: Sticker Creation Experience

### Agregado
- `app.ts`: orquestador central que reemplaza a `toolbar.ts` — cablea `bootstrap.ts` (Canvas Runtime), el panel de capas, el Inspector, el zoom, las herramientas Texto/Imagen, el diálogo de proyecto nuevo, y los atajos de teclado, junto con las acciones de Duplicar/Eliminar/Agrupar/Desagrupar/Reordenar/Nudge. Mantiene el patrón de Nuevo/Abrir de ADR-0009 (destruir y remontar el runtime completo), extendido con precarga asíncrona de imágenes embebidas.
- `projectPresets.ts`: 3 presets curados de tamaño de sticker (cuadrado, circular, rectangular) + `createProjectFromSize()`.
- `newProjectDialog.ts`: diálogo modal de "Nuevo proyecto" (presets + tamaño personalizado).
- `imageAssets.ts`: cargar un `File` (PNG/SVG) como imagen, cache en memoria (`ImageAssetCache`), y precarga (`preloadProjectImages`) al abrir un proyecto guardado — sin una Asset Library real (ver ADR-0010).
- `tools.ts`: acciones "Agregar texto"/"Agregar imagen" (insertan centrado en la página, sin modo de colocación) + botones de la barra de herramientas.
- `zoom.ts`: zoom vía `transform: scale(...)` CSS — presets 25/50/100/200%, "Ajustar a pantalla", rueda del mouse + Ctrl/Cmd.
- `layersPanel.ts`: panel de capas completo — reordenar por drag-and-drop, expandir/colapsar Groups (hijos solo informativos, ver ADR-0010), renombrar inline, ocultar, bloquear.
- `inspector.ts`: Sidebar derecha — Transformar/Apariencia/Texto/Metadata, adaptado a la selección (0/1/2+ objects).
- `keyboardShortcuts.ts`: mapa de atajos de teclado (V/T/I, Supr, Ctrl/Cmd+D/G/Shift+G/Z/Shift+Z/S/O/A, Escape, flechas, Ctrl/Cmd+[/]) desacoplado del Engine.
- `index.html`/`main.ts` reescritos con el layout completo (barra superior, tools-bar, capas | canvas | inspector, diálogo de proyecto nuevo).
- 3 comandos nuevos en `@impulso/engine` (`updateObjectContent`, `groupObjects`, `ungroupObject`) y edición de texto in-canvas en `@impulso/renderer-konva` (ver sus propios CHANGELOGs) usados por esta épica.
- Flujo completo (crear → diseñar → guardar → abrir → editar sin pérdida de información) verificado en Chromium real, sin errores de consola. Durante esa verificación se encontró y corrigió un bug real: el panel de capas reconstruía todo su DOM en cada cambio de selección, rompiendo la detección nativa de doble-click del navegador para el renombrado inline (ver ADR-0010, §"Reconstrucción del panel de capas").
- 131 tests nuevos (161 en total), ~99.8% de cobertura.

### Eliminado
- `toolbar.ts`/`toolbar.test.ts` (Milestone 1) — reemplazados por `app.ts`.

### Fuera de alcance (deliberado)
IA, Exportación, Marketplace, Usuarios, Cloud, Plantillas, Mockups, una Librería de Assets real, Plugins, múltiples Pages/Layers expuestas en la UI, "entrar" a un Group, modo de herramienta persistente para Texto/Imagen.

## [0.2.0] — Milestone 1: Impulso Alpha

### Agregado
- `persistence.ts`: `saveProjectLocally`/`loadProjectLocally`/`hasLocalProject`/`clearLocalProject`, guardando un único `Project` en `localStorage` vía `serializeProject`/`deserializeProject` (`@impulso/document-schema`, sin cambios). Ver ADR-0009.
- `toolbar.ts` + barra de 5 botones en `index.html`: Nuevo, Deshacer, Rehacer, Guardar, Abrir. "Nuevo"/"Abrir" destruyen el `RendererAdapter` actual y montan uno nuevo con un Project fresco/cargado — cero cambios en `@impulso/engine` ni `@impulso/renderer-konva`.
- Primera versión ejecutable de punta a punta: crear, mostrar, renderizar, seleccionar, mover, redimensionar, rotar, deshacer, rehacer, guardar localmente y volver a abrir un documento — todo verificado en un Chromium real, incluyendo una recarga de página real entre Guardar y Abrir.
- 22 tests nuevos (30 en total), 100% de cobertura.

### Fuera de alcance (deliberado)
Toolbar/Sidebar/Inspector/Layers Panel con diseño real, Zoom, Pan, Exportaciones, gestión de Assets, crear objects desde la UI, múltiples documentos guardados.

## [0.1.0] — Editor 1: Canvas Runtime

### Agregado
- `mountCanvasRuntime(container, project?)`: cableado end-to-end del pipeline `Document Schema → Engine → Renderer → Canvas`, usando exclusivamente las APIs públicas ya existentes de `@impulso/document-schema`, `@impulso/engine` y `@impulso/renderer-konva`.
- `createDemoProject()`: Project de demostración (rectangle + ellipse + text) para tener contenido que renderizar sin depender de Persistence ni de una Biblioteca de Assets, ninguna de las dos construida todavía.
- `index.html` + `main.ts`: runtime real montado en el navegador vía Vite (sin framework de UI — no hay Toolbar/Sidebar que justifique React todavía, ver ADR-0005).
- 8 tests, 100% de cobertura, sin dependencias circulares.
- Verificación adicional en un navegador real (Chromium vía Playwright) confirmando píxeles renderizados, no solo estructura de nodos.

### Fuera de alcance (deliberado)
Toolbar, Sidebar, Zoom, Pan, Selección, Resize, Rotación, Handles, atajos de teclado, Exportaciones, Biblioteca de Assets.
