# THÖREN — Product Philosophy (restricción permanente)

**Fecha:** 2026-07-30
**Naturaleza:** filosofía rectora para toda decisión futura de UX, UI, interacción, flujo y producto — no una especificación técnica. Incluye, como primera aplicación práctica, la auditoría del `THOREN_EXPERIENCE_BLUEPRINT.md` contra esta filosofía, tal como se solicitó.
**Nota de recepción:** el mensaje original hacía referencia a un "Product Philosophy" adjunto; a esta sesión no llegó ningún archivo separado. Lo que sigue toma como fuente literal el texto de filosofía incluido directamente en el mensaje del usuario. Si existía un documento adicional que no llegó, debe reemplazarse el texto de la sección 1 por el original.

---

## 1. La filosofía, cita textual (fuente)

> This document is not a feature request. It is a product direction update.
> From this point forward, use this philosophy as the primary decision-making framework for every UX, UI, interaction, workflow and product recommendation you make for THÖREN.
>
> Your goal is not to build an AI-powered editor.
> Your goal is to build the experience of working with the world's best designer, condensed into one minute.
>
> Whenever you have to choose between flexibility and simplicity, choose simplicity unless flexibility creates overwhelming value.
> Whenever you have to choose between exposing controls or making an intelligent assumption, choose the intelligent assumption.
>
> Directrices operativas:
> 1. Evaluar si la experiencia actual está alineada con esta filosofía.
> 2. Identificar momentos donde la experiencia se comporta como software en vez de como un diseñador experto.
> 3. Sugerir mejoras solo si reducen la carga cognitiva o aumentan la sensación de que THÖREN anticipa las necesidades del usuario.
> 4. No agregar funciones solo porque son comunes en software de diseño.
> 5. Preferir eliminar pasos sobre simplificarlos.
> 6. Cuestionar cualquier interacción que exija decisiones innecesarias del usuario.
> 7. Preservar el principio de "éxito en un minuto" a toda costa.
>
> Treat this philosophy as a permanent constraint for future product decisions.

## 2. Los dos principios de decisión, en una frase cada uno

- **Simplicidad por defecto.** Solo se acepta flexibilidad cuando genera un valor tan claro que ninguna persona razonable lo cuestionaría — nunca porque "sería bueno tener la opción".
- **Suposición inteligente por defecto.** Un control expuesto es, por definición, una decisión que THÖREN no supo o no quiso tomar por su cuenta. Cada control que sobrevive a esta prueba debe justificar por qué no podía ser una suposición.

El criterio final para cualquier cambio futuro sigue siendo el mismo de `THOREN_VISION_2.md`: *"THÖREN no es un lienzo. Es un resultado que ya llegó terminado."* Esta filosofía no lo reemplaza — lo hace más estricto.

---

## 3. Veredicto general: ¿el Blueprint está alineado?

Alineado en espíritu, no todavía en cada detalle. El guion de Marcela ya cumple lo esencial: nunca hay jerga técnica, el resultado aparece antes que cualquier explicación, y el número total de decisiones reales que le pertenecen a ella es pequeño. Pero al someterlo a la prueba más estricta de esta filosofía —"¿esto es una suposición inteligente, o es un control expuesto disfrazado de pregunta amable?"— aparecen tres momentos que todavía se sienten como software pidiendo permiso, no como un diseñador experto trabajando con total confianza.

---

## 4. Momentos donde el Blueprint todavía se comporta como software, no como un diseñador experto

**A. Intención e identidad como dos preguntas separadas (0:00 y 0:12).**
Hoy Marcela responde "¿para qué es esto?" y espera a que THÖREN reaccione antes de que le pregunten "¿cómo se llaman?". Un diseñador experto real no necesita ese turno adicional — si alguien le dice "necesito algo para la boda de Marcela y Andrés", ya tiene ambos datos en una sola frase. Separar esto en dos preguntas secuenciales es la estructura de un formulario (un campo, confirmar, el siguiente campo), no la de una conversación. Esto no reduce la carga cognitiva de Marcela — le añade una espera innecesaria entre dos datos que ella ya sabe al mismo tiempo.

**B. La elección de color como pregunta explícita antes de mostrar nada (0:31).**
El Blueprint actual pregunta "¿hay un color que quieras que aparezca?" antes de mostrar el resultado coloreado. Esto es exactamente un control expuesto disfrazado de pregunta amable: le pide a Marcela que imagine un resultado que todavía no existe y lo describa en abstracto — lo más difícil de hacer para alguien sin vocabulario de diseño. Un diseñador experto nunca pregunta "¿qué color quieres?" antes de proponer algo. Elige un color con buen criterio, lo muestra ya resuelto, y solo si hace falta, ofrece un ajuste después de que la persona ya vio el resultado y puede reaccionar a algo concreto, no a una idea abstracta.

