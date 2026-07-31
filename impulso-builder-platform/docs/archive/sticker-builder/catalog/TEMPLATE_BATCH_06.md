> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 06 — Packaging + Shipping (Templates 26-30 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 26 a 30 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas desde Batch 03/04 se mantienen exactamente, sin adiciones. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

Este lote completa Packaging en su totalidad (8.1-8.2) y Shipping en su totalidad (9.1-9.3).

Después de este lote se espera aprobación antes de continuar con el Batch 07.

---

## Template 26 — Sello de Cierre

### 1. Concepto
Cualquier negocio que empaca producto para venta o envío necesita un cierre visual pequeño y reutilizable — una bolsa de regalo doblada, una caja de envío sellada — que refuerce marca en el punto exacto donde el cliente abre el paquete. El problema: sin un sello genérico bien resuelto, cada negocio pequeño tiene que resolver este detalle desde cero cada vez que empaca. Este template existe para ser esa pieza atómica y reutilizable del sistema de empaque de THÖREN.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), misma disciplina de restricción que Serum Facial Premium y Etiqueta Neutral Minimalista.
- **Tipografía**: una sola familia sans-serif geométrica (recomendado: **Work Sans**, peso 500) para el logo/inicial.
- **Paleta**: exactamente la misma paleta del Serum/Etiqueta Neutral — cobre `#9C4E27`, hueso `#EDEAE2`, carbón `#23282B` — reutilizada de forma intencional, tercera vez que esta paleta aparece en el catálogo, reforzando su identidad como "la paleta neutra de THÖREN" para piezas agnósticas de industria.
- **Estilo**: minimalista, silencioso, funcional.
- **Espaciados**: margen mínimo de 3mm respecto al área segura — el formato es pequeño, no hay espacio para aire extra.
- **Jerarquía**: 1) logo o inicial de marca (único elemento), sin segundo nivel.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel, pequeño.
- **Iconografía**: ninguna más allá de la inicial/logo tipográfico — Nivel 0.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro.

### 3. Layout
- **Formato**: círculo de 25mm de diámetro.
- **Zonas**: centro (logo/inicial), borde simple (línea de contorno fina, opcional).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el logo/inicial ocupa el máximo tamaño posible dentro del área segura.

### 4. Elementos
- Logo o inicial de marca
- Borde de contorno fino opcional

### 5. Assets necesarios
- Ninguno gráfico — se construye con tipografía y, opcionalmente, una línea de contorno vectorial simple.

### 6. Mockup
Bolsa de papel doblada con el sello en el pliegue de cierre, fondo neutro claro, luz suave de estudio, sin props adicionales — coherente con la familia Lujo Silencioso.

### 7. Thumbnail
Sello circular solo sobre fondo hueso sólido — debe leerse el logo/inicial con claridad incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 25mm × 25mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado, cualquier material estándar.

### 10. Nivel de calidad
Premium aquí significa que una pieza tan pequeña y funcional no se sienta como un afterthought — el error más común a evitar es sobrecargar el sello con más de un elemento (agregar un ícono decorativo además del logo). Validación: el sello debe funcionar igual de bien en cualquier color de fondo de bolsa/caja, sin perder legibilidad.

### 11. Commercial Sheet
- **Nombre comercial**: Seal Base — Sello de Cierre Universal
- **Elevator Pitch**: Sello circular minimalista para cerrar cualquier bolsa o caja con la marca de tu negocio.
- **Beneficio principal**: Refuerza marca en el momento exacto en que el cliente abre su compra, sin necesitar un diseño de empaque completo.
- **Ideal para**: cualquier negocio que empaque producto para venta o envío, sin importar la industria.
- **Nivel de personalización**: Bajo (logo/inicial únicamente).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Bolsas de papel o plástico, cajas de envío o regalo, sobres.
- **Palabras clave SEO**: sello de cierre, sticker cierre bolsa, template sello universal, etiqueta cierre empaque, packaging sello genérico, sticker logo pequeño, etiqueta sello circular, template cierre caja, packaging bolsa regalo, sticker marca empaque, etiqueta sello minimalista, template sello negocio, packaging cierre envío, sticker sello universal, etiqueta pequeña marca, template sello base, packaging cualquier negocio, sticker cierre paquete, etiqueta sello simple, template packaging seal.
- **Categoría comercial**: Packaging.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta neutra ya validada en Serum y Etiqueta Neutral Minimalista; layout calibrado para el formato de sello más pequeño y funcional del catálogo; cero producción de assets gráficos requerida.
- **Call to Action**: Que hasta el cierre de tu empaque hable de tu marca.

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

