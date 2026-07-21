# UX Audit 0009 — Production Export Hardening (Epic 9 / Fase 9.5)

> Auditoría de cierre de Fase 9.5, mismo proceso que 0001-0008. Ver `docs/ux-audits/README.md` para el formato general.

**Alcance:** el mismo flujo de "Exportar para impresión" evaluado por UX Audit 0008, ahora DESPUÉS del hardening de Fase 9.5 — `productionExportDialog.ts`, `productionExportController.ts`, `productionPreview.ts`. Esta fase fue explícitamente de endurecimiento (ninguna función nueva fuera de hardening), así que esta auditoría se enfoca en: (1) qué de lo que 0008 marcó como "puede mejorar" se resolvió como efecto de corregir bugs reales, (2) qué bugs reales nuevos encontró la verificación exhaustiva de esta fase y cómo cambian la experiencia, y (3) confirmar honestamente que las limitaciones de producto identificadas por 0008 y que NO eran bugs siguen exactamente donde estaban — esta fase no las resolvió porque no le correspondía.

---

## 1. Lo que funciona muy bien (nuevo desde 0008)

- **Los 3 perfiles del selector ahora funcionan de extremo a extremo, no solo se muestran** — 0008 diagnosticó que el problema de "un solo perfil" era de wiring, no del motor (correcto), pero la corrección de esa fase (Fase 9.5, primer commit) resultó estar incompleta: el selector mostraba 3 perfiles reales pero solo "Sticker Sheet" realmente exportaba algo — "Digital PNG"/"Print PDF" dejaban el wizard colgado indefinidamente en "Preparando…" sin ningún archivo ni error visible. Esta fase encontró y corrigió ese gap con verificación real (2 escenarios E2E que completan cada perfil hasta una descarga real), no solo con una inspección de código.
- **Un proyecto genuinamente sin advertencias ahora puede exportar** — antes de esta fase, el auto-avance del paso "Advertencias" (cuando Preflight no reporta ninguna) dejaba el wizard en el mismo estado colgado que el bug anterior, por una razón distinta (el auto-avance solo cambiaba de paso, nunca disparaba la exportación). Ambos bugs compartían el mismo síntoma visible para el usuario ("no pasa nada"), lo cual dificultó encontrarlos por separado — quedan documentados como dos causas independientes en el CHANGELOG.
- **El foco atrapado del diálogo ahora es robusto ante `Shift+Tab` justo después de cualquier cambio de paso** — 0008 verificó el trap en Chromium real, pero no ese momento específico (el foco recién movido al `<h2>` del título, excluido deliberadamente del cálculo del trap). Un lector de pantalla o un usuario de solo-teclado que presionara Shift+Tab inmediatamente después de avanzar de paso podía terminar con el foco fuera del diálogo por completo — confirmado y corregido con un test que reproduce el escape antes del fix.
- **Los controles propios de la Production Preview (navegación de hoja/página, capas, zoom) están confirmados operables 100% por teclado** — 0008 no los probó explícitamente por teclado (solo con `.click()`); esta fase lo hizo y no encontró ningún bug ahí, una confirmación real, no solo una suposición razonable.
- **El nombre de archivo ahora es seguro ante Unicode/emoji en el límite de truncado** — `sanitizeFilename` truncaba por code unit UTF-16, pudiendo partir un emoji a la mitad; un proyecto con un nombre así (nada exótico, cualquier usuario puede nombrarlo con un emoji) habría producido un archivo con un carácter corrupto en el nombre. Corregido y con test de regresión.
- **Performance/memoria/resource-leaks del wizard completo están verificados con datos REALES de Chromium, no solo argumentados** — un ciclo completo con 200 copias imposicionadas en 526ms, sin crecimiento de heap desbocado tras 5 ciclos, sin canvases/object URLs huérfanos tras ciclos de éxito y de cancelación repetida. Esto es exactamente el tipo de confianza que un usuario profesional (alguien exportando pedidos reales, repetidamente, durante una sesión larga) necesita sin saberlo — el wizard no se degrada con el uso.

