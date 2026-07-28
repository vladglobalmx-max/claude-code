# THÖREN Design Language Guide v1.0

**Alcance: exclusivamente documentación de lenguaje visual.** Este documento no modifica la arquitectura (`TEMPLATE_LIBRARY_ARCHITECTURE.md`), no modifica el roadmap (`ROADMAP_TEMPLATE_SYSTEM.md`), no modifica ningún archivo de código. Es el manual maestro de identidad visual del ecosistema THÖREN — la referencia que consolida y formaliza las decisiones de dirección de arte ya tomadas de forma consistente a lo largo de `TEMPLATE_BATCH_01.md` a `TEMPLATE_BATCH_04.md` (20 templates producidos hasta este punto), y que gobierna las decisiones de los 43 templates restantes y de cualquier template futuro fuera de este catálogo v1.

Este documento no inventa un lenguaje visual nuevo — lo describe. Cada regla aquí escrita ya fue aplicada consistentemente en al menos 2-3 templates de los batches anteriores; este documento existe para que esa consistencia deje de vivir implícitamente en la cabeza de quien diseñó los primeros 20 templates y se vuelva explícita, verificable y transferible a cualquier diseñador que continúe el catálogo.

---

## 0. Principio rector

**THÖREN no tiene un solo estilo visual — tiene un solo sistema de disciplina visual, aplicado a través de múltiples "familias de lenguaje" según la categoría de producto.**

Esto no es una contradicción. Un template de café de especialidad (editorial, minimalista, tierra) y un template de cerveza artesanal (audaz, alto contraste, negro/dorado) se ven completamente distintos entre sí — y sin embargo, ambos son inconfundiblemente THÖREN. Lo que los une no es la paleta ni la tipografía, sino la **misma disciplina de restricción**: un acento de color a la vez, un solo ícono por diseño, jerarquía de máximo 2-3 niveles, y una regla que se repite en los 20 templates hasta ahora sin excepción — **el error más común que cada documento de batch identifica es casi siempre "agregar algo de más", nunca "faltó algo"**.

Ese es el lenguaje visual de THÖREN: **restricción deliberada, calibrada por categoría**. Este documento formaliza cómo se calibra esa restricción según el contexto del producto, para que cualquier nuevo template — dentro o fuera del catálogo v1 — pueda decidir su propio nivel de audacia/silencio sin perder la disciplina que los une a todos.

---

## 1. Las 6 familias de lenguaje visual

Los 20 templates producidos hasta ahora, aunque pertenecen a 6 categorías distintas del catálogo, en realidad se agrupan en solo **6 familias de lenguaje visual** — un nivel de abstracción por debajo de "Categoría" (que es un concepto comercial/de catálogo) y por encima de cada template individual. Esta es la capa que un diseñador nuevo debe entender primero: no "¿qué categoría es esto?" sino "¿qué familia de lenguaje le corresponde?".

| Familia | Templates ya producidos que la ejemplifican | Sensación objetivo |
|---|---|---|
| **A. Artesanal Cálido** | Café, Miel, Mermelada, Té de Hierbas, Jabón en Barra | Hecho por una persona, no una fábrica; calidez sin caer en infantil |
| **B. Lujo Silencioso** | Serum Facial Premium, Spa & Bienestar | La ausencia de ornamento ES la señal de calidad; espacio negativo extremo |
| **C. Audaz Gráfico** | Cerveza IPA, Salsa Picante | Alto contraste, sin miedo al espacio ocupado, personalidad de marca fuerte |
| **D. Técnico Funcional** | Identificación de Equipo Industrial, Advertencia General, Frágil Técnico, Rombo Normado | Legibilidad y convención por encima de estética; cero interpretación creativa donde hay norma |
| **E. Elegante Personal** | Sello de Cita — Salón, Marca Personal de Estilista | Cálido pero refinado; monograma/script como firma de identidad |
| **F. Impacto Comercial** | Precio y Oferta | Captura de atención inmediata; la sutileza es un error aquí, no una virtud |

Cada nuevo template del catálogo (o cualquier template futuro fuera de v1) debe **decidir explícitamente a qué familia pertenece antes de empezar el diseño**, no después. La familia determina automáticamente buena parte de las decisiones de §2 a §7 de este documento — no se eligen de forma aislada por template.

