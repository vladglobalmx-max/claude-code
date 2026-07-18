# 06 — Architecture Decisions (índice centralizado)

> Este documento centraliza, en un solo lugar, los nueve Architecture Decision Records creados hasta la fecha — cada uno resumido en **Contexto, Problema, Alternativas, Decisión, Consecuencias**. Es un índice de lectura rápida, no un reemplazo: cada ADR original en [`../adr/`](../adr) incluye además **Riesgos**, **Compatibilidad futura**, y — cuando aplica — una sección **Rendimiento**, que aquí solo se referencian, no se repiten. Ver [`../adr/README.md`](../adr/README.md) para la plantilla completa y las reglas permanentes (ADR obligatorio por Foundation/Editor, Performance Budget, Stable Public API, UX First).
>
> **Nota de nomenclatura:** estos resúmenes preservan el lenguaje de cada ADR original en el momento en que se escribió (algunos usan "Impulso" o "la plataforma" de forma genérica, antes de que "Impulso Platform" fuera el nombre oficial adoptado — ver [`01-Product-Vision.md`](01-Product-Vision.md)). No se reescribe retroactivamente el historial de decisiones; el nombre oficial rige para toda documentación nueva desde este punto en adelante.

---

## ADR-0001 — Impulso Engine: Document Schema → Engine → Renderer → Konva

> [`../adr/0001-impulso-engine-architecture.md`](../adr/0001-impulso-engine-architecture.md) · Foundation 0 (retrofit)

**Contexto:** Sticker Builder debía nacer como el primer módulo de una plataforma con más módulos futuros (Planner Builder, Coloring Book Builder), sin acoplar todo el editor a una librería de renderizado concreta. Konva.js ya se había evaluado y elegido como motor de canvas.

**Problema:** ¿Cómo estructurar el editor para que sea un consumidor de un núcleo reutilizable, no "el producto" en sí mismo?

**Alternativas:**
- Engine acoplado directamente a Konva — más simple a corto plazo, pero cualquier cambio de renderer obligaría a reescribirlo.
- Un solo paquete monolítico (schema + lógica + render mezclados) — imposible de reutilizar en un módulo futuro sin arrastrar Konva.

**Decisión:** Cuatro niveles con dependencia en una sola dirección: `Document Schema → Engine → Renderer (adaptador) → Konva (hoy)`. `packages/engine` nunca importa Konva ni ninguna librería de render; `packages/renderer-konva` es la única implementación concreta del contrato `RendererAdapter`.

**Consecuencias:** Cada Foundation se desarrolla y testea de forma aislada. Un futuro cambio de renderer no toca `document-schema` ni `engine`. Los tipos de Object son genéricos; lo específico de un módulo se expresa vía `metadata.role`.

---

## ADR-0002 — Document Schema como contrato de datos renderer-agnóstico

> [`../adr/0002-document-schema.md`](../adr/0002-document-schema.md) · Foundation 1

**Contexto:** ADR-0001 exige que el Document Schema no dependa de Konva/React/Canvas/SVG/DOM — debe ser TypeScript puro, validable, versionable desde el día uno.

**Problema:** ¿Cómo representar un proyecto de Impulso (páginas, capas, formas) de forma completamente independiente de cómo se dibuja, y genérica entre módulos futuros?

**Alternativas:**
- Tipos de Object específicos por módulo (ej. `StickerDieCut`) — rompe la reutilización entre módulos.
- Documento no tipado (JSON libre) — máxima flexibilidad, cero garantías.
- Path vectorial como string SVG "d" — descartado por depender, aunque solo sea nominalmente, de una tecnología de render; se prefirió un array de segmentos tipados (`PathSegment`).

**Decisión:** Zod + TypeScript puro. Jerarquía `Project → Document → Page → Layer → SceneObject` (Rectangle/Ellipse/Path/Image/Text/Group recursivo), un único `Metadata` reutilizado en los 5 niveles, versionado explícito con pipeline de migraciones inyectable.

**Consecuencias:** Cuatro funciones genéricas (validate/serialize/deserialize/clone) sirven para cualquier entidad. Lo específico de un módulo se modela con `metadata.role`, nunca con un tipo de Object nuevo.

---

## ADR-0003 — Engine Core: estado, comandos y eventos

> [`../adr/0003-engine-core.md`](../adr/0003-engine-core.md) · Foundation 2

**Contexto:** ADR-0001 exige que `packages/engine` no dependa de Konva/React/DOM. El Document Schema (ADR-0002) ya define la forma de los datos; falta la lógica que los muta con seguridad.

