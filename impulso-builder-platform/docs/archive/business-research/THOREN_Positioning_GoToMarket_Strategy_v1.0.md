> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Investigación de mercado / estrategia comercial escrita para Sticker Builder como producto independiente vendido por separado — premisa contradicha por `../product/THOREN_PRODUCT_DIRECTION.md` (escenario D, aprobado). Se conserva íntegro como insumo de referencia (la investigación de mercado en sí sigue siendo informativa), nunca como fuente vigente de estrategia comercial de THÖREN — si THÖREN necesita una estrategia comercial propia en el futuro, se redacta de cero. Ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# THÖREN Positioning & Go-To-Market Strategy v1.0

**Documento estratégico de nivel ejecutivo.** Consolida y extiende los documentos de negocio previos (`01-Positioning.md`, `02-Ideal-Customer-Profiles.md`, `03-Competitive-Landscape.md`, `04-Unique-Value-Proposition.md`) a la luz de dos hechos nuevos: el documento fundacional **THÖREN Product Strategy v1.0** (misión, visión, arquitectura de marca, ecosistema) y el cierre de la versión comercial **THÖREN Sticker Builder v1.0.0** (ver `PROJECT_STATUS.md`). No reemplaza esos documentos — los usa como insumo y, donde hay tensión entre lo escrito antes (bajo el nombre "Impulso") y la estrategia de marca THÖREN, la resuelve explícitamente en este documento.

Toda afirmación de mercado o competencia está respaldada por fuente pública (ver notas al pie de cada capítulo). Toda conclusión que dependa de validación con clientes reales — que THÖREN todavía no tiene — se marca explícitamente **[HIPÓTESIS]**, siguiendo la misma disciplina de `03-Competitive-Landscape.md`. Este documento no decide un precio ni fija una fecha de lanzamiento; entrega el marco de decisión y, en el cierre, una recomendación personal de qué haría yo en el rol de CEO.

Alcance: se escribe con la información disponible en julio de 2026, para el primer producto del ecosistema (THÖREN Sticker Builder). No es un documento técnico — donde se referencia una capacidad del producto, se cita `PROJECT_STATUS.md`/`HANDOFF.md` en vez de repetir el detalle de ingeniería.

---

## 1. Executive Summary

THÖREN entra a un mercado que ya está resuelto en apariencia — sobran editores de diseño — pero mal resuelto en el problema específico que un vendedor de productos físicos/imprimibles enfrenta todos los días: convertir una idea en un archivo que una imprenta acepte sin devolución, sin reprocesos, sin adivinar. Canva y Affinity (ahora gratuita bajo Canva) dominan el diseño generalista; Illustrator domina la producción profesional pero con una curva de aprendizaje que expulsa a quien no es diseñador de oficio; Cricut Design Space y Silhouette Studio dominan el "hazlo tú mismo" pero están construidos alrededor de vender una máquina de corte, no de resolver impresión en general; Inkscape es gratis y potente, pero frágil exactamente donde más importa (medidas de impresión reales) y sin ninguna curva de aprendizaje suavizada.

Ninguno de los seis está diseñado, desde su modelo de datos, para la pregunta que realmente hace un emprendedor creativo: *"¿este archivo va a salir bien impreso, sí o no?"* THÖREN Sticker Builder responde esa pregunta con datos verificables (sangrado, líneas de corte reales, Preflight con 44 códigos explicados en texto), no con una guía visual que hay que interpretar a ojo.

La oportunidad no es robarle usuarios avanzados a Illustrator ni pelear por el usuario masivo de Canva/Affinity. Es capturar al segmento intermedio, hoy mal servido: alguien con un negocio real (Etsy, Gumroad, Mercado Libre, tienda propia) que necesita producir con velocidad y confiabilidad, no aprender una suite profesional ni resignarse a un archivo "más o menos imprimible". THÖREN Sticker Builder es hoy la puerta de entrada a ese segmento; el ecosistema (Planner, Worksheet, Journal, Coloring, Mockup Builder) es la apuesta de que ese mismo emprendedor volverá a comprar cuando THÖREN resuelva su siguiente producto con el mismo rigor.

La recomendación central de este documento: lanzar rápido, con una oferta de "Early Adopter" que compre confianza y testimonios reales (no ingresos altos) durante los primeros 90 días, medir obsesivamente conversión y retención de uso —no solo ventas—, y no invertir en el segundo Builder del ecosistema hasta tener evidencia real de que el primero se vende y se usa solo, sin la mano del equipo empujando cada venta.

## 2. Market Analysis

### Tamaño del mercado

La economía de creadores alcanzó aproximadamente **USD 290–390 mil millones en 2026**, según la fuente consultada, con proyecciones de crecimiento a un CAGR de 23–30% hacia el final de la década¹. Dentro de esa economía, los **productos digitales** (plantillas, imprimibles, herramientas, cursos) son el segmento de más rápido crecimiento fuera de patrocinios/publicidad: estimaciones públicas los ubican entre **USD 32 mil millones y USD 124 mil millones** según qué se incluya en la definición, creciendo **22–28% año contra año** — casi el doble de la tasa de la economía de creadores en general².

**[HIPÓTESIS]** No existe una fuente pública que aísle específicamente "stickers/imprimibles listos para producción física" dentro de ese total — la cifra real del subsegmento exacto de THÖREN no está medida por nadie todavía. Lo que sí es un hecho verificable: el segmento de productos digitales/imprimibles crece más rápido que el promedio del mercado en el que compite, y ninguna de las fuentes consultadas muestra señales de desaceleración.

### Tendencias relevantes para THÖREN

