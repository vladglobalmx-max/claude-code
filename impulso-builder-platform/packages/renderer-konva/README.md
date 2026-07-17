# @impulso/renderer-konva

> FOUNDATION 3 (base) + EDITOR 2 (selección) + EDITOR 3 (movimiento) de Impulso Builder Platform. El primer `RendererAdapter` concreto: traduce Document Schema → Scene Graph → Konva, y eventos de Konva → llamadas al Engine. El único paquete de la plataforma que depende de Konva. Ver [ADR-0004](../../docs/adr/0004-renderer-adapter.md) (base), [ADR-0006](../../docs/adr/0006-selection-system.md) (selección) y [ADR-0007](../../docs/adr/0007-transform-system.md) (movimiento) para el razonamiento completo, y [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md) para el análisis de rendimiento.

**Estado:** completo, incluyendo selección visual (Editor 2) y movimiento por arrastre integrado con la selección (Editor 3). No implementa Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Rotación, Handles, guías, snapping ni Exportaciones — eso es alcance de sprints futuros.

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
    ├── renderer.ts             # createKonvaRenderer() — mount/renderContent/renderSelectionOverlay/destroy
    ├── baseAttrs.ts            # SOLO atributos estáticos — delega interacción a interactions/
    ├── coordinates.ts          # toKonvaXY/fromKonvaXY (la única asimetría: Ellipse se posiciona por el centro)
    ├── style.ts                # applyShapeStyle + blendMode -> globalCompositeOperation
    ├── unit.ts                 # conversión mm/in/px -> píxeles de Stage
    │
    ├── interactions/
    │   ├── selectionInteractions.ts   # click/Shift-click -> setSelection/toggleObjectSelection
    │   └── transformInteractions.ts   # dragstart (asegura selección) / dragend -> updateObjectTransform
    │
    ├── nodes/
    │   ├── rectangle.ts | ellipse.ts | path.ts | image.ts | text.ts | group.ts
    │   └── sceneNode.ts        # dispatcher: SceneObject -> el creador correcto (recursivo para group)
    │
    ├── testing/
    │   └── fakeCanvasContext.ts  # stub de CanvasRenderingContext2D para testear Konva sin `canvas` nativo
    │
    └── testUtils/
        └── fixtures.ts          # builders de Project/Page/Layer/SceneObject para tests

    (78 tests, 100% de statements/functions/lines, 99% de branches — ver "Riesgos")
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
  → por cada id en engine.getSelection(): busca el nodo por id en mainLayer,
    dibuja un Konva.Rect punteado sobre su bounding box (getClientRect)
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

El overlay de selección (Editor 2) vive en su **propio** `Konva.Layer` (`selectionLayer`, `listening: false`), separado de `mainLayer`. No contradice 3.3: son dos layers *fijos* (contenido + UI de selección), no uno por cada Layer del documento. Es, de hecho, el patrón que la propia documentación de Konva recomienda para UI que cambia con más frecuencia que el contenido (selección, indicadores de arrastre) — así un click no dispara un rebuild completo de la escena, solo redibuja un puñado de rectángulos en una capa aparte. Ver ADR-0006, sección "Rendimiento".

### 3.4 Reconciliación: rebuild completo del contenido (a propósito, con su costo documentado)

