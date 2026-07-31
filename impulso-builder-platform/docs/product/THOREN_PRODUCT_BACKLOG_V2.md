# THÖREN — Product Backlog v2

**Fecha:** 2026-07-31
**Naturaleza de este documento:** reemplaza, para THÖREN 2.0 (Concepto E / Motor Creativo), la función de `PRODUCT_BACKLOG.md` y `UX_BACKLOG.md` — que documentan la plataforma Impulso pre-reinvención y no se actualizan como parte de esta fase (ver `THOREN_PROJECT_STATUS_v1.0.md` §4 para la relación exacta). Este no es un backlog de funcionalidades a construir — es un inventario de **preguntas abiertas, hipótesis sin confirmar y mejoras candidatas**, organizado para que la evidencia de la Fase de Validación de Usuario decida qué se activa y en qué orden.
**Regla que gobierna cada ítem de este documento, sin excepción:** **No iniciar hasta cerrar la Beta.** Ningún ítem aquí listado se convierte en trabajo antes de que la ronda de validación (Fase 4) concluya y `THOREN_DECISION_CRITERIA.md` lo autorice explícitamente.

---

## Cómo leer este backlog

Cada ítem tiene un origen (de dónde viene la pregunta/hipótesis/mejora) y una condición de activación (qué evidencia, específicamente, la convertiría en candidata real). Ningún ítem tiene fecha ni estimación — asignar tiempo a trabajo que no está autorizado sería una forma de empezarlo.

---

## 1. Descubrimientos pendientes

Preguntas que la Beta debe responder — no se sabe todavía la respuesta, y no se debe adivinar.

| Ítem | Por qué está abierto | Qué la resolvería |
|---|---|---|
| ¿La promesa "menos de un minuto" se cumple con personas reales, no solo en pruebas internas? | Fase 3 midió tiempos internos del motor (interpretación+composición+validación+exportación: ~20ms), pero el tiempo real incluye la decisión humana de leer, elegir y confiar — nunca medido con usuarios reales. | `THOREN_BETA_DASHBOARD.md` §2 (tiempo hasta seleccionar). |
| ¿La ausencia de edición se siente como alivio o como carencia? | Es la pregunta raíz #3 de `THOREN_USABILITY_TEST_PLAN.md` — el corazón de si Concepto E funciona. | Resultado agregado de todas las sesiones de Fase 4 contra los criterios de éxito/fracaso ya definidos. |
| ¿Qué proporción de personas entiende qué hace THÖREN sin ninguna explicación? | Nunca medido fuera de un entorno de prueba controlado con guion de moderador. | `THOREN_BETA_DASHBOARD.md` §2 (comprensión sin explicación). |
| ¿El repliegue a "Siempre Juntos" (sin nombres detectados) se siente genuino o se nota como una plantilla? | Fase 2 lo diseñó para que nunca se vea como placeholder, pero nunca se probó con una persona real que escribiera una frase sin nombres. | Observación directa en sesiones donde el participante escriba una frase corta o sin nombres propios. |
| ¿Qué tan seguido el Intérprete de intención falla en extraer un nombre real de una frase natural (no de prueba)? | El corpus de pruebas automatizadas de Fase 2 es representativo pero inventado, no recogido de personas reales escribiendo con sus propias palabras. | Frecuencia de "Contenido/ajuste al caso de uso" en `THOREN_FINDINGS_DATABASE.md` relacionada con nombres mal extraídos. |
| ¿Existe una necesidad real, no solo hipotética, de una segunda receta u ocasión antes de expandir el catálogo? | El plan de implementación explícitamente pospuso "más recetas/ocasiones" hasta tener evidencia — no una intuición de producto. | Patrón confirmado de personas pidiendo una ocasión distinta a boda, con perfil e intención reales (no una sola persona probando "por curiosidad"). |
| **¿Qué ocurre con la Beta Comercial del catálogo de Sticker Builder (63 plantillas, Gumroad, RC1), pausada desde `THOREN_PRODUCT_EXPERIENCE_AUDIT.md` y nunca formalmente retomada ni cancelada?** | Descubierto en la auditoría de `THOREN_PROJECT_STATUS_v1.0.md` §3 — es una decisión de producto pendiente, no un descubrimiento de usuario, pero bloquea cualquier afirmación sobre "qué es THÖREN hoy" mientras siga sin resolver. | Una decisión explícita del responsable de producto — no depende de más evidencia de usuario, depende de una decisión de alcance. |

## 2. Hipótesis pendientes

Cosas que el equipo cree, basado en el diseño ya aprobado, pero que ninguna evidencia real ha confirmado todavía.

