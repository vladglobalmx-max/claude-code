> **Documento archivado y fusionado (Consolidación documental THÖREN, 2026-07-31).** Este era el README técnico completo de `apps/sticker-builder` cuando Sticker Builder era un producto independiente. Su documentación técnica reutilizable (árbol de módulos, decisiones 3.1-3.14, verificación) está resumida en [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). El README real y vigente de la app ahora vive en [`../../../apps/sticker-builder/README.md`](../../../apps/sticker-builder/README.md), reescrito para reflejar que el editor es un componente interno, no un producto independiente.

# @impulso/sticker-builder

> EPIC 1 — Sticker Creation Experience + EPIC 2 — Asset Library + EPIC 3 — Export Engine Foundation + EPIC 9 — Professional Print Engine (Fases 9.4-9.5) de Impulso Platform. Experiencia de creación completa: crear un proyecto (eligiendo tamaño de canvas por preset), agregar texto e imágenes, mover/escalar/rotar/duplicar/eliminar objects, reordenar capas, agrupar/desagrupar, bloquear/ocultar, deshacer/rehacer, guardar/abrir, administrar una biblioteca de assets real (subir, reutilizar sin re-subir, eliminar), **exportar a PNG/SVG** para pantalla, y **exportar para impresión real** (imposición, Preflight, PDF/PNG print-ready) — todo dentro del navegador, verificado en Chromium real sin errores de consola, y endurecido en Fase 9.5 (bugs reales de dispatch/foco/naming corregidos, performance/memoria/resource-leaks verificados). Ver [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md)/[ADR-0011](../../docs/adr/0011-asset-library.md)/[ADR-0012](../../docs/adr/0012-export-engine.md) para el razonamiento de las primeras tres épicas, y [ADR-0025](../../docs/adr/0025-production-export-workflow.md) (2 enmiendas de Fase 9.5) para el flujo real de exportación a producción sobre `@impulso/print-engine` (ver ADR-0021 a ADR-0024).

**Estado:** el flujo completo crear → diseñar → guardar → abrir → **exportar a pantalla o a producción** queda cerrado y endurecido — Epic 9 completa (Fases 9.1-9.5). Todo lo construido en Epic 1 vive en la capa de aplicación (`apps/sticker-builder`); Epic 2 agregó `@impulso/asset-library`; Epic 3 agregó `@impulso/export-engine` y el diálogo de exportación rápida; Epic 9 / Fase 9.4 agregó el flujo real de "Exportar para impresión" (wizard de 7 pasos) sobre `@impulso/print-engine`; Fase 9.5 lo endureció (los 3 perfiles del selector ahora funcionan de extremo a extremo — no solo se muestran; bug real de foco atrapado corregido; performance/memoria/resource-leaks verificados en Chromium real). Cero cambios que rompan la API pública de `@impulso/document-schema`/`@impulso/engine`/`@impulso/renderer-konva` — todas las épicas ganaron extensiones aditivas documentadas en sus propios READMEs/CHANGELOGs. Explícitamente fuera de alcance todavía: IA, Marketplace, Usuarios, Cloud, Plantillas guardadas como preset de impresión, Mockups, Plugins, tipos de Asset más allá de `image`, nesting/tiling de gran formato, integración con RIP/plotter.

---

## 1. Qué es y qué no es

- **Sí hace:** Barra superior (Nuevo/Deshacer/Rehacer/Guardar/Abrir/**Exportar**/**Exportar para impresión**/Duplicar/Eliminar/Agrupar/Desagrupar), barra de herramientas (Texto/Imagen + Zoom), Sidebar izquierda con dos tabs — panel de Capas (reordenar por drag-and-drop, expandir/colapsar groups, renombrar, ocultar, bloquear) y panel de **Assets** (subir imágenes, verlas en una grilla con miniatura, insertarlas en el canvas sin volver a subirlas, eliminarlas de la biblioteca) —, Canvas central (con zoom CSS 25-200% + "Ajustar a pantalla" + rueda del mouse con Ctrl/Cmd), Sidebar derecha (Inspector: Transformar/Apariencia/Texto/Metadata, adaptado a la selección actual), diálogo de "Nuevo proyecto" (3 presets de sticker + tamaño personalizado), diálogo de "Exportar" rápido (PNG con fondo transparente/sólido y escala 1x-4x, o SVG, con dimensiones finales en vivo y confirmación de descarga), diálogo de **"Exportar para impresión"** (wizard de 7 pasos: perfil → configuración de imposición → Production Preview real → Preflight → advertencias → progreso → resultados, ver §3.12), y un mapa completo de atajos de teclado. Todo el flujo funciona sin recargar ni perder estado salvo cuando el usuario lo pide explícitamente (Guardar/Abrir/Exportar).
- **No hace:** no soporta múltiples Pages/Layers del Document Schema desde la UI (el panel de capas asume una sola Page/Layer); no tiene un modo de herramienta persistente tipo "lápiz armado" (Texto/Imagen insertan directamente, ver §3.4); no permite "entrar" a un Group para seleccionar un hijo individualmente; no implementa ningún tipo de Asset más allá de `image`; no ofrece ninguna UI para asignar `metadata.role: "die-line"` a un object desde el Inspector (ver §7); no permite editar el nombre de archivo, márgenes por lado, ni configuración de cut path dentro del wizard de exportación a impresión todavía (ver §7).

