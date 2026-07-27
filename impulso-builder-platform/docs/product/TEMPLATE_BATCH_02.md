# Template Batch 02 — Té de Hierbas (Food & Beverage) + Cosmetics (Templates 6-10 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 6 a 10 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Novedad de este lote**: a partir de Batch 02, cada template incorpora una sección 11 — **Commercial Sheet** — con la ficha comercial pensada para Template Library, Gumroad, Marketplace y material de marketing. Esta sección no sustituye ni modifica ninguna de las 10 secciones de diseño anteriores; es información comercial adicional. No implica ningún cambio de arquitectura ni de código.

Este lote cierra la categoría Food & Beverage (template 1.6, el último pendiente) y abre Cosmetics con 4 de sus 5 templates — el quinto (Bálsamo Labial Natural, 2.5) pasa al Batch 03 junto con Beauty, para no romper el ritmo de 5 por lote a la mitad de una categoría.

Después de este lote se espera aprobación antes de continuar con el Batch 03.

---

## Template 6 — Té de Hierbas Orgánico

### 1. Concepto
Las marcas de té de hierbas orgánico venden, sobre todo, una promesa de calma y bienestar — pero la mayoría de los empaques de productores pequeños comunican "granel de tienda naturista" en vez de "ritual diario cuidado". El problema real: el comprador de este producto (con frecuencia alguien invirtiendo en su rutina de bienestar) asocia calidad percibida con serenidad visual, no con abundancia de texto o color. Este template existe para que un productor de té orgánico pequeño transmita esa serenidad de marca — sin necesitar un estudio de diseño — usando el mismo lenguaje de "menos es más" que ya funcionó para café y miel en este catálogo, pero con una paleta e ilustración propias de la categoría de bienestar.

### 2. Dirección de Arte
- **Tipografía**: serif suave y ligera para el nombre de la hierba/mezcla (recomendado: **Lora**, peso 400, igual que la variedad floral del Template 2 — consistencia de familia entre productos naturales del catálogo), sans-serif humanista para el beneficio funcional y datos (recomendado: **Work Sans**, peso 400, minúsculas).
- **Paleta**: salvia `#5F7A61`, crema cálido `#EDE6D6`, verde muy oscuro casi negro `#2F3B2E` para texto de alto contraste. Sin acento intercambiable como en café/mermelada — aquí la calma de una paleta fija es parte de la propuesta (variar el color rompería la sensación de "línea de bienestar coherente").
- **Estilo**: sereno, aireado, casi terapéutico — el espacio negativo es más generoso que en cualquier template anterior del catálogo.
- **Espaciados**: mínimo 5mm de aire alrededor del bloque de texto principal respecto al área segura (más que el mínimo de 4mm de café) — la sensación de "no apurado" es literal en el espaciado.
- **Jerarquía**: 1) nombre de la hierba/mezcla (ej. "Manzanilla & Lavanda"), 2) beneficio funcional corto (ej. "Calma y descanso"), 3) ilustración de hoja/flor, 4) datos de producto (cantidad de sobres, modo de preparación).
- **Alineaciones**: composición centrada, simétrica, sin elementos que rompan el eje vertical.
- **Formas**: cuadrado de troquel con esquinas ligeramente redondeadas si el flujo de producción del cliente lo permite (opcional, no estructural).
- **Iconografía**: una sola ilustración lineal de la hoja/flor correspondiente a la mezcla — mismo criterio de "un solo ícono" que el resto del catálogo.
- **Texturas**: ninguna — el aire y el color sólido ya comunican calma; una textura añadida se sentiría "ruidosa" para esta categoría específicamente.
- **Estilo visual**: línea fina botánica, trazo delicado (más fino que el ícono de café), sin relleno.

### 3. Layout
- **Formato**: cuadrado de 50mm × 50mm.
- **Zonas**: tercio superior (ilustración de hoja/flor), tercio medio (nombre de la mezcla, tipografía más grande), tercio inferior (beneficio funcional + dato de producto).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — en formato cuadrado las esquinas son la zona de mayor riesgo de corte, ningún elemento se ubica en las esquinas.
- **Retícula**: división vertical en 3 franjas iguales, alineación centrada estricta en cada franja.
- **Proporciones**: la ilustración ocupa máximo 22% de la altura total, para no competir con el espacio negativo que define la categoría.

### 4. Elementos
- Nombre de la mezcla de hierbas (ej. "Manzanilla & Lavanda", "Menta & Jengibre")
- Beneficio funcional corto (ej. "Calma y descanso", "Digestión ligera")
- Ilustración de hoja o flor correspondiente
- Cantidad de sobres o peso a granel (ej. "20 sobres" / "50g")
- Modo de preparación breve (opcional, ej. "Infusionar 5 min")

### 5. Assets necesarios
- Set de 4-6 ilustraciones SVG de hoja/flor (manzanilla, lavanda, menta, jengibre, hibisco, rooibos), mismo estilo de línea fina consistente entre todas
- No se requiere fotografía para el diseño del template en sí (solo para el mockup, ver §6)

