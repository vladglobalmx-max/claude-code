# Changelog — @impulso/asset-library

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.1] — Epic 5: refactor sobre @impulso/storage-kit

### Cambiado
- `createIndexedDbAssetStore` ahora usa el andamiaje genérico de IndexedDB de `@impulso/storage-kit` (nuevo, ver ADR-0014) en vez de reimplementarlo — refactor de cero cambio de comportamiento, mismos 22 tests pasando, cobertura 100%/100%/100%/100%.

## [0.1.0] — Epic 2: Asset Library

### Agregado
- `AssetBinaryStore`: interfaz genérica (get/set/delete/clear por `AssetId`, agnóstica al tipo de Asset).
- `createIndexedDbAssetStore`: adaptador real sobre IndexedDB nativo (sin la dependencia `idb`).
- `createMemoryAssetStore`: adaptador en memoria, para tests o entornos sin IndexedDB.
- `createImageAssetFromFile`: único ingestion helper implementado — decodifica un `File` (PNG/SVG) en un `ImageAsset` + su `Blob`.
- Paquete nuevo, nacido directamente reutilizable (no como módulo de app) por ser un pilar nombrado de Impulso Platform — ver ADR-0011.
- 22 tests, ~99% de cobertura, cero dependencias circulares.

### Fuera de alcance (deliberado)
Deduplicación por contenido, compresión, manejo de cuota de IndexedDB agotada, cualquier tipo de Asset más allá de `image` (fuentes, plantillas, íconos, patrones, fondos, texturas, marcos, mockups, assets de IA — el modelo los admite, pero ninguno se implementa todavía).
