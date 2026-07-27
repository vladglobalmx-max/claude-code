# Template Batch 01 — Food & Beverage (Templates 1-5 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los primeros 5 templates de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

Después de este lote se espera aprobación antes de continuar con el Batch 02.

---

## Template 1 — Café de Especialidad — Origen Único

### 1. Concepto
Un tostador de café de especialidad compite, visualmente, contra marcas internacionales (Blue Bottle, Intelligentsia, Onyx) que invirtieron millones en identidad de marca — pero vende en lotes de 20-50 bolsas. El problema real: una etiqueta amateur en una bolsa de café de $18 USD comunica "producto casero", no "producto premium", y el precio no se sostiene. Este template existe para que un tostador pequeño pueda comunicar procedencia (finca, altitud, proceso) con el mismo lenguaje visual reservado/editorial que usan las marcas grandes, sin necesitar un diseñador. Café es, además, la categoría de mayor volumen de reorden dentro de Food & Beverage — el mismo cliente reimprime esta etiqueta cada vez que cambia de origen o lote, así que el template debe ser fácil de reeditar, no solo bonito una vez.

### 2. Dirección de Arte
- **Tipografía**: display serif con carácter editorial para el nombre de la finca/origen (recomendado: **Fraunces**, óptico "soft", peso 500-600 — transmite calidez artesanal sin perder seriedad). Sans-serif humanista para notas de cata y datos técnicos (recomendado: **Work Sans**, peso 400-500, todo minúsculas para las notas de cata, versalitas para el proceso).
- **Paleta**: base neutra tierra — espresso `#3C2A21`, tostado `#D5B893`, crema `#F4E9DA`. Un cuarto color de acento **intercambiable por lote** (ej. terracota `#B5651D` para proceso lavado, salvia `#7C9070` para proceso natural) — el sistema debe soportar recolorear ese único acento sin tocar el resto de la paleta, para que el mismo template sirva para distintos orígenes/procesos sin rediseñar.
- **Estilo**: minimalista editorial, "lujo silencioso" — nunca saturado, nunca con más de 2 pesos tipográficos simultáneos en pantalla.
- **Espaciados**: margen generoso (mínimo 4mm de aire alrededor de cualquier bloque de texto respecto al área segura); ningún elemento toca el borde del área segura directamente.
- **Jerarquía** (de mayor a menor peso visual): 1) nombre de finca/origen, 2) nombre de la tostaduría (lockup de marca), 3) notas de cata, 4) datos técnicos (proceso, altitud, peso neto, fecha de tueste).
- **Alineaciones**: composición centrada, siguiendo la curvatura del círculo (texto en arco superior e inferior).
- **Formas**: un solo círculo de troquel — sin formas secundarias.
- **Iconografía**: un único ícono lineal de grano de café (grosor de trazo constante, ~1.5pt a tamaño real), nunca más de un ícono en el diseño.
- **Texturas**: grano de papel sutil (opacidad 4-6%) detrás de la tipografía, para evitar el aspecto "vector plano digital" — nunca sobre el propio texto (perdería legibilidad).
- **Estilo visual**: ilustración de línea fina estilo botánico/editorial, un solo color de tinta para el ícono (el mismo que el acento de proceso).

### 3. Layout
- **Formato**: círculo de 50mm de diámetro (mismo tamaño que el template de fábrica `builtin_circle-5x5` ya existente — consistencia de tamaño físico esperado por el usuario).
- **Zonas**: arco superior (nombre de finca, 0-90°), centro (ícono de grano + nombre de tostaduría), arco inferior (notas de cata), banda inferior fija (proceso · altitud · peso neto, en una sola línea de datos técnicos separados por punto medio "·").
- **Márgenes**: sangrado 3mm más allá del troquel; área segura con 3mm de margen interno respecto al troquel — ningún texto cruza esa línea (ver arquitectura de safe area ya implementada, `checkSafeAreaForPage`).
- **Retícula**: circular, centrada en el centro geométrico de la página; el texto en arco sigue un radio interior fijo (aprox. 80% del radio del troquel) para que siempre quede dentro del área segura sin importar la longitud del nombre de finca.
- **Proporciones**: el ícono central ocupa no más del 20% del diámetro total, para que la tipografía siga siendo la protagonista.

