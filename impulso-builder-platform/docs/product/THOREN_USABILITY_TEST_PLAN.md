# THÖREN 2.0 — Plan de Prueba de Usabilidad

**Fecha:** 2026-07-30
**Naturaleza de este documento:** un protocolo operativo de validación, no un documento conceptual. No reabre ni modifica `THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`, `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md` ni `THOREN_INTERACTION_SYSTEM.md` — todos siguen congelados como fuente de verdad. Este documento existe para descubrir, con evidencia real, si el prototipo navegable cumple lo que esos documentos prometen.
**A quién sirve:** cualquier persona del equipo debe poder tomar este documento, sentar a un participante frente al prototipo, y obtener información útil sin necesitar contexto adicional ni criterio propio sobre diseño de producto.

---

## 1. Objetivo de la prueba

**Lo que sí queremos validar:** si la experiencia cumple la promesa del producto — *"Obtén un diseño profesional en menos de un minuto"* — y si transmite, sin explicación de por medio, la sensación de que un diseñador experto ya hizo el trabajo. Concretamente, buscamos evidencia sobre tres preguntas raíz:

1. ¿La persona entendió qué hace THÖREN sin que nadie se lo explicara?
2. ¿La persona sintió, en algún momento observable, que el sistema ya resolvió el problema por ella — y no al revés?
3. ¿La persona buscó editar, y de ser así, qué pasó después: se dio cuenta de que no hacía falta, o se quedó con la sensación de que algo le faltaba?

Esta tercera pregunta es la más importante de las tres. El momento *"el usuario buscó editar… y descubrió que ya no hacía falta"* es el instante que define si Concepto E está funcionando de verdad o si solo se ve bien en un prototipo que nadie ha probado.

**Lo que NO queremos validar:** si la interfaz "les gusta", si el color les parece bonito, si cambiarían una palabra por otra, o si tienen sugerencias de funciones nuevas. Ninguna opinión estética o de preferencia personal es el objetivo de esta prueba — son ruido frente a la pregunta real, que es si la experiencia cumple su promesa.

---

## 2. Perfil de participantes

Al menos tres perfiles, cada uno probado con varios participantes (idealmente 3 a 5 por perfil — es suficiente para que los problemas de fondo se repitan y se distingan de una reacción individual aislada).

**Perfil 1 — Persona sin conocimientos de diseño.**
Nunca ha usado Canva, Photoshop, Illustrator ni ninguna herramienta similar. Escenario a plantear: *"Imagina que necesitas un diseño para algo personal tuyo — una celebración, un regalo, algo tuyo de verdad. Resuélvelo como si lo necesitaras hoy."*

**Perfil 2 — Persona que usa Canva con regularidad.**
Ya tiene el reflejo de "entrar a editar" instalado por costumbre. Escenario a plantear: *"Imagina que necesitas resolver exactamente lo mismo que sueles resolver en Canva, pero en esta herramienta que no conoces."*

**Perfil 3 — Dueño de un pequeño negocio que necesita imprimir etiquetas.**
Tiene una necesidad real y práctica, y poca paciencia por herramientas que no van directo al grano. Escenario a plantear: *"Imagina que necesitas etiquetas reales para tu negocio, de las que vas a mandar a imprimir esta semana."*

Cada escenario se entrega en una sola frase, oral, antes de empezar — nunca por escrito, nunca con más detalle del que aquí se da.

---

## 3. Preparación

**Qué decir antes de comenzar** (guion base, adaptable únicamente en el nombre del escenario según el perfil):

> "Vamos a probar una aplicación que estamos desarrollando. Te voy a pedir que imagines una situación real y que uses la aplicación como si de verdad la necesitaras hoy. No hay una forma correcta o incorrecta de usarla — lo que hagas y lo que pienses en el camino es exactamente lo que nos sirve. Si en algún momento piensas algo en voz alta, mejor. Yo no voy a poder ayudarte ni guiarte mientras la usas — eso es a propósito, no es descortesía. Cuando sientas que terminaste, dímelo."

Después de esto, se entrega el escenario del perfil correspondiente (sección 2), en una sola frase, y se le entrega el dispositivo con el prototipo ya abierto en la pantalla inicial.

**Qué jamás decir ni revelar, bajo ninguna circunstancia:**

- El nombre de ningún concepto de diseño ("Concepto E", "La Conversación", "La Galería", "El Estudio").
- Cualquier palabra de la Product Philosophy o del Experience Blueprint ("suposición inteligente", "revelación", "eliminar la edición", "menos de un minuto").
- Que la ausencia de herramientas de edición es intencional.
- Que se espera un momento de sorpresa o "wow" en algún punto específico.
- Que este es un prototipo de validación de experiencia y no el producto final (si preguntan directamente, ver sección 4).
- Comparaciones explícitas con Canva, Figma o cualquier otra herramienta, salvo que el propio participante las mencione primero.

Revelar cualquiera de estos puntos invalida la sesión — el participante dejaría de reaccionar de forma natural y empezaría a decirle al moderador lo que cree que quiere escuchar.

---

## 4. Guion del moderador

**Las únicas frases permitidas antes de iniciar** son las de la sección 3, más el escenario correspondiente al perfil. Nada adicional, sin importar cuánto silencio incómodo genere no explicar más.

**Cómo responder si el participante hace preguntas mientras usa el prototipo:**

- *"¿Estoy haciendo esto bien?"* → "Haz lo que te parezca natural. No hay una forma correcta."
- *"¿Qué se supone que tengo que hacer aquí?"* → "Lo que tú harías si de verdad estuvieras resolviendo esto."
- *"¿Puedo tocar esto?"* (señalando algo) → "Prueba y descúbrelo." (nunca confirmar ni negar de antemano qué es interactivo)
- *"¿Esto ya está? ¿ya terminé?"* → "¿Tú sientes que ya terminaste?" (devolver la pregunta, nunca confirmar el estado del sistema)
- Cualquier pregunta sobre qué es THÖREN, cómo funciona por dentro, o si esto reemplaza a otra herramienta → "Eso te lo cuento con calma al final, ahora prefiero ver cómo lo vives tú."

**Cómo evitar ayudar, incluso sin querer:**

- No señalar con la mirada ni con el dedo hacia ningún elemento de la pantalla.
- No repetir en voz alta lo que el participante ya está viendo ("mira, ahí aparece algo") — eso ya es guiar.
- No llenar los silencios. Un participante en silencio mirando la pantalla está pensando, no está atascado — solo se considera una posible señal de atasco real después de 60-90 segundos sin ninguna acción ni comentario, y en ese caso la única intervención permitida es: *"¿Qué estás pensando en este momento?"* — nunca una pista sobre qué hacer.
- No corregir si el participante hace algo que no tiene efecto (por ejemplo, intenta arrastrar algo que no se mueve) — eso es exactamente el tipo de dato que esta prueba necesita registrar, no corregir.
- Si el participante pide ayuda de forma explícita y directa ("de verdad no sé qué hacer, ayúdame") — se permite una única intervención mínima y neutral: *"¿Qué es lo primero que ves en la pantalla?"* — nunca una instrucción de acción concreta. Registrar que hubo intervención y en qué punto exacto ocurrió.

---

## 5. Observación

Registrar en tiempo real, sin interrumpir. Usar la plantilla de la sección 9 para anotar, con marca de tiempo aproximada, cada una de estas señales cuando ocurra:

- Dónde duda (se detiene sin tocar nada durante varios segundos).
- Qué intenta tocar que no es interactivo (un indicio directo de que esperaba un control que no existe).
- Cuándo sonríe, se ríe, o hace un gesto de sorpresa visible.
- Cuándo se detiene por completo (deja de interactuar sin decir que terminó).
- Cuándo parece confundido (frunce el ceño, relee algo, mueve el cursor sin rumbo).
- Cuándo pierde paciencia (suspira, dice "ya", acelera los toques, mira al moderador buscando ayuda).
- Cuándo aparece una expresión de sorpresa genuina (distinta de la sonrisa social — buscar el gesto físico: cejas levantadas, inclinarse hacia la pantalla, exclamación corta involuntaria).
- Cualquier comentario espontáneo dicho en voz alta, capturado lo más literal posible entre comillas — estas frases valen más que cualquier resumen del observador.
- El instante exacto (aproximado) en el que llega a la revelación, y cualquier reacción física visible en ese momento específico — es el dato más importante de toda la sesión.
- El instante en el que obtiene su resultado, y si dice o hace algo al respecto sin que se le pregunte.

---

## 6. Preguntas posteriores

Muy pocas. Abiertas. Nunca dirigidas. En este orden, sin agregar ninguna otra salvo que surja de una respuesta anterior:

1. ¿Qué crees que hizo THÖREN?
2. ¿Qué momento recuerdas más?
3. ¿Hubo algún instante donde sentiste que faltaba algo?
4. ¿En qué momento sentiste más confianza?
5. ¿Hubo algo que quisieras hacer y no pudiste?
6. Si mañana necesitaras una etiqueta o un diseño real de verdad... ¿volverías a abrir THÖREN? ¿Por qué?

Ninguna pregunta debe mencionar palabras como "edición", "conversación", "propuestas", "revelación" o "sorpresa" — si el participante las usa primero, se pueden retomar con sus propias palabras, nunca introducirlas nosotros.

---

## 7. Criterios de éxito

Marcar cada uno como observado o no observado, por sesión:

- Entendió la propuesta (qué hace THÖREN) sin ninguna explicación previa.
- Llegó al resultado final sin ninguna intervención del moderador.
- Recordó espontáneamente el momento de revelación al preguntarle "¿qué momento recuerdas más?" (pregunta 2), sin que se le insinuara.
- No preguntó, en ningún momento, por herramientas de edición (mover, cambiar fuente, cambiar tamaño, deshacer).
- Expresó sorpresa de forma espontánea y observable (gesto físico o comentario en voz alta), no inducida por el moderador.
- Expresó confianza de forma espontánea (por ejemplo, avanzó sin dudar hacia la acción final, o lo dijo con sus propias palabras al responder la pregunta 4).
- Dijo, sin que se le preguntara directamente "¿pagarías por esto?", algo equivalente a que usaría THÖREN de nuevo (pregunta 6).

**Métrica cuantitativa complementaria:** tiempo real, en segundos, desde que abre el prototipo hasta que obtiene su resultado. Un tiempo consistentemente cercano o menor a un minuto, across varios participantes de un mismo perfil, es evidencia a favor de la promesa central del producto — un tiempo consistentemente mayor, incluso si el participante quedó satisfecho, es una señal a investigar (aunque no necesariamente un fracaso por sí sola, ver sección 10).

---

## 8. Criterios de fracaso

Cualquiera de estas señales, si se repite entre participantes (ver umbral en la sección 10), indica que la filosofía del producto no se está transmitiendo:

- Intenta buscar activamente un editor (busca un lienzo, una barra de herramientas, un lugar para "entrar" al diseño).
- Pregunta dónde cambiar la fuente, el color o el tamaño de algo.
- Pregunta dónde mover o reorganizar elementos.
- Piensa, y lo dice, que el sistema está incompleto o que "le falta terminar de construirse".
- Interpreta a THÖREN como un chatbot de servicio al cliente (espera respuestas conversacionales continuas, hace preguntas de soporte, trata la conversación inicial como un chat permanente).
- No logra explicar, ni siquiera vagamente, qué hizo THÖREN por él o ella al responder la pregunta 1.
- Llega al final del recorrido sin ninguna reacción observable (ni gesto, ni comentario) en el momento de la revelación.
- No relaciona la ausencia de edición con "ya está bien resuelto", sino con "esto no me deja hacer lo que quiero".

---

