# ADR-0014 — Project Library / Workspace

## Problema
Con Epic 4 (Templates Foundation) completo, Sticker Builder sigue siendo, en esencia, "un editor que guarda un proyecto": un único slot de `localStorage` (ADR-0009), sin lista, sin nombres, sin miniaturas, sobrescrito silenciosamente en cada Guardar. Esta épica convierte a Impulso en "una plataforma capaz de administrar múltiples proyectos" — una pantalla "Mis proyectos" (Workspace) que se convierte en el punto de aterrizaje de la app, reutilizable por cualquier módulo futuro.

## Contexto
- `docs/product/04-Roadmap.md` (Beta) ya nombraba literalmente esto: *"Múltiples documentos: reemplazar el slot único de localStorage (Alpha) por una gestión real de varios proyectos guardados localmente (IndexedDB), con lista, nombres y miniaturas."* Esta épica es la ejecución de esa línea, antes de lo previsto (mismo patrón que Asset Library/Export Engine/Templates en épicas anteriores).
- `docs/ARCHITECTURE.md` ya preveía un `StorageProvider` a nivel Engine — ADR-0009 decidió explícitamente NO construirlo entonces, por no haber un segundo consumidor real. Esta épica tampoco lo construye: sigue sin haber un segundo módulo real, así que `ProjectStore` vive en un paquete de plataforma (`packages/project-library`), no en `@impulso/engine`.
- `app.ts`'s `remount(project)` (ADR-0009/ADR-0010) ya era exactamente el mecanismo de "cambiar de proyecto actual sin recrear toda la UI" — reutilizado sin cambios para "Nuevo" dentro del editor.
- `Project.metadata` (Document Schema) ya trae `name`/`createdAt`/`updatedAt` — a diferencia de un Template (que necesita metadatos de catálogo ajenos, como `builtIn`), un `Project` ya es su propio descriptor.
- El patrón "descriptor liviano + contenido pesado, dos implementaciones (memoria + IndexedDB) contract-tested" ya estaba probado dos veces (Asset Library, Template Library) — con esta épica como tercera aplicación real, se justifica extraer el andamiaje común (ver más abajo).

## Decisiones confirmadas con el usuario
Se presentaron dos preguntas de arquitectura antes de implementar, ambas aprobadas en la opción recomendada:

**A. ¿Dónde vive la pantalla Workspace?** Embebida dentro de cada Builder (hoy, `apps/sticker-builder`), filtrando por su propio `moduleId` — igual que la galería de Templates. Una app shell cross-módulo (routing/navegación entre Builders, Workspace global) queda reservada para cuando exista un segundo módulo real que la justifique con evidencia, no con diseño anticipado — mismo criterio ya aplicado a Design System/Shared Services (`05-Technical-Debt.md`). Condición explícita del usuario: `packages/project-library` debe quedar completamente independiente y reutilizable para que esa evolución futura no exija rediseñar el almacenamiento — cumplida (ver "Arquitectura del paquete" más abajo: cero conocimiento de `apps/sticker-builder`, cero conocimiento de cómo se monta una UI).

**B. ¿Cómo aterriza el usuario?** Workspace-first: la app aterriza en "Mis proyectos"; el editor se monta recién al abrir un proyecto existente o crear uno (Template o Personalizado). Establece el modelo mental "Impulso administra proyectos y abre un editor cuando el usuario decide trabajar en uno."

**Ajuste adicional aprobado por el usuario:** extraer el andamiaje común de IndexedDB (ya duplicado en Asset Library y Template Library) a un paquete independiente `packages/storage-kit` — nunca dentro de `document-schema` (que debe permanecer puro, sin DOM/IndexedDB), y sin ninguna lógica específica de Assets/Templates/Projects.

## Alternativas evaluadas

### ¿Qué es un `ProjectDescriptor`?
- **A. Derivado siempre del propio `Project`** (elegida): `id`, `moduleId`, `name` (`metadata.name`, con fallback `"Sin título"`), `createdAt`/`updatedAt` (`metadata`) — la única pieza externa es el thumbnail (`Blob` opaco). `save(project, thumbnail?)` recibe el `Project` completo; el store deriva el descriptor.
- **B. Un objeto de catálogo separado, como `TemplateDescriptor`**: descartada — un Template necesita campos de catálogo (`builtIn`, `tags`) que no tienen equivalente natural en un `Project` en edición activa; un Project, en cambio, ya es autodescriptivo. Introducir un segundo objeto habría sido duplicar información que el propio `Project` ya tiene, con el riesgo de que ambos se desincronicen.

