> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Catalog v1 — Catálogo inicial propuesto (Diseño, no implementación)

**Alcance: exclusivamente diseño de contenido.** Ningún template de este catálogo fue construido, ningún asset fue generado, ningún archivo de la aplicación fue tocado. Este documento es dirección de producto/contenido para una fase de producción futura — describe QUÉ templates debería tener el catálogo inicial y con qué metadata, no los construye.

Acompaña a `TEMPLATE_LIBRARY_ARCHITECTURE.md` (donde vive la justificación de la taxonomía de categorías y la definición formal de cada campo — este documento asume ese contexto y no lo repite).

**Total: 63 templates** en 19 categorías (dentro del rango de 50-100 pedido). La distribución no es pareja a propósito: las categorías con mayor demanda de mercado validada (Food & Beverage, Cosmetics, Wedding, Holiday) reciben más entradas iniciales; categorías más nicho (Industrial, Education) reciben menos, con espacio para crecer en versiones posteriores según uso real.

Cada entrada sigue exactamente los 10 campos pedidos. "Forma" se documenta junto a cada template aunque sea una faceta independiente de "Categoría" (ver arquitectura §2.1), porque es información necesaria para producir el asset real.

---

## 1. Food & Beverage (6)

### 1.1 Café de Especialidad — Origen Único
- **Categoría**: Food & Beverage · **Forma**: Redondo
- **Descripción corta**: Etiqueta circular para bolsas o latas de café de tueste especial, con espacio para origen y notas de sabor.
- **Caso de uso**: Etiqueta de bolsa de 250g/500g de café tostado localmente.
- **Público objetivo**: Tostadores independientes, cafeterías de especialidad.
- **Nivel de dificultad**: Básico
- **Tags**: coffee, cafe, roastery, origin, minimal, kraft
- **Preview sugerido**: Círculo con jerarquía tipográfica clara (nombre de finca grande, notas de cata pequeñas), ilustración lineal simple de un grano de café.
- **Mockup recomendado**: Bolsa kraft con válvula, aplicado en el frente.
- **Colores sugeridos**: `#3C2A21`, `#D5B893`, `#F4E9DA`

### 1.2 Miel Artesanal de Productor Local
- **Categoría**: Food & Beverage · **Forma**: Redondo
- **Descripción corta**: Etiqueta cálida y natural para frascos de miel, con espacio para variedad floral y peso neto.
- **Caso de uso**: Frasco de vidrio de miel de 250g-500g vendida en mercados locales.
- **Público objetivo**: Apicultores, productores de mercado agrícola.
- **Nivel de dificultad**: Básico
- **Tags**: honey, miel, artisan, farm, natural, floral
- **Preview sugerido**: Ilustración simple de abeja o panal, tipografía manuscrita para el nombre del productor.
- **Mockup recomendado**: Frasco de vidrio hexagonal con tapa metálica.
- **Colores sugeridos**: `#D98E28`, `#5C3A21`, `#FFF3D6`

### 1.3 Cerveza Artesanal — Estilo IPA
- **Categoría**: Food & Beverage · **Forma**: Rectangular
- **Descripción corta**: Etiqueta de alto contraste para lata o botella, con jerarquía clara de nombre de cerveza, estilo y % de alcohol.
- **Caso de uso**: Etiqueta envolvente o frontal de lata de 355ml/473ml.
- **Público objetivo**: Cervecerías artesanales pequeñas, homebrewers que venden en lotes.
- **Nivel de dificultad**: Intermedio
- **Tags**: beer, cerveza, ipa, craft, brewery, bold
- **Preview sugerido**: Ilustración central llamativa (lúpulo o icono de marca), banda inferior con datos técnicos (ABV, IBU) en tipografía condensada.
- **Mockup recomendado**: Lata de aluminio de 355ml, vista frontal.
- **Colores sugeridos**: `#1A1A1A`, `#E8A33D`, `#FAFAF5`

### 1.4 Mermelada Casera de Temporada
- **Categoría**: Food & Beverage · **Forma**: Redondo
- **Descripción corta**: Etiqueta ilustrada con espacio para sabor de fruta y fecha de elaboración.
- **Caso de uso**: Frasco de mermelada de 250g hecha en casa o en pequeño lote.
- **Público objetivo**: Emprendedores de repostería/conservas caseras.
- **Nivel de dificultad**: Básico
- **Tags**: jam, mermelada, fruit, homemade, seasonal
- **Preview sugerido**: Ilustración de la fruta correspondiente en el centro, anillo exterior con nombre del sabor.
- **Mockup recomendado**: Frasco pequeño de vidrio con tapa de metal a rayas.
- **Colores sugeridos**: `#A6243A`, `#F2C14E`, `#FFFDF7`

### 1.5 Salsa Picante Gourmet
- **Categoría**: Food & Beverage · **Forma**: Rectangular
- **Descripción corta**: Etiqueta vertical alargada para botella de salsa, con espacio para nivel de picor.
- **Caso de uso**: Botella de salsa picante artesanal de 150-200ml.
- **Público objetivo**: Marcas pequeñas de salsas/condimentos gourmet.
- **Nivel de dificultad**: Intermedio
- **Tags**: hot-sauce, salsa, spicy, gourmet, condiment
- **Preview sugerido**: Ilustración de chile estilizada, indicador visual de nivel de picor (escala de 1-5).
- **Mockup recomendado**: Botella de vidrio alargada tipo "hot sauce".
- **Colores sugeridos**: `#C1272D`, `#1F1F1F`, `#FFEDD5`

### 1.6 Té de Hierbas Orgánico
- **Categoría**: Food & Beverage · **Forma**: Cuadrado
- **Descripción corta**: Etiqueta serena para caja o bolsa de té, con espacio para tipo de hierba y beneficio.
- **Caso de uso**: Caja de té de hierbas de 20 sobres o bolsa a granel.
- **Público objetivo**: Marcas de bienestar, productores de té orgánico.
- **Nivel de dificultad**: Básico
- **Tags**: tea, te, herbal, organic, wellness, calm
- **Preview sugerido**: Ilustración lineal de hoja/flor de la hierba correspondiente, paleta suave.
- **Mockup recomendado**: Caja de cartón pequeña con ventana.
- **Colores sugeridos**: `#5F7A61`, `#EDE6D6`, `#2F3B2E`

