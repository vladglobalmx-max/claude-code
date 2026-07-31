> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 13 — QR & Smart Labels (cierre) (Templates 61-63 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 61 a 63 de `TEMPLATE_CATALOG_v1.md` — el lote final del catálogo completo de 63 templates.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones, en este último lote. Ningún documento maestro fue tocado (`TEMPLATE_LIBRARY_ARCHITECTURE.md`, `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `ROADMAP_TEMPLATE_SYSTEM.md`, `THOREN_ASSET_PRODUCTION_GUIDE.md`, `THOREN_PRODUCT_STRATEGY.md`, `THOREN_LAUNCH_PLAYBOOK.md`, `THOREN_BUNDLE_STRATEGY.md`, `THOREN_CATALOG_AUDIT_FRAMEWORK.md`). Los 3 templates de este lote comparten la familia Técnico Funcional ya abierta por Menú Digital QR (Batch 12) — la misma restricción real de zona de silencio/contraste de escaneo gobierna el diseño, con paletas propias por caso de uso.

Este lote cierra QR & Smart Labels (19.2-19.4) y, con ello, **completa el catálogo de 63 templates en su totalidad**.

Tras este lote, y según lo acordado, se ejecuta la auditoría integral usando `THOREN_CATALOG_AUDIT_FRAMEWORK.md` ya aprobado — no se espera aprobación intermedia adicional antes de esa auditoría, dado que es el paso ya programado inmediatamente después del cierre del catálogo.

---

## Template 61 — Enlace a Redes Sociales QR

### 1. Concepto
Un negocio con presencia en redes sociales necesita convertir el contacto físico con el producto (empaque, vitrina) en un seguidor digital — un QR bien diseñado en el empaque es más efectivo que pedir verbalmente "síguenos en Instagram", porque elimina la fricción de escribir un usuario manualmente.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Técnico Funcional (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) — misma restricción real de zona de silencio/contraste ya establecida en Menú Digital QR (Template 60).
- **Tipografía**: sans-serif simple (recomendado: **Work Sans**, peso 600) para "Síguenos", en anillo perimetral alrededor del QR.
- **Paleta**: cobre `#9C4E27`, hueso `#F7F5EF`, carbón `#23282B` — paleta neutra ya validada en varios templates agnósticos de industria (Sello de Cierre, Etiqueta Neutral Minimalista), reutilizada aquí porque este template también es agnóstico de tipo de negocio.
- **Estilo**: funcional con calidez de marca — el QR domina, pero el anillo de texto aporta identidad.
- **Espaciados**: zona de silencio del QR respetada con la misma disciplina que Menú Digital QR.
- **Jerarquía**: 1) zona de QR (dominante, con su margen de silencio intacto), 2) anillo perimetral de texto "Síguenos", 3) ícono pequeño de red social (opcional).
- **Alineaciones**: centrada, texto perimetral en círculo completo.
- **Formas**: círculo de troquel.
- **Iconografía**: ícono pequeño de red social genérico (opcional, Nivel 3 del Design Language Guide), nunca superpuesto sobre la zona de QR ni su margen de silencio.
- **Texturas**: ninguna — mismo criterio que Menú Digital QR, cualquier textura arriesga el contraste de escaneo.
- **Estilo visual**: funcional, con anillo de texto como único elemento decorativo.

### 3. Layout
- **Formato**: círculo de 40mm de diámetro.
- **Zonas**: centro (QR con margen de silencio intacto), anillo perimetral (texto "Síguenos" + ícono opcional de red social).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, **más** la zona de silencio propia del QR (misma disciplina de doble restricción ya documentada en Menú Digital QR §3).
- **Retícula**: circular concéntrica — QR central, anillo de texto perimetral.
- **Proporciones**: el QR ocupa el máximo tamaño posible dejando espacio suficiente para el anillo de texto sin comprimir su legibilidad.

