# Changelog — @impulso/renderer-konva

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.10.0] — Epic 9 / Fase 9.2: Print Engine — Raster Pipeline & PDF Backend

### Agregado
- `OffscreenRenderOptions` (`offscreenRenderer.ts`) gana 4 opciones nuevas, todas opcionales y sin efecto cuando no se usan: `canvasSizePx`/`contentOffsetPx` (Stage extendido al tamaño del BleedBox, contenido desplazado dentro de él vía un `Konva.Group` contenedor, sin mover ningún `SceneObject` real ni activar clipping — confirma para esta fase lo verificado en Fase 9.1/ADR-0021), `contentScale` (aplica `PrintJob.scale` al mismo Group, ANCLADO en el origen del TrimBox — traslación primero, escala después, verificado con matemática exacta: `(8,8)` de offset + `(10,10)` local + escala 2 = `(28,28)` absoluto, no `(8+10)×2`), y `shouldRenderObject(object, context)` (predicado de filtrado recursivo y coherente en groups mixtos, reemplaza la necesidad de un solo `excludeMetadataRole`; nunca deja un Group vacío innecesario; la medición y el dibujo usan siempre el mismo filtro).
- Consumido por la nueva `renderPrintPage` de `@impulso/print-engine` (Fase 9.2) para construir el raster físico con sangrado real — ver [ADR-0022](../../docs/adr/0022-print-engine-raster-pipeline.md).
- Sin ninguna opción nueva, el árbol Konva producido es idéntico al de Epic 3/Fase 9.1 — verificado explícitamente con tests dedicados, no solo por inspección. Estas opciones nunca afectan el recorte/interacción del editor visible (`renderer.ts`/`mount`), exclusivas del pipeline offscreen.
- 229 tests en total (213 → 229; 27 en `offscreenRenderer.test.ts`, antes 15). Sin dependencias circulares (verificado con `madge`).

## [0.9.0] — Epic 7 / Fase 7.4: Professional Multi Selection

### Agregado
- `manipulation/groupHandles.ts` (nuevo): caja envolvente compartida + 8 handles de resize + 1 handle de rotación para 2+ objects seleccionados — reemplaza el resaltado punteado simple de Editor 2 cuando hay 2+ objects **transformables** (no bloqueados). Mismo invariante preview/commit que `handles.ts`: el preview mueve directamente los nodes Konva de cada member (sin `dispatch`), y el commit usa la MISMA matemática pura (`@impulso/engine` 0.10.0) para construir los patches finales — preview y estado final nunca pueden divergir.
  - **Movimiento**: arrastrar la caja compartida traduce todos los members por el mismo delta; arrastrar el CUERPO de cualquier member ya seleccionado reenvía el gesto a la caja compartida vía `Konva.Node.startDrag()` (API pública de Konva pensada para esto) — cada member deja de ser individualmente `draggable` mientras la selección es 2+ (`renderer.ts` restaura ese estado al bajar a 0/1).
  - **Resize**: los 8 handles escalan el grupo desde el ancla opuesta; a diferencia del resize individual, el snapping funciona SIN restricción de rotación (la caja envolvente del grupo siempre es un AABB puro).
  - **Rotación**: gira todo el grupo alrededor del centro de su caja envolvente inicial; conserva únicamente el snap angular existente (15° vía Shift), sin Smart Guides angulares.
  - **Sesión efímera**: snapshot inicial capturado una sola vez (`initialMembers`); un gesto sin cambio neto (no-op) o cancelado (Escape/`blur`/`pointercancel`) nunca dispatcha ni deja preview visual — se descarta con un re-render completo desde el Project real, reutilizando el mismo callback `onRejected`/`onNeedsRefresh` que ya existía para un `dispatch` rechazado.
  - **Política de objects bloqueados**: nunca forman parte del subconjunto transformable (ni individual ni grupal); conservan su propio indicador de selección simple en paralelo a la caja compartida del resto. Esto también cierra un gap preexistente: los handles de resize/rotación de un solo object ahora se ocultan si ese object está bloqueado (antes eran `draggable: true` incondicionalmente).
