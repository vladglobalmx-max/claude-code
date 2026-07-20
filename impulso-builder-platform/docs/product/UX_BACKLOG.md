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
| 6 | Agregar `title` explicando el motivo del rechazo cuando el Engine rechaza un valor del Inspector (hoy el `title` siempre explica la sintaxis de expresión, nunca el motivo puntual) | UX Audit 0002 | Editor |
| 7 | Separador visual entre la fila de Alineación y la de Distribución en el Inspector, para reforzar que son categorías de operación distintas | UX Audit 0003 | Editor |
| 8 | Mencionar en el tooltip de Distribuir que requiere 3+ objects (hoy solo describe qué hace, no cuándo está disponible) | UX Audit 0003 | Editor |
| 9 | `title`/tooltip distinto en los handles de resize de un object rotado o Ellipse indicando que el snapping no está disponible ahí, en vez de simplemente no mostrar guías | UX Audit 0004 | Editor |
| 10 | Mencionar en el tooltip de "Snap" la jerarquía Página > Objects > Grid, no solo el modificador temporal (Ctrl/Cmd) | UX Audit 0004 | Editor |
| 11 | Estado `:hover` en los botones de ícono del panel de Capas (👁/🔒) y de Assets — hoy solo el propio `.layer-row` tiene hover, no sus botones internos | Fase 7.3.5 (Beta Stabilization) | Editor |
| 12 | Asociar los campos "Ancho (mm)"/"Alto (mm)" del diálogo "Nuevo proyecto" (personalizado) a su input con `<label for>` o `aria-label` — hoy son solo nodos de texto sueltos, sin asociación programática | Fase 7.3.5 (Beta Stabilization) | Editor |
| 13 | `title` en el candado de un object bloqueado que forma parte de una selección múltiple, explicando por qué quedó fuera de la caja compartida | UX Audit 0005 | Editor |
| 14 | Contador breve ("N objects seleccionados") en el Inspector cuando la selección es 2+ | UX Audit 0005 | Editor |

## Medium (más que un quick win, sin requerir una épica completa)

| # | Ítem | Origen | Bloque |
|---|---|---|---|
| 1 | Reemplazar `window.confirm()` de "Eliminar proyecto" por un diálogo con el mismo overlay ya usado en el resto de la app — consistencia visual, espacio para mostrar contexto | UX Audit 0001 | Workspace |
| 2 | Navegación por teclado básica de las grillas de tarjetas: tarjeta alcanzable con Tab, activable con Enter — mismo gap presente tanto en la Workspace como en la galería de "Nuevo proyecto" (Templates) | UX Audit 0001 + STATE_001 §5 | Workspace + Templates |
| 3 | ~~Aviso de cambios sin guardar al salir del editor~~ — **resuelto en Epic 8** (diálogo con foco atrapado + `beforeunload`, ver ADR-0019) | UX Audit 0001 + STATE_001 §10 | Editor / Workspace |
| 4 | Unificar la ubicación visual de las 4 acciones de una tarjeta de proyecto (Renombrar vive separado de Duplicar/Eliminar/Abrir) | UX Audit 0001 | Workspace |
| 5 | Detección de `Document.assets` huérfanos: eliminar un Asset no valida si algún `ImageObject` todavía lo referencia (hoy degrada a placeholder silenciosamente) | README `apps/sticker-builder`, §7 | Editor / Assets |
| 6 | Indicador de progreso al precargar Assets de un documento con muchas imágenes (`preloadDocumentAssets` resuelve todo de una vez, sin carga perezosa ni progresiva) | README `apps/sticker-builder`, §7 | Editor |
| 7 | Indicador visual breve durante el debounce de un campo numérico del Inspector (hoy el cambio se aplica en silencio tras la pausa, sin señal de "aplicando…") | UX Audit 0002 | Editor |
| 8 | Mensaje inline junto al campo inválido del Inspector, no solo color (mejora de accesibilidad sobre lo ya construido en Fase 7.1) | UX Audit 0002 | Editor |
| 9 | Mensaje explicativo específico cuando Distribuir produce superposición por falta de espacio (hoy es un comportamiento determinista sin explicación visible, distinto de un rechazo real) | UX Audit 0003 | Editor |
| 10 | Feedback visual breve cuando Shift desactiva el snap durante un resize (hoy simplemente deja de mostrar guías, sin indicar que es intencional) | UX Audit 0004 | Editor |
| 11 | Selector de unidad accesible desde los Rulers (clic derecho o control dedicado) — hoy no existe en ningún lugar de la UI | UX Audit 0004 | Editor |

## Large (esperar una épica futura o evaluación de producto)

