> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 09 — Crafts + Etsy Sellers (parcial) (Templates 41-45 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 41 a 45 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones. Ningún documento maestro (`TEMPLATE_LIBRARY_ARCHITECTURE.md`, `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `ROADMAP_TEMPLATE_SYSTEM.md`, `THOREN_ASSET_PRODUCTION_GUIDE.md`, `THOREN_PRODUCT_STRATEGY.md`, `THOREN_LAUNCH_PLAYBOOK.md`) fue tocado en este lote. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

**Continuidad del sistema de color**: todos los templates de este lote pertenecen a la familia Artesanal Cálido — la misma disciplina de calidez humana ya validada en Café, Miel, Té de Hierbas, Jabón, Kraft Genérica y Sello "Hecho en Casa". Este lote introduce dos matices dentro de la misma familia (nunca una familia nueva): un registro **pastel/juguetón** para scrapbooking (Template 41-42) y un registro **vintage/curado** con marco ornamental fino para Etsy Sellers (Template 45) — ambos siguen la misma disciplina de un solo acento protagonista y ausencia de saturación excesiva que ya define la familia.

Este lote completa Crafts en su totalidad (13.1-13.3) y avanza 2 de los 3 templates de Etsy Sellers (14.1-14.2) — el restante (14.3, Empaque Artesanal Etsy) pasa al Batch 10 junto con el inicio de Kids, tal como se anticipó al cerrar Batch 08.

Después de este lote se espera aprobación antes de continuar con el Batch 10. Se recuerda que `THÖREN Bundle Strategy` permanece programado para ese punto, no antes.

---

## Template 41 — Decoración de Scrapbook

### 1. Concepto
Quien practica scrapbooking o journaling ilustrado no busca un solo sticker protagonista — busca un set variado de piezas pequeñas que pueda combinar libremente en una página, de forma similar a como un cajón de recortes reales funciona. Este template resuelve una necesidad de composición distinta al resto del catálogo: no es "un diseño terminado", es "un kit de piezas sueltas" pensado para que el usuario decida su propia combinación.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), en su registro pastel/juguetón — un matiz dentro de la misma familia, no una familia nueva.
- **Tipografía**: ninguna — este template es un set de ilustraciones, sin texto (a diferencia de la mayoría del catálogo, aquí el "producto" es la variedad visual, no un mensaje).
- **Paleta**: rosa pastel `#F2C1C1`, verde salvia claro `#A9D6C5`, crema `#FFF3E0` — paleta pastel deliberadamente distinta de los tonos tierra saturados del resto de Artesanal Cálido, coherente con el contexto de scrapbooking.
- **Estilo**: variado, coleccionable — no hay "un" estilo dominante de composición porque el producto es un kit de piezas independientes, cada una completa por sí misma.
- **Espaciados**: no aplica en el sentido tradicional — cada pieza individual del set tiene su propio troquel pequeño, sin retícula compartida entre piezas.
- **Jerarquía**: no aplica — cada pieza del set es autónoma, sin relación jerárquica entre ellas.
- **Alineaciones**: cada pieza centrada dentro de su propio troquel individual.
- **Formas**: **personalizado** — formas libres pequeñas (no un solo troquel repetido), variando entre piezas del mismo set.
- **Iconografía**: ilustraciones lineales pequeñas y variadas (Nivel 1-2 del Design Language Guide), un tema visual amplio por set (ej. un set "de jardín": flores, mariposa, regadera, maceta) para que las piezas se sientan coleccionables entre sí sin ser idénticas.
- **Texturas**: ninguna.
- **Estilo visual**: ilustrativo de línea fina o color plano suave, paleta pastel consistente entre todas las piezas del set.

### 3. Layout
- **Formato**: set de 6-8 piezas individuales, cada una con su propio troquel de forma libre, tamaños entre 15mm y 30mm según la pieza.
- **Zonas**: cada pieza es su propia página/troquel independiente — no hay una sola composición compartida.
- **Márgenes**: sangrado 3mm y área segura 3mm de margen interno, aplicados individualmente a cada pieza del set, sin excepción por tratarse de formas libres pequeñas.
- **Retícula**: no aplica — cada pieza es autónoma.
- **Proporciones**: cada ilustración ocupa el máximo tamaño posible dentro de su propio troquel individual, respetando el área segura.

### 4. Elementos
- Set de 6-8 ilustraciones pequeñas independientes, unificadas por un tema visual común (ej. jardín, mar, papelería)

### 5. Assets necesarios
- Set completo de 6-8 ilustraciones SVG de línea fina o color plano suave, mismo estilo consistente entre todas las piezas del tema elegido

### 6. Mockup
Página de álbum de scrapbook abierta, con varias piezas del set aplicadas junto a fotos y recortes de papel decorativo, luz natural suave, mostrando cómo las piezas se combinan libremente en una composición real de usuario.

### 7. Thumbnail
El set completo mostrado como una cuadrícula pequeña de todas sus piezas juntas sobre fondo crema sólido — a diferencia del resto del catálogo, aquí el thumbnail debe mostrar la variedad completa del set, no una sola pieza aislada, porque la variedad es la propuesta de valor.

### 8. Prompt para IA
Para el set de ilustraciones (ejemplo con tema de jardín):
> "Set of 6-8 small, varied, hand-drawn-feeling illustrations on a garden theme (flower, butterfly, watering can, small potted plant, leaf, ladybug), soft pastel color palette, consistent thin-line or soft flat-color style across all pieces, playful and collectible scrapbooking aesthetic, transparent background, each illustration sized independently but sharing the same level of detail and color treatment."

### 9. Exportación
- Tamaño final: variable por pieza, entre 15mm y 30mm según la ilustración — cada pieza es un troquel independiente dentro del mismo archivo de set.
- Sangrado: 3mm por pieza. Área segura: 3mm de margen interno por pieza.
- Recomendación de impresión: vinil adhesivo mate, resistente a manipulación frecuente (las piezas de scrapbook se manipulan más que un sticker aplicado una sola vez).

### 10. Nivel de calidad
Premium aquí significa que el set se sienta curado como colección, no como un conjunto aleatorio de clip-art — el error más común a evitar es mezclar niveles de detalle o estilos entre piezas del mismo set (una muy simple, otra muy detallada). Validación: exactamente el mismo criterio ya usado en el set de frutas de Mermelada (Template 4) — las piezas deben verse como si las hubiera dibujado la misma mano el mismo día.

### 11. Commercial Sheet
- **Nombre comercial**: Garden Set — Kit de Stickers para Scrapbook
- **Elevator Pitch**: Set de 6-8 stickers pastel coleccionables para combinar libremente en tus páginas de scrapbook o journaling.
- **Beneficio principal**: Da variedad real de piezas para componer, en vez de un solo diseño repetido, imitando la experiencia de un cajón de recortes real.
- **Ideal para**: hobbistas de scrapbooking y journaling, creadores de contenido de papelería decorativa.
- **Nivel de personalización**: Bajo (el set es fijo por tema; el usuario decide cómo combinar las piezas, no edita el contenido individual).
- **Tiempo estimado de personalización**: 5 minutos (selección de piezas a imprimir).
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Álbumes de scrapbook, diarios ilustrados, agendas decoradas.
- **Palabras clave SEO**: sticker scrapbook, kit stickers journaling, template pastel decorativo, etiqueta set coleccionable, packaging scrapbooking kit, sticker jardín pastel, etiqueta journaling decorativo, template kit stickers pequeños, packaging papelería decorativa, sticker set variado, etiqueta scrapbook kit, template stickers coleccionables, packaging diario ilustrado, sticker pastel jardín, etiqueta decorativa hobby, template scrapbooking set, packaging agenda decorada, sticker mini ilustraciones, etiqueta kit journaling, template set pastel craft.
- **Categoría comercial**: Crafts.
- **Colección**: Craft Collection.
- **Premium Features**: Set completo de 6-8 piezas incluido en un solo template; paleta pastel curada específicamente distinta del resto del catálogo; consistencia de estilo validada entre todas las piezas del set.
- **Call to Action**: Arma tu propia composición, pieza por pieza.

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

## Template 42 — Sticker Decorativo para Manualidades

### 1. Concepto
A diferencia del set de piezas sueltas del Template 41, un proyecto de manualidades DIY (una caja de regalo hecha a mano, un proyecto de decoración) a menudo necesita un solo sticker decorativo central y llamativo, no un kit de piezas para combinar. Este template cubre ese caso de uso complementario: un diseño único, colorido y protagonista.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro pastel/juguetón, mismo matiz que el Template 41 pero aplicado a un diseño único en vez de un set.
- **Tipografía**: ninguna — el diseño es puramente ilustrativo.
- **Paleta**: naranja cálido `#E8A33D`, verde salvia `#5F7A61`, crema `#FFF8F0`.
- **Estilo**: colorido, central, festivo pero no infantil.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: un solo nivel — la ilustración central es el único elemento.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel, con borde festoneado opcional (silueta ondulada en vez de un círculo perfectamente liso, para reforzar la sensación decorativa/manual).
- **Iconografía**: una sola ilustración central simple y colorida (Nivel 2 del Design Language Guide — color plano), tema libre según el proyecto DIY (flor, estrella, elemento decorativo genérico).
- **Texturas**: ninguna.
- **Estilo visual**: ilustrativo de color plano, borde festoneado opcional.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro, con opción de borde festoneado.
- **Zonas**: centro completo ocupado por la ilustración.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — si se usa el borde festoneado, el área segura se mide desde el punto más profundo de la onda, no desde el borde exterior de las puntas.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: la ilustración ocupa el máximo tamaño posible dentro del área segura.

### 4. Elementos
- Ilustración central decorativa (tema libre, elegido por el usuario)

### 5. Assets necesarios
- 1 ilustración SVG de color plano, tema decorativo genérico (ej. flor estilizada), estilo consistente con la paleta pastel/cálida de la familia

### 6. Mockup
Caja de regalo DIY decorada con el sticker aplicado, luz natural suave, superficie de mesa de manualidades con materiales de craft desenfocados al fondo (papel, listones), sin competir con el sticker mismo.

### 7. Thumbnail
Sticker circular solo sobre fondo crema sólido — el color y la forma deben ser inmediatamente atractivos a tamaño de card.

### 8. Prompt para IA
Para la ilustración central decorativa:
> "Simple, colorful, flat-color decorative illustration (e.g. stylized flower or festive decorative motif), 2-3 flat colors from a warm pastel palette, clean vector edges, cheerful but not childish craft sticker aesthetic, transparent background, designed to work with an optional scalloped circular border."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo, con o sin borde festoneado).
- Sangrado: 3mm. Área segura: 3mm de margen interno, medida según la nota de §3 si se usa borde festoneado.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí significa color y forma con intención, no un clip-art genérico de "sticker bonito" — el error más común a evitar es una ilustración demasiado genérica sin ningún detalle distintivo. Validación: el sticker debe sentirse como una pieza de diseño elegida deliberadamente para el proyecto, no un relleno decorativo sin pensar.

### 11. Commercial Sheet
- **Nombre comercial**: Craft Bloom — Sticker Decorativo para Manualidades
- **Elevator Pitch**: Sticker circular colorido y protagonista para darle un toque decorativo final a tu proyecto DIY.
- **Beneficio principal**: Un solo sticker de alto impacto visual, listo para aplicar sin necesitar combinar piezas ni planear una composición.
- **Ideal para**: hobbistas y makers, proyectos de regalo hecho a mano.
- **Nivel de personalización**: Bajo (el usuario elige entre variantes de tema/color, sin edición estructural).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de regalo DIY, proyectos de decoración manual, papelería creativa.
- **Palabras clave SEO**: sticker decorativo manualidades, etiqueta craft colorida, template sticker DIY, sticker flor decorativa, packaging regalo hecho a mano, sticker festoneado, etiqueta manualidades color, template craft bloom, packaging proyecto DIY, sticker decorativo circular, etiqueta hobby creativo, template sticker manualidad, packaging caja regalo DIY, sticker colorido craft, etiqueta decorativa festiva, template proyecto manual, packaging decoración creativa, sticker bloom decorativo, etiqueta craft alegre, template DIY sticker central.
- **Categoría comercial**: Crafts.
- **Colección**: Craft Collection.
- **Premium Features**: Ilustración central curada con opción de borde festoneado; paleta pastel/cálida coherente con el resto de la familia Artesanal Cálido; layout de un solo elemento protagonista, sin necesidad de combinar piezas.
- **Call to Action**: El toque final que tu proyecto hecho a mano estaba esperando.

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

## Template 43 — Sello de Regalo Hecho a Mano

### 1. Concepto
Cuando una persona (no un negocio) regala algo hecho a mano a un familiar o amigo, necesita una forma simple de identificarlo como tal — un sello que comunique "esto lo hice yo, con cariño", sin la complejidad comercial de los sellos de negocio del resto del catálogo (Sello "Hecho en Casa", Template 22, está dirigido a un contexto de venta; este template es para regalo personal, sin transacción).

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — misma paleta y textura de sello ya validadas en Jabón en Barra (Template 9) y Sello "Hecho en Casa" (Template 22).
- **Tipografía**: script cálida (recomendado: **Caveat**, mismo rol ya usado en Miel, Sello "Hecho en Casa" y Gracias por tu Compra) para "Hecho con cariño por...".
- **Paleta**: marrón kraft `#8B6F47`, crema `#F5EFE3`, rojo cálido de acento `#C0392B` — el acento rojo es una variación nueva dentro de la paleta kraft ya establecida, usado aquí para dar un toque festivo/personal distinto del tono puramente comercial del Template 22.
- **Estilo**: cálido, personal, con espacio para el nombre de quien regala.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: 1) texto "Hecho con cariño por..." (dominante), 2) espacio para nombre (campo editable, mismo tamaño que el texto fijo).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna — Nivel 0, coherente con la simplicidad del mensaje personal.
- **Texturas**: textura de papel kraft sutil (intensidad media, consistente con Kraft Genérica, Template 24).
- **Estilo visual**: script cálido sobre textura kraft.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (texto fijo "Hecho con cariño por..."), campo inferior (nombre editable).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 2 puntos de anclaje.
- **Proporciones**: el campo de nombre ocupa aproximadamente 30% de la altura total.

