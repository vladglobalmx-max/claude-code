# Template Batch 10 — Etsy Sellers (cierre) + Kids + Education (parcial) (Templates 46-50 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 46 a 50 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones. Ningún documento maestro fue tocado en este lote. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

**Nota de familia**: este lote introduce un registro **infantil/lúdico** dentro de la familia ya existente Audaz Gráfico — no una familia nueva. Audaz Gráfico se define en el Design Language Guide por "alto contraste, sin miedo al espacio ocupado, personalidad de marca fuerte"; hasta ahora esa energía se había expresado con negro + un acento (Cerveza, Salsa Picante). Kids y el Sello "Buen Trabajo" de Education expresan la misma energía y disciplina (colores vivos sin miedo a ocuparse el espacio, un solo ícono protagonista) con una paleta de 3 colores primarios/vivos en vez de negro dominante — mismo principio rector, distinta paleta, exactamente el mismo patrón ya usado para introducir el registro dorado de Wedding o los 3 registros de Crafts. También se confirma que Etsy Sellers, como categoría, abarca dos familias según el tono del vendedor (Artesanal Cálido para 14.1/14.2, ya visto en Batch 09; Lujo Silencioso/neutral para 14.3, este lote) — una distinción intencional, no una inconsistencia.

Este lote cierra Etsy Sellers (14.3), completa Kids en su totalidad (15.1-15.3), y abre Education con su primer template (16.1) — el segundo y último de Education (16.2) pasa al Batch 11.

Después de este lote se espera aprobación antes de continuar con el Batch 11. En paralelo, este Batch 10 abre también el trabajo de `THÖREN Bundle Strategy`, entregado como documento independiente junto con este lote.

---

## Template 46 — Empaque Artesanal Etsy

### 1. Concepto
No todo vendedor de Etsy tiene una estética kraft/artesanal (ya cubierta por Kraft Hecho a Mano, Template 44) — muchos venden producto de diseño moderno, ilustración digital o joyería minimalista, y necesitan un sticker de empaque genérico que no imponga una estética cálida que no corresponde a su marca. Este template resuelve ese caso: un cierre de empaque neutro, con espacio dominante de logo, para cualquier vendedor de marketplace sin importar su categoría de producto.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — misma paleta ya validada en Sello de Cierre (Template 26), confirmando que Etsy Sellers abarca dos familias según el tono del vendedor (ver nota de familia arriba).
- **Tipografía**: una sola familia sans-serif geométrica (recomendado: **Work Sans**, peso 500) para la línea de agradecimiento; el espacio de logo es gráfico, no tipográfico.
- **Paleta**: cobre `#9C4E27`, hueso `#F7F5EF`, carbón `#23282B`.
- **Estilo**: minimalista, agnóstico de categoría de producto.
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) espacio de logo (dominante, arriba), 2) línea de agradecimiento pequeña (abajo).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: ninguna provista por defecto — Nivel 0, el espacio de logo lo completa el usuario con su propio logo.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro con espacio de logo reservado.

### 3. Layout
- **Formato**: cuadrado de 40mm × 40mm.
- **Zonas**: dos tercios superiores (espacio de logo), tercio inferior (línea de agradecimiento).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 franjas horizontales (66% / 34%).
- **Proporciones**: la línea de agradecimiento nunca excede el 34% de la altura total.

### 4. Elementos
- Espacio de logo (a completar por el usuario)
- Línea de agradecimiento corta (ej. "Gracias por tu compra")

### 5. Assets necesarios
- Ninguno gráfico — se construye con tipografía y un espacio reservado para el logo propio del usuario.

### 6. Mockup
Caja de envío con relleno de papel, el sticker aplicado como cierre, luz de estudio neutra, fondo claro sin props adicionales.

### 7. Thumbnail
Sticker cuadrado solo sobre fondo blanco — con un placeholder de logo genérico (círculo o inicial) para representar el espacio reservado, sin implicar una marca real.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y un espacio de logo reservado para el usuario.

