# GAIOS — Módulo 7: Tecnología / Infraestructura

> Identidad y accesos, gestión de cambios, respaldo y seguridad base — la infraestructura que hace posible automatizar con confianza el resto de GAIOS.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director de Tecnología · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 5 — RRHH (onboarding/offboarding)

---

## 1. Objetivo

Estandarizar la gestión de identidad y accesos, la gestión de incidentes y cambios, el respaldo y recuperación ante desastres, y la línea base de seguridad, para que la tecnología sea un habilitador confiable de todos los módulos de GAIOS — en particular la automatización (Módulo 8) — y no un punto de fragilidad ni origen de incidentes de seguridad, **reduciendo la dependencia del Director de Tecnología** en tareas repetitivas de acceso y soporte de primer nivel.

## 2. Alcance

**Incluye:** gestión de identidad y accesos (IAM) ligada al ciclo de vida del colaborador (Módulo 5), gestión de incidentes y solicitudes de TI, gestión de cambios a sistemas de producción, respaldo y recuperación ante desastres (backup/DR), línea base de seguridad (MFA, gestión de contraseñas, parcheo).

**Excluye:** desarrollo de producto de software propio (requiere módulo de Ingeniería/Producto si aplica); automatización de procesos de negocio específicos de cada área (Módulo 8, que se apoya en esta infraestructura).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| ITIL (simplificado) — Incident/Change/Request Management | Estructura de gestión de incidentes y cambios |
| Principio de mínimo privilegio (least privilege) / Zero Trust | Modelo de accesos por rol |
| RPO/RTO (Recovery Point/Time Objective) | Definición de respaldo y recuperación por sistema crítico |
| CIS Controls (simplificado) | Línea base de seguridad |
| Módulo 5 — RRHH | Dispara las altas y bajas de acceso desde onboarding/offboarding |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director de Tecnología | Dueño del proceso, arquitectura y seguridad | X | X | | |
| Soporte TI | Ejecuta altas/bajas, resuelve incidentes | X | | | |
| RRHH | Dispara la solicitud de alta/baja según el ciclo de vida del colaborador | | | X | |
| Chief AI Officer | Arquitectura de integración para automatizaciones | | | X | |
| Todo colaborador | Usuario de los sistemas, reporta incidentes | | | | X |

## 5. Herramientas

- **IAM/SSO:** Okta / Google Workspace / Azure AD.
- **Gestión de tickets de TI:** Jira Service Management / Freshservice.
- **Backup automatizado** con verificación de integridad.
- **Gestor de contraseñas centralizado:** 1Password / Bitwarden.
- **Plataforma de integración (iPaaS):** n8n / Make / Zapier — base técnica del Módulo 8.

## 6. Procedimiento paso a paso

1. **Alta de acceso:** disparada automáticamente por el onboarding de RRHH (Módulo 5); se otorga el acceso mínimo necesario según el rol (least privilege), no acceso amplio "por si acaso".
2. **Gestión de solicitudes e incidentes de TI:** todo requerimiento entra como ticket con SLA de respuesta según severidad.
3. **Gestión de cambios:** todo cambio significativo a sistemas de producción pasa por aprobación, ventana de cambio programada y plan de rollback documentado antes de ejecutarse (`sop-gestion-cambios.md`).
4. **Respaldo y recuperación:** backups automatizados con RPO/RTO definidos por sistema crítico; prueba de restauración periódica, no solo confirmación de que "el backup corrió" (`sop-backup-recuperacion.md`).
5. **Línea base de seguridad:** MFA obligatorio en sistemas críticos, contraseñas gestionadas centralizadamente, parcheo regular de sistemas.
6. **Baja de acceso:** disparada automáticamente por el offboarding de RRHH — revocación de todos los accesos en menos de 24 horas.
7. **Arquitectura de integración:** enfoque API-first; catálogo de integraciones activas entre sistemas (CRM-ERP-Marketing, etc.) documentado y mantenido vigente (`plantilla-catalogo-integraciones.md`).

## 7. Diagrama de flujo (descrito en texto)

```
[Onboarding RRHH] ──► [Alta de acceso: mínimo privilegio según rol]
        │
        ▼
[Colaborador activo] ──► [Solicitudes/incidentes → ticket con SLA por severidad]
        │
        ▼
  ¿Cambio a producción? ──Sí──► [Aprobación + ventana de cambio + plan de rollback]
        │
        ▼
[Backups automatizados con RPO/RTO] ──► [Prueba periódica de restauración]
        │
        ▼
[Offboarding RRHH] ──► [Baja de acceso: revocación en <24 horas]
```

## 8. Checklist operativo

