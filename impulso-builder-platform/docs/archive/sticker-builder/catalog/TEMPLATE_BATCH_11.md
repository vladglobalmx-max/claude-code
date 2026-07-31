> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 11 — Education (cierre) + Holiday (parcial) (Templates 51-55 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 51 a 55 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura**: las 12 secciones congeladas se mantienen exactamente, sin adiciones. Ningún documento maestro fue tocado en este lote (`TEMPLATE_LIBRARY_ARCHITECTURE.md`, `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `ROADMAP_TEMPLATE_SYSTEM.md`, `THOREN_ASSET_PRODUCTION_GUIDE.md`, `THOREN_PRODUCT_STRATEGY.md`, `THOREN_LAUNCH_PLAYBOOK.md`, `THOREN_BUNDLE_STRATEGY.md`). Cada template referencia su familia de `THOREN_DESIGN_LANGUAGE_GUIDE.md` §1.

**Nota de familia**: la Etiqueta de Útiles Escolares (Education) continúa el registro infantil/lúdico de Audaz Gráfico ya establecido en Batch 10. Los 4 templates de Holiday de este lote introducen un registro **festivo/estacional** dentro de la misma familia Audaz Gráfico — mismo principio rector ("alto contraste, sin miedo al espacio ocupado, personalidad de marca fuerte"), aplicado aquí a motivos culturales/festivos de temporada en vez de contexto infantil, con paletas propias por festividad en vez de una sola paleta compartida. Es el mismo patrón ya usado 4 veces (Wedding en Elegante Personal, 3 registros en Crafts dentro de Artesanal Cálido, infantil/lúdico en Audaz Gráfico) — ninguna familia nueva, un registro más dentro de una ya existente.

Este lote cierra Education (16.2) y avanza 4 de los 5 templates de Holiday (17.1-17.4) — el quinto (17.5, San Valentín) pasa al Batch 12 junto con Seasonal.

Después de este lote se espera aprobación antes de continuar con el Batch 12. Se recuerda que al finalizar Batch 13 está programada la auditoría integral del catálogo (cobertura, consistencia visual, estrategia comercial, preparación para producción) — de carácter de validación, no de rediseño.

---

## Template 51 — Etiqueta de Útiles Escolares

### 1. Concepto
Cada inicio de ciclo escolar, padres y escuelas etiquetan decenas de artículos (cuadernos, lápices, loncheras) para evitar pérdidas y confusión entre compañeros — una etiqueta de nombre necesita ser legible a distancia y resistente al manejo diario de un niño, más que decorativa.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro infantil/lúdico — mismo registro ya establecido en Batch 10 para Kids y el Sello "Buen Trabajo".
- **Tipografía**: sans-serif redondeada y muy legible (recomendado: **Fredoka**, peso 600) para el nombre — la legibilidad prevalece sobre la personalidad decorativa en este template específico.
- **Paleta**: azul vivo `#2F80ED`, blanco `#FFFFFF`, amarillo vivo `#F2C94C`.
- **Estilo**: alegre pero funcional — coherente con el uso repetitivo de alto volumen (se produce una etiqueta por cada artículo escolar del niño).
- **Espaciados**: margen de 3mm respecto al área segura, compacto.
- **Jerarquía**: 1) nombre del estudiante (dominante), 2) ícono pequeño de útil escolar (refuerzo, nunca protagonista).
- **Alineaciones**: centrada.
- **Formas**: rectángulo horizontal.
- **Iconografía**: un ícono pequeño de útil escolar genérico (lápiz, libro — Nivel 2-3 del Design Language Guide, color plano), nunca más de uno.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico de alto contraste, colores vivos, ícono pequeño de apoyo.

### 3. Layout
- **Formato**: rectangular horizontal, 50mm × 20mm.
- **Zonas**: espacio dominante izquierdo (nombre del estudiante), espacio pequeño derecho (ícono de útil escolar).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 2 columnas (80% nombre / 20% ícono).
- **Proporciones**: el ícono nunca excede el 20% del ancho total, para que el nombre siga siendo el elemento dominante y de mayor legibilidad.

