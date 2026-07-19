# ADR-0015 — Batch Dispatch + Alignment Engine

## Problema
Hasta Epic 7 / Fase 7.1, `dispatch()` solo admite un `ContentCommand` a la vez: una operación que necesita mover N objects (Alignment, Distribution, y cualquier futura manipulación grupal — Multi Selection en Fase 7.4) tendría que despachar N comandos separados, produciendo N entradas de historial y N renders — un solo `Ctrl/Cmd+Z` solo revertiría el último object movido, no la operación completa. Se necesita un mecanismo genérico de transacción para el Engine, y el primer consumidor real que lo ejercita: un sistema de Alignment/Distribution profesional.

## Contexto
- `applyContentCommand` (Fase 0) ya separa "ejecutar el reducer" de "versionar + historiar + validar" — la pieza que faltaba era repetir eso N veces con una sola versión/historia/validación al final, no N.
- La selección múltiple hoy (ver UX Review previa a Epic 7) solo pinta contornos individuales por object — no hay caja envolvente conjunta ni manipulación como unidad; Alignment es el primer sistema que necesita calcular esa caja conjunta (aunque la manipulación visual en sí queda para Fase 7.4).
- ADR-0008 (Manipulation System) ya estableció que medir la geometría intrínseca real de CUALQUIER object (texto sin `size` explícito, un Group anidado) solo es posible vía Konva (`getSelfRect()`/`getClientRect()`) — ninguna alternativa puramente-Schema puede replicar esto hoy. Cualquier decisión sobre bounding boxes tiene que convivir con esa restricción, no fingir que no existe.
- `Layer` no tiene transform propio (ver `layer/layer.ts`): los objects top-level de una Page ya viven en el mismo espacio de coordenadas que la propia Page — no hace falta normalizar espacios al calcular una caja envolvente conjunta.

## Decisiones confirmadas con el usuario
- **Batch dispatch**: mecanismo genérico en `@impulso/engine`, no una solución particular para transforms. Contrato: `dispatchBatch(commands, metadata?)`. Debe ser atómico, producir una sola entrada de historial, ser reversible con un solo undo/un solo redo, y no duplicar validación ya existente por comando.
- **Batch vacío**: no-op explícito (sin entrada de historial), no un rechazo — no hay razón técnica para tratarlo como error.
- **Semántica de alineación**: la referencia para selección múltiple es la caja envolvente CONJUNTA de la selección (no la de cada object aislado) — alinear a la izquierda no debe hacer "saltar" la selección completa de posición.
- **Distribución**: conserva los extremos fijos, reparte el espacio disponible en partes iguales entre bordes adyacentes (no entre centros); si no hay espacio suficiente, superposición determinista en vez de fallar.
- **Alignment no depende de Konva ni del DOM**: la aritmética vive en `@impulso/engine`, pura. La medición real de cada object (que sí necesita Konva, ver ADR-0008) queda donde ya vivía — `renderer-konva` — sin refactor amplio.
- **Sin atajos de teclado nuevos** para las 8 operaciones en esta fase (no hay convención clara todavía); controles descubribles por ícono + tooltip + `aria-label` es preferible a inventar combinaciones.
- **Errores de esta fase en adelante**: cualquier estado de error nuevo comunica la causa con texto accesible (`role="alert"` + `aria-describedby`), nunca solo con color.

## Alternativas evaluadas

### ¿Dónde vive la aritmética de bounding boxes rotados?
- **A. Función pura nueva en `@impulso/engine`** (elegida): `computeRotatedBoundingBox({ pivot, originOffset, width, height, rotationDegrees })` — 4 esquinas rotadas + min/max, ~15 líneas, sin Konva. `renderer-konva` la importa (ya depende de `@impulso/engine`) en vez de reimplementar la misma trigonometría.
- **B. Reutilizar `localToParent` de `renderer-konva` tal cual**: descartada — está acoplada a `ManipulationBox`, que a su vez exige un `Konva.Node` real para construirse; el Engine no puede (ni debe) depender de Konva.
- **C. Refactorizar `renderer-konva` para que `localToParent` viva en un paquete puro compartido**: descartada para esta fase — es una refactorización más amplia de la necesaria; la instrucción explícita fue extraer únicamente la parte matemática nueva, no reorganizar código ya estable y probado.