### 6. Mockup
Caja de cartón pequeña tipo estuche con ventana troquelada mostrando los sobres de té dentro, luz natural suave y difusa (sin sombras duras — coherente con la sensación de calma), apoyada sobre una superficie de madera clara o piedra mate neutra, con una taza de té humeante desenfocada al fondo como contexto ambiental (nunca en foco, nunca compitiendo con el empaque).

### 7. Thumbnail
Etiqueta cuadrada sola, centrada, sobre fondo crema sólido (`#EDE6D6`) — debe leerse el nombre de la mezcla y la silueta de la hoja a tamaño de card sin esfuerzo; si el aire generoso del diseño hace que el thumbnail se sienta "vacío" a 150px, la solución es aumentar el tamaño de fuente del layout real, nunca recortar el margen del thumbnail.

### 8. Prompt para IA
Para el set de ilustraciones botánicas (ejemplo con manzanilla, repetir patrón por hierba):
> "Delicate thin-line botanical illustration of a single chamomile flower sprig, fine consistent stroke weight around 1pt, no fill, no shading, serene minimalist herbal illustration style, pure black line on transparent background, suitable for a matching set (lavender, mint, ginger root, hibiscus, rooibos leaf) at identical line weight and level of detail."

### 9. Exportación
- Tamaño final: 50mm × 50mm (cuadrado).
- Sangrado: 3mm en los 4 lados. Área segura: margen interno de 3mm.
- Recomendación de impresión: papel adhesivo mate no estucado (el brillo rompe la sensación orgánica/artesanal de esta categoría); resolución mínima de exportación 300 PPI real.

### 10. Nivel de calidad
Lo que hace este template premium es literalmente lo que no tiene: sin textura, sin segundo color de acento, sin segundo ícono. El error más común a evitar es "llenar" el espacio negativo con un sello o banda decorativa adicional — en esta categoría específicamente, el vacío es el mensaje de marca, no un descuido. Validación del estándar THÖREN: si el diseño transmite calma con solo mirarlo 1 segundo (antes de leer una sola palabra), pasa; si el ojo tiene que buscar dónde mirar primero, no pasa.

### 11. Commercial Sheet
- **Nombre comercial**: Ritual — Etiqueta de Té de Hierbas
- **Elevator Pitch**: Etiqueta serena y minimalista para tu línea de té de hierbas, con espacio para mezcla, beneficio e ilustración botánica lista para producción.
- **Beneficio principal**: Transmite calma y calidad artesanal en 2 segundos de vistazo — sin necesitar diseñador ni experiencia previa en branding.
- **Ideal para**: marcas de té artesanal, herbolarias, marcas de bienestar/wellness, apotecarios naturales, cafeterías con línea de infusiones propia.
- **Nivel de personalización**: Medio (nombre de mezcla, beneficio, ilustración intercambiable entre 6 hierbas del set).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de té con ventana, bolsas de té a granel, sobres individuales, latas de té.
- **Palabras clave SEO**: etiqueta té hierbas, sticker té orgánico, template té artesanal, etiqueta infusión, packaging wellness, etiqueta minimalista natural, sticker herbolaria, etiqueta bienestar, diseño té de hierbas, etiqueta bolsa de té, sticker manzanilla, etiqueta menta jengibre, packaging orgánico, etiqueta cuadrada natural, sticker calma, etiqueta línea de té, template wellness, sticker botánico, etiqueta artesanal minimalista, packaging herbal.
- **Categoría comercial**: Food & Beverage.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Set de 6 ilustraciones botánicas intercambiables incluidas; paleta de calma validada para categoría wellness; layout probado para legibilidad a tamaño real de 50mm.
- **Call to Action**: Dale a tu té de hierbas la calma que promete, desde la primera mirada.

---

## Template 7 — Serum Facial Premium

### 1. Concepto
En skincare independiente, el frasco gotero es prácticamente el único punto de contacto físico entre la marca y la promesa de "activo concentrado, resultado real" — y ese punto de contacto compite contra marcas de lujo (The Ordinary, Drunk Elephant, marcas de nicho de Sephora) que invirtieron en minimalismo de altísimo nivel. El problema: cualquier elemento decorativo de más en esta categoría específica se lee como "no confío en mi propio producto" — el comprador de serum premium asocia sofisticación con ausencia de ruido visual, no con más información. Este template existe para dar esa confianza silenciosa sin requerir dirección de arte de lujo contratada.