**Regla de asignación**: si un template nuevo no encaja claramente en una de estas 6 familias, es una señal de que puede necesitar una 7ª familia — pero eso debe decidirse deliberadamente y documentarse aquí, nunca improvisarse template por template (ver §11, Gobernanza).

---

## 2. Sistema tipográfico

### 2.1 Los 4 roles tipográficos

THÖREN usa exactamente 4 roles tipográficos across todo el catálogo. Ningún template usa más de 2 roles simultáneos (casi siempre display + body); ningún template inventa un rol nuevo sin pasar por este documento.

| Rol | Función | Familias tipográficas ya validadas en el catálogo |
|---|---|---|
| **Display Editorial** | Nombre de producto/marca en templates de familia Artesanal/Lujo — carácter, no solo tamaño | Fraunces (café), Lora (miel, té), Cormorant (jabón), Playfair Display (salón, estilista) |
| **Display de Impacto** | Nombre de producto en templates de familia Audaz/Impacto Comercial — condensada, mayúsculas, alto contraste | Anton, Bebas Neue (cerveza), Oswald (salsa picante, sello industrial), Archivo Black (advertencia, oferta) |
| **Sans Body/Utilitaria** | Datos técnicos, descripciones, campos secundarios — en cualquier familia | Work Sans (uso transversal en casi todos los templates), Nunito (crema corporal), Quicksand (mermelada, bálsamo), Inter (técnico/compliance) |
| **Técnica/Monoespaciada** | Datos de especificación en templates de familia Técnico Funcional — refuerza precisión, no calidez | JetBrains Mono, Space Mono (cerveza — datos ABV/IBU), IBM Plex Mono (identificación industrial) |
| **Script/Manuscrita** | Uso restringido a productos con voz humana explícita (nombre de productor, marca personal) — nunca en templates Técnico Funcional o Audaz Gráfico | Caveat, Reenie Beanie (miel), Parisienne (estilista, uso opcional) |

### 2.2 Reglas de emparejamiento (pairing)

- **Nunca 2 display simultáneos.** Un template tiene como máximo 1 tipografía de "carácter" (Editorial, Impacto o Script) y 1 de apoyo (Sans Body o Mono). Mezclar dos tipografías de carácter (ej. una script y una condensada de impacto en el mismo diseño) rompe la jerarquía — ningún template de los 20 producidos lo hace, y ninguno futuro debería.
- **La familia de lenguaje determina el display, no la categoría del catálogo.** Dos templates de categorías de catálogo distintas (ej. Miel en Food & Beverage, Marca Personal de Estilista en Beauty) comparten familia de lenguaje (Artesanal Cálido / Elegante Personal respectivamente son distintas, pero Café y Té de Hierbas sí comparten Artesanal Cálido) y por eso comparten Work Sans como sans de apoyo — la elección tipográfica sigue la familia visual, no la etiqueta de categoría comercial.
- **Monoespaciada implica siempre Técnico Funcional o dato cuantitativo de alto rigor** (ABV/IBU de cerveza, aunque cerveza sea familia Audaz Gráfico, no Técnico — la excepción se explica porque el dato en sí, no el template completo, exige precisión de laboratorio). Nunca se usa monoespaciada por estética "tech" sin esa justificación funcional.

### 2.3 Reglas de escala

- El elemento de mayor jerarquía en cualquier template ocupa siempre un tamaño de fuente notablemente mayor (mínimo ~2x, frecuentemente 3x o más en familia Impacto Comercial) que el segundo nivel — nunca una diferencia sutil que obligue al ojo a "buscar" qué leer primero.
- En formatos diminutos (Aceite Esencial 25mm, Bálsamo Labial 20mm), el número de roles tipográficos se reduce a 1, nunca 2 — la restricción de espacio prevalece sobre la ambición de jerarquía.

---

## 3. Sistema de color

### 3.1 Regla de cantidad

Todo template del catálogo usa **exactamente 3 colores base** (uno dominante/fondo, uno de texto de alto contraste, uno de acento) más, en algunos casos, **1 acento intercambiable por variante** (ver §3.3). Ningún template de los 20 producidos usa 4 o más colores fijos simultáneos. Esta regla de "3 + 1 variable" es la unidad atómica del sistema de color THÖREN.

### 3.2 Paleta por familia de lenguaje

