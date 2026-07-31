# Fase 3 — Experience Integration

**Objetivo de la fase:** reemplazar por completo el contenido estático de la Beta por contenido generado por el Motor Creativo real (`@impulso/creative-engine`, aprobado en Fase 1/Fase 2), sin que la experiencia cambie en absoluto para quien la usa. El Motor Creativo pasa a vivir detrás de la experiencia ya aprobada — la experiencia es el contrato, no al revés.

## Qué cambió

**1. Ningún SVG hardcodeado.** Las tres propuestas que se muestran, la propuesta revelada y el archivo que se descarga en "Obtener" provienen, sin excepción, de una sola tubería real:

```
interpretar(frase) → seleccionarReceta(Intent) → generarLote(Intent)
  → (Fase 2 valida internamente) → exportarSVG(document) por propuesta → UI
```

Se eliminó por completo la lógica anterior (`extractIdentity`/`initials`, el objeto `sealPalettes` con tres estilos fijos, y la construcción manual de un único SVG de círculo+texto en `obtainDesign`).

**2. `@impulso/creative-engine` corre de verdad en el navegador.** `vite.config.js` resuelve `@impulso/creative-engine` y `@impulso/document-schema` directamente contra el código fuente TypeScript del monorepo (`impulso-builder-platform/packages/`, carpetas hermanas en este mismo repositorio) — no hay reimplementación ni copia manual de la lógica de recetas/arquetipos/filtro de calidad. `@impulso/export-engine` se resuelve contra un shim propio (`src/vendor/exportEngineSvgOnly.js`) que expone únicamente `buildSvgDocument` desde su archivo real, evitando que `@impulso/renderer-konva`/Konva entre al bundle del navegador (esa función es Konva-independiente por diseño del propio Motor de Exportación — no hace falta lo que no se usa). `node:crypto` (usado por `creative-engine#ids.ts` en Node/Vitest) se resuelve, solo para el navegador, contra un shim que llama a `crypto.randomUUID()` nativo. **Ningún archivo de los tres paquetes del monorepo fue modificado** — la integración vive entera del lado de `thoren-beta`.

**3. Nuevos módulos en `thoren-beta`:**
- `src/engine.js` — adaptador que llama al Motor Creativo real y devuelve objetos ya listos para mostrar (`{ id, archetypeId, svg }`). La UI nunca importa ni conoce `@impulso/creative-engine` directamente.
- `src/telemetry.js` — instrumentación silenciosa: registro en memoria de los ocho eventos pedidos (`intent_detected`, `recipe_selected`, `compositions_generated`, `quality_passed`, `proposal_rendered`, `proposal_selected`, `svg_exported`, `journey_completed`) y de los tiempos internos (interpretación, composición, validación, tiempo hasta primera propuesta, tiempo hasta lote completo, exportación, total del recorrido). Nunca se muestra al usuario ni se envía a ningún servidor — solo aparece en el panel de `?beta=true`.

**4. `main.js` ahora orquesta datos reales, no plantillas.** `populateProposals` inserta el SVG real de cada propuesta dentro de cada tarjeta (`card.querySelector(".seal").innerHTML = proposal.svg`); `revealChosen` reutiliza el mismo SVG ya exportado (sin volver a llamar al motor); `obtainDesign` descarga ese mismo SVG real vía Blob.

**5. Ritmo del Blueprint como piso, nunca como techo.** `atLeast(runJourney(frase), 900)` corre el Motor Creativo real en paralelo al pulso de "pensando" ya aprobado — si el motor termina antes de 900ms (en la práctica termina en ~20ms, ver mediciones abajo), la experiencia sigue esperando el mínimo ya afinado; si algún día tomara más, nunca se recorta esa espera real. El resto del recorrido (llegada escalonada de tarjetas, revelación, confirmación) no necesitó ningún ajuste de tiempo porque las propuestas ya están completamente generadas y exportadas antes de mostrarse — no hay espera adicional en ningún otro punto.

**6. Adaptación visual mínima e inevitable: la forma del contenedor de cada propuesta.** El prototipo anterior asumía que las tres propuestas eran círculos idénticos (tres fondos CSS fijos, `.seal { border-radius: 50% }`). Los tres arquetipos reales aprobados en Fase 2 son estructuralmente distintos a propósito (uno circular, uno con marco rectangular doble, uno asimétrico sin marco) — esa distinción **es** el resultado aprobado de Fase 2, no un defecto a esconder. Forzar los tres dentro de un círculo habría recortado destructivamente dos de los tres diseños reales. Se cambió `border-radius: 50%` por un redondeo de esquina uniforme y modesto (14%) que enmarca cualquiera de los tres sin recortar nada — mismo tamaño, misma posición, misma animación de llegada; solo cambia cuánto se redondean las esquinas del marco.

**7. Nombre de archivo de descarga.** Antes: derivado de una extracción de iniciales hecha en el propio `main.js` (duplicando lógica que ya no debía vivir ahí). Ahora: `thoren-<archetypeId>.svg` — más simple, y evita reintroducir un segundo parser de nombres en la capa de UI.

## Qué deliberadamente NO cambió