### 4. Elementos
- Texto fijo "Hecho con cariño por..." (o variante corta similar)
- Campo de nombre editable

### 5. Assets necesarios
- 1 textura de papel kraft, tileable, intensidad media (reutilizable del mismo sistema de Kraft Genérica)

### 6. Mockup
Regalo envuelto en papel kraft con listón, el sticker aplicado sobre el envoltorio, luz natural cálida, superficie de mesa doméstica (no de tienda ni mercado — el contexto es personal/hogareño), sin props comerciales.

### 7. Thumbnail
Sello circular solo sobre fondo kraft sólido — el texto debe leerse con calidez incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template reutiliza la textura de papel kraft ya especificada para Kraft Genérica (Template 24) — no requiere un asset generado nuevo.

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: papel kraft adhesivo real o vinil mate texturizado.

### 10. Nivel de calidad
Premium aquí significa que el sello se sienta genuinamente personal, no un producto de tienda — el error más común a evitar es una tipografía demasiado pulida/comercial que traicione el contexto de regalo íntimo entre personas. Validación: comparar con Sello "Hecho en Casa" (Template 22, contexto comercial) — este template debe sentirse más cálido y menos "de negocio", aunque comparta la misma familia base.

### 11. Commercial Sheet
- **Nombre comercial**: Con Cariño — Sello de Regalo Hecho a Mano
- **Elevator Pitch**: Sello circular cálido para identificar un regalo que hiciste tú mismo, con espacio para tu nombre.
- **Beneficio principal**: Comunica el esfuerzo personal detrás de un regalo hecho a mano, sin sentirse como un producto comercial.
- **Ideal para**: cualquier persona que regale algo hecho a mano a familiares o amigos.
- **Nivel de personalización**: Bajo (solo el campo de nombre es editable).
- **Tiempo estimado de personalización**: 3 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Regalos envueltos en papel kraft, cajas de regalo personal, tarjetas de regalo.
- **Palabras clave SEO**: sello regalo hecho a mano, sticker con cariño, template regalo personal, etiqueta hecho por mí, packaging regalo casero, sticker regalo artesanal personal, etiqueta con cariño, template sello regalo, packaging envoltorio kraft, sticker regalo familiar, etiqueta regalo hecho a mano, template gift handmade personal, packaging regalo amigo, sticker con amor, etiqueta regalo casero, template sello personal regalo, packaging regalo kraft, sticker hecho por, etiqueta regalo íntimo, template craft gift seal.
- **Categoría comercial**: Crafts.
- **Colección**: Craft Collection.
- **Premium Features**: Reutiliza la textura kraft ya validada en Kraft Genérica; sistema script cálido consistente con el resto del catálogo; campo de nombre calibrado para personalización rápida.
- **Call to Action**: Que se note, con solo mirarlo, que este regalo lo hiciste tú.

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

