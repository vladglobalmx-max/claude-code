# Changelog — @impulso/engine

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
