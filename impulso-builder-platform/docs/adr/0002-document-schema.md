# ADR-0002 — Document Schema como contrato de datos renderer-agnóstico

> Retrofit de Foundation 1. Detalle completo en [`../../packages/document-schema/README.md`](../../packages/document-schema/README.md).

## Problema
¿Cómo representar un proyecto de Impulso (páginas, capas, formas) de una manera que (a) sea completamente independiente de cómo se dibuja, y (b) sea genérica entre módulos futuros, no específica de stickers?

## Contexto
ADR-0001 exige que el Document Schema no dependa de Konva/React/Canvas/SVG/DOM. Debe ser TypeScript puro, validable, versionable desde el día uno.

## Alternativas evaluadas
- **Tipos de Object específicos por módulo** (ej. un tipo `StickerDieCut`): más directo, pero rompe la reutilización entre módulos y mezcla dominio genérico con reglas de un módulo.
- **Un documento no tipado (JSON libre)**: máxima flexibilidad, cero garantías — cualquier bug de un módulo puede corromper silenciosamente el documento de otro.
- **Path vectorial como string SVG "d"**: más compacto, pero se descartó por ser, literalmente, el formato de una tecnología de render (aunque solo sea texto) — se prefirió un array de segmentos tipados (`PathSegment`) para no depender ni siquiera nominalmente de SVG.

## Decisión tomada
Zod + TypeScript puro. Jerarquía `Project → Document → Page → Layer → SceneObject` (Rectangle/Ellipse/Path/Image/Text/Group recursivo). Un único `Metadata` reutilizado en los 5 niveles. `PluginData`/`CustomProperties` como bolsas genéricas. Versionado explícito (`schemaVersion`/`documentVersion`/`minimumSupportedVersion`) con pipeline de migraciones inyectable.

## Consecuencias
- Cuatro funciones genéricas (`validate/serialize/deserialize/clone`) sirven para cualquier entidad, no doce funciones bespoke.
- Lo específico de un módulo (ej. una línea de corte) se modela con `metadata.role` sobre un tipo genérico, nunca con un tipo de Object nuevo.

## Riesgos
- `PluginData` no se valida a nivel de schema (cada plugin valida lo suyo) — un plugin con un bug puede guardar datos corruptos en su propia sección sin que el schema lo detecte.
- Zod v3 no soporta `discriminatedUnion` con miembros `lazy` (necesario para `Group` recursivo) — se usó `z.union` como solución, con mensajes de error algo menos específicos.

## Compatibilidad futura
El pipeline de migraciones (`runMigrations`) ya existe aunque `MIGRATIONS` esté vacío hoy — el día que haya un cambio incompatible de schema, se agrega un migration step sin rediseñar el mecanismo.