### 2. Dirección de Arte
- **Tipografía**: una sola familia sans-serif geométrica de alta gama para todo el diseño (recomendado: **Century Gothic** o, si se requiere licencia libre, **Poppins** peso 300 para el wordmark y 400 para el porcentaje de activos) — deliberadamente una sola familia, sin segunda tipografía de apoyo, porque la restricción tipográfica ES la señal de lujo en esta categoría.
- **Paleta**: carbón casi negro `#23282B`, hueso `#EDEAE2`, cobre/ámbar `#9C4E27` como único acento (usado solo en el porcentaje de activos o una línea fina, nunca en un bloque grande).
- **Estilo**: minimalista de lujo silencioso — sin ilustración, todo el peso recae en tipografía y espacio negativo (a diferencia de café, que sí usa un ícono; aquí incluso un ícono se sentiría "de más").
- **Espaciados**: el margen de aire alrededor del wordmark central es el elemento de diseño más importante del template — mínimo 6mm de aire respecto al área segura, el mayor de todo el catálogo hasta ahora.
- **Jerarquía**: 1) wordmark/nombre de marca (centrado, dominante), 2) nombre del producto (ej. "Serum Vitamina C"), 3) % de activo principal (ej. "15%"), 4) volumen (ej. "30ml"), en tipografía notablemente más pequeña que las anteriores.
- **Alineaciones**: centrada estricta, eje único vertical, sin ningún elemento fuera de ese eje.
- **Formas**: círculo de troquel para la etiqueta frontal del frasco gotero.
- **Iconografía**: ninguna — cero ilustraciones, cero íconos. Es el único template del catálogo hasta ahora sin ningún elemento gráfico más allá de tipografía y una línea fina divisoria opcional.
- **Texturas**: ninguna.
- **Estilo visual**: tipografía pura, espacio negativo como material de diseño principal.

### 3. Layout
- **Formato**: círculo de 40mm de diámetro (más pequeño que café/miel — frasco gotero de 30ml es un envase más reducido).
- **Zonas**: centro exacto (wordmark de marca), justo debajo (nombre del producto), línea fina divisoria horizontal, debajo de la línea (% de activo + volumen en una sola línea pequeña).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — dado el tamaño reducido del círculo (40mm), el margen de 3mm representa una proporción mayor del diseño total que en los templates de 50mm, así que la disciplina de espaciado es aún más crítica aquí.
- **Retícula**: eje vertical único, todo centrado sobre ese eje, sin retícula horizontal secundaria.
- **Proporciones**: la línea divisoria fina ocupa como máximo el 40% del ancho del círculo, nunca de borde a borde (una línea completa se sentiría como una etiqueta técnica de laboratorio genérica, no de marca premium).

### 4. Elementos
- Wordmark / nombre de marca
- Nombre del producto (ej. "Serum Vitamina C", "Serum Ácido Hialurónico")
- Porcentaje de activo principal (ej. "15%", "2%")
- Volumen (ej. "30ml")
- Línea divisoria fina (elemento gráfico, no texto)

### 5. Assets necesarios
- Ninguno gráfico — el template se construye enteramente con tipografía y una línea divisoria vectorial simple (no requiere ilustración ni ícono).

### 6. Mockup
Frasco gotero de vidrio ámbar u opaco (color a elegir por el cliente), fondo neutro absoluto (blanco puro o gris muy claro, sin textura), luz de estudio suave y uniforme sin sombras duras marcadas (luz difusa tipo softbox), vista frontal recta, sin elementos de apoyo adicionales (sin plantas, sin gotas de agua decorativas) — el vacío alrededor del frasco es intencional y parte del mensaje de lujo silencioso.

### 7. Thumbnail
Etiqueta circular sola sobre fondo hueso sólido (`#EDEAE2`) — a diferencia de todos los templates anteriores, aquí el thumbnail debe verse casi "vacío" a propósito; si se siente con poco contenido, es correcto — llenarlo destruiría la propuesta de valor del template.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y una línea vectorial simple, ambas producibles directamente en el editor sin ilustración externa.

### 9. Exportación
- Tamaño final: 40mm × 40mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno (proporcionalmente más exigente por el tamaño reducido, ver §3).
- Recomendación de impresión: vinil transparente con tinta blanca de respaldo (si el frasco es de vidrio ámbar translúcido) o vinil mate opaco sobre frasco opaco; nunca acabado brillante — compite con la sofisticación mate esperada en skincare premium.

### 10. Nivel de calidad
Premium aquí se mide por lo que se resiste a agregar, no por lo que se agrega: sin ilustración, una sola familia tipográfica, un solo acento de color usado con moderación extrema. El error más común a evitar es agregar un ícono botánico o una hoja decorativa "para que no se vea tan vacío" — eso es exactamente lo que rompe la categoría. Validación: comparar el template a tamaño real junto a una marca de referencia real de lujo en skincare (sin copiar su diseño) — debe sentirse de la misma familia de sofisticación visual.

### 11. Commercial Sheet
- **Nombre comercial**: Pure Line — Etiqueta de Serum Premium
- **Elevator Pitch**: Etiqueta ultra-minimalista para serums y activos concentrados, diseñada con la misma disciplina visual que las marcas de skincare de lujo.
- **Beneficio principal**: Comunica sofisticación y confianza en el producto sin decir una palabra de más — ideal para justificar precio premium.
- **Ideal para**: marcas de skincare independientes, cosmética natural de alta gama, laboratorios de belleza boutique, marcas DTC de activos concentrados.
- **Nivel de personalización**: Bajo (deliberado — la restricción tipográfica es la propuesta de valor; solo cambian nombre, % de activo y volumen).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Muy fácil (sin ilustraciones ni assets gráficos que alinear).
- **Productos compatibles**: Frascos goteros, frascos airless, envases de vidrio ámbar u opaco, tubos premium.
- **Palabras clave SEO**: etiqueta serum, sticker skincare premium, template cosmética minimalista, etiqueta frasco gotero, packaging belleza de lujo, etiqueta serum facial, sticker cosmética natural, template skincare, etiqueta minimalista belleza, packaging activo concentrado, sticker ácido hialurónico, etiqueta vitamina C, template frasco cosmético, sticker marca de lujo, etiqueta belleza independiente, packaging serum premium, template wordmark cosmética, etiqueta circular skincare, sticker beauty brand, packaging minimalista lujo.
- **Categoría comercial**: Cosmetics.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Sistema tipográfico de una sola familia validado para categoría de lujo; cero producción de assets gráficos requerida; layout ya calibrado para frasco gotero de 30ml.
- **Call to Action**: Deja que el silencio del diseño hable de la calidad de tu fórmula.