---

## 2. Cosmetics (5)

### 2.1 Serum Facial Premium
- **Categoría**: Cosmetics · **Forma**: Redondo
- **Descripción corta**: Etiqueta minimalista de alta gama para frasco gotero, con espacio para % de activos.
- **Caso de uso**: Frasco gotero de serum de 30ml.
- **Público objetivo**: Marcas de skincare independientes, cosmética natural premium.
- **Nivel de dificultad**: Intermedio
- **Tags**: skincare, serum, premium, minimal, beauty
- **Preview sugerido**: Wordmark centrado, sin ilustración — todo el peso en la tipografía y el espacio negativo.
- **Mockup recomendado**: Frasco gotero de vidrio ámbar u opaco.
- **Colores sugeridos**: `#23282B`, `#EDEAE2`, `#9C4E27`

### 2.2 Crema Corporal Natural
- **Categoría**: Cosmetics · **Forma**: Rectangular
- **Descripción corta**: Etiqueta envolvente para tubo o frasco de crema, con espacio para ingrediente destacado.
- **Caso de uso**: Envase de crema corporal de 100-200ml.
- **Público objetivo**: Marcas de cosmética natural/orgánica.
- **Nivel de dificultad**: Básico
- **Tags**: body-cream, natural, organic, skincare
- **Preview sugerido**: Ilustración botánica sutil en un borde, resto del espacio limpio.
- **Mockup recomendado**: Frasco cilíndrico blanco con tapa a presión.
- **Colores sugeridos**: `#7C9070`, `#FBF7EF`, `#3C3A32`

### 2.3 Jabón Artesanal en Barra
- **Categoría**: Cosmetics · **Forma**: Personalizado (envoltura rectangular con muescas)
- **Descripción corta**: Envoltura tipo faja para barra de jabón artesanal, con espacio para ingrediente/aroma.
- **Caso de uso**: Faja envolvente de una barra de jabón de 100g.
- **Público objetivo**: Jaboneros artesanales, ferias de productos naturales.
- **Nivel de dificultad**: Avanzado (requiere ajustar la troquelada a la barra física)
- **Tags**: soap, jabon, handmade, natural, artisan
- **Preview sugerido**: Banda horizontal con textura tipo papel reciclado, sello circular pequeño superpuesto con el nombre de la marca.
- **Mockup recomendado**: Barra de jabón artesanal rectangular.
- **Colores sugeridos**: `#8B6F47`, `#F5EFE3`, `#3E2E1F`

### 2.4 Aceite Esencial Puro
- **Categoría**: Cosmetics · **Forma**: Redondo (pequeño)
- **Descripción corta**: Etiqueta pequeña y precisa para frasco gotero de aceite esencial.
- **Caso de uso**: Frasco gotero de 10-15ml.
- **Público objetivo**: Marcas de aromaterapia, bienestar.
- **Nivel de dificultad**: Básico
- **Tags**: essential-oil, aceite, aromatherapy, wellness
- **Preview sugerido**: Nombre de la esencia en tipografía grande, ícono botánico diminuto.
- **Mockup recomendado**: Frasco gotero ámbar de 15ml.
- **Colores sugeridos**: `#4B6673`, `#F7F5EF`, `#14181A`

### 2.5 Bálsamo Labial Natural
- **Categoría**: Cosmetics · **Forma**: Personalizado (circular pequeño, tapa de balm)
- **Descripción corta**: Etiqueta circular diminuta para la tapa o base de un bálsamo labial.
- **Caso de uso**: Tapa de lata o tubo de bálsamo labial.
- **Público objetivo**: Marcas de cuidado personal natural.
- **Nivel de dificultad**: Básico
- **Tags**: lip-balm, balsamo, natural, tiny-label
- **Preview sugerido**: Solo wordmark y sabor/aroma, sin ilustración — el espacio es demasiado pequeño para detalle.
- **Mockup recomendado**: Lata pequeña tipo "tin" de bálsamo.
- **Colores sugeridos**: `#C97A4F`, `#FFF8F0`, `#2B2B2B`

---

## 3. Beauty (3)

### 3.1 Sello de Cita — Salón de Belleza
- **Categoría**: Beauty · **Forma**: Redondo
- **Descripción corta**: Sello circular para tarjetas de cita o agradecimiento en salones de belleza.
- **Caso de uso**: Sticker de cierre en tarjeta de próxima cita o bolsa de producto.
- **Público objetivo**: Salones de belleza, estilistas independientes.
- **Nivel de dificultad**: Básico
- **Tags**: salon, beauty, appointment, seal
- **Preview sugerido**: Monograma o inicial grande centrada, anillo de texto perimetral.
- **Mockup recomendado**: Tarjeta de cita de papel doblada, sticker cerrando el borde.
- **Colores sugeridos**: `#B76E79`, `#2B2224`, `#F7E9EA`

### 3.2 Spa & Bienestar
- **Categoría**: Beauty · **Forma**: Rectangular
- **Descripción corta**: Etiqueta serena para productos o packaging de spa.
- **Caso de uso**: Bolsa o caja de amenidades de spa/tratamiento.
- **Público objetivo**: Spas, centros de bienestar.
- **Nivel de dificultad**: Básico
- **Tags**: spa, wellness, relax, beauty
- **Preview sugerido**: Mucho espacio negativo, línea fina decorativa, tipografía ligera.
- **Mockup recomendado**: Bolsa de papel kraft clara con asas.
- **Colores sugeridos**: `#A9BBB4`, `#F5F3EF`, `#3A423E`

### 3.3 Marca Personal de Estilista
- **Categoría**: Beauty · **Forma**: Cuadrado
- **Descripción corta**: Plantilla de branding personal para estilistas/maquillistas freelance.
- **Caso de uso**: Sticker de promoción en redes o tarjeta de presentación.
- **Público objetivo**: Estilistas y maquillistas independientes.
- **Nivel de dificultad**: Intermedio
- **Tags**: personal-brand, stylist, makeup, freelance
- **Preview sugerido**: Retrato-silueta genérica opcional + nombre en tipografía script.
- **Mockup recomendado**: Espejo de bolsillo o estuche de maquillaje.
- **Colores sugeridos**: `#1D1D1D`, `#E8B4B8`, `#FFFFFF`

