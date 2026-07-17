# ADR-0004 — Renderer Adapter: primer adaptador Konva

## Problema
El Engine (ADR-0003) define un contrato conceptual `RendererAdapter` pero no tiene ninguna implementación real. ¿Cómo construir el primer adaptador concreto — Document Schema → Scene Graph → Konva, y eventos de Konva → Engine — sin que se filtre a `document-schema` ni a `engine` ninguna dependencia de Konva, y sin construir todavía UI/selección visual/zoom/pan/export (explícitamente fuera de este Foundation)?

## Contexto
- ADR-0001 exige que Konva quede confinado a un único paquete.
- El Engine ya expone `getProject()`, `getSelection()`, `dispatch()`, `subscribe()` — el Renderer debe consumir esa API tal cual, sin pedirle cambios.
- El Document Schema (ADR-0002) modela `SceneObject` como 6 tipos genéricos (rectangle/ellipse/path/image/text/group); el path es un array de segmentos propio, no un string SVG.
- Alcance explícito de este Foundation: sin Canvas UI, Toolbar, Sidebar, Zoom, Pan, Resize, Handles, Selection visual, Exportaciones. La única interacción a demostrar es "arrastrar mueve el object" (la prueba mínima de "eventos de Konva → llamadas al Engine").

## Alternativas evaluadas

**Testing sin navegador real:**
- *`canvas` (node-canvas, nativo)*: es como Konva recomienda correr en Node, pero requiere cairo/pango del sistema — no compila en este entorno (confirmado empíricamente: falla el `node-gyp build` por falta de `pangocairo`). Descartado por no ser portable/reproducible.
- *`vitest-canvas-mock`*: paquete hecho para este caso exacto, pero exige `vitest@^3 || ^4` — incompatible con `vitest@^2` ya usado en todo el monorepo. Actualizar vitest en los 3 paquetes solo para esto no se justificó.
- *Stub propio de `CanvasRenderingContext2D`*: ~70 líneas, cero dependencias nativas ni de versión. **Elegido.** Verificado con un spike antes de escribir el paquete real: Konva construye Stage/Layer/Shape/Group, dibuja y dispara eventos sintéticos (`.fire('dragend')`) sin throw.

**Mapeo Document-Layer → Konva:**
- *1 `Konva.Layer` por cada Layer del Document*: mapeo más "directo", pero cada `Konva.Layer` es un canvas real — Konva documenta explícitamente que tener muchos Layers es un antipatrón de rendimiento. Un documento con decenas de Layers (razonable en un editor tipo Photoshop) crearía decenas de canvases.
- *Un único `Konva.Layer`, Document-Layer → `Konva.Group`*: **elegido**. Un solo canvas real por Stage, sin importar cuántas Layers tenga el documento; la jerarquía del Document Schema se preserva como agrupación lógica (Group), no como recurso de render.

**Reconciliación (Project nuevo → árbol Konva):**
- *Diff incremental por id (crear/actualizar/eliminar solo lo cambiado)*: más eficiente, pero significativamente más código y una fuente de bugs sutiles (ver Riesgos) sin evidencia todavía de que el rebuild completo sea un problema real.
- *Rebuild completo en cada `projectChanged`*: **elegido**. Simple, correcto, fácil de testear. Es la aplicación directa de la regla "no optimizar prematuramente" del nuevo Performance Budget — el costo se documenta explícitamente (ver sección Rendimiento) en vez de ignorarse.

**Formato del path vectorial:**
- Konva.Path exige un string SVG "d" — el Document Schema guarda `PathSegment[]` (ADR-0002, deliberadamente no-SVG). Se implementó `segmentsToSvgPathData()` como la traducción explícita que le corresponde al Renderer — es exactamente el tipo de conversión que justifica que exista un adaptador.

