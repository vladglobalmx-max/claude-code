> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 05 — Retail (cierre) + Product Labels (Templates 21-25 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 21 a 25 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: este lote sigue exactamente las 12 secciones congeladas como estándar oficial desde Batch 03/04 (1-10 de diseño, 11 Commercial Sheet, 12 Production Checklist + línea de cierre Production Status) — sin adiciones ni cambios, tal como fue confirmado al aprobar Batch 04.

**Familias de lenguaje visual**: cada template de este lote referencia explícitamente su familia según `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1, ya congelado como documento maestro. Ninguno de los 5 templates de este lote requiere una familia nueva — todos encajan en las 3 ya documentadas: Impacto Comercial, Artesanal Cálido y Lujo Silencioso (esta última en su variante corporativa/profesional, cubierta por el mismo principio de restricción del template Serum).

Este lote cierra Retail (templates 6.2 y 6.3, los últimos pendientes) y completa Product Labels en su totalidad (7.1-7.3).

Después de este lote se espera aprobación antes de continuar con el Batch 06.

---

## Template 21 — Nuevo Producto

### 1. Concepto
Cuando una tienda agrega un producto recién lanzado a su catálogo, necesita una señal visual que interrumpa el escaneo habitual del comprador en el anaquel — "esto es nuevo" es información que debe leerse antes que cualquier otro dato del producto. El problema: un sello de "nuevo" débil o mal ejecutado se pierde entre el resto del empaque; este template existe para garantizar que ese mensaje gane la competencia visual por la atención, siguiendo la misma lógica de impacto inmediato que ya rige el template de Precio y Oferta.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Impacto Comercial (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: display de impacto para la palabra "NUEVO" (recomendado: **Archivo Black**, peso 900, mayúsculas) — mismo rol tipográfico que Precio y Oferta, coherente con la misma familia.
- **Paleta**: verde de novedad `#2ECC71`, casi negro `#1A1A1A`, blanco `#FFFFFF` — 3 colores fijos, sin acento variable (regla de §3.1 del Design Language Guide).
- **Estilo**: directo, celebratorio, sin sutileza — la discreción sería un error aquí, igual que en Oferta.
- **Espaciados**: compacto, la palabra "NUEVO" y la ráfaga de fondo ocupan la mayor proporción posible del espacio disponible dentro del área segura.
- **Jerarquía**: 1) palabra "NUEVO" (dominante, centro absoluto), 2) ráfaga o estrella de fondo (refuerza sin competir, siempre detrás del texto).
- **Alineaciones**: centrada, eje único.
- **Formas**: círculo de troquel.
- **Iconografía**: una sola ráfaga/estrella de fondo (Nivel 3 del Design Language Guide — gráfico de alto contraste, bordes duros), nunca combinada con un segundo ícono.
- **Texturas**: ninguna — coherente con la familia Impacto Comercial.
- **Estilo visual**: gráfico sólido de alto contraste, bordes duros, sin degradados.

### 3. Layout
- **Formato**: círculo de 40mm de diámetro.
- **Zonas**: ráfaga/estrella de fondo ocupando el círculo completo, palabra "NUEVO" superpuesta en el centro.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — el texto nunca se acerca al borde donde la ráfaga puede recortarse.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: la palabra "NUEVO" ocupa aproximadamente 50% del diámetro; la ráfaga de fondo llena el resto sin zonas de aire adicional (a diferencia de familias más silenciosas, aquí la densidad es la estrategia correcta).

### 4. Elementos
- Palabra "NUEVO" (texto fijo, no editable por diseño — es la función central del template)
- Ráfaga o estrella de fondo

### 5. Assets necesarios
- 1 ilustración SVG de ráfaga/estrella de alto contraste, bordes duros, sin degradado

