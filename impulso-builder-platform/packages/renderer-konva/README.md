# @impulso/renderer-konva

> FOUNDATION 3 (base) + EDITOR 2 (selección) + EDITOR 3 (movimiento) + EDITOR EPIC 1 (manipulación) + Sticker Creation Experience (grupos, edición de texto) + Export Engine Foundation (Stage headless para PNG, Epic 3) de Impulso Builder Platform. El primer `RendererAdapter` concreto: traduce Document Schema → Scene Graph → Konva, y eventos de Konva → llamadas al Engine. El único paquete de la plataforma que depende de Konva. Ver [ADR-0004](../../docs/adr/0004-renderer-adapter.md) (base), [ADR-0006](../../docs/adr/0006-selection-system.md) (selección), [ADR-0007](../../docs/adr/0007-transform-system.md) (movimiento), [ADR-0008](../../docs/adr/0008-manipulation-system.md) (resize/rotate/handles), [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md) (grupos, texto editable) y [ADR-0012](../../docs/adr/0012-export-engine.md) (Stage headless) para el razonamiento completo, y [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md) para el análisis de rendimiento.

**Estado:** completo, incluyendo selección visual (Editor 2), movimiento por arrastre (Editor 3), el sistema completo de manipulación (Editor Epic 1), grupos que actúan como una sola unidad seleccionable/arrastrable más edición de texto in-canvas (Sticker Creation Experience), y un Stage headless reutilizado por `@impulso/export-engine` para rasterizar PNG (Epic 3). No implementa Canvas UI, Toolbar, Sidebar, Zoom, Pan, Inspector, Layers Panel ni la exportación en sí (el string SVG/la orquestación de export viven en `@impulso/export-engine`) — eso es alcance de la app o de ese paquete, no de este.

---

## 1. Qué es y qué no es

```
Document Schema  →  Engine  →  Renderer (este paquete)  →  Konva
```

- **Sí hace:** dado un `Engine` (de `@impulso/engine`), construye y mantiene sincronizado un árbol de nodos Konva reales a partir de `engine.getProject()`; traduce los gestos de interacción soportados (arrastrar, click, Shift-click) en `engine.dispatch(...)`; muestra un indicador visual de qué está seleccionado, leyendo `engine.getSelection()`.
- **No hace:** no contiene reglas de negocio, no muta el Document Schema directamente (todo pasa por `engine.dispatch`), no implementa comandos ni historial (eso ya existe en `@impulso/engine`) — incluida la lógica de QUÉ hace un Shift-click con la selección, o qué transform resulta de un arrastre (eso vive en el Engine: `toggleObjectSelection`, `updateObjectTransform`), no persiste nada, no sabe qué es un "sticker" ni una "línea de corte" — solo dibuja un `path` con las propiedades que tiene, sin interpretar su `metadata.role`.

## 2. Árbol del paquete

```
packages/renderer-konva/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts              # API pública
    ├── types.ts               # RendererAdapter, KonvaRendererOptions, NodeContext
    ├── renderer.ts             # createKonvaRenderer() — mount/renderContent/renderSelectionOverlay/destroy; exporta resolveActivePage
    ├── offscreenRenderer.ts     # renderPageToStage() — Stage headless para @impulso/export-engine (PNG), Epic 3
    ├── baseAttrs.ts            # SOLO atributos estáticos — delega interacción a interactions/
    ├── coordinates.ts          # toKonvaXY/fromKonvaXY (la única asimetría: Ellipse se posiciona por el centro)
    ├── style.ts                # applyShapeStyle + blendMode -> globalCompositeOperation
    ├── unit.ts                 # re-exporta toPixels (relocalizado a @impulso/document-schema en Epic 3)
    │
    ├── interactions/
    │   ├── selectionInteractions.ts   # click/Shift-click -> setSelection/toggleObjectSelection
    │   ├── transformInteractions.ts   # dragstart (asegura selección) / dragend -> updateObjectTransform
    │   └── textEditingInteractions.ts # dblclick -> <textarea> superpuesto -> updateObjectContent
    │
    ├── manipulation/
    │   ├── boundingBox.ts      # geometría pura: pivote, tamaño intrínseco, puntos locales de cada handle
    │   ├── cursors.ts          # handle -> cursor CSS
    │   └── handles.ts          # crea/posiciona los 8 handles de resize + 1 de rotación, cablea sus gestos
    │
    ├── nodes/
    │   ├── rectangle.ts | ellipse.ts | path.ts | image.ts | text.ts | group.ts
    │   │   (path.ts re-exporta segmentsToSvgPathData, relocalizado a @impulso/document-schema en Epic 3)
    │   └── sceneNode.ts        # dispatcher: SceneObject -> el creador correcto (recursivo para group)
    │
    ├── testing/
    │   └── fakeCanvasContext.ts  # stub de CanvasRenderingContext2D para testear Konva sin `canvas` nativo
    │
    └── testUtils/
        └── fixtures.ts          # builders de Project/Page/Layer/SceneObject para tests

    (144 tests, ~99.7% de statements/lines, ~98% de branches/functions — ver "Riesgos")
```

