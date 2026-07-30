# THÖREN — Motor Creativo (Especificación de Producto y Arquitectura)

**Fecha:** 2026-07-30
**Naturaleza de este documento:** especificación de producto y arquitectura, no implementación. Es la fuente de verdad para construir el sistema creativo real de THÖREN — suficientemente clara para convertirse después en un plan técnico sin reinterpretaciones, pero sin código, sin pantallas nuevas, sin tareas de programación.
**Precondición:** este documento asume como verdad ya aprobada `THOREN_PRODUCT_PHILOSOPHY.md`, `THOREN_EXPERIENCE_BLUEPRINT.md` e `THOREN_INTERACTION_SYSTEM.md`. No los reabre ni los contradice — al final de este documento hay una revisión explícita de consistencia contra los tres.

**La idea central, textual, que gobierna cada sección que sigue:**

> THÖREN no muestra plantillas guardadas. THÖREN improvisa propuestas nuevas a partir de recetas de estilo curadas, contenido real del usuario y reglas de composición paramétrica.

---

## 1. Propósito del motor creativo

El problema que resuelve no es "¿cómo organizamos mejor un catálogo?" — es "¿cómo evitamos tener un catálogo en absoluto?". Un catálogo, por bien organizado que esté, siempre convierte al usuario en alguien que busca entre archivos ajenos. El motor creativo existe para que, en cambio, cada propuesta se sienta compuesta en el momento, a partir de lo que esa persona específica acaba de contar — con su nombre, su ocasión, su contenido real ya integrado desde el primer instante.

Por qué no debe sentirse como una biblioteca de templates: una biblioteca invita a hojear, comparar y dudar entre opciones que no le pertenecen a nadie en particular hasta que se elige una. El motor creativo, en cambio, genera piezas que ya nacen personalizadas — nunca existe un estado "plantilla genérica esperando ser llenada" en ningún punto del sistema.

Por qué no debe sentirse como un editor tradicional: un editor le devuelve al usuario el trabajo de composición (elegir tipografía, color, disposición). El motor creativo hace ese trabajo por completo, en privado, y solo expone el resultado. La única decisión real que le queda a la persona es de gusto — cuál dirección ya terminada prefiere — nunca de construcción.

## 2. Principios no negociables

Estas diez reglas son restricciones permanentes de diseño del motor, no sugerencias:

1. El usuario nunca navega carpetas de estilos.
2. Los nombres internos de las recetas no se muestran por defecto.
3. Cada propuesta llega completamente resuelta.
4. El sistema propone antes de preguntar.
5. El usuario elige; THÖREN compone.
6. La velocidad es una restricción de producto.
7. La variedad nunca puede degradar la calidad.
8. Ninguna propuesta pasa a la interfaz sin validación.
9. El sistema nunca genera opciones de manera infinita.
10. El motor técnico de impresión permanece invisible.

## 3. Arquitectura general

Cinco componentes. Cada uno tiene una única responsabilidad y límites explícitos sobre qué decide y qué nunca decide.

### 3.1 Intérprete de intención

- **Responsabilidad:** convertir la frase libre del usuario en una estructura de intención utilizable por el resto del motor.
- **Entradas:** la frase completa del usuario; opcionalmente, un atajo de ocasión si tocó un chip.
- **Salidas:** ocasión/propósito, contenido personal (nombres, fecha, marca, producto, cantidad), señales explícitas de tono/color, restricciones dadas por el usuario.
- **Límites:** no decide estilo, no compone nada, no evalúa calidad.
- **Decisiones que toma:** qué segmento de la frase es contenido personal vs. ocasión; qué inferir razonablemente cuando falta un dato.
- **Decisiones que no puede tomar:** qué recetas de estilo activar (le corresponde al Selector); no genera composiciones.
- **Dependencias:** ninguna hacia atrás; alimenta al Selector de direcciones y al Motor de composición.
- **Criterios de éxito:** extrae correctamente ocasión + contenido personal en la gran mayoría de frases razonablemente completas, sin bloquear el flujo con preguntas salvo que sea genuinamente imposible inferir el contenido central.
- **Posibles fallas:** segmentación incorrecta de contenido personal (confundir el nombre de una marca con el de una persona) — mitigado aguas abajo por el Filtro de calidad (chequeo de fidelidad al contenido, sección 11).

### 3.2 Selector de direcciones

