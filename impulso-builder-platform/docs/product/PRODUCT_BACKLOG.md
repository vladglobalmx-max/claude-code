# Product Backlog — Impulso Platform

> Capacidades futuras de producto — no deuda técnica (ver `05-Technical-Debt.md` para lo que se decide no construir todavía por razones de arquitectura/alcance) y no oportunidades de UX sobre lo ya construido (ver `UX_BACKLOG.md`). Cada capacidad se evalúa con Valor, Prioridad, Dependencias y Complejidad — documentar aquí no es comprometerse a construir, es dejar la evaluación lista para cuando el negocio decida que es momento.

---

## ~~Autosave~~ — Construido en Epic 8

**Resuelto.** Ver [ADR-0019](../adr/0019-autosave-save-coordinator.md) (Autosave & Save Coordinator) y [ADR-0020](../adr/0020-project-recovery.md) (Project Recovery). El riesgo de mayor impacto detectado en la plataforma (UX Audit 0001 — pérdida silenciosa de trabajo no guardado) queda cerrado: autosave con debounce, indicador de estado honesto, salida segura del editor, `beforeunload` como última línea de defensa, y recovery ante cierres inesperados. El riesgo de complejidad anticipado (regenerar el thumbnail en cada autosave) se aceptó conscientemente en vez de resolverse con una cadencia separada — ver `docs/PERFORMANCE_BUDGET.md` fila 19 para el razonamiento y qué haría falta medir antes de separarlo.

## PDF Print-Ready (línea de corte + sangrado)

- **Valor:** Es la capacidad que distingue a Impulso de un editor gráfico genérico — el caso de uso comercial central (imprimir un sticker real). Ya está en el Roadmap desde Fase 0.
- **Prioridad:** Alta — es la única capacidad de esta lista con una razón de negocio ya validada desde el inicio del proyecto (no una especulación).
- **Dependencias:** Export Engine (`packages/export-engine`) ya construido; necesita un nuevo formato de exportación (PDF) y una capa de ensamblado de línea de corte/sangrado sobre el Document Schema.
- **Complejidad:** Alta. Requiere validar contra especificaciones reales de imprenta, offsetting de polígonos (Clipper o similar) para la línea de corte, y probablemente una librería de ensamblado de PDF nueva en el navegador.

## Cloud Sync / Cuentas

- **Valor:** Habilita continuar un proyecto entre dispositivos — condición previa para cualquier capacidad de colaboración, compartir, o versionado real.
- **Prioridad:** Media — sin una razón de negocio concreta todavía (uso actual es 100% individual y local), pero es la dependencia dura de casi todo lo demás en este documento.
- **Dependencias:** Requiere Auth (identificar usuarios) + backend HTTP + base de datos remota — ninguno existe hoy. `StorageProvider`/`ProjectStore` ya están diseñados como interfaces reemplazables, así que una implementación remota no exigiría rediseñar cómo el Engine guarda/lee un documento.
- **Complejidad:** Alta. Es, en la práctica, la primera pieza de infraestructura de servidor de toda la plataforma — nada de eso existe hoy (ver `05-Technical-Debt.md`, "Infraestructura y backend").

## Compartir (links de solo lectura / exportación compartible)

- **Valor:** Un caso de uso B2C/B2B de bajo esfuerzo relativo con alto valor percibido (mostrarle un diseño a alguien sin que edite) — suele preceder a la colaboración real en la mayoría de herramientas de referencia.
- **Prioridad:** Media.
- **Dependencias:** Requiere que el proyecto viva en algún lugar accesible por URL — depende de Cloud Sync/backend, aunque una versión mínima (exportar y compartir el archivo PNG/SVG ya generado) no depende de nada nuevo.
- **Complejidad:** Media si se limita a "compartir el archivo ya exportado"; Alta si implica una vista web interactiva del proyecto en sí (requeriría un renderer de solo lectura del Document Schema fuera del editor).

## Versionado (historial de versiones de un proyecto)

- **Valor:** Complementa el undo/redo en memoria (efímero, se pierde al recargar) con un historial real y persistente — "volver a como estaba ayer", no solo "deshacer el último cambio de esta sesión".
- **Prioridad:** Media.
- **Dependencias:** Se beneficia de, pero no depende estrictamente de, Cloud Sync (podría implementarse localmente guardando snapshots periódicos en el `ProjectStore` existente).
- **Complejidad:** Media. El `Document Schema` ya tiene `documentVersion`/`schemaVersion` — el modelo de datos está listo; falta la UI de "ver una versión anterior" y la política de cuántos snapshots conservar.

## Colaboración en tiempo real

