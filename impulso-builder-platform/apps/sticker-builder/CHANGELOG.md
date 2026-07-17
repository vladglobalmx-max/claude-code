# Changelog — @impulso/sticker-builder

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Editor 1: Canvas Runtime

### Agregado
- `mountCanvasRuntime(container, project?)`: cableado end-to-end del pipeline `Document Schema → Engine → Renderer → Canvas`, usando exclusivamente las APIs públicas ya existentes de `@impulso/document-schema`, `@impulso/engine` y `@impulso/renderer-konva`.
- `createDemoProject()`: Project de demostración (rectangle + ellipse + text) para tener contenido que renderizar sin depender de Persistence ni de una Biblioteca de Assets, ninguna de las dos construida todavía.
- `index.html` + `main.ts`: runtime real montado en el navegador vía Vite (sin framework de UI — no hay Toolbar/Sidebar que justifique React todavía, ver ADR-0005).
- 8 tests, 100% de cobertura, sin dependencias circulares.
- Verificación adicional en un navegador real (Chromium vía Playwright) confirmando píxeles renderizados, no solo estructura de nodos.

### Fuera de alcance (deliberado)
Toolbar, Sidebar, Zoom, Pan, Selección, Resize, Rotación, Handles, atajos de teclado, Exportaciones, Biblioteca de Assets.
