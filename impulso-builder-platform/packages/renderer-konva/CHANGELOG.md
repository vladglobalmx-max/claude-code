# Changelog — @impulso/renderer-konva

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
