> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del catálogo comercial de 63 plantillas de Sticker Builder — producto independiente que dejó de existir tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como registro histórico de trabajo de producción real (0% de este catálogo específico llegó a completarse comercialmente) — no es una fuente activa. El kit de producción reutilizable que este trabajo generó sigue vigente como capacidad técnica interna: ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md). Mapa completo de la consolidación: [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md).

# Template Batch 04 — Industrial (cierre) + Warning & Compliance Labels + Retail (Templates 16-20 de 63)

**Alcance: exclusivamente diseño de contenido.** Ningún archivo de código fue tocado, ningún asset fue producido. Este documento es la especificación de producción de los templates 16 a 20 de `TEMPLATE_CATALOG_v1.md` — suficientemente detallada para que un diseñador construya exactamente estos templates sin preguntas adicionales.

Referencia técnica compartida por todo el lote (para no repetirla en cada template): el motor de impresión de THÖREN usa **sangrado estándar de 3mm en los 4 lados** y **área segura con margen interno de 3mm** (`STANDARD_BLEED`/`STANDARD_SAFE_AREA`, ya definidos en `packages/print-engine/src/profiles.ts`) — todos los layouts de este documento se diseñan sobre esos valores reales, no sobre una suposición.

**Estructura congelada**: las 12 secciones establecidas en Batch 03 (1-10 de diseño, 11 Commercial Sheet, 12 Production Checklist + línea de cierre Production Status) quedan confirmadas como estándar oficial y definitivo — este documento y todos los lotes restantes las siguen exactamente, sin agregar ni quitar secciones.

Este lote cierra Industrial (template 4.2, el último pendiente), completa Warning & Compliance Labels en su totalidad (5.1-5.3), y abre Retail con su primer template (6.1) — los 2 restantes de Retail (6.2-6.3) pasan al Batch 05, para no romper el ritmo de 5 por lote a la mitad de una categoría.

Después de este lote se espera aprobación antes de continuar con el Batch 05.

---

## Template 16 — Sello de Calidad Industrial

### 1. Concepto
En manufactura, un sello de "Inspeccionado" o "Control de Calidad" sobre una pieza o empaque comunica una garantía operativa concreta, no una promesa de marca emocional — su función es certificar, no seducir. El problema en la práctica: muchas plantas pequeñas improvisan este sello con un timbre de tinta genérico o texto suelto sin sistema, perdiendo consistencia entre lotes y turnos. Este template existe para dar a un fabricante un sello reutilizable, reconocible al instante como "certificación", que pueda aplicarse de forma consistente en toda la línea de producción.

### 2. Dirección de Arte
- **Tipografía**: sans-serif condensada de alto contraste para el texto perimetral (recomendado: **Oswald**, peso 600, mayúsculas, tracking amplio) — la condensada permite que el anillo de texto quepa en el radio disponible sin comprimir la legibilidad.
- **Paleta**: casi negro `#1B1B1B`, rojo de certificación `#C0392B`, blanco `#FFFFFF`.
- **Estilo**: sobrio, institucional, sin ambigüedad — el sello debe leerse como certificación oficial, no como decoración.
- **Espaciados**: anillo perimetral con tracking amplio y consistente; margen de 3mm respecto al área segura respetado sin excepción en el radio exterior del anillo.
- **Jerarquía**: 1) ícono de check central (elemento más reconocible a distancia), 2) anillo perimetral con texto "INSPECCIONADO" / "CONTROL DE CALIDAD" (editable), 3) campo pequeño opcional de fecha/lote en el centro, debajo del check.
- **Alineaciones**: centrada, texto perimetral en círculo completo de 360°.
- **Formas**: círculo de troquel, anillo grueso definido (no una línea fina — el grosor del anillo es parte de la identidad de "sello oficial").
- **Iconografía**: un solo ícono de check (paloma/marca de verificación), trazo grueso y sólido, sin detalle adicional.
- **Texturas**: opcional, textura sutil de "tinta de sello" (imperfección leve, 5-8% de variación) para reforzar la sensación de sello físico aplicado, no un gráfico digital plano.
- **Estilo visual**: gráfico sólido de alto contraste, bordes duros, sin degradados.

