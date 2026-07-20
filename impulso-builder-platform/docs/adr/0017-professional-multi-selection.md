# ADR-0017 — Professional Multi Selection

## Problema
Hasta Epic 7 / Fase 7.3, seleccionar 2+ objects solo mostraba un rectángulo punteado independiente por object (el resaltado simple de Editor 2) — no había ninguna forma de mover, redimensionar o rotar la selección como una unidad coherente. Mover requería arrastrar cada object por separado; no existía ningún concepto de "caja envolvente del grupo" ni de handles compartidos. Cualquier editor de diseño de referencia (Figma, Canva, Kittl) trata una selección múltiple como un solo object manipulable desde el primer momento en que hay 2+ elementos seleccionados.

## Contexto
- ADR-0008 (Editor Epic 1) ya estableció el patrón preview/commit para UN object: `computeResizedTransform`/`computeRotatedTransform` (puros, en `@impulso/engine`) se aplican al node Konva en `dragmove` (sin `dispatch`) y se despachan recién en `dragend` — el mismo cálculo en ambos casos, para que preview y estado final nunca diverjan.
- ADR-0015 (Fase 7.2) introdujo `dispatchBatch`: N `ContentCommand` como una única transacción lógica (una sola entrada de historial). Ya lo usa `alignment.ts` para traducir una operación sobre 2+ objects en N comandos `updateObjectTransform`.
- ADR-0016 (Fase 7.3) introdujo Smart Guides/Snapping (`computeSnap`, `beginSnapGesture`/`updateSnapGesture`/`endSnapGesture`) y ya dejó documentado en su sección de Compatibilidad futura que esta pieza podía reutilizarse sin cambios para una selección conjunta.
- `computeObjectBoundingBox` (Fase 7.2) ya es el puente entre medición real (Konva, para conocer el tamaño intrínseco de cualquier tipo, incluso texto sin `size` o un Group anidado) y aritmética pura de bounding boxes rotados (`@impulso/engine`, sin Konva).
- El Inspector (Fase 7.1, ADR-0010) ya documentaba explícitamente que mostrar X/Y/Ancho/Alto "promedio" de una selección múltiple confundiría más de lo que ayudaría, y que la manipulación EN EL CANVAS de una selección múltiple quedaba para esta fase.

## Decisiones confirmadas con el usuario
- **Una única caja envolvente compartida** cuando hay 2+ objects seleccionados — oculta las cajas individuales; conserva una indicación clara de qué objects pertenecen a la selección.
- **No depender de Konva para la matemática de transformación grupal** — Konva solo mide (bounding boxes reales); los cálculos de traslación/resize/rotación de grupo viven en `@impulso/engine`.
- **Sin comandos ni cambios de schema nuevos** — un gesto de grupo se traduce en N `updateObjectTransform`, aplicados con el `dispatchBatch` ya existente.
- **Preview y commit parten SIEMPRE del snapshot inicial del gesto** — nunca del resultado del frame anterior (evita drift acumulativo).
- **Objects bloqueados nunca son transformables** (individual ni grupalmente), pero conservan su propio indicador de selección para inspección.
- **Objects ocultos (`visible:false`) SÍ son transformables** como parte del grupo — mismo criterio que ya usan `nudge()`/`deleteSelected()` (no filtran por visibilidad).
- **Snapping durante movimiento** excluye la propia selección como candidato; **snapping durante resize** funciona sin la restricción de rotación del caso individual (la caja del grupo siempre es un AABB puro); **rotación** conserva únicamente el snap angular de 15° (Shift), sin Smart Guides angulares.
- **Fuera de alcance explícito**: edición profunda dentro de grupos, doble-click para entrar a un group, constraints responsivos, auto layout, selección múltiple entre páginas, resize no-proporcional individual dentro del conjunto, pivot de rotación configurable, selección múltiple táctil avanzada, colaboración, autosave, PDF.
- **El handle de rotación cerca de un borde de página** (bug de severidad alta detectado en Fase 7.3.5) se resuelve como parte de esta fase — ver ADR-0018.

## Alternativas evaluadas

