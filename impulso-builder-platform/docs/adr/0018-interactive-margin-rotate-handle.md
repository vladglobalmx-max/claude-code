# ADR-0018 — Handle de rotación cerca del borde del Stage

## Problema
El handle de rotación se dibuja `ROTATE_HANDLE_OFFSET` (24px) arriba del borde superior del object (o de la caja envolvente de una selección múltiple, ver ADR-0017). Un `<canvas>` HTML nunca renderiza ni recibe hit-testing fuera de sus propias dimensiones — el Stage de Konva mide exactamente `page.size` (`stage.width()/height()`). Si el borde superior del object/selección está a menos de 24px del borde superior de la página, el handle cae en coordenadas Y negativas del Stage: invisible e inalcanzable con el mouse. Detectado en Fase 7.3.5 (severidad alta): el preset built-in "Sticker circular" posiciona su object en `Y=0`, así que **todo sticker circular nuevo** tenía su línea de corte imposible de rotar arrastrando el handle hasta mover el object manualmente primero.

## Contexto
- El handle de rotación existe desde Editor Epic 1 (ADR-0008); el bug nunca había sido detectado hasta la auditoría de regresión de Fase 7.3.5.
- El Stage de Konva se monta directamente sobre `elements.canvasContainer` (`apps/sticker-builder`), y Konva gestiona el tamaño CSS de ese contenedor directamente a partir de `stage.width()/height()` — cualquier cambio al tamaño del Stage cambia también el tamaño visual del contenedor.
- Ese MISMO contenedor es el que miden Rulers, el indicador de puntero, el Grid overlay y el zoom (Fase 7.3, ADR-0016) vía `getBoundingClientRect()`, asumiendo que su esquina superior izquierda es exactamente el origen de la página (0,0).
- El Stage headless usado para exportar (`offscreenRenderer.ts`, ADR-0012) es una instancia completamente separada que nunca dibuja handles — cualquier solución debe, por construcción, no poder afectarlo (no comparte código con el Stage interactivo más allá de `createSceneNode`).

## Opciones evaluadas
El enunciado de producto de Fase 7.4 exige evaluar explícitamente estas opciones antes de implementar:

### A. Margen interactivo alrededor de la página (agrandar el Stage)
Agrandar `stage.width()/height()` en un margen fijo por lado, y desplazar `mainLayer`/`guidesLayer`/`selectionLayer` por ese mismo margen para que el espacio de página siga empezando en la misma posición relativa dentro del Stage.
- **Descartada.** Como Konva gestiona el tamaño CSS del `canvasContainer` directamente a partir de `stage.width()/height()`, agrandar el Stage agranda también ese contenedor — y ese es el MISMO elemento que Rulers/indicador de puntero/Grid overlay/zoom miden asumiendo que su esquina superior izquierda es el origen de página. Adoptar esta opción exigiría tocar la matemática de coordenadas de los cuatro módulos simultáneamente: exactamente el "cambio de arquitectura que afecta el sistema de coordenadas en todo `renderer-konva`" que el propio enunciado pide evitar si no es estrictamente necesario.

### B. Overlay layer fuera del clipping del contenido (un segundo Stage)
Un `Konva.Stage` adicional, más grande, posicionado con CSS (offset negativo) sobre el Stage principal, dedicado solo a handles fuera de los límites de la página.
- **Descartada.** Konva no permite que una `Layer` individual tenga un tamaño de canvas distinto al de su `Stage` — lograr esto requeriría un SEGUNDO `Konva.Stage` real, con su propio ciclo de vida, su propia sincronización de pan/zoom/scroll con el Stage principal, y cuidado explícito para que su capa "de margen" (normalmente vacía) no intercepte con eventos DOM del contenido de alrededor (ej. Rulers). Complejidad y superficie de bugs comparables o mayores a la opción A, sin ninguna ventaja que la compense.

