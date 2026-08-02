# THÖREN — Guía Práctica de Observación

**Fecha:** 2026-08-02
**Naturaleza de este documento:** un manual de campo, no un documento conceptual nuevo. Condensa y opera `THOREN_USABILITY_TEST_PLAN.md` (protocolo de sesión, guion del moderador, plantilla de registro) y `THOREN_USER_FEEDBACK_FRAMEWORK.md` (cómo se clasifica y prioriza cada observación) en una secuencia práctica de antes/durante/después, para que cualquier persona del equipo pueda moderar una sesión igual que cualquier otra. No reemplaza a ninguno de los dos — donde algo no esté aquí con suficiente detalle, esos documentos son la fuente completa. No modifica ningún documento existente, no propone cambios de producto, no genera backlog, no hace recomendaciones de diseño.
**A quién sirve:** a quien va a sentarse frente a un participante y necesita, en el momento, saber exactamente qué hacer — no a quien está diseñando el protocolo (eso ya está hecho).

---

## 1. Cómo preparar una sesión

**24 horas antes:**
- Confirma que `https://thoren-beta-v1.vercel.app/` carga correctamente en el dispositivo que vas a usar (no el tuyo de siempre — el que realmente va a usar el participante).
- Decide el perfil del participante (`THOREN_USABILITY_TEST_PLAN.md` §2: Sin conocimientos de diseño / Usa Canva / Dueño de negocio) **antes** de la sesión, no durante.
- Ten lista la frase de escenario de ese perfil — una sola frase, memorizada, nunca leída de una pantalla frente al participante.
- Prepara cómo vas a registrar: papel y lápiz, o la plantilla de la sección 10 de este documento abierta en otro dispositivo (nunca en el mismo dispositivo donde el participante está usando THÖREN).
- Si vas a grabar (pantalla, audio o video), consíguelo con tiempo y ten el consentimiento del participante resuelto antes de sentarlo — nunca es el primer tema de la sesión misma.

**Justo antes:**
- Abre THÖREN en el dispositivo del participante, en la pantalla inicial, **sin** `?beta=true` — el enlace que va a usar la persona real, exactamente igual.
- Guarda tu teléfono, cierra pestañas de trabajo, elimina cualquier distracción visual de la mesa. Tu atención completa es parte del instrumento de medición.
- Revisa una última vez: ¿tienes clara la frase de escenario? ¿sabes qué perfil es esta persona? ¿tienes dónde anotar?

## 2. Cómo recibir al participante sin influir en su comportamiento

- Saluda con normalidad, sin explicar de más ni de menos. El guion base ya está escrito (`THOREN_USABILITY_TEST_PLAN.md` §3) — dilo casi textual, no lo improvises cada vez distinto.
- Entrega la frase de escenario **una sola vez, oral, sin repetirla ni parafrasearla** aunque el participante pregunte de nuevo (si pregunta, ver sección 3).
- No sonrías de más al mencionar la app, no bajes la voz como anticipando algo especial, no cambies tu tono corporal — cualquier señal no verbal tuya de "algo interesante va a pasar" contamina la sorpresa que se supone que la app misma debe generar.
- Entrega el dispositivo y da un paso atrás, física y conversacionalmente. Tu presencia debe sentirse como la de alguien que observa, no la de alguien que acompaña.

## 3. Qué NO decir durante la sesión

Nunca, bajo ninguna circunstancia (lista completa en `THOREN_USABILITY_TEST_PLAN.md` §3, resumida aquí para consulta rápida):

- El nombre de ningún concepto interno de diseño.
- Ninguna palabra de la filosofía del producto ("suposición inteligente", "revelación", "eliminar la edición", "menos de un minuto").
- Que la ausencia de un editor es intencional.
- Que se espera sorpresa en algún momento específico.
- Que esto es una prueba/prototipo, salvo que el participante lo pregunte de forma directa.
- Comparaciones con Canva, Figma u otra herramienta, salvo que el participante las mencione primero.
- Cualquier instrucción de acción concreta ("toca ahí", "prueba esto") — ni con palabras ni señalando con la mirada o el dedo.

**Respuestas ya escritas para las preguntas más comunes** (úsalas literales, no las mejores sobre la marcha):

