# GAIOS — Módulo 1: Comercial / CRM

> Proceso comercial B2B estandarizado, de prospección a cierre, operado sobre el CRM como sistema de registro único.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director Comercial · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra

---

## 1. Objetivo

Estandarizar el proceso comercial B2B end-to-end (prospección → calificación → descubrimiento → propuesta → negociación → cierre → handoff a operaciones) operado íntegramente sobre el CRM, para incrementar la tasa de conversión, acortar el ciclo de venta, mejorar la precisión del forecast y **reducir la dependencia del Director Comercial** en decisiones repetitivas de pipeline (autorizar descuentos rutinarios, dar seguimiento manual a cada oportunidad, reconstruir el forecast a mano).

## 2. Alcance

**Incluye:** el pipeline comercial completo desde que un lead calificado (MQL) entra al embudo hasta el cierre (ganado/perdido) y el handoff a operaciones/postventa; el framework de calificación; la higiene de datos del CRM; el ritmo de revisión de pipeline y forecasting.

**Excluye:** generación de demanda y marketing de contenidos (Módulo 2 — Marketing); atención y éxito del cliente post-cierre (Módulo 11 — Atención al Cliente); diseño de esquemas de comisión y compensación variable (Módulos RRHH/Finanzas); definición de precios de lista (Módulo Finanzas).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| MEDDIC / MEDDPICC (calificación B2B compleja) | Framework de calificación de oportunidades |
| BANT (Budget, Authority, Need, Timeline) | Calificación rápida de leads entrantes |
| The Challenger Sale (Dixon & Adamson) | Enfoque de descubrimiento y manejo de objeciones |
| Rockefeller Habits / Scaling Up | Ritmo de reuniones de pipeline (weekly, cuarterly) |
| Modelo de etapas de pipeline de Salesforce/HubSpot | Definición de etapas y criterios de salida |
| ICP (Ideal Customer Profile) de la empresa | Filtro de calificación inicial |
| Catálogo de productos/servicios y política de precios | Insumo para propuestas |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director Comercial | Dueño del proceso, forecast, aprobación de descuentos mayores | X | X | | |
| Ejecutivo de cuenta (AE) | Ejecuta cada etapa del pipeline en su cartera | X | | | |
| SDR/BDR (si existe) | Prospección y calificación inicial (BANT) | X | | | |
| Marketing | Entrega de MQLs con contexto de origen | | | X | |
| CFO | Aprueba condiciones de pago y descuentos fuera de umbral | | | X | |
| Chief AI Officer | Automatizaciones de pipeline y CRM | | | X | |
| Operaciones | Recibe el handoff de la cuenta ganada | | | | X |

## 5. Herramientas

- **CRM (sistema de registro único):** HubSpot / Salesforce / Pipedrive.
- **Prospección:** LinkedIn Sales Navigator, Apollo.io, secuenciador de email/llamadas.
- **Generación de propuestas:** PandaDoc / DocuSign / Proposify, con plantillas de precio pre-aprobadas.
- **Agenda:** Calendly o equivalente, sincronizado al CRM.
- **Inteligencia de llamadas:** grabación/transcripción (Gong, Fireflies) para calidad y coaching.
- **BI/Forecast:** dashboard nativo del CRM o Looker/Power BI conectado.

## 6. Procedimiento paso a paso

El pipeline tiene siete etapas. Ninguna oportunidad avanza de etapa sin cumplir el **criterio de salida** de la etapa anterior — este es el control central del proceso (ver sección 11).

1. **Prospección:** el SDR/AE identifica cuentas objetivo según el ICP y genera el primer contacto (outbound) o recibe el MQL de Marketing (inbound). *Criterio de salida:* contacto con un decisor o influenciador confirmado.
2. **Calificación (BANT/MEDDIC):** se valida Presupuesto, Autoridad, Necesidad y Tiempo (BANT) o, en ventas complejas, el set completo MEDDIC (Métricas, Comprador Económico, Criterios de Decisión, Proceso de Decisión, Dolor identificado, Campeón interno). *Criterio de salida:* ficha de calificación completa en el CRM (ver `plantilla-ficha-oportunidad.md`).
3. **Descubrimiento / Diagnóstico:** reunión estructurada para entender el problema del cliente a profundidad (enfoque Challenger: enseñar, adaptar, tomar control). *Criterio de salida:* dolor y valor cuantificado, documentado en el CRM.
4. **Propuesta:** se genera la propuesta formal con precio y alcance, usando plantillas pre-aprobadas. *Criterio de salida:* propuesta enviada y confirmada como recibida por el comprador económico.
5. **Negociación:** ajuste de condiciones dentro de los umbrales de descuento autorizados (sección 11); escalamiento a CFO si se excede el umbral. *Criterio de salida:* acuerdo verbal o escrito de condiciones finales.
6. **Cierre (Ganado / Perdido):** firma de contrato o confirmación de pérdida con motivo codificado. *Criterio de salida:* contrato firmado y cargado en el CRM, o motivo de pérdida registrado.
7. **Handoff a Operaciones:** transferencia estructurada de la cuenta ganada, con toda la información de calificación y descubrimiento, para evitar que el cliente "vuelva a explicar todo". *Criterio de salida:* confirmación de recepción del equipo de Operaciones/Postventa.

