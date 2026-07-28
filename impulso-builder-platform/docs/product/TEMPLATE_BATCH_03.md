# Template Batch 03 — Bálsamo Labial (Cosmetics) + Beauty + Industrial (Templates 11-15 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 11 a 15 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Novedades de este lote**: a partir de Batch 03, cada template incorpora una sección 12 — **Production Checklist** — y una línea de cierre **Production Status**. Ninguna de las dos modifica la arquitectura, el roadmap ni el código; son control práctico de avance de producción, tal como la Commercial Sheet (sección 11, confirmada como estándar permanente desde Batch 02) es información comercial. Las 10 secciones de diseño original permanecen sin cambio.

Este lote cierra Cosmetics (template 2.5, el último pendiente), completa Beauty en su totalidad (3.1-3.3), y abre Industrial con su primer template (4.1) — el segundo y último de Industrial (4.2) pasa al Batch 04 junto con el inicio de Warning & Compliance Labels, para no romper el ritmo de 5 por lote a la mitad de una categoría de solo 2 templates.

Después de este lote se espera aprobación antes de continuar con el Batch 04.

---

## Template 11 — Bálsamo Labial Natural

### 1. Concepto
El bálsamo labial se vende en el envase más pequeño y de menor precio unitario de toda la línea de cosmética natural — el reto no es de posicionamiento de marca sino de espacio físico casi inexistente. El comprador de este producto lo trata como un objeto de bolsillo/bolso, casi un accesorio; el diseño debe reducirse a lo esencial sin sentirse recortado o incompleto. Este template existe para resolver, igual que el aceite esencial (Template 10), un problema de escala extrema, pero calibrado para una lata circular de tapa, no un frasco gotero.

### 2. Dirección de Arte
- **Tipografía**: una sola familia sans-serif redondeada y cálida (recomendado: **Quicksand**, peso 500) — a este tamaño, dos familias tipográficas ya no son legibles como jerarquía, se leen como ruido.
- **Paleta**: terracota cálido `#C97A4F`, crema muy pálido `#FFF8F0`, casi negro `#2B2B2B` para el texto de mayor contraste.
- **Estilo**: cálido, táctil, sin pretensión de lujo (a diferencia del serum, Template 7, este producto se percibe como cuidado diario accesible, no como activo premium).
- **Espaciados**: el margen disponible es el más restrictivo de todo el catálogo hasta ahora — el área segura de 3mm en un círculo de 20mm representa una porción del diseño mayor que en cualquier template anterior, incluido el aceite esencial de 25mm.
- **Jerarquía**: 1) sabor/aroma (ej. "Vainilla", "Menta"), único elemento verdaderamente dominante, 2) wordmark de marca, en tamaño notablemente menor.
- **Alineaciones**: centrada, eje único, sin excepción.
- **Formas**: **personalizado** — círculo pequeño calibrado para la tapa o base de una lata de bálsamo tipo "tin".
- **Iconografía**: ninguna — el espacio físico es insuficiente para sostener un ícono legible sin sacrificar el texto, que es la información prioritaria.
- **Texturas**: ninguna.
- **Estilo visual**: tipografía pura, sin ningún elemento gráfico adicional — el segundo template del catálogo (después del serum) que se resuelve exclusivamente con tipografía.

### 3. Layout
- **Formato**: círculo de 20mm de diámetro (el formato más pequeño de todo el catálogo hasta ahora).
- **Zonas**: centro (nombre del sabor/aroma), borde inferior curvo (wordmark de marca, en arco pequeño).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — a este tamaño, la disciplina de "menos elementos, no menos margen" es absoluta; no hay ningún elemento que pueda comprimirse más sin perder legibilidad.
- **Retícula**: un solo eje vertical, dos puntos de anclaje únicamente (sabor, marca).
- **Proporciones**: el wordmark de marca ocupa un tamaño de fuente notablemente menor que el nombre del sabor — la jerarquía debe ser inequívoca incluso a este tamaño mínimo.