### 9. Exportación
- Tamaño final: 40mm × 40mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar.

### 10. Nivel de calidad
Premium aquí significa que la neutralidad se sienta deliberada, no como una plantilla sin terminar — el error más común a evitar es dejar el espacio de logo sin ninguna guía visual de proporción, lo cual generaría logos mal escalados entre distintos usuarios. Validación: comparar con Sello de Cierre (Template 26) — ambos deben sentirse de la misma familia neutra y agnóstica.

### 11. Commercial Sheet
- **Nombre comercial**: Etsy Neutral — Empaque Universal de Marketplace
- **Elevator Pitch**: Sticker de cierre neutro con espacio de logo dominante, para cualquier vendedor de Etsy sin importar su categoría de producto.
- **Beneficio principal**: No impone una estética cálida/artesanal que puede no corresponder a marcas de diseño moderno o minimalista.
- **Ideal para**: vendedores de Etsy de cualquier categoría (joyería, ilustración digital, diseño moderno) que no busquen la estética kraft.
- **Nivel de personalización**: Medio (logo propio del usuario, línea de agradecimiento editable).
- **Tiempo estimado de personalización**: 10 minutos (incluye incorporar el logo propio).
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de envío, bolsas de marketplace, empaques generales de e-commerce.
- **Palabras clave SEO**: sticker empaque etsy neutral, etiqueta cierre marketplace, template etsy moderno, sticker logo marketplace, packaging etsy minimalista, sticker empaque genérico etsy, etiqueta vendedor moderno, template etsy universal, packaging marketplace neutral, sticker cierre etsy, etiqueta empaque flexible, template etsy design, packaging vendedor diseño, sticker etsy logo espacio, etiqueta neutral marketplace, template empaque universal, packaging etsy cualquier categoría, sticker marketplace minimalista, etiqueta etsy genérica, template vendedor marketplace.
- **Categoría comercial**: Etsy Sellers.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta neutra ya validada en Sello de Cierre; layout con proporción de logo calibrada para evitar mal escalado; alternativa deliberada a la estética kraft del resto de Etsy Sellers.
- **Call to Action**: Tu marca, tu estilo — sin que el empaque decida por ti.

### 12. Production Checklist

**Diseño**
□ Layout terminado
□ Tipografía validada
□ Paleta validada
□ Jerarquía visual aprobada
□ Espaciados revisados
□ Assets completos

**Producción**
□ SVG final
□ Thumbnail
□ Mockup
□ Preview
□ Metadata
□ Prompt IA validado

**Impresión**
□ Bleed revisado
□ Safe Area revisada
□ Tamaño validado
□ Material recomendado
□ Resolución verificada

**QA**
□ Legibilidad
□ Contraste
□ Escalabilidad
□ Consistencia con la colección
□ Cumple estándar THÖREN

**Comercial**
□ Gumroad
□ Marketplace
□ Landing Page
□ SEO
□ Social Media

**Estado**
Diseño ☐ · Producción ☐ · QA ☐ · Publicado ☐

**Production Status: Concept Design Completed**

---

## Template 47 — Estrella de Buen Comportamiento

### 1. Concepto
Padres y maestros de educación básica usan sistemas de recompensa visual (tablas de comportamiento, seguimiento de tareas) para reforzar conducta positiva en niños — una estrella de recompensa necesita ser instantáneamente reconocible y emocionalmente positiva, sin ambigüedad de propósito ni sutileza de diseño.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico (ver nota de familia al inicio del documento).
- **Tipografía**: sin texto obligatorio en el diseño base (la estrella funciona sola); si se incluye texto corto (ej. "¡Bien hecho!"), usar sans-serif redondeada amigable (recomendado: **Fredoka**, mismo rol ya validado en Mermelada).
- **Paleta**: amarillo vivo `#F2C94C`, rojo vivo `#EB5757`, azul vivo `#2F80ED`.
- **Estilo**: audaz, alegre, sin miedo al color — máxima expresión de la familia Audaz Gráfico en su registro infantil.
- **Espaciados**: margen mínimo de 3mm respecto al área segura, compacto y directo.
- **Jerarquía**: 1) forma de estrella (dominante, todo el diseño), 2) texto opcional pequeño superpuesto.
- **Alineaciones**: centrada.
- **Formas**: **personalizado** — silueta de estrella de 5 puntas.
- **Iconografía**: la estrella misma es el ícono — Nivel 3 del Design Language Guide (gráfico de alto contraste, bordes duros, colores vivos planos).
- **Texturas**: ninguna.
- **Estilo visual**: gráfico plano de alto contraste, colores vivos.

