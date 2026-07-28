# Template Batch 12 — Holiday (cierre) + Seasonal + QR & Smart Labels (parcial) (Templates 56-60 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 56 a 60 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones. Ningún documento maestro fue tocado en este lote. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

**Nota de familia**: San Valentín cierra Holiday dentro del mismo registro festivo/estacional de Audaz Gráfico ya usado en Navidad, Año Nuevo, Día de Muertos y Halloween. Seasonal introduce una división interesante: Verano y Regreso a Clases permanecen en Audaz Gráfico (brillante, sin miedo al color — Regreso a Clases además reutiliza exactamente la paleta ya validada en la Etiqueta de Útiles Escolares, Template 51), mientras que Otoño se clasifica en Artesanal Cálido (reutilizando el acento `#D98E28` ya visto en Miel Artesanal) porque su carácter es cálido/acogedor, no festivo/audaz — la misma lógica dual ya aplicada a Etsy Sellers en Batch 10. QR & Smart Labels abre con Menú Digital QR en la familia Técnico Funcional, porque un código QR tiene una restricción real de legibilidad (zona de silencio, contraste mínimo para escaneo) —la misma lógica de "convención antes que estética" ya aplicada a Advertencia General y Rombo Normado, aunque aquí la convención es técnica de escaneo, no normativa legal.

Este lote cierra Holiday (17.5) y Seasonal (18.1-18.3) en su totalidad, y abre QR & Smart Labels con su primer template (19.1) — los 3 restantes de QR & Smart Labels (19.2-19.4) pasan al Batch 13, el lote final del catálogo.

Después de este lote se espera aprobación antes de continuar con el Batch 13 — el último lote de producción de contenido, tras el cual se ejecutará la auditoría integral ya anunciada.

---

## Template 56 — San Valentín

### 1. Concepto
La temporada de San Valentín impulsa venta de regalo/empaque de febrero para comercios pequeños de chocolate, flores y regalo — un sticker en forma de corazón necesita comunicar calidez romántica de forma directa y reconocible, cerrando el ciclo de Holiday con el mismo registro festivo que Navidad, Año Nuevo, Día de Muertos y Halloween ya establecieron.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional.
- **Tipografía**: sin texto obligatorio — el corazón funciona solo; si se incluye mensaje corto, usar script cálida (recomendado: **Caveat**, mismo rol ya usado en Miel y Sello "Hecho en Casa") para un tono personal romántico.
- **Paleta**: rojo `#C0392B`, rosa suave `#F7CAC9`, blanco `#FFFFFF`.
- **Estilo**: romántico, cálido, directo — más suave que Halloween/Día de Muertos, pero igual de festivo que Navidad.
- **Espaciados**: margen de 3mm respecto al área segura, medido desde el contorno del corazón.
- **Jerarquía**: 1) forma de corazón con textura o patrón sutil (dominante), 2) mensaje corto opcional.
- **Alineaciones**: centrada.
- **Formas**: **personalizado** — silueta de corazón.
- **Iconografía**: patrón sutil interno (puntos, líneas finas o textura decorativa ligera dentro del corazón — Nivel 2 del Design Language Guide), nunca un ícono figurativo adicional superpuesto.
- **Texturas**: patrón sutil interno del corazón (no textura de fondo tradicional, sino un patrón decorativo propio de la forma).
- **Estilo visual**: gráfico festivo de color plano con patrón interno sutil.

### 3. Layout
- **Formato**: silueta de corazón, aproximadamente 35mm × 32mm.
- **Zonas**: la silueta completa es la zona principal; mensaje corto opcional centrado.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, medida desde el contorno del corazón — atención especial en la muesca superior central del corazón, zona de mayor riesgo de corte en esta forma.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el mensaje corto opcional, si se incluye, ocupa un máximo de 25% del área central, sin invadir el contorno.

### 4. Elementos
- Silueta de corazón con patrón o textura sutil
- Mensaje corto opcional (ej. "Con amor")

### 5. Assets necesarios
- 1 patrón sutil vectorial para el interior del corazón (puntos, líneas finas), diseñado específicamente para adaptarse a la geometría de corazón sin distorsión

