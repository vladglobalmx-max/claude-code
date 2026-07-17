# ADR-0006 — Selection System

## Problema
¿Cómo dar al usuario la capacidad de seleccionar objects por click (single, cambiar entre objects, deseleccionar en vacío, y selección múltiple) manteniendo la regla arquitectónica de que **toda la lógica vive en el Engine** y el **Renderer solo muestra el estado**?

## Contexto
- El Engine (Foundation 2) ya tenía `getSelection()`, `setSelection`, `clearSelection` y poda automática de ids inexistentes — la selección como estado de sesión ya existía, pero nada la disparaba desde una interacción real ni la mostraba visualmente.
- El Renderer (Foundation 3) ya traduce `dragend` en un comando del Engine — el mismo patrón de "traducir el evento crudo, no decidir su significado" debía extenderse a click.
- Regla nueva de este sprint: **UX First** — cada entrega documenta flujo del usuario, consistencia de interacción, accesibilidad y mejoras futuras.
- Regla nueva anterior: **Stable Public API** — cualquier cambio a una API pública existente necesita su propio ADR de motivo/impacto/compatibilidad/migración.
- Explícitamente fuera de alcance: mover objetos (ya existe, heredado, no se toca), resize, rotación, handles, toolbar, sidebar, panel de propiedades, zoom, pan, exportaciones.

## Alternativas evaluadas

**Dónde vive la semántica de selección múltiple (Shift-click):**
- *El Renderer calcula el nuevo array de seleccionados y llama `setSelection` con el resultado*: viola "toda la lógica vive en el Engine" — el Renderer estaría decidiendo qué significa "seleccionar con Shift", no solo traduciendo un evento.
- *Un nuevo comando `toggleObjectSelection { objectId }` en el Engine*: **elegido**. El Renderer solo decide QUÉ comando enviar (`setSelection` vs `toggleObjectSelection`) según un hecho crudo del navegador (¿Shift estaba presionado?); el Engine decide qué le pasa a la selección como resultado. Es además reutilizable por cualquier futura superficie de UI (un panel de capas con Ctrl-click, por ejemplo) sin duplicar la lógica de toggle.

**Bloqueado (`metadata.locked`) y si debe seguir siendo seleccionable:**
- *Mantener el comportamiento de Foundation 3 (`locked` → `listening: false`, no genera ningún evento)*: un object bloqueado se volvería invisible para el sistema de selección — no se podría ni inspeccionar.
- *Desacoplar `listening` (ahora depende de `visible`) de `draggable` (sigue dependiendo de `locked`)*: **elegido**. Un object bloqueado sigue siendo seleccionable por click, solo no se puede arrastrar. Es un cambio de comportamiento interno respecto a Foundation 3 — no de la API pública (misma firma de `createKonvaRenderer`) — documentado aquí y en el CHANGELOG por transparencia, aunque la regla de Stable Public API no exija un ADR de "cambio de API" para esto.

**Cómo mostrar visualmente la selección sin reconstruir todo el contenido:**
- *Redibujar todo con `renderContent()` en cada `selectionChanged`*: más simple de escribir, pero un click (que ocurrirá constantemente) dispararía el mismo costo de rebuild completo ya documentado como el cuello de botella principal del Renderer (PERFORMANCE_BUDGET fila 4) — para una operación que no cambió el contenido en absoluto.
- *Un `Konva.Layer` separado (`selectionLayer`) solo para el overlay, redibujado independientemente*: **elegido**. Es el patrón que la propia documentación de Konva recomienda para UI que cambia con más frecuencia que el contenido. Sigue siendo consistente con la regla "un solo Layer de contenido" de Foundation 3 (ver ADR-0004): son dos layers *fijos* (contenido + overlay de selección), no uno por cada Layer del documento.

**Convención de interacción (qué hace cada click):**
- *Inventar un modelo propio*: sin ninguna ventaja sobre las convenciones ya establecidas, y con el costo real de que cualquier usuario que conozca Figma/Illustrator/Sketch tendría que reaprender el comportamiento.
- *Seguir la convención de facto de las herramientas de diseño de referencia* (click reemplaza, Shift-click alterna, click-vacío limpia): **elegido** — es la opción más consistente con expectativas ya formadas (ver README, sección UX).

## Decisión tomada
Nuevo comando `toggleObjectSelection { objectId }` en `@impulso/engine` (adición pura a `SelectionCommandSchema`, sin tocar `setSelection`/`clearSelection`). En `@impulso/renderer-konva`: cada nodo escucha `click` y decide entre `setSelection`/`toggleObjectSelection` según `evt.evt.shiftKey`, deteniendo la propagación; el `Stage` escucha `click` para limpiar la selección cuando el click no llegó a ningún object; un `Konva.Layer` separado (`selectionLayer`) dibuja el indicador visual (contorno punteado), redibujado solo en `selectionChanged`.

## Consecuencias
- La API pública de `@impulso/engine` gana un comando (aditivo); la de `@impulso/renderer-konva` no cambia de firma, pero sí de comportamiento interno para objects bloqueados.
- Cualquier futura superficie de interacción (panel de capas, atajos de teclado) puede reutilizar `toggleObjectSelection`/`setSelection`/`clearSelection` sin duplicar lógica de selección múltiple.
- El overlay de selección es puramente informativo (`listening: false`) — nunca intercepta un click ni un drag.

## Riesgos
- `mainLayer.findOne('#' + id)` para ubicar el nodo de un object seleccionado es O(profundidad del árbol) por id vía el selector de Konva — irrelevante a la escala actual, pero es otro punto que se beneficiaría del mismo índice `objectId -> nodo` sugerido para la reconciliación incremental (ver PERFORMANCE_BUDGET fila 4).
- Un id seleccionado que no corresponde a ningún nodo (ej. quedó colgante por alguna razón no anticipada) se ignora silenciosamente en el overlay — no lanza, pero tampoco avisa. Aceptable porque `pruneSelection` (Foundation 2) ya debería prevenir este caso en la práctica.
- Sin selección accesible por teclado ni lector de pantalla — ver README, "Accesibilidad". Es una limitación real, no un descuido.

## Compatibilidad futura
`toggleObjectSelection` y el `EntityRef`-like de dirigirse "por id" dejan espacio para que un futuro panel de capas o atajos de teclado disparen exactamente los mismos comandos sin que el Engine necesite saber de dónde vino el click.

## Rendimiento
- **Complejidad aproximada:** `renderSelectionOverlay()` es O(k · d), donde k = cantidad de objects seleccionados (típicamente pequeño) y d = profundidad del árbol para el `findOne` de Konva por cada uno. Completamente independiente del rebuild de contenido (O(m), m = objects totales de la página).
- **Cuellos de botella posibles:** ninguno nuevo relevante a esta escala. El riesgo ya documentado (rebuild completo de contenido en PERFORMANCE_BUDGET fila 4) sigue siendo el mismo de antes — este sprint deliberadamente NO lo agrava (la razón misma de separar `selectionLayer` fue evitar que la interacción más frecuente del editor, hacer click, heredara ese costo).
- **Estrategia de optimización futura:** si `findOne` por id resultara costoso en documentos con árboles muy profundos, se podría mantener un índice `objectId -> Konva.Node` construido durante `renderContent()` y reutilizado por `renderSelectionOverlay()` — no implementado ahora por falta de evidencia de que haga falta.
