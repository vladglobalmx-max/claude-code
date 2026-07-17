# Performance Budget — Impulso Builder Platform

Regla permanente desde Foundation 3: toda decisión con impacto de rendimiento se documenta con **complejidad aproximada**, **cuellos de botella posibles** y **estrategia de optimización futura** — sin optimizar prematuramente. Este documento es el registro consolidado entre Foundations; el detalle de cada decisión vive también en el ADR correspondiente.

**Objetivo del proyecto:** Impulso debe poder manejar documentos grandes (miles de objetos) sin degradar la experiencia de edición.

## Registro

| # | Foundation | Decisión | Complejidad | Cuello de botella | Optimización futura (no implementada) |
|---|---|---|---|---|---|
| 1 | 2 (Engine) | `tree/objectTree.ts`: buscar/actualizar/eliminar un `SceneObject` por id reconstruye el sub-árbol completo del documento | O(n) por operación, n = total de objects en el documento | Documentos con miles de objects y ediciones frecuentes (ej. drag continuo) generan O(n) trabajo por cada evento | Índice `objectId → ruta` mantenido incrementalmente, para localizar/actualizar en O(profundidad) en vez de O(n) |
| 2 | 2 (Engine) | Undo/redo por snapshot completo del `Project` (no patches) | O(tamaño del Project) en memoria por entrada de historial | Sesiones largas con documentos grandes acumulan memoria proporcional a `historyLimit` × tamaño del documento | Undo/redo basado en patches/comandos inversos (JSON Patch o similar) — requiere definir un formato de patch, hoy deliberadamente opaco (`HistoryEntry.patch: JsonValue`) |
| 3 | 2 (Engine) | `updateInList`/reducers reconstruyen un `Group` con un nuevo objeto (`{...object, children: ...}`) aunque nada dentro de ese group haya cambiado | Rompe "structural sharing" solo para ancestros `group` de cualquier cambio en el documento | Un futuro diffing por referencia (ver #4) no podría confiar en igualdad referencial para `group`s sin cambios | Preservar la referencia del `group` cuando ninguno de sus descendientes cambió (comparar antes de reconstruir) |
| 4 | 3 (Renderer) | `createKonvaRenderer` hace **rebuild completo** de los nodos Konva en cada `projectChanged` (`destroyChildren()` + recrear todo) | O(m) por render, m = total de objects en la página activa | La causa principal de jank en documentos grandes: cualquier cambio, por pequeño que sea (mover un solo object), destruye y recrea TODOS los nodos Konva de la página | Reconciliación incremental: diffear el árbol anterior vs el nuevo por `id` (crear/actualizar/eliminar solo lo que cambió), similar a un diff de DOM virtual. Depende de resolver primero el Riesgo #3 (o de diffear por id+igualdad estructural en vez de por referencia) |
| 5 | 3 (Renderer) | Un único `Konva.Layer` por Stage; cada `Layer` del Document Schema se mapea a un `Konva.Group` (no a un `Konva.Layer`) | O(1) canvases reales por Stage, independiente del número de Layers del documento | Ninguno identificado — es la mitigación, no el problema | N/A — Konva recomienda explícitamente pocos `Layer` reales (cada uno es un canvas propio); mapear 1:1 Document-Layer→Konva.Layer hubiera sido el anti-patrón a evitar |
| 6 | 3 (Renderer) | Conversión de unidades física (mm/in) a píxeles vía una constante fija (`96px/in`) | O(1) | Ninguno a este tamaño; una futura exportación de alta resolución necesitará un DPI configurable, no el fijo de pantalla | Hacer el DPI configurable por operación (pantalla vs exportación) cuando exista Export (Foundation futura) |

## Cómo se usa este documento

Antes de cerrar un Foundation, revisar si alguna decisión nueva tiene impacto de rendimiento y agregar una fila aquí (y la sección "Rendimiento" correspondiente en su ADR). No es una lista de tareas pendientes — es un mapa de "dónde están los cuellos de botella conocidos y por qué no se resolvieron todavía", para que la próxima vez que rendimiento sea un problema real y medido, ya exista un plan escrito en vez de tener que investigarlo desde cero.
