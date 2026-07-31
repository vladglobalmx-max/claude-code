# THÖREN — Estado del Proyecto v1.0

**Fecha:** 2026-07-31
**Naturaleza de este documento:** una auditoría, no una propuesta. Responde exactamente cinco preguntas — qué está terminado, qué está validado, qué está pendiente, qué está bloqueado deliberadamente, y qué no debe tocarse durante la Beta — a partir de revisar toda la documentación del proyecto (`docs/product/`, más los documentos de estado ya existentes en `docs/platform/`). No implementa nada, no modifica ningún documento existente, no abre ninguna fase nueva.
**Método:** lectura completa de los 53 archivos de `docs/product/` (52 `.md` + 1 `.csv`), con foco especial en los documentos que no pertenecen a la cadena de reinvención de THÖREN 2.0 ya conocida. Revisión de encabezados y alcance de los documentos de estado ya existentes en `docs/platform/` (`PROJECT_STATUS.md`, `STATE_001.md`) para entender cómo se relacionan con este documento, sin reabrir su contenido.

---

## 0. Los tres dominios de decisión del proyecto

Antes de responder las cinco preguntas, hace falta nombrar algo que la propia auditoría reveló: este proyecto tiene **tres cadenas de decisión distintas**, cada una con su propia fuente única de verdad, que hasta ahora nunca se habían puesto una junto a otra en un solo documento:

| Dominio | Pregunta que gobierna | Fuente única de verdad | Estado |
|---|---|---|---|
| **A. Experiencia de producto THÖREN 2.0** (Concepto E / Motor Creativo) | ¿Qué debe sentir la persona, y cómo se construye para lograrlo? | `THOREN_PRODUCT_PHILOSOPHY.md` → `THOREN_EXPERIENCE_BLUEPRINT.md` → `THOREN_INTERACTION_SYSTEM.md` → `THOREN_CREATIVE_ENGINE.md` → `THOREN_TECHNICAL_ARCHITECTURE.md` → `THOREN_IMPLEMENTATION_PLAN.md` → esta cadena de Fase 4 (`THOREN_USER_FEEDBACK_FRAMEWORK.md`, `THOREN_FINDINGS_DATABASE.md`, `THOREN_DECISION_CRITERIA.md`, `THOREN_PRODUCT_BACKLOG_V2.md`, `THOREN_BETA_DASHBOARD.md`) | **Activo — en Fase 4, Beta en congelamiento funcional.** |
| **B. Catálogo comercial de Sticker Builder** (63 plantillas, Beta Comercial, RC1, Gumroad) | ¿Qué plantillas se producen y cómo se lanzan comercialmente? | `THOREN_DECISION_LOG.md` + `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` + `THOREN_BETA_COMMERCIAL_PLAN.md` | **Pausado desde 2026-07-30, nunca formalmente retomado ni cancelado.** Ver sección 5. |
| **C. Plataforma/arquitectura técnica de Impulso** (paquetes, deuda técnica, calidad de código) | ¿Es el código correcto, mantenible y está bien probado? | `docs/platform/STATE_001.md`, ADRs (`docs/adr/`), `docs/platform/PROJECT_STATUS.md` | **Cerrado para v1.0.0 comercial (2026-07-27); no se reabre en este documento.** |

Este documento (Estado del Proyecto v1.0) audita el **Dominio A** en detalle, porque es el dominio activo de esta fase — y señala, sin resolverla, la ambigüedad pendiente sobre el **Dominio B** (sección 5), sin tocar el **Dominio C**, que ya tiene su propia auditoría cerrada e independiente.

---

## 1. Qué está terminado

**Definición de "terminado" en este documento:** el código existe, pasa sus pruebas automatizadas, fue verificado mediante recorrido real (Playwright/Chromium), y fue cerrado explícitamente por el usuario en la conversación donde se construyó.