## 2. Árbol

```
apps/sticker-builder/
├── package.json / tsconfig.json / vite.config.ts / vitest.config.ts
├── index.html                    # layout completo: barra superior, tools-bar, capas | canvas | inspector
├── README.md / CHANGELOG.md
└── src/
    ├── main.ts                    # entry point real: DOM -> mountApp (sin lógica propia)
    ├── app.ts                     # orquestador central: cablea todos los módulos de abajo entre sí
    ├── bootstrap.ts                # mountCanvasRuntime(container, project?, options?) — pipeline Document Schema -> Engine -> Renderer -> Canvas
    ├── demoProject.ts              # Project de demostración (rectangle + ellipse + text)
    ├── persistence.ts              # guardar/cargar un Project en localStorage
    ├── projectPresets.ts           # 3 presets de tamaño de sticker + createProjectFromSize()
    ├── newProjectDialog.ts         # modal "Nuevo proyecto": presets + tamaño personalizado
    ├── assetResolution.ts          # ResolvedAssetCache: puente síncrono AssetBinaryStore (async) <-> resolveAssetSource (sync)
    ├── legacyMigration.ts          # migración de imágenes embebidas (Epic 1) al modelo de Asset Library
    ├── assetsPanel.ts              # Sidebar izquierda (tab Assets): grilla, subir, insertar, eliminar
    ├── exportDialog.ts             # Diálogo "Exportar": formato PNG/SVG, fondo/escala, dimensiones en vivo, descarga
    ├── tools.ts                    # acciones "Agregar texto"/"Agregar imagen"/subir e insertar Assets + botones de la tools-bar
    ├── zoom.ts                     # zoom vía CSS transform: presets, Ajustar a pantalla, rueda + Ctrl/Cmd
    ├── layersPanel.ts              # Sidebar izquierda (tab Capas): reordenar, expandir/colapsar, renombrar, ocultar, bloquear
    ├── inspector.ts                # Sidebar derecha: Transformar/Apariencia/Texto/Metadata según la selección
    ├── alignment.ts                # sección "Alineación" del Inspector + controller (dispatchBatch), Fase 7.2
    ├── assistedPlacement.ts        # Grid visual, Rulers, indicador de puntero, controles Grid/Snap, Fase 7.3
    ├── workspace.ts                # "Mis proyectos": grilla de proyectos + banner de recovery (Epic 8, ver ADR-0020)
    ├── shell.ts                    # orquestador de nivel superior: Workspace-first, montar/destruir el editor, beforeunload (Epic 8)
    ├── unsavedChangesDialog.ts     # diálogo de salida con cambios sin guardar (foco atrapado), Epic 8, ver ADR-0019
    ├── keyboardShortcuts.ts        # mapa de atajos -> acciones, desacoplado del Engine
    ├── productionPreview.ts        # (Fase 9.4) Production Preview real, data-driven, misma geometría pura de @impulso/print-engine
    ├── productionExportController.ts # (Fase 9.4) estado/ciclo de vida del wizard de 7 pasos — foto inmutable de Project/PrintJob
    ├── productionExportDialog.ts   # (Fase 9.4) UI del wizard "Exportar para impresión", foco atrapado real, ver ADR-0025
    ├── print-engine-harness.html / src/printEngineHarness.ts     # harness temporal de verificación (Fase 9.2/9.3, no producto)
    ├── print-preview-harness.html / src/printPreviewHarness.ts   # harness temporal de verificación de overlays (Fase 9.3, no producto)
    └── testing/
        └── fakeCanvasContext.ts    # stub de canvas 2D para tests (jsdom no implementa uno real)

    (tests unitarios exhaustivos + e2e en Chromium real, ver §4)
```

