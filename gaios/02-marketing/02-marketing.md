# GAIOS — Módulo 2: Marketing

> Motor de generación de demanda B2B: de la atracción de audiencia al lead calificado entregado a Ventas bajo un SLA formal.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director de Marketing · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 1 — Comercial/CRM (ICP, definición de MQL)

---

## 1. Objetivo

Estandarizar el motor de generación de demanda B2B — planeación de contenido, captura de leads, nutrición, lead scoring y entrega a Ventas — para incrementar el volumen y la calidad de los MQLs que alimentan el pipeline comercial (Módulo 1), reducir el costo de adquisición de cliente (CAC) y **reducir la dependencia del Director de Marketing** en decisiones repetitivas de campaña (qué publicar, a quién enviar, cuándo escalar presupuesto).

## 2. Alcance

**Incluye:** estrategia de contenidos por etapa del embudo (TOFU/MOFU/BOFU), captura y nutrición de leads, modelo de lead scoring, el SLA Marketing-Ventas (Demand Waterfall: Inquiry → MQL → SAL → SQL), gestión del ciclo de vida de campañas, gobierno de marca en piezas publicadas.

**Excluye:** el proceso de venta posterior a la aceptación del lead por Ventas (Módulo 1); relaciones públicas y comunicación corporativa institucional; diseño de producto y política de precios (otros módulos).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Inbound Marketing Methodology (HubSpot) — Atraer, Convertir, Cerrar, Deleitar | Estructura general del motor de demanda |
| RACE Framework (Smart Insights) — Reach, Act, Convert, Engage | Planeación de campañas por etapa |
| SiriusDecisions Demand Waterfall | Modelo de etapas Inquiry → MQL → SAL → SQL |
| Content Marketing Institute | Estándares de calendario y producción editorial |
| Account-Based Marketing (ITSMA) | Enfoque para cuentas de alto valor del ICP |
| Módulo 1 — Comercial/CRM | ICP y definición de MQL/SQL ya establecidas — no se redefinen aquí |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director de Marketing | Dueño del proceso, presupuesto, SLA con Ventas | X | X | | |
| Growth/Content Marketer | Ejecuta calendario, campañas, nutrición | X | | | |
| Diseñador | Piezas gráficas, gobierno de marca | X | | | |
| Director Comercial | Co-dueño del SLA (acepta/rechaza MQLs) | | | X | |
| Chief AI Officer | Automatización de scoring, nutrición, contenido asistido | | | X | |
| CEO | Sponsor de presupuesto y posicionamiento | | | | X |

## 5. Herramientas

- **Marketing automation:** HubSpot / Marketo / ActiveCampaign.
- **CMS y landing pages:** Webflow / WordPress / HubSpot CMS.
- **SEO:** Ahrefs / Semrush.
- **Publicación en redes:** Buffer / Hootsuite.
- **Webinars:** Zoom Webinar / Livestorm.
- **Ads:** LinkedIn Ads Manager, Google Ads.
- **CRM compartido con Módulo 1** para sincronizar scoring y estado del lead.

## 6. Procedimiento paso a paso

1. **Planeación trimestral:** calendario de contenido y campañas alineado al ICP y a los buyer personas definidos en el Módulo 1.
2. **Producción de contenido por etapa del embudo:** TOFU (awareness — blog, redes, SEO), MOFU (consideración — ebooks, webinars, comparativas), BOFU (decisión — casos de éxito, demos, calculadoras de ROI).
3. **Captura de leads:** formularios en landing pages y contenido gated generan el registro inicial (**Inquiry**) en el CRM.
4. **Nutrición automatizada:** secuencias de email según la etapa del embudo en que se capturó el lead.
5. **Lead scoring:** puntaje demográfico (encaje con ICP) + puntaje de comportamiento (interacción con contenido); al cruzar el umbral definido, el lead se marca **MQL** (ver `sop-lead-scoring-mql.md`).
6. **Entrega a Ventas bajo SLA:** el MQL se asigna a un AE, quien tiene un tiempo máximo de respuesta para aceptarlo (**SAL** — Sales Accepted Lead) o rechazarlo con motivo.
7. **Calificación por Ventas (Módulo 1):** el SAL se califica con BANT/MEDDIC y se convierte en **SQL** o se regresa a Marketing como "reciclado" con motivo específico.
8. **Medición y atribución:** cada campaña se cierra con reporte de costo por lead, MQLs generados, tasa de conversión a SQL y retorno estimado, retroalimentando la planeación del siguiente trimestre.

## 7. Diagrama de flujo (descrito en texto)

```
[Contenido TOFU/MOFU/BOFU] ──► [Captura de lead: Inquiry]
        │
        ▼
[Nutrición automatizada] ──► [Lead Scoring]
        │
        ▼
  ¿Cruza el umbral? ──No──► [Sigue en nutrición / re-scoring]
        │ Sí
        ▼
[MQL] ──► [Asignación a Ventas — SLA de tiempo de respuesta]
        │
        ▼
  ¿Ventas acepta? ──No (con motivo)──► [Reciclar a Marketing]
        │ Sí
        ▼
[SAL] ──► [Calificación BANT/MEDDIC — Módulo 1]
        │
        ▼
  ¿Califica? ──No (motivo codificado)──► [Reciclar a Marketing]
        │ Sí
        ▼
[SQL] ──► [Entra al pipeline comercial — Módulo 1]
        │
        ▼
[Reporte de atribución y CAC] ──► [Retroalimenta planeación trimestral]
```

## 8. Checklist operativo