### 3. Layout
- **Formato**: círculo de 35mm de diámetro.
- **Zonas**: anillo perimetral grueso (texto de certificación, 360°), centro (ícono de check, dominante), franja pequeña bajo el check (campo opcional de fecha/lote).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — el anillo perimetral se ubica en el radio máximo posible dentro del área segura, sin tocarla.
- **Retícula**: circular concéntrica, anillo exterior + centro, sin zonas intermedias.
- **Proporciones**: el anillo perimetral ocupa aproximadamente 25% del radio total; el ícono de check central ocupa el 40% restante del diámetro interior.

### 4. Elementos
- Texto perimetral de certificación (ej. "INSPECCIONADO · CONTROL DE CALIDAD")
- Ícono de check central
- Campo opcional de fecha o número de lote (texto pequeño bajo el check)

### 5. Assets necesarios
- 1 ícono SVG de check, trazo grueso sólido, sin detalle
- 1 textura sutil opcional de "tinta de sello" con imperfección leve (5-8%), tileable en escala de grises

### 6. Mockup
Caja de cartón corrugado industrial, el sello aplicado sobre la solapa superior, iluminación de planta/almacén (más dura y direccional que los mockups de cosmética/food), fondo de almacén desenfocado con cajas apiladas genéricas de fondo, sin props decorativos adicionales.

### 7. Thumbnail
Sello circular solo, centrado, sobre fondo blanco sólido — el ícono de check y el anillo de texto deben leerse con claridad total incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el ícono de check:
> "Bold solid checkmark icon, thick uniform stroke weight, hard clean edges, no gradients, industrial quality-seal aesthetic, single color, transparent background, suitable for a circular certification stamp."

Para la textura opcional de tinta de sello:
> "Subtle rubber stamp ink texture, slight uneven distribution and minor imperfections at the edges, single dark color, industrial certification seal aesthetic, tileable, suitable for a low-opacity overlay behind bold text and icon."

### 9. Exportación
- Tamaño final: 35mm × 35mm (círculo).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil resistente a manipulación en almacén (abrasión, humedad de bodega), acabado mate o satinado.

### 10. Nivel de calidad
Premium en este template significa que se perciba como certificación real, no como decoración de packaging — el error más común a evitar es una tipografía script o decorativa en el anillo perimetral, que rompe por completo la credibilidad de "sello oficial". Validación: mostrar el sello a alguien sin contexto — debe identificarlo de inmediato como un sello de control de calidad, no como un logo de marca.

### 11. Commercial Sheet
- **Nombre comercial**: Quality Seal — Sello de Certificación Industrial
- **Elevator Pitch**: Sello circular de control de calidad, diseñado para verse como certificación real en cada pieza o lote que sale de tu planta.
- **Beneficio principal**: Da consistencia visual a tu proceso de inspección, reforzando confianza operativa frente a clientes y auditorías.
- **Ideal para**: fabricantes, talleres de manufactura, plantas de control de calidad, empresas con procesos certificados.
- **Nivel de personalización**: Medio (texto perimetral, campo de fecha/lote editables; ícono de check fijo por diseño).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de cartón corrugado, piezas metálicas, empaques industriales, documentación de lote.
- **Palabras clave SEO**: sello calidad industrial, sticker control de calidad, template certificación, etiqueta inspeccionado, packaging manufactura, sticker sello fábrica, etiqueta quality seal, template sello circular industrial, packaging control de proceso, sticker certificación producto, etiqueta sello check, template manufactura calidad, packaging planta industrial, sticker inspección lote, etiqueta sello oficial, template control calidad fábrica, packaging certificado industrial, sticker sello inspección, etiqueta calidad manufactura, template sello producción.
- **Categoría comercial**: Industrial.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Sistema de anillo perimetral de 360° calibrado para máxima legibilidad en 35mm; ícono de check de trazo grueso curado (no clip-art genérico); textura de tinta de sello opcional incluida.
- **Call to Action**: Que tu control de calidad se vea tan riguroso como realmente es.

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

## Template 17 — Advertencia General

### 1. Concepto
Cualquier operación de logística o manufactura necesita señalización de precaución que sea reconocida instantáneamente sin importar el idioma o nivel de alfabetización del personal presente — la convención visual amarillo/negro con símbolo de exclamación existe precisamente porque funciona sin depender del texto. El problema: pequeñas operaciones frecuentemente improvisan advertencias con texto plano sin esa convención, perdiendo la velocidad de reconocimiento que la señalización estándar garantiza. Este template formaliza esa convención en un sticker reutilizable y editable.

