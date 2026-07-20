# Changelog — @impulso/sticker-builder

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