### 4. Elementos
- Nombre del estudiante (editable, alta prioridad de legibilidad)
- Ícono pequeño de útil escolar (lápiz, libro, u otro genérico)

### 5. Assets necesarios
- 1 ícono SVG pequeño de útil escolar genérico (lápiz o libro), color plano, estilo consistente con el registro infantil/lúdico

### 6. Mockup
Cuaderno escolar con la etiqueta aplicada en la portada, luz de escritorio/salón de clases, fondo de útiles escolares desenfocados (lápices, mochila) como contexto.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco — el nombre debe leerse con claridad incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el ícono de útil escolar:
> "Simple flat-color icon of a pencil or book, rounded friendly style, vivid blue or yellow color, high contrast, cheerful school supplies aesthetic, transparent background, small supporting accent icon."

### 9. Exportación
- Tamaño final: 50mm × 20mm.
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo resistente a manipulación frecuente y humedad (uso diario en loncheras/cuadernos), acabado mate o brillante.

### 10. Nivel de calidad
Premium aquí significa legibilidad a prueba de manejo diario infantil — el error más común a evitar es un nombre en tipografía demasiado decorativa que sacrifique legibilidad por estilo. Validación: imprimir a tamaño real y verificar que el nombre se lee sin esfuerzo a la distancia típica de un maestro revisando útiles en el salón.

### 11. Commercial Sheet
- **Nombre comercial**: Mi Nombre — Etiqueta de Útiles Escolares
- **Elevator Pitch**: Etiqueta alegre y legible para identificar cuadernos, lápices y loncheras de tu hijo en la escuela.
- **Beneficio principal**: Evita pérdidas y confusiones entre compañeros con una etiqueta resistente al manejo diario.
- **Ideal para**: padres de familia, escuelas.
- **Nivel de personalización**: Alto (nombre del estudiante varía por cada niño — el template está diseñado para producirse en lote con distintos nombres).
- **Tiempo estimado de personalización**: 3 minutos por etiqueta.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Cuadernos, lápices, loncheras, mochilas, cualquier útil escolar.
- **Palabras clave SEO**: etiqueta útiles escolares, sticker nombre niño, template etiqueta escolar, sticker identificación cuaderno, packaging vuelta a clases, sticker nombre lonchera, etiqueta escolar personalizada, template school supplies label, packaging útiles escolares, sticker nombre estudiante, etiqueta cuaderno nombre, template etiqueta identificación, packaging regreso a clases, sticker lápiz nombre, etiqueta mochila escolar, template nombre útiles, packaging escuela primaria, sticker etiqueta niño, etiqueta identificación escolar, template vuelta clases nombre.
- **Categoría comercial**: Education.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Sistema de nombre calibrado para máxima legibilidad de uso diario; ícono de apoyo consistente con el registro infantil de Kids/Education; formato pensado para producción en lote de múltiples nombres.
- **Call to Action**: Que cada útil escolar diga, sin dudas, a quién pertenece.

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

## Template 52 — Navidad Clásica

### 1. Concepto
La temporada navideña es la ventana de mayor volumen de venta de producto de regalo/empaque de todo el año para comercios pequeños — un sticker navideño necesita comunicar la festividad de inmediato, con la iconografía tradicional que el comprador ya reconoce (rama de pino, estrella), sin necesitar explicación.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional (ver nota de familia al inicio del documento).
- **Tipografía**: sin texto obligatorio — el motivo navideño funciona solo; si se incluye texto (ej. "Feliz Navidad"), usar serif clásica ligera (recomendado: **Playfair Display**, peso 500) para mantener elegancia festiva sin caer en lo infantil.
- **Paleta**: rojo navideño `#B31F1F`, verde pino `#1E5631`, dorado `#D4AF37`.
- **Estilo**: festivo, tradicional, reconocible al instante.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: 1) motivo navideño (rama de pino o estrella, dominante), 2) texto opcional pequeño.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: un motivo navideño (rama de pino o estrella — Nivel 2-3 del Design Language Guide, color plano con detalle moderado), uno solo por versión.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico festivo de color plano, paleta tradicional roja/verde/dorada.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (motivo navideño, dominante), base (texto opcional, si aplica).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el motivo navideño ocupa un mínimo de 70% del diámetro total.

