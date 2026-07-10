# GAIOS — Módulo 11: Atención al Cliente / Servicio Postventa

> Del handoff de Ventas a la renovación: SLA de soporte por severidad, medición continua de satisfacción y gestión proactiva del riesgo de churn.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director Comercial (o Customer Success Manager) · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 1 — Comercial/CRM (handoff)

---

## 1. Objetivo

Estandarizar la atención postventa — desde la recepción del handoff de Ventas hasta la renovación o el churn — asegurando SLA de respuesta por severidad, medición continua de satisfacción (NPS/CSAT) y gestión proactiva de la salud del cliente, para reducir el churn evitable y **la dependencia del Director Comercial** en la resolución manual de cada caso individual.

## 2. Alcance

**Incluye:** recepción y validación del handoff de ventas, onboarding del cliente, gestión de tickets de soporte por niveles con SLA, medición de NPS/CSAT, customer health score, gestión de renovación y de churn.

**Excluye:** el proceso de venta en sí (Módulo 1); el desarrollo de producto (fuera de alcance de este manual salvo módulo aparte); disputas de facturación, que se coordinan con el Módulo 6 pero se resuelven ahí.

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Customer Success methodology | Estructura de onboarding, health score y gestión de renovación |
| Net Promoter Score (Reichheld) | Medición de satisfacción y lealtad del cliente |
| Matriz de escalamiento (análoga a ITIL) | Niveles de soporte (Tier 1/2/3) con SLA por severidad |
| Módulo 1 — Comercial/CRM | El handoff de la cuenta ganada es la entrada de este proceso |
| Módulo 6 — Finanzas | Coordinación en disputas de facturación |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director Comercial / Customer Success Manager | Dueño del proceso, gestión de cuentas en riesgo | X | X | | |
| Agente de soporte | Ejecuta tickets según nivel y SLA | X | | | |
| Director de Operaciones | Consultado si el problema es de entrega/calidad (Módulo 3) | | | X | |
| CFO | Consultado en disputas de facturación (Módulo 6) | | | X | |

## 5. Herramientas

- **Sistema de tickets:** Zendesk / Freshdesk / Intercom.
- **Encuestas:** NPS trimestral, CSAT por ticket resuelto.
- **CRM compartido con Módulo 1** para historial completo de la cuenta.
- **Dashboard de customer health score.**

## 6. Procedimiento paso a paso

1. **Recepción del handoff:** validar que la información de Ventas (Módulo 1) esté completa antes de iniciar la relación postventa — sin handoff completo, el cliente repite lo que ya explicó.
2. **Onboarding del cliente (kickoff):** primeras semanas críticas con objetivos claros, análogas al 30-60-90 de RRHH pero orientadas al cliente.
3. **Gestión de tickets por niveles:** Tier 1 (consultas básicas), Tier 2 (problemas técnicos), Tier 3 (escalamiento a producto/ingeniería), cada uno con SLA de respuesta según severidad (`sop-gestion-tickets-soporte.md`).
4. **Medición continua:** NPS trimestral y CSAT por ticket resuelto (`plantilla-encuesta-nps-csat.md`).
5. **Customer health score:** combinación de uso del producto, tickets abiertos, NPS y comportamiento de pago, para predecir el riesgo de churn.
6. **Gestión proactiva de cuentas en riesgo:** intervención antes de que el cliente decida no renovar (`sop-customer-health-renovacion.md`).
7. **Renovación/upsell:** proceso coordinado con Ventas (Módulo 1) cuando se acerca la fecha de renovación.
8. **Gestión de churn:** si el cliente se va, entrevista de salida con motivo codificado, retroalimentando Producto y Marketing (Módulo 2).

## 7. Diagrama de flujo (descrito en texto)

```
[Handoff de Ventas (Módulo 1)] ──► ¿Completo? ──No──► [Regresar a Ventas para completar]
        │ Sí
        ▼
[Onboarding del cliente (kickoff)]
        │
        ▼
[Ticket de soporte] ──► [Clasificar Tier 1/2/3 con SLA por severidad]
        │
        ▼
[Medición NPS/CSAT] ──► [Customer health score]
        │
        ▼
  ¿Health score bajo? ──Sí──► [Intervención proactiva]
        │ No
        ▼
[Renovación/upsell] ──► ¿Renueva? ──No──► [Entrevista de salida, motivo codificado] ──► [Retroalimenta Producto/Marketing]
        │ Sí
        ▼
[Cliente activo — ciclo continúa]
```

