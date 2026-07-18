# ADR-0010 — Sticker Creation Experience

## Problema
La Épica pide la primera experiencia de creación de stickers de punta a punta: crear un proyecto con un tamaño de canvas, agregar texto e imágenes, mover/escalar/rotar/duplicar/eliminar objects, reordenar capas, agrupar/desagrupar, bloquear/ocultar, deshacer/rehacer, y guardar/abrir — todo dentro del navegador, sin regresiones y sin tocar Engine/Renderer/Document Schema de forma que rompa lo ya construido. Varias de estas capacidades (agrupar, "colocar" una imagen sin una Asset Library, editar texto directamente sobre el canvas, hacer zoom) no tenían todavía una respuesta de diseño en la arquitectura existente.

## Contexto
- Document Schema, Engine y Renderer ya estaban completos y congelados en su forma pública (Foundation 0-3, Editor Epic 1) — la única superficie permitida para esta épica es extenderlos de forma aditiva (nuevos comandos, nuevas funciones puras, nuevas opciones opcionales), nunca romper lo existente.
- El usuario delegó explícitamente la autoridad de decisión de UX ("no necesito aprobar cada decisión menor... solo detente si cambia arquitectura o dirección de producto") — este ADR documenta esas decisiones autónomas, no pide aprobación retroactiva.
- Explícitamente fuera de alcance: IA, Exportación, Marketplace, Usuarios, Cloud, Plantillas, Mockups, Librería de Assets, Plugins. Cualquier diseño que pareciera requerir una de estas piezas se resolvió con un atajo documentado como deuda técnica, no construyéndola.
- `reorderObjects` (Foundation 2) ya restringía su operación a "hijos directos de una Layer" — un precedente directo para cómo debía comportarse `groupObjects`.
- `resolveAssetSource` (Foundation 3) ya era un punto de extensión existente en el Renderer, sin usar hasta ahora — un precedente directo para cómo resolver imágenes sin construir una Asset Library.

## Alternativas evaluadas

### Agrupar/desagrupar objects
- *Permitir agrupar objects de cualquier profundidad/Layer*: exige que el Engine razone sobre jerarquías arbitrarias y reubicaciones entre Layers — mucho más código y superficie de error para una necesidad no pedida.
- *Restringir a hijos directos de una misma Layer (mismo criterio que `reorderObjects`)*: **elegido**. `groupObjects(objectIds, group)` calcula los `children` del Group a partir de los objects encontrados en la Layer (el caller nunca construye el array de hijos a mano) y los retira de la Layer, insertando el Group en la posición del más "al frente" de ellos. `ungroupObject` hace lo inverso.
- *Al desagrupar, dejar que los hijos hereden literalmente el transform del Group (podrían "saltar" visualmente)* vs. *"hornear" (bake) el transform del Group en cada hijo, para que nada se mueva en pantalla*: se eligió lo segundo — `composeChildTransformIntoParent` (scale → rotate → translate, la misma convención de composición ya usada en el sistema de manipulación de Editor Epic 1) garantiza que ungroup sea visualmente un no-op.

### Agregar imágenes sin una Asset Library
- *Construir una Asset Library mínima ahora*: explícitamente fuera de alcance de esta épica.
- *Bloquear "Agregar imágenes" hasta que exista una Asset Library*: incumple un requisito explícito de la épica.
- *Embeber el data URL de la imagen directamente en `customProperties` del propio `ImageObject`, con un `assetId` sintético no respaldado por ningún registro real*: **elegido**. `customProperties` ya existe en el Document Schema (bolsa JSON libre) desde Foundation 1 — no requiere ningún cambio de esquema. `imageAssets.ts` (capa de aplicación) resuelve ese data URL hacia un `HTMLImageElement` en memoria (`ImageAssetCache`) que se conecta al `resolveAssetSource` ya existente del Renderer. Al guardar, el data URL viaja con el documento (dentro de `customProperties`); al abrir, `preloadProjectImages` repuebla el cache antes del primer render. Documentado como deuda técnica explícita: esto no reemplaza una Asset Library real (sin deduplicación, sin límite de tamaño, el documento crece con cada imagen embebida).