### 4. Elementos
- Nombre del sabor/aroma (ej. "Vainilla", "Menta", "Coco")
- Wordmark de marca (pequeño)

### 5. Assets necesarios
- Ninguno gráfico — el template se construye exclusivamente con tipografía, sin ilustración ni ícono.

### 6. Mockup
Lata pequeña metálica tipo "tin" de bálsamo labial, vista superior recta (top-down, no en ángulo — a este tamaño de producto, la vista superior es la que mejor comunica el formato real), fondo neutro claro liso, luz de estudio suave y uniforme, sin ningún prop adicional.

### 7. Thumbnail
Etiqueta circular sola, mostrada considerablemente más grande que su proporción real frente a la card (mismo criterio de excepción que el Template 10, justificado por legibilidad) — fondo crema sólido.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía, sin ilustración externa.

### 9. Exportación
- Tamaño final: 20mm × 20mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno (la relación margen/tamaño total más exigente de todo el catálogo).
- Recomendación de impresión: vinil resistente a residuo graso (contacto directo con el producto), acabado mate; prueba física obligatoria a tamaño real antes de producción masiva.

### 10. Nivel de calidad
Premium a esta escala significa aceptar la restricción sin luchar contra ella — el error más común a evitar es intentar agregar cualquier elemento gráfico "para que no se vea tan simple"; a 20mm, simple es la única opción funcional. Validación: igual que el Template 10, imprimir una prueba física y verificar legibilidad del sabor a distancia de uso normal (sacando el bálsamo de un bolso) sin acercarse.

### 11. Commercial Sheet
- **Nombre comercial**: Tiny Balm — Etiqueta de Bálsamo Labial
- **Elevator Pitch**: Etiqueta ultra-compacta para bálsamos labiales, resuelta con la máxima disciplina tipográfica del catálogo.
- **Beneficio principal**: Legible y con marca clara incluso en el envase más pequeño de tu línea de producto.
- **Ideal para**: marcas de cuidado personal natural, líneas de belleza con producto de entrada/regalo, marcas de bienestar con SKU de bolsillo.
- **Nivel de personalización**: Bajo (sabor y wordmark de marca únicamente).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Media (formato mínimo exige prueba física antes de producción masiva).
- **Productos compatibles**: Latas tipo "tin" de bálsamo labial, tubos pequeños de bálsamo.
- **Palabras clave SEO**: etiqueta bálsamo labial, sticker lip balm, template lata pequeña, etiqueta cosmética mini, packaging bálsamo natural, sticker tin labial, etiqueta vainilla menta, template producto pequeño cosmético, packaging cuidado labial, sticker marca belleza mini, etiqueta lata tapa, template balm natural, packaging regalo cosmético, sticker labial artesanal, etiqueta circular mini, template lip care, packaging bolsillo belleza, sticker bálsamo coco, etiqueta tin metálico, template cosmética compacta.
- **Categoría comercial**: Cosmetics.
- **Colección**: Cosmetics Collection.
- **Premium Features**: Sistema calibrado específicamente para el formato de 20mm (no una reducción de otro template); guía de validación física incluida; cero producción de assets gráficos requerida.
- **Call to Action**: Hasta el producto más pequeño de tu línea merece una etiqueta que se vea intencional.

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

## Template 12 — Sello de Cita — Salón de Belleza

### 1. Concepto
Un salón de belleza independiente construye lealtad de clientes a través de pequeños toques de cuidado — recordatorios de cita, notas de agradecimiento — que las cadenas grandes no personalizan. El problema: sin un sistema visual de marca consistente, esos toques se sienten improvisados en vez de intencionales. Este template existe para dar a un salón pequeño un sello reutilizable que refuerce marca en cada punto de contacto físico con el cliente, sin requerir un diseño distinto cada vez.

