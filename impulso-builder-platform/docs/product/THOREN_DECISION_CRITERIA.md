# THÖREN — Criterios de Decisión

**Fecha:** 2026-07-31
**Naturaleza de este documento:** reglas permanentes, no una opinión de esta ronda. Decide qué evidencia recogida durante la Fase de Validación de Usuario (Fase 4) puede convertirse en desarrollo, y cuál no, sin importar cuán convincente parezca en el momento. No reabre ningún documento de la etapa de definición (`THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md`, `THOREN_CREATIVE_ENGINE.md`) — los aplica como criterio de aceptación o rechazo, nunca los cuestiona.
**Relación con los otros documentos de Fase 4:** `THOREN_USER_FEEDBACK_FRAMEWORK.md` decide cómo se documenta y clasifica un hallazgo, y cuándo alcanza el estado "candidato a desarrollo" (evidencia suficiente: patrón + prioridad). Este documento decide qué pasa **después** de eso — es el único lugar del proyecto donde se decide si algo entra al producto.

---

## 1. La asimetría central

THÖREN no es una democracia de preferencias. La filosofía del producto (`THOREN_PRODUCT_PHILOSOPHY.md`) y la promesa central (`THOREN_VISION_2.md`: *"Obtén un diseño profesional en menos de un minuto"*) no se votan — se protegen. Toda decisión de esta fase parte de una asimetría deliberada:

> **Es más fácil rechazar una mejora popular que contradice la filosofía, que aceptar una mejora impopular que la refuerza.**

Cuando una petición o un patrón de fricción entra en conflicto con esta asimetría, gana la filosofía, no el conteo de personas que pidieron lo contrario.

## 2. Las cuatro reglas permanentes

### Regla 1 — Un comentario aislado nunca genera desarrollo

Un hallazgo con `Frecuencia = 1` (estado `Aislado` en `THOREN_FINDINGS_DATABASE.md`) se registra, se conserva, y **no se actúa sobre él**, sin importar cuán articulado, convincente o repetido dentro de la misma sesión haya sido. La única excepción es un defecto técnico objetivamente verificable (categoría 5 de `THOREN_USER_FEEDBACK_FRAMEWORK.md` §4.2) — un error de software no necesita repetirse para ser real.

*Por qué:* diseñar en respuesta a una sola reacción es exactamente el tipo de iteración impulsiva que `THOREN_USABILITY_TEST_PLAN.md` §10 ya prohibió para la ronda de usabilidad, y que este documento extiende a toda la Fase 4.

### Regla 2 — Un problema repetido por varios usuarios independientes sí es evidencia a evaluar

Un hallazgo con `Estado = Patrón confirmado` (frecuencia ≥ 2, sesiones independientes, ver `THOREN_USER_FEEDBACK_FRAMEWORK.md` §6) es evidencia real y se evalúa formalmente contra las reglas 3 y 4 de este documento. "Evaluar" no significa "implementar automáticamente" — significa que el hallazgo merece pasar por el resto de este proceso, cosa que un hallazgo aislado no se gana.

### Regla 3 — Una petición que contradiga la filosofía se rechaza aunque muchos la pidan

Si un patrón confirmado pide, implica o requeriría, para resolverse, cualquiera de lo siguiente:

- Reintroducir un editor libre, una barra de herramientas o un panel de propiedades como parte del recorrido principal (prohibido explícitamente por `THOREN_CREATIVE_ENGINE.md` §16 y `THOREN_INTERACTION_SYSTEM.md`).
- Mostrar el nombre técnico de una receta, sus reglas internas, puntuaciones de calidad, o jerga de impresión antes de que el usuario lo pida explícitamente (prohibido por `THOREN_CREATIVE_ENGINE.md` §15).
- Agregar una pregunta o paso de configuración antes de la primera propuesta (contradice "el sistema propone antes de preguntar", principio 4 de `THOREN_CREATIVE_ENGINE.md` §2).
- Generar opciones de forma indefinida o especulativa (contradice principio 9 del mismo documento).
- Cualquier otra contradicción directa y verificable contra `THOREN_PRODUCT_PHILOSOPHY.md` o `THOREN_INTERACTION_SYSTEM.md`.

…entonces se **rechaza como cambio de producto**, sin importar cuántas sesiones lo confirmen. Se registra en `THOREN_FINDINGS_DATABASE.md` con `Estado = Rechazado por filosofía` y la cita exacta del principio que lo motiva — nunca se descarta en silencio, porque el rechazo también es memoria institucional útil para la próxima vez que alguien proponga lo mismo.

**Este rechazo es sobre el producto, no sobre el aprendizaje.** Un patrón rechazado por filosofía puede, aun así, revelar algo real sobre expectativas de usuario que vale la pena entender — pero la respuesta a esa comprensión es ajustar cómo THÖREN *comunica* lo que ya hace (lenguaje, momento de revelación, expectativa previa), nunca ceder la decisión de diseño de vuelta al usuario.