**Problema:** ¿Cómo permitir modificar un `Project` de forma segura (validada, versionada, deshacible) sin acoplarse a una librería de renderizado?

**Alternativas:**
- Mutación directa del objeto Project — sin validación centralizada, sin historial, sin forma limpia de notificar cambios.
- Undo/redo basado en patches/comandos inversos — más eficiente en memoria, pero exige mantener una función inversa por cada comando.
- `node:events` para el pub-sub — no funciona en el navegador.

**Decisión:** API de comandos + estado + eventos: `dispatch(command)` (nunca lanza, devuelve `EngineResult<Project>`), `undo()`/`redo()` sobre una pila de snapshots completos en memoria, y un pub-sub propio de ~15 líneas para los eventos.

**Consecuencias:** Cada comando de contenido exitoso incrementa `documentVersion` y agrega una `HistoryEntry`. La selección es estado de sesión, no versionado.

---

## ADR-0004 — Renderer Adapter: primer adaptador Konva

> [`../adr/0004-renderer-adapter.md`](../adr/0004-renderer-adapter.md) · Foundation 3

**Contexto:** El Engine define un contrato conceptual `RendererAdapter` pero no tiene ninguna implementación real. Konva debía quedar confinado a un único paquete. Alcance explícito: sin Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Handles, Selection visual ni Exportaciones — solo demostrar que "eventos de Konva → llamadas al Engine" funciona.

**Problema:** ¿Cómo construir el primer adaptador concreto (Document Schema → Scene Graph → Konva) sin filtrar Konva a `document-schema` ni a `engine`?

**Alternativas:**
- Testing: `canvas` nativo (requiere cairo/pango, no compiló en el entorno) vs. `vitest-canvas-mock` (incompatible con vitest v2 ya en uso) vs. un stub propio de `CanvasRenderingContext2D` — **elegido el stub propio**.
- Mapeo Document-Layer: 1 `Konva.Layer` por cada Layer del documento (antipatrón de rendimiento, muchos canvases) vs. un único `Konva.Layer` con cada Layer del documento como `Konva.Group` — **elegido lo segundo**.
- Reconciliación: diff incremental por id vs. rebuild completo en cada `projectChanged` — **elegido el rebuild completo**, siguiendo la regla de "no optimizar prematuramente" del nuevo Performance Budget.

**Decisión:** `createKonvaRenderer(engine, options): RendererAdapter` con `mount`/`destroy`/`getStage`. Mapeo 1:1 de los 6 tipos de `SceneObject` a un constructor Konva, `applyBaseAttrs` centraliza atributos y traduce `dragend` en `updateObjectTransform`, `toKonvaXY`/`fromKonvaXY` aíslan la asimetría de coordenadas de `Ellipse`.

**Consecuencias:** `@impulso/renderer-konva` es el único paquete con Konva como dependencia. No contiene reglas de negocio ni conoce Sticker Builder.

---

## ADR-0005 — Canvas Runtime: primera integración end-to-end

> [`../adr/0005-canvas-runtime.md`](../adr/0005-canvas-runtime.md) · Editor 1

**Contexto:** Las tres piezas del pipeline (Foundations 1-3) nunca se habían ejecutado juntas en un navegador real. Alcance explícito: sin Toolbar, Sidebar, Zoom, Pan, Selección, Resize, Rotación, Handles, atajos, Exportaciones ni Biblioteca de Assets.

**Problema:** ¿Cómo demostrar, con el mínimo código posible, que `Document Schema → Engine → Renderer → Canvas` efectivamente renderiza algo visible en un navegador real?

**Alternativas:**
- Vite + React desde ahora — introduciría una dependencia sin un solo componente real que la use todavía.
- Vite + TypeScript plano — **elegido**: `renderer-konva` ya gestiona su propio ciclo de vida imperativamente, no necesita React para existir.
- Verificación: solo tests estructurales (no prueban píxeles reales) vs. build de producción + Playwright/Chromium real — **elegida esta última, además de los tests unitarios**.

**Decisión:** `apps/sticker-builder` con `main.ts` (dos líneas) + `bootstrap.ts` (`mountCanvasRuntime(container, project?)`, testable) + `demoProject.ts`. Flujo estrictamente unidireccional.

**Consecuencias:** Primera vez que las tres librerías se ejecutan juntas fuera de sus propios tests. Ninguna API pública existente cambia.

---

## ADR-0006 — Selection System: click, Shift-click, deselección

> [`../adr/0006-selection-system.md`](../adr/0006-selection-system.md) · Editor 2