| Pregunta del participante | Tu respuesta |
|---|---|
| "¿Estoy haciendo esto bien?" | "Haz lo que te parezca natural. No hay una forma correcta." |
| "¿Qué se supone que tengo que hacer aquí?" | "Lo que tú harías si de verdad estuvieras resolviendo esto." |
| "¿Puedo tocar esto?" | "Prueba y descúbrelo." |
| "¿Ya terminé?" | "¿Tú sientes que ya terminaste?" |
| Cualquier pregunta sobre qué es o cómo funciona por dentro | "Eso te lo cuento con calma al final." |

## 4. Qué observar en los primeros 60 segundos

Este es el tramo con más señal por segundo de toda la sesión — la primera reacción de alguien frente a algo que nunca ha visto es la más honesta que vas a obtener.

- **¿Lee la invitación completa antes de tocar algo, o toca antes de leer?** Ninguna es "incorrecta" — pero es un dato sobre cómo esta persona aborda interfaces nuevas.
- **¿Escribe una frase completa y natural, o se detiene a pensar qué "se supone" que debe escribir?** La duda aquí (más de 5-10 segundos sin escribir tras leer la invitación) es la primera señal de fricción de comprensión.
- **¿Busca con la mirada algo que no está** — un menú, un botón de "ayuda", un logo que reconozca? Anótalo aunque no lo diga en voz alta.
- **Postura corporal al primer toque/primera palabra escrita:** ¿inclinado hacia adelante con interés, o tenso como quien no sabe qué esperar?
- **Tiempo exacto hasta el primer toque o primera tecla** — anótalo con cronómetro si puedes, es el primer dato cuantitativo de la sesión.

No intervengas en este tramo bajo ninguna circunstancia, incluso si el silencio se siente largo — 60 segundos de silencio real casi siempre se sienten como 3 minutos para quien observa.

## 5. Señales de comprensión

- Escribe su frase con naturalidad, sin pausas largas ni releer la invitación varias veces.
- Avanza de una pantalla a la siguiente sin buscar ayuda ni preguntar "¿y ahora qué?".
- Reacciona (gesto, comentario) en el momento de la revelación — significa que entendió que ese era el resultado, no un paso intermedio.
- Al preguntarle después "¿qué crees que hizo THÖREN?" (sección 9), da una respuesta coherente con lo que realmente pasó, en sus propias palabras, sin necesitar que se lo repitas.
- Va directo a "Obtener" sin dudar sobre qué significa ese botón.

## 6. Señales de confusión

- Se detiene sin tocar nada durante 60-90 segundos o más, sin decir nada (ver protocolo de intervención mínima en `THOREN_USABILITY_TEST_PLAN.md` §4 si se cumple ese umbral).
- Intenta tocar algo que no es interactivo — anota exactamente qué tocó y qué esperaba que pasara.
- Relee el mismo texto varias veces, frunce el ceño, mueve el cursor o el dedo sin rumbo claro sobre la pantalla.
- Pregunta en voz alta "¿esto ya está?", "¿falta algo?", o busca activamente un control que no existe (editar, cambiar, mover, deshacer).
- Suspira, dice "ya" con impaciencia, acelera los toques como si estuviera perdiendo la paciencia.
- Llega al final sin ninguna reacción visible — ni un gesto, ni un comentario — en el momento de la revelación.

## 7. Qué frases textuales registrar

**Regla simple: si dudas si vale la pena anotar una frase, anótala.** Una cita real, capturada exacta, vale más que cualquier resumen tuyo de lo que "quiso decir".

Prioriza, en este orden:
1. Cualquier cosa dicha espontáneamente, sin que se lo preguntaras — es la señal más pura de toda la sesión.
2. Cualquier pregunta que haga durante el uso (aunque no la respondas, anótala igual).
3. Las respuestas literales a las 6 preguntas posteriores (sección 9) — palabra por palabra, no parafraseadas.
4. Cualquier reacción verbal en el momento exacto de la revelación.

**Cómo anotar:** entre comillas, tal cual, incluyendo muletillas si son parte natural de cómo lo dijo ("o sea, ¿ya? ¿así de fácil?"). Nunca lo limpies ni lo hagas sonar más articulado de lo que fue.

