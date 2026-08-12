# SOP — Revisión Semanal de Pipeline (Forecast Call)

**Versión:** 1.0 · **Dueño:** Director Comercial · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 1 — Comercial/CRM

## 1. Objetivo
Dar seguimiento sistemático a cada oportunidad activa, detectar riesgos de forma temprana y construir un forecast confiable, sin que el Director Comercial tenga que perseguir manualmente a cada AE.

## 2. Alcance
Aplica a todas las oportunidades en etapas 3-6 (Descubrimiento a Cierre). No aplica a oportunidades en Prospección/Calificación (se revisan en el 1:1 semanal individual, no en la reunión de forecast).

## 3. Entradas
Reporte de pipeline exportado del CRM 24h antes de la reunión; oportunidades marcadas "en riesgo" por el sistema (sin actividad >14 días).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director Comercial | X | X | | |
| Cada AE (su cartera) | X | | | |
| CFO | | | | X |

## 5. Herramientas
CRM (vista de pipeline por etapa), dashboard de forecast, videollamada semanal de 45-60 min.

## 6. Procedimiento paso a paso
1. El CRM genera automáticamente el reporte de pipeline el día anterior a la reunión.
2. Cada AE revisa su cartera antes de la reunión y actualiza etapas, fechas de cierre estimadas y próximos pasos.
3. En la reunión, se revisan primero las oportunidades marcadas "en riesgo" (sin actividad reciente o con fecha de cierre vencida).
4. Para cada oportunidad relevante: ¿qué cambió desde la semana pasada?, ¿cuál es el próximo paso concreto y su fecha?, ¿hay bloqueo que requiera ayuda del Director Comercial?
5. Se actualiza el forecast comprometido (commit) vs. el pipeline total (best case) para el periodo.
6. El Director Comercial documenta acuerdos y bloqueos en el CRM al cierre de la reunión.
7. Semanalmente se compara el forecast comprometido de semanas anteriores contra lo realmente cerrado, para calibrar la precisión del equipo.

## 7. Diagrama de flujo (descrito en texto)
```
[Reporte automático de pipeline] → [AE actualiza su cartera antes de la reunión]
        │
        ▼
[Reunión: revisar oportunidades en riesgo primero]
        │
        ▼
[Actualizar forecast: comprometido vs. pipeline total]
        │
        ▼
[Documentar acuerdos y bloqueos en el CRM]
        │
        ▼
[Comparar forecast de semanas previas vs. cierre real] → [Calibrar precisión]
```

## 8. Checklist operativo
- [ ] Reporte de pipeline generado antes de la reunión.
- [ ] Todas las oportunidades "en riesgo" fueron discutidas.
- [ ] Cada oportunidad tiene próximo paso con fecha, no genérico ("dar seguimiento").
- [ ] Forecast comprometido actualizado en el CRM al cierre de la reunión.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Precisión de forecast semanal | Comprometido vs. cerrado real | ≥ 90% |
| % oportunidades sin próximo paso definido | Oportunidades sin fecha de próxima acción / total | 0% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| "Sandbagging" (AE reporta forecast conservador para asegurar cumplir cuota) | Media | Medio |
| Sobre-optimismo sistemático que infla el forecast comprometido | Media | Alto |

## 11. Controles
El histórico de precisión de forecast por AE se revisa trimestralmente; desviaciones sistemáticas (siempre optimista o siempre conservador) se calibran directamente con el AE.

## 12. Automatizaciones posibles
Generación automática del reporte de pipeline; alertas automáticas de oportunidades "en riesgo" antes de la reunión; resumen narrativo automático del forecast para el CEO.

## 13. Prompts IA relacionados
1. *"A partir de este export de CRM, identifica las oportunidades en riesgo (sin actividad >14 días o con fecha de cierre vencida) y redacta la agenda priorizada de la reunión de forecast."*
2. *"Compara el forecast comprometido de las últimas 8 semanas contra el cierre real y señala si hay sesgo sistemático (optimista/conservador) por AE."*

## 14. Indicadores de éxito
Precisión de forecast ≥90% sostenida durante 2 trimestres consecutivos.

## 15. Plan de mejora continua
Revisión trimestral del formato de la reunión y de los criterios de "en riesgo", ajustando umbrales según el ciclo de venta real observado.