## 3. Arquitectura

### 3.1 El ciclo mount → render → destroy

```
mount(container)
  → new Konva.Stage + 2 Konva.Layer: mainLayer (contenido) y selectionLayer (overlay, ver 3.3b)
  → stage.on("click"): click que no llegó a ningún object -> engine.dispatch(clearSelection)
  → renderContent() inicial
  → engine.subscribe():
      "projectChanged"    -> renderContent()   (rebuild completo, ver 3.4)
      "selectionChanged"  -> renderSelectionOverlay()  (NO reconstruye el contenido)

renderContent()
  → lee engine.getProject() y resuelve la página activa (options.pageId, o la primera)
  → mainLayer.destroyChildren()
  → stage.width/height <- toPixels(page.size, page.unit)
  → por cada Layer del documento: un Konva.Group (id = layer.id, visible/listening <- metadata)
  → por cada SceneObject: createSceneNode() (recursivo para group)
  → mainLayer.batchDraw()
  → renderSelectionOverlay()  (los nodos son nuevos: el overlay debe recalcularse)

renderSelectionOverlay()
  → selectionLayer.destroyChildren()
  → si getSelection() tiene EXACTAMENTE 1 id: renderManipulationHandles()
    (bounding box real + 8 handles de resize + 1 de rotación, ver 3.8)
  → si no (0 o 2+ ids): por cada id, un Konva.Rect punteado sobre su
    bounding box (getClientRect) — el resaltado simple de Editor 2
  → selectionLayer.batchDraw()

destroy()
  → unsubscribe del Engine
  → stage.destroy() (limpia el DOM que Konva insertó en el container)
```

### 3.2 Traducción de eventos: arrastrar (Transform System), click, Shift-click (Selection System)

Dos módulos en `interactions/`, aplicados por `applyBaseAttrs` a cada nodo — la SEMÁNTICA de cada uno vive en el Engine, aquí solo se traduce el hecho crudo:

**`interactions/selectionInteractions.ts` — `click`:** si `Shift` NO estaba presionado, `engine.dispatch({ type: "setSelection", objectIds: [object.id] })` (reemplaza la selección). Si `Shift` SÍ estaba presionado, `engine.dispatch({ type: "toggleObjectSelection", objectId: object.id })` (agrega/quita de la selección actual). Se detiene la propagación (`cancelBubble = true`) para que el click no también dispare el "click en vacío" del Stage.

**`interactions/transformInteractions.ts` — `dragstart`/`dragend` (Editor 3):**
- `dragstart`: si el object arrastrado NO estaba ya en `engine.getSelection()`, lo selecciona (`setSelection([object.id])`) — así el resaltado acompaña el arrastre desde el primer frame. Si ya formaba parte de una selección múltiple, esa selección no se colapsa.
- `dragend`: lee la posición final del nodo Konva (`node.x()/y()`), convertida de vuelta con `fromKonvaXY` (solo difiere para `ellipse`), y llama `engine.dispatch({ type: "updateObjectTransform", ... })`. Si el Engine rechaza el cambio, fuerza un `renderContent()` para revertir la posición visual. **No** se despacha nada en cada `dragmove` — Konva ya mueve el nodo visualmente en tiempo real sin necesidad de tocar al Engine; ver ADR-0007, "Rendimiento".

Un object con `metadata.locked: true` se crea con `draggable: false` (no se puede mover, y por lo tanto nunca dispara `dragstart`/`dragend`) pero `listening` sigue dependiendo solo de `metadata.visible` — un object bloqueado **sigue siendo seleccionable** por click; solo dejó de ser arrastrable. Cambio de comportamiento respecto a Foundation 3 (antes, bloqueado implicaba `listening: false`) — no de la API pública; documentado en [ADR-0006](../../docs/adr/0006-selection-system.md).

