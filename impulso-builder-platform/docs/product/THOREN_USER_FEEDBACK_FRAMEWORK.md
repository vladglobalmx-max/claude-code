# THÖREN — Marco de Feedback de Usuario

**Fecha:** 2026-07-31
**Naturaleza de este documento:** un protocolo operativo para la Fase de Validación de Usuario (Fase 4), no un documento conceptual. No reabre ni modifica `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md`, `THOREN_CREATIVE_ENGINE.md`, `THOREN_TECHNICAL_ARCHITECTURE.md` ni `THOREN_IMPLEMENTATION_PLAN.md` — todos siguen congelados como fuente de verdad. Tampoco reabre `THOREN_USABILITY_TEST_PLAN.md`, cuyo protocolo de sesión (perfiles, guion del moderador, plantilla de registro) sigue vigente tal cual — este documento extiende esa plantilla de una sola ronda de prueba hacia un proceso continuo de feedback durante toda la Beta.
**Alcance:** la Beta de experiencia de THÖREN 2.0 (Concepto E / Motor Creativo conversacional, `thoren-beta/`) — no la Beta Comercial del catálogo de Sticker Builder (`THOREN_BETA_COMMERCIAL_PLAN.md`, archivado en `../archive/sticker-builder/commercial/` tras `THOREN_PRODUCT_DIRECTION.md`), que era una iniciativa distinta con su propio proceso ya definido. Ver `THOREN_PROJECT_STATUS_v1.0.md` para la relación entre ambas.
**Precondición de todo este documento:** la Beta está en **congelamiento funcional** — ninguna observación, sin importar cuán convincente parezca en el momento, modifica el producto durante la ronda de validación. Este marco existe para documentar y clasificar evidencia, no para iterar en vivo.

---

## 1. Propósito

Durante la validación de usabilidad (`THOREN_USABILITY_TEST_PLAN.md`) el proceso fue una sola ronda moderada, con tres perfiles y una plantilla de sesión. La Fase 4 amplía la recolección de evidencia más allá de esa ronda: más sesiones, posiblemente no moderadas, posiblemente asíncronas (un participante prueba la Beta solo y responde por escrito), y durante un período más largo. Sin un marco explícito, cada sesión nueva se documentaría distinto, cada observador clasificaría distinto, y el equipo terminaría opinando sobre el producto en vez de leyendo la evidencia. Este documento fija cómo se documenta, cómo se clasifica, qué cuenta como patrón, cómo se prioriza, y cuándo — si acaso — algo se convierte en trabajo de desarrollo.

## 2. Roles durante esta fase

Quien ejecuta este marco actúa como **responsable de analizar evidencia**, no como diseñador ni desarrollador. Concretamente:

- No se implementa ningún cambio a partir de una sola sesión.
- No se generan documentos de estrategia nuevos a partir de una intuición — solo a partir de evidencia acumulada y clasificada.
- No se reabre ningún documento congelado para "ajustarlo" a lo que dijo un participante, salvo que se cumpla el criterio de patrón (sección 4) y pase, además, por `THOREN_DECISION_CRITERIA.md`.

## 3. Cómo documentamos cada sesión

**Sesión moderada (igual que `THOREN_USABILITY_TEST_PLAN.md`):** se usa la plantilla de su sección 9 sin modificarla. Cada sesión completada se traduce en cero o más entradas nuevas en `THOREN_FINDINGS_DATABASE.md` (sección 5 de este documento explica cómo pasar de una sesión a un hallazgo).

**Sesión no moderada / feedback asíncrono** (un participante usa la Beta por su cuenta y reporta después, por mensaje, formulario o llamada breve): se documenta con los mismos campos mínimos que exige `THOREN_FINDINGS_DATABASE.md`, aun si algunos quedan incompletos por no haber moderador presente. Un campo vacío se registra como vacío — nunca se completa por inferencia del observador.

