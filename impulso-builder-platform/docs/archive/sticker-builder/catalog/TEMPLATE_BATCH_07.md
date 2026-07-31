> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 07 — Business + Events (Templates 31-35 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 31 a 35 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones, tal como fue confirmado al aprobar Batch 06. Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

**Nota de continuidad de paleta**: este lote confirma una predicción hecha explícitamente en el Commercial Sheet del Template 25 (Etiqueta Corporativa Simple, Batch 05): "paleta anticipando consistencia con la futura categoría Business". El Sello Corporativo de este lote usa exactamente `#1F2933`/`#FFFFFF`/`#4B6673` — la misma paleta, confirmando que el sistema de color de THÖREN se sostiene entre categorías producidas en lotes distintos, no solo dentro de un mismo lote.

Este lote completa Business en su totalidad (10.1-10.3) y Events en su totalidad (11.1-11.2).

Después de este lote se espera aprobación antes de continuar con el Batch 08.

---

## Template 31 — Sello Corporativo

### 1. Concepto
Una pequeña o mediana empresa necesita un sello circular formal para cerrar sobres, documentos o material impreso corporativo — el equivalente institucional del Sello de Cierre (Template 26), pero con el registro de seriedad que un contexto B2B/corporativo exige, no la neutralidad agnóstica de aquel template. Este template resuelve ese mismo problema de cierre físico con la voz visual propia de la categoría Business.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), variante corporativa — exactamente la misma familia y paleta ya usadas en Etiqueta Corporativa Simple (Template 25), confirmando la coherencia entre lotes.
- **Tipografía**: una sola familia sans-serif profesional (recomendado: **Inter**, peso 600) para el texto perimetral y el monograma/inicial central.
- **Paleta**: gris azulado oscuro `#1F2933`, blanco `#FFFFFF`, azul grisáceo `#4B6673` — idéntica a la Etiqueta Corporativa Simple.
- **Estilo**: formal, institucional, limpio.
- **Espaciados**: anillo perimetral con tracking amplio, margen de 3mm respecto al área segura.
- **Jerarquía**: 1) monograma o inicial de empresa (centro, dominante), 2) anillo perimetral con nombre completo de la empresa.
- **Alineaciones**: centrada, texto perimetral en círculo completo de 360°.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna más allá del monograma tipográfico — Nivel 0, coherente con la familia.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro, sin ilustración.

### 3. Layout
- **Formato**: círculo de 30mm de diámetro.
- **Zonas**: centro (monograma/inicial), anillo perimetral completo (nombre de empresa).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: circular concéntrica.
- **Proporciones**: el monograma ocupa aproximadamente 40% del diámetro total.

### 4. Elementos
- Monograma o inicial de empresa
- Nombre completo de la empresa (anillo perimetral)

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía.

### 6. Mockup
Sobre de papel corporativo, el sello aplicado cerrando la solapa, fondo de escritorio neutro claro, luz de estudio uniforme, sin props adicionales.

### 7. Thumbnail
Sello circular solo sobre fondo blanco sólido — el monograma debe leerse con claridad profesional incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 30mm × 30mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar de oficina/correspondencia.

### 10. Nivel de calidad
Premium aquí significa formalidad sin frialdad — el error más común a evitar es una tipografía corporativa demasiado utilitaria sin ningún peso de personalidad, que se sienta genérica de plantilla de oficina. Validación: comparar con la Etiqueta Corporativa Simple (Template 25) — ambos deben sentirse de la misma familia de seriedad profesional.

