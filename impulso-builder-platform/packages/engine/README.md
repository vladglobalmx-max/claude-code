# @impulso/engine

> FOUNDATION 2 de Impulso Builder Platform. El núcleo del motor de edición: estado, comandos y eventos sobre el `@impulso/document-schema`. Cero dependencias de renderizado. Desde EDITOR EPIC 1 (Manipulation System) también expone la geometría pura de resize/rotate — ver [ADR-0008](../../docs/adr/0008-manipulation-system.md). Desde el épico Sticker Creation Experience, agrupar/desagrupar, editar el contenido de un texto, y clonar un object con identidad fresca — ver [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md). Desde Asset Library (Epic 2), comandos para el registro de Assets del documento — ver [ADR-0011](../../docs/adr/0011-asset-library.md).

**Estado:** completo. No implementa Renderer, Konva, React, Canvas, UI, Assets/Fonts (gestión de binarios), Export ni Persistence — eso es alcance de micro-sprints futuros.

---

## 1. Qué es y qué no es

`@impulso/engine` responde a la pregunta "¿qué le puedo hacer a un `Project` de Impulso, y cómo me entero de que cambió?" — nada más.

```
Document Schema  →  Engine (este paquete)  →  Renderer (futuro)  →  Konva (futuro)
```

- **Sí hace:** mantiene un `Project` en memoria, expone comandos para modificarlo (agregar/quitar/reordenar páginas, layers, objects; actualizar transform/style/metadata; seleccionar), valida cada comando y cada resultado con Zod, versiona cada cambio (`documentVersion` + `history`), soporta undo/redo, y emite eventos para quien quiera escuchar.
- **No hace:** no dibuja nada, no sabe qué es Konva/React/Canvas/SVG/el DOM, no gestiona binarios de assets ni fuentes, no exporta PNG/PDF, no persiste a disco/IndexedDB. Todo eso son otros Foundations.

## 2. Árbol del paquete

```
packages/engine/
├── package.json / tsconfig.json / vitest.config.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                    # API pública
    ├── engine.ts                   # createEngine() — une estado + comandos + historial + eventos
    │
    ├── commands/
    │   ├── entityRef.ts            # EntityRef: a qué nivel apunta un updateMetadata
    │   ├── command.ts              # EngineCommand (Zod) — Content vs Selection
    │   ├── permutation.ts          # helper: validar que un "reorder" es una permutación válida
    │   ├── pageCommands.ts         # addPage / removePage / reorderPages / updatePageGrid
    │   ├── layerCommands.ts        # addLayer / removeLayer / reorderLayers
    │   ├── objectCommands.ts       # addObject / removeObject / updateObjectTransform|Style|Content / reorderObjects
    │   ├── resizeObjectCommand.ts  # resizeObject — delega en geometry/resizeMath.ts + updateObjectTransform
    │   ├── rotateObjectCommand.ts  # rotateObject — delega en geometry/rotateMath.ts + updateObjectTransform
    │   ├── groupCommands.ts        # groupObjects / ungroupObject — solo hijos directos de una layer
    │   ├── assetCommands.ts        # addAsset / removeAsset / renameAsset — genéricos sobre cualquier tipo de Asset
    │   ├── metadataCommand.ts      # updateMetadata — un comando, 5 niveles (project/document/page/layer/object)
    │   ├── selectionCommands.ts    # setSelection / clearSelection / toggleObjectSelection / pruneSelection
    │   └── applyCommand.ts         # orquesta: reducer -> versión -> historial -> validación final
    │
    ├── geometry/
    │   ├── resizeMath.ts           # computeResizedTransform — función pura, sin Project ni dispatch
    │   ├── rotateMath.ts           # computeRotatedTransform — función pura, sin Project ni dispatch
    │   ├── composeTransform.ts     # composeChildTransformIntoParent — hornea el transform de un Group en su hijo
    │   ├── boundingBox.ts          # computeRotatedBoundingBox / unionBoundingBox (Fase 7.2)
    │   ├── alignment.ts            # alignLeft/Right/... / distributeHorizontal/Vertical (Fase 7.2)
    │   └── snapping.ts             # computeSnap / buildPageSnapCandidates / buildObjectSnapCandidates (Fase 7.3)
    │
    ├── cloning/
    │   └── cloneSceneObject.ts     # cloneSceneObjectWithNewIds — clona con ids frescos (no un comando)
    │
    ├── tree/
    │   └── objectTree.ts           # find/update/remove un Object por id, a cualquier profundidad de Group
    │
    ├── history/
    │   └── idGenerator.ts          # generador de ids para HistoryEntry (el único id que el Engine inventa)
    │
    ├── events/
    │   ├── eventEmitter.ts         # pub-sub mínimo, sin node:events ni DOM
    │   └── engineEvent.ts          # EngineEvent (projectChanged / selectionChanged / historyChanged / commandRejected)
    │
    ├── errors/
    │   └── engineError.ts          # EngineError + Result pattern (ok/err) — dispatch() nunca lanza
    │
    └── testUtils/
        └── fixtures.ts             # builders de Project/Document/Page/Layer/Object para tests

    (312 tests, 100% de cobertura)
```

