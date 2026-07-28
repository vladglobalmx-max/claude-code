# THÖREN Product Strategy v1.0

**Alcance: exclusivamente estrategia comercial.** Este documento no modifica la arquitectura (`TEMPLATE_LIBRARY_ARCHITECTURE.md`, ADRs de la fase comercial 4.1-4.2), no modifica código, y no modifica el roadmap técnico (`docs/product/04-Roadmap.md`, `ROADMAP_TEMPLATE_SYSTEM.md`). Es la estrategia comercial oficial de THÖREN — cliente ideal, propuesta de valor, posicionamiento, competencia, modelo de negocio, pricing, packs, marketplace, roadmap comercial, métricas y estrategia de lanzamiento — consolidada en un solo documento de referencia.

Este documento **no inventa decisiones nuevas donde ya existe una decisión tomada**. Reutiliza y consolida lo ya decidido en `docs/platform/COMMERCIAL_PRODUCT_MODEL.md`, `docs/adr/0026` a `0029`, `V1_COMMERCIAL_RECOMMENDATION.md`, `GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RC1_COMMERCIAL_FAQ.md`, `docs/product/PRODUCT_BACKLOG.md` y `ROADMAP_TEMPLATE_SYSTEM.md`. Donde este documento habla de algo condicionado o no decidido todavía, lo marca explícitamente como tal — la misma disciplina que ya rige `ROADMAP_TEMPLATE_SYSTEM.md`.

**Nota de terminología importante**: se solicitó este documento describiendo a THÖREN como "producto SaaS y marketplace". El estado real y ya decidido (ADR-0028, ADR-0029) es **pago único, sin suscripción, sin backend, sin cuentas** — una decisión arquitectónica tomada deliberadamente para V1 y no debe reinterpretarse aquí. Este documento usa "SaaS" en el sentido amplio de "producto de software vendido digitalmente" (como en "vender software como servicio de valor, no como consultoría"), no en el sentido técnico de "suscripción recurrente con backend". Donde el documento explora un modelo de ingreso recurrente real, lo hace exclusivamente como **horizonte condicionado de largo plazo (§6.4)**, nunca como el modelo vigente — de la misma forma en que `ROADMAP_TEMPLATE_SYSTEM.md` condiciona el Marketplace de v2.0 a evidencia real, no a fecha.

---

## 1. Cliente ideal (ICP)

### 1.1 Perfil central, ya validado en `RC1_PRODUCT_PAGE.md`

> Personas sin formación en diseño profesional que necesitan resultados de calidad profesional — específicamente alguien que ya vende o quiere vender stickers físicos y se frustra con la brecha entre "se ve bien en pantalla" y "la imprenta lo acepta".

Este documento no cambia ese perfil — lo desagrega en 4 segmentos concretos, ya nombrados en el mismo documento de origen, útiles para pensar mensajes y canales de adquisición distintos por segmento:

| Segmento | Necesidad específica | Canal de adquisición probable |
|---|---|---|
| **Vendedor de Etsy/redes sociales** | Vender stickers en lotes pequeños con apariencia profesional | Comunidades de sellers (foros de Etsy, grupos de Facebook de "print on demand"), búsqueda orgánica ("cómo exportar sticker para imprenta") |
| **Emprendedor de feria/mercado artesanal** | Stickers de marca (logo, nombre) en cantidad, para repartir o vender | Boca a boca entre productores de mercado, redes sociales de emprendimiento local |
| **Diseñador freelance** | Entregar archivos listos para imprenta sin tener que educar al cliente sobre sangrado/marcas de corte | Comunidades de diseño freelance, recomendación entre colegas |
| **Persona haciendo un lote personalizado** (regalos, invitaciones, decoración) | Varias copias del mismo diseño en una hoja, para cortar en casa o llevar a imprenta local | Búsqueda orgánica de ocasión específica ("stickers para boda imprimir en casa") |

### 1.2 Evolución del ICP con la Template Library

La Template Library (`TEMPLATE_CATALOG_v1.md`, 63 templates en 19 categorías) no cambia el ICP central — lo **refina por industria/ocasión**. Cada categoría del catálogo es, en efecto, un sub-segmento del mismo ICP con una necesidad de contenido específica en vez de una necesidad de herramienta distinta:

