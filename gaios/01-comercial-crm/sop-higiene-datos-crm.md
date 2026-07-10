# SOP — Higiene de Datos del CRM

**Versión:** 1.0 · **Dueño:** Director Comercial (ejecuta: Operaciones Comerciales / RevOps si existe) · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 1 — Comercial/CRM

## 1. Objetivo
Mantener el CRM como fuente de verdad confiable — sin duplicados, sin oportunidades huérfanas, sin campos obligatorios vacíos — para que el forecast, los reportes y las automatizaciones de GAIOS se puedan construir sobre datos reales.

## 2. Alcance
Aplica a todos los registros de Cuentas, Contactos y Oportunidades del CRM. No aplica a datos históricos archivados de más de 24 meses (se gestionan con política de retención aparte).

## 3. Entradas
Exportes semanales de calidad de datos del CRM; reglas de validación configuradas en el sistema.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Operaciones Comerciales / RevOps (o Director Comercial si no existe el rol) | X | X | | |
| Cada AE (sus propios registros) | X | | | |

## 5. Herramientas
CRM con reglas de validación nativas; herramienta de deduplicación (nativa o Insycle/Cloudingo); dashboard de calidad de datos.

## 6. Procedimiento paso a paso
1. Auditoría semanal automática: oportunidades sin actividad en 14+ días, contactos sin cuenta asociada, cuentas duplicadas por dominio de email.
2. El sistema notifica al AE dueño de cada registro con hallazgo, con plazo de 48 horas para corregir.
3. Si no se corrige en el plazo, escala al Director Comercial.
4. Mensualmente, se revisan duplicados de cuentas/contactos y se fusionan siguiendo la regla: se conserva el registro con más actividad histórica.
5. Trimestralmente, se audita que los campos obligatorios (ICP, fuente del lead, motivo de pérdida codificado) tengan 100% de cobertura en oportunidades cerradas del periodo.

## 7. Diagrama de flujo (descrito en texto)
```
[Auditoría semanal automática] → [Notificar al AE dueño del registro]
        │
        ▼
¿Corregido en 48h? --No--> [Escalar a Director Comercial]
        │ Sí
        ▼
[Registro limpio] → [Auditoría mensual de duplicados] → [Fusión con regla de conservación]
        │
        ▼
[Auditoría trimestral de campos obligatorios en cerrados]
```

## 8. Checklist operativo
- [ ] Cero oportunidades activas sin actividad registrada en más de 14 días sin justificación.
- [ ] Cero cuentas duplicadas por mismo dominio de email sin resolver.
- [ ] 100% de oportunidades cerradas con motivo de pérdida codificado (si perdidas) o valor final (si ganadas).
- [ ] 100% de contactos con cuenta asociada.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Higiene de CRM | Registros que pasan la auditoría / total auditado | ≥ 95% |
| Tiempo de corrección | Horas desde notificación hasta corrección | ≤ 48 horas |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Datos sucios invalidan el forecast y las automatizaciones | Alta | Alto |
| Resistencia de AEs a la disciplina de captura de datos | Media | Medio |

## 11. Controles
Campos obligatorios bloqueados a nivel de sistema (no se puede guardar una oportunidad sin ICP y fuente); reporte de higiene visible para todo el equipo comercial (transparencia como incentivo).

## 12. Automatizaciones posibles
Auditoría y notificación 100% automatizada (n8n/Make + API del CRM); deduplicación automática por regla de dominio; enriquecimiento automático de firmográficos al crear una cuenta nueva.

## 13. Prompts IA relacionados
1. *"A partir de este export de CRM, identifica duplicados probables por nombre de cuenta y dominio de email, y sugiere cuál registro conservar según actividad histórica."*
2. *"Genera el resumen semanal de higiene de CRM: % de cumplimiento, registros pendientes de corrección y responsables."*

## 14. Indicadores de éxito
Higiene de CRM ≥95% sostenida, medida y reportada mensualmente sin intervención manual del Director Comercial.

## 15. Plan de mejora continua
Revisión trimestral de las reglas de validación del sistema, incorporando nuevos campos obligatorios si el negocio los requiere (ej. al lanzar un canal de venta nuevo).
