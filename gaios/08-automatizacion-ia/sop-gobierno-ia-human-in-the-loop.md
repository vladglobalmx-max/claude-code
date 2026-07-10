# SOP — Gobierno de IA (Human-in-the-Loop)

**Versión:** 1.0 · **Dueño:** Chief AI Officer · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 8 — Automatización e IA

## 1. Objetivo
Garantizar que ninguna automatización o uso de IA tome decisiones de alto riesgo (financieras, legales, de contratación, de seguridad) sin supervisión humana explícita, evitando errores automatizados a escala.

## 2. Alcance
Aplica a toda automatización o flujo con IA que involucre una decisión de alto riesgo. No aplica a automatizaciones puramente operativas de bajo riesgo (ej. recordatorios, generación de borradores que un humano siempre revisa antes de usar).

## 3. Entradas
Ficha de automatización con clasificación de riesgo (`plantilla-ficha-automatizacion.md`); criterios de qué constituye "alto riesgo" para la empresa.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Chief AI Officer | X | X | | |
| Dueño del proceso automatizado | | | X | |

## 5. Herramientas
Checklist de clasificación de riesgo; plataforma de automatización con paso de aprobación humana configurable.

## 6. Procedimiento paso a paso
1. Clasificar la automatización por nivel de riesgo: **Alto** (decisión financiera, legal, de contratación, de seguridad, o que afecta directamente a un cliente sin revisión), **Medio** (afecta procesos internos con posibilidad de corrección rápida), **Bajo** (informativo, borradores, recordatorios).
2. Para automatizaciones de **Alto riesgo**, definir el punto exacto de intervención humana obligatoria antes de que la acción tenga efecto (ej. "la IA sugiere el descuento, un humano lo aprueba antes de aplicarse").
3. Para automatizaciones de **Medio riesgo**, definir un mecanismo de revisión posterior (auditoría muestral) aunque no bloquee la ejecución.
4. Para automatizaciones de **Bajo riesgo**, permitir ejecución autónoma con monitoreo de tasa de error.
5. Documentar la clasificación y el punto de control humano en la ficha de automatización antes de desplegar.
6. Revisar periódicamente si la clasificación de riesgo sigue siendo correcta a medida que la automatización evoluciona o se le da más autonomía.

## 7. Diagrama de flujo (descrito en texto)
```
[Automatización candidata] → [Clasificar riesgo: Alto / Medio / Bajo]
        │
        ▼
Alto riesgo → [Definir punto de intervención humana obligatoria antes del efecto]
Medio riesgo → [Definir auditoría muestral posterior]
Bajo riesgo → [Ejecución autónoma con monitoreo de tasa de error]
        │
        ▼
[Documentar en ficha de automatización] → [Desplegar]
        │
        ▼
[Revisión periódica de la clasificación de riesgo]
```

## 8. Checklist operativo
- [ ] Toda automatización tiene clasificación de riesgo documentada.
- [ ] Automatizaciones de Alto riesgo tienen punto de intervención humana obligatoria antes del efecto.
- [ ] Automatizaciones de Medio riesgo tienen mecanismo de auditoría posterior.
- [ ] La clasificación de riesgo se revisa si la automatización gana autonomía o cambia de alcance.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de alto riesgo con control humano documentado | Con control / total de alto riesgo | 100% |
| Incidentes por automatización sin supervisión adecuada | Nº de incidentes atribuibles a falta de human-in-the-loop | 0 |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Automatización de alto riesgo desplegada sin clasificación explícita | Baja | Alto |
| Fatiga de aprobación — el humano aprueba sin revisar realmente ("rubber stamping") | Media | Alto |

## 11. Controles
Ninguna automatización de alto riesgo pasa a producción sin el punto de intervención humana verificado por el Chief AI Officer; se audita periódicamente que la aprobación humana sea sustantiva, no automática.

## 12. Automatizaciones posibles
Alerta automática si una automatización de alto riesgo se ejecuta sin el paso de aprobación humana registrado (señal de bypass).

## 13. Prompts IA relacionados
1. *"Clasifica el riesgo de esta automatización propuesta [descripción] como Alto, Medio o Bajo, justificando según el tipo de decisión que toma y a quién afecta."*
2. *"Diseña el flujo de esta automatización [descripción], señalando en qué punto debería haber intervención humana obligatoria si el proceso involucra una decisión financiera o de contratación."*

## 14. Indicadores de éxito
100% de las automatizaciones de alto riesgo con control humano documentado y cero incidentes atribuibles a falta de supervisión, sostenido durante 2 trimestres.

## 15. Plan de mejora continua
Revisión semestral de los criterios de clasificación de riesgo, incorporando aprendizajes de incidentes reales o cambios regulatorios sobre uso de IA.