### 6. Mockup
Empaque de producto genérico (caja o frasco neutro sin marca) en un estante de tienda, el sticker aplicado sobre una esquina visible del empaque, iluminación de tienda plana y uniforme, fondo de estantería desenfocado con productos genéricos de contexto — mismo lenguaje de mockup que Precio y Oferta, misma familia.

### 7. Thumbnail
Sello circular solo sobre fondo blanco — debe leerse "NUEVO" de inmediato incluso a tamaño de card pequeña, sin necesidad de que el ojo busque dónde mirar.

### 8. Prompt para IA
Para la ráfaga/estrella de fondo:
> "Bold high-contrast starburst or radiating star shape, hard clean vector edges, no gradients, flat solid fill, energetic and celebratory retail badge aesthetic, single color, transparent background, suitable as a background element behind bold centered text."

### 9. Exportación
- Tamaño final: 40mm × 40mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo estándar, acabado brillante permitido (coherente con la familia Impacto Comercial, donde el brillo refuerza la sensación de novedad/llamativo).

### 10. Nivel de calidad
Premium aquí se mide por efectividad de interrupción visual, no por sutileza — el error más común a evitar es reducir el tamaño de la palabra "NUEVO" para "dejar respirar" el diseño, lo cual contradice directamente la función del template. Validación: a 2 metros de distancia y 1 segundo de exposición, "NUEVO" debe ser inequívocamente lo único que se retiene.

### 11. Commercial Sheet
- **Nombre comercial**: Nuevo — Sello de Producto Recién Lanzado
- **Elevator Pitch**: Sello circular de alto impacto para anunciar que un producto es nuevo en tu catálogo, diseñado para ganar la atención en el anaquel.
- **Beneficio principal**: Interrumpe el escaneo habitual del comprador y comunica novedad de forma instantánea, sin depender de que lean ningún otro texto.
- **Ideal para**: tiendas físicas y online que lanzan producto nuevo, marcas con catálogo en expansión constante.
- **Nivel de personalización**: Bajo (el texto "NUEVO" es fijo por diseño; solo cambia el tamaño/posición de aplicación según el producto).
- **Tiempo estimado de personalización**: 2 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Empaques de producto, estantes de tienda, vitrinas, displays de lanzamiento.
- **Palabras clave SEO**: sticker nuevo producto, etiqueta lanzamiento, template badge nuevo, sticker retail nuevo, packaging producto nuevo, etiqueta novedad tienda, template new arrival, sticker estrella nuevo, etiqueta ráfaga retail, template lanzamiento producto, packaging badge llamativo, sticker anuncio nuevo, etiqueta catálogo nuevo, template retail badge, packaging tienda lanzamiento, sticker producto reciente, etiqueta impacto visual, template nuevo en tienda, packaging novedad comercial, sticker badge circular.
- **Categoría comercial**: Retail.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Sistema de ráfaga de alto contraste calibrado para máxima captura de atención; jerarquía validada para lectura en menos de 1 segundo; cero producción de assets adicionales requerida más allá de la ráfaga.
- **Call to Action**: Anuncia lo nuevo antes de que el comprador siga de largo.

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

## Template 22 — Sello "Hecho en Casa"