### 4. Elementos
- Nombre de finca/origen (texto editable, ej. "Finca La Esperanza")
- Nombre de la tostaduría (lockup de marca — logotipo o wordmark, placeholder editable)
- Notas de cata (3 descriptores cortos, ej. "chocolate · naranja · caramelo")
- Tipo de proceso (washed / natural / honey — campo corto)
- Altitud (opcional, ej. "1,700 msnm")
- Peso neto (ej. "340g")
- Fecha de tueste (campo de fecha corto)
- Ícono de grano de café

### 5. Assets necesarios
- 1 ilustración SVG de grano de café, estilo línea fina, trazo constante, en negro puro (para poder recolorear libremente en el editor)
- 1 textura de grano de papel sutil, formato PNG/SVG, tileable, en escala de grises para poder aplicarse a baja opacidad
- No se requiere fotografía para el diseño del template en sí (solo para el mockup, ver §6)

### 6. Mockup
Bolsa de café kraft con válvula de desgasificación, vista de 3/4 (no frontal plana — el ángulo comunica "producto real en la mano", no catálogo), luz natural direccional suave desde la izquierda (temperatura cálida, ~3500K simulados), apoyada sobre una superficie de madera clara o lino natural, con 3-4 granos de café enteros dispersos junto a la bolsa fuera de foco (profundidad de campo reducida, f/2.8 simulado) para dar contexto sin competir con la etiqueta. Fondo desenfocado neutro, sin elementos de cocina genéricos de stock.

### 7. Thumbnail
Recorte cerrado sobre la etiqueta circular sola (no la bolsa completa) — la etiqueta ocupa ~80% del cuadro del thumbnail, centrada, sobre un fondo sólido crema (`#F4E9DA`) liso, sin la bolsa ni el mockup completo. A tamaño de grid (card pequeña) debe leerse el nombre de finca y el ícono del grano sin esfuerzo — si a 200px de ancho el texto en arco no se lee, el tamaño de fuente del layout necesita subir, no el thumbnail necesita recortarse más.

### 8. Prompt para IA
Para el ícono de grano de café (línea fina, vectorial, para posterior conversión a SVG limpio):
> "Minimalist single-line illustration of one coffee bean, continuous thin line art, consistent 1.5pt stroke weight, no shading, no fill, pure black on transparent background, editorial botanical illustration style, centered composition, vector-clean edges suitable for tracing to SVG."

Para la textura de grano de papel:
> "Subtle fine paper grain texture, seamless tileable, grayscale, very low contrast, natural uncoated paper feel, no visible pattern repetition artifacts, suitable for 5-8% opacity overlay."

### 9. Exportación
- Tamaño final: 50mm × 50mm (círculo inscrito).
- Sangrado: 3mm en los 4 lados (estándar THÖREN).
- Área segura: margen interno de 3mm respecto al troquel — todo texto/ícono debe quedar dentro.
- Recomendación de impresión: vinil adhesivo mate o papel kraft adhesivo (nunca brillante — el brillo compite con la estética editorial mate de este template); resolución mínima de exportación 300 PPI real.

### 10. Nivel de calidad
Lo que hace que este template se sienta premium: la restricción — un solo color de acento, un solo ícono, tipografía con jerarquía de máximo 2 familias. El error más común a evitar: agregar una segunda ilustración "para llenar espacio" (una taza de café, una planta) — el espacio negativo generoso ES la señal de calidad, llenarlo la destruye. Validación del estándar THÖREN: si al ver el template a tamaño real (50mm) alguien pensaría "esto lo hizo un estudio de branding", pasa; si parece un clip-art de café con texto encima, no pasa.

---

## Template 2 — Miel Artesanal de Productor Local

