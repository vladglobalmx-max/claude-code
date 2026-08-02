# THÖREN — Propuestas Metodológicas Pendientes

**Fecha de creación:** 2026-08-02
**Naturaleza de este documento:** un registro de mejoras propuestas al **instrumento de medición** (`THOREN_USABILITY_TEST_PLAN.md`, `THOREN_OBSERVATION_GUIDE.md`, `THOREN_USER_FEEDBACK_FRAMEWORK.md`), no al producto. Ninguna propuesta aquí listada está activa — todas esperan revisión explícita en el punto de control que cada una define. Los tres documentos de protocolo permanecen exactamente como están hasta que una propuesta se apruebe formalmente y se aplique ahí, no aquí.
**Regla de este documento:** nada de lo que contiene autoriza, por sí solo, ningún cambio al protocolo, a la Beta, ni al producto. Es una lista de espera, no una lista de tareas.

---

## P-001 — Detectar "resolución incompleta" (sensación de trabajo no terminado)

**Estado:** Pendiente — no aplicado.
**Origen:** observación del responsable de producto durante uso propio de la Beta (no una sesión bajo protocolo), 2026-08-02: *"Veo tres propuestas, elijo una, la descargo. Pero nunca siento que terminé mi trabajo. Siento que probé una demostración, no que resolví un problema."*
**Análisis previo:** el protocolo actual (`THOREN_USABILITY_TEST_PLAN.md` §5-6) tiene tres proxies adyacentes a esta sensación — Pregunta 3 ("¿faltó algo?"), Pregunta 6 ("¿volverías?"), y la observación del instante de obtener el resultado (§5) — pero ninguno mide directamente el constructo "sensación de cierre/finalización del trabajo" como algo distinto de "faltó una pieza específica" o "fue útil".

**Modificación mínima propuesta (sin aplicar):**
1. Agregar una línea de observación en `THOREN_USABILITY_TEST_PLAN.md` §5 (y su reflejo en la plantilla §9 y en `THOREN_OBSERVATION_GUIDE.md`): comportamiento en los 10-15 segundos posteriores a obtener el resultado, antes de que el moderador diga nada — ¿mira el archivo, lo abre, comenta algo espontáneo, cierra de inmediato, se queda en silencio?
2. Agregar una nota de interpretación en `THOREN_OBSERVATION_GUIDE.md` (señales de comprensión/confusión): una tercera categoría de señal, "cierre ambivalente" — respuesta plana a la Pregunta 6, "no" dudoso a la Pregunta 3, o ausencia de cualquier gesto/comentario tras la descarga.

**Por qué es de bajo riesgo (si se aplicara):** no agrega ni cambia ninguna pregunta dicha al participante — es una extensión de qué observa y cómo interpreta el moderador, no del guion. No crea una categoría nueva en `THOREN_FINDINGS_DATABASE.md` (encaja en "Confianza", ya existente).

**Condición para revisar esta propuesta:** al completar las **primeras 5 sesiones** bajo el protocolo actual, sin ninguna modificación. En esa revisión, evaluar:
- ¿Los proxies existentes (Pregunta 3, Pregunta 6, observación del instante de obtención) capturaron esta sensación en la práctica, aunque sea indirectamente?
- ¿Apareció esta sensación en alguna de las 5 sesiones reales, o fue exclusiva de la impresión inicial del responsable de producto (con conocimiento completo de la filosofía, que un participante ingenuo no tiene)?
- Solo si la respuesta a la primera pregunta es "no, se nos escapó" y a la segunda es "sí, apareció" — aplicar la modificación antes de la sesión 6. Si no, esta propuesta se marca como innecesaria y se cierra sin aplicarse.

**Mientras tanto:** el protocolo corre exactamente como está escrito hoy, sin ningún cambio, para las primeras 5 sesiones.