### ¿Cómo obtiene Alignment el tamaño intrínseco real de cada object (incluyendo texto sin `size`, Path sin `size`, Group anidado)?
- **A. Separar medición de aritmética** (elegida): `renderer-konva` gana `computeObjectBoundingBox(node, object)` — envuelve `computeManipulationBox` (ya existente, mide vía Konva) y le aplica `computeRotatedBoundingBox` (Engine, puro). Quien orquesta Alignment (`apps/sticker-builder/alignment.ts`) busca el node Konva de cada object seleccionado (`stage.findOne('#'+id)`, mismo patrón que ya usa `renderer.ts` para el overlay de selección) y arma `AlignmentTarget[]` con esas cajas ya calculadas.
- **B. Que el Engine mida el tamaño intrínseco por sí solo desde el Document Schema**: descartada — imposible de forma correcta y honesta para texto sin `size` explícito (el toolbar de Sticker Builder crea texto así) ni para Path (sin campo `size` en absoluto): requeriría o inventar una aproximación (deshonesto, inconsistente con lo ya renderizado) o replicar medición de texto/fuentes fuera del navegador.
- **C. Exigir que todo object tenga `size` explícito**: descartada — cambiaría el Document Schema y el flujo de creación de texto existente, fuera del alcance aprobado para esta fase.

### ¿Cómo se estructura `AlignmentPatch`?
- **A. `{ objectId, transform: Partial<{x, y}> }`, solo el eje que cambia** (elegida): cada función pura (`alignLeft`, `distributeVertical`, etc.) ya sabe qué eje toca; el caller convierte 1:1 a `updateObjectTransform`. Los no-cambios (`|dx| < epsilon`) se filtran DENTRO de la función pura — la garantía de "cero entradas de historial si nada cambió" vive en el lugar más robusto (el Engine), no depende de que la UI recuerde filtrar.
- **B. Siempre `{x, y}` completos**: descartada — obligaría a decidir un valor "sin cambio" para el eje no tocado, y a filtrar no-ops en un lugar distinto (menos robusto) de donde se calculan.

## Decisión tomada

### `dispatchBatch` (`@impulso/engine`)
`dispatchBatch(commands: readonly ContentCommand[], metadata?: { label? }): EngineResult<Project>`. Implementación en dos capas:
- `applyContentCommandBatch` (`commands/applyCommand.ts`): corre cada reducer en secuencia sobre un acumulador **local** (nunca el `project` recibido); si cualquiera falla, se retorna el error de inmediato y el acumulador se descarta — atomicidad por construcción, sin rollback manual. Solo si los N comandos tienen éxito: un único `documentVersion + 1`, una única `HistoryEntry` (con la `label` dada o una descripción generada), una única validación completa de `ProjectSchema`.
- `engine.dispatchBatch`: valida cada comando (rechaza `SelectionCommand` — nunca participaron de historial/undo), delega a `applyContentCommandBatch`, y si tiene éxito empuja UNA vez a `undoStack`/limpia `redoStack` — un solo undo/redo por batch. Emite `batchRejected` en vez de `commandRejected` ante un fallo (no hay un "comando culpable" único que señalar, se reporta el batch completo + el error concreto), y `projectChanged` con `cause: { type: "batch", commands, label }` en éxito.
- Compatibilidad completa con `dispatch()`: aditivo, cero cambios de comportamiento en el camino existente.