### 6. Mockup
Caja de chocolates o regalo pequeño de San Valentín, el sticker en forma de corazón aplicado sobre el envoltorio, luz cálida romántica, superficie de mesa con elementos suaves de temporada (pétalos, listón) desenfocados al fondo.

### 7. Thumbnail
Corazón solo sobre fondo blanco — el patrón interno debe ser visible pero no dominante incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el patrón interno del corazón:
> "Subtle decorative pattern (small dots or fine lines) designed specifically to fill a heart-shaped silhouette without distortion, warm red and soft pink color palette, romantic Valentine's Day sticker aesthetic, clean vector edges, transparent background outside the heart shape."

### 9. Exportación
- Tamaño final: aprox. 35mm × 32mm (silueta de corazón).
- Sangrado: 3mm. Área segura: 3mm de margen interno, con atención a la muesca superior (ver §3).
- Recomendación de impresión: vinil adhesivo brillante o mate.

### 10. Nivel de calidad
Premium aquí significa un corazón con proporciones geométricas limpias y un patrón interno que refuerce sin saturar — el error más común a evitar es un corazón con curvas asimétricas (un lóbulo más grande que el otro) o un patrón interno tan denso que oscurezca la forma. Validación: la silueta debe verse simétrica y limpia, y el patrón debe leerse como textura, no como ilustración compitiendo por atención.

### 11. Commercial Sheet
- **Nombre comercial**: San Valentín — Sticker Romántico en Forma de Corazón
- **Elevator Pitch**: Sticker en forma de corazón con patrón cálido sutil, listo para regalos y productos de la temporada de San Valentín.
- **Beneficio principal**: Cierra el ciclo de las 5 festividades del catálogo con el mismo nivel de calidez reconocible al instante.
- **Ideal para**: comercios y particulares en temporada de febrero.
- **Nivel de personalización**: Bajo (mensaje corto opcional editable).
- **Tiempo estimado de personalización**: 3 minutos.
- **Dificultad de impresión**: Intermedia (troquelado de silueta de corazón requiere precisión en la muesca superior).
- **Productos compatibles**: Cajas de chocolates, regalos pequeños, empaques de temporada de febrero.
- **Palabras clave SEO**: sticker san valentín, etiqueta corazón regalo, template valentine sticker, sticker amor febrero, packaging chocolates san valentín, sticker corazón patrón, etiqueta romántico regalo, template san valentín corazón, packaging regalo febrero, sticker corazón rojo rosa, etiqueta amor comercio, template valentine day, packaging caja chocolates, sticker corazón silueta, etiqueta san valentín circular, template regalo romántico, packaging temporada febrero, sticker corazón cálido, etiqueta valentine gift, template corazón festivo.
- **Categoría comercial**: Holiday.
- **Colección**: Holiday Collection.
- **Premium Features**: Silueta de corazón con proporciones geométricas curadas; patrón interno diseñado específicamente para la forma, no una textura genérica adaptada; cierra el sistema completo de 5 festividades del catálogo con consistencia de familia.
- **Call to Action**: Que el regalo se note con amor antes de abrirse.

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

## Template 57 — Verano

### 1. Concepto
Negocios con oferta estacional (heladerías, bebidas frías, ropa de playa) necesitan comunicar la temporada de verano sin atarse a una fecha festiva fija — a diferencia de Holiday (fechas específicas), Seasonal cubre una ventana de temporada más amplia y flexible.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional — mismo registro de Holiday, aplicado aquí a una temporada sin fecha fija en vez de una festividad puntual.
- **Tipografía**: sin texto obligatorio — el motivo funciona solo; si se incluye texto, usar sans-serif redondeada (recomendado: **Fredoka**) en tono ligero.
- **Paleta**: amarillo sol `#F2C94C`, azul cielo `#56CCF2`, blanco `#FFFFFF`.
- **Estilo**: luminoso, cálido, ligero.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: un solo nivel — el motivo ilustrativo es el diseño completo.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: sol o elemento tropical ilustrado (Nivel 2-3 del Design Language Guide, color plano), uno solo por versión.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico luminoso de color plano.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro completo ocupado por el motivo.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el motivo ocupa un mínimo de 75% del diámetro total.

