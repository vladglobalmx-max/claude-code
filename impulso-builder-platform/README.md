# Impulso Platform

Monorepo de **Impulso Platform** — una plataforma de creación de productos visuales construida sobre un núcleo reutilizable (**Impulso Engine**) del que se alimentan **Modules** independientes. **Sticker Builder** es el primer módulo, no el producto en sí; Planner Builder, Coloring Book Builder y otros módulos futuros están planeados sobre el mismo Engine. Ver la visión de producto completa y el mapa de toda la plataforma (Engine, Shared Services, Design System, AI Engine, Asset Library, Export Engine, Modules) en [`docs/product/`](docs/product/).

Arquitectura aprobada: Impulso Engine nunca depende de una librería de render. Todo proyecto se representa en un **Document Schema** propio, y el renderer (Konva, hoy) es un adaptador reemplazable — `Document Schema → Engine → Renderer → Konva`. Ver el diseño técnico completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y el mapa de arquitectura de producto en [`docs/product/03-Architecture-Map.md`](docs/product/03-Architecture-Map.md).

**Metodología:** desarrollo por micro-sprints. Cada micro-sprint se detiene al terminar y espera aprobación explícita antes de continuar con el siguiente.

## Estado

> La tabla de abajo trackea el progreso de ingeniería de **Impulso Engine** y de su primer módulo, **Sticker Builder** — el único módulo construido hasta la fecha. Para la visión completa de Impulso Platform (todos los módulos planeados, principios de producto, roadmap) ver [`docs/product/`](docs/product/).

**Etapa Foundations — completa.** Document Schema, Engine y Renderer Adapter, cada uno cerrado y aprobado.

**Etapa Editor — en curso.** Construye la experiencia de edición real de Sticker Builder sobre las tres piezas de Foundations, sin volver a tocar su API pública salvo que un ADR documente el cambio (regla de Stable Public API). Desde Editor Epic 1, el trabajo se organiza por sistemas completos ("Editor Epics"), no por micro-funcionalidades aisladas.

| Micro-sprint / Épica | Paquete | Estado |
|---|---|---|
| FOUNDATION 1 — Document Schema | [`packages/document-schema`](packages/document-schema) | ✅ Completo — ver su [README](packages/document-schema/README.md) |
| FOUNDATION 2 — Engine Core | [`packages/engine`](packages/engine) | ✅ Completo — ver su [README](packages/engine/README.md) |
| FOUNDATION 3 — Renderer Adapter (Konva) | [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver su [README](packages/renderer-konva/README.md) |
| EDITOR 1 — Canvas Runtime | [`apps/sticker-builder`](apps/sticker-builder) | ✅ Completo — ver su [README](apps/sticker-builder/README.md) |
| EDITOR 2 — Selection System | [`packages/engine`](packages/engine) + [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver [ADR-0006](docs/adr/0006-selection-system.md) |
| EDITOR 3 — Transform System | [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver [ADR-0007](docs/adr/0007-transform-system.md) |
| EDITOR EPIC 1 — Manipulation System (resize, rotación, bounding box, handles) | [`packages/engine`](packages/engine) + [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver [ADR-0008](docs/adr/0008-manipulation-system.md) |

**Milestones — primeras versiones integradas y ejecutables**, validando el flujo completo antes de seguir agregando capacidades.

| Milestone | Objetivo | Estado |
|---|---|---|
| MILESTONE 1 — Impulso Alpha | Crear, mostrar, renderizar, seleccionar, mover, redimensionar, rotar, deshacer, rehacer, guardar y abrir un documento — de principio a fin | ✅ Completo — ver [`docs/MILESTONE_1_ALPHA.md`](docs/MILESTONE_1_ALPHA.md) y [ADR-0009](docs/adr/0009-local-persistence-alpha.md) |

**Epics — experiencias completas de usuario**, construidas de punta a punta (no funcionalidades aisladas) sobre Foundations + Editor.

| Épica | Paquetes | Estado |
|---|---|---|
| EPIC 1 — Sticker Creation Experience | [`packages/engine`](packages/engine) + [`packages/renderer-konva`](packages/renderer-konva) + [`apps/sticker-builder`](apps/sticker-builder) | ✅ Completo — ver [ADR-0010](docs/adr/0010-sticker-creation-experience.md) |
| EPIC 2 — Asset Library | [`packages/document-schema`](packages/document-schema) + [`packages/engine`](packages/engine) + [`packages/asset-library`](packages/asset-library) + [`apps/sticker-builder`](apps/sticker-builder) | ✅ Completo — ver [ADR-0011](docs/adr/0011-asset-library.md) |

Ver [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) para la regla permanente de calidad que todo paquete debe cumplir, [`docs/adr/`](docs/adr) para el registro de Architecture Decision Records, y [`docs/PERFORMANCE_BUDGET.md`](docs/PERFORMANCE_BUDGET.md) para el registro de decisiones con impacto de rendimiento.

## Desarrollo

```bash
pnpm install
pnpm build
pnpm test
```

Cada paquete es independiente y puede desarrollarse/testearse por separado desde su propia carpeta.