### 1. Concepto
Un productor local que vende su repostería/manufactura a través de tiendas de terceros necesita comunicar "esto no vino de una fábrica" en el mismo instante de contacto visual, dentro de un contexto de venta que no es el suyo propio (un mostrador ajeno, una mesa compartida). El problema: sin un sello que comunique origen humano, el producto se confunde con manufactura industrial genérica del mismo estante. Este template resuelve eso con la misma calidez artesanal ya validada en Café/Miel/Mermelada, aplicada esta vez a un sello universal de "hecho en casa" en vez de un producto específico.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: script cálida y legible (recomendado: **Caveat**, mismo rol tipográfico ya validado en Miel) para el texto principal, sin sans de apoyo — el formato es demasiado pequeño para un segundo rol tipográfico.
- **Paleta**: marrón cálido `#8B5E3C`, crema `#F5EEDD`, casi negro `#2B2B2B`.
- **Estilo**: cálido, hecho a mano, con textura de sello de tinta real — coherente con la misma lógica de "imperfección controlada" del sello del jabón artesanal.
- **Espaciados**: compacto, margen mínimo de 3mm respecto al área segura.
- **Jerarquía**: 1) texto principal "Hecho en casa" o similar (dominante), 2) textura de sello de tinta de fondo (refuerza sin competir).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna ilustración adicional — el texto script y la textura de sello son los únicos elementos.
- **Texturas**: textura de sello de tinta con imperfección leve (mismo asset conceptual documentado en el template de Jabón en Barra, reutilizable dentro del sistema de texturas de la familia Artesanal Cálido) — intensidad pronunciada (12-18% según §7 del Design Language Guide).
- **Estilo visual**: tipográfico con tratamiento de sello estampado, sin ilustración.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (texto script), textura de sello ocupando todo el círculo detrás del texto.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje central único.
- **Proporciones**: el texto script ocupa el máximo tamaño posible dentro del área segura sin comprimirse.

### 4. Elementos
- Texto principal (ej. "Hecho en casa", "Hecho con cariño")
- Textura de sello de tinta de fondo

### 5. Assets necesarios
- 1 textura de sello de tinta con imperfección leve, tileable, en tono marrón oscuro (mismo criterio de producción que el sello del template de Jabón)

### 6. Mockup
Bolsa de papel con producto de repostería visible parcialmente, luz natural cálida difusa, superficie de mercado o mesa de madera rústica, sin elementos decorativos adicionales que compitan con el sello.

### 7. Thumbnail
Sello circular solo sobre fondo crema sólido — debe leerse el texto script con calidez incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la textura de sello de tinta (mismo criterio de producción documentado en el Template 9, Jabón en Barra):
> "Circular rubber stamp texture with slightly uneven ink distribution, hand-stamped imperfection at the edges, single warm brown ink color, vintage artisan seal aesthetic, transparent background, suitable as a background overlay behind handwritten script text."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o papel kraft adhesivo, nunca brillante.

### 10. Nivel de calidad
Premium aquí depende de que el script se sienta genuinamente manuscrito y la imperfección del sello se sienta intencional, no de mala calidad de impresión — el error más común a evitar es un script demasiado "perfecto"/vectorial que traiciona la promesa de calidez humana. Validación: comparar con el sello de Jabón (Template 9) — ambos deben sentirse de la misma familia de autenticidad.

### 11. Commercial Sheet
- **Nombre comercial**: Hecho en Casa — Sello Artesanal Universal
- **Elevator Pitch**: Sello circular cálido y universal para comunicar producción local o casera en cualquier punto de venta ajeno.
- **Beneficio principal**: Diferencia tu producto de la manufactura industrial genérica en el mismo anaquel, sin necesitar packaging completo rediseñado.
- **Ideal para**: productores locales que venden en tiendas/mercados de terceros, reposteros, manufactura casera en pequeña escala.
- **Nivel de personalización**: Bajo (texto principal editable entre 2-3 variantes cortas; textura fija por diseño).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Bolsas de papel, cajas de repostería, empaques de manufactura casera, productos vendidos en consignación.
- **Palabras clave SEO**: sello hecho en casa, sticker producto artesanal, template hecho a mano, etiqueta producción local, packaging casero, sticker sello repostería, etiqueta artesanal universal, template producto local, packaging manufactura casera, sticker hecho con cariño, etiqueta sello tinta, template producción artesanal, packaging venta local, sticker sello casero, etiqueta origen humano, template retail artesanal, packaging producto hecho a mano, sticker sello universal, etiqueta manufactura local, template sello repostero.
- **Categoría comercial**: Retail.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Textura de sello de tinta con imperfección controlada reutilizando el sistema ya validado en Jabón en Barra; sistema tipográfico script curado; layout calibrado para aplicación rápida en punto de venta de terceros.
- **Call to Action**: Que se note, de un vistazo, que esto lo hizo una persona.

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

