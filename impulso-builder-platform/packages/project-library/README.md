# @impulso/project-library

> Project Library oficial de Impulso Platform, nacida en la épica Project Library / Workspace (Epic 5, Sticker Builder). Administra múltiples proyectos guardados — la base de la pantalla "Mis proyectos" (Workspace) — reutilizable por cualquier módulo. Ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md). Epic 8 (Autosave, Recovery & Project Safety) agregó `ProjectSaveCoordinator` y el recovery ligero — ver [ADR-0019](../../docs/adr/0019-autosave-save-coordinator.md) y [ADR-0020](../../docs/adr/0020-project-recovery.md).

**Estado:** v2 (Autosave & Recovery).

---

## 1. Qué es y qué no es

- **Sí hace:** guarda/lista/abre/elimina/duplica proyectos (`Project` completo, `@impulso/document-schema`, sin cambios) con un descriptor liviano por proyecto para listar la Workspace sin cargar cada documento completo; coordina autosave + guardado manual sin races (`ProjectSaveCoordinator`); guarda/recupera un snapshot de recovery ligero por proyecto.
- **No hace:** no genera miniaturas (recibe el `Blob` ya generado — nunca depende de `@impulso/export-engine` ni de Konva), no sabe qué es "abrir un proyecto en el editor" ni cómo mostrar diálogos/indicadores (eso es responsabilidad de la app), no ofrece búsqueda, carpetas, papelera de reciclaje, ni un historial de versiones (deuda deliberada, ver ADR-0014/ADR-0020).

## 2. Por qué un Project ya es su propio descriptor

A diferencia de `TemplateDescriptor` (que necesita metadatos de catálogo ajenos al `Project`, como `builtIn`), un `Project` ya trae `id`, `moduleId` y `metadata.name/createdAt/updatedAt` — suficiente para listar la Workspace. `ProjectDescriptor` se deriva SIEMPRE del propio `Project` (`deriveDescriptor.ts`); la única pieza externa es el thumbnail (`Blob` opaco).

`save(project, thumbnail?)` conserva el thumbnail ya guardado si no se provee uno nuevo — renombrar un proyecto no debe borrar su miniatura.

## 3. Árbol

```
packages/project-library/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                          # API pública
    ├── types.ts                          # ProjectDescriptor / ProjectStore / ProjectRecoveryEntry
    ├── deriveDescriptor.ts               # deriva un ProjectDescriptor de un Project
    ├── duplicateProject.ts               # duplicateProject — clona + guarda como entrada nueva (usa cloneProjectWithNewIds del Engine)
    ├── saveCoordinator.ts                # createProjectSaveCoordinator — Epic 8, ver ADR-0019
    └── stores/
        ├── indexedDbProjectStore.ts      # createIndexedDbProjectStore — sobre @impulso/storage-kit (3 object stores desde Epic 8)
        ├── memoryProjectStore.ts         # createMemoryProjectStore — para tests
        └── projectStore.contract.ts      # suite de tests compartida

    (99 tests: 72 de stores/contrato + 27 de saveCoordinator)
```

## 4. Decisiones clave (ver ADR-0014 para el detalle completo)

### 4.1 `duplicateProject` es una función, no un método de `ProjectStore`
Compone `getProject`/`getDescriptor`/`save` — funciona igual sobre cualquier implementación sin duplicar lógica de clonado en cada adaptador (mismo patrón que `instantiateTemplate` en Template Library, que tampoco es un método de `TemplateStore`).

### 4.2 Depende de `@impulso/storage-kit`, no reimplementa IndexedDB
El andamiaje de apertura/transacciones es compartido con Asset Library y Template Library — ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md) para por qué se extrajo recién con este tercer consumidor real.

### 4.3 Nunca depende de `@impulso/export-engine`
El thumbnail es un `Blob` opaco — la app lo genera (reutilizando el mismo `createThumbnailGenerator` ya construido en Epic 4) y se lo pasa a `save()`.

### 4.4 `ProjectSaveCoordinator` (Epic 8 — ver ADR-0019)
`createProjectSaveCoordinator({ persist, getProject, debounceMs?, persistRecovery?, recoveryDebounceMs?, clock?, initialStatus? })` coordina TODA escritura de un `Project` (autosave con debounce + guardado manual) detrás de una sola pieza testeable — nunca sabe qué es `ProjectStore` ni IndexedDB directamente (`persist`/`persistRecovery` son funciones inyectadas por quien lo usa). Expone `notifyChange()` (llamar en cada cambio de contenido real, ej. `projectChanged` del Engine), `flush()` (guardado inmediato, absorbe el debounce, espera cualquier guardado en curso), `getState()`/`subscribe()` (`"clean" | "dirty" | "saving" | "error" | "recovered"`), `markRecovered()` y `destroy()`.

### 4.5 Recovery ligero, no un historial (Epic 8 — ver ADR-0020)
`saveRecovery(project, savedAt)`/`getRecovery(id)`/`clearRecovery(id)`/`listRecoveries()` — una única entrada por `projectId`, siempre sobreescrita, nunca una lista creciente. Vive en un tercer object store de la MISMA base de datos (`projectRecovery`) — no una base de datos ni un paquete separados. Solo un guardado principal exitoso limpia el recovery; el propio `ProjectSaveCoordinator` puede escribirlo con un debounce independiente y más corto (`persistRecovery`/`recoveryDebounceMs`) que el del guardado principal.

## 5. Desarrollo

```bash
pnpm --filter @impulso/project-library build
pnpm --filter @impulso/project-library test
pnpm --filter @impulso/project-library typecheck
```

## 6. Riesgos y limitaciones conocidas

- **Sin deduplicación de binarios de Asset** al duplicar un proyecto con imágenes (mismo riesgo aceptado ya en Template Library).
- **Cuota de IndexedDB agotada** ya se detecta y traduce a un mensaje accionable (`ProjectSaveCoordinator`), pero no hay ninguna forma de liberar espacio desde la propia app más allá de "exporta como respaldo".
- ~~Sin autosave~~ — resuelto en Epic 8 (ver ADR-0019).
- **Sin historial de versiones** — el recovery es deliberadamente una única entrada por proyecto, no un historial (ver ADR-0020).

## 7. Mejoras futuras

- Un `ProjectStore` remoto (Cloud Sync) — el contrato ya lo permite sin rediseño.
- Búsqueda/carpetas/colecciones si el catálogo de proyectos por usuario crece.
- Un historial de versiones real, si algún día se decide construirlo — el recovery de Epic 8 fue diseñado explícitamente para NO ser ese sistema.
