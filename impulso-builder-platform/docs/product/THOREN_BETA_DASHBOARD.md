# THÖREN — Dashboard de Evaluación de la Beta

**Fecha:** 2026-07-31
**Naturaleza de este documento:** no es un dashboard visual ni una herramienta de software — es la definición exacta de cómo se mide el éxito de la Beta de experiencia (Concepto E / Motor Creativo). Ninguna métrica aquí definida se muestra al usuario ni requiere instrumentación nueva: todas se calculan a partir de lo que ya existe — la instrumentación silenciosa de `thoren-beta` (`src/telemetry.js`, Fase 3) y la plantilla de sesión de `THOREN_USABILITY_TEST_PLAN.md` §9.
**Cómo se usa:** al cerrar cada tanda de sesiones, se calculan estas métricas sobre el conjunto acumulado (nunca sobre una sola sesión) y se registran en la sección 4 de este documento, con fecha de corte. Los números por sí solos no autorizan ningún cambio — eso lo decide `THOREN_DECISION_CRITERIA.md` a partir de los hallazgos correspondientes en `THOREN_FINDINGS_DATABASE.md`.

---

## 1. De dónde vienen los datos

| Fuente | Qué aporta |
|---|---|
| `thoren-beta` con `?beta=true` (telemetry.js, Fase 3) | Los ocho eventos (`intent_detected` → `journey_completed`) y las mediciones de tiempo internas, por sesión. Solo disponibles si la sesión corrió con ese parámetro — ver limitación en sección 5. |
| Plantilla de sesión (`THOREN_USABILITY_TEST_PLAN.md` §9) | Observación humana: tiempos percibidos, criterios de éxito/fracaso marcados, respuestas a las seis preguntas posteriores, citas textuales. |
| `THOREN_FINDINGS_DATABASE.md` | Conteo de hallazgos por categoría, para las métricas que dependen de un patrón (intento de edición). |

## 2. Las métricas

### 2.1 Porcentaje que termina el recorrido

**Definición:** de todas las sesiones iniciadas (la persona escribió una frase y presionó continuar), cuántas llegan hasta el evento `journey_completed` (descarga real completada).

**Cálculo:** `sesiones con journey_completed / sesiones iniciadas × 100`.

**Por qué importa:** es la métrica más cercana a "la promesa se cumplió de punta a punta, sin que nadie se quedara a medio camino".

### 2.2 Tiempo hasta la primera propuesta

**Definición:** tiempo entre que la persona envía su frase y la primera propuesta aparece visible en pantalla.

**Dos números, no uno:**
- **Tiempo técnico** (`tiempoHastaPrimeraPropuesta` del panel de telemetría): mide solo el motor — en las mediciones internas de Fase 3, del orden de milisegundos, irrelevante frente al piso de ritmo de 900ms del Experience Blueprint.
- **Tiempo percibido** (de la plantilla de sesión, "Momento en que aparece la primera propuesta" menos "Hora de inicio"): el que de verdad importa para la promesa "menos de un minuto" — incluye el tiempo que la persona tardó en escribir su frase, que el motor no controla ni debe controlar.

**Por qué se separan:** confundir el tiempo técnico del motor con el tiempo real que vive la persona ocultaría el verdadero cuello de botella (casi siempre humano — pensar qué escribir — no técnico).

### 2.3 Tiempo hasta seleccionar

**Definición:** tiempo entre que aparece la primera propuesta y la persona confirma su elección ("Elegir esta").

**Cálculo:** del panel de telemetría, `at` del evento `proposal_selected` menos `at` de `proposal_rendered` (primera ocurrencia); o de la plantilla de sesión, la resta de los tiempos observados equivalentes.

**Por qué importa:** es la única parte del recorrido donde la duración depende enteramente de la persona, nunca del sistema — un tiempo consistentemente largo aquí es evidencia sobre las propuestas mismas (¿son claramente distintas? ¿alguna comunica mejor que las otras?), no sobre el motor.

### 2.4 Porcentaje que descarga

**Definición:** de las sesiones que llegan a la pantalla de revelación (vieron su propuesta elegida en grande), cuántas presionan "Obtener" y completan una descarga real.

**Cálculo:** `sesiones con svg_exported (del proposal elegido) / sesiones que llegaron a revelación × 100`.

