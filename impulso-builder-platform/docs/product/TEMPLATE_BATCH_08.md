# Template Batch 08 — Wedding (Templates 36-40 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 36 a 40 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones ni cambios, tal como fue reconfirmado al aprobar Batch 07. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1. Ningún documento maestro (`TEMPLATE_LIBRARY_ARCHITECTURE.md`, `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `ROADMAP_TEMPLATE_SYSTEM.md`, `THOREN_ASSET_PRODUCTION_GUIDE.md`, `THOREN_PRODUCT_STRATEGY.md`, `THOREN_LAUNCH_PLAYBOOK.md`) fue tocado en este lote.

**Continuidad del sistema de color**: los 5 templates de este lote pertenecen a la familia Elegante Personal, la misma ya validada en Sello de Cita — Salón de Belleza (Template 12) y Gracias por tu Preferencia (Template 33) — comparten el mismo principio de tipografía elegante + espacio negativo generoso + ausencia de ilustración figurativa. Wedding introduce el dorado `#D4AF37` como acento característico de la categoría (ausente en Beauty/Business), pero mantiene el rosa antiguo `#B76E79` y el casi-negro `#2B2224` ya usados en esa misma familia — un refinamiento dentro de la familia existente, no una familia nueva.

Este lote completa Wedding en su totalidad (12.1-12.5).

Después de este lote se espera aprobación antes de continuar con el Batch 09. Se recuerda que `THÖREN Bundle Strategy` queda agendado como documento comercial futuro, a producirse aproximadamente en Batch 10 — no antes.

---

## Template 36 — Sello de Sobre de Invitación

### 1. Concepto
La invitación de boda es, para la mayoría de las parejas, el primer objeto físico de diseño que definen para todo el evento — el sello que cierra el sobre es la primera impresión que reciben los invitados, antes incluso de abrir la invitación. Este template existe para que ese primer contacto físico comunique la elegancia formal de la boda desde el sobre mismo, con un sistema de monograma reutilizable en el resto de la papelería del evento.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: script fina y formal (recomendado: **Parisienne** o **Playfair Display Italic**) para las iniciales entrelazadas.
- **Paleta**: dorado `#D4AF37`, blanco `#FFFFFF`, casi negro `#2B2224`.
- **Estilo**: elegante, formal, mínimo — coherente con la disciplina de restricción de toda la familia Elegante Personal, aquí con acento dorado en vez del rosa antiguo de Beauty.
- **Espaciados**: margen de 4mm respecto al área segura, generoso dado el formato pequeño.
- **Jerarquía**: un solo nivel — las iniciales entrelazadas son el único elemento del diseño.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel, pequeño.
- **Iconografía**: ninguna — Nivel 0, las iniciales entrelazadas son tipográficas, no ilustrativas.
- **Texturas**: ninguna — se recomienda simular un efecto de sello de cera solo en el mockup (§6), nunca como textura del propio diseño vectorial.
- **Estilo visual**: tipográfico puro, monograma entrelazado.

### 3. Layout
- **Formato**: círculo de 25mm de diámetro.
- **Zonas**: centro (iniciales entrelazadas), sin zonas secundarias.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: las iniciales ocupan el máximo tamaño legible dentro del área segura.

### 4. Elementos
- Iniciales entrelazadas de la pareja (ej. "M & J")

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía script.

### 6. Mockup
Sobre de invitación formal, el sello aplicado sobre la solapa simulando un sello de cera (efecto de mockup, no del diseño vectorial en sí), luz suave de estudio, superficie de escritorio elegante (madera oscura o mármol claro), sin props adicionales.

### 7. Thumbnail
Sello circular solo sobre fondo blanco sólido — las iniciales deben leerse con elegancia incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía script.

### 9. Exportación
- Tamaño final: 25mm × 25mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo dorado metalizado si el proveedor de impresión lo permite, o vinil mate estándar con el dorado como color plano.

### 10. Nivel de calidad
Premium aquí depende enteramente de la calidad del entrelazado tipográfico — el error más común a evitar es un monograma de plantilla genérica descargada, que se ve igual en miles de bodas. Validación: las iniciales deben sentirse diseñadas específicamente para esta pareja, no un generador automático de monogramas.