## Template 27 — Cinta Decorativa de Empaque

### 1. Concepto
Los negocios de regalos, repostería y empaque especial diferencian su presentación envolviendo la caja o bolsa con una cinta decorativa propia, en vez de usar listón genérico de papelería. El problema: producir un patrón repetible que se vea intencional (no un motivo estirado o mal alineado en la costura) requiere pensar el diseño explícitamente como sistema repetible desde el inicio, no como una etiqueta única. Este template resuelve ese reto técnico específico de diseño de patrón.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), en su registro más decorativo/festivo dentro de la familia — coherente con el contexto de regalo.
- **Tipografía**: ninguna — este template es puramente un patrón geométrico repetible, sin texto (el nombre de marca vive en el Sello de Cierre, Template 26, que se combina con esta cinta en el mismo empaque).
- **Paleta**: terracota cálido `#C97A4F`, azul grisáceo `#4B6673`, hueso `#F7F5EF` — combinación deliberada de un tono cálido y uno frío sobre base neutra, para que la cinta funcione como acento decorativo sin necesitar coincidir con la paleta exacta del producto que envuelve.
- **Estilo**: decorativo, festivo pero comedido — 2-3 colores máximo, nunca un patrón denso que compita con el sello de marca aplicado sobre la misma caja.
- **Espaciados**: el patrón se repite a intervalo constante y calculado — no hay "espaciado" en el sentido de aire alrededor de texto, sino en el sentido de ritmo visual entre repeticiones.
- **Jerarquía**: no aplica — es un patrón sin jerarquía interna, todos los elementos del patrón tienen el mismo peso visual.
- **Alineaciones**: patrón repetido a lo largo del eje horizontal de la cinta, simétrico en el eje vertical.
- **Formas**: rectángulo alargado (formato de cinta), patrón geométrico simple repetido dentro.
- **Iconografía**: motivo geométrico simple (no figurativo) — Nivel 2 o 3 del Design Language Guide según la forma elegida (círculos, triángulos, rombos pequeños).
- **Texturas**: ninguna adicional al patrón geométrico en sí.
- **Estilo visual**: geométrico plano, repetible, sin degradados.

### 3. Layout
- **Formato**: rectangular alargado, proporción de cinta continua (ancho fijo de 20mm, largo variable según metraje de producción real — el patrón debe funcionar igual de bien cortado en cualquier punto de su longitud).
- **Zonas**: el patrón ocupa el 100% del ancho de la cinta, sin márgenes de "aire" en los bordes largos (el patrón sangra intencionalmente en esos bordes, ya que la cinta se corta a metraje).
- **Márgenes**: sangrado 3mm en los bordes cortos (donde se corta la cinta a longitud); los bordes largos de la cinta no llevan margen de seguridad porque el patrón está diseñado para continuar más allá del corte de metraje.
- **Retícula**: retícula modular repetida — una sola "celda" de patrón se define y se repite horizontalmente sin costura visible.
- **Proporciones**: cada motivo geométrico individual ocupa un módulo de 20mm × 20mm dentro de la cinta de 20mm de ancho.

### 4. Elementos
- Motivo geométrico repetido (círculos, triángulos o rombos pequeños, a elegir como una sola variante consistente por producción)