## 3. Decisiones clave (ver ADR-0010/ADR-0011/ADR-0012 para el detalle completo)

### 3.1 Orquestación: `app.ts` reemplaza a `toolbar.ts`
`app.ts` es el único módulo que conoce a todos los demás — cada módulo individual (`layersPanel.ts`, `inspector.ts`, `zoom.ts`, `tools.ts`, `keyboardShortcuts.ts`, `newProjectDialog.ts`) no conoce a ningún otro, solo al `Engine`. "Nuevo"/"Abrir" mantienen el patrón ya establecido en Milestone 1 (ADR-0009): destruir el `CanvasRuntime` completo y montar uno nuevo, extendido ahora con precarga asíncrona de imágenes embebidas antes del primer render.

### 3.2 Agrupar/desagrupar: solo hijos directos de una Layer
Igual que `reorderObjects` desde Foundation 2 — agrupar objects de Layers distintas o ya anidados en otro Group se rechaza explícitamente. Al desagrupar, el transform del Group se "hornea" en cada hijo (`composeChildTransformIntoParent`, en `@impulso/engine`) para que nada se mueva visualmente.

### 3.3 Un Group siempre se selecciona como una unidad
Ni el canvas (`NodeContext.interactive`, ver README de `@impulso/renderer-konva`) ni el panel de capas permiten seleccionar un hijo de un Group individualmente — las filas de hijos (mostradas solo al expandir) son informativas, sin click-to-select ni renombrado.

### 3.4 Insertar texto/imágenes centrado, no "colocar con un click"
"Texto"/"Imagen" insertan el object nuevo ya centrado en la página (con un pequeño desplazamiento en cascada entre inserciones consecutivas) en vez de armar un modo de herramienta que espere un click de colocación — evita traducir coordenadas de pantalla a través del zoom CSS hasta el espacio del Stage de Konva. El usuario arrastra el object a su posición final con la interacción de mover ya existente.

### 3.5 Imágenes sobre la Asset Library real (`@impulso/asset-library`, Epic 2)
El binario ya no se embebe en el documento: `tools.ts` sube el `File` a `AssetBinaryStore` (IndexedDB) vía `createImageAssetFromFile`, registra el `ImageAsset` resultante en `document.assets` (`addAsset`), y el `ImageObject` solo guarda su `assetId`. `assetResolution.ts` resuelve ese `assetId` hacia un `HTMLImageElement` en memoria (`ResolvedAssetCache`), conectado al `resolveAssetSource` que `@impulso/renderer-konva` expone desde Foundation 3. Al abrir/remontar, `preloadDocumentAssets` repuebla el cache antes del primer render. Ver ADR-0011 para el diseño completo del paquete.

### 3.6 Zoom vía CSS, no vía `stage.scale()`
El zoom es un `transform: scale(...)` CSS sobre el contenedor que envuelve el Stage — Document Schema, Engine y Konva no saben que el zoom existe. Verificado en un navegador real que arrastrar/redimensionar/rotar un object sigue funcionando correctamente con el canvas escaleado.

### 3.7 Duplicar sin un comando nuevo en el Engine
`cloneSceneObjectWithNewIds` (función pura, no un comando — el Engine nunca inventa identidad) clona recursivamente con ids frescos; la app combina esa clonación con el comando `addObject` ya existente.

### 3.8 Bug encontrado y corregido durante la verificación en navegador: el panel de capas rompía el renombrado por doble-click
La primera implementación reconstruía el DOM completo del panel en cada cambio de selección — esto (verificado en Chromium real, no detectado por jsdom) impedía que el navegador reconociera dos clicks consecutivos como un doble-click, porque el primer click ya había reemplazado el elemento antes de que llegara el segundo. Corregido separando reconstrucción completa (`projectChanged`) de una actualización liviana que solo alterna la clase `.selected` sobre las filas existentes (`selectionChanged`), preservando la identidad de los nodos DOM. Ver ADR-0010 para el detalle.

