# THÖREN 2.0 — Manifiesto de Producto

**Fecha:** 2026-07-30
**Naturaleza de este documento:** visión, no implementación. Sin código, sin wireframes, sin componentes. Esto define el alma del producto antes de que exista una sola pantalla.
**Origen:** reinvención completa a partir de `THOREN_PRODUCT_EXPERIENCE_AUDIT.md`. No es una evolución de la interfaz actual — es la pregunta de qué construiríamos si empezáramos hoy, sin ninguna atadura a lo que ya existe.

---

## La única condición

**No puede parecer otro editor.**

Todo lo que sigue existe para servir esa condición. Cada vez que una idea empiece a sonar a "herramienta de diseño con más pasos", es la idea equivocada, sin importar cuánto sentido técnico tenga.

## La nueva promesa

No es "Diseña etiquetas." Es:

**"Obtén un diseño profesional en menos de un minuto."**

Esa frase no es una tagline de marketing — es un criterio de diseño. Cualquier pantalla, paso o decisión que no acerque a esa promesa se elimina, sin excepción y sin nostalgia por el trabajo ya invertido en construirla.

---

## 0. Quién es realmente nuestro usuario

Antes de responder las 15 preguntas, hay que ser honestos sobre quién abre THÖREN:

No es un diseñador. No quiere aprender una herramienta. No sabe ni quiere saber qué es un sangrado, una imposición o una línea de troquel. Tiene una boda en tres semanas, un pedido de Etsy que despachar mañana, o un negocio pequeño que necesita verse cuidado. Su estado emocional al abrir la app es **impaciencia productiva**: quiere terminar, no crear.

Esto cambia todo. THÖREN no compite por atención creativa (Canva, Figma, Illustrator, Affinity ya ganaron esa categoría y no vale la pena pelearla). THÖREN compite por **tiempo devuelto** y **confianza en el resultado**. Es más parecido a pedirle un sello personalizado a un artesano de confianza que a abrir un programa de diseño: le dices quién eres, y un rato después tienes algo hermoso en las manos, sin haber tocado una sola herramienta.

---

## 1. La experiencia ideal, de abrir a exportar

Contada como una historia, no como una lista de pantallas:

Alguien abre THÖREN. No ve un menú, no ve un párrafo explicando qué es la app, no ve una pantalla vacía de "Mis proyectos". Ve, de inmediato, una sola pregunta con cara humana: **"¿Para qué necesitas esto hoy?"** — con opciones grandes, fotográficas, con nombres de la vida real: "Para mi boda", "Para mi marca", "Para un regalo hecho a mano", "Para mi negocio". Cada opción ya se ve terminada, como una revista, no como un ícono de sistema.

Elige una. THÖREN pregunta lo mínimo indispensable para hacerlo personal — su nombre, o el de su marca, quizás una fecha, quizás un color que le guste — nada más, una cosa a la vez, como una conversación breve, nunca un formulario con muchos campos a la vez.

Mientras responde, THÖREN ya le está mostrando, en tiempo real, cómo se ve. No al final. Durante. Cada palabra que escribe aparece bellamente tipografiada en varias propuestas visuales ya listas, como si un diseñador estuviera trabajando en vivo frente a él, aunque no haya ningún diseñador ni ninguna decisión de diseño de por medio — todo lo resolvió el sistema.

Elige la propuesta que más le guste, entre pocas opciones, todas ya buenas (nunca entre una tabla de configuraciones). Puede ajustar una o dos cosas más si quiere (un color, un tono), pero nunca se le pide que abra un lienzo, mueva un objeto, o entienda un panel de propiedades.

Presiona un solo botón: **"Obtener mi diseño."** No elige perfil de exportación, no configura imposición, no ve la palabra "sangrado". THÖREN ya sabe, por la ocasión que eligió al principio, si esto probablemente se va a imprimir en casa, a mandar a una imprenta, o a compartir en redes — y prepara el archivo correcto en silencio. Si de verdad necesita elegir (por ejemplo, "esto lo voy a mandar a imprimir en volumen"), se le pregunta con una sola frase en lenguaje humano, nunca con un dropdown técnico.

Ve su resultado en una pantalla de revelación — grande, con orgullo, como el desenlace de algo, no como una notificación de estado. Lo descarga. Termina.

De principio a fin: **tres momentos, no siete pasos.** Elegir. Personalizar. Obtener.

---

## 2. Los primeros 30 segundos

Nada de bienvenida explicada en prosa. Nada de "Mis proyectos" vacío. Los primeros 30 segundos son ya la primera pregunta real (“¿Para qué necesitas esto hoy?”) respondida con opciones grandes y hermosas — y para el segundo 15, la persona ya está viendo su propio nombre apareciendo en un diseño que no hizo ella pero que ya se siente suyo.