### 5. Assets necesarios
- 1 patrón vectorial repetible (tileable en el eje horizontal sin costura visible), 2-3 colores según la paleta

### 6. Mockup
Caja de regalo envuelta con la cinta aplicada alrededor, combinada con el Sello de Cierre (Template 26) en el nudo/cierre, luz natural suave, superficie de mesa clara, sin props adicionales — mostrando explícitamente cómo ambos templates de Packaging se combinan en un solo empaque real.

### 7. Thumbnail
Segmento del patrón repetido, mostrado como una franja horizontal sobre fondo blanco — suficiente longitud de patrón visible para que se entienda la repetición, no solo un único módulo aislado.

### 8. Prompt para IA
Para el patrón geométrico repetible (ejemplo con círculos pequeños):
> "Simple repeating geometric pattern of small circles, seamless horizontal tile, 2-3 flat colors maximum, warm decorative gift-wrap aesthetic, no gradients, clean vector edges, designed to repeat without visible seams when tiled horizontally at a fixed 20mm module width."

### 9. Exportación
- Tamaño final: 20mm de ancho × longitud de metraje real (ej. tiras de 300mm o rollo continuo, según capacidad de producción del cliente).
- Sangrado: 3mm en los bordes cortos de cada tira cortada; el patrón mismo es continuo/repetible en los bordes largos.
- Recomendación de impresión: cinta adhesiva de papel tipo washi o vinil adhesivo delgado, acabado mate.

### 10. Nivel de calidad
Premium aquí depende enteramente de que la costura de repetición sea invisible — el error más común a evitar es un patrón que se nota "cortado" en el punto de unión al envolver la caja. Validación: imprimir una tira larga y envolver una caja real — el patrón debe verse continuo alrededor de toda la caja, sin salto visual en la unión.

### 11. Commercial Sheet
- **Nombre comercial**: Wrap — Cinta Decorativa de Empaque
- **Elevator Pitch**: Cinta decorativa de patrón repetible para envolver cajas y bolsas de regalo con una presentación propia, no genérica.
- **Beneficio principal**: Eleva la presentación del empaque sin necesitar listón o cinta comprada por separado — combina directamente con el Sello de Cierre (Template 26).
- **Ideal para**: negocios de regalos, repostería, empaque especial, tiendas de artículos decorativos.
- **Nivel de personalización**: Medio (color del patrón editable dentro de la paleta; forma del motivo geométrico fija por producción).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Intermedia (requiere validar la repetición sin costura antes de producción en metraje).
- **Productos compatibles**: Cajas de regalo, bolsas decorativas, empaques especiales de repostería.
- **Palabras clave SEO**: cinta decorativa empaque, sticker patrón repetible, template washi tape, cinta regalo decorativa, packaging cinta patrón, sticker cinta geométrica, etiqueta patrón repetido, template cinta envoltura, packaging regalo decorativo, sticker patrón caja, cinta adhesiva decorativa, template empaque especial, packaging repostería regalo, sticker cinta geométrica colores, etiqueta cinta continua, template patrón caja regalo, packaging cinta artesanal, sticker wrap decorativo, etiqueta cinta empaque, template cinta repetible.
- **Categoría comercial**: Packaging.
- **Colección**: Business Collection.
- **Premium Features**: Patrón vectorial ya validado como repetible sin costura; combina de forma diseñada con el Sello de Cierre del mismo lote; paleta bicolor cálido/frío pensada para complementar cualquier producto.
- **Call to Action**: Envuelve tu producto con una presentación que se nota que es tuya.

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

## Template 28 — Frágil — Manejo con Cuidado (E-commerce)

