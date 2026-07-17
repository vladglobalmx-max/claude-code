# Impulso Builder Platform

Monorepo de Impulso Builder Platform. **Impulso Sticker Builder** es el primer módulo construido sobre **Impulso Engine**, el núcleo reutilizable (Document Schema, Layers, Assets, Fonts, Export, History, Plugins) del que también se alimentarán futuros módulos como Planner Builder o Coloring Book Builder.

Arquitectura aprobada: Impulso Engine nunca depende de una librería de render. Todo proyecto se representa en un **Document Schema** propio, y el renderer (Konva, hoy) es un adaptador reemplazable — `Document Schema → Engine → Renderer → Konva`. Ver el diseño completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Metodología:** desarrollo por micro-sprints. Cada micro-sprint se detiene al terminar y espera aprobación explícita antes de continuar con el siguiente.

## Estado

| Micro-sprint | Paquete | Estado |
|---|---|---|
| FOUNDATION 1 — Document Schema | [`packages/document-schema`](packages/document-schema) | ✅ Completo — ver su [README](packages/document-schema/README.md) |
| FOUNDATION 2 — Engine Core | [`packages/engine`](packages/engine) | ✅ Completo — ver su [README](packages/engine/README.md) |
| Renderer adapter (Konva) | `packages/renderer-konva` | ⏳ No iniciado |
| Sticker Builder (app) | `apps/sticker-builder` | ⏳ No iniciado |

Ver [`docs/ENGINEERING_STANDARDS.md`](docs/ENGINEERING_STANDARDS.md) para la regla permanente de calidad que todo paquete debe cumplir.

## Desarrollo

```bash
pnpm install
pnpm build
pnpm test
```

Cada paquete es independiente y puede desarrollarse/testearse por separado desde su propia carpeta.
