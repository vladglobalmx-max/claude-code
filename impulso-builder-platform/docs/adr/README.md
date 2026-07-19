# Architecture Decision Records — Impulso Builder Platform

Regla permanente desde Foundation 3: **cada Foundation incluye un ADR**. Un ADR no es un resumen de lo que se construyó — es el registro de *por qué* se decidió así y no de otra forma, para que una decisión no tenga que redescubrirse (o revertirse por accidente) más adelante.

## Plantilla

Cada ADR responde, en este orden:

1. **Problema** — qué pregunta concreta había que responder.
2. **Contexto** — qué restricciones/decisiones previas condicionan la respuesta.
3. **Alternativas evaluadas** — qué otras opciones se consideraron y por qué no se eligieron.
4. **Decisión tomada** — qué se decidió, sin ambigüedad.
5. **Consecuencias** — qué implica esta decisión para el código y para Foundations futuras.
6. **Riesgos** — qué podría salir mal o qué deuda se acepta a propósito.
7. **Compatibilidad futura** — qué mantiene esta decisión abierto, y qué cerraría.

Cuando la decisión tiene impacto de rendimiento (regla del Performance Budget, también desde Foundation 3), el ADR incluye además una sección **Rendimiento** con: complejidad aproximada, cuellos de botella posibles, y estrategia de optimización futura (sin implementarla prematuramente). Ver [`../PERFORMANCE_BUDGET.md`](../PERFORMANCE_BUDGET.md) para el registro consolidado entre Foundations.

## Índice

| ADR | Foundation | Título |
|---|---|---|
| [0001](0001-impulso-engine-architecture.md) | 0 | Impulso Engine: Document Schema → Engine → Renderer → Konva |
| [0002](0002-document-schema.md) | 1 | Document Schema como contrato de datos renderer-agnóstico |
| [0003](0003-engine-core.md) | 2 | Engine Core: estado, comandos y eventos |
| [0004](0004-renderer-adapter.md) | 3 | Renderer Adapter: primer adaptador Konva |
| [0005](0005-canvas-runtime.md) | Editor 1 | Canvas Runtime: primera integración end-to-end |
| [0006](0006-selection-system.md) | Editor 2 | Selection System: click, Shift-click, deselección |
| [0007](0007-transform-system.md) | Editor 3 | Transform System: mover objetos con el puntero |
| [0008](0008-manipulation-system.md) | Editor Epic 1 | Manipulation System: resize, rotación, bounding box, handles |
| [0009](0009-local-persistence-alpha.md) | Milestone 1 | Local Persistence: guardar/abrir un documento (Impulso Alpha) |
| [0010](0010-sticker-creation-experience.md) | Epic 1 | Sticker Creation Experience: agrupar, imágenes sin Asset Library, edición de texto in-canvas, zoom |
| [0011](0011-asset-library.md) | Epic 2 | Asset Library: unión extensible de tipos de Asset, IndexedDB, migración desde el formato embebido de Epic 1 |
| [0012](0012-export-engine.md) | Epic 3 | Export Engine Foundation: SVG independiente de Konva, PNG vía Stage headless de `@impulso/renderer-konva` |
| [0013](0013-templates-foundation.md) | Epic 4 | Templates Foundation: Template = `Project` + metadatos de catálogo, `packages/template-library`, unificación de `STICKER_SIZE_PRESETS` en Templates built-in |
| [0014](0014-project-library-workspace.md) | Epic 5 | Project Library / Workspace: `packages/project-library`, `packages/storage-kit`, app Workspace-first, migración desde el slot único legado |
| [0015](0015-batch-dispatch-alignment.md) | Epic 7 / Fase 7.2 | Batch Dispatch + Alignment Engine: `dispatchBatch` atómico en `@impulso/engine`, bounding boxes rotados puros, Alignment/Distribution para selección múltiple |
