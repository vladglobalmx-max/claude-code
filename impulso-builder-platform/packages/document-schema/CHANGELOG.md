# Changelog — @impulso/document-schema

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Foundation 1

### Agregado
- Esquemas Zod y tipos TypeScript para: `Project`, `Document`, `Page`, `Layer`, `SceneObject` (Rectangle, Ellipse, Path, Image, Text, Group recursivo), `Style`, `Asset`, `Metadata`, `HistoryEntry`/`DocumentHistory`, `PluginData`, `CustomProperties`.
- Identificadores "brandeados" (`ProjectId`, `DocumentId`, `PageId`, `LayerId`, `ObjectId`, `AssetId`).
- Primitivos geométricos (`Point`, `Size`, `Rect`, `Transform`) y `JsonValue` recursivo.
- Sistema de versionado: `CURRENT_SCHEMA_VERSION`, `MINIMUM_SUPPORTED_SCHEMA_VERSION`, pipeline de migraciones (`runMigrations`, tipo `Migration`, `UnsupportedSchemaVersionError`).
- Funciones genéricas de validación/serialización/deserialización/clonado (`validateWithSchema`, `serializeWithSchema`, `deserializeWithSchema`, `cloneWithSchema`), más envolturas específicas para `Document` y `Project` que aplican migración antes de validar.
- 80 tests, 100% de cobertura.