## Template 44 — Kraft Hecho a Mano (Etsy Sellers)

### 1. Concepto
Un vendedor de Etsy de productos hechos a mano necesita una estética kraft/orgánica consistente en el empaque de cada pedido — a diferencia de la Etiqueta Kraft Genérica (Template 24, agnóstica de canal de venta), este template está pensado específicamente para el contexto de marketplace: debe incluir espacio para el nombre de la tienda, reforzando la marca del vendedor en cada envío.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — exactamente la misma paleta que la Etiqueta Kraft Genérica (Template 24), reutilizada de forma intencional para reforzar la identidad kraft del sistema.
- **Tipografía**: serif cálida (recomendado: **Lora**, mismo rol tipográfico que Kraft Genérica) para el nombre de la tienda.
- **Paleta**: marrón kraft `#8B6F47`, crema `#F5EFE3`, marrón muy oscuro `#2B2216` — idéntica a Kraft Genérica.
- **Estilo**: cálido, artesanal, orientado a marketplace (incluye espacio explícito de nombre de tienda, a diferencia del template genérico).
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) nombre de la tienda (dominante), 2) textura kraft de fondo.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna — Nivel 0, la calidez viene de la tipografía y textura, no de ilustración.
- **Texturas**: textura de papel kraft, misma especificación que Kraft Genérica (Template 24).
- **Estilo visual**: cálido artesanal, textura kraft de fondo.

