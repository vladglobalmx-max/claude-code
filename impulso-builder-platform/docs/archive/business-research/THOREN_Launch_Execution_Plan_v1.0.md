> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Investigación de mercado / estrategia comercial escrita para Sticker Builder como producto independiente vendido por separado — premisa contradicha por `../product/THOREN_PRODUCT_DIRECTION.md` (escenario D, aprobado). Se conserva íntegro como insumo de referencia (la investigación de mercado en sí sigue siendo informativa), nunca como fuente vigente de estrategia comercial de THÖREN — si THÖREN necesita una estrategia comercial propia en el futuro, se redacta de cero. Ver [`../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# THÖREN Launch Execution Plan v1.0

Escrito en rol de Chief Revenue Officer. Convierte `THOREN_Positioning_GoToMarket_Strategy_v1.0.md` (estrategia, ya cerrada, no se reabre aquí) en un plan de trabajo ejecutable. Todo lo que sigue asume el producto ya cerrado y verificado (`docs/platform/PROJECT_STATUS.md`, commit `938bfe2`, ZIP `thoren-sticker-builder-v1.0.0.zip`, SHA-256 `cbb49f65...`) — este documento no propone tocar código ni reabrir la Fase 4.2/RC1.

**Punto de partida real, no asumido.** Ya existe trabajo previo de Fase 4.2/RC1 que este plan reutiliza en vez de rehacer: copy de producto (`GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`), FAQ pre-venta (`RC1_COMMERCIAL_FAQ.md`), guion de video (`RC1_DEMO_SCRIPT_AND_ASSETS.md`), checklist de publicación y plan post-lanzamiento (`GUMROAD_LAUNCH_PLAN.md` §4, `RC1_POST_LAUNCH_PLAN.md`). **Todo ese copy sigue nombrando "Impulso Sticker Builder Professional"** — quedó escrito antes de Brand Integration y necesita una pasada de re-branding a THÖREN antes de publicarse; no es trabajo nuevo, es una corrección de una tarde. Las 4 capturas de pantalla que ese material da por "ya generadas" **no existen como archivo en el repositorio** — deben regenerarse sobre el build ya rebrandeado a THÖREN. Este plan parte de esa realidad exacta, no de cero y no de "todo ya está listo".

---

# 1. Objetivo principal

**Objetivo de los primeros 90 días: 50 ventas pagadas y verificadas, con al menos 10 reseñas/testimonios reales publicados, para el día 90 desde el lanzamiento público.**

Es medible (conteo directo en Gumroad/Bookfluence), es alcanzable con canales 100% orgánicos (coherente con la estrategia de Capítulo 10 del GTM, que deliberadamente pospone publicidad paga), y combina ingreso real con prueba social — sin prueba social, la venta #51 es tan difícil de conseguir como la #1.

**Nota de CRO, no de optimismo:** la meta de "primeros USD 10,000" (Capítulo 2) es matemáticamente un objetivo de 6-9 meses a este precio, no de 90 días — a $29 de catálogo se necesitan ~345 ventas para llegar a $10,000; a los primeros 90 días, con cero canales pagados y cero reputación previa, 50 ventas ya es una meta exigente y honesta. Tratar $10,000 como el objetivo de 90 días llevaría a decisiones de pánico (descuentos agresivos, gasto en ads sin datos) que el propio GTM ya identificó como riesgo (Capítulo 12, ítem 2). El objetivo de 90 días es 50 ventas + 10 reseñas; $10,000 es el próximo hito, no este.

# 2. Metas (escalera de hitos, sin fecha fija — cada una dispara la siguiente revisión)

| Hito | Qué confirma | Acción que dispara |
|---|---|---|
| **Primer cliente** | El checkout funciona de principio a fin con dinero real, no solo en pruebas | Contacto personal directo, agradecimiento + primera pregunta de validación (Capítulo 7) |
| **Primeras 10 ventas** | Hay señal de que el mensaje de valor (GTM Cap. 6) convierte a más de un comprador aislado | Revisar de qué canal vino cada una — confirmar o corregir la hipótesis de canales (GTM Cap. 10) |
| **Primeras 50 ventas** | El objetivo de 90 días (Capítulo 1) está cumplido | Fin recomendado del precio de lanzamiento si no terminó antes por tiempo; primer informe formal de métricas (Capítulo 8) |
| **Primeras 100 ventas** | El producto se sostiene más allá del impulso inicial de lanzamiento | Evaluar seriamente el primer canal de pago (GTM Cap. 10, ítem 6) con datos reales de conversión ya existentes |
| **Primeros USD 10,000** | El negocio genera caja suficiente para financiar el segundo Builder del ecosistema sin descapitalizar el primero | Recién aquí se abre la conversación de GTM Cap. 11 (roadmap comercial del ecosistema) — no antes |

# 3. Roadmap semanal (12 semanas ≈ 90 días desde hoy)

**Semanas 1-3: preparación — nada se publica todavía. Semana 4 en adelante: ventana pública de 90 días (ver Capítulo 10 para el detalle día a día de las primeras 4 semanas post-lanzamiento).**

**Semana 1 — Cerrar la brecha de assets reales**
- Rebrandear a THÖREN el copy ya existente (`GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RC1_COMMERCIAL_FAQ.md`) — tarea mecánica, no de redacción desde cero.
- Regenerar las 4 capturas de pantalla sobre el build ya rebrandeado (Workspace, Editor, Exportar rápido, Wizard de impresión).
- Producir imagen de portada/hero e ícono de miniatura (pendientes explícitos desde RC1, requieren diseño humano — usar el sistema visual ya aprobado en Brand Integration como base).
- Redactar: email de bienvenida post-compra, política de soporte pública (una página, no el documento técnico interno), borrador de roadmap público.
- *Entregable:* carpeta de assets lista, cero pendientes de "falta generar".

**Semana 2 — Producción de video + montaje de las páginas**
- Grabar y editar el video demo (guion ya existe en `RC1_DEMO_SCRIPT_AND_ASSETS.md`, actualizar textos en pantalla a THÖREN).
- Montar la página de producto completa en Gumroad y en Bookfluence, en modo **no listado**.
- Reclutar 10-20 early testers reales (perfil Marisol/Diego del GTM, Capítulo 5) desde red personal y 1-2 comunidades de nicho.
- *Entregable:* páginas de venta completas mostrando la marca THÖREN, no publicadas; lista de testers confirmada.

**Semana 3 — Validación privada**
- Compra de prueba propia (checklist de `GUMROAD_LAUNCH_PLAN.md` §4, ya escrito, solo ejecutar).
- Los 10-20 testers usan el producto real y responden el cuestionario de validación (Capítulo 7).
- Corregir cualquier fricción real encontrada (copy confuso, paso del checkout, email de bienvenida) — última oportunidad de arreglar antes de que lo vea un comprador pagado.
- *Entregable:* producto y páginas validados por humanos reales, no solo por el equipo.

**Semana 4 — LANZAMIENTO PÚBLICO** (día 1 del Capítulo 10)
- Listar públicamente en Gumroad + Bookfluence con precio de lanzamiento activo.
- Anunciar en 2-3 comunidades de nicho + red personal (GTM Cap. 10).
- Publicar el video demo y las primeras piezas de contenido.

**Semana 5 — Atención personal a cada venta**
- Responder personalmente a cada comprador (no un autoresponder únicamente) — pedir feedback antes que reseña.
- Revisar el dashboard (Capítulo 8) todos los días, no solo los lunes, durante esta semana crítica.

**Semana 6 — Cierre de precio de lanzamiento**
- Fin del precio de lanzamiento (2 semanas desde el lanzamiento público O 50 compradores, lo que ocurra primero) — transición a precio de catálogo con aviso explícito.
- Primer corte de datos: visitas, conversión, canal de origen de cada venta.

**Semana 7 — Primera ola de contenido con evidencia real**
- 2-3 piezas de contenido corto mostrando el momento de Preflight, ahora con casos reales de los primeros compradores (con permiso).
- Ajustar copy si la conversión real contradice el mensaje asumido en el GTM.

**Semana 8 — Profundizar en comunidad + inicio de SEO**
- Continuar presencia en comunidades (aportando valor, no solo promocionando).
- Empezar a redactar contenido long-tail (GTM Cap. 10) — rendimiento esperado a 6-12 meses, hay que sembrarlo ya.

**Semana 9 — Revisión formal de medio plan**
- Comparar métricas reales contra el objetivo del Capítulo 1.
- Decidir si el mensaje de valor necesita ajuste — con datos, no con intuición.

**Semana 10 — Segunda ola de contenido + primeros partnerships**
- Evaluar 1-2 colaboraciones con micro-creadores del nicho (GTM Cap. 10, ítem 4).

**Semana 11 — Consolidar señal de ecosistema**
- Revisar qué segunda categoría de producto mencionan espontáneamente los compradores (GTM Cap. 13, "señal de ecosistema") — insumo directo para GTM Cap. 11, sin comprometer todavía ningún desarrollo nuevo.

**Semana 12 — Informe de 90 días**
- Informe formal contra el objetivo del Capítulo 1 y las métricas del Capítulo 8.
- Recomendación explícita: continuar igual / ajustar precio / iniciar investigación del segundo Builder.
- *Entregable:* el mismo tipo de reporte ejecutivo verificable que cerró cada fase técnica de este proyecto — no una celebración, una decisión.

# 4. Prioridad de tareas (ordenadas por impacto, no por facilidad)

1. **Rebrandear el copy ya escrito de Impulso → THÖREN.** Bloquea absolutamente todo lo demás — no se puede publicar nada con el nombre equivocado.
2. **Regenerar las 4 capturas de pantalla reales sobre el build THÖREN.** Sin esto no hay página de producto creíble — es el activo visual de mayor impacto en conversión y el más barato de producir (ya existe el guion de qué capturar).
3. **Validación privada con 10-20 testers reales antes de cualquier venta pública.** Más impacto que cualquier pieza de marketing: encuentra la objeción real antes de que la encuentre un comprador pagado y la convierta en un reembolso o una reseña negativa.
4. **Publicar en modo no listado + compra de prueba propia.** Es la última red de seguridad técnica/comercial antes de exponer el producto a dinero real de un desconocido.
5. **Lanzamiento público con precio de lanzamiento activo.** El evento de mayor impacto de todo el plan — todo lo anterior existe para que este momento no falle.
6. **Contacto personal con cada comprador de las primeras 2-3 semanas.** Más impacto en reseñas/retención que cualquier campaña — y es gratis, solo cuesta tiempo del founder.
7. **Video demo.** Alto impacto en conversión de visita→compra, pero por debajo de los ítems 1-6 porque el lanzamiento puede sostenerse (peor, no bloqueado) sin video si hay que elegir.
8. **Imagen de portada/hero + ícono de miniatura.** Impacto real en clics iniciales, pero las capturas reales (ítem 2) ya cubren la necesidad mínima de mostrar el producto — esto es refuerzo, no bloqueante.
9. **Email de bienvenida post-compra.** Impacto directo en activación (¿el comprador realmente abre y usa la app?) — barato de producir, debe existir antes del lanzamiento público, no después.
10. **Política de soporte pública + FAQ pre-venta ya redactada (rebrandeada).** Reduce fricción de decisión de compra y volumen de tickets repetidos — bajo esfuerzo, impacto medio-alto.
11. **Presencia en 2-3 comunidades de nicho.** Mayor impacto de descubrimiento esperado según el GTM (Cap. 10) — requiere empezar antes del lanzamiento (semana 2-3), no después.
12. **Dashboard de métricas instrumentado desde el día 1 del lanzamiento.** Sin esto, todo lo demás se evalúa "a ojo" — impacto alto en la calidad de cada decisión futura, costo de implementación bajo.
13. **Contenido de video corto post-lanzamiento (semana 7+).** Impacto acumulativo a mediano plazo, no inmediato — correctamente después del lanzamiento, no antes.
14. **Roadmap público.** Impacto bajo-medio en confianza de compra ("esto no es un proyecto abandonado") — puede publicarse en versión simple en el lanzamiento y refinarse después.
15. **SEO long-tail.** Impacto real pero a 6-12 meses — sembrar temprano (semana 8) pero nunca a costa de los ítems 1-11.
16. **Partnerships/afiliados con micro-creadores.** Impacto potencialmente alto pero no verificado — correctamente después de tener datos reales de conversión orgánica propia (semana 10+, nunca antes del lanzamiento).

# 5. Assets comerciales — checklist completo

Estado real verificado contra el repositorio, no asumido:

- [ ] **Copy de producto rebrandeado a THÖREN** (existe en Impulso, falta la pasada de renombrado) — `GUMROAD_LAUNCH_PLAN.md`, `RC1_PRODUCT_PAGE.md`, `RC1_COMMERCIAL_FAQ.md`.
- [ ] **Landing / página de producto montada** en Gumroad y Bookfluence (copy listo, falta ensamblar en la plataforma).
- [ ] **4 capturas de pantalla reales** — Workspace, Editor, Exportar rápido, Wizard de impresión (guion de qué capturar ya existe en `RC1_DEMO_SCRIPT_AND_ASSETS.md`; los archivos en sí no existen en el repositorio y deben regenerarse sobre el build THÖREN).
- [ ] **Video demo** (guion completo ya escrito, 30-45s; falta grabar/editar).
- [ ] **Imagen de portada/hero para la miniatura de Gumroad** (pendiente explícito desde RC1 — requiere diseño gráfico humano).
- [ ] **Ícono/logo de marca para miniatura** (mismo caso — el símbolo Þ y la paleta ya existen desde Brand Integration, falta la composición final).
- [ ] **FAQ pre-venta** (existe, redactado en `RC1_COMMERCIAL_FAQ.md`, falta rebrandear).
- [ ] **Email de bienvenida post-compra** — no existe todavía, redactar desde cero (contenido: cómo abrir el producto, dónde está la documentación, cómo pedir soporte).
- [ ] **Política de soporte pública** (existe la versión técnica interna dentro del ZIP para el comprador — `docs/05-problemas-frecuentes-y-soporte.md` — falta una versión corta de cara al público pre-venta, para la página de producto).
- [ ] **Licencia/EULA** — ya existe y está actualizada a THÖREN (`commercial-assets/legal/LICENCIA-DE-USO.md`), listo, sin trabajo pendiente.
- [ ] **Roadmap público** — no existe todavía; puede derivarse de una versión simplificada de `docs/product/04-Roadmap.md`, sin el detalle técnico interno.
- [ ] **Demo interactivo/online** — no existe ni está planeado para v1.0 (el producto corre localmente, sin backend) — evaluar si vale la pena un video más largo en su lugar, no un demo web en vivo.
- [ ] **Checklist de publicación** — ya existe y está listo (`GUMROAD_LAUNCH_PLAN.md` §4), solo ejecutar en el momento correcto.
- [ ] **Plan post-lanzamiento** — ya existe (`RC1_POST_LAUNCH_PLAN.md`), falta revisar que siga vigente tras Brand Integration.

# 6. MVP comercial

**Indispensable para vender (sin esto, no se publica):**
- El ZIP comercial ya cerrado y verificado (existe: `thoren-sticker-builder-v1.0.0.zip`).
- Página de producto con copy rebrandeado y al menos las 4 capturas de pantalla reales.
- Checkout funcional probado con una compra real propia.
- Email de soporte monitoreado activamente (ya existe: `soporte@bookfluence.shop`).
- FAQ pre-venta y política de reembolso claras (Gumroad ya cubre el mecanismo de reembolso; falta solo el texto de política, no la infraestructura).
- Licencia/EULA visible antes de la compra (ya lista).

**Puede esperar a v1.1 (no bloquea el lanzamiento):**
- Video demo pulido — el lanzamiento puede sostenerse con capturas reales solamente si el video se retrasa; no al revés.
- Imagen de portada/hero de diseño avanzado — las capturas reales cubren el mínimo necesario.
- Roadmap público formal — puede lanzarse con una frase simple ("estamos escuchando a los primeros compradores para decidir qué sigue") en vez de un documento completo.
- Programa de afiliados/partnerships.
- Contenido SEO long-tail.
- Cualquier automatización de soporte (respuestas predefinidas, base de conocimiento pública navegable) — soporte manual por correo es suficiente al volumen esperado de los primeros 90 días.
- Cualquier gating de capabilities/edición gratuita — no existe la infraestructura (ver `PROJECT_STATUS.md`, "Pendientes intencionalmente NO implementados") y no hace falta para v1.0.

# 7. Estrategia de validación

**Cómo obtendremos feedback:** contacto directo, uno a uno, con cada uno de los primeros 20-30 compradores (testers privados + primeras semanas públicas) — nunca delegado únicamente a una encuesta automática. Un mensaje corto y personal después de la compra, y otro 3-5 días después de que hayan tenido tiempo de usar el producto.

**Cómo hablaremos con compradores:** mensaje directo por el correo de soporte o el canal de la comunidad donde se conocieron, con tono de founder genuinamente interesado, no de encuesta corporativa. Pedir 10-15 minutos de conversación real (llamada o mensajes) a quien esté dispuesto, no solo respuestas de formulario.

**Qué preguntas debemos hacer** (en este orden, no todas a la vez):
1. ¿Qué estabas usando antes de THÖREN para este problema?
2. ¿Qué casi te hizo NO comprar? (la objeción real, no la que asumimos en el GTM)
3. ¿Llegaste a exportar un archivo para imprimir de verdad? ¿Qué pasó?
4. ¿Qué fue lo más confuso o lento de tu primera media hora usando el producto?
5. ¿Qué otro tipo de producto (planner, worksheet, journal, coloring, mockup, u otro que no esté en nuestra lista) también creas o necesitarías resolver?
6. ¿Le dirías a alguien más que lo compre? ¿A quién, exactamente, y con qué palabras?

**Cómo decidiremos qué construir después:** ninguna decisión de producto (incluido el segundo Builder del ecosistema, GTM Cap. 11) se toma sin que al menos 3 respuestas independientes de compradores reales apunten al mismo problema. Una sola persona pidiendo algo es una anécdota; tres personas no relacionadas pidiendo lo mismo es una señal. El criterio ya adoptado en la fase técnica del proyecto ("¿esto ayuda a vender/entregar/usar la primera copia?") se extiende aquí a: "¿esto lo pidió más de una persona real, sin que se lo sugiriéramos primero?".

# 8. Dashboard del CEO (revisión cada lunes)

| Métrica | Fuente | Semáforo sugerido |
|---|---|---|
| **Ventas de la semana** (unidades y USD) | Gumroad/Bookfluence | Verde si ≥ proyección de la semana del Capítulo 3 |
| **Visitas a la página de producto** | Analítica de Gumroad/Bookfluence | Informativo — contexto de la conversión |
| **Tasa de conversión visita→compra** | Ventas ÷ Visitas | Alarma si cae más de 30% semana contra semana sin explicación de tráfico |
| **Canal de origen de cada venta** | Pregunta directa o UTM si Gumroad lo permite | Informativo — valida o corrige el Capítulo 10 del GTM |
| **Reembolsos (cantidad y motivo declarado)** | Gumroad + seguimiento manual del motivo | Alarma si > 1 en la semana sin patrón claro |
| **Tickets de soporte (volumen y tema)** | Correo de soporte | Alarma si un mismo tema se repite 3+ veces — señal de fricción real de producto |
| **Tiempo medio de primera respuesta a soporte** | Manual (registrar hora de recepción/respuesta) | Alarma si > 2-3 días hábiles (objetivo ya declarado en la licencia) |
| **Reseñas/testimonios nuevos** | Gumroad + mensajes directos | Verde si ≥1 por semana durante el primer mes |
| **% de compradores que exportaron para impresión real** (no solo PNG/SVG) | Encuesta directa (Capítulo 7, pregunta 3) — no hay telemetría, el producto es 100% offline por diseño | Alarma si es consistentemente bajo — indica problema de activación, no de marketing |
| **NPS informal** (¿lo recomendarías, sí/no, a quién?) | Conversación directa (Capítulo 7, pregunta 6) | Informativo — cualitativo, no un número de encuesta formal todavía |

**Nota de diseño del dashboard:** varias filas dependen de preguntas directas, no de telemetría automática — es una decisión de producto ya tomada (`PROJECT_STATUS.md`: "sin telemetría de uso en esta versión") y no se revierte para conseguir métricas más cómodas. El costo de no tener esos datos automáticos es que el CEO/CRO debe preguntar activamente, no esperar un reporte.

# 9. Riesgos operativos

1. **Cuello de botella de producción de assets creativos (screenshots/video/hero image) retrasa el lanzamiento.** Es trabajo humano real (grabación, edición, diseño), no automatizable. *Mitigación:* priorizar estrictamente el orden del Capítulo 4 — lanzar con capturas reales + FAQ + licencia es suficiente; video y hero image pueden llegar en la semana 2 de vida pública sin bloquear el lanzamiento.
2. **Soporte desbordado por un equipo pequeño/solo founder.** Cada ticket sin responder a tiempo es una reseña negativa potencial. *Mitigación:* bloque de tiempo diario dedicado exclusivamente a soporte durante las primeras 3 semanas públicas (Capítulo 3, semana 5); FAQ y política de soporte ya redactadas absorben las preguntas repetidas antes de que lleguen por correo.
3. **La primera reseña pública es negativa, antes de acumular reseñas positivas que la contextualicen.** Con 0-2 reseñas totales, una negativa pesa desproporcionadamente. *Mitigación:* validación privada (Capítulo 3, semana 3) existe precisamente para encontrar y corregir el problema ANTES de exponerlo a un desconocido que deja reseña pública; responder públicamente toda reseña negativa con honestidad y una solución concreta, nunca a la defensiva.
4. **Confusión de precio/versión en el checkout** (p. ej. el precio de lanzamiento no se retira a tiempo, o un comprador ve una versión de la página desactualizada por caché). *Mitigación:* checklist de publicación ya existente (`GUMROAD_LAUNCH_PLAN.md` §4) incluye verificación manual antes de cada cambio de precio; la transición de precio (Capítulo 3, semana 6) se anuncia con fecha exacta, no "pronto".
5. **El mensaje de valor (GTM Cap. 6) no conecta con el comprador real, y el equipo tarda en notarlo por no revisar el dashboard con disciplina.** *Mitigación:* el dashboard del Capítulo 8 se revisa literalmente cada lunes desde la semana 4, sin excepción, y la revisión formal de la semana 9 (Capítulo 3) es un punto de decisión explícito, no opcional.

# 10. Plan de los primeros 30 días después del lanzamiento público (roadmap de negocio, no técnico)

Empieza el día del lanzamiento público (fin de la Semana 3 / inicio de la Semana 4 del Capítulo 3).

**Días 1-7 (Semana de lanzamiento):**
- Anuncio en los 2-3 canales elegidos (GTM Cap. 10) + red personal, el mismo día.
- Revisión del dashboard (Capítulo 8) todos los días, no solo el lunes — es la semana de mayor riesgo y mayor aprendizaje.
- Contacto personal con cada comprador dentro de las primeras 24 horas de su compra.
- Ninguna decisión de precio o mensaje se cambia todavía — una semana no es suficiente señal.

**Días 8-14:**
- Primer envío de la pregunta de validación (Capítulo 7) a quienes compraron en la semana 1.
- Verificar si el precio de lanzamiento debe cerrarse por haber alcanzado 50 compradores antes de las 2 semanas — si es así, ejecutar la transición de precio de inmediato, no esperar al día 14 exacto.
- Primer conteo real de canal de origen de cada venta — confirmar o descartar la hipótesis de canales del GTM con datos, no con impresión.

**Días 15-21:**
- Si el precio de lanzamiento no se cerró antes por volumen, cerrarlo aquí (fin de la ventana de 2 semanas) con aviso explícito.
- Solicitar activamente reseñas a quienes ya dieron feedback positivo en la conversación de validación — pedir la reseña después del feedback, no antes.
- Publicar la primera pieza de contenido basada en un caso de uso real (con permiso del comprador).

**Días 22-30:**
- Compilar el primer informe real contra el objetivo del Capítulo 1: ¿cuántas ventas, cuántas reseñas, qué dice el patrón de soporte?
- Decidir explícitamente: ¿el mensaje de valor necesita ajuste antes de seguir invirtiendo tiempo en más de lo mismo? Esta es una decisión de negocio, se toma con los datos de los primeros 30 días, no se pospone al día 90 completo.
- Preparar la segunda ola de contenido (semana 7 del Capítulo 3) con lo aprendido en el primer mes real de vida pública.

---

# Si solo pudiéramos hacer 10 cosas antes del lanzamiento

Este es el backlog oficial de lanzamiento, ordenado de la más a la menos importante:

1. **Rebrandear a THÖREN todo el copy comercial ya escrito** (Gumroad, FAQ, página de producto).
2. **Regenerar las 4 capturas de pantalla reales sobre el build THÖREN.**
3. **Validar el producto y las páginas con 10-20 testers reales, en privado, antes de cobrar a un desconocido.**
4. **Ejecutar la compra de prueba propia y el checklist de publicación ya escrito, en modo no listado.**
5. **Redactar el email de bienvenida post-compra y la política de soporte pública.**
6. **Lanzar públicamente con el precio de lanzamiento activo, anunciando en 2-3 comunidades de nicho reales.**
7. **Contactar personalmente a cada uno de los primeros compradores dentro de las primeras 24 horas.**
8. **Instrumentar el dashboard del Capítulo 8 desde el primer día — no reconstruirlo retroactivamente al día 30.**
9. **Producir el video demo** (el guion ya existe) — puede llegar en la primera semana de vida pública, no antes de las tareas 1-7.
10. **Producir la imagen de portada/hero y el ícono de miniatura** — el último ítem, porque las capturas reales (tarea 2) ya cubren el mínimo indispensable de mostrar el producto.

---

*Este documento es el plan de ejecución — no se reabre la estrategia (`THOREN_Positioning_GoToMarket_Strategy_v1.0.md`) para modificarla. Se actualiza únicamente con evidencia real de las primeras semanas de vida pública, siguiendo la misma disciplina de verificación antes de avanzar que ya gobernó el desarrollo técnico de este producto.*