- `manipulation/interactiveBounds.ts` (nuevo): `clampPointToStageBounds` — recorte de rayo contra rectángulo que mantiene el handle de rotación siempre dentro del área interactiva del Stage, para cualquier ángulo (ver ADR-0018, corrige el bug de severidad alta detectado en Fase 7.3.5). Usado tanto por `handles.ts` (selección individual) como por `groupHandles.ts` (selección múltiple) — mismo comportamiento en ambos casos.
- `RendererAdapter.cancelActiveManipulation()` (nuevo): cancela el gesto grupal activo, si hay uno — usado por `apps/sticker-builder`'s `Escape` para cancelar una manipulación en curso antes de limpiar la selección.
- `handles.ts`/`cursors.ts` exportan ahora `HANDLE_SIZE`/`HANDLE_FILL`/`HANDLE_STROKE`/`ROTATE_HANDLE_OFFSET`/`isSnapDisabledByModifier`/`eligibleRefPointsForHandle` — reutilizados por `groupHandles.ts` para que ambos sistemas compartan el mismo estilo visual y las mismas reglas de snapping por handle.
- Adición pura a la API pública existente (incluyendo el método nuevo de `RendererAdapter`) — no requiere ADR de cambio de API (regla de Stable Public API), pero sí dos ADR de arquitectura nuevos (ADR-0017, ADR-0018).
- 213 tests en total (40 nuevos: 23 en `manipulation/groupHandles.test.ts`, 8 en `manipulation/interactiveBounds.test.ts`, 3 en `manipulation/groupHandles.performance.test.ts`, 3 en `manipulation/handles.test.ts`, 3 en `renderer.test.ts`). Verificado además en Chromium real (`e2e/multi-selection.spec.ts`): reenvío de drag vía `startDrag()`, cancelación real por `Escape` con blur/pointercancel, y atomicidad de Undo — mecanismos que dependen de gestos de puntero reales, no observables desde jsdom. Sin dependencias circulares (verificado con `madge`).

## [0.8.0] — Epic 7 / Fase 7.3: Assisted Placement

### Agregado
- `manipulation/smartGuides.ts` (nuevo): puente Konva ↔ `computeSnap` (`@impulso/engine` 0.9.0) — `beginSnapGesture`/`updateSnapGesture`/`endSnapGesture`. Dibuja Smart Guides en un tercer `Konva.Layer` (`guidesLayer`, siempre `listening: false`), entre `mainLayer` y `selectionLayer`.
- `transformInteractions.ts` (move) gana `dragmove` por primera vez — snapping en vivo siguiendo el mismo patrón preview/commit que `handles.ts` ya usaba desde Editor Epic 1.
- `handles.ts` (resize) gana snapping — restringido a objects sin rotación y que no sean `Ellipse` (`canSnapDuringResize`); el preview snapeado se invierte a un `pointerDelta` equivalente antes de `dragend`, para que preview y commit nunca diverjan. Shift (mantener proporción) desactiva el snap ese frame.
- Ctrl/Cmd desactiva todo snapping mientras se mantiene presionado (move y resize), sin conflicto con ningún atajo existente.
- `KonvaRendererOptions.getZoom` (nuevo, opcional): normaliza la tolerancia de snap por el zoom CSS actual — `() => 1` por defecto.
- Token visual `--impulso-snap-guide-color` (leído vía `getComputedStyle`, con fallback propio) — primer color de este paquete que no está hardcodeado.
- Adición pura a la API pública existente — no requiere ADR de cambio de API (regla de Stable Public API); el razonamiento de diseño completo vive en ADR-0016.
- 24 tests nuevos (173 en total): `manipulation/smartGuides.test.ts` (11), snapping en `interactions/transformInteractions.test.ts` (6) y `manipulation/handles.test.ts` (7). Sin dependencias circulares (verificado con `madge`).

## [0.7.0] — Epic 7 / Fase 7.2: Batch Operations + Alignment

### Agregado
- `computeObjectBoundingBox(node, object)` (`manipulation/boundingBox.ts`): puente entre `computeManipulationBox` (mide vía Konva, ya existente) y `computeRotatedBoundingBox` (`@impulso/engine` 0.8.0, pura) — el AABB real de cualquier object rotado/escalado, sin duplicar la trigonometría de rotación. Consumido por Alignment (`apps/sticker-builder`) para calcular la caja de cada object seleccionado antes de alinear/distribuir.
- Adición pura a la API pública existente — no requiere ADR de cambio de API (regla de Stable Public API); el razonamiento de diseño completo vive en ADR-0015.
- 5 tests nuevos (149 en total), 100% de cobertura mantenida en el archivo modificado. Sin dependencias circulares (verificado con `madge`).

