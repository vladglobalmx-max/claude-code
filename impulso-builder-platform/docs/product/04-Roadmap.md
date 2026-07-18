# 04 — Roadmap

> Roadmap de producto, no de implementación técnica línea por línea. Cada etapa se detalla en Editor Epics/Milestones concretos cuando llega su turno — este documento fija el destino, no el camino exacto. Ver [`05-Technical-Debt.md`](05-Technical-Debt.md) para lo que cada etapa sigue posponiendo deliberadamente.

---

## Alpha — ✅ Completada (Milestone 1)

**Objetivo:** validar que el flujo completo, de principio a fin, funciona antes de seguir construyendo funcionalidades nuevas sobre una base sin probar.

- Crear un documento, mostrar el canvas, renderizar objetos.
- Seleccionar, mover, redimensionar, rotar.
- Deshacer / rehacer.
- Guardar localmente y volver a abrir el documento.
- Verificado de punta a punta en un navegador real, incluyendo persistencia sobreviviendo una recarga real de página.

Ver [`../MILESTONE_1_ALPHA.md`](../MILESTONE_1_ALPHA.md) para el detalle completo, incluidas las limitaciones conocidas de esta etapa.

## Beta

**Objetivo:** convertir el Alpha (que valida el flujo) en una herramienta que alguien externo al equipo pueda usar sin acompañamiento — todavía sin ambición de "producto terminado", pero sin las asperezas que el Alpha aceptó a propósito.

- **Interfaz de edición real**: Toolbar y Sidebar/Inspector con diseño (no botones HTML sin estilo) — panel de propiedades (color, opacidad, tipografía), lista de capas. Primer uso real que justificaría empezar el pilar **Design System** (ver [`03-Architecture-Map.md`](03-Architecture-Map.md)).
- ~~**Asset Library, primera versión**: subir/gestionar imágenes propias, en vez de solo el contenido de demostración~~ — construida antes de lo previsto, en Epic 2 (`packages/asset-library`), ver [`../adr/0011-asset-library.md`](../adr/0011-asset-library.md).
- **Múltiples documentos**: reemplazar el slot único de `localStorage` (Alpha) por una gestión real de varios proyectos guardados localmente (IndexedDB), con lista, nombres y miniaturas.
- **Especificación de producto para Sticker Builder**: tamaño físico, forma, sangrado y material del sticker — lo que hoy solo existe como concepto en `../ARCHITECTURE.md`.
- ~~**Export Engine, primera versión**: PNG y SVG como mínimo~~ — construida antes de lo previsto, en Epic 3 (`packages/export-engine`), ver [`../adr/0012-export-engine.md`](../adr/0012-export-engine.md).
- **Zoom y Pan** — hoy el canvas se corta si el documento excede el tamaño de la ventana; sin esto, un documento de tamaño real no es utilizable.
- **Accesibilidad de primera pasada**: navegación por teclado para al menos mover un object seleccionado (el Engine ya soporta esto sin cambios — es un problema de UI, no de arquitectura).

## v1.0

**Objetivo:** primer lanzamiento con ambición comercial real — algo que se pueda ofrecer a usuarios finales fuera de un contexto de prueba, con la calidad de experiencia que la Visión de Producto exige.

- **Exportación print-ready completa**: PDF con línea de corte y sangrado ensamblado correctamente, validado contra especificaciones reales de imprenta.
- **Plantillas / punto de partida**: no empezar siempre de un lienzo en blanco o el demo — una selección curada de plantillas de sticker.
- **Rendimiento validado con documentos grandes**: la meta declarada del proyecto ("miles de objetos sin degradar la experiencia") deja de ser un objetivo documentado en `PERFORMANCE_BUDGET.md` y pasa a estar medido con documentos reales de ese tamaño — resolviendo, si hace falta, la reconciliación incremental del Renderer (ya diseñada, no implementada).
- **Onboarding**: la primera vez que alguien abre la app sin contexto previo, entiende qué hacer sin documentación externa.
- **Persistencia robusta**: manejo explícito de cuota de almacenamiento agotada, en vez de fallar sin un mensaje claro (limitación conocida desde Alpha).
- **Fundación de AI Provider Agnostic** (si para entonces existe una primera capacidad de IA, ver `02-Product-Principles.md`): cualquier integración de IA nace detrás de un contrato/adaptador propio, nunca acoplada directamente a un proveedor.

## v2.0

**Objetivo:** demostrar que Impulso Platform es una plataforma real, no un editor con nombre de plataforma — el segundo módulo real es la prueba definitiva de la tesis arquitectónica central.

- **Segundo módulo real** (Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder o Bundle Builder — a decidir según validación de mercado, ver [`03-Architecture-Map.md`](03-Architecture-Map.md) para el roster completo): construido reutilizando Impulso Engine sin modificarlo — la prueba de que "un núcleo, múltiples productos" no era solo una aspiración de arquitectura.
- **Los pilares de plataforma dejan de ser especulativos**: con un segundo módulo real consumiendo Design System/Asset Library/Export Engine, cada uno se valida (o se corrige) con evidencia real en vez de diseño anticipado — exactamente el propósito de no construirlos antes de que hubiera un segundo consumidor.
- **Evaluación honesta de cuentas/sincronización remota (Shared Services)**: solo si para entonces existe una necesidad real de continuar un proyecto entre dispositivos — no antes, y no por moda (ver ADR-0009 y `../ARCHITECTURE.md` §9, "diferido hasta que exista necesidad real").
- **Exploración de colaboración** (si el módulo de negocio lo justifica): evaluar, no necesariamente construir todavía — ver `05-Technical-Debt.md`.
- **Revisión de la arquitectura de plugins**: con dos-tres módulos reales ya construidos, es el momento correcto de revisar si el contrato de plugin (`registerShapeTypes`/`registerExporters`/`registerToolPanels`/`registerRendererBindings`, boceto en `../ARCHITECTURE.md` §2.4) sigue siendo el adecuado, con evidencia real en vez de diseño especulativo.

---

## Cómo se actualiza este roadmap

Cada etapa se descompone en Foundations/Editores/Editor Epics/Milestones concretos cuando llega su turno, siguiendo la misma disciplina de micro-sprints con aprobación explícita ya establecida. Este documento se revisa — no se reescribe silenciosamente — cada vez que una etapa se da por completa, para que el roadmap siga reflejando la realidad del proyecto y no una intención congelada en el tiempo.
