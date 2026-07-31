# THÖREN — Plan de Consolidación Documental

**Fecha:** 2026-07-31
**Naturaleza de este documento:** un plan, no una ejecución. Clasifica cada documento del proyecto relacionado con Sticker Builder ahora que deja de existir como producto independiente y pasa a ser un componente interno de THÖREN (`THOREN_PRODUCT_DIRECTION.md`, decisión D). No modifica ningún documento, no mueve ningún archivo, no escribe código — es el mapa que hace posible ejecutar la consolidación después, de forma ordenada y sin perder conocimiento.
**Objetivo declarado:** que cualquier persona que entre al proyecto dentro de seis meses vea un solo producto — THÖREN — y encuentre, para cada pregunta vigente, exactamente un documento fuente.
**Método:** inventario completo de `docs/product/` (53 archivos), `docs/platform/` (30 archivos), `docs/adr/` (29 ADRs + índice), `docs/archive/`, `docs/business/` (6 archivos), `docs/guides/`, `docs/ux-audits/` (10 auditorías + índice), los cuatro documentos raíz de `docs/`, y la documentación a nivel de `apps/sticker-builder/`.

---

## 1. Las cinco categorías, definidas sin ambigüedad

| Categoría | Significa | Qué pasa con el documento |
|---|---|---|
| **Mantener** | Sigue siendo la fuente de verdad vigente, sin cambios de contenido. | Permanece donde está. |
| **Fusionar** | Contiene conocimiento real que debe incorporarse a otro documento (nombrado explícitamente). | Su contenido válido se traslada; el original pasa a `Archivar` una vez completada la fusión — nunca se borra antes de eso. |
| **Archivar** | Registro histórico real y verificado, pero ya no es una fuente activa de decisiones. | Se conserva íntegro, idealmente reubicado a `docs/archive/` con un encabezado de contexto (mismo patrón ya usado en `ARCHITECTURE-phase0-original-design.md`). |
| **Reemplazar** | La función que cumple sigue siendo necesaria, pero el documento mismo asume una realidad que ya no aplica (Sticker Builder como producto independiente) — no basta con fusionar contenido, hace falta redactarlo de nuevo. | Se conserva el original como insumo/referencia (pasa a `Archivar` tras escribirse el reemplazo); se nombra qué documento nuevo debería existir, sin escribirlo todavía. |
| **Obsoleto** | No aporta valor ni siquiera como referencia histórica organizada. | Se deja tal cual, sin reubicar ni mantener — el historial de git ya lo preserva; no requiere ninguna acción activa. |

**Regla que gobierna esta clasificación, sin excepción:** ningún documento se marca para borrado. "Obsoleto" no significa eliminar — significa dejar de invertir atención en mantenerlo o reubicarlo. `THOREN_PRODUCT_DIRECTION.md` ya lo dijo: no se protege trabajo pasado, pero tampoco se borra la historia.

---

## 2. `docs/product/` — la cadena de THÖREN 2.0 (Dominio A)

**Todo lo siguiente se mantiene sin cambios** — es, desde ahora, la única fuente de verdad del único producto:

`THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`, `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md`, `THOREN_CREATIVE_ENGINE.md`, `THOREN_TECHNICAL_ARCHITECTURE.md`, `THOREN_IMPLEMENTATION_PLAN.md`, `THOREN_USABILITY_TEST_PLAN.md`, `THOREN_USER_FEEDBACK_FRAMEWORK.md`, `THOREN_FINDINGS_DATABASE.md`, `THOREN_DECISION_CRITERIA.md`, `THOREN_PRODUCT_BACKLOG_V2.md`, `THOREN_BETA_DASHBOARD.md`, `THOREN_PROJECT_STATUS_v1.0.md`, `THOREN_PRODUCT_DIRECTION.md`.

**Nota sobre `THOREN_TECHNICAL_ARCHITECTURE.md`:** es, desde hoy, el documento que debe describir el motor de impresión/exportación heredado de Sticker Builder como lo que ahora es — un componente interno. Su contenido actual ya lo trata así (`Motor de Impresión` y `Motor de Exportación` reutilizados, nunca expuestos a la interfaz principal) — no necesita reescritura, solo se confirma que es, sin ambigüedad, el lugar correcto para esa descripción. Ningún otro documento debería competir con este para esa función.