### 4. Elementos
- Motivo navideño (rama de pino o estrella, una sola variante por versión)
- Texto opcional corto (ej. "Feliz Navidad")

### 5. Assets necesarios
- 1 ilustración SVG de rama de pino navideña, y 1 alternativa de estrella navideña (el usuario elige una, no ambas), color plano con acentos dorados

### 6. Mockup
Regalo envuelto con listón navideño, el sticker aplicado sobre el envoltorio, luz cálida de temporada (tonos dorados), superficie de mesa festiva con elementos navideños desenfocados al fondo.

### 7. Thumbnail
Sticker circular solo sobre fondo blanco o rojo — el motivo debe ser inmediatamente reconocible como navideño a tamaño de card.

### 8. Prompt para IA
Para el motivo de rama de pino:
> "Flat, festive illustration of a classic pine branch with a small red bow accent, warm traditional Christmas color palette (deep red, pine green, gold accents), clean vector edges, no gradients, transparent background, recognizable classic holiday sticker aesthetic."

Para el motivo alternativo de estrella navideña:
> "Flat festive Christmas star illustration, gold and warm accent details, clean vector edges, traditional holiday sticker aesthetic, transparent background."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo brillante o metalizado dorado si el proveedor lo permite (refuerza la sensación festiva de temporada).

### 10. Nivel de calidad
Premium aquí significa un motivo navideño que se sienta curado y no genérico de clip-art de temporada descargado masivamente — el error más común a evitar es un ícono demasiado detallado/fotorrealista que pierda impacto a tamaño de sticker pequeño. Validación: el motivo debe reconocerse como navideño en menos de 1 segundo, incluso a tamaño reducido.

### 11. Commercial Sheet
- **Nombre comercial**: Navidad Clásica — Sticker Festivo de Temporada
- **Elevator Pitch**: Sticker circular tradicional con motivo navideño reconocible, listo para la temporada de mayor venta del año.
- **Beneficio principal**: Da presencia festiva instantánea a tu empaque o producto de temporada navideña, sin necesitar diseño de temporada contratado cada año.
- **Ideal para**: comercios y particulares en temporada decembrina.
- **Nivel de personalización**: Bajo (elección entre 2 motivos — pino o estrella — y texto opcional).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Regalos envueltos, empaques de producto de temporada, cajas navideñas.
- **Palabras clave SEO**: sticker navidad, etiqueta navideña, template christmas sticker, sticker regalo navidad, packaging temporada navideña, sticker pino navideño, etiqueta estrella navidad, template navidad clásica, packaging regalo diciembre, sticker feliz navidad, etiqueta navideña tradicional, template holiday sticker, packaging navidad comercio, sticker rama pino, etiqueta navidad dorada, template temporada decembrina, packaging regalo festivo, sticker navideño circular, etiqueta navidad roja verde, template christmas classic.
- **Categoría comercial**: Holiday.
- **Colección**: Holiday Collection.
- **Premium Features**: 2 motivos navideños curados incluidos (pino y estrella); paleta tradicional validada para reconocimiento instantáneo; consistente con el registro festivo/estacional de la familia Audaz Gráfico.
- **Call to Action**: Dale a tu producto la magia de la temporada que todos reconocen de inmediato.

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

## Template 53 — Año Nuevo