### 4. Elementos
- Código QR (generado por el usuario, enlazando a su red social real)
- Texto "Síguenos" (anillo perimetral)
- Ícono pequeño de red social (opcional)

### 5. Assets necesarios
- 1 ícono SVG pequeño de red social genérico (opcional), color plano

### 6. Mockup
Empaque de producto o ventana de tienda con el sticker aplicado, luz de estudio neutra, fondo claro sin props que compitan con el QR.

### 7. Thumbnail
Layout con QR de ejemplo ilustrativo (no funcional) sobre fondo hueso — el anillo "Síguenos" debe leerse con claridad a tamaño de card, dejando explícito que el QR real lo genera el usuario.

### 8. Prompt para IA
Para el ícono opcional de red social:
> "Simple flat-color generic social media icon, clean vector edges, neutral copper or charcoal tone, transparent background, small supporting accent icon designed to sit outside the QR code's quiet zone."

### 9. Exportación
- Tamaño final: 40mm × 40mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno, más la zona de silencio del QR (ver §3).
- Recomendación de impresión: vinil adhesivo mate — **prueba de escaneo física obligatoria antes de producción masiva**, mismo criterio ya establecido en Menú Digital QR.

### 10. Nivel de calidad
Premium aquí, igual que en Menú Digital QR, se mide primero por funcionalidad real de escaneo, después por estética del anillo de texto. El error más común a evitar es un ícono de red social demasiado grande que invada la zona de silencio del QR. Validación obligatoria: escaneo con al menos 2 dispositivos móviles distintos antes de aprobar para producción.

### 11. Commercial Sheet
- **Nombre comercial**: Síguenos QR — Etiqueta de Redes Sociales
- **Elevator Pitch**: Sticker circular con QR que convierte el contacto físico con tu producto en un nuevo seguidor en redes.
- **Beneficio principal**: Elimina la fricción de escribir un usuario manualmente — un escaneo y listo.
- **Ideal para**: cualquier negocio con presencia activa en redes sociales.
- **Nivel de personalización**: Alto (el código QR es único por negocio; texto e ícono editables).
- **Tiempo estimado de personalización**: 10 minutos (incluye generar el QR propio y validar el escaneo).
- **Dificultad de impresión**: Intermedia (requiere reservar la zona de silencio y validar escaneo antes de producción masiva).
- **Productos compatibles**: Empaques de producto, ventanas de tienda, mostradores.
- **Palabras clave SEO**: sticker síguenos qr, etiqueta redes sociales qr, template social media qr, sticker seguir instagram, packaging redes sociales negocio, sticker qr redes, etiqueta síguenos circular, template follow us qr, packaging vitrina redes sociales, sticker código social, etiqueta negocio redes, template qr seguidores, packaging producto redes sociales, sticker escanea síguenos, etiqueta social qr label, template redes sociales sticker, packaging tienda seguidores, sticker qr instagram negocio, etiqueta síguenos escaneo, template social follow sticker.
- **Categoría comercial**: QR & Smart Labels.
- **Colección**: Business Collection.
- **Premium Features**: Reutiliza la paleta neutra ya validada en múltiples templates agnósticos de industria; layout de anillo perimetral calibrado para no invadir la zona de silencio del QR; protocolo de validación de escaneo heredado de Menú Digital QR.
- **Call to Action**: Que cada producto que sale de tu negocio traiga a un nuevo seguidor.

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
□ Prueba de escaneo en dispositivo real

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

## Template 62 — Reseña QR

