# UX Audit 0002 — Inspector honesto (Epic 7 / Fase 7.1)

> Auditoría breve de cierre de fase, según el proceso acordado para Epic 7 (Architecture Review + UX Review + criterios antes de cada fase; demo + tests + UX Audit breve + deuda + reporte después de cada fase). Ver `docs/ux-audits/README.md` para el formato general de esta práctica.

**Alcance:** el Inspector de un único object seleccionado (`inspector.ts` + su CSS en `index.html`) tras Fase 7.1. No cubre selección múltiple avanzada, Alignment, Smart Guides, Snapping, Grid ni Rulers — quedan para Fases 7.2/7.3/7.4.

---

## 1. Lo que funciona muy bien

- **Ya no hay controles decorativos.** Tipografía/Tamaño/Alineación eran no-ops silenciosos antes de esta fase — el hallazgo más grave de la UX Review previa. Ahora los tres disparan `updateTextStyle` de verdad, con undo/redo y una entrada de historial por cambio, verificado en Chromium.
- **El Engine nunca miente.** Si un valor es rechazado (ej. `fontSize` resultante ≤ 0 vía la expresión `*0`), el campo se marca inválido y conserva el texto problemático — nunca se ve como si el cambio "hubiera funcionado" cuando en realidad no se aplicó. Esto es exactamente el criterio que motivó la fase.
- **Las expresiones relativas (`+n`/`-n`/`*n`/`/n`) funcionan como en Figma/Sketch** para ajustar un valor sin recalcular a mano — verificado con `+5` sobre X.
- **Perder el foco con una expresión inválida revierte al último valor válido**, en vez de dejar al usuario atascado con un campo roto sin salida obvia.
- **Las unidades ahora son honestas y visibles**: X/Y/Ancho/Alto muestran `page.unit` (mm/in/px), Rotación muestra `°`, Tamaño de fuente muestra `px` — antes ningún campo indicaba en qué unidad estaba expresado su número.
- **Deshacer/Rehacer/Guardar ahora tienen tooltip con su atajo** — cerraba la última brecha de descubribilidad de atajos en la Toolbar (Duplicar/Eliminar/Agrupar/Desagrupar ya lo tenían desde Epic anterior).

## 2. Lo que puede mejorar

- **El debounce de 300 ms es invisible para el usuario.** Al escribir sin confirmar, el cambio se aplica solo/a tras la pausa — no hay ninguna señal visual (ej. un pequeño indicador "aplicando…") de que algo está por pasar. Un usuario que escribe y navega rápido a otro campo puede no notar cuándo exactamente se confirmó.
- **El estado inválido es únicamente cromático** (borde/fondo rojo + `aria-invalid`). No hay un mensaje de texto que explique POR QUÉ se rechazó (¿expresión no reconocida? ¿el Engine lo rechazó por rango?) — el usuario ve "está mal" pero no "por qué está mal".
- **La Tipografía sigue siendo un campo de texto libre**, no una lista de fuentes disponibles/instaladas — un typo produce una fuente inexistente sin ninguna advertencia (el navegador simplemente hace fallback). Fuera de alcance de esta fase (no se pidió una selección curada), pero es la brecha más visible que queda en la sección Texto.
- **Selección múltiple sigue mostrando solo Opacidad**, sin ningún indicio en el propio Inspector de que Alignment/Distribution llegan en la próxima fase — un usuario podría interpretar la ausencia como una limitación permanente en vez de una fase pendiente.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un `title` explicando el motivo del rechazo cuando el Engine lo rechaza (hoy el `title` del campo numérico siempre explica la sintaxis, nunca el motivo puntual del rechazo actual).
2. Redondear la unidad mostrada a la abreviatura estándar consistente en los tres contextos (ya es "mm"/"in"/"px"/"°"/"px" — verificar que "in" no se confunda visualmente con la preposición inglesa en una futura traducción).

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Indicador visual breve durante el debounce** (ej. un punto o un leve cambio de color mientras el timer está pendiente) para que escribir y cambiar de campo rápido no se sienta "silencioso".
2. **Mensaje de error inline junto al campo inválido**, no solo color — mejora de accesibilidad y claridad, sin cambiar el mecanismo de validación ya construido.

## 5. Cambios grandes (esperar una fase/épica futura)

1. **Selector de fuentes curado** (lista de fuentes reales disponibles, con previsualización) — cambia el tipo de control, no solo su estilo.
2. **Alignment/Distribution en selección múltiple** — ya planificado explícitamente para Fase 7.2.
3. **Smart Guides/Snapping/Grid/Rulers** — ya planificado explícitamente para Fase 7.3.

---

**Nota de alcance:** esta auditoría no reevalúa Workspace/Templates/Export (ver Audit 0001 y futuras) ni el resto de la Toolbar más allá de las tres tooltips agregadas en esta fase.