### 3. Layout
- **Formato**: círculo de 45mm de diámetro (mismo tamaño que Kraft Genérica).
- **Zonas**: centro (nombre de la tienda).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje central único.
- **Proporciones**: el nombre de la tienda ocupa el máximo tamaño legible dentro del área segura.

### 4. Elementos
- Nombre de la tienda de Etsy/marketplace

### 5. Assets necesarios
- 1 textura de papel kraft, misma especificación reutilizada de Kraft Genérica (Template 24)

### 6. Mockup
Caja de envío pequeña con papel de seda, el sticker aplicado como cierre del empaque, luz natural cálida, superficie de escritorio de empaque casero (no de tienda física, coherente con el contexto de venta online), sin props adicionales.

### 7. Thumbnail
Etiqueta circular sola sobre fondo kraft sólido — el nombre de la tienda debe leerse con calidez incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template reutiliza la textura de papel kraft ya especificada para Kraft Genérica (Template 24) — no requiere un asset generado nuevo.

### 9. Exportación
- Tamaño final: 45mm × 45mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: papel kraft adhesivo real o vinil mate texturizado.

### 10. Nivel de calidad
Premium aquí significa reforzar marca sin perder la calidez kraft del sistema — el error más común a evitar es agregar demasiada información (redes sociales, sitio web) que sature el espacio y rompa la simplicidad del mensaje de marca. Validación: comparar directamente con Kraft Genérica (Template 24) — deben sentirse de la misma familia, con la única diferencia siendo la inclusión del nombre de tienda.

