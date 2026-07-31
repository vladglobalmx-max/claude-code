# @impulso/creative-engine

Motor Creativo de THÖREN 2.0. Ver `docs/product/THOREN_CREATIVE_ENGINE.md`, `docs/product/THOREN_TECHNICAL_ARCHITECTURE.md` y `docs/product/THOREN_IMPLEMENTATION_PLAN.md` en la raíz del monorepo — este README no repite esas decisiones, solo documenta el estado actual del código.

## Estado: Fase 1 — Núcleo del Documento

Alcance de esta fase (ver `THOREN_IMPLEMENTATION_PLAN.md`): confirmar y exponer, como base estable, el contrato mínimo que las fases siguientes van a necesitar de `@impulso/document-schema` y `@impulso/export-engine` — sin recetas, sin interpretación de intención, sin interfaz nueva. Ninguno de esos dos paquetes se modifica.

- `componer(params)` — construye un `Document` válido (una página, una forma de fondo — círculo o rectángulo — y un texto centrado) a partir de contenido real, tipografía y color.
- `exportarSVG(document)` — envuelve el `Document` en el `Project` mínimo que `@impulso/export-engine#buildSvgDocument` exige y devuelve el SVG resuelto.

## Por qué `vitest.config.ts` fuerza `environment: "jsdom"` + `resolve.mainFields`

`@impulso/export-engine` reexporta `exportProject`, que importa `@impulso/renderer-konva` → Konva. Konva resuelve por defecto su build de Node (`package.json` `"main"`), que requiere el paquete nativo `canvas` — no instalado en este monorepo. Sin esta configuración, `import { buildSvgDocument } from "@impulso/export-engine"` falla en tiempo de import aunque el código nunca use la ruta de PNG/Konva. Es el mismo problema, y la misma solución, que ya existe en `packages/renderer-konva/vitest.config.ts`.

Esto también significa que, hoy, **no hay una forma de correr un script de Node plano** que importe `@impulso/export-engine` sin este truco — Node no tiene equivalente a `resolve.mainFields` de Vite. Por eso el entregable demostrable de esta fase se ejecuta como una prueba (`pnpm demo`), no como un script suelto.

## Comandos

```bash
pnpm install        # una vez, desde la raíz del monorepo
pnpm test           # suite completa
pnpm test:coverage  # con cobertura
pnpm typecheck
pnpm demo           # genera SVGs reales en demo-output/ para inspección visual
```