- **Responsabilidad:** elegir qué 4-5 recetas de estilo son relevantes para la ocasión detectada.
- **Entradas:** ocasión/propósito, señales de tono si existen.
- **Salidas:** una lista ordenada por relevancia de recetas activas para este lote.
- **Límites:** nunca activa las siete recetas a la vez salvo que la ocasión sea genuinamente genérica; no compone nada.
- **Decisiones que toma:** cuáles recetas activar y su orden de aparición.
- **Decisiones que no puede tomar:** el contenido de cada propuesta ni su validación de calidad.
- **Dependencias:** la tabla de afinidad (sección 6); recibe del Intérprete.
- **Criterios de éxito:** el subconjunto elegido se siente relevante y variado — nunca dos recetas casi idénticas en el mismo lote.
- **Posibles fallas:** ocasión no mapeada en la tabla — usa un conjunto genérico amplio de repliegue (Clásico, Moderno, Minimalista, Botánico) en vez de fallar o mostrar las siete.

### 3.3 Motor de composición

- **Responsabilidad:** producir una pieza terminada real combinando receta + contenido.
- **Entradas:** una receta activa, el contenido personal del usuario, un arquetipo de layout de esa receta.
- **Salidas:** una composición completa y renderizable.
- **Límites:** no decide qué recetas usar; no decide si el resultado es lo bastante bueno.
- **Decisiones que toma:** cómo distribuir el contenido dentro del arquetipo elegido, qué variante tipográfica/paleta exacta usar dentro de lo permitido por la receta.
- **Decisiones que no puede tomar:** salirse de las reglas de la receta activa.
- **Dependencias:** reutiliza el motor de layout/tipografía/gráficos ya existente en el sistema de impresión (ver sección 16).
- **Criterios de éxito:** cada composición es, por construcción, coherente con su receta y con el contenido real.
- **Posibles fallas:** contenido inusualmente largo o corto que no encaja en el arquetipo (mitigado en la sección 7).

### 3.4 Generador de variantes

- **Responsabilidad:** producir nuevas composiciones dentro de la misma receta cuando el usuario pide "más como esta".
- **Entradas:** la receta de la propuesta semilla, el contenido del usuario, la(s) composición(es) ya vista(s).
- **Salidas:** hasta 3 nuevas composiciones de la misma receta, distintas entre sí y respecto a la semilla.
- **Límites:** una sola ronda por dirección (sección 10); nunca cambia de receta.
- **Decisiones que toma:** qué combinación de arquetipo/motivo/matiz maximiza diferencia real manteniendo coherencia de familia.
- **Decisiones que no puede tomar:** mezclar recetas distintas en un mismo lote de variantes.
- **Dependencias:** Motor de composición (reutilizado con distintos parámetros); Filtro de calidad.
- **Criterios de éxito:** cada variante se siente como una idea nueva, nunca un recoloreado.
- **Posibles fallas:** agotar combinaciones distintas en una receta austera (mitigado exigiendo mínimo tres arquetipos válidos por receta desde su propio diseño).

### 3.5 Filtro de calidad

- **Responsabilidad:** aprobar, ajustar o rechazar cada composición antes de que llegue a la interfaz.
- **Entradas:** una composición generada.
- **Salidas:** una clasificación (secciones 11-12) y, si aplica, una versión ajustada automáticamente.
- **Límites:** no genera contenido nuevo; ajusta solo parámetros menores (espaciado, escala) — nunca reescribe el contenido del usuario.
- **Decisiones que toma:** aprobar, ajustar automáticamente, o rechazar y solicitar un nuevo intento al Motor.
- **Decisiones que no puede tomar:** qué receta o arquetipo probar a continuación tras un rechazo.
- **Dependencias:** recibe de Motor de composición y Generador de variantes; es el último paso antes de la interfaz.
- **Criterios de éxito:** cero composiciones de baja calidad llegan jamás a la persona.
- **Posibles fallas:** rechazo repetido de la misma receta/arquetipo — señal de una receta mal calibrada, para revisión manual del sistema, nunca visible al usuario.

---

## 4. Intérprete de intención

Información que debe extraer de la frase, cuando esté presente:

- Ocasión o propósito (boda, negocio, regalo, evento, producto).
- Contenido personal: nombres de personas.
- Marca (nombre de negocio o proyecto).
- Fecha, si se menciona.
- Producto físico al que se destina (etiqueta, sello, empaque) cuando se infiere del contexto.
- Cantidad, cuando sea relevante para decidir después si aplica la extensión de impresión en volumen (ver `THOREN_EXPERIENCE_BLUEPRINT.md`).
- Señales explícitas de tono ("elegante", "divertido", "sencillo").
- Señales explícitas de color ("en dorado", "en verde").
- Restricciones dadas por el usuario ("sin flores", "sin inglés").

**Regla general: THÖREN debe inferir todo lo razonable antes de hacer una pregunta adicional.** Comportamiento ante frases problemáticas:

- **Muy corta** ("etiquetas para mi negocio"): infiere el propósito genérico correspondiente (etiquetas de producto/negocio) y procede con el Selector en modo de repliegue amplio — nunca pide más detalle antes de mostrar algo.
- **Ambigua** ("algo bonito para mi mamá"): infiere "regalo personal", usa el nombre implícito ("mamá") como contenido si no hay otro nombre disponible, y continúa.
- **Incompleta** (falta la ocasión pero hay nombres): infiere ocasión genérica de regalo/celebración y sigue adelante — el contenido personal siempre pesa más que la etiqueta de la ocasión.
- **Informal o con errores** ("etiketas pa mi marka"): normaliza silenciosamente; el Intérprete nunca corrige ni comenta la ortografía del usuario.
- **Compuesta por fragmentos** ("velas. Regalo. Marcela"): trata cada fragmento como una señal independiente y los combina — no exige una oración gramatical completa.
- **Contradictoria** ("para mi boda, para mi negocio"): prioriza la primera ocasión mencionada; nunca pide que el usuario "elija una" explícitamente — eso rompería el principio 4 (el sistema propone antes de preguntar).

Solo cuando **el contenido central** (qué palabras deben aparecer en la pieza) sea genuinamente irrecuperable — frase vacía de contenido, o puramente abstracta sin ningún nombre/marca/tema— el sistema puede, como único caso, pedir una sola aclaración mínima. Esto debe ser la excepción, no el camino común.

## 5. Sistema de recetas de estilo

Cada receta es un sistema creativo compacto, nunca una carpeta de archivos. Los nombres son **internos** — nunca se muestran a la persona por defecto (principio 2).

### Elegante
- Intención visual: sofisticación cálida, atemporalidad, ligereza formal sin frialdad.
- Paletas permitidas: champán/marfil con acento metálico discreto (oro viejo, bronce); alternativa en tinta oscura sobre marfil.
- Parejas tipográficas: serifa fina de alto contraste para el elemento principal + sans humanista ligera para texto secundario.
- Arquetipos de composición: monograma centrado con anillo de texto; insignia enmarcada por línea fina doble.
- Motivos ornamentales: filete simple, orla mínima — nunca ilustraciones figurativas.
- Densidad: baja.
- Jerarquía: un solo elemento dominante, todo lo demás notablemente más discreto.
- Espaciado: márgenes generosos, tracking abierto en mayúsculas pequeñas.
- Usos recomendados: bodas, eventos formales, regalos corporativos de alto nivel.
- Usos a evitar: productos infantiles, alimentos informales, contextos industriales.
- Formalidad: alta. Expresividad: baja-media.

### Minimalista
- Intención visual: claridad absoluta, confianza silenciosa.
- Paletas: monocromía (negro/blanco/un gris) o un único acento plano.
- Parejas tipográficas: una sola familia sans geométrica, dos pesos, nunca dos familias distintas.
- Arquetipos: bloque de texto alineado a un lado; sello circular con un solo carácter o ícono simple.
- Motivos: ninguno, o una única forma geométrica.
- Densidad: mínima.
- Jerarquía: por tamaño y peso tipográfico, nunca por color adicional.
- Espaciado: retícula estricta, alineación exacta.
- Usos recomendados: marcas modernas, tecnología/diseño, cosmética minimalista.
- Usos a evitar: bodas tradicionales, contextos que buscan calidez artesanal.
- Formalidad: media. Expresividad: baja.

### Botánico
- Intención visual: organicidad, cercanía con lo natural y lo hecho a mano.
- Paletas: verde salvia, terracota suave, kraft/arena como fondo.
- Parejas tipográficas: serifa suave o script legible para el nombre + sans simple para detalles.
- Arquetipos: anillo o corona de hojas alrededor de un monograma; motivo floral en una esquina con texto asimétrico.
- Motivos: ilustraciones lineales de hojas, ramas, flores simples — nunca fotográficas.
- Densidad: media.
- Jerarquía: el motivo enmarca sin competir con el texto principal.
- Espaciado: orgánico, asimetrías intencionales.
- Usos recomendados: velas, cosmética natural, alimentos artesanales, regalos hechos a mano.
- Usos a evitar: productos industriales, tecnología, contextos muy formales.
- Formalidad: media-baja. Expresividad: media-alta.

### Clásico
- Intención visual: tradición, solidez, confianza heredada.
- Paletas: negro/tinta sobre blanco o marfil; acentos en dorado apagado o burdeos.
- Parejas tipográficas: serifa tradicional robusta para el nombre + la misma familia en versalitas para detalles.
- Arquetipos: sello ovalado o circular con doble filete; composición simétrica centrada.
- Motivos: filetes dobles, pequeñas cenefas geométricas — nunca ilustraciones orgánicas.
- Densidad: media.
- Jerarquía: fuertemente simétrica y centrada.
- Espaciado: regular, predecible.
- Usos recomendados: café, productos artesanales tradicionales, bautizos, negocios familiares.
- Usos a evitar: marcas que buscan sentirse disruptivas o ultramodernas.
- Formalidad: alta. Expresividad: baja-media.