### 3.3 Un solo `Konva.Layer` de contenido, no uno por Layer del documento

Cada `Layer` del Document Schema se mapea a un `Konva.Group` (agrupación lógica, sin costo de canvas), no a un `Konva.Layer` (que sí es un canvas real). Konva documenta explícitamente que tener muchos `Layer` es un antipatrón — un documento con decenas de layers de edición (razonable en un editor tipo Photoshop) habría creado decenas de canvases si se hubiera mapeado 1:1.

### 3.3b Un segundo `Konva.Layer` para la selección — a propósito, no una excepción a lo anterior

El overlay de selección (Editor 2) vive en su **propio** `Konva.Layer` (`selectionLayer`), separado de `mainLayer`. No contradice 3.3: son dos layers *fijos* (contenido + UI de selección), no uno por cada Layer del documento. Es, de hecho, el patrón que la propia documentación de Konva recomienda para UI que cambia con más frecuencia que el contenido (selección, indicadores de arrastre) — así un click no dispara un rebuild completo de la escena, solo redibuja un puñado de rectángulos en una capa aparte. Ver ADR-0006, sección "Rendimiento".

Hasta Editor 3, `selectionLayer` se creaba con `listening: false` (nada dentro de ella necesitaba recibir eventos — el resaltado punteado es puramente visual). **Desde Editor Epic 1 la Layer entera escucha eventos** (`new Konva.Layer()`, sin la opción): los handles de resize/rotación viven ahí y necesitan recibir `dragstart`/`dragmove`/`dragend`/`mouseenter`/`mouseleave`. El contorno punteado de multi-selección y las líneas del bounding box de manipulación siguen sin ser interactivos, pero ahora por una razón distinta — cada uno fija `listening: false` en su propio node, no porque la Layer los bloquee a todos. Ver "Riesgos": este cambio se detectó tarde porque los tests con jsdom (`.fire(...)`) no lo habrían revelado nunca.

### 3.4 Reconciliación: rebuild completo del contenido (a propósito, con su costo documentado)