- **Democratización + profesionalización simultáneas.** Cada vez más personas sin formación en diseño venden productos físicos/imprimibles (impulsado por Etsy, Gumroad, TikTok Shop, Mercado Libre), y cada vez más esperan resultado profesional sin curva de aprendizaje — la misma tensión que resuelve la Filosofía THÖREN ("experiencia profesional sin curva de aprendizaje elevada").
- **Consolidación del diseño generalista gratuito.** El movimiento más disruptivo de 2026 es que Canva liberó Affinity por completo (Designer + Photo + Publisher fusionados en una sola app, gratis, sin límite de funciones core)³ — el terreno de "editor de diseño gratuito y potente" ya no tiene un vacío que llenar. Esto **valida** la estrategia THÖREN de no competir ahí (ver Capítulo 4) y la hace más urgente: pelear por ser "otro editor gratis" es ahora literalmente imposible de ganar contra Canva.
- **Fragmentación de herramientas por tipo de máquina, no por tipo de producto.** Cricut Design Space y Silhouette Studio están diseñados alrededor de vender/alimentar una máquina de corte física, no alrededor de resolver "impresión" en general — un usuario que solo quiere imprimir (no cortar con su propia máquina) queda mal servido por ambas. Esa fragmentación es exactamente el hueco donde entra THÖREN.
- **IA generativa como comoditización, no como diferenciador.** Canva, Kittl y Adobe ya integran IA generativa en el flujo (vectorizado, generación de imágenes, remoción de fondo)⁴ — para 2027 será tabla estacas, no ventaja. THÖREN no debe competir en "quién tiene mejor IA" (ver `docs/product/05-Technical-Debt.md`, AI Engine sigue siendo solo un concepto arquitectónico) sino en rigor de producción, donde la IA generativa no ayuda.

### Economía del creador — implicación directa para THÖREN

El comprador objetivo de THÖREN no es un "usuario de software" en el sentido tradicional — es un microempresario que evalúa cada herramienta por su retorno directo sobre tiempo y dinero. Esto tiene tres consecuencias de producto/precio concretas: (1) el pago único encaja mejor que la suscripción con la psicología de "esto es una herramienta de mi negocio, no un gasto recurrente de software", (2) la disposición a pagar está atada a evidencia de ahorro de tiempo real, no a la lista de funciones, y (3) el canal de descubrimiento más efectivo no es publicidad paga genérica sino comunidades y creadores ya presentes en el mismo ecosistema (ver Capítulo 10).

---

¹ Creator Economy Market Report 2026 (Research and Markets); Creator Economy Market Size & Share (Research Nester); Fortune Business Insights, Creator Economy Market.
² Digital Product Trends 2026 (Behind The Scenes); Digital Product Market Size 2026 (InsightRaider); Creator Economy Statistics 2026 (Yahoo Finance/agregador).
³ "Why we made Affinity free, and how we'll keep it that way" (Canva Newsroom, 2026); "Introducing the all-new Affinity" (Canva Newsroom, 2026).
⁴ Ver Capítulo 3 (Competitor Analysis) para el detalle por competidor.

## 3. Competitor Analysis

Análisis de los seis competidores solicitados. A diferencia de `03-Competitive-Landscape.md` (que cubre Canva/Kittl/Creative Fabrica/Placeit, competidores del "espacio POD/merch"), este capítulo cubre el eje **"herramienta de creación/producción"** — el eje en el que THÖREN Sticker Builder compite más directamente.

### Canva (incluye Affinity, ahora de su propiedad)

- **Fortalezas:** alcance masivo (cientos de millones de usuarios), biblioteca de plantillas y contenido premium enorme, marca sinónimo de "editor de diseño" fuera del círculo de diseñadores, y desde 2026 posee además Affinity — cubriendo tanto el extremo "fácil" (Canva) como el extremo "semi-profesional gratis" (Affinity) del mercado.
- **Debilidades:** no genera líneas de corte reales — su propia ayuda lo reconoce: "Canva doesn't generate cut lines as Illustrator does"⁵; el usuario debe simular el die-line a mano con una capa que es solo una guía visual, no un dato de producción. Generalista por diseño: ningún flujo está pensado para las reglas físicas de un sticker (sangrado real, troquelado, materiales).
- **Posicionamiento:** "la herramienta de diseño para todo, para todos" — precisamente lo que la Filosofía THÖREN rechaza construir.
- **Precio:** Free / Pro USD 15/mes / Business USD 20 por asiento/mes; Affinity (Designer+Photo+Publisher fusionados) ahora **completamente gratis**, con funciones de IA generativa reservadas a Canva Premium⁶.
- **Público objetivo:** masivo y heterogéneo — freelancers, marketers, creadores de contenido, pequeños negocios, estudiantes. No especializado en producción física.

### Adobe Illustrator

- **Fortalezas:** el estándar profesional de la industria para trabajo vectorial de producción — control absoluto de curvas Bézier, color, tipografía, preflight de impresión avanzado, e interoperabilidad total con flujos de imprenta profesional (CMYK, Pantone, perfiles ICC). Cualquier imprenta comercial seria sabe trabajar con un archivo de Illustrator.
- **Debilidades:** curva de aprendizaje pronunciada — no es una herramienta pensada para alguien sin formación de diseño; requiere entender conceptos (trazado, plumas, paneles de color, unión de rutas) que un emprendedor sin ese background no tiene tiempo ni interés en aprender. Sin plan gratuito permanente (solo prueba gratuita)⁷. Ningún flujo dedicado a "sticker" específicamente — el usuario debe construir sus propias guías de sangrado/troquelado desde cero cada vez, sin ayuda de la herramienta.
- **Posicionamiento:** la navaja suiza profesional — potencia total, sin especialización en ningún tipo de producto.
- **Precio:** sin plan gratuito permanente; planes de USD 22.99/mes (app única, compromiso anual) hasta USD 37.99–99.99/mes en planes de equipo/Creative Cloud completo, con variantes mes a mes más caras⁸.
- **Público objetivo:** diseñadores gráficos profesionales, estudios, agencias — personas para quienes el dominio de la herramienta ES el trabajo, no un medio para otro fin.

