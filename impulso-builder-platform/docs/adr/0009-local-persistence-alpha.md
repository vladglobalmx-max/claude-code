# ADR-0009 — Local Persistence (Milestone 1: Impulso Alpha)

## Problema
Milestone 1 ("Impulso Alpha") exige que el usuario pueda guardar un documento localmente y volver a abrirlo. Ninguna pieza existente (Document Schema, Engine, Renderer) sabe qué es `localStorage`, ni debería saberlo — ¿dónde vive esta capacidad nueva, y cómo se le "abre" al Engine un documento distinto al que se creó con `createEngine()`?

## Contexto
- `@impulso/document-schema` ya expone `serializeProject`/`deserializeProject` (Foundation 1) — convierten un `Project` a/desde un string JSON, validando con Zod y migrando `schemaVersion` si hace falta. No falta ninguna pieza de bajo nivel.
- `@impulso/engine` deliberadamente no depende de nada del navegador (sin DOM en su `tsconfig`) — persistencia en `localStorage` es, por definición, una API del navegador.
- El Engine no tiene (ni tenía por qué tener) una operación de "reemplazar el Project actual por otro" — se diseñó para mutarse exclusivamente vía `dispatch`, no para "recargarse". Añadir una así habría sido un cambio de API pública sin necesidad real.
- `bootstrap.ts` (Editor 1) ya acepta un `Project` opcional en `mountCanvasRuntime(container, project?)` — construido para demostrar el pipeline con contenido de demostración, pero sirve igual de bien para montar CUALQUIER Project, incluido uno recién cargado de `localStorage`.
- Milestone 1 prioriza "validar el flujo completo y detectar problemas de integración", no construir una Foundation formal de Persistence — no hay todavía un segundo módulo (Planner Builder, etc.) que necesite esta misma capacidad, así que generalizarla prematuramente sería especular sobre un consumidor que no existe.

## Alternativas evaluadas

**Dónde vive el código de persistencia:**
- *Agregar un método `engine.loadProject(project)` a `@impulso/engine`*: rompería la regla "el Engine no sabe que existe un navegador" (aunque `loadProject` en sí no tocaría `localStorage`, es el primer paso de una pendiente resbaladiza) y es un cambio de API pública para una capacidad que ni siquiera necesita tocar el Engine.
- *Un paquete nuevo `packages/persistence-local`*: sería el movimiento correcto SI ya hubiera un segundo consumidor real (otro módulo de Impulso Builder Platform) — hoy sería abstraer para un futuro hipotético, en contra de la disciplina de este proyecto de no diseñar para necesidades que no existen todavía.
- *Código de aplicación en `apps/sticker-builder/src/persistence.ts`, usando las funciones de serialización ya públicas de `@impulso/document-schema`*: **elegido**. Cero cambios en `@impulso/engine` o `@impulso/document-schema`. Si en el futuro un segundo módulo necesita lo mismo, extraerlo a un paquete es un refactor mecánico (mismo patrón ya usado para `interactions/` en Editor 3): mover el archivo, no rediseñarlo.

**Cómo "abrir" un documento distinto sin una API de "reemplazar Project" en el Engine:**
- *Agregar esa API al Engine*: descartado por la razón de arriba.
- *Destruir el `RendererAdapter` actual y volver a llamar `mountCanvasRuntime(container, projectCargado)`*: **elegido**. `bootstrap.ts` ya soporta esto sin ningún cambio — un nuevo `Engine` + `RendererAdapter` se construyen desde cero con el Project cargado. "Nuevo documento" usa exactamente el mismo mecanismo con un Project fresco en vez de uno cargado.

**Qué se guarda y bajo qué clave:**
- *Múltiples documentos, con una clave por `project.id` y algún selector de "cuál abrir"*: exigiría una UI de lista de documentos — fuera de alcance explícito de este milestone ("no es necesario implementar todavía una interfaz final").
- *Un único slot fijo (`impulso:sticker-builder:project`), sobrescrito en cada Guardar*: **elegido**. Es la implementación mínima que satisface literalmente "guardar localmente" y "abrir nuevamente el documento" — soporte multi-documento es una mejora futura evidente, no una necesidad de este milestone.

**Qué pasa con el historial de undo/redo al recargar:**
- *Serializar también las pilas de undo/redo*: el `Project` serializado no las incluye (son estado de sesión del Engine, no contenido persistido, igual que la selección) — hacerlo habría exigido un formato nuevo y tocar la API de `@impulso/engine`.
- *Aceptar que undo/redo empiece vacío tras "Abrir" (un `Engine` nuevo, sin historial previo)*: **elegido**, y coherente con cómo ya se diseñó el Engine desde Foundation 2 — el historial en memoria siempre fue efímero por instancia, nunca se prometió que sobreviviera un reinicio.

## Decisión tomada
`apps/sticker-builder/src/persistence.ts`: `saveProjectLocally`/`loadProjectLocally`/`hasLocalProject`/`clearLocalProject`, envolviendo `serializeProject`/`deserializeProject` sobre un único slot de `localStorage`, con `storage: Storage` inyectable (por defecto el `localStorage` real) para tests determinísticos. `apps/sticker-builder/src/toolbar.ts`: cablea 5 botones (Nuevo/Deshacer/Rehacer/Guardar/Abrir) sobre el `CanvasRuntime` de `bootstrap.ts`; "Nuevo"/"Abrir" destruyen el runtime actual y montan uno nuevo (`mountCanvasRuntime`) con un Project fresco o cargado, respectivamente.

## Consecuencias
- Cero cambios en `@impulso/document-schema` y `@impulso/engine` — ambos ya tenían todo lo necesario.
- `@impulso/sticker-builder`: 0.1.0 → 0.2.0. Gana una UI mínima (5 botones) y dos módulos nuevos (`persistence.ts`, `toolbar.ts`).
- El patrón "destruir y remontar" para cambiar de documento es simple y ya estaba soportado — no requirió ninguna extensión de `RendererAdapter`/`Engine`.

## Riesgos
- **Un solo slot de guardado**: guardar sobrescribe cualquier guardado anterior sin aviso ni confirmación. No hay lista de documentos, ni nombre de archivo, ni "guardar como". Documentado, no resuelto — es exactamente la limitación que "no interfaz final" acepta a cambio de velocidad de validación.
- **Sin manejo de cuota de `localStorage`**: un documento suficientemente grande podría exceder el límite del navegador (~5-10MB típico) y `setItem` lanzaría — no se agregó manejo específico de ese error porque el tamaño de documento de Sticker Builder hoy está lejos de ese límite; sería el primer punto a resolver si esto creciera.
- **El historial de undo/redo no sobrevive a Guardar/Abrir/recargar la página** (ver "Alternativas evaluadas") — comportamiento esperado, pero vale la pena que quien pruebe el Alpha lo sepa de antemano para no reportarlo como bug.
- **Sin versionado de "quién guardó qué, cuándo"** más allá de `document.history` (que sí persiste, pero no incluye info del navegador/sesión) — no hay conflicto de concurrencia entre pestañas si dos pestañas del mismo navegador guardan al mismo tiempo (la última que escribe gana, sin aviso).

## Compatibilidad futura
Si un segundo módulo de Impulso Builder Platform necesita persistencia local, extraer `persistence.ts` a un paquete `packages/persistence-local` es mecánico: mismas cuatro funciones, mismo uso de `serializeProject`/`deserializeProject`, sin rediseño. Cuando exista una Foundation de verdad para Persistence (con sincronización remota, multi-documento, versionado real), esta implementación local seguiría siendo válida como su capa de caché offline — no es código descartable, es la base mínima correcta.