## 7. Diagrama de flujo (descrito en texto)

```
[Prospección] ──(MQL de Marketing / Outbound)──► [Calificación BANT/MEDDIC]
        │
        ▼
  ¿Cumple criterios mínimos? ──No──► [Descalificar / nutrir en Marketing]
        │ Sí
        ▼
[Descubrimiento / Diagnóstico] ──► [Dolor y valor cuantificados]
        │
        ▼
[Propuesta] ──► ¿Aceptada tal cual? ──No──► [Negociación] ──► ¿Dentro del umbral de descuento?
        │ Sí                                        │                    │ No
        ▼                                            │                    ▼
                                                       │            [Escalar a CFO]
                                                       ▼                    │
                                              [Acuerdo final] ◄─────────────┘
        ▼
[Cierre] ──► ¿Ganado? ──Sí──► [Handoff a Operaciones] ──► [Fin: cuenta activa]
        │ No
        ▼
[Registrar motivo de pérdida] ──► [Retroalimenta a Marketing/Producto]
```

## 8. Checklist operativo

- [ ] Toda oportunidad tiene ICP validado antes de entrar a Calificación.
- [ ] Ficha BANT/MEDDIC completa antes de pasar a Descubrimiento.
- [ ] Ninguna propuesta se envía sin pasar por la plantilla de precios pre-aprobada.
- [ ] Ningún descuento fuera del umbral se aplica sin aprobación del CFO documentada en el CRM.
- [ ] Toda oportunidad "Ganada" tiene handoff confirmado por Operaciones en ≤48 horas.
- [ ] Toda oportunidad "Perdida" tiene motivo codificado (no texto libre) para análisis agregado.
- [ ] El CRM no tiene oportunidades sin actividad registrada en más de 14 días (ver `sop-higiene-datos-crm.md`).

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Tasa de conversión por etapa | Oportunidades que avanzan / oportunidades en la etapa | Benchmark por etapa, revisión trimestral |
| Ciclo de venta promedio | Días desde Calificación hasta Cierre | Reducción trimestral sostenida |
| Precisión del forecast | Forecast comprometido vs. cerrado real | ≥ 90% de precisión |
| Valor promedio de oportunidad (ACV) | Suma de valor cerrado / Nº de cierres ganados | Creciente trimestre a trimestre |
| Higiene de CRM | % de oportunidades con actividad en los últimos 14 días | ≥ 95% |
| Quota attainment | Ventas cerradas / cuota asignada por AE | ≥ 80% del equipo sobre cuota |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Pipeline "fantasma": oportunidades infladas o desactualizadas | Alta | Alto |
| Dependencia de un solo vendedor estrella (tribal knowledge de cuentas clave) | Media | Alto |
| Descuentos no autorizados que erosionan margen | Media | Alto |
| Handoff deficiente a Operaciones → fricción y churn temprano | Media | Alto |
| Forecast poco confiable para decisiones de CFO/CEO | Alta | Alto |
| Fuga de información competitiva por falta de disciplina en el CRM | Baja | Medio |

## 11. Controles

- **Revisión semanal de pipeline (forecast call):** ver `sop-revision-pipeline-semanal.md` — cada oportunidad en etapas 3-6 se revisa con el Director Comercial.
- **Umbrales de descuento:** hasta 10% aprueba el AE, 10-20% el Director Comercial, >20% requiere aprobación del CFO — todo registrado en el CRM, nunca verbal.
- **Auditoría de higiene de CRM:** semanal, automatizada (sección 12), sobre oportunidades sin actividad reciente.
- **Codificación obligatoria de motivo de pérdida** (lista cerrada: precio, competencia, timing, sin presupuesto, sin autoridad, producto no ajusta) — prohibido el texto libre como único registro.
- **Checklist de handoff** firmado digitalmente por Ventas y Operaciones antes de considerar cerrado el ciclo comercial.

