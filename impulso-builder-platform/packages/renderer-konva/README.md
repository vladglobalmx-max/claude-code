# @impulso/renderer-konva

> FOUNDATION 3 de Impulso Builder Platform. El primer `RendererAdapter` concreto: traduce Document Schema → Scene Graph → Konva, y eventos de Konva → llamadas al Engine. El único paquete de la plataforma que depende de Konva. Ver [ADR-0004](../../docs/adr/0004-renderer-adapter.md) para el razonamiento completo detrás de cada decisión, y [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md) para el análisis de rendimiento.

**Estado:** completo. No implementa Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Handles, Selection visual ni Exportaciones — eso es alcance de Foundations futuras.

---

## 1. Qué es y qué no es

```
Document Schema  →  Engine  →  Renderer (este paquete)  →  Konva
```

- **Sí hace:** dado un `Engine` (de `@impulso/engine`), construye y mantiene sincronizado un árbol de nodos Konva reales a partir de `engine.getProject()`; traduce el único gesto de interacción de este Foundation (arrastrar) en `engine.dispatch({type: "updateObjectTransform", ...})`.
- **No hace:** no contiene reglas de negocio, no muta el Document Schema directamente (todo pasa por `engine.dispatch`), no implementa comandos ni historial (eso ya existe en `@impulso/engine`), no persiste nada, no sabe qué es un "sticker" ni una "línea de corte" — solo dibuja un `path` con las propiedades que tiene, sin interpretar su `metadata.role`.

## 2. Árbol del paquete

```
packages/renderer-konva/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts              # API pública
    ├── types.ts               # RendererAdapter, KonvaRendererOptions, NodeContext
    ├── renderer.ts             # createKonvaRenderer() — mount/render/destroy
    ├── baseAttrs.ts            # atributos comunes a todo nodo + traducción dragend -> dispatch
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

    (62 tests, 100% de cobertura)
```

## 3. Arquitectura

### 3.1 El ciclo mount → render → destroy

```
mount(container)
  → new Konva.Stage + new Konva.Layer (uno solo, ver 3.3)
  → render() inicial
  → engine.subscribe(): en cada "projectChanged", vuelve a llamar render()

render()
  → lee engine.getProject() y resuelve la página activa (options.pageId, o la primera)
  → mainLayer.destroyChildren()  (rebuild completo, ver 3.4 y ADR-0004 "Rendimiento")
  → stage.width/height <- toPixels(page.size, page.unit)
  → por cada Layer del documento: un Konva.Group (id = layer.id, visible/listening <- metadata)
  → por cada SceneObject: createSceneNode() (recursivo para group)
  → mainLayer.batchDraw()

destroy()
  → unsubscribe del Engine
  → stage.destroy() (limpia el DOM que Konva insertó en el container)
```

### 3.2 Traducción de eventos: solo "arrastrar mueve"

`applyBaseAttrs` (llamado por cada creador de nodo) registra un único listener, `dragend`, que:
1. Lee la posición final del nodo Konva (`node.x()/y()`), convertida de vuelta con `fromKonvaXY` (solo difiere para `ellipse`).
2. Llama `engine.dispatch({ type: "updateObjectTransform", objectId, transform: { x, y } })`.
3. Si el Engine rechaza el cambio (el object ya no existe, por ejemplo), fuerza un `render()` para revertir la posición visual — Konva ya movió el nodo optimistamente durante el drag; sin este paso, la pantalla quedaría desincronizada del estado canónico.

Un object con `metadata.locked: true` se crea con `draggable: false` y `listening: false` — no genera este evento en absoluto.

### 3.3 Un solo `Konva.Layer`, no uno por Layer del documento

Cada `Layer` del Document Schema se mapea a un `Konva.Group` (agrupación lógica, sin costo de canvas), no a un `Konva.Layer` (que sí es un canvas real). Konva documenta explícitamente que tener muchos `Layer` es un antipatrón — un documento con decenas de layers de edición (razonable en un editor tipo Photoshop) habría creado decenas de canvases si se hubiera mapeado 1:1.

### 3.4 Reconciliación: rebuild completo (a propósito, con su costo documentado)

`render()` no diffea el árbol anterior contra el nuevo — destruye y reconstruye todos los nodos Konva de la página activa en cada cambio. Es la implementación más simple y correcta, elegida deliberadamente siguiendo la regla del Performance Budget ("no optimizar prematuramente, pero documentar el camino"): el costo (O(objetos de la página) por render, sin importar cuán pequeño fue el cambio real) y la estrategia de reconciliación incremental futura están documentados en [ADR-0004](../../docs/adr/0004-renderer-adapter.md#rendimiento) y en [PERFORMANCE_BUDGET.md](../../docs/PERFORMANCE_BUDGET.md).

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

---

## 5. Riesgos y mejoras futuras

Ver la sección "Riesgos" y "Compatibilidad futura" de [ADR-0004](../../docs/adr/0004-renderer-adapter.md) para el detalle completo. En resumen:

- Rebuild completo por render — el cuello de botella principal para documentos grandes, con su estrategia de reconciliación incremental ya documentada (no implementada).
- El stub de canvas de testing no dibuja píxeles reales — prueba estructura y eventos, no resultado visual.
- `fontStyle` de Konva.Text solo distingue "bold"/"normal" — el `fontWeight` numérico (100-900) del Document Schema se aproxima con un umbral.
- No hay API todavía para cambiar la página activa dinámicamente (`options.pageId` es fijo por instancia de renderer).
