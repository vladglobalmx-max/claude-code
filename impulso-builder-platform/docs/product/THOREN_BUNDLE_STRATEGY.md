# THÖREN Bundle Strategy v1.0

**Alcance: exclusivamente organización comercial del catálogo.** Este documento no modifica ningún template ya especificado (`TEMPLATE_BATCH_01.md` a `TEMPLATE_BATCH_10.md`), no modifica la arquitectura (`TEMPLATE_LIBRARY_ARCHITECTURE.md`), no modifica el roadmap (`ROADMAP_TEMPLATE_SYSTEM.md`), no modifica `THOREN_DESIGN_LANGUAGE_GUIDE.md`, `THOREN_PRODUCT_STRATEGY.md` ni `THOREN_LAUNCH_PLAYBOOK.md`. Documenta exclusivamente cómo se organizarían comercialmente los templates del catálogo — bundles por categoría, por industria, por perfil de cliente, bundles premium, upsell, cross-sell y orden recomendado de lanzamiento.

Este documento se produce en el punto acordado (Batch 10, 50 de 63 templates ya especificados) y extiende, sin contradecir, lo ya establecido en `THOREN_PRODUCT_STRATEGY.md` §6-8 (pricing preliminar de packs, estructura de packs, postura sobre Marketplace). Donde este documento profundiza en detalle no cubierto antes (segmentación por industria/perfil, mecánica de upsell/cross-sell, orden de lanzamiento), lo marca como nuevo.

---

## 0. Principio rector (heredado, no reinventado)

Todo lo que sigue está subordinado a 3 decisiones ya tomadas que este documento no puede ni debe contradecir:

1. **Pago único, sin suscripción** (ADR-0029) — ningún bundle de este documento se estructura como recurrencia.
2. **Un solo pack de prueba en v1.2, no un catálogo de packs completo** (`ROADMAP_TEMPLATE_SYSTEM.md`) — este documento diseña la organización comercial completa *para cuando exista evidencia que la justifique*, no autoriza construir más de un pack ahora.
3. **Ningún bundle se anuncia sin contenido producido realmente** (`THOREN_ASSET_PRODUCTION_GUIDE.md` §7.2, ya establecido) — hoy, 50 de 63 templates están en especificación de diseño, 0 en producción real de assets. Este documento es planeación comercial anticipada, no un catálogo listo para vender.

---

## 1. Bundles por categoría

La unidad más simple de empaquetado: los templates de una sola categoría del catálogo, vendidos juntos. Consolidación de las 19 categorías con su tamaño real (a la fecha de este documento, con Batch 10 recién cerrado):

| Categoría | Templates | Tamaño de pack | Precio recomendado (referencia §6.2 de `THOREN_PRODUCT_STRATEGY.md`) |
|---|---|---|---|
| Food & Beverage | 6 | Grande | $15 |
| Cosmetics | 5 | Mediano-grande | $13 |
| Wedding | 5 | Mediano-grande | $13 |
| Holiday | 5 (pendiente de producción) | Mediano-grande | $13 |
| Beauty | 3 | Pequeño | $9 |
| Warning & Compliance Labels | 3 | Pequeño | $9 (nicho B2B, ver nota) |
| Retail | 3 | Pequeño | $9 |
| Product Labels | 3 | Pequeño | $9 |
| Shipping | 3 | Pequeño | $9 |
| Business | 3 | Pequeño | $9 |
| Wedding/Crafts/Etsy Sellers/Kids | 3 cada una | Pequeño | $9 |
| Industrial, Packaging, Events, Education | 2 cada una | Mínimo | $6 |
| QR & Smart Labels | 4 (pendiente de producción) | Pequeño-mediano | $11 |
| Seasonal | 3 (pendiente de producción) | Pequeño | $9 |