### 2. Dirección de Arte
- **Tipografía**: sans-serif condensada de alto impacto para el texto de advertencia (recomendado: **Archivo Black** o **Anton**, todo mayúsculas) — la condensada permite mensajes cortos de máximo impacto en espacio reducido.
- **Paleta**: amarillo de seguridad `#F4C11F`, casi negro `#1A1A1A`, blanco `#FFFFFF` — colores de convención normada, no decisión estética libre.
- **Estilo**: funcional, universal, cero ambigüedad — este es un template donde "menos personalidad de marca, más claridad de convención" es literalmente el objetivo de diseño correcto.
- **Espaciados**: franja diagonal de advertencia con ángulo constante (45°), símbolo de exclamación centrado con margen mínimo de 3mm respecto al área segura.
- **Jerarquía**: 1) símbolo de exclamación estándar (máximo peso visual, reconocible sin leer texto), 2) texto de advertencia corto en mayúsculas condensadas, 3) franja diagonal amarillo/negro de fondo.
- **Alineaciones**: centrada, símbolo dominante en el tercio superior, texto en el tercio inferior.
- **Formas**: cuadrado de troquel.
- **Iconografía**: un símbolo de exclamación estándar dentro de un triángulo (convención universal de advertencia), sin variaciones creativas del símbolo.
- **Texturas**: ninguna — la convención visual normada no debe alterarse con texturas decorativas.
- **Estilo visual**: gráfico plano de máximo contraste, bordes duros, franja diagonal repetible tipo "cinta de precaución".

### 3. Layout
- **Formato**: cuadrado de 60mm × 60mm.
- **Zonas**: franja diagonal de fondo (patrón amarillo/negro a 45°), símbolo de exclamación centrado en tercio superior, banda de texto de advertencia en tercio inferior (fondo sólido negro para máximo contraste con el texto blanco).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — crítico que el símbolo y el texto queden dentro, aunque la franja diagonal de fondo sí puede sangrar hasta el borde.
- **Retícula**: 2 zonas verticales (símbolo arriba, texto abajo) sobre el fondo de franjas diagonales.
- **Proporciones**: el símbolo de exclamación ocupa aproximadamente 35% de la altura total; la banda de texto inferior ocupa un 20% fijo, independiente de la longitud del mensaje (mensajes largos reducen tamaño de fuente, nunca invaden la zona del símbolo).

### 4. Elementos
- Símbolo de exclamación en triángulo (convención estándar)
- Texto de advertencia corto (editable, ej. "PRECAUCIÓN", "SUPERFICIE CALIENTE")
- Franja diagonal de fondo amarillo/negro

### 5. Assets necesarios
- 1 ícono SVG de símbolo de exclamación en triángulo, convención estándar reconocida
- 1 patrón de franja diagonal amarillo/negro, vectorial, ángulo fijo de 45°

### 6. Mockup
Puerta de equipo industrial o superficie lateral de caja de cartón industrial, el sticker aplicado de forma recta, iluminación de planta neutra, sin props decorativos — el contexto de aplicación real es la única "escenografía" necesaria para este template funcional.

### 7. Thumbnail
Sticker cuadrado solo sobre fondo blanco — debe ser reconocible como "advertencia" incluso sin leer el texto, por la sola combinación de franja diagonal y símbolo.

### 8. Prompt para IA
Para el símbolo de exclamación:
> "Standard warning triangle icon with exclamation mark, bold solid black shape, universally recognized hazard symbol, no decorative variation, transparent background, suitable for high-visibility safety labeling."

### 9. Exportación
- Tamaño final: 60mm × 60mm (cuadrado).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil resistente a intemperie/exterior si la aplicación es en equipo expuesto, acabado mate para evitar reflejos que dificulten la lectura rápida.

### 10. Nivel de calidad
Premium aquí no se mide en términos estéticos sino de fidelidad a la convención — el error más común a evitar es "estilizar" el símbolo de exclamación o cambiar los colores normados por preferencia estética, lo cual reduce el reconocimiento instantáneo que es la única razón de ser del template. Validación: el símbolo debe ser reconocible como advertencia de seguridad a distancia y de reojo, sin necesidad de leer el texto.