---

## 4. Industrial (2)

### 4.1 Identificación de Equipo Industrial
- **Categoría**: Industrial · **Forma**: Rectangular
- **Descripción corta**: Etiqueta sobria de alto contraste para identificar maquinaria o equipo.
- **Caso de uso**: Placa adhesiva con número de serie/mantenimiento en equipo de planta.
- **Público objetivo**: Plantas industriales, talleres, mantenimiento.
- **Nivel de dificultad**: Básico
- **Tags**: industrial, equipment, id-tag, technical
- **Preview sugerido**: Fondo metálico simulado, tipografía monoespaciada, campos claramente delimitados (ID, fecha, responsable).
- **Mockup recomendado**: Superficie metálica de máquina industrial.
- **Colores sugeridos**: `#2B2E31`, `#F2C94C`, `#FFFFFF`

### 4.2 Sello de Calidad Industrial
- **Categoría**: Industrial · **Forma**: Redondo
- **Descripción corta**: Sello circular de garantía/inspección para productos industriales.
- **Caso de uso**: Sello de "Inspeccionado"/"Control de calidad" sobre empaque o pieza.
- **Público objetivo**: Fabricantes, talleres de manufactura.
- **Nivel de dificultad**: Básico
- **Tags**: quality-seal, industrial, inspection
- **Preview sugerido**: Anillo grueso con texto perimetral, ícono de check central.
- **Mockup recomendado**: Caja de cartón corrugado industrial.
- **Colores sugeridos**: `#1B1B1B`, `#C0392B`, `#FFFFFF`

---

## 5. Warning & Compliance Labels (3)

### 5.1 Advertencia General
- **Categoría**: Warning & Compliance Labels · **Forma**: Cuadrado
- **Descripción corta**: Plantilla de advertencia genérica con convención visual amarillo/negro reconocible.
- **Caso de uso**: Señalización de precaución en empaque o equipo.
- **Público objetivo**: Logística, manufactura, cumplimiento normativo.
- **Nivel de dificultad**: Básico
- **Tags**: warning, safety, compliance, hazard
- **Preview sugerido**: Franja diagonal amarillo/negro, símbolo de exclamación estándar, texto en mayúsculas condensadas.
- **Mockup recomendado**: Caja de cartón industrial o puerta de equipo.
- **Colores sugeridos**: `#F4C11F`, `#1A1A1A`, `#FFFFFF`

### 5.2 Manejo con Cuidado — Frágil Técnico
- **Categoría**: Warning & Compliance Labels · **Forma**: Rectangular
- **Descripción corta**: Etiqueta técnica de manejo especial, más formal que la versión de e-commerce de la categoría Shipping.
- **Caso de uso**: Manejo de equipo sensible en traslado industrial/logístico.
- **Público objetivo**: Empresas de logística, manufactura con equipo delicado.
- **Nivel de dificultad**: Básico
- **Tags**: fragile, handling, compliance, logistics
- **Preview sugerido**: Icono estándar de copa/frágil, texto bilingüe (ES/EN) apilado.
- **Mockup recomendado**: Caja de madera o cartón reforzado de envío industrial.
- **Colores sugeridos**: `#1A1A1A`, `#FFFFFF`, `#C0392B`

### 5.3 Material Peligroso — Rombo Normado
- **Categoría**: Warning & Compliance Labels · **Forma**: Personalizado (rombo)
- **Descripción corta**: Plantilla de rombo de clasificación de materiales peligrosos siguiendo la convención visual estándar.
- **Caso de uso**: Identificación de contenedores con materiales regulados.
- **Público objetivo**: Transporte de mercancías, plantas químicas.
- **Nivel de dificultad**: Avanzado (requiere respetar proporciones/convención del rombo)
- **Tags**: hazmat, dangerous-goods, compliance, diamond-label
- **Preview sugerido**: Rombo con división diagonal, número de clase en la esquina inferior, símbolo genérico central editable.
- **Mockup recomendado**: Tambor/contenedor industrial.
- **Colores sugeridos**: `#D64541`, `#FFFFFF`, `#1A1A1A`

---

## 6. Retail (3)

### 6.1 Precio y Oferta
- **Categoría**: Retail · **Forma**: Rectangular
- **Descripción corta**: Etiqueta de punto de venta con precio destacado y espacio para "antes/ahora".
- **Caso de uso**: Sticker de oferta sobre estante o producto en tienda física.
- **Público objetivo**: Tiendas minoristas, boutiques.
- **Nivel de dificultad**: Básico
- **Tags**: retail, price-tag, sale, promo
- **Preview sugerido**: Número de precio dominante, banda diagonal "OFERTA" opcional.
- **Mockup recomendado**: Estante de tienda con producto genérico.
- **Colores sugeridos**: `#C0392B`, `#1A1A1A`, `#FFFFFF`

### 6.2 Nuevo Producto
- **Categoría**: Retail · **Forma**: Redondo
- **Descripción corta**: Sello llamativo de "Nuevo" para destacar productos recién lanzados.
- **Caso de uso**: Sticker adherido al empaque de un producto recién agregado al catálogo.
- **Público objetivo**: Tiendas físicas y online lanzando producto nuevo.
- **Nivel de dificultad**: Básico
- **Tags**: new, retail, badge, launch
- **Preview sugerido**: Estrella o ráfaga de fondo, palabra "NUEVO" en tipografía gruesa central.
- **Mockup recomendado**: Empaque de producto genérico en estante.
- **Colores sugeridos**: `#2ECC71`, `#1A1A1A`, `#FFFFFF`

### 6.3 Sello "Hecho en Casa"
- **Categoría**: Retail · **Forma**: Redondo
- **Descripción corta**: Sello cálido para comunicar producción local/casera en punto de venta.
- **Caso de uso**: Sticker sobre producto de repostería/manufactura local vendido en tienda de terceros.
- **Público objetivo**: Productores locales que venden a través de tiendas/mercados.
- **Nivel de dificultad**: Básico
- **Tags**: handmade, local, retail, seal
- **Preview sugerido**: Textura de sello de tinta, tipografía manuscrita.
- **Mockup recomendado**: Bolsa de papel con producto de repostería.
- **Colores sugeridos**: `#8B5E3C`, `#F5EEDD`, `#2B2B2B`

---

