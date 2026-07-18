# 02 — Product Principles

> Estos principios guían toda decisión futura — de producto y de arquitectura. Cuando dos opciones compitan, la que respete mejor estos principios gana, incluso si la otra es más rápida de construir hoy. Ver [`01-Product-Vision.md`](01-Product-Vision.md) para el contexto de negocio detrás de estos principios.

---

## Simplicidad

**Qué significa:** la opción correcta es la más simple que resuelve el problema real, no la más simple de escribir ni la más "impresionante" técnicamente. Simplicidad para el USUARIO primero; simplicidad de implementación cuando no compite con eso.

**Ejemplos ya aplicados:**
- El Document Schema modela solo 6 tipos de objeto genéricos (rectangle/ellipse/path/image/text/group) en vez de un tipo especial por cada necesidad de módulo — lo específico se expresa con `metadata.role`, no inventando complejidad nueva (ADR-0002).
- Editor 1 (Canvas Runtime) usó TypeScript plano en vez de React porque no había todavía ningún Toolbar/Sidebar que justificara un framework de UI — se evitó complejidad especulativa (ADR-0005).
- Milestone 1 (Alpha) usa `localStorage` con un único slot de guardado en vez de una base de datos local con multi-documento, porque eso es lo mínimo que responde a "guardar y volver a abrir" (ADR-0009).

## Velocidad

**Qué significa:** tanto velocidad de desarrollo (no bloquearse en decisiones perfectas cuando una decisión suficientemente buena y reversible existe) como velocidad de producto (la app se siente instantánea para quien la usa).

**Ejemplos ya aplicados:**
- Metodología de micro-sprints con aprobación explícita en cada paso — evita construir semanas de funcionalidad en una dirección equivocada antes de validar.
- Resize/rotación se previsualizan en tiempo real moviendo el nodo Konva directamente, sin pasar por el ciclo completo de validación del Engine en cada frame de arrastre — solo se confirma una vez, al soltar (ADR-0007, ADR-0008, "Rendimiento").

## Calidad comercial

**Qué significa:** el resultado debe sentirse y funcionar como un producto que alguien pagaría por usar, no como un prototipo. Esto aplica tanto a la experiencia visible (interacciones fluidas, sin errores) como a lo invisible (código mantenible, testeado, documentado) — un producto de clase mundial no se sostiene sobre una base fràgil.

**Ejemplos ya aplicados:**
- Estándar permanente desde Foundation 2: todo paquete debe compilar sin errores, tener pruebas automatizadas, evitar `any`, mantener API pública estable, y alcanzar 90% de cobertura mínima (`docs/ENGINEERING_STANDARDS.md`).
- Cada decisión arquitectónicamente relevante se documenta en un ADR (Problema/Contexto/Alternativas/Decisión/Consecuencias/Riesgos/Compatibilidad futura) — nueve hasta la fecha (`docs/adr/`).
- Verificación en navegador real (Playwright/Chromium), no solo tests con stubs, antes de dar por completo cualquier sprint que toque interacción de usuario.

## Modularidad

**Qué significa:** el núcleo (Impulso Engine) no sabe nada específico de ningún módulo. Un módulo nuevo se agrega sin reescribir lo que ya existe, y un cambio en un módulo no puede romper otro.

**Ejemplos ya aplicados:**
- Arquitectura de cuatro niveles con dependencia en una sola dirección: `Document Schema → Engine → Renderer → Konva` (ADR-0001) — verificada activamente con `madge --circular` en cada paquete, no solo declarada.
- `packages/engine/package.json` no tiene a Konva como dependencia — un cambio de librería de render no tocaría el Engine en absoluto.
- La lógica de manipulación (resize/rotación) vive enteramente en el Engine como funciones puras (`computeResizedTransform`/`computeRotatedTransform`); el Renderer solo traduce gestos de puntero y representa el estado visual (ADR-0008) — la misma separación se replicaría exactamente igual para un futuro `renderer-pixi` o `renderer-svg`.

## UX First

**Qué significa:** toda funcionalidad de edición se documenta junto con su experiencia de uso — flujo del usuario, consistencia con herramientas de referencia, accesibilidad honesta (qué funciona y qué NO todavía), y mejoras futuras reconocidas explícitamente. La UX no es una capa que se agrega al final; es parte de la definición de "terminado".

