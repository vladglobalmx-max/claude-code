# @impulso/export-engine

> Export Engine oficial de Impulso Platform, nacido en la épica Export Engine Foundation (Epic 3, Sticker Builder). Produce archivos finales (PNG/SVG en v1) a partir del Document Schema, reutilizable por cualquier módulo futuro (Planner Builder, Coloring Book Builder...) — no una función de descarga específica de Sticker Builder. Ver [ADR-0012](../../docs/adr/0012-export-engine.md).

**Estado:** primera versión (v1). PNG y SVG; PDF print-ready con línea de corte/sangrado queda para una épica futura.

---

## 1. Qué es y qué no es

- **Sí hace:** `exportProject(project, resolver, options)` produce un `Blob` PNG o un string+Blob SVG a partir de un `Project` — nunca del estado de edición (selección, handles, zoom, overlays: ninguno existe en `Document`, así que quedan excluidos por construcción). El núcleo SVG (`svg/`) es 100% independiente de Konva — lee `project.document` directamente y serializa a texto. El adaptador PNG (`png/`) reutiliza `@impulso/renderer-konva` vía un Stage headless (nunca el Stage interactivo del editor) para garantizar fidelidad pixel a pixel con el canvas. `browser/` provee `triggerBrowserDownload`/`sanitizeFilename`, DOM-only y separados del núcleo.
- **No hace:** no genera PDF, líneas de corte ni sangrado (v1.0 futuro); no detecta fuentes no disponibles todavía (`font_unavailable` declarado, no emitido); no deduplica ni comprime binarios de Asset; no construye ninguna UI (eso vive en cada módulo consumidor, ver `apps/sticker-builder/src/exportDialog.ts`).

## 2. Árbol

```
packages/export-engine/
├── package.json / tsconfig.json / vitest.config.ts
├── README.md / CHANGELOG.md
└── src/
    ├── index.ts                    # API pública
    ├── types.ts                    # ExportAssetResolver, ExportOptions, ExportResult/Warning
    ├── errors.ts                   # ExportError + códigos
    ├── exportProject.ts            # punto de entrada único: Project -> archivo final
    ├── svg/                        # NÚCLEO — cero dependencia de Konva, determinista
    │   ├── buildSvgDocument.ts      # Document -> string SVG
    │   ├── sceneObjectToSvg.ts      # recorrido recursivo (incluye Group)
    │   ├── transformToSvgAttr.ts    # transform.x/y/rotation/scale -> "translate(...) rotate(...) scale(...)"
    │   ├── styleToSvgAttrs.ts       # fill/stroke/opacity/blend/sombra (feDropShadow)
    │   ├── shapeMarkup.ts           # <rect>/<ellipse>/<path>
    │   ├── textMarkup.ts            # <text>/<tspan> multilinea
    │   ├── blobToDataUrl.ts         # Blob -> data URL (embeber una imagen)
    │   └── escapeXml.ts
    ├── png/
    │   └── rasterizeProjectToPng.ts # ÚNICO módulo del paquete que importa Konva
    └── browser/
        ├── download.ts              # triggerBrowserDownload
        └── filename.ts               # sanitizeFilename

    (59 tests, ~99% de cobertura, cero dependencias circulares)
```

## 3. Decisiones clave (ver ADR-0012 para el detalle completo)

### 3.1 El límite Renderer / Export Engine
SVG nunca toca Konva — es un recorrido puro de `project.document` a texto. PNG SÍ reutiliza Konva, pero solo a través de `renderPageToStage` (`@impulso/renderer-konva`, función nueva de esta épica): un `Konva.Stage` desacoplado, nunca el Stage interactivo montado en el editor, sin `selectionLayer`, sin ninguna interactividad. Ambos formatos parten siempre de `Document` como única fuente de verdad — Konva se invoca de forma stateless (construir → rasterizar → destruir) en cada exportación.

### 3.2 ¿Por qué PNG reutiliza Konva en vez de un rasterizador propio?
Reimplementar a mano el layout de texto (wrap, alineación, altura de línea) y las sombras habría duplicado lógica ya correcta y probada en el Renderer, con riesgo real de que el PNG exportado no coincidiera pixel a pixel con lo que el usuario ve en el editor. `renderPageToStage` reutiliza `createSceneNode` 1:1 — el mismo código que ya dibuja el canvas — y `stage.toCanvas({ pixelRatio })` rasteriza cada primitiva directamente a la resolución pedida (1x-4x nítido, sin ampliar un raster ya generado).

### 3.3 `segmentsToSvgPathData`/`toPixels` viven en `@impulso/document-schema`, no aquí ni en `renderer-konva`
Ambas funciones son puras sobre tipos del propio Document Schema y las necesitan tanto el Renderer (Konva.Path también consume sintaxis `d` de SVG) como este paquete — vivir en el schema evita que cualquiera de los dos dependa del otro solo para obtenerlas.

### 3.4 Interfaz de Assets propia, no una dependencia de `@impulso/asset-library`
`ExportAssetResolver { resolve(assetId): Promise<Blob|undefined> }` es deliberadamente más angosta que `AssetBinaryStore` — este paquete no depende de Asset Library en absoluto. Un caller (`apps/sticker-builder`) la satisface con un adaptador de una línea.

### 3.5 Degradación controlada, nunca un fallo silencioso
Un Asset eliminado-pero-referenciado o con binario ausente no aborta la exportación: se dibuja un marcador de posición (mismo rectángulo punteado que ya usa el Renderer) y se reporta como `ExportWarning` — el caller decide cómo mostrarlo. Errores verdaderamente irrecuperables (`no_active_page`, `invalid_filename`, `out_of_memory`, `download_failed`) son un `ExportError` tipado, nunca un `undefined` silencioso.

## 4. Desarrollo

```bash
pnpm --filter @impulso/export-engine build
pnpm --filter @impulso/export-engine test
pnpm --filter @impulso/export-engine typecheck
```

## 5. Riesgos y limitaciones conocidas

- **`font_unavailable` no se detecta todavía** — una fuente no instalada en el visor del SVG exportado degrada silenciosamente al fallback del navegador/app que lo abra.
- **Ajuste automático de línea (`TextObject.size`) no se reproduce en SVG** — solo se preservan saltos de línea explícitos (`\n`); reproducir el wrap exacto requeriría medir texto con las métricas reales de la fuente, no garantizable en un visor SVG ajeno a Impulso.
- **Sombra aproximada**: `feDropShadow stdDeviation ≈ shadowBlur/2` no es una equivalencia exacta con el `shadowBlur` de Canvas 2D que usa Konva.
- **Sin deduplicación/compresión** de binarios embebidos — heredado de `@impulso/asset-library`.
- **`cropRect` de `ImageObject` sigue sin usarse** — ni el Renderer ni este paquete lo implementan (brecha preexistente, no introducida aquí).
- **PNG a escala 4x en documentos grandes** puede acercarse a límites reales de memoria del navegador — mitigado con el error `out_of_memory` explícito, sin tiling/chunking.

## 6. Mejoras futuras

- PDF print-ready con línea de corte (`metadata.role: "die-line"`, ya modelada en el Document Schema) y sangrado — v1.0 del roadmap.
- Detección de `font_unavailable` vía `document.fonts.check(...)` en la capa de aplicación/adaptador de navegador.
- Exportación por lotes / ZIP de producto, construida sobre `exportProject` llamado repetidas veces — sin cambios al núcleo.