- Un tostador de café pequeño (segmento "Etsy/redes sociales") necesita la *herramienta* que ya existe, y ahora también un *punto de partida de diseño de su industria* (Food & Beverage) en vez de empezar de una página en blanco.
- Una pareja organizando su boda (nuevo micro-segmento, no cubierto explícitamente en el ICP original de venta de stickers) es un caso de uso distinto: no vende stickers, los usa para su propio evento — la categoría Wedding (5 templates) es evidencia de que el catálogo amplía el ICP más allá de "vendedor de stickers" hacia "cualquiera que necesite producción física de sticker de calidad", una ampliación de alcance ya implícita en el catálogo aprobado, no una decisión nueva de este documento.

### 1.3 A quién NO se dirige THÖREN (explícito, ya validado en `RC1_PRODUCT_PAGE.md`)

No compite por el usuario que busca una herramienta de diseño gráfico general (no reemplaza Illustrator/Photoshop para otros usos) — es una herramienta de un solo trabajo, bien hecho. Esta exclusión es una decisión de posicionamiento, no una limitación a esconder (ver §3).

---

## 2. Propuesta de valor

### 2.1 Propuesta de valor central (software), ya validada

> Cierra la brecha entre "se ve bien en pantalla" y "la imprenta lo acepta" — un editor completo de stickers con exportación real de producción (sangrado, marcas de corte, imposición en hoja) y Preflight que avisa de errores antes de exportar, no después.

### 2.2 Propuesta de valor extendida (Template Library, v1.1+)

> No empiezas de una página en blanco — empiezas de un sistema de diseño ya resuelto para tu industria específica, con la misma disciplina de calidad profesional que el resto de THÖREN, listo para personalizar en minutos.

Esta propuesta de valor extendida depende de que el catálogo exista en producción real (no solo especificado) — es exactamente la razón de ser del `THOREN_ASSET_PRODUCTION_GUIDE.md` y del trabajo de batches en curso.

### 2.3 Las 3 promesas que nunca se negocian (transversales a ambas propuestas)

1. **Pago único, nunca sorpresas de suscripción** — ya decidido (ADR-0029), y es en sí mismo un argumento de venta frente a la competencia de suscripción (§4).
2. **100% offline, tus diseños nunca sin tu consentimiento salen de tu equipo** — ya decidido y validado (ADR-0028, política de privacidad).
3. **Calidad profesional sin curva de aprendizaje de software profesional** — el hilo conductor tanto del editor como de cada uno de los 63 templates (`THOREN_DESIGN_LANGUAGE_GUIDE.md` §0: "restricción deliberada" como estándar accesible, no exclusivo de expertos).

---

## 3. Posicionamiento

### 3.1 Declaración de posicionamiento

> Para el vendedor o creador independiente que necesita producir stickers físicos de calidad profesional, THÖREN Sticker Builder es la herramienta de diseño-a-impresión especializada que garantiza que tu archivo sea aceptado por cualquier imprenta a la primera — a diferencia de un editor de diseño generalista (Canva, Illustrator) que no está pensado para este flujo específico, o de plantillas sueltas sin herramienta (Creative Market, Etsy digital), THÖREN entrega herramienta + contenido de industria en un solo producto, sin suscripción.

### 3.2 Categoría de mercado (ya validada en `V1_COMMERCIAL_RECOMMENDATION.md`)

THÖREN compite explícitamente en la categoría **"preparación de archivos para impresión de sticker"**, no en la categoría **"editor gráfico generalista"**. Esta distinción de categoría es la que justifica el pago único (§5) frente al modelo de suscripción de las suites generalistas — son categorías de producto distintas con expectativas de pricing distintas, no la misma categoría con un precio más bajo.

### 3.3 Cómo la Template Library refuerza (no diluye) el posicionamiento

El riesgo de posicionamiento al agregar una Template Library es que THÖREN empiece a "sentirse" como un editor generalista tipo Canva (que también tiene plantillas). La defensa contra ese riesgo ya está en el diseño: cada template está construido específicamente para producción física de sticker (con bleed/safe area reales, no una plantilla de post de Instagram) — el catálogo refuerza la categoría "listo para imprenta", no la diluye, siempre que la ejecución respete `THOREN_ASSET_PRODUCTION_GUIDE.md` (ningún template se publica sin pasar por Preflight real).