## 3. Arquitectura

### 3.1 Estado, comandos, eventos — el ciclo completo

```
   dispatch(command)
        │
        ▼
  ¿comando de selección?  ──sí──▶  actualizar `selection`  ──▶ emit selectionChanged
        │no
        ▼
  validar shape con Zod (EngineCommandSchema)
        │ inválido → emit commandRejected, return { ok:false }
        ▼
  ejecutar el reducer específico (pageCommands/layerCommands/objectCommands/metadataCommand)
        │ error de dominio (ej. object_not_found) → emit commandRejected, return { ok:false }
        ▼
  incrementar documentVersion + agregar HistoryEntry + actualizar updatedAt
        │
        ▼
  validar el Project resultante completo con ProjectSchema (red de seguridad)
        │ inválido → emit commandRejected (invariant_violation)
        ▼
  push a undoStack, limpiar redoStack, reemplazar `project`
        │
        ▼
  podar selección (quitar objectIds que ya no existen)
        │
        ▼
  emit projectChanged, emit historyChanged
        │
        ▼
  return { ok:true, value: project }
```

### 3.2 Por qué comandos + Result, no una API de mutación directa

Un `Engine` no expone `engine.project.pages.push(...)`. Todo pasa por `dispatch(command)` porque eso es lo que permite: validar antes de aplicar, versionar cada cambio, construir undo/redo genéricamente (una pila de snapshots, no lógica ad-hoc por operación), y notificar por evento sin que el Engine conozca a sus suscriptores.

`dispatch` (y `undo`/`redo`) **nunca lanzan** — devuelven `{ ok: true, value }` o `{ ok: false, error }`. Es una decisión deliberada: se llaman en cada interacción del usuario, y forzar `try/catch` en cada una sería peor API que revisar `.ok`. La única excepción es `createEngine(initialProject)`: un Project inicial inválido es un error de programación, no un caso de uso — ahí sí se lanza (falla rápido), igual que `ProjectSchema.parse` en Foundation 1.

### 3.3 Comandos: un catálogo simétrico, no ad-hoc

Los 24 comandos son 1:1 con las operaciones estructurales que el Document Schema ya define — nada específico de Sticker Builder:

| Nivel | Comandos |
|---|---|
| Page | `addPage`, `removePage`, `reorderPages` |
| Layer | `addLayer`, `removeLayer`, `reorderLayers` |
| Object | `addObject`, `removeObject`, `updateObjectTransform`, `updateObjectStyle`, `updateObjectContent`, `updateTextStyle`, `reorderObjects`, `resizeObject`, `rotateObject`, `groupObjects`, `ungroupObject` |
| Asset (Asset Library, genérico sobre cualquier tipo de Asset) | `addAsset`, `removeAsset`, `renameAsset` |
| Metadata (genérico, 6 niveles) | `updateMetadata` con un `EntityRef` (`project`\|`document`\|`page`\|`layer`\|`object`\|`asset`) |
| Selección (efímera, no versionada) | `setSelection`, `clearSelection`, `toggleObjectSelection` (selección múltiple, ver Editor 2 / ADR-0006) |

`updateMetadata` es un único comando para los seis niveles en vez de `updateProjectMetadata`/`updateDocumentMetadata`/... — mismo principio de "sistema genérico" que el Document Schema aplicó a sus tipos de Object. `renameAsset` es su propio comando (no parte de `updateMetadata`) porque `Asset.name` es un campo propio, no parte de `metadata` — `updateMetadata` a nivel `"asset"` sigue cubriendo `tags`/`description`/etc.

Los comandos de **objeto** se dirigen solo por `objectId` (no `pageId`+`layerId`): un Object puede estar anidado a cualquier profundidad dentro de un `group`, así que el Engine lo busca en todo el árbol (`tree/objectTree.ts`) en vez de exigirle a quien llama que sepa la ruta exacta.

`resizeObject` y `rotateObject` no duplican la lógica de fusión/validación de `Transform`: cada uno calcula un `Partial<Transform>` (vía `geometry/resizeMath.ts` / `geometry/rotateMath.ts`) y se lo delega tal cual al reducer ya probado de `updateObjectTransform` — ver §3.8.

### 3.8 Geometría de manipulación: funciones puras, exportadas en la API pública

`computeResizedTransform` y `computeRotatedTransform` (`src/geometry/`) son las únicas piezas de este paquete pensadas explícitamente para ser llamadas **fuera** de `dispatch`. Un Renderer las usa para computar una previsualización visual en cada `dragmove` (sin tocar el `Project`, sin disparar un rebuild) y, al soltar el puntero, el comando `resizeObject`/`rotateObject` llama **exactamente a la misma función** para calcular el `Transform` final — preview y estado commiteado nunca pueden divergir, porque es el mismo cálculo. Ver ADR-0008 para el razonamiento completo (por qué el resize opera sobre `scaleX`/`scaleY` y no sobre `size`, y por qué `intrinsicSize` lo mide el Renderer y no el Engine).

Estas dos funciones son deliberadamente las únicas en el Engine que no requieren un `Project` para ejecutarse — reciben un `Transform` (o un ángulo) y devuelven un `Partial<Transform>`. Son las candidatas naturales si en el futuro se decide extraer un sub-paquete `@impulso/geometry` puro, pero eso no se hizo aquí porque no hay todavía una segunda necesidad de consumirlas fuera de `@impulso/engine`.

### 3.9 Agrupar/desagrupar: una operación estructural, no una transformación

`groupObjects`/`ungroupObject` (`commands/groupCommands.ts`) solo operan sobre hijos **directos** de una Layer — mismo alcance que ya tenía `reorderObjects` desde Foundation 2, por la misma razón (mantener acotada la primera versión, no una limitación del árbol recursivo del Document Schema en sí).

- `groupObjects` construye el nuevo `GroupObject` con el `transform`/`style`/`metadata` que trae el comando (el Engine nunca inventa identidad ni timestamps, mismo principio que `addObject`) y sus `children` en el orden real que ya tenían en la layer. Con un `transform` identidad (el caso normal al agrupar desde una UI), ningún hijo se mueve — agrupar es puramente estructural.
- `ungroupObject` hace lo inverso: reemplaza el Group por sus hijos en su misma posición, pero primero "hornea" el `transform` del Group en cada hijo con `composeChildTransformIntoParent` (`geometry/composeTransform.ts`) — así, si el Group fue movido/rotado/escalado después de creado, ningún hijo cambia de posición visual al desagrupar.
- `composeChildTransformIntoParent` sigue el mismo estilo que `computeResizedTransform`/`computeRotatedTransform`: función pura, sin `Project`, exportada en la API pública para que un Renderer pueda reutilizar la misma matemática si algún día necesita previsualizar un ungroup antes de despachar el comando.