## Template 23 — Etiqueta Neutral Minimalista

### 1. Concepto
Cualquier emprendedor en etapa temprana, en cualquier industria no cubierta todavía por una categoría específica del catálogo, necesita una etiqueta funcional desde el primer día — no una plantilla vacía sin dirección, sino un sistema ya resuelto con la misma disciplina que el resto de THÖREN. Este template existe para ser la base neutral del catálogo: deliberadamente sin ilustración ni color de identidad de industria, pero nunca genérico en ejecución — la misma lógica de "restricción como señal de calidad" del Serum Facial Premium, aplicada de forma agnóstica a cualquier producto.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — variante neutral/agnóstica de industria, misma disciplina que Serum Facial Premium.
- **Tipografía**: una sola familia sans-serif geométrica (recomendado: **Work Sans**, peso 500 para el wordmark, 400 para el subtítulo) — deliberadamente la misma disciplina de una sola familia que el Serum.
- **Paleta**: exactamente la misma paleta del Serum Facial Premium — carbón `#23282B`, hueso `#EDEAE2`, cobre `#9C4E27` — reutilizada de forma intencional, no coincidencia: ambos templates comparten familia de lenguaje y esa consistencia de paleta es la prueba de que el sistema funciona across categorías distintas.
- **Estilo**: minimalista, agnóstico de industria — "en blanco pero no vacío": jerarquía clara sin ilustración.
- **Espaciados**: margen generoso, mínimo 5mm respecto al área segura.
- **Jerarquía**: 1) wordmark del producto/marca (centrado, dominante), 2) línea divisoria fina, 3) subtítulo pequeño (categoría de producto o dato breve).
- **Alineaciones**: centrada estricta, eje único.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ninguna — Nivel 0 del Design Language Guide, igual que Serum y Spa.
- **Texturas**: ninguna.
- **Estilo visual**: tipografía pura, sin ilustración, coherente con la familia Lujo Silencioso.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 2.5:1.
- **Zonas**: centro (wordmark), línea fina divisoria, subtítulo pequeño debajo.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 3 puntos de anclaje (wordmark, línea, subtítulo).
- **Proporciones**: la línea divisoria ocupa máximo 40% del ancho total, nunca de borde a borde.

### 4. Elementos
- Wordmark de marca/producto
- Línea divisoria fina
- Subtítulo corto (ej. categoría de producto, tagline breve)

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía y una línea vectorial simple, igual que el Serum.

### 6. Mockup
Envase genérico neutro (frasco o caja lisa sin forma de industria específica), fondo blanco puro, luz de estudio uniforme sin sombras marcadas, sin props — mismo lenguaje de mockup que el Serum, aplicado aquí de forma agnóstica de producto.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo hueso sólido — el wordmark debe leerse con claridad, el diseño se percibe deliberadamente "silencioso" a tamaño de card.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y una línea vectorial simple.

### 9. Exportación
- Tamaño final: 75mm × 30mm aprox. (etiqueta rectangular genérica, ajustable a cualquier envase).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar — sin restricción especial dado que el template es agnóstico de industria.

### 10. Nivel de calidad
Premium aquí es que un template "sin industria propia" no se sienta como el peor del catálogo, sino como una versión igual de disciplinada que cualquier otro — el error más común a evitar es tratar este template como relleno de catálogo y descuidar la calidad tipográfica. Validación: comparar directamente con el Serum Facial Premium — deben sentirse de la misma familia de calidad, pese a no compartir industria.

