# @impulso/renderer-konva

> FOUNDATION 3 (base) + EDITOR 2 (selección) de Impulso Builder Platform. El primer `RendererAdapter` concreto: traduce Document Schema → Scene Graph → Konva, y eventos de Konva → llamadas al Engine. El único paquete de la plataforma que depende de Konva. Ver [ADR-0004](../../docs/adr/0004-renderer-adapter.md) (base) y [ADR-0006](../../docs/adr/0006-selection-system.md) (selección) para el razonamiento completo, y [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md) para el análisis de rendimiento.

**Estado:** completo, incluyendo selección visual (Editor 2). No implementa Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Rotación, Handles ni Exportaciones — eso es alcance de sprints futuros.

---

## 1. Qué es y qué no es

```
Document Schema  →  Engine  →  Renderer (este paquete)  →  Konva
```

- **Sí hace:** dado un `Engine` (de `@impulso/engine`), construye y mantiene sincronizado un árbol de nodos Konva reales a partir de `engine.getProject()`; traduce los gestos de interacción soportados (arrastrar, click, Shift-click) en `engine.dispatch(...)`; muestra un indicador visual de qué está seleccionado, leyendo `engine.getSelection()`.
- **No hace:** no contiene reglas de negocio, no muta el Document Schema directamente (todo pasa por `engine.dispatch`), no implementa comandos ni historial (eso ya existe en `@impulso/engine`) — incluida la lógica de QUÉ hace un Shift-click con la selección (eso vive en el Engine, `toggleObjectSelection`), no persiste nada, no sabe qué es un "sticker" ni una "línea de corte" — solo dibuja un `path` con las propiedades que tiene, sin interpretar su `metadata.role`.

## 2. Árbol del paquete

