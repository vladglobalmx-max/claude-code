# ADR-0020 — Project Recovery

## Problema
ADR-0019 resuelve "el trabajo confirmado se guarda solo automáticamente" — pero deja una ventana real: el guardado principal corre detrás de un debounce de 1200ms. Un cierre inesperado (crash, cerrar la pestaña, recargar) segundos después de una edición podría perderla igual, aunque el autosave "ya estuviera funcionando". Esta épica exige una capa de recovery ligera — explícitamente **no** un sistema de versiones completo — para cubrir exactamente ese hueco, y para un caso más extremo: un Project que todavía no existe en el store en absoluto (nuevo, o creado desde un Template).

## Contexto
- El enunciado de producto es explícito sobre los límites: "diseñar un snapshot o journal de recovery ligero", "nunca debe convertirse en un sistema de versiones completo", "nunca acumular snapshots indefinidamente", "sin múltiples versiones históricas".
- `packages/project-library` ya tenía una única base de datos IndexedDB con dos object stores (`projectDescriptors`/`projectContent`, ADR-0014) sobre el andamiaje genérico de `packages/storage-kit`.
- IndexedDB dispara `onupgradeneeded` para **cualquier** incremento de `version`, no solo para una base de datos nueva — relevante porque esta épica sube la versión de una base de datos que ya existe en instalaciones reales.

## Alternativas evaluadas

### ¿Dónde vive el recovery?
- **A. Un tercer object store (`projectRecovery`) en la MISMA base de datos de `project-library`** (elegida): reutiliza la conexión ya abierta, cero infraestructura nueva. Cumple la preferencia arquitectónica explícita del usuario: `storage-kit` mantiene primitivas genéricas, `project-library` mantiene conceptos de persistencia de Project, y no se contamina `document-schema` con nada de storage.
- **B. Una base de datos IndexedDB separada**: descartada — dos conexiones para el mismo dominio (Project) sin ninguna ventaja real, solo complejidad de coordinación.
- **C. Un paquete nuevo (`packages/recovery-kit` o similar)**: descartada — no hay evidencia de un segundo consumidor (otro Builder) que lo necesite todavía; el contrato (`ProjectStore.saveRecovery/getRecovery/clearRecovery/listRecoveries`) es suficientemente genérico como para que un Builder futuro lo reutilice sin fricción cuando llegue ese segundo consumidor, sin haber construido nada especulativo hoy.

### ¿Una entrada por Project o un historial?
Una sola entrada por `projectId` (`ProjectRecoveryEntry { projectId, project, savedAt }`), siempre sobreescrita — nunca una lista creciente. `saveRecovery()` sobre el mismo id reemplaza la entrada anterior (probado en el contrato compartido memoria/IndexedDB). Esto es, deliberadamente, lo que impide que esto se convierta en un sistema de versiones.

### ¿Con qué cadencia se escribe el recovery?
- **A. Debounce propio, independiente y más corto que el del guardado principal (400ms vs. 1200ms)** (elegida, en `ProjectSaveCoordinator`): sin thumbnail, sin pasar por `persist` — mucho más barato que el guardado principal, así que puede correr más seguido sin su costo. Resuelve exactamente el hueco descrito en el Problema: a los ~400ms de una edición ya existe un recovery, mucho antes de que el guardado principal (~1200ms) siquiera empiece.
- **B. Recovery en el mismo ciclo que el guardado principal** (implementación inicial, descartada tras verificación E2E): dejaba la ventana completa de 1200ms sin ninguna red de seguridad — se detectó como hueco real al diseñar el spec E2E de "recargar antes del autosave principal", no como error reportado por el usuario.
- **C. Escribir en cada `notifyChange()` sin ningún debounce**: descartada — una ráfaga rápida (tipeo, nudge repetido) generaría una escritura de IndexedDB por cada cambio; el debounce corto sigue coalesciendo una ráfaga en una sola escritura (probado explícitamente: "una ráfaga de cambios rápidos consolida el recovery en una sola escritura").

### ¿Quién limpia el recovery?
Únicamente un guardado PRINCIPAL exitoso (`persistProject`, después de `projectStore.save`) — el camino rápido de recovery nunca limpia nada, es puramente aditivo. `flush()` (Guardar manual, o el flush al salir del editor) cancela cualquier escritura de recovery rápida todavía pendiente antes de forzar el guardado principal — sin esto, una escritura de recovery tardía podría "resucitar" una entrada justo después de un guardado exitoso, mostrando un banner de recuperación falso la próxima vez que se abriera la Workspace (encontrado y corregido durante la verificación E2E de esta épica).