### Affinity (Designer/Photo/Publisher — ahora unificado y gratuito, propiedad de Canva)

- **Fortalezas:** calidad profesional real (motor vectorial/raster/maquetación comparable a Illustrator/Photoshop/InDesign) ahora **sin costo alguno** — el cambio de posicionamiento más agresivo del mercado en 2026. Un único app unifica los tres estudios (Píxel/Vector/Layout).
- **Debilidades:** hereda la misma curva de aprendizaje de una herramienta profesional generalista — "gratis" no resuelve "especializado". Ninguna función dedicada a sangrado/troquelado/imposición para productos físicos de nicho; sigue siendo una herramienta de diseño general, ahora sin el filtro de precio que antes limitaba su adopción masiva. Funciones de IA generativa quedan detrás de Canva Premium, de pago.
- **Posicionamiento:** "el poder profesional de Illustrator/Photoshop, sin pagar nada" — ahora la alternativa gratuita más creíble a Adobe.
- **Precio:** Gratis (app unificada Designer+Photo+Publisher); funciones de IA generativa requieren Canva Premium⁹.
- **Público objetivo:** diseñadores y semi-profesionales que antes pagaban por Affinity o evaluaban dejar Adobe — un público más capacitado técnicamente que el comprador típico de THÖREN.

### Cricut Design Space

- **Fortalezas:** integración perfecta con el hardware Cricut (el "cómo" de cortar ya está resuelto), enorme biblioteca de contenido bajo Cricut Access, comunidad masiva de makers/crafters, curva de aprendizaje baja para proyectos simples.
- **Debilidades:** es, en esencia, **el software complementario de una máquina de corte**, no una herramienta de diseño/producción independiente — su valor colapsa si el usuario no posee (o no piensa comprar) un cortador Cricut. El plan gratuito exige pagar por contenido (Cricut Access) para desbloquear la mayoría de la biblioteca¹⁰. No está pensado para preparar un archivo que se envíe a una imprenta externa de stickers — su output está optimizado para su propio flujo de corte, no para exportación print-ready agnóstica de proveedor.
- **Posicionamiento:** el software que hace funcionar tu máquina Cricut — no una herramienta de diseño en sí misma.
- **Precio:** Design Space gratis; Cricut Access Standard ≈USD 7.99–9.99/mes, Premium ≈USD 9.99–14.99/mes (según facturación anual o mensual)¹¹.
- **Público objetivo:** dueños de una máquina Cricut — crafters hobbyistas y algunos micro-negocios de personalización que cortan vinil/papel en casa.

### Silhouette Studio

- **Fortalezas:** mismo modelo que Cricut pero para el ecosistema Silhouette — Business Edition (pago único, no suscripción) desbloquea exportación SVG/PNG/JPEG/PDF, herramientas avanzadas de corte, anidado y soporte multi-máquina¹².
- **Debilidades:** la versión gratuita/básica **no exporta a los formatos que una imprenta necesita** (SVG/PDF quedan detrás del pago de Business Edition) — una barrera dura para cualquiera que solo quiera un archivo de impresión, no cortar en su propia máquina Silhouette. Igual que Cricut, está diseñada alrededor de una máquina física, no de la impresión como caso de uso independiente.
- **Posicionamiento:** el software de diseño de la marca Silhouette, con un "modo profesional" de pago para desbloquear exportación real.
- **Precio:** versión básica gratis (con el hardware); Business Edition ≈USD 99 pago único (a veces en oferta ≈USD 50)¹³.
- **Público objetivo:** dueños de máquinas Silhouette, muy solapado con el público de Cricut — crafters y micro-negocios de personalización con equipo de corte propio.

### Inkscape

- **Fortalezas:** 100% gratuito y de código abierto, motor vectorial real (no una imitación) con soporte SVG nativo, comunidad activa, sin ningún candado comercial.
- **Debilidades:** limitaciones documentadas y recurrentes específicamente en impresión — reportes públicos de objetos que cambian de tamaño al imprimir/exportar incluso indicando "no escalar", y de documentos que se recortan al imprimir tamaños no estándar¹⁴ — exactamente el tipo de falla que un archivo de producción física no puede tener. Sin ningún asistente de sangrado/troquelado/imposición para productos físicos: cualquier configuración de impresión se arma manualmente, guía por guía, con el mismo riesgo de error humano que Illustrator pero sin el ecosistema profesional de soporte/plugins de Adobe detrás. Curva de aprendizaje real para quien no tiene experiencia vectorial previa.
- **Posicionamiento:** la alternativa gratuita y de código abierto a Illustrator — potente, pero sin pulir para ningún caso de uso específico.
- **Precio:** Gratis.
- **Público objetivo:** usuarios técnicos, makers, y quienes rechazan por principio pagar por software de diseño — un público más técnico que el comprador típico de THÖREN, y menos dispuesto a pagar por cualquier herramienta.

### Tabla comparativa

| | Canva | Illustrator | Affinity | Cricut Design Space | Silhouette Studio | Inkscape |
|---|---|---|---|---|---|---|
| **Línea de corte real** | No (guía manual) | Sí (manual, sin asistente) | Sí (manual, sin asistente) | No (optimizado para su propio corte) | Solo en Business Edition | Sí (manual, con bugs de escala documentados) |
| **Curva de aprendizaje** | Baja | Alta | Alta | Baja (si tienes la máquina) | Media | Alta |
| **Atado a hardware propio** | No | No | No | Sí (Cricut) | Sí (Silhouette) | No |
| **Modelo de precio** | Freemium | Suscripción, sin free permanente | Gratis | Freemium + contenido de pago | Gratis básico + pago único avanzado | Gratis |
| **Rigor de producción física** | Bajo | Alto (manual) | Alto (manual) | Bajo (fuera de su propio corte) | Medio | Medio (con bugs conocidos) |