**Nota sobre Warning & Compliance Labels**: aunque tiene solo 3 templates, es la categoría con mayor sensibilidad de cumplimiento normativo (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §1, familia Técnico Funcional) — un pack de esta categoría se posiciona explícitamente para el segmento B2B/industrial, no como "pack pequeño de menor valor", su precio no debería anclarse solo al conteo de templates sino a la especificidad del problema que resuelve (ver §3, Bundles por industria).

**Regla de escalado de precio**: el precio de un pack de categoría no es lineal al número de templates — un pack de 2 templates muy especializados (Industrial) puede valer más para su comprador específico que uno de 3 templates genéricos (Retail). Esta tabla es un punto de partida de referencia de mercado, no una fórmula matemática rígida — la decisión final de precio por pack, si se autoriza, debe revisarse con la señal de uso real de v1.1 (`ROADMAP_TEMPLATE_SYSTEM.md`), no solo con esta tabla.

---

## 2. Bundles por industria (nuevo — no cubierto antes en este nivel de detalle)

A diferencia de los bundles por categoría (que siguen la taxonomía del catálogo), los bundles por industria **cruzan categorías** para servir a un tipo de negocio real que necesita varias categorías del catálogo a la vez. Esta es información nueva que no vivía en `TEMPLATE_CATALOG_v1.md` (organizado por categoría) ni en `THOREN_PRODUCT_STRATEGY.md` (que no bajaba a este nivel de combinación).

| Bundle de industria | Categorías que combina | Por qué tiene sentido junto |
|---|---|---|
| **Cafetería / Restaurante** | Food & Beverage (café/té) + QR & Smart Labels (menú digital) + Shipping (gracias por tu compra, si venden para llevar/delivery) | Un mismo negocio necesita etiqueta de producto, QR de menú, y agradecimiento de pedido — 3 categorías, un solo tipo de negocio real |
| **Spa / Salón de Belleza** | Beauty + QR & Smart Labels (reseña) + Packaging (sello de cierre) | El mismo flujo de negocio de belleza: identidad de marca, invitación a reseña online, cierre de empaque de producto |
| **Boda (pareja + planner)** | Wedding + Events (networking no aplica, pero conferencia/lanzamiento tampoco — este bundle es Wedding solo, ya es su propia categoría completa; se mantiene como bundle de categoría, no de industria — nota de honestidad: no forzar una combinación cross-categoría donde no existe necesidad real) | — |
| **Tienda de Regalos / Repostería Especial** | Packaging (cinta decorativa + sello de cierre) + Crafts (sello de regalo hecho a mano) + Holiday/Seasonal (cuando estén producidos) | Un negocio de regalos necesita empaque decorativo, sellos personales, y templates de temporada — 3 categorías que sirven al mismo tipo de comprador |
| **Vendedor de E-commerce/Marketplace** | Etsy Sellers + Shipping + Packaging | El flujo completo de "empacar y enviar un pedido online" cruza estas 3 categorías de forma natural |
| **Negocio Industrial/Manufactura** | Industrial + Warning & Compliance Labels | Ambas categorías sirven al mismo comprador B2B (plantas, talleres) — bundle de alta especificidad, bajo volumen, precio por valor de nicho, no por conteo de templates |
| **Organizador de Eventos Corporativos** | Business + Events | Ya identificado como consistencia de paleta en Batch 07 — el mismo comprador que necesita Sello Corporativo probablemente también necesita Conferencia/Lanzamiento |
| **Familia / Educador** | Kids + Education + Seasonal (regreso a clases, cuando esté producido) | El mismo comprador (padre o maestro) usa las 3 categorías en distintos momentos del año escolar |

**Regla de este tipo de bundle**: un bundle de industria nunca incluye una categoría completa solo para "rellenar" — cada categoría incluida debe resolver una necesidad real y distinta del mismo tipo de negocio, tal como se justifica explícitamente en la columna derecha de la tabla.

---

## 3. Bundles por perfil de cliente (nuevo)

