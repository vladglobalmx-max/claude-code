# SOP — Alta de un Nuevo Módulo GAIOS

**Versión:** 1.0 · **Dueño:** Arquitecto Empresarial · **Próxima revisión:** 2027-01-10

## 1. Objetivo
Estandarizar cómo se propone, construye, revisa y publica un nuevo módulo del manual GAIOS, garantizando que cumpla el estándar de la Arquitectura Maestra antes de llegar a producción.

## 2. Alcance
Aplica a todo módulo nuevo o a toda revisión mayor de un módulo existente. No aplica a correcciones menores de redacción (typos, formato), que pueden editarse directo con changelog.

## 3. Entradas
- Roadmap de módulos (`gaios/roadmap/roadmap-modulos.md`)
- Plantilla estándar (`plantilla-estandar-documento.md`)
- Proceso real vigente en la operación (entrevista con el Director de área dueño)

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director de área dueño del proceso | X | | | |
| Arquitecto Empresarial | | X | | |
| Chief AI Officer | | | X | |
| Consultor metodológico (EOS/Six Sigma) | | | X | |

## 5. Herramientas
Repositorio Git, plantilla estándar, Claude (redacción asistida), Mermaid (diagramas).

## 6. Procedimiento paso a paso
1. El Director de área o el CEO propone el módulo en el roadmap con una justificación de impacto (ventas / errores / dependencia del CEO / productividad).
2. El Arquitecto Empresarial prioriza el módulo dentro del roadmap.
3. Se agenda entrevista estructurada con el Director de área dueño para levantar el proceso real (no inventado).
4. Se genera el borrador usando la plantilla estándar (15 secciones), con apoyo de IA (prompt #1 de `prompts-ia-modulo0.md`).
5. El borrador se somete a revisión del Director de área dueño para validar exactitud operativa.
6. El Arquitecto Empresarial audita el borrador contra el checklist de aceptación (`checklist-modulo0.md`).
7. Se corrigen gaps identificados.
8. Se aprueba y se marca el estado como "Publicado" con fecha de próxima revisión.
9. Se comunica el nuevo módulo a los equipos afectados y se capacita si aplica.
10. Se activan las automatizaciones declaradas en la sección 12 del módulo, si están listas.

## 7. Diagrama de flujo (descrito en texto)
```
[Propuesta en roadmap] → [Priorización] → [Entrevista con dueño del proceso]
   → [Borrador con plantilla estándar] → [Revisión del dueño]
   → [Auditoría contra checklist] → ¿Cumple? --No--> [Corrección]
   → Sí → [Aprobación] → [Publicación] → [Comunicación y capacitación]
   → [Activación de automatizaciones]
```

## 8. Checklist operativo
- [ ] Módulo priorizado en el roadmap con justificación de impacto.
- [ ] Entrevista con el dueño del proceso realizada y documentada.
- [ ] Borrador cumple las 15 secciones.
- [ ] Auditado contra el checklist de aceptación de la Arquitectura Maestra.
- [ ] Aprobado por el Director de área dueño.
- [ ] Fecha de próxima revisión asignada (≤ 6 meses).
- [ ] Comunicado a los equipos afectados.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de alta | Días desde propuesta hasta publicación | ≤ 15 días |
| Tasa de retrabajo | Borradores rechazados en auditoría / total | ≤ 20% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Proceso documentado no coincide con la realidad operativa | Media | Alto |
| Director de área no disponible para validar | Media | Medio |

## 11. Controles
Ningún módulo pasa a "Publicado" sin firma de aprobación del dueño del proceso y del Arquitecto Empresarial.

## 12. Automatizaciones posibles
Formulario de intake automático (Airtable/Notion) que captura la propuesta de nuevo módulo y dispara la asignación de entrevista en el calendario del Director de área.

## 13. Prompts IA relacionados
1. *"Realiza una entrevista estructurada simulada conmigo, como si fueras el Arquitecto Empresarial de GAIOS, para levantar el proceso real de [área], antes de escribir cualquier documento."*
2. *"Convierte las respuestas de esta entrevista en el borrador del módulo GAIOS usando la plantilla estándar de 15 secciones, sin inventar pasos no mencionados."*

## 14. Indicadores de éxito
100% de los módulos publicados pasaron por entrevista real con su dueño (cero módulos "inventados").

## 15. Plan de mejora continua
Revisión de este SOP cada 6 meses o cuando el ritmo de alta de módulos supere 1 por semana (señal de que el proceso necesita más paralelización).