---

## 4. Competencia

### 4.1 Comparativa de herramienta (ya validada en `RC1_PRODUCT_PAGE.md`, consolidada aquí)

| Alternativa | Categoría | Por qué un cliente la deja / no la elige para este trabajo |
|---|---|---|
| Canva (incl. Canva Pro) | Editor generalista, suscripción | No prepara archivos de impresión reales (sangrado, marcas de corte, imposición) sin plugins/trucos manuales |
| Adobe Illustrator | Editor profesional generalista, suscripción | Sí lo hace, pero cuesta suscripción mensual y tiene curva de aprendizaje alta para un trabajo tan específico como stickers |
| Flujo manual (Canva/Photoshop + Illustrator para preparar) | Combinación de herramientas | Dos pasos, dos herramientas, cálculo manual de imposición, el error se descubre cuando la imprenta devuelve el archivo |
| Kittl | Editor generalista con plantillas, suscripción | Misma categoría que Canva — no especializado en preparación de impresión de sticker |

### 4.2 Comparativa de contenido (Template Library, análisis nuevo de este documento)

| Alternativa | Qué ofrece | Dónde THÖREN es distinto |
|---|---|---|
| Creative Market / Etsy (plantillas digitales sueltas) | Archivos de diseño (a menudo `.ai`/`.psd`) sin herramienta propia — requieren que el comprador ya tenga Illustrator/Photoshop | THÖREN entrega plantilla + herramienta en el mismo producto — no hay "y ahora necesitas otro software de $20/mes para abrir esto" |
| Placeit / mockups genéricos | Mockups fotográficos de producto, sin editor de diseño integrado ni preparación de impresión | THÖREN integra mockup conceptual (§6 de cada template) como dirección de arte, pero el entregable real es el archivo de impresión, no solo una imagen bonita |
| Canva (biblioteca de plantillas) | Enorme volumen de plantillas genéricas, ninguna pensada para bleed/safe area de producción física real | THÖREN tiene menos volumen pero cada template está diseñado y validado contra las especificaciones reales de impresión (`THOREN_ASSET_PRODUCTION_GUIDE.md` Etapa 4) |

### 4.3 Ventaja competitiva sostenible (no solo inicial)

La ventaja de "pago único sin suscripción" es replicable por un competidor en cualquier momento — no es defendible a largo plazo por sí sola. La ventaja más defendible en el tiempo es la combinación **herramienta + contenido de industria + disciplina de calidad documentada** (`THOREN_DESIGN_LANGUAGE_GUIDE.md`) — un competidor puede copiar el precio, pero replicar 63 templates con la misma disciplina de familias de lenguaje visual y checklist de producción exige el mismo trabajo de diseño real que THÖREN ya invirtió.

---

## 5. Modelo de negocio

### 5.1 Modelo vigente (V1, ya decidido — ADR-0026 a 0029)

- **Producto**: Sticker Builder, edición única, todo incluido (sin fragmentar en SKUs sin evidencia de demanda diferenciada — decisión ya tomada en `V1_COMMERCIAL_RECOMMENDATION.md` §5).
- **Canal**: Gumroad (checkout + entrega), con landing/marketing propio enlazando hacia Gumroad.
- **Cobro**: pago único. Sin suscripción.
- **Licenciamiento**: `delivery-only` — Gumroad gatea el acceso, THÖREN no valida nada técnicamente (ADR-0028).
- **Cuenta**: no obligatoria — la cuenta de Gumroad del comprador cubre recuperación/historial.
- **Backend**: ninguno.

Este modelo no cambia por este documento — se documenta aquí como el punto de partida real sobre el que se construye todo lo demás.

### 5.2 Por qué "pago único sin backend" sigue siendo la decisión correcta al agregar Template Library