### 1. Concepto
Un apicultor o productor de mercado agrícola vende un producto 100% natural, pero compite en el mismo anaquel/mesa que marcas industriales con envases idénticos. El problema: sin una etiqueta que comunique "hecho por una persona, no por una fábrica", el precio premium de la miel artesanal (típicamente 2-3x el precio de supermercado) no se justifica a primera vista. Este template existe para comunicar calidez humana y origen floral específico en el mismo vistazo de 2 segundos que tiene un comprador frente a una mesa de mercado.

### 2. Dirección de Arte
- **Tipografía**: script cálido y legible para el nombre del productor/marca (recomendado: **Caveat** o **Reenie Beanie** — manuscrito pero sin sacrificar legibilidad a tamaño de etiqueta pequeña), serif suave para el nombre de la variedad floral (recomendado: **Lora**, peso 400).
- **Paleta**: dorado miel `#D98E28`, marrón oscuro `#5C3A21`, crema muy pálido `#FFF3D6`.
- **Estilo**: cálido, hecho a mano, nunca corporativo — el opuesto deliberado del Template 1 (café) en tono, aunque comparten la misma disciplina de jerarquía.
- **Espaciados**: más compacto que el template de café — el formato es más pequeño (frasco de 250g), pero mantiene un margen mínimo de 3mm respecto al área segura en todo momento.
- **Jerarquía**: 1) nombre de la variedad floral (ej. "Miel de Azahar"), 2) ilustración de abeja/panal, 3) nombre del productor, 4) peso neto.
- **Alineaciones**: composición centrada verticalmente, simétrica.
- **Formas**: círculo de troquel.
- **Iconografía**: una abeja ilustrada en línea simple, o alternativamente un panal hexagonal simplificado — nunca ambos a la vez (elegir uno por versión para no saturar).
- **Texturas**: ninguna textura de fondo — el dorado sólido ya aporta calidez, una textura adicional competiría con el color.
- **Estilo visual**: ilustración de línea orgánica, trazos ligeramente irregulares (no geometría perfecta) para reforzar la sensación de "hecho a mano".

### 3. Layout
- **Formato**: círculo de 50mm de diámetro.
- **Zonas**: tercio superior (ilustración de abeja/panal), tercio medio (nombre de variedad floral, tipografía más grande del diseño), tercio inferior (nombre del productor + peso neto en una línea).
- **Márgenes**: sangrado 3mm, área segura 3mm de margen interno.
- **Retícula**: división horizontal en 3 franjas iguales dentro del área segura, sin líneas divisorias visibles — la división es solo de composición, no un elemento gráfico.
- **Proporciones**: la ilustración de abeja ocupa max. 25% de la altura total.

### 4. Elementos
- Nombre de la variedad floral (ej. "Miel de Azahar", "Miel de Mil Flores")
- Nombre del productor/marca
- Peso neto (ej. "250g")
- Ilustración de abeja o panal (una sola, no ambas)
- Opcional: ubicación/región de origen, en texto muy pequeño bajo el nombre del productor

### 5. Assets necesarios
- 1 ilustración SVG de abeja, estilo línea orgánica
- 1 ilustración SVG alternativa de panal hexagonal simplificado (para que el usuario elija cuál usar, no ambas a la vez)

### 6. Mockup
Frasco de vidrio hexagonal pequeño con tapa metálica dorada, luz cálida difusa desde arriba (simula luz de ventana de cocina/mercado), fondo de madera clara o mantel de mercado agrícola desenfocado, ángulo ligeramente picado (cámara arriba mirando hacia abajo ~15°) para mostrar la textura dorada de la miel a través del vidrio como contexto secundario (fuera de foco, sin competir con la etiqueta).

### 7. Thumbnail
Etiqueta circular sola, centrada, sobre fondo sólido dorado pálido — mismo criterio que Template 1: debe leerse "Miel de [Variedad]" a tamaño de card sin esfuerzo.