| Familia | Lógica de color | Ejemplos ya validados |
|---|---|---|
| **Artesanal Cálido** | Tonos tierra/naturales, nunca saturación alta, un acento cálido | Espresso/tostado/crema (café); dorado miel/marrón/crema (miel); salvia/crema/verde oscuro (té) |
| **Lujo Silencioso** | Neutros casi monocromáticos, un solo acento discreto usado con extrema moderación | Carbón/hueso/cobre (serum); salvia grisáceo/hueso/verde oscuro (spa) |
| **Audaz Gráfico** | Alto contraste, negro/blanco + un color de identidad vibrante | Negro/dorado ámbar/blanco roto (cerveza); rojo/negro/crudo (salsa) |
| **Técnico Funcional** | Colores de convención normada cuando existe norma (amarillo/negro de seguridad, rojo de hazmat); gris industrial + un acento de énfasis cuando no hay norma | Amarillo seguridad/negro (advertencia); grafito/amarillo (identificación equipo) |
| **Elegante Personal** | Tonos rosados/neutros cálidos, nunca colores primarios | Rosa antiguo/casi negro/rosa pálido (salón, estilista) |
| **Impacto Comercial** | Rojo de urgencia + negro + blanco, deliberadamente el más "gritón" del sistema | Rojo oferta/negro/blanco (precio y oferta) |

### 3.3 Acento intercambiable

Varios templates (Café, Mermelada) están diseñados para que **un solo color de acento cambie según variante del producto** (proceso de café, sabor de fruta) sin tocar el resto de la paleta ni el layout. Esta es una decisión de sistema, no una casualidad: cualquier template que represente una familia de productos con variantes (sabores, aromas, procesos) debe diseñarse con este mismo patrón de "3 colores fijos + 1 acento variable", nunca rediseñando la paleta completa por variante.

### 3.4 Regla de no combinar familias de color entre sí

Un template de familia Audaz Gráfico nunca debería tomar prestada la paleta de tonos tierra de Artesanal Cálido, aunque pertenezcan a la misma categoría de catálogo (ambos son Food & Beverage) — la paleta sigue la familia de lenguaje visual (§1), no la categoría comercial. Esta es la razón documentada por la que Café y Cerveza, ambos Food & Beverage, no comparten ni un solo color entre sí.

---

## 4. Iconografía e ilustración

### 4.1 Los 5 niveles de reducción

THÖREN usa 5 niveles de simplificación de ilustración/ícono, y cada template debe usar exactamente uno — nunca mezclar niveles dentro del mismo template ni dentro de un mismo set de variantes (regla explícita ya validada en el Nivel de Calidad del template de Mermelada: "las 6-8 variantes de fruta deben verse como si las hubiera dibujado la misma mano el mismo día").

| Nivel | Descripción | Templates que lo usan |
|---|---|---|
| **1. Línea fina editorial** | Trazo delgado y constante (~1-1.5pt), sin relleno, estilo botánico/editorial | Grano de café, abeja, hoja de té, ingredientes botánicos de crema corporal |
| **2. Color plano simplificado** | 2-3 tonos máximo, geométrico, sin fotorrealismo | Set de frutas de mermelada |
| **3. Gráfico de alto contraste** | Bordes duros, relleno sólido, sin degradados, funciona en un solo color | Lúpulo de cerveza, chile de salsa picante |
| **4. Pictograma ultra-reducido** | Reducido a forma esencial, casi ícono de interfaz, sin detalle fino | Set de íconos de aceite esencial (25mm) |
| **5. Símbolo normado** | Cero interpretación creativa — convención internacional exacta (exclamación de advertencia, copa de frágil, rombo hazmat) | Advertencia General, Frágil Técnico, Rombo Normado |

### 4.2 Regla de cantidad

Ningún template usa más de **un ícono/ilustración protagonista** por diseño (excepto sets de variantes del mismo ícono, como el indicador de picor de la salsa, que cuenta como un solo sistema, no como múltiples elementos). La tentación de "agregar una segunda ilustración para llenar espacio" aparece nombrada explícitamente como error a evitar en al menos 4 de los 20 templates ya documentados — es, junto con el exceso de acentos de color, el error más repetido que este sistema existe para prevenir.

### 4.3 Correspondencia familia → nivel de reducción

