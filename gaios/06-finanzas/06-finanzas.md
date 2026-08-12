# GAIOS — Módulo 6: Finanzas / Control

> Presupuesto, ciclo Order-to-Cash, cierre contable y reporting como un sistema único de visibilidad financiera — no como reportes reconstruidos cada mes desde cero.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** CFO · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 4 — Compras (control de tres vías)

---

## 1. Objetivo

Estandarizar los procesos financieros core — presupuesto, ciclo Order-to-Cash (facturación y cobranza), cierre contable mensual y reporting — para dar visibilidad financiera confiable y oportuna, proteger el flujo de caja, y **reducir la dependencia del CFO y el CEO** en el seguimiento manual de cobranza y en la reconstrucción manual de reportes cada mes.

## 2. Alcance

**Incluye:** presupuesto anual y su seguimiento (budget vs. actual), ciclo Order-to-Cash (facturación, cobranza, gestión de cartera vencida), cierre contable mensual, reporting financiero a la dirección, unit economics (CAC/LTV en conjunto con Módulos 1-2).

**Excluye:** contabilidad fiscal detallada y cumplimiento tributario (requiere asesoría fiscal local); tesorería de inversión; el pago a proveedores en sí, cuyo control de tres vías ya se ejecuta en el Módulo 4 — este módulo recibe el pago ya autorizado y lo procesa.

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Driver-based budgeting | Presupuesto basado en drivers de negocio, no en incremento arbitrario |
| Order-to-Cash (O2C) best practices | Estructura del ciclo de facturación y cobranza |
| Fast close / month-end close checklist | Cierre contable mensual disciplinado |
| 13-week cash flow forecast | Anticipación de necesidades de liquidez |
| Unit economics (LTV:CAC) | Salud del modelo de negocio, en conjunto con Módulos 1-2 |
| Módulo 4 — Compras | Control de tres vías que autoriza el pago a proveedores |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| CFO | Dueño del proceso, aprueba el presupuesto consolidado y el reporting | X | X | | |
| Analista financiero / Contador | Ejecuta cierre, cobranza, reportes | X | | | |
| Director de área | Dueño de su presupuesto, explica desviaciones | | | X | |
| CEO | Aprueba el presupuesto anual, recibe el reporting | | X | | X |
| Director Comercial | Provee datos de facturación y cartera ligados a ventas | | | X | |

## 5. Herramientas

- **ERP / sistema contable** como sistema de registro único.
- **FP&A:** Fathom / Jirav / hoja de cálculo estructurada con drivers.
- **CRM compartido con Módulo 1** para datos de facturación ligados a oportunidades cerradas.
- **Sistema de cobranza** con seguimiento de antigüedad de cartera (aging).
- **Dashboard de flujo de caja rodante (13 semanas).**

## 6. Procedimiento paso a paso

1. **Presupuesto anual:** cada Director de área presenta su presupuesto basado en drivers de negocio (volumen, headcount, capacidad), no en incremento arbitrario del año anterior; el CFO consolida y el CEO aprueba antes del inicio del ejercicio.
2. **Seguimiento mensual (budget vs. actual):** análisis de variación con explicación obligatoria de desviaciones que excedan el umbral acordado.
3. **Facturación:** emitir la factura inmediatamente al cumplirse el criterio de facturación (entrega, hito contractual) — nunca acumular facturación pendiente.
4. **Cobranza:** seguimiento de cartera por antigüedad (aging: 0-30, 31-60, 61-90, >90 días), con escalamiento según días de mora (`sop-ciclo-cobranza.md`).
5. **Cierre contable mensual:** checklist de cierre (conciliaciones bancarias, devengos, cierre de periodo) con fecha límite fija (`sop-cierre-contable-mensual.md`).
6. **Reporting:** paquete financiero mensual al CEO y Directores con P&L, flujo de caja y KPIs clave (`plantilla-reporte-financiero-mensual.md`).
7. **Forecast de caja rodante (13 semanas)** para anticipar necesidades de liquidez antes de que se vuelvan urgentes.
8. **Análisis de unit economics** (CAC, LTV, payback period) en conjunto con Marketing (Módulo 2) y Ventas (Módulo 1).

## 7. Diagrama de flujo (descrito en texto)

```
[Presupuesto anual por driver, consolidado y aprobado]
        │
        ▼
[Ejecución mensual] ──► [Budget vs. Actual: variance analysis]
        │
        ▼
[Hito de facturación cumplido] ──► [Emitir factura]
        │
        ▼
[Cartera por antigüedad] ──► ¿Mora según umbral? ──Sí──► [Escalar cobranza]
        │ No
        ▼
[Cierre contable mensual: checklist con fecha límite]
        │
        ▼
[Reporting financiero mensual: P&L, flujo de caja, KPIs]
        │
        ▼
[Forecast de caja rodante 13 semanas] ──► [Análisis de unit economics]
```

## 8. Checklist operativo

