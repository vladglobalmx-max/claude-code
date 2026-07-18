# Changelog — @impulso/engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