### 1. Concepto
La celebración de fin de año necesita un lenguaje visual distinto de la Navidad (más sobrio y elegante, tonos negro/dorado en vez de rojo/verde) para no confundirse en el mismo empaque o evento — comercios y organizadores de brindis de fin de año necesitan esta distinción clara de temporada.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional — paleta propia, deliberadamente distinta de Navidad Clásica para diferenciar ambas festividades de diciembre.
- **Tipografía**: display de impacto para el año (recomendado: **Anton**, mismo rol tipográfico ya usado en Cerveza Artesanal, reforzando la sensación de celebración audaz) — el año es editable cada temporada.
- **Paleta**: casi negro `#1A1A1A`, dorado `#D4AF37`, blanco `#FFFFFF`.
- **Estilo**: elegante-festivo, más sobrio que Navidad, con destellos dorados.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: 1) año (dominante, editable), 2) confeti/destellos dorados de fondo (refuerzo).
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: confeti o destellos dorados de fondo (Nivel 2-3 del Design Language Guide), siempre detrás del año, nunca compitiendo con su legibilidad.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico festivo de alto contraste negro/dorado.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro (año, dominante), fondo completo (confeti/destellos dorados).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: el año ocupa un mínimo de 50% del diámetro total, independiente de si tiene 4 dígitos (siempre los tiene, pero el layout debe validarse para no comprimirse en años con dígitos visualmente más anchos).

### 4. Elementos
- Año (editable cada temporada, ej. "2027")
- Confeti o destellos dorados de fondo

### 5. Assets necesarios
- 1 ilustración SVG de confeti/destellos dorados, diseñada para funcionar como fondo sin competir con texto grande superpuesto

### 6. Mockup
Copa o botella de brindis de fin de año, el sticker aplicado sobre el empaque o directamente en la copa (si el material lo permite), luz de estudio con reflejos dorados, fondo oscuro elegante de celebración nocturna.

### 7. Thumbnail
Sticker circular solo sobre fondo negro — el contraste dorado/negro debe ser evidente incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el confeti/destellos dorados de fondo:
> "Flat gold confetti and sparkle illustration, designed to sit as a background layer behind large bold text without competing with it, elegant New Year's celebration aesthetic, black and gold color scheme, transparent background."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo metalizado dorado si el proveedor lo permite, o vinil mate/brillante estándar con el dorado como color plano.

### 10. Nivel de calidad
Premium aquí significa que el confeti de fondo refuerce sin competir con el año — el error más común a evitar es un fondo de confeti tan denso que reduzca la legibilidad del número. Validación: el año debe leerse instantáneamente incluso con el fondo de confeti activo, sin que el ojo dude entre ambos elementos.

### 11. Commercial Sheet
- **Nombre comercial**: Año Nuevo — Sticker de Celebración de Fin de Año
- **Elevator Pitch**: Sticker circular elegante negro y dorado para celebrar la llegada del nuevo año en tu producto o evento.
- **Beneficio principal**: Se diferencia claramente de la estética navideña, permitiendo usar ambos stickers de temporada sin confusión visual.
- **Ideal para**: comercios y organizadores de eventos de fin de año.
- **Nivel de personalización**: Medio (año editable cada temporada).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Copas y botellas de brindis, invitaciones de fin de año, empaques de temporada.
- **Palabras clave SEO**: sticker año nuevo, etiqueta fin de año, template new year sticker, sticker celebración año nuevo, packaging brindis fin de año, sticker confeti dorado, etiqueta año nuevo elegante, template new year celebration, packaging fiesta fin de año, sticker año editable, etiqueta brindis nochevieja, template celebración diciembre, packaging copa brindis, sticker negro dorado fiesta, etiqueta destellos año nuevo, template fin de año elegante, packaging evento diciembre, sticker celebración nocturna, etiqueta año nuevo circular, template new year gold.
- **Categoría comercial**: Holiday.
- **Colección**: Holiday Collection.
- **Premium Features**: Paleta negro/dorado deliberadamente distinta de Navidad Clásica para coexistir sin confusión; sistema de confeti de fondo calibrado para no competir con el texto; tipografía de impacto ya validada en Cerveza Artesanal.
- **Call to Action**: Que tu celebración de fin de año brille con su propia identidad.

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

## Template 54 — Día de Muertos