### 11. Commercial Sheet
- **Nombre comercial**: Kraft Etsy — Etiqueta de Tienda para Marketplace
- **Elevator Pitch**: Etiqueta kraft cálida con espacio para el nombre de tu tienda, lista para cada pedido que empaques y envíes.
- **Beneficio principal**: Refuerza tu marca de tienda en cada envío con la misma estética orgánica que ya esperan tus compradores de productos hechos a mano.
- **Ideal para**: vendedores de Etsy de productos hechos a mano, vendedores de marketplaces de artesanías en general.
- **Nivel de personalización**: Bajo (nombre de tienda únicamente).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de envío pequeñas, bolsas kraft, empaques de pedido de marketplace.
- **Palabras clave SEO**: etiqueta kraft etsy, sticker tienda marketplace, template kraft seller, etiqueta nombre tienda, packaging etsy hecho a mano, sticker kraft vendedor, etiqueta marca etsy, template tienda artesanal, packaging pedido etsy, sticker kraft marketplace, etiqueta vendedor handmade, template etsy shop label, packaging envío etsy, sticker tienda kraft, etiqueta hecho a mano venta, template kraft marketplace, packaging artesanía online, sticker nombre marca etsy, etiqueta kraft tienda, template vendedor artesanal.
- **Categoría comercial**: Etsy Sellers.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Reutiliza exactamente la paleta y textura ya validadas en Kraft Genérica, garantizando coherencia entre el catálogo agnóstico y el orientado a marketplace; layout calibrado para nombre de tienda de cualquier longitud.
- **Call to Action**: Que cada pedido que envíes lleve tu marca con la misma calidez con la que lo hiciste.

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

