# ADR-0012 — Export Engine Foundation

## Problema
Sticker Builder permite crear, diseñar, guardar y abrir un proyecto — pero nunca produce un archivo final utilizable fuera de Impulso. Esta épica cierra ese vacío con la primera versión del **Export Engine oficial de Impulso Platform**: un pilar de plataforma reutilizable por cualquier módulo futuro (Planner Builder, Coloring Book Builder, Worksheet Builder...), no una función de descarga específica de Sticker Builder. V1: exportar a PNG y SVG.

## Contexto
- `docs/product/03-Architecture-Map.md` ya nombraba "Export Engine" como uno de los pilares de la plataforma (⏳ planeado, sin código real) — el mismo estatus que tenía "Asset Library" antes de Epic 2, que justificó nacer como paquete real desde el día uno (ver ADR-0011).
- `docs/ARCHITECTURE.md` §2.5 ya dejaba una decisión de diseño escrita antes de que existiera código real: *"SVG... se genera leyendo el Document Schema directamente, nunca pasa por Konva. PNG es la única excepción real: hace falta pedirle al Renderer que rasterice."* Esta épica confirma y concreta esa decisión con código real.
- `@impulso/renderer-konva` ya exponía públicamente (`index.ts`) funciones puras de traducción (`segmentsToSvgPathData`, `toPixels`) con un comentario explícito anticipando un "futuro paquete hermano, ej. un exportador headless" — la intención de reutilización ya estaba sembrada desde Foundation 3/Epic 1.
- `@impulso/asset-library`'s `AssetBinaryStore.get(assetId): Promise<Blob|undefined>` ya resuelve exactamente el binario que un exportador necesita.
- El usuario fue explícito: "No conviertas al Renderer Konva en el motor oficial de exportación si eso compromete fidelidad, escalabilidad, portabilidad, pruebas deterministas, o reutilización — pero si encontrás que alguna parte puede reutilizarse de forma segura, documentá claramente el límite entre Renderer y Export Engine."

## Alternativas evaluadas

### ¿Cómo produce píxeles el exportador PNG?
Esta fue la única decisión que se planteó explícitamente al usuario antes de implementar (ver más abajo, "Decisión confirmada con el usuario") — las demás se resolvieron de forma autónoma por no cambiar arquitectura existente.

