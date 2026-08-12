# SOP — Lead Scoring y SLA Marketing-Ventas

**Versión:** 1.0 · **Dueño:** Director de Marketing (co-dueño: Director Comercial) · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 2 — Marketing, Módulo 1 — Comercial/CRM

## 1. Objetivo
Definir de forma objetiva cuándo un lead se convierte en MQL y garantizar que Ventas lo reciba, acepte o rechace dentro de un tiempo acordado — eliminando la fricción histórica entre Marketing y Ventas sobre "calidad de leads".

## 2. Alcance
Aplica a todo lead capturado por Marketing desde el primer contacto (Inquiry) hasta su aceptación o rechazo por Ventas (SAL). La calificación posterior (BANT/MEDDIC → SQL) pertenece al Módulo 1.

## 3. Entradas
Datos firmográficos del lead (industria, tamaño, cargo); datos de comportamiento (páginas visitadas, contenido descargado, emails abiertos, asistencia a webinars); ICP del Módulo 1.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director de Marketing | X | X | | |
| Director Comercial | | X | | |
| AE receptor del MQL | X | | | |

## 5. Herramientas
Marketing automation con motor de scoring nativo (HubSpot/Marketo), CRM compartido con Módulo 1.

## 6. Procedimiento paso a paso
1. Definir el modelo de puntaje: **puntaje demográfico** (encaje con el ICP: industria, tamaño de empresa, cargo del contacto) + **puntaje de comportamiento** (visitas a páginas clave, descargas de contenido MOFU/BOFU, asistencia a webinar, apertura de emails).
2. Fijar el umbral a partir del cual un lead se marca automáticamente como **MQL** (ej. ≥60/100 puntos).
3. Al cruzar el umbral, el sistema asigna automáticamente el MQL al AE correspondiente según territorio/cuenta.
4. El AE tiene un **tiempo máximo de respuesta** (SLA, ej. 24 horas hábiles) para marcar el MQL como **SAL** (aceptado) o rechazarlo con motivo codificado (no encaja ICP, dato falso, ya es cliente, duplicado).
5. Los SAL entran al proceso de calificación BANT/MEDDIC del Módulo 1.
6. Los MQLs rechazados regresan a Marketing con el motivo, para ajustar el modelo de scoring o la segmentación de campañas.
7. El modelo de scoring se recalibra trimestralmente con datos reales de conversión MQL→SQL→Ganado.

## 7. Diagrama de flujo (descrito en texto)
```
[Lead con puntaje demográfico + comportamiento] → ¿Cruza el umbral? --No--> [Continúa en nutrición]
        │ Sí
        ▼
[MQL] → [Asignación automática al AE] → [SLA de respuesta: 24h hábiles]
        │
        ▼
¿Ventas acepta? --No (motivo codificado)--> [Reciclar a Marketing, ajustar scoring]
        │ Sí
        ▼
[SAL] → [Calificación BANT/MEDDIC — Módulo 1] → [SQL o reciclado]
```

## 8. Checklist operativo
- [ ] Modelo de scoring documentado y vigente (revisado en los últimos 3 meses).
- [ ] Umbral de MQL acordado entre Marketing y Ventas por escrito.
- [ ] Asignación de MQL a AE automática, no manual.
- [ ] SLA de respuesta medido en el sistema, no autorreportado.
- [ ] Todo rechazo tiene motivo codificado.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Cumplimiento del SLA | MQLs respondidos a tiempo / MQLs entregados | ≥ 95% |
| Tasa de aceptación (MQL → SAL) | SALs / MQLs entregados | ≥ 70% (referencia) |
| Precisión del scoring | SQLs / MQLs (tendencia trimestral) | Creciente |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Umbral mal calibrado genera MQLs de baja calidad | Media | Alto |
| Ventas no respeta el SLA y los MQLs se enfrían | Media | Alto |

## 11. Controles
El SLA se audita semanalmente en el CRM; incumplimientos recurrentes de un AE se escalan al Director Comercial en la revisión mensual conjunta.

## 12. Automatizaciones posibles
Scoring 100% automatizado; alerta automática al AE y a su gerente si el SLA está por vencer; recalibración asistida por IA del modelo de scoring con datos trimestrales.

## 13. Prompts IA relacionados
1. *"Con este export de MQLs de los últimos 3 meses y su resultado final (SQL/reciclado/ganado), sugiere ajustes al modelo de puntaje demográfico y de comportamiento."*
2. *"Genera el resumen mensual de cumplimiento de SLA por AE, señalando quiénes están fuera del umbral acordado."*

## 14. Indicadores de éxito
Cumplimiento del SLA ≥95% sostenido y tasa de aceptación de MQLs ≥70% durante 2 trimestres consecutivos.

## 15. Plan de mejora continua
Recalibración trimestral del modelo de scoring y del umbral de MQL, con revisión conjunta Marketing-Ventas de los casos límite.