### 1. Concepto
Un vendedor online de artículos delicados (cerámica, vidrio, arte) necesita comunicar fragilidad al personal de paquetería y al propio destinatario, pero en un tono amigable de marca al consumidor — no el registro formal/bilingüe ya cubierto por el template Frágil Técnico de Warning & Compliance Labels. Este template es, deliberadamente, la versión de la misma información con una familia de lenguaje visual opuesta: mismo mensaje, tono completamente distinto según el contexto (B2C casual vs. B2B/logística formal).

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), aplicada aquí de forma deliberada a un contexto funcional para diferenciarse explícitamente del registro Técnico Funcional del template Frágil Técnico (Batch 04) — mismo problema de comunicación, familia de lenguaje opuesta según el contexto de venta.
- **Tipografía**: sans-serif redondeada y amigable (recomendado: **Nunito**, peso 600) — nunca la sans técnica/condensada del template formal equivalente.
- **Paleta**: rojo suave `#D64541`, blanco `#FFFFFF`, casi negro `#1A1A1A` — mismo rojo de alerta que el template técnico (la función de "alerta" se mantiene), pero acompañado de una ilustración amigable en vez de un ícono normado.
- **Estilo**: cercano, no alarmante — deliberadamente lo opuesto al tono serio de la versión industrial.
- **Espaciados**: margen de 4mm respecto al área segura, más generoso que la versión técnica.
- **Jerarquía**: 1) ilustración amigable de copa quebrándose (estilo lineal, expresión casi de personaje, no alarmante), 2) texto "Con cuidado, por favor" en un solo idioma (español, sin necesidad del bilingüismo formal de la versión industrial).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: ilustración de línea fina/amigable (Nivel 1 del Design Language Guide) de una copa quebrándose con una expresión casi de personaje — nunca el ícono normado de convención internacional que sí usa el template técnico equivalente.
- **Texturas**: ninguna.
- **Estilo visual**: ilustrativo amigable, coherente con la calidez del resto de la familia Artesanal Cálido.

### 3. Layout
- **Formato**: cuadrado de 50mm × 50mm.
- **Zonas**: dos tercios superiores (ilustración amigable), tercio inferior (texto "Con cuidado, por favor").
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 2 puntos de anclaje.
- **Proporciones**: la ilustración ocupa un máximo de 60% de la altura total.

### 4. Elementos
- Ilustración amigable de copa quebrándose (estilo lineal, no alarmante)
- Texto "Con cuidado, por favor" (o variante corta similar)

### 5. Assets necesarios
- 1 ilustración SVG de línea fina de una copa quebrándose, con tratamiento amigable/casi de personaje (no el ícono normado internacional)

### 6. Mockup
Caja de cartón de envío estándar de e-commerce, el sticker aplicado en una esquina visible, iluminación de estudio suave (más cercana a un contexto de casa/oficina que a un almacén industrial), fondo neutro claro con un elemento de contexto de envío (cinta de embalaje visible) — deliberadamente menos "industrial" que el mockup del template técnico equivalente.

### 7. Thumbnail
Sticker cuadrado solo sobre fondo blanco — debe transmitir calidez y cuidado, no urgencia o alarma, incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la ilustración amigable de copa quebrándose:
> "Friendly, non-alarming thin-line illustration of a glass cup with a small crack, slightly whimsical and warm character (not a scary or aggressive depiction), single continuous line style, warm approachable e-commerce packaging aesthetic, transparent background, suitable for a caring 'handle with care' consumer-facing sticker."

### 9. Exportación
- Tamaño final: 50mm × 50mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado, cualquier material estándar de envío.

### 10. Nivel de calidad
Premium aquí significa comunicar cuidado sin alarmar — el error más común a evitar es reutilizar el ícono normado internacional de frágil (el del template técnico) en este contexto, lo cual rompería la distinción deliberada de tono entre ambos templates. Validación: comparar directamente con el template Frágil Técnico (Warning & Compliance, Batch 04) — ambos deben comunicar el mismo mensaje funcional, pero sentirse de familias de lenguaje visual completamente distintas.

