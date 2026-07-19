# Changelog — @impulso/engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.9.0] — Epic 7 / Fase 7.3: Assisted Placement

### Agregado
- `geometry/snapping.ts` (nuevo): `computeSnap({ targetBox, candidates, toleranceDocumentUnits, grid?, previousSnap?, eligibleRefPoints? })` — snapping puro, sin Konva ni DOM. Prioridad Página > Objects > Grid (niveles completos); desempate determinista (menor distancia → menor id de object → orden fijo de punto de referencia); hysteresis vía `previousSnap` explícito (parámetro, no estado oculto). `buildPageSnapCandidates`/`buildObjectSnapCandidates`: helpers para armar los 6 candidatos (inicio/centro/fin × X/Y) de página y de un object.
- `updatePageGrid` (comando nuevo, `commands/pageCommands.ts`): merge-then-validate sobre `Page.grid` (`@impulso/document-schema` 0.4.0), mismo patrón que `updateObjectTransform`. Nuevo código de error `invalid_grid`. Pasa por el pipeline normal de historial/versión/validación.
- Adición pura a la API pública existente — no requiere ADR de cambio de API (regla de Stable Public API), pero sí un ADR de arquitectura nuevo (ADR-0016) por introducir un mecanismo genuinamente nuevo.
- 20 tests nuevos en `geometry/snapping.test.ts` + 5 en `pageCommands.test.ts` + 1 en `applyCommand.test.ts` (312 tests en total), 100% de cobertura mantenida. Sin dependencias circulares (verificado con `madge`).

## [0.8.0] — Epic 7 / Fase 7.2: Batch Operations + Alignment

### Agregado
- `dispatchBatch(commands, metadata?)` (`engine.ts`): aplica N `ContentCommand` como una única transacción lógica — una sola entrada de historial, un solo undo/redo revierte/restaura todo el batch. Atómico por construcción (`applyContentCommandBatch`, `commands/applyCommand.ts`, corre cada reducer sobre un acumulador local que nunca toca el `project` en vivo hasta que todos los comandos tienen éxito). No admite `SelectionCommand`. Batch vacío: no-op explícito. Compatible al 100% con `dispatch()` existente. Ver ADR-0015.
- `EngineEvent` gana `batchRejected`; `EngineChangeCause` gana `{ type: "batch", commands, label? }` — aditivo, ningún consumidor existente se ve afectado.
- `geometry/boundingBox.ts` (nuevo): `computeRotatedBoundingBox`, `unionBoundingBox` — AABB de un object rotado/escalado y envolvente conjunta de varias cajas, puros, sin Konva ni DOM.
- `geometry/alignment.ts` (nuevo): `alignLeft/Right/Top/Bottom/CenterHorizontal/CenterVertical`, `distributeHorizontal/Vertical`, `centerOnPageHorizontal/Vertical` — funciones puras que calculan patches de `Transform` para selección múltiple/individual, filtrando internamente cualquier cambio menor a `1e-6` (garantiza cero entradas de historial cuando nada cambia).
- Adición pura a la API pública existente — ningún comando/función previa cambia de comportamiento; no requiere ADR de cambio de API (regla de Stable Public API), pero sí un ADR de arquitectura nuevo (ADR-0015) por introducir un mecanismo genuinamente nuevo.
- 286 tests en total (55 nuevos: contrato de batch dispatch, bounding boxes, alignment/distribution, benchmark ligero de 150 objects en un solo batch), 100%/99.57%/100%/100% de cobertura (únicos gaps: dos ramas defensivas ya documentadas, no ejercitables en uso normal). Sin dependencias circulares (verificado con `madge`).

## [0.7.0] — Epic 7 / Fase 7.1: Inspector Honesto y Profesional

### Agregado
- Comando `updateTextStyle { objectId, textStyle: { fontFamily?, fontSize?, textAlign? } }` (`commands/objectCommands.ts`): cubre los tres campos de `TextObject` que el Inspector exponía como controles sin ningún comando que los respaldara (no-ops silenciosos, ver UX Audit 0002). Mismo criterio que `updateObjectContent` (rechaza si el object no es `type: "text"`, código de error nuevo `invalid_text_style`) y que `updateObjectStyle`/`updateObjectTransform` (merge-then-validate: fusiona el patch parcial sobre el object completo y valida el resultado entero contra `TextObjectSchema`, nunca aplica un patch a medias).
- Separado de `updateObjectStyle` porque `fontFamily`/`fontSize`/`textAlign` son campos propios de `TextObjectSchema`, no de `StyleSchema`.
- Adición pura a la API pública existente (un comando nuevo) — ningún comando previo cambia de comportamiento; no requiere ADR de cambio de API (regla de Stable Public API).
- 231 tests en total (7 nuevos: 6 del reducer + 1 del pipeline completo vía `applyContentCommand`), 100%/99.73%/100%/100% de cobertura (único gap: una rama defensiva ya documentada en `objectCommands.ts`, no ejercitable en uso normal). Sin dependencias circulares (verificado con `madge`).

