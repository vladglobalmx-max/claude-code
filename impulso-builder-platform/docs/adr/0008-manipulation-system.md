# ADR-0008 — Manipulation System: resize, rotación, bounding box, handles

## Problema
El usuario puede seleccionar (Editor 2) y mover (Editor 3) objects, pero no puede cambiar su tamaño ni su ángulo. Este es el primer "Editor Epic" del proyecto — a partir de aquí se trabaja por sistemas completos, no por micro-funcionalidades aisladas — y debe entregar, integrado, TODO lo necesario para manipular un object: resize, rotación, bounding box, handles, anclajes, restricciones, cursor feedback e hit testing. La regla de siempre sigue vigente: toda la lógica vive en el Engine; el Renderer solo traduce eventos de puntero y representa el estado visual.

## Contexto
- `@impulso/engine` ya expone `updateObjectTransform` (Foundation 2) aceptando un `Partial<Transform>` — el mecanismo de "aplicar" un cambio de transform ya existe y es genérico.
- `Transform` tiene `x`, `y`, `rotation`, `scaleX`, `scaleY` — no tiene ni `width`/`height` propios (eso vive en `size`, específico de Rectangle/Ellipse/Image, y ausente en Path/Group) ni ningún campo de "handle" o "anclaje". Cualquier resize tiene que expresarse en términos de estos cinco campos.
- El patrón preview/commit establecido en Editor 3 (`transformInteractions.ts`: Konva mueve el nodo en tiempo real durante el gesto, el Engine se entera una sola vez al soltar) es el molde a extender, no a reinventar.
- El Performance Budget (fila 4) ya documenta el costo del rebuild completo de `mainLayer` en cada `projectChanged` — cualquier diseño que despachara en cada `dragmove` multiplicaría ese costo por cada frame de un gesto continuo.

## Alternativas evaluadas

**Cómo representar un resize sin un campo `size` universal:**
- *Agregar un comando que reciba directamente `width`/`height` finales*: no funciona para `Path` (definido por `segments`, sin tamaño propio) ni para `Group` (tamaño = envolvente de sus hijos, no un campo propio) — habría exigido inventar un campo que el Document Schema no tiene y que rompería la simetría entre tipos de object.
- *Resize expresado puramente como `scaleX`/`scaleY` sobre el `Transform` existente*: **elegido**. Todo `SceneObject`, sin excepción, ya tiene `scaleX`/`scaleY`. Redimensionar una forma es matemáticamente equivalente a escalarla desde el anclaje correcto — no hace falta ningún campo nuevo en el Document Schema ni en el Engine.

**Quién mide el tamaño "natural" (a escala 1) de un object, necesario para convertir un delta de arrastre en un `scaleX`/`scaleY`:**
- *El Engine lo calcula a partir del Document Schema*: imposible en general — un `Path` con curvas bezier o un `Group` anidado requieren conocimiento de geometría/renderizado (bounding box real de una curva, envolvente recursiva de hijos) que el Engine deliberadamente no tiene (nunca importó una librería de render, por diseño desde la arquitectura original).
- *El Renderer mide (`node.getSelfRect()`/`getClientRect`) y se lo pasa al Engine como dato (`intrinsicSize`) en cada comando*: **elegido**. El Engine sigue sin saber qué es Konva; solo recibe un número. Es la misma filosofía que ya rige `resolveAssetSource` (Foundation 3): el Renderer aporta lo que solo él puede saber, el Engine decide qué hacer con eso.

**Dónde vive la matemática de "qué anclaje se mueve, cuánto crece cada eje, cómo afecta la rotación":**
- *En el Renderer, cerca de los handles que la disparan*: violaría la regla explícita del épico ("toda la lógica continuará viviendo exclusivamente dentro del Engine").
- *Como funciones puras exportadas por el Engine (`computeResizedTransform`, `computeRotatedTransform`), sin acceso a `Project` ni a `dispatch`*: **elegido**. Permite que el Renderer las llame directamente para previsualizar en vivo durante el arrastre (sin pasar por `dispatch`, sin rebuild) y que el comando `resizeObject`/`rotateObject` las use internamente para calcular el resultado final — la MISMA función en ambos casos, así que previsualización y estado commiteado nunca pueden divergir.