### 11. Commercial Sheet
- **Nombre comercial**: Con Cuidado — Etiqueta Frágil para E-commerce
- **Elevator Pitch**: Sticker amigable de "manejar con cuidado" para paquetes de venta online, con calidez de marca en vez de tono industrial.
- **Beneficio principal**: Comunica fragilidad de forma cercana y memorable, reforzando la personalidad de marca del vendedor en cada envío.
- **Ideal para**: vendedores online de cerámica, vidrio, arte y artículos delicados; tiendas de e-commerce con identidad de marca cuidada.
- **Nivel de personalización**: Bajo (texto corto editable entre 2-3 variantes; ilustración fija por diseño).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de cartón de envío estándar, sobres acolchados, empaques de e-commerce.
- **Palabras clave SEO**: etiqueta frágil ecommerce, sticker con cuidado, template envío frágil, etiqueta paquete delicado, packaging frágil amigable, sticker cerámica envío, etiqueta vidrio cuidado, template shipping fragile friendly, packaging vendedor online, sticker envío artesanal, etiqueta cuidado paquete, template frágil consumidor, packaging arte envío, sticker frágil cálido, etiqueta manejar con cuidado, template ecommerce fragile, packaging envío delicado, sticker copa quebradiza, etiqueta frágil marca, template envío cerámica.
- **Categoría comercial**: Shipping.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Ilustración amigable curada específicamente para diferenciarse del registro industrial; sistema de tono cálido validado para contexto B2C; layout calibrado para reconocimiento rápido sin alarmar.
- **Call to Action**: Que hasta el aviso de "frágil" se sienta como tu marca, no como una advertencia de bodega.

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

## Template 29 — Gracias por tu Compra

### 1. Concepto
El cierre de un paquete de e-commerce es el último punto de contacto físico entre un vendedor pequeño y su cliente antes de que la relación continúe (o no) en la próxima compra — un sticker de agradecimiento genuino en ese momento genera la misma lealtad emocional que ya cumple el Sello "Hecho en Casa" en retail físico, pero para el contexto específico de venta online. Este template existe para que ese cierre de paquete se sienta personal, no como el final automático de una transacción.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: script cálida (recomendado: **Caveat**, mismo rol ya validado en Miel y Sello "Hecho en Casa") para "¡Gracias!".
- **Paleta**: cobre `#9C4E27`, hueso `#F7F5EF`, carbón `#23282B`.
- **Estilo**: cálido, personal, breve.
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) texto "¡Gracias!" en script (dominante), 2) ícono pequeño de corazón o estrella (refuerzo, nunca protagonista).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: un solo ícono pequeño (corazón o estrella, línea fina — Nivel 1), nunca ambos a la vez.
- **Texturas**: ninguna.
- **Estilo visual**: script cálido con acento de línea fina.

### 3. Layout
- **Formato**: círculo de 30mm de diámetro.
- **Zonas**: centro (texto "¡Gracias!"), borde inferior (ícono pequeño de corazón o estrella).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 2 puntos de anclaje.
- **Proporciones**: el ícono ocupa un máximo de 15% del diámetro total.

### 4. Elementos
- Texto "¡Gracias!" (o variante corta similar)
- Ícono pequeño de corazón o estrella (uno solo)

### 5. Assets necesarios
- 1 ícono SVG de línea fina de corazón, y 1 alternativo de estrella (el usuario elige uno, no ambos simultáneos)

### 6. Mockup
Bolsa de envío tipo mailer, el sticker aplicado cerrando la solapa, luz natural suave, superficie de escritorio o mesa de empaque, sin props adicionales.

### 7. Thumbnail
Sticker circular solo sobre fondo hueso sólido — debe transmitir calidez inmediata a tamaño de card.

### 8. Prompt para IA
Para el ícono de corazón:
> "Simple thin-line heart icon, delicate consistent stroke weight, no fill, warm handwritten-adjacent style, pure black line on transparent background, suitable as a small accent next to handwritten script text."