- **Fase de definición completa** (documentos, no código): Auditoría de experiencia → Visión 2.0 → Filosofía de producto → Experience Blueprint → Sistema de interacción → Motor Creativo (especificación) → Arquitectura técnica → Plan de implementación → Plan de prueba de usabilidad. Los seis documentos centrales quedaron congelados explícitamente y no se han vuelto a abrir.
- **Fase 1 — Núcleo del Documento.** `@impulso/creative-engine`: `componer()`/`exportarSVG()`, dos arquetipos geométricos mínimos, 11 pruebas, demo ejecutable con SVG real verificado visualmente. Cerrado y aprobado.
- **Fase 2 — Motor Creativo v1.** Intérprete de intención determinista, receta Elegante-Boda con tres arquetipos estructuralmente distintos (monograma-anillo, insignia-doble-filete, composición-asimétrica), Selector trivial, Filtro de calidad básico (texto, contraste, colisiones, exportación), 62 pruebas, demo con evidencia visual. Cerrado y aprobado.
- **Fase 3 — Experience Integration.** `thoren-beta/` reemplaza sus tres propuestas estáticas por el Motor Creativo real, sin cambiar ni un tiempo del Experience Blueprint. Instrumentación silenciosa de ocho eventos y siete mediciones de tiempo, visible solo bajo `?beta=true`. 13 pruebas nuevas, cobertura 100% en la lógica no-DOM, recorrido real verificado en Chromium (propuestas, selección, revelación, descarga real de SVG con contenido real), Lighthouse 100/100/100/100 en desktop y mobile. Cerrado y aprobado.
- **Infraestructura de Fase 4 (este mismo cierre).** Marco de feedback, base de hallazgos, criterios de decisión, backlog v2, dashboard de evaluación — los cinco documentos operativos para procesar evidencia de usuarios reales, listos antes de la primera sesión.

## 2. Qué está validado

Esta pregunta merece una respuesta más cuidadosa que "sí" o "no" — hay dos tipos de validación en este proyecto, y confundirlos sería el error más grave que esta auditoría podría cometer.

**Validado técnicamente (código correcto, comportamiento determinista confirmado):**
- Que el Motor Creativo genera tres composiciones estructuralmente distintas, válidas, exportables, para un corpus representativo de frases (canónicas, cortas, fragmentadas, informales, contradictorias, con fecha y color explícitos).
- Que la integración de Fase 3 no altera ningún tiempo del Experience Blueprint y que el recorrido técnico completo (frase → propuestas → selección → revelación → descarga) funciona de punta a punta en un navegador real.
- Que el rendimiento (Lighthouse) y la cobertura de pruebas cumplen los umbrales ya fijados en fases anteriores.

**No validado con personas reales — todavía:**
- **Absolutamente ninguna de las hipótesis centrales del producto** (`THOREN_PRODUCT_BACKLOG_V2.md` §2) ha sido confirmada ni refutada por una sola sesión real de usuario. Esto incluye la pregunta más importante de todo el proyecto: si el momento *"el usuario buscó editar… y descubrió que ya no hacía falta"* ocurre de verdad, o si solo se ve bien en un prototipo que nadie externo ha probado.
- Que las tres propuestas se perciban como genuinamente distintas por una persona ajena al proyecto (validado internamente por diseño, nunca por un tercero).
- Que la promesa "menos de un minuto" se sostenga incluyendo el tiempo real de decisión humana, no solo el tiempo técnico del motor (que es de milisegundos, y por lo tanto no informativo por sí solo sobre la experiencia completa).

**Esta distinción es el motivo de ser de la Fase 4.** Todo lo "terminado" (sección 1) es una construcción cuidadosa sobre un diseño bien razonado — pero un diseño bien razonado no es lo mismo que un diseño confirmado. Nadie fuera del equipo que lo construyó ha usado todavía la Beta.

## 3. Qué está pendiente

- **Ejecutar la ronda de validación de usuario** — las sesiones reales bajo `THOREN_USABILITY_TEST_PLAN.md`, documentadas y clasificadas según `THOREN_USER_FEEDBACK_FRAMEWORK.md`.
- Los siete descubrimientos y las cinco hipótesis listadas en `THOREN_PRODUCT_BACKLOG_V2.md` §1-2 — ninguno tiene todavía una respuesta.
- **Una decisión explícita, no de evidencia sino de alcance, sobre el Dominio B** (Beta Comercial/catálogo de 63 plantillas) — ver sección 5. No requiere más sesiones de usuario; requiere que alguien con autoridad de producto diga qué pasa con ese trabajo ya construido y pausado.
- Una decisión, más adelante y solo con evidencia, sobre 10 de los 63 templates de catálogo que no completaron sus secciones 11-12 (Ficha Comercial / Checklist de Producción) — ya señalado como brecha administrativa, no de diseño, en `THOREN_CATALOG_AUDIT_v1.0.md`; no bloquea nada de la Beta actual porque pertenece al Dominio B, pausado.

## 4. Qué está bloqueado deliberadamente

Todo lo siguiente existe como diseño o como plan aprobado, pero tiene instrucción explícita de no iniciarse hasta cerrar esta Beta — ver `THOREN_PRODUCT_BACKLOG_V2.md` para el detalle completo:

- Fase 4 y Fase 5 del Motor Creativo (`THOREN_IMPLEMENTATION_PLAN.md`): generador de variantes, Filtro de calidad ampliado con ciclo de reintento.
- Cualquier receta nueva de las siete ya diseñadas en `THOREN_CREATIVE_ENGINE.md` §5 (hoy solo "Elegante" está construida).
- Cualquier ocasión nueva más allá de "Boda" en la tabla de afinidad (`THOREN_CREATIVE_ENGINE.md` §6, diseñada, no implementada).
- Cualquier forma de IA generativa o no determinista — descartada indefinidamente por decisión de filosofía, no por falta de evidencia.
- Cualquier mejora cosmética o de rendimiento que no responda a un patrón confirmado.
- La reanudación (o cancelación) del Dominio B — bloqueada no por falta de evidencia sino porque nadie la ha decidido todavía (sección 5).

## 5. Qué no debe tocarse durante la Beta

- **Los seis documentos congelados de la Fase de Definición** (`THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md`, `THOREN_CREATIVE_ENGINE.md`, `THOREN_TECHNICAL_ARCHITECTURE.md`, `THOREN_IMPLEMENTATION_PLAN.md`) — salvo con evidencia real de usuarios que `THOREN_DECISION_CRITERIA.md` determine suficiente.
- **El código de `thoren-beta/` y de los tres paquetes del Motor Creativo** (`@impulso/creative-engine`, `@impulso/document-schema`, `@impulso/export-engine`) — ninguna modificación hasta que la ronda de validación cierre.
- **Cada constante de tiempo del Experience Blueprint** ya preservada en Fase 3 — ninguna aceleración ni desaceleración, con o sin justificación de "mejora".
- **El Dominio B, en su estado actual (pausado).** No se debe reanudar la Beta Comercial, publicar en Gumroad, ni tampoco cancelar o archivar formalmente ese trabajo, mientras no exista una decisión explícita al respecto — tocarlo en cualquier dirección sin esa decisión sería exactamente el tipo de cambio no autorizado que esta fase existe para prevenir.

---

## 6. Hallazgos de la auditoría documental

### 6.1 Sin contradicciones dentro del Dominio A

La cadena de seis documentos congelados más los artefactos de Fase 1-3 y esta Fase 4 es internamente consistente — cada documento declara explícitamente cuáles lo preceden y no los reabre, y no se encontró ninguna decisión duplicada dentro de este dominio (por ejemplo: solo `THOREN_DECISION_CRITERIA.md` decide qué entra al producto; solo `THOREN_FINDINGS_DATABASE.md` registra hallazgos; ningún otro documento de esta fase reclama la misma función).

### 6.2 Contradicción real y ya resuelta por abandono silencioso, entre dominios

`THOREN_VISION_2.md` descarta explícitamente dos piezas que la documentación de la plataforma Impulso (pre-THÖREN 2.0) celebra como recién terminadas: el *"wizard de exportación de 7 pasos"* y la *"galería de plantillas como cuadrícula de miniaturas"*, ambos descritos en detalle en `docs/product/04-Roadmap.md`, `TEMPLATE_LIBRARY_ARCHITECTURE.md` y `UX_TEMPLATE_LIBRARY.md` como logros de ingeniería ya construidos y probados. Ningún documento marca estos tres archivos (ni `01-Product-Vision.md`, `02-Product-Principles.md`, `03-Architecture-Map.md`, `05-Technical-Debt.md`, `06-Architecture-Decisions.md`, `PRODUCT_BACKLOG.md`, `UX_BACKLOG.md`, que describen la misma plataforma pre-reinvención) como obsoletos o superados — la superación ocurrió en la práctica (el trabajo del equipo se movió por completo a la cadena de reinvención) pero nunca se declaró por escrito.

**Recomendación, no ejecutada aquí:** estos siete documentos deberían recibir un encabezado explícito de contexto histórico ("describe la plataforma previa a la reinvención de THÖREN 2.0; ver `THOREN_VISION_2.md`") — no se modificaron como parte de esta auditoría porque hacerlo es, en sí mismo, una decisión de alcance documental que corresponde autorizar explícitamente, no ejecutar de oficio dentro de un documento que solo debía auditar.

### 6.3 El hallazgo más importante de esta auditoría: una pausa nunca resuelta

`THOREN_PRODUCT_EXPERIENCE_AUDIT.md` (2026-07-30) pausó explícitamente la Beta Comercial del catálogo (*"la Beta Comercial queda pausada hasta cerrar esta auditoría"*). Esa auditoría cerró, y desató la reinvención completa que produjo los seis documentos congelados y las tres fases de construcción ya cerradas — pero ningún documento, en ningún momento posterior, dice explícitamente qué pasa con el Dominio B: ni se retoma, ni se cancela, ni se archiva formalmente. RC1 (el paquete comercial) está construido, verificado y listo para publicarse; el catálogo de 63 plantillas está diseñado al 100% (14 producidas realmente); los mensajes de invitación y el checklist de Gumroad están listos, sin ejecutar ni un solo paso.

