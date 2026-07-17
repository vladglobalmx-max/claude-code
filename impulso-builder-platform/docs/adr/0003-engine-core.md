# ADR-0003 — Engine Core: estado, comandos y eventos

> Retrofit de Foundation 2. Detalle completo en [`../../packages/engine/README.md`](../../packages/engine/README.md).

## Problema
¿Cómo permitir modificar un `Project` de forma segura (validada, versionada, deshacible) sin que quien lo modifica necesite saber cómo se dibuja, y sin acoplarse a una librería de renderizado?

## Contexto
ADR-0001 exige que `packages/engine` no dependa de Konva/React/DOM. El Document Schema (ADR-0002) ya define la forma de los datos; falta la lógica que los muta con seguridad.

## Alternativas evaluadas
- **Mutación directa del objeto Project** (`project.pages.push(...)`): simple, pero sin validación centralizada, sin historial, sin forma limpia de notificar cambios.
- **Undo/redo basado en patches/comandos inversos**: más eficiente en memoria, pero requiere escribir y mantener una función inversa por cada uno de los 13 comandos — más superficie de bugs para un beneficio no demostrado todavía.
- **`node:events` para el pub-sub**: disponible en Node, pero no funciona en el navegador — el Engine debe poder correr en ambos entornos.

## Decisión tomada
API de comandos + estado + eventos: `dispatch(command)` (nunca lanza, devuelve `EngineResult<Project>`), `undo()`/`redo()` sobre una pila de snapshots completos en memoria (no patches), y un pub-sub propio de ~15 líneas (sin `node:events` ni DOM) para los eventos (`projectChanged`/`selectionChanged`/`historyChanged`/`commandRejected`).

## Consecuencias
- Cada comando de contenido exitoso incrementa `documentVersion` y agrega una `HistoryEntry`; `updateMetadata` a nivel `project` es la única excepción documentada (no toca `document`).
- La selección es estado de sesión, no versionado — deshacer contenido no deshace qué estaba seleccionado.

## Riesgos
- Undo/redo por snapshot completo es O(tamaño del Project) en memoria por entrada de historial — aceptable para los tamaños actuales, pero un cuello de botella documentado si los documentos crecen mucho (ver `../PERFORMANCE_BUDGET.md`).
- Las operaciones sobre `SceneObject` por id reconstruyen el árbol completo del documento (O(n) en el total de objetos) — mismo tipo de riesgo.

## Compatibilidad futura
El contrato `RendererAdapter` (implementado por primera vez en ADR-0004) consume `Engine` tal cual quedó aquí, sin cambios — es la prueba de que la separación funciona.