## Template 45 — Vintage Curado

### 1. Concepto
Un vendedor de artículos vintage o curados en un marketplace necesita comunicar autenticidad y valor de curaduría — a diferencia de "hecho a mano" (que comunica producción), "vintage curado" comunica selección y criterio. Este template introduce, por primera vez en el catálogo, un marco ornamental fino como recurso de dirección de arte, reservado específicamente a este registro de "antigüedad con valor".

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), en su registro vintage/curado — un tercer matiz dentro de la misma familia (junto al pastel/juguetón de Crafts y el kraft cálido estándar), introducido aquí porque el contexto de curaduría de artículos vintage lo justifica de forma específica, no como una decisión estética libre.
- **Tipografía**: serif clásica (recomendado: **Cormorant**, mismo rol tipográfico que Jabón en Barra, reforzando el registro artesanal/atemporal) para el nombre o descripción del artículo.
- **Paleta**: marrón añejo `#6B4F3B`, hueso envejecido `#EFE6D8`, marrón muy oscuro `#2B2216`.
- **Estilo**: vintage, curado, con un marco ornamental fino perimetral — la primera y única aparición de un marco ornamental decorativo en todo el catálogo hasta este punto, reservada deliberadamente a este contexto de "artículo con historia".
- **Espaciados**: margen de 3mm respecto al área segura, medido desde el borde interior del marco ornamental.
- **Jerarquía**: 1) nombre o descripción breve del artículo (dominante), 2) marco ornamental perimetral fino (marco, nunca protagonista).
- **Alineaciones**: centrada.
- **Formas**: rectángulo horizontal.
- **Iconografía**: el marco ornamental en sí (línea fina decorativa clásica, Nivel 1 del Design Language Guide) — sin ilustración figurativa adicional dentro del marco.
- **Texturas**: ninguna adicional al marco — el marco ornamental cumple la función que en otros templates cumple la textura.
- **Estilo visual**: clásico, marco ornamental fino, tipografía serif atemporal.

### 3. Layout
- **Formato**: rectangular horizontal, 50mm × 30mm aprox. (formato de etiqueta colgante).
- **Zonas**: marco ornamental perimetral (borde completo), centro (nombre o descripción del artículo).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, medida desde el borde interior del marco ornamental, no desde el borde de troquel — el marco en sí vive en la zona entre el sangrado y el área segura funcional del contenido de texto.
- **Retícula**: marco perimetral + centro, sin zonas intermedias.
- **Proporciones**: el marco ornamental ocupa una franja delgada y constante (aproximadamente 2mm de grosor visual) en todo el perímetro, sin variar de grosor.

### 4. Elementos
- Nombre o descripción breve del artículo vintage
- Marco ornamental perimetral fino

### 5. Assets necesarios
- 1 marco ornamental vectorial de línea fina, estilo clásico (no floral como Wedding, sino geométrico/lineal atemporal tipo "marco de placa antigua"), diseñado para adaptarse al perímetro rectangular sin distorsión en las esquinas

