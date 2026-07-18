# Changelog — @impulso/sticker-builder

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

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
