> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba "Impulso Platform" con Sticker Builder como primer módulo de un ecosistema de varios productos futuros — modelo de plataforma descartado por la reinvención hacia THÖREN 2.0 (`THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`). Se conserva íntegro como registro histórico de la intención original. La función que este documento cumplía ahora vive en la cadena vigente de THÖREN — ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) §Fuentes de verdad para la fuente única vigente de cada tema.

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
| 15 | Agregar un campo de texto editable para el nombre base del archivo en el wizard de "Exportar para impresión" (paso de configuración o de resultados), en vez de depender únicamente del nombre del Project al abrir el diálogo | UX Audit 0008 | Editor / Export |
| 16 | Mostrar un mensaje breve ("No hay nada que ajustar todavía") si "Ajustar" (Fit) del Production Preview no puede calcular una escala real, en vez de no hacer nada visible | UX Audit 0008 | Editor / Export |
| 17 | ~~Texto de ayuda explicando por qué solo aparece un perfil~~ — ya no aplica (los 3 perfiles funcionan desde Fase 9.5). Reemplazado: texto breve aclarando por qué "Web Preview" no aparece en este wizard (ya cubierto por "Exportar" rápido) — para que un usuario que conoce el motor no se pregunte por un 4to perfil faltante | UX Audit 0009 | Editor / Export |

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
| 12 | **Exponer márgenes por lado y configuración de cut path (color/grosor/offset) en una sección "Avanzado"** del paso de configuración del wizard de exportación — hoy son parte del `PrintJob`/`GridImpositionSpec` pero no editables desde el flujo | UX Audit 0008 | Editor / Export |
| 13 | **Localizar issues de Preflight en el Production Preview** — al hacer click en un issue con `pageId`/`objectId`, resaltar temporalmente esa pieza/hoja en el preview; requiere permitir volver al paso de preview desde Preflight sin perder el estado ya calculado (hoy el flujo es estrictamente lineal hacia adelante salvo "Atrás") | UX Audit 0008 | Editor / Export |

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
| 10 | ~~Onboarding: la primera vez que alguien abre la app sin contexto previo, debe entender qué hacer sin documentación externa~~ — **resuelto en Fase 4.2**: `welcomeDialog.ts`, bienvenida breve y cerrable en el primer uso (gateada por `localStorage`, nunca repetida), más "Estado comercial" honesto visible en la Workspace y documentación completa del comprador en español (`commercial-assets/docs/`) | Fase 4.2 (Commercial MVP) | Workspace |
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
| 23 | ~~La UI real de exportación a producción necesita: toggles de visibilidad, selector de kiss-cut/die-cut, indicación de color RGB no-certificado, superficie para los códigos de Preflight~~ — **resuelto en Fase 9.4** (`productionPreview.ts`/`productionExportDialog.ts`, ver ADR-0025): toggles de overlay diferenciados por `stroke-dasharray` además de color, issues de Preflight mostrados con `message`/`recommendation` en texto, agrupados por severidad | Fase 9.3 (Marks, Safe Area & Cut Paths) | Editor / Export |
| 24 | **UI de asignación de `metadata.role: "die-line"`** en el Inspector — desbloquearía el camino feliz completo del wizard de exportación (y del Production Preview de Fase 9.3) sin depender de editar el documento directamente; hoy es la brecha más visible detectada durante la verificación E2E real de Fase 9.4 | UX Audit 0008 | Editor / Export |
| 25 | ~~Múltiples perfiles de imposición en el wizard de exportación~~ — **resuelto en Fase 9.5**: el gap real era wiring de UI (`pendingProfileId` hardcodeado), no falta de perfiles en el motor — ver enmienda de ADR-0025. El wizard ahora ofrece Digital PNG/Print PDF/Sticker Sheet; "Web Preview" queda fuera por decisión explícita (cubierto por el export rápido existente) | UX Audit 0008 | Editor / Export |
| 26 | **Persistencia de configuraciones de imposición como preset reutilizable** — explícitamente fuera de alcance de Fase 9.4 salvo trivial; evaluar cuando exista evidencia real de que los usuarios repiten la misma configuración entre proyectos | UX Audit 0008 | Editor / Export |
| 27 | **UX comercial** (activación, feature bloqueada, periodo de gracia, upgrade, recuperación) — wireflows textuales diseñados en Fase 4.1 (`docs/platform/V1_COMMERCIAL_RECOMMENDATION.md` §4), sin UI real todavía; solo se construye si Fase 4.2+ introduce una segunda edición/producto que la justifique | Fase 4.1 (Commercial Platform Architecture) | Plataforma completa |
| 28 | Los botones de Grid/Snap muestran su estado como "Grid: on"/"Snap: off" (inglés) — decisión deliberada de Fase 7.3 (referenciando la convención de Figma/Canva/Kittl), revisada durante la revisión de branding de Release Candidate 1.0 y dejada intacta a propósito (cambiarla es un ajuste de terminología más amplio, no un bug ni una inconsistencia accidental como "Metadata"/"Assets", que sí se corrigieron en RC1) — evaluar una localización completa de Grid/Snap solo si feedback real de compradores lo señala como confuso | RC1 (revisión de branding) | Editor |

---

## Bloques todavía sin una UX Audit formal

La práctica de UX Audits nació con Epic 5 — los siguientes bloques, ya construidos, nunca fueron auditados bajo el mismo proceso riguroso que la Workspace. Es razonable esperar hallazgos adicionales, hoy no documentados, cuando les toque su turno:

- **Editor** — el Inspector de un object individual (UX Audit 0002) y la sección de Alineación (UX Audit 0003) ya están auditados; Toolbar, Canvas Runtime y manipulación de un solo object (resize/rotate) siguen sin auditoría formal.
- **Export** (diálogo de exportación PNG/SVG) — Epic 3.
- **Templates** (galería de "Nuevo proyecto", "Guardar como plantilla") — Epic 4.

## Cómo se usa este documento

Se revisa cada vez que se genera una nueva UX Audit (`docs/ux-audits/000N-*.md`) — sus hallazgos se trasladan aquí, clasificados en Quick Win/Medium/Large. Priorizar desde aquí es una decisión de producto explícita, no automática: este documento no implica que todo lo listado se vaya a construir, ni en qué orden.
