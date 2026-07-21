# ADR-0025 — Sticker Builder: Production Export Workflow (Épica 9 / Fase 9.4, producto)

## Problema
El motor de imposición (ADR-0024) y todo el Print Engine construido hasta esta fase (ADR-0021/0022/0023) no tenía, hasta ahora, ninguna UI real de producto — solo harnesses temporales de verificación en Chromium (`print-engine-harness.html`/`print-preview-harness.html`) que nunca fueron pensados como el flujo final. Esta fase construye el flujo real de "Exportar para impresión": un wizard de 7 pasos (perfil → configuración → preview → preflight → advertencias → progreso → resultados) que un usuario real puede usar de principio a fin, con accesibilidad y responsividad verificadas en un navegador real, no solo argumentadas.

## Contexto
- Continúa la misma Revisión Previa aprobada de Fase 9.4 (ver ADR-0024) — el flujo de UI, el Production Preview real, y el controller de estado están dentro del mismo alcance ya autorizado.
- Reemplaza ambos harnesses temporales de Fase 9.2/9.3 como la superficie de verificación en Chromium para exportación — el harness técnico de preview (`printPreviewHarness.ts`) queda obsoleto en su propósito de producto (sigue existiendo como verificación de geometría de overlays de Fase 9.3, sin cambios).
- Explícitamente fuera de alcance: persistencia de un `PrintJob` como preset reutilizable más allá de lo trivial en memoria durante el flujo, múltiples perfiles imposicionables (solo existe "Sticker Sheet" hoy), UI de asignación de `metadata.role: "die-line"` en el Inspector.

## Alternativas evaluadas

### ¿Cómo modelar el estado del wizard de 7 pasos?
- **A. Una clase ES con métodos privados**: descartada — rompería la convención establecida en toda la plataforma (Engine, `ProjectSaveCoordinator`, cualquier controller previo) de funciones factory que devuelven un objeto plano con `getState()`/`subscribe()` explícitos, nunca una clase ni un `EventTarget`.
- **B. Función factory `mountProductionExportController(options): ProductionExportController`** (elegida) — mismo patrón exacto que `ProjectSaveCoordinator` (Epic 8, `packages/project-library`). Estado interno en closures, `emit()` notifica a los `listener`s suscritos tras cada cambio, nunca expone setters directos sobre campos individuales.

### ¿El controller debe leer el `Project` en vivo o una foto?
- **A. Mantener una referencia viva a `getProject()`**: descartada — si el usuario sigue editando mientras el diálogo de exportación permanece abierto (nada se lo impide), el flujo mezclaría silenciosamente geometría de dos revisiones distintas del documento a mitad de un Preflight o de una exportación ya en curso.
- **B. Foto inmutable tomada en `open()` (`structuredClone`), invalidación explícita ante cambios** (elegida) — `open(project, initialPrintJob)` clona ambos de inmediato; todo el resto del flujo (preview, Preflight, exportación) opera ÚNICAMENTE sobre esa foto. El caller notifica cambios reales del `Project` (`notifyProjectChanged()`, enganchado al mismo evento `projectChanged` del Engine que ya usa `ProjectSaveCoordinator`) — el controller se marca `projectStale: true` y muestra un banner honesto ("El proyecto cambió desde que se abrió este flujo") en vez de mezclar revisiones; el usuario decide explícitamente `refreshSnapshot(project)` para continuar con el contenido nuevo, lo que invalida cualquier Preflight ya corrido.

### ¿Cuándo se invalida un Preflight ya corrido y cuándo se recuerda la aceptación de advertencias?
`updatePrintJob`/`refreshSnapshot` invalidan siempre `preflightCurrent` (un Preflight desactualizado NUNCA se muestra como vigente, sección 26 del enunciado) y resetean `warningsAccepted` — la aceptación de advertencias es **por ejecución**, nunca recordada entre corridas distintas (sección 29): el checkbox de "acepto las advertencias" debe marcarse de nuevo cada vez que cambie cualquier dato que pudiera cambiar el resultado del Preflight. El paso de advertencias se salta automáticamente cuando el Preflight vigente no tiene ninguna advertencia real.

