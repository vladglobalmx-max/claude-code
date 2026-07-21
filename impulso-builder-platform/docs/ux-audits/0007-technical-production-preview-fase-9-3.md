# UX Audit 0007 — Technical Production Preview Foundations (Epic 9 / Fase 9.3)

> Auditoría de cierre de Fase 9.3, mismo proceso que 0001-0006. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** ÚNICAMENTE el preview técnico construido en Fase 9.3 (`apps/sticker-builder/src/printPreviewHarness.ts` + `print-preview-harness.html`) — sus toggles de overlays, funcionamiento con teclado, labels/estado accesible, resumen textual equivalente, zoom, diferenciación visual de Trim/Bleed/Media/Safe/Cut Path, dependencia de color, legibilidad, y limitaciones conocidas. **No es una evaluación de una UI final de producto** — el harness es explícitamente temporal (ningún flujo de usuario navega a él) y esta auditoría existe para que sus recomendaciones alimenten directamente el diseño del Production Preview real de Fase 9.4, no para calificarlo como si fuera ya una pantalla terminada. No cubre el resto del pipeline de impresión (raster, PDF, Preflight en sí — ya evaluados en su propia dimensión técnica en ADR-0023), ni ningún aspecto del flujo de exportación de producto (Fase 9.4).

---

## 1. Lo que funciona muy bien

- **La geometría del preview es idéntica a la de exportación, verificado programáticamente, no solo argumentado** — el harness reutiliza literalmente las mismas funciones puras exportadas por `@impulso/print-engine` (`computeBoxes`, `computeCropMarksGeometry`, `computeSafeAreaCanonicalRect`, `resolveDieLineSource`/`normalizeCutGeometry`/`applyCutGeometryOffset`/`cutGeometryToPathSegments`, `cropMarkSegmentToRaster`/`cutPathSegmentsToRaster`/`canonicalPointToRasterPoint`) — no existe ninguna reimplementación aproximada de la geometría en la capa de UI. Esto es exactamente la garantía que Fase 9.4 necesita heredar sin reconstruirla.
- **Los 4 boxes rectangulares (MediaBox/BleedBox/TrimBox/Safe Area) se diferencian por un patrón de trazo distinto ADEMÁS del color** (`stroke-dasharray`: `2 2`/`6 3`/sólido/`1 4`) — un usuario con daltonismo puede distinguirlos entre sí sin depender únicamente del color, un acierto real de accesibilidad que no es automático (fácil de pasar por alto al diseñar overlays técnicos).
- **Cada toggle es un checkbox nativo con `<label>` envolvente y `aria-controls` apuntando al grupo SVG correspondiente** — funciona con teclado sin ningún JavaScript adicional (Tab/Espacio), y el estado (marcado/desmarcado) es inherentemente expuesto a tecnología asistiva por ser un control nativo, no un `div` con `onclick`.
- **El resumen textual (`<dl>`) es una alternativa real, no decorativa, al canvas/SVG** — el contenedor visual completo está marcado `aria-hidden="true"` precisamente porque este resumen (tamaño final, sangrado, safe area, marcas, cut path detectado, warnings) cubre la información esencial sin depender de la percepción visual.
- **La inmutabilidad del Project se verifica programáticamente, no se asume** — el harness compara el `Project` antes/después vía `JSON.stringify` y cuenta eventos `projectChanged` del Engine, exponiendo ambos en `window.__printPreviewHarness` para que el E2E lo confirme en cada corrida, exactamente el mismo rigor que ya se aplicó a los exportadores en Fase 9.2.
- **El zoom es puramente una transformación CSS (`transform: scale()`) sobre el contenedor, nunca recalcula ni vuelve a pedir geometría** — separación limpia entre "cómo se ve" y "qué es", que Fase 9.4 puede heredar sin cambios para su propio control de zoom.

## 2. Lo que puede mejorar