### 6. Mockup
Etiqueta colgante atada con hilo o cordel a un artículo vintage genérico, luz natural suave con tono cálido ligeramente sepia, superficie de madera envejecida o textil neutro de fondo, sin props adicionales que distraigan del artículo mismo.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo hueso envejecido sólido — el marco ornamental debe ser reconocible incluso a tamaño de card pequeña, sin perderse en la reducción.

### 8. Prompt para IA
Para el marco ornamental perimetral:
> "Thin classic ornamental frame border, geometric and timeless (not floral), delicate consistent line weight, designed to wrap cleanly around a rectangular label without distortion at the corners, vintage curated aesthetic reminiscent of an antique plaque or label, single color line art, transparent center, transparent background."

### 9. Exportación
- Tamaño final: 50mm × 30mm.
- Sangrado: 3mm. Área segura: 3mm de margen interno, medida desde el borde interior del marco (ver §3).
- Recomendación de impresión: vinil adhesivo mate o etiqueta colgante en cartulina rígida con orificio para hilo, según el uso (adhesivo vs. colgante).

### 10. Nivel de calidad
Premium aquí depende de que el marco ornamental se sienta clásico y atemporal, nunca genérico de plantilla de "etiqueta vintage" descargada — el error más común a evitar es un marco demasiado ornamentado o barroco que compita con el nombre del artículo. Validación: el marco debe leerse como un detalle de calidad discreto, no como el elemento principal del diseño — cubrir el marco con la mano no debe cambiar la percepción de qué artículo es.

### 11. Commercial Sheet
- **Nombre comercial**: Vintage Curated — Etiqueta de Artículo Curado
- **Elevator Pitch**: Etiqueta clásica con marco ornamental fino para comunicar autenticidad y criterio de curaduría en artículos vintage.
- **Beneficio principal**: Da a tus artículos vintage la misma sensación de valor y selección que percibe el comprador al ver la pieza misma.
- **Ideal para**: vendedores de artículos vintage o de segunda mano curados, tiendas de antigüedades pequeñas en marketplace.
- **Nivel de personalización**: Medio (nombre/descripción del artículo editable; marco ornamental fijo por diseño).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Intermedia (el marco ornamental requiere precisión de corte para no distorsionarse en las esquinas).
- **Productos compatibles**: Artículos vintage, piezas de antigüedad, ropa o accesorios curados de segunda mano.
- **Palabras clave SEO**: etiqueta vintage curado, sticker artículo antiguo, template vintage label, etiqueta marco ornamental, packaging vintage marketplace, sticker curaduría vintage, etiqueta antigüedad venta, template etiqueta colgante vintage, packaging artículo curado, sticker marco clásico, etiqueta vendedor vintage, template curated item label, packaging segunda mano curado, sticker etiqueta antigua, etiqueta artículo con historia, template marco geométrico vintage, packaging tienda antigüedades, sticker vintage marketplace, etiqueta curaduría marca, template etiqueta clásica ornamental.
- **Categoría comercial**: Etsy Sellers.
- **Colección**: Craft Collection.
- **Premium Features**: Marco ornamental vectorial curado, único en todo el catálogo, diseñado específicamente para el contexto de valor/curaduría; sistema tipográfico serif atemporal consistente con Jabón Artesanal en Barra.
- **Call to Action**: Que la etiqueta cuente, de un vistazo, que esta pieza fue elegida con criterio.

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

5 de 63 templates completados en este lote (Batch 09: templates 13.1 a 13.3 — cierra Crafts en su totalidad — y templates 14.1 y 14.2 de Etsy Sellers). El template 14.3 (Empaque Artesanal Etsy) pasa al Batch 10 junto con el inicio de Kids, tal como se anticipó al cerrar Batch 08.

Progreso acumulado: 45 de 63 templates completados (Batch 01 a Batch 09).

**A la espera de aprobación antes de continuar con Batch 10** (Empaque Artesanal Etsy — cierra Etsy Sellers — + Kids completa [3 templates] + 1 template de Education).

**Nota de planeación comercial**: Batch 10 es el punto en el que `THÖREN Bundle Strategy` fue agendado para comenzar a producirse — se retomará esa conversación al cerrar este lote, no antes.