### ¿Cómo cancelar una exportación real en curso?
Un `AbortController` real se crea al iniciar `startExport()` y se propaga como `signal` hasta `exportImpositionToPdf`/`exportImpositionToPng` (los mismos puntos de chequeo de cancelación de Fase 9.2/ADR-0024) — `cancelExport()` simplemente llama a `.abort()`. Una cancelación explícita del usuario nunca se muestra como un error ("Error: …") sino que detiene el progreso sin más — distinguido explícitamente de cualquier otro `PrintEngineError` real capturado en el mismo `catch`.

### ¿Cómo construir un Production Preview que no sea un demo fijo?
- **A. Reutilizar el harness de Fase 9.3 tal cual, solo cambiándole el `Project` de entrada**: descartada — ese harness fue construido explícitamente como código de verificación temporal (ADR-0023), sin la disciplina de producto (accesibilidad, responsividad, manejo de ciclo de vida `destroy()`) que un componente real necesita.
- **B. `productionPreview.ts` nuevo, data-driven, reutilizando la MISMA geometría pura que los exportadores** (elegida) — `mountProductionPreview(container, {resolver})` recibe el `Project`/`PrintJob` reales en cada `render()`, nunca un documento de demo fijo. Reutiliza sin excepción `computeImpositionLayout`/`renderPrintPage`/`computeCropMarksGeometry`/`resolveDieLineSource`+`normalizeCutGeometry`+`applyCutGeometryOffset`+`cutGeometryToPathSegments`/`cropMarkSegmentToRaster`/`canonicalPointToRasterPoint`/`cutPathSegmentsToRaster` de `@impulso/print-engine` — nunca una reimplementación aproximada de esa geometría en la capa de UI.

### ¿A qué resolución debe renderizarse el preview?
`PREVIEW_PPI = 72` fijo, deliberadamente **menor** al `targetPpi` real de producción del `PrintJob` (sección 21/38 del enunciado) — comunica explícitamente, con su propia etiqueta textual en el resumen del preview, que "esto no es una promesa de pixel-perfecto"; evita además el costo de rasterizar a resolución de impresión solo para mostrarlo en pantalla a una fracción de su tamaño real.

### ¿Cómo distinguir overlays (Sheet/Useful Area/Footprint/Trim/SafeArea/CropMarks/CutPath) de forma accesible?
Cada overlay usa un `stroke-dasharray` distinto además de su color — nunca solo color (hallazgo principal de UX Audit 0007: un usuario con daltonismo o viendo una impresión en escala de grises debe poder distinguirlos igual). Toggles independientes por capa, resumen textual equivalente (`<dl>`) con la etiqueta de PPI y el `message` (nunca el `code` técnico crudo) de cualquier issue de Preflight relevante.

### ¿Cómo estructurar el diálogo de 7 pasos en sí?
- **A. Un formulario largo de scroll único con todos los campos visibles**: descartada — mezclaría configuración/preview/resultados en una sola pantalla abrumadora, sin ningún punto de validación intermedio antes de comprometerse a exportar.
- **B. Wizard de 7 pasos, lineal-pero-navegable hacia atrás** (elegida) — `mountProductionExportDialog(container, options): ProductionExportDialog` con `{open(project, defaultProjectName), destroy()}`. Foco atrapado real (modelado exactamente sobre `unsavedChangesDialog.ts`, el único otro diálogo de la app con esa disciplina): `role="dialog"` `aria-modal="true"` `aria-labelledby` apuntando al `<h2 tabIndex="-1">` de cada paso, que recibe `.focus()` en cada cambio de paso — un lector de pantalla anuncia el paso nuevo de inmediato, sin que el usuario tenga que adivinar dónde quedó el foco. Región de progreso `aria-live="polite"` `role="status"` (nunca `"assertive"` — sección 36: no interrumpir abruptamente al usuario). Issues de Preflight agrupados por severidad bajo encabezados de texto ("Errores (bloquean la exportación)"/"Advertencias"/"Información"), usando `issue.message`/`issue.recommendation`, nunca el `code` crudo.