### 1. Concepto
Las reseñas online son el activo de confianza más valioso para un comercio pequeño, pero pedir una reseña verbalmente rara vez se convierte en acción real — un QR visible en el mostrador o recibo, acompañado de una señal visual de "calificación" reconocible (estrellas), reduce la fricción entre la buena experiencia del cliente y la reseña efectivamente publicada.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Técnico Funcional (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1).
- **Tipografía**: sans-serif de impacto (recomendado: **Archivo Black**, mismo rol ya usado en templates de familia Impacto Comercial, aquí prestado para dar urgencia amable a la invitación) para el texto breve de invitación.
- **Paleta**: amarillo de reseña `#F2C94C`, casi negro `#1A1A1A`, blanco `#FFFFFF` — el amarillo evoca directamente la convención visual de calificación por estrellas.
- **Estilo**: funcional con un guiño directo a la convención de rating ya reconocida universalmente.
- **Espaciados**: zona de silencio del QR respetada con la misma disciplina de los templates anteriores de la categoría.
- **Jerarquía**: 1) zona de QR (dominante), 2) íconos de estrellas junto al QR (refuerzo visual inmediato de "esto es para calificarnos"), 3) texto breve de invitación.
- **Alineaciones**: centrada.
- **Formas**: rectángulo horizontal.
- **Iconografía**: fila de 5 estrellas (Nivel 3 del Design Language Guide, color plano, convención de rating reconocida), ubicadas fuera de la zona de silencio del QR.
- **Texturas**: ninguna.
- **Estilo visual**: funcional, con el ícono de estrellas como refuerzo de propósito inmediato.

### 3. Layout
- **Formato**: rectangular horizontal, 60mm × 40mm.
- **Zonas**: dos tercios izquierdos (QR con margen de silencio intacto), tercio derecho (estrellas + texto breve apilados).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, más la zona de silencio del QR.
- **Retícula**: 2 columnas (QR / estrellas+texto).
- **Proporciones**: las estrellas ocupan un máximo de 40% de la altura de la columna derecha, dejando espacio suficiente para el texto breve debajo.

### 4. Elementos
- Código QR (generado por el usuario, enlazando a su página de reseñas real — Google, Yelp, u otra)
- Fila de 5 estrellas
- Texto breve de invitación (ej. "¿Nos calificas?")

### 5. Assets necesarios
- 1 ícono SVG de estrella (repetido 5 veces), color plano amarillo, convención de rating reconocida

### 6. Mockup
Mostrador de tienda o mesa de restaurante con el sticker aplicado de forma visible, luz de comercio cálida, fondo de mostrador genérico desenfocado.

### 7. Thumbnail
Layout con QR de ejemplo ilustrativo sobre fondo blanco — la fila de estrellas debe ser lo primero que se reconozca a tamaño de card, comunicando el propósito antes de leer el texto.

### 8. Prompt para IA
Para el ícono de estrella:
> "Simple flat-color five-pointed star icon, vivid yellow, clean vector edges, universally recognized rating/review symbol, transparent background, designed to repeat five times in a row."

### 9. Exportación
- Tamaño final: 60mm × 40mm.
- Sangrado: 3mm. Área segura: 3mm de margen interno, más la zona de silencio del QR.
- Recomendación de impresión: vinil adhesivo mate — **prueba de escaneo física obligatoria antes de producción masiva**.

### 10. Nivel de calidad
Premium aquí significa que la invitación se sienta genuina, no como una táctica agresiva de solicitud de reseñas — el error más común a evitar es un texto de invitación que suene a exigencia ("¡Califícanos ahora!") en vez de invitación cordial. Validación funcional: mismo protocolo de escaneo en 2 dispositivos reales ya establecido para toda la categoría QR & Smart Labels.