### 11. Commercial Sheet
- **Nombre comercial**: Sello Nupcial — Cierre de Sobre de Invitación
- **Elevator Pitch**: Sello elegante de iniciales entrelazadas para cerrar el sobre de tu invitación de boda con la primera impresión que merece.
- **Beneficio principal**: Da consistencia visual desde el primer objeto físico que reciben tus invitados, antes de que abran la invitación.
- **Ideal para**: parejas planeando su boda, wedding planners.
- **Nivel de personalización**: Medio (iniciales de la pareja editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Sobres de invitación, papelería formal de boda.
- **Palabras clave SEO**: sello invitación boda, sticker sobre boda, template monograma boda, etiqueta sello nupcial, packaging invitación elegante, sticker iniciales pareja, etiqueta sello cera boda, template wedding seal, packaging sobre invitación, sticker boda formal, etiqueta monograma pareja, template sello dorado boda, packaging papelería nupcial, sticker cierre sobre, etiqueta invitación elegante, template sello boda circular, packaging wedding planner, sticker sello matrimonio, etiqueta iniciales entrelazadas, template invitación formal.
- **Categoría comercial**: Wedding.
- **Colección**: Wedding Collection.
- **Premium Features**: Sistema de monograma script curado, no genérico; layout calibrado para el formato de sello más pequeño de la categoría; consistente con la familia Elegante Personal ya validada en Beauty.
- **Call to Action**: Que el primer detalle que vean tus invitados ya cuente la historia de su elegancia.

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

## Template 37 — Favor de Boda

### 1. Concepto
El detalle o recuerdo entregado a los invitados (dulces, mini producto) necesita una etiqueta que refuerce la identidad visual de la boda sin competir con el producto que envuelve — a diferencia del Sello de Sobre (Template 36, contacto formal inicial), este template acompaña al invitado después del evento, y por eso incorpora nombres y fecha, no solo iniciales.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: serif elegante (recomendado: **Playfair Display**, peso 500) para los nombres, sans-serif ligera (recomendado: **Work Sans**, peso 300) para la fecha.
- **Paleta**: rosa antiguo `#B76E79`, blanco cálido `#FFF8F5`, dorado `#D4AF37`.
- **Estilo**: elegante, cálido, con un motivo floral sutil en el borde (única concesión a ilustración de todo el lote, y solo como acento perimetral, nunca protagonista).
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) nombres de la pareja (dominante), 2) fecha (más pequeña, debajo), 3) motivo floral perimetral sutil (refuerzo, nunca protagonista).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: motivo floral de línea fina en el borde (Nivel 1 del Design Language Guide) — el único elemento ilustrativo del lote de Wedding, deliberadamente contenido al perímetro.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico con acento floral perimetral de línea fina.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (nombres + fecha), anillo perimetral (motivo floral sutil, sin invadir el centro).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: circular concéntrica.
- **Proporciones**: el motivo floral perimetral ocupa un anillo delgado, máximo 15% del radio total, dejando el 85% central limpio para los nombres.

### 4. Elementos
- Nombres de la pareja
- Fecha de la boda
- Motivo floral sutil en el borde

### 5. Assets necesarios
- 1 ilustración SVG de motivo floral fino, diseñada específicamente para funcionar como anillo perimetral delgado (no como elemento central)

### 6. Mockup
Bolsita de organza con dulces, la etiqueta aplicada en el cierre, luz natural suave, superficie de mesa de banquete elegante (mantel claro), sin props decorativos adicionales.

### 7. Thumbnail
Etiqueta circular sola sobre fondo blanco cálido — los nombres deben leerse con claridad incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el motivo floral perimetral:
> "Delicate thin-line floral motif designed specifically as a thin circular border ring (not a centered illustration), fine consistent stroke weight, no fill, elegant wedding aesthetic, pure black line on transparent background, designed to frame text without competing with it."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí significa que el motivo floral se sienta como un marco discreto, nunca como el elemento que compite por atención con los nombres — el error más común a evitar es un motivo floral demasiado grande o detallado que invada el espacio central. Validación: cubrir el anillo floral con la mano — los nombres y la fecha deben seguir siendo perfectamente legibles y con la misma sensación de elegancia.