---

## Template 8 — Crema Corporal Natural

### 1. Concepto
La crema corporal natural/orgánica se vende principalmente por el ingrediente destacado (karité, coco, avena, caléndula) — el comprador decide con frecuencia por ese único ingrediente antes de leer cualquier otra cosa. El problema: muchos productores pequeños listan el ingrediente en texto plano perdido entre otro texto, en vez de darle protagonismo visual. Este template resuelve eso dándole al ingrediente destacado su propio espacio gráfico dedicado, manteniendo el resto del diseño limpio y natural.

### 2. Dirección de Arte
- **Tipografía**: sans-serif orgánica y cálida para el nombre del producto (recomendado: **Nunito** peso 600), la misma familia en peso 400 para el ingrediente destacado y descripción.
- **Paleta**: verde salvia `#7C9070`, hueso cálido `#FBF7EF`, marrón oscuro casi negro `#3C3A32` para texto de alto contraste.
- **Estilo**: natural, limpio, ligeramente botánico — más cálido que el serum (Template 7) pero igual de disciplinado en espacio negativo.
- **Espaciados**: márgenes generosos (mínimo 5mm respecto al área segura) en el cuerpo central de texto; la ilustración botánica vive únicamente en el borde, nunca invade el centro.
- **Jerarquía**: 1) nombre del producto (ej. "Crema Corporal"), 2) ingrediente destacado (ej. "Karité & Coco", en tamaño casi tan grande como el nombre del producto — es co-protagonista, no un detalle menor), 3) descripción corta de beneficio, 4) volumen.
- **Alineaciones**: composición envolvente (la etiqueta rodea el tubo o frasco cilíndrico), texto alineado a la izquierda dentro del rectángulo envolvente para facilitar lectura en superficie curva.
- **Formas**: rectángulo envolvente (etiqueta de tubo o frasco cilíndrico).
- **Iconografía**: una sola ilustración botánica sutil ubicada en un borde (nunca en el centro), correspondiente al ingrediente destacado (ej. una hoja de karité, la silueta de un coco partido).
- **Texturas**: ninguna en el cuerpo central; textura de papel muy sutil (3-4% opacidad) permitida solo en la franja donde vive la ilustración botánica, para diferenciarla visualmente del bloque de texto.
- **Estilo visual**: línea fina botánica para la ilustración, coherente con el resto del catálogo de productos naturales (té, miel).

### 3. Layout
- **Formato**: rectangular horizontal envolvente, proporción aprox. 1:3.5 (etiqueta de tubo o envase cilíndrico de 100-200ml).
- **Zonas**: banda izquierda (ilustración botánica sutil, ~15% del ancho), cuerpo central (nombre del producto + ingrediente destacado + descripción), banda derecha (volumen + un pequeño ícono de "natural"/"vegano" si aplica).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — en un envase cilíndrico envolvente, la zona central (donde queda de frente al usuario) concentra toda la información crítica, dejando los extremos de la etiqueta como zona de menor lectura garantizada.
- **Retícula**: 3 columnas horizontales de proporción fija (15% / 70% / 15%), sin líneas divisorias visibles.
- **Proporciones**: la ilustración botánica nunca excede el ancho de su columna asignada (15%), evitando que "invada" el cuerpo de texto central.

### 4. Elementos
- Nombre del producto (ej. "Crema Corporal Nutritiva")
- Ingrediente destacado (ej. "Karité & Coco", "Avena & Caléndula")
- Descripción corta de beneficio (ej. "Hidratación profunda 24h")
- Volumen (ej. "150ml")
- Ilustración botánica del ingrediente destacado
- Opcional: sello pequeño "Natural" / "Vegano" / "Sin parabenos"

### 5. Assets necesarios
- Set de 3-4 ilustraciones botánicas SVG correspondientes a ingredientes comunes (karité, coco, avena, caléndula), mismo estilo de línea fina que el resto del catálogo natural
- 1 ícono pequeño opcional de sello "natural/vegano" (línea simple, no un badge complejo)

### 6. Mockup
Frasco cilíndrico blanco mate con tapa a presión, vista de 3/4, luz natural suave desde la izquierda, apoyado sobre una superficie de piedra clara o madera muy pálida, con 1-2 elementos del ingrediente destacado junto al frasco fuera de foco (ej. un coco partido a la mitad si el ingrediente es coco) — el mismo patrón de "contexto desenfocado que refuerza sin competir" usado en café y miel.