- Artesanal Cálido → Nivel 1 (línea fina) o Nivel 2 (color plano) si el reconocimiento instantáneo de variante importa (frutas)
- Lujo Silencioso → Ningún ícono en absoluto (Nivel 0 — ver Serum, Spa)
- Audaz Gráfico → Nivel 3
- Técnico Funcional → Nivel 5 cuando existe convención normada; Nivel 3 cuando no (identificación de equipo)
- Elegante Personal → Nivel 1 (silueta) o ninguno (monograma tipográfico puro)
- Impacto Comercial → Ninguno (la tipografía y la banda diagonal son el único lenguaje gráfico)

---

## 5. Layout, retícula y proporción

### 5.1 Constantes técnicas (no negociables)

Todo template, sin excepción, respeta:
- **Sangrado**: 3mm en los 4 lados (`STANDARD_BLEED`, `packages/print-engine/src/profiles.ts`).
- **Área segura**: margen interno de 3mm (`STANDARD_SAFE_AREA`), ningún elemento crítico la cruza.

Esto no es una regla de "lenguaje visual" en sentido estético — es la única restricción verdaderamente universal del sistema, y por eso se documenta primero en esta sección.

### 5.2 Regla de alineación por familia

- **Centrada simétrica**: familia por defecto de casi todo el catálogo (Artesanal, Lujo, Audaz, Elegante, Impacto) — el eje único vertical centrado es la composición base de THÖREN.
- **Alineación izquierda funcional**: única excepción deliberada, reservada a familia Técnico Funcional cuando el contenido es una lista de campos de datos a escanear rápidamente (Identificación de Equipo Industrial) — la alineación izquierda facilita el escaneo de una lista, la centrada lo dificulta. Nunca usar alineación izquierda fuera de este caso de uso específico.

### 5.3 Regla de densidad de espacio negativo

El espacio negativo no es constante entre familias — es una variable deliberada:
- Lujo Silencioso: margen mínimo de 6-8mm alrededor del contenido — el máximo del sistema.
- Artesanal Cálido/Elegante Personal: margen de 4-5mm — generoso pero no extremo.
- Audaz Gráfico/Técnico Funcional/Impacto Comercial: margen ajustado al mínimo funcional (el área segura de 3mm y poco más) — la densidad visual es parte de la estrategia de estas familias, no una limitación.

**Regla de oro**: más espacio negativo no es "más premium" de forma universal — es premium únicamente dentro de la familia Lujo Silencioso. En Impacto Comercial o Audaz Gráfico, el mismo espacio negativo generoso sería un error de diseño, no una mejora.

### 5.4 Formas de troquel

- Círculo: familia por defecto para productos "de mesa" (frascos, latas circulares) — Artesanal Cálido, Elegante Personal.
- Rectángulo vertical/horizontal: familia Audaz Gráfico (etiquetas envolventes) y Técnico Funcional.
- Formas personalizadas (rombo, faja con muescas, corazón, estrella): reservadas a casos donde la forma física del producto o una convención normada lo exige — nunca una decisión estética libre; cada forma personalizada del catálogo hasta ahora está justificada por una restricción física real (la barra de jabón) o normativa (el rombo hazmat).

---

## 6. Fotografía de mockup

### 6.1 Convenciones de iluminación por familia

| Familia | Luz | Ángulo | Props |
|---|---|---|---|
| Artesanal Cálido | Natural cálida difusa (~3500K simulados), direccional suave | 3/4, nunca frontal plana | Elementos del ingrediente real, desenfocados, nunca en foco pleno |
| Lujo Silencioso | Estudio uniforme, sin sombras marcadas | Frontal recta | Ninguno — el vacío alrededor del producto es intencional |
| Audaz Gráfico | Estudio de alto contraste, sombras duras | Frontal recta (cerveza) o 3/4 con dramatismo (salsa) | Props en foco pleno permitido solo si refuerzan directamente el mensaje (chiles frescos junto a la salsa) |
| Técnico Funcional | Iluminación de planta/almacén, dura y direccional | Recta, aplicada sobre la superficie real | Ninguno decorativo — el contexto de aplicación real es la única escenografía necesaria |
| Elegante Personal | Suave, íntima, de escritorio | 3/4 o frontal según objeto | Mínimos, coherentes con objeto personal (espejo, tarjeta) |
| Impacto Comercial | Plana y uniforme, tipo iluminación de tienda | Frontal, sobre estante | Producto genérico de contexto, desenfocado |

### 6.2 Regla transversal

