# UX Audit 0008 — Production Export Experience (Epic 9 / Fase 9.4)

> Auditoría de cierre de Fase 9.4, mismo proceso que 0001-0007. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** el flujo real de "Exportar para impresión" construido en Fase 9.4 — `productionExportDialog.ts` (los 7 pasos: perfil → configuración → preview → preflight → advertencias → progreso → resultados), `productionExportController.ts` (estado/ciclo de vida) y `productionPreview.ts` (el preview de producción real, ya evaluado en sus fundamentos técnicos por UX Audit 0007 sobre el harness de Fase 9.3 — aquí se audita su integración real dentro del flujo, no su geometría, que sigue heredada intacta de `@impulso/print-engine`). No cubre el resto del pipeline de impresión (raster, PDF, Preflight en sí — ya evaluados en su propia dimensión técnica en ADR-0023) ni el flujo de exportación rápida existente (`exportDialog.ts`, sin cambios en esta fase).

---

## 1. Lo que funciona muy bien

- **El Production Preview real hereda exactamente la garantía que UX Audit 0007 pedía para Fase 9.4** — ya no es un demo fijo de una sola página: opera sobre el `Project`/`PrintJob` reales, navega entre páginas (grupos de imposición independientes) y hojas, y reutiliza la MISMA `computeImpositionLayout`/geometría pura que `exportImpositionToPdf`/`exportImpositionToPng` — nunca una reimplementación aproximada en la capa de UI. Los "Cambios grandes" #1 de la auditoría anterior están resueltos.
- **El diálogo completo tiene foco atrapado real, verificado en Chromium (no solo jsdom)** — `Tab`/`Shift+Tab` cíclico, `Escape` cierra y restaura el foco al elemento que abrió el diálogo, cada paso mueve el foco a su propio `<h2>` (con `tabIndex=-1`) para que un lector de pantalla anuncie el cambio de paso de inmediato — exactamente el "Cambio grande #2" (verificación de accesibilidad real, no solo inspección de código) que la auditoría anterior dejaba pendiente.
- **Errores/advertencias/información de Preflight se distinguen por encabezado de texto** ("Errores (bloquean la exportación)"/"Advertencias"/"Información"), nunca solo por color — y usan `issue.message`/`issue.recommendation` (el texto ya redactado para humanos), no el `code` técnico crudo — resuelve directamente el Quick Win #2 de la auditoría anterior, ahora en el flujo real.
- **La aceptación de advertencias es real y por ejecución** — cualquier cambio en el `PrintJob` (`updatePrintJob`) invalida el Preflight ya corrido y resetea `warningsAccepted`; el botón "Exportar" del paso de advertencias permanece deshabilitado hasta que el checkbox se marque explícitamente, y el paso se salta automáticamente cuando no hay nada que aceptar — nunca hay una advertencia "heredada" de una corrida anterior con datos distintos.
- **La política de cambio de Project durante el flujo es honesta y visible** — `open()` toma una foto (`structuredClone`) inmediata; si el `Project` real cambia mientras el diálogo sigue abierto, aparece un banner explícito ("El proyecto cambió desde que se abrió este flujo") con un botón "Actualizar con los cambios" que re-fotografía e invalida el Preflight — nunca mezcla silenciosamente geometría de dos revisiones distintas.
- **La cancelación es real, no cosmética** — un `AbortController` real se propaga hasta `exportImpositionToPdf`/`Png` (los mismos puntos de chequeo de cancelación de Fase 9.2), y una cancelación explícita del usuario nunca se muestra como un error ("Error: ...") sino que simplemente detiene el progreso.

## 2. Lo que puede mejorar