- [ ] Todo contenido publicado sigue el gobierno de marca (tono, logo, plantillas).
- [ ] Toda campaña tiene brief aprobado antes del lanzamiento (`plantilla-brief-campana.md`).
- [ ] Todo enlace de campaña lleva etiquetado UTM para atribución.
- [ ] El modelo de lead scoring está vigente (revisado en los últimos 3 meses).
- [ ] Ningún MQL se entrega a Ventas sin cumplir el umbral de scoring acordado.
- [ ] El SLA de tiempo de respuesta de Ventas se cumple y se mide.
- [ ] Todo lead reciclado tiene motivo codificado, no texto libre.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Costo por lead (CPL) | Gasto de campaña / leads generados | Reducción trimestral por canal |
| Volumen de MQL | MQLs generados en el periodo | Crecimiento sostenido trimestre a trimestre |
| Conversión MQL → SQL | SQLs / MQLs entregados | ≥ 30% (referencia B2B) |
| Costo de adquisición de cliente (CAC) | Gasto total de marketing y ventas / clientes nuevos | Reducción sostenida |
| Cumplimiento del SLA | MQLs respondidos a tiempo / MQLs entregados | ≥ 95% |
| % de pipeline originado en Marketing | Valor de oportunidades con fuente Marketing / pipeline total | Creciente |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| MQLs de baja calidad → Ventas deja de confiar en Marketing | Alta | Alto |
| SLA incumplido de forma sistemática por cualquiera de las partes | Media | Alto |
| Atribución poco confiable, decisiones de presupuesto a ciegas | Media | Alto |
| Dependencia de un solo canal (ej. solo paid ads) | Media | Medio |
| Inconsistencia de marca entre piezas y campañas | Baja | Medio |

## 11. Controles

- Revisión mensual conjunta Marketing-Ventas de la conversión MQL→SQL y de los motivos de reciclaje.
- Revisión trimestral del modelo de lead scoring y de los umbrales, con datos reales de conversión.
- Aprobación de diseño/marca antes de publicar cualquier pieza pública.
- Límites de aprobación de presupuesto de ads por campaña (ej. >$X requiere aprobación del Director de Marketing; >$Y, del CFO).
- El SLA de tiempo de respuesta se mide automáticamente en el CRM, no se autorreporta.

## 12. Automatizaciones posibles

- **Lead scoring automático** en el CRM/marketing automation, sin intervención manual.
- **Secuencias de nutrición automatizadas** según etapa del embudo y comportamiento.
- **Alerta de incumplimiento de SLA** cuando un MQL no ha sido contactado en el tiempo acordado.
- **Reporte de atribución automático** por campaña y canal.
- **Generación asistida de contenido** (borradores de blog, variantes de copy para ads) con revisión editorial humana obligatoria antes de publicar.
- **Programación automática de redes sociales** desde el calendario de contenido aprobado.

## 13. Prompts IA relacionados

1. *"Genera 5 ideas de contenido TOFU para el ICP [descripción], basadas en los dolores identificados en las llamadas de descubrimiento del equipo comercial (Módulo 1)."*
2. *"Redacta 3 variantes de copy para anuncio de LinkedIn Ads dirigido a [buyer persona], cada una probando un ángulo distinto (dolor, resultado, prueba social)."*
3. *"Diseña una secuencia de 5 correos de nutrición para un lead que descargó [contenido MOFU], moviéndolo hacia una demo o consulta."*
4. *"Con este export de campaña, redacta el reporte de cierre: CPL, MQLs generados, conversión a SQL y recomendación para el siguiente trimestre."*
5. *"Analiza los motivos de reciclaje de MQLs de este trimestre y sugiere ajustes al modelo de lead scoring o a los criterios de contenido."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- La conversión MQL → SQL alcanza o supera el 30%, señal de que Ventas confía en la calidad de los MQLs.
- El cumplimiento del SLA de respuesta se sostiene ≥95% de ambos lados (Marketing entrega a tiempo, Ventas responde a tiempo).
- El CAC muestra una tendencia sostenida a la baja o estable con crecimiento de pipeline.
- El Director de Marketing reporta menos tiempo dedicado a decisiones tácticas repetitivas de campaña.

## 15. Plan de mejora continua

- **Revisión mensual** Marketing-Ventas de conversión y calidad de MQLs.
- **Revisión trimestral** del modelo de lead scoring, el mix de canales y el ICP (en conjunto con Módulo 1).
- **Revisión de este documento cada 6 meses**, o antes si cambia el modelo de go-to-market.
- **Retroalimentación continua** canalizada al comité mensual de gobierno de GAIOS (Módulo 0).

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Generación de contenido | `gaios/02-marketing/sop-generacion-contenido.md` |
| SOP — Lead scoring y SLA Marketing-Ventas | `gaios/02-marketing/sop-lead-scoring-mql.md` |
| SOP — Gestión del ciclo de vida de campañas | `gaios/02-marketing/sop-gestion-campanas.md` |
| Plantilla — Brief de campaña | `gaios/02-marketing/plantilla-brief-campana.md` |
| Checklist operativo de aceptación | `gaios/02-marketing/checklist-modulo2.md` |
| Prompts IA relacionados (ampliado) | `gaios/02-marketing/prompts-ia-modulo2.md` |
| Formulario / dashboard de KPIs de marketing | `gaios/02-marketing/kpis-dashboard-marketing.md` |

**Próximos módulos dependientes:** Módulo 1 (Comercial/CRM) consume directamente el flujo de MQL/SAL/SQL definido aquí; Módulo 11 (Atención al Cliente) puede reutilizar el modelo de nutrición para campañas de retención; Módulo 6 (Finanzas) consume el reporte de CAC para análisis de unit economics.
