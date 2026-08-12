# SOP — Presupuesto Anual

**Versión:** 1.0 · **Dueño:** CFO · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 6 — Finanzas

## 1. Objetivo
Construir un presupuesto anual basado en drivers reales del negocio, que se pueda dar seguimiento mes a mes, en vez de un ejercicio de "incremento arbitrario" que nadie vuelve a revisar.

## 2. Alcance
Aplica a todas las áreas con presupuesto asignado. No aplica a gasto menor de caja chica, que sigue una política simplificada aparte.

## 3. Entradas
Resultados del ejercicio anterior; plan estratégico y prioridades del año (Módulo 10 — Gobierno Corporativo); drivers de negocio por área (headcount, volumen de ventas, campañas planeadas).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director de área | X | | | |
| CFO | X | X | | |
| CEO | | X | | |

## 5. Herramientas
Plantilla de presupuesto por driver; herramienta de FP&A o plantilla estructurada.

## 6. Procedimiento paso a paso
1. El CFO distribuye la plantilla de presupuesto y el calendario del ciclo, con al menos 6 semanas de anticipación al inicio del ejercicio.
2. Cada Director de área construye su presupuesto basado en drivers explícitos (ej. headcount planeado × costo promedio, no "aumento el 10% del año pasado").
3. El CFO consolida los presupuestos de área en el presupuesto general de la empresa.
4. Revisión y ajuste conjunto CFO-Directores para alinear el presupuesto consolidado con las metas financieras de la empresa.
5. Aprobación final del CEO antes del inicio del ejercicio.
6. Publicación del presupuesto aprobado a cada Director de área como su línea base de seguimiento mensual.

## 7. Diagrama de flujo (descrito en texto)
```
[Calendario y plantilla distribuidos] → [Cada área construye presupuesto por driver]
        │
        ▼
[CFO consolida] → [Revisión y ajuste conjunto CFO-Directores]
        │
        ▼
[Aprobación del CEO] → [Publicación como línea base de seguimiento]
```

## 8. Checklist operativo
- [ ] Presupuesto de cada área basado en drivers explícitos, no en incremento arbitrario.
- [ ] Presupuesto consolidado revisado conjuntamente con los Directores.
- [ ] Aprobación del CEO documentada antes del inicio del ejercicio.
- [ ] Presupuesto publicado como línea base antes del primer mes del ejercicio.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Cumplimiento del calendario | Presupuesto aprobado antes del inicio del ejercicio (Sí/No) | 100% |
| Precisión del presupuesto | 1 − \|Actual − Budget\| / Budget, acumulado anual | ≥ 90% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Presupuesto aprobado tarde, después de iniciado el ejercicio | Media | Medio |
| Drivers poco realistas que garantizan desviación desde el inicio | Media | Alto |

## 11. Controles
Ningún presupuesto de área se consolida sin drivers explícitos documentados; el CFO valida la lógica de cada driver antes de consolidar.

## 12. Automatizaciones posibles
Plantilla de presupuesto con fórmulas pre-cargadas por driver; dashboard de consolidación automática a medida que cada área carga su presupuesto.

## 13. Prompts IA relacionados
1. *"Ayúdame a construir el presupuesto del área de [área] basado en estos drivers de negocio [drivers], comparando contra el gasto real del año anterior."*
2. *"Revisa este presupuesto consolidado y señala qué áreas tienen drivers poco realistas o inconsistentes entre sí."*

## 14. Indicadores de éxito
100% de las áreas con presupuesto aprobado y basado en drivers antes del inicio del ejercicio, durante 2 ciclos consecutivos.

## 15. Plan de mejora continua
Revisión post-mortem anual del proceso de presupuesto: ¿qué drivers predijeron bien el resultado real?, ¿cuáles ajustar para el siguiente ciclo?