### 11. Commercial Sheet
- **Nombre comercial**: Base — Etiqueta Neutral Minimalista
- **Elevator Pitch**: Etiqueta minimalista y agnóstica de industria, lista para cualquier producto que aún no tiene una categoría propia en el catálogo.
- **Beneficio principal**: Da presencia profesional desde el primer día a cualquier producto nuevo, sin esperar a que exista un template de su industria específica.
- **Ideal para**: emprendedores en etapa temprana, cualquier industria no cubierta por las categorías existentes del catálogo, productos de prueba de concepto.
- **Nivel de personalización**: Bajo (wordmark y subtítulo únicamente — restricción deliberada, misma lógica que el Serum).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Cualquier envase genérico — frascos, cajas, bolsas sin forma de industria específica.
- **Palabras clave SEO**: etiqueta neutral, sticker minimalista genérico, template producto general, etiqueta base universal, packaging neutro, sticker marca genérica, etiqueta minimalista producto, template etiqueta agnóstica, packaging emprendimiento nuevo, sticker producto sin categoría, etiqueta simple profesional, template base minimalista, packaging producto general, sticker wordmark limpio, etiqueta universal negocio, template etiqueta flexible, packaging cualquier industria, sticker minimalista negocio, etiqueta genérica premium, template producto nuevo.
- **Categoría comercial**: Product Labels.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Reutiliza la paleta y disciplina validadas del Serum Facial Premium, ya probada como sistema de percepción de calidad; cero producción de assets gráficos requerida; agnóstico de industria sin sentirse genérico.
- **Call to Action**: Empieza con presencia profesional, incluso antes de tener una categoría propia.

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

## Template 24 — Etiqueta Kraft Genérica

### 1. Concepto
La versión cálida de la etiqueta neutral: un maker o pequeño productor artesanal sin categoría específica en el catálogo necesita la misma flexibilidad agnóstica del Template 23, pero con calidez humana en vez de neutralidad corporativa. Este template resuelve el mismo problema de "producto sin industria propia" desde la familia Artesanal Cálido en vez de Lujo Silencioso, dando dos puntos de partida genéricos con personalidades opuestas para que cualquier emprendedor elija el que corresponda al tono real de su marca.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Artesanal Cálido (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: serif cálida ligera para el wordmark (recomendado: **Lora**, mismo rol ya validado en Miel y Té de Hierbas), sans-serif simple para el subtítulo (recomendado: **Work Sans**).
- **Paleta**: exactamente la misma paleta del Jabón en Barra — marrón artesanal `#8B6F47`, crema papel reciclado `#F5EFE3`, marrón muy oscuro `#2B2216` — reutilizada de forma intencional, misma lógica de consistencia inter-template que el Template 23 con el Serum.
- **Estilo**: cálido, artesanal, sobre fondo tipo papel kraft.
- **Espaciados**: margen de 4mm respecto al área segura, generoso pero no extremo (coherente con la familia).
- **Jerarquía**: 1) wordmark de marca/producto, 2) sello circular simple superpuesto (opcional), 3) subtítulo pequeño.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna ilustrativa — solo el sello circular simple como elemento gráfico opcional, sin ícono figurativo.
- **Texturas**: textura de papel kraft visible (intensidad media, 8-10% — menos pronunciada que Jabón en Barra porque aquí no hay un producto físico irregular que envolver, solo una etiqueta plana).
- **Estilo visual**: cálido artesanal, textura kraft de fondo.

### 3. Layout
- **Formato**: círculo de 45mm de diámetro.
- **Zonas**: centro (wordmark), sello circular simple superpuesto opcional en un borde, subtítulo pequeño en la parte inferior.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: circular centrada, un solo eje.
- **Proporciones**: el sello circular opcional, cuando se usa, ocupa un máximo de 20% del diámetro total.

### 4. Elementos
- Wordmark de marca/producto
- Sello circular simple opcional
- Subtítulo corto (ej. "hecho a mano", categoría de producto)

### 5. Assets necesarios
- 1 textura de papel kraft, tileable, en tonos cálidos (intensidad media)
- 1 elemento gráfico simple de sello circular (línea, sin ilustración figurativa)

