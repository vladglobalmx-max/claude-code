# ADR-0001 — Impulso Engine: Document Schema → Engine → Renderer → Konva

> Retrofit: esta decisión se tomó en Foundation 0, antes de que el estándar de ADRs existiera. Se documenta aquí en retrospectiva porque sigue condicionando cada Foundation posterior. El detalle completo vive en [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Problema
¿Cómo estructurar Sticker Builder para que sea el primer módulo de una plataforma (Impulso Builder Platform) con más módulos futuros (Planner Builder, Coloring Book Builder), sin acoplar todo el editor a una librería de renderizado concreta?

## Contexto
- Sticker Builder es el primer módulo, pero no debe ser "el producto" — debe ser un consumidor de un núcleo reutilizable.
- El producto necesita imprecisión vectorial (líneas de corte) que sobreviva a un eventual cambio de librería de render.
- Se evaluó y decidió Konva.js como motor de canvas (ver comparación Fabric vs Konva en `ARCHITECTURE.md` §1).

## Alternativas evaluadas
- **Engine acoplado directamente a Konva**: más simple a corto plazo, pero cualquier cambio de renderer (o necesidad de un renderer headless) obligaría a reescribir el Engine.
- **Un solo paquete monolítico** (schema+lógica+render mezclados): viola alta cohesión/bajo acoplamiento y hace imposible reutilizar el núcleo en un futuro módulo sin arrastrar a Konva.

## Decisión tomada
Cuatro niveles con dependencia en una sola dirección:
```
Document Schema  →  Engine  →  Renderer (adaptador)  →  Konva (hoy)
```
`packages/engine` nunca importa Konva ni ninguna librería de render. `packages/renderer-konva` es la única implementación concreta del contrato `RendererAdapter` que el Engine define.

## Consecuencias
- Cada Foundation se puede desarrollar y testear de forma aislada (Document Schema sin Engine; Engine sin Renderer).
- Un futuro cambio de renderer (o un renderer headless para exportación) no toca `document-schema` ni `engine`.
- Los tipos de Object del schema son genéricos (rect/ellipse/path/text/image/group); lo específico de un módulo se expresa vía `metadata.role`, no vía tipos nuevos.

## Riesgos
- Disciplina arquitectónica constante requerida: es fácil "solo por esta vez" importar algo de Konva en el Engine y romper la separación silenciosamente. Mitigado por: `package.json` de `engine` sin Konva como dependencia, y el hábito de correr `madge --circular` en cada paquete.

## Compatibilidad futura
Permite añadir `renderer-pixi`, `renderer-svg` o un renderer headless sin rediseño, y añadir Planner Builder/Coloring Book Builder como nuevos consumidores del mismo Engine.