### 7. Thumbnail
Recorte de la etiqueta envolvente aplanada (vista frontal, no la curva completa del cilindro) sobre fondo hueso sólido — debe leerse tanto el nombre del producto como el ingrediente destacado a tamaño de card, ya que ambos son igual de importantes para el reconocimiento rápido.

### 8. Prompt para IA
Para el set de ilustraciones botánicas de ingredientes (ejemplo con karité):
> "Delicate thin-line botanical illustration of a shea tree leaf and nut, fine consistent stroke weight, no fill, no shading, natural skincare label aesthetic, pure black line on transparent background, suitable for a matching set of ingredient illustrations (coconut half, oat stalk, calendula flower) at identical line weight and detail level."

### 9. Exportación
- Tamaño final: 130mm × 40mm aprox. (etiqueta envolvente para tubo/frasco cilíndrico de 150ml, ajustable a la circunferencia real del envase del cliente).
- Sangrado: 3mm en los 4 lados. Área segura: 3mm de margen interno, con atención especial a que la información central quede dentro del arco de visión frontal del cilindro (no en el pliegue trasero de la etiqueta).
- Recomendación de impresión: vinil resistente a humedad de baño (uso típico en ducha/regadera), acabado mate.

### 10. Nivel de calidad
Premium aquí se logra dándole al ingrediente destacado el mismo peso visual que el nombre del producto, sin que ninguno de los dos "gane" — el error más común a evitar es hacer el ingrediente una nota pequeña al pie, lo cual desperdicia la razón real de compra del cliente. Validación: cubrir con la mano el nombre del producto — el ingrediente destacado por sí solo debe seguir siendo perfectamente legible y prominente.

### 11. Commercial Sheet
- **Nombre comercial**: Botanica — Etiqueta de Crema Corporal Natural
- **Elevator Pitch**: Etiqueta envolvente que le da al ingrediente estrella de tu crema el protagonismo que merece, sin perder limpieza visual.
- **Beneficio principal**: Comunica el ingrediente destacado de un vistazo — la razón real por la que el cliente compra — sin saturar el diseño.
- **Ideal para**: marcas de cosmética natural/orgánica, productores de cremas artesanales, marcas veganas de cuidado corporal, spas con línea de producto propia.
- **Nivel de personalización**: Medio (nombre, ingrediente destacado e ilustración intercambiables entre 4 opciones del set).
- **Tiempo estimado de personalización**: 15 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Tubos cosméticos, frascos cilíndricos con tapa a presión, envases airless.
- **Palabras clave SEO**: etiqueta crema corporal, sticker cosmética natural, template crema hidratante, etiqueta karité coco, packaging cosmética orgánica, sticker crema vegana, etiqueta ingrediente destacado, template cuidado corporal, packaging spa natural, sticker crema artesanal, etiqueta tubo cosmético, template avena caléndula, packaging natural belleza, sticker crema nutritiva, etiqueta envolvente cosmética, template marca vegana, packaging cuidado piel, sticker botánico crema, etiqueta cosmética limpia, template crema orgánica.
- **Categoría comercial**: Cosmetics.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Set de 4 ilustraciones botánicas de ingredientes incluidas; layout envolvente calibrado para envase cilíndrico; sistema de "ingrediente co-protagonista" diferenciador frente a etiquetas genéricas.
- **Call to Action**: Deja que tu ingrediente estrella se vea tan bien como se siente en la piel.

---

## Template 9 — Jabón Artesanal en Barra

### 1. Concepto
El jabón artesanal en barra se vende casi exclusivamente en ferias, mercados y tiendas de productos naturales, donde compite directamente contra decenas de otras barras de jabón hechas a mano en la misma mesa. El problema: sin empaque, el jabón se ve genérico e indistinguible; con una faja envolvente bien diseñada, comunica de inmediato aroma/ingrediente y marca. Este template existe específicamente para resolver el reto técnico de envolver una barra física irregular (no un envase de vidrio uniforme) sin que el diseño se vea "estirado" o mal ajustado.