### 3.10 Clonar con identidad fresca: una utilidad, no un comando

"Duplicar" un object no tiene un comando propio — `cloneSceneObjectWithNewIds` (`cloning/cloneSceneObject.ts`) es una función pura que clona un `SceneObject` (recursivamente si es un `Group`, a cualquier profundidad) asignando un id nuevo a cada nodo, y el resultado se despacha con el `addObject` ya existente. Quien llama provee tanto el generador de ids como el timestamp — el Engine nunca inventa ninguno de los dos, exactamente como con cualquier otro object nuevo. Un `offset` opcional desplaza `x`/`y` solo del object de nivel superior; los hijos de un Group conservan su posición relativa intacta (ya es relativa al Group, no al documento).

### 3.11 Comandos de Asset Library: genéricos sobre `AssetSchema`, sin duplicar el registro

`addAsset`/`removeAsset`/`renameAsset` (`commands/assetCommands.ts`) operan sobre `document.assets` — el registro de descriptores de Asset Library (`@impulso/document-schema`, ver ADR-0011). Son genéricos sobre la unión completa de `Asset` (hoy `image`/`font`, mañana cualquier variante nueva): el reducer nunca necesita saber de qué tipo concreto es un Asset para agregarlo/quitarlo/renombrarlo, exactamente igual que `addObject` no necesita saber si un `SceneObject` es un Rectangle o un Group.

`removeAsset` no valida si el Asset sigue siendo referenciado por algún `ImageObject.assetId` — mismo criterio que el resto del Engine (no valida referencias cruzadas en otros casos tampoco); el Renderer ya degrada correctamente a un placeholder ante un `assetId` sin resolver.

El binario real de un Asset vive fuera de este paquete (`@impulso/asset-library`, IndexedDB) — el Engine solo conoce el descriptor.

### 3.12 `dispatchBatch`: N comandos como una sola transacción (Epic 7 / Fase 7.2)

`dispatchBatch(commands, metadata?)` aplica N `ContentCommand` como una única transacción lógica: una sola `HistoryEntry`, un solo `Ctrl/Cmd+Z` revierte todo el batch, un solo Redo lo restaura completo. Atomicidad **por construcción**, no por rollback manual: `applyContentCommandBatch` (`commands/applyCommand.ts`) corre cada reducer en secuencia sobre un acumulador `current` **local** — nunca el `project` que recibió como parámetro. Si cualquier comando falla, se devuelve el error de inmediato y `current` se descarta; el `project` original nunca fue tocado, así que no hace falta deshacer nada. Solo si los N comandos tienen éxito se bumpea `documentVersion` (una vez) y se agrega una `HistoryEntry` (una vez, con la `label` dada o una descripción generada — ver `describeBatch`).

No admite `SelectionCommand` — nunca participaron del pipeline de versión/historial (§3.5), mezclarlos en un batch no tendría semántica de undo coherente. Un batch vacío es un no-op explícito: mismo `project`, sin entrada de historial, ver ADR-0015.

Ver ADR-0015 para el contrato completo y las alternativas descartadas.

### 3.13 Alignment Engine: geometría pura sobre múltiples objects (Epic 7 / Fase 7.2)

`geometry/boundingBox.ts` + `geometry/alignment.ts` son el primer módulo de este paquete que opera sobre **varios** objects a la vez (§3.8 documentaba geometría de UN object). Ninguno depende de Konva ni del DOM:

- `computeRotatedBoundingBox({ pivot, originOffset, width, height, rotationDegrees })`: rota las 4 esquinas de una caja alrededor de su pivote y devuelve el AABB resultante — la misma trigonometría que `localToParent` (`@impulso/renderer-konva`) usa para posicionar handles, reimplementada aquí como función pura de 5 números (sin depender de un `ManipulationBox`/`Konva.Node` real).
- `unionBoundingBox(boxes)`: la envolvente conjunta de N cajas — la referencia que usa Alignment para que la selección completa no "salte" de posición al alinear.
- `alignLeft/Right/Top/Bottom/CenterHorizontal/CenterVertical(targets)`: alinean contra la caja envolvente conjunta.
- `distributeHorizontal/Vertical(targets)`: reparte el espacio disponible en partes iguales entre bordes adyacentes, conservando fijos los extremos (por posición visual, con el id como desempate determinista); no-op con menos de 3 targets.
- `centerOnPageHorizontal/Vertical(target, pageWidth|Height)`: centra UN object respecto de la página — `pageWidth`/`pageHeight` deben venir ya en la unidad canónica (`toPixels` si `page.unit !== "px"`), esta función no sabe nada de unidades físicas.

Todas devuelven `AlignmentPatch[]` (`{ objectId, transform: Partial<{x, y}> }`), filtrando internamente cualquier delta menor a `1e-6` — el resultado nunca incluye un patch para un object que ya estaba en la posición deseada (así, un batch con `dispatchBatch` nunca genera una entrada de historial vacía de cambios reales). No mutan nada ni despachan — quien llama arma los `updateObjectTransform` y los aplica con `dispatchBatch`.

**Quién mide el tamaño real de cada object:** este paquete nunca lo hace — recibe `AlignmentTarget[]` ya armado (con la caja de cada object ya calculada) desde quien orquesta la operación. En Sticker Builder, `apps/sticker-builder/alignment.ts` obtiene esas cajas vía `computeObjectBoundingBox` (`@impulso/renderer-konva`), que sigue midiendo con Konva (único camino correcto para texto sin `size` explícito o un Group anidado, ver ADR-0008) y le aplica `computeRotatedBoundingBox` de aquí. Ver ADR-0015 para el razonamiento completo de esta separación.

### 3.14 Snapping: prioridad, desempate y hysteresis, sin Konva ni DOM (Epic 7 / Fase 7.3)

`geometry/snapping.ts` es la matemática de Assisted Placement — Smart Guides, snap a página/objects/grid. Función pura: `computeSnap(input): SnapResult` evalúa X e Y de forma independiente (`evaluateAxis`).

**Modelo de prioridad**: Página > Objects > Grid, evaluados en niveles completos — si algo del nivel "Página" calza dentro de tolerancia, ni siquiera se miran los candidatos de Objects. El candidato de Grid nunca se enumera (sería infinito): se calcula analíticamente (`Math.round(valor / size) * size`) solo si ningún nivel anterior calzó.

**Desempate determinista** cuando compiten varios candidatos dentro del MISMO nivel: menor distancia gana; empate exacto → menor id de object (comparación de string); empate → orden fijo de punto de referencia (`"start" < "center" < "end"`, la posición de cada uno en `RefPoint`). Nunca hay ambigüedad ni dependencia del orden de iteración.

**Hysteresis** (evitar jitter en micro-movimientos): `previousSnap` es un parámetro explícito, no estado oculto — quien orquesta el gesto (`renderer-konva`) guarda el `SnapResult` del frame anterior y lo pasa de vuelta. Si el mismo `refPoint` sigue dentro de tolerancia × `hysteresisMultiplier` (default 1.5, mayor que la tolerancia de entrada), se reengancha sin re-evaluar prioridades desde cero — solo se recalcula el `delta` (la posición pudo cambiar dentro del gesto).

**Tolerancia**: se recibe ya normalizada por zoom, en espacio canónico (`toleranceDocumentUnits`) — quien llama calcula `toleranciaPantalla / zoom` antes de invocar (ver `renderer-konva`, `manipulation/smartGuides.ts`). Este módulo no sabe qué es "zoom".

