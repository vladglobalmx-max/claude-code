# THÖREN — Plan de Beta Comercial

**Origen.** Punto de control ya reservado en `THOREN_CATALOG_PRODUCTION_PLAN_v1.md` (DEC-006) al cerrar los Lotes 1-3: pausar la producción de templates y validar el catálogo actual con usuarios reales antes de invertir en la integración de ilustración (Lote 4). Formalizado en `THOREN_DECISION_LOG.md` DEC-015. Este documento es el entregable propio que ese punto de control exigía.

**Regla que gobierna esta beta** (heredada del plan maestro, sin excepción): la Beta Comercial puede reordenar la **prioridad** de los Lotes 4-12 según lo que el mercado muestre — nunca puede alterar la arquitectura ni la infraestructura ya aprobadas.

---

## 1. Objetivos de la beta

1. Confirmar que una persona real, sin guía, puede completar el flujo completo (elegir template → personalizar → exportar para imprenta) sin ayuda externa.
2. Detectar qué categorías/colecciones del catálogo actual generan más interés real (uso, no solo opinión) — insumo directo para reordenar la prioridad de los Lotes 4-12.
3. Confirmar o corregir decisiones de diseño ya congeladas (paleta por familia, "cero ilustración" como estándar de los Lotes 1-3, `arrangeRingText`) contra el criterio de alguien que nunca vio el proceso de producción.
4. Decidir, con evidencia real en vez de suposición interna, si el Lote 4 (integración de ilustración) es realmente el siguiente paso de mayor valor o si el mercado señala otra prioridad.
5. Validar que la propuesta de precio y el posicionamiento ya definidos en `GUMROAD_LAUNCH_PLAN.md` (pago único, $19 lanzamiento / $29 catálogo) resisten el contacto con compradores reales.

**Objetivo explícito que esta beta NO tiene**: no es una prueba de estrés de infraestructura, ni una validación de escalabilidad — el producto es 100% cliente (sin backend), así que ese riesgo no aplica.

## 2. Alcance

- **Producto**: el paquete comercial ya construido y verificado en RC1 (`build:commercial`, checksums validados, prueba de recorrido completo en Chromium) — sin ningún cambio de código adicional para la beta. Se usa exactamente lo que ya existe.
- **Canal**: Gumroad en modo **no listado** (mecanismo ya documentado en `GUMROAD_LAUNCH_PLAN.md` §4 — "publicar en modo no listado primero y hacer una compra de prueba propia antes de listar públicamente"). El enlace no listado se comparte únicamente con los participantes reclutados, nunca de forma pública.
- **Precio de la beta**: acceso gratuito o a precio simbólico (a decidir por el usuario; recomendado: código de descuento del 100% vía Gumroad para participantes confirmados) — el objetivo es maximizar la calidad del feedback, no generar ingreso en esta fase. El precio de catálogo ($19/$29) se valida indirectamente preguntando "¿pagarías $X por esto?", no cobrándolo de entrada.
- **Fuera de alcance explícito**:
  - No se integra ilustración ni se adelanta ningún trabajo del Lote 4.
  - No se construye ninguna infraestructura de telemetría, encuestas in-app, ni analítica de producto — THÖREN mantiene su compromiso de privacidad ya decidido en Fase 4.1 ("Ninguno propio de THÖREN" en datos recopilados, ver `V1_COMMERCIAL_RECOMMENDATION.md` §8); toda medición de esta beta usa canales externos al runtime del Builder (ver punto 7).
  - No se publica públicamente en Gumroad ni se anuncia en redes durante la duración de la beta.
  - No se modifican los 15 templates existentes salvo que la beta revele un defecto real (no una preferencia estética sin sustento).

## 3. Público objetivo

Reclutamiento dirigido, no abierto — participantes que coincidan con al menos una de las categorías ya cubiertas por el catálogo actual, para que el feedback sea representativo de a quién THÖREN ya sirve:

| Categoría del catálogo | Perfil de participante objetivo |
|---|---|
| Cosmetics, Beauty | Marcas de skincare/salones de belleza independientes |
| Business | Pequeñas empresas B2B, despachos profesionales |
| Etsy Sellers, Retail, Crafts | Vendedores de Etsy/marketplaces, productores locales, manufactura casera |
| Product Labels | Emprendedores en etapa temprana sin categoría propia todavía |
| Wedding | Parejas planeando su boda, wedding planners |

Criterio de inclusión: la persona debe **necesitar realmente** stickers/etiquetas listos para imprenta en los próximos 1-3 meses (no un "probador" sin necesidad real) — el mismo criterio de autenticidad que ya rige el resto del proyecto ("¿esto ayuda a que una persona compre y use THÖREN?").

## 4. Número de participantes