`renderContent()` no diffea el árbol anterior contra el nuevo — destruye y reconstruye todos los nodos Konva de la página activa en cada `projectChanged`. Es la implementación más simple y correcta, elegida deliberadamente siguiendo la regla del Performance Budget ("no optimizar prematuramente, pero documentar el camino"): el costo (O(objetos de la página) por render, sin importar cuán pequeño fue el cambio real) y la estrategia de reconciliación incremental futura están documentados en [ADR-0004](../../docs/adr/0004-renderer-adapter.md#rendimiento) y en [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md). `renderSelectionOverlay()` es deliberadamente independiente de ese costo — ver 3.3b.

### 3.5 Coordenadas: por qué existe `coordinates.ts`

El Document Schema trata `transform.x/y` como la esquina superior izquierda — consistente para Rectangle/Path/Image/Text/Group. `Konva.Ellipse`, por diseño de Konva, posiciona su nodo por el **centro**. `toKonvaXY`/`fromKonvaXY` son el único lugar donde esa conversión ocurre, en ambos sentidos (aplicar transform → Konva, y leer de vuelta tras un drag → Document Schema).

### 3.6 Imágenes sin binario: placeholder, no un error

`ImageObject.assetId` es una referencia; el binario real no existe todavía como concepto en la plataforma (no hay Foundation de Assets). Sin un `resolveAssetSource` inyectado en las opciones, una Image se dibuja como un rectángulo punteado del tamaño correcto — no lanza, no inventa píxeles. `resolveAssetSource` es el punto de extensión ya preparado para cuando exista esa Foundation.

### 3.7 Testing sin navegador ni dependencias nativas

jsdom no implementa un contexto 2D real (requiere el paquete nativo `canvas`, que no compiló en este entorno por faltar `pangocairo` del sistema — ver ADR-0004). `src/testing/fakeCanvasContext.ts` es un stub propio (~70 líneas, cero dependencias) que reemplaza `HTMLCanvasElement.prototype.getContext('2d')` con no-ops suficientes para que Konva construya su árbol, dibuje sin lanzar, y dispare eventos sintéticos (`.fire('dragend')`). No produce píxeles reales — no es su propósito; prueba la ESTRUCTURA del árbol Konva y la traducción de eventos, no el resultado visual.

`vitest.config.ts` fuerza `resolve.mainFields: ["browser", ...]` porque Konva usa el campo clásico `package.json` `"main"` (build de Node, requiere `canvas`) vs `"browser"` (usa el DOM real) — Vite/Vitest por defecto resuelven `"main"` incluso con `environment: "jsdom"`.

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

### Consistencia de interacción
El modelo de selección (click reemplaza, Shift-click alterna, click-vacío limpia) sigue la convención de herramientas de diseño de referencia (Figma, Illustrator, Sketch). El arrastre extiende esa misma consistencia: en esas mismas herramientas, arrastrar un object no seleccionado lo selecciona automáticamente — es exactamente el comportamiento que Editor 3 agrega (antes, Foundation 3 permitía mover sin seleccionar, una inconsistencia menor que este sprint corrige). Arrastre y click conviven sin conflicto porque Konva distingue nativamente ambos gestos por la distancia de movimiento del puntero.

### Accesibilidad
**Limitación real, no resuelta en este sprint:** igual que la selección, el movimiento hoy es exclusivamente por puntero (arrastrar con mouse/touch) sobre un `<canvas>` opaco para lectores de pantalla. No hay forma de mover un object por teclado (flechas, por ejemplo) ni de que un lector de pantalla anuncie que un object se movió o a qué posición. Reconocido honestamente, no maquillado: requeriría una superficie de interacción paralela al canvas (ver "Mejoras futuras").

### Mejoras futuras
- Navegación de selección por teclado y **mover con flechas del teclado** una vez seleccionado — el Engine ya soporta esto sin cambios (`updateObjectTransform` no le importa si el llamador fue un arrastre o una tecla).
- Mover una selección múltiple completa arrastrando cualquiera de sus miembros (hoy solo se mueve el object arrastrado, aunque el resto de la selección se preserva visualmente).
- Límites de arrastre / guías / snapping a otros objects o a los bordes de la página — explícitamente fuera de alcance de este sprint.
- Una lista accesible fuera de pantalla (ARIA) que permita mover objects sin depender del canvas, despachando los mismos comandos del Engine.

---

## 6. Riesgos y mejoras futuras (técnico)

Ver la sección "Riesgos" y "Compatibilidad futura" de [ADR-0004](../../docs/adr/0004-renderer-adapter.md), [ADR-0006](../../docs/adr/0006-selection-system.md) y [ADR-0007](../../docs/adr/0007-transform-system.md) para el detalle completo. En resumen:

- Rebuild completo del contenido por cambio — el cuello de botella principal para documentos grandes, con su estrategia de reconciliación incremental ya documentada (no implementada). El overlay de selección ya NO comparte este costo (capa separada, ver 3.3b). El arrastre tampoco lo agrava: se confirma solo en `dragend`, nunca en cada `dragmove`.
- El stub de canvas de testing no dibuja píxeles reales — prueba estructura y eventos, no resultado visual.
- `fontStyle` de Konva.Text solo distingue "bold"/"normal" — el `fontWeight` numérico (100-900) del Document Schema se aproxima con un umbral.
- No hay API todavía para cambiar la página activa dinámicamente (`options.pageId` es fijo por instancia de renderer).
- No hay selección por marquee/rubber-band, movimiento por teclado, ni límites/guías/snapping de arrastre (ver "Accesibilidad"/"Mejoras futuras" arriba).