## 2. Lo que puede mejorar (sin cambios desde 0008 — correctamente fuera de alcance de esta fase)

Estas son las mismas limitaciones que 0008 ya documentó honestamente. Se re-confirman aquí, no porque esta fase las haya ignorado, sino porque una fase de hardening explícitamente no debía convertirlas en features nuevas ("no conviertas limitaciones conocidas en features improvisadas"):

- **El nombre de archivo del resultado sigue sin ser editable** dentro del flujo — se corrigió un bug de un caso extremo de truncado (arriba), pero la limitación de producto (0008, Quick Win #1) sigue intacta.
- **Los issues de Preflight siguen sin poder localizarse visualmente en el preview.**
- **La configuración avanzada expuesta sigue siendo parcial** (sin márgenes por lado, cut path, ni PPI editables desde el wizard).
- **Sigue sin existir una UI de asignación de `metadata.role: "die-line"`** en el Inspector.
- **"Ajustar" (Fit) sigue sin un mensaje de fallback visible** si no puede calcular una escala real.

## 3. Hallazgos nuevos de esta fase (ni bugs de producto ni deuda de UX — límites de proceso/entorno)

- **`ProductionExportController.cancelExport()` es un método público, testeado, pero inalcanzable desde la UI real** — el único "Cancelar" visible usa `close()` (aborta y cierra todo, comportamiento seguro y correcto); `cancelExport()` (aborta pero deja el diálogo abierto en "progress") no tiene ningún botón que lo dispare. No es un bug — es una capacidad del controller sin una afordancia de UI correspondiente, documentada en Technical Debt en vez de inventarse una nueva UI durante hardening.
- **Cross-browser (Firefox/WebKit) sigue sin verificarse — confirmado como límite del ENTORNO de desarrollo actual** (solo Chromium está instalado), no una decisión de producto ni un hallazgo de UX. Un usuario en Safari/iPad (WebKit) sigue siendo una superficie de riesgo real no verificada — documentado explícitamente, no asumido como "probablemente funciona".

## 4. Quick Wins (menos de 30 minutos cada uno)

Los 3 Quick Wins de 0008 siguen vigentes sin cambios (nombre de archivo editable, mensaje de fallback de "Ajustar", texto de ayuda del selector de perfil — este último parcialmente obsoleto ahora que SÍ hay 3 perfiles reales funcionando, así que se reemplaza por uno nuevo):

1. Agregar un campo de texto editable para el nombre base del archivo en el paso de resultados (heredado de 0008, sin cambios).
2. Mostrar un mensaje breve si "Ajustar" no puede calcular una escala real (heredado de 0008, sin cambios).
3. ~~Agregar un texto de ayuda explicando por qué solo aparece un perfil~~ — ya no aplica (los 3 perfiles funcionan); en su lugar, considerar un texto breve aclarando que "Web Preview" no está en este wizard porque ya está cubierto por "Exportar" (rápido) — evita que un usuario que conoce el motor se pregunte por qué falta un 4to perfil.

## 5. Cambios medianos (más que un quick win, sin tocar arquitectura)

Sin cambios respecto a 0008 — exponer márgenes/cut path en "Avanzado" y localizar issues de Preflight en el preview siguen siendo los dos candidatos más claros para una fase de producto futura.

## 6. Cambios grandes (fuera del alcance de Fase 9.5, para un backlog futuro)

Sin cambios respecto a 0008 (UI de asignación de die-line, más perfiles imposicionables más allá del grid rectangular, persistencia de configuraciones como preset) — ninguno de los tres es un tema de hardening, y ninguno se tocó en esta fase por diseño.

---

**Nota de alcance:** esta auditoría evalúa el flujo tal como quedó después de Fase 9.5 (Hardening & Golden Tests) — el cierre formal de Epic 9 depende de esta auditoría más el resto de los criterios listados en `docs/platform/TRACEABILITY_MATRIX_EPIC9.md`, no solo de esta auditoría por sí sola.