### ¿Dónde vive el nuevo punto de entrada en el editor?
`#production-export-btn` ("Exportar para impresión") junto al `#export-btn` ("Exportar") ya existente — dos flujos deliberadamente distintos y con etiquetas distintas: exportación rápida a pantalla (PNG/SVG, Epic 3, sin cambios) vs. exportación real a producción (este flujo). Confundirlos bajo un mismo botón habría ocultado que uno de los dos pasa por Preflight/imposición y el otro no.

## Decisión tomada

### Arquitectura de 3 piezas, cada una con una sola responsabilidad
1. **`productionPreview.ts`** — renderizado puro data-driven de una hoja/página de imposición, sin ningún estado de flujo (perfil, paso actual, Preflight) — solo `render(project, printJob)` y navegación (`nextSheet`/`prevSheet`/`nextPageGroup`/`prevPageGroup`) + zoom (Fit/100%/slider).
2. **`productionExportController.ts`** — dueño exclusivo del estado/ciclo de vida del wizard (`ExportStep`, foto de Project/PrintJob, Preflight, aceptación de advertencias, exportación/cancelación) — nunca toca el DOM directamente.
3. **`productionExportDialog.ts`** — la UI del wizard en sí, consume el controller vía `subscribe()`/`getState()` y monta/desmonta el `productionPreview` dentro de su paso correspondiente — nunca duplica el estado del controller en variables propias.

Esta separación es la misma disciplina ya usada en `ProjectSaveCoordinator` + su UI consumidora en `app.ts` (Epic 8) — un controller nunca conoce el DOM, una UI nunca guarda su propia copia de la verdad.

### Integración en `app.ts`/`main.ts`/`index.html`
`mountProductionExportDialog` se monta una sola vez junto al resto de los controllers de la app; el botón nuevo del toolbar dispara `productionExportDialog.open(runtime.engine.getProject(), runtime.engine.getProject().metadata.name ?? "Sticker")`. `AppElements` gana `productionExportDialogContainer`/`productionExportButton`, reflejado en `main.ts` (`requireElement`) y en los fixtures de `app.test.ts`/`shell.test.ts`.

## Verificación en Chromium real
`e2e/production-export.spec.ts` — 19 escenarios sin ningún mock, verificando específicamente lo que `vitest`/jsdom no puede confirmar: `role="dialog"`/`aria-modal`/título por paso; `Escape` cierra y restaura el foco al elemento que abrió el diálogo; `Tab` desde el último elemento enfocable nunca escapa del diálogo (foco atrapado real); el foco se mueve al `<h2>` de cada paso nuevo; Preflight bloquea "Siguiente" con un proyecto en blanco (`cut_path_missing`) mostrando el motivo en texto, nunca solo color; layout responsivo sin overflow horizontal en 4 viewports (1366×768/1440×900/1920×1080/360×740 estrecho); el preview renderiza un canvas real con dimensiones > 0; "Atrás" deshabilitado en el primer paso; "Cancelar" cierra desde cualquier paso intermedio; navegación completamente por teclado (Enter activa el botón enfocado, un input numérico real acepta un valor con el teclado); región de progreso con `aria-live="polite"`; errores de Preflight distinguidos por encabezado de texto.

### Bug real encontrado mediante E2E (no hipotético)
`ProductionExportController.close()` no reseteaba `step` de vuelta a `"profile"` — solo limpiaba `projectSnapshot`/`printJob`/`exporting`. Reproducido con un test real en Chromium: avanzar al paso "config" → clic en Cancelar → reabrir el diálogo → mostraba el título obsoleto "Configuración de la imposición" con un `printJob` ya vacío, en vez de reiniciar a "Perfil de impresión". Corregido agregando `step = "profile"` dentro de `close()`, con una regresión equivalente agregada también al lado `vitest` (`productionExportController.test.ts`). Exactamente el tipo de defecto que la verificación en un navegador real está pensada para atrapar y que jsdom, estructuralmente, no puede.