### 4. Elementos
- Ilustración de sol o elemento tropical (una sola variante por versión)

### 5. Assets necesarios
- 1 ilustración SVG de sol estilizado, y 1 alternativa de elemento tropical (hoja de palma, por ejemplo), color plano, estilo consistente

### 6. Mockup
Vaso de bebida fría o producto de playa, el sticker aplicado, luz natural brillante de exterior, fondo desenfocado de ambiente veraniego (playa o alberca genérica).

### 7. Thumbnail
Sticker circular solo sobre fondo blanco o azul cielo — el motivo debe transmitir luminosidad inmediata a tamaño de card.

### 8. Prompt para IA
Para la ilustración de sol:
> "Flat, stylized sun illustration with simple radiating rays, vivid yellow and sky blue color palette, clean vector edges, bright cheerful summer sticker aesthetic, transparent background."

Para la alternativa de elemento tropical:
> "Flat, simplified tropical palm leaf illustration, vivid summer color palette, clean vector edges, bright cheerful aesthetic, transparent background."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo resistente a humedad (uso en vasos de bebida fría con condensación), acabado mate o brillante.

### 10. Nivel de calidad
Premium aquí significa luminosidad genuina sin saturación excesiva — el error más común a evitar es un amarillo tan intenso que resulte agresivo a la vista en vez de cálido. Validación: el sticker debe transmitir "día soleado agradable", no "advertencia visual".

### 11. Commercial Sheet
- **Nombre comercial**: Verano — Sticker de Temporada Luminosa
- **Elevator Pitch**: Sticker circular luminoso para tu oferta de temporada de verano, sin atarse a una fecha festiva específica.
- **Beneficio principal**: Da presencia estacional flexible durante toda la temporada cálida, más allá de un solo día festivo.
- **Ideal para**: heladerías, negocios de bebidas frías, tiendas de ropa de playa.
- **Nivel de personalización**: Bajo (elección entre sol o elemento tropical).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Vasos de bebida fría, empaques de temporada de verano, productos de playa.
- **Palabras clave SEO**: sticker verano, etiqueta temporada verano, template summer sticker, sticker sol playa, packaging bebida fría verano, sticker tropical verano, etiqueta helado temporada, template verano luminoso, packaging producto playa, sticker sol amarillo, etiqueta temporada cálida, template summer season, packaging vaso bebida, sticker verano circular, etiqueta hoja palma, template temporada soleada, packaging heladería verano, sticker sol tropical, etiqueta verano azul amarillo, template summer bright.
- **Categoría comercial**: Seasonal.
- **Colección**: Retail & POS Collection.
- **Premium Features**: 2 motivos luminosos curados (sol y elemento tropical); paleta calibrada para transmitir calidez sin saturación excesiva; flexible para toda la temporada de verano, sin fecha fija.
- **Call to Action**: Que tu producto de temporada brille tanto como el verano mismo.

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

## Template 58 — Otoño

### 1. Concepto
Cafeterías y comercios con oferta estacional de otoño (bebidas de temporada, productos de calabaza/especias) necesitan una paleta terrosa y cálida que se sienta acogedora, no festiva/audaz como el resto de Seasonal — el carácter del otoño es distinto al del verano, y este template lo refleja cambiando deliberadamente de familia de lenguaje visual.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — no Audaz Gráfico como el resto de Seasonal, precisamente porque el otoño se siente acogedor, no audaz; reutiliza el acento `#D98E28` ya visto en Miel Artesanal (Template 2), reforzando la coherencia de paleta cálida entre categorías distintas.
- **Tipografía**: serif suave (recomendado: **Lora**, mismo rol ya usado en Miel y Té de Hierbas) para texto opcional.
- **Paleta**: ocre otoñal `#B5651D`, dorado miel `#D98E28`, marrón oscuro `#5C3A21`.
- **Estilo**: cálido, acogedor, terroso — más cercano a Café/Miel que a Verano/Regreso a Clases.
- **Espaciados**: margen de 4mm respecto al área segura, generoso, coherente con la familia.
- **Jerarquía**: un solo nivel — la ilustración de hoja de otoño es el diseño completo.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: hoja de otoño ilustrada (Nivel 1-2 del Design Language Guide, línea fina o color plano suave), un solo motivo.
- **Texturas**: ninguna, coherente con la simplicidad de la familia en este contexto.
- **Estilo visual**: ilustrativo cálido, línea fina o color plano terroso.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro completo ocupado por la ilustración de hoja.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: la hoja ocupa un mínimo de 70% del diámetro total.