### 11. Commercial Sheet
- **Nombre comercial**: Precaución — Etiqueta de Advertencia General
- **Elevator Pitch**: Sticker de advertencia con la convención visual amarillo/negro reconocida universalmente, listo para cualquier mensaje de precaución.
- **Beneficio principal**: Comunica riesgo de forma instantánea sin depender del idioma o la lectura, mejorando seguridad operativa.
- **Ideal para**: logística, manufactura, almacenes, cumplimiento normativo de seguridad industrial.
- **Nivel de personalización**: Medio (texto de advertencia editable; símbolo y franja diagonal fijos por convención).
- **Tiempo estimado de personalización**: 5 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Puertas de equipo, cajas industriales, paredes de almacén, maquinaria.
- **Palabras clave SEO**: etiqueta advertencia, sticker precaución industrial, template señalización seguridad, etiqueta warning, packaging advertencia amarillo negro, sticker símbolo exclamación, etiqueta seguridad industrial, template hazard label, packaging almacén precaución, sticker franja diagonal, etiqueta compliance seguridad, template advertencia general, packaging logística seguridad, sticker superficie caliente, etiqueta triángulo advertencia, template señalización industrial, packaging riesgo laboral, sticker precaución universal, etiqueta seguridad almacén, template warning sign.
- **Categoría comercial**: Warning & Compliance Labels.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Símbolo de convención normada curado (no una interpretación estilizada); franja diagonal vectorial de ángulo preciso incluida; layout calibrado para máxima legibilidad de seguridad.
- **Call to Action**: La seguridad no espera a que alguien lea las letras pequeñas.

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

## Template 18 — Manejo con Cuidado — Frágil Técnico

### 1. Concepto
El traslado de equipo sensible en logística industrial (a diferencia del envío de e-commerce, Template en la categoría Shipping) requiere una comunicación más formal y bilingüe, dirigida a personal de manejo de carga profesional, no a un cliente final. El problema: usar la misma etiqueta "amigable" de e-commerce en un contexto industrial se percibe como poco serio; este template existe específicamente para el registro más técnico y formal que ese contexto exige.

### 2. Dirección de Arte
- **Tipografía**: sans-serif técnica de alto contraste (recomendado: **Inter**, peso 700 para el texto principal, 500 para la traducción secundaria) — nunca condensada decorativa; la seriedad del contexto pide una tipografía neutra y profesional.
- **Paleta**: casi negro `#1A1A1A`, blanco `#FFFFFF`, rojo de énfasis `#C0392B` (usado solo en el ícono, nunca en bloques grandes de fondo).
- **Estilo**: formal, técnico, bilingüe por diseño — más contenido, la variación deliberada frente a la simplicidad del resto del catálogo.
- **Espaciados**: texto bilingüe apilado con separación clara entre idiomas (mínimo 2mm de espacio entre bloque ES y bloque EN, para que no se lean como una sola oración).
- **Jerarquía**: 1) ícono estándar de copa/frágil (reconocimiento inmediato), 2) texto en español (bloque superior), 3) texto en inglés (bloque inferior, mismo peso tipográfico que el español — ninguno de los dos idiomas es secundario).
- **Alineaciones**: centrada, ícono arriba, bloques de texto apilados debajo.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ícono estándar de copa quebradiza (convención internacional de manejo frágil), sin estilización creativa.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico técnico de alto contraste, bordes duros.

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 3:2.
- **Zonas**: tercio superior (ícono de copa/frágil, centrado), tercio medio (texto en español), tercio inferior (texto en inglés).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno.
- **Retícula**: 3 franjas horizontales de proporción fija (35% ícono, 32.5% texto ES, 32.5% texto EN).
- **Proporciones**: el ícono ocupa un máximo de 40% del ancho total, centrado.

### 4. Elementos
- Ícono estándar de copa/frágil
- Texto en español (ej. "MANEJAR CON CUIDADO — EQUIPO SENSIBLE")
- Texto en inglés (ej. "HANDLE WITH CARE — SENSITIVE EQUIPMENT")

### 5. Assets necesarios
- 1 ícono SVG de copa quebradiza, convención estándar internacional de manejo frágil, sin estilización

### 6. Mockup
Caja de madera o cartón reforzado de envío industrial, el sticker aplicado en una esquina visible de la caja, iluminación de almacén/muelle de carga, fondo de bodega industrial desenfocado, sin props decorativos adicionales.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco — el ícono y ambos bloques de texto deben ser legibles a tamaño de card, incluyendo el bilingüismo.