Agregar un catálogo de templates no exige, por sí mismo, ningún cambio al modelo de licenciamiento de V1: los 63 templates del catálogo v1.1 (ver `ROADMAP_TEMPLATE_SYSTEM.md`) se entregan como parte del mismo producto de pago único, sin gating técnico — exactamente la misma filosofía `delivery-only` ya aplicada al software. El primer punto donde el modelo de negocio *podría* necesitar evolucionar es en v1.2 (el experimento de un solo pack premium, ya previsto y condicionado en `ROADMAP_TEMPLATE_SYSTEM.md` §v1.2) — y ese experimento reutiliza el modelo `CommercialProduct`/`Capabilities` ya diseñado (`COMMERCIAL_PRODUCT_MODEL.md`), no uno nuevo.

### 5.3 Estructura de ingresos actual vs. futura (honesto sobre qué es real y qué es exploración)

| Horizonte | Fuente de ingreso | Estado |
|---|---|---|
| **Hoy (V1/RC1)** | Venta única de Sticker Builder | Listo para publicar, pendiente de autorización humana explícita (ver §11) |
| **v1.1** (catálogo) | Ninguna fuente de ingreso nueva — el catálogo de 63 templates se incluye en el mismo producto de pago único | Diseño ya aprobado (`ROADMAP_TEMPLATE_SYSTEM.md`), producción de contenido en curso (Epic 9) |
| **v1.2** (packs) | Un solo pack premium de prueba, venta adicional opcional | Condicionado a que v1.1 muestre señal de uso real — no decidido todavía |
| **v2.0** (marketplace) | Comisión sobre ventas de terceros (autores externos) | Condicionado a evidencia real de demanda del pack de v1.2 — explícitamente no comprometido a fecha |
| **Horizonte largo, no planeado** | Modelo recurrente (ej. una capa de servicio en la nube opcional, sincronización entre dispositivos, colaboración) | **No es una decisión de este documento.** Se menciona en §6.4 solo como posibilidad a evaluar con evidencia futura, nunca contradice ADR-0029 sin una decisión arquitectónica explícita y separada |

### 5.4 Principio rector de todo el modelo de negocio

El mismo principio que ya gobierna `ROADMAP_TEMPLATE_SYSTEM.md` gobierna este documento: **ninguna evolución del modelo de negocio se compromete sin evidencia real de demanda o uso** — la secuencia v1.1 → v1.2 → v2.0 existe precisamente para generar esa evidencia paso a paso, nunca para saltar a un modelo mayor (marketplace, recurrencia) sin haberla observado primero.

---

## 6. Pricing

### 6.1 Software (ya decidido, `GUMROAD_LAUNCH_PLAN.md`)

**Precio recomendado: USD $29 (pago único), con precio de lanzamiento de USD $19** durante las primeras 2 semanas o los primeros 50 compradores (lo que ocurra primero). Justificación ya documentada: comparables de mercado de herramientas de preparación de impresión especializadas ($20-60 USD pago único, excluyendo suites generalistas de suscripción que no son comparables directas), sin recurrencia de ingreso por decisión de producto, y precio de lanzamiento para reducir fricción de los primeros compradores sin entrar en una espiral de descuento permanente.

### 6.2 Pricing de packs de templates (v1.2, propuesta nueva de este documento — no decidida, solo recomendación para cuando el experimento se autorice)

Basado en comparables reales de mercado de contenido de diseño (Creative Market, Etsy digital — plantillas sueltas $2-8 USD, packs curados $15-40 USD):

| Producto | Precio recomendado | Justificación |
|---|---|---|
| Pack de categoría (ej. "Food & Beverage Pack", 6 templates) | USD $12-15 | Comparable a un pack pequeño curado de mercado; suficientemente bajo para ser una compra de impulso sobre el software ya adquirido |
| Pack "Starter" curado cross-categoría (10-15 templates variados) | USD $19-25 | Punto de entrada para quien no sabe qué categoría necesita todavía |
| Catálogo completo (63 templates) | USD $39-49 | Precio de "todo incluido", pensado como upsell de mayor valor percibido, nunca el único punto de entrada |
| Bundle software + catálogo completo (para compradores nuevos) | USD $59-69 (vs. $29 + $39-49 por separado) | Descuento de bundle estándar de mercado (15-20%) para incentivar la compra combinada desde el primer contacto |

**Esta tabla es una recomendación de pricing para cuando v1.2 se autorice — no un precio ya decidido ni una autorización para construir el pack**, exactamente la misma cautela que ya aplica `ROADMAP_TEMPLATE_SYSTEM.md` a todo lo de v1.2 en adelante.