### 11. Commercial Sheet
- **Nombre comercial**: Corporate Seal — Sello Corporativo Formal
- **Elevator Pitch**: Sello circular formal para cerrar sobres y documentos con la identidad seria de tu empresa.
- **Beneficio principal**: Da consistencia institucional a cada pieza de correspondencia física que sale de tu negocio.
- **Ideal para**: pequeñas y medianas empresas, despachos profesionales, oficinas corporativas.
- **Nivel de personalización**: Medio (monograma y nombre de empresa editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Sobres corporativos, documentos impresos, carpetas de presentación.
- **Palabras clave SEO**: sello corporativo, sticker sello empresa, template sello formal, etiqueta sello institucional, packaging correspondencia empresa, sticker monograma corporativo, etiqueta sello oficina, template business seal, packaging documento corporativo, sticker sello profesional, etiqueta empresa formal, template sello circular negocio, packaging sobre corporativo, sticker sello seriedad, etiqueta corporate seal, template monograma empresa, packaging correspondencia formal, sticker sello institucional, etiqueta negocio serio, template sello despacho.
- **Categoría comercial**: Business.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta corporativa ya validada en la Etiqueta Corporativa Simple; sistema de anillo perimetral de 360° calibrado para legibilidad en 30mm; cero producción de assets gráficos requerida.
- **Call to Action**: Que cada sobre que envías hable con la seriedad de tu marca.

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

## Template 32 — Tarjeta de Presentación Adhesiva

### 1. Concepto
Un freelancer o pequeño negocio de servicios necesita dejar sus datos de contacto pegados en un lugar donde una tarjeta suelta se perdería — sobre un producto entregado, dentro de una carpeta, en un empaque — combinando el formato reconocible de una tarjeta de presentación clásica con la practicidad de un sticker adhesivo. Este template resuelve ese híbrido específico: información de tarjeta de negocios, formato de sticker.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — misma paleta neutra ya usada en Serum, Etiqueta Neutral Minimalista y Sello de Cierre, cuarta aparición de este sistema de color en el catálogo.
- **Tipografía**: una sola familia sans-serif (recomendado: **Work Sans**, peso 600 para el nombre, 400 para rol/contacto).
- **Paleta**: carbón `#23282B`, hueso `#F7F5EF`, cobre `#9C4E27`.
- **Estilo**: minimalista, profesional, formato de tarjeta clásica adaptado.
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) nombre de la persona/negocio (dominante), 2) rol/especialidad, 3) datos de contacto (más pequeño, al pie).
- **Alineaciones**: alineación izquierda (excepción documentada en `THOREN_DESIGN_LANGUAGE_GUIDE.md` §5.2 — layout tipo tarjeta clásica, información a escanear en orden, no composición centrada decorativa).
- **Formas**: rectángulo horizontal, proporción de tarjeta de presentación estándar.
- **Iconografía**: ninguna — Nivel 0.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro, layout de tarjeta clásica.

### 3. Layout
- **Formato**: rectangular horizontal, proporción 85mm × 55mm (proporción estándar de tarjeta de presentación, adaptada a sticker).
- **Zonas**: bloque superior izquierdo (nombre + rol), bloque inferior izquierdo (datos de contacto), espacio derecho reservado para logo opcional.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 columnas asimétricas (70% información textual a la izquierda, 30% espacio de logo opcional a la derecha).
- **Proporciones**: los datos de contacto ocupan un tamaño de fuente notablemente menor que el nombre, para jerarquía clara de escaneo rápido.

### 4. Elementos
- Nombre de la persona o negocio
- Rol o especialidad
- Datos de contacto (teléfono, email o sitio web)
- Espacio opcional de logo

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía, salvo que el usuario incorpore su propio logo (fuera del alcance de este template).

### 6. Mockup
Superficie de escritorio o carpeta de presentación, el sticker aplicado sobre una esquina visible, luz de estudio suave, fondo neutro claro, sin props decorativos.

### 7. Thumbnail
Tarjeta rectangular sola sobre fondo blanco — el nombre y rol deben leerse con claridad incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 85mm × 55mm.
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar.

### 10. Nivel de calidad
Premium aquí significa que el híbrido "tarjeta + sticker" no se sienta como una tarjeta de presentación genérica escaneada y convertida en sticker — el error más común a evitar es una jerarquía de información desordenada que rompa el escaneo rápido típico de una tarjeta de negocios real. Validación: alguien debe poder identificar nombre, rol y forma de contacto en menos de 3 segundos, en ese orden.

