# Changelog — @impulso/template-library

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Epic 4: Templates Foundation

### Agregado
- Paquete nuevo. `TemplateStore` (interfaz), `createIndexedDbTemplateStore`/`createMemoryTemplateStore` (contract-tested), `instantiateTemplate` (envoltorio sobre `cloneProjectWithNewIds` de `@impulso/engine`).
- Depende únicamente de `@impulso/document-schema` + `@impulso/engine` — nunca de `@impulso/export-engine` ni de Konva.
- 28 tests, 100%/100%/92.59%/100% de cobertura. Sin dependencias circulares (verificado con `madge`).
- Ver [ADR-0013](../../docs/adr/0013-templates-foundation.md) para el razonamiento de diseño completo.