- [ ] Todo colaborador tiene solo los accesos que su rol requiere (least privilege), verificado en la revisión trimestral.
- [ ] MFA activo en todos los sistemas críticos, sin excepción.
- [ ] Todo cambio a producción tiene ventana de cambio y plan de rollback documentado.
- [ ] Backups probados con restauración real periódicamente, no solo verificados como "ejecutados".
- [ ] Baja de acceso completada en menos de 24 horas tras el offboarding.
- [ ] Catálogo de integraciones activas vigente y documentado.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de resolución de incidentes | Horas por severidad (crítica/alta/media/baja) | Según SLA definido por severidad |
| % de sistemas críticos con MFA | Sistemas con MFA / sistemas críticos | 100% |
| Tiempo de revocación de acceso | Horas desde offboarding hasta revocación completa | ≤ 24 horas |
| Éxito de pruebas de restauración | Restauraciones exitosas / pruebas realizadas | 100% |
| % de cambios con rollback documentado | Cambios con plan de rollback / total de cambios a producción | 100% |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Acceso no revocado a tiempo tras una salida — riesgo de seguridad | Media | Alto |
| Cambios no controlados que rompen sistemas de producción | Media | Alto |
| Backup nunca probado — falla justo cuando se necesita | Media | Alto |
| Falta de MFA en sistemas críticos — vector de ataque | Baja | Alto |
| Shadow IT: sistemas no autorizados fuera del catálogo | Media | Medio |

## 11. Controles

- Revisión trimestral de accesos activos vs. necesarios (access review) por sistema.
- Ningún cambio a producción se ejecuta sin ventana de cambio aprobada y plan de rollback.
- Prueba de restauración de backup programada, no opcional.
- MFA obligatorio sin excepción en sistemas críticos — no se otorgan excepciones individuales sin aprobación del Director de Tecnología.
- Todo sistema nuevo se incorpora al catálogo de integraciones antes de conectarse a sistemas de producción.

## 12. Automatizaciones posibles

- **Alta/baja de acceso automática** ligada al HRIS (Módulo 5), sin ticket manual.
- **Backups automatizados con verificación** de integridad post-respaldo.
- **Alertas de intentos de acceso anómalos** (geolocalización inusual, múltiples fallos de login).
- **Dashboard de estado de integraciones** con alertas si una integración falla silenciosamente.

## 13. Prompts IA relacionados

1. *"Genera el checklist de alta de acceso para el rol de [rol], aplicando el principio de mínimo privilegio — qué sistemas necesita y con qué nivel de permiso."*
2. *"Redacta el plan de cambio para [cambio a sistema], incluyendo ventana propuesta, pasos de ejecución y plan de rollback en caso de falla."*
3. *"Analiza este log de incidentes de TI de los últimos 3 meses y agrupa los patrones más frecuentes por sistema y causa probable."*
4. *"Con este inventario de sistemas conectados, genera el catálogo de integraciones activas: qué sistemas conecta, qué datos fluyen y con qué frecuencia."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de altas y bajas de acceso ligadas automáticamente al ciclo de vida de RRHH.
- Cero accesos revocados fuera del plazo de 24 horas.
- 100% de sistemas críticos con MFA activo.
- Al menos una prueba de restauración de backup exitosa por sistema crítico en el semestre.
- El Director de Tecnología reporta menos tiempo dedicado a solicitudes repetitivas de acceso.

## 15. Plan de mejora continua

- **Revisión trimestral** de accesos activos y del catálogo de integraciones.
- **Revisión semestral** de la línea base de seguridad frente a nuevas amenazas o buenas prácticas.
- **Revisión de este documento cada 6 meses**, o antes si cambia significativamente el stack tecnológico.
- **Aplicación de DMAIC (Módulo 3)** ante incidentes recurrentes del mismo tipo.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Gestión de accesos e identidad (IAM) | `gaios/07-tecnologia/sop-gestion-accesos-iam.md` |
| SOP — Gestión de cambios | `gaios/07-tecnologia/sop-gestion-cambios.md` |
| SOP — Respaldo y recuperación | `gaios/07-tecnologia/sop-backup-recuperacion.md` |
| Plantilla — Catálogo de integraciones | `gaios/07-tecnologia/plantilla-catalogo-integraciones.md` |
| Checklist operativo de aceptación | `gaios/07-tecnologia/checklist-modulo7.md` |
| Prompts IA relacionados (ampliado) | `gaios/07-tecnologia/prompts-ia-modulo7.md` |
| Formulario / dashboard de KPIs de tecnología | `gaios/07-tecnologia/kpis-dashboard-tecnologia.md` |

**Próximos módulos dependientes:** Módulo 8 (Automatización e IA transversal) se construye directamente sobre la arquitectura de integración y el catálogo de este módulo.
