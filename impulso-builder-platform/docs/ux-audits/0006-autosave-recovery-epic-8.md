# UX Audit 0006 — Autosave, Recovery & Project Safety (Epic 8)

> Auditoría breve de cierre de épica, mismo proceso que 0002-0005. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** dirty-state, autosave con debounce, indicador de estado de guardado, salida segura del editor, `beforeunload`, recovery ante cierres inesperados, manejo de errores de guardado, integración con guardado manual/Templates/Workspace. No cubre historial de versiones, papelera de reciclaje, cuentas/cloud, colaboración, ni la reparación de gaps de UX no relacionados (ej. sin herramienta de Rectangle/Ellipse, ya registrado en UX Audit 0005) — explícitamente fuera de alcance de esta épica.

---

## 1. Lo que funciona muy bien

- **El hallazgo de mayor impacto detectado en toda la plataforma (UX Audit 0001: pérdida silenciosa de trabajo no guardado) queda cerrado de raíz** — no con un parche puntual, sino con un modelo completo de estados honesto: nunca se muestra "Guardado" antes de que la persistencia termine con éxito, nunca se limpia el dirty-state tras un intento fallido.
- **El indicador de guardado es legible sin jerga técnica** ("Cambios sin guardar", "Guardando…", "Error al guardar") y nunca depende solo de color — incluye texto siempre, y un botón "Reintentar" propio junto al mensaje de error.
- **El diálogo de salida con cambios sin guardar es, deliberadamente, el más accesible de toda la app** — el único con foco atrapado real, verificado explícitamente porque el enunciado de esta épica lo exigía para este caso concreto (una decisión de alcance consciente, no una inconsistencia).
- **El recovery se ofrece, nunca se impone** — un cierre inesperado nunca sobreescribe en silencio; el usuario ve fecha y nombre del proyecto y elige explícitamente Recuperar cambios, Abrir versión guardada o Descartar.
- **Un bug de concurrencia real (`workspace.ts` disparando `refresh()` dos veces al aterrizar, duplicando filas del banner de recovery) se encontró y corrigió durante la propia verificación E2E de esta épica** — no fue reportado por el usuario, y no habría sido visible sin escribir el escenario de recovery de punta a punta contra IndexedDB real.

## 2. Lo que puede mejorar

- **El indicador de guardado no explica, en el momento del error, qué implica cada opción de forma anticipada** — el mensaje de error es genérico ("No se pudo guardar el proyecto. Intenta de nuevo.") salvo para cuota agotada; un usuario no técnico podría no saber si "Reintentar" tiene sentido sin haber leído antes qué pasó.
- **El banner de recovery de la Workspace no distingue visualmente "cuánto" se perdería si se descarta** — muestra fecha y nombre, pero no una vista previa (miniatura) del contenido recuperable, a diferencia de las tarjetas de proyecto normales (que sí muestran thumbnail).
- **Ninguna señal explica por qué el thumbnail de la Workspace puede tardar en reflejar el último cambio** si el autosave todavía está en curso — el usuario ve la tarjeta con la miniatura anterior sin ninguna pista de que hay un guardado en progreso en el editor (visible solo si volviera a abrir el editor).
- **El recovery rápido (~400ms) y el guardado principal (~1200ms) no tienen ningún reflejo visual distinto en el indicador** — ambos se ven como "Cambios sin guardar"/"Guardando…"; un usuario avanzado que entendiera el mecanismo no tiene forma de saber si ya existe al menos un recovery reciente.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un `title`/tooltip al indicador de guardado explicando en una frase qué significa cada estado (ej. sobre "Cambios sin guardar": "Se guardará automáticamente en unos segundos, o presiona Ctrl/Cmd+S").
2. Mensaje de error más específico para el caso "IndexedDB no disponible" (hoy cae en el mensaje genérico) — distinguible de un fallo de escritura transitorio.

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Miniatura en la fila del banner de recovery**, generada a partir del `Project` recuperable (mismo `createThumbnailGenerator` ya existente) — ayudaría a decidir entre "Recuperar" y "Descartar" sin tener que abrir el editor para verlo.
2. **Señal visual (no solo textual) de que un guardado está en curso desde la Workspace**, si en el futuro se permite tener el editor de un proyecto abierto en más de una pestaña — hoy fuera de alcance porque esta épica asume una sola pestaña activa por proyecto.

## 5. Cambios grandes (esperar una épica futura)

1. **Historial de versiones real** — deliberadamente fuera de esta épica (ver ADR-0020, "el recovery no debe convertirse en un sistema de versiones"); si el negocio lo justifica, es un rediseño de almacenamiento, no una extensión incremental del recovery actual.
2. **Sincronización entre pestañas/dispositivos** — el modelo actual asume una sola pestaña editando un proyecto a la vez; dos pestañas abiertas sobre el mismo proyecto hoy competirían silenciosamente por el mismo `ProjectStore` sin ninguna coordinación (riesgo nuevo, ver Technical Debt).

---

**Nota de alcance:** esta épica resolvió la seguridad del proyecto dentro de una sola pestaña/dispositivo — cloud, cuentas y colaboración siguen fuera de alcance, tal como el enunciado de producto lo estableció explícitamente desde el inicio.