### 8. Prompt para IA
Para la ilustración de abeja:
> "Simple organic line illustration of a single bee, slightly irregular hand-drawn line quality (not perfectly geometric), single continuous line style, warm and friendly character, pure black line on transparent background, no shading, no fill, suitable for tracing to clean SVG."

Para la ilustración alternativa de panal:
> "Simplified hexagonal honeycomb pattern illustration, minimal line art, 3-4 hexagons clustered, hand-drawn organic line quality, pure black on transparent background, no fill, no shading."

### 9. Exportación
- Tamaño final: 50mm × 50mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo con acabado mate o satinado (evitar brillo especular fuerte, que puede leerse como plástico barato sobre un producto que se vende como natural).

### 10. Nivel de calidad
Premium se logra aquí con calidez sin caer en "infantil" — la línea de la abeja debe sentirse dibujada por un ilustrador, no ser un clip-art genérico de stock. Error a evitar: usar una fotografía de abeja o miel en vez de ilustración — rompe la consistencia del sistema con los demás templates de la categoría y generalmente se ve más barato, no más premium. Validación: comparar lado a lado con el Template 1 (café) — ambos deben sentirse parte de la misma "familia" de calidad aunque el tono sea distinto.

---

## Template 3 — Cerveza Artesanal — Estilo IPA

### 1. Concepto
Las cervecerías artesanales pequeñas compiten visualmente contra marcas con presupuestos de diseño de agencia (Stone, Dogfish Head, BrewDog) en el mismo anaquel de tienda. El problema: una lata sin identidad visual fuerte se pierde completamente entre decenas de otras IPAs. Este template existe para dar a una microcervecería un sistema de etiqueta de alto impacto visual —el estilo de cerveza en sí demanda audacia, no sutileza, a diferencia de café o miel— sin requerir un ilustrador de etiquetas contratado.

### 2. Dirección de Arte
- **Tipografía**: condensada de alto impacto para el nombre de la cerveza (recomendado: **Anton** o **Bebas Neue**, todo mayúsculas), monoespaciada técnica para los datos (ABV/IBU) (recomendado: **JetBrains Mono** o **Space Mono**, refuerza la sensación "de laboratorio/técnica" que el mercado craft asocia con seriedad cervecera).
- **Paleta**: negro casi puro `#1A1A1A`, dorado/ámbar de lúpulo `#E8A33D`, blanco roto `#FAFAF5`. Acento intercambiable por estilo de cerveza (el mismo dorado para IPA, podría rotarse a un tono más oscuro para stout en una variación futura del mismo template).
- **Estilo**: audaz, alto contraste, sin miedo al espacio ocupado — el opuesto del minimalismo de café/miel; aquí "más presencia visual" sí es la estrategia correcta porque así se comporta la categoría en el mercado real.
- **Espaciados**: más ajustado que los templates anteriores — la etiqueta de lata tiene menos margen de respiración por convención de categoría, pero el área segura de 3mm se respeta igual, sin excepción.
- **Jerarquía**: 1) nombre de la cerveza (dominante), 2) ilustración/ícono central (lúpulo o marca), 3) estilo de cerveza (IPA), 4) datos técnicos (ABV, IBU) en banda inferior de alto contraste.
- **Alineaciones**: centrada, con la banda de datos técnicos ocupando todo el ancho como un bloque sólido de color contrastante.
- **Formas**: rectángulo vertical (formato de etiqueta envolvente o frontal de lata).
- **Iconografía**: un ícono de lúpulo estilizado o un ícono de marca abstracto — nunca ambos.
- **Texturas**: opcional, textura sutil tipo "grano" o "ruido" al 3-5% sobre el fondo oscuro para evitar planitud digital en superficies grandes de color sólido.
- **Estilo visual**: gráfico/vectorial de alto contraste, bordes duros, sin degradados suaves (los degradados leen como "diseño de PowerPoint", no como diseño de etiqueta craft).