### 3. Layout
- **Formato**: silueta de estrella de 5 puntas, 30mm de diámetro (medida punta a punta).
- **Zonas**: la estrella completa es una sola zona; texto opcional centrado.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — medida desde las puntas de la estrella, la zona de mayor riesgo de corte en esta forma.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: si se incluye texto, ocupa un máximo de 25% del área central de la estrella, sin invadir las puntas.

### 4. Elementos
- Silueta de estrella de 5 puntas
- Texto opcional corto (ej. "¡Bien hecho!")

### 5. Assets necesarios
- 1 silueta SVG de estrella de 5 puntas, proporciones geométricas limpias, color plano

### 6. Mockup
Tabla de comportamiento pegada en refrigerador, varias estrellas aplicadas junto a nombres/días, luz de cocina hogareña, fondo doméstico realista.

### 7. Thumbnail
Estrella sola sobre fondo blanco — el color vivo debe ser lo primero que capture la atención a tamaño de card.

### 8. Prompt para IA
Para la silueta de estrella:
> "Bold five-pointed star silhouette, clean geometric proportions, flat vivid color fill (yellow, red, or blue), hard clean vector edges, no gradients, cheerful children's reward sticker aesthetic, transparent background."

### 9. Exportación
- Tamaño final: 30mm de diámetro punta a punta (estrella).
- Sangrado: 3mm. Área segura: 3mm de margen interno, medida desde las puntas.
- Recomendación de impresión: vinil adhesivo brillante permitido (coherente con el registro infantil/lúdico, donde el brillo refuerza la sensación festiva, similar a la excepción ya documentada para Impacto Comercial).

### 10. Nivel de calidad
Premium aquí significa proporciones geométricas limpias en la estrella, no una silueta irregular o mal balanceada — el error más común a evitar es una estrella con puntas de tamaño desigual, que se ve poco profesional incluso en un contexto informal e infantil. Validación: la estrella debe verse simétrica y limpia a cualquier tamaño de reducción.

### 11. Commercial Sheet
- **Nombre comercial**: Star Reward — Estrella de Buen Comportamiento
- **Elevator Pitch**: Estrella de recompensa vibrante y reconocible al instante, para sistemas de comportamiento en casa o el salón de clases.
- **Beneficio principal**: Refuerza conducta positiva con un símbolo universalmente entendido por niños, sin ambigüedad de propósito.
- **Ideal para**: padres, maestros de educación básica.
- **Nivel de personalización**: Bajo (color y texto opcional editables).
- **Tiempo estimado de personalización**: 3 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Tablas de comportamiento, calendarios de tareas, cuadernos escolares.
- **Palabras clave SEO**: sticker estrella niños, etiqueta buen comportamiento, template reward star kids, sticker recompensa infantil, packaging tabla comportamiento, sticker estrella colorida, etiqueta buen trabajo niños, template estrella premio, packaging calendario tareas, sticker maestro recompensa, etiqueta estrella escolar, template kids reward, packaging comportamiento infantil, sticker estrella brillante, etiqueta premio niño, template estrella cinco puntas, packaging refrigerador tareas, sticker recompensa escolar, etiqueta estrella vivo color, template comportamiento positivo.
- **Categoría comercial**: Kids.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Silueta geométrica curada con proporciones validadas; sistema de color vivo consistente con el registro infantil de la familia Audaz Gráfico; layout calibrado para reducción sin pérdida de simetría.
- **Call to Action**: Una estrella que se gana, se nota y se celebra.