### 11. Commercial Sheet
- **Nombre comercial**: Reseña QR — Invitación a Calificar tu Negocio
- **Elevator Pitch**: Sticker con QR y estrellas que invita a tus clientes satisfechos a dejar una reseña en el momento justo.
- **Beneficio principal**: Reduce la fricción entre una buena experiencia y una reseña real publicada, aumentando tu prueba social online.
- **Ideal para**: comercios y restaurantes que buscan reseñas online.
- **Nivel de personalización**: Alto (el código QR es único por negocio; texto editable).
- **Tiempo estimado de personalización**: 10 minutos (incluye generar el QR propio y validar el escaneo).
- **Dificultad de impresión**: Intermedia (requiere reservar la zona de silencio y validar escaneo antes de producción masiva).
- **Productos compatibles**: Mostradores de tienda, mesas de restaurante, recibos.
- **Palabras clave SEO**: sticker reseña qr, etiqueta calificación negocio, template review qr, sticker estrellas reseña, packaging mostrador reseñas, sticker qr opinión, etiqueta reseña google, template rating qr sticker, packaging restaurante reseña, sticker calificanos qr, etiqueta review label, template negocio reseñas, packaging mesa reseña, sticker cinco estrellas qr, etiqueta invitación reseña, template comercio calificación, packaging recibo reseña, sticker qr yelp google, etiqueta reseña negocio local, template review invitation.
- **Categoría comercial**: QR & Smart Labels.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Ícono de estrella con convención de rating ya reconocida universalmente; layout de dos columnas calibrado para no comprometer la zona de silencio del QR; protocolo de validación de escaneo consistente con el resto de la categoría.
- **Call to Action**: Convierte cada buena experiencia en una reseña que otros puedan ver.

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
□ Prueba de escaneo en dispositivo real

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

## Template 63 — Tarjeta de Contacto QR

### 1. Concepto
Un profesional independiente en un contexto de networking (el mismo perfil ya cubierto por Marca Personal de Estilista y Sticker de Networking) puede llevar el intercambio de contacto un paso más allá de un ícono memorable: un QR que enlaza directamente a una tarjeta de contacto digital, eliminando la fricción de escribir manualmente un número o correo. Este es, deliberadamente, el template número 63 y último del catálogo — cierra tanto QR & Smart Labels como el catálogo completo.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Técnico Funcional (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1) en su ejecución, con una paleta que conscientemente evoca la disciplina de Lujo Silencioso — coherente con el registro minimalista ya usado en Etiqueta Corporativa Simple y Sticker de Networking, sus vecinos de perfil de cliente.
- **Tipografía**: sans-serif profesional (recomendado: **Work Sans**, peso 500) para nombre/rol, debajo del QR.
- **Paleta**: carbón `#23282B`, hueso `#F7F5EF`, azul grisáceo `#4B6673` — misma familia de paleta corporativa/profesional ya usada en Sello Corporativo, Etiqueta Corporativa Simple y Conferencia/Lanzamiento.
- **Estilo**: minimalista, profesional, funcional.
- **Espaciados**: zona de silencio del QR respetada con la misma disciplina de toda la categoría.
- **Jerarquía**: 1) zona de QR (dominante), 2) nombre/rol (debajo, tipografía pequeña, consistente con el registro de restricción de Lujo Silencioso).
- **Alineaciones**: centrada.
- **Formas**: cuadrado de troquel.
- **Iconografía**: ninguna — Nivel 0, coherente con el minimalismo del registro corporativo/profesional.
- **Texturas**: ninguna.
- **Estilo visual**: funcional y minimalista a la vez — el diseño más silencioso de toda la categoría QR & Smart Labels.

### 3. Layout
- **Formato**: cuadrado de 40mm × 40mm.
- **Zonas**: dos tercios superiores (QR con margen de silencio intacto), tercio inferior (nombre/rol).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, más la zona de silencio del QR.
- **Retícula**: 2 franjas horizontales.
- **Proporciones**: el nombre/rol nunca excede el 34% de la altura total, dejando el QR como elemento dominante.

### 4. Elementos
- Código QR (generado por el usuario, enlazando a su tarjeta de contacto digital real)
- Nombre y rol (texto pequeño debajo)

### 5. Assets necesarios
- Ninguno gráfico — se construye con tipografía y el espacio reservado para el QR generado por el usuario.