### 3. Layout
- **Formato**: rectangular, proporción vertical 7:10 aprox. (formato de etiqueta envolvente de lata de 355ml — ancho menor, alto mayor).
- **Zonas**: tercio superior (nombre de la cervecería, pequeño), franja central (nombre de la cerveza, dominante, + ilustración de lúpulo), banda inferior de alto contraste (estilo + ABV + IBU en una sola línea condensada).
- **Márgenes**: sangrado 3mm en los 4 lados; área segura 3mm — crítico en este formato porque una etiqueta envolvente de lata sufre distorsión en los bordes al aplicarse sobre una superficie curva, así que ningún elemento crítico debe acercarse al borde de sangrado.
- **Retícula**: 3 franjas horizontales (cabecera de marca, cuerpo de nombre, pie de datos técnicos), sin columnas — es un layout de una sola columna, alineado al centro.
- **Proporciones**: la banda de datos técnicos ocupa un 15% fijo de la altura total, siempre del mismo tamaño relativo sin importar la longitud del nombre de la cerveza (evita que un nombre largo empuje los datos técnicos fuera del área segura).

### 4. Elementos
- Nombre de la cervecería (pequeño, cabecera)
- Nombre de la cerveza (dominante)
- Estilo de cerveza (ej. "IPA", "Hazy IPA", "Double IPA")
- ABV (% de alcohol)
- IBU (unidades de amargor, opcional)
- Ilustración de lúpulo o ícono de marca

### 5. Assets necesarios
- 1 ilustración SVG de lúpulo, estilo gráfico de alto contraste (no línea fina — debe funcionar a alto contraste sólido)
- Alternativa: 1 ícono de marca abstracto genérico (geométrico) para cervecerías que prefieran no usar iconografía de lúpulo literal

### 6. Mockup
Lata de aluminio de 355ml, vista frontal recta (a diferencia de los mockups en ángulo de café/miel — el formato de lata se comunica mejor de frente, mostrando la curvatura natural del aluminio en los bordes), con condensación/gotas de agua sutiles sobre la superficie (simula "recién refrigerada"), iluminación de estudio de alto contraste (no luz cálida difusa como los templates anteriores — aquí el contraste duro refuerza la identidad audaz), fondo oscuro casi negro para que la lata "flote" con presencia.

### 7. Thumbnail
Recorte de la etiqueta desenvuelta (plana, no aplicada a la lata) sobre fondo negro sólido — a diferencia de los templates anteriores, aquí SÍ conviene mostrar el contraste alto del diseño desde el thumbnail mismo, ya que es la propuesta de valor central del template (impacto visual).

### 8. Prompt para IA
Para la ilustración de lúpulo:
> "Bold high-contrast graphic illustration of a single hop cone, hard clean vector edges, no soft gradients, flat solid fill style, craft beer label aesthetic, suitable for a single or two-color print reproduction, transparent background."

Para el ícono de marca abstracto alternativo:
> "Abstract geometric brewery mark, bold hard-edged shapes, single color, high contrast, modern craft beer branding style, no gradients, no photorealism, vector-clean for SVG tracing."

### 9. Exportación
- Tamaño final: 100mm × 143mm aprox. (etiqueta envolvente para lata de 355ml — ancho de circunferencia de lata estándar, ajustable).
- Sangrado: 3mm. Área segura: 3mm de margen interno, con margen adicional recomendado de +2mm extra en los bordes laterales específicamente por la distorsión de aplicación sobre superficie curva.
- Recomendación de impresión: vinil resistente a la humedad/condensación (relevante porque el producto se refrigera) o impresión directa en lata si el flujo de producción del cliente lo permite — nota aclaratoria en la documentación de entrega, no una limitación del template en sí.

### 10. Nivel de calidad
Premium en esta categoría se ve distinto que en café/miel: aquí es la ejecución del alto contraste sin verse "genérico craft beer clip-art" — el error más común a evitar es un lúpulo ilustrado con demasiado detalle fotorrealista (se ve como stock art, no como diseño de marca). Validación: el diseño debe funcionar igual de bien reproducido en un solo color (blanco sobre negro) que a todo color — si pierde impacto en un solo color, la jerarquía no está bien resuelta.

