# THÖREN — Base de Hallazgos

**Fecha:** 2026-07-31
**Naturaleza de este documento:** la estructura única y acumulativa donde vive todo hallazgo de la Fase de Validación de Usuario (Fase 4) de la Beta de experiencia (Concepto E / Motor Creativo, `thoren-beta/`). Se rige por `THOREN_USER_FEEDBACK_FRAMEWORK.md` (cómo se documenta y clasifica) y alimenta a `THOREN_DECISION_CRITERIA.md` (qué se hace con cada hallazgo). No contiene, todavía, ningún hallazgo real — la Beta acaba de entrar en congelamiento funcional; este documento existe para estar listo antes de la primera sesión, no después.
**Regla de oro:** un campo vacío se deja vacío. Nunca se completa por inferencia de quien documenta.

---

## 1. Esquema — un hallazgo, una fila

Cada hallazgo tiene exactamente estos campos. Ninguno se combina con otro dentro del mismo texto libre — en particular, **el hecho objetivo, la hipótesis y la cita textual del participante viven en tres campos separados**, nunca mezclados en uno solo (ver `THOREN_USER_FEEDBACK_FRAMEWORK.md` §4.1).

| Campo | Qué contiene | Formato |
|---|---|---|
| **ID** | Identificador único, nunca reutilizado ni renumerado. | `F-001`, `F-002`, … |
| **Fecha** | Fecha de la sesión que originó el hallazgo. | `AAAA-MM-DD` |
| **Participante** | Identificador anónimo — nunca un nombre real. | `P-01`, `P-02`, … |
| **Perfil** | El perfil de `THOREN_USABILITY_TEST_PLAN.md` §2, o el perfil real si Fase 4 amplía el reclutamiento. | `Sin conocimientos de diseño` / `Usa Canva` / `Dueño de negocio` / `Otro: <especificar>` |
| **Momento del recorrido** | En qué punto del Experience Blueprint ocurrió. | `Conversación inicial` / `Pulso de espera` / `Propuestas` / `Selección` / `Revelación` / `Obtener` / `Confirmación` / `Pregunta de impresión` |
| **Categoría** | Eje de categoría de `THOREN_USER_FEEDBACK_FRAMEWORK.md` §4.2. | `Comprensión` / `Confianza` / `Intención de edición` / `Fricción de interacción` / `Defecto técnico` / `Contenido/ajuste al caso de uso` / `Deseo de función nueva` |
| **Observación objetiva** | El hecho, tal cual, sin interpretación. Debe poder verificarse por dos observadores distintos. | Texto libre, en tiempo pasado, sin adjetivos de juicio. |
| **Cita textual** | Palabras exactas del participante, si las hubo. Vacío si no aplica — nunca parafraseado. | Entre comillas, verbatim. |
| **Evidencia** | Dónde vive el respaldo verificable del hallazgo. | Referencia a grabación, captura de pantalla, timestamp del panel `?beta=true`, o la plantilla de sesión completa. |
| **Impacto** | Según `THOREN_USER_FEEDBACK_FRAMEWORK.md` §7. | `Alto` / `Medio` / `Bajo` |
| **Frecuencia** | Número de sesiones independientes donde se confirmó el mismo hecho de fondo (no necesariamente las mismas palabras). Empieza en 1 y se actualiza al encontrar coincidencias reales. | Entero ≥ 1 |
| **Hipótesis** | Explicación propuesta, explícitamente marcada como tal. Vacío si no hay ninguna. | Texto libre, siempre precedido de "Hipótesis:" |
| **Estado** | Ver sección 2. | Enum cerrado |

## 2. Estados posibles

Un hallazgo transita, en este orden, sin saltarse pasos:

1. **Nuevo** — recién registrado, todavía no comparado contra el resto de la base.
2. **Aislado** — comparado contra toda la base; frecuencia = 1. Se conserva, no se descarta, no autoriza ningún cambio (`THOREN_USER_FEEDBACK_FRAMEWORK.md` §6).
3. **Patrón confirmado** — frecuencia ≥ 2 (o defecto técnico verificado una sola vez). Elegible para priorización.
4. **Candidato a desarrollo** — cumplió las tres condiciones de `THOREN_USER_FEEDBACK_FRAMEWORK.md` §8 y pasó la evaluación de `THOREN_DECISION_CRITERIA.md`. Pasa a `THOREN_PRODUCT_BACKLOG_V2.md` con referencia cruzada a su ID.
5. **Rechazado por filosofía** — pasó por `THOREN_DECISION_CRITERIA.md` y fue explícitamente rechazado, aunque fuera un patrón confirmado. Se conserva con la justificación del rechazo — nunca se borra un hallazgo rechazado, es memoria institucional.
6. **Resuelto** — se implementó un cambio y se verificó que atiende el hallazgo (solo aplicable después de que la Beta cierre y el desarrollo se reanude).
7. **Descartado** — se determinó, con evidencia posterior, que el hallazgo original era un error de registro o no era reproducible.

Ningún hallazgo se elimina de este documento. El estado se actualiza; la fila permanece.

## 3. Cómo actualizar la frecuencia sin inflarla artificialmente

Antes de crear un hallazgo nuevo, se compara contra los ya existentes con la misma Categoría y Momento del recorrido. Si el hecho de fondo es el mismo (no la redacción, el hecho), **no se crea una fila nueva** — se incrementa `Frecuencia` en la fila existente y se agrega el nuevo `Participante`/`Fecha`/`Evidencia` como una entrada adicional dentro de esa misma fila (lista, no una fila nueva por cada repetición). Esto evita que un patrón real quede fragmentado en varias filas que individualmente parecen aisladas.

## 4. Ejemplo ilustrativo (no es un hallazgo real)

La fila siguiente existe únicamente para mostrar el formato — no proviene de ninguna sesión real, porque ninguna sesión de Fase 4 se ha ejecutado todavía.

| ID | Fecha | Participante | Perfil | Momento | Categoría | Observación objetiva | Cita textual | Evidencia | Impacto | Frecuencia | Hipótesis | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-000 (ejemplo) | 2026-01-01 | P-00 | Usa Canva | Propuestas | Intención de edición | Tocó dos veces la tarjeta ya seleccionada antes de tocar "Elegir esta". | "¿No hay como un botón de editar aquí?" | Grabación de sesión, min 1:42 | Medio | 1 | Hipótesis: el hábito de "entrar a editar" de Canva se activó al ver tarjetas con apariencia de miniatura de diseño. | Aislado |

## 5. Registro real de hallazgos

*(Vacío. Se completa a partir de la primera sesión real de Fase 4 — ver `THOREN_USER_FEEDBACK_FRAMEWORK.md` para el proceso de captura.)*

| ID | Fecha | Participante | Perfil | Momento | Categoría | Observación objetiva | Cita textual | Evidencia | Impacto | Frecuencia | Hipótesis | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | |
