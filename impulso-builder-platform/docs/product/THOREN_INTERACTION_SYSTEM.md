# THÖREN 2.0 — Sistema de Interacción

**Fecha:** 2026-07-30
**Naturaleza de este documento:** un manual de comportamiento, no una especificación técnica. No hay pantallas, no hay componentes, no hay Figma, no hay valores de implementación. Define cómo se *comporta* THÖREN — cómo aparece, cómo responde, cómo se siente cada instante — para que cualquier diseñador o desarrollador pueda construir la interfaz visual leyendo únicamente esto.
**Estado de las bases:** `THOREN_PRODUCT_EXPERIENCE_AUDIT.md`, `THOREN_VISION_2.md`, `THOREN_PRODUCT_PHILOSOPHY.md` y `THOREN_EXPERIENCE_BLUEPRINT.md` quedan congelados como la base oficial de THÖREN 2.0. Este documento no reabre ninguna de sus decisiones — traduce la filosofía y el guion ya aprobados a reglas de comportamiento. No agrega funciones, no modifica el recorrido, no cambia la visión.
**Regla de justificación:** cada regla de este documento debe poder explicarse citando la Product Philosophy ("la experiencia de trabajar con el mejor diseñador del mundo, condensada en un minuto"; simplicidad y suposición inteligente por defecto) o un instante específico del Experience Blueprint (el recorrido de Marcela). Ninguna regla existe porque "así se hace normalmente en software de diseño" — esa es, de hecho, exactamente el tipo de razón que este documento existe para rechazar.

---

## El principio detrás de todos los demás

Un diseñador experto real, trabajando frente a un cliente, nunca hace ruido innecesario: no anuncia cada paso, no pide confirmación de cosas obvias, no interrumpe su propio trabajo para explicar el proceso. Trabaja con calma, muestra avances reales en vez de promesas de avance, y reserva su momento de mayor intensidad para el instante en que de verdad importa: cuando entrega el resultado.

Todo el sistema de interacción de THÖREN existe para imitar ese comportamiento, nunca el de un programa que necesita mantener informado a su usuario de cada operación interna que realiza.

---

## 1. Cómo aparece cada pantalla

Ninguna pantalla "aparece" como una unidad nueva — cada momento emerge como una continuación directa del anterior, nunca como un reemplazo. Cuando Marcela termina de contar en una frase qué necesita (Blueprint, 0:10), lo que sigue no es "una pantalla nueva de resultados" sustituyendo a la anterior — es el mismo espacio donde ella acaba de hablar, transformándose para mostrarle lo que su frase generó. La sensación debe ser la de estar todavía en la misma conversación, nunca la de haber sido enviada a otro lugar.

*Justificación:* la Product Philosophy exige "la experiencia de trabajar con el mejor diseñador", y un diseñador real no hace que su cliente cambie de sala cada vez que hay una novedad — sigue frente a él, mostrándole cosas nuevas en el mismo lugar.

## 2. Cómo desaparece cada pantalla

Nada desaparece de golpe ni se queda estorbando más de lo necesario. Lo que ya cumplió su función se retira dando espacio a lo que sigue — nunca con un cierre que se sienta como descartar algo (como cerrar una ventana), sino como un paso que ya se dio y que ahora cede el lugar al siguiente. La pregunta inicial de intención, por ejemplo, no se "cierra" cuando Marcela responde — se retira suavemente mientras las primeras propuestas ya empiezan a ocupar su lugar (Blueprint, 0:10 → 0:14): las dos cosas ocurren como una sola transición continua, no como salir de una pantalla y entrar a otra.

*Justificación:* Blueprint, la instrucción de lectura ("si aparece la tentación de nombrar un botón o una pantalla, nos adelantamos") — el comportamiento de desaparición debe reforzar que nunca hubo "pantallas" separadas, solo un mismo momento evolucionando.

## 3. Qué transiciones existen

Solo tres tipos de transición existen en todo el producto, y cada una tiene un único trabajo:

- **Continuación:** algo que Marcela ya generó (una palabra, una elección) se transforma directamente en su siguiente forma, en el mismo lugar de la pantalla donde ella actuó. Es la transición más frecuente de todo el producto — cubre casi todo el recorrido (0:10 → 0:14, 0:26 → 0:29).
- **Acompañamiento:** una transición breve y discreta que ocurre mientras el sistema está resolviendo algo en segundo plano (ver punto 7) — nunca llama la atención sobre sí misma, solo sostiene la sensación de que algo real está en curso.
- **Revelación:** una transición reservada, deliberadamente distinta de todas las demás — con una pausa un poco más larga antes de ocurrir, y un despliegue más generoso una vez que ocurre. Existe en un único instante de todo el recorrido: la entrega del resultado terminado (Blueprint, 0:36). No se repite en ningún otro momento del producto, ni siquiera en una versión más pequeña.

*Justificación:* la Product Philosophy exige preservar "el éxito de un minuto a toda costa" — repetir la transición de revelación en otros momentos (por ejemplo, al elegir una propuesta) le robaría intensidad al único instante donde de verdad debe sentirse como un logro, y convertiría un clímax en una decoración repetida.

## 4. Qué animaciones comunican progreso

Ninguna. THÖREN nunca muestra una animación cuyo único propósito sea decir "espera, estoy trabajando" de forma abstracta (una barra que avanza sin relación con nada real, un ícono que gira sin decir qué está pasando). El progreso siempre se comunica mostrando el trabajo real a medida que existe: las propuestas del segundo 0:14 no aparecen después de una espera vacía — ellas mismas, apareciendo una tras otra, son la evidencia de que algo está sucediendo. Ver avance real siempre reemplaza a anunciar que hay avance.

*Justificación:* Blueprint, nota de dirección 10 ("Haciendo visible el trabajo, no el proceso") — y el principio de suposición inteligente de la Philosophy: mostrar un símbolo abstracto de carga es, en el fondo, pedirle confianza al usuario sin dársela; mostrar el trabajo real se la da directamente.

## 5. Qué elementos pueden moverse

Solo lo que Marcela está tocando o mirando directamente en ese instante: el texto mientras lo escribe, la propuesta que está recorriendo, la pieza elegida mientras se transforma con un tono distinto. El movimiento siempre tiene una causa visible e inmediata — algo que ella acaba de hacer.

## 6. Qué elementos nunca deben moverse

El lugar donde Marcela está actuando —donde escribe, donde elige, donde ve el resultado— nunca cambia de posición en la pantalla sin que ella lo haya causado. Nada se desplaza, reordena o reubica por iniciativa del sistema mientras ella no ha hecho nada. Una vez que la pieza elegida ocupa su lugar central para la revelación (0:36), permanece exactamente ahí — puede transformarse, nunca desplazarse.

*Justificación:* la Product Philosophy exige "reducir la carga cognitiva al mínimo" (Blueprint, nota 8) — el movimiento no causado por el usuario es, precisamente, el tipo de sorpresa que exige atención y esfuerzo de reorientación, lo opuesto a calma.

## 7. Cómo responde el sistema mientras está pensando

Existen dos formas de "pensar", y cada una se comporta distinto:

- **Reacción inmediata** (mientras escribe, mientras recorre propuestas): no hay pensamiento visible en absoluto — la respuesta es tan rápida que se siente como parte del mismo gesto, nunca como una consecuencia posterior.
- **Preparación real** (el instante entre que Marcela termina su frase y las primeras propuestas aparecen, 0:10 → 0:14): existe una pausa breve, perceptible pero corta, durante la cual ya empieza a insinuarse algo real llegando —nunca una pantalla en blanco, nunca un símbolo abstracto de espera— sino el principio visible de lo que ya viene, como si alguien empezara a mostrar un trazo antes de completar el dibujo.

En ningún caso el sistema queda en silencio total durante más de un instante sin dar ninguna señal de que sigue presente.

*Justificación:* Blueprint, nota de dirección 7 ("cada segundo de espera... está lleno de evidencia de trabajo real en curso, nunca de silencio").

## 8. Cómo aparecen las propuestas

Una tras otra, con un ritmo calmado y parejo — nunca todas de golpe (se sentiría como un volcado de datos) ni con pausas largas entre una y otra (se sentiría como que algo está fallando). Cada propuesta aparece ya completa, nunca construyéndose por partes frente a Marcela — ella nunca ve un boceto llenándose, ve resultados terminados llegando uno después de otro. Ninguna propuesta se marca como "recomendada" ni se distingue de las demás con ninguna insignia o énfasis — todas se presentan con la misma confianza, porque la elección de cuál es mejor le pertenece únicamente a ella (Blueprint, 0:20).

*Justificación:* Philosophy, "elige la suposición inteligente" cubre la calidad pareja de las propuestas (THÖREN ya hizo el trabajo de que todas sean buenas); pero cuál gusta más es el único punto de flexibilidad real que la Philosophy protege explícitamente — señalarle a Marcela cuál "recomienda" el sistema contaminaría esa libertad.

## 9. Cómo se revela el resultado

Con una pausa deliberadamente más larga que cualquier otra del producto justo antes de que ocurra, y con el resultado ocupando, al aparecer, más espacio y más presencia que cualquier otro elemento visto hasta ese momento — nada compite con él en ese instante. Ninguna acción, texto o elemento secundario aparece al mismo tiempo que la revelación misma; todo lo demás (la única acción de obtener el resultado) llega un instante después, nunca simultáneamente.

*Justificación:* Blueprint, 0:36 ("el clímax emocional de todo el recorrido, y nada lo interrumpe justo antes"). Este es el único momento del producto donde la intensidad es intencional y máxima — precisamente porque en todos los demás instantes el sistema elige la calma, este contraste es lo que hace que la revelación se sienta como un verdadero logro y no como un paso más.

## 10. Cómo se siente cada interacción

- **Escribir** se siente escuchado: cada palabra tiene una consecuencia visible casi inmediata, nunca una demora que la haga dudar si el sistema la registró.
- **Elegir una propuesta** se siente como una decisión tomada con gusto propio, no como seleccionar una opción de una lista — lo elegido se asienta en su lugar con calma, nunca con un marco o contorno abrupto que grite "seleccionado".
- **Pedir un ajuste opcional** (probar otro tono) se siente reversible y ligero, como jugar, nunca como configurar — el cambio ocurre de inmediato y puede deshacerse con la misma facilidad, sin ceremonia.
- **Obtener el resultado** se siente ganado, no descargado — el instante final es pausado, no apresurado, dando espacio a que el logro se sienta antes de pasar a cualquier otra cosa.

## 11. Qué microinteracciones generan sensación de calidad

Las más pequeñas, no las más vistosas. La transformación del texto que Marcela escribe en la tipografía ya resuelta del diseño (0:14) es, en sí misma, la microinteracción más importante de todo el producto — sentir que sus propias palabras se vuelven parte de algo hermoso, en tiempo real. El asentamiento suave de cualquier cosa que se vuelve "definitiva" (una propuesta elegida, el resultado final) comunica cuidado sin necesitar ningún adorno adicional. La capacidad de probar un tono distinto y verlo reaccionar al instante, de forma reversible, comunica confianza sin exigir ninguna configuración. Ninguna de estas microinteracciones necesita ruido, celebración exagerada, ni un efecto que llame la atención sobre sí mismo — la calidad se siente en lo bien resuelto de lo pequeño, no en lo grande de lo añadido.

*Justificación:* `THOREN_VISION_2.md`, sección 14 ("Ritmo pausado y silencioso: transiciones que dan la sensación de calidad por su suavidad, no por su cantidad — menos animaciones, mejor ejecutadas").

## 12. Qué feedback recibe el usuario después de cada acción

El estado mismo es la confirmación — nunca un aviso aparte que haya que leer para saber si algo funcionó. Cuando Marcela elige una propuesta, el hecho de verla asentarse como la protagonista de la pantalla ya le confirma que su elección se registró; no necesita un mensaje que se lo diga con palabras. Cuando obtiene su resultado, tenerlo ya frente a ella es la confirmación completa. Puede existir, como mucho, una frase breve y humana acompañando un cambio de estado importante (por ejemplo, al terminar de obtener el archivo) — pero nunca como la única señal, siempre como un complemento silencioso a algo que el propio estado visual ya demostró.

*Justificación:* Product Philosophy — "prefer intelligent assumption over exposing controls" se extiende naturalmente a "prefer que el estado se explique solo, sobre exponer notificaciones que expliquen el estado".

## 13. Qué principios gobiernan todas las interacciones