## 3. `docs/product/` — catálogo comercial y Beta Comercial de Sticker Builder (Dominio B)

| Documento | Clasificación | Justificación / destino |
|---|---|---|
| `THOREN_DECISION_LOG.md` | **Fusionar** | Contiene 16 decisiones; las de patrón de ingeniería reutilizable (fuentes libres, partición de color en `TextObject`, arquitectura del kit, validación de `arrangeRingText`) tienen valor técnico real — se fusionan en la futura documentación técnica del componente interno. Las decisiones específicas del checkpoint de Beta Comercial (DEC-006, DEC-015, DEC-016) quedan sin objeto y pasan a `Archivar` junto con el resto del Dominio B. |
| `THOREN_PRODUCT_STRATEGY.md` | **Archivar** | Estrategia comercial completa (ICP, competencia, pricing) para Sticker Builder como producto independiente — investigación real, ya no aplicable tal cual. |
| `THOREN_BETA_COMMERCIAL_PLAN.md` | **Archivar** | La Beta Comercial que planeaba ya no tiene producto que validar. |
| `THOREN_BUNDLE_STRATEGY.md` | **Archivar** | Empaquetado comercial por categoría, específico del catálogo cancelado. |
| `THOREN_LAUNCH_PLAYBOOK.md` | **Archivar** | Ejecución operativa de un lanzamiento que no ocurrirá. |
| `THOREN_GUMROAD_BETA_CHECKLIST.md` | **Obsoleto** | Checklist operativo nunca ejecutado (cero casillas marcadas) — sin conocimiento que preservar más allá de lo ya capturado en el plan. |
| `THOREN_BETA_INVITATION_MESSAGES.md` | **Obsoleto** | Plantillas de mensajes nunca enviados. |
| `THOREN_BETA_PARTICIPANT_TRACKER.csv` | **Obsoleto** | Plantilla vacía, cero datos reales. |

## 4. `docs/product/` — producción del catálogo de 63 plantillas

| Documento | Clasificación | Justificación / destino |
|---|---|---|
| `THOREN_DESIGN_LANGUAGE_GUIDE.md` | **Fusionar** | Sus convenciones técnicas de producción (sangrado, área segura, reducción de iconografía) son reutilizables para cualquier salida de impresión real que THÖREN genere — se fusionan en documentación técnica del Motor de Impresión. Sus "6 familias de lenguaje visual" atadas al catálogo comercial se archivan con el resto. |
| `THOREN_PILOT_TEMPLATE_STANDARD.md` | **Fusionar** | El proceso de convertir una especificación en un `Project` real usando el kit es conocimiento de ingeniería reutilizable — se fusiona en la documentación técnica del componente interno. |
| `THOREN_PRODUCTION_INFRASTRUCTURE.md` | **Fusionar** | Documenta código real (`catalogTemplates/kit/`: `createCatalogProject`, `arrangeRingText`, etc.) que sigue existiendo — se fusiona en la arquitectura técnica del componente interno, ya no enmarcado como "infraestructura de un catálogo comercial" sino como capacidad reutilizable. |
| `THOREN_VISUAL_ACCEPTANCE.md` | **Fusionar** | El checklist de 8 puntos de aceptación visual humana es un proceso de calidad genuinamente reutilizable — candidato directo a fusionarse con el Filtro de Calidad ampliado que `THOREN_IMPLEMENTATION_PLAN.md` ya reserva para una fase futura del Motor Creativo. |
| `TEMPLATE_LIBRARY_ARCHITECTURE.md` | **Archivar** | Arquitectura de una galería de plantillas a escala — específica del modelo de catálogo comercial descartado. |
| `TEMPLATE_CATALOG_v1.md` | **Archivar** | Especificación de contenido de las 63 plantillas. |
| `UX_TEMPLATE_LIBRARY.md` | **Archivar** | Flujos de UX de la galería de plantillas descartada. |
| `ROADMAP_TEMPLATE_SYSTEM.md` | **Archivar** | Roadmap de un sistema de catálogo que no continúa. |
| `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` | **Archivar** | Plan de 12 lotes de un catálogo que no se completará. |
| `THOREN_CATALOG_AUDIT_FRAMEWORK.md` / `THOREN_CATALOG_AUDIT_v1.0.md` | **Archivar** | Marco y ejecución de auditoría de un catálogo que ya no es un producto activo. |
| `THOREN_ASSET_PRODUCTION_GUIDE.md` | **Archivar** | Pipeline de producción de assets comerciales, atado al catálogo. |
| `THOREN_LOTE_01_REPORTE.md`, `_02_`, `_03_` (3 archivos) | **Archivar** | Reportes de producción de un catálogo pausado — registro histórico real de trabajo real completado (14 plantillas). |
| `TEMPLATE_BATCH_01.md` – `TEMPLATE_BATCH_13.md` (13 archivos) | **Archivar** | Especificaciones de contenido de las 63 plantillas — 0% de assets reales producidos según la propia auditoría del catálogo; valor exclusivamente como referencia histórica de diseño. |