## 9. Plantilla de registro de hallazgos

Una plantilla por sesión. Copiar esta estructura para cada participante:

```
SESIÓN — THÖREN Usability Test
Fecha:
Moderador:
Participante (perfil): [ ] Sin conocimientos de diseño  [ ] Usa Canva  [ ] Dueño de negocio
Escenario entregado (una frase):
Dispositivo / navegador usado:

TIEMPOS OBSERVADOS
Hora de inicio:
Momento en que responde la conversación inicial:
Momento en que aparece la primera propuesta:
Momento en que elige una propuesta:
Momento de la revelación:
Momento en que obtiene el resultado:
Hora de fin:
Duración total:

INTERVENCIONES DEL MODERADOR (idealmente ninguna)
¿Hubo alguna intervención? [ ] No  [ ] Sí — ¿en qué punto y por qué?:

SEÑALES OBSERVADAS (marcar y anotar el instante aproximado)
[ ] Dudó — ¿dónde?
[ ] Intentó tocar algo no interactivo — ¿qué?
[ ] Sonrió / gesto de sorpresa — ¿cuándo?
[ ] Se detuvo sin avisar — ¿dónde?
[ ] Mostró confusión — ¿en qué momento?
[ ] Mostró impaciencia — ¿en qué momento?
[ ] Expresión de sorpresa genuina en la revelación — describir:

CITAS TEXTUALES (lo más literal posible)


RESPUESTAS A LAS PREGUNTAS POSTERIORES
1. ¿Qué crees que hizo THÖREN?
2. ¿Qué momento recuerdas más?
3. ¿Hubo algún instante donde sentiste que faltaba algo?
4. ¿En qué momento sentiste más confianza?
5. ¿Hubo algo que quisieras hacer y no pudiste?
6. ¿Volverías a abrir THÖREN? ¿Por qué?

CRITERIOS DE ÉXITO (marcar los observados)
[ ] Entendió sin explicación
[ ] Llegó al resultado sin ayuda
[ ] Recordó la revelación espontáneamente
[ ] No preguntó por edición
[ ] Sorpresa espontánea
[ ] Confianza espontánea
[ ] Diría que volvería a usarlo

CRITERIOS DE FRACASO (marcar los observados)
[ ] Buscó un editor
[ ] Preguntó por cambiar fuente/color/tamaño
[ ] Preguntó por mover elementos
[ ] Pensó que estaba incompleto
[ ] Lo interpretó como chatbot
[ ] No pudo explicar qué hizo THÖREN
[ ] Sin reacción visible en la revelación

NOTA LIBRE DEL MODERADOR (cualquier cosa inesperada, sin filtrar)
```

---

## 10. Regla final

**Queda prohibido modificar el prototipo o el producto entre una sesión y la siguiente.** Primero se completan todas las sesiones planeadas de los tres perfiles. Solo después se analizan los patrones en conjunto.

**Qué cuenta como patrón que sí justifica un cambio** (y qué no):

- Un hallazgo de la sección 8 (criterio de fracaso) que aparece en **al menos dos participantes de un mismo perfil**, o en **participantes de dos perfiles distintos**, se considera un patrón real y amerita revisión.
- Un hallazgo observado en un único participante, sin importar cuán llamativo parezca en el momento, **no** justifica ningún cambio por sí solo — se registra, se guarda, y se compara contra el resto de las sesiones antes de actuar.
- Ninguna sugerencia de función nueva hecha por un participante se implementa directamente — se registra como dato, y solo se considera si, de forma independiente, aparece la misma necesidad de fondo (no la misma solución sugerida) en varios perfiles distintos.

El objetivo de esta fase no es corregir el prototipo sesión por sesión — es reunir evidencia completa antes de decidir nada. Diseñar en respuesta a la reacción de una sola persona es exactamente el tipo de iteración impulsiva que esta fase existe para evitar. Solo cuando todas las sesiones estén completas y los patrones sean visibles en conjunto, se decide qué — si acaso algo — necesita cambiar.