### 11. Commercial Sheet
- **Nombre comercial**: Card Sticker — Tarjeta de Presentación Adhesiva
- **Elevator Pitch**: El formato reconocible de una tarjeta de presentación, en versión sticker, para dejar tus datos donde una tarjeta suelta se perdería.
- **Beneficio principal**: Combina la seriedad de una tarjeta de negocios con la practicidad de pegarse directamente sobre el producto o material entregado.
- **Ideal para**: freelancers, pequeños negocios de servicios, consultores independientes.
- **Nivel de personalización**: Medio (nombre, rol y datos de contacto editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Intermedia (requiere corte preciso al ser un formato rectangular con proporción reconocible de tarjeta).
- **Productos compatibles**: Carpetas, empaques de entrega, superficies de escritorio, productos de servicio entregado.
- **Palabras clave SEO**: tarjeta presentación adhesiva, sticker tarjeta negocio, template business card sticker, etiqueta datos contacto, packaging tarjeta profesional, sticker freelancer contacto, etiqueta tarjeta pegable, template contacto adhesivo, packaging servicio profesional, sticker tarjeta minimalista, etiqueta presentación negocio, template card label, packaging consultor independiente, sticker datos freelance, etiqueta contacto rápido, template tarjeta sticker, packaging entrega servicio, sticker negocio contacto, etiqueta profesional adhesiva, template freelance card.
- **Categoría comercial**: Business.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta neutra validada en Serum, Etiqueta Neutral Minimalista y Sello de Cierre; layout de tarjeta clásica adaptado a formato sticker; jerarquía de escaneo rápido calibrada.
- **Call to Action**: Deja tu contacto donde realmente se va a ver, no en el fondo de una billetera.

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

## Template 33 — Gracias por tu Preferencia

### 1. Concepto
Un negocio de atención directa al cliente (no e-commerce) necesita un sticker de agradecimiento formal para facturas, bolsas o material de atención — el equivalente de negocio B2C físico al "Gracias por tu Compra" de e-commerce (Template 29), pero en un registro elegante en vez de cálido/casual. Este template completa el trío de agradecimientos del catálogo (retail casual, e-commerce cálido, negocio elegante), cada uno en su propia familia de lenguaje visual según el contexto.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — misma familia y paleta cercana a Sello de Cita — Salón de Belleza (Template 12), aplicada aquí a un contexto de negocio formal en vez de belleza.
- **Tipografía**: serif elegante (recomendado: **Playfair Display**, peso 500) para "Gracias por su preferencia" — sin sans de apoyo, el formato es breve y no requiere segundo rol tipográfico.
- **Paleta**: casi negro `#2B2224`, hueso `#F7F5EF`, rosa antiguo `#B76E79`.
- **Estilo**: elegante, sin ilustración, mucho espacio negativo — más cercano en disciplina a Lujo Silencioso que al resto de Elegante Personal, pero con la calidez tipográfica (serif, no sans geométrica) que define esta familia.
- **Espaciados**: margen de 6mm respecto al área segura — generoso, coherente con la ausencia de ilustración.
- **Jerarquía**: un solo nivel — el texto de agradecimiento es el único elemento del diseño.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: ninguna — Nivel 0.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro, sin ilustración.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (texto de agradecimiento, único elemento).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el texto ocupa el máximo tamaño legible dentro del área segura, sin comprimirse.

### 4. Elementos
- Texto de agradecimiento (ej. "Gracias por su preferencia")

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía.

### 6. Mockup
Bolsa de tienda con asas de cordón, el sticker aplicado como cierre o detalle visible, luz de estudio suave, fondo neutro claro, sin props adicionales.

### 7. Thumbnail
Sticker circular solo sobre fondo hueso sólido — el texto debe leerse con elegancia incluso a tamaño de card pequeña.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí depende enteramente de la calidad tipográfica del texto — sin ilustración ni acento gráfico, la serif elegida y su espaciado son el 100% de la percepción de calidad. Validación: comparar con Sello de Cita — Salón de Belleza (Template 12) — ambos deben sentirse de la misma familia de elegancia, aunque uno tenga monograma y este solo tipografía.

### 11. Commercial Sheet
- **Nombre comercial**: Preferencia — Sello de Agradecimiento de Negocio
- **Elevator Pitch**: Sticker circular elegante de agradecimiento para negocios de atención directa al cliente, sin el tono casual de una tienda online.
- **Beneficio principal**: Comunica gratitud formal y refinada en cada punto de contacto físico con el cliente.
- **Ideal para**: comercios de atención directa, boutiques, servicios profesionales con entrega física.
- **Nivel de personalización**: Bajo (texto de agradecimiento editable entre 2-3 variantes).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Facturas, bolsas de tienda, material de atención al cliente.
- **Palabras clave SEO**: sticker gracias preferencia, etiqueta agradecimiento negocio, template thank you formal, sticker elegante gracias, packaging atención cliente, etiqueta gracias elegante, template negocio agradecimiento, packaging boutique gracias, sticker preferencia cliente, etiqueta gratitud formal, template comercio agradecimiento, packaging factura gracias, sticker atención directa, etiqueta gracias negocio, template preferencia elegante, packaging cliente formal, sticker gracias comercio, etiqueta agradecimiento boutique, template negocio elegante, packaging gratitud cliente.
- **Categoría comercial**: Business.
- **Colección**: Beauty & Wellness Collection.
- **Premium Features**: Sistema tipográfico serif curado, sin ilustración; espacio negativo calibrado para percepción de elegancia; layout consistente con Sello de Cita del catálogo de Beauty.
- **Call to Action**: Que el agradecimiento a tu cliente se sienta tan cuidado como tu servicio.

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

## Template 34 — Conferencia / Lanzamiento

### 1. Concepto
Un evento corporativo (conferencia, lanzamiento de producto) necesita una plantilla de identificación temporal que comunique nombre, fecha y lugar con seriedad institucional — el mismo registro que ya define la familia corporativa del catálogo (Sello Corporativo, Etiqueta Corporativa Simple), aplicado ahora a un contexto de evento en vez de identidad permanente de marca.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Lujo Silencioso (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), variante corporativa — misma paleta que Sello Corporativo y Etiqueta Corporativa Simple, tercera aparición de esta paleta en el catálogo.
- **Tipografía**: sans-serif profesional (recomendado: **Inter**, peso 700 para el nombre del evento, 400 para fecha/lugar).
- **Paleta**: gris azulado oscuro `#1F2933`, azul grisáceo `#4B6673`, blanco `#FFFFFF`.
- **Estilo**: formal, institucional, directo.
- **Espaciados**: margen de 4mm respecto al área segura.
- **Jerarquía**: 1) nombre del evento (dominante, arriba), 2) banda inferior con fecha y lugar.
- **Alineaciones**: centrada.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ninguna — Nivel 0, coherente con la familia corporativa.
- **Texturas**: ninguna.
- **Estilo visual**: tipográfico puro.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 2:1.
- **Zonas**: dos tercios superiores (nombre del evento), banda inferior de contraste (fecha y lugar).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 franjas horizontales (66% / 34%).
- **Proporciones**: la banda inferior mantiene un tamaño fijo independiente de la longitud del nombre del evento (nombres largos reducen su propio tamaño de fuente, nunca invaden la banda de fecha/lugar).