**Ejemplos ya aplicados:**
- Estándar permanente desde Editor 2 (`docs/ENGINEERING_STANDARDS.md`, "UX First") — cada README de módulo/app incluye estas cuatro secciones desde entonces.
- El modelo de selección (click reemplaza, Shift-click alterna, click vacío limpia) y el vocabulario de manipulación (handles de esquina vs. borde, Shift para proporción/snap) siguen deliberadamente la convención de herramientas de referencia (Figma, Illustrator, Sketch) — para que nada sorprenda a quien ya usó una herramienta de diseño alguna vez.
- Limitaciones de accesibilidad reconocidas explícitamente en vez de maquilladas — ej. "todo el movimiento/resize/rotación es exclusivamente por puntero, no hay navegación por teclado todavía" (README de `@impulso/renderer-konva`).

## AI Provider Agnostic

**Qué significa:** cuando Impulso incorpore capacidades de IA (generación de imágenes, sugerencias de diseño, autocompletado de texto, etc.), ninguna de ellas debe acoplar el producto a un proveedor específico de forma irreversible. La integración con un modelo/API de IA se trata igual que la integración con un Renderer (ADR-0001): un contrato/adaptador, no una dependencia directa esparcida por el código.

**Por qué está aquí ahora, sin que exista todavía ninguna funcionalidad de IA:** exactamente por la misma razón que Document Schema → Engine → Renderer se diseñó ANTES de escribir la primera línea de Foundation 1 (ver ADR-0001, "Por qué esta separación importa desde ya y no cuando haga falta") — retrofitear una separación de este tipo después de que el acoplamiento ya existe es mucho más caro que diseñarla desde el principio, aunque la funcionalidad de IA en sí todavía no exista.

**Cómo se aplicará cuando llegue el momento:** cualquier capacidad de IA se definirá detrás de un contrato propio (análogo a `RendererAdapter`), de modo que cambiar de proveedor — o correr sin ninguno, en un entorno offline — sea una cuestión de conectar un adaptador distinto, no de reescribir la funcionalidad.

## Performance First

**Qué significa:** toda decisión con impacto de rendimiento se documenta explícitamente (complejidad aproximada, cuellos de botella posibles, estrategia de optimización futura) en el momento en que se toma — sin optimizar prematuramente, pero sin dejar el rendimiento como una sorpresa para descubrir tarde. El objetivo declarado del proyecto es manejar documentos grandes (miles de objetos) sin degradar la experiencia de edición.

**Ejemplos ya aplicados:**
- Estándar permanente desde Foundation 3 (`docs/ENGINEERING_STANDARDS.md`, "Performance Budget") con un registro consolidado (`docs/PERFORMANCE_BUDGET.md`) de nueve decisiones documentadas hasta la fecha, cada una con su costo y su plan de optimización futura (no implementado prematuramente).
- El rebuild completo del Renderer en cada cambio (simple y correcto hoy) tiene ya documentada su alternativa futura (reconciliación incremental por id) para el día que el tamaño de documento lo justifique — sin haberla construido especulativamente.
- El patrón preview-en-vivo/commit-al-soltar (arrastrar, redimensionar, rotar) evita multiplicar el costo de un `dispatch` completo por cada frame de un gesto continuo — la decisión de NO despachar en cada `dragmove` es, en sí misma, la aplicación de este principio.

## Offline First (cuando aplique)

**Qué significa:** la funcionalidad esencial del producto (crear, editar, guardar, exportar un documento) debe funcionar sin depender de una conexión a un servidor — "cuando aplique" reconoce que futuras capacidades (sincronización entre dispositivos, colaboración, un marketplace) sí requerirán red por naturaleza, y ESAS no están sujetas a este principio de la misma forma.

**Ejemplos ya aplicados:**
- Milestone 1 (Alpha) guarda y recupera un documento completo en `localStorage`, sin ningún backend — verificado explícitamente sobreviviendo una recarga real de página, no solo un cambio de estado en memoria (ADR-0009).
- `ARCHITECTURE.md` (Fase 0) ya declara la Fase 1 como "editor 100% local, sin backend, sin auth, sin infraestructura distribuida" — una decisión de producto, no una limitación temporal accidental.
- La abstracción `StorageProvider` (planeada) existe precisamente para que, el día que se agregue sincronización remota, el Engine no tenga que cambiar cómo guarda/lee un documento — el modo offline seguiría siendo válido, no reemplazado.
