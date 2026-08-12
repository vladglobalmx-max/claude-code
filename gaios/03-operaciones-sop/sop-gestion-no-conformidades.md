# SOP — Gestión de No Conformidades

**Versión:** 1.0 · **Dueño:** Director de Operaciones · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 3 — Operaciones/SOP

## 1. Objetivo
Capturar, contener y resolver cualquier desviación de un proceso o defecto de calidad de forma sistemática, distinguiendo la corrección inmediata (contención) de la acción correctiva de fondo (causa raíz).

## 2. Alcance
Aplica a toda desviación de un SOP vigente, defecto de producto/servicio o reclamo de cliente interno o externo. No aplica a sugerencias de mejora sin defecto asociado (esas son Kaizen, ver sección 15 del Módulo 3).

## 3. Entradas
Reporte del colaborador que detecta la desviación; reclamo de cliente; hallazgo de auditoría.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Colaborador que detecta/reporta | X | | | |
| Director de Operaciones | | X | | |
| Dueño del proceso afectado | X | | | |

## 5. Herramientas
Sistema de tickets (Jira/Trello); registro de no conformidades con clasificación por severidad y tipo.

## 6. Procedimiento paso a paso
1. Registrar la no conformidad en el sistema de tickets: qué pasó, cuándo, quién lo detectó, severidad.
2. **Contención inmediata:** acción para evitar que el defecto llegue al cliente o se propague, sin esperar el análisis de causa raíz.
3. Clasificar la no conformidad por tipo (los 8 desperdicios de Lean) y severidad (crítica, mayor, menor).
4. Si es recurrente (≥2 veces en 90 días) o de severidad crítica, escalar a un proyecto DMAIC completo (`sop-analisis-causa-raiz.md`).
5. Si es un evento aislado de baja severidad, documentar la corrección puntual sin necesidad del ciclo DMAIC completo.
6. Cerrar el ticket con la acción tomada y, si aplica, la referencia al SOP actualizado.
7. Revisar mensualmente el registro agregado de no conformidades para detectar patrones no evidentes caso por caso.

## 7. Diagrama de flujo (descrito en texto)
```
[No conformidad detectada] → [Registrar en el sistema de tickets]
        │
        ▼
[Contención inmediata]
        │
        ▼
[Clasificar por tipo y severidad]
        │
        ▼
¿Recurrente (≥2 en 90 días) o crítica? --Sí--> [Escalar a proyecto DMAIC]
        │ No
        ▼
[Corrección puntual documentada] → [Cerrar ticket]
        │
        ▼
[Revisión mensual agregada de patrones]
```

## 8. Checklist operativo
- [ ] Toda no conformidad registrada en el sistema de tickets, no solo comunicada verbalmente.
- [ ] Contención inmediata documentada antes del cierre.
- [ ] Clasificación por tipo y severidad completa.
- [ ] No conformidades recurrentes o críticas escaladas a DMAIC.
- [ ] Revisión mensual agregada realizada.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de contención | Horas desde detección hasta contención | ≤ 24 horas |
| % de no conformidades cerradas con causa raíz | Cerradas con causa raíz identificada / total críticas o recurrentes | 100% |
| Tasa de recurrencia | No conformidades repetidas / total del periodo | Decreciente |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Sub-reporte por miedo a señalar culpables | Alta | Alto |
| Contención sin acción correctiva de fondo — el problema se repite | Media | Alto |

## 11. Controles
Cultura explícita de "sin culpa" (blameless) para el reporte de no conformidades — el sistema audita el proceso, no castiga a quien reporta.

## 12. Automatizaciones posibles
Clasificación automática por tipo de desperdicio usando IA a partir de la descripción del ticket; alerta automática cuando una no conformidad similar ocurre 2 veces en 90 días, disparando el escalamiento a DMAIC.

## 13. Prompts IA relacionados
1. *"Clasifica estas 15 no conformidades del último trimestre por tipo de desperdicio (Lean DOWNTIME) y severidad, y señala cuáles son recurrentes."*
2. *"Con este registro de no conformidades, redacta el resumen mensual para el comité de Operaciones: patrones detectados, escalados a DMAIC, cerrados con corrección puntual."*

## 14. Indicadores de éxito
100% de no conformidades críticas o recurrentes cerradas con causa raíz identificada y acción correctiva verificada.

## 15. Plan de mejora continua
Revisión trimestral del proceso de gestión de no conformidades en sí mismo, ajustando los umbrales de severidad y recurrencia según la madurez operativa de la empresa.