- **La filosofía del producto.** Cero pantallas nuevas, cero opciones nuevas, cero casos de uso nuevos, cero IA generativa (el Motor Creativo sigue siendo 100% determinista, Fase 2).
- **El Experience Blueprint.** Las seis pantallas, su orden, y cada pausa/transición/microinteracción existente (conversación inicial → transición de la frase a la esquina → pulso de espera → llegada progresiva de propuestas → selección → revelación → descarga → confirmación → pregunta diferida de impresión) permanecen exactamente iguales. Las constantes de tiempo del prototipo aprobado (900ms de pulso, 250+i·380ms de llegada escalonada, 200/500/1500ms de la revelación, 1300ms hasta la pregunta de impresión, 500ms hasta el cierre) no se tocaron — solo se envolvió la primera en `atLeast` para que sea un piso real en vez de una duración fija ciega al tiempo de generación.
- **Ninguna receta ni arquetipo nuevo.** Sigue siendo exactamente la receta Elegante-Boda de Fase 2 con sus tres arquetipos — Fase 3 no amplía el catálogo creativo.
- **El desacoplamiento UI ↔ Motor Creativo.** `main.js` nunca importa `@impulso/creative-engine`; solo conoce `engine.js`, que le entrega objetos `{ id, archetypeId, svg }` ya listos para mostrar. No hay ninguna referencia a nombres de receta, reglas de arquetipo, ni puntuaciones de calidad en la capa de interfaz — exactamente lo que `THOREN_CREATIVE_ENGINE.md` §15 prohíbe exponer.
- **Los tres paquetes del monorepo (`@impulso/creative-engine`, `@impulso/document-schema`, `@impulso/export-engine`).** Ni un archivo modificado — toda la integración vive del lado de `thoren-beta` (alias de Vite + dos shims propios).

## Interpretación de dos decisiones de instrumentación

- **`compositions_generated` y `quality_passed` comparten el mismo instante y la misma medición de tiempo.** Fase 2 diseñó `generarLote()` para validar cada composición internamente antes de devolverla — no existe, desde fuera de ese paquete (congelado, no se modifica), una frontera observable entre "componer" y "validar". Separarlas artificialmente habría significado inventar una medición falsa; se prefirió ser honesto y documentarlo aquí en vez de simular una granularidad que la arquitectura actual no tiene.
- **`journey_completed` se dispara en el momento de la descarga**, no después de la pregunta de impresión — el propio Blueprint la describe como una "pregunta diferida", fuera del recorrido central. El recorrido termina cuando la persona ya tiene su archivo.

## Verificación realizada

- **Recorrido completo en Chromium real** (Playwright, no simulado): frase → 3 propuestas reales y visualmente distintas → selección → revelación → "Obtener" → descarga real de un `.svg` que empieza con `<svg` y contiene el nombre real del usuario → confirmación → pregunta de impresión. Confirmado también con una frase sin nombres detectables (repliegue a "Siempre Juntos") y con una frase con fecha y color explícitos.
- **Descarga real verificada por contenido**, no solo por nombre de archivo: se leyó el `.svg` descargado y se confirmó que es exactamente el SVG del Motor Creativo, con el contenido real del usuario.
- **Eventos y tiempos registrados** — verificados leyendo el panel `?beta=true` tras un recorrido real: los ocho eventos aparecen en orden, con timestamps relativos crecientes, y las seis mediciones de tiempo (interpretación 2ms, composición/validación 15ms, exportación 2ms, tiempo hasta primera propuesta 18ms, tiempo hasta lote completo 19ms, total del recorrido ~5.4s incluyendo el tiempo real de decisión del usuario) quedan visibles solo bajo ese parámetro — confirmado que `?betaPanel` permanece `hidden` en la experiencia normal.
- **Lighthouse** contra la build de producción (con el Motor Creativo real ya integrado, bundle de 82KB/22KB gzip, sin Konva): **100/100/100/100** en preset desktop y en preset mobile — igual o mejor que el estándar ya alcanzado en la Beta anterior.
- **Pruebas automáticas**: 13 pruebas nuevas (`vitest`) — `telemetry.test.js` (9, cobertura 100%) y `engine.test.js` (4, cobertura 100%), estas últimas llamando al Motor Creativo real, no un doble de prueba. `main.js` (orquestación del DOM) se valida mediante el recorrido real en Chromium descrito arriba, no con pruebas unitarias — es la estrategia correcta para lógica de interacción.
- **Typecheck**: no aplica un `tsc` propio (proyecto en JS puro, Vite transpila los `.ts` importados del monorepo sin chequeo de tipos, igual que `tsup`/esbuild ya hacían allí) — el typecheck real de esa lógica ya se corrió y pasó dentro de `impulso-builder-platform` (Fase 1/Fase 2, no reabierto aquí).
- **Cobertura**: 100% en `engine.js` y `telemetry.js` (los únicos módulos con lógica no-DOM de esta fase).

## Criterio de éxito

Una persona que vio el prototipo anterior no puede distinguir, mirando la experiencia normal (sin `?beta=true`), en qué momento se dejó de usar contenido estático y se empezó a usar el Motor Creativo real — la integración es invisible por diseño, y la única diferencia visible (el redondeo de esquina de los "sellos") existe porque ahora hay contenido real y estructuralmente distinto que mostrar, no porque cambió la interacción.