- **A. Reutilizar Konva vía un Stage headless** (elegida): un `Konva.Stage` desacoplado del editor — nunca el Stage interactivo montado, sin `selectionLayer`, sin ninguna interactividad — reutiliza `createSceneNode` 1:1 (`@impulso/renderer-konva`, función nueva `renderPageToStage`). `stage.toCanvas({ pixelRatio })` rasteriza en 1x-4x con nitidez nativa (Konva vuelve a dibujar cada primitiva a la resolución pedida, no amplía un raster ya generado). Máxima fidelidad garantizada por construcción: es literalmente el mismo código que ya dibuja el canvas del editor — cero riesgo de que un layout de texto o una sombra reimplementados a mano diverjan de lo que el usuario ve.
- **B. SVG propio + rasterizar en `<canvas>`, cero Konva**: el Export Engine genera su propio SVG (sin Konva) y lo dibuja sobre un `<canvas>` vía un `<img>` intermedio — el escalado sale gratis por ser vectorial. Descartada para PNG (aunque SÍ es exactamente el diseño elegido para el formato SVG en sí, ver abajo) porque habría exigido reimplementar a mano el layout de texto (wrap, alineación, altura de línea) y las sombras (aproximar `shadowBlur` de Canvas2D con `feDropShadow` de SVG) — duplicando lógica ya correcta en el Renderer, con riesgo real de que el PNG no coincidiera pixel a pixel con el editor (viola el criterio de aceptación #8 de la épica).
- **C. Reimplementar un walker Canvas2D propio, sin Konva ni SVG**: descartada — tercera reimplementación completa de fills/strokes/curvas/texto/sombras, el mayor riesgo de duplicación de las tres opciones, sin ningún beneficio sobre A.

**Decisión confirmada con el usuario:** opción A. El límite documentado (ver más abajo, "El límite Renderer / Export Engine") es que Konva se usa SOLO para esta rasterización headless — nunca para SVG, nunca leyendo el Stage interactivo del editor, nunca como fuente de verdad (que sigue siendo `Document`).

### Aprobación formal y condiciones
El usuario aprobó explícitamente la opción A ("priorizar fidelidad visual, consistencia con el editor y reutilización de código probado sobre independencia teórica en esta etapa") sujeta a 8 condiciones. Cada una quedó satisfecha así:

1. **"El Stage de exportación debe estar completamente desacoplado del Stage visible del editor."** `renderPageToStage` construye su propio `Konva.Stage` sobre un `<div>` creado en memoria, nunca agregado a `document.body` — ninguna instancia ni referencia se comparte con el Stage que `createKonvaRenderer` monta en el editor.
2. **"No debe incluir selección, handles, overlays, guías ni interactividad."** Sin `selectionLayer`; `interactive: false` en el `NodeContext` de cada node (nunca se adjuntan `attachSelectionInteractions`/`attachTransformInteractions`/`attachTextEditingInteraction`, ver `baseAttrs.ts`).
3. **"La dependencia de Konva debe quedar acotada y documentada exclusivamente en el adaptador PNG."** Formalizada como un puerto: `png/pngRasterizer.ts` declara la interfaz `PngRasterizer` (sin Konva); `png/konvaPngRasterizer.ts` + `png/rasterizeProjectToPng.ts` son los ÚNICOS dos archivos de todo `@impulso/export-engine` que importan (transitivamente) `@impulso/renderer-konva`/`konva` — verificado con `madge --circular` (cero dependencias circulares) y por inspección: ningún archivo de `svg/`, `browser/`, `types.ts`, `errors.ts` ni `exportProject.ts` los importa.
4. **"El núcleo del Export Engine debe continuar siendo independiente de Konva."** Sin cambios respecto al diseño original — `svg/` sigue siendo 100% Konva-free.
5. **"SVG debe seguir generándose mediante un exportador propio basado en Document Schema."** Sin cambios — `buildSvgDocument` sigue siendo el único camino para SVG, nunca pasa por `renderPageToStage`.
6. **"La interfaz pública debe permitir reemplazar en el futuro el rasterizador PNG sin afectar a los consumidores."** `exportProject(project, resolver, options, { pngRasterizer })` acepta un `PngRasterizer` inyectado (por defecto `konvaPngRasterizer`) — ver "Estrategia de sustitución futura" más abajo.
7. **"Deben existir pruebas visuales o snapshots que comparen editor y PNG exportado en casos representativos."** `apps/sticker-builder/e2e/export-visual.spec.ts` (Playwright, navegador real — nuevo `@playwright/test` como devDependency del app, separado de los tests unitarios jsdom): compara píxeles del canvas interactivo del editor contra el PNG exportado en 3 casos (relleno de un rectángulo, relleno de una ellipse, fondo vacío) a 1x, repite la comparación a 2x, y verifica alpha=0 con fondo transparente. Corre con `pnpm --filter @impulso/sticker-builder test:e2e`, contra un build de producción real (`vite preview`).
8. **"Documenta la decisión en un ADR, incluyendo el costo de esta dependencia y la estrategia de sustitución futura."** Este documento — ver las dos secciones siguientes.

### Costo de la dependencia de Konva en el adaptador PNG
- **Superficie acotada pero real**: `@impulso/export-engine` depende de `@impulso/renderer-konva` (y transitivamente de `konva`) en su `package.json` — cualquier consumidor del Export Engine que solo necesite SVG igual instala esas dependencias (no hay un `package.json` de solo-SVG separado). Se aceptó porque el paquete completo ya es liviano y todo módulo consumidor de Impulso Engine ya depende de `@impulso/renderer-konva` para su propio editor — el costo marginal real es cero para cualquier módulo que ya edite con Impulso.
- **Portabilidad**: PNG no puede generarse en un entorno sin capacidad de canvas real (Node puro sin el paquete `canvas`, o un Worker sin OffscreenCanvas) — SVG, en cambio, sí es 100% portable (solo depende de `Blob`/`FileReader`). Este costo es inherente a producir PNG en absoluto, no específico de haber elegido Konva — cualquier alternativa (B o C evaluadas arriba) habría tenido la misma restricción.
- **Acoplamiento a las particularidades de Konva**: paridad de fidelidad (§"Fidelidad" abajo) significa que el Export Engine hereda cualquier comportamiento específico de Konva (ej. cómo trata el pivote de rotación de una Ellipse, cómo Konva.Text hace word-wrap) — un cambio de versión de Konva que altere sutilmente ese comportamiento podría, en teoría, cambiar también el PNG exportado. Mitigado por `export-visual.spec.ts` (condición 7): cualquier divergencia real entre editor y exportación se detecta ahí, no en producción.

### Estrategia de sustitución futura
El puerto `PngRasterizer` (`rasterize(project, resolver, options): Promise<RasterizePngResult>`) es el único contrato que `exportProject` conoce. Sustituir `konvaPngRasterizer` en el futuro (ej. por un rasterizador basado en `resvg`/WASM, un servicio server-side, o una versión más nueva del propio Konva con otra API) implica:
1. Escribir una nueva implementación de `PngRasterizer` (mismo archivo o uno nuevo en `png/`).
2. Inyectarla vía `exportProject(project, resolver, options, { pngRasterizer: nuevoRasterizador })`, o cambiar el default en `exportProject.ts` si reemplaza a Konva por completo.
3. Correr `export-visual.spec.ts` contra la nueva implementación — si sigue en verde, la fidelidad pixel-a-pixel con el editor está garantizada de la misma forma que hoy.

Ningún cambio en `ExportOptions`, `ExportResult`, `ExportAssetResolver`, el núcleo SVG, ni ningún caller existente (`apps/sticker-builder/src/exportDialog.ts` u otro módulo futuro) sería necesario.

### Núcleo SVG: ¿generar el `d` de un Path a mano, o reutilizar `segmentsToSvgPathData`?
`@impulso/renderer-konva` ya tenía esta función (Konva.Path también consume sintaxis `d` de SVG como su prop `data` — la traducción es literalmente la misma). Reutilizarla importando `@impulso/renderer-konva` habría acoplado el núcleo SVG (que debe ser 100% independiente de Konva) a ese paquete. Se movió `segmentsToSvgPathData` (y `toPixels`, mismo razonamiento: ambos paquetes necesitan la misma conversión física→píxeles) a `@impulso/document-schema` — el hogar natural, ya que ambas son funciones puras sobre tipos del propio Document Schema, sin ninguna dependencia de una librería de render. `renderer-konva` las re-exporta para no romper a quien ya las importaba de ahí.

### Interfaz de resolución de Assets: ¿depender de `AssetBinaryStore`, o una interfaz propia?
Se definió `ExportAssetResolver { resolve(assetId): Promise<Blob|undefined> }`, deliberadamente más angosta que `AssetBinaryStore` — el Export Engine no depende de `@impulso/asset-library` en absoluto. `apps/sticker-builder` satisface la interfaz con un adaptador de una línea (`{ resolve: (id) => binaryStore.get(id) }`). Esto deja la puerta abierta a que un futuro módulo use el Export Engine con cualquier otra fuente de binarios sin ningún cambio en este paquete.

### Escala de PNG: ¿presets 1x-4x, o un DPI/resolución arbitraria?
Se interpretó "resolución configurable" y "escala de exportación 1x-4x" (ambos mencionados en el encargo) como la MISMA idea descrita dos veces, no dos controles distintos — la V1 solo expone los 4 presets, sin un campo de píxeles/DPI arbitrario. Es la interpretación de menor superficie que cumple el criterio de aceptación ("elegir distintas escalas"), sin sobrecargar la UI con una opción avanzada que la épica no pidió explícitamente.

## Decisión tomada

### Arquitectura del paquete (`packages/export-engine`, nuevo)
```
src/
├── types.ts / errors.ts        # ExportAssetResolver, ExportOptions, ExportResult/Warning, ExportError
├── svg/                        # NÚCLEO — cero dependencia de Konva, determinista
│   ├── buildSvgDocument.ts     # Document -> string SVG (punto de entrada)
│   ├── sceneObjectToSvg.ts     # recorrido recursivo (Group incluido)
│   ├── transformToSvgAttr.ts / styleToSvgAttrs.ts / shapeMarkup.ts / textMarkup.ts
│   └── blobToDataUrl.ts        # embebe el binario de una Image como data URI
├── png/
│   ├── pngRasterizer.ts        # interfaz PngRasterizer — el puerto, sin Konva
│   ├── konvaPngRasterizer.ts   # implementación por defecto del puerto
│   └── rasterizeProjectToPng.ts # ÚNICO módulo que importa Konva (vía @impulso/renderer-konva)
└── browser/
    ├── download.ts             # triggerBrowserDownload — DOM-only, reutilizable por cualquier módulo futuro
    └── filename.ts             # sanitizeFilename
```

### El límite Renderer / Export Engine
- **SVG nunca toca Konva.** `buildSvgDocument` lee `project.document` directamente y produce un string — 100% puro, determinista, testeable sin navegador (mismo patrón `// @vitest-environment node` ya probado en Asset Library para el interop de `Blob`).
- **PNG SÍ reutiliza Konva — pero solo la pieza de dibujo, nunca el Stage del editor.** `renderPageToStage` (nueva función pública de `@impulso/renderer-konva`) construye un `Konva.Stage` desacoplado: `container` es un `<div>` que nunca se agrega al DOM visible, sin `selectionLayer`, con `interactive: false` en cada node (nunca se adjuntan handlers de drag/selección/edición de texto). Reutiliza `createSceneNode` 1:1.
- **Ninguno de los dos lee estado de edición.** Selección, handles, bounding boxes, guías, overlays de UI nunca existen en `Document` — quedan excluidos del archivo exportado por construcción, no por un filtro especial.
- **La fuente de verdad sigue siendo `Document` en ambos casos** — Konva se invoca de forma stateless (construir Stage → rasterizar → destruir) en cada exportación, nunca conserva estado entre llamadas.

### Fidelidad: paridad exacta con lo que dibuja el Renderer
- `transform.x/y` es top-left para todo tipo excepto Ellipse (que Konva posiciona/rota por su centro) — el núcleo SVG replica el mismo pivote de rotación por tipo (`transformToSvgAttr.ts`), para que una Ellipse rotada en el SVG coincida con lo que el usuario ve en el canvas.
- `Group` nunca recibe pintura propia (fill/stroke/sombra) en el Renderer actual (`createGroupNode` nunca llama a `applyShapeStyle`) — el núcleo SVG replica esa misma omisión deliberadamente (`styleToSvgAttrs({ includePaint: false })`), no es una laguna nueva.
- Un object/Layer oculto (`metadata.visible === false`) no produce ningún elemento en el SVG, ni se resuelve su asset — igual que Konva nunca dibuja un node invisible.
- Imágenes se estiran a `size.width/height` sin preservar aspect ratio (`preserveAspectRatio="none"`) — igual que `Konva.Image`, que tampoco lo preserva.
- `cropRect` de `ImageObject` (campo del schema) sigue sin usarse en ningún lado — ni el Renderer ni el Export Engine lo implementan; brecha preexistente, no introducida por esta épica.

### Casos de error y degradación controlada
- **Warnings** (la exportación SIGUE produciendo un archivo): `asset_reference_missing` (el Asset fue eliminado de la Biblioteca pero un object todavía lo referencia — comportamiento ya documentado de `removeAsset`, ver ADR-0011), `asset_binary_missing` (el descriptor existe, el Blob no está en el store). Ambos degradan a un placeholder visual (mismo rectángulo punteado que ya usa el Renderer para un asset sin resolver) y se listan en la UI.
- **Errores duros** (`ExportError`, la exportación se cancela): `no_active_page`, `invalid_filename` (nombre vacío tras sanitizar — nunca silencioso), `out_of_memory` (canvas demasiado grande: `stage.toCanvas()` lanza, o `canvas.toBlob()` devuelve `null`), `download_failed` (falla `URL.createObjectURL`/el click del `<a>`).
- `font_unavailable` está declarado en la taxonomía de warnings pero NO se emite todavía en v1 — detectarlo (`document.fonts.check(...)`) requiere DOM, y el núcleo SVG es deliberadamente DOM-mínimo; queda como mejora futura documentada, no una promesa incumplida silenciosamente (nunca se reporta un falso positivo).

### UX de exportación (`apps/sticker-builder`)
Botón "Exportar" en la barra superior + modal nuevo (`exportDialog.ts`, mismo patrón de overlay propio que `newProjectDialog.ts` — sin `<dialog>` nativo, ver ADR-0010): formato PNG/SVG, fondo transparente/sólido+color y escala 1x-4x (solo para PNG), dimensiones finales en vivo, nombre de archivo, estado "Generando…", confirmación con tamaño del archivo, warnings visibles, y errores claros sin descarga fallida silenciosa.

## Consecuencias
- `@impulso/export-engine` nace en 0.1.0. `@impulso/document-schema` gana `segmentsToSvgPathData`/`toPixels` (adición pura). `@impulso/renderer-konva` gana `renderPageToStage`/`resolveActivePage` públicos (adición pura). `@impulso/sticker-builder` 0.4.0 → 0.5.0.
- El flujo completo crear → diseñar → guardar → abrir → **exportar** queda cerrado por primera vez.
- Un futuro módulo (Planner Builder...) reutiliza `@impulso/export-engine` sin ningún cambio — la única pieza module-specific es la UI del diálogo, que cada módulo construye a su gusto sobre la misma API.
- `exportProject` gana una firma más (`dependencies: { pngRasterizer? }`), aditiva — ningún caller existente necesita cambiar.
- `apps/sticker-builder` gana `@playwright/test` como devDependency real y un script `test:e2e` — primera vez que Playwright se instala como parte del proyecto (antes, la verificación en navegador real de cada épica era manual/ad-hoc, no código committeado).

## Riesgos
- **Sin deduplicación/compresión** heredada de Asset Library — cada imagen exportada se embebe tal cual está guardada.
- **`font_unavailable` no se detecta todavía** — una fuente no instalada en el visor del SVG exportado degrada silenciosamente al fallback del navegador/app que lo abra, sin warning explícito en esta v1.
- **Ajuste automático de línea de `TextObject.size` no se reproduce en SVG** — solo se preservan saltos de línea explícitos (`\n`); ver README para el detalle.
- **Aproximación de sombra**: `feDropShadow stdDeviation ≈ shadowBlur/2` no es una equivalencia exacta con el `shadowBlur` de Canvas 2D que usa Konva.
- **PNG en escalas altas (4x) sobre documentos grandes** puede acercarse a límites reales de memoria del navegador — mitigado con el error `out_of_memory` explícito, sin una estrategia de tiling/chunking (fuera de alcance v1).

## Compatibilidad futura
- **PDF print-ready, líneas de corte, sangrado, kiss cut/die cut, presets Cricut/Silhouette**: el núcleo SVG es el punto de apoyo natural — un exportador PDF futuro reutiliza la misma serialización de escena (o el SVG ya generado, vía una librería de ensamblado PDF) sin tocar el núcleo actual. Las líneas de corte ya son, en el Document Schema, un `PathObject` cerrado con `metadata.role: "die-line"` (ver `docs/ARCHITECTURE.md` §2.4) — el Export Engine no necesita ningún concepto nuevo para reconocerlas, solo un pipeline nuevo que las trate distinto (offset de sangrado, capa de corte separada) al ensamblar el PDF.
- **ZIP de producto / exportación por lotes / thumbnails para Etsy**: se construyen naturalmente sobre `exportProject` llamado repetidas veces con distintas opciones — no requieren ningún cambio al núcleo, solo un orquestador nuevo en la capa de aplicación (o un paquete `packages/export-batch` si el caso de uso lo justifica más adelante).
- **Historial de exportaciones / exportación cloud**: son responsabilidad de la capa de aplicación/backend (persistencia de resultados), no del Export Engine — que permanece puro y sin estado, tal como el Engine central.
