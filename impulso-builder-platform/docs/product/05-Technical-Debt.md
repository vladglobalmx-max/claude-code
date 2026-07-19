# 05 — Technical Debt (deliberadamente pospuesto)

> Este documento no es una lista de errores ni de trabajo mal hecho. Es un registro deliberado de todo lo que Impulso **decide no construir todavía**, para que la decisión de posponerlo sea explícita y revisitable — no un olvido accidental que alguien redescubre meses después. "Pospuesto" no significa "descartado": cada ítem se incorpora cuando exista una necesidad real, no por anticipación especulativa (ver [`02-Product-Principles.md`](02-Product-Principles.md), "Simplicidad").
>
> **Reorganizado en Epic 6 (Platform Consolidation).** Este documento contiene exclusivamente deuda **técnica/arquitectónica** — código o infraestructura que se decidió no construir todavía. Las capacidades de negocio futuras (cuentas, Cloud Sync, Marketplace, Colaboración, Plugins públicos, IA, Facturación...) se movieron a [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md), cada una con Valor/Prioridad/Dependencias/Complejidad. Las oportunidades de mejora de experiencia de usuario viven en [`UX_BACKLOG.md`](UX_BACKLOG.md). Ver [`../platform/STATE_001.md`](../platform/STATE_001.md) para la auditoría completa que motivó esta reorganización.

---

## 1. Deuda de arquitectura / código (detectada en la auditoría de Epic 6)

Prioridad: **media** — ninguna bloquea nada hoy, pero afectan a un consumidor futuro (un segundo módulo, o cualquiera que integre varios pilares a la vez).

| Ítem | Detalle | Se resuelve cuando... |
|---|---|---|
| **Filosofía de manejo de errores no unificada entre paquetes** | `engine` usa un patrón Result (`dispatch` nunca lanza); `export-engine` lanza una clase `ExportError` propia; `document-schema` deja pasar excepciones de Zod sin envolver; Asset/Template/Project Library son funciones async que rechazan/lanzan sin Result pattern. | Un segundo módulo real evidencie que la inconsistencia genera fricción concreta (no antes — unificar sin ese caso real sería anticipar una necesidad no probada). |
| **`document-schema/src/index.ts` usa `export * from ...`** (superficie implícita) mientras los otros 7 paquetes usan exports nombrados explícitos (superficie deliberada) | Inconsistencia de estilo, no de sustancia — `document-schema` es el paquete más grande y fundacional, revisar/angostar su superficie ahora sería un cambio grande y mecánico sin beneficio funcional inmediato. | Se audite la superficie pública de `document-schema` con un objetivo concreto (ej. antes de considerar publicarlo fuera del monorepo). |
| **Bridge de thumbnails (`createThumbnailGenerator`) no extraído** | Conecta Export Engine con Template/Project Library; vive privado en `apps/sticker-builder/src/app.ts`, reutilizado 3 veces dentro de la misma app. Correcto según el diseño de cada librería (ninguna quiere depender de Export Engine) — pero un segundo módulo lo reimplementaría línea por línea. | Exista un segundo módulo real que necesite exactamente el mismo bridge — momento en el que extraerlo es mecánico. |
| **`ProjectStore`/`TemplateStore` comparten forma pero no una interfaz genérica** (`CatalogStore<TDescriptor, TContent>` evaluado, no implementado) | Los tres dominios (Asset/Template/Project) difieren lo suficiente (Asset = solo binario; Template = descriptor con `builtIn`/`tags`; Project = descriptor derivable del propio contenido) que forzar una interfaz genérica reduciría claridad más de lo que ahorraría código. | Aparezca un cuarto store con exactamente la misma forma — evidencia real de un patrón, no una generalización de dos casos. |

## 2. Pilares de Impulso Platform aún no construidos (ver `03-Architecture-Map.md`)

La estructura conceptual de la plataforma nombra pilares que hoy son solo eso — conceptos, no paquetes con código. El disparador de NEGOCIO para construir cada uno (qué módulo/capacidad los justifica) vive en `PRODUCT_BACKLOG.md`; aquí se registra únicamente el estado técnico actual.

| Pilar | Estado hoy | Prioridad |
|---|---|---|
| **Shared Services** | No existe ningún servicio compartido real — la persistencia local de Sticker Builder es código de aplicación, no un servicio de plataforma. | Baja — depende de un segundo módulo real (ver `PRODUCT_BACKLOG.md`, "Segundo módulo real"). |
| **Design System** | No existe `packages/ui` ni ningún componente compartido — cada pantalla de Sticker Builder usa CSS/DOM ad-hoc. Ya identificado en `docs/platform/STATE_001.md` como el gap concreto de "preparación para múltiples Builders". | Media — sube a Alta en el momento exacto en que arranca un segundo módulo. |
| **AI Engine** | No existe ninguna funcionalidad de IA en la plataforma todavía; el principio "AI Provider Agnostic" ya está declarado de antemano. | Media — ver `PRODUCT_BACKLOG.md`, "AI". |

## 3. Deuda por pilar ya construido

**Asset Library** (Epic 2, `packages/asset-library`) — Deuda restante (ver [ADR-0011](../adr/0011-asset-library.md)): sin deduplicación por contenido, sin compresión al subir, sin gestión de assets entre proyectos distintos, y `font` sigue siendo un tipo declarado en el Document Schema sin ningún flujo real que lo produzca. Prioridad: baja.