**Contexto:** El Engine ya tenía `getSelection()`/`setSelection`/`clearSelection` y poda automática de ids inexistentes, pero nada la disparaba desde una interacción real. Nuevos estándares permanentes de este sprint: UX First y Stable Public API.

**Problema:** ¿Cómo dar selección por click (single, cambiar, deseleccionar en vacío, múltiple) manteniendo que toda la lógica vive en el Engine y el Renderer solo muestra el estado?

**Alternativas:**
- Selección múltiple: el Renderer calcula el nuevo array de seleccionados (viola la separación) vs. un nuevo comando `toggleObjectSelection` en el Engine — **elegido lo segundo**.
- `metadata.locked`: mantener que bloqueado implique `listening:false` (lo vuelve invisible al sistema de selección) vs. desacoplar `listening` (depende de `visible`) de `draggable` (depende de `locked`) — **elegido lo segundo**: un object bloqueado sigue siendo seleccionable.
- Mostrar la selección: redibujar todo el contenido en cada click (hereda el costo del rebuild completo) vs. un `Konva.Layer` separado (`selectionLayer`) redibujado independientemente — **elegido lo segundo**.
- Convención de interacción: inventar un modelo propio vs. seguir la convención de facto de Figma/Illustrator/Sketch — **elegida la convención existente**.

**Decisión:** Comando `toggleObjectSelection { objectId }` (adición pura). El Renderer decide QUÉ comando enviar según `evt.evt.shiftKey`; el Engine decide qué le pasa a la selección. `selectionLayer` separado dibuja el contorno punteado.

**Consecuencias:** La API del Engine gana un comando aditivo. Cualquier futura superficie de interacción puede reutilizar `toggleObjectSelection` sin duplicar lógica.

---

## ADR-0007 — Transform System: mover objetos con el puntero

> [`../adr/0007-transform-system.md`](../adr/0007-transform-system.md) · Editor 3

**Contexto:** `updateObjectTransform` (Foundation 2) ya aceptaba un `Partial<Transform>` — no hizo falta ningún cambio en `@impulso/engine` para este sprint. El arrastre de Foundation 3 movía cualquier object sin relación con la selección de Editor 2.

**Problema:** ¿Qué falta para que exista un "Transform System" sólido y desacoplado — preparado para resize/rotación futuros — y no solo el arrastre ad-hoc que ya había?

**Alternativas:**
- Arrastrar un object no seleccionado: dejarlo mover sin seleccionar (como ya estaba) vs. que `dragstart` lo seleccione si no lo estaba ya — **elegido lo segundo**, preservando una selección múltiple existente.
- Organización del código: mantener click y dragend mezclados en `applyBaseAttrs` vs. extraer `interactions/selectionInteractions.ts` y `interactions/transformInteractions.ts` — **elegida la extracción**, como molde para futuras interacciones (resize/rotate).
- Confirmar el movimiento: despachar `updateObjectTransform` en cada `dragmove` (multiplica el costo de `dispatch` por frame) vs. confirmar solo en `dragend` — **elegido confirmar solo al soltar**.

**Decisión:** `interactions/transformInteractions.ts`: `dragstart` asegura la selección sin colapsar una múltiple; `dragend` despacha `updateObjectTransform` con la posición final, revirtiendo la vista si el Engine rechaza el cambio. `NodeContext` gana `getSelection` (opcional, aditivo).

**Consecuencias:** Cero cambios en `document-schema`/`engine` — ambos ya estaban preparados. `applyBaseAttrs` queda reducido a atributos estáticos.

---

## ADR-0008 — Manipulation System: resize, rotación, bounding box, handles

> [`../adr/0008-manipulation-system.md`](../adr/0008-manipulation-system.md) · Editor Epic 1

**Contexto:** Primer "Editor Epic" — trabajo por sistemas completos, no por micro-funcionalidades. `Transform` no tiene campo `size` propio (ausente en Path/Group); el Performance Budget ya documentaba el costo del rebuild completo del Renderer.

**Problema:** ¿Cómo construir resize + rotación + bounding box + handles + anclajes + restricciones + cursor feedback + hit testing, integrados, manteniendo que toda la lógica vive en el Engine?