### 1. Concepto
El Día de Muertos es una celebración cultural mexicana con un lenguaje visual propio y respetado (calavera decorada estilo papel picado, flor de cempasúchil) — un sticker de esta temporada necesita honrar esa estética tradicional con autenticidad, no reducirla a un motivo genérico de "Halloween mexicano". Este es el primer template del catálogo con troquel de forma completamente ilustrativa (silueta de calavera), no una forma geométrica simple.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional, con la mayor riqueza de detalle ilustrativo permitida en este registro — justificado porque la estética de papel picado depende de patrones internos detallados para ser reconocible como tal, no como una calavera genérica.
- **Tipografía**: sin texto obligatorio — el motivo ilustrativo es autosuficiente; si se incluye texto, usar una serif con carácter mexicano/festivo (a definir en producción real con curaduría cultural apropiada, no una fuente genérica "mexicana" estereotipada).
- **Paleta**: naranja cempasúchil `#F2994A`, morado vivo `#9B51E0`, casi negro `#1A1A1A`.
- **Estilo**: cultural, vibrante, decorado — estilo papel picado con patrones florales internos.
- **Espaciados**: margen de 3mm respecto al área segura, medido desde el contorno más externo de la silueta de calavera (la zona de mayor riesgo de corte, dado lo irregular de la forma).
- **Jerarquía**: un solo nivel — la calavera decorada es el diseño completo.
- **Alineaciones**: centrada.
- **Formas**: **personalizado** — silueta de calavera decorada o, alternativamente, flor de cempasúchil (el usuario elige una variante, no ambas en el mismo template).
- **Iconografía**: patrón decorativo interno estilo papel picado (flores, líneas ornamentales) dentro de la silueta — Nivel 3-4 del Design Language Guide, el nivel de detalle más alto permitido en el registro festivo/estacional.
- **Texturas**: ninguna adicional al patrón decorativo interno, que ya cumple esa función.
- **Estilo visual**: ilustrativo cultural, patrón interno decorativo, paleta vibrante.

### 3. Layout
- **Formato**: **personalizado** — silueta de calavera decorada, aproximadamente 40mm × 45mm (proporción natural de la forma, no un rectángulo/círculo contenedor).
- **Zonas**: la silueta completa es una sola zona ilustrativa, sin subdivisión de texto/ícono como el resto del catálogo.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno, medida desde el contorno de la silueta — dado que la forma es irregular, se recomienda validar visualmente que ningún detalle decorativo fino quede en la zona de riesgo de corte, no solo verificar la medida numérica.
- **Retícula**: no aplica — la retícula es la geometría propia de la silueta ilustrativa.
- **Proporciones**: los patrones decorativos internos deben mantener un grosor de línea mínimo verificado contra la resolución de impresión de §9, para no perderse en la reproducción física.

### 4. Elementos
- Silueta de calavera decorada estilo papel picado (o alternativa de flor de cempasúchil)
- Patrón decorativo interno (flores, líneas ornamentales)

### 5. Assets necesarios
- 1 ilustración SVG de calavera decorada estilo papel picado, y 1 alternativa de flor de cempasúchil — ambas con curaduría cultural apropiada en la etapa de producción real (`THOREN_ASSET_PRODUCTION_GUIDE.md` Etapa 2), no una generación automática sin revisión humana de autenticidad cultural

### 6. Mockup
Ofrenda o producto artesanal de temporada, el sticker aplicado sobre empaque de producto conmemorativo, luz cálida de temporada con tonos naranja/morado, superficie con elementos tradicionales de ofrenda desenfocados al fondo (papel picado, veladoras) — contexto cultural respetuoso, no genérico de "Halloween".

### 7. Thumbnail
Silueta completa sola sobre fondo blanco — el patrón decorativo debe ser reconocible como papel picado incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la silueta de calavera decorada:
> "Traditional Mexican Día de Muertos decorated skull illustration in papel picado (cut paper) style, intricate internal floral and ornamental pattern, vibrant orange and purple color palette, culturally authentic and respectful representation (not a generic Halloween skull), clean vector edges suitable for die-cut sticker production, transparent background. Requires human cultural review before production use."

Para la alternativa de flor de cempasúchil:
> "Traditional cempasúchil (marigold) flower illustration in a decorative papel picado-inspired style, vibrant orange petals, clean vector edges, culturally authentic Día de Muertos aesthetic, transparent background. Requires human cultural review before production use."