### 12. Production Checklist

**Diseño**
□ Layout terminado
□ Tipografía validada
□ Paleta validada
□ Jerarquía visual aprobada
□ Espaciados revisados
□ Assets completos

**Producción**
□ SVG final
□ Thumbnail
□ Mockup
□ Preview
□ Metadata
□ Prompt IA validado

**Impresión**
□ Bleed revisado
□ Safe Area revisada
□ Tamaño validado
□ Material recomendado
□ Resolución verificada

**QA**
□ Legibilidad
□ Contraste
□ Escalabilidad
□ Consistencia con la colección
□ Cumple estándar THÖREN

**Comercial**
□ Gumroad
□ Marketplace
□ Landing Page
□ SEO
□ Social Media

**Estado**
Diseño ☐ · Producción ☐ · QA ☐ · Publicado ☐

**Production Status: Concept Design Completed**

---

## Template 48 — Personaje Divertido

### 1. Concepto
La papelería escolar y productos infantiles (cuadernos, loncheras) se diferencian entre sí, para un niño, principalmente por el personaje o ilustración que llevan — no por el nombre de marca. Este template resuelve la necesidad de una marca infantil o de papelería escolar de tener un personaje amigable propio, sin necesitar un ilustrador de personajes contratado desde cero.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico.
- **Tipografía**: sin texto obligatorio — el personaje es el protagonista absoluto; si se incluye nombre de marca, usar sans-serif redondeada (recomendado: **Fredoka**), en tamaño notablemente menor al personaje.
- **Paleta**: rojo vivo `#EB5757`, azul vivo `#2F80ED`, amarillo vivo `#F2C94C` — paleta primaria idéntica a la Estrella de Buen Comportamiento, reforzando la coherencia visual dentro de la categoría Kids.
- **Estilo**: amigable, expresivo, colorido.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: 1) personaje ilustrado (dominante, ocupa casi todo el espacio), 2) nombre de marca opcional (pequeño, si aplica).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: un personaje ilustrado central con expresión amigable (Nivel 2-3 del Design Language Guide — color plano con posible gráfico de mayor detalle en la cara/expresión) — el nivel de detalle más alto permitido dentro del registro infantil, porque la expresión facial es lo que comunica "amigable".
- **Texturas**: ninguna.
- **Estilo visual**: ilustrativo de personaje, colores primarios vivos.

### 3. Layout
- **Formato**: círculo de 45mm de diámetro.
- **Zonas**: el personaje ocupa prácticamente el círculo completo; nombre de marca opcional en la base, si el espacio lo permite sin comprimir al personaje.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el personaje ocupa un mínimo de 85% del diámetro total — la ilustración es, en este template específicamente, la protagonista absoluta del catálogo entero.

### 4. Elementos
- Personaje ilustrado amigable (genérico, no un personaje con derechos de autor de terceros)
- Nombre de marca opcional (pequeño)

### 5. Assets necesarios
- 1 ilustración SVG de personaje amigable genérico, expresión positiva, colores primarios vivos, estilo consistente con el resto del registro infantil

### 6. Mockup
Cuaderno o lonchera infantil con el sticker aplicado, luz de estudio brillante y alegre, fondo colorido pero no saturado, contexto escolar/infantil reconocible.

### 7. Thumbnail
Personaje solo sobre fondo blanco — la expresión amigable debe ser evidente incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el personaje ilustrado:
> "Friendly, generic cartoon character (not based on any existing copyrighted character), simple flat-color illustration style, vivid primary color palette, warm and expressive friendly facial expression, clean vector edges, colorful children's sticker aesthetic, transparent background."

### 9. Exportación
- Tamaño final: 45mm × 45mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo brillante o mate, según preferencia — el registro infantil admite ambos acabados sin comprometer la percepción de calidad.