Ningún mockup del catálogo usa fotografía de stock genérica reconocible ni props de otra categoría (la salvedad explícita documentada en el template de Jabón: "el mismo lenguaje de mockup artesanal usado en miel, pero con props propios de jabonería — nunca reutilizar props de otra categoría"). Cada mockup se diseña desde la lógica de su propia familia, no se recicla de otro template por conveniencia.

---

## 7. Texturas

Las texturas en THÖREN son **funcionales, no decorativas por defecto** — de hecho, la ausencia de textura es la opción más común (Lujo Silencioso, Impacto Comercial, Elegante Personal no usan ninguna). Cuando se usa, sigue esta escala de intensidad:

| Intensidad | Uso | Ejemplo |
|---|---|---|
| Sutil (4-8% opacidad) | Reforzar calidez artesanal sin volverse protagonista | Grano de papel (café), tinta de sello (calidad industrial) |
| Pronunciada (12-18% opacidad) | La textura ES parte del argumento de venta ("artesanal", "reciclado") | Papel kraft del jabón en barra |
| Funcional/técnica | Simula un material real para integración visual con el objeto físico | Superficie metálica cepillada (identificación industrial) |
| Ninguna | Default para familias donde la textura restaría sofisticación o claridad | Serum, Spa, Advertencia, Rombo Normado, Oferta |

**Regla**: la textura nunca se aplica sobre el propio texto (pierde legibilidad) y nunca se usa "para llenar espacio" — si un template se siente vacío, la solución de este sistema es siempre aumentar tipografía o aire, nunca agregar una textura de relleno.

---

## 8. Thumbnails para Template Library

- **Regla base**: recorte cerrado sobre el sticker/etiqueta solo (no el mockup completo), ocupando ~80% del cuadro, sobre fondo sólido de un color de la propia paleta del template.
- **Excepción de escala**: en formatos diminutos (Aceite Esencial 25mm, Bálsamo Labial 20mm), el thumbnail se escala deliberadamente por encima de su proporción real frente a otros templates de la grilla, para preservar legibilidad — documentado como excepción consciente, no como inconsistencia.
- **Excepción de familia**: Audaz Gráfico (cerveza) es la única familia donde se recomienda mostrar el contraste alto ya desde el thumbnail como la propuesta de valor central, en vez de la neutralidad de fondo sólido estándar.
- **Excepción de objeto físico**: Jabón en Barra es el único template donde el thumbnail muestra el producto físico completo (barra + faja), no solo el diseño plano, porque la faja únicamente se entiende en contexto de la barra.
- **Prueba de validación transversal**: si el contenido esencial (nombre, ícono si aplica) no se lee a 150-200px de ancho, la solución es siempre subir el tamaño de fuente del layout real — nunca recortar más el thumbnail ni reducir el margen del template para "que quepa mejor".

---

## 9. Voz y tono comercial (Commercial Sheet)

Con la incorporación de la sección Commercial Sheet desde Batch 02, THÖREN también tiene una voz escrita consistente, no solo una identidad visual. Reglas ya aplicadas en los 15 Commercial Sheets producidos hasta ahora (Batch 02-04):

- **Elevator Pitch**: siempre 2 líneas máximo, siempre nombra el objeto físico + el beneficio, nunca lenguaje vago tipo "eleva tu marca" sin especificar cómo.
- **Beneficio principal**: siempre responde "por qué alguien elegiría esto" en términos concretos (ahorro de tiempo, percepción de precio, reconocimiento instantáneo) — nunca adjetivos sueltos sin mecanismo (evitar "hermoso", "único" sin explicar el mecanismo detrás).
- **Call to Action**: siempre una frase corta, en segunda persona implícita, que conecta la acción del producto físico del cliente con el sticker — nunca un CTA genérico de e-commerce ("¡Cómpralo ya!").
- **Palabras clave SEO**: siempre 15-25, siempre mezclando términos genéricos de categoría con términos específicos del template (nombre de ingrediente/aroma/uso), nunca solo términos genéricos repetidos con sinónimos vacíos.
- **Nombre comercial**: siempre un nombre de 1-3 palabras + descriptor corto (ej. "Ritual — Etiqueta de Té de Hierbas"), nunca el nombre técnico del catálogo reutilizado tal cual.

Esta voz comercial, igual que la identidad visual, varía en tono según la familia de lenguaje (Lujo Silencioso usa un tono más contenido y menos exclamativo que Impacto Comercial), pero mantiene siempre esta misma estructura de 11 campos.