### 2. Dirección de Arte
- **Tipografía**: serif elegante para el monograma/inicial (recomendado: **Playfair Display**, peso 600), sans-serif ligera para el texto perimetral (recomendado: **Work Sans**, peso 400, versalitas).
- **Paleta**: rosa antiguo `#B76E79`, casi negro `#2B2224`, rosa pálido `#F7E9EA`.
- **Estilo**: elegante, íntimo, ligeramente romántico sin caer en infantil.
- **Espaciados**: anillo de texto perimetral con espaciado de letras (tracking) amplio, mínimo 3mm de margen respecto al área segura en el monograma central.
- **Jerarquía**: 1) monograma o inicial del salón (dominante, centrado), 2) anillo de texto perimetral con el nombre completo del salón.
- **Alineaciones**: centrada, texto perimetral siguiendo la curva completa del círculo (360°, a diferencia del arco parcial del Template 1 de café).
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna más allá del monograma tipográfico en sí — el monograma ES el elemento gráfico central, no un ícono aparte.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro con tratamiento de monograma, sin ilustración.

### 3. Layout
- **Formato**: círculo de 30mm de diámetro.
- **Zonas**: centro (monograma/inicial, gran tamaño), anillo perimetral completo (nombre del salón, texto en círculo completo de 360°).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — el texto perimetral se ubica en el radio máximo posible dentro del área segura, sin tocarla.
- **Retícula**: circular concéntrica (monograma central + anillo perimetral), sin zonas intermedias.
- **Proporciones**: el monograma ocupa aproximadamente 40% del diámetro total.

### 4. Elementos
- Monograma o inicial del salón/estilista (ej. "M" para "Salón Marina")
- Nombre completo del salón (anillo perimetral)
- Opcional: una palabra corta adicional (ej. "beauty", "studio")

### 5. Assets necesarios
- Ninguno gráfico — el monograma se construye con tipografía; no requiere ilustración externa.

### 6. Mockup
Tarjeta de cita de papel doblada tipo carta pequeña, el sello aplicado cerrando el borde/solapa, fondo de escritorio con luz natural suave, superficie de madera clara o mármol claro, sin props adicionales que compitan con la tarjeta.

### 7. Thumbnail
Sello circular solo, centrado, sobre fondo rosa pálido sólido (`#F7E9EA`) — el monograma debe leerse con claridad total incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — el monograma se construye directamente con tipografía en el editor.

### 9. Exportación
- Tamaño final: 30mm × 30mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado, corte preciso de círculo (la desviación de corte es más notoria en formatos pequeños con texto perimetral).

### 10. Nivel de calidad
Premium aquí depende enteramente de la calidad tipográfica del monograma — el error más común a evitar es usar una fuente decorativa genérica de "monograma" descargada sin curaduría, que se ve igual a miles de productos de stock. Validación: el monograma debe sentirse diseñado específicamente para esta marca, no un placeholder de plantilla genérica de monogramas.

### 11. Commercial Sheet
- **Nombre comercial**: Monogram Seal — Sello de Salón de Belleza
- **Elevator Pitch**: Sello circular elegante con monograma para dar consistencia de marca a cada tarjeta y detalle de tu salón.
- **Beneficio principal**: Convierte un gesto pequeño (cerrar una tarjeta de cita) en un punto de contacto de marca memorable.
- **Ideal para**: salones de belleza independientes, estilistas y barberías boutique, spas pequeños.
- **Nivel de personalización**: Medio (inicial/monograma y nombre del salón editables; tipografía fija por diseño).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Tarjetas de cita, sobres, bolsas de producto, cajas de amenidades.
- **Palabras clave SEO**: sello salón de belleza, sticker monograma, etiqueta tarjeta de cita, template sello circular, packaging salón, sticker estilista, etiqueta monograma elegante, template beauty salon, packaging spa pequeño, sticker sello personalizado, etiqueta inicial marca, template tarjeta cita, packaging peluquería, sticker sello beauty, etiqueta circular salón, template monograma negocio, packaging barbería, sticker sello elegante, etiqueta salón independiente, template sello marca personal.
- **Categoría comercial**: Beauty.
- **Colección**: Beauty & Wellness Collection.
- **Premium Features**: Sistema de monograma tipográfico curado (no descarga genérica de stock); anillo perimetral de 360° calibrado para máxima legibilidad en 30mm; cero producción de assets gráficos requerida.
- **Call to Action**: Deja tu firma en cada detalle que sale de tu salón.

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