### ¿Cómo se previsualiza el movimiento/resize/rotación de N objects sin re-renderizar el documento completo?
- **A. Iterar sobre un snapshot de N members y escribir sus atributos Konva directamente, un solo `batchDraw()` por frame** (elegida): O(N) escrituras de atributo por frame, sin medir Konva de nuevo (la medición ya ocurrió una vez al capturar el snapshot). Verificado con smoke tests de performance: 100/50/50 objects, sin ninguna llamada a `getSelfRect` durante 30 frames de `dragmove`.
- **B. Envolver los nodes seleccionados en un `Konva.Group` temporal, transformar solo el wrapper**: explorada y descartada — requiere reparent de nodos Konva (rompe la referencia estable que ya usa el resto del sistema), introduce un segundo sistema de coordenadas a sincronizar, y no aporta ninguna ventaja de performance real frente a la opción A a las escalas exigidas (100 objects).
- **C. Dispatchar un `updateObjectTransform` por object en cada `dragmove`**: descartada de inmediato — generaría N comandos por frame (violación directa de la sección de Performance del enunciado) y N entradas de historial si no se agrupara al final.

### ¿Cómo se arrastra la caja compartida O el cuerpo de cualquier member ya seleccionado, sin que Konva compita consigo mismo?
- **A. Un único node "caja compartida" `draggable`; cada member pasa a `draggable:false` mientras la selección es 2+; el `mousedown` de un member reenvía el gesto a la caja vía `Konva.Node.startDrag()`** (elegida): `startDrag()` es la API pública de Konva pensada exactamente para "iniciar un drag desde el evento de otro nodo" — probado empíricamente (ver `groupHandles.test.ts`) que funciona correctamente sin necesitar rastreo manual de puntero fuera de Konva. Un `click` normal (sin arrastre) sobre un member sigue reseleccionando ese único object, sin cambios.
- **B. Cada member sigue siendo `draggable`, y se sincroniza manualmente la posición de los demás en `dragmove` del member que inició el gesto**: descartada — requeriría que CUALQUIERA de los N members pudiera ser "el líder" del gesto, multiplicando la superficie de casos a probar sin ninguna ventaja sobre reenviar a un único node dedicado.

### ¿Cómo se resuelve el resize de un grupo con members rotados y un factor de escala no-uniforme?
- **A. Escalar la posición del pivote de cada member como un punto (exacto, sin importar su rotación) y multiplicar su `scaleX`/`scaleY` propio por el factor del eje del grupo, sin decantarlo por su rotación** (elegida): geométricamente exacto para members sin rotación o con resize uniforme (donde la escala uniforme siempre conmuta con cualquier rotación sin producir shear); una aproximación deliberada, determinista y documentada para members rotados con resize no-uniforme — el Document Schema no tiene un campo de shear/skew, así que una escala verdaderamente exacta de un rectángulo rotado bajo un factor no-uniforme no es representable sin ampliar el schema (fuera de alcance).
- **B. Introducir un campo de shear/skew en `Transform`**: descartada — cambio de schema amplio, explícitamente fuera de lo pedido ("no cambios amplios en el modelo").
- **C. Rasterizar/aplanar la selección durante el resize (aplicar una transformación de matriz general vía un `Konva.Group` con `skewX/skewY`)**: descartada — contradice directamente "no rasterizar ni aplanar grupos" del enunciado, y solo resolvería el problema visualmente en Konva sin que el Document Schema pudiera representarlo de forma persistente.

### ¿Cómo se cancela un gesto activo (Escape, blur, pointercancel) sin dejar estado visual inconsistente?
- **A. Cada gesto (mover/redimensionar/rotar) registra su propia cancelación vía `window.addEventListener("blur"/"pointercancel")`, removida en `dragend`; `Escape` se resuelve consultando `RendererAdapter.cancelActiveManipulation()` (nuevo), que delega a la cancelación del gesto activo, si hay uno** (elegida): evita una carrera entre el handler global de `Escape` de `keyboardShortcuts.ts` (que limpia la selección) y un handler local de gesto — `app.ts`'s `escape()` primero intenta cancelar una manipulación activa; solo si no había ninguna, procede a limpiar la selección. Verificado empíricamente que `stopDrag()` llamado desde un handler de `blur`/`pointercancel` SÍ completa correctamente un drag iniciado con `startDrag()` (dispara `dragend` de forma síncrona), permitiendo reutilizar la MISMA ruta de "descartar preview" que ya usa un `dispatch` rechazado.
- **B. Cada attach* de gesto registra también su propio listener de `keydown`/Escape**: descartada tras verificar empíricamente que competiría en orden de registro con el listener global de `keyboardShortcuts.ts` (montado al iniciar la app, antes que cualquier gesto), pudiendo limpiar la selección ANTES de que el gesto se cancele — el enunciado exige que la cancelación de un gesto activo tenga prioridad, no que compita con `clearSelection`.

## Decisión tomada