Esto no es una contradicción de contenido — es una **decisión de alcance pendiente**, y es, de las cinco preguntas que abre este documento, la única que no depende de más evidencia de usuario. Se registra como el primer ítem de `THOREN_PRODUCT_BACKLOG_V2.md` §1 precisamente porque bloquea cualquier afirmación completa sobre "qué es THÖREN hoy" mientras seis carpetas de trabajo terminado y aprobado permanezcan en un estado que ningún documento describe.

### 6.4 Brecha administrativa menor, ya señalada y sin acción pendiente urgente

10 de los 63 templates del catálogo (Lotes 1-2) no completaron las secciones 11-12 de su especificación (Ficha Comercial / Checklist de Producción) — ya identificado como brecha administrativa (no de diseño) por `THOREN_CATALOG_AUDIT_v1.0.md`, con su propia recomendación de requerir aprobación explícita separada antes de remediarlo. Pertenece enteramente al Dominio B, pausado — no requiere ninguna acción mientras ese dominio permanezca sin reanudarse.

### 6.5 Ningún documento fuente duplicado dentro del alcance auditado

Se confirmó que, para cada decisión vigente del Dominio A, existe exactamente un documento fuente:

| Decisión | Único documento fuente |
|---|---|
| Filosofía y promesa del producto | `THOREN_PRODUCT_PHILOSOPHY.md` / `THOREN_VISION_2.md` |
| Guion de la experiencia | `THOREN_EXPERIENCE_BLUEPRINT.md` |
| Reglas de interacción/transición | `THOREN_INTERACTION_SYSTEM.md` |
| Diseño del Motor Creativo | `THOREN_CREATIVE_ENGINE.md` |
| Arquitectura técnica | `THOREN_TECHNICAL_ARCHITECTURE.md` |
| Secuencia de construcción | `THOREN_IMPLEMENTATION_PLAN.md` |
| Protocolo de sesión de usabilidad | `THOREN_USABILITY_TEST_PLAN.md` |
| Cómo se documenta/clasifica feedback | `THOREN_USER_FEEDBACK_FRAMEWORK.md` |
| Qué entra al producto | `THOREN_DECISION_CRITERIA.md` |
| Qué se ha aprendido y qué falta | `THOREN_FINDINGS_DATABASE.md` / `THOREN_PRODUCT_BACKLOG_V2.md` |
| Cómo se mide el éxito | `THOREN_BETA_DASHBOARD.md` |

Ninguna de estas doce responsabilidades se repite en un segundo documento. `THOREN_DECISION_LOG.md` (decisiones de producción de catálogo, Dominio B) y `docs/platform/STATE_001.md`/ADRs (calidad de arquitectura, Dominio C) cubren preguntas distintas, en dominios distintos, y no compiten por la misma autoridad.

### 6.6 Cierre de la pausa de §6.3, con evidencia (nota añadida el 2026-07-31, posterior a la auditoría original)

La "decisión de alcance pendiente" de §6.3 quedó resuelta: `THOREN_PRODUCT_DIRECTION.md` (2026-07-31) recomendó y el responsable de producto aprobó el escenario D — Sticker Builder deja de existir como producto comercial independiente y pasa a ser un componente interno de THÖREN. La consolidación documental que ejecuta esa decisión (`THOREN_DOCUMENT_CONSOLIDATION.md` → `THOREN_DOCUMENT_STRUCTURE_v1.0.md`) archivó íntegro todo el Dominio B (catálogo de 63 plantillas, RC1/Gumroad, estrategia comercial) en `docs/archive/`, sin perder ningún documento, y fusionó el conocimiento de ingeniería reutilizable en `THOREN_STICKER_BUILDER_COMPONENT.md`. El resto de este documento (secciones 0-6.5) se conserva sin editar como el registro exacto del estado en el momento de esta auditoría — la sección 0 y la fila del Dominio B en cualquier tabla anterior deben leerse ahora a la luz de esta nota, no reescritas retroactivamente.

---

## 7. Criterio final

> El proyecto no avanza escribiendo más documentos ni más código — avanza cuando una persona ajena al equipo usa THÖREN sin que nadie le explique nada, y el equipo observa, sin actuar todavía, lo que de verdad ocurre.

Este documento no autoriza ninguna acción. Autoriza, únicamente, empezar a mirar.