### 8. Prompt para IA
Para el ícono de copa/frágil:
> "Standard fragile-handling glass icon (broken wine glass symbol), bold solid black shape, internationally recognized shipping handling symbol, no decorative styling, transparent background, suitable for formal industrial logistics labeling."

### 9. Exportación
- Tamaño final: 90mm × 60mm aprox. (etiqueta rectangular para caja de envío industrial).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil resistente a manipulación de almacén/transporte, acabado mate.

### 10. Nivel de calidad
Premium aquí significa seriedad y claridad bilingüe, no personalidad de marca — el error más común a evitar es tratar este template como el de Shipping/e-commerce (icono amigable, tono casual), lo cual no corresponde al contexto industrial/logístico formal que este template específicamente atiende. Validación: un encargado de logística debe poder leer e identificar ambos idiomas sin ambigüedad en menos de 2 segundos.

### 11. Commercial Sheet
- **Nombre comercial**: Handle Care Pro — Etiqueta Técnica Bilingüe de Manejo
- **Elevator Pitch**: Etiqueta formal y bilingüe (ES/EN) de manejo especial, diseñada para logística industrial profesional.
- **Beneficio principal**: Comunica manejo especial con seriedad técnica ante personal de carga profesional, en ambos idiomas de operación logística estándar.
- **Ideal para**: empresas de logística, manufactura con equipo delicado, transporte de carga industrial, exportadores.
- **Nivel de personalización**: Medio (texto en ambos idiomas editable; ícono fijo por convención).
- **Tiempo estimado de personalización**: 10 minutos.
- **Dificultad de impresión**: Fácil.
- **Productos compatibles**: Cajas de madera de envío, cartón reforzado industrial, contenedores de carga.
- **Palabras clave SEO**: etiqueta frágil industrial, sticker manejo con cuidado, template handle with care, etiqueta bilingüe logística, packaging equipo sensible, sticker fragile bilingual, etiqueta carga industrial, template manejo especial, packaging transporte frágil, sticker logística profesional, etiqueta copa frágil, template equipo delicado, packaging exportación frágil, sticker fragile handling, etiqueta manejo técnico, template caja industrial fragil, packaging carga sensible, sticker bilingual warning, etiqueta transporte carga, template logistics fragile.
- **Categoría comercial**: Warning & Compliance Labels.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Sistema bilingüe con jerarquía tipográfica equilibrada entre idiomas; ícono de convención internacional curado; layout calibrado para lectura rápida por personal de carga.
- **Call to Action**: Cuando el equipo no puede fallar, el manejo tampoco puede ser ambiguo.

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

## Template 19 — Material Peligroso — Rombo Normado

### 1. Concepto
El transporte de mercancías reguladas exige rombos de clasificación de materiales peligrosos que sigan una convención internacional estricta (proporción, división diagonal, ubicación del número de clase) — no es un espacio de libertad creativa, es un documento de cumplimiento normativo con consecuencias legales si se ejecuta incorrectamente. Este template existe para dar a empresas de transporte/plantas químicas una base correctamente proporcionada que solo requiera completar el número de clase y símbolo correspondientes, sin arriesgar errores de formato.

### 2. Dirección de Arte
- **Tipografía**: sans-serif técnica de alto contraste para el número de clase (recomendado: **Inter**, peso 700, tamaño grande) — la legibilidad del número a distancia es un requisito normativo, no estético.
- **Paleta**: rojo normado `#D64541`, blanco `#FFFFFF`, casi negro `#1A1A1A` — colores de convención regulada (la paleta exacta puede variar según clase de peligro real; este template documenta la variante de clase inflamable como base, con nota de que otras clases normadas requieren su propia paleta oficial).
- **Estilo**: estrictamente normativo — cero interpretación creativa; el rombo debe seguir la convención de transporte de mercancías peligrosas al pie de la letra.
- **Espaciados**: proporciones exactas del rombo según convención (división diagonal en el tercio superior para símbolo, número de clase en la esquina inferior) — no son proporciones estéticas, son requisito de cumplimiento.
- **Jerarquía**: 1) símbolo genérico central (editable según el peligro específico), 2) número de clase en la esquina inferior (grande, alto contraste), 3) división diagonal que separa visualmente ambas zonas.
- **Alineaciones**: la geometría del rombo es fija; símbolo centrado en la mitad superior, número alineado a la esquina inferior según convención.
- **Formas**: **personalizado** — rombo (diamante) con proporción y división normada, no un cuadrado rotado arbitrario.
- **Iconografía**: símbolo genérico editable central (llama, calavera, etc. según clase de peligro real — el template documenta la estructura, el símbolo específico se selecciona según el material real transportado).
- **Texturas**: ninguna.
- **Estilo visual**: gráfico normativo de alto contraste, bordes duros, geometría exacta.