## [0.6.0] — Epic 4: Templates Foundation

### Agregado
- `cloneProjectWithNewIds(project, { now, generateId }): Project` (`cloning/cloneProject.ts`): clona un `Project` completo asignando un id nuevo a `Project`/`Document`/cada `Page`/cada `Layer`/cada object de nivel superior (reutilizando `cloneSceneObjectWithNewIds` por object, incluida la recursión de grupos). Resetea `documentVersion` a 1 y `history.entries` a `[]`; actualiza timestamps. `generateId` es un parámetro **requerido** (sin default) — misma convención que `cloneSceneObjectWithNewIds`: el Engine nunca inventa identidad, y el paquete se mantiene libre de dependencias del DOM (`crypto.randomUUID()` no está disponible en su `lib`).
- Deliberadamente preserva `document.assets` y cada `ImageObject.assetId` sin reasignar — es una función pura y síncrona sin acceso a `AssetBinaryStore`, no puede duplicar binarios de forma segura. Ver ADR-0013 para el riesgo aceptado.
- Adición pura a la API pública existente (una función nueva) — ningún comando previo cambia de comportamiento; no requiere ADR de cambio de API (regla de Stable Public API). Ver ADR-0013 para el razonamiento de diseño de la épica completa (Templates Foundation).
- 7 tests nuevos (232 en total), 100%/99.72%/100%/100% de cobertura. Sin dependencias circulares (verificado con `madge`).

## [0.5.0] — Epic 2: Asset Library

### Agregado
- Comandos `addAsset { asset }` / `removeAsset { assetId }` / `renameAsset { assetId, name }` (`commands/assetCommands.ts`): operan sobre `document.assets` (registro de descriptores de Asset Library, ver ADR-0011), genéricos sobre la unión completa de `Asset` — el reducer nunca necesita saber de qué tipo concreto es un Asset. `renameAsset` es un comando separado (no un caso de `updateMetadata`) porque `Asset.name` es un campo de primer nivel, no parte de `metadata`.
- `EntityRef` gana el nivel `"asset"` (`{ level: "asset", assetId }`): `updateMetadata` ahora cubre tags/description de un Asset igual que cubre los demás niveles.
- Dos códigos de error nuevos: `asset_not_found`, `duplicate_asset_id`.
- Adición pura a la API pública existente (tres comandos nuevos, un nivel nuevo de `EntityRef`) — ningún comando previo cambia de comportamiento; no requiere ADR de cambio de API (regla de Stable Public API). Ver ADR-0011 para el razonamiento de diseño de la épica completa.
- 16 tests nuevos (218 en total), 100%/99.72%/100%/100% de cobertura. Sin dependencias circulares (verificado con `madge`).

### Alcance (documentado, no un descuido)
`removeAsset` no valida si el Asset sigue siendo referenciado por algún `ImageObject.assetId` — mismo criterio que el resto del Engine (no valida referencias cruzadas en otros casos tampoco). El binario real de un Asset vive fuera de este paquete (`@impulso/asset-library`); el Engine solo conoce el descriptor.

## [0.4.0] — Sticker Creation Experience

### Agregado
- Comando `groupObjects { objectIds, group }`: agrupa 2+ objects hermanos (hijos directos de la misma layer) en un nuevo `GroupObject`. `group` es el object base completo (id/transform/style/metadata/pluginData/customProperties, sin `children`) — el Engine nunca inventa identidad ni timestamps, igual que `addObject`. Con un `transform` identidad, agrupar no mueve nada visualmente (es una operación puramente estructural).
- Comando `ungroupObject { objectId }`: reemplaza un Group (hijo directo de una layer) por sus hijos en su misma posición, horneando el transform del Group en cada hijo (`composeChildTransformIntoParent`) para que nada se mueva visualmente aunque el Group haya sido movido/rotado/escalado.
- Comando `updateObjectContent { objectId, content }`: actualiza el `content` de un `TextObject` — rechaza cualquier otro tipo de object en vez de ignorarlo.
- `composeChildTransformIntoParent(parent, child)`: función pura de composición de transforms (escalar → rotar → trasladar), exportada desde la API pública — la misma matemática que usa `ungroupObject` internamente.
- `cloneSceneObjectWithNewIds(object, generateId, now, options?)`: utilidad pura (no un comando) que clona un `SceneObject` recursivamente (incluye `Group`s anidados a cualquier profundidad) asignando un id nuevo a cada nodo del subárbol. Pensada para que "Duplicar" reutilice `addObject` sin necesitar un comando nuevo — el generador de ids lo provee quien llama, el Engine nunca inventa identidad.
- Dos códigos de error nuevos: `invalid_content`, `invalid_group`.
- Adición pura a la API pública existente (tres comandos nuevos, dos funciones nuevas) — ningún comando previo cambia de comportamiento; no requiere ADR de cambio de API (regla de Stable Public API). Ver ADR-0010 para el razonamiento de diseño de la épica completa.
- 35 tests nuevos (202 en total), 100% de cobertura en statements/functions/lines. Sin dependencias circulares (verificado con `madge`).