### 2. Dirección de Arte
- **Tipografía**: serif clásica ligera para el nombre de la marca/jabonería (recomendado: **Cormorant**, peso 500), sans-serif simple para el ingrediente/aroma (recomendado: **Work Sans**, versalitas).
- **Paleta**: marrón artesanal `#8B6F47`, crema papel reciclado `#F5EFE3`, marrón muy oscuro `#3E2E1F` para texto de alto contraste.
- **Estilo**: artesanal auténtico — textura de papel reciclado visible, nunca digital-plano; este es el template del catálogo donde la textura SÍ es protagonista, no un detalle sutil de fondo.
- **Espaciados**: banda horizontal compacta (la faja es angosta por naturaleza), margen mínimo de 3mm respecto al área segura respetado incluso en el formato más estrecho del catálogo hasta ahora.
- **Jerarquía**: 1) nombre del aroma/ingrediente (ej. "Lavanda & Avena"), 2) sello circular pequeño superpuesto con el nombre de la jabonería, 3) peso del jabón.
- **Alineaciones**: banda horizontal centrada, sello circular superpuesto ligeramente descentrado hacia un extremo (rompe deliberadamente la simetría perfecta — refuerza la sensación de "hecho a mano", no de producción en masa).
- **Formas**: **personalizado** — envoltura rectangular con muescas/pestañas para plegarse sobre los extremos de la barra física (no un rectángulo simple; requiere plantilla de troquelado con líneas de plegado).
- **Iconografía**: ninguna ilustración adicional — el sello circular superpuesto es el único elemento gráfico más allá de tipografía y textura.
- **Texturas**: textura de papel reciclado visible y pronunciada (12-18% de presencia, notablemente más marcada que la textura sutil de café) — aquí la textura ES el argumento de venta de "artesanal", no un detalle de fondo.
- **Estilo visual**: aspecto de papel kraft reciclado auténtico, sello tipo estampado con ligera imperfección de tinta simulada.

### 3. Layout
- **Formato**: **personalizado** — faja rectangular alargada (aprox. 200mm × 60mm desplegada) con muescas de plegado en ambos extremos para envolver una barra estándar de 100g; requiere plantilla técnica de troquelado + líneas de plegado, no solo un rectángulo de impresión.
- **Zonas**: cuerpo central visible (nombre del aroma, sello superpuesto), pestañas laterales de plegado (sin contenido crítico — se pliegan hacia atrás de la barra y quedan ocultas).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — con una restricción adicional específica de este template: todo el contenido crítico (nombre del aroma, sello) debe quedar dentro de la zona central que permanece visible una vez plegada la faja, no en las pestañas laterales.
- **Retícula**: una sola franja horizontal para el cuerpo central; las pestañas laterales siguen la plantilla técnica de plegado, no una retícula de diseño libre.
- **Proporciones**: el sello circular superpuesto mide aproximadamente 25mm de diámetro, fijo, sin importar el ancho total de la barra (para mantener consistencia entre distintos tamaños de jabón de la misma marca).

### 4. Elementos
- Nombre del aroma o ingrediente principal (ej. "Lavanda & Avena", "Carbón Activado")
- Sello circular superpuesto con el nombre de la jabonería/marca
- Peso del jabón (ej. "100g")
- Opcional: lista corta de 2-3 ingredientes clave

### 5. Assets necesarios
- 1 plantilla técnica de troquelado con líneas de plegado para faja envolvente de barra de 100g (documento de producción, no solo un archivo de diseño plano)
- 1 textura de papel reciclado visible, tileable, en tonos cálidos
- 1 elemento gráfico de "sello estampado" (textura de tinta con ligera imperfección, para el sello circular superpuesto)

### 6. Mockup
Barra de jabón artesanal rectangular con la faja aplicada, vista de 3/4 apoyada sobre una tabla de madera rústica, con virutas de jabón o pétalos secos del ingrediente correspondiente dispersos junto a la barra (desenfocados), luz natural cálida direccional — el mismo lenguaje de mockup artesanal usado en miel, pero con props propios de jabonería (nunca reutilizar props de otra categoría).

### 7. Thumbnail
Vista de la barra completa con la faja aplicada (a diferencia de otros templates del catálogo, aquí SÍ conviene mostrar el producto físico completo en el thumbnail, no solo la etiqueta plana, porque la faja solo se entiende en contexto de la barra) — fondo neutro claro.

### 8. Prompt para IA
Para la textura de papel reciclado:
> "Visible recycled kraft paper texture, warm brown tones, natural fiber flecks and subtle imperfections clearly visible (not too subtle), tileable seamless pattern, artisan handmade packaging aesthetic, suitable for a prominent 12-18% opacity overlay."

Para el elemento de sello estampado:
> "Circular rubber stamp texture with slightly uneven ink distribution, hand-stamped imperfection at the edges, single dark brown or black ink color, vintage artisan seal aesthetic, transparent background, suitable as an overlay behind a circular logo mark."

### 9. Exportación
- Tamaño final: 200mm × 60mm aprox. desplegada (faja completa con pestañas de plegado) — **requiere archivo técnico de troquelado adicional al archivo de diseño**, no es una exportación plana estándar.
- Sangrado: 3mm en los 4 lados del contorno total de la faja (incluyendo pestañas). Área segura: 3mm de margen interno, aplicado estrictamente a la zona central visible, no a las pestañas.
- Recomendación de impresión: papel kraft reciclado real (no solo textura simulada) cuando sea posible, para coherencia entre diseño y material físico; si se imprime en vinil, usar acabado mate texturizado, nunca liso.

### 10. Nivel de calidad
Premium aquí no significa "lujoso" sino "auténtico" — el error más común a evitar es una faja perfectamente simétrica y digital-limpia, que traiciona la promesa de "hecho a mano" del producto. Validación: el sello circular debe verse ligeramente imperfecto a propósito (no perfectamente centrado, tinta con variación sutil) — si se ve demasiado perfecto, se ve falso para esta categoría específica.