**`eligibleRefPoints`**: restringe qué puntos de referencia del target participan por eje — usado por resize (un handle de borde solo mueve UN punto de referencia; pasar `[]`, nunca `undefined`, para el eje que ese handle no toca, o `computeSnap` evaluaría los 3 default). Move no restringe nada (los 3 son válidos).

- `buildPageSnapCandidates(pageWidth, pageHeight)`: los 6 candidatos de página (inicio/centro/fin × X/Y), en espacio canónico — quien llama convierte con `toPixels` si `page.unit !== "px"`.
- `buildObjectSnapCandidates(objectId, box)`: los 6 candidatos de un object a partir de su `BoundingBox` ya medido (ver `computeObjectBoundingBox`, §3.13).

**Quién mide/dibuja**: igual que Alignment, este módulo nunca toca Konva ni el DOM. `renderer-konva` mide (vía `computeObjectBoundingBox`), arma los candidatos, llama a `computeSnap` en cada `dragmove`, y dibuja las Smart Guides resultantes — ver su propio README y ADR-0016 para el contrato completo.

### 3.4 Versionado e historial

Cada `ContentCommand` exitoso incrementa `document.documentVersion` y agrega una `HistoryEntry` a `document.history.entries` (descripción legible, ids `documentVersionBefore`/`After`) — es la bitácora persistida que Foundation 1 ya modeló. **Excepción:** `updateMetadata` con `target.level: "project"` no toca `document` en absoluto (solo renombra el Project en sí), así que no incrementa versión ni agrega historial — sí actualiza `project.metadata.updatedAt`.

El **undo/redo en vivo** es un mecanismo aparte, deliberadamente separado de ese historial persistido: una pila en memoria de snapshots completos de `Project` (acotada por `historyLimit`, 100 por defecto). Es la implementación más simple y correcta; el costo (memoria) y la alternativa (patches/diffs) se documentan en "Riesgos".

### 3.5 Selección: estado de sesión, no contenido

`setSelection`/`clearSelection` no pasan por el pipeline de versión/historial — deshacer un cambio de contenido no debería "deshacer" qué tenías seleccionado. El Engine sí **poda automáticamente** la selección cuando un objeto seleccionado deja de existir (por un `removeObject`, un `undo`, etc.), para que `getSelection()` nunca apunte a un id fantasma.

### 3.6 Por qué una función factoría y no una clase

`createEngine()` devuelve un objeto respaldado por closures, no una instancia de clase. El estado mutable (`project`, `selection`, las pilas de undo/redo) queda encapsulado en el closure — inalcanzable salvo a través de los métodos expuestos. Los reducers que hacen el trabajo real (cada `*Commands.ts`) son funciones puras `(project, command) => Result<Project>`; `createEngine` es la única pieza con estado, deliberadamente delgada.

### 3.7 Aislamiento de entorno

Igual que `@impulso/document-schema`, este paquete no depende de DOM (`tsconfig` sin lib `"DOM"`) ni de módulos exclusivos de Node (`node:events`, etc.) — el emisor de eventos (`events/eventEmitter.ts`) es un pub-sub propio de ~15 líneas, para poder correr tanto en Node (tests) como en el navegador (donde el Engine aterrizará, embebido bajo un Renderer).

---

## 4. Ejemplos de uso

```ts
import { createEngine } from "@impulso/engine";
import { ObjectIdSchema, type Project } from "@impulso/document-schema";

const engine = createEngine(myProject); // lanza si myProject es inválido

const unsubscribe = engine.subscribe((event) => {
  if (event.type === "projectChanged") console.log("nueva versión:", event.project.document.documentVersion);
});

const result = engine.dispatch({
  type: "updateObjectTransform",
  objectId: ObjectIdSchema.parse("rect_1"),
  transform: { x: 120, y: 40 },
});

if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  console.log("nuevo x:", result.value.document.pages[0]?.layers[0]?.objects[0]?.transform.x);
}

engine.dispatch({ type: "setSelection", objectIds: [ObjectIdSchema.parse("rect_1")] });
console.log(engine.getSelection()); // ["rect_1"]

engine.undo(); // vuelve x a su valor anterior
engine.redo(); // lo vuelve a aplicar

unsubscribe();
```