### Moderno
- Intención visual: energía contemporánea, movimiento, seguridad.
- Paletas: contrastes marcados (negro + un color vibrante único), o duotonos.
- Parejas tipográficas: sans de peso variable, uso expresivo del peso como jerarquía.
- Arquetipos: composición asimétrica con bloques de color; texto a ángulo o layout deliberadamente roto.
- Motivos: formas geométricas simples — nunca ornamento clásico.
- Densidad: media.
- Jerarquía: por contraste de peso y color.
- Espaciado: dinámico, puede romper la retícula de forma controlada.
- Usos recomendados: ropa, negocios digitales, marcas jóvenes, productos industriales de diseño.
- Usos a evitar: bodas tradicionales, bautizos, contextos de calidez nostálgica.
- Formalidad: baja-media. Expresividad: alta.

### Vintage
- Intención visual: nostalgia cálida, artesanía de otra época.
- Paletas: tonos tierra desaturados, sepia, kraft, rojos y verdes envejecidos.
- Parejas tipográficas: serifa o script con carácter, combinada con slab o sans condensada retro.
- Arquetipos: sello tipo timbre postal o etiqueta de baúl antiguo; marco decorativo grueso.
- Motivos: texturas de papel envejecido, ilustraciones de estilo grabado.
- Densidad: media-alta.
- Jerarquía: el marco/orla compite visualmente de forma intencional con el texto — es parte del carácter.
- Espaciado: más apretado que Elegante, deliberadamente "lleno" pero ordenado.
- Usos recomendados: alimentos artesanales, café, productos hechos a mano, regalos con espíritu nostálgico.
- Usos a evitar: tecnología, minimalismo, marcas ultramodernas.
- Formalidad: media. Expresividad: alta.

### Premium
- Intención visual: exclusividad, peso, calidad percibida alta.
- Paletas: negro profundo, blanco puro, un único acento metálico frío (plata/oro frío, no dorado "vintage").
- Parejas tipográficas: serifa de lujo de alto contraste o sans ultra-refinada, con mucho tracking en mayúsculas.
- Arquetipos: monograma mínimo de gran tamaño; composición con muchísimo espacio negativo.
- Motivos: ninguno, o una única línea perfecta.
- Densidad: muy baja.
- Jerarquía: extremadamente simple — un solo elemento, todo lo demás casi ausente.
- Espaciado: el más generoso de todas las recetas.
- Usos recomendados: regalos corporativos de alto nivel, cosmética premium, productos industriales de gama alta.
- Usos a evitar: contextos informales, productos económicos, alimentos caseros.
- Formalidad: muy alta. Expresividad: muy baja (el lujo se comunica por ausencia, no por adorno).

## 6. Tabla de afinidad ocasión → recetas

El primer lote incluye normalmente entre 4 y 5 direcciones. No todas las recetas se activan para todos los casos.

| Ocasión / producto | Recetas activadas (orden de relevancia) |
|---|---|
| Bodas | Elegante, Clásico, Botánico, Vintage, Premium |
| Bautizos | Clásico, Elegante, Botánico, Vintage |
| Cumpleaños | Moderno, Botánico, Vintage, Minimalista |
| Velas | Botánico, Minimalista, Vintage, Premium |
| Cosméticos | Minimalista, Premium, Botánico, Moderno |
| Alimentos artesanales | Vintage, Botánico, Clásico, Moderno |
| Café | Clásico, Vintage, Botánico, Moderno |
| Ropa | Moderno, Minimalista, Premium, Vintage |
| Herramientas | Clásico, Moderno, Minimalista |
| Productos industriales | Minimalista, Moderno, Premium, Clásico |
| Regalos corporativos | Premium, Clásico, Elegante, Minimalista |
| Pequeños negocios (genérico) | Moderno, Clásico, Minimalista, Botánico, Vintage |
| Etiquetas de producto (genérico) | Moderno, Clásico, Botánico, Minimalista |
| Packaging | Botánico, Vintage, Premium, Moderno |

Cuando una ocasión no está en la tabla, se usa el repliegue genérico de "Pequeños negocios" (el conjunto más ampliamente aplicable).

## 7. Motor de composición paramétrica

Combina, en este orden lógico: contenido real del usuario → receta activa → arquetipo de layout elegido dentro de esa receta → pareja tipográfica permitida → paleta permitida → motivo ornamental (si aplica) → proporción y jerarquía según las reglas de espaciado de la receta → formato físico (definido por la ocasión/producto, no por la receta).

**Reutilización del motor técnico existente:** el motor de composición no se construye desde cero — reutiliza el sistema de layout, tipografía y elementos gráficos paramétricos que ya existe en el producto actual (el mismo que hoy arma las plantillas del catálogo). Se reutiliza como maquinaria interna e invisible; nunca se expone como superficie editable (ver sección 16).