---

⁵ Canva Help Center, "Use margins, bleed, rulers, and crop marks"; StickerGiant, "Create Print-Ready Sticker Files in Canva".
⁶ AI Productivity, "Canva Pricing 2026"; CheckThat.ai, "Canva Pricing 2026".
⁷ Adobe Community; CheckThat.ai/ComparEdge, "Adobe Illustrator Pricing 2026".
⁸ Ídem.
⁹ Canva Newsroom, "Why we made Affinity free, and how we'll keep it that way" (2026); "Introducing the all-new Affinity" (2026).
¹⁰ Cricut Help Center, "What is Cricut Access?"; Cuttabl, "Cricut Access Plans Compared".
¹¹ Ídem.
¹² Cutting for Business, "Silhouette Studio Business Edition — What Is It & How Much Does It Cost?"; Silhouette America, oficial.
¹³ Ídem; Silhouette School Blog, 2026.
¹⁴ Foros públicos de Inkscape (Launchpad Answers, Inkscape Mailman) — reportes de usuario recurrentes sobre escalado/recorte al imprimir.

## 4. Competitive Positioning

### ¿Por qué existe THÖREN?

Porque hoy, preparar un producto físico de nicho para producción real obliga a elegir entre dos extremos igual de malos: una herramienta profesional (Illustrator, Affinity) con todo el poder pero ninguna guía — el usuario construye su propio sangrado/troquelado a mano, cada vez, con el riesgo de error que eso implica — o una herramienta casual/atada a hardware (Canva, Cricut, Silhouette) que no modela la producción física como un dato real, sino como una guía visual o una función secundaria de vender una máquina.

THÖREN Sticker Builder no es "Illustrator simplificado" ni "Canva con más funciones de impresión". Es la única herramienta analizada donde el sangrado, la línea de corte y el Preflight son parte del modelo de datos desde el primer diseño (ver `docs/adr/`, Document Schema) — no una capa añadida a un editor que originalmente no pensaba en esto.

### ¿Por qué alguien debería usar THÖREN aunque ya tenga Illustrator o Canva (ahora con Affinity gratis)?

**Si ya tiene Illustrator/Affinity:** porque no está comprando "otro editor vectorial" — está comprando el tiempo que hoy gasta reconstruyendo manualmente sangrado, troquelado y verificación de impresión en cada archivo. THÖREN convierte ese trabajo repetitivo en un asistente guiado de 7 pasos con validación explicada en texto. Illustrator/Affinity siguen siendo superiores para ilustración libre y trabajo creativo complejo — THÖREN no compite ahí (ver "Qué jamás intentaremos competir" en `01-Positioning.md`) y de hecho puede convivir con ellos: el diseñador ilustra en su herramienta de siempre y usa THÖREN para el último tramo, el de producción.

**Si ya tiene Canva (o Affinity gratis):** porque ninguna de las dos genera una línea de corte real — el usuario sigue exportando "más o menos imprimible" y descubriendo el problema cuando la imprenta rechaza el archivo o el resultado físico no coincide con lo esperado. THÖREN cambia la pregunta de "¿espero que esto salga bien impreso?" a "el Preflight ya me dijo, en español simple, qué está mal antes de gastar en imprimir".

**[HIPÓTESIS]** que este argumento convenza a un comprador que todavía no tuvo una mala experiencia de impresión — es más persuasivo para quien YA perdió tiempo/dinero con un archivo rechazado que para un comprador de primera vez sin ese dolor todavía vivido. Esto debe validarse en el copy real de venta (ver Capítulo 6, mensajes) y en las primeras conversaciones de venta reales.

## 5. Ideal Customer Profiles

Se detallan cuatro personas, alineadas con los cuatro segmentos del documento fundacional THÖREN Product Strategy v1.0, con matices específicos para Sticker Builder (el ecosistema completo servirá a los cuatro segmentos a través de distintos Builders futuros).

### Persona 1 — "Marisol, la Emprendedora Creativa" (cliente principal)

- **Perfil:** 28-45 años, vende stickers/pegatinas personalizadas en Etsy y/o Mercado Libre, a veces también en su propia tienda Shopify. Empezó como hobby, hoy es un ingreso real (parcial o de tiempo completo).
- **Herramientas actuales:** probablemente Canva (por accesibilidad) o Affinity gratis desde hace poco; en algunos casos "algo de Illustrator" aprendido a medias, o directamente le paga a alguien más para preparar el archivo de impresión.
- **Mayor frustración:** no le falta creatividad, le falta tiempo — cada sticker nuevo implica reconstruir sangrado/troquelado desde cero, o enviar el archivo a la imprenta y esperar que no lo rechacen.
- **Qué la haría comprar THÖREN:** ver, en un video/demo de 60 segundos, que el asistente de exportación hace en minutos lo que hoy le toma media tarde y varios intentos fallidos.
- **Objeción más probable:** "¿esto realmente funciona con MI imprenta?" — se resuelve con Preflight explicado en texto simple y con casos de uso reales, no con jerga técnica.

### Persona 2 — "Profe. Andrea, la Docente"

- **Perfil:** profesora de primaria o secundaria, crea material educativo (etiquetas, calcomanías de motivación, recursos visuales de aula) para imprimir en la escuela o en un servicio local.
- **Herramientas actuales:** Canva (casi universal en el sector educativo), a veces PowerPoint para maquetar.
- **Mayor frustración:** no tiene tiempo ni interés en aprender software "de diseñador" — necesita resultado rápido y bonito, sin curva de aprendizaje.
- **Qué la haría comprar THÖREN:** mensaje de "resultado profesional sin aprender diseño" — el mismo lenguaje que ya usa con Canva, pero con salida imprimible confiable.
- **Objeción más probable:** precio — su presupuesto personal para herramientas de aula es bajo; un pago único barato pesa más que cualquier otra consideración.