## 8. Cómo distinguir una opinión de un patrón

Esto es lo más fácil de hacer mal bajo presión, así que ten la regla escrita y a la vista durante la sesión:

- **Un hecho** es algo que dos observadores distintos habrían anotado exactamente igual: "tardó 40 segundos", "tocó el botón X dos veces", "dijo la palabra 'editar'".
- **Una hipótesis** es tu explicación de por qué pasó ese hecho — anótala, pero **siempre** precedida de la palabra "Hipótesis:", nunca mezclada en la misma frase que el hecho.
- **Una opinión** es lo que el participante dijo que sintió, le gustó o cambiaría — cítala literal, nunca la resumas con tus propias palabras.
- **Un patrón** no existe todavía si solo tienes una sesión. Necesitas, como mínimo, **el mismo hecho de fondo en dos sesiones independientes** (mismo perfil o distinto, no importa) antes de que algo deje de ser una señal aislada. Ver `THOREN_USER_FEEDBACK_FRAMEWORK.md` §6 para el detalle completo — la regla corta: **una sesión nunca es evidencia suficiente, sin importar qué tan convincente parezca en el momento.**

## 9. Qué preguntar al finalizar

En este orden exacto, sin agregar ninguna otra pregunta salvo que surja naturalmente de una respuesta anterior (`THOREN_USABILITY_TEST_PLAN.md` §6):

1. ¿Qué crees que hizo THÖREN?
2. ¿Qué momento recuerdas más?
3. ¿Hubo algún instante donde sentiste que faltaba algo?
4. ¿En qué momento sentiste más confianza?
5. ¿Hubo algo que quisieras hacer y no pudiste?
6. Si mañana necesitaras algo así de verdad, ¿volverías a abrir THÖREN? ¿Por qué?

Nunca menciones tú primero palabras como "edición", "revelación" o "propuestas" — si el participante las usa, puedes retomarlas con sus propias palabras.

## 10. Cómo documentar la sesión

Usa la plantilla completa de `THOREN_USABILITY_TEST_PLAN.md` §9 — no la reescribas ni la resumas. Tres reglas prácticas para llenarla bien:

- **El mismo día, antes de comentarla con nadie.** Documentar después de discutirla contamina tu registro con la opinión de otra persona.
- **Un campo vacío se deja vacío.** Nunca completes por inferencia lo que no observaste directamente.
- **Separa siempre hecho / hipótesis / cita textual en sus propios espacios** — nunca en la misma oración (ver sección 8).

## 11. Cómo comparar varias sesiones

- No compares sesión por sesión a medida que ocurren para decidir nada — el protocolo (`THOREN_USABILITY_TEST_PLAN.md` §10) es explícito: **primero se completan todas las sesiones planeadas, después se analizan los patrones en conjunto.**
- Para comparar, agrupa por: mismo perfil, misma categoría de observación (Comprensión / Confianza / Intención de edición / Fricción / Defecto técnico / Contenido / Deseo de función nueva — `THOREN_USER_FEEDBACK_FRAMEWORK.md` §4.2), y mismo momento del recorrido.
- Pregúntate, para cada grupo: ¿el mismo hecho de fondo aparece en más de una sesión independiente? (no la misma frase textual — el mismo hecho, aunque lo hayan dicho distinto).

## 12. Cómo convertir observaciones en evidencia

Cada sesión completa se traduce en cero o más entradas en `THOREN_FINDINGS_DATABASE.md` — no toda anotación se convierte en una entrada. Se crea una entrada cuando la observación:

- Corresponde a un criterio de fracaso ya definido (`THOREN_USABILITY_TEST_PLAN.md` §8), o
- Es un defecto técnico objetivo (algo que la app hizo objetivamente mal), o
- Es una señal fuerte y específica (una cita textual, un gesto de sorpresa, un tiempo atípico) que podría, junto con otras sesiones, formar un patrón.

Una nota genérica ("todo fluyó bien") no genera una entrada — se queda en la plantilla de sesión como respaldo, sin inflar la base de hallazgos con ruido. Ver `THOREN_USER_FEEDBACK_FRAMEWORK.md` §5 para el detalle completo del formato de cada entrada.

