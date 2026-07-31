> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Documentaba "Impulso Platform" con Sticker Builder como primer módulo de un ecosistema de varios productos futuros — modelo de plataforma descartado por la reinvención hacia THÖREN 2.0 (`THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`). Se conserva íntegro como registro histórico de la intención original. La función que este documento cumplía ahora vive en la cadena vigente de THÖREN — ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) §Fuentes de verdad para la fuente única vigente de cada tema.

# Product Backlog — Impulso Platform

> Capacidades futuras de producto — no deuda técnica (ver `05-Technical-Debt.md` para lo que se decide no construir todavía por razones de arquitectura/alcance) y no oportunidades de UX sobre lo ya construido (ver `UX_BACKLOG.md`). Cada capacidad se evalúa con Valor, Prioridad, Dependencias y Complejidad — documentar aquí no es comprometerse a construir, es dejar la evaluación lista para cuando el negocio decida que es momento.

---

## ~~Autosave~~ — Construido en Epic 8

**Resuelto.** Ver [ADR-0019](../adr/0019-autosave-save-coordinator.md) (Autosave & Save Coordinator) y [ADR-0020](../adr/0020-project-recovery.md) (Project Recovery). El riesgo de mayor impacto detectado en la plataforma (UX Audit 0001 — pérdida silenciosa de trabajo no guardado) queda cerrado: autosave con debounce, indicador de estado honesto, salida segura del editor, `beforeunload` como última línea de defensa, y recovery ante cierres inesperados. El riesgo de complejidad anticipado (regenerar el thumbnail en cada autosave) se aceptó conscientemente en vez de resolverse con una cadencia separada — ver `docs/PERFORMANCE_BUDGET.md` fila 19 para el razonamiento y qué haría falta medir antes de separarlo.

## PDF Print-Ready (línea de corte + sangrado + imposición) — motor, UI real y hardening completos (Epic 9, cerrada)

**Resuelto para V1 y endurecido — con limitaciones documentadas, no capacidades faltantes de negocio.** El motor completo existe: `packages/print-engine` (Fases 9.1-9.5, ver [ADR-0021](../adr/0021-print-engine-foundation.md)/[ADR-0022](../adr/0022-print-engine-raster-pipeline.md)/[ADR-0023](../adr/0023-print-engine-marks-safearea-cutpaths.md)/[ADR-0024](../adr/0024-print-engine-imposition.md)) produce PDF/PNG aplanados de alta resolución con boxes físicos correctos (Trim/Bleed/Media/Crop), marcas de corte vectoriales reales, safe area verificable, cut paths (kiss-cut/die-cut V1, offset exacto para Rectangle/Ellipse), e imposición/repetición en hojas (grid automático o fijo, gaps/márgenes/alineación, reutilización real de raster a escala). `apps/sticker-builder` tiene el flujo real de "Exportar para impresión" — un wizard de 7 pasos que un usuario real puede usar de principio a fin hoy con sus 3 perfiles reales funcionando (Digital PNG/Print PDF/Sticker Sheet), verificado en Chromium real (ver [ADR-0025](../adr/0025-production-export-workflow.md), 2 enmiendas de Fase 9.5) y con performance/memoria/resource-leaks verificados con datos reales (Fase 9.5, ver `docs/PERFORMANCE_BUDGET.md`).
- **Lo que queda, documentado como limitación V1, no como "falta construir"**: nombre de archivo editable dentro del wizard, localización visual de un issue de Preflight en el Production Preview, márgenes/cut path/PPI editables desde el wizard (hoy heredan del `PrintJob`), UI de asignación de `metadata.role: "die-line"` en el Inspector (hoy solo editable directamente en el documento). Ver UX Audit 0008/0009 para el detalle completo. ~~Múltiples perfiles de impresión imposicionables~~ — resuelto en Fase 9.5 (era un gap de wiring, no del motor).
- **Prioridad:** Ya no aplica una prioridad activa — la épica está cerrada. Cualquier trabajo futuro (más perfiles, editar nombre de archivo desde el wizard, etc.) requeriría una nueva evaluación de negocio, no es continuación automática de Epic 9.
- **Dependencias:** Export Engine (`packages/export-engine`) + Print Engine (`packages/print-engine`, Fases 9.1-9.5) — ambos construidos, endurecidos, y en uso real.
- **Complejidad:** Resuelta. Fase 9.5 (Hardening & Golden Tests) completada — golden outputs/fixtures, precisión física/determinismo/property-based tests, performance/memoria/resource-leaks verificados en Chromium real, error injection y cancelación cooperativa exhaustiva, tabla formal de 44 códigos de Preflight, accesibilidad/responsive/descargas endurecidas. Cross-browser (Firefox/WebKit) queda como límite de entorno documentado, no resuelto (ver Technical Debt).

