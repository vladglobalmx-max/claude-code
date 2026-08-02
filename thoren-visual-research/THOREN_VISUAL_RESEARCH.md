# THÖREN Visual Research

**Fecha:** 2026-08-02
**Naturaleza de este documento — leer antes que nada:** esto es **investigación**, no producto. Vive completamente fuera de la cadena de documentos de THÖREN (`docs/product/`), no referencia ni es referenciado por `THOREN_VISION_2.md`, `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md`, `THOREN_INTERACTION_SYSTEM.md` ni ningún otro documento fuente. No modifica `thoren-beta/`. No genera entradas en `THOREN_PRODUCT_BACKLOG_V2.md`. No es una fase. No rompe el congelamiento de desarrollo vigente.
**Qué es:** un mapa de principios de diseño visual observables en productos digitales considerados de calidad premium — Apple, Linear, Raycast, Arc Browser, Stripe, Notion, Framer — organizado por dimensión (color, tipografía, grid, etc.), no un sistema prescriptivo para THÖREN. Donde algo aplicaría a THÖREN, se presenta como **pregunta abierta**, nunca como decisión.
**Qué NO es:** no es un clon de ninguno de estos productos, no reproduce sus tokens de diseño internos exactos (no tengo acceso verificado a ellos — lo que sigue es análisis de su lenguaje visual público, observable por cualquiera que use el producto), no diseña ninguna pantalla ni componente de THÖREN, no propone ninguna implementación.
**Cuándo se activa:** nunca automáticamente. Solo si, al cerrar la Beta, se decide explícitamente que la percepción visual fue una barrera real (evidencia en `THOREN_FINDINGS_DATABASE.md`), y solo entonces se decide —con ese documento y este, juntos— qué construir.

---

## 0. La pregunta que organiza toda esta investigación

Los productos de la lista de referencia no se sienten "premium" por una paleta bonita — se sienten premium porque **cada decisión visual comunica una intención**, y esa intención es consistente en todas partes. La pregunta de fondo, para cada dimensión de abajo, no es "¿qué colores/tipografía/sombras usan?" sino: **¿qué está comunicando esa decisión sobre qué tipo de producto es este, y quién lo hizo?**

Tres intenciones distintas aparecen, repetidas, en los siete productos de referencia — vale la pena nombrarlas porque no son la misma cosa, y THÖREN tendría que elegir (no mezclar) si algún día decide perseguir esto:

| Intención | Cómo se ve | Ejemplos |
|---|---|---|
| **Precisión de instrumento** | Todo se siente calibrado, denso de información bien organizada, para gente que ya sabe lo que quiere | Linear, Raycast |
| **Calma editorial** | Espacio generoso, tipografía como protagonista, casi ausencia de color | Notion, Apple (páginas de producto) |
| **Confianza institucional** | Pulido pero cálido, cada micro-detalle cuidado, nunca frío | Stripe, Arc Browser |

THÖREN, por filosofía (`THOREN_PRODUCT_PHILOSOPHY.md`, fuera de alcance de este documento pero citado como contexto), ya es un "ritual de un solo uso", no una herramienta de sesión continua — eso lo acerca estructuralmente más a la segunda columna (calma editorial) que a la primera (precisión de instrumento). Esto no es una decisión tomada aquí — es una observación para tener en cuenta si algún día se retoma este documento.

---

## 1. Color System

**Qué hacen los productos de referencia:**
- **Un solo color de marca, usado con extrema disciplina.** Stripe usa su morado/violeta en menos del 5% de la superficie visual de cualquier pantalla — el resto es neutro. Linear hace lo mismo con su acento morado-azulado. El color de marca marca *un* lugar de atención (la acción principal), nunca decora.
- **Neutros con temperatura, no neutros puros.** Ninguno de estos productos usa un gris puro (`#808080`) o un blanco puro (`#FFFFFF`) como base — usan grises con un sesgo sutil de temperatura (fríos hacia el azul en Linear/Raycast, cálidos hacia el crema en Notion/Apple). Un gris "sin sesgo" se percibe como no-elegido; un gris con sesgo se percibe como diseñado.
- **Modo oscuro como ciudadano de primera clase, no una inversión automática.** Linear, Raycast y Arc fueron diseñados con el modo oscuro como experiencia primaria, no como un "también funciona en oscuro" — los negros no son `#000000` sino grises muy oscuros con la misma temperatura que la paleta clara, y el acento de marca se recalibra (nunca el mismo hex en ambos modos) para mantener el mismo nivel de énfasis percibido.
- **El color como jerarquía, no como decoración.** En Stripe y Linear, el color casi nunca aparece en más de un elemento por pantalla a la vez — si algo tiene color, es porque es lo único que se supone que mires primero.