### 10. Nivel de calidad
Premium aquí significa un personaje genuinamente propio y expresivo, no un clip-art genérico de "mascota" descargado — el error más común a evitar es una expresión facial ambigua o neutra que no comunique claramente "amigable". Validación: mostrar el personaje a un niño real (o a alguien pensando como uno) y preguntar si se ve "simpático" — una respuesta ambigua indica que la expresión necesita más trabajo, no el color.

### 11. Commercial Sheet
- **Nombre comercial**: Buddy — Personaje Divertido para Marca Infantil
- **Elevator Pitch**: Personaje ilustrado amigable y colorido, listo para dar identidad a productos y papelería infantil.
- **Beneficio principal**: Da a tu marca infantil un personaje propio y expresivo sin necesitar contratar un ilustrador de personajes desde cero.
- **Ideal para**: marcas infantiles, papelería escolar, productos para niños.
- **Nivel de personalización**: Bajo (nombre de marca opcional; el personaje es fijo por diseño, con variantes de color disponibles).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cuadernos escolares, loncheras, mochilas, papelería infantil en general.
- **Palabras clave SEO**: sticker personaje infantil, etiqueta mascota niños, template character kids, sticker divertido colorido, packaging papelería escolar, sticker personaje amigable, etiqueta marca infantil, template buddy character, packaging cuaderno infantil, sticker mascota escolar, etiqueta personaje niños, template lonchera sticker, packaging marca niños, sticker cartoon amigable, etiqueta personaje expresivo, template papelería infantil, packaging mochila escolar, sticker mascota colorida, etiqueta character sticker, template personaje divertido niños.
- **Categoría comercial**: Kids.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Personaje ilustrado propio (no genérico de stock ni con derechos de terceros); paleta primaria consistente con el resto de la categoría Kids; expresión facial curada específicamente para transmitir calidez.
- **Call to Action**: Dale a tu marca infantil una cara que los niños quieran ver de nuevo.

### 12. Production Checklist

**Diseño**
□ Layout terminado
□ Tipografía validada
□ Paleta validada
□ Jerarquía visual aprobada
□ Espaciados revisados
□ Assets completos

**Producción**
□ SVG final
□ Thumbnail
□ Mockup
□ Preview
□ Metadata
□ Prompt IA validado

**Impresión**
□ Bleed revisado
□ Safe Area revisada
□ Tamaño validado
□ Material recomendado
□ Resolución verificada

**QA**
□ Legibilidad
□ Contraste
□ Escalabilidad
□ Consistencia con la colección
□ Cumple estándar THÖREN

**Comercial**
□ Gumroad
□ Marketplace
□ Landing Page
□ SEO
□ Social Media

**Estado**
Diseño ☐ · Producción ☐ · QA ☐ · Publicado ☐

**Production Status: Concept Design Completed**

---

## Template 49 — Cumpleaños Infantil

### 1. Concepto
Un padre organizando una fiesta de cumpleaños infantil necesita personalizar la bolsa de dulces o invitación con el nombre y la edad del festejado — un detalle personal que hace que la fiesta se sienta hecha a la medida, no comprada de un paquete genérico de artículos de fiesta.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico, con una paleta propia de fiesta (distinta de la paleta primaria de Estrella/Personaje, para diferenciar el contexto de celebración del contexto de recompensa/marca).
- **Tipografía**: display redondeada festiva (recomendado: **Fredoka**, peso 700) para el número de edad — el elemento más grande del diseño.
- **Paleta**: naranja festivo `#F2994A`, morado vivo `#9B51E0`, azul cielo `#56CCF2`.
- **Estilo**: festivo, celebratorio, con globos o confeti ilustrado.
- **Espaciados**: compacto, sin miedo a ocupar todo el espacio disponible.
- **Jerarquía**: 1) número de edad (dominante, el más grande de todo el diseño), 2) nombre del festejado, 3) globos/confeti ilustrado de fondo.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: globos o confeti ilustrado (Nivel 2 del Design Language Guide — color plano), como fondo/contexto, nunca compitiendo en tamaño con el número de edad.
- **Texturas**: ninguna.
- **Estilo visual**: festivo, colores vivos, ilustración de apoyo sin protagonismo.

