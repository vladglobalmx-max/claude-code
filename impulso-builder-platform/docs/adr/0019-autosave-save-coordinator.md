# ADR-0019 — Autosave & Save Coordinator

## Problema
Desde ADR-0014, Impulso administra proyectos completos (Workspace, IndexedDB) — pero el guardado sigue siendo enteramente manual (clic en "Guardar" o Ctrl/Cmd+S). ADR-0014 lo señaló explícitamente como riesgo aceptado ("Sin autosave — deliberado, fuera de alcance de v1") y como cuello de botella latente en `docs/PERFORMANCE_BUDGET.md` (fila 16: "relevante si en el futuro se implementa autosave"). Con Professional Multi Selection (Fase 7.4) cerrada, los proyectos que Impulso permite construir ya son lo bastante complejos como para que una pérdida silenciosa de cambios (cerrar la pestaña, navegar a "Mis proyectos", un crash) sea inaceptable. Epic 8 construye un sistema completo y honesto de seguridad del proyecto: no solo "guardar automáticamente", sino distinguir en todo momento entre estado en memoria, último guardado exitoso, guardado en progreso, guardado fallido y recuperación pendiente — y comunicarlo con precisión.

## Contexto
- El Engine (`@impulso/engine`) ya emite `projectChanged` de forma uniforme para `dispatch`, `dispatchBatch`, `undo` y `redo` (Fase 7.2) — y NUNCA para `selectionChanged` ni para ningún preview efímero (Smart Guides, resize/rotate en vivo, indicador de puntero, zoom/pan): ninguno de estos pasa por `dispatch` hasta que el gesto se confirma. Esto significa que el dirty-state puede derivarse suscribiéndose únicamente a `projectChanged`, sin ningún cambio en el Engine.
- `document.documentVersion` existe pero puede **bajar** después de un `undo` (restaura un snapshot completo con la versión que tenía) — inutilizable como comparador de "¿esto es más nuevo que lo último persistido?".
- `app.ts` ya tenía un patrón "destruir y remontar" (`remount()`, ADR-0009/ADR-0010) para reemplazar el `Project` activo — reutilizado sin cambios para decidir cuándo el `ProjectSaveCoordinator` debe reiniciarse.
- Ningún diálogo existente en la app (`exportDialog.ts`, `saveAsTemplateDialog.ts`, `newProjectDialog.ts`) implementa foco atrapado — esta épica lo exige explícitamente para el diálogo de salida con cambios sin guardar (única excepción deliberada).

## Principio fundamental (gobierna todo el diseño)
Nunca mostrar "Guardado" antes de que la persistencia haya terminado con éxito. Nunca descartar cambios en silencio. Nunca limpiar el dirty-state después de un intento fallido. Todo el diseño de abajo es una consecuencia directa de esto.

## Decisiones confirmadas con el usuario
El enunciado de producto de esta épica llegó con 22 secciones explícitas (modelo de dirty-state, estrategia de autosave/recovery, contrato de persistencia, manejo de errores, criterios de aceptación, riesgos) — la Revisión Previa (Architecture + UX Review) se entregó y aprobó antes de escribir código, autorizando implementar sin una segunda ronda salvo decisiones fuera del alcance aprobado (ninguna surgió).

## Alternativas evaluadas

### ¿Qué comparador de revisión usar para "¿hay algo sin persistir?"
- **A. Contador de sesión monotónico (`revision`), incrementado una vez por cada `notifyChange()`** (elegida): nunca ambiguo, nunca baja. Se compara contra `persistedRevision` (la revisión que el último `persist()` exitoso confirmó).
- **B. `document.documentVersion`**: descartada — puede bajar tras un `undo`, lo que rompería la comparación "¿la revisión actual es más nueva que la persistida?" exactamente en el caso de uso que la sección 14 del enunciado pide probar explícitamente (autosave debe re-guardar el estado post-Undo).
- **C. Hash/serialización completa del `Project` en cada cambio**: descartada — el enunciado prohíbe explícitamente "serializar/hashear en cada pointermove"; un contador entero es O(1) y suficiente porque el disparador (`notifyChange()`) ya solo ocurre en cambios reales.