**Regla común a ambos casos:** toda sesión se documenta el mismo día en que ocurre, antes de discutirla con nadie más del equipo. Discutir primero y documentar después contamina la observación con la opinión de otros — exactamente lo que este marco existe para evitar.

## 4. Clasificación de cada observación

Toda observación registrada se clasifica, sin excepción, en dos ejes independientes.

### 4.1 Eje de naturaleza — separar el hecho de la opinión

- **Hecho observado.** Algo que ocurrió y que dos observadores distintos habrían registrado igual: "tocó el botón X", "tardó 47 segundos en llegar a la revelación", "dijo la frase '¿ya está?'", "no llegó a descargar el archivo". Un hecho no incluye interpretación.
- **Hipótesis del observador.** Una explicación propuesta para un hecho: "probablemente dudó porque no reconoció el ícono". Toda hipótesis se registra *como hipótesis*, explícitamente etiquetada, nunca mezclada en la misma frase que el hecho que la originó.
- **Opinión o preferencia expresada por el participante.** Lo que el participante dijo que le pareció, le gustó, o cambiaría — se registra literalmente entre comillas (igual que ya exige `THOREN_USABILITY_TEST_PLAN.md` §5), nunca resumida ni parafraseada por el observador.

`THOREN_FINDINGS_DATABASE.md` tiene un campo distinto para cada una de las tres — nunca se combinan en un solo campo de texto libre.

### 4.2 Eje de categoría — de qué trata la observación

1. **Comprensión** — ¿la persona entendió qué hace THÖREN y qué esperar de él?
2. **Confianza** — ¿la persona sintió que el sistema ya resolvió el problema por ella?
3. **Intención de edición** — ¿buscó controles de edición, y qué pasó cuando no los encontró?
4. **Fricción de interacción** — ¿algo no respondió como esperaba, sin importar la causa?
5. **Defecto técnico** — el sistema hizo algo objetivamente incorrecto (error, contenido roto, exportación fallida).
6. **Contenido/ajuste al caso de uso** — la propuesta generada no encajó con lo que la persona necesitaba (evidencia potencial para el Motor Creativo, nunca para la interfaz).
7. **Deseo de función nueva** — el participante pidió o imaginó algo que hoy no existe.

Esta categoría determina, en parte, a qué documento madre pertenece un hallazgo maduro: 1-4 son primariamente evidencia de experiencia; 5 es un defecto técnico (puede justificar una corrección incluso sin patrón, ver sección 6); 6 es evidencia sobre el Motor Creativo (Fase 2, no la interfaz); 7 nunca se implementa directamente (ver `THOREN_DECISION_CRITERIA.md`).

## 5. De la sesión al hallazgo

No toda anotación de una sesión se convierte en una entrada de `THOREN_FINDINGS_DATABASE.md`. Se crea una entrada nueva cuando la observación cumple **al menos una** de estas condiciones:

- Corresponde a un criterio de fracaso ya definido en `THOREN_USABILITY_TEST_PLAN.md` §8.
- Es un defecto técnico objetivo (categoría 5).
- Es una señal fuerte y específica (una cita textual, un gesto de sorpresa, un tiempo atípico) que podría, en conjunto con otras sesiones, formar un patrón.

Una anotación genérica sin señal específica ("todo fluyó bien", "no pasó nada raro") no genera una entrada — se queda en la plantilla de sesión, que se conserva íntegra como respaldo, pero no infla la base de hallazgos con ruido.

## 6. Qué constituye un patrón

Se extiende, sin contradecirla, la regla ya fijada en `THOREN_USABILITY_TEST_PLAN.md` §10:

> Un hallazgo que aparece en al menos dos participantes de un mismo perfil, o en participantes de dos perfiles distintos, se considera un patrón real.

Para el feedback continuo de Fase 4 (más allá de la ronda original de tres perfiles), esta regla se generaliza así:

- **Patrón confirmado:** la misma observación (mismo hecho de fondo, no necesariamente las mismas palabras) aparece en **al menos dos sesiones independientes**, sin importar si comparten perfil.
- **Señal aislada:** aparece en una sola sesión. Se conserva en la base de hallazgos con estado `Aislado` (ver `THOREN_FINDINGS_DATABASE.md`), nunca se descarta, pero tampoco autoriza ningún cambio por sí sola.
- **Excepción — defecto técnico objetivo:** un defecto técnico verificable (categoría 5) no necesita repetirse para justificar una corrección — un error es un error la primera vez que se confirma, no una preferencia que necesite consenso. Esta excepción no aplica a ninguna otra categoría.
- **Nunca cuenta como patrón:** la misma persona repitiendo la misma queja varias veces dentro de una sola sesión, o el mismo observador viendo "lo mismo" en sesiones distintas sin que el hecho registrado (sección 4.1) sea realmente equivalente — el umbral es de **participantes independientes**, no de menciones.

## 7. Cómo priorizamos hallazgos

Cada patrón confirmado (nunca una señal aislada, salvo la excepción de defecto técnico) se ubica en una matriz de dos ejes:

**Impacto** — ¿qué tan cerca está de romper una de las tres preguntas raíz de `THOREN_USABILITY_TEST_PLAN.md` §1?
- **Alto:** contradice directamente un criterio de fracaso (§8) o impide llegar al resultado.
- **Medio:** genera fricción o duda visible, pero la persona igual completa el recorrido y obtiene su resultado.
- **Bajo:** es una preferencia o comentario que no afecta si la persona entendió, confió, o completó el recorrido.

**Frecuencia** — cuántas sesiones independientes lo confirman (mínimo 2, por definición de patrón; se registra el número exacto).

| | Frecuencia baja (2-3) | Frecuencia media (4-6) | Frecuencia alta (7+) |
|---|---|---|---|
| **Impacto alto** | Prioridad 1 | Prioridad 1 | Prioridad 1 |
| **Impacto medio** | Prioridad 3 | Prioridad 2 | Prioridad 1 |
| **Impacto bajo** | Prioridad 4 | Prioridad 3 | Prioridad 3 |

La prioridad determina el orden en que se revisan los hallazgos al cerrar la ronda de validación — no autoriza, por sí sola, ningún cambio al producto (eso lo decide exclusivamente `THOREN_DECISION_CRITERIA.md`).

## 8. Cuándo un problema merece convertirse en desarrollo

Un hallazgo pasa de "registrado" a "candidato a desarrollo" únicamente cuando se cumplen **las tres** condiciones siguientes:

1. Es un **patrón confirmado** (sección 6) — o un defecto técnico objetivo verificado.
2. Su prioridad es **1 o 2** (sección 7).
3. Pasa la evaluación de `THOREN_DECISION_CRITERIA.md` — que puede rechazarlo aunque cumpla 1 y 2, si contradice la filosofía del producto.

Cumplir 1 y 2 nunca es suficiente por sí solo — es condición necesaria, no suficiente. El criterio final de si algo entra al producto vive exclusivamente en `THOREN_DECISION_CRITERIA.md`, para que nunca haya dos lugares distintos decidiendo lo mismo con reglas distintas.

## 9. Qué hacer con esto mientras la Beta está en congelamiento funcional

Todo hallazgo, sin importar su prioridad, se registra en `THOREN_FINDINGS_DATABASE.md` y espera ahí. Ninguno se convierte en trabajo de desarrollo hasta que:

- Se complete la ronda de validación planeada (todas las sesiones programadas).
- Se analicen los patrones en conjunto, nunca sesión por sesión (mismo principio que `THOREN_USABILITY_TEST_PLAN.md` §10).
- Se cierre la Beta formalmente y se autorice explícitamente reanudar el desarrollo — ver `THOREN_PRODUCT_BACKLOG_V2.md`, donde cada ítem está marcado "No iniciar hasta cerrar la Beta".

## 10. Criterio final

> Documentar no es opinar. Clasificar no es decidir. Un patrón no es un mandato — es evidencia suficiente para *considerar* una decisión, nunca para tomarla automáticamente.