### 3. Layout
- **Formato**: círculo de 40mm de diámetro.
- **Zonas**: centro (número de edad, dominante), banda inferior (nombre del festejado), fondo (globos/confeti ilustrado, detrás de todo).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, número de edad como ancla central.
- **Proporciones**: el número de edad ocupa un mínimo de 50% del diámetro total — nunca menor, para que sea editable (1 dígito o 2) sin perder dominancia.

### 4. Elementos
- Número de edad (editable, 1-2 dígitos)
- Nombre del festejado
- Ilustración de globos o confeti de fondo

### 5. Assets necesarios
- 1 ilustración SVG de globos y/o confeti, color plano, estilo festivo consistente con la paleta de fiesta

### 6. Mockup
Bolsa de dulces de fiesta infantil, el sticker aplicado como cierre, luz de estudio brillante y alegre, fondo de mesa de fiesta con elementos festivos genéricos desenfocados.

### 7. Thumbnail
Sticker circular solo sobre fondo blanco — el número de edad debe ser lo primero y más grande que se perciba a tamaño de card.

### 8. Prompt para IA
Para la ilustración de globos/confeti:
> "Flat, colorful illustration of party balloons and confetti, vivid festive color palette (orange, purple, sky blue), simple flat-color shapes, playful children's birthday party aesthetic, designed to sit as a background layer behind large bold text without competing with it, transparent background."

### 9. Exportación
- Tamaño final: 40mm × 40mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo brillante o mate.

### 10. Nivel de calidad
Premium aquí significa que el número de edad, aunque editable dígito a dígito, mantenga siempre la misma dominancia visual — el error más común a evitar es que un número de 2 dígitos (ej. "10") se vea proporcionalmente más pequeño que uno de 1 dígito (ej. "5"), rompiendo la consistencia entre distintas edades. Validación: producir una prueba con edad de 1 dígito y otra de 2 dígitos — ambas deben verse igual de dominantes en el diseño.

### 11. Commercial Sheet
- **Nombre comercial**: Party Age — Etiqueta de Cumpleaños Infantil
- **Elevator Pitch**: Sticker festivo y colorido con nombre y edad, para personalizar cada bolsa de dulces del cumpleaños de tu hijo.
- **Beneficio principal**: Hace que la fiesta se sienta hecha a la medida del festejado, con un detalle personal en cada bolsa.
- **Ideal para**: padres organizando fiestas infantiles.
- **Nivel de personalización**: Alto (nombre y edad varían por cada fiesta — el template está diseñado para producirse una sola vez por evento, no en lote de variantes).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Bolsas de dulces de fiesta, invitaciones, cajas de regalo de cumpleaños infantil.
- **Palabras clave SEO**: sticker cumpleaños infantil, etiqueta fiesta niños, template birthday kids, sticker edad personalizada, packaging bolsa dulces fiesta, sticker fiesta colorida, etiqueta cumpleaños personalizado, template party age, packaging invitación infantil, sticker globos confeti, etiqueta nombre edad niño, template fiesta cumpleaños, packaging dulces cumpleaños, sticker festivo infantil, etiqueta cumpleaños circular, template bolsa fiesta niños, packaging cumpleaños personalizado, sticker número edad, etiqueta party kids, template fiesta infantil personalizada.
- **Categoría comercial**: Kids.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Sistema de número de edad calibrado para mantener dominancia visual con 1 o 2 dígitos; paleta festiva propia, distinta de la paleta de recompensa de Estrella/Personaje; ilustración de fondo diseñada para no competir con el texto.
- **Call to Action**: Que cada bolsa de dulces lleve el nombre del cumpleañero, no solo dulces.