**Fallo preexistente, no de esta fase**: `e2e/assisted-placement.spec.ts`'s test de Smart Guides sigue fallando (confirmado antes y después de todo el trabajo de esta fase) — sin relación con el flujo de exportación; no investigado ni corregido aquí (ver Technical Debt).

## Consecuencias
- `@impulso/sticker-builder` sube de 0.14.0 a 0.15.0.
- Nuevos módulos de producto: `productionPreview.ts`, `productionExportController.ts`, `productionExportDialog.ts` (con sus respectivos tests).
- Nuevo punto de entrada de UI (`#production-export-btn`) y ~130 líneas de CSS nuevas en el único bloque `<style>` global de `index.html` (esta app no tiene hojas de estilo separadas).
- Ambos harnesses temporales de Fase 9.2/9.3 (`print-engine-harness.html`/`print-preview-harness.html`) dejan de ser la única superficie de verificación en Chromium para exportación — quedan como código de verificación técnica de geometría de bajo nivel, no como sustituto del flujo real.
- UX Audit 0008 (`docs/ux-audits/0008-production-export-experience-fase-9-4.md`) documenta con autocrítica explícita las limitaciones conocidas de V1 de este flujo (ver debajo).

## Riesgos y limitaciones conocidas (ver UX Audit 0008 para el detalle completo)
- **Sin nombre de archivo editable** — el paso de resultados usa directamente `buildPrintFilename(...)` ya resuelto; el nombre base se define implícitamente al abrir el diálogo, sin ningún campo para ajustarlo dentro del flujo.
- **Sin localización visual de un issue de Preflight en el preview** — la lista de issues es texto plano, sin interacción hacia el paso de preview (que además es un paso anterior en el flujo lineal).
- **Configuración avanzada parcial** — márgenes por lado, configuración de cut path (color/grosor/offset), y resolución/PPI de exportación no son editables desde este flujo todavía (heredan el valor ya presente en el `PrintJob`).
- ~~Un solo perfil imposicionable ("Sticker Sheet")~~ — **corregido en Fase 9.5** (ver enmienda debajo): era un gap de wiring, no una limitación del motor.
- **No existe UI de asignación de `metadata.role: "die-line"`** en el Inspector — detectado durante la verificación E2E: un `Project` recién creado sin ese rol asignado siempre bloquea en Preflight (`cut_path_missing`) con el perfil por defecto. Brecha ya conocida del editor en general, no de esta fase, pero esta fase es la primera en depender de ella de forma central para su camino feliz.
- **"Ajustar" (Fit) del preview depende de `clientWidth` real** — sin ningún mensaje visible si el contenedor todavía no tiene layout medible; un clic sin efecto visible no se explica al usuario.

## Enmienda (Fase 9.5 — Hardening & Golden Tests)

**Discrepancia encontrada y corregida**: la auditoría inicial de Fase 9.5 encontró que el enunciado original de Fase 9.4 ("perfiles como opciones comprensibles para el usuario") nunca se cumplió del todo — `@impulso/print-engine` siempre tuvo 4 perfiles completos y funcionales (`digital-png`/`print-pdf`/`sticker-sheet`/`web-preview`), pero `productionExportDialog.ts` tenía `pendingProfileId` **hardcodeado** a `"sticker-sheet"`, sin ningún selector real. UX Audit 0008 documentó esto (incorrectamente) como una limitación del motor ("un solo perfil imposicionable") cuando en realidad era una desconexión de wiring en la UI.

**Corregido**: el paso "profile" ahora muestra un selector real (`WIZARD_PROFILE_IDS`) con 3 perfiles — **Digital PNG**, **Print PDF**, **Sticker Sheet** — cada uno inicializando un `PrintJob` real y coherente al confirmarse. El paso "config" se bifurca según `imposition.mode`: perfiles con `"grid"` (Sticker Sheet) muestran el formulario de imposición existente (`buildConfigForm`); perfiles con `"single"` (Digital PNG/Print PDF) muestran un resumen de formato/resolución/sangrado (`buildSimpleConfigForm`, nuevo) en vez de una pantalla en blanco (el gap real que existía antes de este fix: un perfil sin imposición renderizaba un paso de configuración completamente vacío).

