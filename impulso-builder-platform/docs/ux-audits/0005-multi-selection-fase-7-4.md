# UX Audit 0005 — Professional Multi Selection (Epic 7 / Fase 7.4)

> Auditoría breve de cierre de fase, mismo proceso que 0002/0003/0004. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** mover/redimensionar/rotar 2+ objects seleccionados como una unidad coherente (caja envolvente compartida, handles compartidos, preview efímero, commit atómico), política de objects bloqueados, integración con Smart Guides/Snapping, y la corrección del handle de rotación cerca del borde. No cubre edición profunda dentro de grupos, doble-click para entrar a un group, constraints responsivos, auto layout, selección múltiple entre páginas, resize no-proporcional individual dentro del conjunto, pivot de rotación configurable, selección múltiple táctil avanzada, colaboración, autosave ni PDF — explícitamente fuera de alcance de esta fase.

---

## 1. Lo que funciona muy bien

- **Una selección múltiple ahora se siente como un solo object manipulable**, tal como pedía el enunciado — verificado en Chromium real: arrastrar CUALQUIER object ya seleccionado (no solo la caja) mueve todo el conjunto, gracias al reenvío vía `Konva.Node.startDrag()`.
- **Preview y commit nunca divergen**: la misma función pura de `@impulso/engine` calcula el preview en vivo y el patch final del commit — verificado con 23 tests dedicados en `groupHandles.test.ts` cubriendo mover/redimensionar/rotar, más 2 tests en Chromium real confirmando que el resultado visual coincide.
- **Un solo gesto produce una sola entrada de historial**, sin importar cuántos objects mueva — un `Ctrl/Cmd+Z` revierte el movimiento/resize/rotación completos del conjunto. Verificado también para `nudge` (mover con flechas), que antes de esta fase generaba una entrada POR object.
- **Escape cancela un gesto en curso ANTES de limpiar la selección** — verificado con un `blur` real y un `pointercancel` real (no solo `Escape`), confirmando que ninguno de los tres deja el preview a medias ni genera historial.
- **El snapping durante resize de grupo es MÁS permisivo que el individual, no menos** — la caja del grupo siempre es un AABB puro, así que no hereda la restricción "sin rotación" del resize de un solo object; una mejora incidental descubierta al diseñar la matemática, no un objetivo explícito de la fase.
- **El bug de severidad alta de Fase 7.3.5 (handle de rotación fuera del Stage cerca de un borde) queda resuelto tanto para selección individual como múltiple**, con la misma función — verificado con tests dedicados en ambos módulos.
- **Objects bloqueados se comportan de forma predecible**: nunca se pierden de la selección visual (conservan su propio indicador), pero tampoco pueden transformarse por accidente ni individual ni grupalmente.

## 2. Lo que puede mejorar

- **El resize de un grupo con members rotados y un factor no-uniforme no es una transformación afín exacta** (ver Technical Debt/ADR-0017) — un usuario que redimensione un grupo mixto (algunos rotados, otros no) de forma asimétrica podría notar que un member rotado "se estira" de una forma sutilmente distinta a lo que un editor con soporte de *shear* real produciría. No hay ninguna señal en la UI de que esto es una aproximación conocida.
- **Ningún tooltip explica que un object bloqueado quedó fuera de la caja compartida** — un usuario que seleccione 3 objects y vea que solo 2 tienen handles (el tercero conserva su rectángulo punteado individual) no tiene ninguna pista textual de por qué, más allá del candado ya visible en el panel de Capas.
- **El handle de rotación recortado (ADR-0018) no da ninguna señal de que está "más cerca de lo normal"** — se ve idéntico a un handle sin recortar, solo que a menor distancia del object; un usuario que compare mentalmente contra otro object más alejado del borde podría notar la inconsistencia visual sin entender por qué.
- **Sin indicación de "N objects seleccionados" en ningún lugar de la UI** — ni el Inspector (que deliberadamente no cambió, ver ADR-0010) ni la caja compartida muestran un conteo; solo el panel de Capas (contando filas `.selected`) lo revela indirectamente.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un `title`/tooltip en el candado de un object bloqueado que forma parte de una selección múltiple, aclarando "Este object está bloqueado — no se moverá con el resto de la selección".
2. Mostrar un contador breve ("3 objects seleccionados") en algún punto ya visible del Inspector cuando la selección es 2+, sin tocar el resto de su contenido (opacidad-solamente, ver ADR-0010).

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Señal visual sutil cuando el handle de rotación fue recortado** (ej. un tono ligeramente distinto) — mejora de descubribilidad de una limitación conocida, no de corrección.
2. **Mensaje explicativo cuando un resize de grupo con members rotados produce un resultado que no es una escala uniforme** — hoy es un comportamiento determinista sin ninguna explicación visible.

## 5. Cambios grandes (esperar una fase/épica futura)

1. **Soporte de *shear*/skew en el Document Schema**, para que el resize de grupo con members rotados sea geométricamente exacto en todos los casos (ver ADR-0017, "Compatibilidad futura").
2. **Doble-click para entrar a un group y editar un hijo individual** sin desagrupar primero — ya excluido explícitamente del alcance de esta fase.
3. **Herramienta de creación de Rectangle/Ellipse desde el toolbar** — gap preexistente (detectado en Fase 7.3.5), no resuelto en esta fase por estar fuera de su alcance declarado; sigue siendo la limitación más visible para probar libremente Multi Selection con formas nuevas (hoy solo Imagen/Texto/el preset "Sticker circular").

---

**Nota de alcance:** el Inspector deliberadamente sigue sin mostrar X/Y/Ancho/Alto agregados para una selección múltiple (ADR-0010) — esta fase resolvió la manipulación EN EL CANVAS, no cambió esa decisión de UI.