### Comando genérico de metadata en distintos niveles

```ts
engine.dispatch({ type: "updateMetadata", target: { level: "project" }, metadata: { name: "Mi sticker" } });
engine.dispatch({
  type: "updateMetadata",
  target: { level: "object", objectId: ObjectIdSchema.parse("rect_1") },
  metadata: { role: "die-line" }, // así es como un plugin marca semántica sin un tipo de Object nuevo
});
```

### `dispatchBatch` + Alignment: mover varios objects con un solo undo

```ts
import { alignLeft, type AlignmentTarget } from "@impulso/engine";

// `targets` ya trae la caja real de cada object (ver `computeObjectBoundingBox`
// en @impulso/renderer-konva — el Engine nunca mide geometría por sí solo).
const targets: AlignmentTarget[] = [
  { objectId: ObjectIdSchema.parse("a"), box: { minX: 0, minY: 0, maxX: 10, maxY: 10 }, transform: { x: 0, y: 0 } },
  { objectId: ObjectIdSchema.parse("b"), box: { minX: 50, minY: 0, maxX: 60, maxY: 10 }, transform: { x: 50, y: 0 } },
];

const patches = alignLeft(targets); // [{ objectId: "b", transform: { x: 0 } }] — "a" ya estaba alineado

if (patches.length > 0) {
  const result = engine.dispatchBatch(
    patches.map((p) => ({ type: "updateObjectTransform", objectId: p.objectId, transform: p.transform })),
    { label: "Alinear a la izquierda" },
  );
  // Un solo engine.undo() revierte el movimiento de TODOS los objects del batch.
}
```

### Snapping: candidatos de página + objects, con hysteresis entre frames

```ts
import { computeSnap, buildPageSnapCandidates, buildObjectSnapCandidates } from "@impulso/engine";

// Snapshot al iniciar el gesto (una sola vez, no en cada pointermove).
const candidates = [
  ...buildPageSnapCandidates(320, 320), // página 320x320 canónico px
  ...buildObjectSnapCandidates(ObjectIdSchema.parse("badge"), { minX: 60, minY: 60, maxX: 260, maxY: 260 }),
];

let previousSnap; // undefined al iniciar el gesto

// En cada dragmove: `targetBox` ya con el delta crudo del puntero aplicado.
const result = computeSnap({
  targetBox: { minX: 95, minY: 145, maxX: 235, maxY: 185 },
  candidates,
  toleranceDocumentUnits: 8 / zoom, // 8px de pantalla, normalizado por el zoom actual
  grid: { size: 10, snapEnabled: true },
  previousSnap,
});
previousSnap = result; // se pasa de vuelta en el siguiente frame — habilita hysteresis

if (result.x) node.x(node.x() + result.x.delta);
if (result.y) node.y(node.y() + result.y.delta);
```

### Inyectar `clock` e ids para tests determinísticos

```ts
const engine = createEngine(myProject, {
  clock: () => "2026-01-01T00:00:00.000Z",
  historyEntryIdGenerator: (() => { let n = 0; return () => `h_${++n}`; })(),
  historyLimit: 50,
});
```

---

## 5. Riesgos detectados