**C. La pregunta de destino de impresión interpuesta antes de la revelación (0:42, justo antes del clímax en 0:48).**
Este es el hallazgo más importante. Tal como está escrito hoy, el guion coloca una pregunta con sabor logístico/técnico ("¿vas a imprimir esto tú, o en cantidad?") en el instante inmediatamente anterior al momento de mayor carga emocional de todo el recorrido — la revelación del resultado terminado. Eso rompe el impulso exactamente donde más debería sostenerse. Es la versión suave de una fricción real: sin importar cuán bien esté redactada la pregunta, sigue siendo una pausa transaccional insertada justo antes del pago emocional. Un diseñador experto nunca detiene la entrega del resultado para preguntar sobre logística de producción — entrega primero, y solo después, si hace falta escalar a producción en volumen, lo pregunta como una extensión natural de un éxito que ya ocurrió.

---

## 5. Lo que sí se queda: la única flexibilidad que gana su lugar

**Elegir entre varias propuestas ya terminadas (0:24-0:31)** sobrevive esta auditoría sin cambios, y merece decirse explícitamente por qué: el gusto personal por una de varias versiones igualmente bien resueltas no es información que THÖREN pueda inferir por sí mismo — es, por definición, subjetiva y le pertenece únicamente a la persona. Esto es exactamente el caso que la filosofía describe como excepción legítima ("a menos que la flexibilidad cree un valor abrumador"): sin esta elección, THÖREN estaría imponiendo un único resultado sin dar espacio a que la pieza se sienta genuinamente "de ellos". La diferencia con los tres puntos anteriores es clave: aquí no se le pide a Marcela que configure nada ni que imagine algo abstracto — se le pide que reaccione con su gusto frente a opciones ya reales y terminadas. Esa es la clase de decisión que sí necesita tomar un ser humano.

---

## 6. Mejoras sugeridas (solo las que reducen carga cognitiva o aumentan la sensación de anticipación)

1. **Fusionar intención e identidad en un único momento conversacional.** En vez de "¿para qué es esto?" → esperar → "¿cómo se llaman?", una sola invitación abierta ("Cuéntame en pocas palabras qué necesitas") que capture ambas cosas a la vez cuando la persona ya las sabe juntas — con las opciones de ocasión disponibles como atajo visual para quien prefiera tocar en vez de escribir, nunca como una pregunta obligatoria previa. Esto elimina un paso completo, no lo simplifica.

2. **Invertir la decisión de color: de pregunta previa a ajuste posterior opcional.** THÖREN elige un color con criterio propio (coherente con la ocasión y, si existe, con cualquier imagen o logo ya provisto) y lo muestra ya resuelto en la revelación. Solo después de ver el resultado, si Marcela quiere, puede pedir "pruébalo en otro tono" — nunca antes, y nunca como una pregunta que interrumpa el camino hacia el resultado.

3. **Diferir la pregunta de destino de impresión a después del momento de éxito.** El resultado de un minuto se entrega siempre con un archivo ya válido y de calidad (pensado por defecto para el caso más común: una pieza, lista para verse bien en pantalla o imprimirse en casa). La pregunta sobre producción en volumen se ofrece *después*, como una extensión natural ("¿quieres que prepare esto para imprimir muchas copias en una imprenta?") — nunca como una condición previa a obtener el primer resultado. Esto preserva el principio de "éxito en un minuto" incluso para quien sí necesita producción en volumen: primero tiene su resultado, y la conversación sobre logística ocurre desde un lugar de confianza ya ganada, no de trámite pendiente.

**Efecto neto:** el número de momentos donde Marcela debe detenerse a decidir algo baja de cinco a, esencialmente, dos irreducibles (qué necesita + quién es, fusionados en un solo gesto; y cuál propuesta prefiere) más un refinamiento verdaderamente opcional (color) y una extensión diferida (producción en volumen) que solo aparece para quien la necesita, después del éxito, nunca antes.

---

## 7. Qué no cambia (protecciones explícitas de la promesa central)

- El número de propuestas visuales que se muestran sigue siendo pequeño y curado — nunca se convierte en "pide lo que quieras y lo genero", que sería el camino hacia un editor de IA conversacional sin fin, exactamente lo que esta filosofía descarta como objetivo.
- El Modo Avanzado sigue existiendo únicamente para la minoría que de verdad lo necesita, y sigue sin filtrarse al flujo principal bajo ninguna circunstancia.
- El principio de "éxito en un minuto" sigue siendo el criterio de aceptación de cualquier cambio futuro — incluidas las tres mejoras propuestas arriba, que existen precisamente para protegerlo, no para relajarlo.

---

## Cierre

Esta filosofía queda establecida como el marco de decisión permanente para THÖREN, según lo solicitado. Los tres hallazgos de la sección 4 son los únicos cambios que esta auditoría respalda sobre `THOREN_EXPERIENCE_BLUEPRINT.md` — cualquier otro ajuste debería pasar primero por las mismas dos preguntas: ¿esto es una suposición inteligente en vez de un control?, y ¿esto elimina un paso en vez de solo simplificarlo?