Distinto de "por industria" (qué tipo de negocio) — este corte organiza por **quién es la persona**, independientemente de su industria específica, reutilizando los 4 segmentos ya identificados en `THOREN_PRODUCT_STRATEGY.md` §1.1:

| Perfil de cliente | Bundle recomendado | Lógica |
|---|---|---|
| Vendedor de Etsy/redes sociales | Bundle de industria más cercano a su producto específico (ej. Cafetería si vende café, Spa si vende cosmética) + Etsy Sellers (empaque de marketplace) | Este perfil necesita tanto el contenido de su producto como el empaque de su canal de venta |
| Emprendedor de feria/mercado artesanal | Artesanal Cálido cross-categoría: Food & Beverage + Crafts + Retail ("Hecho en Casa") | Este perfil vende en persona, no en marketplace — no necesita Etsy Sellers ni Shipping, sí necesita el registro cálido/artesanal transversal |
| Diseñador freelance entregando a terceros | Ningún bundle de contenido — este perfil compra la **herramienta**, no templates de industria específica (ya identificado en `THOREN_PRODUCT_STRATEGY.md` §1.1 como un perfil que resuelve el trabajo de un cliente, no el suyo propio) | Ofrecer un bundle de templates a este perfil sería un cross-sell de bajo ajuste — mejor no forzarlo (ver §7) |
| Persona haciendo lote personalizado (regalos, eventos) | Bundle por ocasión específica (Wedding, Holiday, Kids según el evento) — nunca un bundle de industria, porque no tiene un "negocio" | Este perfil compra por ocasión puntual, no por categoría de industria recurrente |

**Diferencia clave con §2**: "por industria" asume que el comprador va a **reutilizar** el bundle repetidamente (es su negocio); "por perfil de cliente" reconoce que algunos compradores (freelance, ocasión puntual) no encajan en el marco de "industria recurrente" y necesitan una oferta distinta o ninguna oferta de bundle forzada.

---

## 4. Bundles Premium

Un nivel por encima de los bundles de categoría/industria — pensado para el comprador que quiere "todo" o "lo mejor", no una selección específica:

| Bundle Premium | Contenido | Posicionamiento |
|---|---|---|
| **Catálogo Completo** (ya definido en `THOREN_PRODUCT_STRATEGY.md` §6.2) | Los 63 templates | El ancla de mayor precio percibido, nunca el único punto de entrada |
| **Signature Collection** (nuevo, propuesta de este documento) | Una selección curada cross-categoría de los templates de mayor "Nivel de calidad" documentado en cada Batch — no todos, los más representativos de la disciplina del Design Language Guide (ej. Serum, Café, Cerveza, Monograma de Boda — uno por familia de lenguaje visual) | Pensado como pieza de "muestra de la calidad del sistema completo THÖREN", útil como regalo/demo de mayor valor percibido que un pack de categoría suelto, y como argumento de venta ("mira la disciplina de diseño detrás de todo el catálogo") |
| **Bundle Software + Catálogo Completo** (ya definido en `THOREN_PRODUCT_STRATEGY.md` §6.2) | Sticker Builder + 63 templates | El paquete de mayor valor absoluto, con descuento de bundle estándar de mercado |

**Regla de Bundles Premium**: ninguno de estos se lanza antes de que exista evidencia real de v1.1 (`ROADMAP_TEMPLATE_SYSTEM.md`) — son la cima de la pirámide de oferta, no el punto de entrada, y su construcción real depende de que la base (packs de categoría/industria) ya haya validado demanda.

---

## 5. Estrategias de upsell (nuevo)

Upsell = ofrecer más valor al mismo comprador en el mismo momento o inmediatamente después de una compra ya decidida.