### Edición de texto directamente en el canvas
- `Konva.Text` no es nativamente editable — las alternativas son (a) un editor de texto propio dentro de Konva, o (b) un overlay HTML.
- *Overlay HTML (`<textarea>`) posicionado y rotado con CSS sobre el node de Konva mientras se edita*: **elegido** (ya anticipado desde ADR-0004). Doble-click sobre un `Konva.Text` oculta el node, coloca un `<textarea>` con la misma posición/rotación/tamaño absolutos, y confirma (`updateObjectContent`, comando nuevo) en blur o Enter; Escape cancela. Riesgo aceptado y documentado: el layout del `<textarea>` no garantiza un pixel-match exacto con el `Konva.Text` (fuentes/kerning del navegador vs. Konva).

### Selección de un Group como una sola unidad
- *Permitir que cada hijo de un Group se seleccione/arrastre individualmente desde el canvas*: rompería la expectativa estándar de cualquier editor de diseño (Figma, Illustrator) de que un Group es una sola unidad hasta que se "entra" explícitamente en él (función no pedida en esta épica).
- *Agregar hit-testing personalizado para que un click en un hijo seleccione al Group*: innecesario — se verificó directamente en el código fuente de Konva (`Node.js`/`DragAndDrop.js`) que un hijo con `draggable:false` dentro de un Group con `draggable:true` ya hace bubbling del `mousedown` hasta el listener del propio Group, logrando el comportamiento correcto sin ningún código de hit-testing nuevo.
- **Elegido**: `NodeContext.interactive` (opcional, default `true`); `createGroupNode` construye a sus hijos con `interactive:false` (a cualquier profundidad, recursivamente) — `applyBaseAttrs` usa ese flag para omitir `draggable` y no adjuntar interacciones de selección/transform/edición de texto en esos hijos, dejando `listening` intacto para que el bubbling siga funcionando. El panel de capas replica la misma restricción: las filas de hijos de un Group (profundidad > 0) son solo informativas, sin selección ni renombrado individual.

