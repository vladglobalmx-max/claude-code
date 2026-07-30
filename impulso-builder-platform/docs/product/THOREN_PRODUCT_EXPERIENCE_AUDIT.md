# THÖREN — Auditoría de Experiencia de Producto

**Fecha:** 2026-07-30
**Autor:** evaluación como Chief Product Officer (perspectiva externa, sin defender el trabajo previo)
**Método:** uso real del producto (no lectura de documentación) — recorrido completo en `pnpm dev`, capturas de pantalla del primer lanzamiento, la galería de "Nuevo proyecto", el editor con una plantilla real cargada, y las tres primeras pantallas del wizard de "Exportar para impresión".
**Mandato:** evaluación emocional y de producto, no técnica. Cero validación. La Beta Comercial queda pausada hasta cerrar esta auditoría.

---

## 0. El veredicto en una frase

THÖREN es una herramienta de producción de impresión con una interfaz de formulario pegada encima. No es un producto de diseño que alguien abra por gusto — es un producto que alguien *tolera* porque necesita el archivo final. Esa distinción lo explica todo lo que sigue.

Tu reacción — "no me gustó mucho" — es correcta y es información de producto de primer nivel. No es una queja vaga: cuando la abrí y navegué exactamente los mismos pasos que haría un comprador real de Gumroad, encontré la causa. No es un bug. Es una decisión de diseño (o la ausencia de una) repetida en cada pantalla: priorizar la exactitud técnica sobre la sensación de usar la herramienta.

---

## 1. Diagnóstico general

THÖREN fue construido de adentro hacia afuera: primero el motor (documento, capas, imposición, preflight, PDF/PNG exactos), después una interfaz encima de ese motor. Se nota en cada pantalla. Los controles exponen el modelo de datos casi 1:1 ("gap X", "TrimBox por pieza", "Cut path (1 piezas)") en vez de exponer lo que la persona quiere lograr ("separa mis stickers", "¿dónde corta la impresora?").

Compáralo con Canva: Canva también tiene una imposición, un sangrado, un perfil de exportación — pero el usuario nunca ve esas palabras a menos que las busque. THÖREN se las pone enfrente en el paso 2 de 7, con inputs numéricos crudos de HTML sin estilizar.

El resultado emocional: uses THÖREN y sientes que estás **rellenando un formulario de imprenta**, no diseñando algo tuyo. Eso explica el "no me emociona usarla" con precisión quirúrgica.

La arquitectura, la cobertura de pruebas y la corrección técnica del PDF/imposición son reales y valiosas — pero son invisibles para la persona que abre la app por primera vez, y esa persona decide en los primeros 10 segundos si esto "se siente bien" o no. Ahora mismo, no.

---

## 2. Lo que funciona

Para no perder la honestidad por exceso de crítica — esto es real y no hay que tocarlo:

- **La identidad de marca tiene una base decente.** Tipografía propia (Familjen Grotesk / Schibsted Grotesk), una paleta cálida de piedra/terracota (`#1c1917`, `#78716c`, el acento óxido del logo) en vez del típico azul-morado genérico de SaaS. Es una base con la que se puede construir una identidad memorable — hoy simplemente no se usa con intención en la UI de trabajo.
- **El motor de impresión es genuinamente sólido.** Sangrado, marcas de corte, imposición en hoja, PDF aplanado — esto es el tipo de cosa que Canva y la mayoría de editores "para el hogar" ni siquiera intentan bien. Es un diferenciador real frente a la competencia de bajo costo.
- **El autoguardado y la recuperación funcionan de forma invisible** ("Guardado" en la barra, sin fricción de "guardar como"). Eso es exactamente el estándar que Notion/Figma establecieron y que el usuario ya espera sin pensarlo — aquí está bien resuelto y no hay que rehacerlo.
- **La oferta central (plantillas reales, listas para producción física) es un problema de negocio genuino**, no inventado. El "qué" vale la pena. El "cómo se siente usarlo" es el problema.

---

## 3. Lo que definitivamente no funciona

**El primer lanzamiento no vende nada.** Ves un modal blanco con un párrafo de texto plano explicando qué es la app en prosa ("Diseña stickers y expórtalos listos para imprenta..."). Cero imagen, cero muestra de lo que vas a producir, cero movimiento. Es una nota de versión, no una bienvenida. Figma, Framer, Linear — todos abren mostrando el producto en acción, nunca describiéndolo en un párrafo.