## Template 13 — Spa & Bienestar

### 1. Concepto
Un spa o centro de bienestar vende, sobre todo, una experiencia de calma anticipada — el empaque de sus amenidades (bolsas, cajas de tratamiento) es la primera señal física de esa promesa, antes de que el cliente entre a la sala de tratamiento. El problema: un empaque visualmente denso contradice la promesa de relajación antes de que el servicio siquiera comience. Este template existe para que ese primer contacto físico ya comunique calma, siguiendo la misma disciplina de espacio negativo que el té de hierbas (Template 6), pero adaptada a un formato rectangular de mayor superficie.

### 2. Dirección de Arte
- **Tipografía**: sans-serif ligera de trazo fino para todo el diseño (recomendado: **Work Sans**, peso 300 para el nombre del spa, 400 para el subtítulo) — un solo peso ligero dominante, nunca un peso bold en este template.
- **Paleta**: verde grisáceo suave `#A9BBB4`, hueso `#F5F3EF`, verde oscuro casi negro `#3A423E` para el texto de contraste mínimo necesario.
- **Estilo**: sereno al extremo — el template con más espacio negativo proporcional de todo el catálogo hasta ahora, junto con el serum (Template 7).
- **Espaciados**: mínimo 8mm de aire alrededor del bloque de texto respecto al área segura — el mayor de todo el catálogo.
- **Jerarquía**: 1) nombre del spa/centro (único elemento de peso visual real), 2) una línea fina decorativa horizontal, 3) subtítulo pequeño opcional (ej. "amenidades de bienestar").
- **Alineaciones**: centrada, eje único.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ninguna.
- **Texturas**: ninguna.
- **Estilo visual**: tipografía y una sola línea fina decorativa — nada más.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 2:1 (etiqueta de bolsa o caja de amenidades).
- **Zonas**: centro exacto (nombre del spa), línea fina decorativa justo debajo, subtítulo opcional debajo de la línea.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — dado el espacio negativo extremo de este template, el área segura no es una restricción activa en la práctica (el diseño ya deja mucho más margen del mínimo requerido), pero se documenta igual como piso técnico no negociable.
- **Retícula**: eje vertical único, 3 puntos de anclaje (nombre, línea, subtítulo).
- **Proporciones**: la línea decorativa ocupa un máximo de 30% del ancho total, nunca de borde a borde.

### 4. Elementos
- Nombre del spa/centro de bienestar
- Línea fina decorativa horizontal
- Subtítulo corto opcional (ej. "amenidades de bienestar", "spa & relax")

### 5. Assets necesarios
- Ninguno gráfico — el template se construye con tipografía y una línea vectorial simple.

### 6. Mockup
Bolsa de papel kraft clara con asas de cordón, fondo neutro muy claro, luz suave y difusa sin sombras marcadas, sin ningún prop adicional — el vacío alrededor de la bolsa refuerza la sensación de calma, igual que en el serum (Template 7).

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo hueso sólido — debe sentirse "silencioso" incluso a tamaño de card, sin necesidad de llenar el espacio.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y una línea vectorial simple.

### 9. Exportación
- Tamaño final: 100mm × 50mm aprox. (etiqueta rectangular para bolsa o caja de amenidades).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: papel adhesivo mate no estucado, acabado suave al tacto si el proveedor de impresión lo permite (coherente con la experiencia táctil de spa).