### 6.3 Regla de pricing transversal

Ningún precio de THÖREN se estructura como suscripción mientras ADR-0029 siga vigente. Cualquier pack o bundle es, por diseño, pago único — coherente con la promesa central de marca (§2.3).

### 6.4 Horizonte de largo plazo (exploración, no decisión)

Si en el futuro lejano THÖREN evaluara una capa de servicio verdaderamente recurrente (ej. sincronización en la nube entre dispositivos, colaboración en tiempo real — ninguna construida ni planeada hoy), esa sería una decisión arquitectónica separada que requeriría su propio ADR y su propia evaluación de si contradice o coexiste con ADR-0029 — no algo que este documento de estrategia comercial pueda ni deba decidir de forma implícita.

---

## 7. Packs comerciales

### 7.1 Estructura de packs recomendada (alineada con las 19 categorías de `TEMPLATE_CATALOG_v1.md`)

| Tipo de pack | Contenido | Cuándo tiene sentido lanzarlo |
|---|---|---|
| **Packs de categoría** | Los templates de una sola categoría (ej. Wedding, 5 templates; Holiday, 5 templates) | El experimento de v1.2 (un solo pack de prueba) debería elegir la categoría con mayor señal de uso real de v1.1 — no una elección arbitraria |
| **Pack "Starter"** | Selección curada cross-categoría de los templates de mayor aplicabilidad general (ej. Product Labels + Retail + Packaging) | Útil como "primera compra de contenido" para quien todavía no sabe qué necesita |
| **Pack "Ocasión"** | Cross-categoría por temporalidad (ej. un pack que combine Holiday + Seasonal + Wedding para el Q4/temporada de eventos) | Estrategia de campaña estacional, no un pack permanente de catálogo |
| **Catálogo completo** | Los 63 templates | El upsell de mayor valor, nunca el único punto de entrada de precio |

### 7.2 Regla de gobernanza de packs

Ningún pack se construye ni se anuncia sin que exista contenido real de producción (`THOREN_ASSET_PRODUCTION_GUIDE.md` completo para cada template incluido) — un pack no puede vender specs de diseño sin producir, tal como el propio Production Checklist (sección 12 de cada template) ya lo exige antes de marcar "Publicado".

---

## 8. Marketplace

### 8.1 Estado real (ya decidido en `ROADMAP_TEMPLATE_SYSTEM.md` §v2.0 y `PRODUCT_BACKLOG.md`)

El Marketplace de terceros (autores externos vendiendo sus propios templates/packs a través de THÖREN) es **v2.0, condicionado explícitamente a evidencia real de demanda del experimento de pack de v1.2** — no una fecha, no un compromiso. `docs/product/PRODUCT_BACKLOG.md` ya establece esto como decisión de producto vigente: "no se construyen sin evidencia de demanda real".

### 8.2 Qué ya existe (diseño, no construcción) para cuando el Marketplace se autorice

- Modelo comercial: `CommercialProduct.productType: "template-pack"`, ya definido en `COMMERCIAL_PRODUCT_MODEL.md` — no requiere un modelo de datos nuevo.
- Capabilities/Entitlements/License/Channel: ya diseñados de forma genérica para soportar esto sin retrabajo (`ADR-0028`).
- Autoría: `Author` como entidad propia con proceso de curaduría/aprobación — diseño de arquitectura ya descrito en `TEMPLATE_LIBRARY_ARCHITECTURE.md` §8.2.
- Amenazas de seguridad/licenciamiento de contenido de terceros: ya cubiertas en principio por `LICENSING_THREAT_MODEL.md` (delivery-only V1, sin promesa de DRM).

### 8.3 Qué decide este documento sobre Marketplace (nada nuevo)

Este documento **no adelanta ni acelera** la decisión de Marketplace — la reafirma explícitamente como condicionada, consolidando por qué (evitar construir infraestructura de comisión/autores/curaduría sin evidencia de que el pack de prueba de v1.2 genera demanda real) en el mismo lugar que el resto de la estrategia comercial, para que quede claro que Marketplace **no** es parte del modelo de negocio vigente de THÖREN hoy.