- **Continuidad, nunca corte.** Ninguna transición se siente como cambiar de lugar — todo ocurre en el mismo espacio de conversación (regla 1, 2).
- **Una sola invitación a la vez.** En cualquier instante, solo una acción posible reclama la atención de Marcela — nunca dos decisiones compitiendo al mismo tiempo (regla 4 del Sistema, y Philosophy §6 "eliminar el 80% de la complejidad").
- **El trabajo se ve, nunca se anuncia.** El progreso siempre se demuestra con resultados reales apareciendo, jamás con símbolos abstractos de espera (regla 4, 7).
- **Nada se mueve sin causa.** Todo movimiento en pantalla responde a algo que Marcela acaba de hacer (regla 5, 6).
- **El silencio es una señal de calidad, no de fallo.** Los espacios en blanco, las pausas breves y la ausencia de ruido visual comunican confianza, no desatención (regla 11, y Vision 2 §14).
- **La revelación se reserva.** Existe un único momento de máxima intensidad en todo el producto, y su poder depende de que nunca se repita en otro lugar (regla 3, 9).
- **Siempre reaccionar a algo concreto, nunca preguntar por algo abstracto.** Ninguna interacción le pide a Marcela imaginar un resultado que todavía no existe — todo lo que se le ofrece ajustar ya está mostrado primero (Philosophy §4.B, Blueprint 0:29).
- **Toda decisión logística vive después del éxito, nunca antes.** Ninguna interacción con sabor técnico o de producción se interpone entre el gusto personal de Marcela y el momento en que ya tiene su resultado (Philosophy §4.C, Blueprint 0:36 → 0:52).

## 14. Qué cosas están prohibidas

- Barras de progreso o símbolos de carga abstractos que no muestren nada real detrás.
- Ventanas o superposiciones apiladas unas sobre otras compitiendo por atención — nunca más de una invitación a la vez.
- Notificaciones flotantes o avisos que interrumpan lo que Marcela está viendo para anunciar algo que el propio estado ya comunica.
- Cualquier palabra técnica de proceso ("cargando", "procesando", "sincronizando", "validando") en cualquier mensaje visible durante el recorrido principal.
- Movimiento decorativo o ambiental que no responda a ninguna acción del usuario — nada se mueve "porque se ve bien", todo se mueve porque algo lo causó.
- Insignias, etiquetas o jerarquías visuales que le digan a Marcela cuál propuesta "recomienda" el sistema — la elección de gusto le pertenece completamente a ella.
- Repetir la transición de revelación (regla 3) en cualquier otro momento del producto, sin importar cuán "logrado" se sienta ese otro momento — diluye el único clímax real.
- Fingir trabajo que no está ocurriendo: ninguna pausa se alarga artificialmente para "parecer más sofisticada" — el ritmo calmado que este documento pide es honesto con el tiempo real que toma cada cosa, nunca una demora fabricada para dar teatro.
- Cualquier interacción que exija a Marcela describir o imaginar algo abstracto (un color, un estilo) antes de que exista algo concreto que ver — se prohíbe explícitamente, no solo se desalienta.

## 15. Cómo garantizar que la aplicación siempre transmita calma, rapidez y confianza

Aplicando la misma "gramática" de comportamiento en todo el producto, sin excepciones puntuales: la misma manera de aparecer, de responder mientras piensa, de dar feedback, se repite de forma reconocible en cada instante del recorrido, para que Marcela nunca tenga que reaprender cómo se comporta THÖREN de una pantalla a otra. La calma se protege reservando la intensidad para un único instante (la revelación) — todo lo demás puede permitirse ser tranquilo precisamente porque no está compitiendo por ser el momento más importante. La rapidez se transmite mostrando siempre trabajo real en curso, nunca símbolos de espera vacíos. Y la confianza se construye evitando, en cada regla de este documento, cualquier interacción que le pida a Marcela algo que un diseñador experto real jamás le pediría a un cliente: adivinar, imaginar en abstracto, o esperar sin saber por qué.

---

## Cierre

Este documento no introduce ninguna decisión nueva de producto — traduce lo ya aprobado en `THOREN_PRODUCT_PHILOSOPHY.md` y `THOREN_EXPERIENCE_BLUEPRINT.md` a un lenguaje de comportamiento que cualquier persona que vaya a construir la interfaz pueda seguir sin ambigüedad. Cuando llegue el momento de diseñar pantallas, componentes y visuales, cada elección visual debería poder justificarse señalando una regla concreta de este documento — y cada regla de este documento, a su vez, debería poder justificarse señalando una frase de la Philosophy o un instante del Blueprint. Esa cadena de justificación, de principio a fin, es lo que convierte una interfaz bonita en una experiencia coherente.