### 9. Exportación
- Tamaño final: aprox. 40mm × 45mm (silueta, proporción natural de la forma).
- Sangrado: 3mm. Área segura: 3mm de margen interno, con verificación visual adicional recomendada dada la irregularidad de la silueta (ver §3).
- Recomendación de impresión: vinil adhesivo mate o brillante; troquelado de precisión requerido dada la complejidad de la silueta (más exigente que un círculo o rectángulo estándar).

### 10. Nivel de calidad
Premium aquí depende de la autenticidad cultural del motivo, no solo de la ejecución técnica — el error más grave posible en este template sería una representación estereotipada o culturalmente inexacta disfrazada de "festiva". Validación obligatoria: revisión por alguien con conocimiento cultural genuino de la tradición antes de aprobar el asset final para producción — este es el único template del catálogo hasta ahora donde la validación de "Nivel de calidad" incluye explícitamente un criterio no solo estético sino de respeto cultural.

### 11. Commercial Sheet
- **Nombre comercial**: Día de Muertos — Sticker Conmemorativo Cultural
- **Elevator Pitch**: Sticker de calavera decorada estilo papel picado, con la autenticidad y respeto que merece esta tradición.
- **Beneficio principal**: Da presencia cultural genuina a tu producto o evento de temporada, sin caer en representaciones genéricas o estereotipadas.
- **Ideal para**: comercios mexicanos y de la diáspora, eventos culturales.
- **Nivel de personalización**: Bajo (elección entre calavera o cempasúchil).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Intermedia (troquelado de silueta irregular requiere precisión).
- **Productos compatibles**: Ofrendas, productos artesanales de temporada, empaques conmemorativos.
- **Palabras clave SEO**: sticker día de muertos, etiqueta calavera decorada, template dia de los muertos, sticker papel picado, packaging ofrenda mexicana, sticker cempasúchil, etiqueta calavera mexicana, template cultural mexicano, packaging temporada día muertos, sticker calavera papel picado, etiqueta flor cempasúchil, template ofrenda producto, packaging día de muertos comercio, sticker tradición mexicana, etiqueta calavera colorida, template evento cultural mexicano, packaging conmemorativo día muertos, sticker skull mexicano, etiqueta día de muertos auténtico, template calavera festiva.
- **Categoría comercial**: Holiday.
- **Colección**: Holiday Collection.
- **Premium Features**: Primer troquel de silueta completamente ilustrativa del catálogo; proceso de validación cultural explícito documentado como parte del estándar de calidad; 2 motivos disponibles (calavera y cempasúchil).
- **Call to Action**: Honra la tradición con un diseño que la representa con el respeto que merece.

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
□ Revisión de autenticidad cultural (criterio adicional específico de este template)

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

## Template 55 — Halloween

### 1. Concepto
Halloween es una temporada de venta importante para negocios de dulces y productos infantiles/familiares — a diferencia de una estética de terror genuina, el mercado de este catálogo (regalos, familias, comercios) necesita un Halloween "divertido, no de miedo real", coherente con el registro festivo/estacional del resto de Holiday.

### 2. Dirección de Arte
- **Familia de lenguaje visual**: Audaz Gráfico (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1), registro festivo/estacional.
- **Tipografía**: sin texto obligatorio — el motivo ilustrativo funciona solo; si se incluye texto, usar sans-serif redondeada amigable (recomendado: **Fredoka**), nunca una tipografía de terror/gótica.
- **Paleta**: naranja Halloween `#E67E22`, morado `#6C3483`, casi negro `#1A1A1A`.
- **Estilo**: divertido, no alarmante — explícitamente lo opuesto de una estética de terror genuina.
- **Espaciados**: margen de 3mm respecto al área segura.
- **Jerarquía**: un solo nivel — la ilustración es el diseño completo.
- **Alineaciones**: centrada.
- **Formas**: círculo de troquel.
- **Iconografía**: calabaza o fantasma ilustrado de forma amigable (Nivel 2-3 del Design Language Guide, color plano con expresión simpática), uno solo por versión.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico festivo de color plano, expresión amigable en el motivo.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: centro completo ocupado por la ilustración.
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: un solo punto de anclaje central.
- **Proporciones**: la ilustración ocupa un mínimo de 75% del diámetro total.