**La pantalla "Mis proyectos" vacía es un vacío literal.** Fondo gris uniforme, dos botones, una línea de texto gris apagado ("Todavía no tienes proyectos guardados"). No hay una sola plantilla destacada, ni una sugerencia visual de qué hacer. Es la peor "primera impresión tras la bienvenida" posible: inmediatamente después de prometerte algo bonito en el modal, la app te enseña una pantalla en blanco.

**La galería de plantillas no vende las plantillas.** Las tarjetas son minúsculas (más o menos 190×110px), en escala de grises casi total, con texto microscópico. El "Sello Corporativo" —una de las piezas más elaboradas del catálogo— se ve como un círculo blanco con una "T" y texto ilegible. Ninguna tarjeta transmite "esto se ve bien hecho". Esto es exactamente lo opuesto a Canva, cuyo modelo de negocio entero es "la plantilla se ve tan bien en miniatura que quieres hacerla tuya".

**El lienzo de edición desperdicia el 90% de la pantalla en gris vacío.** Cuando cargas una plantilla, el sticker aparece como un cuadradito diminuto flotando en el centro de un área gris enorme, sin sombra, sin marco, sin ningún indicio de que "esto es tu pieza de trabajo, tu obra". Se ve como un editor de CAD, no como un lienzo creativo.

**La barra de herramientas es una pared de texto.** Doce botones de puro texto en dos filas ("Nuevo", "Deshacer", "Rehacer", "Guardar", "Mis proyectos", "Exportar", "Exportar para impresión", "Guardar como plantilla", "Duplicar", "Eliminar", "Agrupar", "Desagrupar"...). Cero iconografía, cero agrupación visual, cero jerarquía entre lo que usas todo el tiempo (Texto, Imagen) y lo que usas una vez por proyecto (Guardar como plantilla). Se lee como el menú de un IDE de los 2000s, no como Figma/Framer, donde un vistazo a los iconos ya te dice qué hace cada botón antes de leer una palabra.

**El inspector, cuando no hay nada seleccionado, dice literalmente "Nada seleccionado."** — en gris, sin ilustración, sin invitación a hacer clic en algo. Es honesto pero es frío. Notion y Figma nunca dejan un panel completamente vacío sin al menos un microtexto que invite a la acción.

**El wizard de exportación mezcla español e inglés en el mismo párrafo.** "Digital PNG", "Print PDF", "Sticker Sheet" — nombres de perfil en inglés, incrustados en una interfaz que por lo demás está enteramente en español ("Perfil de impresión", "Configuración de la imposición"). Para un producto que se vende explícitamente a hispanohablantes (los mensajes de invitación de la Beta están en español puro), esto se siente como una traducción a medias, no como un producto terminado.

**El paso de configuración de imposición es un formulario de propiedades, no una experiencia.** Inputs `<input type="number">` sin estilizar, con etiquetas técnicas entre paréntesis en inglés ("Separación horizontal (gap X)"). No hay una previsualización en vivo mientras ajustas los valores — tienes que avanzar al paso 3 para ver qué hiciste.

**El paso de vista previa de producción es jerga de imprenta sin traducir a valor humano.** Seis casillas técnicas ("TrimBox por pieza", "Safe Area por pieza", "Cut path (1 piezas)" — nótese el error de concordancia gramatical "1 piezas") controlan un diagrama con líneas punteadas de colores (naranja, morado, verde) sin ninguna leyenda visual que explique qué significa cada color para alguien que no sabe qué es un TrimBox. Este es probablemente el momento de mayor abandono emocional de todo el flujo: justo cuando el usuario espera ver "mi diseño, bonito, listo", ve un plano técnico de fábrica.

---

## 4. Los momentos donde el producto pierde al usuario

En orden de aparición en el flujo real:

