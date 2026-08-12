# SOP — Ciclo de Cobranza (Order-to-Cash)

**Versión:** 1.0 · **Dueño:** CFO · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 6 — Finanzas

## 1. Objetivo
Convertir las ventas cerradas en efectivo de forma predecible y oportuna, evitando que la cobranza dependa de que alguien "se acuerde" de dar seguimiento a una factura vencida.

## 2. Alcance
Aplica a toda factura emitida a crédito. No aplica a ventas de contado o prepago, que no generan cuentas por cobrar.

## 3. Entradas
Orden ganada en el CRM (Módulo 1) con condiciones de pago acordadas; política de crédito de la empresa; factura emitida.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Analista de cobranza / Contador | X | | | |
| CFO | | X | | |
| Director Comercial (relación con el cliente) | | | X | |

## 5. Herramientas
Sistema de cobranza con aging automático; plantillas de recordatorio por nivel de mora; CRM para contexto de la relación comercial.

## 6. Procedimiento paso a paso
1. Al cerrar la venta (Módulo 1), se valida la política de crédito y el límite de crédito del cliente antes de facturar a plazo.
2. Se emite la factura inmediatamente al cumplirse el hito de facturación acordado.
3. El sistema clasifica la cartera por antigüedad: 0-30 días (vigente), 31-60 (recordatorio), 61-90 (escalamiento), >90 días (gestión formal/legal).
4. **0-30 días:** recordatorio automático de cortesía cerca de la fecha de vencimiento.
5. **31-60 días:** contacto directo del analista de cobranza, tono firme pero profesional.
6. **61-90 días:** escalamiento al Director Comercial (relación con el cliente) y al CFO; se evalúa suspender nuevas órdenes al cliente.
7. **>90 días:** gestión formal, con involucramiento del CFO y evaluación de acción legal si aplica.
8. Toda gestión de cobranza se documenta en el sistema con fecha, canal y resultado.

## 7. Diagrama de flujo (descrito en texto)
```
[Venta cerrada] → [Validar política y límite de crédito] → [Emitir factura al cumplir el hito]
        │
        ▼
[Clasificación automática por antigüedad]
        │
        ▼
0-30 días: recordatorio de cortesía
31-60 días: contacto directo del analista
61-90 días: escalamiento a Comercial + CFO, evaluar suspensión de órdenes
>90 días: gestión formal, evaluar acción legal
        │
        ▼
[Toda gestión documentada: fecha, canal, resultado]
```

## 8. Checklist operativo
- [ ] Límite de crédito validado antes de facturar a plazo.
- [ ] Factura emitida dentro de los días acordados desde el hito.
- [ ] Cartera clasificada por antigüedad de forma automática.
- [ ] Toda gestión de cobranza documentada en el sistema.
- [ ] Cartera >60 días escalada a Comercial y CFO.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| DSO | Cuentas por cobrar / ventas a crédito × días | Reducción sostenida |
| % cartera >60 días | Cartera >60 días / cartera total | ≤ 10% |
| Tasa de recuperación | Cartera cobrada / cartera gestionada en el periodo | ≥ 90% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Cobranza reactiva sin seguimiento sistemático | Alta | Alto |
| Cliente estratégico con cartera vencida sin escalamiento oportuno | Media | Alto |

## 11. Controles
El escalamiento por antigüedad es automático en el sistema, no depende del criterio individual del analista de cobranza.

## 12. Automatizaciones posibles
Recordatorios automáticos por nivel de mora; alerta automática al Director Comercial y al CFO cuando una cuenta cruza el umbral de 60 días; bloqueo automático de nuevas órdenes a clientes con cartera >90 días, salvo excepción aprobada.

## 13. Prompts IA relacionados
1. *"Genera 3 niveles de recordatorio de cobranza (30, 60, 90 días de mora) con tono creciente de urgencia pero profesional, para el cliente [nombre]."*
2. *"Con este reporte de aging de cartera, identifica los clientes de mayor riesgo y sugiere la acción de escalamiento correspondiente."*

## 14. Indicadores de éxito
DSO en tendencia decreciente y cartera >60 días ≤10%, sostenido durante 2 trimestres consecutivos.

## 15. Plan de mejora continua
Revisión trimestral de la política de crédito y de los umbrales de escalamiento, ajustando según el comportamiento real de pago de los clientes.