### 4. Elementos
- Ilustración de calabaza o fantasma amigable (una sola variante por versión)

### 5. Assets necesarios
- 1 ilustración SVG de calabaza con expresión amigable, y 1 alternativa de fantasma amigable (el usuario elige una, no ambas), color plano, estilo consistente con el registro festivo del catálogo

### 6. Mockup
Bolsa de dulces de Halloween, el sticker aplicado como cierre, luz de estudio brillante y alegre (nunca oscura/tenebrosa — coherente con el tono no alarmante), fondo con elementos de temporada desenfocados (calabazas decorativas genéricas).

### 7. Thumbnail
Sticker circular solo sobre fondo blanco o naranja — la expresión amigable del motivo debe ser evidente incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para la ilustración de calabaza amigable:
> "Flat, friendly, non-scary jack-o'-lantern illustration with a cheerful expression, vivid orange and purple color palette, clean vector edges, playful Halloween sticker aesthetic (fun, not frightening), transparent background."

Para la ilustración alternativa de fantasma amigable:
> "Flat, friendly, non-scary ghost illustration with a cheerful expression, simple rounded shape, vivid purple accent, clean vector edges, playful Halloween sticker aesthetic, transparent background."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo brillante o mate.

### 10. Nivel de calidad
Premium aquí significa mantener el diseño genuinamente divertido, nunca alarmante — el error más común a evitar es una expresión facial ambigua que pueda leerse como amenazante en vez de simpática, especialmente relevante dado que el público incluye niños. Validación: mismo criterio que Personaje Divertido (Template 48) — mostrar el motivo y preguntar si se ve "simpático", nunca "de miedo".

### 11. Commercial Sheet
- **Nombre comercial**: Halloween Divertido — Sticker Festivo de Temporada
- **Elevator Pitch**: Sticker circular alegre y no alarmante para la temporada de Halloween, perfecto para dulces y productos familiares.
- **Beneficio principal**: Da presencia festiva de temporada sin la intensidad de una estética de terror, ideal para negocios orientados a familias.
- **Ideal para**: comercios y familias en temporada de Halloween.
- **Nivel de personalización**: Bajo (elección entre calabaza o fantasma).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Bolsas de dulces de Halloween, decoración de temporada, empaques familiares.
- **Palabras clave SEO**: sticker halloween, etiqueta calabaza divertida, template halloween sticker, sticker fantasma amigable, packaging dulces halloween, sticker halloween familiar, etiqueta jack o lantern, template halloween fun, packaging temporada octubre, sticker calabaza alegre, etiqueta halloween no terror, template halloween niños, packaging bolsa dulces, sticker halloween colorido, etiqueta fantasma simpático, template calabaza sticker, packaging halloween comercio, sticker temporada halloween, etiqueta halloween circular, template halloween divertido.
- **Categoría comercial**: Holiday.
- **Colección**: Holiday Collection.
- **Premium Features**: 2 motivos amigables curados (calabaza y fantasma); expresión facial validada específicamente para tono no alarmante; consistente con el registro festivo/estacional del resto de Holiday.
- **Call to Action**: La diversión de la temporada, sin los sustos.

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

5 de 63 templates completados en este lote (Batch 11: template 16.2 — cierra Education en su totalidad — y templates 17.1 a 17.4 de Holiday). El template 17.5 (San Valentín) pasa al Batch 12 junto con Seasonal (3 templates).

Progreso acumulado: 55 de 63 templates completados (Batch 01 a Batch 11).

**A la espera de aprobación antes de continuar con Batch 12** (San Valentín — cierra Holiday — + Seasonal completa [3 templates]).

**Recordatorio de auditoría**: al finalizar Batch 13 (los 63 templates completos) está programada la auditoría integral del catálogo (cobertura, consistencia visual, estrategia comercial, preparación para producción), de carácter de validación, no de rediseño.