### 10. Nivel de calidad
Premium aquí, igual que en el serum, se mide por lo que se resiste a agregar. El error más común a evitar es un ícono decorativo tipo "hoja" o "gota de agua" agregado para "darle vida" al diseño — en esta categoría específica, ese ícono es exactamente el cliché genérico de wellness que el template busca evitar. Validación: comparar con packaging real de spas de alta gama (sin copiarlos) — debe sentirse igual de silencioso.

### 11. Commercial Sheet
- **Nombre comercial**: Calma — Etiqueta de Spa & Bienestar
- **Elevator Pitch**: Etiqueta minimalista que extiende la experiencia de calma de tu spa al primer contacto físico con el empaque.
- **Beneficio principal**: Comunica sofisticación y tranquilidad antes de que el tratamiento siquiera comience.
- **Ideal para**: spas, centros de bienestar, masajistas y terapeutas independientes, retiros de wellness.
- **Nivel de personalización**: Bajo (nombre del spa y subtítulo opcional únicamente — restricción deliberada).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Bolsas de amenidades, cajas de tratamiento, sobres de producto de spa.
- **Palabras clave SEO**: etiqueta spa, sticker bienestar, template centro de spa, etiqueta minimalista wellness, packaging spa relax, sticker amenidades spa, etiqueta calma, template spa premium, packaging bienestar, sticker terapeuta, etiqueta bolsa amenidades, template masaje relax, packaging spa boutique, sticker wellness center, etiqueta serena, template retiro bienestar, packaging tratamiento spa, sticker spa minimalista, etiqueta rectangular wellness, template amenidad natural.
- **Categoría comercial**: Beauty.
- **Colección**: Beauty & Wellness Collection.
- **Premium Features**: Sistema de espacio negativo validado para percepción de lujo silencioso; cero producción de assets gráficos requerida; consistente con la misma disciplina visual del Serum Facial Premium (Template 7).
- **Call to Action**: Que la calma de tu spa empiece desde el primer detalle que el cliente toca.

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

## Template 14 — Marca Personal de Estilista

### 1. Concepto
Estilistas y maquillistas freelance construyen su negocio enteramente sobre marca personal — a diferencia del salón (Template 12), que tiene identidad de negocio, aquí la persona ES la marca. El problema: sin un sistema visual propio, un freelancer se ve genérico frente a clientes que lo descubren en redes sociales, donde la primera impresión visual decide si generan confianza. Este template existe para dar a un profesional independiente un sticker de marca personal que se sienta curado, no improvisado con una foto de perfil recortada.

### 2. Dirección de Arte
- **Tipografía**: script elegante para el nombre (recomendado: **Playfair Display Italic** o una script real como **Parisienne** si se busca mayor calidez), sans-serif simple para el rol/especialidad (recomendado: **Work Sans**, versalitas pequeñas).
- **Paleta**: casi negro `#1D1D1D`, rosa suave `#E8B4B8`, blanco puro `#FFFFFF`.
- **Estilo**: personal, cálido, con un toque de glamour discreto (coherente con la industria de belleza, sin caer en lo genérico).
- **Espaciados**: margen mínimo de 3mm respecto al área segura, composición compacta pero no apretada.
- **Jerarquía**: 1) nombre de la persona (dominante, en script), 2) rol o especialidad (ej. "maquillista", "colorista"), 3) silueta opcional (ver iconografía).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: silueta genérica opcional (no un retrato realista — una silueta simple de perfil, deliberadamente anónima/estilizada) para quienes quieran un elemento visual además del nombre; el template debe funcionar igual de bien sin ella.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico con posible silueta de apoyo, nunca fotografía real integrada al diseño del sticker en sí (la fotografía vive en el mockup, no en el sticker).