1. **Segundo 0-3, modal de bienvenida:** un párrafo de texto en vez de una demostración visual. Pierdes la oportunidad del "wow" antes de que empiece.
2. **Segundo 4-8, "Mis proyectos" vacío:** la pantalla más aburrida posible justo después de la bienvenida. Cualquier momentum emocional que el modal haya generado muere aquí.
3. **Al abrir la galería de plantillas:** las miniaturas no comunican calidad. Si no conoces ya el catálogo, no hay ninguna señal visual de "esto vale la pena".
4. **Al entrar al editor por primera vez:** el sticker es diminuto en un mar gris. No hay ningún micro-momento de "aquí está, esto es lo tuyo" — ni zoom automático a la pieza, ni resaltado, ni transición.
5. **Al llegar al paso 4 (Preflight) o al paso de vista previa técnica:** el lenguaje de imprenta sin traducir convierte un flujo de "estoy terminando algo bonito" en "estoy llenando un formulario de control de calidad industrial".
6. **Al terminar la exportación:** (no llegué a capturarlo en este recorrido, pero por el patrón del resto del wizard, es predecible que el resultado final sea un mensaje de confirmación de texto plano, no una celebración). Si es así, es el mayor desperdicio de todos: el final de un flujo de creación es exactamente donde Canva/Figma más invierten en la sensación de logro, y es probable que aquí no exista.

---

## 5. Los momentos donde debería sorprender y no lo hace

- **El primer lanzamiento** debería sentirse como abrir una caja de regalo de diseño — Arc Browser, por ejemplo, convierte literalmente el onboarding en una experiencia guiada con movimiento y personalidad. THÖREN lo resuelve con un `<div>` blanco de texto.
- **Elegir una plantilla** debería sentirse como hojear un catálogo bonito — como el feed de plantillas de Canva o la galería de Framer. Aquí se siente como escoger un ícono de sistema operativo de los años 2000.
- **Ver tu sticker por primera vez en el editor** debería sentirse como "ahí está mi pieza" — con espacio, contexto (una mesa, una sombra suave, algo que sugiera "producto físico real"), quizás una transición de entrada. Hoy es un rectángulo perdido en gris.
- **Terminar una exportación** debería sentirse como un logro — confirmación visual satisfactoria, quizás el archivo con una vista previa grande, un cierre emocional del ciclo de trabajo. Todo indica que hoy es un mensaje de estado más.
- **Descubrir funciones** (agrupar, plantillas guardadas, biblioteca de assets) debería sentirse como encontrar herramientas — en Figma, cada herramienta nueva que descubres se siente como una superpotencia. Aquí todo vive al mismo nivel visual en una lista de texto, así que nada se siente como un descubrimiento.

---

## 6. Problemas de UX críticos

- **Cero iconografía en toda la barra de herramientas y en el inspector.** El escaneo visual es imposible; todo requiere lectura letra por letra.
- **Mezcla de idiomas** en los nombres de perfil de exportación (inglés dentro de una UI en español).
- **El wizard de exportación de 7 pasos es el camino por defecto, incluso para el caso más simple** (una sola pieza, PNG). Un formulario de configuración técnica no debería ser la primera experiencia de exportar — debería existir un camino de "un clic" para el 80% de los casos, con el modo avanzado escondido detrás de un "Opciones avanzadas".
- **No hay ninguna vista previa en vivo mientras ajustas configuración** (paso 2 del wizard) — tienes que avanzar a ciegas para ver el resultado.
- **El inspector no tiene estado de "bienvenida al vacío"** — solo dice "Nada seleccionado", sin invitar a hacer nada.
- **Errores de concordancia/redacción no revisados** ("Cut path (1 piezas)") que delatan que el copy nunca pasó por una revisión de producto, solo por generación mecánica de strings.
- **Ningún onboarding interactivo** — el modal de bienvenida es informativo, no experiencial. No hay un "prueba esto primero" guiado.

---

## 7. Problemas de diseño visual

- **Jerarquía visual plana en toda la app.** Todos los botones del toolbar tienen el mismo peso visual, sin importar si se usan una vez por proyecto ("Guardar como plantilla") o constantemente ("Texto", "Imagen").
- **Miniaturas de plantillas sin contraste ni color real** — el catálogo tiene piezas con paletas de color reales (kraft, pastel, colores de marca) pero las tarjetas de selección las muestran casi monocromáticas y a una escala que no permite apreciar el diseño.
- **El lienzo no tiene "peso" ni contexto** — no hay sombra, no hay simulación de superficie, no hay nada que ancle visualmente la pieza como un objeto físico que se va a imprimir y pegar en algo real.
- **Tipografía de marca subutilizada** — Familjen Grotesk/Schibsted Grotesk existen mas no se sienten presentes: los textos de UI usan pesos y tamaños que podrían ser cualquier fuente del sistema. La identidad tipográfica no se percibe en el uso diario.
- **El acento de marca (terracota/óxido) aparece de forma inconsistente** — está en el logo y en el botón "Nuevo proyecto", pero desaparece en el resto del flujo (los botones principales del wizard son negro puro, sin relación con la identidad de marca).
- **Los checkboxes/inputs son controles nativos del navegador sin estilizar** en pasos clave (configuración de imposición, capas visibles del preview) — rompen cualquier sensación de producto pulido en el momento exacto donde se necesita más confianza (justo antes de exportar y pagar por el resultado).