### ¿Dónde vive la pieza que coordina el guardado?
- **A. `ProjectSaveCoordinator`, un módulo explícito y testeable en `packages/project-library`** (elegida): observa revisiones, programa el autosave, serializa operaciones (un solo `persist()` en vuelo), expone estado, ejecuta flush, maneja errores, cancela timers, libera listeners — todo en un solo lugar, testeado con temporizadores falsos sin depender de IndexedDB real.
- **B. Distribuido en listeners ad hoc dentro de `app.ts`**: descartada explícitamente por el enunciado de producto — habría esparcido la lógica de races/debounce/errores entre varios call sites, exactamente el tipo de estado implícito y difícil de testear que esta épica busca evitar.
- **C. Una abstracción genérica de "coordinator" reusable para cualquier tipo de store**: descartada por ahora — solo existe un tipo de `ProjectStore`; generalizar sin un segundo consumidor real habría sido infraestructura especulativa (mismo criterio que ADR-0014 aplicó a `packages/storage-kit` antes de tener 2 consumidores reales).

### ¿Cuánto debounce?
1200ms (dentro del rango de referencia 800-1500ms sugerido) — más cerca de 1500 que de 800 porque el guardado incluye regenerar el thumbnail (más costoso que una escritura desnuda): un debounce demasiado corto arriesgaría disparar guardados más seguido que las pausas genuinas del usuario.

### ¿Cómo evitar que Guardar manual y autosave escriban de forma desordenada?
Un único `startSave()` interno, con single-flight (`inFlightSave`): si ya hay un guardado en curso, tanto `notifyChange()` como `flush()` (Guardar manual) lo respetan — nunca dos invocaciones de `persist()` a la vez. `flush()` además cancela cualquier debounce pendiente y, si el guardado en curso terminó dejando una revisión más nueva pendiente, ejecuta un guardado adicional inmediato en vez de reportar éxito prematuramente.

### ¿Qué estados se muestran en la UI?
`Guardado` / `Cambios sin guardar` / `Guardando…` / `Error al guardar` / `Recuperado` — sin "Sin conexión" (todo es local, inventar ese estado sería deshonesto). El indicador visual (`#save-status`, junto al botón Guardar) se actualiza en cada transición para quien mira la pantalla; un anuncio a lectores de pantalla separado y oculto visualmente (`#save-status-announcer`, `aria-live="polite"`) solo se actualiza al entrar a error/recuperado, o al llegar a "clean" desde un estado sucio — nunca en cada "Guardando…"/"Cambios sin guardar", que ocurren con demasiada frecuencia como para anunciarlos sin generar ruido (sección 19).

### ¿Cómo se sale del editor de forma segura?
`App.requestClose(): Promise<boolean>` intenta `saveCoordinator.flush()`; si falla, abre `unsavedChangesDialog` (foco atrapado, `role="alertdialog"`, Escape resuelve a la opción más segura) ofreciendo Reintentar/Permanecer en el editor/Salir sin guardar — nunca `window.confirm()` (no puede describir el problema ni ofrecer "Reintentar" como acción propia). `shell.ts` llama a `requestClose()` antes de destruir la instancia de `App` tanto al abrir/crear otro Project desde la Workspace como al hacer clic en "Mis proyectos"; si el usuario elige permanecer, la transición se cancela por completo (nunca se llega a mostrar la Workspace). El "Nuevo" interno del editor (que reemplaza el Project vía `remount()`) pasa por el mismo `requestClose()` antes de abrir el diálogo de selección de plantilla.

### ¿Qué hace `beforeunload`?
Última línea de defensa, no el mecanismo principal: `shell.ts` registra un único listener de `window` que solo llama a `event.preventDefault()`/asigna `event.returnValue` si `App.hasUnsavedChanges()` es `true` (cualquier estado que no sea `"clean"`). Nunca intenta flushear nada ahí (una escritura async de IndexedDB no puede garantizarse dentro de `beforeunload`); el texto del diálogo lo decide el navegador, no esta app.

## Decisión tomada