- **Valor:** Habilita un caso de uso B2B genuino (equipos de diseño editando junto) — pero fuera del objetivo actual declarado (editor individual, rápido, offline-first).
- **Prioridad:** Baja — explícitamente diferida hasta que un caso de negocio B2B lo justifique (ver `05-Technical-Debt.md`).
- **Dependencias:** Cuentas + Cloud Sync + resolución de conflictos de edición simultánea — la lista de dependencias más larga de todo este documento.
- **Complejidad:** Alta. Introduce problemas de concurrencia (CRDTs u operational transform) sin relación directa con nada ya construido.

## Marketplace (plantillas/assets/plugins de terceros)

- **Valor:** Monetización de contenido de terceros y efecto de red — pero solo tiene sentido con una base de usuarios y un catálogo de contenido ya grande.
- **Prioridad:** Baja — no existe todavía ni un segundo módulo real ni una base de usuarios que lo justifique.
- **Dependencias:** Cuentas, Cloud Sync, un modelo de monetización definido, y probablemente Plugins públicos (para la porción de terceros).
- **Complejidad:** Alta. Es, en esencia, un producto propio (catálogo, moderación, pagos) construido sobre Impulso, no una funcionalidad del editor.

## Plugins públicos (API de terceros)

- **Valor:** Extiende Impulso más allá de lo que el propio equipo construye — pero la arquitectura de plugins hoy existe para que Impulso mismo crezca (módulos internos), no para terceros.
- **Prioridad:** Baja — sin al menos dos-tres módulos internos reales validando el contrato de plugin, abrir la superficie a terceros sería comprometerse a una API pública sin evidencia de que la forma actual (boceto de Fase 0, nunca implementado) es la correcta.
- **Dependencias:** Segundo/tercer módulo real construido primero (para validar el contrato de plugin con evidencia, no diseño anticipado).
- **Complejidad:** Alta. Implica compromisos de API pública y seguridad (sandboxing de código de terceros) que hoy no están ni diseñados.

## AI (generación de imágenes, sugerencias de diseño, autocompletado)

- **Valor:** Potencialmente el mayor diferenciador de producto de esta lista — pero ninguna capacidad de IA existe hoy en la plataforma.
- **Prioridad:** Media — depende de qué capacidad concreta se defina primero (generación de imágenes para Assets vs. sugerencias de layout vs. autocompletado de texto son proyectos muy distintos).
- **Dependencias:** Ninguna arquitectónica bloqueante — el principio "AI Provider Agnostic" (ver `02-Product-Principles.md`) ya está declarado desde antes de que exista la primera funcionalidad, precisamente para que la primera integración nazca detrás de un contrato/adaptador propio.
- **Complejidad:** Variable según la capacidad elegida — desde Media (un botón "generar imagen" que llama a un proveedor externo) hasta Alta (sugerencias de layout que requieren entender el Document Schema semánticamente).

## Segundo módulo real (Multi Builder Platform)

- **Valor:** Es, en sí mismo, la prueba definitiva de la tesis arquitectónica central del proyecto ("un núcleo, múltiples productos") — sin esto, toda afirmación de reutilización de plataforma sigue siendo teórica (ver `docs/platform/STATE_001.md`, Riesgos #2).
- **Prioridad:** Alta desde la perspectiva arquitectónica (valida o corrige cada pilar con evidencia real); depende de validación de mercado desde la perspectiva de negocio (qué módulo construir: Planner Builder, Coloring Book Builder, Flashcard Builder, Worksheet Builder, Journal Builder, Bundle Builder).
- **Dependencias:** Ninguna técnica bloqueante — es precisamente lo que toda la arquitectura actual se preparó para soportar.
- **Complejidad:** Alta en esfuerzo absoluto (un módulo completo), pero la complejidad INCREMENTAL sobre la plataforma ya construida es la variable que esta capacidad existe para medir.

## Design System compartido

- **Valor:** Elimina la reimplementación de UI ad-hoc (CSS/DOM directo) que cada módulo nuevo tendría que repetir — ya identificado como un gap real en `docs/platform/STATE_001.md` ("Preparación para múltiples Builders").
- **Prioridad:** Media — se vuelve alta en el momento exacto en que arranca el segundo módulo real.
- **Dependencias:** Se beneficia enormemente de construirse EN PARALELO con (o inmediatamente antes de) el segundo módulo real, con evidencia real de qué componentes se repiten, en vez de anticipar componentes que ese módulo termine no necesitando.
- **Complejidad:** Media. La superficie visual actual de Sticker Builder (Toolbar, Sidebar, diálogos, galería de tarjetas) ya es un inventario razonable de qué extraer primero.

---

## Cómo se usa este documento

Prioridad y Complejidad son puntos de partida para una conversación de producto, no una promesa. Se revisa cada vez que se cierra una épica grande o cuando el negocio evalúa qué construir después — ver `WHAT_SHOULD_WE_BUILD_NEXT.md` para la recomendación puntual más reciente.