## 7. Product Labels (3)

### 7.1 Etiqueta Neutral Minimalista
- **Categoría**: Product Labels · **Forma**: Rectangular
- **Descripción corta**: Plantilla en blanco pero no vacía — jerarquía clara sin ilustración, para cualquier producto sin categoría propia todavía.
- **Caso de uso**: Etiqueta genérica para cualquier producto físico nuevo en catálogo.
- **Público objetivo**: Emprendedores en etapa temprana, cualquier industria no cubierta arriba.
- **Nivel de dificultad**: Básico
- **Tags**: generic, minimal, neutral, product-label
- **Preview sugerido**: Wordmark centrado, línea divisoria fina, subtítulo pequeño.
- **Mockup recomendado**: Envase genérico neutro (frasco o caja lisa).
- **Colores sugeridos**: `#23282B`, `#EDEAE2`, `#9C4E27`

### 7.2 Etiqueta Kraft Genérica
- **Categoría**: Product Labels · **Forma**: Redondo
- **Descripción corta**: Versión cálida/artesanal de la etiqueta neutral, sobre fondo tipo papel kraft.
- **Caso de uso**: Producto artesanal sin categoría específica en el catálogo.
- **Público objetivo**: Makers y pequeños productores en general.
- **Nivel de dificultad**: Básico
- **Tags**: kraft, generic, artisan, product-label
- **Preview sugerido**: Textura de papel kraft, sello circular simple.
- **Mockup recomendado**: Bolsa o frasco con textura kraft.
- **Colores sugeridos**: `#8B6F47`, `#F5EFE3`, `#2B2216`

### 7.3 Etiqueta Corporativa Simple
- **Categoría**: Product Labels · **Forma**: Cuadrado
- **Descripción corta**: Versión formal/corporativa de la etiqueta neutral, con espacio para logo y datos de contacto.
- **Caso de uso**: Producto de marca corporativa sin plantilla de industria específica.
- **Público objetivo**: Pequeñas empresas B2B.
- **Nivel de dificultad**: Básico
- **Tags**: corporate, generic, business, product-label
- **Preview sugerido**: Bloque de logo arriba, información de contacto en tipografía pequeña abajo.
- **Mockup recomendado**: Caja corporativa lisa.
- **Colores sugeridos**: `#1F2933`, `#FFFFFF`, `#4B6673`

---

## 8. Packaging (2)

### 8.1 Sello de Cierre
- **Categoría**: Packaging · **Forma**: Redondo (pequeño)
- **Descripción corta**: Sello circular pequeño para cerrar bolsas o cajas de empaque.
- **Caso de uso**: Cierre decorativo de bolsa de regalo o caja de envío.
- **Público objetivo**: Cualquier negocio que empaque productos para venta/envío.
- **Nivel de dificultad**: Básico
- **Tags**: seal, packaging, closure, tiny-label
- **Preview sugerido**: Logo o inicial centrada, borde simple.
- **Mockup recomendado**: Bolsa de papel doblada con el sello en el pliegue.
- **Colores sugeridos**: `#9C4E27`, `#EDEAE2`, `#23282B`

### 8.2 Cinta Decorativa de Empaque
- **Categoría**: Packaging · **Forma**: Rectangular (alargada, patrón repetible)
- **Descripción corta**: Patrón repetible tipo washi tape para envolver empaques.
- **Caso de uso**: Cinta decorativa alrededor de caja o bolsa de regalo.
- **Público objetivo**: Negocios de regalos, repostería, empaque especial.
- **Nivel de dificultad**: Intermedio (requiere pensar el patrón como repetible)
- **Tags**: tape, packaging, pattern, decorative
- **Preview sugerido**: Patrón geométrico simple repetido, 2-3 colores.
- **Mockup recomendado**: Caja de regalo envuelta con la cinta.
- **Colores sugeridos**: `#C97A4F`, `#4B6673`, `#F7F5EF`

---

## 9. Shipping (3)

### 9.1 Frágil — Manejo con Cuidado
- **Categoría**: Shipping · **Forma**: Cuadrado
- **Descripción corta**: Versión amigable/e-commerce de la etiqueta de frágil, menos formal que la de Warning & Compliance.
- **Caso de uso**: Paquete de venta online con contenido delicado.
- **Público objetivo**: Vendedores online de artículos frágiles (cerámica, vidrio, arte).
- **Nivel de dificultad**: Básico
- **Tags**: fragile, shipping, ecommerce, care
- **Preview sugerido**: Ilustración amigable de copa quebrándose (estilo lineal, no alarmante), texto "Con cuidado, por favor".
- **Mockup recomendado**: Caja de cartón de envío estándar.
- **Colores sugeridos**: `#D64541`, `#FFFFFF`, `#1A1A1A`

### 9.2 Gracias por tu Compra
- **Categoría**: Shipping · **Forma**: Redondo
- **Descripción corta**: Sticker de agradecimiento para cerrar paquetes de venta online.
- **Caso de uso**: Sello de cierre de la bolsa/caja de un pedido online.
- **Público objetivo**: Vendedores de e-commerce y marketplaces.
- **Nivel de dificultad**: Básico
- **Tags**: thank-you, shipping, ecommerce, packaging
- **Preview sugerido**: Texto manuscrito "¡Gracias!" con un pequeño ícono de corazón o estrella.
- **Mockup recomendado**: Bolsa de envío tipo mailer.
- **Colores sugeridos**: `#9C4E27`, `#F7F5EF`, `#23282B`

### 9.3 Este Lado Arriba
- **Categoría**: Shipping · **Forma**: Rectangular
- **Descripción corta**: Etiqueta funcional de orientación de paquete para envío.
- **Caso de uso**: Indicar orientación correcta de una caja durante transporte.
- **Público objetivo**: Cualquier vendedor que envíe productos que no deban voltearse.
- **Nivel de dificultad**: Básico
- **Tags**: this-side-up, shipping, orientation
- **Preview sugerido**: Flechas apuntando hacia arriba a ambos lados del texto, alto contraste.
- **Mockup recomendado**: Caja de cartón de envío.
- **Colores sugeridos**: `#1A1A1A`, `#FFFFFF`, `#F2C94C`

---

## 10. Business (3)