`renderContent()` no diffea el árbol anterior contra el nuevo — destruye y reconstruye todos los nodos Konva de la página activa en cada `projectChanged`. Es la implementación más simple y correcta, elegida deliberadamente siguiendo la regla del Performance Budget ("no optimizar prematuramente, pero documentar el camino"): el costo (O(objetos de la página) por render, sin importar cuán pequeño fue el cambio real) y la estrategia de reconciliación incremental futura están documentados en [ADR-0004](../../docs/adr/0004-renderer-adapter.md#rendimiento) y en [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md). `renderSelectionOverlay()` es deliberadamente independiente de ese costo — ver 3.3b.

### 3.5 Coordenadas: por qué existe `coordinates.ts`

El Document Schema trata `transform.x/y` como la esquina superior izquierda — consistente para Rectangle/Path/Image/Text/Group. `Konva.Ellipse`, por diseño de Konva, posiciona su nodo por el **centro**. `toKonvaXY`/`fromKonvaXY` son el único lugar donde esa conversión ocurre, en ambos sentidos (aplicar transform → Konva, y leer de vuelta tras un drag → Document Schema).

### 3.6 Imágenes sin binario: placeholder, no un error

`ImageObject.assetId` es una referencia; el binario real no existe todavía como concepto en la plataforma (no hay Foundation de Assets). Sin un `resolveAssetSource` inyectado en las opciones, una Image se dibuja como un rectángulo punteado del tamaño correcto — no lanza, no inventa píxeles. `resolveAssetSource` es el punto de extensión ya preparado para cuando exista esa Foundation.

### 3.7 Testing sin navegador ni dependencias nativas

jsdom no implementa un contexto 2D real (requiere el paquete nativo `canvas`, que no compiló en este entorno por faltar `pangocairo` del sistema — ver ADR-0004). `src/testing/fakeCanvasContext.ts` es un stub propio (~70 líneas, cero dependencias) que reemplaza `HTMLCanvasElement.prototype.getContext('2d')` con no-ops suficientes para que Konva construya su árbol, dibuje sin lanzar, y dispare eventos sintéticos (`.fire('dragend')`). No produce píxeles reales — no es su propósito; prueba la ESTRUCTURA del árbol Konva y la traducción de eventos, no el resultado visual.

`vitest.config.ts` fuerza `resolve.mainFields: ["browser", ...]` porque Konva usa el campo clásico `package.json` `"main"` (build de Node, requiere `canvas`) vs `"browser"` (usa el DOM real) — Vite/Vitest por defecto resuelven `"main"` incluso con `environment: "jsdom"`.

### 3.8 Manipulación (Editor Epic 1): bounding box, handles, resize, rotación

Ver [ADR-0008](../../docs/adr/0008-manipulation-system.md) para el razonamiento de diseño completo. Resumen de cómo encaja en este paquete:

**Geometría (`manipulation/boundingBox.ts`), pura y sin Konva-específico salvo el tipo de entrada:**
- `computeManipulationBox(node, object)`: mide el `intrinsicSize` real del node (`node.getSelfRect()` para cualquier `Konva.Shape`; `node.getClientRect({ skipTransform: true })` para `Konva.Group`, que no implementa `getSelfRect`), y devuelve el pivote (la posición Konva real del node — esquina superior izquierda o centro para `ellipse`, la misma asimetría de `coordinates.ts`), la rotación actual, y el tamaño ya escalado.
- `localHandlePoint`/`localRotateHandlePoint`: las 8 posiciones de handle + la del handle de rotación, en espacio LOCAL (sin rotar) relativo al pivote.
- `localToParent`: rota un punto local al espacio de `mainLayer`/`selectionLayer`, con la MISMA convención de giro que `computeResizedTransform` (Engine) usa para reubicar el anclaje — así el bounding box dibujado sigue exactamente la orientación real del object, incluso rotado (no es una caja alineada a ejes tipo `getClientRect`).

**Handles (`manipulation/handles.ts`) — mismo patrón preview/commit que `transformInteractions.ts` desde Editor 3:**
- `dragmove` de un handle de resize llama `computeResizedTransform` (Engine, función pura) y aplica el resultado directamente al node de contenido vía `setAttrs` — previsualización instantánea, sin `dispatch`, sin rebuild.
- `dragend` llama `engine.dispatch({ type: "resizeObject", ... })` con el `pointerDelta` acumulado desde el inicio del gesto — el reducer del Engine recalcula con la MISMA función pura, así que preview y estado final commiteado son matemáticamente idénticos.
- El handle de rotación sigue el mismo patrón con `computeRotatedTransform`, calculando el ángulo con `atan2` desde el pivote del object hasta la posición actual del handle.
- **Restricciones (Shift):** `maintainAspectRatio` (resize) y `snapToIncrement` (rotación, a 15°) se activan leyendo `evt.evt.shiftKey` del propio evento de Konva — ninguna lógica de "qué hace Shift" vive aquí, solo se reenvía la tecla al Engine.
- **Anclaje del eje de arrastre:** los handles de BORDE (`top`/`bottom`/`left`/`right`) tienen un `dragBoundFunc` que proyecta el arrastre sobre el eje local correspondiente (rotado si el object lo está) — así el handle se desliza visualmente sobre el borde real, en vez de despegarse en diagonal. Los handles de ESQUINA se arrastran libres en 2D (convención estándar de cualquier editor de diseño).

**Hit testing:** no hay ningún algoritmo propio. Los 8 handles + el de rotación son nodos Konva reales, interactivos (`draggable`, `mouseenter`/`mouseleave`) — Konva ya resuelve qué handle está bajo el puntero con su propio sistema de eventos, el mismo que ya usan `selectionInteractions`/`transformInteractions` desde Foundation 3. No se reinventó nada aquí a propósito.

**Cursor feedback (`manipulation/cursors.ts`):** `mouseenter`/`mouseleave` sobre cada handle fijan/limpian `stage.container().style.cursor` (`nwse-resize`, `nesw-resize`, `ns-resize`, `ew-resize` según el handle; `grab` para el de rotación). Es CSS puro sobre el contenedor del Stage, sin ninguna dependencia nueva.

**Single- vs multi-selección:** `renderSelectionOverlay()` solo dibuja la caja de manipulación completa cuando `engine.getSelection()` tiene EXACTAMENTE un id. Con 0 o 2+ ids seleccionados, se conserva el resaltado simple de Editor 2 (un `Konva.Rect` punteado por object) — mover/redimensionar varios objects a la vez queda fuera de alcance de este épico.

### 3.9b Stage headless para exportación PNG (`offscreenRenderer.ts`, Epic 3)
`renderPageToStage(project, options)` construye un `Konva.Stage` DESACOPLADO del editor — su `container` es un `<div>` que nunca se agrega al DOM visible, sin `selectionLayer`, con `interactive: false` en cada node (nunca se adjuntan handlers de drag/selección/edición de texto). Reutiliza `createSceneNode` 1:1: el `@impulso/export-engine` que lo invoca (para rasterizar PNG vía `stage.toCanvas({ pixelRatio })`) obtiene exactamente el mismo dibujo que ya ve el usuario en el canvas interactivo, sin reimplementar layout de texto/curvas/sombras por separado. `dispatch` en su `NodeContext` lanza si se invoca — nunca debería pasar con `interactive: false`, es una guarda de desarrollo, no un camino real. Ver ADR-0012 para el límite completo entre este paquete y el Export Engine (SVG nunca pasa por aquí).

### 3.9 Grupos como una sola unidad, y edición de texto in-canvas (Sticker Creation Experience)

**Un `group` se comporta como una única unidad**, no como una colección de objects independientemente seleccionables/arrastrables — la convención estándar de cualquier editor de diseño (Figma, Illustrator): seleccionar/mover cualquier parte de un grupo selecciona/mueve el grupo completo, no el hijo individual bajo el puntero. Se logra con `NodeContext.interactive` (opcional, `true` por defecto): `createGroupNode` construye a sus hijos con `interactive: false`, y `applyBaseAttrs` responde a eso de dos formas — nunca marca al node como `draggable` (sin importar `metadata.locked`), y nunca le adjunta sus propias interacciones de selección/transform/edición de texto. Un mousedown/click sobre un hijo así configurado sigue siendo un objetivo de hit-testing válido (`listening` no cambia), así que el evento burbujea hasta el Group — que sí tiene sus propias interacciones y `draggable` activo — sin que este paquete tenga que reimplementar ningún hit-testing propio: es el comportamiento nativo de Konva ante un hijo no-arrastrable dentro de un ancestro arrastrable. Editar un hijo individual (mover, redimensionar, cambiar texto) requiere desagrupar primero — no se construyó "entrar al grupo" con doble-click en esta versión (ver "Riesgos").

**Edición de texto in-canvas** (`interactions/textEditingInteractions.ts`): doble-click sobre un `TextObject` oculta el node de Konva y superpone un `<textarea>` HTML real, posicionado/rotado/escalado exactamente sobre su bounding box. Escribir ahí es edición local del navegador (sin dispatch); al perder el foco o presionar Enter (sin Shift) se confirma con `engine.dispatch({type:"updateObjectContent", ...})` — Escape cancela sin despachar nada, restaurando el node tal como estaba. Un texto anidado dentro de un group (`interactive: false`) tampoco es editable individualmente, mismo criterio que selección/transform.

---

## 4. Ejemplos de uso

```ts
import { createEngine } from "@impulso/engine";
import { createKonvaRenderer } from "@impulso/renderer-konva";

const engine = createEngine(myProject);
const renderer = createKonvaRenderer(engine);

const container = document.getElementById("editor-canvas") as HTMLDivElement;
renderer.mount(container);

// El Renderer se mantiene sincronizado solo: cualquier dispatch posterior
// re-renderiza automáticamente.
engine.dispatch({
  type: "updateObjectTransform",
  objectId: someObjectId,
  transform: { x: 100 },
});

// Al desmontar (ej. cambiar de pantalla en una futura UI):
renderer.destroy();
```

### Con resolución de assets (cuando exista esa Foundation)

```ts
const renderer = createKonvaRenderer(engine, {
  resolveAssetSource: (assetId) => myAssetCache.get(assetId), // HTMLImageElement, etc.
});
```

### Eligiendo qué página renderizar

```ts
const renderer = createKonvaRenderer(engine, { pageId: somePageId });
```

### Selección (Editor 2)

```ts
// Click sencillo en un object del canvas -> reemplaza la selección.
// Shift-click -> agrega/quita ese object de la selección actual.
// Click en área vacía del canvas -> limpia la selección.
// Todo esto ya ocurre solo con mount() — no hace falta código adicional.

engine.subscribe((event) => {
  if (event.type === "selectionChanged") {
    console.log("seleccionados:", event.selection);
  }
});
```

---

## 5. UX (regla permanente "UX First", desde Editor 2)

### Flujo del usuario
**Selección (Editor 2):**
1. Click sobre un object visible → queda resaltado con un contorno punteado azul.
2. Click sobre otro object → el resaltado se mueve (la selección anterior se reemplaza).
3. Shift-click sobre un segundo object → ambos quedan resaltados (selección múltiple); Shift-click de nuevo sobre uno ya seleccionado lo quita, el resto permanece.
4. Click en área vacía → todo el resaltado desaparece.

**Movimiento (Editor 3):**
5. El usuario arrastra directamente un object, SIN haber hecho click antes → el object se resalta desde el instante en que empieza a moverse (no hace falta seleccionar primero y arrastrar después como dos pasos separados) y se mueve junto con el puntero.
6. Al soltar, el object queda en la nueva posición — el resaltado de selección permanece.
7. Si el usuario ya tenía varios objects seleccionados y arrastra uno de ellos, la selección múltiple no se pierde (aunque, por ahora, solo se mueve el object arrastrado — ver "Mejoras futuras").

**Manipulación — resize y rotación (Editor Epic 1):**
8. Al seleccionar UN solo object, aparece su caja de manipulación: el contorno real del object (siguiendo su rotación actual, no una caja alineada a pantalla), 8 handles cuadrados en las esquinas/bordes, y un handle circular de rotación conectado por una línea sobre el borde superior.
9. Arrastrar cualquier handle de esquina redimensiona libremente en ambos ejes; arrastrar un handle de borde (arriba/abajo/izquierda/derecha) redimensiona solo ese eje, deslizándose visualmente sobre el borde real del object (incluso si está rotado).
10. Mantener Shift mientras se arrastra un handle de resize preserva la proporción ancho/alto original.
11. Arrastrar el handle circular rota el object en tiempo real, siguiendo el ángulo del puntero respecto al pivote del object.
12. Mantener Shift mientras se rota ajusta ("snap") a incrementos de 15°.
13. Pasar el cursor sobre cada handle cambia el puntero del mouse al ícono de resize/rotación correspondiente, antes de empezar a arrastrar.
14. Con 0 objects o 2+ objects seleccionados, se mantiene el resaltado simple de Editor 2 (sin handles) — redimensionar/rotar una selección múltiple a la vez no está soportado.

**Grupos y edición de texto (Sticker Creation Experience):**
15. Click o arrastre sobre cualquier hijo de un group selecciona/mueve el GROUP completo, no el hijo individual — un grupo se comporta como una sola unidad, igual que en Figma/Illustrator.
16. Doble-click sobre un texto activa edición in-canvas: un cursor de texto real aparece exactamente sobre el object, listo para escribir.
17. Escribir y presionar Enter (o hacer click fuera) confirma el nuevo contenido; Escape descarta los cambios y restaura el texto anterior.

### Consistencia de interacción
El modelo de selección (click reemplaza, Shift-click alterna, click-vacío limpia) sigue la convención de herramientas de diseño de referencia (Figma, Illustrator, Sketch). El arrastre extiende esa misma consistencia: en esas mismas herramientas, arrastrar un object no seleccionado lo selecciona automáticamente — es exactamente el comportamiento que Editor 3 agrega (antes, Foundation 3 permitía mover sin seleccionar, una inconsistencia menor que este sprint corrige). Arrastre y click conviven sin conflicto porque Konva distingue nativamente ambos gestos por la distancia de movimiento del puntero. La manipulación (Editor Epic 1) sigue el mismo vocabulario visual y de teclas modificadoras (Shift) que Figma/Illustrator/Sketch: handles de esquina vs. borde, Shift para proporción/snap.

### Accesibilidad
**Limitación real, no resuelta en este sprint:** igual que la selección y el movimiento, resize y rotación son exclusivamente por puntero sobre un `<canvas>` opaco para lectores de pantalla. No hay forma de redimensionar/rotar por teclado, ni de que un lector de pantalla anuncie el nuevo tamaño/ángulo. El cursor CSS tampoco rota junto con el object (ver "Riesgos") — para un object muy rotado, el ícono de cursor mostrado ya no representa visualmente la dirección real del handle bajo el puntero. Reconocido honestamente, no maquillado: ambas requerirían trabajo adicional fuera de este épico (ver "Mejoras futuras").

### Mejoras futuras
- Navegación de selección por teclado y **mover/redimensionar/rotar con teclado** una vez seleccionado — el Engine ya soporta esto sin cambios (`updateObjectTransform`/`resizeObject`/`rotateObject` no les importa si el llamador fue un gesto de puntero o una tecla).
- Mover o redimensionar una selección múltiple completa a la vez (hoy solo aplica al único object seleccionado).
- Límites de arrastre / guías / snapping a otros objects o a los bordes de la página — explícitamente fuera de alcance de este sprint.
- Una lista accesible fuera de pantalla (ARIA) que permita mover/redimensionar/rotar objects sin depender del canvas, despachando los mismos comandos del Engine.
- Cursor CSS que rote junto con el object (hoy es siempre la orientación nominal del handle) — requeriría generar un cursor SVG a medida por ángulo.

---

## 6. Riesgos y mejoras futuras (técnico)

Ver la sección "Riesgos" y "Compatibilidad futura" de [ADR-0004](../../docs/adr/0004-renderer-adapter.md), [ADR-0006](../../docs/adr/0006-selection-system.md), [ADR-0007](../../docs/adr/0007-transform-system.md) y [ADR-0008](../../docs/adr/0008-manipulation-system.md) para el detalle completo. En resumen:

- Rebuild completo del contenido por cambio — el cuello de botella principal para documentos grandes, con su estrategia de reconciliación incremental ya documentada (no implementada). El overlay de selección ya NO comparte este costo (capa separada, ver 3.3b). El arrastre tampoco lo agrava: se confirma solo en `dragend`, nunca en cada `dragmove`; lo mismo aplica a resize/rotación (Editor Epic 1).
- El stub de canvas de testing no dibuja píxeles reales — prueba estructura y eventos, no resultado visual.
- `fontStyle` de Konva.Text solo distingue "bold"/"normal" — el `fontWeight` numérico (100-900) del Document Schema se aproxima con un umbral.
- No hay API todavía para cambiar la página activa dinámicamente (`options.pageId` es fijo por instancia de renderer).
- No hay selección por marquee/rubber-band, movimiento por teclado, ni límites/guías/snapping de arrastre (ver "Accesibilidad"/"Mejoras futuras" arriba).
- **El handle de rotación puede renderizarse fuera del área visible del Stage** si el object seleccionado está muy cerca del borde superior de la página (el handle se dibuja `ROTATE_HANDLE_OFFSET` píxeles arriba de la caja) — en ese caso queda inalcanzable con el puntero en un navegador real, aunque la lógica de rotación en sí (verificada con tests que disparan los eventos directamente) es correcta. Detectado durante la verificación manual de este épico; no se resolvió por requerir que `handles.ts` conociera los límites del Stage (acoplamiento nuevo, fuera del alcance ya construido) para clampar o reposicionar el handle — documentado como limitación conocida, no arreglado.
- **`intrinsicSize` para un `Konva.Group` se aproxima con `getClientRect({ skipTransform: true })`**, no con `getSelfRect()` (que `Group` no implementa) — funciona para los casos probados, pero no se verificó exhaustivamente contra un Group con hijos rotados/anidados a varios niveles.
- **Los tests con jsdom (`node.fire(...)`) no habrían detectado el bug real encontrado durante la verificación en navegador**: hasta antes de esta corrección, `selectionLayer` se creaba con `listening: false` a nivel de Layer completa (heredado de Editor 2, cuando solo contenía overlays decorativos) — esto bloqueaba SILENCIOSAMENTE todos los eventos reales de puntero sobre los handles nuevos, sin que ningún test (que dispara eventos directamente sobre el node, sin pasar por el hit-graph de Konva ni por el árbol DOM real) lo hiciera fallar. Se detectó solo con Playwright contra un Chromium real. Lección para futuros sprints: un test que solo llama `.fire(evento)` prueba la RESPUESTA a un evento, no si ese evento llegaría a ese node en un navegador real — ambas verificaciones siguen siendo necesarias.
- **No se construyó "entrar a un grupo" con doble-click** para seleccionar/editar un hijo individual sin desagrupar primero (ver 3.9) — documentado como mejora futura, no un descuido.
- **El `<textarea>` de edición de texto no reproduce con exactitud absoluta el layout de `Konva.Text`** (kerning, wrapping de palabras largas, etc. pueden diferir ligeramente entre el motor de layout del navegador y el de Konva) — aceptable para edición de contenido, no para una previsualización pixel-perfect mientras se escribe.