### 11. Commercial Sheet
- **Nombre comercial**: Favor Elegante — Etiqueta de Detalle de Boda
- **Elevator Pitch**: Etiqueta circular con nombres y fecha para el detalle que tus invitados se llevan a casa como recuerdo.
- **Beneficio principal**: Extiende la identidad visual de tu boda al detalle que queda con el invitado después del evento.
- **Ideal para**: parejas organizando su boda, wedding planners.
- **Nivel de personalización**: Medio (nombres y fecha editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Bolsitas de organza, cajas de dulces pequeñas, mini productos de recuerdo.
- **Palabras clave SEO**: etiqueta favor de boda, sticker recuerdo boda, template wedding favor, etiqueta dulces boda, packaging detalle invitados, sticker bolsita organza, etiqueta nombres fecha boda, template favor elegante, packaging recuerdo matrimonio, sticker boda floral, etiqueta detalle nupcial, template wedding favor label, packaging dulces invitados, sticker fecha boda, etiqueta motivo floral boda, template recuerdo elegante, packaging favor matrimonio, sticker etiqueta boda circular, etiqueta wedding favor, template detalle boda dulces.
- **Categoría comercial**: Wedding.
- **Colección**: Wedding Collection.
- **Premium Features**: Motivo floral perimetral diseñado específicamente para no competir con el texto central; sistema tipográfico coherente con el resto de la categoría Wedding; layout calibrado para formato de favor de 35mm.
- **Call to Action**: Que el detalle que se llevan tus invitados siga contando tu historia en casa.

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

## Template 38 — Nombres y Fecha — Monograma

### 1. Concepto
A diferencia de los templates 36 y 37 (aplicaciones puntuales), este template es el elemento decorativo central que se repite a lo largo de toda la papelería de la boda — programas de ceremonia, menús, favores — dando consistencia visual entre todos los materiales impresos del evento. Es, en efecto, el "logo temporal" de la boda.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: serif entrelazada para las 2 iniciales (recomendado: **Playfair Display**, tratamiento de monograma clásico), sans-serif ligera para la fecha (recomendado: **Work Sans**, peso 300, tracking amplio).
- **Paleta**: dorado `#D4AF37`, casi negro `#2B2224`, blanco `#FFFFFF`.
- **Estilo**: elegante, atemporal, diseñado para reducirse bien a tamaños pequeños (dado que se reutiliza en múltiples materiales de distinto tamaño).
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) iniciales entrelazadas (dominante), 2) línea decorativa fina, 3) fecha (más pequeña, debajo de la línea).
- **Alineaciones**: centrada.
- **Formas**: **personalizado** — óvalo o silueta de corazón, a elegir como una sola variante consistente por boda (no ambas simultáneamente en el mismo set de materiales).
- **Iconografía**: ninguna más allá del monograma tipográfico — Nivel 0.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro, monograma clásico.

### 3. Layout
- **Formato**: **personalizado** — óvalo o corazón de 40mm × 30mm aprox. (proporción ajustable según la forma elegida).
- **Zonas**: centro superior (iniciales entrelazadas), línea decorativa fina, centro inferior (fecha).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — crítico en la forma de corazón, donde las curvas cóncavas superiores reducen el área útil real disponible respecto a un óvalo simple.
- **Retícula**: eje vertical único, 3 puntos de anclaje (iniciales, línea, fecha).
- **Proporciones**: la línea decorativa ocupa un máximo de 40% del ancho total.

### 4. Elementos
- Iniciales entrelazadas de la pareja
- Línea decorativa fina
- Fecha de la boda

### 5. Assets necesarios
- Ninguno gráfico adicional — se construye con tipografía y una línea vectorial simple; la forma de troquel (óvalo/corazón) es geometría de página, no un asset de ilustración.

### 6. Mockup
Programa de ceremonia doblado, el monograma aplicado en la portada, luz natural suave, superficie de banquete o iglesia desenfocada al fondo, sin props decorativos adicionales.

### 7. Thumbnail
Monograma solo sobre fondo blanco — las iniciales deben leerse con elegancia y la forma (óvalo o corazón) debe ser reconocible incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y la geometría de página (óvalo/corazón), sin ilustración externa.

### 9. Exportación
- Tamaño final: 40mm × 30mm aprox. (óvalo o corazón).
- Sangrado: 3mm. Área segura: 3mm de margen interno — atención especial en la variante corazón por las curvas cóncavas superiores.
- Recomendación de impresión: vinil adhesivo mate o dorado metalizado si el proveedor lo permite; también aplicable como elemento impreso directamente en papel de programas/menús, no solo como sticker.