### 10.1 Sello Corporativo
- **Categoría**: Business · **Forma**: Redondo
- **Descripción corta**: Sello circular de marca corporativa, formal y limpio.
- **Caso de uso**: Cierre de sobres, documentos o material impreso corporativo.
- **Público objetivo**: Pequeñas y medianas empresas.
- **Nivel de dificultad**: Básico
- **Tags**: corporate, business, seal, formal
- **Preview sugerido**: Anillo de texto con nombre de empresa, ícono/monograma central.
- **Mockup recomendado**: Sobre de papel corporativo.
- **Colores sugeridos**: `#1F2933`, `#FFFFFF`, `#4B6673`

### 10.2 Tarjeta de Presentación Adhesiva
- **Categoría**: Business · **Forma**: Rectangular
- **Descripción corta**: Formato de tarjeta de presentación en versión sticker, para pegar en lugar de entregar.
- **Caso de uso**: Promoción/contacto adherible en producto o material impreso.
- **Público objetivo**: Freelancers y pequeños negocios de servicios.
- **Nivel de dificultad**: Intermedio
- **Tags**: business-card, contact, sticker, professional
- **Preview sugerido**: Layout tipo tarjeta clásica (nombre, rol, contacto) adaptado a formato adhesivo.
- **Mockup recomendado**: Superficie de escritorio o carpeta.
- **Colores sugeridos**: `#23282B`, `#F7F5EF`, `#9C4E27`

### 10.3 Gracias por tu Preferencia
- **Categoría**: Business · **Forma**: Redondo
- **Descripción corta**: Sticker de agradecimiento formal para clientes de negocio (no e-commerce).
- **Caso de uso**: Sello en factura, bolsa o material de atención al cliente.
- **Público objetivo**: Comercios y negocios de atención directa al cliente.
- **Nivel de dificultad**: Básico
- **Tags**: thank-you, business, customer, seal
- **Preview sugerido**: Tipografía elegante, sin ilustración, mucho espacio negativo.
- **Mockup recomendado**: Bolsa de tienda con asas de cordón.
- **Colores sugeridos**: `#2B2224`, `#F7F5EF`, `#B76E79`

---

## 11. Events (2)

### 11.1 Conferencia / Lanzamiento
- **Categoría**: Events · **Forma**: Rectangular
- **Descripción corta**: Plantilla de identificación temporal para un evento con nombre, fecha y lugar.
- **Caso de uso**: Gafete/sticker de acceso o material de un evento corporativo.
- **Público objetivo**: Organizadores de eventos y conferencias.
- **Nivel de dificultad**: Intermedio
- **Tags**: conference, event, launch, corporate
- **Preview sugerido**: Nombre del evento dominante arriba, fecha/lugar en banda inferior.
- **Mockup recomendado**: Gafete colgante o mesa de registro.
- **Colores sugeridos**: `#1F2933`, `#4B6673`, `#FFFFFF`

### 11.2 Sticker de Networking
- **Categoría**: Events · **Forma**: Redondo
- **Descripción corta**: Sticker casual para intercambiar en eventos de networking.
- **Caso de uso**: Sticker de marca personal repartido en un evento o meetup.
- **Público objetivo**: Profesionales independientes, comunidades/meetups.
- **Nivel de dificultad**: Básico
- **Tags**: networking, event, personal-brand, meetup
- **Preview sugerido**: Ilustración/ícono llamativo, nombre y una línea de contacto (redes o sitio web).
- **Mockup recomendado**: Laptop o cuaderno con el sticker aplicado.
- **Colores sugeridos**: `#9C4E27`, `#23282B`, `#EDEAE2`

---

## 12. Wedding (5)

### 12.1 Sello de Sobre de Invitación
- **Categoría**: Wedding · **Forma**: Redondo (pequeño)
- **Descripción corta**: Sello elegante para cerrar el sobre de la invitación de boda.
- **Caso de uso**: Cierre de sobre de invitación formal.
- **Público objetivo**: Parejas planeando su boda, wedding planners.
- **Nivel de dificultad**: Básico
- **Tags**: wedding, envelope-seal, elegant, invitation
- **Preview sugerido**: Iniciales entrelazadas o monograma, tipografía script fina.
- **Mockup recomendado**: Sobre de invitación con sello de cera simulado.
- **Colores sugeridos**: `#D4AF37`, `#FFFFFF`, `#2B2224`

### 12.2 Favor de Boda
- **Categoría**: Wedding · **Forma**: Redondo
- **Descripción corta**: Sticker decorativo para el detalle/recuerdo entregado a los invitados.
- **Caso de uso**: Etiqueta en bolsita de dulces o mini producto de agradecimiento.
- **Público objetivo**: Parejas organizando su boda.
- **Nivel de dificultad**: Básico
- **Tags**: wedding-favor, thank-you, guests, elegant
- **Preview sugerido**: Nombres de la pareja + fecha, motivo floral sutil en el borde.
- **Mockup recomendado**: Bolsita de organza con dulces.
- **Colores sugeridos**: `#B76E79`, `#FFF8F5`, `#D4AF37`

### 12.3 Nombres y Fecha — Monograma
- **Categoría**: Wedding · **Forma**: Personalizado (óvalo/corazón)
- **Descripción corta**: Monograma central con iniciales de la pareja y fecha de la boda.
- **Caso de uso**: Elemento decorativo repetido en varios materiales de la boda (programas, menús, favores).
- **Público objetivo**: Parejas que buscan consistencia visual en toda su boda.
- **Nivel de dificultad**: Intermedio
- **Tags**: monogram, wedding, initials, date
- **Preview sugerido**: Dos iniciales entrelazadas, línea decorativa fina con la fecha debajo.
- **Mockup recomendado**: Programa de ceremonia doblado.
- **Colores sugeridos**: `#D4AF37`, `#2B2224`, `#FFFFFF`

### 12.4 Mesa de Dulces
- **Categoría**: Wedding · **Forma**: Rectangular
- **Descripción corta**: Etiquetas para identificar cada dulce/postre en la mesa de dulces de la boda.
- **Caso de uso**: Tarjeta/etiqueta identificando un postre específico en la mesa de dulces.
- **Público objetivo**: Parejas y organizadores de la recepción.
- **Nivel de dificultad**: Básico
- **Tags**: candy-table, dessert, wedding, labels
- **Preview sugerido**: Espacio para nombre del postre en tipografía elegante, línea decorativa superior.
- **Mockup recomendado**: Mesa de postres con tarjetas paradas.
- **Colores sugeridos**: `#F7E9EA`, `#B76E79`, `#2B2224`