### 4. Elementos
- Ilustración de hoja de otoño

### 5. Assets necesarios
- 1 ilustración SVG de hoja de otoño, línea fina o color plano suave en tonos ocre/dorado

### 6. Mockup
Vaso de bebida caliente de temporada (café/té de otoño), el sticker aplicado, luz cálida de interior, fondo con hojas de otoño reales desenfocadas.

### 7. Thumbnail
Sticker circular solo sobre fondo ocre pálido — la hoja debe transmitir calidez acogedora incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la ilustración de hoja de otoño:
> "Delicate illustration of a single autumn leaf, warm ochre and golden tones, thin-line or soft flat-color style (not vivid/bold), cozy autumn aesthetic consistent with a warm coffee-shop feel, clean vector edges, transparent background."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo resistente a humedad de bebida caliente, acabado mate.

### 10. Nivel de calidad
Premium aquí significa calidez acogedora genuina, no un motivo de temporada genérico de clip-art — el error más común a evitar es una paleta demasiado vibrante que rompa la sensación acogedora y lo acerque al registro audaz de Verano/Halloween en vez del cálido de Café/Miel. Validación: comparar con Miel Artesanal (Template 2) — ambos deben sentirse de la misma familia de calidez, aunque uno sea de temporada y el otro de producto.

### 11. Commercial Sheet
- **Nombre comercial**: Otoño — Sticker Cálido de Temporada
- **Elevator Pitch**: Sticker circular acogedor con hoja de otoño, en la misma paleta cálida que ya reconocen tus clientes de café y miel.
- **Beneficio principal**: Comunica la temporada de otoño con calidez genuina, coherente con la estética de negocios de café/té que buscan sentirse acogedores, no festivos.
- **Ideal para**: cafeterías, comercios con oferta estacional de otoño.
- **Nivel de personalización**: Bajo (el motivo es fijo por diseño).
- **Tiempo estimado de personalización**: 3 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Vasos de bebida caliente, empaques de temporada otoñal, productos de café/té de otoño.
- **Palabras clave SEO**: sticker otoño, etiqueta temporada otoñal, template autumn sticker, sticker hoja otoño, packaging bebida caliente otoño, sticker cafetería otoño, etiqueta acogedor temporada, template otoño cálido, packaging café temporada, sticker hoja dorada, etiqueta otoño ocre, template autumn cozy, packaging vaso caliente, sticker temporada café, etiqueta hoja otoñal, template otoño acogedor, packaging bebida temporada, sticker otoño terroso, etiqueta autumn leaf, template cafetería temporada.
- **Categoría comercial**: Seasonal.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Reutiliza el acento dorado ya validado en Miel Artesanal, reforzando consistencia de paleta cálida entre categorías; único template de Seasonal en la familia Artesanal Cálido, justificado por el carácter distinto del otoño frente a las demás temporadas.
- **Call to Action**: Que tu producto de otoño se sienta tan acogedor como la temporada misma.

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

## Template 59 — Regreso a Clases