## [0.6.0] — Epic 3: Export Engine Foundation

### Agregado
- `renderPageToStage` (`offscreenRenderer.ts`): construye un `Konva.Stage` headless (desacoplado del editor, sin `selectionLayer`, sin interactividad) reutilizando `createSceneNode` 1:1 — usado por `@impulso/export-engine` para rasterizar PNG con fidelidad pixel a pixel al canvas interactivo.
- `resolveActivePage` ahora es un export público (antes privado a `renderer.ts`) — mismo criterio de "qué Page es la activa" reutilizado por el Export Engine.
- 11 tests nuevos (144 en total).

### Cambiado
- `segmentsToSvgPathData` y `toPixels` se relocalizaron a `@impulso/document-schema` (ambas puras, sin dependencia de Konva; ahora también las necesita `@impulso/export-engine`) — este paquete las re-exporta desde `nodes/path.ts`/`unit.ts` respectivamente, sin cambio de comportamiento ni de API pública. Ver ADR-0012.

## [0.5.0] — Sticker Creation Experience

### Agregado
- `NodeContext.interactive` (opcional, aditivo): cuando es `false`, un node no recibe sus propias interacciones de selección/transform/edición de texto — usado para que los hijos de un `group` actúen como una única unidad seleccionable/arrastrable, en vez de responder cada uno por separado. `createGroupNode` lo pone en `false` para todos sus hijos, a cualquier profundidad.
- `interactions/textEditingInteractions.ts`: doble-click sobre un `TextObject` superpone un `<textarea>` HTML real (posicionado/rotado/escalado exactamente sobre el node) para editar su contenido in-canvas — capacidad anticipada desde ADR-0004 ("Konva.Text no es editable in-canvas"), implementada aquí por primera vez. Confirma con blur/Enter (`engine.dispatch({type:"updateObjectContent", ...})`), cancela con Escape sin despachar nada.
- 40 tests nuevos (140 en total), 100% de cobertura en statements/functions/lines.

### Corregido (comportamiento, no de la API pública)
- Antes de esta versión, hacer click o arrastrar un hijo dentro de un `group` lo seleccionaba/movía INDIVIDUALMENTE (cada hijo tenía sus propias interacciones activas) — contrario a la convención de cualquier editor de diseño profesional, donde un group se comporta como una sola unidad hasta desagruparlo. Corregido desactivando `draggable` y las interacciones propias de cualquier node anidado dentro de un group; Konva ya resuelve correctamente que un mousedown sobre un hijo no-draggable inicie el arrastre del ancestro draggable más cercano (el propio Group), sin código adicional de hit-testing.

## [0.4.0] — Editor Epic 1 (Manipulation System)

### Agregado
- Sistema completo de manipulación de un único object seleccionado: bounding box real (sigue la rotación, no una caja alineada a ejes), 8 handles de resize (esquinas + bordes) y 1 handle de rotación, todos nodos Konva interactivos reales.
- `manipulation/boundingBox.ts`: geometría pura (pivote, tamaño intrínseco vía `getSelfRect()`/`getClientRect({skipTransform:true})`, puntos locales de cada handle, rotación local -> espacio del padre).
- `manipulation/handles.ts`: cablea `dragmove` (previsualización en vivo llamando a `computeResizedTransform`/`computeRotatedTransform` del Engine, sin `dispatch`) y `dragend` (`engine.dispatch({type:"resizeObject"|"rotateObject", ...})`) — mismo patrón preview/commit que `transformInteractions.ts` desde Editor 3. `maintainAspectRatio`/`snapToIncrement` se activan con Shift. Los handles de borde restringen su arrastre al eje local correcto (`dragBoundFunc`); los de esquina se arrastran libres.
- `manipulation/cursors.ts`: cursor CSS por handle (`nwse-resize`/`nesw-resize`/`ns-resize`/`ew-resize`/`grab`) vía `mouseenter`/`mouseleave` sobre `stage.container()`.
- `renderSelectionOverlay()` ahora dibuja la caja de manipulación completa cuando hay EXACTAMENTE un object seleccionado; con 0 o 2+ ids conserva el resaltado simple de Editor 2.
- Hit testing: ninguno propio — se apoya en el sistema de eventos nativo de Konva sobre los handles, igual que el resto de las interacciones desde Foundation 3.
- 44 tests nuevos (122 en total), 100% de cobertura en `manipulation/`. Sin dependencias circulares (madge).