| Momento | Oferta de upsell | Mecanismo |
|---|---|---|
| Dentro de la Template Library (v1.1), al ver un template de una categoría con pack disponible (v1.2+) | "Este template es parte del pack completo de [categoría] — X templates más por $Y" | Banner o CTA dentro del Template Detail (`UX_TEMPLATE_LIBRARY.md` ya define esta superficie) — **solo aplica cuando exista un pack real, no antes** |
| Después de comprar un pack de categoría | Sugerencia del bundle de industria relacionado (ej. compró Food & Beverage → se le ofrece agregar QR & Smart Labels para el menú digital) | Email o mensaje post-compra en Gumroad (mismo canal ya usado en `THOREN_LAUNCH_PLAYBOOK.md` §5 para avisos a compradores existentes) |
| Al ver el pack de categoría más pequeño (2-3 templates) | Sugerencia del Catálogo Completo como alternativa de mejor valor por template | Comparación de precio por template mostrada explícitamente (ej. "$9 por 3 templates = $3/template, vs. Catálogo Completo a $0.70/template") |

**Regla de upsell**: nunca se presiona con lenguaje de urgencia artificial (mismo principio ya aplicado en `V1_COMMERCIAL_RECOMMENDATION.md` §4 para gating de capabilities: "nunca con lenguaje de urgencia/presión") — el upsell se presenta como información de valor, no como táctica de conversión agresiva.

---

## 6. Estrategias de cross-sell (nuevo)

Cross-sell = ofrecer un producto distinto y complementario, no más del mismo.

| Dirección | Oferta de cross-sell | Mecanismo |
|---|---|---|
| **Software → Templates** | Comprador del Sticker Builder (sin Template Library todavía, si compró antes de v1.1) recibe aviso de que ahora puede acceder al catálogo | Ya diseñado en `THOREN_LAUNCH_PLAYBOOK.md` §5 y `THOREN_PRODUCT_STRATEGY.md` §11.3 — se incluye sin costo adicional en v1.1, no es upsell de precio, es entrega de valor incluido |
| **Templates → Software** | Alguien descubre THÖREN a través de contenido de Social Media mostrando un template específico (`THOREN_LAUNCH_PLAYBOOK.md` §6.2, último renglón del calendario) pero todavía no tiene el software | El mensaje de marketing debe dejar claro que el template requiere el software para editarse — nunca vender la ilusión de un archivo standalone sin el editor, coherente con la propuesta de valor real (`THOREN_PRODUCT_STRATEGY.md` §2.2) |
| **Categoría adyacente** | Alguien que compra el pack de Wedding es candidato natural a interesarse en Events (organización del mismo tipo de celebración) | Sugerencia contextual dentro de la Template Library, basada en categorías que ya comparten familia de lenguaje visual o paleta (`THOREN_DESIGN_LANGUAGE_GUIDE.md`) — ej. Business y Events ya comparten paleta corporativa, lo que los hace candidatos naturales de cross-sell entre sí |

**Regla de cross-sell**: la categoría adyacente sugerida debe tener una relación real ya documentada (misma familia de lenguaje visual, mismo perfil de cliente, o continuidad de paleta ya confirmada en los batches) — nunca una sugerencia genérica de "también te puede interesar" sin base real, que es exactamente el tipo de personalización superficial que el catálogo evita por diseño.

---

## 7. Orden recomendado de lanzamiento

### 7.1 Restricción real que gobierna esta sección

`ROADMAP_TEMPLATE_SYSTEM.md` ya establece que v1.2 autoriza **un solo pack de prueba**, elegido según la señal de uso real de v1.1 — no según una lista pre-decidida. Este documento no puede ni debe adelantar esa decisión con datos que todavía no existen (0 templates en producción real, 0 usuarios reales del catálogo). Lo que sí puede aportar es un **marco de decisión** para cuando esa señal exista, y una **hipótesis razonada de partida** (no una decisión) para el caso de que se necesite elegir antes de tener suficiente volumen de datos.

### 7.2 Marco de decisión para el pack de prueba de v1.2 (cuándo exista señal real)

