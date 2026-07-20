# Changelog — @impulso/project-library

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.2.0] — Epic 8: Autosave, Recovery & Project Safety

### Agregado
- `ProjectSaveCoordinator` (`createProjectSaveCoordinator`, `saveCoordinator.ts`): coordina autosave (debounce configurable, default 1200ms) y guardado manual detrás de una sola pieza testeable — single-flight (nunca dos `persist()` en vuelo), coalesce cambios durante un guardado en curso, estados `"clean" | "dirty" | "saving" | "error" | "recovered"`, mensajes de error traducidos a lenguaje de usuario (incluye `QuotaExceededError`). 27 tests con temporizadores falsos.
- Recovery ligero: `ProjectRecoveryEntry`, y en `ProjectStore` — `saveRecovery(project, savedAt)`/`getRecovery(id)`/`clearRecovery(id)`/`listRecoveries()`. Una única entrada por proyecto (nunca un historial), en un tercer object store (`projectRecovery`) de la misma base de datos IndexedDB. `delete()`/`clear()` también limpian recoveries asociadas. `ProjectSaveCoordinator` puede escribir el recovery con su propio debounce, independiente y más corto que el del guardado principal (`persistRecovery`/`recoveryDebounceMs`, default 400ms).
- 8 nuevos casos en el contrato compartido (`projectStore.contract.ts`), corridos contra ambas implementaciones.
- Ver [ADR-0019](../../docs/adr/0019-autosave-save-coordinator.md) (Autosave & Save Coordinator) y [ADR-0020](../../docs/adr/0020-project-recovery.md) (Project Recovery).

### Cambiado
- `indexedDbProjectStore.ts`: `DATABASE_VERSION` de 1 a 2 (agrega el object store `projectRecovery`); `onUpgrade` ahora es idempotente (`objectStoreNames.contains()` antes de cada `createObjectStore`) — seguro para bases de datos reales preexistentes, dado que IndexedDB dispara `onupgradeneeded` para cualquier incremento de versión.

## [0.1.0] — Epic 5: Project Library / Workspace

### Agregado
- Paquete nuevo. `ProjectStore` (`listDescriptors`/`getDescriptor`/`getProject`/`save`/`delete`/`clear`), dos implementaciones contract-tested (`createMemoryProjectStore`/`createIndexedDbProjectStore`, esta última sobre `@impulso/storage-kit`). `duplicateProject` (clona con ids frescos vía `cloneProjectWithNewIds` del Engine, agrega " (copia)" al nombre, conserva el thumbnail).
- Depende de `@impulso/document-schema` + `@impulso/engine` + `@impulso/storage-kit` — nunca de `@impulso/export-engine`.
- 36 tests, 100%/100%/100%/100% de cobertura. Sin dependencias circulares (verificado con `madge`).
- Ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md) para el razonamiento de diseño completo.
