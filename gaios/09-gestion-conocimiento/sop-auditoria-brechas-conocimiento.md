# SOP — Auditoría de Brechas de Conocimiento

**Versión:** 1.0 · **Dueño:** Especialista en Gestión del Conocimiento · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 9 — Gestión del Conocimiento

## 1. Objetivo
Identificar de forma proactiva qué conocimiento crítico de la empresa depende de una sola persona, antes de que una salida inesperada lo convierta en una crisis operativa.

## 2. Alcance
Aplica a todos los roles de la organización, priorizando los de mayor impacto operativo. No aplica a conocimiento de bajo impacto cuya pérdida no afectaría la continuidad del negocio.

## 3. Entradas
Organigrama y Accountability Chart (Módulo 10); scorecards de puesto (Módulo 5); catálogo de procesos core (Módulo 3).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Especialista en Gestión del Conocimiento | X | X | | |
| Director de área | | | X | |

## 5. Herramientas
Matriz de riesgo de conocimiento (impacto del rol × nivel de documentación existente); entrevistas con Directores de área.

## 6. Procedimiento paso a paso
1. Revisar el catálogo de procesos core (Módulo 3) y el organigrama para identificar roles con alto impacto operativo.
2. Para cada rol crítico, evaluar: ¿existe documentación explícita de cómo se ejecuta su trabajo?, ¿cuántas personas más podrían ejecutarlo hoy sin esa persona?
3. Clasificar el riesgo: **Alto** (un solo poseedor, sin documentación, alto impacto), **Medio** (documentación parcial o más de un poseedor), **Bajo** (bien documentado o distribuido entre varias personas).
4. Priorizar la captura de conocimiento (Módulo 9, sección 6) para los roles de riesgo Alto.
5. Registrar el resultado en el inventario de riesgo de conocimiento, visible para RRHH y Directores de área.
6. Repetir la auditoría trimestralmente, incorporando cambios organizacionales.

## 7. Diagrama de flujo (descrito en texto)
```
[Roles de alto impacto (organigrama + procesos core)]
        │
        ▼
[Evaluar documentación existente y nº de poseedores del conocimiento]
        │
        ▼
[Clasificar riesgo: Alto / Medio / Bajo]
        │
        ▼
[Priorizar captura de conocimiento para riesgo Alto]
        │
        ▼
[Registrar en inventario de riesgo] → [Repetir trimestralmente]
```

## 8. Checklist operativo
- [ ] Todos los roles de alto impacto evaluados.
- [ ] Clasificación de riesgo documentada por rol.
- [ ] Roles de riesgo Alto priorizados en el backlog de captura de conocimiento.
- [ ] Inventario de riesgo visible para RRHH y Directores de área.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de roles críticos auditados | Auditados / roles de alto impacto identificados | 100% |
| Roles de riesgo Alto sin resolver | Nº de roles Alto sin captura de conocimiento iniciada | Decreciente |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Auditoría hecha una sola vez y nunca actualizada | Media | Alto |
| Subestimar el riesgo de un rol por falta de visibilidad del Director de área | Media | Medio |

## 11. Controles
La auditoría se repite trimestralmente sin excepción, integrada al ciclo de revisión del Módulo 0.

## 12. Automatizaciones posibles
Alerta automática cuando un rol de alto impacto no tiene captura de conocimiento iniciada 90 días después de clasificarse como riesgo Alto.

## 13. Prompts IA relacionados
1. *"A partir de este organigrama y la descripción de cada rol, identifica qué conocimiento crítico podría depender de una sola persona y debería auditarse primero."*
2. *"Con este inventario de riesgo de conocimiento, prioriza los 5 roles más urgentes de capturar, considerando impacto operativo y probabilidad de salida."*

## 14. Indicadores de éxito
100% de los roles críticos auditados cada trimestre, con el número de roles de riesgo Alto sin resolver en tendencia decreciente.

## 15. Plan de mejora continua
Revisión anual de los criterios de clasificación de riesgo, ajustando según la evolución de la estructura organizacional.