## 5. `docs/platform/` — comercial de Sticker Builder v1.0.0 (RC1/Gumroad)

| Documento(s) | Clasificación | Justificación / destino |
|---|---|---|
| `COMMERCIAL_BUILD_GUIDE.md`, `COMMERCIAL_PLATFORM_ROADMAP.md`, `COMMERCIAL_PRODUCT_MODEL.md`, `COMMERCIAL_SECURITY_CHECKLIST.md`, `COMMERCIAL_WALKTHROUGH_VERIFICATION.md`, `FASE5_LAUNCH_VIDEO_STORYBOARD_v1.0.md`, `FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md`, `FASE5_TECHNICAL_DELIVERY_SPEC_v1.0.md`, `FINAL_RELEASE_CHECKLIST.md`, `GUMROAD_LAUNCH_PLAN.md`, `KNOWN_LIMITATIONS_v1.0.0.md`, `LICENSING_THREAT_MODEL.md`, `PACKAGING_GUIDE.md`, `PRODUCT_MANIFEST_GUIDE.md`, `RC1_COMMERCIAL_FAQ.md`, `RC1_DEMO_SCRIPT_AND_ASSETS.md`, `RC1_POST_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RELEASE_CHECKLIST.md`, `RELEASE_NOTES_v1.0.0.md`, `V1_COMMERCIAL_RECOMMENDATION.md`, `BUYER_VALIDATION_REPORT.md` (22 archivos) | **Archivar** | Trabajo real, cuidadoso y verificado (checklists ejecutados, ZIP validado, copy de Gumroad listo) para un lanzamiento comercial que ya no ocurrirá bajo esta forma. Preservar íntegro como evidencia de un proceso de release disciplinado — reutilizable como referencia si THÖREN mismo necesita empaquetarse comercialmente en el futuro. |
| `OFFLINE_DISTRIBUTION_GUIDE.md` | **Archivar** | Diseño técnico del launcher/servidor local, específico de la distribución de un ZIP comercial independiente. |
| `THIRD_PARTY_LICENSE_INVENTORY.md` | **Fusionar** | El inventario de licencias de fuentes/dependencias tiene valor legal directo y reutilizable si THÖREN reempaqueta cualquiera de esos mismos recursos — se fusiona en un futuro inventario de licencias de THÖREN, no se descarta. |
| `PROJECT_STATUS.md` | **Reemplazar** | Declara cerrado "THÖREN Sticker Builder v1.0.0" como producto comercial — ya no describe la realidad del proyecto. Debe reemplazarse por un único documento de estado consolidado. **Nota importante:** este archivo comparte función y nombre casi idénticos con `docs/product/THOREN_PROJECT_STATUS_v1.0.md`, ya escrito en esta misma sesión — exactamente el tipo de duplicidad de nombre entre carpetas que esta consolidación existe para prevenir. La recomendación es que exista un único "Estado del Proyecto" hacia adelante, viviendo en `docs/product/` junto con el resto de la cadena de decisión de THÖREN. |
| `CAPABILITY_MODEL.md`, `CAPABILITY_PROVIDER_GUIDE.md` | **Fusionar** | El patrón de `CapabilityProvider` (gating de funciones sin acoplar la UI al precio/plan) es reutilizable en general — se fusiona en documentación técnica de plataforma, retirando los identificadores específicos (`sticker.*`) atados a la venta independiente de Sticker Builder. |
| `COST_MODEL.md` | **Fusionar** | Análisis de costo de infraestructura genérico (Supabase/Firebase/backend propio) — se fusiona en una futura planeación de costos de THÖREN, si THÖREN llega a necesitar backend. |
| `HANDOFF.md`, `PREFLIGHT_CODES.md`, `STATE_001.md`, `TRACEABILITY_MATRIX_EPIC9.md` | **Mantener** | Documentación de ingeniería general (invariantes de arquitectura, códigos de Preflight, auditoría de plataforma, trazabilidad del Motor de Impresión) — válida sin importar el nombre o posicionamiento del producto que la usa. |

