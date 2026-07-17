# ADR-0005 — Canvas Runtime: primera integración end-to-end

## Problema
Los tres Foundations anteriores (Document Schema, Engine, Renderer Adapter) nunca se ejecutaron juntos en un navegador real. ¿Cómo demostrar, con el mínimo código posible, que el pipeline completo `Document Schema → Engine → Renderer → Canvas` efectivamente renderiza algo visible, sin construir todavía ninguna pieza de UI de edición?

## Contexto
- Las tres piezas del pipeline ya existen y están cerradas (Foundations 1-3), cada una con su propia API pública estable.
- La etapa "Editor" empieza aquí; el alcance explícito de este primer micro-sprint excluye Toolbar, Sidebar, Zoom, Pan, Selección, Resize, Rotación, Handles, atajos de teclado, Exportaciones y Biblioteca de Assets — es decir, no hay ninguna UI de edición que justifique todavía un framework de componentes.
- `ARCHITECTURE.md` (Foundation 0) había anticipado React 18 como parte del stack de Sticker Builder, pero esa decisión asumía que ya habría Toolbar/paneles que componer.

## Alternativas evaluadas

**Framework de UI para este runtime:**
- *Vite + React ya desde ahora*: consistente con la visión de largo plazo del stack, pero introduciría una dependencia (React + ReactDOM) sin un solo componente real que la use — este sprint no tiene Toolbar/Sidebar que componer. Se habría escrito, en la práctica, un `main.tsx` que monta un único `<div>` vacío para Konva, sin ningún beneficio de React sobre TypeScript plano.
- *Vite + TypeScript plano (sin framework de UI)*: **elegido**. `@impulso/renderer-konva` ya gestiona su propio ciclo de vida (`mount`/`destroy`) imperativamente sobre un `HTMLDivElement` — no necesita React para existir. React se incorpora en el primer sprint de Editor que realmente construya Toolbar/Sidebar (paneles, estado de UI, formularios), no antes.

**Contenido a renderizar:**
- *Cargar un documento desde algún origen externo*: no existe Persistence ni Biblioteca de Assets todavía (excluidas explícitamente) — no hay de dónde cargar nada.
- *Un Project de demostración construido en código (`createDemoProject()`)*: **elegido**. Es datos puros, validados por `ProjectSchema` igual que cualquier otro Project — no es una entidad especial ni un atajo que rompa el pipeline.

**Verificación de que "se ve" algo:**
- *Solo tests unitarios/estructurales (inspeccionar el árbol de nodos Konva, como en Foundation 3)*: prueban el cableado, pero no prueban que un navegador real efectivamente pinta píxeles — los tests de `renderer-konva` corren contra un stub de canvas que deliberadamente no dibuja.
- *Build de producción + verificación visual con un navegador real (Playwright/Chromium, ya preinstalado en este entorno)*: **elegido, además de los tests unitarios**. Es la primera vez en el proyecto que se comprueba con un navegador de verdad (no jsdom) que el `<canvas>` tiene contenido pintado — la prueba más fuerte disponible de que el runtime "funciona", no solo de que compila.

## Decisión tomada
`apps/sticker-builder`: un `main.ts` de dos líneas que monta el runtime real en el DOM, respaldado por `bootstrap.ts` (`mountCanvasRuntime(container, project?)`, testable, sin efectos secundarios de módulo) y `demoProject.ts` (el `Project` de demostración). El flujo de datos es estrictamente unidireccional: `demoProject → createEngine → createKonvaRenderer → mount(container)`; ninguna llamada nueva se agrega en sentido inverso más allá del `dragend → dispatch` que el Renderer ya traía de Foundation 3.

## Consecuencias
- Es la primera vez que las tres librerías se instalan y ejecutan juntas fuera de sus propios tests — cualquier incompatibilidad de resolución de módulos entre ellas (como la de Konva "browser" vs "main" en Foundation 3) se manifestaría aquí primero.
- El drag heredado de Foundation 3 sigue activo (ningún object del demo está `locked`) — no se construyó ninguna interacción nueva, pero tampoco se desactivó una capacidad que el Renderer ya tenía aprobada; deshabilitarla habría sido modificar el paquete de Foundation 3 sin que se pidiera.
- No se modifica la API pública de `document-schema`, `engine` ni `renderer-konva` — la regla de Stable Public API no aplica ningún ADR de cambio en este sprint porque no hay cambio que documentar.

## Riesgos
- El Project de demostración vive hardcodeado en código — el día que exista una Biblioteca de Assets o Persistence real, este demo debería reemplazarse o quedar como fixture de desarrollo, no como el único contenido que el runtime sabe mostrar.
- Sin Zoom/Pan, el tamaño del Stage es exactamente el tamaño físico de la página convertido a píxeles (vía `toPixels`, Foundation 3) — un documento más grande que la ventana simplemente se corta, sin scroll ni ajuste. Aceptable para este sprint (no se pidió Zoom/Pan); sería un problema real si el runtime se usara con documentos grandes antes de que exista esa funcionalidad.

## Compatibilidad futura
`bootstrap.ts` expone `{ engine, renderer }` explícitamente para que el próximo sprint (Toolbar/Sidebar, u otra integración de UI) pueda conectar controles reales al mismo Engine sin rehacer el cableado — solo agregar componentes que llamen a `engine.dispatch(...)` y lean `engine.subscribe(...)`.

## Rendimiento
No se introduce ninguna decisión de rendimiento nueva — este sprint reutiliza el pipeline tal cual quedó en Foundations 1-3. El Project de demostración es intencionalmente pequeño (unos pocos objects) precisamente para no ejercitar todavía los cuellos de botella ya documentados en `../PERFORMANCE_BUDGET.md` (filas 1, 2 y 4) — esa validación de rendimiento con documentos grandes queda para cuando exista una forma real de generar/cargar documentos de ese tamaño (Biblioteca de Assets o Persistence).