---

## Template 4 — Mermelada Casera de Temporada

### 1. Concepto
Quien vende mermelada casera en lotes pequeños (ferias, mercados, encargos) necesita comunicar dos cosas a la vez en un frasco de 250g: qué sabor es (de un vistazo, sin leer) y que fue hecho con cuidado artesanal, no en una planta industrial. El problema es de reconocimiento rápido — en una mesa con 8 sabores distintos, el comprador decide en segundos cuál llevar, y necesita distinguir "fresa" de "durazno" sin leer letras pequeñas. Este template resuelve eso con un sistema de ilustración de fruta que cambia por sabor sobre una estructura fija.

### 2. Dirección de Arte
- **Tipografía**: display redondeada y amigable para el nombre del sabor (recomendado: **Fredoka** peso 500, o **Quicksand** peso 600 — ambas cálidas sin ser infantiles), sans-serif simple para la fecha de elaboración (recomendado: **Work Sans**, igual que Template 1, por consistencia entre templates de la misma categoría amplia).
- **Paleta base**: fondo crema `#FFFDF7`, texto oscuro `#2B2216`. El color de acento **cambia según la fruta** (frambuesa `#A6243A`, durazno `#F2994A`, uva `#6C3483`) — el sistema debe soportar recolorear ese acento sin rediseñar el layout, exactamente como el acento de proceso del Template 1.
- **Estilo**: ilustrado, cálido, casero — con más color que café/miel pero sin llegar al alto contraste audaz de la cerveza.
- **Espaciados**: compacto (frasco pequeño de 250g), margen mínimo de 3mm respetado siempre.
- **Jerarquía**: 1) ilustración de la fruta (ocupa el centro, es el reconocimiento visual instantáneo), 2) nombre del sabor, 3) anillo perimetral con el nombre del productor.
- **Alineaciones**: centrada, ilustración dominante en el centro con texto en anillo perimetral (mismo patrón estructural que Template 1, pero con ilustración a color en vez de ícono de línea).
- **Formas**: círculo de troquel.
- **Iconografía**: una ilustración de la fruta correspondiente, a color plano (no línea fina como café) — aquí SÍ conviene color porque la fruta es la señal de reconocimiento inmediato.
- **Texturas**: ninguna — el color plano de la fruta ya aporta calidez suficiente.
- **Estilo visual**: ilustración de fruta en estilo plano/geométrico simplificado (no fotorrealista, no clip-art detallado) — 2-3 tonos por fruta máximo.

### 3. Layout
- **Formato**: círculo de 50mm de diámetro.
- **Zonas**: centro (ilustración de fruta, ocupa ~45% del diámetro), anillo perimetral superior (nombre del sabor, siguiendo la curva), anillo perimetral inferior (nombre del productor).
- **Márgenes**: sangrado 3mm, área segura 3mm.
- **Retícula**: circular concéntrica — círculo central para la ilustración, anillo exterior para el texto, sin elementos fuera de esas dos zonas.
- **Proporciones**: la ilustración de fruta nunca excede el 50% del diámetro total, para dejar suficiente anillo de texto legible.

### 4. Elementos
- Ilustración de fruta (varía por sabor — fresa, durazno, uva, zarzamora, etc., como un set de variantes del mismo template)
- Nombre del sabor (ej. "Mermelada de Fresa")
- Nombre del productor/marca
- Fecha de elaboración (campo corto)
- Opcional: "Sin conservadores" u otro sello corto de honestidad de producto

### 5. Assets necesarios
- Set de 6-8 ilustraciones de fruta a color plano (fresa, durazno, uva, zarzamora, higo, ciruela, manzana, cereza) — mismo estilo gráfico consistente entre todas, para que el sistema se sienta como una familia, no ilustraciones sueltas de distintas fuentes