**Reglas para evitar fallas conocidas de composición:**

- **Texto desbordado:** el arquetipo debe declarar de antemano su capacidad máxima de caracteres por campo; si el contenido la excede, se reduce la escala tipográfica dentro de los límites de legibilidad de la receta antes de truncar cualquier contenido — nunca se corta el nombre del usuario.
- **Jerarquía débil:** cada arquetipo define explícitamente cuál elemento es dominante; el motor nunca puede producir dos elementos del mismo peso visual compitiendo.
- **Composiciones repetitivas:** el Selector y el Generador de variantes nunca repiten el mismo arquetipo dos veces dentro del mismo lote o ronda.
- **Exceso de ornamento:** cada receta define un techo de densidad (sección 5); el motor no puede superarlo aunque el arquetipo lo permitiera visualmente.
- **Elementos sin relación semántica:** los motivos ornamentales de una receta están acotados a los declarados para ella — nunca se mezclan motivos de recetas distintas.
- **Contraste insuficiente:** validado por el Filtro de calidad (sección 11), no por el Motor mismo — el Motor solo debe operar dentro de paletas ya diseñadas para tener contraste suficiente.
- **Escalas incoherentes:** las proporciones relativas entre elementos están definidas por arquetipo, no calculadas libremente.
- **Resultados que parezcan templates genéricos:** se evita exigiendo que cada composición use el contenido real del usuario desde el primer render — nunca existe una versión "placeholder" que luego se reemplaza.

## 8. Generación del primer lote

Flujo completo: recepción de la frase → Intérprete extrae ocasión + contenido → Selector elige 4-5 recetas relevantes y su orden → por cada receta, el Motor de composición genera una pieza usando un arquetipo distinto → el Filtro de calidad valida cada una (sección 11) — cualquier rechazo dispara una nueva composición dentro de la misma receta antes de continuar → las piezas aprobadas se presentan en el orden de relevancia definido por el Selector, apareciendo una tras otra con el ritmo ya definido en `THOREN_INTERACTION_SYSTEM.md` (nunca todas de golpe, nunca con pausas largas entre ellas).

Cada propuesta del primer lote debe representar una dirección creativa realmente distinta — nunca la misma composición con colores diferentes. Esto está garantizado estructuralmente: cada propuesta proviene de una receta distinta, y las recetas difieren en paleta, tipografía, arquetipo y motivo simultáneamente, no en un solo eje.

## 9. Generación de variantes

"Más como esta" significa: generar nuevas composiciones dentro de la misma receta que la propuesta que despertó interés, nunca copias con un cambio cosmético.

**Debe mantenerse:** familia visual (paleta y pareja tipográfica de la receta), intención, tono, coherencia cromática.

**Debe cambiar de forma significativa:** arquetipo de composición, estructura, motivo, balance visual, énfasis, tratamiento del contenido dentro del arquetipo.

La transición hacia estas variantes es, en términos del Sistema de Interacción, una transición de **continuación** (la propuesta semilla se transforma/acompaña de sus hermanas en el mismo lugar de la pantalla) — nunca introduce un cuarto tipo de transición distinto a los tres ya definidos (continuación, acompañamiento, revelación), y nunca reutiliza la transición de revelación, reservada exclusivamente para el resultado final elegido.

## 10. Límites de exploración

Reglas formales:

- Máximo **una ronda** de variantes por dirección.
- Máximo **tres** variantes nuevas por ronda.
- Prohibido el scroll infinito de propuestas.
- Prohibida la generación especulativa (nunca se genera nada que el usuario no haya pedido con una acción explícita).
- Prohibido producir opciones nuevas mientras el usuario todavía está evaluando el lote actual.

**Cómo conducir hacia una decisión sin presionar:** si tras la única ronda de variantes permitida la persona todavía no elige, THÖREN no ofrece una segunda ronda ni un mensaje de urgencia — en vez de eso, resalta con calma (sin texto de advertencia, sin cuenta regresiva) la propuesta que más tiempo ha mirado o que tocó más de una vez, dándole más presencia visual momentánea, como una invitación silenciosa a decidir. Nunca se bloquea la posibilidad de seguir mirando las demás — solo se deja de ofrecer más alternativas nuevas.

## 11. Filtro de calidad creativa

Verificaciones obligatorias antes de que cualquier propuesta llegue a la interfaz:

- Legibilidad
- Contraste
- Desbordamiento de texto
- Alineación
- Balance visual
- Densidad (respecto al techo de la receta)
- Coherencia tipográfica
- Coherencia cromática
- Jerarquía
- Ausencia de colisiones entre elementos
- Compatibilidad con impresión (sangrado, área segura, línea de corte cuando el formato lo requiera — heredado del motor técnico existente)
- Fidelidad al contenido del usuario (que el nombre/marca real aparezca correctamente, sin errores de segmentación del Intérprete)
- Diferenciación frente a otras propuestas del mismo lote