## 6. `docs/adr/` — decisiones de arquitectura (29 ADRs)

| Documento(s) | Clasificación | Justificación / destino |
|---|---|---|
| ADR-0001 a ADR-0025 (25 ADRs: Document Schema, Engine, Renderer, Canvas/Selección/Transformación, Persistencia local, Asset/Template/Project Library, Export Engine, Batch/Alineación, Multi-selección, Autosave/Recovery, Motor de Impresión completo) | **Mantener** | Documentan el motor que THÖREN reutiliza tal cual, sin modificarlo — su validez no depende de si Sticker Builder se vende por separado. |
| ADR-0026 (Commercial Platform Boundaries), ADR-0027 (Product Manifest), ADR-0028 (Entitlements & Licensing V1), ADR-0029 (Distribution Strategy) | **Archivar** | Arquitectura de una capa comercial multi-canal para un producto vendido de forma independiente — el problema que resuelven ya no existe en esa forma. |

## 7. `docs/archive/`

`ARCHITECTURE-phase0-original-design.md` — **ya archivado correctamente**, sin acción pendiente. Sirve, además, como el precedente exacto de cómo debe verse un documento archivado (encabezado de contexto, conservado íntegro).

## 8. `docs/business/` — posicionamiento y go-to-market

| Documento(s) | Clasificación | Justificación / destino |
|---|---|---|
| `01-Positioning.md`, `02-Ideal-Customer-Profiles.md`, `03-Competitive-Landscape.md`, `04-Unique-Value-Proposition.md` | **Fusionar** | La investigación de mercado (competencia real: Canva/Kittl/Creative Fabrica/Placeit, perfiles de cliente) tiene valor informativo real más allá del producto específico — se fusiona como insumo de una futura estrategia de mercado propia de THÖREN, nunca copiada tal cual (la promesa y el cliente objetivo de THÖREN son distintos a los de un editor de plantillas). |
| `THOREN_Launch_Execution_Plan_v1.0.md`, `THOREN_Positioning_GoToMarket_Strategy_v1.0.md` | **Archivar** | Plan de ejecución y estrategia de mercado ya escritos específicamente para "THÖREN Sticker Builder" como primer producto de un ecosistema de módulos — modelo de negocio descartado por la propia decisión de consolidación. |

## 9. `docs/guides/`

`exportar-para-impresion.md` — **Fusionar**. La capacidad de exportar listo para imprenta persiste como parte del Motor de Impresión interno; la guía debe fusionarse en documentación técnica del componente interno, reescrita para no asumir que el wizard de 7 pasos es una superficie visible por defecto (ya descartado explícitamente por `THOREN_VISION_2.md`).

## 10. `docs/ux-audits/`

| Documento(s) | Clasificación | Justificación / destino |
|---|---|---|
| 0001 Workspace, 0002 Inspector, 0003 Alignment, 0004 Assisted Placement, 0005 Multi-Selection, 0006 Autosave/Recovery, 0007 Technical Production Preview, 0008 Production Export Experience, 0009 Production Export Hardening (9 auditorías) | **Mantener** | Auditorías reales de calidad de UX del editor/motor, con hallazgos y correcciones verificadas — siguen siendo referencia técnica válida de esa capacidad interna, sin relación con el modelo comercial. |
| 0010 First Commercial Delivery Experience | **Archivar** | Específica de la experiencia de compra/entrega comercial de un producto que ya no se vende de forma independiente. |