### 6. Mockup
Laptop o cuaderno profesional con el sticker aplicado, luz de estudio suave, fondo neutro claro, sin props adicionales — mismo lenguaje de mockup ya usado en Sticker de Networking (Template 35), reforzando la continuidad de perfil de cliente.

### 7. Thumbnail
Layout con QR de ejemplo ilustrativo sobre fondo hueso — nombre/rol deben leerse con claridad profesional a tamaño de card.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía; el QR real lo genera el usuario.

### 9. Exportación
- Tamaño final: 40mm × 40mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno, más la zona de silencio del QR.
- Recomendación de impresión: vinil adhesivo mate — **prueba de escaneo física obligatoria antes de producción masiva**, cerrando la categoría con el mismo estándar de validación funcional aplicado a los 4 templates de QR & Smart Labels.

### 10. Nivel de calidad
Premium aquí es la misma disciplina de restricción ya validada en toda la familia Lujo Silencioso, aplicada sin comprometer la función real del QR — el error más común a evitar sigue siendo el mismo de toda la categoría: sacrificar contraste o zona de silencio por estética. Validación funcional: escaneo en 2 dispositivos reales, el mismo criterio consistente en los 4 templates de QR & Smart Labels.

### 11. Commercial Sheet
- **Nombre comercial**: Contacto QR — Tarjeta de Networking Digital
- **Elevator Pitch**: Sticker minimalista con QR que enlaza directamente a tu tarjeta de contacto digital, para networking sin fricción.
- **Beneficio principal**: Elimina la necesidad de intercambiar contacto manualmente — un escaneo, y tu información ya quedó guardada.
- **Ideal para**: freelancers y profesionales independientes.
- **Nivel de personalización**: Alto (el código QR es único por persona; nombre y rol editables).
- **Tiempo estimado de personalización**: 10 minutos (incluye generar el QR propio y validar el escaneo).
- **Dificultad de impresión**: Intermedia (requiere reservar la zona de silencio y validar escaneo antes de producción masiva).
- **Productos compatibles**: Laptops, cuadernos profesionales, material de networking.
- **Palabras clave SEO**: sticker contacto qr, etiqueta tarjeta digital, template contact qr sticker, sticker networking profesional, packaging tarjeta contacto, sticker qr laptop, etiqueta contacto freelance, template digital business card qr, packaging profesional independiente, sticker qr minimalista, etiqueta networking digital, template tarjeta contacto qr, packaging cuaderno profesional, sticker contacto instantáneo, etiqueta qr profesional, template freelance contact, packaging networking sticker, sticker tarjeta virtual qr, etiqueta contacto minimalista, template digital contact card.
- **Categoría comercial**: QR & Smart Labels.
- **Colección**: Business Collection.
- **Premium Features**: Consistente con la paleta corporativa/profesional ya validada en Sello Corporativo, Etiqueta Corporativa Simple y Conferencia/Lanzamiento; mismo lenguaje de mockup que Sticker de Networking; cierra la categoría QR & Smart Labels con el mismo estándar de validación funcional de los 3 templates anteriores.
- **Call to Action**: Que compartir tu contacto sea tan simple como un escaneo.

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
□ Prueba de escaneo en dispositivo real

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

## Cierre del catálogo completo

3 de 3 templates completados en este lote final (Batch 13: templates 19.2 a 19.4 — cierra QR & Smart Labels en su totalidad).

**Progreso final: 63 de 63 templates completados.** El catálogo de `TEMPLATE_CATALOG_v1.md` queda completamente especificado a nivel de diseño (secciones 1-10), estrategia comercial (sección 11) y control de producción (sección 12), distribuido en 13 documentos de batch (`TEMPLATE_BATCH_01.md` a `TEMPLATE_BATCH_13.md`).

**Siguiente paso, ya acordado**: ejecución de la auditoría integral usando `THOREN_CATALOG_AUDIT_FRAMEWORK.md`, de carácter de validación, no de rediseño, entregada como documento separado inmediatamente después de este cierre.