### Persona 3 — "Negocio de Personalización DTF/Sublimación/Corte Láser"

- **Perfil:** micro-negocio o freelancer que produce regalos personalizados, promocionales, sublimación, DTF UV, corte láser — para clientes propios, no para vender diseños en marketplaces.
- **Herramientas actuales:** frecuentemente una mezcla — Illustrator/CorelDRAW para quien tiene formación, o el software de su propia máquina de corte/impresión (RIP software, Cricut/Silhouette si también cortan).
- **Mayor frustración:** preparar archivos rápido, para pedidos variados, sin reprocesar por errores de sangrado/tamaño — el tiempo de preparación de archivo es tiempo no facturable.
- **Qué la haría comprar THÖREN:** velocidad de preparación de archivo por pedido — el Preflight y los perfiles predefinidos (Digital PNG/Print PDF/Sticker Sheet) reducen el tiempo de "de idea a archivo listo" de forma medible.
- **Objeción más probable:** "ya tengo mi flujo con [Illustrator/CorelDRAW/software de mi máquina], ¿por qué cambiar?" — se resuelve posicionando THÖREN como complemento del último tramo (preparación/impresión), no reemplazo del diseño creativo.

### Persona 4 — "Diego, el Diseñador Freelance"

- **Perfil:** diseñador profesional con Illustrator/Affinity ya dominado, que atiende clientes de stickers/etiquetas entre otros encargos.
- **Herramientas actuales:** Illustrator o Affinity como herramienta principal — domina la técnica, pero prepara sangrado/troquelado a mano cada vez.
- **Mayor frustración:** repetir trabajo mecánico de preparación de impresión que no requiere su criterio creativo, solo tiempo.
- **Qué lo haría comprar THÖREN:** THÖREN no sustituye su herramienta principal, la complementa — usa Illustrator para el diseño y THÖREN para acelerar el último tramo (sangrado/troquelado/Preflight/imposición en hoja) en encargos de volumen.
- **Objeción más probable:** "yo ya sé hacer esto en Illustrator" — cierto, pero no rápido; el argumento de venta es tiempo ahorrado por encargo, no capacidad nueva.

**[HIPÓTESIS]** Los cuatro perfiles están descritos con el conocimiento del documento fundacional y patrones de mercado públicos, no con entrevistas reales de clientes THÖREN — deben validarse (o corregirse) con las primeras ventas y conversaciones de soporte reales.

## 6. Value Proposition

> **THÖREN convierte una idea en un archivo listo para vender — sin curva de aprendizaje, sin adivinar si va a imprimir bien.**

Una frase, sin cliché ("revoluciona", "todo en uno", "lleva tu creatividad al siguiente nivel" quedan fuera deliberadamente): nombra la acción (convierte idea en archivo listo para vender), nombra a quién no es diseñador (sin curva de aprendizaje), y nombra el dolor real y específico frente a Canva/Cricut/Silhouette/Inkscape (sin adivinar si va a imprimir bien).

## 7. Unique Selling Propositions

Ordenadas de mayor a menor peso de decisión de compra esperado:

1. **Preflight que explica en texto, no solo con color** — 44 códigos de validación, cada uno con una razón legible, antes de gastar en imprimir.
2. **Línea de corte como dato real, no una guía dibujada a mano** — modelada desde el propio archivo, no un truco de capas.
3. **Un asistente de 7 pasos reemplaza el trabajo manual de sangrado/troquelado/imposición** que Illustrator, Affinity e Inkscape exigen reconstruir cada vez.
4. **Pago único, sin suscripción** — encaja con la psicología de "herramienta de mi negocio", no "gasto mensual de software", a diferencia de Canva Pro/Business e Illustrator.
5. **No depende de comprar ninguna máquina** — a diferencia de Cricut Design Space y Silhouette Studio, funciona igual sin importar cómo o dónde se imprima.
6. **100% offline, sin cuenta, sin telemetría** — tus proyectos y tus diseños nunca salen de tu computadora salvo que tú los exportes.
7. **Curva de aprendizaje mínima frente a Illustrator/Affinity/Inkscape** — sin sacrificar el rigor de producción que Canva/Cricut/Silhouette no ofrecen.
8. **Imposición en hoja con reutilización real de raster** — prepara múltiples copias en una sola hoja de impresión sin trabajo manual de acomodo.
9. **Arquitectura pensada para un ecosistema**, no una herramienta aislada — quien compra hoy Sticker Builder es candidato natural al siguiente Builder (Planner, Worksheet, Journal, Coloring, Mockup) con la misma filosofía.
10. **Sin atarse a un servicio de impresión propio** — el archivo exportado es agnóstico de imprenta, a diferencia de ecosistemas cerrados (Kittl Print, o la dependencia de hardware de Cricut/Silhouette).

## 8. Pricing Strategy

No se decide un precio en este documento — se explican las estrategias disponibles con ventajas y riesgos, para decisión posterior explícita. Como referencia de trabajo previo ya hecho (no una decisión vigente): `GUMROAD_LAUNCH_PLAN.md` propuso en su momento USD 29 de catálogo con USD 19 de lanzamiento — un punto de partida razonable dentro de la estrategia "Early Adopter + Low Entry" descrita abajo, no una decisión final.

### Low Entry Price (precio de entrada bajo, ej. USD 9–19)