**15-25 participantes confirmados**, distribuidos aproximadamente parejo entre las 5 agrupaciones de categoría del punto 3 (3-5 por grupo).

Justificación del rango:
- Suficientemente grande para detectar un patrón real de preferencia por categoría (si 4 de 5 participantes de un grupo usan y valoran su categoría, es señal; si solo 1 de 25 en total la menciona, no lo es).
- Suficientemente pequeño para que el feedback se procese de forma manual (mismo criterio ya adoptado en `RC1_POST_LAUNCH_PLAN.md`: sin infraestructura de soporte automatizada) — 25 conversaciones por correo o llamada corta son manejables sin construir ninguna herramienta nueva.
- Consistente con el precio de lanzamiento ya definido ("primeros 50 compradores") — la beta es un subconjunto deliberadamente más pequeño y más controlado que el lanzamiento público que vendrá después.

## 5. Templates disponibles

Los 15 templates ya producidos y aprobados (piloto + Lotes 1-3), sin ningún template adicional ni recorte:

| Lote | Templates | Categorías cubiertas |
|---|---|---|
| Piloto | Serum Facial Premium | Cosmetics |
| Lote 1 (5) | Bálsamo Labial Natural, Spa & Bienestar, Etiqueta Neutral Minimalista, Sello de Cierre, Gracias por tu Preferencia | Cosmetics, Beauty, Product Labels, Packaging, Business |
| Lote 2 (5) | Etiqueta Kraft Genérica, Etiqueta Corporativa Simple, Sello de Regalo Hecho a Mano, Kraft Hecho a Mano, Empaque Artesanal Etsy | Product Labels, Crafts, Etsy Sellers |
| Lote 3 (4) | Sello de Cita — Salón de Belleza, Sello Corporativo, Sello "Hecho en Casa", Sello de Sobre de Invitación | Beauty, Business, Retail, Wedding |

Ningún template se oculta ni se marca como "beta" dentro de la app — todos aparecen en la galería exactamente como los verá el comprador final del lanzamiento público.

## 6. Flujo de uso esperado

1. El participante recibe el enlace no listado de Gumroad + instrucciones breves (1 párrafo: qué es, qué se le pide).
2. Descarga y ejecuta el paquete (launcher de un clic, sin instalación) — primer punto de fricción posible, ya cubierto por `COMMERCIAL_WALKTHROUGH_VERIFICATION.md`.
3. Ve la bienvenida de primera ejecución (welcomeDialog) y la galería de templates.
4. Elige un template de una categoría relevante para su necesidad real (no uno al azar).
5. Lo personaliza (texto, colores dentro de lo que el template permite) usando el editor.
6. Exporta al menos un archivo (PNG, SVG, o el flujo completo de "Exportar para impresión" con Preflight) — este es el evento mínimo de éxito (ver punto 7).
7. Responde el pedido de retroalimentación (punto 9) — por correo o en una llamada corta de 15-20 minutos, según preferencia del participante.

Tiempo estimado total por participante: 20-40 minutos (consistente con "10 minutos de personalización" ya estimado por template en sus Commercial Sheets, más tiempo de exploración inicial).

## 7. Métricas de éxito

Dado que THÖREN no recopila telemetría propia (decisión ya tomada en Fase 4.1 — ver `V1_COMMERCIAL_RECOMMENDATION.md` §8, "Ninguno propio de THÖREN"), ninguna métrica de esta beta depende de instrumentar la app. Todas se miden por canales externos ya existentes o por auto-reporte del participante:

| Métrica | Fuente | Umbral de éxito |
|---|---|---|
| Tasa de activación (descarga → al menos 1 exportación completada) | Auto-reporte del participante (paso 6 confirmado) | ≥70% de los participantes confirmados |
| Completación sin ayuda externa | Auto-reporte ("¿necesitaste preguntar algo para completar el flujo?") | ≥80% completa sin soporte |
| Interés por categoría | Elección real de template + comentario cualitativo | Al menos 3 categorías con señal positiva clara (no solo 1) |
| Disposición a pagar el precio de catálogo | Pregunta directa en el feedback ("¿pagarías $19-29 por esto?") | ≥60% responde sí o "sí, con [ajuste puntual]" |
| Calidad de exportación percibida | Pregunta directa + revisión del archivo exportado real que comparta el participante | Ningún reporte de archivo no apto para imprenta |

## 8. Métricas de abandono

| Señal de abandono | Cómo se detecta | Umbral de alerta |
|---|---|---|
| No llega a instalar/abrir el producto | El participante no responde tras 3 días del envío del enlace | >20% de los reclutados |
| Abre la app pero no completa ninguna exportación | Auto-reporte o silencio total tras seguimiento | >20% de los que sí abrieron |
| Abandona a mitad de personalización | Auto-reporte del paso exacto donde se detuvo, con motivo | Cualquier motivo que se repita en ≥3 participantes distintos (señal de un problema real, no anecdótico) |
| No responde el pedido de feedback aunque sí exportó | Seguimiento activo, 1 recordatorio máximo | Se registra igual como participación parcial, no se insiste más de una vez (mismo criterio de cortesía ya usado en `RC1_POST_LAUNCH_PLAN.md`) |

