# ADR-0007 — Transform System: movimiento de objetos

## Problema
El usuario ya puede seleccionar objects (Editor 2) y ya existe un mecanismo de arrastre desde Foundation 3 (`updateObjectTransform`). ¿Qué falta realmente para que exista un "Transform System" — sólido, desacoplado, preparado para resize/rotación futuros — y no solo el arrastre ad-hoc que ya había?

## Contexto
- `updateObjectTransform` (Foundation 2) ya acepta un `Partial<Transform>` — ya estaba diseñado para cubrir mover, y más adelante rotar/escalar, sin cambiar de forma. **No hizo falta ningún cambio en `@impulso/engine` para este sprint** — la mejor confirmación posible de que ese diseño ya anticipaba esto.
- El arrastre de Foundation 3 movía CUALQUIER object, estuviera o no seleccionado, sin relación con el sistema de selección de Editor 2.
- El flujo descrito por el encargo — "seleccionar un objeto, arrastrarlo con el puntero" — describe una secuencia que la implementación actual no garantizaba: se puede arrastrar sin haber seleccionado antes, y el resaltado de selección no acompañaba el arrastre.
- Regla vigente: toda la lógica de transformación vive en el Engine; el Renderer solo traduce eventos de puntero y actualiza la vista.

## Alternativas evaluadas

**Qué hace un arrastre sobre un object no seleccionado:**
- *Dejarlo como estaba (mueve sin seleccionar)*: es lo que ya existía, pero no cumple "seleccionar, luego arrastrar" como una experiencia coherente — el usuario movería algo sin ver qué es lo que está moviendo.
- *`dragstart` selecciona el object si no lo estaba ya*: **elegido**. El resaltado de selección aparece desde el primer frame del arrastre, no solo al soltar. Si el object ya formaba parte de una selección múltiple, esa selección se conserva (no se colapsa a uno solo) — mover varios objects a la vez sigue fuera de alcance, pero no se rompe el estado de selección existente por el simple hecho de arrastrar uno de ellos.

**Organización del código en el Renderer:**
- *Dejar `click` y `dragend` mezclados en `applyBaseAttrs`, como en Editor 2*: funcionaba, pero "preparado para futuras transformaciones" (resize, rotación) pide una costura clara para agregar nuevas interacciones sin seguir engordando un solo archivo.
- *Extraer `interactions/selectionInteractions.ts` y `interactions/transformInteractions.ts`, dejando `baseAttrs.ts` solo para atributos estáticos*: **elegido**. Un futuro `resizeInteractions.ts`/`rotateInteractions.ts` se agrega como hermano, sin tocar ninguno de los dos existentes.

**Confirmar el movimiento en cada frame de arrastre (`dragmove`) vs. solo al soltar (`dragend`):**
- *Despachar `updateObjectTransform` en cada `dragmove`*: daría al Engine (y a cualquier futuro observador — colaboración, por ejemplo) la posición en tiempo real, pero significa un `dispatch` completo (validación Zod + reducer + `ProjectSchema.parse` de red de seguridad + posible entrada de historial) en cada frame de un gesto que puede disparar decenas de frames por segundo.
- *Confirmar solo en `dragend`, dejando que Konva mueva el nodo visualmente en tiempo real sin tocar al Engine*: **elegido, sin cambios respecto a Foundation 3**. La vista ya se siente "inmediata" porque Konva mueve el nodo nativamente durante el gesto; el Engine se entera una sola vez, al final, con el valor definitivo. Ver "Rendimiento".

## Decisión tomada
`interactions/transformInteractions.ts` (nuevo): `dragstart` asegura que el object arrastrado esté en la selección (sin colapsar una selección múltiple existente); `dragend` despacha `updateObjectTransform` con la posición final, revirtiendo la vista si el Engine rechaza el cambio. `interactions/selectionInteractions.ts` (extraído de `baseAttrs.ts`, sin cambios de comportamiento): el click. `NodeContext` gana un campo opcional y aditivo, `getSelection`, para que `transformInteractions` pueda decidir si el object ya estaba seleccionado.

## Consecuencias
- Cero cambios en `@impulso/document-schema` y `@impulso/engine` — ambos ya estaban "preparados para futuras transformaciones" desde su propio diseño original.
- `applyBaseAttrs` queda reducido a fijar atributos estáticos; toda traducción de gestos vive en `interactions/`.
- `NodeContext.getSelection` es opcional: sin él, `transformInteractions` asume que nada está seleccionado y siempre selecciona el object arrastrado — un fallback seguro, no un caso de error.

## Riesgos
- Un arrastre que empieza sobre un object ya seleccionado y termina fuera de cualquier posición razonable no tiene límites de canvas (no hay "guías" ni límites — explícitamente fuera de alcance). El object puede arrastrarse fuera del área visible de la página.
- Mover varios objects seleccionados a la vez (arrastrar uno y que el resto de la selección lo acompañe) sigue sin implementarse — dragstart preserva la selección múltiple, pero dragend solo mueve el object arrastrado. Documentado como mejora futura, no un descuido.

## Compatibilidad futura
El mismo patrón (`interactions/<algo>Interactions.ts`, atributos estáticos separados de comportamiento) es el molde para `resizeInteractions.ts` y `rotateInteractions.ts` cuando existan — ninguno de los dos necesitará tocar `selectionInteractions.ts` ni `transformInteractions.ts`. Cuando exista "mover en grupo", `dragend` tendría que iterar la selección completa en vez de solo `object.id` — un cambio localizado a esa función.

## Rendimiento
- **Complejidad aproximada:** sin cambios respecto a Foundation 3 — `dragend` sigue siendo un único `dispatch` (O(m), m = objects de la página, por el rebuild completo ya documentado) por gesto de arrastre completo, no por frame.
- **Cuellos de botella posibles:** ninguno nuevo. Se evaluó explícitamente NO despachar en cada `dragmove` precisamente para no multiplicar el costo ya documentado (PERFORMANCE_BUDGET fila 4) por cada frame de un gesto continuo — de haberlo hecho, un arrastre de un segundo a 60fps habría significado ~60 rebuilds completos de la escena en vez de uno.
- **Estrategia de optimización futura:** ninguna requerida todavía; si en el futuro se necesitara sincronizar la posición en tiempo real con un observador externo (colaboración), se evaluaría un evento de solo-lectura tipo `dragging` emitido por el Renderer sin pasar por `dispatch`, para no acoplar ese caso al costo de un comando de contenido completo.