### `@impulso/engine/geometry/groupTransform.ts` (nuevo)
`GroupMember { objectId, box: BoundingBox, transform: Transform }` es el snapshot inicial. `translateGroupMembers` (exacto), `computeGroupResize` (exacto para rotación 0/resize uniforme, aproximación documentada en el resto de casos), `computeGroupRotation` (exacto, rotación pura alrededor del centro de la caja inicial), `computeGroupUnionBox` (reexporta `unionBoundingBox`). Ningún comando ni cambio de schema nuevo — los patches resultantes son `Partial<Transform>` listos para `updateObjectTransform`.

### `renderer-konva/manipulation/groupHandles.ts` (nuevo)
`renderSharedManipulationHandles`: dibuja la caja compartida (`Konva.Rect`, borde visible + área completa arrastrable vía `fill` no-nulo) + 8 handles de resize + 1 handle de rotación, mismo estilo visual que `handles.ts` (constantes reexportadas: `HANDLE_SIZE`/`HANDLE_FILL`/`HANDLE_STROKE`/`ROTATE_HANDLE_OFFSET`). Cada member transformable pasa a `draggable:false` y reenvía su `mousedown` a la caja compartida. El preview de cada gesto (mover/redimensionar/rotar) itera el snapshot inicial (`initialMembers`, medido UNA vez) y escribe los atributos Konva de cada member; el commit compara contra el snapshot con tolerancia `1e-6` y solo dispatcha si algo cambió de verdad.

### `renderer-konva/manipulation/interactiveBounds.ts` (nuevo) — ver ADR-0018
`clampPointToStageBounds` — recorte de rayo contra rectángulo, reutilizado por `handles.ts` y `groupHandles.ts` para que el handle de rotación nunca quede fuera del área interactiva del Stage.

### `renderer.ts`: partición locked/transformable + `cancelActiveManipulation`
`renderSelectionOverlay()` parte la selección en `transformableIds`/`lockedIds`; dibuja la caja compartida para 2+ transformables (con fallback a `renderManipulationHandles` para exactamente 1, y al resaltado simple si algo falla), y el resaltado simple de siempre para cualquier member bloqueado. `restoreIndividualDraggableState()` restaura `draggable` a `!locked` en cada object top-level al principio de CADA `renderSelectionOverlay()` — necesario porque `mainLayer` no se reconstruye en cada cambio de selección, solo en `projectChanged`. `RendererAdapter` gana `cancelActiveManipulation()`.

### `apps/sticker-builder`: `app.ts`
`escape()` llama primero a `runtime.renderer.cancelActiveManipulation()`; solo si devuelve `false`, limpia la selección. `nudge()` pasa de N `dispatch` a un solo `dispatchBatch` (bug de atomicidad cerrado como parte de esta fase, por usar el mismo primitivo que el resto de operaciones grupales).

## Consecuencias
- `@impulso/engine` gana su segundo módulo de geometría grupal (después de `alignment.ts`) — mismo estilo (funciones puras, sin Konva, patches listos para `dispatchBatch`).
- `renderer-konva` gana su primer mecanismo de cancelación externa de un gesto en curso (`RendererAdapter.cancelActiveManipulation`) — precedente reutilizable por cualquier gesto futuro que necesite ser cancelable desde fuera de su propio módulo.
- El resize individual de UN object bloqueado deja de exponer handles interactivos (gap preexistente cerrado incidentalmente al formalizar la política de bloqueados para el caso grupal).
- `nudge()` deja de generar N entradas de historial por un solo gesto de teclado.

## Riesgos
- **Resize de grupo con members rotados y factor no-uniforme es una aproximación, no una transformación afín exacta** (sin shear) — documentado explícitamente arriba y en Technical Debt; determinista y sin degenerar (verificado con tests), pero no pixel-perfecto en ese caso específico.
- **Selección completa/parcialmente fuera del Stage**: el handle de rotación puede quedar sin espacio para recortar si el `anchor` mismo ya está fuera de los límites interactivos — limitación residual, ver ADR-0018.
- **Nudge con teclado y drag de grupo comparten el mismo primitivo (`dispatchBatch`) pero no la misma UX** (nudge no tiene preview ni cancelación) — consistente con que nudge nunca tuvo un modelo de gesto continuo, no una regresión de esta fase.

## Compatibilidad futura
- Una futura fase de guías manuales/constraints puede reutilizar `GroupMember`/`computeGroupUnionBox` sin cambios para calcular contra qué se alinea la selección conjunta.
- Si en el futuro se decide dar soporte a shear/skew en el Document Schema, `computeGroupResize` tiene un único punto de extensión documentado (el cálculo de `scaleX`/`scaleY` por member) donde introducir la corrección exacta sin tocar el resto del módulo.
