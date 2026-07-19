# UX Audit 0004 — Assisted Placement (Epic 7 / Fase 7.3)

> Auditoría breve de cierre de fase, mismo proceso que 0002/0003. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** Smart Guides, Snapping (página/objects/grid), Grid visual + persistente, Rulers, indicador de posición del puntero, y los controles de Grid/Snap del toolbar. No cubre selección múltiple profesional, resize/rotate de una selección conjunta, guías manuales arrastrables, márgenes/columnas ni layouts automáticos — explícitamente fuera de alcance de esta fase (ver Fase 7.4 y el Roadmap).

---

## 1. Lo que funciona muy bien

- **El snapping se siente preciso sin ser agresivo** — verificado en Chromium arrastrando un object real hasta un candidato dentro de tolerancia (8px de pantalla): el ajuste es inmediato y limpio, sin oscilación perceptible entre candidatos cercanos gracias a la hysteresis (`updateSnapGesture`/`previousSnap`).
- **Las Smart Guides aparecen y desaparecen exactamente cuando se esperan**: nunca antes de iniciar un drag, nunca después de soltarlo (verificado que `guidesLayer` queda vacío tras `dragend`, incluso cuando el snap SÍ se aplicó ese frame).
- **Ctrl/Cmd para desactivar snapping no compite con ningún atajo existente** — auditoría completa del repo confirmó que mantener Ctrl/Cmd solo (sin una tecla adicional) durante un drag no dispara nada hoy; es, además, la misma convención que Figma/Sketch/Illustrator ya establecieron.
- **Grid visual y Snap to Grid son independientes por diseño, no por accidente** — se verificó explícitamente que ocultar el Grid no desactiva el snap, y que desactivar el snap no oculta el Grid; ambos estados conviven sin acoplarse.
- **El indicador de puntero no inunda a lectores de pantalla**: `aria-hidden="true"` deliberado (el valor ya es accesible vía los campos X/Y del Inspector cuando hay selección) — decisión explícita para no depender de `aria-live` en cada `pointermove`.
- **Documentos y Templates antiguos (sin `grid`) abren sin fricción** — `GridConfigSchema.default({})` normaliza silenciosamente, verificado con un test dedicado ("recibe los defaults explícitos").
- **Los controles de Grid/Snap viven donde un usuario de Figma/Canva/Kittl ya los esperaría** (junto al zoom, no en el Inspector) — decisión de ubicación documentada explícitamente en la revisión previa a esta fase, no una elección ad-hoc.

## 2. Lo que puede mejorar

- **El resize snapping no cubre objects rotados ni Ellipse** (ver Technical Debt) — un usuario que rote un object y luego intente redimensionarlo cerca de un candidato no verá ninguna guía ni ajuste; no hay ninguna señal visual de "esto no está disponible aquí", podría leerse como snapping "que a veces no funciona" en vez de una limitación conocida.
- **Shift (mantener proporción) desactiva el snap de resize sin avisarlo** — mismo caso: el usuario simplemente deja de ver guías al mantener Shift durante un resize, sin ningún indicio de que es intencional.
- **Los Rulers no tienen menú contextual ni clic para cambiar de unidad** — coherente con el alcance declarado ("no implementar cambio de origen ni múltiples sistemas de unidades"), pero un usuario que quiera ver en otra unidad debe salir a cambiar `page.unit` por otro camino (hoy tampoco existe ese control en la UI — gap preexistente, no nuevo de esta fase).
- **El campo de tamaño de Grid no valida visualmente mientras se escribe** — solo al confirmar (`change`, blur/Enter), consistente con el resto de inputs numéricos nativos del navegador, pero sin el mismo feedback en vivo que sí tienen los campos del Inspector (Fase 7.1).
- **Ningún tooltip enumera las 3 fuentes de snap (Página/Objects/Grid) en un solo lugar** — el tooltip del botón "Snap" explica el modificador temporal, pero no la jerarquía de prioridad; un usuario curioso no tiene dónde leerla dentro de la propia UI (sí en la documentación del Engine).

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un `title`/tooltip distinto en los handles de resize de un object rotado o Ellipse indicando "snapping no disponible para objects rotados", en vez de simplemente no mostrar nada.
2. Mencionar en el tooltip de "Snap" la jerarquía Página > Objects > Grid, no solo el modificador temporal.

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Feedback visual breve cuando Shift desactiva el snap durante un resize** (ej. un indicador sutil junto al cursor) — mejora de descubribilidad, no de corrección.
2. **Selector de unidad accesible desde los Rulers** (clic derecho o control dedicado) — hoy no existe en ningún lugar de la UI, no solo en Rulers.

## 5. Cambios grandes (esperar una fase/épica futura)

1. **Snapping de resize para objects rotados** — requiere generalizar qué "borde" corresponde a cada handle cuando el AABB rotado ya no tiene una correspondencia 1:1 eje↔handle; evaluar si vale la pena antes de construirlo (ver Technical Debt).
2. **Guías manuales arrastrables (guides), márgenes y columnas** — ya excluidos explícitamente del alcance de esta fase, quedan para una fase futura de Assisted Placement.
3. **Snapping/Smart Guides considerando objects dentro de un `group`** — mismo criterio pendiente que Alignment (Fase 7.2): hoy solo top-level.

---

**Nota de alcance:** Rotation snapping (snap-to-15°) ya existía antes de esta fase y no se tocó — esta auditoría no lo reevalúa.
