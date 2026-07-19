# Changelog — @impulso/project-library

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Epic 5: Project Library / Workspace

### Agregado
- Paquete nuevo. `ProjectStore` (`listDescriptors`/`getDescriptor`/`getProject`/`save`/`delete`/`clear`), dos implementaciones contract-tested (`createMemoryProjectStore`/`createIndexedDbProjectStore`, esta última sobre `@impulso/storage-kit`). `duplicateProject` (clona con ids frescos vía `cloneProjectWithNewIds` del Engine, agrega " (copia)" al nombre, conserva el thumbnail).
- Depende de `@impulso/document-schema` + `@impulso/engine` + `@impulso/storage-kit` — nunca de `@impulso/export-engine`.
- 36 tests, 100%/100%/100%/100% de cobertura. Sin dependencias circulares (verificado con `madge`).
- Ver [ADR-0014](../../docs/adr/0014-project-library-workspace.md) para el razonamiento de diseño completo.