### `packages/project-library/src/saveCoordinator.ts` (nuevo)
`createProjectSaveCoordinator({ persist, getProject, debounceMs?, persistRecovery?, recoveryDebounceMs?, clock?, initialStatus? })` expone `notifyChange()`, `flush()`, `getState()`, `subscribe()`, `markRecovered()`, `destroy()`. `initialStatus: "dirty"` (Project nuevo/desde Template) arranca con una revisión pendiente y programa su primer autosave (y su primer recovery rápido) de inmediato, sin esperar un cambio adicional.

### `apps/sticker-builder/src/app.ts`
- `persistProject(project)`: escribe el recovery (`projectStore.saveRecovery`), genera el thumbnail, llama a `projectStore.save`, y limpia el recovery — en ese orden. Solo el `save` puede propagar su error al coordinator; un fallo escribiendo/limpiando el recovery o generando el thumbnail se registra pero nunca bloquea el guardado principal (sección 15: un fallo del thumbnail no marca todo el Project como sin guardar).
- `subscribeToEngine()` llama a `saveCoordinator.notifyChange()` en cada `projectChanged`.
- `doSave()` es un envoltorio delgado sobre `saveCoordinator.flush()` — mantiene el atajo Ctrl/Cmd+S existente.
- `remount()` destruye el coordinator anterior y crea uno nuevo en `"dirty"` — el Project que llega ahí siempre es distinto (único call site: "Nuevo" del editor).
- `App.requestClose()`/`App.hasUnsavedChanges()` nuevos, expuestos para `shell.ts`.

### `apps/sticker-builder/src/unsavedChangesDialog.ts` (nuevo)
Único diálogo de la app con foco atrapado real (Tab/Shift+Tab cíclico, Escape → "Permanecer", foco inicial en la opción no destructiva, foco restaurado al cerrar) — justificado explícitamente por el enunciado de producto para este caso.

### `apps/sticker-builder/src/shell.ts`
`openEditor()` es ahora async: si hay un editor abierto, espera `currentApp.requestClose()` antes de destruirlo; si devuelve `false`, no navega. Un listener de `beforeunload` cubre el cierre real de pestaña/recarga.

## Consecuencias
- El usuario nunca pierde una edición confirmada (comando/batch/undo/redo) sin al menos un intento visible de guardarla, y nunca ve "Guardado" mientras algo siga pendiente.
- La complejidad de races/debounce/errores queda concentrada en un solo módulo testeado exhaustivamente con temporizadores falsos (27 tests), en vez de esparcida en listeners de `app.ts`.
- El riesgo "Sin autosave" de ADR-0014 queda resuelto; el riesgo "Sin manejo de cuota de IndexedDB agotada" también (ver política de errores más abajo).

## Manejo de errores
`toUserMessage()` traduce `QuotaExceededError` a un mensaje accionable ("Libera espacio o exporta tu proyecto como respaldo") y cualquier otro fallo a un mensaje genérico — nunca el nombre de la excepción ni un stack trace. Un guardado fallido preserva el dirty-state, nunca limpia el mensaje de error hasta el próximo intento, y nunca entra en un loop de reintento automático (el usuario decide cuándo reintentar, vía el botón "Reintentar" del propio indicador o el diálogo de salida).

## Riesgos
- El guardado principal regenera el thumbnail completo en cada ciclo de autosave, no solo en un clic explícito — ver `docs/PERFORMANCE_BUDGET.md` fila 19 (riesgo anticipado desde ADR-0014, ahora medido/documentado, no resuelto con Web Workers sin evidencia real de que haga falta).
- Sin cifrado ni backup fuera del dispositivo — IndexedDB sigue siendo el único almacenamiento (fuera de alcance, ver Recovery, ADR-0020).

## Compatibilidad futura
`ProjectSaveCoordinator` no conoce `ProjectStore` ni IndexedDB directamente (`persist`/`persistRecovery` son funciones inyectadas) — un futuro `ProjectStore` remoto (Cloud Sync) es un `persist` distinto, sin cambios en el coordinator. Cualquier Builder futuro puede reutilizar el mismo mecanismo con su propio `persist`.