**Export Engine** (Epic 3, `packages/export-engine`) — Deuda restante (ver [ADR-0012](../adr/0012-export-engine.md)): sin PDF print-ready/línea de corte/sangrado (ver `PRODUCT_BACKLOG.md` — es una capacidad de negocio, no solo deuda técnica), sin detección de `font_unavailable`, sin deduplicación/compresión de imágenes embebidas, ajuste automático de línea de texto no se reproduce en SVG. Prioridad: media (el PDF es alta prioridad de negocio; el resto, baja).

**Templates** (Epic 4, `packages/template-library`) — Deuda restante (ver [ADR-0013](../adr/0013-templates-foundation.md)): sin deduplicación de binarios de Asset al clonar un Template con imágenes, sin versionado/edición de un Template ya guardado, sin categorías ni búsqueda en la galería. Prioridad: baja.

**Project Library** (Epic 5, `packages/project-library`) — Deuda restante (ver [ADR-0014](../adr/0014-project-library-workspace.md)): sin autosave (ver `PRODUCT_BACKLOG.md` — prioridad alta como capacidad, aquí solo se registra la ausencia técnica), sin deduplicación de binarios de Asset al duplicar un proyecto, sin búsqueda/carpetas/colecciones en la Workspace (ver `UX_BACKLOG.md`), sin papelera de reciclaje, sin manejo de cuota de IndexedDB agotada. Prioridad: media.

**Batch Dispatch + Alignment Engine** (Epic 7 / Fase 7.2, `@impulso/engine`/`renderer-konva`/`apps/sticker-builder`) — Deuda restante (ver [ADR-0015](../adr/0015-batch-dispatch-alignment.md)): sin caché de bounding boxes entre operaciones sucesivas (cada alineación remide desde cero vía Konva); Alignment/Distribution no consideran objects dentro de un `group` (solo top-level); texto sin `size` explícito y `Path` siguen dependiendo de medición vía Konva para su bounding box exacto (limitación heredada de ADR-0008, no nueva de esta fase). Prioridad: baja.

## 4. Infraestructura y backend (no construida)

Ninguna pieza de infraestructura de servidor existe todavía — Fase 1 es 100% cliente, por decisión de producto (ver [`02-Product-Principles.md`](02-Product-Principles.md), "Offline First"), no por limitación. El disparador de negocio de cada una vive en `PRODUCT_BACKLOG.md` ("Cloud Sync / Cuentas", "Colaboración en tiempo real", "Marketplace").

| Ítem | Se incorpora cuando... |
|---|---|
| Auth (Clerk/Auth.js o equivalente) | Se necesite identificar usuarios entre sesiones/dispositivos. |
| Backend HTTP | El `StorageProvider` remoto (Cloud Sync) necesite un servidor real detrás. |
| Base de datos relacional (PostgreSQL) | Exista almacenamiento server-side — viene junto con el backend HTTP. |
| Cola de jobs distribuida (Redis + BullMQ) | El procesamiento de exportación deje de poder resolverse en un Web Worker del navegador. |
| Object storage remoto (S3/R2) | Los assets/exports necesiten vivir fuera del navegador del usuario. |
| Renderers adicionales (Pixi, SVG-only, headless) | Exista un caso de uso concreto — el contrato `RendererAdapter` ya lo permite sin rediseño. |
| Checkout, fulfillment, integración con imprentas, white-label | Fuera de alcance del producto tal como está definido hoy (ver [`01-Product-Vision.md`](01-Product-Vision.md)) — decisión de qué ES y qué NO ES Impulso, no solo una postergación técnica. |

## 5. Deuda técnica de rendimiento (registrada en `../PERFORMANCE_BUDGET.md`)

Prioridad: **media-alta** — es la única categoría de deuda con un objetivo de producto ya declarado y todavía sin medir ("miles de objetos sin degradar la experiencia", ver `docs/platform/STATE_001.md` §3).

- Undo/redo por snapshot completo del `Project` (no por patches).
- Búsqueda/actualización de un `SceneObject` por id reconstruyendo el árbol completo (O(n)).
- Rebuild completo del Renderer en cada cambio de contenido, sin reconciliación incremental por id.
- Guardado local (Milestone 1) serializa el `Project` completo en cada guardado, sin manejo de cuota agotada.
- Generación de thumbnail (rasterización PNG completa vía Konva headless) en cada "Guardar"/"Guardar como plantilla" — costo no medido todavía (fila nueva en `PERFORMANCE_BUDGET.md`, Epic 6).

Ver `../PERFORMANCE_BUDGET.md` para el registro completo, fila por fila, con la estrategia de optimización futura de cada una.

## Cómo se usa este documento

Antes de cerrar cualquier épica mayor, revisar si algo nuevo se está posponiendo deliberadamente y agregarlo aquí — clasificado en la sección que corresponda (arquitectura/código, pilar no construido, deuda de un pilar ya construido, infraestructura, o rendimiento). No es una lista de tareas pendientes con fecha — es un mapa de "qué decidimos no construir todavía, y por qué". Revisar también, periódicamente (ver `docs/platform/STATE_00N.md`), si algún ítem cambió de categoría o dejó de ser válido.