**Por qué funciona:** el ojo humano detecta color antes que forma. Un solo acento entrena al usuario, sin que se dé cuenta, a saber dónde mirar — usar color en todas partes anula esa señal por completo. Esto es, notablemente, **el mismo principio ya documentado** en el archivo de identidad visual heredado de Sticker Builder (ahora archivado): "un acento de color a la vez... el error más común es casi siempre agregar algo de más."

**Preguntas abiertas para THÖREN (no decisiones):**
- ¿La paleta actual de THÖREN (crema/tinta cálida, ver `thoren-beta/src/style.css`) ya tiene esta disciplina de "un acento", o hay más de un color compitiendo por atención?
- ¿Vale la pena que THÖREN tenga un modo oscuro diseñado de origen, o eso es una ambición sin evidencia de que alguien lo pida?

---

## 2. Typography System

**Qué hacen los productos de referencia:**
- **Máximo dos familias tipográficas, casi siempre solo una.** Linear y Raycast usan una sola familia (Inter o una variante propia) para absolutamente todo — título, cuerpo, datos técnicos — variando solo peso y tamaño. Apple usa su propia familia (SF Pro) de la misma manera. Notion es la excepción parcial: una serif opcional para títulos de documento, sans para todo lo demás — pero es una *elección del usuario*, no una decisión de marca impuesta en toda la interfaz.
- **Una escala tipográfica estricta y limitada** (típicamente 5-7 tamaños, nunca "lo que se sienta bien en el momento"), con relaciones matemáticas entre pasos (razón ~1.2-1.25), no números arbitrarios.
- **El peso hace el trabajo que el tamaño no debería hacer.** Cuando algo necesita más presencia sin romper la escala, estos productos suben el peso (`font-weight`), no el tamaño — la jerarquía se siente más disciplinada.
- **Line-height generoso en cuerpo de texto** (1.5-1.6), casi apretado en títulos grandes (1.05-1.15) — la lectura larga necesita aire, el impacto visual de un título grande necesita compactarse para sentirse como un bloque sólido, no como líneas sueltas.
- **Letter-spacing negativo en tamaños grandes, positivo (y sutil) en mayúsculas pequeñas** (etiquetas, eyebrows) — nunca al revés.

**Por qué funciona:** una tipografía consistente en todas partes hace que el producto se sienta hecho por una sola mano. Cuando varían las familias sin razón, el ojo detecta la inconsistencia antes de poder nombrarla — se percibe como "no terminado" aunque cada pieza individual esté bien hecha.

**Preguntas abiertas para THÖREN:**
- ¿Cuántas familias tipográficas usa hoy la Beta, y responde cada una a un rol claro o son decisiones puntuales sin sistema?
- ¿La escala de tamaños actual sigue una progresión matemática o son valores elegidos pantalla por pantalla?

---

## 3. Grid System

**Qué hacen los productos de referencia:**
- **Una unidad base fija** (casi siempre 4px u 8px) de la que se derivan todos los demás valores — anchos de columna, gutters, tamaños de componente. Nada se mide "a ojo".
- **Grids de contenido angostos, no grids de aplicación anchos**, incluso en pantallas grandes — Stripe, Notion y Apple limitan el ancho máximo de línea de texto (~65-75 caracteres) independientemente del ancho de la ventana. Un grid que se estira infinitamente en monitores anchos se siente menos cuidado, no más espacioso.
- **Alineación óptica sobre alineación matemática en casos puntuales** — por ejemplo, un ícono redondo junto a texto se desplaza 1-2px para *sentirse* alineado, aunque matemáticamente no lo esté al pixel — el ojo humano no mide en píxeles, mide en percepción.