### 12. Production Checklist

**Diseño**
□ Layout terminado
□ Tipografía validada
□ Paleta validada
□ Jerarquía visual aprobada
□ Espaciados revisados
□ Assets completos

**Producción**
□ SVG final
□ Thumbnail
□ Mockup
□ Preview
□ Metadata
□ Prompt IA validado

**Impresión**
□ Bleed revisado
□ Safe Area revisada
□ Tamaño validado
□ Material recomendado
□ Resolución verificada

**QA**
□ Legibilidad
□ Contraste
□ Escalabilidad
□ Consistencia con la colección
□ Cumple estándar THÖREN

**Comercial**
□ Gumroad
□ Marketplace
□ Landing Page
□ SEO
□ Social Media

**Estado**
Diseño ☐ · Producción ☐ · QA ☐ · Publicado ☐

**Production Status: Concept Design Completed**

---

## Template 50 — Sello "Buen Trabajo"

### 1. Concepto
Un maestro de educación básica retroalimenta decenas de tareas por semana — un sello de "buen trabajo" reutilizable es más rápido que escribir un comentario cada vez, y para el estudiante, un símbolo de reconocimiento visual reconocible es más motivador que una palabra escrita a mano apurada.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico — mismo principio que Kids, aplicado aquí al contexto escolar de retroalimentación en vez de recompensa doméstica o fiesta.
- **Tipografía**: sans-serif redondeada amigable (recomendado: **Fredoka**, peso 600) para "¡Buen trabajo!".
- **Paleta**: verde de aprobación `#27AE60`, amarillo vivo `#F2C94C`, blanco `#FFFFFF` — paleta propia de la categoría Education, distinta de la paleta de Kids, para diferenciar el contexto escolar formal del contexto doméstico/festivo.
- **Estilo**: alegre pero funcional — más contenido que Kids (menos ilustración, más texto/símbolo claro), coherente con su uso repetitivo en muchas tareas.
- **Espaciados**: margen de 3mm respecto al área segura, compacto.
- **Jerarquía**: 1) texto "¡Buen trabajo!" o ícono de check (dominante), 2) estrella pequeña de apoyo (refuerzo, nunca protagonista).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: un ícono de check o estrella pequeña (Nivel 3 del Design Language Guide — gráfico de alto contraste), uno solo, no ambos simultáneamente como protagonistas.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico de alto contraste, colores vivos pero contenidos (2 colores de acento, no 3 como Kids).

### 3. Layout
- **Formato**: círculo de 25mm de diámetro (menor que los templates de Kids, pensado para aplicarse repetidamente en la esquina de una hoja de tarea, no como elemento decorativo grande).
- **Zonas**: centro (texto o ícono, dominante), borde (estrella o check pequeño de apoyo).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el elemento de apoyo (estrella/check) ocupa un máximo de 20% del diámetro total.

### 4. Elementos
- Texto "¡Buen trabajo!" o variante corta
- Ícono de check o estrella pequeña (uno solo)

### 5. Assets necesarios
- 1 ícono SVG de check de alto contraste, y 1 alternativo de estrella pequeña (el usuario elige uno, no ambos)

### 6. Mockup
Hoja de tarea escolar con el sticker aplicado en la esquina superior, luz de escritorio/salón de clases, fondo de hoja de cuaderno real con escritura de ejemplo desenfocada.

### 7. Thumbnail
Sticker circular solo sobre fondo blanco — el mensaje de aprobación debe ser instantáneo, incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el ícono de check:
> "Bold, friendly checkmark icon, rounded and approachable (not sharp/corporate), vivid green color, high contrast, cheerful teacher-feedback sticker aesthetic, transparent background."

Para el ícono alternativo de estrella pequeña:
> "Small friendly star icon, rounded and approachable style matching a companion checkmark icon, vivid yellow color, transparent background, suitable as a small supporting accent."