### 4. Elementos
- Nombre del evento
- Fecha
- Lugar

### 5. Assets necesarios
- Ninguno gráfico — se construye exclusivamente con tipografía.

### 6. Mockup
Gafete colgante o mesa de registro de evento, el sticker aplicado sobre el gafete o material impreso de la mesa, iluminación de salón de eventos/conferencia, fondo neutro con desenfoque de ambiente corporativo — sin props decorativos adicionales.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco — el nombre del evento debe leerse con claridad institucional a tamaño de card.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía.

### 9. Exportación
- Tamaño final: 90mm × 45mm aprox.
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate, cualquier material estándar de gafete/registro.

### 10. Nivel de calidad
Premium aquí significa comunicar la seriedad de un evento corporativo real, no una plantilla genérica de "evento" descargada de internet — el error más común a evitar es agregar un ícono decorativo de calendario o ubicación que rompa la disciplina tipográfica pura de la familia corporativa. Validación: comparar con Sello Corporativo y Etiqueta Corporativa Simple — los tres deben sentirse de la misma familia institucional.

### 11. Commercial Sheet
- **Nombre comercial**: Summit — Etiqueta de Conferencia y Lanzamiento
- **Elevator Pitch**: Plantilla formal de identificación de evento corporativo, con nombre, fecha y lugar en un layout institucional limpio.
- **Beneficio principal**: Da seriedad profesional inmediata a la identidad temporal de tu conferencia o lanzamiento sin necesitar diseño de marca de evento completo.
- **Ideal para**: organizadores de eventos y conferencias corporativas, empresas lanzando producto.
- **Nivel de personalización**: Medio (nombre del evento, fecha y lugar editables).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Gafetes colgantes, material de mesa de registro, señalización de evento.
- **Palabras clave SEO**: etiqueta conferencia, sticker evento corporativo, template lanzamiento producto, etiqueta gafete evento, packaging conferencia empresa, sticker registro evento, etiqueta fecha lugar evento, template corporate event, packaging lanzamiento corporativo, sticker gafete conferencia, etiqueta evento profesional, template identificación evento, packaging mesa registro, sticker conferencia formal, etiqueta lanzamiento empresa, template evento institucional, packaging gafete colgante, sticker summit evento, etiqueta corporativa evento, template conferencia lanzamiento.
- **Categoría comercial**: Events.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta corporativa validada en Sello Corporativo y Etiqueta Corporativa Simple; banda de datos de tamaño fijo calibrada para nombres de evento de cualquier longitud; cero producción de assets gráficos requerida.
- **Call to Action**: Que la identidad de tu evento se sienta tan seria como lo que vas a anunciar.

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