```
packages/renderer-konva/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts              # API pública
    ├── types.ts               # RendererAdapter, KonvaRendererOptions, NodeContext
    ├── renderer.ts             # createKonvaRenderer() — mount/renderContent/renderSelectionOverlay/destroy
    ├── baseAttrs.ts            # atributos comunes a todo nodo + traducción dragend/click -> dispatch
    ├── coordinates.ts          # toKonvaXY/fromKonvaXY (la única asimetría: Ellipse se posiciona por el centro)
    ├── style.ts                # applyShapeStyle + blendMode -> globalCompositeOperation
    ├── unit.ts                 # conversión mm/in/px -> píxeles de Stage
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

    (71 tests, 100% de statements/functions/lines, 98.95% de branches — ver "Riesgos")
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

### 3.2 Traducción de eventos: arrastrar, click, Shift-click

`applyBaseAttrs` (llamado por cada creador de nodo) registra los listeners que traducen gestos de Konva a comandos del Engine — la SEMÁNTICA de cada uno vive en el Engine, aquí solo se traduce el hecho crudo:

- **`dragend`**: lee la posición final del nodo Konva (`node.x()/y()`), convertida de vuelta con `fromKonvaXY` (solo difiere para `ellipse`), y llama `engine.dispatch({ type: "updateObjectTransform", ... })`. Si el Engine rechaza el cambio, fuerza un `renderContent()` para revertir la posición visual.
- **`click`**: si `Shift` NO estaba presionado, `engine.dispatch({ type: "setSelection", objectIds: [object.id] })` (reemplaza la selección). Si `Shift` SÍ estaba presionado, `engine.dispatch({ type: "toggleObjectSelection", objectId: object.id })` (agrega/quita de la selección actual — la decisión de "agregar o quitar" la toma el Engine, no este paquete). Se detiene la propagación (`cancelBubble = true`) para que el click no también dispare el "click en vacío" del Stage.

Un object con `metadata.locked: true` se crea con `draggable: false` (no se puede mover) pero `listening` sigue dependiendo solo de `metadata.visible` — un object bloqueado **sigue siendo seleccionable** por click; solo dejó de ser arrastrable. Esto es un cambio de comportamiento respecto a Foundation 3 (antes, bloqueado implicaba `listening: false`) — no es un cambio de la API pública (misma firma de `createKonvaRenderer`), pero sí de comportamiento interno; documentado en [ADR-0006](../../docs/adr/0006-selection-system.md).

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

## 5. UX (Editor 2 — regla permanente "UX First")

### Flujo del usuario
1. El usuario hace click sobre un object visible del canvas → ese object queda resaltado con un contorno punteado azul.
2. Hace click sobre otro object → el resaltado se mueve al nuevo object (la selección anterior se reemplaza).
3. Mantiene Shift y hace click sobre un segundo object → ambos quedan resaltados (selección múltiple).
4. Shift-click sobre un object ya seleccionado → se quita solo ese object de la selección, el resto permanece.
5. Hace click en un área vacía del canvas (sin ningún object debajo) → todo el resaltado desaparece.

### Consistencia de interacción
El modelo (click reemplaza, Shift-click alterna, click-vacío limpia) sigue la convención ya establecida por herramientas de diseño de referencia (Figma, Illustrator, Sketch) — se eligió deliberadamente para que el comportamiento no sorprenda a nadie que ya haya usado un editor de este tipo, en vez de inventar un modelo propio. El arrastre (heredado de Foundation 3) y el click conviven sin conflicto porque Konva distingue nativamente un click de un drag por la distancia de movimiento del puntero — no fue necesario ningún código adicional para evitar que "seleccionar" y "mover" se pisen entre sí.

### Accesibilidad
**Limitación real, no resuelta en este sprint:** la selección hoy es exclusivamente por puntero (mouse/touch/click) sobre un `<canvas>` — un `<canvas>` es una superficie de píxeles opaca para un lector de pantalla, sin semántica DOM propia por elemento. No hay forma de navegar la selección por teclado (`Tab`/flechas) ni de que un lector de pantalla anuncie qué está seleccionado. Esto es honesto de reconocer, no un descuido: construir accesibilidad real requeriría una superficie DOM paralela (ver "Mejoras futuras"), que es explícitamente trabajo de un sprint futuro, no de este.

### Mejoras futuras
- Navegación de selección por teclado (`Tab`/`Shift+Tab` entre objects, `Escape` para deseleccionar) — el Engine ya soporta esto sin cambios (`setSelection`/`toggleObjectSelection` no saben ni les importa si el llamador fue un click o una tecla).
- Una lista accesible fuera de pantalla (ARIA, `aria-live`) que enumere los objects del documento y permita seleccionarlos sin depender del canvas — despacharía los mismos comandos del Engine, sin duplicar lógica.
- Selección por marquee/rubber-band (arrastrar sobre área vacía para seleccionar varios a la vez) — no implementada; hoy la única vía a selección múltiple es Shift-click repetido.
- Indicador de foco de teclado visualmente distinto al de selección por mouse, cuando exista navegación por teclado.

---

## 6. Riesgos y mejoras futuras (técnico)

Ver la sección "Riesgos" y "Compatibilidad futura" de [ADR-0004](../../docs/adr/0004-renderer-adapter.md) y [ADR-0006](../../docs/adr/0006-selection-system.md) para el detalle completo. En resumen:

- Rebuild completo del contenido por cambio — el cuello de botella principal para documentos grandes, con su estrategia de reconciliación incremental ya documentada (no implementada). El overlay de selección ya NO comparte este costo (capa separada, ver 3.3b).
- El stub de canvas de testing no dibuja píxeles reales — prueba estructura y eventos, no resultado visual.
- `fontStyle` de Konva.Text solo distingue "bold"/"normal" — el `fontWeight` numérico (100-900) del Document Schema se aproxima con un umbral.
- No hay API todavía para cambiar la página activa dinámicamente (`options.pageId` es fijo por instancia de renderer).
- No hay selección por marquee/rubber-band ni por teclado (ver "Accesibilidad" arriba).