### 10. Nivel de calidad
Premium aquí significa que el monograma se reduzca bien a cualquier tamaño en que se reutilice en la papelería del evento — el error más común a evitar es un diseño que solo funciona bien a un tamaño específico y pierde legibilidad al reducirse para un menú pequeño. Validación: probar el mismo monograma a 3 tamaños distintos (favor pequeño, programa mediano, invitación grande) — debe seguir siendo elegante y legible en los tres.

### 11. Commercial Sheet
- **Nombre comercial**: Monograma Nupcial — Nombres y Fecha
- **Elevator Pitch**: El monograma central de tu boda, diseñado para repetirse con consistencia en programas, menús y favores.
- **Beneficio principal**: Da una identidad visual coherente a toda la papelería de tu evento, sin diseñar cada pieza por separado.
- **Ideal para**: parejas que buscan consistencia visual en toda su boda, wedding planners.
- **Nivel de personalización**: Medio (iniciales, fecha y forma de troquel — óvalo o corazón — editables).
- **Tiempo estimado de personalización**: 15 minutos.
- **Dificultad de impresión**: Intermedia (la variante corazón requiere mayor atención al área segura por sus curvas cóncavas).
- **Productos compatibles**: Programas de ceremonia, menús, favores, invitaciones, cualquier papelería del evento.
- **Palabras clave SEO**: monograma boda, sticker nombres fecha boda, template monograma nupcial, etiqueta boda óvalo, packaging papelería boda, sticker corazón boda, etiqueta monograma pareja, template wedding monogram, packaging programa ceremonia, sticker menú boda, etiqueta identidad boda, template nombres pareja, packaging consistencia visual boda, sticker monograma dorado, etiqueta corazón elegante, template boda papelería completa, packaging invitación monograma, sticker fecha pareja, etiqueta boda repetible, template monograma clásico.
- **Categoría comercial**: Wedding.
- **Colección**: Wedding Collection.
- **Premium Features**: Sistema de monograma validado para reducirse a múltiples tamaños sin perder legibilidad; 2 formas de troquel disponibles (óvalo/corazón); consistente con el resto de la identidad Wedding del catálogo.
- **Call to Action**: Un solo monograma, presente en cada pieza de tu boda.

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

## Template 39 — Mesa de Dulces

### 1. Concepto
La mesa de dulces de una boda necesita identificar cada postre individualmente para que los invitados sepan qué están tomando (relevante por alergias/preferencias, no solo estética) — pero cada tarjeta debe sentirse parte del mismo sistema elegante que el resto de la papelería del evento, no una etiqueta de precio de panadería.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: serif elegante (recomendado: **Playfair Display**, peso 400) para el nombre del postre.
- **Paleta**: rosa pálido `#F7E9EA`, rosa antiguo `#B76E79`, casi negro `#2B2224`.
- **Estilo**: elegante, funcional (debe pararse verticalmente sobre la mesa), con línea decorativa superior fina.
- **Espaciados**: margen de 3mm respecto al área segura — el formato es una tarjeta pequeña que debe pararse, con menos aire que otros templates de la familia.
- **Jerarquía**: 1) nombre del postre (dominante), 2) línea decorativa fina superior (marco discreto).
- **Alineaciones**: centrada.
- **Formas**: rectángulo vertical, diseñado con una pestaña de plegado en la base para pararse sobre la mesa (nota técnica de producción, no solo diseño plano — similar en espíritu a la faja del jabón artesanal, aunque de complejidad menor).
- **Iconografía**: ninguna — Nivel 0, solo la línea decorativa.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico con línea decorativa fina.

### 3. Layout
- **Formato**: rectangular vertical, 50mm × 70mm (incluyendo la pestaña de plegado en la base para pararse).
- **Zonas**: cuerpo visible (línea decorativa superior + nombre del postre), pestaña de plegado en la base (sin contenido crítico, se pliega hacia atrás).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, aplicado a la zona visible del cuerpo, no a la pestaña de plegado.
- **Retícula**: eje vertical único en el cuerpo visible.
- **Proporciones**: la línea decorativa ocupa un máximo de 50% del ancho del cuerpo visible.

### 4. Elementos
- Nombre del postre (ej. "Macarons de Frambuesa")
- Línea decorativa fina superior
- Pestaña de plegado en la base (elemento técnico, no visible una vez plegada)

### 5. Assets necesarios
- 1 plantilla técnica de troquelado con línea de plegado para la pestaña de base (documento de producción, similar en principio al de la faja de jabón artesanal, pero de menor complejidad — un solo pliegue, no muescas laterales)