### ¿Cómo se preserva el thumbnail al renombrar (que no debería regenerar una miniatura)?
`save(project, thumbnail?)` es "sticky": si `thumbnail` se omite, el store conserva el thumbnail ya guardado para ese id (lee el descriptor existente antes de sobrescribir). Alternativa descartada: exigir que todo `save()` provea un thumbnail — habría obligado a renombrar/otras operaciones ligeras a regenerar una miniatura (rasterización real, costosa) solo para no perder la existente.

### ¿Dónde vive `duplicateProject`?
- **A. Función independiente, no un método de `ProjectStore`** (elegida): compone `getProject`/`getDescriptor`/`save` — funciona igual sobre cualquier implementación sin duplicar lógica de clonado en cada adaptador. Mismo criterio que `instantiateTemplate` en Template Library (tampoco un método de `TemplateStore`).
- **B. Un método `duplicate(id)` en la interfaz `ProjectStore`**: descartada — habría exigido reimplementar la misma lógica de clonado (`cloneProjectWithNewIds` + " (copia)" + conservar thumbnail) en `memoryProjectStore` Y en `indexedDbProjectStore` por separado.

### ¿`packages/storage-kit`: qué expone?
`promisifyRequest`, `openIndexedDb`, `createLazyIndexedDbConnection`, `runInTransaction` — exactamente el andamiaje ya duplicado en `indexedDbStore.ts` (Asset Library) e `indexedDbTemplateStore.ts` (Template Library): apertura con `onupgradeneeded` parametrizable, memoización de la conexión, y acceso a la `IDBTransaction` cruda para que cada consumidor combine los object stores que necesite (Asset Library: 1 store; Template Library/Project Library: 2 stores, atómicos). Cero lógica de ningún dominio — se refactorizaron Asset Library y Template Library para usarlo, sin cambiar su comportamiento observable (mismos tests, mismos contratos, cobertura igual o mejor).

### ¿Cómo se navega entre Workspace y el editor sin una app shell/router?
- **A. `shell.ts`: mostrar/ocultar dos contenedores DOM, montar/destruir `App` bajo demanda** (elegida): `mountShell` monta la Workspace una sola vez (persiste durante toda la sesión) y, al abrir/crear un proyecto, monta un `App` (`app.ts`) nuevo — destruyendo cualquier instancia anterior primero (`currentApp?.destroy()`), nunca dos editores vivos a la vez. Es literalmente el mismo patrón "destruir y remontar" que `app.ts` ya usa internamente para "Nuevo"/"Abrir" desde ADR-0009, aplicado un nivel más arriba.
- **B. Un router (History API, rutas `/workspace`, `/editor/:id`)**: descartada — no hay todavía necesidad real de URLs profundas/compartibles ni de botón atrás del navegador; introducir un router es infraestructura que ni la Decisión A del usuario pidió. Se revisará si/cuando la app shell cross-módulo (diferida a v2.0) lo requiera.

### ¿Qué le pasa a "Abrir" (el botón) y a Ctrl/Cmd+O?
El slot único legado ya no existe como concepto de uso — "Abrir un proyecto distinto" ahora siempre pasa por elegir cuál en la Workspace. El botón "Abrir" se reemplaza por "Mis proyectos" (`backToWorkspaceButton`), y el atajo `Ctrl/Cmd+O` (antes `actions.open()`) se renombra a `actions.goToWorkspace()` — mismo atajo, nuevo significado, documentado en el propio tipo (`KeyboardShortcutActions`).

### ¿Qué pasa con la migración de imágenes embebidas (Epic 2, formato Epic 1) ahora que no hay un flujo de "Abrir" único?
Se reubica dentro de `migrateLegacyLocalProject` (`workspaceMigration.ts`): el ÚNICO proyecto que podría seguir teniendo el formato viejo (data URL embebida) es precisamente el que viene del slot legado de `localStorage` — ningún proyecto guardado en el `ProjectStore` nuevo pudo haberse guardado nunca en ese formato. La migración de imágenes (`legacyMigration.ts`, sin cambios) se ejecuta como parte de esta migración única al arrancar, no en cada apertura de proyecto.

## Decisión tomada

### Arquitectura del paquete (`packages/project-library`, nuevo)
Depende de `@impulso/document-schema` + `@impulso/engine` (reutiliza `cloneProjectWithNewIds` para `duplicateProject`) + `@impulso/storage-kit`. Nunca de `@impulso/export-engine` — el thumbnail es un `Blob` opaco.

