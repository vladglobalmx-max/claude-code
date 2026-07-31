# THÖREN — Estructura de Documentación v1.0

**Fecha:** 2026-07-31
**Naturaleza de este documento:** cierre y evidencia de la consolidación documental ejecutada tras `THOREN_DOCUMENT_CONSOLIDATION.md` (el plan) y la autorización explícita de ejecución completa. Es el documento que cualquier persona que entre al proyecto a partir de hoy debería leer primero para orientarse: qué existe, dónde vive, y por qué. A partir de este documento, **el proyecto tiene un solo producto visible: THÖREN.** Sticker Builder existe únicamente como componente técnico interno — nunca de nuevo como una segunda línea de producto.

---

## 1. Resumen ejecutivo de la consolidación

- **Qué se decidió:** `THOREN_PRODUCT_DIRECTION.md` recomendó, y el responsable de producto aprobó, el escenario D — Sticker Builder deja de existir como producto comercial independiente y pasa a ser un componente interno de THÖREN.
- **Qué se ejecutó:** se movieron **87 documentos** a `docs/archive/` (organizados en 6 carpetas temáticas, ver §4), se **fusionó** el conocimiento técnico reutilizable de 7 de esos documentos (más partes de un octavo) en 2 documentos nuevos/actualizados (`THOREN_STICKER_BUILDER_COMPONENT.md` nuevo; `docs/ENGINEERING_STANDARDS.md` ampliado), se **eliminaron** (`git rm`, no recuperables salvo por historial de git) los 3 documentos marcados explícitamente como Obsoleto, se **reescribió** `apps/sticker-builder/README.md` para dejar de presentarse como producto independiente, se actualizaron los índices de `docs/adr/README.md` y `docs/ux-audits/README.md`, y se corrigieron todas las referencias cruzadas rotas detectadas en un barrido completo del árbol de documentación activa.
- **Qué NO se perdió:** ningún documento archivado fue borrado — los 87 documentos de `docs/archive/` conservan su contenido íntegro, cada uno con un encabezado que explica por qué se archivó y a dónde apunta la información vigente equivalente. Solo los 3 documentos explícitamente Obsoleto (checklist nunca ejecutado, mensajes nunca enviados, tracker vacío) se eliminaron del árbol de trabajo — quedan recuperables únicamente vía `git log`/`git show` sobre commits anteriores a esta consolidación.
- **Qué cambia para quien lee el proyecto de ahora en adelante:** `docs/product/` describe un solo producto (THÖREN 2.0), sin ninguna mención activa de un catálogo comercial paralelo. La capacidad técnica de Sticker Builder (editor, motor de impresión, kit de producción) sigue intacta y documentada — como componente, nunca como producto.

## 2. Árbol final de documentación

```
impulso-builder-platform/
├── docs/
│   ├── ARCHITECTURE.md                          [activo — arquitectura de código]
│   ├── ENGINEERING_STANDARDS.md                 [activo — estándares + principios de producto fusionados]
│   ├── MILESTONE_1_ALPHA.md                     [activo]
│   ├── PERFORMANCE_BUDGET.md                    [activo]
│   ├── adr/                                     [25 ADRs vigentes + README con índice]
│   ├── ux-audits/                               [9 auditorías vigentes + README con índice]
│   ├── platform/                                [4 documentos de ingeniería pura vigentes]
│   ├── product/                                 [20 documentos — la cadena completa de THÖREN 2.0, ver §3]
│   ├── guides/                                  [vacío — su único documento fue fusionado y archivado]
│   ├── business/                                [vacío — los 6 documentos fueron archivados]
│   └── archive/                                 [87 documentos de esta consolidación + 1 ya archivado antes, ver §4]
│       ├── ARCHITECTURE-phase0-original-design.md   [ya archivado antes de esta consolidación]
│       ├── adr-commercial/                      [4 ADRs comerciales archivados]
│       ├── ux-audits-commercial/                [1 auditoría comercial archivada]
│       ├── business-research/                   [6 documentos de investigación de mercado archivados]
│       ├── pre-reinvention-platform/             [6 documentos de "Impulso Platform" pre-THÖREN 2.0]
│       └── sticker-builder/                     [70 documentos del Dominio B, incluidos 8 fusionados, ver §4]
│           ├── catalog/                         [24 — catálogo de 63 plantillas y sus 13 batches]
│           ├── commercial/                      [4 — estrategia/plan comercial de producto independiente]
│           ├── commercial-platform/             [27 — RC1/Gumroad + capability/cost model]
│           ├── buyer-docs/                      [7 — documentación del comprador del ZIP comercial]
│           └── (8 archivos sueltos)             [fuentes técnicas fusionadas en THOREN_STICKER_BUILDER_COMPONENT.md]
├── apps/sticker-builder/                        [código vigente, README reescrito como componente interno]
└── thoren-beta/                                 [la Beta de experiencia — no forma parte de esta consolidación]
```

## 3. Documentos activos

Todo lo listado aquí es, hoy, una fuente de verdad vigente — nada más compite por su función.

### 3.1 `docs/product/` — la cadena completa de THÖREN 2.0 (20 documentos)

`THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`, `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md`, `THOREN_CREATIVE_ENGINE.md`, `THOREN_TECHNICAL_ARCHITECTURE.md`, `THOREN_IMPLEMENTATION_PLAN.md`, `THOREN_USABILITY_TEST_PLAN.md`, `THOREN_USER_FEEDBACK_FRAMEWORK.md`, `THOREN_FINDINGS_DATABASE.md`, `THOREN_DECISION_CRITERIA.md`, `THOREN_PRODUCT_BACKLOG_V2.md`, `THOREN_BETA_DASHBOARD.md`, `THOREN_PROJECT_STATUS_v1.0.md`, `THOREN_PRODUCT_DIRECTION.md`, `THOREN_STICKER_BUILDER_COMPONENT.md` (nuevo, ver §3.2), `05-Technical-Debt.md`, `06-Architecture-Decisions.md`, y `THOREN_DOCUMENT_CONSOLIDATION.md`/este mismo documento (el par plan+cierre de esta consolidación).

### 3.2 El componente interno de Sticker Builder

`docs/product/THOREN_STICKER_BUILDER_COMPONENT.md` — único documento vigente sobre el motor de creación/impresión heredado de Sticker Builder. Fusiona: `THOREN_PRODUCTION_INFRASTRUCTURE.md`, `THOREN_PILOT_TEMPLATE_STANDARD.md`, `THOREN_VISUAL_ACCEPTANCE.md`, decisiones reutilizables de `THOREN_DECISION_LOG.md`, convenciones de producción de `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `docs/guides/exportar-para-impresion.md`, `docs/platform/THIRD_PARTY_LICENSE_INVENTORY.md` y partes técnicas de `apps/sticker-builder/README.md` original. `apps/sticker-builder/README.md` (reescrito) apunta aquí como su documentación técnica completa.

### 3.3 `docs/ENGINEERING_STANDARDS.md`

Ampliado con la sección "Principios de producto", que fusiona lo no duplicado de `docs/product/02-Product-Principles.md` (Simplicidad, Velocidad, Modularidad, AI Provider Agnostic, Offline First) — único documento vigente de principios de ingeniería/producto.

### 3.4 Resto del árbol activo

`docs/ARCHITECTURE.md`, `docs/MILESTONE_1_ALPHA.md`, `docs/PERFORMANCE_BUDGET.md` (sin cambios de fondo); `docs/adr/` (25 ADRs, índice actualizado); `docs/ux-audits/` (9 auditorías, índice actualizado); `docs/platform/HANDOFF.md`, `PREFLIGHT_CODES.md`, `STATE_001.md`, `TRACEABILITY_MATRIX_EPIC9.md` (ingeniería de plataforma, sin relación con el modelo comercial).

## 4. Documentos archivados (87, ninguno eliminado)

Todos con un encabezado que explica el contexto de archivado y enlaza al reemplazo vigente. Ninguno requiere acción — se conservan como memoria del proyecto.

| Carpeta | Documentos | Contenido |
|---|---|---|
| `docs/archive/sticker-builder/catalog/` | 24 | Catálogo comercial de 63 plantillas: arquitectura, roadmap, plan de 12 lotes, auditoría, 13 batches de especificación, 3 reportes de lote. |
| `docs/archive/sticker-builder/commercial/` | 4 | Estrategia/plan comercial de Sticker Builder como producto independiente (`THOREN_PRODUCT_STRATEGY.md`, `THOREN_BETA_COMMERCIAL_PLAN.md`, `THOREN_BUNDLE_STRATEGY.md`, `THOREN_LAUNCH_PLAYBOOK.md`). |
| `docs/archive/sticker-builder/commercial-platform/` | 27 | Lanzamiento comercial v1.0.0 (RC1/Gumroad): guías de build/packaging/seguridad/release, FAQ y página de producto, distribución offline, capability/cost model. |
| `docs/archive/sticker-builder/buyer-docs/` | 7 | Documentación en español para el comprador del ZIP comercial (`apps/sticker-builder/commercial-assets/docs/` original). |
| `docs/archive/sticker-builder/` (raíz, 8 sueltos) | 8 | Fuentes técnicas fusionadas en `THOREN_STICKER_BUILDER_COMPONENT.md`: infraestructura de producción, estándar del piloto, aceptación visual, design language guide, decision log, guía de exportar para impresión, inventario de licencias, README técnico original de la app. |
| `docs/archive/adr-commercial/` | 4 | ADR-0026 a ADR-0029 — arquitectura de la capa comercial (manifest, capabilities, entitlements, distribución) de un producto que ya no se vende por separado. |
| `docs/archive/ux-audits-commercial/` | 1 | Auditoría 0010 — First Commercial Delivery Experience. |
| `docs/archive/business-research/` | 6 | Investigación de mercado (`01-Positioning.md` a `04-Unique-Value-Proposition.md`) y plan de lanzamiento/GTM (`THOREN_Launch_Execution_Plan_v1.0.md`, `THOREN_Positioning_GoToMarket_Strategy_v1.0.md`) de `docs/business/`, escritos para Sticker Builder como primer módulo de un ecosistema de varios productos. |
| `docs/archive/pre-reinvention-platform/` | 6 | Documentación de "Impulso Platform" pre-THÖREN 2.0: `01-Product-Vision.md`, `02-Product-Principles.md` (fusionado, ver §3.3), `03-Architecture-Map.md`, `04-Roadmap.md`, `PRODUCT_BACKLOG.md`, `UX_BACKLOG.md`. |

**Nota sobre un refinamiento de ejecución respecto al plan original:** `THOREN_DOCUMENT_CONSOLIDATION.md` clasificó como "Fusionar" seis documentos (`docs/business/*`, 4 archivos; `CAPABILITY_MODEL.md`, `CAPABILITY_PROVIDER_GUIDE.md`, `COST_MODEL.md` de `docs/platform/`) hacia destinos que todavía no existen (una futura estrategia comercial propia de THÖREN, una futura documentación técnica de plataforma que necesite ese patrón). Fusionar hacia un documento inexistente habría significado escribirlo de cero sin necesidad real hoy — se archivaron en su lugar, íntegros, listos para fusionarse el día que exista un destino real. Los 5 documentos "Reemplazar" (`01-Product-Vision.md`, `03-Architecture-Map.md`, `04-Roadmap.md`, `PRODUCT_BACKLOG.md`, `docs/platform/PROJECT_STATUS.md`) tampoco se reescribieron: THÖREN ya tiene un documento vigente cumpliendo cada una de esas funciones (ver §5), así que se archivaron directamente en vez de redactar un reemplazo que ya existe con otro nombre.

## 5. Documentos obsoletos (eliminados)

Los 3 marcados explícitamente como Obsoleto en `THOREN_DOCUMENT_CONSOLIDATION.md` §3 fueron eliminados con `git rm` — recuperables solo desde el historial de git, nunca desde el árbol de trabajo:

- `docs/product/THOREN_GUMROAD_BETA_CHECKLIST.md` (checklist operativo, cero casillas marcadas)
- `docs/product/THOREN_BETA_INVITATION_MESSAGES.md` (plantillas de mensajes nunca enviados)
- `docs/product/THOREN_BETA_PARTICIPANT_TRACKER.csv` (plantilla vacía, cero datos reales)

## 6. Fuentes de verdad, por tema

| Tema | Fuente única vigente |
|---|---|
| Visión y promesa del producto | `THOREN_VISION_2.md` + `THOREN_PRODUCT_PHILOSOPHY.md` |
| Guion de experiencia | `THOREN_EXPERIENCE_BLUEPRINT.md` |
| Reglas de interacción/transición | `THOREN_INTERACTION_SYSTEM.md` |
| Diseño del Motor Creativo | `THOREN_CREATIVE_ENGINE.md` |
| Arquitectura de producto/módulos | `THOREN_TECHNICAL_ARCHITECTURE.md` |
| Arquitectura de código (paquetes/dependencias) | `docs/ARCHITECTURE.md` |
| Secuencia de construcción / roadmap | `THOREN_IMPLEMENTATION_PLAN.md` |
| Backlog de producto | `THOREN_PRODUCT_BACKLOG_V2.md` |
| Protocolo de validación de usuario | `THOREN_USABILITY_TEST_PLAN.md` + `THOREN_USER_FEEDBACK_FRAMEWORK.md` |
| Hallazgos de usuarios reales | `THOREN_FINDINGS_DATABASE.md` |
| Qué entra al producto | `THOREN_DECISION_CRITERIA.md` |
| Métricas de éxito de la Beta | `THOREN_BETA_DASHBOARD.md` |
| Estado general del proyecto | `THOREN_PROJECT_STATUS_v1.0.md` |
| **Sticker Builder como componente interno** (kit de producción, decisiones técnicas reutilizables, calidad visual, exportación a impresión, licencias) | `THOREN_STICKER_BUILDER_COMPONENT.md` |
| Decisión estratégica sobre el alcance del producto | `THOREN_PRODUCT_DIRECTION.md` |
| Estándares de ingeniería + principios de producto | `docs/ENGINEERING_STANDARDS.md` |
| Deuda técnica | `docs/product/05-Technical-Debt.md` |
| Presupuesto de rendimiento | `docs/PERFORMANCE_BUDGET.md` |
| Decisiones de arquitectura de código | `docs/adr/` (25 ADRs vigentes) |
| Auditorías de UX del editor/motor interno | `docs/ux-audits/` (9 auditorías vigentes) |
| Estrategia comercial/GTM (si hace falta en el futuro) | *A redactar de cero, cuando THÖREN la necesite* — `docs/archive/business-research/` queda como insumo, nunca como fuente vigente |

Ninguna de estas responsabilidades se repite en un segundo documento activo. Cualquier documento archivado que describía la misma función bajo el modelo anterior (Sticker Builder como producto independiente) queda explícitamente superado por la fila correspondiente de esta tabla — no compite, no se actualiza, no se consulta salvo como referencia histórica.

---

**Consolidación cerrada.** El proyecto tiene, a partir de este documento, un único producto visible: THÖREN.