## 11. Documentos raíz de `docs/`

`ARCHITECTURE.md`, `ENGINEERING_STANDARDS.md`, `MILESTONE_1_ALPHA.md`, `PERFORMANCE_BUDGET.md` — **Mantener**, los cuatro. Ninguno contiene contenido comercial específico de Sticker Builder; documentan ingeniería, estándares y desempeño de la plataforma que THÖREN sigue usando internamente.

## 12. Documentación previa a THÖREN (plataforma Impulso, pre-reinvención)

| Documento | Clasificación | Justificación / destino |
|---|---|---|
| `01-Product-Vision.md` | **Reemplazar** | Visión de "Impulso Platform" con Sticker Builder como primer módulo de varios futuros — modelo descartado; THÖREN necesita su propia declaración de visión de plataforma, si acaso hace falta una además de `THOREN_VISION_2.md`. |
| `02-Product-Principles.md` | **Fusionar** | Sus principios de ingeniería (Simplicidad, Velocidad, Modularidad) se solapan con `docs/ENGINEERING_STANDARDS.md` — se fusiona ahí lo que no esté ya cubierto, se retira el resto. |
| `03-Architecture-Map.md` | **Reemplazar** | Mapa de capas de "Impulso Platform + Commercial Platform" — ya no refleja los seis módulos reales definidos en `THOREN_TECHNICAL_ARCHITECTURE.md`. |
| `04-Roadmap.md` | **Reemplazar** | Roadmap de plataforma multi-módulo — `THOREN_IMPLEMENTATION_PLAN.md` ya es la hoja de ruta vigente; este documento describe una secuencia que ya no aplica. |
| `05-Technical-Debt.md` | **Mantener** | Deuda técnica real sobre código que sigue existiendo — su función no depende del nombre del producto; se sigue actualizando como parte del mantenimiento normal, no de esta consolidación. |
| `06-Architecture-Decisions.md` | **Mantener** | Índice de los ADRs — sigue siendo válido; 25 de 29 ADRs indexados permanecen vigentes (sección 6). |
| `PRODUCT_BACKLOG.md` | **Reemplazar** | Backlog de capacidades de plataforma multi-módulo (Cloud Sync, Marketplace, segundo módulo) — reemplazado en función por `THOREN_PRODUCT_BACKLOG_V2.md` como mecanismo vigente hacia adelante. |
| `UX_BACKLOG.md` | **Archivar** | Hallazgos de UX reales del editor, ya no la superficie principal del producto — referencia útil si el componente interno se revisita, no una fuente activa hoy. |

## 13. Documentación a nivel de `apps/sticker-builder/`

| Documento | Clasificación | Justificación / destino |
|---|---|---|
| `README.md` (de la app) | **Fusionar** | Documentación técnica real (estructura de archivos, módulos) del código que sigue existiendo — se fusiona en la documentación técnica del componente interno, retirando cualquier lenguaje que lo presente como producto independiente. |
| `CHANGELOG.md` (de la app) | **Mantener** | Historial real de cambios de ingeniería del código, que sigue vivo como componente interno — sigue acumulándose con normalidad; las entradas ya escritas (incluida la del rebranding a THÖREN) permanecen como registro histórico exacto. |
| `commercial-assets/docs/*` (guías para el comprador, empaquetadas en el ZIP) | **Archivar** | Documentación orientada al comprador de un producto que ya no se distribuye de forma independiente. |

---

## 14. Duplicidades encontradas

Documentos que, sin ser necesariamente contradictorios entre sí, responden la misma pregunta desde dos lugares distintos — exactamente el tipo de fragmentación que impide que "cualquier persona que entre dentro de seis meses" sepa dónde mirar.