### Alcance (documentado, no un descuido)
`groupObjects`/`ungroupObject` solo operan sobre hijos DIRECTOS de una Layer — agrupar objects ya anidados en otro group, o desagrupar un group anidado en otro group, no está soportado en esta primera versión (mismo tipo de restricción que ya tenía `reorderObjects` desde Foundation 2).

## [0.3.0] — Editor Epic 1 (Manipulation System)

### Agregado
- Comando `resizeObject { objectId, handle, pointerDelta, intrinsicSize, maintainAspectRatio? }`: redimensiona un object vía sus 8 handles estándar (`top-left`…`bottom-right`), operando exclusivamente sobre `transform.scaleX`/`scaleY` (nunca sobre `size`, que no existe para `Path`/`Group`). Delega la fusión/validación final en el reducer ya existente de `updateObjectTransform`.
- Comando `rotateObject { objectId, pointerAngleDegrees, snapToIncrement? }`: rota un object a un ángulo absoluto, con normalización a `[0, 360)` y snapping opcional a incrementos de 15° (`ROTATION_SNAP_INCREMENT_DEGREES`).
- `computeResizedTransform` y `computeRotatedTransform`, exportadas desde la API pública como funciones puras (`src/geometry/`) — sin `Project`, sin `dispatch`. Permiten que un Renderer las llame directamente para previsualizar en vivo durante un gesto de drag, garantizando que la previsualización y el estado finalmente commiteado sean siempre idénticos (mismo cálculo). Ver ADR-0008.
- `RESIZE_HANDLES`/`ResizeHandle`/`ResizeHandleSchema` (los 8 handles válidos), `MIN_RESIZE_SIZE` (tamaño mínimo, previene colapso/inversión de la forma).
- Adición pura a la API pública existente (dos comandos nuevos, dos funciones nuevas) — no cambia el comportamiento de ningún comando previo, por eso no requiere un ADR de cambio de API (regla de Stable Public API); ADR-0008 documenta la decisión de diseño del sistema completo, no un cambio disruptivo.
- 50 tests nuevos (167 en total), 100% de cobertura mantenida. Sin dependencias circulares (verificado con `madge`).

## [0.2.0] — Editor 2 (Selection System)

### Agregado
- Comando `toggleObjectSelection { objectId }`: agrega/quita un id de la selección actual (selección múltiple). Adición pura a la API pública existente — `setSelection`/`clearSelection` no cambian de comportamiento, por eso no requiere un ADR de cambio de API (ver `docs/adr/0006-selection-system.md` y la regla de Stable Public API).

## [0.1.0] — Foundation 2

### Agregado
- `createEngine(project, options)`: motor de edición basado en comandos, estado y eventos, operando exclusivamente sobre `@impulso/document-schema` (sin Renderer, Konva, React, Canvas ni UI).
- 13 comandos de contenido (`addPage`/`removePage`/`reorderPages`, `addLayer`/`removeLayer`/`reorderLayers`, `addObject`/`removeObject`/`updateObjectTransform`/`updateObjectStyle`/`reorderObjects`, `updateMetadata` genérico de 5 niveles) más `setSelection`/`clearSelection`, validados con Zod.
- Versionado automático: cada comando de contenido exitoso incrementa `documentVersion` y agrega una `HistoryEntry`, con la excepción documentada de `updateMetadata` a nivel `project`.
- Undo/redo en memoria (pila de snapshots, límite configurable), independiente del historial persistido.
- Selección como estado de sesión (no versionado), con poda automática de ids que dejan de existir.
- Sistema de eventos (`projectChanged`, `selectionChanged`, `historyChanged`, `commandRejected`) vía un pub-sub propio sin dependencias de Node ni del DOM.
- Utilidades de árbol (`tree/objectTree.ts`) para localizar/actualizar/eliminar un `SceneObject` a cualquier profundidad dentro de `group`s.
- `dispatch`/`undo`/`redo` nunca lanzan — API basada en `EngineResult<T>` (`{ ok, value }` / `{ ok, error }`); `createEngine` sí lanza ante un Project inicial inválido.
- 113 tests, 100% de cobertura. Sin dependencias circulares (verificado con `madge`).