## 12. Automatizaciones posibles

- **Lead routing automático:** asignación de MQLs a AE según territorio/ICP, sin intervención manual del Director Comercial.
- **Alertas de oportunidades estancadas:** notificación automática cuando una oportunidad no tiene actividad en 14 días.
- **Generación asistida de propuestas:** IA que arma el borrador de propuesta a partir de los campos de calificación ya capturados en el CRM.
- **Resumen automático de llamadas:** transcripción + resumen estructurado (dolor, presupuesto, próximos pasos) cargado directamente a la ficha de oportunidad.
- **Forecast narrativo automático:** IA que redacta el resumen ejecutivo semanal de pipeline para el CEO a partir de los datos del CRM.
- **Sincronización CRM → ERP/Finanzas:** al marcar "Ganado", se dispara automáticamente la generación de la orden en el ERP.

## 13. Prompts IA relacionados

1. *"Actúa como SDR senior. Con esta información de la cuenta [datos], redacta una secuencia de 4 correos de prospección outbound alineados al ICP de la empresa, sin sonar genérico ni tipo plantilla masiva."*
2. *"Con esta transcripción de llamada de descubrimiento, extrae: dolor principal, métricas de impacto, comprador económico, criterios de decisión y próximos pasos, en el formato de la ficha MEDDIC."*
3. *"Genera el borrador de propuesta comercial para [cuenta] usando la plantilla de precios aprobada y el resumen de descubrimiento de esta oportunidad."*
4. *"Redacta el resumen ejecutivo semanal de forecast para el CEO a partir de este export del CRM: pipeline total, oportunidades en riesgo, forecast comprometido vs. meta."*
5. *"Analiza estas 20 oportunidades perdidas y agrupa los motivos codificados en patrones accionables para Producto y Marketing."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- El 100% de las oportunidades en etapas 3-6 tiene ficha de calificación completa en el CRM (cero "cajas negras").
- La precisión del forecast semanal alcanza ≥90% frente al cierre real.
- El ciclo de venta promedio se reduce de forma medible trimestre a trimestre.
- Cero descuentos aplicados fuera de umbral sin aprobación registrada.
- El Director Comercial reporta una reducción medible del tiempo dedicado a "perseguir" actualizaciones de pipeline manualmente.

## 15. Plan de mejora continua

- **Revisión semanal (forecast call):** ajustes tácticos de pipeline, sin esperar al ciclo trimestral.
- **Revisión trimestral (Rockefeller/Scaling Up):** análisis de conversión por etapa, ajuste de metas y del ICP si el mercado cambió.
- **Revisión de este documento cada 6 meses**, o antes si cambia el modelo comercial (ej. se introduce un canal de venta nuevo).
- **Retroalimentación continua** de AEs sobre fricciones del proceso, canalizada al comité mensual de gobierno de GAIOS (Módulo 0).

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Calificación de leads (MEDDIC/BANT) | `gaios/01-comercial-crm/sop-calificacion-leads-meddic.md` |
| SOP — Revisión semanal de pipeline (forecast call) | `gaios/01-comercial-crm/sop-revision-pipeline-semanal.md` |
| SOP — Higiene de datos del CRM | `gaios/01-comercial-crm/sop-higiene-datos-crm.md` |
| Plantilla — Ficha de oportunidad | `gaios/01-comercial-crm/plantilla-ficha-oportunidad.md` |
| Checklist operativo de aceptación | `gaios/01-comercial-crm/checklist-modulo1.md` |
| Prompts IA relacionados (ampliado) | `gaios/01-comercial-crm/prompts-ia-modulo1.md` |
| Formulario / dashboard de KPIs comerciales | `gaios/01-comercial-crm/kpis-dashboard-comercial.md` |

**Próximos módulos dependientes:** Módulo 2 (Marketing) consume el mismo framework de ICP y el criterio de MQL definido aquí; Módulo 11 (Atención al Cliente) consume el checklist de handoff; Módulo 6 (Finanzas) consume la sincronización CRM→ERP declarada en la sección 12.
