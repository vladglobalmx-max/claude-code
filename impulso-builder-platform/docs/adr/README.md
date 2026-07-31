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
| [0016](0016-assisted-placement.md) | Epic 7 / Fase 7.3 | Assisted Placement: Smart Guides, Snapping (página/objects/grid) puro en `@impulso/engine`, Grid persistente por Page, Rulers, indicador de puntero |
| [0017](0017-professional-multi-selection.md) | Epic 7 / Fase 7.4 | Professional Multi Selection: caja envolvente + handles compartidos para 2+ objects, matemática grupal pura (`groupTransform.ts`), reenvío de drag vía `Konva.Node.startDrag()`, política de objects bloqueados, cancelación externa de un gesto activo |
| [0018](0018-interactive-margin-rotate-handle.md) | Epic 7 / Fase 7.4 | Handle de rotación cerca del borde del Stage: recorte dinámico (`clampPointToStageBounds`) en vez de agrandar el Stage — corrige el bug de severidad alta detectado en Fase 7.3.5 |
| [0019](0019-autosave-save-coordinator.md) | Epic 8 | Autosave & Save Coordinator: `ProjectSaveCoordinator` en `packages/project-library`, dirty-state derivado de `projectChanged`, indicador de estado, salida segura del editor, `beforeunload` |
| [0020](0020-project-recovery.md) | Epic 8 | Project Recovery: snapshot ligero por proyecto (nunca un historial), debounce independiente y más corto que el autosave principal, banner de recuperación en la Workspace |
| [0021](0021-print-engine-foundation.md) | Epic 9 / Fase 9.1 | Print Engine Foundation: modelo real de coordenadas verificado (px canónico vs. unidad física de página vs. PPI de impresión), `packages/print-engine`, `PrintJob` efímero y versionado, boxes físicas (TrimBox/BleedBox/MediaBox/CropBox), Preflight estructural, ausencia de clipping en el Renderer confirmada para el sangrado de Fase 9.2 |
| [0022](0022-print-engine-raster-pipeline.md) | Epic 9 / Fase 9.2 | Print Engine — Raster Pipeline & PDF Backend: `renderPrintJob`/`renderPrintPage` (generador asíncrono, nunca N páginas en memoria a la vez), `PdfBackend` con `pdf-lib` completamente aislado, PNG físico y PDF aplanado de alta resolución, `contentScale`/`shouldRenderObject`/`canvasSizePx` aditivos en `renderer-konva`, verificación en Chromium real (12 escenarios, sin mocks) |
| [0023](0023-print-engine-marks-safearea-cutpaths.md) | Epic 9 / Fase 9.3 | Print Engine — Crop Marks, Safe Area & Cut Paths: marcas de corte vectoriales reales (PDF/PNG), `MediaBox` expandido para el espacio de marcas, Safe Area como ayuda de preview verificada byte-idéntica al archivo final, `CutGeometry` uniforme (Rectangle/Ellipse/ClosedPath) con composición afín de grupos/rotación/escala y offset honesto por tipo, kiss-cut/die-cut V1 semántico (sin OCG ni hardware real), 15 códigos nuevos de Preflight, preview técnico mínimo reutilizando la misma geometría pura, verificación en Chromium real (15 escenarios nuevos + 4 del preview) |
| [0024](0024-print-engine-imposition.md) | Epic 9 / Fase 9.4 | Print Engine — Imposition & Sheet Repetition: `ImpositionSpec` discriminated union (`single`/`grid`), geometría pura de grid (footprint/capacidad/alineación/hoja), reutilización real de raster a escala (una pieza rasterizada/embebida una sola vez, dibujada N veces), `exportImpositionToPdf`/`exportImpositionToPng`, marcas `per-piece`/`per-sheet`, cut path normalizado una vez por página y trasladado por copia, 16 códigos nuevos de Preflight de imposición, límites de producto (200 hojas/2000 piezas) verificados con evidencia de performance real |
| [0025](0025-production-export-workflow.md) | Epic 9 / Fase 9.4 | Sticker Builder — Production Export Workflow: wizard real de 7 pasos (perfil/configuración/preview/preflight/advertencias/progreso/resultados), `ProductionExportController` (foto inmutable de Project/PrintJob, invalidación de Preflight, aceptación de advertencias por ejecución, cancelación real), Production Preview data-driven (nunca un demo fijo) reutilizando la geometría pura de imposición, foco atrapado y accesibilidad verificados en Chromium real, bug real de reseteo de paso encontrado y corregido mediante E2E |

### Archivados (consolidación documental 2026-07-31)

Los siguientes 4 ADRs documentaban la capa comercial de Sticker Builder como producto independiente — el problema que resuelven ya no existe en esa forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conservan íntegros como registro histórico, reubicados en [`docs/archive/adr-commercial/`](../archive/adr-commercial):

| ADR | Foundation | Título |
|---|---|---|
| [0026](../archive/adr-commercial/0026-commercial-platform-boundaries.md) | Fase 4.1 | Commercial Platform Boundaries: vocabulario Module/Feature/Commercial Product/Entitlement/License/Channel, arquitectura de 11 capas con dependencia unidireccional (el dominio creativo nunca depende de la capa comercial), `@impulso/commercial-schema` como único paquete nuevo (contrato de datos puro, sin lógica ni proveedor) |
| [0027](../archive/adr-commercial/0027-product-manifest.md) | Fase 4.1 | Commercial Product Manifest: formato versionado `commercial-product.json`, validación Zod con fallback seguro, `licensingMode` como enum abierto, decisión deliberada de no fijar todavía la mecánica de entrega del archivo real |
| [0028](../archive/adr-commercial/0028-entitlements-and-licensing.md) | Fase 4.1 | Entitlements & Licensing V1: `licensingMode: "delivery-only"` (Gumroad gatea la entrega, la app no valida nada técnicamente) como la única opción compatible con "sin backend, sin DRM agresivo, sin bloquear compradores legítimos"; modelo de `Entitlement` diseñado como contrato para Fase 4.3, sin emisor/consumidor real todavía |
| [0029](../archive/adr-commercial/0029-distribution-strategy.md) | Fase 4.1 | Distribution Strategy: Gumroad como canal de checkout/entrega inicial, Bookfluence como storefront/marketing (nunca el motor interno de los Builders), interfaz `CommerceAdapter` neutral de proveedor, separación dura marketing/commerce/identity/application runtime |