- `ProjectDescriptor { id, moduleId, name, thumbnail?, createdAt, updatedAt }`.
- `ProjectStore { listDescriptors(filter?), getDescriptor(id), getProject(id), save(project, thumbnail?), delete(id), clear() }`.
- `createMemoryProjectStore()`/`createIndexedDbProjectStore()` — contract-tested (36 tests), IndexedDB con dos object stores (`projectDescriptors`/`projectContent`) sobre `@impulso/storage-kit`.
- `duplicateProject(store, id, options)` — función independiente.

### `packages/storage-kit` (nuevo)
`promisifyRequest`, `openIndexedDb`, `createLazyIndexedDbConnection`, `runInTransaction`. Sin dependencias de dominio. Asset Library y Template Library refactorizados para usarlo (0.1.0 → 0.1.1 en ambos, cero cambio de comportamiento).

### Cambios en `apps/sticker-builder`
- `workspace.ts` (nuevo): pantalla "Mis proyectos" — grilla de tarjetas (miniatura, nombre editable inline, "Editado [fecha]"), acciones Abrir/Renombrar/Duplicar proyecto ("Duplicar proyecto", deliberadamente distinto del botón "Duplicar" del editor que duplica un *object* seleccionado)/Eliminar (con `window.confirm`), ordenadas por `updatedAt` descendente. "Nuevo proyecto" reutiliza `newProjectDialog.ts` (Epic 4) sin cambios, montado en su propio contenedor.
- `shell.ts` (nuevo): orquestador de nivel superior — Workspace-first, migración al arrancar, montar/destruir el editor bajo demanda.
- `workspaceMigration.ts` (nuevo): migración transparente de una sola vez desde `persistence.ts` (slot legado) hacia el `ProjectStore`, incorporando `migrateLegacyEmbeddedImages` (Epic 2).
- `app.ts`: `doSave` ahora async, persiste en `projectStore` con un thumbnail (reutilizando `createThumbnailGenerator` ya existente desde Epic 4) — un fallo generando el thumbnail nunca bloquea el guardado del Project en sí. `doOpen`/`openButton`/`storage` eliminados. Nuevo `onBackToWorkspace` inyectable.
- `persistence.ts`: `saveProjectLocally` eliminado (sin llamadores tras esta épica) — el módulo sobrevive solo como fuente de lectura/borrado para la migración.
- `keyboardShortcuts.ts`: `open()` renombrado a `goToWorkspace()`.
- `index.html`/`main.ts`: `#workspace-screen`/`#editor-screen` como dos pantallas alternadas; `#open-btn` → `#back-to-workspace-btn`.

## Consecuencias
- Sticker Builder deja de ser "un editor que guarda un archivo" — aterriza en un catálogo de proyectos administrables, con el mismo lenguaje visual ya validado en la galería de Templates.
- Cualquier módulo futuro obtiene, sin escribir infraestructura nueva: Workspace propia (filtrada por su `moduleId`), Guardar/Renombrar/Duplicar/Eliminar, con solo escribir su propio `moduleId` y su propio `mountShell`/pantalla de editor.
- `packages/storage-kit` deja el terreno preparado para que un cuarto pilar de almacenamiento (o el propio Project Library evolucionando a sync remoto) no vuelva a duplicar este andamiaje.

## Riesgos
- **Sin autosave** — deliberado, fuera de alcance de v1 (ver Roadmap/Technical Debt).
- **Sin deduplicación de binarios de Asset al duplicar un proyecto** — mismo riesgo ya aceptado en Template Library, extendido aquí.
- **Sin búsqueda/carpetas/colecciones** en la Workspace, **sin papelera de reciclaje** (eliminar es definitivo, con `window.confirm` como única red de seguridad).
- **Sin manejo de cuota de IndexedDB agotada.**
- **Miniaturas de proyectos recién creados desde un Template built-in pueden verse casi en blanco** — reflejan fielmente el contenido real (los presets solo definen tamaño/forma, no decoración), no es un defecto de esta épica.

## Compatibilidad futura
- Un `ProjectStore` remoto (Cloud Sync) es una tercera implementación del mismo contrato — sin cambios en `workspace.ts`/`shell.ts`.
- Una app shell cross-módulo (v2.0, con un segundo módulo real) reutiliza `packages/project-library` sin cambios — el paquete nunca conoció cómo se monta una UI ni en qué app vive.
