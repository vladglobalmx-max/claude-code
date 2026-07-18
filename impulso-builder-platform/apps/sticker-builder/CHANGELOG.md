# Changelog — @impulso/sticker-builder

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.5.0] — Epic 3: Export Engine Foundation

### Agregado
- Botón "Exportar" en la barra superior + `exportDialog.ts` (mismo patrón de overlay propio que `newProjectDialog.ts`, ver ADR-0010): formato PNG/SVG, fondo transparente/sólido+color y escala 1x-4x (PNG), dimensiones finales en vivo, nombre de archivo, estado de procesamiento, confirmación de descarga con tamaño del archivo, warnings de Assets no resueltos y errores claros sin descarga fallida silenciosa.
- Se apoya en `@impulso/export-engine` (paquete nuevo, ver ADR-0012): `exportProject`/`sanitizeFilename`/`triggerBrowserDownload`, adaptando `AssetBinaryStore.get` a `ExportAssetResolver` con una línea.
- 16 tests nuevos (202 en total), ~99.2%/93.7%/95%/~99.2% de cobertura.

### Fuera de alcance (deliberado)
PDF/línea de corte/sangrado, detección de fuente no disponible, exportación por lotes — ver README de `@impulso/export-engine`.

## [0.4.0] — Epic 2: Asset Library

### Agregado
- Panel "Assets" (`assetsPanel.ts`) en el Sidebar izquierdo, junto al panel de Capas (tabs) — grilla de miniaturas, botón "Subir imagen", click para insertar un Asset ya existente sin volver a subirlo, botón de eliminar por Asset.
- `assetResolution.ts`: `ResolvedAssetCache`, el puente síncrono entre el `AssetBinaryStore` (asíncrono) y el contrato síncrono `resolveAssetSource` del Renderer (Foundation 3) — gestiona el ciclo de vida de `HTMLImageElement` + Object URL. `preloadDocumentAssets` recorre `document.assets` y resuelve cada uno antes de montar/remontar el runtime.
- `legacyMigration.ts`: migración transparente y de una sola vez de proyectos guardados en el formato de Epic 1 (imagen embebida como data URL en `customProperties.impulsoImageDataUrl`) al nuevo modelo de Asset Library — convierte a `Blob`, lo guarda en el `AssetBinaryStore`, crea el `ImageAsset` real, limpia la `customProperty` legada. "Abrir" ejecuta la migración automáticamente y reporta cuántas imágenes se migraron.
- `tools.ts` gana `uploadAsset(file)` (solo sube a la biblioteca, sin insertar — usado por el panel Assets) e `insertImageFromAsset(assetId)` (inserta un Asset ya existente sin re-subir).
- `app.ts`: nuevas dependencias inyectables `binaryStore`/`keyboardTarget` (esta última resuelve un bug real de contaminación entre tests, ver abajo); tabs de Sidebar Layers/Assets; `doOpen()` ejecuta la migración legada antes de remontar.
- Se apoya en `@impulso/asset-library` (paquete nuevo, ver ADR-0011) y en `Document.assets`/`AssetSchema` (`@impulso/document-schema` 0.2.0) y en los comandos `addAsset`/`removeAsset`/`renameAsset` (`@impulso/engine` 0.5.0).
- 25 tests nuevos (186 en total), ~99.8%/94%/96%/~99.8% de cobertura.

### Eliminado
- `imageAssets.ts`/`imageAssets.test.ts` (hack de Epic 1: cache de imágenes en memoria sin Asset Library real) — reemplazados por `assetResolution.ts` + `@impulso/asset-library`.

### Corregido
- Bug de contaminación entre tests: instancias de `App` nunca destruidas entre tests permanecían suscritas a `window`'s `keydown`, provocando que un despacho de evento en un test tardío disparara `doOpen()` en instancias de tests ya completados (con sus stubs de `URL`/`Image` ya revertidos), causando un rechazo no manejado (`URL.revokeObjectURL is not a function`, ausente en el `URL` nativo de jsdom). Corregido agregando `keyboardTarget` como dependencia inyectable de `App` (default a `window` en producción), permitiendo que cada test use un `EventTarget` aislado.

### Fuera de alcance (deliberado)
Deduplicación de Assets, compresión, tipos de Asset más allá de `image` (fuentes, plantillas, íconos, etc. — el modelo ya los admite, ver ADR-0011), validación de Assets huérfanos (sin ninguna referencia), carga perezosa de Assets (`preloadDocumentAssets` resuelve todos al abrir/remontar).

## [0.3.0] — Epic 1: Sticker Creation Experience