**Alternativas:**
- Representar resize: un campo `width`/`height` final (no existe para Path/Group) vs. expresarlo puramente como `scaleX`/`scaleY` sobre el `Transform` ya existente — **elegido lo segundo**.
- Medir el tamaño natural del object: que el Engine lo calcule (imposible para curvas bezier/grupos anidados sin conocimiento de render) vs. que el Renderer lo mida (`getSelfRect`) y se lo pase como dato (`intrinsicSize`) — **elegido lo segundo**.
- Dónde vive la matemática de anclaje/rotación: en el Renderer (viola la regla del épico) vs. funciones puras exportadas por el Engine (`computeResizedTransform`/`computeRotatedTransform`), llamadas por el Renderer para previsualizar Y por el comando para commitear — **elegido lo segundo**: mismo cálculo, preview y estado final nunca divergen.
- Bounding box con rotación: `getClientRect` (AABB, no sigue los bordes reales de un object rotado) vs. calcular las 8 posiciones en espacio local y rotarlas de vuelta — **elegido lo segundo**.
- Restricción de eje al arrastrar un handle de borde: sin restricción (funcionaría matemáticamente pero se ve roto visualmente) vs. `dragBoundFunc` que proyecta sobre el eje local correcto — **elegido lo segundo**.
- Hit testing: algoritmo propio vs. handles como nodos Konva reales interactivos (Konva ya resuelve esto) — **elegido reutilizar Konva, cero código nuevo**.

**Decisión:** Engine: `computeResizedTransform`/`computeRotatedTransform` (funciones puras) + comandos `resizeObject`/`rotateObject` delegando en `updateObjectTransform`. Renderer: `manipulation/` (bounding box, 8 handles + 1 de rotación, cursor feedback).

**Consecuencias:** Cero cambios en `document-schema`. Engine 0.2.0→0.3.0, Renderer 0.3.0→0.4.0 (ambos aditivos). Se descubrió y corrigió, vía Playwright, un bug real (`selectionLayer` con `listening:false` a nivel de Layer bloqueaba los handles nuevos) invisible para los tests jsdom existentes.

---

## ADR-0009 — Local Persistence (Milestone 1: Impulso Alpha)

> [`../adr/0009-local-persistence-alpha.md`](../adr/0009-local-persistence-alpha.md) · Milestone 1

**Contexto:** Milestone 1 exige guardar/abrir un documento localmente. `serializeProject`/`deserializeProject` (Foundation 1) ya existían. El Engine deliberadamente no conoce el navegador; no tenía (ni necesitaba) una operación de "reemplazar el Project actual". `bootstrap.ts` ya aceptaba un `Project` opcional.

**Problema:** ¿Dónde vive esta capacidad nueva, y cómo se le "abre" al Engine un documento distinto al que se creó, sin romper ninguna regla arquitectónica existente?

**Alternativas:**
- Dónde vive el código: un método `engine.loadProject()` (rompería "el Engine no sabe que existe un navegador") vs. un paquete nuevo `packages/persistence-local` (especular sobre un consumidor que no existe todavía) vs. código de aplicación en `apps/sticker-builder` reutilizando las funciones ya públicas de `document-schema` — **elegida esta última**.
- Cómo "abrir" un documento distinto: una API de "reemplazar Project" en el Engine (descartada) vs. destruir el `RendererAdapter` actual y volver a montar con `mountCanvasRuntime(container, projectCargado)` — **elegido lo segundo**, ya soportado sin cambios.
- Qué se guarda: múltiples documentos con selector (exige UI fuera de alcance) vs. un único slot fijo sobrescrito en cada Guardar — **elegido el slot único**, como mínimo viable de este milestone.
- Historial de undo/redo tras recargar: serializarlo también (exigiría tocar la API del Engine) vs. aceptar que empiece vacío (coherente con que siempre fue estado de sesión efímero) — **elegida esta última**.

**Decisión:** `persistence.ts` (`saveProjectLocally`/`loadProjectLocally`/`hasLocalProject`/`clearLocalProject`, `storage: Storage` inyectable) + `toolbar.ts` (5 botones: Nuevo/Deshacer/Rehacer/Guardar/Abrir, "Nuevo"/"Abrir" remontan el runtime completo).

**Consecuencias:** Cero cambios en `document-schema`/`engine`. `@impulso/sticker-builder` 0.1.0→0.2.0. El patrón "destruir y remontar" para cambiar de documento no requirió ninguna extensión de `RendererAdapter`/`Engine`.

---

## Cómo se mantiene este índice

Cada vez que se cierra un nuevo ADR en [`../adr/`](../adr), se agrega aquí un resumen siguiendo el mismo formato de cinco campos — nunca se reescribe el ADR original, este documento solo lo resume para lectura rápida. Ver [`../adr/README.md`](../adr/README.md) para la plantilla completa (siete campos: Problema, Contexto, Alternativas evaluadas, Decisión tomada, Consecuencias, Riesgos, Compatibilidad futura, más Rendimiento cuando aplica) que todo ADR nuevo debe seguir.