- **Ventajas:** fricción mínima de primera compra, volumen de reseñas/testimonios rápido, coherente con el perfil de "Profe. Andrea" (presupuesto bajo).
- **Riesgos:** ancla la percepción de valor del producto hacia abajo desde el día uno — subir precio después genera fricción con compradores tempranos; margen bajo dificulta financiar soporte/desarrollo del siguiente Builder; puede leerse como "herramienta barata" frente a un comprador que sí evalúa Illustrator/Affinity como alternativas serias.

### Premium (precio alto, ej. USD 79–149)

- **Ventajas:** financia mejor el desarrollo del ecosistema; posiciona THÖREN como herramienta profesional seria, coherente con la identidad de marca ("precisión, calidad, diseño profesional"); atrae al segmento de "Negocio de Personalización"/"Diseñador Freelance", con mayor disposición a pagar por ahorro de tiempo real.
- **Riesgos:** sin reputación de marca todavía, un precio alto sin evidencia social (reseñas, casos de uso) puede simplemente no convertir; el comprador puede comparar contra Affinity (ahora gratis) y percibir el precio como injustificado si no entiende la diferencia de propuesta de valor.

### Lifetime License (licencia de por vida, pago único más alto con promesa de actualizaciones futuras incluidas)

- **Ventajas:** coherente con la decisión ya tomada de "sin suscripción" (`licensingMode: "delivery-only"`); fuerte gancho de marketing ("paga una vez, es tuyo para siempre"); genera caja anticipada útil para financiar desarrollo.
- **Riesgos:** compromiso de soporte/actualización a largo plazo sin ingreso recurrente que lo sostenga — cualquier costo futuro de mantenimiento (nuevas versiones de navegador, nuevos requisitos) se financia solo con nuevas ventas, no con la base instalada; requiere pensar desde ya qué significa "actualización futura incluida" para no prometer de más (ver `docs/product/05-Technical-Debt.md`, sin instalador nativo ni firma de código todavía).

### Freemium (versión gratuita limitada + versión de pago)

- **Ventajas:** el modelo dominante y validado del mercado (Canva, Kittl, Cricut, Creative Fabrica lo usan); reduce fricción de descubrimiento a cero; genera el volumen de usuarios necesario para boca a boca.
- **Riesgos:** exige backend/gating real de capabilities, que hoy **no existe** (ver `docs/product/05-Technical-Debt.md`: "toda capability listada siempre está presente, el chequeo sería un no-op" — solo hay edición `"professional"`) — construirlo es trabajo de ingeniería real, no una casilla de configuración; corre el riesgo de canibalizar exactamente el segmento (rigor de producción) que hoy nadie gratuito resuelve bien, si el Preflight/exportación real queda detrás del muro de pago sin dejar suficiente valor gratis para convencer.

### Early Adopter (precio de lanzamiento temporal, sube después)

- **Ventajas:** exactamente el mecanismo ya propuesto en `GUMROAD_LAUNCH_PLAN.md` — reduce fricción de los primeros compradores sin anclar el precio de catálogo permanentemente abajo; genera urgencia legítima ("precio de lanzamiento, sube pronto") sin caer en descuentos falsos; produce las primeras reseñas reales rápido.
- **Riesgos:** mal ejecutado (fecha de fin que no se respeta, "lanzamiento" que dura meses) destruye la credibilidad del mecanismo para el propio ecosistema futuro — la promesa debe cumplirse literalmente la primera vez para que sea creíble la segunda.

**Recomendación de marco (no de número):** combinar **Early Adopter + Lifetime License**, exactamente como ya está decidido arquitectónicamente (`licensingMode: "delivery-only"`, sin suscripción) — un precio de catálogo "premium-accesible" (ni el extremo bajo ni el extremo alto) con una ventana de lanzamiento más barata, evaluando Freemium recién para el segundo Builder del ecosistema, cuando exista ya evidencia de qué funciones realmente separan a quien paga de quien no.

## 9. Launch Strategy — primeros 90 días

**Días 1–15 — Fundación de confianza, sin gastar en adquisición paga.**
Publicar en Gumroad y Bookfluence con el precio de lanzamiento. Activar 10-20 "early testers" reales (no pagados) del perfil Marisol/Diego — les interesa acceso anticipado más que dinero — a cambio de una reseña honesta. Publicar el material ya preparado en RC1 (descripción larga/corta, comparativas, FAQ — ver `docs/platform/GUMROAD_LAUNCH_PLAN.md`) revisado contra el lenguaje de este documento (Capítulos 4/6/7).

**Días 16–30 — Primera evidencia social.**
Recolectar las primeras 5-10 reseñas/testimonios reales. Publicar 1-2 casos de uso reales con capturas del producto terminado (sticker físico, no solo el archivo). Empezar contenido orgánico en los canales donde ya vive el público (Capítulo 10) mostrando el flujo de Preflight — es el momento más demostrable visualmente del producto.

**Días 31–60 — Fin del precio de lanzamiento, primera medición real.**
Subir al precio de catálogo con aviso explícito ("el precio de lanzamiento termina el [fecha]"). Medir conversión real de visitas→compra en Gumroad/Bookfluence. Empezar a segmentar qué persona (Capítulo 5) está comprando realmente, contrastado contra la hipótesis — corregir mensaje si el comprador real difiere del esperado.

**Días 61–90 — Decisión de continuar o ajustar.**
Con al menos 60 días de datos reales de conversión/uso/soporte, decidir: ¿el mensaje de valor (Capítulo 6) está funcionando o necesita reescritura? ¿qué objeciones reales aparecieron en soporte que este documento no anticipó? Producir el primer informe de métricas reales (Capítulo 13) y usarlo como input, no como celebración — este es el punto de decisión antes de invertir en el segundo Builder del ecosistema.

## 10. Marketing Channels

Priorizados por retorno esperado dado el perfil de cliente (Capítulo 5) y el estado actual de la marca (cero reputación, presupuesto de marketing no definido en este documento):