### 12.5 Agradecimiento de Boda
- **Categoría**: Wedding · **Forma**: Redondo
- **Descripción corta**: Sticker de agradecimiento post-boda para tarjetas o regalos de agradecimiento a invitados.
- **Caso de uso**: Sello de cierre en tarjetas de agradecimiento enviadas después del evento.
- **Público objetivo**: Parejas recién casadas.
- **Nivel de dificultad**: Básico
- **Tags**: thank-you, wedding, gratitude, elegant
- **Preview sugerido**: Texto "Gracias" en script, motivo floral mínimo.
- **Mockup recomendado**: Tarjeta de agradecimiento con sobre.
- **Colores sugeridos**: `#D4AF37`, `#FFF8F5`, `#2B2224`

---

## 13. Crafts (3)

### 13.1 Decoración de Scrapbook
- **Categoría**: Crafts · **Forma**: Personalizado (formas libres pequeñas)
- **Descripción corta**: Set de stickers decorativos pequeños para scrapbooking y journaling.
- **Caso de uso**: Decoración de páginas de álbum o diario ilustrado.
- **Público objetivo**: Hobbistas de scrapbooking y journaling.
- **Nivel de dificultad**: Básico
- **Tags**: scrapbook, journaling, craft, decorative
- **Preview sugerido**: Ilustraciones lineales pequeñas y variadas (no un solo diseño), paleta pastel.
- **Mockup recomendado**: Página de álbum abierto con stickers aplicados.
- **Colores sugeridos**: `#F2C1C1`, `#A9D6C5`, `#FFF3E0`

### 13.2 Sticker Decorativo para Manualidades
- **Categoría**: Crafts · **Forma**: Redondo
- **Descripción corta**: Sticker decorativo genérico para acompañar proyectos de manualidades.
- **Caso de uso**: Decoración de caja de regalo hecha a mano o proyecto DIY.
- **Público objetivo**: Hobbistas y makers.
- **Nivel de dificultad**: Básico
- **Tags**: craft, diy, decorative, handmade
- **Preview sugerido**: Ilustración central simple y colorida, borde festoneado opcional.
- **Mockup recomendado**: Caja de regalo DIY.
- **Colores sugeridos**: `#E8A33D`, `#5F7A61`, `#FFF8F0`

### 13.3 Sello de Regalo Hecho a Mano
- **Categoría**: Crafts · **Forma**: Redondo
- **Descripción corta**: Sello simple para identificar un regalo hecho a mano.
- **Caso de uso**: Etiqueta en regalo artesanal para un familiar/amigo.
- **Público objetivo**: Cualquier persona que regale algo hecho a mano.
- **Nivel de dificultad**: Básico
- **Tags**: gift, handmade, craft, seal
- **Preview sugerido**: Texto "Hecho con cariño por..." con espacio para nombre.
- **Mockup recomendado**: Regalo envuelto en papel kraft con listón.
- **Colores sugeridos**: `#8B6F47`, `#F5EFE3`, `#C0392B`

---

## 14. Etsy Sellers (3)

### 14.1 Kraft Hecho a Mano
- **Categoría**: Etsy Sellers · **Forma**: Redondo
- **Descripción corta**: Estética kraft/orgánica consistente, pensada para vendedores de artículos hechos a mano en marketplaces.
- **Caso de uso**: Etiqueta de empaque para pedidos de Etsy u otro marketplace de artesanías.
- **Público objetivo**: Vendedores de Etsy de productos hechos a mano.
- **Nivel de dificultad**: Básico
- **Tags**: etsy, handmade, kraft, seller
- **Preview sugerido**: Nombre de la tienda en tipografía cálida, textura kraft de fondo.
- **Mockup recomendado**: Caja de envío pequeña con papel de seda.
- **Colores sugeridos**: `#8B6F47`, `#F5EFE3`, `#2B2216`

### 14.2 Vintage Curado
- **Categoría**: Etsy Sellers · **Forma**: Rectangular
- **Descripción corta**: Estética vintage/curada para vendedores de artículos de segunda mano o vintage.
- **Caso de uso**: Etiqueta de autenticidad o descripción para artículo vintage vendido en marketplace.
- **Público objetivo**: Vendedores de artículos vintage/curados.
- **Nivel de dificultad**: Intermedio
- **Tags**: etsy, vintage, curated, seller
- **Preview sugerido**: Marco ornamentado fino, tipografía serif clásica.
- **Mockup recomendado**: Etiqueta colgante atada con hilo a un artículo.
- **Colores sugeridos**: `#6B4F3B`, `#EFE6D8`, `#2B2216`

### 14.3 Empaque Artesanal Etsy
- **Categoría**: Etsy Sellers · **Forma**: Cuadrado
- **Descripción corta**: Sticker de empaque genérico con espacio para logo de tienda de marketplace.
- **Caso de uso**: Cierre de empaque de cualquier pedido de marketplace de artesanías.
- **Público objetivo**: Vendedores de Etsy en general, sin importar la categoría de producto.
- **Nivel de dificultad**: Básico
- **Tags**: etsy, packaging, shop, seller
- **Preview sugerido**: Espacio de logo dominante, línea de agradecimiento pequeña abajo.
- **Mockup recomendado**: Caja de envío con relleno de papel.
- **Colores sugeridos**: `#9C4E27`, `#F7F5EF`, `#23282B`

---

## 15. Kids (3)

### 15.1 Estrella de Buen Comportamiento
- **Categoría**: Kids · **Forma**: Personalizado (estrella)
- **Descripción corta**: Sticker de recompensa en forma de estrella para uso escolar/familiar.
- **Caso de uso**: Sistema de recompensas para niños (tabla de comportamiento, tareas).
- **Público objetivo**: Padres, maestros de educación básica.
- **Nivel de dificultad**: Básico
- **Tags**: kids, reward, star, behavior
- **Preview sugerido**: Estrella de colores vivos, espacio pequeño para texto tipo "¡Bien hecho!".
- **Mockup recomendado**: Tabla de comportamiento pegada en refrigerador.
- **Colores sugeridos**: `#F2C94C`, `#EB5757`, `#2F80ED`

