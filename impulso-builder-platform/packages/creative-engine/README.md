# @impulso/creative-engine

Motor Creativo de THÖREN 2.0. Ver `docs/product/THOREN_CREATIVE_ENGINE.md`, `docs/product/THOREN_TECHNICAL_ARCHITECTURE.md` y `docs/product/THOREN_IMPLEMENTATION_PLAN.md` en la raíz del monorepo — este README no repite esas decisiones, solo documenta el estado actual del código.

## Estado: Fase 2 — Motor Creativo v1

### Fase 1 — Núcleo del Documento

Alcance (ver `THOREN_IMPLEMENTATION_PLAN.md`): confirmar y exponer, como base estable, el contrato mínimo que las fases siguientes van a necesitar de `@impulso/document-schema` y `@impulso/export-engine` — sin recetas, sin interpretación de intención, sin interfaz nueva. Ninguno de esos dos paquetes se modifica.

- `componer(params)` — construye un `Document` válido (una página, una forma de fondo — círculo o rectángulo — y un texto centrado) a partir de contenido real, tipografía y color.
- `exportarSVG(document)` — envuelve el `Document` en el `Project` mínimo que `@impulso/export-engine#buildSvgDocument` exige y devuelve el SVG resuelto.

### Fase 2 — Motor Creativo v1

Alcance deliberadamente acotado (instrucción explícita): una sola ocasión (Boda), una sola receta (Elegante), tres arquetipos de composición reales — la primera demostración completa de la tubería, no un motor genérico. Sin múltiples recetas/ocasiones, variantes, aprendizaje, IA ni internacionalización (llegan en fases posteriores, ver `THOREN_CREATIVE_ENGINE.md` §20).

- `interpretar(frase) → Intent` — intérprete de intención **determinista** (sin LLM, sin prompts): extrae nombres, fecha y color solo cuando se mencionan explícitamente; ocasión fija en `"boda"` (única soportada esta fase). Ver `src/intent.ts` para el comportamiento exacto ante frases cortas, fragmentadas, informales o contradictorias.
- `seleccionarReceta(Intent) → Recipe` — trivial mientras exista una sola receta: siempre devuelve Elegante-Boda (`src/recipes/eleganteBoda.ts`).
- `generarLote(Intent) → Composition[]` — genera las tres composiciones de la receta (un arquetipo cada una), validando cada una con el Filtro de calidad básico antes de devolverla. Lanza un error explícito si alguna no pasa — esta fase no implementa el ciclo de reintento/sustitución de receta (eso es el Filtro de calidad ampliado, Fase 5).
- `crearPropuestas(frase) → Composition[]` — atajo de una sola llamada (`interpretar` + `generarLote`) para demos/pruebas de extremo a extremo; no es una interfaz pública nueva del Motor Creativo.
- `validarComposicion(document, palette, anchors) → Validacion` — Filtro de calidad básico: texto dentro de límites (estimación conservadora de ancho, sin métrica real de fuente), contraste WCAG (4.5:1 texto normal, 3:1 texto grande/gráficos), ausencia de colisiones entre contenido (AABB de las cajas rotadas, ver `src/quality/collision.ts`), y exportación SVG correcta con fidelidad de contenido (el texto real del usuario debe sobrevivir, sin distinguir mayúsculas/minúsculas).

**Los tres arquetipos de Elegante-Boda** (`src/archetypes/`) son estructuralmente distintos, no una simple variación de posición/color:

1. `monograma-anillo` — simetría circular: un círculo-guía de solo contorno, un anillo de texto perimetral (aproximado con cajas de texto rotadas tangentes al círculo — no hay texto curvado letra por letra en `@impulso/document-schema`), y un monograma grande centrado.
2. `insignia-doble-filete` — simetría rectangular: dos marcos rectangulares concéntricos de solo contorno ("doble filete") con un bloque de texto centrado y apilado (nombre + fecha opcional) dentro.
3. `composicion-asimetrica` — sin marco de ningún tipo: texto alineado a la izquierda, un filete simple corto (no un contorno cerrado) como único divisor, espacio negativo deliberado a la derecha.

Una señal explícita de color (`"en dorado"`) sustituye solo el acento de la receta, nunca el fondo ni el color de alto contraste — y si el tono pedido no alcanza el contraste mínimo contra el fondo, se oscurece en silencio (`ensureContrast`) en vez de rechazar la composición o preguntar.

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