### "Colocar" texto e imágenes nuevos
- *Herramienta con modo persistente ("Texto"/"Imagen" armados, esperando un click en el canvas para posicionar")*: requeriría traducir coordenadas de pantalla a través del zoom CSS (ver más abajo) hasta el espacio del Stage de Konva — código de coordinación adicional para una interacción que ningún requisito pidió explícitamente ("Agregar texto"/"Agregar imágenes", no "colocar con un click").
- *Insertar el object ya centrado en la página, con un pequeño desplazamiento en cascada entre inserciones consecutivas (para que no queden perfectamente apilados)*: **elegido**. El usuario arrastra el object recién creado a su posición final con la interacción de mover ya existente (Editor Epic 1) — cero código nuevo de coordinación.

### Zoom
- *Reescalar el Stage de Konva (`stage.scale()`)*: mezclaría "zoom de la vista" con la escala real de los objects del documento, y complicaría la interacción entre el zoom y el sistema de manipulación (resize handles, etc.) que ya asume unidades de documento.
- *`transform: scale(...)` en CSS sobre el contenedor que envuelve el Stage*: **elegido**. Puramente visual — el Document Schema, el Engine y el Stage de Konva no saben que el zoom existe; los eventos de puntero de Konva siguen operando en las coordenadas reales del Stage sin ninguna conversión adicional (verificado en un navegador real: arrastrar un object sigue funcionando correctamente con el canvas escaleado por zoom). Presets 25/50/100/200%, "Ajustar a pantalla" (calcula el factor que hace caber el tamaño de página actual dentro del viewport visible) y rueda del mouse + Ctrl/Cmd.

### Duplicar sin un comando nuevo de "clonar"
- *Un comando `duplicateObject` dispachable en el Engine*: el Engine "nunca inventa identidad" (ids/timestamps de contenido de usuario siempre los provee quien llama) — un comando de este tipo tendría que generar un id internamente, rompiendo ese principio, o recibir el id ya generado desde afuera (en cuyo caso no aporta nada sobre usar `addObject` directamente).
- **Elegido**: `cloneSceneObjectWithNewIds` (función pura en `@impulso/engine`, no un comando) clona recursivamente un subárbol asignando ids frescos con un generador inyectado por el caller, y la app la combina con el comando `addObject` ya existente. Cero comandos nuevos para "Duplicar".

### Reconstrucción del panel de capas en cada cambio de selección (bug encontrado durante la verificación en navegador)
- La primera implementación reconstruía el DOM completo del panel de capas en cualquier evento `projectChanged` **o** `selectionChanged`. Verificado en Chromium real (no en jsdom, que sintetiza `dblclick` sin pasar por la detección nativa de doble-click): esto rompía el renombrado inline, porque el primer click de un doble-click dispara `setSelection` → reconstruye el DOM → el segundo click aterriza sobre un elemento distinto (aunque visualmente idéntico) al que recibió el primero, y el navegador nunca cuenta 2 clicks sobre el "mismo" elemento, así que `dblclick` jamás se dispara.
- **Elegido**: separar reconstrucción completa (solo en `projectChanged`) de una actualización liviana que solo alterna la clase `.selected` sobre las filas ya existentes (en `selectionChanged`), preservando la identidad de los nodos DOM entre clicks. Verificado de nuevo en Chromium real tras el cambio: el renombrado por doble-click funciona correctamente.

## Decisión tomada
Todo lo anterior se implementó como seis módulos nuevos en `apps/sticker-builder` (`projectPresets.ts`, `imageAssets.ts`, `layersPanel.ts`, `inspector.ts`, `zoom.ts`, `tools.ts`, `keyboardShortcuts.ts`, `newProjectDialog.ts`) orquestados por un nuevo `app.ts` que reemplaza a `toolbar.ts` (Milestone 1) — mismo patrón de "destruir y remontar el runtime completo" para Nuevo/Abrir (ADR-0009), extendido con precarga de imágenes embebidas antes del primer render. En el Engine: 3 comandos nuevos (`updateObjectContent`, `groupObjects`, `ungroupObject`), 2 funciones puras nuevas (`composeChildTransformIntoParent`, `cloneSceneObjectWithNewIds`), 2 códigos de error nuevos. En el Renderer: `NodeContext.interactive` y la interacción de edición de texto in-canvas. Cero cambios que rompan la API pública existente de ningún paquete.

## Consecuencias
- `@impulso/engine` 0.3.0 → 0.4.0, `@impulso/renderer-konva` 0.4.0 → 0.5.0, `@impulso/sticker-builder` 0.2.0 → 0.3.0.
- El flujo completo (crear → diseñar → guardar → abrir → editar sin pérdida de información) funciona de punta a punta en un navegador real, verificado con Playwright contra un build de producción (`vite build` + `vite preview`), sin errores de consola.
- El panel de capas y el Inspector asumen un único Page/Layer (el Document Schema soporta múltiples, pero esta UI no los expone) — alcance explícito de esta épica, no una limitación de la arquitectura.
- Los atajos de teclado son un mapa puro (`KeyboardShortcutActions`) desacoplado del Engine — reutilizable si un futuro módulo de Impulso Platform quiere el mismo set de atajos con acciones distintas.

## Riesgos
- **Imágenes embebidas como data URL**: sin deduplicación ni compresión — un documento con varias imágenes grandes crece proporcionalmente en `localStorage`, y el límite típico de ~5-10MB del navegador podría alcanzarse antes de lo esperado. Documentado como el primer punto a resolver cuando exista una Asset Library real.
- **Agrupar/desagrupar de un solo nivel de restricción**: igual que `reorderObjects`, solo opera sobre hijos directos de una Layer — agrupar objects que ya están anidados en otro Group, o que viven en Layers distintas, se rechaza explícitamente en vez de soportarse.
- **Sin "entrar" a un Group**: un Group siempre se selecciona/edita como una unidad; no hay una interacción de "doble-click para entrar y seleccionar un hijo individualmente" (estándar en Figma/Illustrator) — se puede lograr el mismo resultado desagrupando, editando, y volviendo a agrupar.
- **El `<textarea>` de edición de texto no garantiza pixel-match exacto** con el renderizado de `Konva.Text` (diferencias de fuente/kerning entre el motor de layout del navegador y Konva).
- **No hay un modo de herramienta persistente**: Texto/Imagen insertan de inmediato en vez de "armarse" y esperar un click de colocación — una futura épica de refinamiento de UX podría reconsiderar esto si el patrón de "arrastrar tras insertar" resulta incómodo en la práctica.
- **Deshacer/Rehacer no sobreviven a Guardar/Abrir** (heredado de ADR-0009, sin cambios en esta épica).

## Compatibilidad futura
Ninguna de estas decisiones cierra una puerta: una Asset Library real puede reemplazar el mecanismo de `customProperties`/`assetId` sintético sin tocar Document Schema (solo migrando el dato); agrupar/desagrupar multi-Layer, "entrar" a un Group, y un modo de herramienta persistente son extensiones aditivas sobre lo ya construido, no rediseños. El mapa de atajos de teclado y el patrón de zoom-vía-CSS son directamente reutilizables por cualquier futuro módulo de Impulso Platform (Planner Builder, Coloring Book Builder, etc.).