### Regla 4 — Una mejora solo entra si aumenta la promesa del producto

Un patrón confirmado que **no** contradice la filosofía todavía necesita pasar una prueba positiva, no basta con "no ser dañino". Se pregunta, en este orden:

1. **¿Acerca más el recorrido a "menos de un minuto"?** (reduce tiempo, pasos, o fricción medible sin agregar una decisión nueva al usuario)
2. **¿Hace más fuerte la sensación de que un diseñador experto ya resolvió el problema?** (aumenta confianza, reduce duda, refuerza la revelación)
3. **¿Reduce, en vez de aumentar, la necesidad de que el usuario edite algo?**

Si la respuesta a las tres es "no" o "no aplica", el hallazgo se registra como evidencia válida pero **no se convierte en desarrollo** — pasa a `THOREN_PRODUCT_BACKLOG_V2.md` bajo "Mejoras de experiencia" o la categoría que corresponda, marcado "No iniciar hasta cerrar la Beta", a la espera de más contexto o de una versión del cambio que sí pase esta prueba.

Si al menos una respuesta es claramente "sí", con evidencia (no solo intuición) que lo respalde, el hallazgo se marca `Candidato a desarrollo` y se traslada a `THOREN_PRODUCT_BACKLOG_V2.md` con referencia cruzada a su ID en `THOREN_FINDINGS_DATABASE.md`.

## 3. Flujo de decisión

```
Hallazgo con Estado = Patrón confirmado
        │
        ▼
¿Contradice la filosofía? (Regla 3, criterios explícitos)
    │                                   │
   Sí                                  No
    │                                   │
    ▼                                   ▼
Rechazado por filosofía      ¿Aumenta la promesa? (Regla 4, 3 preguntas)
(se documenta el porqué)              │                  │
                                      Sí                 No
                                       │                  │
                                       ▼                  ▼
                          Candidato a desarrollo    Backlog, sin iniciar
                          (→ Backlog V2, con        (→ Backlog V2, con
                           prioridad de Fase 5+)      prioridad de Fase 5+)
```

Nótese que un hallazgo que no aumenta la promesa **no se descarta** — simplemente no se prioriza como si aumentara la promesa. Sigue siendo evidencia legítima para una fase futura si el contexto cambia.

## 4. Quién decide, y cuándo se permite una excepción

Ninguna persona individual del equipo tiene autoridad para saltarse este proceso a partir de una corazonada, sin importar su rol. La única excepción reconocida es la ya definida en la Regla 1 (un defecto técnico objetivo se corrige sin esperar patrón) — y esa corrección es una reparación, no un cambio de diseño: corrige el sistema para que haga lo que ya debía hacer, no le agrega una decisión nueva.

Cualquier ambigüedad genuina sobre si un hallazgo contradice la filosofía o aumenta la promesa se resuelve citando el documento congelado exacto y el pasaje exacto en disputa — nunca por consenso informal del equipo ni por intuición de diseño no verificada contra un documento existente.

## 5. Ejemplos ilustrativos (hipotéticos, no hallazgos reales)

- *"Un participante pidió poder cambiar el color de una propuesta."* — Aislado (un solo participante): se registra, no se actúa. Si apareciera en 3 sesiones independientes: sigue siendo, en esencia, una petición de control de edición — se evalúa contra la Regla 3 (reintroduce una decisión de diseño al usuario) antes que contra la Regla 4; si el patrón real de fondo fuera "el color no encajó con lo que la persona necesitaba" (categoría "Contenido/ajuste al caso de uso", no "Intención de edición"), la vía correcta no es un control de edición sino mejorar cómo el Intérprete de intención capta señales de color explícitas — ya resuelto en Fase 2, evidencia adicional solo confirmaría que el diseño actual es correcto o revelaría un caso límite del Intérprete, nunca un editor.
- *"Cuatro participantes de perfiles distintos tardaron visiblemente más de un minuto en llegar al resultado."* — Patrón confirmado, impacto alto. No contradice la filosofía. Pasa la Regla 4 (pregunta 1: acerca el recorrido a la promesa central). Candidato a desarrollo.
- *"Un participante sugirió agregar un asistente conversacional continuo tipo chatbot."* — Si apareciera como patrón, se rechaza directamente por Regla 3: contradice el rechazo explícito del "Concepto Asistente" ya documentado en el proceso de diseño (`THOREN_INTERACTION_SYSTEM.md`), sin importar cuántos lo pidan.

## 6. Criterio final

> Una decisión de producto no se toma por cuántas personas la pidieron. Se toma por si acerca al producto a su promesa sin traicionar lo que el producto decidió ser.