**Por qué es distinta de 2.1:** aísla específicamente la revelación → obtención, la parte final y más crítica del recorrido — una caída aquí, después de que la persona ya vio y le gustó su resultado, sería la señal más grave posible.

### 2.5 Porcentaje que entiende el producto sin explicación

**Definición:** de las sesiones moderadas, cuántas responden de forma reconocible a la pregunta posterior 1 (*"¿Qué crees que hizo THÖREN?"*, `THOREN_USABILITY_TEST_PLAN.md` §6) sin haber recibido ninguna explicación previa del moderador.

**Cálculo:** marca binaria por sesión (criterio de éxito ya definido: "Entendió la propuesta... sin ninguna explicación previa") — `sesiones marcadas / total de sesiones moderadas × 100`.

**Limitación:** no aplica a sesiones no moderadas/asíncronas sin esa pregunta explícita — se calcula solo sobre el subconjunto que sí la tuvo.

### 2.6 Porcentaje que intenta editar

**Definición:** de todas las sesiones, cuántas muestran al menos una señal de los criterios de fracaso relacionados con edición (`THOREN_USABILITY_TEST_PLAN.md` §8: busca un editor, pregunta por cambiar fuente/color/tamaño, pregunta por mover elementos).

**Cálculo:** `sesiones con al menos una señal de esas tres / total de sesiones × 100`.

**Por qué importa más que cualquier otra:** es la métrica más directamente ligada a la pregunta raíz #3 de la usabilidad — si este porcentaje es alto y sostenido entre perfiles, es la señal más fuerte de que la filosofía "eliminar la edición" todavía no se percibe como resuelta, sin importar qué tan bien midan las demás métricas.

### 2.7 Porcentaje que pediría usarlo otra vez

**Definición:** de las sesiones moderadas, cuántas responden de forma afirmativa y espontánea a la pregunta posterior 6 (*"¿Volverías a abrir THÖREN?"*).

**Cálculo:** `sesiones con respuesta afirmativa / total de sesiones moderadas × 100`.

**Por qué se registra la respuesta completa, no solo sí/no:** el "por qué" de esta pregunta suele contener la cita más útil de toda la sesión — se conserva textual en `THOREN_FINDINGS_DATABASE.md`, no solo como un conteo.

## 3. Qué este dashboard deliberadamente no mide

- **Preferencia estética** ("¿te gustó el diseño?") — explícitamente fuera del objetivo de la prueba (`THOREN_USABILITY_TEST_PLAN.md` §1).
- **Cualquier promedio que combine perfiles distintos en un solo número sin desglose.** Toda métrica de este documento se reporta también desglosada por perfil (`Sin conocimientos de diseño` / `Usa Canva` / `Dueño de negocio`) — nunca solo como un agregado global, por la misma razón ya documentada en `THOREN_DECISION_LOG.md` DEC-016 para la Beta Comercial: un promedio puede ocultar exactamente la señal que se busca.
- **Volumen de uso o retención a largo plazo.** Fuera de alcance de una Beta de validación de experiencia — pertenecen a una eventual fase comercial, no a esta.

## 4. Registro de mediciones

*(Vacío. Se completa al cerrar cada tanda de sesiones — nunca sesión por sesión, mismo principio que `THOREN_USABILITY_TEST_PLAN.md` §10.)*

| Corte (fecha) | Sesiones incluidas | 2.1 Completa recorrido | 2.2 Tiempo 1ª propuesta (percibido) | 2.3 Tiempo hasta seleccionar | 2.4 % Descarga | 2.5 % Comprensión | 2.6 % Intenta editar | 2.7 % Volvería a usar |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## 5. Limitaciones reconocidas de antemano

- El panel `?beta=true` altera ligeramente el DOM (agrega el panel visible) — se recomienda que las sesiones de medición formal corran con ese parámetro para capturar telemetría exacta, sabiendo que el participante podría notar el panel si mira esa esquina de la pantalla. Si una sesión debe ser perfectamente indistinguible del enlace público, se sacrifica la telemetría fina de esa sesión a cambio de fidelidad total de experiencia — se documenta cuál caso aplicó en cada fila de la sección 4.
- Las métricas 2.5 y 2.7 dependen de una sesión moderada con las preguntas posteriores — no existen para feedback asíncrono puro.
