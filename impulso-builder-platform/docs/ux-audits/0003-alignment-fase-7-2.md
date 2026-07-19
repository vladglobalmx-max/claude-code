# UX Audit 0003 — Batch Operations + Alignment (Epic 7 / Fase 7.2)

> Auditoría breve de cierre de fase, mismo proceso que 0002. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** la nueva sección "Alineación" del Inspector (`alignment.ts`) y el mecanismo de `dispatchBatch` que la respalda. No cubre Smart Guides, Snapping, Grid, Rulers (Fase 7.3) ni manipulación visual conjunta de una selección múltiple (Fase 7.4) — la selección múltiple sigue mostrando el resaltado simple ya conocido, solo gana botones de acción, no una caja envolvente manipulable.

---

## 1. Lo que funciona muy bien

- **Alinear/distribuir es 1 clic**, sin submenús — igual de rápido que la barra de alineación de Figma/Illustrator, verificado en Chromium con 2 y 3 objects seleccionados.
- **Un solo Ctrl/Cmd+Z deshace toda la operación**, sin importar cuántos objects movió — verificado con 3 objects distribuidos horizontalmente: un solo Deshacer los devuelve a todos a su posición original, un solo Rehacer los restaura a todos.
- **La sección aparece y desaparece exactamente donde se la espera**: 0 seleccionados → nada (igual que el resto del Inspector); 1 → solo centrar en página; 2 → las 6 alineaciones; 3+ → suma distribuir. Verificado en vivo que cambiar la selección de 3→2→1 objects ajusta los botones visibles sin ningún parpadeo ni estado intermedio incorrecto.
- **La selección nunca "salta" de posición al alinear** — la referencia es la caja envolvente conjunta, no el primer object o un promedio arbitrario; consistente con el comportamiento esperado de Figma/Illustrator.
- **Cero controles decorativos**: cada botón corresponde a una operación real, igual que exige la filosofía de Fase 7.1 — ninguno es una promesa vacía.
- **El estado de error es accesible por diseño**, no solo una idea: cada botón lleva `aria-describedby` apuntando a un `role="alert"` que se actualiza con un mensaje de texto ante cualquier rechazo — cumple la regla nueva de esta fase antes de que exista una segunda oportunidad de olvidarla.

## 2. Lo que puede mejorar

- **Los 8 íconos son la primera vez que Sticker Builder usa un botón "solo ícono"** en toda su Toolbar/Inspector — el resto de la app usa exclusivamente texto (Deshacer, Guardar, Agrupar...). Es el patrón correcto para una barra de alineación (igual que cualquier editor de referencia), pero introduce una inconsistencia visual puntual que vale la pena tener presente si se agregan más íconos en el futuro sin una convención explícita.
- **Ningún indicador visual distingue las 6 alineaciones de las 2 distribuciones** más allá de estar en dos filas separadas — un usuario nuevo podría no notar de inmediato que la segunda fila es conceptualmente distinta (mueve varios objects a la vez con una lógica distinta) hasta pasar el mouse y leer el tooltip.
- **Distribuir con muy poco espacio disponible produce superposición silenciosa** (documentado como comportamiento determinista, no un bug) — visualmente, sin embargo, un usuario podría interpretar objects superpuestos como "se rompió algo" en vez de "no había espacio suficiente". No hay ningún mensaje que lo aclare en ese caso específico (a diferencia de un rechazo real, que sí muestra texto).
- **"Centrar en página" no indica en el botón mismo si el resultado será un no-op** (object ya centrado) — no es un problema real (no genera historial vacío), pero un usuario podría hacer clic esperando ver movimiento y no notar que ya estaba centrado.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un separador visual sutil (borde o espacio ligeramente mayor) entre la fila de alineación y la de distribución, para reforzar que son dos categorías de operación distintas.
2. Mencionar explícitamente en el tooltip de Distribuir que requiere 3 o más objects (hoy el tooltip solo describe QUÉ hace, no cuándo está disponible) — refuerza por qué el botón aparece/desaparece.

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Mensaje explicativo específico cuando Distribuir produce superposición** por falta de espacio — distinto del mensaje de rechazo genérico, ya que técnicamente no es un rechazo (la operación sí se aplicó).
2. **Vista previa en vivo mientras se pasa el mouse sobre un botón de alineación** (ghost/outline de dónde quedaría cada object) — mejora de descubribilidad, no de corrección; ningún editor de referencia lo hace como default pero algunos lo ofrecen como mejora.

## 5. Cambios grandes (esperar una fase/épica futura)

1. **Manipulación visual conjunta de la selección** (caja envolvente única, mover/redimensionar/rotar como unidad) — ya planificado explícitamente para Fase 7.4, que reutilizará `dispatchBatch` sin cambios.
2. **Smart Guides/Snapping contra los mismos bordes que usa Alignment** — ya planificado para Fase 7.3.
3. **Alinear/distribuir dentro de un Group** (hoy solo top-level) — evaluar si hace falta cuando exista selección dentro de grupos (hoy fuera de alcance de todo el producto).

---

**Nota de alcance:** no reevalúa selección múltiple más allá de los botones nuevos — el resaltado visual de 2+ objects (contornos individuales, sin caja conjunta) es exactamente el mismo que documentó la UX Review previa a Epic 7, sin cambios en esta fase.