### 6. Mockup
Mesa de postres con varias tarjetas paradas junto a distintos dulces, luz natural suave de salón de banquete, mantel claro de fondo, mostrando varias tarjetas del sistema juntas para evidenciar la consistencia entre ellas.

### 7. Thumbnail
Tarjeta sola, de pie, sobre fondo neutro claro — a diferencia de otros templates de Wedding, aquí conviene mostrar la tarjeta parada (no plana) porque su función de pararse es parte de su identidad de producto.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye con tipografía y una línea vectorial simple; la plantilla de plegado es geometría técnica de producción, no un asset ilustrativo.

### 9. Exportación
- Tamaño final: 50mm × 70mm desplegada (incluyendo pestaña de plegado en la base).
- Sangrado: 3mm en el contorno total. Área segura: 3mm de margen interno, aplicado a la zona visible una vez plegada.
- Recomendación de impresión: cartulina o vinil adhesivo sobre cartulina rígida (debe sostenerse de pie por sí sola) — material distinto al vinil flexible estándar del resto del catálogo.

### 10. Nivel de calidad
Premium aquí depende de que el sistema completo (varias tarjetas de distintos postres) se sienta como una sola colección coherente — el error más común a evitar es variar el tamaño de la línea decorativa o la posición del nombre entre tarjetas de la misma boda. Validación: colocar 4-5 tarjetas de distinto postre en fila — deben sentirse producidas por el mismo sistema, solo cambiando el nombre.

### 11. Commercial Sheet
- **Nombre comercial**: Mesa Dulce — Etiquetas para Postres de Boda
- **Elevator Pitch**: Tarjetas elegantes y funcionales que se paran solas para identificar cada postre en la mesa de dulces de tu boda.
- **Beneficio principal**: Da información clara a tus invitados (relevante por alergias/preferencias) sin romper la estética elegante del evento.
- **Ideal para**: parejas y organizadores de la recepción, wedding planners.
- **Nivel de personalización**: Alto (nombre del postre varía por cada tarjeta individual — el template está diseñado para producirse en lote con distintos nombres).
- **Tiempo estimado de personalización**: 5 minutos por tarjeta.
- **Dificultad de impresión**: Intermedia (requiere material rígido y plantilla de plegado para que se sostenga de pie).
- **Productos compatibles**: Mesa de postres, mesa de dulces, buffet de recepción.
- **Palabras clave SEO**: etiqueta mesa de dulces, sticker postres boda, template candy table, etiqueta identificación postre, packaging mesa dulces boda, sticker tarjeta parada, etiqueta nombre postre, template mesa buffet boda, packaging recepción dulces, sticker postre elegante, etiqueta candy bar boda, template tarjeta postre, packaging mesa de dulces, sticker identificación dulces, etiqueta buffet boda, template postres recepción, packaging tarjeta mesa, sticker nombre dulce, etiqueta mesa postres, template candy table wedding.
- **Categoría comercial**: Wedding.
- **Colección**: Wedding Collection.
- **Premium Features**: Plantilla técnica de plegado incluida para que la tarjeta se sostenga de pie; sistema de línea decorativa validado para producción en lote de múltiples postres; material rígido recomendado ya especificado.
- **Call to Action**: Que cada dulce de tu mesa se presente con la misma elegancia que el resto de tu boda.

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

## Template 40 — Agradecimiento de Boda

### 1. Concepto
Después del evento, la pareja envía tarjetas de agradecimiento a sus invitados — el cierre formal y emocional de todo el ciclo de papelería de la boda que este catálogo cubre (desde el Sello de Sobre inicial hasta este agradecimiento final). Este template completa ese ciclo con el mismo lenguaje visual que abrió la experiencia.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: script elegante (recomendado: **Parisienne**, mismo rol tipográfico que el Sello de Sobre, Template 36) para "Gracias".
- **Paleta**: dorado `#D4AF37`, blanco cálido `#FFF8F5`, casi negro `#2B2224`.
- **Estilo**: elegante, emotivo, con motivo floral mínimo (más reducido incluso que el del Favor de Boda, Template 37).
- **Espaciados**: margen de 5mm respecto al área segura.
- **Jerarquía**: 1) texto "Gracias" en script (dominante), 2) motivo floral mínimo (acento, no protagonista).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: motivo floral mínimo de línea fina (Nivel 1), más reducido en presencia que el del Template 37 — un solo elemento pequeño, no un anillo perimetral completo.
- **Texturas**: ninguna.
- **Estilo visual**: script elegante con acento floral mínimo.