Clasificación de resultados:

- **Fallas bloqueantes:** desbordamiento no corregible, colisión de elementos, contraste insuficiente sin ajuste posible, contenido del usuario alterado o ausente — la composición se descarta y se solicita un nuevo intento al Motor, nunca llega a la interfaz.
- **Advertencias corregibles automáticamente:** exceso leve de longitud de texto (se ajusta escala), densidad ligeramente por encima del techo (se reduce automáticamente un elemento secundario) — se corrigen en silencio antes de continuar.
- **Ajustes aceptables:** variaciones menores de proporción dentro de los márgenes ya definidos por el arquetipo — no requieren corrección, se aprueban tal cual.
- **Resultado rechazado:** cualquier composición con una falla bloqueante que no se resuelve tras un reintento razonable dentro de la misma receta — en ese caso, el Selector sustituye esa dirección por la siguiente receta relevante de la tabla de afinidad, nunca deja un hueco visible en el lote.

## 12. Modelo de calidad

Escala de clasificación para cada composición generada:

1. **Rechazada** — no cumple con las verificaciones obligatorias; nunca llega a ningún lado.
2. **Técnicamente correcta** — pasa las verificaciones mínimas pero no transmite la intención de la receta con fuerza.
3. **Visualmente competente** — se ve ordenada y correcta, pero genérica.
4. **Profesional** — se siente como el trabajo de alguien que sabe lo que hace; cumple la receta con intención clara.
5. **Sobresaliente** — además de profesional, tiene un acierto compositivo memorable (un balance particularmente logrado, una combinación especialmente afortunada de motivo y contenido).

**Solo las composiciones clasificadas como "Profesional" o "Sobresaliente" llegan al usuario.** "Técnicamente correcta" y "Visualmente competente" se tratan, a efectos de exposición a la interfaz, igual que un rechazo — disparan un nuevo intento, nunca se muestran como "la opción segura".

## 13. Rendimiento

La velocidad es una restricción de producto, no un detalle de implementación — ninguna demora artificial se introduce nunca para "aparentar trabajo" (esto también está prohibido explícitamente en `THOREN_INTERACTION_SYSTEM.md`). Objetivos preliminares:

- Interpretación de la frase: prácticamente instantánea (bajo un segundo).
- Composición de una pieza individual: near-instant, del orden de cientos de milisegundos.
- Validación de calidad por pieza: near-instant, ejecutándose en paralelo a la composición de las siguientes.
- Llegada de la primera propuesta visible: dentro de los primeros 2 segundos después de que la persona termina de contar su frase.
- Llegada del lote completo (4-5 propuestas): dentro de los primeros 4-5 segundos, apareciendo con el ritmo calmado ya definido, nunca todas exactamente al mismo tiempo.
- Generación de una ronda de variantes: comparable en velocidad al lote inicial — nunca sensiblemente más lenta, porque reutiliza la misma receta ya resuelta.

Estos objetivos existen para sostener, sin trampas, el "wow" del segundo 0:14 y la revelación del segundo 0:36 descritos en `THOREN_EXPERIENCE_BLUEPRINT.md`.

## 14. Casos límite

- **Texto demasiado largo:** se reduce escala tipográfica dentro de los límites de legibilidad de la receta; si aun así no cabe, se elige un arquetipo de la misma receta con mayor capacidad de texto en vez de truncar contenido.
- **Varios nombres:** el Intérprete los trata como una lista; el Motor usa el arquetipo de composición para múltiples nombres que cada receta ya contempla (p. ej. "X & Y").
- **Nombres con caracteres especiales:** se respetan tal cual (acentos, ñ, guiones) — nunca se normalizan ni se eliminan.
- **Contenido en distintos idiomas:** se conserva el idioma tal como lo escribió el usuario; el motor no traduce nada.
- **Marca sin nombre definido:** si la ocasión es "para mi negocio" sin nombre de marca, se usa el contenido disponible (p. ej. el nombre de la persona) como elemento central, nunca un placeholder genérico tipo "Tu Marca".
- **Petición demasiado genérica:** activa el conjunto de repliegue amplio de la sección 6, nunca bloquea pidiendo más detalle.
- **Petición incompatible con impresión** (por ejemplo, un tamaño físico absurdo): se resuelve en silencio ajustando al formato físico razonable más cercano — nunca se expone al usuario el motivo técnico.
- **Petición con demasiadas instrucciones** ("elegante pero moderno pero con flores pero minimalista"): se prioriza la primera preferencia explícita de tono mencionada y se ignoran las contradictorias posteriores sin señalarlo — nunca se le pide al usuario que resuelva su propia contradicción.
- **Preferencias estéticas contradictorias:** igual que el punto anterior — el sistema decide, no pregunta.
- **Contenido ofensivo o no permitido:** el Intérprete debe poder señalar contenido claramente inapropiado antes de que llegue al Motor; en ese caso se solicita una única aclaración (la única excepción real al principio 4), nunca se genera una pieza con ese contenido.
- **Ausencia de recetas suficientemente adecuadas:** si ninguna combinación alcanza "Profesional" tras reintentos razonables en varias recetas, el sistema recurre al conjunto de repliegue genérico antes que mostrar un resultado de menor calidad.