Para el ícono alternativo de estrella:
> "Simple thin-line star icon, delicate consistent stroke weight matching a companion heart icon, no fill, transparent background, suitable as a small accent next to handwritten script text."

### 9. Exportación
- Tamaño final: 30mm × 30mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí significa que el agradecimiento se sienta genuino, no una obligación de checklist de e-commerce — el error más común a evitar es un script genérico de plantilla gratuita que se ve igual en miles de tiendas online. Validación: comparar con el Sello "Hecho en Casa" (Template 22) — ambos deben sentirse de la misma familia de calidez humana, aunque uno sea para retail físico y el otro para envío online.

### 11. Commercial Sheet
- **Nombre comercial**: Gracias — Sello de Agradecimiento para Envíos
- **Elevator Pitch**: Sticker circular cálido de agradecimiento para cerrar cada paquete de tu tienda online con un toque personal.
- **Beneficio principal**: Convierte el último punto de contacto físico de la compra en un momento de conexión emocional con el cliente.
- **Ideal para**: vendedores de e-commerce y marketplaces, tiendas online pequeñas e independientes.
- **Nivel de personalización**: Bajo (texto de agradecimiento e ícono elegido entre 2 opciones).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Bolsas de envío tipo mailer, cajas de e-commerce, sobres acolchados.
- **Palabras clave SEO**: sticker gracias por tu compra, etiqueta agradecimiento ecommerce, template thank you sticker, sticker cierre paquete, packaging agradecimiento online, etiqueta gracias envío, template tienda online gracias, packaging mailer sticker, sticker corazón agradecimiento, etiqueta gracias cliente, template envío personal, packaging thank you seal, sticker gracias marca, etiqueta cierre venta online, template agradecimiento marketplace, packaging envío cálido, sticker gracias circular, etiqueta compra online, template mailer thank you, packaging vendedor independiente.
- **Categoría comercial**: Shipping.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Reutiliza el sistema de script cálido ya validado en Miel y Sello "Hecho en Casa"; set de 2 íconos pequeños incluido; layout calibrado para cierre rápido de paquete.
- **Call to Action**: Deja que cada paquete termine con un "gracias" que se sienta real.

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

## Template 30 — Este Lado Arriba

### 1. Concepto
Un paquete que no debe voltearse durante el transporte (líquidos, cerámica con orientación de apoyo, electrónica sensible) necesita comunicar orientación de forma tan instantánea como la advertencia de peligro — el personal de manejo de carga debe reconocer "arriba" sin necesidad de leer texto completo. Este template formaliza esa convención funcional, coherente con el mismo enfoque que ya rige Advertencia General y Rombo Normado en Warning & Compliance.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Técnico Funcional (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: sans-serif condensada de alto contraste (recomendado: **Archivo Black** o **Anton**, mayúsculas) — mismo rol tipográfico que Advertencia General.
- **Paleta**: casi negro `#1A1A1A`, blanco `#FFFFFF`, amarillo de énfasis `#F2C94C` — el amarillo aquí es de énfasis visual, no de convención normada estricta como en Advertencia General (no existe una norma internacional única de color para "este lado arriba", a diferencia del símbolo de exclamación).
- **Estilo**: funcional, sin ambigüedad.
- **Espaciados**: compacto, orientado a máxima legibilidad a distancia.
- **Jerarquía**: 1) flechas apuntando hacia arriba (elemento de reconocimiento más rápido, mayor peso visual), 2) texto "ESTE LADO ARRIBA".
- **Alineaciones**: centrada, flechas a ambos lados del texto en simetría horizontal.
- **Formas**: rectángulo horizontal.
- **Iconografía**: par de flechas idénticas apuntando hacia arriba, a ambos lados del texto (Nivel 3-4 del Design Language Guide — gráfico de alto contraste, simplificado).
- **Texturas**: ninguna.
- **Estilo visual**: gráfico de alto contraste, bordes duros.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 3:1.
- **Zonas**: franja central completa: flecha izquierda, texto central, flecha derecha, todo en una sola línea horizontal.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: una sola fila, 3 columnas simétricas (flecha / texto / flecha).
- **Proporciones**: cada flecha ocupa aproximadamente 20% del ancho total; el texto central ocupa el 60% restante.