---

## 9. Roadmap comercial

Consolidación de dos roadmaps ya existentes (software y templates) en una sola línea de tiempo comercial — sin fechas de calendario, coherente con el principio ya establecido en `docs/product/04-Roadmap.md` y `ROADMAP_TEMPLATE_SYSTEM.md` de no comprometer fechas sin base real.

| Hito | Contenido | Condición de avance |
|---|---|---|
| **RC1 (hoy)** | Sticker Builder, edición única, listo para Gumroad | Pendiente de autorización humana explícita para publicar (ver §11) |
| **Post-lanzamiento inmediato** | Recolección de las primeras ventas/reseñas reales, validación de que el precio de lanzamiento ($19) genera las primeras conversiones | Señal mínima: primeras ventas reales y feedback de compradores reales |
| **v1.1 (Template Library — catálogo)** | 63 templates en producción real, búsqueda/filtros funcionando sobre datos reales, incluidos en el mismo producto sin costo adicional | Ya diseñado y en producción de contenido (Epic 9); criterio de salida ya definido en `ROADMAP_TEMPLATE_SYSTEM.md`: señal real de qué categorías/templates se usan más |
| **v1.2 (Favoritos/Colecciones + 1 pack de prueba)** | Favoritos y "más usados" reales, colecciones curadas, un solo pack premium de prueba (pricing recomendado en §6.2) | Condicionado a la señal de uso real de v1.1 |
| **v2.0 (Marketplace + primera IA)** | Autores externos, ratings, checkout de terceros, primera integración de IA (sugerencia de templates por texto) | Condicionado a evidencia real de demanda del pack de v1.2 — nunca por fecha |

---

## 10. Métricas principales

### 10.1 Métricas de software (V1/RC1)

| Métrica | Por qué importa | Fuente |
|---|---|---|
| Unidades vendidas (lanzamiento vs. precio de catálogo) | Valida si el precio de lanzamiento ($19) realmente reduce fricción sin canibalizar el precio de catálogo ($29) más de lo esperado | Panel de Gumroad |
| Tasa de reembolso | Señal directa de si el producto cumple la promesa hecha en el copy (`RC1_PRODUCT_PAGE.md`) | Panel de Gumroad |
| Reseñas/testimonios reales de los primeros compradores | Insumo para pasar de precio de lanzamiento a precio de catálogo con confianza | Gumroad / contacto directo |
| Consultas de soporte por correo | Señal de fricción de onboarding no capturada por otras métricas | Bandeja de soporte (proceso manual, ya documentado en `V1_COMMERCIAL_RECOMMENDATION.md` §3) |

### 10.2 Métricas de Template Library (v1.1+, la "señal de uso" que ya exige `ROADMAP_TEMPLATE_SYSTEM.md`)

| Métrica | Por qué importa | Cuándo se vuelve accionable |
|---|---|---|
| Templates más usados/guardados como proyecto | Determina qué categoría es candidata al pack de prueba de v1.2 | Criterio de salida explícito de v1.1 en `ROADMAP_TEMPLATE_SYSTEM.md` |
| Categorías más buscadas/filtradas (aun sin resultado de uso real) | Señal temprana de demanda de categoría, incluso antes de que exista contenido completo en todas | Desde que la búsqueda/filtros de v1.1 estén activos |
| Tasa de "template abierto → proyecto guardado" | Distingue interés superficial (explorar la galería) de intención real de uso | v1.1 |

### 10.3 Métricas de packs/marketplace (v1.2/v2.0, condicionadas)

| Métrica | Por qué importa | Gate que desbloquea |
|---|---|---|
| Tasa de conversión del pack de prueba de v1.2 | Es literalmente el dato que decide si v2.0 (Marketplace) se autoriza a diseñarse en construcción real | Determina si se avanza a v2.0 — descrito ya como criterio de salida en `ROADMAP_TEMPLATE_SYSTEM.md` |
| Interés expresado en programa de autores externos (si se sondea) | Evidencia adicional de demanda del lado de la oferta, no solo de la demanda de compradores | Insumo cualitativo para la decisión de v2.0, no un reemplazo del dato cuantitativo de conversión |

---

## 11. Estrategia de lanzamiento