### ¿Cómo se detecta y ofrece la recuperación?
- **A. La Workspace (`workspace.ts`) revisa `listRecoveries()` en cada `refresh()` y muestra un banner dismissible por entrada** (elegida): compara `recovery.savedAt` contra `descriptor.updatedAt` (si existe) — si el recovery es más reciente, ofrece "Recuperar cambios" (abre el editor con el contenido recuperado, `isNew: true` para que su propio `ProjectSaveCoordinator` lo autosalve pronto) y, solo si existe una versión realmente guardada, "Abrir versión guardada" (descarta el recovery, abre lo persistido). "Descartar" limpia el recovery sin abrir nada. Un recovery ya obsoleto (más viejo que el último guardado real) se limpia en silencio, sin molestar al usuario.
- **B. Recuperar/descartar automáticamente sin preguntar**: descartada explícitamente por el enunciado de producto ("nunca sobreescribir automáticamente sin informar, salvo justificación de UX muy fuerte" — no se encontró esa justificación).
- **C. Mostrar el banner dentro del editor en vez de en la Workspace**: descartada — la detección debe ocurrir ANTES de decidir qué Project abrir, que es exactamente el momento en que el usuario está en la Workspace.

## Decisión tomada

### `packages/project-library`
- `ProjectRecoveryEntry { projectId, project, savedAt }`, agregado a `ProjectStore`: `saveRecovery(project, savedAt)`, `getRecovery(id)`, `clearRecovery(id)`, `listRecoveries()`.
- `indexedDbProjectStore.ts`: tercer object store `projectRecovery`, `DATABASE_VERSION` subido a 2, `onUpgrade` idempotente (`objectStoreNames.contains()` antes de cada `createObjectStore`) — seguro para bases de datos reales preexistentes.
- `delete(id)` también borra el recovery asociado; `clear()` también vacía las recoveries — un Project eliminado nunca deja una entrada de recovery "resucitable".
- Contrato compartido (`projectStore.contract.ts`) extendido con 8 casos, corridos contra ambas implementaciones (memoria + IndexedDB).

### `ProjectSaveCoordinator` (ver ADR-0019)
`persistRecovery`/`recoveryDebounceMs` (default 400ms) opcionales — si se omiten, el coordinator no escribe ningún recovery propio (compatibilidad con consumidores que no lo necesiten).

### `apps/sticker-builder/src/workspace.ts`
Banner de recovery (`.workspace-recovery-banner`) construido en `refreshRecoveryBanner()`, llamado desde `refresh()`. `refresh()` se protegió con una guarda de "único vuelo" (`refreshInFlight`) tras encontrarse, durante la verificación E2E de esta épica, que dos llamadas concurrentes (`mountWorkspace` + `shell.ts`) duplicaban filas del banner.

## Consecuencias
- Un cierre inesperado nunca pierde más de ~400ms de edición real (el intervalo del recovery rápido), muy por debajo del ~1200ms del guardado principal.
- Un Project nuevo sin persistir todavía es recuperable desde el primer instante (arranca `"dirty"`, que programa su primer recovery de inmediato).
- El recovery nunca crece indefinidamente ni se convierte en un historial — una sola entrada por Project, siempre sobreescrita, siempre limpiada por el siguiente guardado real exitoso.

## Riesgos
- El recovery es tan grande como el `Project` completo (igual que el contenido principal) — mismo costo de almacenamiento que duplicar el Project mientras hay cambios pendientes; aceptable dado que siempre hay como máximo una entrada por Project.
- Sin garantía de que el recovery rápido (400ms) alcance a escribirse antes de un crash catastrófico instantáneo (ej. corte de energía a los 100ms de una edición) — reducido drásticamente respecto al guardado principal, pero no eliminado; ningún mecanismo puramente en el navegador puede eliminarlo del todo.

## Compatibilidad futura
El contrato de recovery vive en `ProjectStore` (no en `apps/sticker-builder`) — un Builder futuro lo obtiene automáticamente al construir su propio `ProjectSaveCoordinator` con `persistRecovery`, sin escribir su propia versión.