- **El nombre de archivo del resultado no es editable** — la sección 32 del enunciado de Fase 9.4 pedía un nombre base editable antes de la descarga; hoy el paso de resultados muestra directamente `buildPrintFilename(...)` ya resuelto, sin ningún campo para ajustarlo. El dato (`projectName`) se define una sola vez, implícitamente, al abrir el diálogo (`app.ts` pasa el nombre del Project actual) y nunca se expone para edición dentro del flujo.
- **Los issues de Preflight no se pueden localizar visualmente en el preview** — la sección 30 pedía un resaltado temporal del object/página involucrado al hacer click en un issue; hoy el paso de Preflight es una lista de texto plano sin ninguna interacción hacia el paso de preview (que además es un paso ANTERIOR en el flujo lineal, nunca revisitado automáticamente).
- **La configuración avanzada expuesta es parcial** — el paso de configuración cubre cantidad, tamaño de hoja, orientación, gaps X/Y, alineación, modo de marcas y formato de salida, pero NO expone: márgenes por lado (solo hereda el valor ya presente en el `PrintJob` sin UI para editarlo), configuración de cut path (color/grosor/offset), ni resolución/PPI de exportación. Es una limitación de producto documentada (sección de alcance del enunciado no la exige explícitamente para V1), no un bug, pero vale la pena que el próximo backlog la registre explícitamente en vez de que quede implícita.
- **El paso de perfil solo puede mostrar el perfil "Sticker Sheet"** — es el único perfil de `PRINT_PROFILES` con `imposition.mode === "grid"` hoy; la tarjeta de perfil (sección 24) está construida para escalar a más de un perfil imposicionable, pero con un solo perfil real disponible, ese paso es hoy más una confirmación de bienvenida que una elección genuina.
- **No existe todavía una UI para asignar `metadata.role: "die-line"` a un object** — detectado durante la verificación E2E: un `Project` recién creado sin ese rol asignado (que hoy solo puede establecerse editando el documento directamente, no desde el Inspector) siempre bloquea en Preflight con `cut_path_missing` al usar el perfil por defecto (`cutPath.mode: "die-cut"`). No es un defecto de esta fase — es una brecha ya conocida del editor en general — pero esta fase es la primera en depender de ella de forma central para su camino feliz, así que vale la pena que quede registrada aquí con esa relación explícita.
- **"Ajustar" (Fit) del Production Preview depende de `clientWidth` real** — funciona correctamente en Chromium real (verificado), pero no tiene ningún fallback visible para el usuario si el contenedor todavía no tiene layout medible (ej. justo tras abrir el paso) más allá de "no cambiar el zoom silenciosamente"; un usuario podría hacer click en "Ajustar" sin ningún efecto visible ni mensaje.

## 3. Quick Wins (menos de 30 minutos cada uno)

1. Agregar un campo de texto editable para el nombre base del archivo en el paso de resultados (o ya en el paso de configuración), en vez de depender únicamente del nombre del Project al momento de abrir el diálogo.
2. Mostrar un mensaje breve ("No hay nada que ajustar todavía") si "Ajustar" no puede calcular una escala real, en vez de no hacer nada visible.
3. Agregar un texto de ayuda en el paso de perfil aclarando por qué solo aparece un perfil hoy ("Sticker Sheet es el único perfil con imposición disponible actualmente") — para que no parezca un bug de un selector vacío.

## 4. Cambios medianos (más que un quick win, sin tocar arquitectura)

1. **Exponer márgenes por lado y configuración de cut path (color/grosor/offset) en la sección "Avanzado"** del paso de configuración — hoy son parte del `PrintJob`/`GridImpositionSpec` pero no editables desde este flujo.
2. **Localizar issues de Preflight en el preview** — al hacer click en un issue con `pageId`/`objectId`, resaltar temporalmente esa pieza/hoja en el Production Preview (sección 30) — requiere permitir volver al paso de preview desde Preflight sin perder el estado ya calculado, hoy el flujo es estrictamente lineal hacia adelante salvo "Atrás".

## 5. Cambios grandes (fuera del alcance aprobado de Fase 9.4, para un backlog futuro)

1. **UI de asignación de die-line** en el Inspector — desbloquearía el camino feliz completo de esta fase (y de Fase 9.3) sin depender de editar el documento directamente; hoy es la brecha más visible detectada durante la verificación E2E real.
2. **Múltiples perfiles de imposición** (más allá de "Sticker Sheet") — el paso de perfil y su tarjeta ya están preparados estructuralmente para esto, solo falta que `PRINT_PROFILES` ofrezca más de una opción imposicionable.
3. **Persistencia de configuraciones de imposición como preset reutilizable** — explícitamente fuera de alcance de Fase 9.4 salvo trivial (sección de exclusiones del enunciado); no se intentó en esta fase.

---

**Nota de alcance:** esta auditoría evalúa el flujo real de producción construido en Fase 9.4 tal como quedó implementado y verificado (jsdom + Chromium real) al cierre de esta fase — no anticipa trabajo de Fase 9.5 (Hardening & Golden Tests), que queda fuera de este documento por instrucción explícita de alcance.