### 3. Layout
- **Formato**: cuadrado de 40mm × 40mm.
- **Zonas**: centro (nombre en script, dominante), justo debajo (rol/especialidad), silueta opcional como elemento de fondo sutil detrás del nombre (no como elemento separado que compita).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 2 puntos de anclaje (nombre, rol).
- **Proporciones**: la silueta opcional, cuando se usa, no debe exceder el 60% de la altura total y siempre a baja opacidad (15-20%) para mantenerse como fondo, no como protagonista.

### 4. Elementos
- Nombre de la persona (ej. "Camila Ruiz")
- Rol/especialidad (ej. "Maquillista Profesional", "Colorista")
- Silueta de perfil opcional (genérica, no retrato realista)

### 5. Assets necesarios
- 1 silueta genérica de perfil (opcional, estilizada, no un retrato específico) — un solo asset reutilizable para cualquier usuario del template, no personalizado por persona

### 6. Mockup
Espejo de bolsillo o estuche de maquillaje con el sticker aplicado, fondo neutro claro, luz suave de estudio, sin elementos adicionales — el mockup debe sentirse como un objeto personal, íntimo, coherente con la naturaleza de marca personal del template.

### 7. Thumbnail
Sticker cuadrado solo, centrado, sobre fondo blanco — debe leerse el nombre en script con claridad incluso a tamaño de card pequeña (si el script elegido no se lee bien a ese tamaño, ajustar el tamaño de fuente del layout, no cambiar de thumbnail).

### 8. Prompt para IA
Para la silueta genérica opcional:
> "Generic minimalist silhouette of a person's profile, stylized and anonymous (not a specific individual), flat single-color fill, elegant and simple line quality suitable for a personal branding sticker background element, transparent background, designed to sit at low opacity behind text without competing with it."

### 9. Exportación
- Tamaño final: 40mm × 40mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí depende de que el script tipográfico se sienta curado, no una fuente script genérica de plantilla gratuita — el error más común a evitar es una silueta demasiado detallada o un intento de retrato realista, que rompe la elegancia deliberadamente anónima del elemento. Validación: el nombre debe ser identificable/memorable a primera vista sin depender de ningún elemento gráfico adicional.

