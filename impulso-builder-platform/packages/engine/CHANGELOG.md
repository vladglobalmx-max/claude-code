# Changelog — @impulso/engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