### 9. Exportación
- Tamaño final: 25mm × 25mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o brillante, cualquier material estándar de uso escolar repetitivo (debe soportar aplicación frecuente).

### 10. Nivel de calidad
Premium aquí significa que el sello se sienta cálido y genuino, no como un sello de oficina genérico reutilizado para contexto escolar — el error más común a evitar es una tipografía demasiado corporativa o un ícono de check demasiado angular/frío, que rompería la calidez esperada en retroalimentación a un niño. Validación: comparar con Estrella de Buen Comportamiento (Template 47) — ambos deben sentirse del mismo registro infantil/lúdico, aunque uno sea de contexto doméstico y el otro escolar.

### 11. Commercial Sheet
- **Nombre comercial**: Buen Trabajo — Sello de Retroalimentación Escolar
- **Elevator Pitch**: Sello circular alegre y rápido de aplicar, para reconocer el buen trabajo de tus estudiantes en cada tarea.
- **Beneficio principal**: Ahorra tiempo de retroalimentación manual mientras da a los estudiantes un símbolo de reconocimiento visual claro y motivador.
- **Ideal para**: maestros de educación básica.
- **Nivel de personalización**: Bajo (texto e ícono elegido entre 2 opciones).
- **Tiempo estimado de personalización**: 3 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Hojas de tarea, exámenes, cuadernos de trabajo escolar.
- **Palabras clave SEO**: sticker buen trabajo, etiqueta retroalimentación escolar, template teacher sticker, sticker maestro reconocimiento, packaging tarea escolar, sticker check aprobado, etiqueta buen trabajo niños, template good job sticker, packaging examen escolar, sticker estrella maestro, etiqueta reconocimiento estudiante, template retroalimentación tarea, packaging cuaderno trabajo, sticker aprobado escolar, etiqueta buen trabajo circular, template sello maestro, packaging hoja de tarea, sticker feedback positivo, etiqueta escolar reconocimiento, template buen trabajo estudiante.
- **Categoría comercial**: Education.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Sistema de 2 íconos intercambiables (check/estrella) con estilo consistente; paleta propia de Education distinta de Kids, diferenciando contexto escolar de contexto doméstico; formato calibrado para aplicación repetitiva de alto volumen.
- **Call to Action**: Reconoce el esfuerzo de tus estudiantes en el mismo instante en que lo ves.

### 12. Production Checklist

**Diseño**
□ Layout terminado
□ Tipografía validada
□ Paleta validada
□ Jerarquía visual aprobada
□ Espaciados revisados
□ Assets completos

**Producción**
□ SVG final
□ Thumbnail
□ Mockup
□ Preview
□ Metadata
□ Prompt IA validado

**Impresión**
□ Bleed revisado
□ Safe Area revisada
□ Tamaño validado
□ Material recomendado
□ Resolución verificada

**QA**
□ Legibilidad
□ Contraste
□ Escalabilidad
□ Consistencia con la colección
□ Cumple estándar THÖREN

**Comercial**
□ Gumroad
□ Marketplace
□ Landing Page
□ SEO
□ Social Media

**Estado**
Diseño ☐ · Producción ☐ · QA ☐ · Publicado ☐

**Production Status: Concept Design Completed**

---

## Cierre del lote

5 de 63 templates completados en este lote (Batch 10: template 14.3 — cierra Etsy Sellers en su totalidad — templates 15.1 a 15.3 — cierra Kids en su totalidad — y template 16.1 de Education). El template 16.2 (Etiqueta de Útiles Escolares) pasa al Batch 11 junto con el inicio de Holiday.

Progreso acumulado: 50 de 63 templates completados (Batch 01 a Batch 10).

**A la espera de aprobación antes de continuar con Batch 11** (Etiqueta de Útiles Escolares — cierra Education — + 4 templates de Holiday).

**Nota de planeación comercial**: tal como se indicó, este Batch 10 abre en paralelo el trabajo de `THÖREN Bundle Strategy` — entregado junto con este lote como documento independiente.