### C. Compensación dinámica del handle (elegida)
Recortar la distancia entre el borde real del object/caja y el handle de rotación, a lo largo del mismo vector dirección, contra los límites interactivos del Stage — el handle se acerca al object en vez de dibujarse fuera de rango.
- **Elegida.** No requiere ningún cambio al tamaño del Stage/container, por lo tanto cero impacto en Rulers/indicador de puntero/Grid overlay/zoom. Es un recorte de rayo contra rectángulo (`clampPointToStageBounds`), válido para **cualquier ángulo** de rotación del object/selección (no solo el caso sin rotar, que era la limitación que Fase 7.3.5 documentó de un simple `Math.max(y, 0)`). Sirve idénticamente para selección individual (`handles.ts`) y múltiple (`groupHandles.ts`, ADR-0017) con la misma función.

## Decisión tomada
`renderer-konva/manipulation/interactiveBounds.ts` (nuevo): `clampPointToStageBounds(anchor, desiredPoint, stage, padding)`. Dado el punto fijo `anchor` (el borde superior real del object/caja, que nunca se mueve) y el punto `desiredPoint` que el handle ocuparía sin restricción, calcula el parámetro `t ∈ [0,1]` a lo largo del vector `desiredPoint - anchor` tal que `anchor + t·vector` se mantiene dentro del rectángulo `[padding, stageWidth-padding] × [padding, stageHeight-padding]` — el mismo tipo de recorte que usan los algoritmos estándar de clipping de líneas contra un rectángulo (Liang-Barsky simplificado a un único segmento), sin necesitar ninguna dependencia nueva.

`padding = HANDLE_SIZE / 2`: sin él, el CENTRO del handle podría quedar exactamente sobre el borde del Stage, dejando la mitad de su área de hit-test fuera igualmente.

`handles.ts` (selección individual) y `groupHandles.ts` (selección múltiple, ADR-0017) llaman a la misma función con sus propios `anchor`/`desiredPoint` — mismo comportamiento en ambos casos, sin duplicar la lógica de recorte.

El handle **nunca se oculta**: en el caso límite donde no hay ningún margen disponible (offset recortado a 0), el handle queda exactamente sobre `anchor` — visible e interactivo, solo más cerca del object de lo habitual. Esto es intencional: "no ocultar silenciosamente el handle" es un requisito explícito del enunciado de producto.

## Consecuencias
- Cero cambios a `renderer.ts`'s manejo de `stage.width()/height()`, a `assistedPlacement.ts` (Rulers/indicador de puntero/Grid overlay), ni a `zoom.ts` — el fix queda enteramente contenido en `manipulation/`.
- `offscreenRenderer.ts` (export headless) no necesita ningún cambio ni verificación adicional — nunca dibuja handles, por lo que este bug y su fix le son estructuralmente ajenos.
- El mismo mecanismo sirve, sin ninguna adaptación, tanto para la caja de un solo object (ADR-0008) como para la caja compartida de una selección múltiple (ADR-0017) — un solo lugar de verdad para "qué tan cerca del borde puede estar un handle de rotación".

## Riesgos
- **Limitación residual, no resuelta por diseño**: si el object/la selección completa está enteramente fuera del área interactiva del Stage (`anchor` mismo fuera de `[padding, size-padding]`), no hay ninguna distancia que recortar — el handle queda sobre un `anchor` que también está fuera de rango. Es una limitación inherente a cualquier canvas de tamaño fijo (no soluble sin la opción A, descartada arriba por su costo), no una regresión de esta fase ni un caso que la opción C pretenda resolver.
- **El handle puede terminar visualmente muy cerca (o encima) del borde del object** cuando el recorte es severo — aceptable y esperado (mejor que inalcanzable), pero un usuario podría necesitar hacer zoom o mover el object levemente para tener más margen de maniobra en casos extremos; no se consideró justificado introducir ninguna otra señal visual adicional para esto en esta fase.

## Compatibilidad futura
- Si una fase futura decide sí invertir en la opción A (margen real del Stage) — por ejemplo, para soportar guías manuales que se extiendan más allá de la página — `clampPointToStageBounds` puede simplemente dejar de invocarse (o recibir un `padding`/límites mayores) sin ningún cambio a su firma ni a quien la llama.