## Template 35 — Sticker de Networking

### 1. Concepto
Un profesional independiente en un evento de networking necesita un sticker casual de marca personal para intercambiar o pegar en su laptop/cuaderno — más informal que la Tarjeta de Presentación Adhesiva (Template 32, contexto de entrega de servicio) y más gráfico que el Sello de Cita corporativo, porque el contexto de networking premia memorabilidad visual sobre formalidad de datos completos.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Elegante Personal (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), en su registro más gráfico/casual — mismo espíritu que Marca Personal de Estilista (Template 14), aplicado aquí a un contexto profesional general en vez de belleza específicamente.
- **Tipografía**: sans-serif con carácter (recomendado: **Work Sans**, peso 600) para el nombre — sin script, a diferencia de Marca Personal de Estilista, porque el contexto de networking profesional general pide un registro ligeramente más neutro que el de belleza personal.
- **Paleta**: cobre `#9C4E27`, carbón `#23282B`, hueso `#EDEAE2`.
- **Estilo**: casual pero cuidado, memorable.
- **Espaciados**: margen de 3mm respecto al área segura, compacto.
- **Jerarquía**: 1) ilustración/ícono llamativo (dominante, refuerza memorabilidad), 2) nombre, 3) una línea de contacto (redes o sitio web, tipografía pequeña).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: un solo ícono o ilustración llamativa (Nivel 2-3 del Design Language Guide — color plano o gráfico de contraste, elegido según la personalidad del profesional, no un ícono normado del sistema).
- **Texturas**: ninguna.
- **Estilo visual**: gráfico con personalidad, más audaz que el resto de la familia Elegante Personal pero sin llegar al alto contraste de Audaz Gráfico.

### 3. Layout
- **Formato**: círculo de 40mm de diámetro.
- **Zonas**: dos tercios superiores (ilustración/ícono), tercio inferior (nombre + línea de contacto).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: eje vertical único, 2 puntos de anclaje.
- **Proporciones**: el ícono/ilustración ocupa un máximo de 55% del diámetro total.