- **Crop Marks y Cut Path se diferencian ÚNICAMENTE por color entre sí y respecto al TrimBox** — las marcas de corte (negro, línea sólida), el cut path (magenta, trazo sólido) y el TrimBox (verde, trazo sólido) comparten el mismo estilo de línea continua; a diferencia de los 4 boxes rectangulares (que sí tienen `stroke-dasharray` distintos), estos tres elementos son indistinguibles entre sí para un usuario que no perciba color con precisión. Es la brecha de accesibilidad más concreta encontrada.
- **El resumen textual de Preflight muestra códigos técnicos, no los mensajes ya redactados para humanos** — `object_crosses_safe_area (warning)` en vez de reutilizar el `message`/`recommendation` que el propio `PreflightIssue` ya trae (ej. "Un object cruza el límite del safe area — podría recortarse..."). El dato friendly ya existe en el objeto, simplemente no se usa en el resumen.
- **El zoom no expone su valor actual como texto visible** — el `<input type="range">` no tiene un elemento asociado que muestre "150%" mientras se arrastra; el valor solo vive en el `value` del control, no siempre anunciado de forma legible por un lector de pantalla durante el arrastre, y tampoco visible para un usuario vidente sin fijarse en la posición exacta del slider.
- **El origen de la transformación de zoom es la esquina superior-izquierda (`transform-origin: top left`), sin ningún control de paneo** — al hacer zoom más allá del viewport visible, el contenido se desplaza hacia abajo-derecha sin ninguna forma de recentrar salvo el scroll nativo del contenedor; no hay "Fit sheet" ni "100%" como acciones directas, solo el valor numérico del slider.
- **El preview siempre muestra un único proyecto de demostración fijo, construido internamente** (`buildDemoProject`) — nunca refleja el `Project` real que un usuario estaría editando. Es coherente con ser un harness de verificación técnica, pero significa que ninguna de sus interacciones (toggles, zoom) fue validada todavía contra contenido variable/real, incluyendo múltiples páginas.
- **Los labels de los toggles se calculan una sola vez al cargar** (ej. "Crop Marks (8 segmentos)") — no reflejan un recuento que pudiera cambiar dinámicamente si la configuración se editara en vivo; aceptable en un harness estático de una sola pasada, pero un patrón a evitar si el Production Preview real permite editar configuración sin recargar todo el componente.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un patrón de trazo distinto (`stroke-dasharray`) a Crop Marks y Cut Path, para que los 6 overlays completos se diferencien sin depender de color — mismo patrón ya usado en los 4 boxes.
2. Mostrar el `message` (no el `code`) de cada `PreflightIssue` en el resumen textual — el dato ya existe, es un cambio de qué campo se interpola.
3. Agregar un `<output>` o `<span>` junto al slider de zoom mostrando el porcentaje actual como texto (`aria-live="polite"` opcional, sin anunciar cada movimiento continuo — solo el valor final tras soltar).

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Controles "Fit sheet"/"100%" explícitos**, además del slider libre — el enunciado de Fase 9.4 (sección 22) ya los exige para el Production Preview real; el harness de Fase 9.3 puede servir de base pero no los tiene.
2. **Paneo del contenido cuando el zoom excede el viewport** — hoy solo existe el scroll nativo del contenedor; un control de "centrar" (también exigido en Fase 9.4, sección 22) evitaría perder de vista la hoja tras hacer zoom.
3. **Recalcular labels de toggles reactivamente** si el Production Preview real permite cambiar configuración sin recargar todo el componente (a diferencia de este harness, que solo renderiza una vez).

## 5. Cambios grandes (esperar Fase 9.4, ya en su propio alcance aprobado)

1. **El preview debe operar sobre el `Project`/`PrintJob` real del usuario, con navegación entre páginas/hojas** — hoy es un demo fijo de una sola página; Fase 9.4 ya lo exige explícitamente (número de hoja, cantidad de hojas, navegación siguiente/anterior).
2. **Verificación de accesibilidad de `role="img"` anidado dentro de un SVG contenedor** — cada overlay usa `<g role="img" aria-label="...">`, una técnica razonable pero cuyo soporte real varía entre lectores de pantalla; Fase 9.4 debería verificar esto con una herramienta de accesibilidad real (no solo inspección de código) antes de asumir que el resumen textual paralelo es estrictamente necesario o solo un refuerzo.

---

**Nota de alcance:** esta auditoría evalúa exclusivamente el harness técnico temporal de Fase 9.3 — no implica que el Production Preview de Fase 9.4 deba ser una extensión literal de este código (puede reconstruirse), solo que debe **preservar exactamente su garantía central**: la misma geometría pura que usan los exportadores reales, nunca una aproximación paralela calculada en la capa de UI.