**Restricción de tamaño mínimo:**
- *Sin restricción (permitir tamaño 0 o negativo)*: produciría formas invertidas o invisibles, un estado confuso y sin vuelta atrás intuitiva para el usuario.
- *`MIN_RESIZE_SIZE` (clamp a 1 unidad), con el anclaje recalculado a partir del delta REAL aplicado, no del delta crudo del puntero*: **elegido**. Verificado con test que el anclaje queda matemáticamente exacto incluso arrastrando mucho más allá del límite.

**Cómo dibujar la caja de manipulación cuando el object está rotado:**
- *Usar `node.getClientRect()` (bounding box alineado a ejes, AABB)*: es lo que Editor 2 ya usa para el resaltado simple — pero un AABB de un object rotado NO sigue sus bordes reales, así que los handles quedarían mal ubicados (no en las esquinas visuales de la forma).
- *Calcular las 8 posiciones en espacio LOCAL (sin rotar) y rotarlas de vuelta al espacio del padre con la misma convención de giro que usa `computeResizedTransform`*: **elegido** (`manipulation/boundingBox.ts`). El contorno y los handles siguen la orientación real del object, rotado o no.

**Restricción de eje al arrastrar un handle de borde:**
- *Sin restricción (el handle se mueve libre en 2D bajo el puntero)*: la matemática de `computeResizedTransform` ya ignora la componente perpendicular para un handle de borde, así que el CÁLCULO sería correcto, pero visualmente el handle se despegaría del borde de la forma al arrastrar en diagonal — se ve roto aunque no lo esté.
- *`dragBoundFunc` que proyecta el arrastre sobre el eje local correcto (rotado si el object lo está)*: **elegido**. Los handles de esquina quedan libres (convención estándar); los de borde se deslizan visualmente sobre el borde real.

**Hit testing:**
- *Implementar un algoritmo propio de "¿qué handle está bajo el puntero?"*: no hay ninguna razón para reinventarlo — Konva ya resuelve esto para cualquier node interactivo con su propio sistema de eventos, el mismo que Foundation 3 ya usa para el arrastre de objects.
- *Handles como nodos Konva reales, interactivos*: **elegido**. Cero código nuevo de hit testing.

## Decisión tomada
- **Engine** (`packages/engine/src/geometry/`): `computeResizedTransform` (8 handles, restricción de proporción, restricción de tamaño mínimo, consciente de rotación) y `computeRotatedTransform` (normalización de ángulo a `[0,360)`, snap opcional a 15°) — funciones puras, `Partial<Transform>` de entrada/salida, sin `Project`. Dos comandos nuevos, `resizeObject`/`rotateObject`, que delegan la fusión/validación final en el reducer ya existente de `updateObjectTransform`.
- **Renderer** (`packages/renderer-konva/src/manipulation/`): `boundingBox.ts` (geometría del pivote/tamaño/puntos locales), `handles.ts` (8 handles de resize + 1 de rotación, patrón preview-en-`dragmove`/commit-en-`dragend`, restricción de eje vía `dragBoundFunc`, `maintainAspectRatio`/`snapToIncrement` con Shift), `cursors.ts` (cursor CSS por handle). `renderSelectionOverlay()` dibuja esta caja completa solo cuando hay exactamente un object seleccionado.

## Consecuencias
- Cero cambios en `@impulso/document-schema` — `Transform` ya tenía todos los campos necesarios.
- `@impulso/engine`: 0.2.0 → 0.3.0 (aditivo — dos comandos y varias funciones/tipos nuevos exportados, ninguno rompe la API existente).
- `@impulso/renderer-konva`: 0.3.0 → 0.4.0.
- El Renderer gana una responsabilidad nueva pero acotada: MEDIR geometría (`intrinsicSize`) para pasársela al Engine. Sigue sin decidir ninguna restricción de negocio (mínimos, proporciones, snapping) — eso vive enteramente en las funciones puras del Engine.