| Pregunta que ambos responden | Documento A | Documento B | Resolución propuesta |
|---|---|---|---|
| ¿Cuál es el estado actual del proyecto? | `docs/platform/PROJECT_STATUS.md` (Sticker Builder v1.0.0, "Cerrado") | `docs/product/THOREN_PROJECT_STATUS_v1.0.md` (THÖREN, en Fase de Validación) | Un solo "Estado del Proyecto" hacia adelante, en `docs/product/`. El de `docs/platform/` se archiva como cierre histórico de esa release específica. |
| ¿Cuál es el mapa de arquitectura de la plataforma? | `docs/product/03-Architecture-Map.md` (Impulso Platform + Commercial Platform) | `docs/ARCHITECTURE.md` (Document Schema → Engine → Renderer + pilares) **y** `THOREN_TECHNICAL_ARCHITECTURE.md` (los 6 módulos de THÖREN) | Tres documentos para una sola pregunta, en dos capas distintas de abstracción sin límite explícito entre ellas. Se retira `03-Architecture-Map.md`; `docs/ARCHITECTURE.md` queda como fuente de arquitectura de código, `THOREN_TECHNICAL_ARCHITECTURE.md` como fuente de arquitectura de producto/módulos. |
| ¿Cuál es la hoja de ruta? | `docs/product/04-Roadmap.md` (Impulso Platform, fases de ingeniería) | `THOREN_IMPLEMENTATION_PLAN.md` (fases del Motor Creativo) | `THOREN_IMPLEMENTATION_PLAN.md` es la única hoja de ruta vigente. `04-Roadmap.md` se reemplaza (o se retira sin reemplazo si ya no hace falta un roadmap de "plataforma" distinto del de producto). |
| ¿Qué falta por construir? | `docs/product/PRODUCT_BACKLOG.md` | `THOREN_PRODUCT_BACKLOG_V2.md` | `THOREN_PRODUCT_BACKLOG_V2.md` es el único backlog vigente. |
| ¿Qué problemas de experiencia existen? | `docs/product/UX_BACKLOG.md` (editor, pre-reinvención) | `THOREN_FINDINGS_DATABASE.md` (experiencia conversacional, Fase 4) | No compiten por el mismo período ni la misma superficie — se conservan ambos, pero `UX_BACKLOG.md` se archiva explícitamente para que nadie lo confunda con una fuente activa. |
| ¿Dónde vive la estrategia comercial? | `docs/product/THOREN_PRODUCT_STRATEGY.md` | `docs/business/*` (6 archivos) | Contenido del mismo dominio partido entre dos carpetas (`docs/product/` y `docs/business/`) sin razón declarada. Si THÖREN llega a necesitar una estrategia comercial propia, debería vivir en un solo lugar — se recomienda `docs/business/` (ya es la carpeta con vocación de negocio), redactada de cero. |
| ¿Cuáles son las decisiones permanentes del proyecto? | `THOREN_DECISION_LOG.md` (decisiones técnicas de producción de catálogo) | `THOREN_DECISION_CRITERIA.md` (reglas para decidir qué entra al producto en Fase 4) | No son la misma cosa — uno es un registro histórico de decisiones ya tomadas, el otro es un reglamento para decisiones futuras — pero el nombre similar puede confundir. Se recomienda que, tras la fusión de la sección 3, `THOREN_DECISION_LOG.md` quede explícitamente re-enfocado como "bitácora técnica del componente interno", nunca como una segunda fuente de reglas de decisión de producto. |

## 15. Contradicciones detectadas

1. **La contradicción central que origina toda esta consolidación.** `docs/business/*` y `THOREN_PRODUCT_STRATEGY.md` describen a Sticker Builder vendiéndose de forma independiente en Gumroad a $19/$29, como "el primer módulo" de un ecosistema de varios productos futuros. Esa premisa queda formalmente contradicha por `THOREN_PRODUCT_DIRECTION.md` (escenario D, aprobado): Sticker Builder deja de ser un producto vendible por separado. No es una contradicción entre dos documentos igualmente vigentes — es una decisión nueva que invalida la premisa de los documentos más antiguos. Se resuelve clasificándolos como se indica en las secciones 8 y 4 (Fusionar/Archivar), no editándolos.

