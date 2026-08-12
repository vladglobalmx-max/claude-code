# SOP — Gestión de Accesos e Identidad (IAM)

**Versión:** 1.0 · **Dueño:** Director de Tecnología · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 7 — Tecnología, Módulo 5 — RRHH

## 1. Objetivo
Garantizar que cada colaborador tenga exactamente los accesos que su rol requiere — ni más (riesgo de seguridad) ni menos (fricción operativa) — y que los accesos se revoquen sin demora al salir de la empresa.

## 2. Alcance
Aplica a todo sistema con inicio de sesión individual (correo, CRM, ERP, herramientas de marketing, etc.). No aplica a licencias de software de uso compartido sin identidad individual.

## 3. Entradas
Notificación de alta/baja desde el proceso de onboarding/offboarding (Módulo 5); matriz de accesos por rol.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Soporte TI | X | | | |
| Director de Tecnología | | X | | |
| RRHH (dispara la solicitud) | | | X | |

## 5. Herramientas
IAM/SSO centralizado; matriz de accesos por rol documentada; sistema de tickets de TI.

## 6. Procedimiento paso a paso
1. RRHH notifica el alta de un nuevo colaborador con su rol, disparando automáticamente la solicitud de accesos correspondiente.
2. Soporte TI otorga los accesos según la matriz de accesos por rol — mínimo privilegio necesario, no acceso amplio por defecto.
3. Accesos adicionales fuera de la matriz estándar requieren aprobación explícita del Director de Tecnología.
4. Revisión trimestral (access review): Soporte TI audita los accesos activos contra la matriz de roles vigente, revocando accesos que ya no correspondan.
5. Al offboarding (Módulo 5), RRHH notifica la baja y Soporte TI revoca todos los accesos en menos de 24 horas.
6. Todo acceso otorgado o revocado se registra con fecha, sistema y responsable.

## 7. Diagrama de flujo (descrito en texto)
```
[Onboarding RRHH] → [Solicitud automática de accesos según rol]
        │
        ▼
[Otorgar accesos: mínimo privilegio] → ¿Acceso adicional fuera de la matriz? --Sí--> [Aprobación del Director de Tecnología]
        │
        ▼
[Revisión trimestral de accesos activos vs. matriz de roles]
        │
        ▼
[Offboarding RRHH] → [Revocación de todos los accesos en <24 horas]
```

## 8. Checklist operativo
- [ ] Todo alta de acceso ligada a una notificación de onboarding de RRHH.
- [ ] Accesos otorgados según la matriz de roles, no por defecto amplios.
- [ ] Accesos adicionales fuera de la matriz aprobados explícitamente.
- [ ] Revisión trimestral de accesos activos completada.
- [ ] Toda baja de acceso completada en menos de 24 horas del offboarding.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de revocación de acceso | Horas desde offboarding hasta revocación completa | ≤ 24 horas |
| % de accesos conformes a la matriz de roles | Accesos conformes / total auditado en la revisión trimestral | ≥ 95% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Acceso no revocado a tiempo — riesgo de seguridad tras una salida conflictiva | Media | Alto |
| Acumulación de accesos innecesarios por cambios de rol no reflejados | Media | Medio |

## 11. Controles
La baja de acceso es un paso obligatorio del checklist de offboarding del Módulo 5 — no se considera cerrado el offboarding sin confirmación de TI.

## 12. Automatizaciones posibles
Alta/baja de acceso 100% automatizada vía integración HRIS-IAM, sin ticket manual intermedio; alerta automática si un acceso no se revoca dentro de las 24 horas del offboarding.

## 13. Prompts IA relacionados
1. *"Genera el checklist de alta de acceso para el rol de [rol], aplicando el principio de mínimo privilegio."*
2. *"Con esta lista de accesos activos y la matriz de roles vigente, identifica los accesos que ya no corresponden y deberían revocarse."*

## 14. Indicadores de éxito
Cero accesos revocados fuera del plazo de 24 horas, sostenido durante 2 trimestres consecutivos.

## 15. Plan de mejora continua
Revisión semestral de la matriz de accesos por rol, incorporando nuevos sistemas o cambios en la estructura organizacional.