### 3. Layout
- **Formato**: círculo de 30mm de diámetro.
- **Zonas**: centro (texto "Gracias" en script), un solo punto con motivo floral mínimo (esquina o base, no anillo completo).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje central único.
- **Proporciones**: el motivo floral ocupa un máximo de 15% del diámetro total, mucho más contenido que el anillo del Favor de Boda.

### 4. Elementos
- Texto "Gracias" en script
- Motivo floral mínimo (un solo elemento pequeño)

### 5. Assets necesarios
- 1 ilustración SVG de un motivo floral mínimo (una sola flor o rama pequeña, no un anillo perimetral completo como el del Template 37)

### 6. Mockup
Tarjeta de agradecimiento con su sobre correspondiente, el sticker aplicado como sello de cierre, luz natural suave, superficie de escritorio elegante, sin props adicionales — cerrando visualmente el mismo tipo de mockup que abrió el lote con el Sello de Sobre de Invitación.

### 7. Thumbnail
Sticker circular solo sobre fondo blanco cálido — el texto "Gracias" debe leerse con elegancia y calidez incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el motivo floral mínimo:
> "Single small delicate thin-line flower or sprig illustration, minimal and understated (smaller and simpler than a full decorative border), fine consistent stroke weight, no fill, elegant wedding aesthetic, pure black line on transparent background, designed as a small accent element, not a dominant illustration."

### 9. Exportación
- Tamaño final: 30mm × 30mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o dorado metalizado si el proveedor lo permite.

### 10. Nivel de calidad
Premium aquí significa que el agradecimiento se sienta genuino y no protocolario — el error más común a evitar es un script demasiado formal/frío que pierda la calidez emocional del momento post-boda. Validación: comparar con el Sello de Sobre (Template 36) — ambos deben sentirse del mismo sistema de marca de la boda, cerrando el ciclo con coherencia.

### 11. Commercial Sheet
- **Nombre comercial**: Gracias Nupcial — Sello de Agradecimiento de Boda
- **Elevator Pitch**: Sticker circular elegante de agradecimiento para las tarjetas que envías a tus invitados después de la boda.
- **Beneficio principal**: Cierra el ciclo de tu identidad visual de boda con la misma elegancia con la que empezó, en el mensaje más personal de todos.
- **Ideal para**: parejas recién casadas enviando tarjetas de agradecimiento.
- **Nivel de personalización**: Bajo (texto de agradecimiento editable entre 2-3 variantes cortas).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Tarjetas de agradecimiento, sobres de correspondencia post-boda.
- **Palabras clave SEO**: sticker agradecimiento boda, etiqueta gracias matrimonio, template thank you wedding, sticker tarjeta agradecimiento, packaging boda post evento, sticker gracias nupcial, etiqueta boda recién casados, template agradecimiento elegante, packaging tarjeta boda gracias, sticker floral agradecimiento, etiqueta gracias invitados, template wedding thank you, packaging correspondencia boda, sticker cierre boda, etiqueta gracias dorado, template tarjeta post boda, packaging agradecimiento matrimonio, sticker boda circular gracias, etiqueta gracias elegante boda, template recién casados gracias.
- **Categoría comercial**: Wedding.
- **Colección**: Wedding Collection.
- **Premium Features**: Motivo floral mínimo diseñado específicamente para complementar sin competir con el texto; consistente con el Sello de Sobre de Invitación, cerrando el ciclo completo de papelería de la boda del catálogo; sistema script curado.
- **Call to Action**: Cierra tu boda con el mismo "gracias" con el que empezaste a compartirla.

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

5 de 63 templates completados en este lote (Batch 08: templates 12.1 a 12.5 — cierra Wedding en su totalidad). El próximo lote inicia Crafts (3 templates) junto con Etsy Sellers (3 templates), tomando 5 de los 6 disponibles entre ambas categorías — el template restante pasa al Batch 10.

Progreso acumulado: 40 de 63 templates completados (Batch 01 a Batch 08).

**A la espera de aprobación antes de continuar con Batch 09** (Crafts completa [3 templates] + 2 de 3 templates de Etsy Sellers).

**Nota de planeación comercial**: se recuerda que `THÖREN Bundle Strategy` queda agendado para producirse aproximadamente en Batch 10, cuando el catálogo alcance masa crítica suficiente — no se adelanta ni se inicia en este lote.