## 15. Relación con la interfaz

**La interfaz puede recibir:**
- Propuestas terminadas (listas para renderizar).
- Orden de aparición.
- Metadatos mínimos de selección (cuál propuesta fue tocada, cuál fue elegida).
- Estados de disponibilidad (lote listo, variante lista).
- Señal de que existen variantes disponibles para una dirección (para mostrar la invitación discreta "más como esta", nunca como una etiqueta técnica).

**La interfaz nunca debe mostrar por defecto:**
- El nombre técnico de la receta.
- Las reglas internas de la receta.
- Puntuaciones de calidad.
- Decisiones tipográficas o de composición tomadas.
- Parámetros de composición.
- Información de preflight.
- Jerga de impresión de cualquier tipo.

## 16. Relación con el motor de impresión existente

**Se conserva y se reaprovecha,** como maquinaria interna invisible:
- Composición paramétrica.
- Reglas de layout.
- Sistema tipográfico.
- Elementos gráficos.
- Preflight.
- Exportación.
- Preparación de impresión.

**Se retira de la experiencia principal** (puede seguir existiendo únicamente dentro de un eventual Modo Avanzado, nunca en el recorrido por defecto):
- Editor libre.
- Toolbar.
- Inspector.
- Panel de capas.
- Configuración manual técnica.
- Wizard de exportación de varios pasos.

## 17. Datos y aprendizaje futuro

Señales que valdría la pena registrar en el futuro para mejorar el motor (sin diseñar todavía analítica ni privacidad):

- Qué propuesta fue elegida, y de qué receta provenía.
- Qué propuestas fueron mostradas pero ignoradas.
- Qué direcciones recibieron una solicitud de "más como esta".
- Tiempo de decisión (desde que aparece el lote hasta que se elige).
- Abandono (si la persona sale sin obtener un resultado, y en qué punto).
- Tasa de solicitud de variantes.
- Tasa de aceptación directa del primer lote (sin pedir variantes).
- Cualquier corrección manual posterior, si en el futuro existiera algún ajuste ligero posible tras la revelación.

Estas señales importan porque son la única forma honesta de saber, con el tiempo, si la tabla de afinidad (sección 6) y las recetas (sección 5) siguen calibradas correctamente frente a necesidades reales — no para vigilar a la persona, sino para calibrar el motor.

## 18. Métricas de éxito

- Porcentaje de usuarios que eligen directamente del primer lote (sin pedir variantes).
- Porcentaje que solicita variantes.
- Tiempo hasta la primera propuesta.
- Tiempo hasta la selección.
- Tiempo hasta obtener el resultado.
- Porcentaje que termina el recorrido sin haber buscado ninguna herramienta de edición.
- Porcentaje que regresa a usar THÖREN de nuevo.
- Porcentaje que, al preguntársele, considera el resultado "profesional".
- Tasa de rechazo del Filtro de calidad (cuántas composiciones nunca llegan a mostrarse por cada una que sí llega — una tasa alta y estable es saludable; una tasa creciente indica recetas mal calibradas).

## 19. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Resultados genéricos | El Filtro de calidad exige "Profesional" o superior; "Visualmente competente" no es suficiente para mostrarse. |
| Repetición entre usuarios | El Generador de variantes y la variedad de arquetipos por receta reducen la probabilidad de que dos personas con la misma ocasión vean exactamente lo mismo. |
| Recetas demasiado rígidas | Cada receta debe definir mínimo tres arquetipos válidos desde su diseño inicial, no uno solo. |
| Demasiada variedad | Los límites de exploración (sección 10) acotan cuánta variedad puede llegar a ver una sola persona. |
| Insuficiente variedad | El Selector nunca activa recetas casi idénticas en el mismo lote; la tabla de afinidad se revisa si las métricas de la sección 18 muestran baja tasa de elección directa. |
| Lentitud | Los objetivos de la sección 13 son restricciones de producto, verificadas antes de cualquier lanzamiento de fase. |
| Falsa sensación de personalización | El contenido real del usuario se integra desde el primer render, nunca como reemplazo de un placeholder — la personalización debe ser genuina, no cosmética. |
| Tipografías inadecuadas | Cada receta define parejas tipográficas cerradas y curadas — el motor nunca elige tipografía libremente fuera de esa lista. |
| Dificultad para escalar a nuevas categorías | La arquitectura de receta + tabla de afinidad está diseñada para agregar nuevas ocasiones ampliando la tabla (sección 6), no rediseñando el motor. |
| Dependencia excesiva de reglas manuales | Aceptada deliberadamente en las fases tempranas (ver sección 20) a cambio de calidad garantizada; el aprendizaje basado en datos reales (sección 17) es la vía prevista para reducir esa dependencia con el tiempo. |
| Degradación de calidad al aumentar el catálogo creativo | Cada receta y arquetipo nuevo debe pasar por el mismo Filtro de calidad antes de integrarse — crecer el catálogo nunca baja el umbral de aceptación. |