### 6. Mockup
Frasco de vidrio pequeño clásico con tapa metálica a rayas (rojo/blanco o similar, look "de abuela" auténtico, no genérico), luz natural suave desde una ventana lateral, sobre una tabla de madera rústica con un paño de cocina de lino desenfocado al fondo, y opcionalmente 2-3 piezas de la fruta correspondiente junto al frasco (fuera de foco) para reforzar el sabor sin competir con la etiqueta.

### 7. Thumbnail
Etiqueta circular sola sobre fondo crema — como los anteriores, pero aquí el color de la fruta debe ser lo primero que el ojo detecta en el grid, ya que es la señal de diferenciación entre sabores dentro del mismo template.

### 8. Prompt para IA
Para el set de ilustraciones de fruta (ejemplo con fresa, repetir patrón por cada fruta):
> "Flat, simplified illustration of a single strawberry, 2-3 flat color tones maximum, geometric simplified shape (not photorealistic, not detailed clip-art), clean vector edges, warm handmade jam-label aesthetic, transparent background, consistent illustration style suitable for a matching set of fruit illustrations (peach, grape, blackberry, fig, plum, apple, cherry) at the same level of simplification and line weight."

### 9. Exportación
- Tamaño final: 50mm × 50mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo resistente a humedad (el frasco puede sudar en refrigeración) — mate o satinado.

### 10. Nivel de calidad
Premium aquí significa que el set de frutas se vea diseñado como sistema, no como ilustraciones descargadas de distintos bancos de imágenes con estilos inconsistentes — error más común a evitar exactamente ese: mezclar niveles de detalle entre frutas (una simple, otra muy detallada) rompe la sensación de producto profesional. Validación: poner las 6-8 variantes de fruta lado a lado — deben verse como si las hubiera dibujado la misma mano el mismo día.

---

## Template 5 — Salsa Picante Gourmet

### 1. Concepto
Las salsas picantes artesanales/gourmet compiten en un mercado saturado de marcas con personalidad visual fuerte (marcas como Cholula, Tapatío o boutiques de "hot sauce" en Etsy) — el comprador espera que el diseño comunique nivel de picor y personalidad antes de leer el ingrediente. El problema: sin un sistema visual de "nivel de picor" reconocible, el comprador no puede decidir rápido entre varias salsas de la misma marca en una repisa. Este template resuelve eso con un indicador visual de picor integrado a la estructura, no un texto suelto.

### 2. Dirección de Arte
- **Tipografía**: display condensada con actitud para el nombre de la salsa (recomendado: **Oswald**, peso 600, mayúsculas), sans-serif simple para ingredientes/descripciones (recomendado: **Work Sans**).
- **Paleta**: rojo picante `#C1272D`, negro `#1F1F1F`, crudo cálido `#FFEDD5`. El nivel de picor se comunica con **intensidad del rojo** (más oscuro = más picante) además del indicador gráfico de §4, dando dos señales redundantes para reconocimiento instantáneo.
- **Estilo**: gráfico y directo, con un toque de humor visual permitido (a diferencia de café/miel, aquí un poco de personalidad/actitud es parte de la categoría).
- **Espaciados**: layout vertical alargado, compacto, con el indicador de picor SIEMPRE en la misma posición relativa sin importar el nombre de la salsa (para que una fila de productos de la misma marca sea escaneable).
- **Jerarquía**: 1) nombre de la salsa, 2) ilustración de chile, 3) indicador de nivel de picor (escala visual), 4) descripción corta/ingrediente destacado.
- **Alineaciones**: centrada, composición vertical de arriba hacia abajo.
- **Formas**: rectángulo vertical alargado (etiqueta de botella).
- **Iconografía**: ilustración de chile estilizada + un sistema de indicador de picor (ver §4) — son dos elementos gráficos distintos con roles distintos, no redundantes entre sí.
- **Texturas**: ninguna — el contraste de color ya cumple la función de llamar la atención.
- **Estilo visual**: gráfico plano de alto contraste, bordes duros, sin degradados.