Un umbral de alerta cruzado no detiene la beta automáticamente — se documenta y se investiga la causa (ej. instrucciones poco claras vs. problema real del producto) antes de sacar cualquier conclusión.

## 9. Retroalimentación que queremos obtener

Preguntas específicas (por correo o llamada corta, mismo canal manual ya adoptado para soporte en V1 — sin formulario nuevo que construir):

1. ¿Qué template elegiste y por qué (de las categorías disponibles)?
2. ¿Completaste una exportación? Si no, ¿en qué paso te detuviste y por qué?
3. ¿Necesitaste ayuda externa (buscar en internet, preguntarle a alguien) en algún punto? ¿Cuál?
4. ¿El archivo exportado te sirve tal cual para llevarlo a imprenta, o le harías algún cambio antes?
5. ¿Qué te pareció el nivel de personalización disponible — suficiente, insuficiente, o justo?
6. ¿Pagarías $19-29 USD por esto? Si no, ¿qué precio te parecería justo?
7. ¿Qué categoría de producto te gustaría ver que el catálogo todavía no cubre?
8. ¿Algo se sintió roto, confuso, o "no terminado"?

## 10. Riesgos

- **Muestra sesgada por reclutamiento manual**: al reclutar directamente (no vía anuncio abierto), el grupo puede sobrerrepresentar contactos cercanos al proyecto — mitigado exigiendo el criterio de necesidad real (punto 3), no solo disponibilidad para probar algo.
- **Feedback cualitativo contradictorio entre categorías**: con solo 15-25 participantes, es posible que ninguna categoría muestre una señal clara — en ese caso, la recomendación es no reordenar la prioridad de los Lotes 4-12 sin evidencia, y documentarlo explícitamente en vez de forzar una conclusión.
- **Filtración del enlace no listado más allá de los participantes**: mitigado usando un código de descuento del 100% ligado a invitación, no un enlace público compartible sin control.
- **Participantes que no completan ni responden**: cubierto por las métricas de abandono (punto 8) — un `n` efectivo menor al esperado se documenta como limitación del resultado, no se oculta.
- **Confundir "no les gustó el template que probaron" con "el sistema arrangeRingText no funciona"**: DEC-015 ya validó `arrangeRingText` como parte del estándar técnico — la beta evalúa contenido/categoría/precio, no vuelve a poner en duda una capacidad ya aprobada técnica y visualmente.
- **Tentación de agregar infraestructura de medición durante la beta** (encuestas in-app, analítica): rechazada de antemano (punto 2, fuera de alcance) — sería exactamente el tipo de inversión no validada que esta beta busca evitar antes de confirmarla con evidencia.

## 11. Criterios para reanudar la producción del Lote 4

La producción del Lote 4 se reanuda cuando se cumplan **todas** las siguientes condiciones:

1. La Beta Comercial concluyó (todos los participantes reclutados respondieron o se agotó el plazo de seguimiento, ver punto 8).
2. Se completó una revisión de los resultados contra las métricas de éxito (punto 7) y de abandono (punto 8), documentada en un reporte de cierre de la beta (mismo formato de reporte ya usado en los Lotes 1-3 — commitear antes de reanudar producción, per la práctica ya vigente).
3. El usuario aprobó explícitamente ese reporte de cierre — ninguna decisión de reanudar producción se toma solo con la evidencia recolectada, requiere la misma aprobación humana que rige cualquier avance de lote.
4. Se decidió explícitamente, con base en la evidencia, uno de estos dos caminos (nunca ambos sin decisión expresa):
   - **(a) Proceder con el Lote 4 tal como está planeado** (integración de ilustración), si la beta no reveló una prioridad distinta más urgente.
   - **(b) Reordenar la prioridad de los Lotes 4-12** hacia la categoría/capacidad que la beta mostró como de mayor interés real — sin alterar la arquitectura ni la infraestructura ya aprobadas (regla heredada del plan maestro, sin excepción).
5. Si la tasa de activación o completación sin ayuda (punto 7) quedó por debajo del umbral definido, se prioriza investigar y resolver esa fricción de producto **antes** de cualquier lote nuevo — ninguna cantidad de templates adicionales compensa un flujo de uso que ya falla para los usuarios actuales.

---

## Estado

**Plan de Beta Comercial listo para aprobación.** No se recluta ningún participante ni se publica nada en Gumroad hasta que el usuario apruebe este documento explícitamente.
