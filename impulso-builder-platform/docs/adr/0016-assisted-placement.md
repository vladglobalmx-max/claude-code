# ADR-0016 — Assisted Placement (Smart Guides, Snapping, Grid, Rulers)

## Problema
Hasta Epic 7 / Fase 7.2, posicionar objects con precisión dependía enteramente del ojo del usuario o de escribir valores exactos en el Inspector — no existe ninguna ayuda visual/comportamental durante el propio gesto de arrastrar o redimensionar (ni guías de alineación, ni snapping a otros objects/página/grid, ni una referencia visual de escala como reglas). Cualquier editor de diseño de referencia (Figma, Canva, Kittl) ofrece esto como comportamiento base, no como funcionalidad avanzada.

## Contexto
- ADR-0015 (Fase 7.2) ya estableció `computeRotatedBoundingBox`/`computeObjectBoundingBox` como el puente entre medición real (Konva) y aritmética pura (Engine) — esta fase reutiliza ambos sin cambios para saber contra qué bordes/centros comparar durante un drag.
- `transformInteractions.ts` (move) NO tenía `dragmove` — Konva ya dejaba el nodo en la posición cruda del puntero sin ningún preview intermedio; `handles.ts` (resize/rotate) sí seguía el patrón preview-en-`dragmove`/commit-en-`dragend` desde ADR-0007/0008. Cualquier snapping durante move es, por lo tanto, código nuevo, no una modificación de código existente.
- El zoom es 100% CSS (`transform: scale()` sobre el contenedor del Stage, ver ADR-0010) — el Stage de Konva nunca cambia de escala. Cualquier tolerancia de snap definida en píxeles de pantalla debe normalizarse dividiendo por ese zoom antes de comparar contra coordenadas canónicas.
- No existía ningún sistema de tokens visuales (CSS custom properties) en todo el repo — los colores (ej. el azul de selección) estaban hardcodeados de forma duplicada en `renderer.ts` y `handles.ts`. Introducir Smart Guides obligaba a decidir de dónde sale su color sin repetir ese patrón.
- `Page` no tenía ningún campo de configuración de Grid — se necesitaba una decisión de Document Schema (dónde vive, cómo se normalizan documentos/Templates antiguos) antes de tocar Engine o UI.

## Decisiones confirmadas con el usuario
- **Alcance cerrado de esta fase**: Smart Guides, snapping (página/objects/grid), Grid visual + persistente, Rulers, indicador de posición del puntero, modificador temporal para desactivar snapping. Explícitamente NO: selección múltiple profesional, resize/rotate conjunto de una selección, guías manuales arrastrables, márgenes, columnas, layouts automáticos, constraints, autosave, PDF, Cloud, colaboración.
- **Prioridad de snapping**: Página > Objects > Grid, evaluada en niveles completos (un nivel se agota antes de mirar el siguiente).
- **Desempate determinista** cuando compiten varios candidatos de la misma prioridad: menor distancia gana; empate → menor id de object (string compare); empate → orden fijo de punto de referencia (inicio < centro < fin). Nunca debe oscilar entre candidatos con micro-movimientos del puntero (hysteresis).
- **Tolerancia normalizada por zoom**: definida en píxeles de PANTALLA, dividida por el zoom actual antes de comparar en espacio canónico — la sensación debe ser consistente en cualquier nivel de zoom.
- **Modificador temporal**: Ctrl/Cmd (verificado sin conflicto real: hoy solo dispara combos completos de teclado, nunca el estado retenido del puntero durante un drag) — no cambia preferencias persistidas, solo afecta la manipulación activa.
- **Grid persistente por Page**: `{ visible, snapEnabled, size, type }`, independientes entre sí (ocultar Grid no desactiva Snap to Grid y viceversa); defaults explícitos; documentos/Templates antiguos se normalizan sin migración de `schemaVersion` (mismo patrón que `unit`/`layers`); `type` reservado para extensibilidad futura con un único valor soportado hoy (`"lines"`).
- **Cambios de Grid SÍ crean historial** (un comando por intención de usuario, no uno por tick de un control de tamaño) — mismo criterio que cualquier otra propiedad editable de Page/Document.
- **Smart Guides/Rulers/indicador de puntero NUNCA crean historial** ni persisten — son estado puramente efímero de la manipulación o de la sesión visual.
- **Controles de Grid/Snap junto al zoom** (`#tools-bar`), no en el Inspector — son controles de VISTA, no dependen de la selección (consistente con Figma/Canva/Kittl).
- **Indicador de puntero `aria-hidden`**: el valor ya es accesible vía los campos X/Y del Inspector (Fase 7.1) cuando hay selección — no usar `aria-live` en cada `pointermove`.
- **Atajos nuevos, mínimos**: "G" (Grid) y "R" (Rulers), sin modificador — no chocan con ningún atajo existente (Ctrl/Cmd+G/Shift+G siguen siendo Agrupar/Desagrupar).

## Alternativas evaluadas