**`"web-preview"` se deja deliberadamente FUERA de este wizard** — decisión explícita, no un descuido: su propósito (resolución baja para pantalla, sin bleed/marcas/cut path/imposición) ya está cubierto por el diálogo de "Exportar" rápido existente (`exportDialog.ts`), que además ofrece más control útil para ese caso (fondo transparente/sólido, escala 1x-4x) sin pasarlo por Preflight ni por pasos de imposición que no le aplican. Exponerlo aquí duplicaría una capacidad ya existente y confundiría el propósito de este flujo (producción real, no vista rápida a pantalla). El perfil sigue existiendo en `PRINT_PROFILES` — disponible programáticamente para cualquier consumidor futuro que lo necesite (ej. una API, u otro Builder).

### Segunda enmienda (Fase 9.5, verificación de performance/memoria/leaks — bug real encontrado y corregido)

Al escribir pruebas end-to-end reales para los 3 perfiles del wizard (no solo el selector de la primera enmienda, sino completar TODO el flujo hasta una descarga real) se descubrió que el wiring de la primera enmienda estaba **incompleto**: `ProductionExportController.startExport()` llamaba SIEMPRE a `exportImpositionToPdf`/`exportImpositionToPng` (los exportadores de Fase 9.4, que exigen `imposition.mode === "grid"` y lanzan si no) protegido por un guard `if (!isImposed(printJob)) return;` que simplemente no hacía nada para un `PrintJob` sin imposición — **"Digital PNG"/"Print PDF" quedaban seleccionables, pasaban por config/preview/preflight/warnings, pero el click en "Exportar" no producía ningún archivo ni ningún error visible; el wizard quedaba colgado indefinidamente en "Preparando…"** (el botón "Siguiente" se oculta durante el paso "progress", sin ninguna forma de continuar).

Un segundo bug relacionado, independiente del anterior: el paso "warnings" avanzaba automáticamente a "progress" cuando Preflight no reportaba advertencias (sección 29: "solo se pregunta cuando hay algo que aceptar") — pero ese auto-avance solo llamaba `controller.setStep("progress")`, nunca `controller.startExport(...)` (que solo se disparaba desde el click handler cuando el usuario alcanzaba a ver y confirmar el paso "warnings" manualmente). Un proyecto genuinamente sin advertencias (ej. "Digital PNG" sobre un lienzo simple, sin bleed/marcas/cut path/imposición que objetar) quedaba con el mismo síntoma: colgado en "Preparando…" sin ninguna exportación real disparada.

**Corregido**: `startExport()` ahora despacha según `imposition.mode` — `"grid"` usa los exportadores de imposición (sin cambios); `"single"` usa `exportPrintJobToPdf`/`exportPrintJobToPng` (Fase 9.2, ya exhaustivamente probados de forma aislada, nunca antes invocados desde este wizard). El paso "results" del diálogo distingue ambos tipos de resultado (`"sheetCount" in result`/`"sheets" in result` vs `"pageCount" in result`/`"pages" in result`) para mostrar el resumen y los botones de descarga correctos en cualquiera de los dos casos. El auto-avance del paso "warnings" ahora dispara `startExport()` directamente en vez de solo cambiar de paso. Regresión: `productionExportController.test.ts` (2 tests nuevos, perfil sin imposición vía PDF y PNG), `productionExportDialog.test.ts` (1 test, proyecto sin advertencias completo hasta "Resultado"), y 2 escenarios E2E reales en Chromium (`e2e/production-export.spec.ts`, "Digital PNG"/"Print PDF" completos hasta la descarga).

## Compatibilidad futura
- Una UI de asignación de die-line en el Inspector y la localización de issues de Preflight en el preview quedan registrados en el backlog (ver `UX_BACKLOG.md`) para una decisión de producto futura.