---

## 10. Checklist de consistencia para templates nuevos

Antes de dar por completo el diseño de cualquier template nuevo (dentro del catálogo v1 restante o fuera de él en el futuro), validar:

□ ¿A qué una de las 6 familias de lenguaje visual (§1) pertenece? Si no encaja claramente en ninguna, escalar antes de continuar (ver §11).
□ ¿Usa como máximo 1 tipografía de carácter + 1 de apoyo? (§2.2)
□ ¿Usa exactamente 3 colores base (+ opcionalmente 1 acento variable)? (§3.1)
□ ¿El nivel de reducción de su ilustración/ícono corresponde a su familia? (§4.3)
□ ¿Usa un solo ícono/ilustración protagonista? (§4.2)
□ ¿Respeta sangrado 3mm y área segura 3mm sin excepción? (§5.1)
□ ¿Su densidad de espacio negativo corresponde a su familia (no asume que "más aire" siempre es mejor)? (§5.3)
□ ¿Su mockup sigue la convención de luz/ángulo/props de su familia, sin reciclar props de otra categoría? (§6)
□ ¿Su uso de textura (o ausencia) corresponde a su familia? (§7)
□ ¿Su Commercial Sheet sigue la estructura de voz de §9?

Si todas las respuestas son "sí", el template es consistente con el lenguaje visual THÖREN. Si alguna respuesta requiere una excepción, esa excepción debe **justificarse explícitamente en la sección 10 (Nivel de calidad) del documento del template**, siguiendo el mismo patrón ya usado en las excepciones documentadas de este catálogo (ej. por qué Jabón en Barra sí necesita textura pronunciada, por qué Cerveza sí usa monoespaciada pese a ser familia Audaz Gráfico).

---

## 11. Gobernanza del documento

- Este documento describe decisiones ya tomadas — no es una restricción nueva impuesta retroactivamente. Los 20 templates de Batch 01-04 ya cumplen con todo lo aquí escrito; este documento simplemente lo hace explícito y consultable.
- **Cuándo actualizar este documento**: si un template futuro requiere una 7ª familia de lenguaje visual, un 5º rol tipográfico, o una regla de color/textura que no encaja en las ya descritas, esa decisión se documenta primero aquí (como una adición a este Design Language Guide) antes de aplicarse al template en cuestión — nunca al revés. Esto evita que la identidad visual de THÖREN se fragmente template por template sin registro central.
- **Relación con otros documentos**: este documento no reemplaza ni contradice `TEMPLATE_LIBRARY_ARCHITECTURE.md` (arquitectura de datos/sistema), `TEMPLATE_CATALOG_v1.md` (qué templates existen), `UX_TEMPLATE_LIBRARY.md` (cómo se navega/busca la librería) ni `ROADMAP_TEMPLATE_SYSTEM.md` (cuándo se construye cada cosa) — es un documento paralelo y complementario, exclusivamente de identidad visual, que ninguno de los otros cuatro cubre en este nivel de detalle.
- **No es una autorización de producción real.** Igual que todo el trabajo de Epic 8 y Epic 9, este documento es diseño/especificación — ningún asset fue producido, ningún archivo de código fue tocado.

---

## Resumen de una línea por sección

| Sección | En una frase |
|---|---|
| §1 | 6 familias de lenguaje visual, no un solo estilo — la restricción es lo que las une. |
| §2 | 4 roles tipográficos, nunca 2 display juntos, la familia determina la fuente. |
| §3 | 3 colores fijos + 1 acento variable opcional, nunca 4+ colores fijos. |
| §4 | 5 niveles de reducción de ilustración, un solo ícono protagonista por template. |
| §5 | Sangrado/área segura 3mm siempre; densidad de espacio negativo varía por familia. |
| §6 | Luz/ángulo/props de mockup siguen convención de familia, nunca se reciclan entre categorías. |
| §7 | Textura es la excepción, no la norma; cuando se usa, es funcional. |
| §8 | Thumbnail 80% del cuadro, con excepciones documentadas por escala/familia/objeto físico. |
| §9 | La voz comercial tiene la misma disciplina que la identidad visual. |
| §10 | Checklist de 10 preguntas para validar cualquier template nuevo. |
| §11 | Este documento crece por adición documentada, nunca por fragmentación silenciosa. |