- [ ] Presupuesto anual aprobado antes del inicio del ejercicio.
- [ ] Variance analysis mensual con explicación de desviaciones significativas.
- [ ] Toda factura emitida dentro de los días acordados desde el hito de facturación.
- [ ] Cartera vencida con plan de acción documentado por rango de antigüedad.
- [ ] Cierre contable completado en la fecha límite establecida.
- [ ] Paquete de reporting financiero enviado a tiempo a CEO y Directores.
- [ ] Forecast de caja rodante actualizado semanalmente.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| DSO (Days Sales Outstanding) | Cuentas por cobrar / ventas a crédito × días del periodo | Reducción sostenida |
| % de cartera vencida >60 días | Cartera >60 días / cartera total | ≤ 10% |
| Precisión del presupuesto | 1 − \|Actual − Budget\| / Budget | ≥ 90% |
| Tiempo de cierre contable | Días hábiles desde fin de mes hasta cierre | ≤ 5 días hábiles |
| LTV:CAC | Valor de vida del cliente / costo de adquisición | ≥ 3:1 (referencia B2B) |
| Cash runway | Efectivo disponible / gasto mensual neto | Visibilidad ≥ 6 meses adelante |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Cobranza reactiva sin proceso — dinero atrapado en cartera vencida | Alta | Alto |
| Cierre contable que se retrasa y llega tarde para decisiones | Media | Alto |
| Presupuesto irreal que nadie sigue durante el año | Media | Medio |
| Falta de visibilidad de flujo de caja hasta que es urgente | Media | Alto |
| Unit economics no medidos — CAC:LTV desfavorable sin saberlo | Media | Alto |

## 11. Controles

- Ningún presupuesto de área se aprueba sin estar basado en drivers de negocio documentados.
- Política de crédito y límites de crédito por cliente antes de facturar a plazo.
- Escalamiento automático de cartera vencida según antigüedad (sin depender de que alguien "se acuerde" de cobrar).
- Checklist de cierre contable auditado por el CFO antes de declarar el periodo cerrado.
- El forecast de caja rodante se revisa semanalmente por el CFO, no solo al final del mes.

## 12. Automatizaciones posibles

- **Facturación automática** al cumplirse el hito en el CRM/ERP.
- **Recordatorios automáticos de cobranza** escalados por antigüedad de cartera.
- **Dashboard de budget vs. actual en tiempo real**, sin esperar el cierre mensual para ver desviaciones.
- **Alertas de cash runway** cuando cae bajo un umbral definido.
- **Generación asistida del paquete de reporting mensual** a partir de los datos ya consolidados en el ERP.

## 13. Prompts IA relacionados

1. *"Con este reporte de budget vs. actual del mes, redacta el análisis de variación explicando las desviaciones mayores al 10% por área."*
2. *"Genera 3 niveles de recordatorio de cobranza (30, 60, 90 días de mora) con tono creciente de urgencia pero profesional, para el cliente [nombre]."*
3. *"Con estos datos financieros del mes, redacta el resumen ejecutivo para el CEO: P&L, flujo de caja, principales variaciones y riesgos."*
4. *"Con los datos de CAC de Marketing (Módulo 2) y el valor promedio de cliente de Ventas (Módulo 1), calcula el LTV:CAC y sugiere si el modelo de adquisición es sostenible."*
5. *"Proyecta el flujo de caja de las próximas 13 semanas a partir de este historial de cobros y pagos, señalando la semana de menor liquidez proyectada."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- Cierre contable completado dentro de 5 días hábiles, todos los meses.
- % de cartera vencida >60 días ≤10%, con tendencia decreciente.
- Precisión de presupuesto ≥90% en las áreas principales.
- El CEO recibe el paquete de reporting financiero sin tener que solicitarlo.
- La empresa tiene visibilidad de flujo de caja con al menos 6 meses de anticipación.

## 15. Plan de mejora continua

- **Revisión mensual** de variance analysis con cada Director de área.
- **Revisión trimestral** del modelo de unit economics con Marketing y Ventas.
- **Revisión de este documento cada 6 meses**, o antes si cambia significativamente el modelo de negocio o de facturación.
- **Aplicación de DMAIC (Módulo 3)** si el tiempo de cierre contable o la tasa de cartera vencida se deterioran de forma sostenida.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Presupuesto anual | `gaios/06-finanzas/sop-presupuesto-anual.md` |
| SOP — Ciclo de cobranza (Order-to-Cash) | `gaios/06-finanzas/sop-ciclo-cobranza.md` |
| SOP — Cierre contable mensual | `gaios/06-finanzas/sop-cierre-contable-mensual.md` |
| Plantilla — Reporte financiero mensual | `gaios/06-finanzas/plantilla-reporte-financiero-mensual.md` |
| Checklist operativo de aceptación | `gaios/06-finanzas/checklist-modulo6.md` |
| Prompts IA relacionados (ampliado) | `gaios/06-finanzas/prompts-ia-modulo6.md` |
| Formulario / dashboard de KPIs financieros | `gaios/06-finanzas/kpis-dashboard-finanzas.md` |

**Próximos módulos dependientes:** Módulo 10 (Gobierno Corporativo/EOS) consume el reporting financiero para el scorecard ejecutivo; Módulo 11 (Atención al Cliente) coordina con cobranza en casos de disputa de facturación.
