# SOP — Customer Health Score y Renovación

**Versión:** 1.0 · **Dueño:** Director Comercial / Customer Success Manager · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 11 — Atención al Cliente

## 1. Objetivo
Detectar el riesgo de churn antes de que el cliente decida no renovar, permitiendo una intervención proactiva en vez de una reacción tardía.

## 2. Alcance
Aplica a toda cuenta activa con contrato recurrente. No aplica a compras únicas sin renovación.

## 3. Entradas
Datos de uso del producto/servicio; historial de tickets; resultados de NPS; comportamiento de pago (Módulo 6).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Customer Success Manager | X | X | | |
| Director Comercial (renovación/upsell) | | | X | |

## 5. Herramientas
Dashboard de customer health score; CRM compartido con Módulo 1.

## 6. Procedimiento paso a paso
1. Calcular el customer health score combinando: frecuencia de uso del producto, número y severidad de tickets abiertos, resultado de la última encuesta NPS, y comportamiento de pago (cartera vencida o al corriente).
2. Clasificar cada cuenta: **Saludable** (score alto), **En observación** (score medio), **En riesgo** (score bajo).
3. Para cuentas **En riesgo**, agendar una intervención proactiva: llamada para entender la causa antes de que el cliente decida no renovar.
4. Para cuentas **Saludables** próximas a su fecha de renovación, coordinar con Ventas (Módulo 1) la conversación de renovación o upsell.
5. Documentar el resultado de cada intervención y su impacto en el health score posterior.
6. Si a pesar de la intervención el cliente decide no renovar, ejecutar la entrevista de salida con motivo codificado.

## 7. Diagrama de flujo (descrito en texto)
```
[Calcular customer health score: uso + tickets + NPS + pago]
        │
        ▼
[Clasificar: Saludable / En observación / En riesgo]
        │
        ▼
En riesgo → [Intervención proactiva: llamada para entender la causa]
Saludable + renovación próxima → [Coordinar renovación/upsell con Ventas]
        │
        ▼
¿Renueva? --No--> [Entrevista de salida, motivo codificado]
        │ Sí
        ▼
[Cuenta activa — recalcular health score]
```

## 8. Checklist operativo
- [ ] Health score calculado y actualizado para toda cuenta activa.
- [ ] Cuentas "En riesgo" con intervención proactiva agendada.
- [ ] Cuentas próximas a renovación coordinadas con Ventas con anticipación.
- [ ] Todo churn con entrevista de salida y motivo codificado.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Customer health score promedio | Promedio ponderado de la cartera activa | Creciente |
| % de cuentas en riesgo con intervención | Con intervención / total en riesgo | ≥ 80% |
| Tasa de retención de cuentas intervenidas | Renovadas tras intervención / intervenidas | ≥ 50% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Cuenta en riesgo detectada demasiado tarde para intervenir | Media | Alto |
| Intervención genérica sin entender la causa real del riesgo | Media | Medio |

## 11. Controles
El sistema genera alerta automática cuando una cuenta cruza el umbral de "En riesgo" — no depende de que el Customer Success Manager la revise manualmente a tiempo.

## 12. Automatizaciones posibles
Cálculo automático del health score a partir de datos ya capturados en CRM, sistema de tickets y facturación; alerta automática de cuentas en riesgo; recordatorio de renovación próxima.

## 13. Prompts IA relacionados
1. *"Genera el guion de la llamada de intervención proactiva para esta cuenta en riesgo [datos de health score], enfocado en entender la causa antes de ofrecer soluciones."*
2. *"Con este historial de la cuenta [datos], evalúa si el riesgo de churn es por producto, servicio o precio, y sugiere el enfoque de la conversación de renovación."*

## 14. Indicadores de éxito
≥80% de las cuentas en riesgo con intervención proactiva antes de la fecha de renovación, sostenido durante 2 trimestres.

## 15. Plan de mejora continua
Revisión trimestral del modelo de health score, ajustando los pesos de cada variable según qué tan bien predijo el churn real.