### 3. Layout
- **Formato**: **personalizado** — rombo de 100mm × 100mm (medida de diagonal, convención de placa de mercancías peligrosas estándar).
- **Zonas**: mitad superior del rombo (símbolo genérico de peligro), línea diagonal divisoria, esquina inferior (número de clase, grande).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — aplicado sobre la geometría de rombo, no sobre un rectángulo contenedor; ningún elemento normado se acerca al vértice del rombo.
- **Retícula**: geometría de rombo fija por convención — no hay libertad de retícula aquí, a diferencia de todo el resto del catálogo.
- **Proporciones**: el símbolo central ocupa aproximadamente 50% del área del rombo; el número de clase ocupa la esquina inferior en un tamaño de fuente proporcional a la convención (mínimo legible a distancia de manejo de carga).

### 4. Elementos
- Símbolo genérico de peligro (editable según clase de material)
- Número de clase (esquina inferior)
- División diagonal del rombo

### 5. Assets necesarios
- 1 plantilla vectorial de rombo con geometría y proporción normada (documento de producción técnico, no solo diseño libre)
- Set de símbolos genéricos de peligro editables (llama, corrosivo, tóxico, etc. — según las clases que THÖREN decida cubrir en producción real)

### 6. Mockup
Tambor o contenedor industrial metálico, el rombo aplicado en la superficie lateral siguiendo la convención real de transporte, iluminación de planta/almacén industrial, fondo de bodega desenfocado, sin props decorativos.

### 7. Thumbnail
Rombo solo sobre fondo blanco — debe seguir la geometría exacta reconocible de la convención de mercancías peligrosas incluso a tamaño de card pequeña.

### 8. Prompt para IA
Para el set de símbolos genéricos de peligro (ejemplo con llama, clase inflamable):
> "Standard hazmat pictogram symbol for flammable material, bold solid black shape on white background, internationally recognized dangerous goods classification icon style, no decorative variation, precise geometric proportions matching official dangerous goods labeling conventions, transparent background."

### 9. Exportación
- Tamaño final: 100mm × 100mm (rombo, medida de diagonal).
- Sangrado: 3mm. Área segura: 3mm de margen interno, aplicado sobre la geometría de rombo.
- Recomendación de impresión: vinil resistente a intemperie y a productos químicos (relevante — el rombo se aplica sobre contenedores expuestos a los materiales mismos que clasifica), acabado mate.
- **Nota de cumplimiento**: este template documenta la estructura visual de un rombo de clasificación — la selección del símbolo y número de clase correctos para un material específico es responsabilidad regulatoria del cliente, no una decisión de diseño; se recomienda validar contra la normativa de transporte vigente antes de producción real.

### 10. Nivel de calidad
Premium aquí se mide exclusivamente por precisión de convención, no por creatividad — el error más grave posible en todo el catálogo sería una desviación de proporción o color que genere una placa de mercancías peligrosas no conforme a normativa. Validación: comparar la geometría exacta (ángulos, proporción de división diagonal, ubicación del número) contra una referencia oficial de clasificación de mercancías peligrosas antes de aprobar cualquier variante.