- **Hipótesis:** el momento de revelación (transición reservada y única, `THOREN_INTERACTION_SYSTEM.md`) genera una reacción de sorpresa espontánea y observable en la mayoría de las personas.
- **Hipótesis:** las tres composiciones de un mismo lote se perciben como "propuestas genuinamente distintas" y no como "la misma plantilla con distinto color" — validado internamente por diseño (Fase 2), nunca por una persona ajena al proyecto.
- **Hipótesis:** el ritmo pausado (llegada escalonada de propuestas, pulso de espera) se siente deliberado y cuidado, no como una demora técnica.
- **Hipótesis:** las personas que usan Canva con regularidad (Perfil 2) sentirán con más fuerza el reflejo de "buscar el editor" que los otros dos perfiles, precisamente por el hábito ya instalado.
- **Hipótesis:** el nombre del archivo descargado (`thoren-<archetypeId>.svg`) es irrelevante para la experiencia — nadie lo mira ni le importa.

Cada hipótesis se marca `Confirmada`, `Refutada`, o `Sin evidencia suficiente` únicamente al cerrar la ronda de validación — nunca antes, y nunca a partir de una sola sesión.

## 3. Mejoras de experiencia

Candidatas que ya se pueden nombrar hoy, sin necesitar todavía evidencia específica que las origine — pero que **no se implementan** sin pasar primero por un patrón confirmado y `THOREN_DECISION_CRITERIA.md`.

- Revisar el lenguaje exacto de la conversación inicial si aparece un patrón de comprensión débil (categoría "Comprensión").
- Revisar el tiempo de llegada escalonada de las propuestas si aparece un patrón de impaciencia observable.
- Evaluar si la pregunta diferida de impresión necesita un contexto adicional, si aparece un patrón de confusión en esa pantalla específica.

*Nota deliberada: esta sección se mantiene corta a propósito. Llenarla de antemano con ideas no solicitadas sería exactamente el tipo de "mejora cosmética prematura" que esta fase prohíbe (ver instrucción de congelamiento funcional).*

## 4. Mejoras de rendimiento

- Verificar Lighthouse y tiempos reales bajo condiciones de red más lentas que las medidas en Fase 3 (esa medición fue en local, red no restringida).
- Evaluar si el bundle actual (82KB/22KB gzip, con Zod + Document Schema + Motor Creativo + shim de exportación) sigue rindiendo igual de bien en dispositivos móviles de gama baja, no solo en Chromium de escritorio.
- Ninguna de estas dos se investiga activamente hasta que exista evidencia de que el rendimiento —no medido, sino sentido por una persona real— fue un problema durante alguna sesión.

## 5. Expansión del Motor Creativo

Todo lo que `THOREN_IMPLEMENTATION_PLAN.md` ya definió como Fases 4 y 5, explícitamente no autorizadas hasta cerrar esta Beta:

- **Fase 4 — Variantes.** Generador de "más como esta" dentro de la misma receta.
- **Fase 5 — Calidad ampliada.** Clasificación completa de 5 niveles, ciclo de reintento/sustitución de receta ante un rechazo (hoy `generarLote()` simplemente lanza un error explícito — comportamiento correcto para esta fase, pero no el final).
- Refinar el Intérprete de intención con más patrones reales de frase (solo si aparece un patrón confirmado de fallo de extracción, sección 1).

## 6. Nuevas ocasiones

- Ampliar la tabla de afinidad ocasión→receta más allá de "Boda" (ya diseñada conceptualmente en `THOREN_CREATIVE_ENGINE.md` §6, nunca implementada).
- Agregar recetas nuevas (Minimalista, Botánico, Clásico, Moderno, Vintage, Premium — las 7 ya diseñadas en `THOREN_CREATIVE_ENGINE.md` §5, solo "Elegante" está implementada).
- **Condición de activación explícita:** evidencia real de demanda (sección 1) — nunca se inicia por supuesto de producto.

## 7. IA futura

- Cualquier forma de generación no determinista (LLM, modelo generativo de imagen) permanece fuera de alcance indefinidamente — no es una mejora pendiente de evidencia, es una decisión de filosofía ya tomada (`THOREN_CREATIVE_ENGINE.md`: "sin LLM, sin prompts, sin modelos"). Se lista aquí únicamente para que quede explícito que fue considerado y descartado, no olvidado.

---

## Resumen de estado

| Sección | Ítems | Estado de todos |
|---|---|---|
| 1. Descubrimientos pendientes | 7 | Abiertos — esperando evidencia de Fase 4 |
| 2. Hipótesis pendientes | 5 | Sin confirmar |
| 3. Mejoras de experiencia | 3 (deliberadamente corta) | No iniciar hasta cerrar la Beta |
| 4. Mejoras de rendimiento | 2 | No iniciar hasta cerrar la Beta |
| 5. Expansión del Motor Creativo | 3 | No iniciar hasta cerrar la Beta |
| 6. Nuevas ocasiones | 2 | No iniciar hasta cerrar la Beta |
| 7. IA futura | 1 | Descartada indefinidamente, no pendiente |
