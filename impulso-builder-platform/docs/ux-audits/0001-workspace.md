# UX Audit 0001 — Workspace (Epic 5)

> Auditoría independiente, sin cambios de código. Ver `docs/ux-audits/README.md` para el propósito y formato de esta práctica.

**Alcance:** la pantalla "Mis proyectos" (`workspace.ts`), su relación con el diálogo "Nuevo proyecto" (Templates, reutilizado de Epic 4) y con el editor (transición Workspace ↔ Editor vía `shell.ts`).

---

## 1. Lo que funciona muy bien

- **Crear un proyecto es rápido de verdad**: "Nuevo proyecto" → la galería abre con el primer Template ya preseleccionado → "Crear" es el segundo clic. Dos clics para el camino feliz (usar un Template existente) es del mismo orden que Figma ("+ New design file") o Canva (elegir un tamaño predefinido).
- **Abrir un proyecto es un solo clic**, y además redundante de tres formas (miniatura, nombre, botón "Abrir") — el usuario no tiene que aprender dónde exactamente hay que hacer clic, cualquier zona obvia de la tarjeta funciona. Esto es exactamente el comportamiento que un usuario de Canva/Notion ya espera de una tarjeta de documento.
- **Las acciones de la tarjeta están todas a la vista, sin menú oculto.** Para el volumen de proyectos que un usuario tendrá en esta etapa del producto, esto es mejor que esconder Duplicar/Eliminar detrás de un "···" — cero curva de aprendizaje, cero clics extra para descubrir qué se puede hacer con un proyecto.
- **El renombrado inline (clic en el lápiz → input → Enter) es el patrón correcto** — coincide con cómo Figma renombra un archivo o una capa: sin navegar a otra pantalla, sin un diálogo modal para algo tan simple.
- **El mensaje de estado vacío tiene el tono correcto** ("Todavía no tienes proyectos guardados. Crea uno para empezar.") — no culpa al usuario, invita a la acción.
- **La Workspace nunca deja al usuario en un callejón sin salida**: incluso si `listDescriptors()` falla, la tarjeta "Personalizado" (dentro de "Nuevo proyecto") sigue disponible — ya validado en Epic 4 y heredado aquí sin regresión.

## 2. Lo que puede mejorar