### 11. Commercial Sheet
- **Nombre comercial**: Signature — Etiqueta de Marca Personal
- **Elevator Pitch**: Sticker de marca personal elegante para estilistas y maquillistas freelance que buscan verse tan profesionales como su trabajo.
- **Beneficio principal**: Da consistencia visual de marca personal en redes, tarjetas y material físico, sin necesitar diseñador propio.
- **Ideal para**: maquillistas freelance, estilistas independientes, colegas de belleza que trabajan por cuenta propia, creadores de contenido de belleza.
- **Nivel de personalización**: Medio (nombre, especialidad y presencia/ausencia de silueta editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Estuches de maquillaje, espejos de bolsillo, tarjetas de presentación, laptops y agendas.
- **Palabras clave SEO**: sticker marca personal, etiqueta maquillista freelance, template estilista independiente, sticker branding personal belleza, packaging marca propia, etiqueta script elegante, template maquillaje freelance, sticker colorista independiente, etiqueta personal brand, template belleza freelance, packaging estuche maquillaje, sticker nombre elegante, etiqueta profesional belleza, template signature style, packaging marca personal beauty, sticker freelance stylist, etiqueta silueta minimalista, template maquillista, packaging personal branding, sticker beauty freelancer.
- **Categoría comercial**: Beauty.
- **Colección**: Beauty & Wellness Collection.
- **Premium Features**: Sistema de script tipográfico curado (no fuente gratuita genérica); silueta opcional reutilizable incluida; layout calibrado para verse elegante con o sin elemento gráfico.
- **Call to Action**: Tu nombre es tu marca — dale la presencia visual que merece.

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

## Template 15 — Identificación de Equipo Industrial

### 1. Concepto
En plantas industriales y talleres, cada máquina requiere trazabilidad física (número de serie, fecha de mantenimiento, responsable asignado) — sin una etiqueta clara y duradera, esa información se pierde o se improvisa a mano, generando riesgo operativo y de cumplimiento. Este template resuelve un problema completamente distinto al resto del catálogo: no es de percepción de marca sino de legibilidad funcional bajo condiciones de uso reales (superficies metálicas, ambientes con grasa/polvo, lectura rápida por personal técnico).

### 2. Dirección de Arte
- **Tipografía**: monoespaciada técnica para todos los campos de datos (recomendado: **JetBrains Mono** o **IBM Plex Mono**, peso 500) — la monoespaciada es funcional aquí, no estética: alinea columnas de datos (ID, fecha) de forma predecible.
- **Paleta**: gris grafito oscuro `#2B2E31`, amarillo de seguridad industrial `#F2C94C`, blanco `#FFFFFF` — el amarillo es un color de convención reconocida en entornos industriales, no una elección decorativa.
- **Estilo**: técnico, funcional, sobrio — cero elementos decorativos; cada elemento gráfico presente cumple una función de lectura.
- **Espaciados**: campos de datos con separación uniforme y predecible (grid estricto), sin espacio negativo decorativo — el espacio aquí se usa para separar campos legibles, no para transmitir calma o lujo.
- **Jerarquía**: 1) identificador/número de serie del equipo (dominante), 2) campos de datos (fecha de instalación, fecha de último mantenimiento, responsable), en grid de igual peso visual entre sí.
- **Alineaciones**: alineación izquierda dentro de cada campo (no centrada) — la alineación izquierda facilita el escaneo rápido de una lista de campos, a diferencia de la composición centrada usada en el resto del catálogo.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ninguna ilustrativa; opcionalmente un pequeño ícono de advertencia estándar solo si el equipo específico lo requiere (campo condicional, no parte fija del diseño base).
- **Texturas**: fondo simulando superficie metálica cepillada (textura sutil, funcional para integrarse visualmente con el equipo real, no decorativa).
- **Estilo visual**: técnico/industrial, bordes duros, sin curvas decorativas.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 2:1.
- **Zonas**: banda superior (identificador/número de serie, banda de alto contraste amarillo/negro), cuerpo inferior (grid de 2-3 campos de datos alineados a la izquierda: fecha de instalación, fecha de mantenimiento, responsable).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — en este template, además de la restricción estándar, se recomienda un margen visual adicional de 2mm en la práctica porque las superficies industriales frecuentemente tienen bordes/tornillos que pueden recortar la zona de aplicación real.
- **Retícula**: grid estricto de filas horizontales, cada campo de dato en su propia fila de altura fija.
- **Proporciones**: la banda superior de identificador ocupa 30% de la altura total, fija, independiente de la longitud del número de serie (los números de serie más largos reducen el tamaño de fuente dentro de esa banda, nunca invaden el cuerpo de campos de datos).

### 4. Elementos
- Identificador/número de serie del equipo
- Fecha de instalación
- Fecha de último mantenimiento
- Nombre o código de responsable asignado
- Opcional: ícono de advertencia estándar (condicional según el equipo)

### 5. Assets necesarios
- 1 textura de superficie metálica cepillada, sutil, tileable
- 1 ícono de advertencia estándar genérico (opcional, solo si aplica al equipo)

### 6. Mockup
Superficie metálica real de una máquina industrial (placa de acero o aluminio con textura cepillada visible), la etiqueta aplicada de forma recta y nivelada, iluminación de planta industrial (más dura y direccional que cualquier mockup anterior del catálogo, con reflejos controlados sobre el metal), sin elementos decorativos de fondo — el contexto es la máquina misma, no un set fotográfico.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo gris grafito sólido — debe comunicar de inmediato "técnico/funcional" solo por la paleta y tipografía monoespaciada, sin necesidad de contexto adicional.