### 11. Commercial Sheet
- **Nombre comercial**: Hazmat Diamond — Rombo de Clasificación Normado
- **Elevator Pitch**: Plantilla de rombo de mercancías peligrosas con la geometría y proporción exactas de la convención internacional de transporte.
- **Beneficio principal**: Elimina el riesgo de errores de proporción o formato en una etiqueta con implicaciones normativas reales.
- **Ideal para**: empresas de transporte de mercancías, plantas químicas, operadores logísticos de carga regulada.
- **Nivel de personalización**: Alto (símbolo y número de clase varían según el material específico transportado — el template está diseñado para producirse en múltiples variantes de clase).
- **Tiempo estimado de personalización**: 15 minutos (incluye validar el símbolo/clase correctos contra normativa).
- **Dificultad de impresión**: Avanzada (la geometría normada no admite desviación; requiere revisión de cumplimiento antes de producción masiva).
- **Productos compatibles**: Tambores industriales, contenedores de carga, camiones de transporte de materiales regulados.
- **Palabras clave SEO**: rombo mercancías peligrosas, etiqueta hazmat, sticker clasificación peligro, template diamond label, etiqueta transporte químico, packaging materiales peligrosos, sticker rombo normado, etiqueta clase peligro, template hazmat diamond, packaging transporte regulado, sticker material inflamable, etiqueta contenedor químico, template rombo transporte, packaging carga peligrosa, sticker clasificación normada, etiqueta dangerous goods, template rombo industrial, packaging tambor químico, sticker hazmat classification, etiqueta rombo transporte peligroso.
- **Categoría comercial**: Warning & Compliance Labels.
- **Colección**: Industrial & Compliance Collection.
- **Premium Features**: Geometría de rombo validada contra convención internacional (no una aproximación estética); set de símbolos genéricos de peligro incluido; nota de cumplimiento documentada para validación normativa previa a producción.
- **Call to Action**: Cuando la norma no admite margen de error, tampoco debería admitirlo tu etiqueta.

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

## Template 20 — Precio y Oferta

### 1. Concepto
En retail físico, una oferta necesita comunicar el precio y el ahorro en el mismo instante en que el comprador pasa frente al anaquel — con frecuencia menos de un segundo de atención real. El problema: muchas tiendas pequeñas improvisan carteles de oferta a mano o con plantillas genéricas de impresora de oficina, que no logran el impacto visual necesario para detener la mirada del comprador. Este template resuelve ese problema específico de captura de atención inmediata en punto de venta.

### 2. Dirección de Arte
- **Tipografía**: display de alto impacto para el número de precio (recomendado: **Archivo Black**, peso 900) — el precio es, literalmente, el elemento tipográfico más grande de todo el catálogo hasta ahora, sans-serif simple para "antes/ahora" (recomendado: **Work Sans**, peso 500).
- **Paleta**: rojo de oferta `#C0392B`, casi negro `#1A1A1A`, blanco `#FFFFFF`.
- **Estilo**: directo, urgente, sin sutileza — a diferencia de la mayoría del catálogo, aquí la discreción sería un error: el objetivo es detener la mirada, no comunicar sofisticación.
- **Espaciados**: compacto y denso deliberadamente — el precio y la banda "OFERTA" ocupan la mayor proporción posible del espacio disponible, dejando el mínimo margen técnico (3mm de área segura) como único respiro.
- **Jerarquía**: 1) precio "ahora" (dominante, el elemento más grande de toda la etiqueta), 2) banda diagonal "OFERTA" (opcional, superpuesta), 3) precio "antes" (tachado, notablemente más pequeño).
- **Alineaciones**: centrada, precio dominante ocupando el centro visual absoluto.
- **Formas**: rectángulo horizontal.
- **Iconografía**: ninguna ilustrativa — la banda diagonal de "OFERTA" es el único elemento gráfico además de la tipografía.
- **Texturas**: ninguna.
- **Estilo visual**: gráfico de máximo impacto, bordes duros, banda diagonal repetible tipo "sello de oferta".

### 3. Layout
- **Formato**: rectangular horizontal, proporción aprox. 3:2.
- **Zonas**: banda diagonal superior-izquierda (texto "OFERTA", opcional), centro (precio "ahora", dominante), esquina o línea inferior (precio "antes", tachado, pequeño).
- **Márgenes**: sangrado 3mm; área segura 3mm de margen interno — el diseño ocupa el máximo espacio permitido dentro de esa área, sin el aire generoso de otros templates del catálogo (aquí más densidad visual es la decisión correcta).
- **Retícula**: eje central único, precio dominante ocupando el 60% del área total disponible.
- **Proporciones**: el precio "ahora" ocupa un tamaño de fuente notablemente mayor (mínimo 3x) que el precio "antes" tachado, para que la jerarquía de ahorro sea instantánea.

### 4. Elementos
- Precio "ahora" (dominante)
- Precio "antes" (tachado, pequeño)
- Banda diagonal "OFERTA" (opcional, superpuesta)

