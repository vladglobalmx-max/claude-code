# SOP — Priorización de Automatizaciones

**Versión:** 1.0 · **Dueño:** Chief AI Officer · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 8 — Automatización e IA

## 1. Objetivo
Decidir con criterio objetivo qué automatizar primero, evitando construir lo más fácil o lo más interesante técnicamente en vez de lo que más reduce trabajo repetitivo o error.

## 2. Alcance
Aplica a todo candidato de automatización que provenga de la sección 12 de cualquier módulo GAIOS. No aplica a experimentos técnicos exploratorios sin caso de uso de negocio identificado.

## 3. Entradas
Backlog consolidado de candidatos (`plantilla-ficha-automatizacion.md`); estimación de horas ahorradas y frecuencia del proceso actual.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Chief AI Officer | X | X | | |
| Director de Tecnología (factibilidad técnica) | | | X | |
| Dueño del proceso candidato | | | X | |

## 5. Herramientas
Matriz valor-factibilidad (2×2); backlog en Airtable/Notion/Linear.

## 6. Procedimiento paso a paso
1. Registrar cada candidato de automatización con su origen (módulo y sección 12 de origen).
2. Evaluar el **valor**: frecuencia del proceso, horas ahorradas estimadas, reducción de error esperada.
3. Evaluar la **factibilidad**: complejidad técnica, dependencias de sistemas (Módulo 7), riesgo de la automatización.
4. Ubicar el candidato en la matriz: Alto valor/Alta factibilidad (prioridad inmediata), Alto valor/Baja factibilidad (requiere inversión, planear), Bajo valor/Alta factibilidad (quick win oportunista), Bajo valor/Baja factibilidad (descartar o posponer indefinidamente).
5. Publicar el backlog priorizado, visible para todos los Directores de área.
6. Revisar la priorización mensualmente, incorporando nuevos candidatos y reevaluando los existentes.

## 7. Diagrama de flujo (descrito en texto)
```
[Candidato registrado con origen] → [Evaluar valor] × [Evaluar factibilidad]
        │
        ▼
[Ubicar en matriz 2×2]
        │
        ▼
Alto valor/Alta factibilidad → Prioridad inmediata
Alto valor/Baja factibilidad → Planear inversión
Bajo valor/Alta factibilidad → Quick win oportunista
Bajo valor/Baja factibilidad → Descartar/posponer
        │
        ▼
[Backlog priorizado publicado] → [Revisión mensual]
```

## 8. Checklist operativo
- [ ] Todo candidato tiene módulo y sección 12 de origen identificados.
- [ ] Valor y factibilidad evaluados con criterio explícito, no solo intuición.
- [ ] Backlog priorizado visible para los Directores de área.
- [ ] Revisión mensual del backlog realizada.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de candidatos evaluados | Con valor-factibilidad asignados / total en backlog | 100% |
| Automatizaciones de alto valor/alta factibilidad construidas | Nº construido / Nº identificado en ese cuadrante | ≥ 80% en 6 meses |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Priorizar por interés técnico en vez de impacto de negocio | Media | Medio |
| Backlog que crece sin ejecutarse — "cementerio de ideas" | Media | Medio |

## 11. Controles
Ninguna automatización se construye sin haber pasado por la evaluación de la matriz valor-factibilidad, documentada en el backlog.

## 12. Automatizaciones posibles
Cálculo semi-automático del valor a partir de datos de frecuencia y tiempo ya capturados en cada módulo, con validación humana final.

## 13. Prompts IA relacionados
1. *"Evalúa esta automatización candidata usando la matriz valor-factibilidad: ¿qué tan repetitivo/propenso a error es el proceso actual, y qué tan compleja es la implementación técnica?"*
2. *"Con este backlog de automatizaciones, sugiere el orden de construcción de las próximas 5, priorizando por valor y factibilidad."*

## 14. Indicadores de éxito
100% de los candidatos del backlog evaluados con la matriz valor-factibilidad, y al menos 80% de los de "alto valor/alta factibilidad" construidos en 6 meses.

## 15. Plan de mejora continua
Revisión trimestral de la precisión de las estimaciones de valor (horas ahorradas estimadas vs. reales), ajustando el método de estimación si hay desviación sistemática.