1. **Undo/redo por snapshot completo, no por patch.** Simple y correcto, pero cada entrada de la pila de undo es una copia completa del `Project`. Para documentos muy grandes o sesiones muy largas, esto es memoria no despreciable — mitigado parcialmente por `historyLimit` (100 por defecto). Migrar a un modelo de patches/comandos-inversos es la optimización natural si esto resulta un problema real.
2. **Las actualizaciones por `objectId` reconstruyen el árbol completo del documento.** `tree/objectTree.ts` es O(n) en el total de objetos por cada `update`/`remove`/`find`. Para los tamaños de Sticker Builder es irrelevante; un documento con miles de objetos se beneficiaría de un índice `objectId -> ruta` mantenido incrementalmente.
3. **`reorderObjects` solo reordena los hijos directos de una Layer**, no los hijos de un `group` anidado — es una limitación deliberada (no se pidió), documentada en el propio código de `objectCommands.ts`.
4. **El emisor de eventos entrega de forma síncrona y en orden de suscripción**, sin manejo especial si un listener lanza una excepción (esa excepción se propagaría hacia quien llamó a `dispatch`). No se agregó un try/catch por listener porque no hay evidencia de que haga falta todavía.
5. **`resizeObject` confía en que `intrinsicSize` (medido por el Renderer) es correcto** — el Engine no tiene forma de verificar independientemente esa medición, porque calcular la geometría real de un `Path` con curvas bezier o de un `Group` anidado requiere conocimiento de renderizado que el Engine deliberadamente no tiene (ver ADR-0008). Un `intrinsicSize` incorrecto produce un resize matemáticamente consistente pero visualmente erróneo — no hay forma de detectarlo desde este paquete.
6. **`groupObjects`/`ungroupObject` solo soportan un nivel de anidamiento** (hijos directos de una Layer) — agrupar objects ya anidados en otro group, o desagrupar un group anidado en otro group, se rechaza explícitamente con `invalid_group` en vez de intentarlo. Documentado, no un descuido (ver §3.9).
7. **Alignment/Distribution no consideran objects dentro de un `group`** (solo top-level) — consistente con que un Group ya se trata como una unidad indivisible en el resto del producto, no una limitación nueva de esta fase (Epic 7 / Fase 7.2, ver ADR-0015).
8. **Sin caché de bounding boxes entre operaciones sucesivas de Alignment** — cada operación remide desde cero vía `computeObjectBoundingBox` (ver `PERFORMANCE_BUDGET.md`, fila 18); aceptable a la escala actual de selección típica.
9. **`computeSnap` no sabe nada de rotación por sí solo** — recibe `targetBox` ya como AABB (potencialmente de un object rotado, vía `computeRotatedBoundingBox`), pero decidir qué ajuste es "seguro" invertir de vuelta a un `pointerDelta` de resize para un object rotado es responsabilidad de quien llama (`renderer-konva`), no de este módulo — y esa pieza deliberadamente NO se construyó para objects rotados en Fase 7.3 (ver ADR-0016, Riesgos).

## 6. Posibles mejoras futuras

*(No implementadas — fuera de alcance de Foundation 2 / Editor Epic 1 / Sticker Creation Experience.)*

- Comandos para reordenar/mover hijos dentro de un `group` anidado, y para agrupar/desagrupar más allá de un solo nivel (ver Riesgo 6).
- Un modo de undo/redo basado en patches en vez de snapshots completos (ver Riesgo 1).
- Índice `objectId -> ruta` para acelerar las operaciones sobre objetos en documentos grandes (ver Riesgo 2).
- Middleware/interceptores de `dispatch` (por ejemplo, para que un plugin valide un comando antes de que llegue al reducer) — no se construyó porque Foundation 2 no incluye todavía el sistema de Plugins.
- Manipulación visual conjunta de una selección múltiple (mover/redimensionar/rotar como una unidad, con una sola caja envolvente manipulable) — `dispatchBatch` ya está listo para soportarlo; falta la UX de Fase 7.4 (Multi Selection).
- Reutilizar `computeRotatedBoundingBox`/`computeObjectBoundingBox` para Smart Guides/Snapping (Fase 7.3) — la matemática de bounding boxes ya existe, falta la lógica de snap en sí.