## Riesgos
- **El handle de rotación puede renderizarse fuera del área visible del Stage** si el object seleccionado está muy cerca del borde superior de la página — inalcanzable con el puntero en un navegador real, aunque la lógica de rotación en sí es correcta (verificada con tests que disparan los eventos directamente, sin depender de la posición en pantalla). No se resolvió: requeriría que `handles.ts` conociera los límites del Stage, un acoplamiento nuevo fuera de lo ya construido. Documentado, no arreglado.
- **`intrinsicSize` para un `Konva.Group` se aproxima con `getClientRect({skipTransform:true})`**, no con `getSelfRect()` (que `Group` no implementa) — funciona para los casos probados, pero no se verificó exhaustivamente contra un Group con hijos rotados/anidados a varios niveles.
- **El cursor CSS no rota junto con el object** — siempre muestra la orientación nominal del handle (ej. `ns-resize` para "arriba/abajo"), aunque el object esté rotado 45° y ese handle ya no apunte visualmente arriba/abajo. Arreglarlo requeriría generar un cursor SVG a medida por ángulo; no hay evidencia de que la ausencia de esto sea un problema real hoy.
- **Un bug real solo visible en navegador, no en jsdom**: durante la verificación con Playwright se descubrió que `selectionLayer` se creaba con `listening: false` a nivel de Layer completa (heredado de Editor 2, cuando solo contenía overlays decorativos) — esto bloqueaba SILENCIOSAMENTE todos los eventos de puntero sobre los handles nuevos. Los 122 tests con jsdom (que disparan eventos con `.fire(...)` directamente sobre el node) pasaban igual, porque `.fire()` no pasa por el hit-graph real de Konva ni por el árbol de eventos del DOM — nunca habría revelado este bug. Se corrigió quitando `listening: false` de la Layer (los nodes puramente decorativos ya fijaban `listening: false` individualmente). Lección para futuros Editor Epics: la verificación en navegador real no es opcional para cambios de interacción, ni siquiera con cobertura de tests al 100%.
- Redimensionar/rotar una selección múltiple a la vez no está implementado — explícitamente fuera de alcance de este épico.

## Compatibilidad futura
- `computeResizedTransform`/`computeRotatedTransform` son las únicas piezas del Engine que no requieren un `Project` para ejecutarse — candidatas naturales a un futuro sub-paquete `@impulso/geometry` puro si en algún momento otro consumidor (fuera de `@impulso/engine`) las necesitara; no se extrajeron ahora porque no hay todavía una segunda necesidad real.
- El mismo patrón de `manipulation/` (geometría pura + módulo de interacción con preview/commit) es el molde para agregar, en el futuro, guías/snapping a otros objects o a los bordes de la página, sin tocar `boundingBox.ts` ni `handles.ts` existentes.
- Cuando exista Zoom/Pan, la conversión de coordenadas de puntero a espacio del Stage tendrá que pasar por una transformación adicional antes de llegar a `computeResizedTransform`/`computeRotatedTransform` — ninguna de las dos funciones necesitaría cambiar, porque ya reciben el delta/ángulo ya traducido al espacio del padre, no coordenadas de pantalla crudas.

## Rendimiento
- **Complejidad aproximada:** cada `dragmove` de un handle es O(1) (una llamada a una función pura + `setAttrs` sobre un único node) — no toca `mainLayer` ni el resto del árbol. Cada `dragend` es un único `dispatch` (O(m), m = objects de la página, por el rebuild completo ya documentado en PERFORMANCE_BUDGET fila 4), igual que cualquier otro comando de contenido — no una vez por frame.
- **Cuellos de botella posibles:** ninguno nuevo respecto a lo ya documentado. Se evaluó explícitamente NO despachar en cada `dragmove`, exactamente por la misma razón que Editor 3 — un resize/rotación de un segundo a 60fps habría significado ~60 rebuilds completos de la escena en vez de uno.
- **Estrategia de optimización futura:** si en el futuro se necesitara redimensionar/rotar una selección múltiple a la vez, el costo seguiría siendo un único `dispatch` por gesto (no por object) si se modelara como un solo comando que itere la selección — evaluar entonces si conviene un comando de "resize por lote" en el Engine en vez de N `dispatch` secuenciales.