### 15.2 Personaje Divertido
- **Categoría**: Kids · **Forma**: Redondo
- **Descripción corta**: Sticker con espacio para un personaje/ilustración amigable genérica.
- **Caso de uso**: Decoración de cuadernos, loncheras o regalos infantiles.
- **Público objetivo**: Marcas infantiles, papelería escolar.
- **Nivel de dificultad**: Intermedio (requiere ilustración de personaje)
- **Tags**: kids, character, fun, colorful
- **Preview sugerido**: Personaje ilustrado central con expresión amigable, paleta primaria vibrante.
- **Mockup recomendado**: Cuaderno o lonchera infantil.
- **Colores sugeridos**: `#EB5757`, `#2F80ED`, `#F2C94C`

### 15.3 Cumpleaños Infantil
- **Categoría**: Kids · **Forma**: Redondo
- **Descripción corta**: Sticker festivo para fiestas infantiles con espacio para nombre y edad.
- **Caso de uso**: Bolsa de dulces o invitación de cumpleaños infantil.
- **Público objetivo**: Padres organizando fiestas infantiles.
- **Nivel de dificultad**: Básico
- **Tags**: birthday, kids, party, celebration
- **Preview sugerido**: Globos o confeti ilustrado, número de edad grande y editable.
- **Mockup recomendado**: Bolsa de dulces de fiesta.
- **Colores sugeridos**: `#F2994A`, `#9B51E0`, `#56CCF2`

---

## 16. Education (2)

### 16.1 Sello "Buen Trabajo"
- **Categoría**: Education · **Forma**: Redondo
- **Descripción corta**: Sello de reconocimiento para calificar trabajos escolares.
- **Caso de uso**: Sticker de retroalimentación en tareas o exámenes.
- **Público objetivo**: Maestros de educación básica.
- **Nivel de dificultad**: Básico
- **Tags**: teacher, school, reward, good-job
- **Preview sugerido**: Texto "¡Buen trabajo!" con una estrella o check, colores amigables.
- **Mockup recomendado**: Hoja de tarea con el sticker en la esquina.
- **Colores sugeridos**: `#27AE60`, `#F2C94C`, `#FFFFFF`

### 16.2 Etiqueta de Útiles Escolares
- **Categoría**: Education · **Forma**: Rectangular
- **Descripción corta**: Etiqueta de identificación de nombre para útiles escolares.
- **Caso de uso**: Etiquetar cuadernos, lápices o loncheras con el nombre del estudiante.
- **Público objetivo**: Padres de familia, escuelas.
- **Nivel de dificultad**: Básico
- **Tags**: school-supplies, name-label, education, kids
- **Preview sugerido**: Espacio dominante para el nombre, ícono pequeño de útil escolar.
- **Mockup recomendado**: Cuaderno escolar con la etiqueta en la portada.
- **Colores sugeridos**: `#2F80ED`, `#FFFFFF`, `#F2C94C`

---

## 17. Holiday (5)

### 17.1 Navidad Clásica
- **Categoría**: Holiday · **Forma**: Redondo
- **Descripción corta**: Sticker navideño clásico con motivo festivo tradicional.
- **Caso de uso**: Empaque de regalo o producto de temporada navideña.
- **Público objetivo**: Comercios y particulares en temporada decembrina.
- **Nivel de dificultad**: Básico
- **Tags**: christmas, navidad, holiday, festive
- **Preview sugerido**: Motivo de rama de pino o estrella, paleta roja/verde/dorada.
- **Mockup recomendado**: Regalo envuelto con listón.
- **Colores sugeridos**: `#B31F1F`, `#1E5631`, `#D4AF37`

### 17.2 Año Nuevo
- **Categoría**: Holiday · **Forma**: Redondo
- **Descripción corta**: Sticker festivo de celebración de año nuevo.
- **Caso de uso**: Decoración de producto o invitación de fin de año.
- **Público objetivo**: Comercios y organizadores de eventos de fin de año.
- **Nivel de dificultad**: Básico
- **Tags**: new-year, celebration, holiday, festive
- **Preview sugerido**: Confeti/destellos dorados, año editable en tipografía grande.
- **Mockup recomendado**: Copa o botella de brindis.
- **Colores sugeridos**: `#1A1A1A`, `#D4AF37`, `#FFFFFF`

### 17.3 Día de Muertos
- **Categoría**: Holiday · **Forma**: Personalizado (forma de calavera o flor de cempasúchil)
- **Descripción corta**: Sticker con motivo tradicional mexicano para la celebración de Día de Muertos.
- **Caso de uso**: Producto o empaque conmemorativo de temporada.
- **Público objetivo**: Comercios mexicanos y de la diáspora, eventos culturales.
- **Nivel de dificultad**: Intermedio
- **Tags**: dia-de-muertos, mexico, holiday, cultural
- **Preview sugerido**: Ilustración de calavera decorada estilo papel picado, paleta vibrante.
- **Mockup recomendado**: Ofrenda o producto artesanal de temporada.
- **Colores sugeridos**: `#F2994A`, `#9B51E0`, `#1A1A1A`

### 17.4 Halloween
- **Categoría**: Holiday · **Forma**: Redondo
- **Descripción corta**: Sticker festivo de Halloween con motivo divertido, no de terror.
- **Caso de uso**: Bolsa de dulces o decoración de temporada.
- **Público objetivo**: Comercios y familias en temporada de Halloween.
- **Nivel de dificultad**: Básico
- **Tags**: halloween, spooky-fun, holiday, festive
- **Preview sugerido**: Calabaza o fantasma ilustrado de forma amigable, paleta naranja/morado.
- **Mockup recomendado**: Bolsa de dulces de Halloween.
- **Colores sugeridos**: `#E67E22`, `#6C3483`, `#1A1A1A`

### 17.5 San Valentín
- **Categoría**: Holiday · **Forma**: Personalizado (corazón)
- **Descripción corta**: Sticker romántico en forma de corazón para productos/regalos de San Valentín.
- **Caso de uso**: Empaque de regalo o producto de temporada de San Valentín.
- **Público objetivo**: Comercios y particulares en temporada de febrero.
- **Nivel de dificultad**: Básico
- **Tags**: valentine, love, holiday, heart
- **Preview sugerido**: Corazón con textura o patrón sutil, espacio para mensaje corto.
- **Mockup recomendado**: Caja de chocolates o regalo pequeño.
- **Colores sugeridos**: `#C0392B`, `#F7CAC9`, `#FFFFFF`