### 4. Elementos
- Texto "ESTE LADO ARRIBA"
- Par de flechas apuntando hacia arriba (izquierda y derecha del texto)

### 5. Assets necesarios
- 1 ícono SVG de flecha simple apuntando hacia arriba, alto contraste, bordes duros (se usa duplicado/reflejado a ambos lados)

### 6. Mockup
Caja de cartón de envío estándar, el sticker aplicado en la cara lateral de la caja, iluminación de almacén/muelle de carga, fondo de bodega desenfocado — mismo lenguaje de mockup que el resto de la familia Técnico Funcional.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco — el mensaje debe ser reconocible por la sola forma de las flechas, incluso antes de leer el texto.

### 8. Prompt para IA
Para el ícono de flecha:
> "Simple bold upward-pointing arrow icon, hard clean vector edges, high contrast solid fill, no gradients, universally clear directional symbol, transparent background, suitable for shipping orientation labeling, designed to be mirrored for symmetric placement on both sides of text."

### 9. Exportación
- Tamaño final: 90mm × 30mm aprox. (etiqueta rectangular para cara lateral de caja de envío).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil resistente a manipulación de almacén/transporte, acabado mate.

### 10. Nivel de calidad
Premium aquí se mide por reconocimiento instantáneo de orientación, no por estética — el error más común a evitar es una tipografía decorativa que reduzca la velocidad de lectura del mensaje funcional. Validación: mostrar la etiqueta rotada 90° y 180° a alguien — debe poder identificar de inmediato que el paquete está mal orientado, sin leer el texto completo.

### 11. Commercial Sheet
- **Nombre comercial**: Orientación — Etiqueta "Este Lado Arriba"
- **Elevator Pitch**: Etiqueta funcional de alto contraste para indicar la orientación correcta de un paquete durante el transporte.
- **Beneficio principal**: Reduce el riesgo de daño por mal manejo, comunicando orientación de forma instantánea a cualquier persona que mueva el paquete.
- **Ideal para**: cualquier vendedor que envíe productos que no deban voltearse (líquidos, cerámica, electrónica sensible).
- **Nivel de personalización**: Bajo (el mensaje y las flechas son fijos por convención funcional).
- **Tiempo estimado de personalización**: 2 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Cajas de cartón de envío, contenedores de transporte que requieren orientación fija.
- **Palabras clave SEO**: etiqueta este lado arriba, sticker orientación paquete, template this side up, etiqueta flechas envío, packaging orientación carga, sticker paquete no voltear, etiqueta transporte orientado, template envío vertical, packaging flecha arriba, sticker orientación caja, etiqueta shipping orientation, template carga orientada, packaging envío líquidos, sticker no voltear paquete, etiqueta funcional envío, template orientación transporte, packaging arrow up label, sticker caja orientada, etiqueta arriba abajo envío, template shipping arrows.
- **Categoría comercial**: Shipping.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Sistema de flechas de alto contraste calibrado para reconocimiento a distancia; layout simétrico validado para lectura instantánea; consistente con la misma familia funcional de Advertencia General.
- **Call to Action**: Que la orientación correcta se entienda de un vistazo, sin necesidad de leer una sola palabra.

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

5 de 63 templates completados en este lote (Batch 06: templates 8.1 y 8.2 — cierra Packaging en su totalidad — y templates 9.1 a 9.3 — cierra Shipping en su totalidad). El próximo lote inicia la categoría Business (3 templates) junto con Events (2 templates), para completar 5.

Progreso acumulado: 30 de 63 templates completados (Batch 01 a Batch 06).

**A la espera de aprobación antes de continuar con Batch 07** (Business completa [3 templates] + Events completa [2 templates]).
