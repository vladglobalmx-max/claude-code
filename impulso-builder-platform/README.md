# Impulso Builder Platform

Monorepo de Impulso Builder Platform. **Impulso Sticker Builder** es el primer módulo construido sobre **Impulso Engine**, el núcleo reutilizable (Document Schema, Layers, Assets, Fonts, Export, History, Plugins) del que también se alimentarán futuros módulos como Planner Builder o Coloring Book Builder.

Arquitectura aprobada: Impulso Engine nunca depende de una librería de render. Todo proyecto se representa en un **Document Schema** propio, y el renderer (Konva, hoy) es un adaptador reemplazable — `Document Schema → Engine → Renderer → Konva`. Ver el diseño completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Metodología:** desarrollo por micro-sprints. Cada micro-sprint se detiene al terminar y espera aprobación explícita antes de continuar con el siguiente.

## Estado

**Etapa Foundations — completa.** Document Schema, Engine y Renderer Adapter, cada uno cerrado y aprobado.

**Etapa Editor — en curso.** Construye la experiencia de edición real de Sticker Builder sobre las tres piezas de Foundations, sin volver a tocar su API pública salvo que un ADR documente el cambio (regla de Stable Public API).

| Micro-sprint | Paquete | Estado |
|---|---|---|
| FOUNDATION 1 — Document Schema | [`packages/document-schema`](packages/document-schema) | ✅ Completo — ver su [README](packages/document-schema/README.md) |
| FOUNDATION 2 — Engine Core | [`packages/engine`](packages/engine) | ✅ Completo — ver su [README](packages/engine/README.md) |
| FOUNDATION 3 — Renderer Adapter (Konva) | [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver su [README](packages/renderer-konva/README.md) |
| EDITOR 1 — Canvas Runtime | [`apps/sticker-builder`](apps/sticker-builder) | ✅ Completo — ver su [README](apps/sticker-builder/README.md) |
| EDITOR 2 — Selection System | [`packages/engine`](packages/engine) + [`packages/renderer-konva`](packages/renderer-konva) | ✅ Completo — ver [ADR-0006](docs/adr/0006-selection-system.md) |

Ver [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) para la regla permanente de calidad que todo paquete debe cumplir, [`docs/adr/`](docs/adr) para el registro de Architecture Decision Records, y [`docs/PERFORMANCE_BUDGET.md`](docs/PERFORMANCE_BUDGET.md) para el registro de decisiones con impacto de rendimiento.

## Desarrollo

```bash
pnpm install
pnpm build
pnpm test
```

Cada paquete es independiente y puede desarrollarse/testearse por separado desde su propia carpeta.