## Decisión tomada
`createKonvaRenderer(engine, options): RendererAdapter` con `mount(container)`, `destroy()`, `getStage()`. Internamente:
- Un mapeo 1:1 de cada uno de los 6 tipos de `SceneObject` a un constructor Konva (`nodes/*.ts`), con un dispatcher (`sceneNode.ts`) que resuelve `group` recursivamente.
- `applyBaseAttrs` centraliza transform/opacity/visible/locked/blendMode y es el único lugar que traduce un evento Konva (`dragend`) en `engine.dispatch({type: "updateObjectTransform", ...})`.
- `toKonvaXY`/`fromKonvaXY` aíslan la única inconsistencia de coordenadas real (Konva.Ellipse posiciona por el centro; el resto por la esquina superior izquierda, igual que el Document Schema).
- Sin `resolveAssetSource` inyectado, `ImageObject` se dibuja como placeholder (rectángulo punteado) — no hay gestión de Assets todavía.
- Si el Engine rechaza un `dispatch` de drag, se fuerza un `render()` para revertir la posición visual al estado canónico.

## Consecuencias
- `@impulso/renderer-konva` es, a propósito, el único paquete de la plataforma con `konva` en `dependencies` y con `"DOM"` en su `lib` de TypeScript.
- No contiene reglas de negocio ni conoce Sticker Builder: cualquier `metadata.role` (ej. `"die-line"`) es invisible para este paquete — dibuja un `path`, nada más.
- El paquete es "publicable de forma independiente" (regla permanente): su `package.json` declara sus propias dependencias (`@impulso/document-schema`, `@impulso/engine`, `konva`), sin asumir nada del resto del monorepo.

## Riesgos
- **Rebuild completo por render** es el riesgo de rendimiento principal — ver sección Rendimiento.
- El stub de canvas de testing es una aproximación (no dibuja píxeles reales); un bug de Konva que solo se manifieste al pintar realmente no lo detectaría esta suite. Se acepta porque el objetivo de Foundation 3 es la ESTRUCTURA del árbol y la traducción de eventos, no el resultado visual en sí.
- `fontStyle` de Konva.Text no tiene un equivalente 1:1 al `fontWeight` numérico (100-900) del Document Schema — se aproxima con un umbral (`>=700` → "bold"), una simplificación con pérdida de fidelidad documentada en el código.
- Depender del campo clásico `"browser"` de `package.json` de Konva (en vez de `exports` moderno) para resolver correctamente en Vite/Vitest es un detalle de configuración (`resolve.mainFields`) que un consumidor con un bundler distinto tendría que replicar si no usa Vite.

## Compatibilidad futura
- El punto de extensión para Assets ya existe (`resolveAssetSource`) sin necesitar rediseño cuando exista esa Foundation.
- `KonvaRendererOptions.pageId` deja espacio para una futura API de "página activa" dinámica sin cambiar la forma del contrato.
- Nada aquí le impide a un futuro `renderer-pixi`/`renderer-svg` implementar el mismo `RendererAdapter` (`mount`/`destroy`/`getStage` — este último naturalmente distinto por tecnología) sin tocar `engine`.

## Rendimiento

- **Complejidad aproximada:** cada `render()` es O(m), donde m = total de `SceneObject` en la página activa (recorre y recrea todo el árbol Konva de esa página, sin importar el tamaño real del cambio).
- **Cuellos de botella posibles:** en un documento con miles de objects, CUALQUIER comando exitoso (mover un solo rectángulo, renombrar una layer) dispara un `projectChanged` que destruye y recrea TODOS los nodos Konva de la página activa. Es, con diferencia, el cuello de botella más probable para la meta declarada de "documentos grandes sin degradar la experiencia".
- **Estrategia de optimización futura (no implementada):** reconciliación incremental — diffear el árbol de `SceneObject` anterior contra el nuevo por `id` y solo crear/actualizar/eliminar los nodos Konva que realmente cambiaron, en vez de un rebuild completo. Esto se beneficiaría de resolver primero la fila 3 del Performance Budget (los `group` en el Engine pierden la igualdad referencial en cada cambio, en cualquier parte del documento), o alternativamente diffear por id + comparación estructural superficial en vez de por referencia. Ver `../PERFORMANCE_BUDGET.md`, filas 4 y 5, para el registro completo.