Orden de criterios, de mayor a menor peso:
1. **Templates más guardados como proyecto real** (criterio de salida ya definido en `ROADMAP_TEMPLATE_SYSTEM.md`) — el dato más fuerte posible, prioridad sobre cualquier otro.
2. **Categorías más buscadas/filtradas**, aun sin conversión a proyecto todavía — señal temprana si el dato #1 todavía no es suficiente.
3. **Tamaño de categoría ya en producción real** (no tiene sentido elegir un pack de una categoría que todavía no completó su producción de assets, `THOREN_ASSET_PRODUCTION_GUIDE.md`).

### 7.3 Hipótesis razonada de partida (no una decisión — solo un punto de referencia si se necesitara elegir sin datos suficientes)

Si se tuviera que nombrar una categoría candidata hoy, sin datos reales, por pura lógica de mercado comparable (mismo criterio de comparables ya usado en `GUMROAD_LAUNCH_PLAN.md` para el pricing del software): **Food & Beverage** es la hipótesis más razonable — es la categoría más grande del catálogo (6 templates), cubre el segmento de mayor volumen de reorden ya identificado en el propio Template 1 ("café es la categoría de mayor volumen de reorden dentro de Food & Beverage"), y tiene la aplicabilidad más amplia entre los 4 segmentos de ICP de `THOREN_PRODUCT_STRATEGY.md` §1.1. **Wedding** sería la segunda hipótesis, por ser igual de grande (5 templates) y dirigirse a un micro-segmento de alto valor percibido por evento (bodas) dispuesto a pagar por presentación, aunque de menor recurrencia que Food & Beverage.

**Esto no es una decisión de qué pack construir** — es, literalmente, lo que dice el título de esta subsección: una hipótesis de partida, subordinada por completo al marco de decisión real de §7.2 en cuanto exista evidencia.

### 7.4 Orden recomendado para bundles de categoría (post-v1.2, si el Marketplace de v2.0 llegara a autorizarse)

Si algún día se autoriza construir más de un pack (evento condicionado a la evidencia de v1.2, `ROADMAP_TEMPLATE_SYSTEM.md` §v2.0), el orden de expansión razonable seguiría el mismo criterio de tamaño + aplicabilidad, no un orden alfabético ni arbitrario: categorías grandes de aplicabilidad amplia primero (Food & Beverage, Cosmetics, Wedding, Holiday), luego categorías medianas de nicho claro (Beauty, Business, Retail, Shipping, Product Labels, Etsy Sellers, Crafts, Kids), y al final las categorías más pequeñas o más especializadas (Industrial, Packaging, Events, Education, Warning & Compliance, Seasonal, QR & Smart Labels) — **este orden es una guía de secuenciación posible, no un compromiso**, exactamente el mismo tipo de disciplina condicional que ya aplica `ROADMAP_TEMPLATE_SYSTEM.md` a todo lo posterior a v1.1.

---

## 8. Resumen de una línea por sección

| Sección | En una frase |
|---|---|
| §1 | Bundles por categoría siguen la taxonomía del catálogo — el precio escala por especificidad, no solo por conteo. |
| §2 | Bundles por industria cruzan categorías para servir a un tipo de negocio real, nunca combinando categorías "para rellenar". |
| §3 | Bundles por perfil de cliente reconocen que no todos los compradores encajan en el marco de "industria recurrente" — algunos no necesitan bundle de contenido en absoluto. |
| §4 | Los Bundles Premium son la cima de la pirámide de oferta, nunca el punto de entrada, y dependen de evidencia previa de la base. |
| §5 | El upsell ofrece más del mismo valor, presentado como información, nunca como presión de urgencia artificial. |
| §6 | El cross-sell ofrece valor complementario real, con base documentada, nunca una sugerencia genérica sin fundamento. |
| §7 | El pack de prueba de v1.2 lo decide la evidencia real de uso, no este documento — aquí solo se deja el marco de decisión y una hipótesis razonada de partida. |