### 3.9 Migración transparente de proyectos guardados en formato Epic 1
Un proyecto guardado antes de esta épica tiene sus imágenes embebidas como data URL (`customProperties.impulsoImageDataUrl`). `legacyMigration.ts` detecta ese formato al "Abrir", convierte cada data URL a `Blob`, lo sube al `AssetBinaryStore`, crea el `ImageAsset` real, limpia la `customProperty` legada, y reporta cuántas imágenes se migraron en el mensaje de estado. `doOpen()` vuelve a guardar tras migrar, así que la migración solo ocurre una vez por proyecto.

### 3.10 Bug de contaminación entre tests corregido con una dependencia inyectable, no con un workaround
Instancias de `App` nunca destruidas entre tests quedaban suscritas a `window`'s `keydown`; un `dispatchEvent` en un test tardío disparaba `doOpen()` en instancias de tests ya completados, con sus stubs de `URL`/`Image` ya revertidos, causando un rechazo no manejado. Se corrigió agregando `keyboardTarget` como dependencia inyectable de `App` (default a `window` en producción vía el fallback ya existente en `keyboardShortcuts.ts`), permitiendo que cada test aísle sus atajos en un `EventTarget` propio.

### 3.11 Exportar reutiliza `@impulso/export-engine` sin conocer PNG/SVG por dentro (Epic 3)
`exportDialog.ts` solo arma `ExportOptions` (formato/escala/fondo/nombre) y llama a `exportProject`/`triggerBrowserDownload`/`sanitizeFilename` del paquete — no sabe que PNG rasteriza vía un Stage headless de Konva ni que SVG es un recorrido puro del Document Schema; ese límite completo vive documentado en ADR-0012, no aquí. El adaptador de Assets es una línea: `{ resolve: (id) => binaryStore.get(id) }`.

### 3.12 "Exportar para impresión" — arquitectura de 3 piezas con una sola responsabilidad cada una (Fase 9.4, ver ADR-0025)

> Guía de usuario (no técnica) de este flujo: [`docs/guides/exportar-para-impresion.md`](../../docs/guides/exportar-para-impresion.md).

`productionPreview.ts` (render puro data-driven, reutiliza exactamente la geometría de `@impulso/print-engine`, nunca la reimplementa), `productionExportController.ts` (dueño exclusivo del estado del wizard de 7 pasos — foto inmutable de `Project`/`PrintJob` tomada al abrir, nunca una lectura en vivo; invalida Preflight ante cualquier cambio; aceptación de advertencias por ejecución, nunca recordada; cancelación real vía `AbortController`), y `productionExportDialog.ts` (la UI en sí, consume el controller vía `subscribe()`/`getState()`, nunca duplica su estado). El botón `#production-export-btn` ("Exportar para impresión") es deliberadamente distinto de `#export-btn` ("Exportar") — dos flujos con propósitos distintos (pantalla rápida vs. producción con Preflight/imposición), nunca fusionados bajo una sola etiqueta.

### 3.13 Bug real encontrado mediante E2E, no hipotético (Fase 9.4)
`ProductionExportController.close()` no reseteaba el paso del wizard de vuelta a `"profile"` — reabrir el diálogo tras cancelar desde un paso intermedio mostraba el título obsoleto de ese paso con un `printJob` ya vacío. Detectado con un test real en Chromium (jsdom nunca lo habría atrapado, al no ejercitar un ciclo completo abrir→cancelar→reabrir de la misma manera), corregido reseteando `step` explícitamente en `close()`. Ver ADR-0025 para el detalle completo.

### 3.14 Hardening del wizard (Fase 9.5) — bugs reales encontrados por verificación exhaustiva, no hipotéticos