2. **THÖREN 2.0 descarta, por nombre, dos piezas que la plataforma anterior celebra como recién construidas.** `THOREN_VISION_2.md` es explícito: el "wizard de exportación de 7 pasos... desaparece por completo" y "la galería de plantillas como cuadrícula de miniaturas... desaparece como formato". Ambas piezas están documentadas en `docs/product/04-Roadmap.md`, `TEMPLATE_LIBRARY_ARCHITECTURE.md` y `UX_TEMPLATE_LIBRARY.md` como logros de ingeniería terminados y probados, sin ninguna nota de que fueran a descartarse. Ya identificada en `THOREN_PROJECT_STATUS_v1.0.md` §6.2 — se repite aquí porque es la evidencia textual más directa de que la plataforma pre-reinvención (sección 12) no puede mantenerse como fuente vigente sin contradecir a `THOREN_VISION_2.md`.

3. **Dos documentos afirman estados de cierre incompatibles del mismo proyecto en fechas cercanas.** `docs/platform/PROJECT_STATUS.md` (27 de julio): *"Cerrado. La versión comercial 1.0 está congelada, verificada y lista para publicación."* Tres días después, `THOREN_PRODUCT_EXPERIENCE_AUDIT.md` (30 de julio) reabre por completo la pregunta de qué es el producto, y desata la reinvención total. Ninguno de los dos documentos es falso — describen el mismo código en dos momentos de juicio distintos — pero leídos sin fecha, contradicen directamente la idea de que el proyecto esté "cerrado".

4. **Una condición de reanudación que nunca se cumplió, ni se declaró incumplida.** `THOREN_PRODUCT_EXPERIENCE_AUDIT.md` pausa la Beta Comercial explícitamente *"hasta cerrar esta auditoría"* — redactado de forma que implica que cerrar la auditoría sería la señal para retomarla. La auditoría cerró (produjo `THOREN_VISION_2.md` y toda la cadena posterior); la Beta Comercial nunca se retomó, y ningún documento dice por qué no. Ya identificado como el hallazgo más importante de `THOREN_PROJECT_STATUS_v1.0.md` §6.3 — hoy queda resuelto por la decisión explícita de `THOREN_PRODUCT_DIRECTION.md`, pero es la contradicción que hizo necesaria toda esta auditoría.

## 16. Fuente de verdad propuesta, por tema

| Tema | Fuente única propuesta | Documentos que dejan de competir por esa función |
|---|---|---|
| Visión y promesa del producto | `THOREN_VISION_2.md` + `THOREN_PRODUCT_PHILOSOPHY.md` | `docs/product/01-Product-Vision.md` |
| Guion de experiencia | `THOREN_EXPERIENCE_BLUEPRINT.md` | — (sin competencia) |
| Reglas de interacción/transición | `THOREN_INTERACTION_SYSTEM.md` | — (sin competencia) |
| Diseño del Motor Creativo | `THOREN_CREATIVE_ENGINE.md` | — (sin competencia) |
| Arquitectura de producto/módulos | `THOREN_TECHNICAL_ARCHITECTURE.md` | `docs/product/03-Architecture-Map.md` |
| Arquitectura de código (paquetes/dependencias) | `docs/ARCHITECTURE.md` | `docs/product/03-Architecture-Map.md` (mismo, ver fila anterior) |
| Secuencia de construcción / roadmap | `THOREN_IMPLEMENTATION_PLAN.md` | `docs/product/04-Roadmap.md` |
| Backlog de producto | `THOREN_PRODUCT_BACKLOG_V2.md` | `docs/product/PRODUCT_BACKLOG.md`, `docs/product/UX_BACKLOG.md` (este último pasa a referencia archivada, no a competidor activo) |
| Protocolo de validación de usuario | `THOREN_USABILITY_TEST_PLAN.md` + `THOREN_USER_FEEDBACK_FRAMEWORK.md` | — (sin competencia) |
| Hallazgos de usuarios reales | `THOREN_FINDINGS_DATABASE.md` | — (sin competencia) |
| Qué entra al producto | `THOREN_DECISION_CRITERIA.md` | — (sin competencia) |
| Métricas de éxito de la Beta | `THOREN_BETA_DASHBOARD.md` | — (sin competencia) |
| Estado general del proyecto | `THOREN_PROJECT_STATUS_v1.0.md` (`docs/product/`) | `docs/platform/PROJECT_STATUS.md` |
| Decisiones técnicas del componente interno (post-fusión) | `THOREN_DECISION_LOG.md`, re-enfocado | — (re-enfocado, no reemplazado) |
| Deuda técnica | `docs/05-Technical-Debt.md` | — (sin competencia) |
| Estándares de ingeniería | `docs/ENGINEERING_STANDARDS.md` | `docs/product/02-Product-Principles.md` (se fusiona lo no cubierto y se retira) |
| Presupuesto de rendimiento | `docs/PERFORMANCE_BUDGET.md` | — (sin competencia) |
| Decisiones de arquitectura de código | `docs/adr/` (25 de 29 ADRs vigentes) | — (sin competencia; los 4 ADRs comerciales se archivan) |
| Estrategia comercial/GTM (si hace falta en el futuro) | *A redactar de cero, cuando THÖREN la necesite* | `docs/business/*`, `THOREN_PRODUCT_STRATEGY.md` (quedan como insumo de investigación, nunca como fuente vigente) |