## Commercial Platform (empaquetado, licencias, distribución) — primer producto real listo para vender (Fase 4.1 + 4.2)

Fase 4.1 (Commercial Platform Architecture & Product Packaging) entregó la arquitectura completa: boundaries Module/Feature/Commercial Product/Entitlement/License/Channel (ver [ADR-0026](../adr/0026-commercial-platform-boundaries.md)), formato de `commercial-product.json` (ADR-0027), estrategia de licensing V1 sin backend ni DRM agresivo (ADR-0028), y Gumroad/Bookfluence como canal inicial/storefront (ADR-0029). Fase 4.2 (Commercial MVP) convirtió eso en un producto real y empaquetable: "Impulso Sticker Builder Professional" v1.0.0 — `@impulso/commercial-schema` + `@impulso/capabilities` (CapabilityProvider real, conectado), manifest checked-in real (`edition: "professional"`, `channel: "gumroad"`, `licensingMode: "delivery-only"`), `pnpm build:commercial` (paquete reproducible + ZIP + checksum, ver `docs/platform/COMMERCIAL_BUILD_GUIDE.md`), launchers de un clic verificados offline en Chromium real, backup/portabilidad de proyectos, documentación legal y del comprador completa en español, y plan de publicación en Gumroad listo (copy/precio/checklist, sin publicar todavía — ver `docs/platform/GUMROAD_LAUNCH_PLAN.md`).
- **Prioridad:** Alta para continuar — el producto está listo para vender, falta la autorización explícita de publicación (Fase 4.3+, ver `docs/platform/COMMERCIAL_PLATFORM_ROADMAP.md`), misma disciplina que Epic 9.
- **Dependencias:** Ninguna técnica bloqueante restante para publicar V1 tal como está. Fases 4.4+ (entitlements/licensing técnico, cuentas, más canales) dependen de decisiones de negocio externas y de evidencia de demanda real.
- **Complejidad:** Resuelta para V1 (sin backend, `delivery-only`). Alta a partir de 4.4-4.5 si se decide agregar un canal con verificación técnica o cuentas reales.

## Cloud Sync / Cuentas

- **Valor:** Habilita continuar un proyecto entre dispositivos — condición previa para cualquier capacidad de colaboración, compartir, o versionado real.
- **Prioridad:** Media — sin una razón de negocio concreta todavía (uso actual es 100% individual y local), pero es la dependencia dura de casi todo lo demás en este documento. Fase 4.1 evaluó esto conceptualmente (ver `V1_COMMERCIAL_RECOMMENDATION.md` §1) y recomendó NO construir cuentas para el V1 comercial — la cuenta de Gumroad del comprador cubre recuperación/historial en esta etapa.
- **Dependencias:** Requiere Auth (identificar usuarios) + backend HTTP + base de datos remota — ninguno existe hoy. `StorageProvider`/`ProjectStore` ya están diseñados como interfaces reemplazables, así que una implementación remota no exigiría rediseñar cómo el Engine guarda/lee un documento.
- **Complejidad:** Alta. Es, en la práctica, la primera pieza de infraestructura de servidor de toda la plataforma — nada de eso existe hoy (ver `05-Technical-Debt.md`, "Infraestructura y backend"). Fase 4.1 recomienda Supabase como default declarado para cuando exista evidencia real de necesitarlo (ver `docs/platform/COST_MODEL.md`), sin comprometerse a esa elección todavía.

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