- **`startExport()` no despachaba a los exportadores de página única para perfiles sin imposición** — Fase 9.5 primero conectó el selector de 3 perfiles reales (`digital-png`/`print-pdf`/`sticker-sheet`, ver ADR-0025 enmienda), pero `startExport()` seguía llamando SIEMPRE a los exportadores de imposición (que exigen `imposition.mode === "grid"`) — "Digital PNG"/"Print PDF" quedaban seleccionables pero el click en "Exportar" no hacía nada, dejando el wizard colgado en "Preparando…". Corregido despachando por `imposition.mode`; confirmado con 2 escenarios E2E reales que completan cada perfil hasta una descarga real. Ver 2da enmienda de ADR-0025.
- **El auto-avance del paso "Advertencias" nunca disparaba la exportación** cuando Preflight no reportaba ninguna — mismo síntoma visible, causa independiente. Corregido.
- **Un `Shift+Tab` justo después de cualquier cambio de paso podía escapar el foco atrapado del diálogo** — el `<h2>` del título recibe el foco (`tabIndex=-1`, deliberadamente fuera del cálculo del trap) en cada transición; un `Shift+Tab` en ese momento exacto no coincidía con ninguna rama de la lógica de foco atrapado. Reproducido con un test E2E antes del fix, corregido tratando el título como equivalente al primer elemento real.
- **Performance/memoria/resource-leaks del wizard completo verificados en Chromium real** (`e2e/production-export-hardening.spec.ts`, sin mocks): ciclo completo con 200 copias imposicionadas en 526ms; heap observado sin crecimiento desbocado tras 5 ciclos; object URLs/canvases balanceados tras ciclos repetidos de éxito y de cancelación — ningún leak encontrado, el cleanup ya existente era correcto.

## 4. Cómo se verificó (no solo tests unitarios)

Además de los 410 tests (jsdom + stub de canvas), se hizo el build de producción (`vite build`) y se ejecutó el flujo COMPLETO en un **Chromium real** (Playwright, 51 escenarios en total incluyendo `e2e/production-export.spec.ts`/`production-export-hardening.spec.ts`) contra ese build:

- Crear un proyecto nuevo desde el diálogo (preset y personalizado), agregar texto e imagen (PNG), moverlos/escalarlos/rotarlos sobre el canvas real (confirmado en el Inspector), duplicar, eliminar, reordenar por drag-and-drop, agrupar/desagrupar, ocultar/bloquear desde el panel de capas, deshacer/rehacer, hacer zoom (presets y "Ajustar a pantalla").
- Guardar → recargar la página completa (no solo en memoria) → Abrir → el `Project` restaurado, incluidas las imágenes embebidas, es exactamente el guardado.
- Renombrado inline por doble-click en el panel de capas (el bug de §3.8, reproducido y luego confirmado corregido).
- **Cero errores de consola** en todo el flujo.

## 5. Desarrollo

```bash
pnpm --filter @impulso/sticker-builder dev       # servidor de desarrollo
pnpm --filter @impulso/sticker-builder build      # build de producción
pnpm --filter @impulso/sticker-builder preview    # sirve el build de producción
pnpm --filter @impulso/sticker-builder test        # tests
pnpm --filter @impulso/sticker-builder typecheck   # tsc --noEmit
pnpm --filter @impulso/sticker-builder test:e2e     # Playwright, navegador real (ver e2e/, ADR-0012)
```

`e2e/export-visual.spec.ts` compara píxeles reales entre el canvas interactivo del editor y el PNG exportado (relleno de formas, fondo, escala 2x, transparencia) — la verificación repetible de la condición de fidelidad bajo la que se aprobó reutilizar Konva para PNG (ver ADR-0012). `e2e/autosave-recovery.spec.ts` (Epic 8) verifica el indicador de guardado sin intervención manual, salida sin advertencias tras un autosave, Guardar manual, y recuperación desde el banner de la Workspace tras recargar antes del autosave principal — con IndexedDB real, no jsdom. `e2e/production-export.spec.ts` (Fase 9.4/9.5, ver ADR-0025) verifica en Chromium real, sin ningún mock, lo que jsdom no puede: foco atrapado real del wizard de 7 pasos (incluido el escape por `Shift+Tab` de §3.14), anuncio del paso nuevo al lector de pantalla, Preflight bloqueando con texto real, layout responsivo sin overflow en 6 viewports (incluidos 1024×768 y un ancho de tablet, agregados en Fase 9.5), los 3 perfiles completando una descarga real de extremo a extremo, controles de la Production Preview operables 100% por teclado, y el bug real de reseteo de paso (§3.13) que este spec encontró. `e2e/production-export-hardening.spec.ts` (Fase 9.5) verifica performance/memoria/resource-leaks del wizard con datos reales de Chromium (§3.14). `e2e/print-engine.spec.ts`/`e2e/print-preview.spec.ts` (Fase 9.2/9.3) siguen verificando la geometría de bajo nivel del motor sobre sus harnesses temporales, independientes del flujo de producto real. `test:e2e` corre `vite build` antes de `playwright test` (nunca contra un `dist/` desactualizado — incidente detectado y corregido en Epic 8, ver ADR-0019).