### Corregido
- `selectionLayer` ya no se crea con `listening: false` a nivel de Layer completa — bloqueaba silenciosamente TODOS los eventos de puntero de cualquier node interactivo agregado a esa capa (incluidos los nuevos handles). Los overlays puramente decorativos (resaltado de multi-selección, contorno del bounding box) siguen sin ser interactivos, pero ahora porque cada node individual fija su propio `listening: false`, no la Layer entera. Detectado con Playwright contra un navegador real — los tests jsdom existentes (`.fire(...)`) no ejercitan el hit-graph real de Konva y no lo habrían detectado.

## [0.3.0] — Editor 3 (Transform System)

### Agregado
- `dragstart` ahora asegura que el object arrastrado esté en la selección (`setSelection`) si no lo estaba ya, sin colapsar una selección múltiple existente — el resaltado visual acompaña el arrastre desde el primer frame, no solo al soltar.
- `NodeContext.getSelection` (opcional, aditivo): permite a `transformInteractions` consultar la selección actual.

### Cambiado (refactor interno, sin cambios de la API pública)
- La lógica de traducción de eventos se reorganizó de `baseAttrs.ts` a dos módulos nuevos en `interactions/`: `selectionInteractions.ts` (click) y `transformInteractions.ts` (arrastrar) — preparando el mismo patrón para futuros `resizeInteractions.ts`/`rotateInteractions.ts`. `baseAttrs.ts` queda reducido a fijar atributos estáticos.

### Sin cambios en otros paquetes
`@impulso/document-schema` y `@impulso/engine` no requirieron ninguna modificación — `updateObjectTransform` ya estaba diseñado desde Foundation 2 para aceptar transformaciones parciales.

## [0.2.0] — Editor 2 (Selection System)

### Agregado
- Selección por click: click reemplaza la selección, Shift-click alterna (agrega/quita) un object de la selección múltiple, click en área vacía del Stage limpia la selección. La semántica vive en `@impulso/engine` (`toggleObjectSelection`); este paquete solo traduce el gesto crudo.
- Indicador visual de selección: un `Konva.Layer` separado (`selectionLayer`, no interactivo) dibuja un contorno punteado sobre cada object seleccionado, redibujado solo en `selectionChanged` — sin reconstruir el contenido.

### Cambiado (comportamiento interno, no de la API pública)
- Un object con `metadata.locked: true` ahora sigue siendo `listening` (seleccionable por click); antes de este cambio dejaba de escuchar eventos por completo. `draggable` se mantiene en `false` para objects bloqueados. Ver ADR-0006.

## [0.1.0] — Foundation 3

### Agregado
- `createKonvaRenderer(engine, options)`: primer `RendererAdapter` concreto — `mount(container)`, `destroy()`, `getStage()`.
- Mapeo completo de los 6 tipos de `SceneObject` (Rectangle, Ellipse, Path, Image, Text, Group recursivo) a nodos Konva.
- Traducción de `PathSegment[]` (formato propio del Document Schema) a sintaxis de path SVG que Konva consume.
- Traducción del único gesto de interacción de este Foundation — arrastrar (`dragend`) — en `engine.dispatch({type: "updateObjectTransform", ...})`, con reversión visual si el Engine rechaza el cambio.
- Un único `Konva.Layer` por Stage; cada Layer del Document Schema se mapea a un `Konva.Group` (evita el antipatrón de "muchos canvases").
- Conversión de unidades físicas (mm/in) a píxeles de Stage, y de coordenadas Document Schema ↔ Konva (la única asimetría: `Konva.Ellipse` se posiciona por el centro).
- Placeholder para `Image` sin `resolveAssetSource` inyectado (no hay gestión de Assets todavía).
- Respeta `metadata.visible`/`metadata.locked` de Layer y Object (visibilidad y si el object es arrastrable).
- Stub propio de `CanvasRenderingContext2D` para testear Konva en jsdom sin el paquete nativo `canvas`.
- 62 tests, 100% de cobertura, sin dependencias circulares (madge).

### Fuera de alcance (deliberado)
Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Handles, Selection visual, Exportaciones, gestión de Assets/Fonts, lógica específica de Sticker Builder.