### 3. Layout
- **Formato**: rectangular vertical, proporción aprox. 1:2.2 (etiqueta de botella alargada tipo "hot sauce").
- **Zonas**: cabecera (nombre de la marca, pequeño), cuerpo superior (nombre de la salsa, dominante), cuerpo medio (ilustración de chile), banda de indicador de picor (posición fija, siempre en el mismo lugar relativo), pie (ingrediente destacado o descripción corta).
- **Márgenes**: sangrado 3mm, área segura 3mm.
- **Retícula**: una sola columna, 5 franjas horizontales de proporción fija (cabecera 10%, nombre 25%, ilustración 30%, indicador de picor 15%, pie 20%).
- **Proporciones**: el indicador de picor mantiene su tamaño y posición constantes en todas las variantes de picor de la misma marca — solo cambia cuántos segmentos están "llenos", nunca su ubicación.

### 4. Elementos
- Nombre de la marca (cabecera, pequeño)
- Nombre de la salsa (dominante)
- Ilustración de chile
- Indicador de nivel de picor (escala visual de 1 a 5, ej. 5 chiles pequeños donde algunos están "llenos" y otros en contorno — sistema editable por variante)
- Ingrediente destacado o descripción corta (ej. "Habanero + Mango")
- Volumen neto (ej. "148ml")

### 5. Assets necesarios
- 1 ilustración SVG de chile, estilo gráfico de alto contraste (bordes duros, sin degradado)
- 1 set de íconos pequeños de chile para el indicador de nivel de picor (mismo ícono repetido, en 2 estados: lleno/contorno)

### 6. Mockup
Botella de vidrio alargada tipo "hot sauce", vista frontal ligeramente en ángulo (3/4, similar a café pero con más dramatismo de luz), iluminación de contraste medio-alto con una sombra direccional marcada (no luz plana difusa), sobre una superficie oscura (madera oscura o pizarra), con 1-2 chiles frescos enteros junto a la botella para reforzar el producto (nítidos, no desenfocados — a diferencia de los mockups anteriores, aquí el elemento de apoyo puede estar en foco porque refuerza directamente el mensaje de picor).

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo negro o rojo oscuro sólido — el alto contraste debe ser evidente incluso a tamaño de card pequeña, ya que es la propuesta central del template.

### 8. Prompt para IA
Para la ilustración de chile principal:
> "Bold flat graphic illustration of a single chili pepper, hard clean vector edges, no gradients, high contrast solid fill, playful but confident attitude, hot sauce label aesthetic, transparent background, suitable for single or two-color print reproduction."

Para el ícono pequeño del indicador de picor (versión llena y versión contorno):
> "Tiny simplified chili pepper icon, two versions: one solid filled silhouette, one outline-only version with identical proportions, flat vector style, no shading, for use as a repeated 1-to-5 spice-level indicator, transparent background."

### 9. Exportación
- Tamaño final: 60mm × 130mm aprox. (etiqueta de botella alargada, ajustable según la botella específica del cliente).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil resistente a manchas/salpicaduras (relevante por el uso en cocina), acabado mate o satinado.

### 10. Nivel de calidad
Premium aquí es la disciplina del sistema de picor — debe sentirse como un sistema de packaging real (piénsese en una línea de producto coherente), no una etiqueta aislada. Error a evitar: hacer el indicador de picor decorativo en vez de funcional (si los "chiles llenos" no comunican claramente la escala de un vistazo, falla su propósito). Validación: mostrar 3 variantes del mismo template con distinto nivel de picor una junto a otra — un comprador debe poder ordenar de "menos picante" a "más picante" en menos de 2 segundos solo mirando el indicador, sin leer texto.

---

## Cierre del lote

5 de 63 templates completados (Batch 01, categoría Food & Beverage — templates 1.1 a 1.5 de `TEMPLATE_CATALOG_v1.md`). El template 1.6 (Té de Hierbas Orgánico) pasa al Batch 02 junto con Cosmetics, para no romper el ritmo de lotes de 5 a la mitad de una categoría innecesariamente.

**A la espera de aprobación antes de continuar con Batch 02** (Té de Hierbas Orgánico + 4 templates de Cosmetics).
