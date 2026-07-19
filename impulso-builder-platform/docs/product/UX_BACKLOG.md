# UX Backlog — Impulso Platform

> Consolida todas las oportunidades de mejora de experiencia de usuario detectadas hasta hoy — desde `docs/ux-audits/`, desde las secciones "Riesgos y limitaciones conocidas"/"UX" de cada README de paquete/app, y desde la propia auditoría de plataforma (`docs/platform/STATE_001.md`). Es un documento vivo de **oportunidades**, no un compromiso de implementación — alimenta decisiones de producto futuras. Ver `docs/ux-audits/README.md` para cómo se generan las auditorías que nutren este backlog.

---

## Quick Wins (menos de 30 minutos cada uno)

| # | Ítem | Origen | Bloque |
|---|---|---|---|
| 1 | Igualar la etiqueta del botón "Nuevo" (editor) y "Nuevo proyecto" (Workspace) — misma función, dos textos distintos | UX Audit 0001 | Workspace / Editor |
| 2 | Tooltip en "Guardar" ("Guarda este proyecto en Mis proyectos") y "Guardar como plantilla" ("Crea una plantilla reutilizable") — resuelve la confusión conceptual más probable entre Workspace y Templates | UX Audit 0001 | Editor |
| 3 | Estado `:hover` visible en `.workspace-card` (borde o sombra) — señal de interactividad antes del clic | UX Audit 0001 | Workspace |
| 4 | Repetir el botón "Nuevo proyecto" junto al mensaje de estado vacío, no solo arriba a la derecha | UX Audit 0001 | Workspace |
| 5 | `aria-label` explícito en el botón de ícono (lápiz de renombrar), además del `title` ya existente | UX Audit 0001 | Workspace |

## Medium (más que un quick win, sin requerir una épica completa)

| # | Ítem | Origen | Bloque |
|---|---|---|---|
| 1 | Reemplazar `window.confirm()` de "Eliminar proyecto" por un diálogo con el mismo overlay ya usado en el resto de la app — consistencia visual, espacio para mostrar contexto | UX Audit 0001 | Workspace |
| 2 | Navegación por teclado básica de las grillas de tarjetas: tarjeta alcanzable con Tab, activable con Enter — mismo gap presente tanto en la Workspace como en la galería de "Nuevo proyecto" (Templates) | UX Audit 0001 + STATE_001 §5 | Workspace + Templates |
| 3 | Aviso de cambios sin guardar al salir del editor (Ctrl/Cmd+O, botón "Mis proyectos", cerrar la pestaña) — el hallazgo de mayor impacto detectado hasta la fecha en toda la plataforma | UX Audit 0001 + STATE_001 §10 | Editor / Workspace |
| 4 | Unificar la ubicación visual de las 4 acciones de una tarjeta de proyecto (Renombrar vive separado de Duplicar/Eliminar/Abrir) | UX Audit 0001 | Workspace |
| 5 | Detección de `Document.assets` huérfanos: eliminar un Asset no valida si algún `ImageObject` todavía lo referencia (hoy degrada a placeholder silenciosamente) | README `apps/sticker-builder`, §7 | Editor / Assets |
| 6 | Indicador de progreso al precargar Assets de un documento con muchas imágenes (`preloadDocumentAssets` resuelve todo de una vez, sin carga perezosa ni progresiva) | README `apps/sticker-builder`, §7 | Editor |

## Large (esperar una épica futura o evaluación de producto)

| # | Ítem | Origen | Bloque |
|---|---|---|---|
| 1 | Autosave — resuelve de raíz el riesgo de pérdida silenciosa de trabajo (ver Medium #3) | UX Audit 0001 + Technical Debt | Editor / Workspace |
| 2 | Búsqueda/filtro/orden visible en la Workspace, cuando el volumen de proyectos por usuario lo justifique | UX Audit 0001 | Workspace |
| 3 | Miniaturas más ricas para proyectos con poco contenido (hoy casi indistinguibles entre sí a simple vista) | UX Audit 0001 | Workspace / Templates |
| 4 | Patrón "Recientes" separado de "Todos los proyectos" (estilo Figma home) si el catálogo por usuario crece | UX Audit 0001 | Workspace |
| 5 | Selección múltiple y acciones en lote (duplicar/eliminar varios proyectos a la vez) | UX Audit 0001 | Workspace |
| 6 | "Entrar" a un Group con doble-click para seleccionar/editar un hijo individual sin desagrupar primero | README `renderer-konva`/`sticker-builder` | Editor |
| 7 | Selección por marquee/rubber-band, movimiento por teclado del canvas, límites/guías/snapping de arrastre | README `renderer-konva`, §6 | Editor |
| 8 | Un modo de herramienta persistente (hoy Texto/Imagen insertan de inmediato, sin "armar" un modo de colocación) | README `apps/sticker-builder`, §7 | Editor |
| 9 | Manejo explícito de cuota de almacenamiento agotada, con mensaje claro en vez de fallar silenciosamente | README `apps/sticker-builder`/`asset-library`, varios | Editor / Workspace / Assets |
| 10 | Onboarding: la primera vez que alguien abre la app sin contexto previo, debe entender qué hacer sin documentación externa (ya en el Roadmap como criterio de v1.0/Commercial Platform) | Roadmap | Plataforma completa |

---

## Bloques todavía sin una UX Audit formal

La práctica de UX Audits nació con Epic 5 — los siguientes bloques, ya construidos, nunca fueron auditados bajo el mismo proceso riguroso que la Workspace. Es razonable esperar hallazgos adicionales, hoy no documentados, cuando les toque su turno:

- **Editor** (Toolbar, Sidebar/Inspector, Canvas Runtime, manipulación) — Epics 1 y Editor Epics 1-3.
- **Export** (diálogo de exportación PNG/SVG) — Epic 3.
- **Templates** (galería de "Nuevo proyecto", "Guardar como plantilla") — Epic 4.

## Cómo se usa este documento

Se revisa cada vez que se genera una nueva UX Audit (`docs/ux-audits/000N-*.md`) — sus hallazgos se trasladan aquí, clasificados en Quick Win/Medium/Large. Priorizar desde aquí es una decisión de producto explícita, no automática: este documento no implica que todo lo listado se vaya a construir, ni en qué orden.