**Por qué funciona:** un grid consistente es invisible cuando funciona — el usuario nunca piensa "esto está alineado", pero sí nota, sin poder explicarlo, cuando no lo está. La disciplina de grid es la diferencia entre "se ve hecho a mano" (en el mal sentido) y "se ve diseñado".

**Preguntas abiertas para THÖREN:**
- ¿Existe hoy una unidad base explícita, o los valores de layout de la Beta son ad hoc?

---

## 4. Spacing System

**Qué hacen los productos de referencia:**
- **Una escala de espaciado cerrada y con nombre** (ej. `4, 8, 12, 16, 24, 32, 48, 64`), nunca valores intermedios inventados caso por caso (`13px`, `22px`).
- **El espacio en blanco es un elemento de diseño activo, no lo que sobra.** Notion y Apple usan espacio negativo generoso deliberadamente como señal de calma y confianza — llenar el espacio disponible se percibe como ansiedad visual, no como eficiencia.
- **Espaciado que aumenta con el nivel jerárquico**, no espaciado uniforme — más aire alrededor de lo más importante, menos entre elementos que pertenecen al mismo grupo.

**Por qué funciona:** el espaciado consistente es lo que hace que una interfaz se sienta "tranquila" en vez de "apretada" — y una escala cerrada, en vez de valores libres, es lo que hace posible mantener esa consistencia a través de cientos de componentes sin que cada uno se vea ligeramente distinto.

---

## 5. Elevation & Shadows

**Qué hacen los productos de referencia:**
- **Sombras suaves, difusas y de bajo contraste**, nunca sombras duras tipo "material design temprano" (offset grande, opacidad alta). Linear y Arc usan sombras casi imperceptibles a simple vista, pero que el ojo registra como "esto flota un poco".
- **Elevación como sistema de capas con significado**, no decoración por elemento — cada nivel de sombra corresponde a un nivel real de jerarquía de interacción (superficie base / tarjeta / menú flotante / modal), nunca una sombra distinta por gusto en cada componente.
- **Doble sombra (ambient + direct)** es común en sistemas maduros: una sombra muy difusa y tenue que simula luz ambiental, más una sombra más definida y cercana que simula la fuente de luz principal — la combinación se siente más realista que una sola sombra.
- **Bordes sutiles como alternativa a la sombra** en modo oscuro — una sombra es casi invisible sobre fondo oscuro; Linear y Raycast usan un borde de 1px con opacidad baja para separar superficies en dark mode, en vez de depender de sombra.

**Por qué funciona:** la elevación bien hecha comunica jerarquía espacial sin que el usuario tenga que pensar en ella. Mal hecha (sombras duras o inconsistentes), comunica lo contrario: que el diseño no pensó en cómo se relacionan los elementos entre sí.

---

## 6. Motion Principles

**Qué hacen los productos de referencia:**
- **Duraciones cortas y consistentes** (150-250ms para la mayoría de transiciones de UI; hasta 400-500ms solo para transiciones de pantalla completa) — nada se siente "esperado" durante una interacción común.
- **Curvas de easing que desaceleran al llegar**, casi nunca lineales ni con rebote exagerado — `ease-out` para elementos que entran, `ease-in` para los que salen, transmite peso físico real sin sentirse "juguetón".
- **El movimiento explica una relación causal**, no decora. Cuando algo aparece, de dónde viene visualmente importa — un modal que crece desde el botón que lo abrió comunica "esto vino de ahí"; un modal que aparece de la nada no comunica nada, solo aparece.
- **Reduced motion como ciudadano de primera clase**, no un afterthought — Apple, Linear y Stripe respetan `prefers-reduced-motion` desactivando específicamente el movimiento que no es funcional (parallax, rebotes decorativos), preservando el que sí comunica estado (aparecer/desaparecer).

**Por qué funciona:** el movimiento de calidad no se nota como movimiento — se siente como "las cosas se comportan como deberían". El movimiento de baja calidad sí se nota, precisamente porque llama la atención sobre sí mismo en vez de sobre el contenido.

**Nota de compatibilidad con THÖREN:** esta es, de las 18 dimensiones, la que ya tiene más terreno común explícito con la filosofía existente — el "ritmo pausado, nunca apresurado" y el "pulso de espera" de `THOREN_INTERACTION_SYSTEM.md` (fuera de alcance aquí, solo se cita) ya son, en esencia, una aplicación deliberada de "el movimiento comunica intención, no decora".