### Bounding boxes rotados (`@impulso/engine/geometry/boundingBox.ts`, nuevo)
`computeRotatedBoundingBox` (rota 4 esquinas alrededor del pivote, toma el AABB) + `unionBoundingBox` (envolvente de N cajas). Sistema de coordenadas: el mismo que `Transform.x/y` de un object top-level (== espacio de la Page, `Layer` no tiene transform propio). Origen de rotación: el mismo pivote que usa Konva (esquina superior izquierda salvo Ellipse, centro). Escala: `width`/`height` de entrada ya vienen escalados (`currentWidth`/`currentHeight`, mismo campo que `ManipulationBox`) — este módulo no vuelve a escalar. Precisión: aritmética `number` estándar sin redondeo intermedio; la tolerancia para "esto no cambió" (`1e-6`) vive en `alignment.ts`, no aquí.

### Alignment Engine (`@impulso/engine/geometry/alignment.ts`, nuevo)
Funciones puras, sin Konva/DOM: `alignLeft/Right/Top/Bottom/CenterHorizontal/CenterVertical`, `distributeHorizontal/Vertical` (no-op con <3 targets), `centerOnPageHorizontal/Vertical` (un solo `AlignmentTarget`, `pageWidth`/`pageHeight` deben venir ya en la unidad canónica — quien llama convierte con `toPixels` si `page.unit !== "px"`). Todas devuelven `AlignmentPatch[]`, filtrando internamente cualquier delta menor a `1e-6`.

### `renderer-konva`: `computeObjectBoundingBox` (nuevo, en `manipulation/boundingBox.ts`)
Puente entre medición real (Konva) y aritmética pura (Engine) — ver alternativas arriba.

### `apps/sticker-builder`: `alignment.ts` (nuevo) + sección "Alineación" en el Inspector
`createAlignmentController(engine, renderer)`: arma `AlignmentTarget[]` buscando el node Konva de cada object seleccionado top-level, invoca la función pura correspondiente, aplica el resultado con `dispatchBatch`. Devuelve `{ ok, message? }` — `message` siempre presente en rechazo, para el `role="alert"` accesible. `mountAlignmentPanel`: 0 seleccionados → vacío; 1 → centrar en página (2 botones); 2+ → las 6 alineaciones; 3+ → suma distribuir H/V. Iconos SVG inline + `title` + `aria-label` + `aria-describedby` en cada botón — nunca dependen solo del ícono.

## Consecuencias
- `dispatchBatch` es reutilizable, sin cambios, por Multi Selection (Fase 7.4) y cualquier operación masiva futura — no hubo que crear una solución específica para transforms.
- El Inspector gana su primera sección "contextual por cantidad de selección" (no solo por tipo de object) — precedente reutilizable para futuras secciones similares.
- `@impulso/engine` gana su primer módulo de geometría que opera sobre MÚLTIPLES objects a la vez (hasta ahora, `resizeMath`/`rotateMath`/`composeTransform` operaban sobre uno).

## Riesgos
- **Texto sin `size` explícito y Path**: su bounding box exacto depende de medir el node Konva real — no hay alternativa pura-Schema hoy (ver ADR-0008). Riesgo aceptado, no es una regresión de esta fase.
- **`dispatchBatch` rechaza silenciosamente un batch con `SelectionCommand` mezclado**: decisión deliberada (los comandos de selección nunca participaron de historial), documentada, no un bug.
- **Sin caché de bounding boxes entre operaciones sucesivas** (ver `PERFORMANCE_BUDGET.md`, fila 18) — remedir en cada operación es aceptable a la escala actual.
- **Alineación/Distribución no consideran objects dentro de un Group** (solo top-level) — consistente con que un Group ya se trata como una unidad en todo el resto del producto.

## Compatibilidad futura
- Fase 7.3 (Smart Guides/Snapping/Grid) puede reutilizar `computeRotatedBoundingBox`/`computeObjectBoundingBox` sin cambios para calcular los bordes/centros contra los que se hace snap.
- Fase 7.4 (Multi Selection) reutiliza `dispatchBatch` para mover/redimensionar/rotar la selección como una unidad con un solo undo — la pieza transaccional ya existe, falta solo la UX de manipulación visual conjunta.