### 5. Assets necesarios
- Ninguno gráfico — el template se construye con tipografía y una banda diagonal vectorial simple, sin ilustración externa.

### 6. Mockup
Estante de tienda con producto genérico (caja o envase neutro sin marca), el sticker aplicado sobre el estante o directamente sobre el producto, iluminación de tienda comercial (más plana y uniforme que un mockup editorial), fondo de estantería desenfocado con otros productos genéricos de contexto.

### 7. Thumbnail
Etiqueta rectangular sola sobre fondo blanco o rojo — el precio dominante debe ser lo primero y más grande que se perciba, incluso antes que cualquier otro elemento del thumbnail.

### 8. Prompt para IA
Este template no requiere ningún asset generado por IA — se construye exclusivamente con tipografía y una banda diagonal vectorial simple.

### 9. Exportación
- Tamaño final: 75mm × 50mm aprox. (etiqueta de punto de venta para estante o producto).
- Sangrado: 3mm. Área segura: 3mm de margen interno.
- Recomendación de impresión: vinil adhesivo estándar, acabado brillante permitido (a diferencia de la mayoría del catálogo — en retail de oferta, el brillo puede reforzar la sensación de urgencia/llamativo en vez de restarle valor percibido).

### 10. Nivel de calidad
Premium en este template se mide por efectividad de conversión, no por sutileza — el error más común a evitar es aplicar la misma disciplina de espacio negativo usada en categorías de lujo (serum, spa); en retail de oferta esa disciplina reduciría el impacto que el formato necesita para funcionar. Validación: mostrar el diseño a 2 metros de distancia por 1 segundo — el precio "ahora" debe ser lo único que se retiene de esa exposición breve.

### 11. Commercial Sheet
- **Nombre comercial**: Oferta Flash — Etiqueta de Precio y Promoción
- **Elevator Pitch**: Etiqueta de punto de venta de alto impacto que comunica precio y ahorro en menos de un segundo de atención.
- **Beneficio principal**: Detiene la mirada del comprador en el pasillo y comunica el ahorro sin necesidad de leer texto adicional.
- **Ideal para**: tiendas minoristas, boutiques, comercios con rotación de ofertas frecuente, puntos de venta físicos.
- **Nivel de personalización**: Alto (precio "ahora", precio "antes" y presencia de banda "OFERTA" editables por cada promoción individual).
- **Tiempo estimado de personalización**: 5 minutos por oferta.
- **Dificultad de impresión**: Muy fácil.
- **Productos compatibles**: Estantes de tienda, empaques de producto, vitrinas, mostradores de punto de venta.
- **Palabras clave SEO**: etiqueta oferta, sticker precio rebajado, template promoción retail, etiqueta antes y ahora, packaging punto de venta, sticker oferta flash, etiqueta descuento tienda, template precio oferta, packaging promoción comercial, sticker rebaja producto, etiqueta retail oferta, template sale label, packaging tienda descuento, sticker precio destacado, etiqueta promoción estante, template oferta comercial, packaging punto venta retail, sticker descuento flash, etiqueta oferta impactante, template precio rebajado.
- **Categoría comercial**: Retail.
- **Colección**: Retail & POS Collection.
- **Premium Features**: Sistema tipográfico de alto impacto calibrado para conversión en punto de venta; jerarquía precio-antes/ahora validada para reconocimiento instantáneo; cero producción de assets gráficos requerida.
- **Call to Action**: Haz que el precio hable antes de que el comprador siga caminando.

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

5 de 63 templates completados en este lote (Batch 04: template 4.2 — cierra Industrial — templates 5.1 a 5.3 — cierra Warning & Compliance Labels en su totalidad — y template 6.1 de Retail). Los templates 6.2 y 6.3 (Nuevo Producto, Sello "Hecho en Casa") pasan al Batch 05 junto con el inicio de Product Labels, para no romper el ritmo de lotes de 5 a la mitad de una categoría.

Progreso acumulado: 20 de 63 templates completados (Batch 01 + Batch 02 + Batch 03 + Batch 04).

**A la espera de aprobación antes de continuar con Batch 05** (Nuevo Producto + Sello "Hecho en Casa" — cierra Retail — + 3 templates de Product Labels — cierra esa categoría en su totalidad).
