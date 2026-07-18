# @impulso/engine

> FOUNDATION 2 de Impulso Builder Platform. El núcleo del motor de edición: estado, comandos y eventos sobre el `@impulso/document-schema`. Cero dependencias de renderizado. Desde EDITOR EPIC 1 (Manipulation System) también expone la geometría pura de resize/rotate — ver [ADR-0008](../../docs/adr/0008-manipulation-system.md).

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
    │   ├── pageCommands.ts         # addPage / removePage / reorderPages
    │   ├── layerCommands.ts        # addLayer / removeLayer / reorderLayers
    │   ├── objectCommands.ts       # addObject / removeObject / updateObjectTransform|Style / reorderObjects
    │   ├── resizeObjectCommand.ts  # resizeObject — delega en geometry/resizeMath.ts + updateObjectTransform
    │   ├── rotateObjectCommand.ts  # rotateObject — delega en geometry/rotateMath.ts + updateObjectTransform
    │   ├── metadataCommand.ts      # updateMetadata — un comando, 5 niveles (project/document/page/layer/object)
    │   ├── selectionCommands.ts    # setSelection / clearSelection / toggleObjectSelection / pruneSelection
    │   └── applyCommand.ts         # orquesta: reducer -> versión -> historial -> validación final
    │
    ├── geometry/
    │   ├── resizeMath.ts           # computeResizedTransform — función pura, sin Project ni dispatch
    │   └── rotateMath.ts           # computeRotatedTransform — función pura, sin Project ni dispatch
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

    (167 tests, 100% de cobertura)
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

Los 16 comandos son 1:1 con las operaciones estructurales que el Document Schema ya define — nada específico de Sticker Builder:

| Nivel | Comandos |
|---|---|
| Page | `addPage`, `removePage`, `reorderPages` |
| Layer | `addLayer`, `removeLayer`, `reorderLayers` |
| Object | `addObject`, `removeObject`, `updateObjectTransform`, `updateObjectStyle`, `reorderObjects`, `resizeObject`, `rotateObject` |
| Metadata (genérico, 5 niveles) | `updateMetadata` con un `EntityRef` (`project`\|`document`\|`page`\|`layer`\|`object`) |
| Selección (efímera, no versionada) | `setSelection`, `clearSelection`, `toggleObjectSelection` (selección múltiple, ver Editor 2 / ADR-0006) |

`updateMetadata` es un único comando para los cinco niveles en vez de `updateProjectMetadata`/`updateDocumentMetadata`/... — mismo principio de "sistema genérico" que el Document Schema aplicó a sus tipos de Object.

Los comandos de **objeto** se dirigen solo por `objectId` (no `pageId`+`layerId`): un Object puede estar anidado a cualquier profundidad dentro de un `group`, así que el Engine lo busca en todo el árbol (`tree/objectTree.ts`) en vez de exigirle a quien llama que sepa la ruta exacta.

`resizeObject` y `rotateObject` no duplican la lógica de fusión/validación de `Transform`: cada uno calcula un `Partial<Transform>` (vía `geometry/resizeMath.ts` / `geometry/rotateMath.ts`) y se lo delega tal cual al reducer ya probado de `updateObjectTransform` — ver §3.8.

### 3.8 Geometría de manipulación: funciones puras, exportadas en la API pública

`computeResizedTransform` y `computeRotatedTransform` (`src/geometry/`) son las únicas piezas de este paquete pensadas explícitamente para ser llamadas **fuera** de `dispatch`. Un Renderer las usa para computar una previsualización visual en cada `dragmove` (sin tocar el `Project`, sin disparar un rebuild) y, al soltar el puntero, el comando `resizeObject`/`rotateObject` llama **exactamente a la misma función** para calcular el `Transform` final — preview y estado commiteado nunca pueden divergir, porque es el mismo cálculo. Ver ADR-0008 para el razonamiento completo (por qué el resize opera sobre `scaleX`/`scaleY` y no sobre `size`, y por qué `intrinsicSize` lo mide el Renderer y no el Engine).

Estas dos funciones son deliberadamente las únicas en el Engine que no requieren un `Project` para ejecutarse — reciben un `Transform` (o un ángulo) y devuelven un `Partial<Transform>`. Son las candidatas naturales si en el futuro se decide extraer un sub-paquete `@impulso/geometry` puro, pero eso no se hizo aquí porque no hay todavía una segunda necesidad de consumirlas fuera de `@impulso/engine`.

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

## 6. Posibles mejoras futuras

*(No implementadas — fuera de alcance de Foundation 2 / Editor Epic 1.)*

- Comandos para reordenar/mover hijos dentro de un `group` anidado.
- Un modo de undo/redo basado en patches en vez de snapshots completos (ver Riesgo 1).
- Índice `objectId -> ruta` para acelerar las operaciones sobre objetos en documentos grandes (ver Riesgo 2).
- Middleware/interceptores de `dispatch` (por ejemplo, para que un plugin valide un comando antes de que llegue al reducer) — no se construyó porque Foundation 2 no incluye todavía el sistema de Plugins.