## 6. UX (regla permanente "UX First")

### Flujo del usuario
1. Al abrir la app, se ve un documento de demostración ya renderizado.
2. "Nuevo" abre un diálogo con 3 tamaños de sticker curados (cuadrado, circular, rectangular) + una opción "Personalizado" (ancho/alto en mm).
3. "Texto"/"Imagen" en la barra de herramientas insertan un object nuevo centrado en la página, listo para arrastrar a su posición final.
4. Cualquier object se selecciona con click (Shift-click para selección múltiple) tanto en el canvas como en el panel de capas; el Inspector se adapta automáticamente a la selección (0/1/2+ objects).
5. Duplicar/Eliminar/Agrupar/Desagrupar están disponibles como botones (deshabilitados cuando no aplican a la selección actual) y como atajos de teclado.
6. El panel de capas permite reordenar arrastrando filas, expandir un Group para ver (no seleccionar) sus hijos, renombrar con doble-click, y ocultar/bloquear con un ícono por fila.
7. El tab "Assets" del Sidebar izquierdo permite subir una imagen a la biblioteca sin insertarla, ver todas las imágenes subidas en una grilla con miniatura, insertar cualquiera de ellas en el canvas con un click (sin volver a subirla), y eliminarlas de la biblioteca.
8. El zoom (25/50/100/200%, "Ajustar a pantalla", rueda + Ctrl/Cmd) es puramente visual — nunca afecta las medidas reales del documento.
9. "Guardar"/"Abrir" persisten y restauran el proyecto completo, incluidos los Assets; "Abrir" migra automáticamente proyectos guardados en el formato anterior (imágenes embebidas) al nuevo modelo de Asset Library. "Deshacer"/"Rehacer" reflejan el estado real del Engine en los botones.
10. "Exportar" abre un diálogo con formato (PNG/SVG), opciones contextuales por formato (fondo transparente/sólido+color y escala 1x-4x solo para PNG), dimensiones finales calculadas en vivo, nombre de archivo, y descarga automática al confirmar — con warnings visibles si algún Asset no pudo resolverse, y errores claros si la exportación falla.

### Consistencia de interacción
Vocabulario y atajos estándar de cualquier editor de diseño (Ctrl/Cmd+D duplicar, Ctrl/Cmd+G agrupar, Ctrl/Cmd+Z/Shift+Z deshacer/rehacer, flechas para mover 1px/10px con Shift, etc.) — sin inventar convenciones propias donde ya existe una esperada.

### Accesibilidad
Todos los controles de la barra superior/herramientas son elementos `<button>`/`<input>` HTML reales, navegables por teclado, con estado `disabled` nativo reflejando cuándo una acción no aplica. **Limitación conocida:** el mensaje de estado (`#toolbar-status`) no tiene `aria-live`, y la edición dentro del canvas (mover/escalar/rotar/agregar) sigue siendo exclusivamente por puntero.

### Mejoras futuras
- `aria-live="polite"` en el mensaje de estado.
- Confirmación antes de "Nuevo"/"Abrir" si hay cambios sin guardar.
- Guardar/abrir múltiples documentos con nombre, no un único slot fijo.
- Un modo de "entrar" a un Group para seleccionar un hijo individualmente.
- Menú contextual (click derecho) como alternativa descubrible a los atajos de teclado.

## 7. Riesgos y limitaciones conocidas

Ver [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md)/[ADR-0011](../../docs/adr/0011-asset-library.md)/[ADR-0012](../../docs/adr/0012-export-engine.md)/[ADR-0013](../../docs/adr/0013-templates-foundation.md)/[ADR-0014](../../docs/adr/0014-project-library-workspace.md)/[ADR-0019](../../docs/adr/0019-autosave-save-coordinator.md)/[ADR-0020](../../docs/adr/0020-project-recovery.md)/[ADR-0025](../../docs/adr/0025-production-export-workflow.md) para el detalle completo. En resumen:

- **Exportar SVG no detecta fuentes no disponibles** en el visor que abra el archivo, ni reproduce el ajuste automático de línea de un `TextObject` con caja de wrap (solo saltos de línea explícitos).
- **"Exportar para impresión" no permite editar el nombre de archivo** dentro del wizard — usa directamente el nombre del Project al momento de abrir el diálogo (ver UX Audit 0008/0009, sin cambios en Fase 9.5 por diseño — no es hardening).
- **Los issues de Preflight de impresión no se pueden localizar visualmente en el Production Preview** — el paso de Preflight es una lista de texto plano, sin interacción hacia el paso de preview (ver UX Audit 0008/0009).
- **Configuración avanzada de impresión parcial** — márgenes por lado, configuración de cut path (color/grosor/offset), y resolución/PPI de exportación no son editables desde el wizard todavía (heredan el valor ya presente en el `PrintJob`).
- ~~Solo un perfil de impresión imposicionable ("Sticker Sheet")~~ — **resuelto en Fase 9.5**: los 3 perfiles reales (Digital PNG/Print PDF/Sticker Sheet) ahora funcionan de extremo a extremo (ver §3.14, ADR-0025 2da enmienda); "Web Preview" queda deliberadamente fuera del wizard (cubierto por "Exportar" rápido).
- **Sin UI de asignación de `metadata.role: "die-line"`** en el Inspector — un `Project` recién creado sin ese rol asignado siempre bloquea en Preflight (`cut_path_missing`) con el perfil por defecto; brecha del editor en general (ver UX Audit 0008/0009).
- **`ProductionExportController.cancelExport()` no está wireado a ninguna afordancia de UI real** (encontrado en Fase 9.5) — el único "Cancelar" visible usa `close()` (cierre completo, seguro); no se agregó una UI nueva de "cancelar pero seguir abierto" durante hardening.
- **Cross-browser (Firefox/WebKit) sigue sin verificar** — límite del entorno de desarrollo actual (solo Chromium instalado), confirmado en Fase 9.5, no una decisión de producto.
- **Sin deduplicación ni compresión de Assets**: subir la misma imagen dos veces crea dos entradas independientes en la biblioteca (y ambas se embeben completas al exportar).
- **`preloadDocumentAssets` resuelve todos los Assets del documento al abrir/remontar**: no hay carga perezosa — documentos con muchas imágenes grandes pagan ese costo por adelantado (ver `docs/PERFORMANCE_BUDGET.md`).
- **Sin validación de Assets huérfanos**: eliminar un Asset de la biblioteca no valida si algún `ImageObject` todavía lo referencia (el Renderer degrada a un placeholder ante un `assetId` sin resolver).
- **Solo el tipo `image` implementado**: el modelo (`@impulso/document-schema`, `@impulso/asset-library`) ya admite extenderse a fuentes/plantillas/íconos/etc., pero ninguno tiene todavía un ingestion helper ni UI.
- **Agrupar/desagrupar de un solo nivel**: solo opera sobre hijos directos de una Layer, igual que `reorderObjects`.
- **Sin "entrar" a un Group**: siempre se selecciona/edita como una unidad completa.
- **El `<textarea>` de edición de texto in-canvas** no garantiza pixel-match exacto con el `Konva.Text` renderizado (diferencias de fuente/kerning entre el navegador y Konva).
- **Sin modo de herramienta persistente**: Texto/Imagen insertan de inmediato, no "arman" un modo de colocación.
- ~~Sin autosave~~ — **resuelto en Epic 8** (ver ADR-0019): autosave con debounce, indicador de estado, salida segura del editor y recovery ante cierres inesperados. El slot único legado de `localStorage` de Milestone 1/ADR-0009 fue reemplazado en Epic 5 — se conserva únicamente como origen de la migración transparente de una sola vez.
- **El historial de undo/redo no sobrevive a Guardar/salir de la Workspace/recargar** (heredado de ADR-0009, sigue vigente: el historial es efímero por instancia del Engine, no se serializa — el recovery de Epic 8 tampoco lo persiste, ver ADR-0020).
- **El recovery (Epic 8) es una única entrada por proyecto, no un historial de versiones** — un cierre inesperado bien antes del autosave rápido (~400ms) todavía podría perder la edición más reciente (ver ADR-0020).
- **La cuota de IndexedDB agotada** ya se detecta y traduce a un mensaje accionable, pero la app no ofrece ninguna forma de liberar espacio por sí misma más allá de sugerir exportar como respaldo.
- **La UI asume una sola Page/Layer**: el Document Schema soporta múltiples, pero el panel de capas y el Inspector no las exponen todavía.