1. **Comunidades de nicho ya existentes (Etsy Seller groups, foros/Discord/Facebook de "sticker business", subreddits de crafters/POD).** Retorno esperado alto, costo bajo — es donde vive Marisol/el negocio de personalización, con intención de compra ya presente.
2. **Contenido orgánico en video corto (TikTok/Reels/YouTube Shorts) mostrando el flujo real** — "de idea a sticker impreso en X minutos", con el Preflight como momento demostrable. Retorno esperado alto a mediano plazo, costo bajo (tiempo, no dinero), pero requiere consistencia.
3. **Marketplaces de plantillas/creadores donde ya compra el público (Creative Fabrica, Gumroad Discover, Etsy)** vía colaboración o presencia, no necesariamente publicidad paga — aprovecha audiencia ya calificada.
4. **Partnerships con creadores/educadores de Etsy o print-on-demand** (micro-influencers reales del nicho, no celebridades) a cambio de licencia gratis + comisión de afiliado — coherente con "escucharemos primero al mercado" de la Cultura THÖREN.
5. **SEO de long-tail** ("cómo hacer líneas de corte para stickers", "sticker sheet imposición para imprenta") — retorno alto pero lento; empezar contenido ahora para rendimiento en 6-12 meses.
6. **Publicidad paga (Meta/Google Ads)** — priorizada al final deliberadamente: sin reputación de marca ni conversión medida todavía, gastar en adquisición paga antes del día 60 es apostar a ciegas. Reevaluar recién con datos reales de conversión orgánica (Capítulo 9, días 61-90).

**[HIPÓTESIS]** El orden de prioridad asume que el costo de adquisición pagado será alto relativo al ticket de un pago único de precio bajo/medio — debe confirmarse con los primeros datos reales de conversión antes de comprometer presupuesto de ads.

## 11. Product Roadmap Comercial

No técnico — la hoja de ruta de ingeniería vive en `docs/product/04-Roadmap.md`; esto es cómo crece el **negocio** THÖREN.

- **Ahora — Un solo producto, validar el modelo.** THÖREN Sticker Builder es la única fuente de ingreso y de aprendizaje real sobre el comprador. Ninguna decisión de expansión del ecosistema se toma sin datos reales de este primer producto.
- **Corto plazo (evidencia de 3-6 meses) — Decidir el segundo Builder con datos, no con preferencia interna.** El documento fundacional lista seis candidatos (Planner, Worksheet, Journal, Coloring, Mockup Builder, Template Library). La elección del segundo no debe basarse en cuál es más interesante de construir, sino en qué piden realmente los compradores de Sticker Builder en soporte/reseñas — validación de mercado antes que roadmap técnico, exactamente el principio ya adoptado en Fase 4.2 ("¿esto ayuda a vender/entregar/usar la primera copia?").
- **Mediano plazo — Ecosistema con reconocimiento cruzado.** Una vez exista un segundo Builder real, la propuesta comercial cambia de "compra una herramienta" a "THÖREN resuelve tu categoría de producto, la que sea" — el momento de introducir bundles/paquetes de varios Builders, y de evaluar con evidencia real (no antes) si un modelo de suscripción de acceso a todo el ecosistema tiene sentido frente al pago único por producto.
- **Largo plazo — THÖREN AI y Template Library como capas transversales.** Ambos, listados en el documento fundacional como parte del ecosistema, solo tienen sentido cuando ya existen 2-3 Builders reales generando datos/contenido que una capa de IA o una biblioteca compartida pueda potenciar — construirlos antes sería anticipación especulativa, exactamente lo que la Filosofía THÖREN rechaza ("no desarrollaremos funciones únicamente porque sean interesantes").

## 12. Riesgos

**¿Por qué podría fracasar THÖREN?**

1. **El dolor que resolvemos (rigor de producción) no pesa tanto como creemos en la decisión de compra real.** El comprador puede preferir "gratis y aproximado" (Canva/Affinity/Cricut/Silhouette) sobre "de pago y exacto" si nunca tuvo una mala experiencia de impresión costosa. Es el riesgo más grande de todo el documento — y el más barato de probar rápido (Capítulo 9, días 1-30).
2. **Affinity gratuito redefine la expectativa de precio de todo el mercado adyacente.** Si el comprador empieza a esperar "gratis" como default para cualquier herramienta de diseño, cualquier precio de THÖREN necesita un argumento de valor más fuerte que "es más barato que Illustrator".
3. **Sin marca ni reputación, el mensaje de diferenciación (Capítulo 4) puede no llegar antes de que el comprador ya haya decidido usar lo que ya conoce** (Canva, la máquina Cricut/Silhouette que ya compró). El costo de cambiar de herramienta, aunque THÖREN sea mejor, no es cero.
4. **Dependencia total de Gumroad/Bookfluence como únicos canales de venta** — sin presencia en marketplaces más grandes (Etsy no vende software, pero canales de descubrimiento alternativos no están definidos todavía más allá del Capítulo 10).
5. **Expandir el ecosistema antes de validar el primer producto** — el riesgo estructural más caro: construir el segundo/tercer Builder sin evidencia de que el primero se vende y se usa de forma sostenida, repitiendo el costo de desarrollo sin repetir el ingreso.
6. **Limitaciones técnicas conocidas que se vuelven objeciones de venta** — cross-browser sin verificar, sin coordinación multi-pestaña, dependencia de Python para el launcher de Windows (ver `PROJECT_STATUS.md`, "Riesgos conocidos") — ninguna es bloqueante hoy, pero cualquiera puede convertirse en una reseña negativa pública si un comprador real la encuentra sin haber sido advertido primero.

**¿Qué deberíamos validar antes de invertir más?**