### 1. Concepto
Comercios (no solo escuelas) necesitan promocionar su oferta de temporada de regreso a clases — útiles, ropa, tecnología — de forma distinta a la Etiqueta de Útiles Escolares (Template 51, que es de identificación personal, no de promoción comercial). Este template es la versión de venta/promoción de temporada, reutilizando la paleta ya asociada a contexto escolar en el catálogo.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico-comercial — reutiliza exactamente la paleta ya validada en la Etiqueta de Útiles Escolares (Template 51), reforzando la coherencia visual entre Education y Seasonal en este contexto compartido.
- **Tipografía**: sans-serif de impacto (recomendado: **Archivo Black**, mismo rol ya usado en Precio y Oferta/Nuevo Producto) para el mensaje de oferta.
- **Paleta**: azul vivo `#2F80ED`, amarillo vivo `#F2C94C`, blanco `#FFFFFF` — idéntica a Etiqueta de Útiles Escolares.
- **Estilo**: comercial, directo, temporada escolar.
- **Espaciados**: margen de 3mm respecto al área segura, compacto (coherente con la familia Impacto Comercial/Audaz Gráfico en su vertiente promocional).
- **Jerarquía**: 1) mensaje de oferta de temporada (dominante), 2) ícono pequeño de útil escolar (lápiz o libreta).
- **Alineaciones**: centrada.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ícono pequeño de lápiz o libreta (Nivel 2-3 del Design Language Guide, color plano), reforzando sin competir con el mensaje.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico de alto contraste, promocional.

### 3. Layout
- **Formato**: rectangular horizontal, 60mm × 30mm.
- **Zonas**: banda superior (mensaje de oferta), banda inferior (ícono pequeño de útil escolar).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 franjas horizontales.
- **Proporciones**: el ícono ocupa un máximo de 20% de la altura total.

### 4. Elementos
- Mensaje de oferta de temporada (ej. "Oferta de Regreso a Clases")
- Ícono pequeño de lápiz o libreta

### 5. Assets necesarios
- 1 ícono SVG de lápiz o libreta, color plano, mismo estilo ya usado en la Etiqueta de Útiles Escolares (Template 51)

### 6. Mockup
Vitrina de tienda con útiles escolares, el sticker aplicado como señalización de oferta, luz de tienda comercial, fondo de estantería con productos escolares genéricos.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco — el mensaje de oferta debe leerse con claridad e impacto a tamaño de card.

### 8. Prompt para IA
Este template reutiliza el ícono de útil escolar ya especificado para la Etiqueta de Útiles Escolares (Template 51) — no requiere un asset generado nuevo.

### 9. Exportación
- Tamaño final: 60mm × 30mm.
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o brillante, cualquier material estándar de vitrina/estante.

### 10. Nivel de calidad
Premium aquí significa impacto comercial claro sin perder la coherencia con el resto del sistema escolar del catálogo — el error más común a evitar es una paleta distinta a la ya establecida en Education, lo cual rompería la señal visual de "temporada escolar" que el comprador ya reconoce del resto del catálogo. Validación: comparar con la Etiqueta de Útiles Escolares (Template 51) — ambos deben sentirse del mismo sistema de temporada escolar.

### 11. Commercial Sheet
- **Nombre comercial**: Regreso a Clases — Sticker de Oferta de Temporada
- **Elevator Pitch**: Sticker promocional de alto impacto para tu oferta de temporada de regreso a clases.
- **Beneficio principal**: Comunica oferta de temporada con la misma paleta reconocible que ya asocia el comprador con contexto escolar.
- **Ideal para**: comercios con oferta de temporada de regreso a clases (útiles, ropa, tecnología).
- **Nivel de personalización**: Medio (mensaje de oferta editable).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Vitrinas de tienda, estantes, empaques de temporada escolar.
- **Palabras clave SEO**: sticker regreso a clases, etiqueta oferta escolar, template back to school, sticker promoción temporada, packaging oferta útiles, sticker regreso clases comercio, etiqueta temporada escolar oferta, template back to school sale, packaging vitrina escolar, sticker oferta lápiz libreta, etiqueta comercio escolar, template regreso clases promo, packaging tienda útiles, sticker oferta azul amarillo, etiqueta temporada regreso clases, template promoción escolar, packaging oferta comercial escuela, sticker regreso a clases oferta, etiqueta school season sale, template comercio temporada escolar.
- **Categoría comercial**: Seasonal.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Reutiliza exactamente la paleta y el ícono ya validados en la Etiqueta de Útiles Escolares, reforzando coherencia entre Education y Seasonal; layout promocional consistente con Precio y Oferta/Nuevo Producto.
- **Call to Action**: Que tu oferta de temporada se vea tan lista como los útiles que vendes.

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