### ¿Dónde vive la matemática de snapping?
- **A. Función pura nueva en `@impulso/engine` (`geometry/snapping.ts`)** (elegida): `computeSnap({ targetBox, candidates, toleranceDocumentUnits, grid?, previousSnap?, eligibleRefPoints? })` — cero Konva/DOM, recibe candidatos ya armados como números planos. `renderer-konva` mide (vía Konva) y arma los candidatos; el Engine decide prioridad/desempate/hysteresis.
- **B. Calcular snapping directamente en `renderer-konva`**: descartada — duplicaría lógica de decisión (prioridad, desempate) fuera del Engine, rompiendo la misma separación que ya estableció ADR-0015 para Alignment.

### ¿Cómo se representa la hysteresis (evitar jitter) sin estado oculto?
- **A. Parámetro explícito `previousSnap` en cada llamada** (elegida): quien orquesta el gesto (`renderer-konva`) guarda el último `SnapResult` en una variable local del gesto y lo pasa de vuelta en el siguiente frame. `computeSnap` sigue siendo una función pura — sin mutación interna, sin necesidad de "iniciar"/"terminar" un objeto con estado.
- **B. Un objeto con estado mutable (`SnapEngine` class) dentro de `@impulso/engine`**: descartada — introduciría el primer objeto con estado propio en un paquete que hasta ahora es 100% funciones puras + un Engine con su propio ciclo de vida ya establecido; innecesario cuando pasar el valor anterior como parámetro alcanza.

### ¿Cómo se integra snapping en `move` (que no tenía `dragmove`) vs. `resize` (que ya lo tenía)?
- **A. Agregar `dragmove` a `transformInteractions.ts`, replicar el patrón preview/commit de `handles.ts`** (elegida): mismo invariante ya establecido (preview en `dragmove` vía `node.setAttrs`, commit en `dragend` vía `dispatch`, nunca divergen). Para resize, esto exige además invertir el snap aplicado de vuelta a un `pointerDelta` equivalente (`pointerDeltaForSnappedPreview`) — sin esto, el preview snapeado y el `resizeObject` final (que solo conoce `pointerDelta` crudo) podrían divergir.
- **B. Snapping de resize para cualquier rotación/tipo de object**: descartada para esta fase — con rotación, los 4 extremos del AABB rotado se mueven todos a la vez y "qué borde corresponde a este handle" deja de tener una única respuesta limpia; el propio enunciado de la fase autoriza explícitamente restringir resize snapping a "cuando la arquitectura actual lo permita limpiamente". Se restringe a objects sin rotación y que no sean Ellipse (ver `canSnapDuringResize`).
- **C. Combinar snap de resize con Shift (mantener proporción)**: descartada — Shift ya ajusta ambos ejes a la vez según una proporción fija; nuestro ajuste de snap es por eje independiente (`applySnapToResizePreview`), y combinarlos rompería la proporción que el usuario pidió mantener. Con Shift presionado, el snap se trata como desactivado ese frame.

### ¿Dónde vive el Grid visual (evitar dibujar miles de líneas a zoom lejano)?
- **A. `background-image` CSS repetido, no nodos Konva** (elegida): un único patrón CSS (`linear-gradient` repetido vía `background-size`) resuelve "nunca miles de nodos" por construcción — el navegador compone el patrón, no hay conteo de elementos que crezca con el zoom. El intervalo VISUAL se adapta (duplicar hasta una separación mínima en pantalla) sin tocar nunca el `grid.size` real que usa el snap.
- **B. Líneas Konva reales, una por intersección de grid**: descartada — a zoom muy alejado con un grid fino, generaría miles de `Konva.Line`, exactamente el problema que el enunciado pide evitar explícitamente.

### ¿De dónde sale el color de las Smart Guides (sin sistema de tokens previo)?
- **A. Custom property CSS (`--impulso-snap-guide-color`) definida en `apps/sticker-builder/index.html`, leída por `renderer-konva` vía `getComputedStyle` con fallback propio** (elegida): el primer token visual del proyecto vive donde vive el fondo real del canvas (la App), no en el paquete de renderizado — que sigue funcionando standalone (tests, un consumidor externo) gracias al fallback.
- **B. Hardcodear el color directamente en `renderer-konva`, igual que `SELECTION_STROKE_COLOR`**: descartada — hubiera repetido el mismo patrón de duplicación que ya es deuda técnica conocida, en el momento exacto en que introducir un token es más barato que nunca.

## Decisión tomada

### `@impulso/engine/geometry/snapping.ts` (nuevo)
`computeSnap` evalúa X/Y de forma independiente (`evaluateAxis`): hysteresis primero (si el `previousSnap` del mismo `refPoint` sigue dentro de tolerancia × `hysteresisMultiplier`, se reengancha sin re-evaluar prioridades); si no, Página → Objects → Grid, cada nivel evaluado completo antes de caer al siguiente. `buildPageSnapCandidates`/`buildObjectSnapCandidates` arman los 6 candidatos (inicio/centro/fin × X/Y) de página y de un object respectivamente. El candidato de Grid nunca se enumera — se calcula analíticamente (`Math.round(valor / size) * size`) dentro de `evaluateAxis`.

