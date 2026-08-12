# SOP — Auditoría Interna de Cumplimiento

**Versión:** 1.0 · **Dueño:** Consultor Lean Six Sigma · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 12 — Calidad

## 1. Objetivo
Verificar que cada módulo GAIOS publicado se cumple en la práctica, no solo en el papel — la brecha más común en cualquier sistema de gestión es que el documento diga una cosa y la operación real haga otra.

## 2. Alcance
Aplica a todo módulo GAIOS publicado (estado "Publicado" en el roadmap). No aplica a módulos en estado "Planeado" o "En construcción".

## 3. Entradas
Checklist de aceptación del módulo a auditar; fecha de última revisión; scorecard del Módulo 10 si el módulo alimenta indicadores ahí.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Consultor Lean Six Sigma (auditor) | X | X | | |
| Dueño del módulo auditado | | | X | |

## 5. Herramientas
Checklist de aceptación del módulo; guía de gemba walk; formato de reporte de hallazgos.

## 6. Procedimiento paso a paso
1. Programar la auditoría con el dueño del módulo, con anticipación razonable.
2. Revisar el checklist de aceptación del módulo punto por punto contra evidencia real (no solo preguntar "¿lo hacen?").
3. Realizar el **gemba walk**: observar el proceso en operación, hablar con quien lo ejecuta día a día, no solo con el Director del área.
4. Clasificar cada hallazgo: **Conformidad** (cumple), **Observación menor** (fricción sin riesgo significativo), **No conformidad** (incumplimiento con riesgo relevante).
5. Toda no conformidad se registra en el sistema de gestión de no conformidades del Módulo 3, con acción correctiva y fecha.
6. Redactar el reporte de auditoría con hallazgos, evidencia y recomendaciones.
7. Dar seguimiento a las acciones correctivas en la siguiente auditoría o en el plazo acordado.

## 7. Diagrama de flujo (descrito en texto)
```
[Programar auditoría con el dueño del módulo]
        │
        ▼
[Revisar checklist contra evidencia real] → [Gemba walk: observar el proceso en operación]
        │
        ▼
[Clasificar hallazgos: Conformidad / Observación menor / No conformidad]
        │
        ▼
¿No conformidad? --Sí--> [Registrar en gestión de no conformidades (Módulo 3)]
        │
        ▼
[Reporte de auditoría con hallazgos y recomendaciones] → [Seguimiento de acciones correctivas]
```

## 8. Checklist operativo
- [ ] Auditoría programada según el calendario anual.
- [ ] Checklist del módulo revisado punto por punto con evidencia.
- [ ] Gemba walk realizado, no solo revisión documental.
- [ ] Hallazgos clasificados y reporte redactado.
- [ ] No conformidades registradas en el sistema del Módulo 3.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de módulos auditados a tiempo | Auditados según calendario / programados | 100% |
| Tiempo de cierre de acciones correctivas | Días desde el hallazgo hasta el cierre | ≤ 30 días |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Auditoría superficial sin gemba walk, basada solo en lo que dice el Director | Media | Alto |
| Acciones correctivas que nunca se cierran | Media | Medio |

## 11. Controles
Ninguna auditoría se considera completa sin evidencia de gemba walk (notas, fotos, conversación con el ejecutor del proceso).

## 12. Automatizaciones posibles
Recordatorio automático de auditorías programadas; plantilla de reporte pre-cargada con el checklist del módulo correspondiente.

## 13. Prompts IA relacionados
1. *"Genera el plan de auditoría del Módulo [nombre]: qué verificar del checklist, qué preguntar en el gemba walk, y qué evidencia recolectar."*
2. *"Con estas notas de gemba walk, sintetiza el reporte de hallazgos clasificados en conformidad, observación menor y no conformidad."*

## 14. Indicadores de éxito
100% de los módulos publicados auditados a tiempo, con gemba walk documentado, sostenido durante 2 ciclos anuales.

## 15. Plan de mejora continua
Revisión anual del programa de auditoría: ¿la profundidad del gemba walk es suficiente?, ¿el calendario cubre todos los módulos críticos?
