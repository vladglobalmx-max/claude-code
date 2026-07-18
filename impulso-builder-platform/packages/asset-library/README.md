# @impulso/asset-library

> Asset Library oficial de Impulso Platform, nacida en la épica Asset Library (Epic 2, Sticker Builder). Genérica sobre cualquier tipo de Asset del Document Schema — hoy solo `image` está implementado, pero el modelo/organización/API admiten fuentes, plantillas, íconos, patrones, fondos, texturas, marcos, mockups o assets de IA sin rediseño. Ver [ADR-0011](../../docs/adr/0011-asset-library.md).

**Estado:** primera versión (v1). Solo ingesta de imágenes (PNG/SVG); el registro de descriptores vive en `Document.assets` (`@impulso/document-schema`), este paquete administra únicamente el binario.

---

## 1. Qué es y qué no es

- **Sí hace:** almacena/resuelve el binario (`Blob`) de un Asset por su id (`AssetBinaryStore`, con una implementación real sobre IndexedDB y una en memoria para tests), y provee `createImageAssetFromFile` — el único "ingestion helper" implementado, que decodifica un `File` en un `ImageAsset` (descriptor válido contra `@impulso/document-schema`) + su `Blob`.
- **No hace:** no mantiene su propio registro de descriptores (`Document.assets` ya es la única fuente de verdad — duplicarlo sería un segundo estado a sincronizar), no sabe dibujar nada, no gestiona múltiples proyectos ni sincronización remota, no implementa ningún tipo de Asset más allá de `image`.

## 2. Árbol

```
packages/asset-library/
├── package.json / tsconfig.json / vitest.config.ts / vitest.setup.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                        # API pública
    ├── types.ts                        # AssetBinaryStore — la única interfaz del paquete
    ├── stores/
    │   ├── indexedDbStore.ts           # createIndexedDbAssetStore — adaptador real (IndexedDB nativo, sin dependencia `idb`)
    │   ├── memoryStore.ts              # createMemoryAssetStore — para tests / entornos sin IndexedDB
    │   └── assetBinaryStore.contract.ts # suite de tests compartida entre ambas implementaciones
    └── ingestion/
        └── imageIngestion.ts           # createImageAssetFromFile — único ingestion helper implementado

    (22 tests, 99%+ de cobertura)
```

## 3. Decisiones clave (ver ADR-0011 para el detalle completo)

### 3.1 `AssetBinaryStore` es 100% agnóstico al tipo de Asset
`get`/`set`/`delete`/`clear` operan sobre `AssetId -> Blob` — nunca sobre el descriptor (que vive en `Document.assets`). Un futuro tipo de Asset (fuente, textura, mockup...) reutiliza exactamente esta misma interfaz sin ningún cambio.

### 3.2 Dos implementaciones, un mismo contrato de tests
`createIndexedDbAssetStore` (real, IndexedDB nativo — sin la dependencia `idb`, ~50 líneas de envoltura en Promises son suficientes para un único object store) y `createMemoryAssetStore` (en memoria, para tests o entornos sin IndexedDB) pasan la MISMA suite (`assetBinaryStore.contract.ts`) — verifica que son intercambiables de verdad, no que "se parecen".

### 3.3 Ingesta separada del almacenamiento, y por tipo
`createImageAssetFromFile` es una función pura respecto al store (recibe un `File`, devuelve `{ asset, binary }` — quien la llama decide cuándo/si guardarlo). Un tipo de Asset futuro agrega su propio `xxxIngestion.ts` sin tocar `AssetBinaryStore`.

### 3.4 Testeado en un entorno `"node"` explícito para `indexedDbStore.ts`
`fake-indexeddb` (usado para testear el adaptador real sin un navegador) no interopera perfectamente con el `Blob` de jsdom (un Blob clonado a través de IndexedDB simulado pierde su prototipo real bajo jsdom). `indexedDbStore.test.ts` corre con `// @vitest-environment node`, donde el `Blob` nativo de Node sobrevive el roundtrip intacto — verificado además con la app completa contra un build de producción real en Chromium.

## 4. Desarrollo

```bash
pnpm --filter @impulso/asset-library build
pnpm --filter @impulso/asset-library test
pnpm --filter @impulso/asset-library typecheck
```

## 5. Riesgos y limitaciones conocidas

- **Sin deduplicación por contenido**: subir el mismo archivo dos veces crea dos entradas independientes en el store.
- **Sin compresión/optimización** al guardar un binario.
- **`indexedDbStore.ts` no maneja explícitamente cuota agotada** de IndexedDB (mucho más generosa que `localStorage`, pero no ilimitada).
- **Solo `image` implementado** — `font` existe como tipo declarado en `@impulso/document-schema` desde antes de esta épica, sin ningún ingestion helper todavía.

## 6. Mejoras futuras

- Ingestion helpers para los tipos de Asset mencionados en el diseño de esta épica (fuentes, plantillas, íconos, patrones, fondos, texturas, marcos, mockups, assets de IA) — cada uno mecánico de agregar, sin tocar este README de arquitectura.
- Deduplicación por hash de contenido.
- Manejo explícito de cuota de IndexedDB agotada.