## Template 60 — Menú Digital QR

### 1. Concepto
Restaurantes, cafeterías y food trucks necesitan dirigir al cliente a un menú digital de forma rápida y sin fricción — el reto de diseño no es estético sino técnico: un código QR necesita una zona de alto contraste y un margen de silencio (quiet zone) reales para poder escanearse correctamente, una restricción funcional que gobierna el diseño tanto como el sangrado/área segura gobiernan el resto del catálogo.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Técnico Funcional (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — la restricción técnica real de escaneo de QR (zona de silencio, contraste mínimo) funciona con la misma lógica de "convención antes que estética" ya aplicada a Advertencia General y Rombo Normado, aunque aquí la convención es de legibilidad de escaneo, no normativa legal.
- **Tipografía**: sans-serif simple de alto contraste (recomendado: **Work Sans**, peso 600) para "Escanea el menú".
- **Paleta**: casi negro `#1A1A1A`, blanco `#FFFFFF`, cobre `#9C4E27` — el cobre aporta calidez de contexto gastronómico sin comprometer el contraste negro/blanco que el QR necesita para escanearse de forma confiable.
- **Estilo**: funcional, claro, con un toque cálido de hospitalidad.
- **Espaciados**: la zona de silencio del QR (margen sin contenido alrededor del código) es un requisito técnico real, no una decisión estética — se respeta con la misma disciplina que el área segura de impresión.
- **Jerarquía**: 1) zona de QR (dominante, con su margen de silencio intacto), 2) texto corto "Escanea el menú" (debajo, nunca superpuesto ni invadiendo la zona de silencio).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: ninguna adicional — el QR mismo es el único elemento gráfico, sin decoración superpuesta que reduzca su contraste o legibilidad.
- **Texturas**: ninguna — cualquier textura de fondo detrás del QR arriesga reducir el contraste necesario para el escaneo.
- **Estilo visual**: funcional, alto contraste, sin decoración que comprometa la escaneabilidad.

### 3. Layout
- **Formato**: cuadrado de 50mm × 50mm.
- **Zonas**: dos tercios superiores (zona de QR con su margen de silencio intacto), tercio inferior (texto "Escanea el menú").
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — **además** de esta restricción estándar, la zona de QR requiere su propia zona de silencio (recomendado mínimo 4 módulos de QR de margen, según convención técnica estándar de códigos QR) que se respeta de forma independiente al área segura de impresión.
- **Retícula**: 2 franjas horizontales (66% QR / 34% texto).
- **Proporciones**: la zona de QR nunca se reduce por debajo del tamaño mínimo de escaneo confiable a la distancia de uso esperada (mesa de restaurante, aprox. 20-30cm) — esto se valida con una prueba de escaneo real antes de aprobar el template para producción, no solo con la medida en el archivo de diseño.

### 4. Elementos
- Código QR (generado por el usuario/negocio, enlazando a su menú digital real — no un asset de diseño producido por THÖREN)
- Texto "Escanea el menú" (o variante corta similar)

### 5. Assets necesarios
- Ninguno gráfico — el código QR lo genera el propio usuario con su enlace real; el template provee únicamente el layout, la zona reservada y el texto, no el código en sí.

### 6. Mockup
Mesa de restaurante con soporte de mesa mostrando el sticker aplicado, luz de restaurante cálida, fondo de mesa con elementos de restaurante genéricos desenfocados (servilletero, cubiertos).

### 7. Thumbnail
Layout con un QR de ejemplo (no funcional, solo ilustrativo) sobre fondo blanco — debe leerse "Escanea el menú" con claridad a tamaño de card, dejando explícito que el QR real lo genera el usuario.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — el único elemento gráfico (el código QR) lo genera el usuario con su propio enlace; THÖREN provee solo el layout y el texto.

