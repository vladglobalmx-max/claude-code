# SOP — Respaldo y Recuperación (Backup/DR)

**Versión:** 1.0 · **Dueño:** Director de Tecnología · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 7 — Tecnología

## 1. Objetivo
Garantizar que la empresa pueda recuperar sus datos y sistemas críticos ante una falla o incidente, con pérdida de datos y tiempo de inactividad dentro de límites definidos y probados — no asumidos.

## 2. Alcance
Aplica a todos los sistemas clasificados como críticos (CRM, ERP, sistema contable, repositorio de documentos). No aplica a datos temporales o de bajo valor sin impacto en la continuidad del negocio.

## 3. Entradas
Inventario de sistemas críticos; definición de RPO (Recovery Point Objective) y RTO (Recovery Time Objective) por sistema.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director de Tecnología | X | X | | |
| Soporte TI | X | | | |

## 5. Herramientas
Sistema de backup automatizado con verificación de integridad; entorno de prueba para restauraciones.

## 6. Procedimiento paso a paso
1. Clasificar los sistemas críticos y definir su RPO (cuánta pérdida de datos es aceptable) y RTO (cuánto tiempo de inactividad es aceptable).
2. Configurar backups automatizados con la frecuencia que cumpla el RPO definido (ej. RPO de 1 hora requiere backups cada hora o replicación continua).
3. Verificar automáticamente la integridad de cada backup al completarse.
4. Programar pruebas de restauración periódicas (no solo confirmar que el backup "corrió", sino restaurarlo realmente en un entorno de prueba).
5. Documentar el tiempo real de restauración obtenido en la prueba y compararlo contra el RTO objetivo.
6. Si la prueba de restauración falla o excede el RTO, corregir la causa antes de la siguiente revisión programada.
7. Mantener un plan de recuperación ante desastres (DR) documentado con los pasos de restauración por sistema crítico.

## 7. Diagrama de flujo (descrito en texto)
```
[Clasificar sistemas críticos] → [Definir RPO/RTO por sistema]
        │
        ▼
[Configurar backups automatizados según RPO] → [Verificación de integridad automática]
        │
        ▼
[Prueba de restauración periódica en entorno de prueba]
        │
        ▼
¿Cumple el RTO objetivo? --No--> [Corregir causa antes de la siguiente revisión]
        │ Sí
        ▼
[Documentar resultado] → [Plan de DR actualizado y vigente]
```

## 8. Checklist operativo
- [ ] Todo sistema crítico tiene RPO y RTO definidos.
- [ ] Backups configurados según el RPO de cada sistema.
- [ ] Verificación de integridad automática tras cada backup.
- [ ] Prueba de restauración real realizada según calendario, no solo verificación de ejecución.
- [ ] Plan de DR documentado y vigente por sistema crítico.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Éxito de pruebas de restauración | Restauraciones exitosas / pruebas realizadas | 100% |
| Cumplimiento de RTO en pruebas | Pruebas dentro del RTO objetivo / total de pruebas | ≥ 90% |
| Cobertura de sistemas críticos con backup verificado | Sistemas con backup+prueba vigente / sistemas críticos | 100% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Backup nunca probado — falla justo cuando se necesita | Media | Alto |
| RPO/RTO no definidos — expectativas poco realistas ante un incidente real | Media | Alto |

## 11. Controles
Ningún sistema se considera "respaldado" solo porque el backup se ejecuta — se requiere evidencia de una restauración de prueba exitosa dentro del periodo de revisión.

## 12. Automatizaciones posibles
Verificación automática de integridad post-backup; alertas si un backup falla o no se ejecuta según lo programado; calendario automatizado de pruebas de restauración con recordatorio al responsable.

## 13. Prompts IA relacionados
1. *"Ayúdame a definir el RPO y RTO razonable para [sistema crítico], considerando el impacto de negocio de una interrupción."*
2. *"Con este resultado de la prueba de restauración (tiempo real vs. RTO objetivo), evalúa si el sistema cumple el estándar y qué ajustar si no."*

## 14. Indicadores de éxito
100% de los sistemas críticos con al menos una prueba de restauración exitosa dentro del RTO objetivo en el semestre.

## 15. Plan de mejora continua
Revisión semestral de la clasificación de sistemas críticos y de los RPO/RTO definidos, ajustando según la evolución del stack tecnológico.