Lo que debería sentir: sorpresa de que algo tan bonito reaccionara tan rápido a algo tan simple como escribir su nombre. Ninguna fricción de aprendizaje — cero curva. La sensación es "esto ya me entendió", no "tengo que entender esto".

---

## 3. Lo que desaparece por completo

Sin excepciones, sin versión reducida, directamente fuera del producto por defecto:

- El toolbar de comandos de edición (Deshacer, Rehacer, Agrupar, Desagrupar, Duplicar, etc.) — desaparece de la experiencia principal. Existe, si acaso, solo dentro de un Modo Avanzado opcional.
- El inspector de propiedades (posición, tamaño, rotación, opacidad por objeto) — desaparece. El usuario nunca elige "X: 45, Y: 12".
- El panel de capas — desaparece. Nadie que "quiere terminar" piensa en términos de capas.
- El lienzo libre de manipulación directa (arrastrar, redimensionar handles, multi-selección) — desaparece como experiencia por defecto.
- El wizard de exportación de 7 pasos — desaparece por completo como camino único. Se reemplaza por un solo botón con una decisión binaria oculta detrás ("¿es para imprimir en volumen?").
- Todo el vocabulario técnico de imprenta expuesto por defecto: sangrado, TrimBox, imposición, gap, cut path, marcas de corte. Ninguna de estas palabras debería aparecer jamás en la experiencia principal.
- La galería de plantillas como cuadrícula de miniaturas pequeñas — desaparece como formato. Se reemplaza por una experiencia de selección grande, secuencial, casi editorial.
- El modal de bienvenida explicativo — desaparece. La primera pantalla ya es la primera pregunta útil.
- La pantalla de "Mis proyectos" vacía como destino por defecto — desaparece como primera parada; solo tiene sentido como un lugar al que se llega después, para alguien que regresa.

Si hay que poner un número: de la interfaz actual, sobrevive el 100% del motor técnico de impresión (PDF exacto, sangrado, imposición, marcas de corte) — pero como una capa completamente invisible al servicio del resultado. De la **interfaz de edición** tal como existe hoy (toolbar, inspector, lienzo manipulable, wizard de 7 pasos), sobrevive prácticamente nada: quizás un 5-10%, únicamente como los cimientos técnicos escondidos detrás de un "Modo Avanzado" opcional para el minoría de usuarios que sí necesitan control fino. La experiencia principal se construye de cero.

---

## 4. Lo que THÖREN decide automáticamente

Todo lo que es ejecución técnica, no identidad personal:

- Composición, alineación, jerarquía y espaciado del diseño.
- Pareja tipográfica y tamaños relativos de cada texto.
- Armonía de color (si el usuario sube una foto o un logo, THÖREN extrae y propone una paleta coherente).
- Escalado y ajuste al tamaño físico correspondiente al material elegido.
- Sangrado, marcas de corte, área segura, línea de troquel — su existencia, su geometría, y su corrección.
- Imposición en hoja (cuántas piezas caben, cómo se acomodan, con qué separación) cuando aplica.
- Resolución, formato de archivo y perfil técnico de salida, según si el resultado es para pantalla o para producción física.
- Corrección de errores de producción (lo que hoy se llama Preflight) — si algo no es válido para imprimir, THÖREN lo corrige solo, en silencio, en vez de bloquear con un mensaje técnico. Solo pide ayuda humana cuando de verdad no puede decidir por sí mismo (por ejemplo, una ambigüedad real que solo la persona puede resolver) — y en ese caso lo hace con una pregunta en lenguaje humano, nunca con un código de error.

## 5. Lo que realmente necesita decidir el usuario

Solo lo que es, por definición, suyo y de nadie más:

- Para qué ocasión es (la intención, no la forma geométrica).
- Las palabras que lo hacen personal: un nombre, una fecha, una frase, un dato de contacto.
- Cuál de un puñado de propuestas visuales ya terminadas le gusta más.
- Opcionalmente, un matiz de tono o color entre pocas opciones curadas (nunca una rueda de color infinita).
- Si va a imprimir esto físicamente en volumen o no (la única bifurcación técnica real que le pertenece, y solo si aplica).

Todo lo demás — tamaño exacto en milímetros, separación entre piezas, qué objeto es la línea de troquel — nunca debería llegar a la persona como una pregunta.

---

## 6. Cómo eliminamos el 80% de la complejidad sin perder poder

La complejidad no desaparece — se reubica. Hoy vive expuesta, al mismo nivel, para todos los usuarios todo el tiempo. En THÖREN 2.0 vive en dos lugares distintos:

Primero, **dentro del sistema**, como inteligencia invisible: reglas de diseño, composición y producción que el motor ya aplica sin preguntar, basadas en la ocasión elegida y en principios de diseño gráfico y de imprenta ya validados. El poder técnico actual (el motor de impresión) no se reduce — se esconde detrás de decisiones automáticas de buena calidad por defecto.

Segundo, **dentro de un Modo Avanzado explícito**, para la minoría real que sí necesita control fino (alguien mandando a imprimir 500 hojas con requisitos exactos de una imprenta específica, por ejemplo). Ese modo puede parecerse más a una herramienta tradicional — pero nunca es el camino por defecto, nunca es lo primero que alguien ve, y se llega a él por elección explícita, no por accidente.

La regla de oro: el 80% de las personas nunca deberían enterarse de que el Modo Avanzado existe. El 20% que sí lo necesita debería poder encontrarlo sin fricción cuando lo busque.

---

## 7. Cómo lograr el "wow" antes de editar

El "wow" no puede depender de que la persona ya haya hecho algo — tiene que ocurrir con el mínimo posible de esfuerzo de su parte. La única entrada mínima necesaria para generar sorpresa es su propio nombre (o el de su marca). En el momento en que lo escribe, antes de tomar ninguna otra decisión, ya debería ver ese nombre apareciendo, bellamente tipografiado, en varias propuestas ya terminadas.

Ver tu propio nombre, al instante, ya diseñado con calidad profesional, sin haber hecho nada más que escribirlo — ese es el "wow". Es exactamente el tipo de sorpresa que genera un buen fotomatón o un artesano rápido y talentoso: le diste lo mínimo, y el resultado ya se siente tuyo.

---

## 8. La selección de templates como experiencia espectacular

Nunca una cuadrícula de miniaturas pequeñas. La selección debería sentirse como hojear una vitrina, no como escanear íconos de sistema operativo. Cada propuesta se muestra grande, una o pocas a la vez, con transiciones satisfactorias entre una y otra — más parecido a elegir el color de un producto en la tienda de Apple, o a deslizar entre fondos de pantalla en Arc, que a elegir un archivo en un explorador.

Cada propuesta, además, ya está personalizada con lo que la persona escribió (su nombre, su fecha) — nunca con texto de relleno genérico ("Tu Marca", "Lorem Ipsum"). Elegir un template debería sentirse como elegir cuál de varias versiones ya terminadas de tu propio diseño prefieres, no como elegir una plantilla vacía que vas a tener que llenar después.

---

## 9. Cómo lograr que la personalización parezca magia, no trabajo

Tres reglas:

Primero, **una cosa a la vez**. Nunca un formulario con múltiples campos simultáneos — una pregunta breve, una respuesta, ver el resultado, la siguiente pregunta solo si hace falta.

Segundo, **reacción inmediata y visible**. Cada dato que la persona entrega se refleja al instante en el diseño, en vivo, nunca después de confirmar o de avanzar de pantalla. La sensación de causa-efecto inmediata es lo que separa "estoy usando una herramienta" de "esto está reaccionando a mí".

Tercero, **nunca pedir más de lo estrictamente necesario para la identidad**. Si THÖREN puede inferir algo razonable por sí mismo (un color a partir de un logo, un tamaño a partir de la ocasión), lo hace, y solo ofrece la opción de cambiarlo después, nunca la obligación de decidirlo antes.

---

## 10. Qué vive solo en el Modo Avanzado

- Ajuste manual de posición, tamaño y rotación de elementos individuales.
- Gestión de capas.
- Configuración manual de imposición (tamaño de hoja, separación entre piezas, alineación de grid).
- Elección explícita de perfil técnico de exportación y sus parámetros (sangrado exacto, marcas de corte, formato).
- Edición de la línea de troquel o del área segura.
- Cualquier flujo de varios pasos que hoy existe como el wizard técnico de producción.

Este modo existe para la minoría de usuarios avanzados o negocios con necesidades específicas de imprenta — nunca debería ser necesario para el caso normal, y su existencia no debería anunciarse de forma prominente en la experiencia principal (una sola entrada discreta, no un botón compitiendo por atención con "Obtener mi diseño").

---

## 11. Un onboarding de menos de 60 segundos

No hay pantalla de onboarding separada — el onboarding es la primera tarea real, y dura lo que dura completar esa tarea la primera vez. Un posible recorrido, minuto a minuto:

Segundo 0: la app abre directo en "¿Para qué necesitas esto hoy?" con 4-6 opciones grandes y fotográficas.

Segundo 5: la persona toca una (por ejemplo, "Para un regalo hecho a mano").

Segundo 8: una sola pregunta — "¿Cómo quieres que diga?" — un campo de texto grande, nada más alrededor.

Segundo 15: mientras escribe, ya empiezan a aparecer, en vivo, 3-4 propuestas visuales con su texto ya puesto.