### `@impulso/document-schema`: `Page.grid` (nuevo)
`GridConfigSchema = { visible: boolean.default(false), snapEnabled: boolean.default(false), size: number.positive().finite().default(10), type: enum(["lines"]).default("lines") }`, agregado como `Page.grid.default({})` — Zod re-parsea el default a través del schema interno, produciendo el objeto completo con sus propios defaults sin tener que escribirlo a mano en `Page`.

### `@impulso/engine`: comando `updatePageGrid` (nuevo)
Mismo patrón merge-then-validate que `updateObjectTransform`: busca la Page por id, fusiona el patch parcial, valida con `GridConfigSchema.safeParse`, reemplaza en el array. Nuevo código de error `invalid_grid`. Pasa por el pipeline normal de `applyContentCommand` — historial/versión/validación completos, sin caso especial.

### `renderer-konva`: `manipulation/smartGuides.ts` (nuevo) + `guidesLayer` (nuevo)
Tercera `Konva.Layer` entre `mainLayer` y `selectionLayer`, siempre `listening: false`. `beginSnapGesture`/`updateSnapGesture`/`endSnapGesture` son el puente: snapshot de candidatos al iniciar el gesto (Página + cada object top-level visible, excluyendo el/los manipulados), un frame de `computeSnap` + dibujo de guías por llamada, limpieza incondicional al terminar. Las guías se dibujan con un halo blanco detrás de la línea de color (contraste sobre cualquier fondo) y se extienden más allá de la caja involucrada usando la caja del candidato emparejado (objeto o página), no solo el ancho del object arrastrado.

### `transformInteractions.ts` (move) y `handles.ts` (resize)
Ambos ganan un `dragstart` que arma el snapshot del gesto (`beginSnapGesture`) y un `dragmove` que calcula/aplica el snap sobre el preview ya existente; `dragend` siempre limpia las guías. Resize invierte el snap aplicado a un `pointerDelta` equivalente antes de despachar, para que preview y commit nunca diverjan (ver alternativas). Ctrl/Cmd (`isSnapDisabledByModifier`) desactiva snapping ese frame en ambos.

### `apps/sticker-builder`: `assistedPlacement.ts` (nuevo)
`mountGridOverlay` (CSS, primer hijo de `#canvas-runtime`), `mountRulers` (dos `<canvas>` DOM, DPR-aware, leen scroll nativo del viewport + zoom + `page.unit`), `mountPointerIndicator` (`aria-hidden`, throttled vía `requestAnimationFrame`), `mountGridSnapControls` (botones + input de tamaño, junto al zoom). `zoom.ts` gana un callback `onChange` opcional para que Rulers/Grid se recalculen en cada cambio de zoom sin que `zoom.ts` conozca su existencia.

## Consecuencias
- `@impulso/engine` gana su primer módulo de geometría con estado explícito pasado por parámetro (`previousSnap`) — sigue siendo 100% funciones puras, sin introducir un objeto con ciclo de vida propio.
- El proyecto gana su primer (y por ahora único) par de tokens visuales CSS — precedente para cualquier color futuro que hoy sigue hardcodeado (ver Technical Debt).
- `transformInteractions.ts` deja de ser el único módulo de interacción sin `dragmove` — ahora sigue el mismo patrón preview/commit que `handles.ts` desde ADR-0007/0008.
- El Document Schema gana su segundo campo de Page normalizado vía `.default()` (después de `unit`) — mismo patrón, ninguna migración de `schemaVersion` necesaria.

## Riesgos
- **Resize snapping no cubre objects rotados ni Ellipse** — decisión explícita de alcance, documentada en Technical Debt y en la UX Audit 0004; sin ninguna señal visual todavía de que es una limitación conocida (quick win pendiente).
- **Shift desactiva snap de resize sin avisar** — mismo caso, mismo quick win pendiente.
- **Sin caché de mediciones entre frames más allá del snapshot inicial** — cada frame de `dragmove` vuelve a evaluar candidatos (no a re-medirlos vía Konva), aceptable a la escala actual (ver Technical Debt/`PERFORMANCE_BUDGET.md`).
- **Smart Guides/snapping no consideran objects dentro de un `group`** — mismo criterio pendiente que Alignment (Fase 7.2, ADR-0015): solo top-level.
- **Dos bugs pre-existentes, no relacionados con esta fase, encontrados incidentalmente** al construir la verificación en Chromium (`computeInsertPosition` en `tools.ts`, y el `size` de la línea de corte en `createProjectFromSize`) — documentados en Technical Debt, deliberadamente NO corregidos aquí por estar fuera del alcance autorizado de esta fase.

## Compatibilidad futura
- Fase 7.4 (Multi Selection) puede reutilizar `computeSnap`/`buildObjectSnapCandidates` sin cambios para snapear una selección conjunta contra página/objects/grid — la pieza matemática ya existe, falta solo la UX de manipulación visual conjunta (mismo patrón de "la pieza transaccional/matemática ya existe" que dejó ADR-0015 para Alignment).
- Una futura fase de guías manuales arrastrables puede reutilizar `guidesLayer` y el mismo modelo de dibujo (halo + color) sin cambios, agregando un tipo de candidato nuevo ("guía manual") a `SnapCandidate`.
