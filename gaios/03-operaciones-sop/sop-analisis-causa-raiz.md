# SOP — Análisis de Causa Raíz (5 Whys / Ishikawa)

**Versión:** 1.0 · **Dueño:** Director de Operaciones (facilita: Consultor Lean Six Sigma) · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 3 — Operaciones/SOP

## 1. Objetivo
Llegar a la causa raíz real de un error o defecto operativo, evitando que las soluciones ataquen únicamente el síntoma y el problema reaparezca.

## 2. Alcance
Aplica a la fase Analizar de todo proyecto DMAIC y a toda no conformidad recurrente (≥2 veces en 90 días). No aplica a incidentes aislados sin patrón de recurrencia (se gestionan directo en `sop-gestion-no-conformidades.md`).

## 3. Entradas
Línea base medida de la fase Medir del DMAIC; datos de incidentes o reprocesos; SIPOC del proceso.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Facilitador (Consultor Lean Six Sigma o Director de Operaciones) | X | X | | |
| Ejecutores del proceso involucrados | | | X | |

## 5. Herramientas
Diagrama de Ishikawa (espina de pescado) con las 6M (Mano de obra, Método, Máquina, Material, Medición, Medio ambiente); técnica de los 5 Whys.

## 6. Procedimiento paso a paso
1. Enunciar el problema de forma específica y medible (no "el proceso falla", sino "el 12% de las órdenes tienen error de captura").
2. Preguntar "¿por qué ocurre esto?" y registrar la respuesta.
3. Tomar esa respuesta y volver a preguntar "¿por qué?" — repetir al menos 5 veces o hasta llegar a una causa raíz accionable (no una causa externa fuera de control de la empresa).
4. Si el problema tiene múltiples causas posibles, usar el diagrama de Ishikawa para organizarlas por categoría (6M) antes de aplicar los 5 Whys a cada rama relevante.
5. Validar la causa raíz con datos, no solo con opinión — si es posible, confirmar que eliminar esa causa elimina el efecto en una prueba piloto.
6. Documentar la causa raíz y pasar a la fase Mejorar del DMAIC.

## 7. Diagrama de flujo (descrito en texto)
```
[Enunciar el problema de forma específica y medible]
        │
        ▼
[¿Por qué ocurre?] → Respuesta 1 → [¿Por qué ocurre eso?] → Respuesta 2 → ... (≥5 iteraciones)
        │
        ▼
¿Múltiples causas posibles? --Sí--> [Diagrama de Ishikawa por las 6M]
        │ No
        ▼
[Causa raíz identificada] → [Validar con datos / piloto] → [Pasar a fase Mejorar]
```

## 8. Checklist operativo
- [ ] El problema está enunciado de forma específica y medible.
- [ ] Se realizaron al menos 5 iteraciones de "¿por qué?".
- [ ] La causa raíz es accionable por la empresa (no una causa externa fuera de control).
- [ ] La causa raíz está validada con datos, no solo con opinión.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tasa de recurrencia post-mejora | Problemas que reaparecen tras la mejora / total de mejoras | ≤ 10% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Detenerse en el primer "por qué" y atacar un síntoma | Alta | Alto |
| Sesgo de culpar a una persona en vez de analizar el proceso/sistema | Media | Alto |

## 11. Controles
La sesión de 5 Whys se facilita siempre en grupo con los ejecutores del proceso, nunca de forma individual por el Director de Operaciones para evitar sesgo unilateral.

## 12. Automatizaciones posibles
Asistencia de IA para sugerir la siguiente pregunta "¿por qué?" a partir de las respuestas previas, y para clasificar causas según las 6M automáticamente.

## 13. Prompts IA relacionados
1. *"Con estos datos de línea base [datos] aplica la técnica de los 5 Whys para llegar a la causa raíz del problema de [error/defecto], sin quedarte en el primer síntoma."*
2. *"Organiza estas causas posibles del problema [problema] en un diagrama de Ishikawa usando las 6M (Mano de obra, Método, Máquina, Material, Medición, Medio ambiente)."*

## 14. Indicadores de éxito
Tasa de recurrencia post-mejora ≤10%, medida en las auditorías de sostenibilidad a 30/60/90 días.

## 15. Plan de mejora continua
Revisión semestral de los proyectos donde el problema reapareció, para identificar si el análisis de causa raíz fue insuficiente y ajustar el método de facilitación.