- Que el mensaje "Preflight que explica en texto" realmente mueve una decisión de compra — no solo suena bien en este documento.
- Que existe al menos un canal de descubrimiento (Capítulo 10) con costo de adquisición sostenible, antes de gastar en publicidad paga.
- Que el precio elegido (cualquiera que sea) no es la razón principal de abandono en el checkout — hoy no hay ningún dato real de esto.
- Qué segunda categoría de producto pide realmente el comprador de Sticker Builder — antes de comprometer meses de desarrollo en un Builder específico.

## 13. Métricas de éxito — primeros 6 meses

**Adquisición**
- Visitas a la página de producto (Gumroad + Bookfluence) y tasa de conversión visita→compra.
- Costo de adquisición por canal (aun si es $0 en canales orgánicos — medir tiempo invertido como costo real).
- Fuente de cada venta (qué canal del Capítulo 10 la originó) — sin esto, no se puede repetir lo que funciona.

**Activación y uso real (la métrica más importante y la más fácil de ignorar)**
- % de compradores que efectivamente abren la aplicación y crean al menos un proyecto tras la compra — un producto "comprado pero no usado" no genera ni reseña ni recompra futura del ecosistema.
- % de compradores que completan al menos una exportación para impresión real (no solo PNG/SVG de pantalla) — es el corazón de la propuesta de valor; si este número es bajo, el problema es de onboarding, no de marketing.

**Retención de confianza**
- Reseñas/testimonios obtenidos y su contenido cualitativo — ¿mencionan el dolor específico que este documento identificó (Capítulo 4), o algo distinto?
- Tasa de reembolso y, más importante, el motivo declarado de cada reembolso — cada uno es una corrección gratuita a este documento.
- Volumen y naturaleza de tickets de soporte — qué objeción/confusión real aparece que el Capítulo 5/12 no anticipó.

**Señal de ecosistema**
- Cuántos compradores, sin que se les pregunte directamente, mencionan qué otro tipo de producto (planner, worksheet, journal, coloring, mockup) también crean o necesitarían — es el dato más valioso para el Capítulo 11, y no se puede fabricar, solo escuchar.

## 14. Conclusiones

THÖREN entra tarde al "mercado de editores de diseño" y a tiempo al mercado real que importa: emprendedores que necesitan producir, no diseñar, con la confianza de que el archivo va a funcionar la primera vez. Ese mercado creció más rápido que la economía de creadores en general durante los últimos años, y la consolidación reciente del extremo gratuito (Affinity) no lo amenaza — lo aclara: nadie más está resolviendo el problema de producción física con el mismo rigor de datos, para el comprador que no quiere convertirse en diseñador para vender su producto.

La ventaja de THÖREN no es tener más funciones que sus seis competidores analizados — es tener menos funciones, todas apuntando exactamente al mismo problema (rigor de producción sin curva de aprendizaje), en una arquitectura pensada desde el día uno para repetirse en un segundo, tercer y cuarto producto sin reconstruir el núcleo cada vez. Esa ventaja arquitectónica hoy es interna e invisible para el comprador — el trabajo de los próximos 90-180 días es traducirla en evidencia externa: reseñas reales, casos de uso reales, y datos reales de qué convierte y qué no.

### Recomendación personal — si yo fuera el CEO de THÖREN, ¿qué haría en los próximos 12 meses?

Lanzaría rápido y barato en confianza, no en precio. Publicaría ya, con el marco Early Adopter + Lifetime License descrito en el Capítulo 8 (sin obsesionarme con el número exacto — cualquier precio dentro del rango razonable importa menos que conseguir las primeras 20-30 ventas reales con seguimiento personal de cada una). Pasaría los primeros 60 días hablando directamente con cada comprador que me lo permita —no delegaría esa conversación a un formulario de soporte— porque el activo más valioso que THÖREN puede construir ahora no es ingreso, es verdad sobre quién compra, por qué, y qué casi le hizo no comprar.

No tocaría el segundo Builder del ecosistema durante al menos los primeros 6 meses, sin importar cuántas ganas de construir algo nuevo aparezcan — es la disciplina que ya demostró funcionar en el desarrollo técnico de este mismo producto (verificación real antes de avanzar, nunca alcance implícito) y es exactamente la misma disciplina que le falta a la mayoría de founders de software cuando llegan a la parte comercial: construyen el segundo producto para escapar de la incomodidad de vender el primero. Invertiría ese tiempo, en cambio, en tres cosas baratas y de alto retorno: (1) estar presente personalmente en 2-3 comunidades reales del Capítulo 10, no como vendedor sino aportando valor real antes de mencionar THÖREN; (2) grabar contenido de video mostrando el producto resolviendo un problema real de principio a fin, con la cámara puesta en el momento exacto donde Preflight explica un error en texto simple — es el momento más persuasivo de todo el producto y hoy nadie fuera de este equipo lo ha visto; y (3) instrumentar de verdad las métricas del Capítulo 13 desde el día uno, no como un ejercicio retrospectivo a los 6 meses.

Y trataría el primer reembolso, la primera reseña de una estrella, y la primera objeción repetida de soporte no como una mala noticia que gestionar, sino como el dato más caro y más valioso que THÖREN puede comprar en esta etapa — porque ningún documento de estrategia, por completo que sea, sustituye lo que un cliente real dice cuando algo no funcionó como esperaba.

---

*Este documento es la base de decisión comercial de THÖREN — no reemplaza `01-Positioning.md`/`02-Ideal-Customer-Profiles.md`/`03-Competitive-Landscape.md`/`04-Unique-Value-Proposition.md` (siguen vigentes como detalle de soporte del análisis frente a Canva/Kittl/Creative Fabrica/Placeit), los extiende con el eje de competidores de creación/producción y con la estrategia de salida al mercado. Se revisa — no se reescribe silenciosamente — cuando exista evidencia real de mercado que contradiga alguna de sus hipótesis marcadas.*
