# @impulso/project-library

> Project Library oficial de Impulso Platform, nacida en la épica Project Library / Workspace (Epic 5, Sticker Builder). Administra múltiples proyectos guardados — la base de la pantalla "Mis proyectos" (Workspace) — reutilizable por cualquier módulo. Ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md).

**Estado:** primera versión (v1).

---

## 1. Qué es y qué no es

- **Sí hace:** guarda/lista/abre/elimina/duplica proyectos (`Project` completo, `@impulso/document-schema`, sin cambios) con un descriptor liviano por proyecto para listar la Workspace sin cargar cada documento completo.
- **No hace:** no genera miniaturas (recibe el `Blob` ya generado — nunca depende de `@impulso/export-engine` ni de Konva), no sabe qué es "abrir un proyecto en el editor" (eso es responsabilidad de la app), no ofrece autosave, búsqueda, carpetas ni papelera de reciclaje (deuda deliberada, ver ADR-0014).

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
    ├── types.ts                          # ProjectDescriptor / ProjectStore
    ├── deriveDescriptor.ts               # deriva un ProjectDescriptor de un Project
    ├── duplicateProject.ts               # duplicateProject — clona + guarda como entrada nueva (usa cloneProjectWithNewIds del Engine)
    └── stores/
        ├── indexedDbProjectStore.ts      # createIndexedDbProjectStore — sobre @impulso/storage-kit
        ├── memoryProjectStore.ts         # createMemoryProjectStore — para tests
        └── projectStore.contract.ts      # suite de tests compartida

    (36 tests, 100%/100%/100%/100% de cobertura)
```

## 4. Decisiones clave (ver ADR-0014 para el detalle completo)

### 4.1 `duplicateProject` es una función, no un método de `ProjectStore`
Compone `getProject`/`getDescriptor`/`save` — funciona igual sobre cualquier implementación sin duplicar lógica de clonado en cada adaptador (mismo patrón que `instantiateTemplate` en Template Library, que tampoco es un método de `TemplateStore`).

### 4.2 Depende de `@impulso/storage-kit`, no reimplementa IndexedDB
El andamiaje de apertura/transacciones es compartido con Asset Library y Template Library — ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md) para por qué se extrajo recién con este tercer consumidor real.

### 4.3 Nunca depende de `@impulso/export-engine`
El thumbnail es un `Blob` opaco — la app lo genera (reutilizando el mismo `createThumbnailGenerator` ya construido en Epic 4) y se lo pasa a `save()`.

## 5. Desarrollo

```bash
pnpm --filter @impulso/project-library build
pnpm --filter @impulso/project-library test
pnpm --filter @impulso/project-library typecheck
```

## 6. Riesgos y limitaciones conocidas

- **Sin deduplicación de binarios de Asset** al duplicar un proyecto con imágenes (mismo riesgo aceptado ya en Template Library).
- **Sin manejo de cuota de IndexedDB agotada.**
- **Sin autosave** — v1 mantiene guardado explícito.

## 7. Mejoras futuras

- Un `ProjectStore` remoto (Cloud Sync) — el contrato ya lo permite sin rediseño.
- Búsqueda/carpetas/colecciones si el catálogo de proyectos por usuario crece.