## 8. Checklist operativo

- [ ] Handoff de Ventas validado como completo antes de iniciar el onboarding del cliente.
- [ ] Todo ticket clasificado por Tier y severidad, con SLA aplicado.
- [ ] NPS medido trimestralmente; CSAT medido por ticket resuelto.
- [ ] Cuentas con health score bajo tienen plan de intervención documentado.
- [ ] Todo churn tiene entrevista de salida con motivo codificado.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| NPS | % promotores − % detractores | Benchmark de industria, tendencia creciente |
| CSAT | % de tickets calificados como satisfactorios | ≥ 90% |
| Tiempo de primera respuesta | Minutos/horas por severidad | Según SLA definido |
| Tasa de resolución en Tier 1 | Resueltos sin escalar / total | ≥ 70% |
| Tasa de churn | Clientes perdidos / clientes activos del periodo | Decreciente |
| Customer health score promedio | Promedio ponderado de la cartera activa | Creciente |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Handoff incompleto — el cliente repite información y se frustra desde el inicio | Media | Alto |
| Tickets sin SLA generan percepción de abandono | Media | Alto |
| Churn reactivo: se detecta cuando el cliente ya decidió irse | Alta | Alto |
| Sin medición de NPS, no hay señal temprana de insatisfacción | Media | Medio |

## 11. Controles

- Ningún cliente pasa a "activo" sin handoff completo confirmado por Customer Success.
- SLA de tickets auditado semanalmente por severidad.
- Cuentas con health score bajo un umbral se escalan automáticamente a intervención proactiva.
- Entrevista de salida obligatoria en todo churn, con motivo codificado (lista cerrada, no texto libre).

## 12. Automatizaciones posibles

- **Enrutamiento automático de tickets** por tipo y severidad al agente o equipo correspondiente.
- **Encuestas NPS/CSAT automáticas** post-resolución o trimestrales.
- **Alertas de customer health score bajo umbral**, disparando la intervención proactiva.
- **Recordatorio automático de renovación próxima** al equipo comercial y de éxito del cliente.

## 13. Prompts IA relacionados

1. *"Redacta una respuesta a este ticket de soporte [descripción del problema], con tono empático, solución clara y próximos pasos concretos."*
2. *"Con estos resultados de NPS del trimestre, identifica los temas más mencionados por los detractores y prioriza 3 acciones."*
3. *"Genera el guion de la llamada de intervención proactiva para esta cuenta en riesgo [datos de health score], enfocado en entender la causa antes de ofrecer soluciones."*
4. *"Analiza estos motivos de churn codificados de los últimos 2 trimestres y agrupa los patrones más frecuentes para retroalimentar a Producto y Marketing."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de las cuentas nuevas con handoff validado antes del onboarding.
- CSAT ≥90% sostenido.
- Tasa de resolución en Tier 1 ≥70%.
- Al menos el 80% de las cuentas con health score bajo reciben intervención proactiva antes de la fecha de renovación.

## 15. Plan de mejora continua

- **Revisión mensual** de SLA de tickets y CSAT.
- **Revisión trimestral** de NPS y del modelo de customer health score.
- **Revisión de este documento cada 6 meses.**
- **Aplicación de DMAIC (Módulo 3)** si un tipo de ticket se vuelve recurrente y señala un problema sistémico de producto u operación.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Gestión de tickets de soporte | `gaios/11-atencion-cliente/sop-gestion-tickets-soporte.md` |
| SOP — Customer health score y renovación | `gaios/11-atencion-cliente/sop-customer-health-renovacion.md` |
| Plantilla — Encuesta NPS/CSAT | `gaios/11-atencion-cliente/plantilla-encuesta-nps-csat.md` |
| Checklist operativo de aceptación | `gaios/11-atencion-cliente/checklist-modulo11.md` |
| Prompts IA relacionados (ampliado) | `gaios/11-atencion-cliente/prompts-ia-modulo11.md` |
| Formulario / dashboard de KPIs de atención al cliente | `gaios/11-atencion-cliente/kpis-dashboard-atencion-cliente.md` |

**Próximos módulos dependientes:** Módulo 12 (Calidad/Mejora Continua) consume los patrones de tickets recurrentes como candidatos a proyecto DMAIC; Módulo 2 (Marketing) consume los motivos de churn para ajustar el ICP y el contenido.