## 13. Cómo decidir si algo merece convertirse en un cambio del producto

**No te corresponde decidir esto durante ni inmediatamente después de una sesión — y esta guía tampoco lo decide.** El camino completo, ya definido, es:

1. El hallazgo debe ser un **patrón confirmado** (aparece en al menos 2 sesiones independientes) — o un defecto técnico verificado una sola vez.
2. Debe tener **prioridad 1 o 2** según la matriz de impacto × frecuencia de `THOREN_USER_FEEDBACK_FRAMEWORK.md` §7.
3. Debe pasar la evaluación de `THOREN_DECISION_CRITERIA.md` — que puede rechazarlo aunque cumpla los dos puntos anteriores, si contradice la filosofía del producto.

Cumplir los tres es responsabilidad de quien analiza la base de hallazgos completa al cerrar la ronda de validación — no de quien modera una sesión individual. Tu trabajo como moderador termina en documentar con la mayor fidelidad posible, no en juzgar si algo "debería cambiarse".

## 14. Errores comunes del moderador que invalidan una sesión

- **Ayudar sin darse cuenta** — señalar con la mirada, repetir en voz alta lo que la persona ya está viendo, o llenar un silencio incómodo con una pista.
- **Explicar de más al inicio**, "para que no se pierda" — esto es exactamente lo que la sesión existe para medir sin ayuda.
- **Reaccionar visiblemente** (sonreír, asentir con entusiasmo, decir "¡eso es!") cuando el participante hace algo "correcto" — le enseña, sin palabras, qué se espera de él el resto de la sesión.
- **Corregir un intento fallido** ("no, eso no se mueve, prueba con esto otro") — ese intento fallido es exactamente el dato que la sesión necesita, no un error que arreglar.
- **Comparar en voz alta con otra sesión** ("la persona anterior hizo tal cosa") — contamina la interpretación de la sesión en curso.
- **Documentar de memoria, horas después** — los detalles finos (tiempos exactos, la frase textual exacta) se pierden o se reconstruyen mal.
- **Discutir la sesión con el equipo antes de documentarla** — la opinión ajena se filtra en tu registro sin que te des cuenta.
- **Cambiar el guion o el escenario a mitad de la ronda** porque "la última vez funcionó mejor así" — invalida la comparación entre sesiones (ver sección 11).

## 15. Checklist de una sesión completa

**Antes:**
- [ ] Perfil del participante decidido de antemano.
- [ ] Frase de escenario memorizada (una sola, la del perfil correcto).
- [ ] THÖREN abierto en el dispositivo del participante, sin `?beta=true`.
- [ ] Forma de registrar lista (papel o plantilla, en un dispositivo aparte).
- [ ] Consentimiento de grabación resuelto, si aplica, antes de empezar.

**Durante:**
- [ ] Guion base dicho casi textual, sin explicar de más.
- [ ] Escenario entregado una sola vez, oral.
- [ ] Cero instrucciones de acción concreta, cero señalar con la mirada o el dedo.
- [ ] Primeros 60 segundos observados con atención completa (sección 4).
- [ ] Señales de comprensión/confusión anotadas con el instante aproximado (secciones 5-6).
- [ ] Frases textuales capturadas literales, entre comillas (sección 7).
- [ ] Las 6 preguntas posteriores, en orden, sin agregar de más (sección 9).

**Después:**
- [ ] Plantilla de sesión completada el mismo día, antes de comentarla con nadie.
- [ ] Hecho / hipótesis / cita separados en sus propios campos.
- [ ] Campos sin dato dejados vacíos, nunca completados por inferencia.
- [ ] Comparado contra sesiones previas del mismo perfil/categoría/momento — solo para ver si algo se repite, nunca para decidir un cambio todavía.
- [ ] Ninguna sesión individual usada como justificación de ningún cambio de producto.

---

**Recordatorio final, el más importante de todo el documento:** tu trabajo como moderador es reunir la evidencia más fiel posible — no interpretarla, no decidir con ella, y menos aún, corregir el producto entre una sesión y la siguiente. Eso le corresponde a otro momento del proceso, con todas las sesiones completas y los patrones ya visibles.