### 11.1 Estado real del lanzamiento de software (RC1, ya cerrado y documentado)

El paquete comercial V1 (Sticker Builder) completó su Release Candidate 1.0: ZIP validado, checksums verificados, instalación y actualización probadas de punta a punta, backup/restore validado, branding revisado, capturas oficiales tomadas, guion de video y lista de imágenes para Gumroad preparados, página de producto completa (`RC1_PRODUCT_PAGE.md`), FAQ comercial (`RC1_COMMERCIAL_FAQ.md`), y checklist de publicación consolidado — **todo listo, pero explícitamente sin publicar**, en espera de autorización humana directa. Este documento no cambia ese estado ni lo autoriza — lo consolida como parte de la estrategia general.

### 11.2 Secuencia de lanzamiento recomendada (consolidación, no nueva decisión)

1. Autorización humana explícita para publicar en Gumroad (fuera del alcance de este documento — es una decisión de negocio real, no de diseño/estrategia).
2. Publicación con precio de lanzamiento ($19, ventana de 2 semanas o 50 compradores).
3. Recolección de métricas de §10.1 durante la ventana de lanzamiento.
4. Transición a precio de catálogo ($29) al cierre de la ventana, sin descuentos posteriores agresivos (ya decidido en `GUMROAD_LAUNCH_PLAN.md`).
5. En paralelo (no secuencial — puede ocurrir durante o después del lanzamiento de software), continuar la producción de contenido de la Template Library (Epic 9, batches en curso) hacia el lanzamiento de v1.1.

### 11.3 Estrategia de lanzamiento de v1.1 (Template Library — catálogo)

A diferencia del software (que requiere una decisión de "publicar o no"), la Template Library v1.1 se integra al mismo producto ya vendido — no es un lanzamiento comercial separado con su propio checkout, sino una actualización de valor incluida (`updatePolicy: "included-minor"`, ya decidida en `V1_COMMERCIAL_RECOMMENDATION.md` §6). Su "lanzamiento" es, en la práctica, una comunicación a los compradores existentes ("ahora tu Sticker Builder incluye 63 templates profesionales") más que una campaña de adquisición nueva — aunque también sirve como argumento de venta renovado para nuevos compradores que todavía no compraron.

### 11.4 Estrategia de lanzamiento de v1.2 (pack de prueba) — condicionada, solo marco

Cuando (y si) v1.2 se autorice: el pack de prueba se lanza como un producto adicional dentro del mismo Gumroad/canal ya validado, dirigido primero a la base de compradores existente (mayor probabilidad de conversión que adquisición fría), usando el Commercial Sheet (`sección 11` de cada template) del pack como copy fuente, siguiendo el mismo criterio de "sin publicar hasta autorización humana explícita" ya aplicado al software.

---

## 12. Resumen de una línea por sección

| Sección | En una frase |
|---|---|
| §1 | El ICP central no cambia — la Template Library lo refina por industria/ocasión, no lo reemplaza. |
| §2 | La propuesta de valor crece de "herramienta que cierra la brecha con la imprenta" a "herramienta + contenido de industria ya resuelto". |
| §3 | THÖREN compite en "preparación de impresión de sticker", nunca en "editor gráfico generalista". |
| §4 | La ventaja defendible no es el precio — es herramienta + contenido + disciplina de calidad documentada, junta. |
| §5 | Pago único sin backend sigue siendo el modelo vigente; nada de este documento lo cambia. |
| §6 | Software ya tiene precio decidido ($29/$19); packs de templates tienen una recomendación de pricing para cuando se autoricen, no un precio ya decidido. |
| §7 | Los packs se organizan por categoría/ocasión, y ninguno se anuncia sin contenido real producido. |
| §8 | Marketplace sigue siendo v2.0, condicionado a evidencia — este documento lo reafirma, no lo adelanta. |
| §9 | Un solo roadmap comercial consolidado, sin fechas, con condiciones de avance explícitas en cada hito. |
| §10 | Cada horizonte tiene sus propias métricas, y las de packs/marketplace son literalmente el gate que decide si el siguiente horizonte se autoriza. |
| §11 | El software está listo para lanzar pero no publicado; la Template Library se integra como valor incluido, no como lanzamiento separado. |
