# 04 — Roadmap 2.0

> Reescrito por completo en Epic 6 (Platform Consolidation). El roadmap anterior organizaba el trabajo por etapas de ingeniería (Alpha/Beta/v1.0/v2.0) que ya no reflejaban dónde está realmente la plataforma — varias capacidades planeadas para "más adelante" se construyeron antes de lo previsto, y el documento no lo reflejaba con claridad. Esta versión organiza por **fases de producto**, no por épicas de implementación: cada fase es un estado real y verificable de qué puede hacer un usuario con Impulso, no una lista de tareas técnicas. Ver [`05-Technical-Debt.md`](05-Technical-Debt.md) para lo que cada fase sigue posponiendo deliberadamente, y [`PRODUCT_BACKLOG.md`](PRODUCT_BACKLOG.md) para capacidades futuras evaluadas con valor/prioridad/dependencias/complejidad.

---

## Fase 1 — Foundation ✅ Completa

**Objetivo:** un núcleo reutilizable (Document Schema → Engine → Renderer) y un primer recorrido funcional end-to-end, antes de construir cualquier experiencia de usuario real encima.

- Document Schema, Engine Core, Renderer Adapter (Konva) — tres paquetes con dependencia en una sola dirección, verificada sin dependencias circulares.
- Canvas Runtime: crear un documento, renderizarlo, seleccionar/mover/redimensionar/rotar, deshacer/rehacer.
- Persistencia local (Impulso Alpha): guardar y volver a abrir un documento, verificado sobreviviendo una recarga real de página.

Ver [`../MILESTONE_1_ALPHA.md`](../MILESTONE_1_ALPHA.md) y ADR-0001 a ADR-0009 para el detalle completo.

## Fase 2 — Professional Editor ✅ Completa (con gaps menores abiertos)

**Objetivo:** convertir el núcleo validado en una herramienta real de creación — el objetivo de esta fase, tal como se planteó originalmente ("una interfaz que alguien externo pueda usar sin acompañamiento"), ya está cumplido.

**Construido:**
- Interfaz de edición real (Toolbar, Sidebar/Inspector, paneles de Capas/Assets) — sin framework de UI, CSS/DOM directo.
- Agrupar/desagrupar, imágenes, edición de texto in-canvas, zoom (Sticker Creation Experience, Epic 1).
- Asset Library real: subir/gestionar/reutilizar imágenes (Epic 2).
- Export Engine: PNG y SVG (Epic 3).
- Templates: galería de puntos de partida + Templates propios guardados por el usuario (Epic 4).
- Project Library / Workspace: administrar múltiples proyectos, ya no un solo slot de guardado (Epic 5).

**Gaps todavía abiertos dentro de esta fase** (ver `UX_BACKLOG.md`/`05-Technical-Debt.md` para el detalle):
- Autosave (hoy guardado explícito — ver `PRODUCT_BACKLOG.md`).
- Accesibilidad de navegación por teclado (mover un object seleccionado, navegar grillas de tarjetas) — el Engine ya lo soporta sin cambios, es trabajo de UI pendiente.
- Pan del canvas mediante scroll nativo del contenedor, sin una herramienta dedicada de arrastre (Espacio/click central) como la de herramientas de referencia.
- Especificación de producto para Sticker Builder (sangrado, material) — sigue siendo, hasta hoy, solo un concepto en `../ARCHITECTURE.md`, sin UI real.

## Fase 3 — Print Production ⏳ Planeada

**Objetivo:** primer lanzamiento con ambición comercial real para el caso de uso central de Sticker Builder — un archivo listo para imprenta, no solo para pantalla.

- **PDF print-ready completo**: línea de corte y sangrado ensamblados correctamente, validado contra especificaciones reales de imprenta (ver `PRODUCT_BACKLOG.md`).
- **Rendimiento validado con documentos grandes**: la meta declarada del proyecto ("miles de objetos sin degradar la experiencia") deja de ser un objetivo documentado en `PERFORMANCE_BUDGET.md` y pasa a medirse con documentos reales de ese tamaño.
- **Persistencia robusta**: manejo explícito de cuota de almacenamiento agotada.

## Fase 4 — Commercial Platform ⏳ Planeada

**Objetivo:** algo que se pueda ofrecer a usuarios finales fuera de un contexto de prueba, con la calidad de experiencia que la Visión de Producto exige.

- **Onboarding**: la primera vez que alguien abre la app sin contexto previo, entiende qué hacer sin documentación externa.
- **Cuentas / Cloud Sync**: continuar un proyecto entre dispositivos (ver `PRODUCT_BACKLOG.md` — depende de que exista una razón de negocio concreta).
- **Compartir**: links de solo lectura o exportación compartible (ver `PRODUCT_BACKLOG.md`).
- **Fundación de AI Provider Agnostic**, si para entonces existe una primera capacidad de IA concreta a construir — nace desde el día uno detrás de un contrato/adaptador propio, nunca acoplada directamente a un proveedor.
- **Facturación**, si el negocio define una propuesta de precios validada.

## Fase 5 — Multi Builder Platform ⏳ Planeada

**Objetivo:** demostrar que Impulso Platform es una plataforma real, no un editor con nombre de plataforma — el segundo módulo real es la prueba definitiva de la tesis arquitectónica central (ver `docs/platform/STATE_001.md`, "Reutilización" y "Preparación para múltiples Builders": hoy calificadas 8/10 y 7/10, pero enteramente teóricas sin este hito).

- **Segundo módulo real** (Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder o Bundle Builder — a decidir según validación de mercado): construido reutilizando Impulso Engine sin modificarlo.
- **Design System compartido**: extraído con evidencia real de qué componentes se repiten entre Sticker Builder y el segundo módulo, no anticipado.
- **Los pilares de plataforma dejan de ser teóricos**: con un segundo módulo real consumiendo Asset Library/Export Engine/Templates/Project Library, cada uno se valida (o se corrige) con evidencia real.
- **Evaluación honesta de colaboración/Marketplace/Plugins públicos** (ver `PRODUCT_BACKLOG.md`) — evaluar con el contexto de negocio de ese momento, no antes.
- **Revisión de la arquitectura de plugins**: con dos-tres módulos reales ya construidos, es el momento correcto de revisar si el contrato boceteado desde Fase 0 (`registerShapeTypes`/`registerExporters`/`registerToolPanels`/`registerRendererBindings`) sigue siendo el adecuado, con evidencia real en vez de diseño especulativo.

---

## Cómo se actualiza este roadmap

Cada fase se descompone en épicas concretas cuando llega su turno, siguiendo la misma disciplina de micro-sprints con aprobación explícita ya establecida. Este documento se revisa — no se reescribe silenciosamente — cada vez que una fase avanza, para que el roadmap siga reflejando la realidad del proyecto. Ver [`docs/platform/STATE_001.md`](../platform/STATE_001.md) para la auditoría de plataforma que más recientemente confirmó este estado, y [`WHAT_SHOULD_WE_BUILD_NEXT.md`](../../WHAT_SHOULD_WE_BUILD_NEXT.md) para la recomendación puntual de la próxima épica.