---

## 7. Surface Materials

**Qué hacen los productos de referencia:**
- **Vidrio esmerilado (glassmorphism) usado con extrema moderación**, solo donde hay una razón funcional real (una barra de navegación flotante sobre contenido que se desplaza, un panel de comando sobre el fondo de la app) — Arc y Raycast lo usan así; nunca como textura de fondo genérica.
- **Superficies casi siempre planas y opacas para contenido**, con textura/profundidad reservada exclusivamente para elementos de navegación/control que flotan *sobre* el contenido, nunca para el contenido mismo.
- **Gradientes sutiles, casi imperceptibles**, usados para dar una sensación leve de luz direccional sobre un botón o superficie — nunca gradientes vibrantes multicolor como fondo (ese lenguaje pertenece a otra era del diseño de producto, ya percibida como genérica/anticuada).

**Por qué funciona:** el material comunica qué es interactivo/flotante versus qué es contenido fijo. Usar el mismo lenguaje de material en todo diluye esa señal.

---

## 8. Iconography

**Qué hacen los productos de referencia:**
- **Un solo grosor de trazo, una sola familia de íconos, en toda la aplicación** — nunca mezclar íconos de línea fina con íconos de relleno sólido en la misma vista.
- **Grid de construcción consistente** (típicamente 24×24 con área segura interna) — cada ícono ocupa proporcionalmente el mismo espacio visual, aunque su forma sea distinta.
- **Íconos como lenguaje funcional, no decorativo** — Linear y Raycast usan íconos casi exclusivamente para acciones/estados reales, nunca como adorno junto a un título que ya se explica solo con texto.

**Por qué funciona:** la consistencia de íconos es, otra vez, invisible cuando está bien hecha — el usuario reconoce patrones (todos los íconos de "eliminar" se ven igual de graves, todos los de "agregar" igual de simples) sin tener que pensarlo.

---

## 9-11. Lenguaje de Botones, Inputs y Tarjetas (unificado — es un solo lenguaje de componentes)

**Qué hacen los productos de referencia:**
- **Jerarquía de botones estricta y limitada** (típicamente 3 niveles: primario sólido con el color de marca, secundario con borde o fondo neutro, terciario como texto plano) — nunca más de un botón "primario" (con el color de marca) visible al mismo tiempo en la misma vista, la misma regla del acento único aplicada a componentes.
- **Radios de esquina consistentes en toda la app**, derivados de una escala pequeña (ej. 6px, 8px, 12px, 16px+ para tarjetas grandes) — nunca radios arbitrarios por componente.
- **Estados de foco visibles y con personalidad**, no el outline azul del navegador sin tocar ni un anillo genérico — Linear y Stripe diseñan su anillo de foco con el color de marca, comunicando cuidado incluso en un detalle que solo ven usuarios de teclado.
- **Inputs con feedback inmediato y específico**, nunca solo "borde rojo genérico" — el mensaje de error explica qué pasó y cómo corregirlo, en el mismo lugar donde ocurrió el problema (mismo principio ya presente en la filosofía general de escritura de interfaces, no exclusivo de estos productos).
- **Tarjetas con una sola fuente de elevación** (sombra o borde, casi nunca ambos a la vez) y un padding interno que sigue la misma escala de espaciado que el resto de la app — una tarjeta nunca debería sentirse como "un mini-diseño aparte" dentro de la página.

**Por qué funciona:** cuando el lenguaje de componentes es consistente, el usuario aprende las reglas del juego una sola vez y las aplica en toda la app sin fricción — cada botón/input/tarjeta nuevo se siente familiar antes de tocarlo.

---

## 12. Image Style

**Qué hacen los productos de referencia:**
- **Fotografía real (cuando se usa) con dirección de arte consistente**: mismo tratamiento de color/temperatura, misma calidad de luz, en todas las imágenes de un mismo contexto — nunca una mezcla de fotos de stock genéricas con fotos propias de estilo distinto.
- **Preferencia por composición/ilustración sobre fotografía de stock genérica** cuando no hay presupuesto para fotografía real de calidad — una foto de stock reconocible es una de las señales más rápidas de "esto no es premium", incluso si el resto del diseño es impecable.