### Agregado
- `app.ts`: orquestador central que reemplaza a `toolbar.ts` — cablea `bootstrap.ts` (Canvas Runtime), el panel de capas, el Inspector, el zoom, las herramientas Texto/Imagen, el diálogo de proyecto nuevo, y los atajos de teclado, junto con las acciones de Duplicar/Eliminar/Agrupar/Desagrupar/Reordenar/Nudge. Mantiene el patrón de Nuevo/Abrir de ADR-0009 (destruir y remontar el runtime completo), extendido con precarga asíncrona de imágenes embebidas.
- `projectPresets.ts`: 3 presets curados de tamaño de sticker (cuadrado, circular, rectangular) + `createProjectFromSize()`.
- `newProjectDialog.ts`: diálogo modal de "Nuevo proyecto" (presets + tamaño personalizado).
- `imageAssets.ts`: cargar un `File` (PNG/SVG) como imagen, cache en memoria (`ImageAssetCache`), y precarga (`preloadProjectImages`) al abrir un proyecto guardado — sin una Asset Library real (ver ADR-0010).
- `tools.ts`: acciones "Agregar texto"/"Agregar imagen" (insertan centrado en la página, sin modo de colocación) + botones de la barra de herramientas.
- `zoom.ts`: zoom vía `transform: scale(...)` CSS — presets 25/50/100/200%, "Ajustar a pantalla", rueda del mouse + Ctrl/Cmd.
- `layersPanel.ts`: panel de capas completo — reordenar por drag-and-drop, expandir/colapsar Groups (hijos solo informativos, ver ADR-0010), renombrar inline, ocultar, bloquear.
- `inspector.ts`: Sidebar derecha — Transformar/Apariencia/Texto/Metadata, adaptado a la selección (0/1/2+ objects).
- `keyboardShortcuts.ts`: mapa de atajos de teclado (V/T/I, Supr, Ctrl/Cmd+D/G/Shift+G/Z/Shift+Z/S/O/A, Escape, flechas, Ctrl/Cmd+[/]) desacoplado del Engine.
- `index.html`/`main.ts` reescritos con el layout completo (barra superior, tools-bar, capas | canvas | inspector, diálogo de proyecto nuevo).
- 3 comandos nuevos en `@impulso/engine` (`updateObjectContent`, `groupObjects`, `ungroupObject`) y edición de texto in-canvas en `@impulso/renderer-konva` (ver sus propios CHANGELOGs) usados por esta épica.
- Flujo completo (crear → diseñar → guardar → abrir → editar sin pérdida de información) verificado en Chromium real, sin errores de consola. Durante esa verificación se encontró y corrigió un bug real: el panel de capas reconstruía todo su DOM en cada cambio de selección, rompiendo la detección nativa de doble-click del navegador para el renombrado inline (ver ADR-0010, §"Reconstrucción del panel de capas").
- 131 tests nuevos (161 en total), ~99.8% de cobertura.

### Eliminado
- `toolbar.ts`/`toolbar.test.ts` (Milestone 1) — reemplazados por `app.ts`.

### Fuera de alcance (deliberado)
IA, Exportación, Marketplace, Usuarios, Cloud, Plantillas, Mockups, una Librería de Assets real, Plugins, múltiples Pages/Layers expuestas en la UI, "entrar" a un Group, modo de herramienta persistente para Texto/Imagen.

## [0.2.0] — Milestone 1: Impulso Alpha

### Agregado
- `persistence.ts`: `saveProjectLocally`/`loadProjectLocally`/`hasLocalProject`/`clearLocalProject`, guardando un único `Project` en `localStorage` vía `serializeProject`/`deserializeProject` (`@impulso/document-schema`, sin cambios). Ver ADR-0009.
- `toolbar.ts` + barra de 5 botones en `index.html`: Nuevo, Deshacer, Rehacer, Guardar, Abrir. "Nuevo"/"Abrir" destruyen el `RendererAdapter` actual y montan uno nuevo con un Project fresco/cargado — cero cambios en `@impulso/engine` ni `@impulso/renderer-konva`.
- Primera versión ejecutable de punta a punta: crear, mostrar, renderizar, seleccionar, mover, redimensionar, rotar, deshacer, rehacer, guardar localmente y volver a abrir un documento — todo verificado en un Chromium real, incluyendo una recarga de página real entre Guardar y Abrir.
- 22 tests nuevos (30 en total), 100% de cobertura.

### Fuera de alcance (deliberado)
Toolbar/Sidebar/Inspector/Layers Panel con diseño real, Zoom, Pan, Exportaciones, gestión de Assets, crear objects desde la UI, múltiples documentos guardados.

## [0.1.0] — Editor 1: Canvas Runtime

### Agregado
- `mountCanvasRuntime(container, project?)`: cableado end-to-end del pipeline `Document Schema → Engine → Renderer → Canvas`, usando exclusivamente las APIs públicas ya existentes de `@impulso/document-schema`, `@impulso/engine` y `@impulso/renderer-konva`.
- `createDemoProject()`: Project de demostración (rectangle + ellipse + text) para tener contenido que renderizar sin depender de Persistence ni de una Biblioteca de Assets, ninguna de las dos construida todavía.
- `index.html` + `main.ts`: runtime real montado en el navegador vía Vite (sin framework de UI — no hay Toolbar/Sidebar que justifique React todavía, ver ADR-0005).
- 8 tests, 100% de cobertura, sin dependencias circulares.
- Verificación adicional en un navegador real (Chromium vía Playwright) confirmando píxeles renderizados, no solo estructura de nodos.

### Fuera de alcance (deliberado)
Toolbar, Sidebar, Zoom, Pan, Selección, Resize, Rotación, Handles, atajos de teclado, Exportaciones, Biblioteca de Assets.
