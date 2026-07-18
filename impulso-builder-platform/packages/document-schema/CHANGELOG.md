# Changelog — @impulso/document-schema

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.2.1] — Epic 3: Export Engine Foundation

### Agregado
- `segmentsToSvgPathData` (`object/pathData.ts`) y `toPixels` (`page/unitConversion.ts`) — funciones puras relocalizadas desde `@impulso/renderer-konva`, que las necesitaba, y ahora también `@impulso/export-engine` — vivir aquí evita que uno de los dos paquetes dependa del otro solo para obtenerlas. `renderer-konva` re-exporta ambas para no romper a quien ya las importaba de ahí. Ver ADR-0012.
- 8 tests nuevos (93 en total), 100% de cobertura mantenida.

## [0.2.0] — Epic 2: Asset Library

### Cambiado
- `AssetSchema` pasa de un objeto plano con `superRefine` a una unión discriminada extensible: `asset/base.ts` (`AssetBaseSchema`, gana `pluginData`/`customProperties`), `asset/image.ts` (`ImageAssetSchema`), `asset/font.ts` (`FontAssetSchema`, extraído a su propio archivo). Agregar un tipo de Asset nuevo es agregar una variante, sin tocar ningún consumidor existente — ver ADR-0011.
- `Document` gana `assets: Asset[]` (`.default([])`, aditivo — sin bump de `schemaVersion`, sin migración necesaria: `Asset` nunca se persistió realmente antes de esta épica).

### Agregado
- 5 tests nuevos (85 en total), 100% de cobertura mantenida.

### Fuera de alcance (deliberado)
Validación de integridad referencial entre `ImageObject.assetId` y `document.assets`; cualquier tipo de Asset más allá de `image`/`font`.

## [0.1.0] — Foundation 1

### Agregado
- Esquemas Zod y tipos TypeScript para: `Project`, `Document`, `Page`, `Layer`, `SceneObject` (Rectangle, Ellipse, Path, Image, Text, Group recursivo), `Style`, `Asset`, `Metadata`, `HistoryEntry`/`DocumentHistory`, `PluginData`, `CustomProperties`.
- Identificadores "brandeados" (`ProjectId`, `DocumentId`, `PageId`, `LayerId`, `ObjectId`, `AssetId`).
- Primitivos geométricos (`Point`, `Size`, `Rect`, `Transform`) y `JsonValue` recursivo.
- Sistema de versionado: `CURRENT_SCHEMA_VERSION`, `MINIMUM_SUPPORTED_SCHEMA_VERSION`, pipeline de migraciones (`runMigrations`, tipo `Migration`, `UnsupportedSchemaVersionError`).
- Funciones genéricas de validación/serialización/deserialización/clonado (`validateWithSchema`, `serializeWithSchema`, `deserializeWithSchema`, `cloneWithSchema`), más envolturas específicas para `Document` y `Project` que aplican migración antes de validar.
- 80 tests, 100% de cobertura.