---

## 8. Problemas de flujo

- **Fricción de "elige-antes-de-ver"**: seleccionas una plantilla por su miniatura diminuta, sin ninguna vista previa grande antes de comprometerte a "Crear".
- **El flujo de exportación es lineal y obligatorio incluso cuando no aplica** — alguien exportando un PNG simple para redes sociales pasa por los mismos 7 pasos conceptuales que alguien mandando a imprimir 500 hojas con imposición.
- **No hay atajo para "repetir la última exportación"** — cada vez se empieza desde el paso 1.
- **La navegación entre "Mis proyectos" y el editor no deja rastro de contexto** — no vi ninguna migas de pan ni indicación visual de en qué proyecto/plantilla estás trabajando más allá del título de la pestaña del navegador.

---

## 9. Problemas de percepción de valor

Este es, en mi criterio, el punto más importante de toda la auditoría:

**Hoy, THÖREN no se ve ni se siente como algo por lo que valga la pena pagar**, independientemente de que el PDF final sea técnicamente perfecto. La percepción de valor se construye en los primeros minutos, con señales completamente ajenas a la calidad del PDF: qué tan bonita es la primera pantalla, qué tan bien se ven las plantillas en miniatura, qué tan "cuidado" se siente cada micro-momento.

Ahora mismo, cada una de esas señales dice "esto es una herramienta interna", no "esto es un producto premium". Un comprador de Gumroad no puede ver ni tocar el PDF de imprenta antes de comprar — todo lo que puede evaluar es exactamente lo que audité aquí: la sensación. Y la sensación actual no sostiene el precio de un producto pagado, sin importar cuán bueno sea el motor debajo.

---

## 10. Qué haría que alguien pagara por THÖREN

Comparando mentalmente contra Canva, Figma, Notion, Framer, Linear y Arc — lo que esos productos tienen en común no es su paleta de colores ni su iconografía específica. Es esto:

1. **El primer minuto ya demuestra el valor central**, sin necesitar leer nada. Arc te muestra pestañas reinventadas en movimiento. Linear te muestra velocidad real, no una promesa de velocidad.
2. **Cada pantalla se ve como si alguien la hubiera diseñado a propósito**, no como si fuera la superficie mínima necesaria para exponer una función del motor.
3. **El producto tiene una opinión visual fuerte** — Framer y Linear no se parecen a nada más, y esa distintividad se siente como calidad incluso antes de usarlos a fondo.
4. **Terminar una tarea se siente bien**, no solo "completo". Notion te confirma con micro-momentos amables; Canva termina cada descarga con una sensación de logro.
5. **El lenguaje siempre está del lado del usuario**, nunca del lado del motor. Ninguno de esos productos te muestra "gap X" o "TrimBox" — te muestran "separación entre piezas" y "lo que se ve en la hoja final", con una vista previa, no con un número.

Para que alguien pague por THÖREN específicamente (más allá de la calidad genérica arriba), necesita sentir que **está comprando resultados físicos hermosos y confiables**, con la misma facilidad emocional que Canva, pero con la ventaja real (que sí existe hoy) de producción de imprenta correcta. Hoy solo se comunica la segunda parte, nunca la primera.

---

## 11. Prioridad de cambios (Impacto vs. Esfuerzo)

**Alto impacto / bajo esfuerzo — hacer primero:**
- Unificar el idioma: traducir "Digital PNG" / "Print PDF" / "Sticker Sheet" y cualquier otro string en inglés a español consistente.
- Corregir errores de copy detectados ("Cut path (1 piezas)" y revisión general de plurales/concordancia en mensajes generados).
- Agregar iconografía real a la barra de herramientas y agrupar visualmente por frecuencia de uso (edición vs. archivo vs. exportación).
- Rediseñar el estado vacío del inspector ("Nada seleccionado") con una invitación activa, no solo un aviso pasivo.
- Aumentar el tamaño y la fidelidad de color de las miniaturas de plantillas en la galería de "Nuevo proyecto".