### 11. Commercial Sheet
- **Nombre comercial**: Artesano — Faja para Jabón en Barra
- **Elevator Pitch**: Faja envolvente con plantilla de troquelado incluida, diseñada específicamente para vestir una barra de jabón artesanal real.
- **Beneficio principal**: Resuelve el reto técnico de empacar un producto físico irregular con un diseño que se ve auténtico, no genérico ni digital.
- **Ideal para**: jaboneros artesanales, marcas de cosmética natural en barra, ferias y mercados de productos naturales, tiendas de regalo artesanal.
- **Nivel de personalización**: Medio (aroma, ingredientes y nombre de marca editables; el sello circular mantiene su formato).
- **Tiempo estimado de personalización**: 20 minutos (incluye revisar el ajuste de la plantilla de plegado al tamaño real de la barra del cliente).
- **Dificultad de impresión**: Avanzada (requiere ajustar la troquelada a las dimensiones exactas de la barra física — el único template "Avanzado" de este lote).
- **Productos compatibles**: Barras de jabón artesanal de 80-120g, barras de champú sólido de formato similar.
- **Palabras clave SEO**: faja jabón artesanal, etiqueta jabón en barra, sticker jabonería, template packaging jabón, faja envolvente natural, etiqueta jabón hecho a mano, packaging jabón artesanal, sticker sello jaboneria, template faja kraft, etiqueta champú sólido, packaging cosmética natural barra, faja producto artesanal, etiqueta lavanda avena, template jabón vegano, sticker mercado artesanal, packaging faja reciclada, etiqueta carbón activado, template jabonería independiente, sticker producto en barra, faja kraft jabón.
- **Categoría comercial**: Cosmetics.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Incluye plantilla técnica de troquelado con líneas de plegado (no solo diseño plano); textura de papel reciclado auténtica; sistema de sello estampado con imperfección controlada.
- **Call to Action**: Viste tu jabón con la misma autenticidad con la que lo elaboras.

---

## Template 10 — Aceite Esencial Puro

### 1. Concepto
El aceite esencial se vende en el frasco más pequeño de todo este catálogo (10-15ml) — el reto de diseño no es de jerarquía compleja sino de precisión extrema en un espacio mínimo. El comprador de aromaterapia valora la pureza y concentración del producto; un diseño que intenta meter demasiada información en un frasco tan pequeño comunica lo contrario. Este template existe para resolver ese problema específico de escala, no como una versión reducida del Template 7 (serum) sino como un sistema propio calibrado desde cero para formatos diminutos.

### 2. Dirección de Arte
- **Tipografía**: sans-serif geométrica simple para el nombre de la esencia (recomendado: **Work Sans**, peso 500) — una sola familia, un solo peso dominante; a este tamaño de etiqueta, una segunda familia tipográfica generalmente deja de ser legible.
- **Paleta**: azul profundo `#4B6673`, hueso `#F7F5EF`, casi negro `#14181A` para texto de máximo contraste (crítico dado el tamaño reducido del texto).
- **Estilo**: preciso, casi farmacéutico en su exactitud, pero cálido en su paleta (evita el aspecto "de laboratorio frío" mediante el uso del azul profundo en vez de blanco/gris clínico).
- **Espaciados**: al ser el formato más pequeño del catálogo, el margen se mide en fracciones de milímetro más que en los templates anteriores — aun así, el área segura de 3mm se mantiene como piso no negociable, lo que en un frasco de 25mm de diámetro representa una proporción considerable del espacio total disponible.
- **Jerarquía**: 1) nombre de la esencia (ej. "Lavanda", "Eucalipto") — el elemento más grande posible dentro del espacio disponible, 2) ícono botánico diminuto, 3) volumen (ej. "15ml"), en el texto más pequeño del diseño.
- **Alineaciones**: centrada estricta, un solo eje.
- **Formas**: círculo de troquel, pequeño (25mm).
- **Iconografía**: un ícono botánico diminuto de la planta correspondiente, reducido a su forma más esencial posible (menos detalle que cualquier otro ícono del catálogo — a este tamaño, el detalle se pierde y solo genera ruido visual).
- **Texturas**: ninguna — a este tamaño cualquier textura se percibiría como manchas, no como textura intencional.
- **Estilo visual**: línea ultra simplificada, casi pictograma, más cercana a un ícono de interfaz que a una ilustración botánica detallada.

### 3. Layout
- **Formato**: círculo de 25mm de diámetro (el formato más pequeño de todo el catálogo).
- **Zonas**: centro (nombre de la esencia, ocupando la mayor proporción posible del círculo), borde superior (ícono botánico diminuto), borde inferior (volumen).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — a este tamaño de troquel, el área segura consume una porción del diámetro notablemente mayor que en los templates de 50mm, por lo que el diseño se planea desde cero para esa restricción, no se reduce un layout pensado para un tamaño mayor.
- **Retícula**: eje vertical único, 3 puntos de anclaje (ícono arriba, nombre centro, volumen abajo), sin zonas intermedias de aire adicional — a este tamaño no sobra espacio para "aire de lujo" como en el serum.
- **Proporciones**: el ícono botánico ocupa un máximo de 15% del diámetro total — el más pequeño de todos los íconos del catálogo.