### 9. Exportación
- Tamaño final: 50mm × 50mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno, más la zona de silencio propia del QR (ver §3) — **ambas restricciones se validan de forma independiente, la segunda no sustituye a la primera**.
- Recomendación de impresión: vinil adhesivo mate (el acabado brillante puede generar reflejos que dificulten el escaneo bajo ciertas condiciones de luz de restaurante) — **prueba de escaneo física obligatoria antes de producción masiva**, único requisito de validación funcional real en todo el catálogo hasta este template.

### 10. Nivel de calidad
Premium aquí se mide, antes que nada, por funcionalidad real: un QR que no escanea confiablemente no cumple su propósito sin importar cuán bien diseñado esté alrededor. El error más común a evitar es comprometer el contraste o el margen de silencio del QR por razones puramente estéticas (ej. superponer un logo grande sobre el código sin validar que sigue siendo legible). Validación obligatoria: escanear el diseño final impreso con al menos 2 dispositivos móviles distintos antes de aprobar para producción — el único template del catálogo con un criterio de validación funcional de dispositivo real, no solo visual.

### 11. Commercial Sheet
- **Nombre comercial**: Menú QR — Etiqueta de Menú Digital
- **Elevator Pitch**: Sticker funcional con espacio calibrado para tu código QR de menú digital, diseñado para escanearse sin fallos.
- **Beneficio principal**: Dirige a tus clientes a tu menú digital de forma instantánea, con un diseño que prioriza la funcionalidad real de escaneo sobre la decoración.
- **Ideal para**: restaurantes, cafeterías, food trucks.
- **Nivel de personalización**: Alto (el código QR es único por negocio; el texto es editable).
- **Tiempo estimado de personalización**: 10 minutos (incluye generar el QR propio y validar el escaneo).
- **Dificultad de impresión**: Intermedia (requiere reservar correctamente la zona de alto contraste y validar escaneo antes de producción masiva).
- **Productos compatibles**: Mesas de restaurante, vitrinas, mostradores de cafetería y food truck.
- **Palabras clave SEO**: sticker menú qr, etiqueta código qr restaurante, template digital menu, sticker escanea menú, packaging mesa restaurante, sticker qr cafetería, etiqueta menú digital, template qr food truck, packaging restaurante moderno, sticker código escaneable, etiqueta menú sin contacto, template restaurant qr, packaging mesa qr, sticker menu digital label, etiqueta escaneo menú, template food service qr, packaging cafetería moderna, sticker qr hospitalidad, etiqueta digital menu label, template restaurante código qr.
- **Categoría comercial**: QR & Smart Labels.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Layout calibrado respetando la zona de silencio técnica real del QR; único template del catálogo con protocolo de validación de escaneo en dispositivo real documentado como parte del estándar de calidad; paleta cálida de hospitalidad sin comprometer contraste funcional.
- **Call to Action**: Que ver tu menú sea tan fácil como escanear y listo.

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
□ Prueba de escaneo en dispositivo real (criterio adicional específico de este template)

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

5 de 63 templates completados en este lote (Batch 12: template 17.5 — cierra Holiday en su totalidad — templates 18.1 a 18.3 — cierra Seasonal en su totalidad — y template 19.1 de QR & Smart Labels). Los templates 19.2 a 19.4 (Enlace a Redes Sociales QR, Reseña QR, Tarjeta de Contacto QR) pasan al Batch 13 — el lote final del catálogo.

Progreso acumulado: 60 de 63 templates completados (Batch 01 a Batch 12).

**A la espera de aprobación antes de continuar con Batch 13** (los 3 templates finales de QR & Smart Labels, cerrando el catálogo completo de 63 templates).

**Recordatorio de auditoría**: al completar Batch 13 se ejecutará la auditoría integral del catálogo (cobertura, consistencia visual, estrategia comercial, preparación para producción) — de carácter de validación, no de rediseño. La estructura documental que usará esa auditoría se entrega en paralelo a este lote, preparada pero sin ejecutar todavía (`THOREN_CATALOG_AUDIT_FRAMEWORK.md`).