### 6. Mockup
Bolsa o frasco con textura kraft visible, luz natural cálida, superficie de madera clara, sin props adicionales — coherente con el resto de la familia Artesanal Cálido.

### 7. Thumbnail
Etiqueta circular sola sobre fondo kraft sólido — debe comunicar calidez artesanal de inmediato, incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la textura de papel kraft:
> "Kraft paper texture, warm brown tones, visible but moderate natural fiber texture (less pronounced than a heavily textured recycled paper), tileable seamless pattern, artisan generic packaging aesthetic, suitable for an 8-10% opacity overlay behind typography."

### 9. Exportación
- Tamaño final: 45mm × 45mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: papel kraft adhesivo real cuando sea posible, o vinil mate texturizado.

### 10. Nivel de calidad
Premium aquí significa que la versión "genérica cálida" del catálogo se sienta tan cuidada como cualquier template de industria específica — el error más común a evitar es tratar la textura kraft como un atajo visual sin cuidar la tipografía debajo. Validación: comparar con Miel o Té de Hierbas — debe sentirse de la misma familia, aunque sea la versión "sin industria asignada" del sistema.

### 11. Commercial Sheet
- **Nombre comercial**: Kraft — Etiqueta Artesanal Universal
- **Elevator Pitch**: Etiqueta circular cálida sobre fondo kraft, lista para cualquier producto artesanal sin categoría propia todavía en el catálogo.
- **Beneficio principal**: Da calidez y personalidad artesanal desde el primer día, sin necesitar un template de industria específica.
- **Ideal para**: makers y pequeños productores artesanales en general, sin importar el rubro.
- **Nivel de personalización**: Bajo (wordmark, subtítulo y presencia del sello opcional editables).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Bolsas kraft, frascos con textura kraft, empaques artesanales genéricos.
- **Palabras clave SEO**: etiqueta kraft genérica, sticker artesanal universal, template producto artesanal, etiqueta kraft circular, packaging maker general, sticker kraft producto, etiqueta hecho a mano genérica, template artesanal flexible, packaging kraft universal, sticker productor pequeño, etiqueta papel kraft, template producto artesanal genérico, packaging maker independiente, sticker etiqueta cálida, etiqueta universal artesanal, template kraft base, packaging artesano general, sticker circular kraft, etiqueta producto hecho a mano, template kraft genérico.
- **Categoría comercial**: Product Labels.
- **Colección**: Coffee & Tea Collection.
- **Premium Features**: Reutiliza la paleta y textura validadas del Jabón Artesanal en Barra; sello circular opcional incluido; agnóstico de industria sin perder calidez.
- **Call to Action**: Empieza con la calidez de lo artesanal, sin esperar a tener tu propia categoría.

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

## Template 25 — Etiqueta Corporativa Simple

### 1. Concepto
Una pequeña empresa B2B que vende producto físico de marca corporativa (no artesanal, no de consumo masivo) necesita una etiqueta que comunique formalidad y confianza profesional, con espacio explícito para datos de contacto — un requisito que ningún otro template genérico del catálogo cubre todavía. Este template completa el trío de opciones "sin industria propia" (junto a Templates 23 y 24) cubriendo específicamente el registro corporativo/formal.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), variante corporativa/profesional — misma disciplina de restricción tipográfica y espacio negativo que el Serum, con una paleta más fría y orientada a negocio en vez de belleza.
- **Tipografía**: una sola familia sans-serif profesional (recomendado: **Inter**, peso 600 para el bloque de logo/nombre, 400 para los datos de contacto).
- **Paleta**: exactamente la misma paleta usada en la familia Business del catálogo — gris azulado oscuro `#1F2933`, blanco `#FFFFFF`, azul grisáceo `#4B6673` — anticipando de forma consistente la paleta que la categoría Business (aún pendiente de producción, Batch 07) usará para sus propios templates, evitando así tener que introducir una paleta nueva sin precedente cuando esa categoría se produzca.
- **Estilo**: formal, corporativo, limpio — sin ilustración, sin calidez artesanal.
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) bloque de logo/nombre de empresa (arriba, dominante), 2) datos de contacto (abajo, tipografía pequeña — dirección, teléfono o sitio web).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: ninguna — Nivel 0, coherente con la variante Lujo Silencioso.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro, sin ilustración.