- **Cero soporte de teclado en la grilla.** La miniatura y el nombre de una tarjeta son un `<img>` y un `<span>` con un `click` listener — no un `<button>` ni un `<a>` — así que no son alcanzables con Tab ni activables con Enter/Espacio. Solo el botón "Abrir" (texto) es realmente accesible por teclado. Un usuario que navega solo con teclado, o con lector de pantalla, no puede abrir un proyecto tocando su miniatura — tiene que encontrar el botón de texto más chico. Esto no es exclusivo de la Workspace: el mismo patrón ya existía en la galería de Templates (Epic 4) — aquí se hace más visible porque es la pantalla de aterrizaje de toda la app.
- **El diálogo de confirmación de "Eliminar" es un `window.confirm()` nativo del navegador** — el único punto de toda la app donde aparece un popup de sistema sin estilo, rompiendo la consistencia visual que sí mantienen `newProjectDialog`/`exportDialog`/`saveAsTemplateDialog` (todos con overlay propio). Para una acción destructiva e irreversible, además, el confirm nativo no permite mostrar contexto adicional (ej. una miniatura del proyecto que se está por borrar).
- **Ninguna tarjeta tiene estado de `hover`** más allá del cursor — no hay elevación, ni borde resaltado, ni ninguna señal de "esto es interactivo" antes de que el usuario haga clic. Figma/Canva usan casi siempre una sombra o un leve scale-up al pasar el mouse sobre una tarjeta de documento.
- **Renombrar y Duplicar/Eliminar viven en dos ubicaciones visuales distintas de la misma tarjeta** (el lápiz junto al nombre arriba; los tres botones de texto abajo) — son 4 acciones de la misma categoría ("gestionar este proyecto") con dos tratamientos visuales distintos, sin una razón obvia para el usuario.
- **"Nuevo" (editor) vs. "Nuevo proyecto" (Workspace) es la misma función con dos etiquetas distintas.** Un usuario que aprendió el botón en un lugar no tiene garantía de reconocer inmediatamente que el otro hace lo mismo.
- **Ningún aviso antes de perder trabajo no guardado.** Salir del editor hacia la Workspace (botón "Mis proyectos", o Ctrl/Cmd+O) descarta silenciosamente cualquier cambio hecho desde el último "Guardar" explícito — sin confirmación, sin indicador de "cambios sin guardar". Este es, con diferencia, el hallazgo de mayor impacto de esta auditoría: es exactamente el tipo de sorpresa que ninguna herramienta profesional de referencia permite hoy en día.
- **"Guardar" vs. "Guardar como plantilla" están uno al lado del otro en la barra superior, sin ninguna distinción visual ni tooltip** que aclare la diferencia (uno guarda EN Mis proyectos; el otro crea un Template reutilizable). Para un usuario nuevo que todavía no internalizó la diferencia conceptual entre Workspace y Templates, este es el punto exacto donde la confusión ocurriría.
- **Las miniaturas de proyectos con poco contenido son casi indistinguibles entre sí** (fondo blanco, quizás una línea de corte apenas visible) — no es un defecto de la Workspace en sí (ya documentado en ADR-0014 como reflejo fiel del contenido), pero SÍ es un problema real de "claridad visual de la jerarquía" cuando hay varios proyectos nuevos sin decorar: a simple vista, todas las tarjetas lucen iguales.
- **No hay ningún control de orden visible para el usuario** — el orden por "última edición" es correcto por defecto, pero no hay ninguna señal en la UI de que ESE es el criterio (podría leerse como orden aleatorio si no se nota la fecha).

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Igualar la etiqueta del botón: "Nuevo" (editor) → "Nuevo proyecto" (mismo texto que la Workspace).
2. Agregar un `title`/tooltip a "Guardar" ("Guarda este proyecto en Mis proyectos") y a "Guardar como plantilla" ("Crea una plantilla reutilizable a partir de este proyecto") — una línea de texto que resuelve la confusión conceptual más probable detectada en esta auditoría.
3. Agregar un `:hover` visual a `.workspace-card` (borde o sombra sutil) — señal de interactividad antes del clic.
4. Repetir el botón "Nuevo proyecto" (o un texto-link equivalente) junto al mensaje de estado vacío, no solo arriba a la derecha — reduce la distancia entre "no tengo nada" y "crear algo" para un usuario nuevo.
5. Agregar `aria-label` explícito a los botones de ícono (el lápiz de renombrar) además del `title` ya existente, para lectores de pantalla que no siempre calculan el nombre accesible desde `title`.

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Reemplazar `window.confirm()` de Eliminar por un diálogo con el mismo overlay ya usado en el resto de la app** — consistencia visual, y espacio para mostrar contexto (nombre/miniatura del proyecto a borrar).
2. **Navegación por teclado básica de la grilla**: hacer que la tarjeta completa (o al menos miniatura/nombre) sea alcanzable con Tab y activable con Enter — mismo problema ya presente en la galería de Templates, buen momento para resolverlo en ambos lugares a la vez.
3. **Aviso de cambios sin guardar** al salir del editor (Ctrl/Cmd+O, botón "Mis proyectos", o cerrar la pestaña) si hubo ediciones desde el último "Guardar" — el hallazgo de mayor impacto de esta auditoría; no requiere autosave, solo detectar "hay cambios sin persistir" y confirmar antes de descartar.
4. **Unificar las 4 acciones de una tarjeta (Renombrar/Duplicar/Eliminar/Abrir) en una sola zona visual coherente** — ya sea agrupándolas todas abajo, o revisando por qué Renombrar vive aparte.

## 5. Cambios grandes (esperar una épica futura)

1. **Autosave** — ya reconocido como deuda deliberada en ADR-0014; esta auditoría solo confirma que su ausencia es la raíz del hallazgo más serio (pérdida silenciosa de trabajo).
2. **Búsqueda/filtro/orden visible** en la Workspace, cuando el volumen de proyectos por usuario lo justifique.
3. **Miniaturas más ricas** (ej. previsualización animada al hover, o un placeholder ilustrado en vez de blanco puro para proyectos sin contenido) — mejora de percepción de producto, no una corrección de bug.
4. **Un patrón de "Recientes" separado de "Todos los proyectos"** (como el Figma home), si la cantidad de proyectos por usuario crece lo suficiente para que la grilla completa deje de ser el mejor punto de entrada.
5. **Selección múltiple y acciones en lote** (duplicar/eliminar varios proyectos a la vez).

---

**Nota de alcance:** esta auditoría no evalúa el editor en sí (Toolbar, canvas, Inspector) ni el diálogo "Nuevo proyecto"/Templates como bloques propios — ambos merecen su propia auditoría cuando les toque. Se los menciona aquí únicamente donde interactúan directamente con la Workspace.