## 20. Fases de construcción

**Fase 1 — Motor determinista mínimo.** Pocas recetas (2-3) y pocos arquetipos por receta, suficientes para validar que la composición paramétrica produce resultados "Profesionales" de forma consistente. Validación: revisión humana de una muestra representativa de composiciones generadas.

**Fase 2 — Variantes reales por dirección.** Se activa el Generador de variantes sobre las recetas ya validadas en la Fase 1. Validación: las variantes generadas deben pasar la prueba de "familia visual coherente, estructura significativamente distinta" ante revisión humana.

**Fase 3 — Filtro de calidad ampliado.** Se implementan todas las verificaciones de la sección 11 y la clasificación completa de la sección 12. Validación: tasa de rechazo estable y muestreo manual de lo aprobado vs. lo rechazado para calibrar el umbral.

**Fase 4 — Más ocasiones y productos.** Se amplía la tabla de afinidad (sección 6) y, si hace falta, se agregan recetas nuevas — nunca se relaja el Filtro de calidad para acomodar la expansión. Validación: cada ocasión nueva debe alcanzar la misma tasa de aprobación que las ya existentes antes de lanzarse.

**Fase 5 — Aprendizaje basado en decisiones reales.** Se incorporan las señales de la sección 17 para ajustar la tabla de afinidad y la calibración de recetas con datos de uso real, no solo con criterio de diseño inicial. Validación: mejoras medibles en las métricas de la sección 18 frente a la línea base de las fases anteriores.

Este orden es intencional: nunca se amplía el catálogo creativo (Fase 4) antes de que el Filtro de calidad esté completo (Fase 3), y nunca se automatiza aprendizaje (Fase 5) antes de tener un motor determinista confiable que sirva de base estable.

## 21. Criterio final

Toda decisión futura sobre este motor — de diseño, de implementación, o de expansión — se mide contra estas dos reglas:

> "THÖREN nunca delega en el usuario una decisión que un diseñador profesional tomaría por criterio propio."

> "El trabajo invisible de THÖREN es el trabajo que el usuario nunca tuvo que hacer."

---

## Revisión de consistencia

**Contra `THOREN_PRODUCT_PHILOSOPHY.md`:** consistente. El motor traduce directamente "preferir la suposición inteligente sobre exponer controles" (las recetas y el Selector deciden todo lo técnico/estético en privado) y "preferir eliminar pasos sobre simplificarlos" (nunca hay una pantalla de "elige tu estilo" — la variedad de estilos llega ya resuelta en el primer lote). El límite de una sola ronda de variantes (sección 10) es la aplicación directa de "el sistema nunca genera opciones de manera infinita".

**Contra `THOREN_EXPERIENCE_BLUEPRINT.md`:** consistente, con una extensión explícita y acotada. El Blueprint ya describe a Marcela recorriendo varias propuestas (segundo 0:20) antes de elegir (0:26); este documento no cambia esa escena — solo define, por primera vez, qué ocurre técnicamente detrás de "recorre las propuestas", y añade un branch opcional ("más como esta") dentro de ese mismo instante del recorrido, nunca como un paso nuevo en la línea de tiempo. El camino común — elegir directamente del primer lote — permanece exactamente como está descrito en el Blueprint, incluyendo sus tiempos (0:14 wow, 0:36 revelación). No se modifica ningún otro instante del guion.

**Contra `THOREN_INTERACTION_SYSTEM.md`:** consistente. La generación de variantes usa explícitamente la transición de "continuación" ya definida (sección 9 de este documento), nunca introduce un cuarto tipo de transición. La revelación permanece reservada exclusivamente al resultado final elegido — el motor creativo nunca la reutiliza para mostrar variantes ni para el primer lote. Ninguna propuesta se marca como "recomendada" (principio ya establecido en el Sistema de Interacción, reafirmado aquí en la sección 8). No se introduce ningún símbolo de carga abstracto — los objetivos de rendimiento (sección 13) existen precisamente para que nunca haga falta uno.

No se encontraron contradicciones que requirieran corrección antes de la entrega.