### 3. Layout
- **Formato**: cuadrado de 40mm × 40mm.
- **Zonas**: dos tercios superiores (bloque de logo/nombre de empresa), tercio inferior (datos de contacto en tipografía pequeña).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 franjas horizontales (66% / 34%).
- **Proporciones**: el bloque de datos de contacto nunca excede el 34% de la altura total, para que el logo/nombre siga siendo el elemento dominante.

### 4. Elementos
- Bloque de logo o nombre de empresa
- Datos de contacto (ej. sitio web, teléfono, dirección corta)

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía, sin ilustración externa.

### 6. Mockup
Caja corporativa lisa (sin forma de industria específica), fondo neutro claro, luz de estudio uniforme, sin props — mismo lenguaje de mockup silencioso que el resto de la familia Lujo Silencioso.

### 7. Thumbnail
Etiqueta cuadrada sola sobre fondo blanco sólido — el bloque de logo/nombre debe leerse con claridad profesional a tamaño de card.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 40mm × 40mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar de oficina/empaque corporativo.

### 10. Nivel de calidad
Premium aquí significa que el registro corporativo se sienta confiable y profesional sin caer en frío/genérico — el error más común a evitar es una tipografía corporativa demasiado utilitaria (sin ningún peso de personalidad) que se sienta como una plantilla de Word. Validación: comparar con el Serum — debe sentirse igual de cuidado, aunque el contexto sea de negocio en vez de belleza.

### 11. Commercial Sheet
- **Nombre comercial**: Corporate — Etiqueta Corporativa Simple
- **Elevator Pitch**: Etiqueta cuadrada formal con espacio para logo y datos de contacto, para cualquier producto de marca corporativa B2B.
- **Beneficio principal**: Comunica confianza profesional y datos de contacto claros, sin necesitar diseño de marca completo.
- **Ideal para**: pequeñas empresas B2B, proveedores corporativos, productos de marca institucional sin industria específica en el catálogo.
- **Nivel de personalización**: Medio (nombre/logo de empresa y datos de contacto editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas corporativas, sobres, empaques de producto B2B, material institucional.
- **Palabras clave SEO**: etiqueta corporativa, sticker negocio formal, template empresa B2B, etiqueta datos de contacto, packaging corporativo simple, sticker marca institucional, etiqueta profesional negocio, template corporate label, packaging producto empresarial, sticker contacto empresa, etiqueta formal B2B, template negocio pequeño, packaging institucional, sticker empresa proveedor, etiqueta corporativa cuadrada, template marca corporativa, packaging B2B simple, sticker negocio formal, etiqueta contacto profesional, template empresarial genérico.
- **Categoría comercial**: Product Labels.
- **Colección**: Business Collection.
- **Premium Features**: Paleta anticipando consistencia con la futura categoría Business del catálogo; sistema tipográfico corporativo curado; cero producción de assets gráficos requerida.
- **Call to Action**: Que cada empaque que sale de tu empresa hable con la misma seriedad que tu negocio.

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

5 de 63 templates completados en este lote (Batch 05: templates 6.2 y 6.3 — cierra Retail en su totalidad — y templates 7.1 a 7.3 — cierra Product Labels en su totalidad). El próximo lote inicia la categoría Packaging (2 templates) junto con Shipping (3 templates), para completar 5.

Progreso acumulado: 25 de 63 templates completados (Batch 01 a Batch 05).

**A la espera de aprobación antes de continuar con Batch 06** (Packaging completa [2 templates] + Shipping completa [3 templates]).