Segundo 30: la persona toca la que más le gusta. Se le ofrece, opcionalmente, cambiar un color o un tono — un solo gesto, no obligatorio.

Segundo 40: pantalla de revelación del resultado final, grande y satisfactoria.

Segundo 50: un solo botón — "Obtener mi diseño."

Segundo 58: el archivo está en sus manos.

Nunca hubo un tutorial. Nunca hubo una explicación de qué es THÖREN. La explicación fue la experiencia misma.

---

## 12. La prueba de los 65 años

Si una persona de 65 años, sin experiencia previa con herramientas de diseño ni con jerga técnica, no puede completar todo el recorrido sola, sin ayuda y sin frustración, el diseño falló — sin importar cuán elegante se vea. Concretamente, esto significa:

Nunca depender de gestos finos (arrastrar, redimensionar con handles, hacer doble clic para editar). Solo tocar y escribir. Nunca exigir entender una palabra técnica — ni "sangrado", ni "capa", ni "imposición", ni siquiera "plantilla" si hay una palabra más natural disponible. Siempre un solo camino claro hacia adelante en cada pantalla — nunca una decisión sin una opción evidente por defecto. Texto legible y objetivos de toque grandes, sin miniaturas diminutas que exijan buena vista o precisión motriz. Un único botón de "atrás" o "empezar de nuevo" simple, nunca un historial de deshacer/rehacer de varios niveles que haya que entender.

Si el producto final pasa esta prueba, probablemente también le encanta a todos los demás — es un estándar más exigente que "fácil de usar para alguien técnico", y por eso es el correcto.

---

## 13. La frase que resume la filosofía

**"THÖREN no es un lienzo. Es un resultado que ya llegó terminado."**

Toda decisión de producto futura puede medirse contra esta frase: ¿esto acerca al usuario a un resultado terminado, o lo invita a trabajar en un lienzo? Si es lo segundo, no pertenece a la experiencia principal.

---

## 14. Si Apple hubiera diseñado THÖREN

Extrema reducción: una sola acción posible por pantalla, nunca dos cosas compitiendo por atención. Ningún ajuste visible salvo que el usuario lo pida explícitamente — la configuración por defecto es siempre la respuesta, nunca la pregunta. Reverencia por el objeto físico: dado que el resultado final casi siempre es algo que se imprime y se pega o se sostiene — un sticker, un sello, una etiqueta — el producto debería tratar esa pieza con la misma seriedad fotográfica con la que Apple trata un producto de hardware: mostrada con luz, con materialidad, nunca como un rectángulo plano sobre fondo gris. Ritmo pausado y silencioso: transiciones que dan la sensación de calidad por su suavidad, no por su cantidad — menos animaciones, mejor ejecutadas. Lenguaje mínimo y humano en cada pantalla, nunca una oración más larga de la necesaria. Y, sobre todo, la sensación de que cada decisión de diseño de la app fue deliberada — que nada quedó así "porque así salió del motor", sino porque alguien decidió que así se sentía mejor.

---

## 15. Por qué alguien abre THÖREN mañana

No por un panel de "Mis proyectos" para administrar archivos — eso es una razón para un editor, no para un resultado. La razón real para volver es que **la segunda vez es más rápida y más personal que la primera**: THÖREN ya sabe su nombre, su marca, sus colores, su estilo preferido, así que la próxima ocasión (una tarjeta de agradecimiento, una etiqueta para otro producto, un sello distinto) no empieza de cero — empieza ya reconociéndolo a él. Volver a abrir la app no se siente como "otro proyecto que armar" sino como "otra cosa que ya casi está lista, porque THÖREN ya me conoce". Esa sensación de continuidad y reconocimiento — nunca un catálogo de archivos que administrar — es lo que genera el hábito de regreso.

---

## Cierre

Este documento no protege nada de lo ya construido. Si al leerlo la conclusión es que el 90% de la interfaz de edición actual debe desaparecer, la conclusión es correcta — literalmente se propuso así en la sección 3. Lo único que se conserva sin cuestionamiento es el motor técnico de producción de impresión, porque es real, es difícil de replicar, y es la ventaja que hace posible cumplir la promesa ("profesional") sin sacrificar la otra mitad de la promesa ("en menos de un minuto").

El producto que describe este documento no es una versión mejorada del editor actual. Es otra cosa: una experiencia guiada, conversacional, casi mágica, que termina en un resultado — no un lienzo que hay que aprender a usar. Si esto se siente como un producto distinto al que existe hoy, es porque lo es, y esa es exactamente la intención.

La interfaz vendrá después, diseñada al servicio de esta visión. El código vendrá al final, al servicio de esa interfaz. Este documento es, deliberadamente, lo único que existe por ahora.
