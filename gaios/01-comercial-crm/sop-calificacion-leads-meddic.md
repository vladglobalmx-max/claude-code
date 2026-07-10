# SOP — Calificación de Leads (MEDDIC / BANT)

**Versión:** 1.0 · **Dueño:** Director Comercial · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 1 — Comercial/CRM

## 1. Objetivo
Calificar de forma consistente cada lead antes de invertir tiempo comercial en él, evitando que oportunidades sin presupuesto, autoridad o necesidad real avancen en el pipeline y distorsionen el forecast.

## 2. Alcance
Aplica a todo lead, inbound o outbound, antes de pasar de la etapa "Prospección" a "Calificación" del pipeline. No aplica a cuentas ya cerradas en renovación (ver Módulo 11).

## 3. Entradas
Lead entregado por Marketing (MQL) o identificado por prospección outbound; ICP de la empresa; historial de la cuenta en el CRM si existe.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| SDR / AE a cargo | X | | | |
| Director Comercial | | X | | |

## 5. Herramientas
CRM (campos obligatorios de calificación), LinkedIn Sales Navigator para validar autoridad del contacto.

## 6. Procedimiento paso a paso
1. Validar que la cuenta cumple el ICP (industria, tamaño, geografía, stack tecnológico si aplica). Si no cumple, descalificar y regresar a Marketing con motivo.
2. **Calificación rápida (BANT)** en el primer contacto: ¿hay presupuesto o capacidad de conseguirlo?, ¿hablo con quien decide o influencia?, ¿existe una necesidad concreta?, ¿hay un horizonte de tiempo para resolverla?
3. Si el lead pasa BANT y el ciclo de venta es complejo (multi-stakeholder, ticket alto), profundizar con **MEDDIC**: Métricas (impacto cuantificable), Comprador Económico (quién firma), Criterios de Decisión, Proceso de Decisión, Dolor identificado, Campeón interno.
4. Registrar cada campo en la ficha de oportunidad del CRM (`plantilla-ficha-oportunidad.md`) — ningún campo se deja "se pregunta después".
5. Si falta un elemento crítico (sin presupuesto o sin autoridad confirmada), la oportunidad permanece en "Calificación" con plan explícito para resolver el gap, no avanza a Descubrimiento.
6. Una vez completos los campos mínimos, mover la oportunidad a "Descubrimiento" en el CRM.

## 7. Diagrama de flujo (descrito en texto)
```
[Lead entrante] → ¿Cumple ICP? --No--> [Descalificar, notificar a Marketing]
       │ Sí
       ▼
[BANT en primer contacto] → ¿Pasa BANT? --No--> [Nutrir / reintentar en 90 días]
       │ Sí
       ▼
¿Ciclo complejo? --Sí--> [Profundizar MEDDIC] --No--> [Registrar ficha]
       │                          │
       └──────────────────────────┘
       ▼
[Ficha de calificación completa en CRM] → [Avanza a Descubrimiento]
```

## 8. Checklist operativo
- [ ] ICP validado y documentado.
- [ ] BANT completo en la ficha de oportunidad.
- [ ] MEDDIC completo si el ciclo es complejo.
- [ ] Campeón interno identificado por nombre, no genérico.
- [ ] Fecha estimada de decisión registrada.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tasa de descalificación temprana | Leads descalificados en Calificación / total | Indicador de calidad del MQL, no de fracaso |
| % fichas completas | Oportunidades con BANT/MEDDIC 100% / total en Descubrimiento+ | 100% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| AE avanza oportunidad sin calificación completa por presión de cuota | Alta | Alto |
| Campeón interno pierde influencia o deja la empresa sin que se detecte | Media | Alto |

## 11. Controles
El CRM bloquea el cambio de etapa a "Descubrimiento" si los campos obligatorios de BANT están vacíos (control de sistema, no solo de proceso).

## 12. Automatizaciones posibles
Validación automática de campos obligatorios antes de permitir el cambio de etapa; enriquecimiento automático de datos de la cuenta (firmográficos) al crear el lead.

## 13. Prompts IA relacionados
1. *"Con esta transcripción de la primera llamada, extrae los elementos BANT y señala cuáles quedaron sin confirmar."*
2. *"Evalúa si este lead cumple el ICP de la empresa [criterios] y justifica la recomendación de calificar o descalificar."*

## 14. Indicadores de éxito
Cero oportunidades en etapa "Propuesta" sin ficha de calificación completa, verificado en la auditoría semanal.

## 15. Plan de mejora continua
Revisión trimestral de los criterios BANT/MEDDIC contra la tasa de conversión real, ajustando el umbral de calificación si se detecta demasiada fricción o demasiada laxitud.