### 4. Elementos
- Ilustración o ícono llamativo (elegido por el usuario según su personalidad de marca)
- Nombre
- Línea de contacto (red social o sitio web)

### 5. Assets necesarios
- Ninguno provisto por defecto — este template está diseñado para que el usuario incorpore su propio ícono/ilustración de marca personal (a diferencia de otros templates del catálogo con set de íconos incluido); si THÖREN decide producir una versión con set de íconos genéricos incluido, sería una extensión futura, no parte de esta especificación base.

### 6. Mockup
Laptop o cuaderno con el sticker aplicado, luz natural de oficina/café, superficie de escritorio real, sin props decorativos adicionales.

### 7. Thumbnail
Sticker circular solo sobre fondo hueso sólido — el ícono/ilustración debe ser lo primero que capture la atención a tamaño de card, coherente con su función de memorabilidad.

### 8. Prompt para IA
Dado que este template está diseñado para incorporar el ícono propio del usuario, no se provee un prompt de asset por defecto — se recomienda, si el usuario solicita ayuda de generación, adaptar el siguiente prompt base a su personalidad de marca específica:
> "Bold, memorable flat icon or illustration representing [tema/personalidad de marca específica del usuario], clean vector edges, 2-3 flat colors maximum, distinctive and eye-catching for a networking sticker context, transparent background."

### 9. Exportación
- Tamaño final: 40mm × 40mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo mate o satinado.

### 10. Nivel de calidad
Premium aquí se mide por memorabilidad genuina, no por complejidad — el error más común a evitar es un ícono genérico de stock que no comunique nada distintivo sobre la persona. Validación: mostrar el sticker a alguien 3 segundos y preguntar qué recuerda — debe ser el ícono y el nombre, no una impresión vaga de "algo profesional".

### 11. Commercial Sheet
- **Nombre comercial**: Connect — Sticker de Networking Personal
- **Elevator Pitch**: Sticker circular memorable para intercambiar en eventos de networking, con espacio para tu ícono de marca personal y contacto.
- **Beneficio principal**: Deja una impresión visual memorable en segundos, mucho más efectivo que entregar una tarjeta que se pierde en un bolsillo.
- **Ideal para**: profesionales independientes, miembros de comunidades y meetups, creadores de contenido profesional.
- **Nivel de personalización**: Alto (ícono/ilustración, nombre y línea de contacto totalmente personalizables por el usuario).
- **Tiempo estimado de personalización**: 15 minutos (incluye incorporar el ícono propio).
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Laptops, cuadernos, credenciales de evento, merchandising personal.
- **Palabras clave SEO**: sticker networking, etiqueta marca personal profesional, template evento networking, sticker laptop profesional, packaging meetup personal, sticker contacto redes, etiqueta networking evento, template sticker memorable, packaging comunidad profesional, sticker personal brand networking, etiqueta profesional independiente, template conexión evento, packaging sticker laptop, sticker meetup contacto, etiqueta marca personal redes, template networking circular, packaging profesional creativo, sticker evento comunidad, etiqueta contacto memorable, template personal branding event.
- **Categoría comercial**: Events.
- **Colección**: Business Collection.
- **Premium Features**: Sistema de layout calibrado para máxima memorabilidad en formato pequeño; flexible para cualquier ícono de marca personal del usuario; consistente con la familia Elegante Personal ya validada en Marca Personal de Estilista.
- **Call to Action**: Que te recuerden por tu sticker antes de que busquen tu tarjeta.

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

5 de 63 templates completados en este lote (Batch 07: templates 10.1 a 10.3 — cierra Business en su totalidad — y templates 11.1 y 11.2 — cierra Events en su totalidad). El próximo lote inicia la categoría Wedding (5 templates), completando el lote exacto sin necesidad de tomar templates de otra categoría.

Progreso acumulado: 35 de 63 templates completados (Batch 01 a Batch 07).

**A la espera de aprobación antes de continuar con Batch 08** (Wedding completa [5 templates]).
