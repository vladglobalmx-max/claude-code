# @impulso/template-library

> Templates oficiales de Impulso Platform, nacido en la épica Templates Foundation (Epic 4, Sticker Builder). Catálogo de plataforma para "cómo empieza un usuario un proyecto nuevo" — genérico sobre cualquier módulo (`moduleId`), reutilizable por Sticker Builder y todo módulo futuro (Planner Builder, Coloring Book Builder, Worksheet Builder, Flashcard Builder, Journal Builder, Mockup Builder...) sin ningún cambio. Ver [ADR-0013](../../docs/adr/0013-templates-foundation.md).

**Estado:** primera versión (v1). Un Template es un `Project` completo (`@impulso/document-schema`, sin cambios) envuelto en metadatos de catálogo.

---

## 1. Qué es y qué no es

- **Sí hace:** almacena/lista descriptores de Template (`TemplateDescriptor`, liviano) y su contenido pesado (`TemplateContent`: el `Project` + una miniatura opaca `Blob`), con una implementación real sobre IndexedDB y una en memoria para tests; provee `instantiateTemplate` — clona el `Project` de un Template con ids frescos, listo para convertirse en un proyecto nuevo.
- **No hace:** no genera miniaturas (recibe el `Blob` ya generado — nunca depende de `@impulso/export-engine` ni de Konva), no decide qué Templates son built-in de cada módulo (eso vive en el código de aplicación de cada módulo), no deduplica binarios de Asset al clonar.

## 2. Árbol

```
packages/template-library/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                          # API pública
    ├── types.ts                          # TemplateId / TemplateDescriptor / TemplateContent / TemplateStore
    ├── instantiateTemplate.ts            # instantiateTemplate — envoltorio sobre cloneProjectWithNewIds (@impulso/engine)
    ├── stores/
    │   ├── indexedDbTemplateStore.ts     # createIndexedDbTemplateStore — adaptador real (IndexedDB nativo, dos object stores)
    │   ├── memoryTemplateStore.ts        # createMemoryTemplateStore — para tests / entornos sin IndexedDB
    │   └── templateStore.contract.ts     # suite de tests compartida entre ambas implementaciones
    └── testUtils/
        └── fixtures.ts                  # buildTemplateProject / buildTemplateDescriptor

    (28 tests, 100%/100%/92.59%/100% de cobertura)
```

## 3. Decisiones clave (ver ADR-0013 para el detalle completo)

### 3.1 Un Template ES un `Project` completo, no un concepto nuevo de Document Schema
`TemplateContent.project` es exactamente el tipo `Project` de `@impulso/document-schema` — cero cambios en ese paquete para esta épica. `TemplateId` es un `string` simple (no un branded type Zod): un Template nunca se deserializa como parte de un `Document`/`Project` persistido, así que no cruza la misma frontera de confianza.

### 3.2 Descriptor liviano / contenido pesado, mismo patrón que Asset Library
`listDescriptors` siempre es barato (para dibujar una galería); `getContent` (el `Project` completo + miniatura) se carga solo bajo demanda.

### 3.3 Depende únicamente de `@impulso/document-schema` + `@impulso/engine` — nunca de Export Engine
La miniatura es un `Blob` opaco. Generarla es responsabilidad exclusiva del código de aplicación que consume este paquete (ver `apps/sticker-builder/src/app.ts`'s `createThumbnailGenerator`).

### 3.4 `instantiateTemplate` reutiliza `cloneProjectWithNewIds` del Engine
Sin duplicar la lógica recursiva de clonado de objects/groups ya existente y probada en `@impulso/engine`.

### 3.5 Dos implementaciones, un mismo contrato de tests
`createIndexedDbTemplateStore` (real, dos object stores: `templateDescriptors`/`templateContent`, transacción única para `save`/`delete`/`clear`) y `createMemoryTemplateStore` pasan la misma suite (`templateStore.contract.ts`).

## 4. Desarrollo

```bash
pnpm --filter @impulso/template-library build
pnpm --filter @impulso/template-library test
pnpm --filter @impulso/template-library typecheck
```

## 5. Riesgos y limitaciones conocidas

- **Sin deduplicación de binarios de Asset** al clonar un Template con imágenes — el proyecto clonado comparte la misma referencia de Asset que el original (`instantiateTemplate` es puro/síncrono, sin acceso a `AssetBinaryStore`).
- **Sin versionado/edición** de un Template ya guardado — solo crear (guardar snapshot nuevo) y eliminar.
- **Sin categorías ni búsqueda** en el catálogo.

## 6. Mejoras futuras

- Deduplicación/reasignación de binarios de Asset al instanciar un Template (requeriría que `instantiateTemplate` acepte un `AssetBinaryStore` opcional y se vuelva async).
- Categorías/etiquetas de búsqueda en la galería, si el catálogo crece.
- Un `TemplateStore` remoto (compartido entre dispositivos/usuarios) — el contrato ya lo permite sin rediseño.