| # | Ítem | Origen | Bloque |
|---|---|---|---|
| 1 | ~~Autosave~~ — **resuelto en Epic 8** (ver ADR-0019/ADR-0020) | UX Audit 0001 + Technical Debt | Editor / Workspace |
| 2 | Búsqueda/filtro/orden visible en la Workspace, cuando el volumen de proyectos por usuario lo justifique | UX Audit 0001 | Workspace |
| 3 | Miniaturas más ricas para proyectos con poco contenido (hoy casi indistinguibles entre sí a simple vista) | UX Audit 0001 | Workspace / Templates |
| 4 | Patrón "Recientes" separado de "Todos los proyectos" (estilo Figma home) si el catálogo por usuario crece | UX Audit 0001 | Workspace |
| 5 | Selección múltiple y acciones en lote (duplicar/eliminar varios proyectos a la vez) | UX Audit 0001 | Workspace |
| 6 | "Entrar" a un Group con doble-click para seleccionar/editar un hijo individual sin desagrupar primero | README `renderer-konva`/`sticker-builder` | Editor |
| 7 | Selección por marquee/rubber-band, movimiento por teclado del canvas, límites/guías/snapping de arrastre | README `renderer-konva`, §6 | Editor |
| 8 | Un modo de herramienta persistente (hoy Texto/Imagen insertan de inmediato, sin "armar" un modo de colocación) | README `apps/sticker-builder`, §7 | Editor |
| 9 | ~~Manejo explícito de cuota de almacenamiento agotada~~ — **resuelto para guardado de Project en Epic 8** (`QuotaExceededError` → mensaje accionable, ver ADR-0019); sigue pendiente para Asset Library | README `apps/sticker-builder`/`asset-library`, varios | Editor / Workspace / Assets |
| 10 | Onboarding: la primera vez que alguien abre la app sin contexto previo, debe entender qué hacer sin documentación externa (ya en el Roadmap como criterio de v1.0/Commercial Platform) | Roadmap | Plataforma completa |
| 11 | Selector de fuentes curado (lista de fuentes reales disponibles, con previsualización) en vez de texto libre en el campo Tipografía del Inspector | UX Audit 0002 | Editor |
| 12 | Vista previa en vivo al pasar el mouse sobre un botón de Alineación (ghost/outline de dónde quedaría cada object) | UX Audit 0003 | Editor |
| 13 | Snapping de resize para objects rotados (requiere generalizar qué "borde" corresponde a cada handle cuando el AABB rotado ya no tiene correspondencia 1:1 eje↔handle) | UX Audit 0004 | Editor |
| 14 | Guías manuales arrastrables (guides), márgenes y columnas — excluidos explícitamente del alcance de Fase 7.3, quedan para una fase futura de Assisted Placement | UX Audit 0004 | Editor |
| 15 | Snapping/Smart Guides considerando objects dentro de un `group` (hoy solo top-level, mismo gap pendiente que Alignment) | UX Audit 0004 | Editor |
| 16 | **[Prioridad alta]** Herramienta para insertar un Rectangle/Ellipse nuevo desde el toolbar — hoy no existe ningún camino de UI para crearlos (ver Technical Debt) | Fase 7.3.5 (Beta Stabilization) | Editor |
| 17 | ~~Handle de rotación inalcanzable cuando el object está a menos de 24px del borde superior de la página~~ — **resuelto en Fase 7.4** (`clampPointToStageBounds`, ADR-0018) | Fase 7.3.5 (Beta Stabilization) | Editor |
| 18 | Incluir `size` explícito al insertar un `TextObject` desde el toolbar, para que Ancho/Alto aparezcan en el Inspector igual que en cualquier otro tipo de object | Fase 7.3.5 (Beta Stabilization) | Editor |
| 19 | Unificar el sistema de iconografía (emoji en Capas, SVG inline en Alineación, texto plano en Grid/Snap/Zoom) — depende de que exista un Design System (ver Technical Debt, "pilares no construidos") | Fase 7.3.5 (Beta Stabilization) | Plataforma completa |
| 20 | Soporte de *shear*/skew en el Document Schema, para que el resize de una selección múltiple con members rotados sea geométricamente exacto en todos los casos (ver Technical Debt, ADR-0017) | Fase 7.4 (Professional Multi Selection) | Editor |
| 21 | Señal visual/tooltip cuando el handle de rotación fue recortado por cercanía a un borde (ADR-0018) — hoy se ve idéntico a un handle sin recortar, solo más cerca del object | Fase 7.4 (Professional Multi Selection) | Editor |
| 22 | Indicación textual ("N objects seleccionados") en algún punto visible de la UI durante una selección múltiple — hoy solo se infiere contando filas `.selected` en Capas | Fase 7.4 (Professional Multi Selection) | Editor |

---

## Bloques todavía sin una UX Audit formal

La práctica de UX Audits nació con Epic 5 — los siguientes bloques, ya construidos, nunca fueron auditados bajo el mismo proceso riguroso que la Workspace. Es razonable esperar hallazgos adicionales, hoy no documentados, cuando les toque su turno:

- **Editor** — el Inspector de un object individual (UX Audit 0002) y la sección de Alineación (UX Audit 0003) ya están auditados; Toolbar, Canvas Runtime y manipulación de un solo object (resize/rotate) siguen sin auditoría formal.
- **Export** (diálogo de exportación PNG/SVG) — Epic 3.
- **Templates** (galería de "Nuevo proyecto", "Guardar como plantilla") — Epic 4.

## Cómo se usa este documento

Se revisa cada vez que se genera una nueva UX Audit (`docs/ux-audits/000N-*.md`) — sus hallazgos se trasladan aquí, clasificados en Quick Win/Medium/Large. Priorizar desde aquí es una decisión de producto explícita, no automática: este documento no implica que todo lo listado se vaya a construir, ni en qué orden.