## 17. Resumen cuantitativo

| Clasificación | Documentos |
|---|---|
| Mantener | ~50 (toda la cadena de THÖREN 2.0 + Fase 4, 25 ADRs de motor/plataforma, 4 docs raíz, 9 auditorías UX de editor, 4 docs de `docs/platform/` de ingeniería pura, 2 docs de plataforma pre-reinvención, changelog de la app) |
| Fusionar | ~13 (decisiones técnicas reutilizables, guías de producción/impresión, investigación de mercado, inventario de licencias, capability model, principios de ingeniería, README de la app) |
| Archivar | ~55 (todo el Dominio B: estrategia comercial, Beta Comercial, catálogo de 63 plantillas y sus 13 batches, todo RC1/Gumroad, 4 ADRs comerciales, 1 auditoría UX comercial, 2 docs de negocio específicos de lanzamiento, guías para comprador) |
| Reemplazar | ~6 (visión/mapa/roadmap de la plataforma pre-reinvención, backlog pre-reinvención, estado de proyecto de `docs/platform/`) |
| Obsoleto | 3 (checklist de Gumroad nunca ejecutado, mensajes de invitación nunca enviados, tracker de participantes vacío) |

Ningún documento de la cadena de THÖREN 2.0 (Dominio A) requiere ninguna acción — es, ya hoy, el único conjunto de fuentes de verdad del proyecto.

## 18. Secuencia sugerida de ejecución (plan, no ejecutado en este documento)

1. Reubicar físicamente a `docs/archive/` los ~55 documentos marcados `Archivar`, con el mismo encabezado de contexto histórico que ya usa `ARCHITECTURE-phase0-original-design.md`.
2. Ejecutar las fusiones de contenido técnico reutilizable (`Fusionar`) hacia los documentos de destino ya nombrados en cada sección — priorizando `THOREN_PRODUCTION_INFRASTRUCTURE.md`, `THOREN_VISUAL_ACCEPTANCE.md` y `THOREN_DECISION_LOG.md`, por ser los de mayor valor técnico inmediato para cuando el componente interno vuelva a tocarse.
3. Redactar los reemplazos (`Reemplazar`) solo cuando haga falta consultarlos — ninguno bloquea la Fase de Validación de Usuario en curso; no hay urgencia de escribirlos hoy.
4. Dejar los tres documentos `Obsoleto` exactamente donde están, sin ninguna acción.
5. Una vez completados los pasos 1-2, actualizar `THOREN_PROJECT_STATUS_v1.0.md` (Dominio A, ya existente) para reflejar que la consolidación se ejecutó — cerrando así, con evidencia, el hallazgo que esta misma cadena de auditorías identificó.

Ninguno de estos cinco pasos se ejecuta en este documento — es, exclusivamente, el plan.

## 19. Criterio final

> Un documento no se conserva porque cueste trabajo rehacerlo. Se conserva porque todavía responde una pregunta real, o porque es la memoria honesta de una que ya se dejó de hacer. Todo lo demás se archiva, se fusiona o se reemplaza — nunca se protege por inercia.
