# @impulso/sticker-builder — Canvas Runtime

> EDITOR 1 de Impulso Builder Platform. Primera integración end-to-end del pipeline completo: `Document Schema → Engine → Renderer → Canvas`. Ver [ADR-0005](../../docs/adr/0005-canvas-runtime.md) para el razonamiento completo.

**Estado:** runtime mínimo completo. Desde Editor 2 hereda selección por click (click selecciona/cambia, Shift-click selecciona múltiple, click en vacío deselecciona) y desde Editor 3 hereda movimiento por arrastre integrado con la selección (arrastrar sin click previo selecciona y mueve a la vez) — ver [`@impulso/renderer-konva`](../../packages/renderer-konva/README.md#5-ux-regla-permanente-ux-first-desde-editor-2), sin ningún código adicional en esta app: son capacidades del Renderer, no de este runtime. Sigue sin implementar Toolbar, Sidebar, Zoom, Pan, Resize, Rotación, Handles, guías, snapping, atajos de teclado, Exportaciones ni Biblioteca de Assets.

---

## 1. Qué es y qué no es

- **Sí hace:** monta un `<canvas>` visible en la página y demuestra que un `Project` (Document Schema) fluye, sin atajos, a través de `@impulso/engine` y `@impulso/renderer-konva` hasta convertirse en píxeles reales en el navegador.
- **No hace:** no tiene ninguna UI de edición todavía — ni un botón, ni un panel. El único contenido que muestra es un `Project` de demostración construido en código (no hay de dónde más cargarlo: no existe Persistence ni Biblioteca de Assets).

## 2. Árbol

```
apps/sticker-builder/
├── package.json / tsconfig.json / vite.config.ts / vitest.config.ts
├── index.html                 # <div id="canvas-runtime"> + <script src="/src/main.ts">
├── README.md / CHANGELOG.md
└── src/
    ├── main.ts                 # entry point real: DOM -> mountCanvasRuntime (sin lógica propia)
    ├── bootstrap.ts             # mountCanvasRuntime(container, project?) — testable, el cableado real
    ├── demoProject.ts           # Project de demostración (rectangle + ellipse + text)
    └── testing/
        └── fakeCanvasContext.ts # stub de canvas 2D para tests (jsdom no implementa uno real)

    (8 tests, 100% de cobertura — y verificado además en un navegador real, ver §4)
```

## 3. El flujo unidireccional

```
demoProject (Document Schema)
     │
     ▼
createEngine(project)              -- @impulso/engine
     │
     ▼
createKonvaRenderer(engine)        -- @impulso/renderer-konva
     │
     ▼
renderer.mount(container)          -- Canvas real en el DOM
```

`bootstrap.ts` es el único lugar que conecta las tres piezas — y lo hace exclusivamente a través de sus APIs públicas ya existentes, sin tocar ninguna de ellas. `main.ts` es la única pieza con efectos de módulo (llama a `mountCanvasRuntime` contra el DOM real de `index.html`); todo lo demás es testable sin un navegador.

## 4. Cómo se verificó (no solo tests unitarios)

Además de los tests (jsdom + stub de canvas, igual que `renderer-konva`), se hizo el build de producción (`vite build`) y se cargó en un **Chromium real** (Playwright) para confirmar con píxeles reales, no solo estructura de nodos:

- El `<canvas>` montado mide 320×320px (el tamaño de la página del demo).
- El color de fondo muestreado en una esquina es exactamente `#fef08a` (el fill del rectángulo).
- El texto "Impulso" aparece centrado sobre la insignia naranja, en el orden de capas correcto.
- Fuera de las formas, el canvas es transparente (`rgba(0,0,0,0)`).

Esta es la primera vez en el proyecto que se comprueba con un navegador real (no un stub) que el pipeline pinta algo — ver ADR-0005.

## 5. Desarrollo

```bash
pnpm --filter @impulso/sticker-builder dev      # servidor de desarrollo
pnpm --filter @impulso/sticker-builder build     # build de producción
pnpm --filter @impulso/sticker-builder test       # tests
```

## 6. Riesgos y fuera de alcance

Ver ADR-0005. En resumen: el Project de demostración está hardcodeado (no hay otra fuente de contenido todavía); sin Zoom/Pan, un documento más grande que el Stage simplemente se corta. El drag heredado de Foundation 3 (Renderer) sigue activo — no se construyó ninguna interacción nueva en este sprint, pero tampoco se deshabilitó una capacidad ya aprobada del Renderer.