**Alto impacto / esfuerzo medio:**
- Rediseñar el modal de bienvenida como una experiencia visual (mostrar el producto, no describirlo en prosa).
- Rediseñar la pantalla vacía de "Mis proyectos" para que muestre plantillas destacadas de entrada, en vez de un mensaje de texto.
- Dar peso visual y contexto al lienzo de edición (marco, sombra, quizás simulación de superficie física) en vez de dejarlo flotando en gris.
- Crear un camino de exportación "rápida" de un clic para el caso simple (PNG/SVG para uso digital), dejando el wizard de 7 pasos como "modo avanzado" para producción física real.
- Traducir la pantalla de vista previa técnica (paso 3) a lenguaje humano con leyenda visual clara, o esconder las opciones técnicas detrás de un nivel "avanzado" opcional.

**Alto impacto / esfuerzo alto — la apuesta grande:**
- Reconstruir la identidad visual del flujo de trabajo completo (toolbar, inspector, lienzo) con un sistema de diseño propio que use de verdad la tipografía y el color de marca ya elegidos, en vez de controles nativos del navegador sin estilizar.
- Diseñar un momento de cierre/celebración real al terminar una exportación.
- Repensar el modelo de onboarding como una experiencia guiada e interactiva (crear tu primer sticker en la propia bienvenida), no un modal informativo.

**Bajo impacto — no priorizar todavía:**
- Micro-ajustes de espaciado o alineación puntual que no cambian la sensación general mientras la estructura de fondo (toolbar de texto, formularios crudos) siga igual. Arreglar el detalle antes que la estructura es exactamente el tipo de "mejora incremental" que este documento pidió explícitamente evitar como prioridad.

---

## 12. Visión completamente nueva, si empezáramos desde cero

Si THÖREN se replanteara hoy desde cero, con la misma tecnología de producción de impresión (que sí vale la pena conservar), esto es lo que cambiaría de raíz:

**La entrada al producto no sería un formulario de bienvenida — sería un lienzo con una plantilla ya cargada y lista para tocar.** El usuario llega y ya está "dentro" de un sticker bonito, con una sola invitación clara: "Toca cualquier texto para hacerlo tuyo." Cero fricción entre abrir la app y sentir que ya está creando.

**La galería de plantillas sería la superficie principal del producto, no un modal secundario.** Tarjetas grandes, con color real, organizadas por intención ("Para mi marca", "Para mi boda", "Para vender en Etsy") en vez de por forma geométrica ("Sticker circular", "Sticker cuadrado"). La forma es un detalle técnico; la intención es lo que hace que alguien haga clic.

**El lienzo tendría presencia física.** La pieza se vería como un objeto real sobre una superficie, con sombra suave y espacio de respiro — no como una figura perdida en un plano de CAD.

**La barra de herramientas sería icónica, compacta y agrupada por momento del flujo** (crear → organizar → exportar), con los comandos raros (agrupar, plantillas, duplicar) escondidos en un menú secundario, no expuestos permanentemente al mismo nivel que "Texto" e "Imagen".

**Exportar sería una sola acción por defecto** ("Descargar mi sticker"), con el detalle de imposición/sangrado/marcas de corte disponible como "Modo producción" para quien de verdad va a mandar a imprimir en volumen — nunca como el único camino disponible.

**Todo el lenguaje técnico de imprenta se traduciría a lenguaje humano**, con la jerga (TrimBox, cut path, gap) disponible solo si el usuario activa explícitamente un modo experto, nunca como vocabulario por defecto.

**El final de cada creación tendría un momento de cierre real** — una vista grande del resultado, quizás una animación breve, un mensaje que reconozca el logro ("Tu sticker está listo") en vez de una notificación de estado técnico.

La tecnología de impresión que ya existe seguiría siendo la ventaja competitiva real de THÖREN frente a Canva. Pero se convertiría en la razón de fondo por la que alguien se queda, nunca en la primera cosa que ve — exactamente al revés de como está construido hoy.

---

## Cierre

No hay ningún hallazgo aquí que se resuelva con una lista de retoques cosméticos. La sensación de "no me gustó mucho" viene de una decisión estructural: construir la interfaz como una capa fina sobre el motor técnico, en vez de construir el motor técnico como la base invisible de una experiencia de producto. Esa es la verdad incómoda, y es mejor enfrentarla ahora, antes del lanzamiento comercial, que después de que los primeros compradores la sientan y no vuelvan.