---

## 13. Illustration Style

**Qué hacen los productos de referencia:**
- **Un solo nivel de abstracción/detalle en toda la ilustración de un mismo producto** — Notion usa ilustraciones planas de dos-tres colores en todos sus estados vacíos; Stripe usa gráficos geométricos abstractos, nunca mezclado con ilustración figurativa detallada en otra parte.
- **La ilustración refuerza el mensaje, no lo reemplaza** — un estado vacío bien ilustrado todavía necesita texto claro; la ilustración es tono emocional, no la explicación en sí.

*(Este principio ya está, en esencia, documentado — con más detalle técnico del que corresponde repetir aquí — en el archivo de identidad visual heredado de Sticker Builder, ahora archivado: "5 niveles de reducción, un solo nivel por template, nunca mezclar".)*

---

## 14-16. Empty, Loading & Success States (unificado — son el mismo momento visto en tres tiempos)

**Qué hacen los productos de referencia:**
- **Loading states que muestran la forma final del contenido** (skeleton screens que ya tienen la silueta de las tarjetas/texto que van a aparecer) en vez de un spinner genérico centrado — reduce la sensación de espera porque el cerebro ya empieza a "leer" la forma antes de que llegue el contenido real.
- **Empty states como oportunidad de enseñar, no solo de informar** — un estado vacío bien diseñado no dice solo "no hay nada aquí", sugiere la primera acción posible, con el mismo tono de voz del resto del producto.
- **Success states breves y de bajo drama** — una confirmación visual clara pero que no se queda en pantalla más tiempo del necesario ni interrumpe el flujo con una celebración exagerada (excepción deliberada: momentos genuinamente poco frecuentes y de alto significado, donde sí se permite un momento más grande — pero es la excepción, no la norma).

**Nota de compatibilidad con THÖREN:** el "pulso de espera" y el momento de "revelación" de la Beta ya son, en esencia, un loading state y un success state diseñados con intención — no genéricos. Esta sección confirma que el instinto ya está alineado con el patrón de referencia; no señala ninguna carencia.

---

## 17. Visual Hierarchy

**Qué hacen los productos de referencia:**
- **Una sola cosa "grita" por pantalla.** Cada vista tiene exactamente un elemento que el ojo encuentra primero (por tamaño, color o posición) — todo lo demás es deliberadamente más silencioso.
- **La jerarquía se construye con múltiples señales alineadas, no una sola** — algo importante es simultáneamente más grande, más oscuro/con más contraste, y tiene más espacio alrededor; nunca depende de una sola variable haciendo todo el trabajo.
- **Contraste de peso, no solo de tamaño** — el mismo principio ya mencionado en tipografía (§2), aplicado a toda la interfaz: la diferencia entre "importante" y "secundario" se refuerza en varias dimensiones a la vez.

---

## 18. Responsive Principles

**Qué hacen los productos de referencia:**
- **Diseño desde el contenido, no desde el dispositivo** — los breakpoints existen donde el contenido lo pide (una línea de texto se vuelve incómoda de leer, una tarjeta se aprieta demasiado), no en números de ancho de pantalla arbitrarios memorizados de una convención genérica.
- **La versión móvil no es la versión de escritorio encogida** — cuando el contexto de uso cambia (una mano, una pantalla pequeña, atención fragmentada), la jerarquía de información se reconsidera, no solo se apila verticalmente.
- **Áreas táctiles generosas en móvil** (mínimo ~44×44px reales), independientemente de qué tan pequeño se vea el ícono visualmente dentro de esa área.

---

## Cierre — qué hacer con esto

Este documento no concluye con una recomendación, porque no le corresponde concluir nada — es investigación, no una decisión de producto. Su único propósito es que, si algún día (después de cerrar la Beta, con evidencia real de que la percepción visual importó) se decide invertir en dirección de arte, exista ya un mapa de principios extraído con cuidado, en vez de empezar esa conversación desde cero o desde el gusto personal del momento.

Ninguna sección de este documento se implementa. Ninguna se convierte en tarea. Ninguna modifica THÖREN. Queda aquí, esperando, como toda la evidencia de la Beta también espera en `THOREN_FINDINGS_DATABASE.md` — hasta que haya una razón real para mirarla de nuevo.