### 4. Elementos
- Nombre de la esencia (ej. "Lavanda", "Eucalipto", "Árbol de Té")
- Ícono botánico diminuto de la planta correspondiente
- Volumen (ej. "15ml", "10ml")

### 5. Assets necesarios
- Set de 6-8 íconos botánicos ultra-simplificados (lavanda, eucalipto, árbol de té, menta, romero, limón, naranja, incienso), estilo pictograma, mismo nivel de reducción entre todos

### 6. Mockup
Frasco gotero ámbar de 15ml, vista frontal recta, fondo neutro claro liso, luz de estudio suave sin sombras marcadas, sin props adicionales (ni siquiera los elementos botánicos desenfocados usados en otros templates — a este tamaño de producto, cualquier elemento adicional en el mockup compite visualmente con el frasco mismo, que ya es pequeño).

### 7. Thumbnail
Etiqueta circular sola sobre fondo hueso sólido, mostrada considerablemente más grande que su tamaño real relativo a la card (para que el nombre de la esencia siga siendo legible pese al formato diminuto del template) — única excepción del catálogo donde el thumbnail se escala deliberadamente por encima de la proporción real frente a otros templates, justificada por la legibilidad.

### 8. Prompt para IA
Para el set de íconos botánicos ultra-simplificados (ejemplo con lavanda):
> "Ultra-minimal pictogram-style icon of a single lavender sprig, reduced to its most essential recognizable shape, single thin line, no fine detail (must remain legible at very small sizes), flat vector icon aesthetic similar to a UI icon rather than a detailed botanical illustration, transparent background, suitable for a matching icon set (eucalyptus, tea tree, mint, rosemary, lemon, orange, frankincense) at identical reduction level."

### 9. Exportación
- Tamaño final: 25mm × 25mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno (proporcionalmente la más exigente de todo el catálogo dado el tamaño reducido del troquel).
- Recomendación de impresión: vinil resistente a aceites (relevante — el producto puede tener contacto directo con residuo de aceite en el cuello del frasco), acabado mate; verificar impresión de prueba física a tamaño real antes de producción masiva, dado lo reducido del texto.

### 10. Nivel de calidad
Premium a esta escala se mide en legibilidad, no en ornamento — el error más común a evitar es intentar incluir información adicional (porcentaje de pureza, país de origen, modo de uso) que satura un espacio que físicamente no la puede sostener con legibilidad. Validación: imprimir una prueba física a 25mm real y leer el nombre de la esencia a 30cm de distancia sin acercarse — si no se lee cómodamente, el texto necesita ser más grande y algo más necesita eliminarse del diseño, nunca reducirse de tamaño.

### 11. Commercial Sheet
- **Nombre comercial**: Essence — Etiqueta de Aceite Esencial
- **Elevator Pitch**: Sistema de etiqueta ultra-preciso para aceites esenciales puros, diseñado desde cero para el reto de los frascos más pequeños.
- **Beneficio principal**: Mantiene legibilidad y elegancia incluso en el formato más reducido de toda la Template Library — nada se ve apretado ni improvisado.
- **Ideal para**: marcas de aromaterapia, herbolarias, spas con línea de aceites propia, marcas de bienestar y aceites esenciales puros.
- **Nivel de personalización**: Bajo (nombre de esencia e ícono intercambiables entre 8 opciones del set; volumen editable).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Media (formato pequeño exige revisión de prueba física antes de producción masiva).
- **Productos compatibles**: Frascos goteros de 10-15ml, frascos roll-on pequeños.
- **Palabras clave SEO**: etiqueta aceite esencial, sticker aromaterapia, template frasco pequeño, etiqueta lavanda eucalipto, packaging aceite esencial puro, sticker aceite roll-on, etiqueta gotero 15ml, template aromaterapia, packaging wellness pequeño, sticker esencia pura, etiqueta frasco ámbar, template aceite botánico, packaging spa aceites, sticker minimalista aceite, etiqueta árbol de té, template etiqueta diminuta, packaging herbolaria aceite, sticker aceite natural, etiqueta pictograma botánico, template esencial puro.
- **Categoría comercial**: Cosmetics.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Set de 8 íconos botánicos pictográficos incluidos; layout calibrado específicamente para formatos de 25mm (no una reducción de un template más grande); guía de validación de legibilidad a tamaño real incluida.
- **Call to Action**: La pureza de tu aceite merece una etiqueta igual de precisa.

---

## Cierre del lote

5 de 63 templates completados en este lote (Batch 02: template 1.6 de Food & Beverage — cierra esa categoría — y templates 2.1 a 2.4 de Cosmetics). El template 2.5 (Bálsamo Labial Natural) pasa al Batch 03 junto con Beauty completa (3.1-3.3), para no romper el ritmo de lotes de 5 a la mitad de una categoría.

Progreso acumulado: 10 de 63 templates completados (Batch 01 + Batch 02).

**A la espera de aprobación antes de continuar con Batch 03** (Bálsamo Labial Natural + 3 templates de Beauty).
