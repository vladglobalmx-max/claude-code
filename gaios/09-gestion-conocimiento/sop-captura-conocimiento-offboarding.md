# SOP — Captura de Conocimiento en Offboarding

**Versión:** 1.0 · **Dueño:** Especialista en Gestión del Conocimiento · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 9 — Gestión del Conocimiento, Módulo 5 — RRHH

## 1. Objetivo
Asegurar que el conocimiento crítico de un colaborador que sale de la empresa quede documentado antes de su última semana, evitando que se pierda con su salida.

## 2. Alcance
Aplica a toda salida (voluntaria o involuntaria) de un colaborador cuyo rol fue identificado con conocimiento crítico en el knowledge audit. No aplica a roles sin conocimiento crítico específico, donde el onboarding estándar del reemplazo es suficiente.

## 3. Entradas
Notificación de offboarding desde RRHH (Módulo 5); knowledge audit vigente que identifica si el rol tiene conocimiento crítico.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Especialista en Gestión del Conocimiento | X | X | | |
| Colaborador saliente | X | | | |
| Gerente directo | | | X | |

## 5. Herramientas
Plantilla de entrevista de captura; grabación/transcripción; plantilla de artículo de base de conocimiento.

## 6. Procedimiento paso a paso
1. Al notificarse una salida (Módulo 5), verificar si el rol está identificado como poseedor de conocimiento crítico.
2. Si aplica, agendar una o más sesiones de captura en la primera mitad del periodo de preaviso — nunca en el último día.
3. Realizar la entrevista estructurada: procesos que solo esa persona ejecuta, decisiones tácitas, atajos o excepciones no documentadas, contactos clave, contraseñas o accesos especiales (coordinado con Módulo 7).
4. Sintetizar la sesión en documentos de la base de conocimiento o SOPs formales según corresponda.
5. Validar el documento con el colaborador saliente antes de su último día.
6. Confirmar a RRHH que la captura se completó — este paso es requisito para cerrar el checklist de offboarding del Módulo 5.

## 7. Diagrama de flujo (descrito en texto)
```
[Notificación de offboarding] → ¿Rol con conocimiento crítico? --No--> [Offboarding estándar]
        │ Sí
        ▼
[Agendar sesión de captura en la primera mitad del preaviso]
        │
        ▼
[Entrevista estructurada] → [Sintetizar en documento/SOP]
        │
        ▼
[Validar con el colaborador saliente] → [Confirmar a RRHH]
```

## 8. Checklist operativo
- [ ] Verificación de conocimiento crítico realizada al notificarse la salida.
- [ ] Sesión de captura agendada en la primera mitad del preaviso.
- [ ] Documento sintetizado y validado con el colaborador saliente.
- [ ] Confirmación enviada a RRHH antes del último día.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de salidas críticas con captura completa | Con captura / salidas de roles críticos | 100% |
| Tiempo de captura respecto al preaviso | Días de la sesión respecto al inicio del preaviso | Primera mitad del periodo |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Captura agendada tarde, sin tiempo de completarla | Media | Alto |
| Colaborador saliente desmotivado a compartir a fondo | Baja | Medio |

## 11. Controles
El checklist de offboarding del Módulo 5 no se cierra sin la confirmación explícita de captura de conocimiento cuando el rol lo requiere.

## 12. Automatizaciones posibles
Alerta automática al Especialista en Gestión del Conocimiento en cuanto RRHH registra una salida de un rol marcado como crítico; transcripción y síntesis asistida por IA de la sesión de captura.

## 13. Prompts IA relacionados
1. *"Con esta transcripción de entrevista de salida, extrae procesos, decisiones tácitas y contactos clave que deban documentarse antes de que este colaborador se vaya."*
2. *"Genera las preguntas de la sesión de captura de conocimiento para el rol de [rol], basadas en su scorecard de puesto (Módulo 5)."*

## 14. Indicadores de éxito
100% de las salidas de roles críticos con captura completa y validada antes del último día, sostenido durante 2 trimestres.

## 15. Plan de mejora continua
Revisión semestral de qué tan útiles resultaron los documentos capturados (¿se consultaron?, ¿evitaron fricción con el reemplazo?), ajustando la plantilla de entrevista si hace falta.