---

## 18. Seasonal (3)

### 18.1 Verano
- **Categoría**: Seasonal · **Forma**: Redondo
- **Descripción corta**: Sticker de temporada de verano, sin atarse a una fecha festiva fija.
- **Caso de uso**: Promoción o producto de temporada de verano.
- **Público objetivo**: Comercios con oferta estacional (helados, bebidas, ropa de playa).
- **Nivel de dificultad**: Básico
- **Tags**: summer, verano, seasonal, sunny
- **Preview sugerido**: Sol o elemento tropical ilustrado, paleta cálida y luminosa.
- **Mockup recomendado**: Vaso de bebida fría o producto de playa.
- **Colores sugeridos**: `#F2C94C`, `#56CCF2`, `#FFFFFF`

### 18.2 Otoño
- **Categoría**: Seasonal · **Forma**: Redondo
- **Descripción corta**: Sticker de temporada de otoño con paleta cálida terrosa.
- **Caso de uso**: Producto o promoción de temporada otoñal.
- **Público objetivo**: Cafeterías, comercios con oferta estacional de otoño.
- **Nivel de dificultad**: Básico
- **Tags**: autumn, otono, seasonal, cozy
- **Preview sugerido**: Hoja de otoño ilustrada, paleta ocre/naranja.
- **Mockup recomendado**: Vaso de bebida caliente de temporada.
- **Colores sugeridos**: `#B5651D`, `#D98E28`, `#5C3A21`

### 18.3 Regreso a Clases
- **Categoría**: Seasonal · **Forma**: Rectangular
- **Descripción corta**: Sticker de temporada de regreso a clases, sin ser específicamente de la categoría Education.
- **Caso de uso**: Promoción comercial de temporada escolar (útiles, ropa, tecnología).
- **Público objetivo**: Comercios con oferta de temporada de regreso a clases.
- **Nivel de dificultad**: Básico
- **Tags**: back-to-school, seasonal, promo
- **Preview sugerido**: Ícono de lápiz o libreta, banda de "oferta de temporada".
- **Mockup recomendado**: Vitrina de tienda con útiles escolares.
- **Colores sugeridos**: `#2F80ED`, `#F2C94C`, `#FFFFFF`

---

## 19. QR & Smart Labels (4)

### 19.1 Menú Digital QR
- **Categoría**: QR & Smart Labels · **Forma**: Cuadrado
- **Descripción corta**: Sticker con espacio integrado para código QR enlazando a un menú digital.
- **Caso de uso**: Mesa o vitrina de restaurante/cafetería enlazando al menú online.
- **Público objetivo**: Restaurantes, cafeterías, food trucks.
- **Nivel de dificultad**: Intermedio (requiere reservar zona de alto contraste para el QR)
- **Tags**: qr-code, menu, restaurant, digital
- **Preview sugerido**: Zona de QR con margen de silencio respetado, texto "Escanea el menú" corto.
- **Mockup recomendado**: Mesa de restaurante con soporte de mesa.
- **Colores sugeridos**: `#1A1A1A`, `#FFFFFF`, `#9C4E27`

### 19.2 Enlace a Redes Sociales QR
- **Categoría**: QR & Smart Labels · **Forma**: Redondo
- **Descripción corta**: Sticker con QR para dirigir a redes sociales del negocio.
- **Caso de uso**: Empaque o vitrina enlazando al perfil de Instagram/redes del negocio.
- **Público objetivo**: Cualquier negocio con presencia en redes sociales.
- **Nivel de dificultad**: Intermedio
- **Tags**: qr-code, social-media, follow, digital
- **Preview sugerido**: QR centrado con anillo de texto "Síguenos", ícono de red social pequeño.
- **Mockup recomendado**: Empaque de producto o ventana de tienda.
- **Colores sugeridos**: `#9C4E27`, `#F7F5EF`, `#23282B`

### 19.3 Reseña QR
- **Categoría**: QR & Smart Labels · **Forma**: Rectangular
- **Descripción corta**: Sticker con QR invitando a dejar una reseña del negocio.
- **Caso de uso**: Mostrador o recibo invitando a calificar el negocio en línea.
- **Público objetivo**: Comercios y restaurantes que buscan reseñas online.
- **Nivel de dificultad**: Intermedio
- **Tags**: qr-code, review, feedback, digital
- **Preview sugerido**: Íconos de estrellas junto al QR, texto breve de invitación.
- **Mockup recomendado**: Mostrador de tienda o mesa de restaurante.
- **Colores sugeridos**: `#F2C94C`, `#1A1A1A`, `#FFFFFF`

### 19.4 Tarjeta de Contacto QR
- **Categoría**: QR & Smart Labels · **Forma**: Cuadrado
- **Descripción corta**: Sticker con QR que enlaza a una tarjeta de contacto digital.
- **Caso de uso**: Networking o material profesional con contacto digital instantáneo.
- **Público objetivo**: Freelancers y profesionales independientes.
- **Nivel de dificultad**: Intermedio
- **Tags**: qr-code, contact, networking, digital
- **Preview sugerido**: QR con nombre/rol debajo, diseño minimalista consistente con Business.
- **Mockup recomendado**: Laptop o cuaderno profesional.
- **Colores sugeridos**: `#23282B`, `#F7F5EF`, `#4B6673`

---

## Notas de cierre

- Ningún nombre de marca, logo o mockup fotográfico real fue usado — todas las direcciones de "Preview sugerido"/"Mockup recomendado" son dirección de arte para producción futura, no assets existentes.
- Los colores sugeridos son puntos de partida editables por el usuario en cada template, nunca un límite — el editor de THÖREN ya permite cambiar cualquier color libremente.
- Este catálogo es v1: la arquitectura (`TEMPLATE_LIBRARY_ARCHITECTURE.md` §1.5) está diseñada explícitamente para que agregar más templates, o categorías nuevas, no requiera ningún cambio estructural — ver `ROADMAP_TEMPLATE_SYSTEM.md` para cómo crece esto en versiones futuras.