### 8. Prompt para IA
Para la textura de superficie metálica:
> "Brushed metal surface texture, subtle directional brushing pattern, neutral steel or aluminum tone, seamless tileable, low contrast, industrial equipment aesthetic, suitable for a background overlay behind high-contrast technical typography."

### 9. Exportación
- Tamaño final: 80mm × 40mm aprox. (etiqueta rectangular para placa de identificación de equipo).
- Sangrado: 3mm. Área segura: 3mm de margen interno, con recomendación adicional de +2mm de margen visual práctico por posibles obstrucciones de bordes/tornillos en la superficie real de aplicación.
- Recomendación de impresión: vinil industrial resistente a aceites, temperatura y abrasión (material distinto al resto del catálogo, por el entorno de uso); verificar con el proveedor de impresión que el material soporte condiciones de planta.

### 10. Nivel de calidad
Premium en este template no se mide en términos estéticos sino funcionales — el error más común a evitar es priorizar la estética sobre la legibilidad bajo condiciones reales de planta (poca luz, distancia de lectura, superficie sucia). Validación: imprimir una prueba y verificar que el número de serie se lea correctamente a 1 metro de distancia en condiciones de iluminación de planta (no de oficina).

### 11. Commercial Sheet
- **Nombre comercial**: Industrial ID — Etiqueta de Identificación de Equipo
- **Elevator Pitch**: Etiqueta técnica de alto contraste para trazabilidad real de maquinaria y equipo industrial.
- **Beneficio principal**: Reduce errores de mantenimiento y mejora cumplimiento normativo con un sistema de identificación legible y consistente.
- **Ideal para**: plantas industriales, talleres mecánicos, empresas de mantenimiento, gestión de activos/equipo.
- **Nivel de personalización**: Alto (todos los campos de datos son variables por cada pieza de equipo individual — el template está diseñado para producirse en lote con datos distintos por unidad).
- **Tiempo estimado de personalización**: 5 minutos por unidad (una vez configurado el layout base).
- **Dificultad de impresión**: Media (requiere material resistente a condiciones industriales, no el vinil estándar del resto del catálogo).
- **Productos compatibles**: Placas metálicas, superficies de maquinaria, gabinetes eléctricos, tableros de control.
- **Palabras clave SEO**: etiqueta identificación industrial, sticker equipo maquinaria, template placa técnica, etiqueta número de serie, packaging industrial, sticker mantenimiento equipo, etiqueta trazabilidad, template industrial ID, packaging planta industrial, sticker código equipo, etiqueta técnica alto contraste, template gestión de activos, packaging taller mecánico, sticker placa metálica, etiqueta responsable mantenimiento, template equipo industrial, packaging control técnico, sticker identificación maquinaria, etiqueta amarillo seguridad, template placa industrial.
- **Categoría comercial**: Industrial.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Grid de campos de datos ya calibrado para producción en lote con datos variables; textura de superficie metálica incluida; margen práctico adicional documentado para condiciones reales de planta.
- **Call to Action**: Trazabilidad clara empieza con una etiqueta que se lee sin esfuerzo, en cualquier condición de planta.

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

5 de 63 templates completados en este lote (Batch 03: template 2.5 — cierra Cosmetics — templates 3.1 a 3.3 — cierra Beauty en su totalidad — y template 4.1 de Industrial). El template 4.2 (Sello de Calidad Industrial) pasa al Batch 04 junto con el inicio de Warning & Compliance Labels, para no romper el ritmo de lotes de 5 a la mitad de una categoría de solo 2 templates.

Progreso acumulado: 15 de 63 templates completados (Batch 01 + Batch 02 + Batch 03).

**A la espera de aprobación antes de continuar con Batch 04** (Sello de Calidad Industrial — cierra Industrial — + Warning & Compliance Labels completa [3 templates] + el primer template de Retail).
