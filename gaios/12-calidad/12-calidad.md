# GAIOS — Módulo 12: Calidad / Mejora Continua

> El sistema de auditoría que verifica, con gemba walk, que lo escrito en cada módulo GAIOS es lo que realmente ocurre — y que las mejoras logradas no se revierten con el tiempo.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Consultor Lean Six Sigma · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 3 — Operaciones/SOP (DMAIC)

---

## 1. Objetivo

Instalar una cultura y un sistema de calidad transversal — auditoría interna de cumplimiento de cada módulo GAIOS, gestión consolidada del costo de no calidad (COPQ), eventos Kaizen de mejora rápida y objetivos de calidad anuales en cascada — para sostener en el tiempo las mejoras logradas por cada módulo individual y evitar que la operación "regrese a la forma antigua de hacer las cosas" unos meses después de implementado un cambio.

## 2. Alcance

**Incluye:** programa de auditoría interna que verifica cada módulo GAIOS publicado contra su propio checklist y contra la realidad operativa (gemba walk); consolidación del costo de no calidad (COPQ) de toda la empresa; eventos Kaizen de mejora rápida; objetivos de calidad anuales en cascada.

**Excluye:** la ejecución del ciclo DMAIC en sí, que pertenece al Módulo 3 — este módulo lo dispara y lo prioriza a nivel empresa; el contenido específico de calidad de cada área, que vive en su propio módulo.

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| ISO 9001 (sistema de gestión de calidad) | Estructura del programa de auditoría interna |
| Gemba walk (Lean) | Verificar el proceso real, no solo el documento |
| Kaizen events | Mejoras rápidas de 1-3 días sin requerir un DMAIC completo |
| Cost of Poor Quality (COPQ) | Consolidación del costo de no calidad de toda la empresa |
| Módulo 0 — checklist de aceptación de cada módulo | Base de la auditoría de cumplimiento |
| Módulo 3 — DMAIC | Mecanismo de ejecución para hallazgos que ameritan un proyecto completo |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Consultor Lean Six Sigma | Dueño del programa de auditoría y calidad | X | X | | |
| Arquitecto Empresarial | Vela por la coherencia con el gobierno de GAIOS (Módulo 0) | | | X | |
| Dueño de cada módulo | Participa en su auditoría, ejecuta acciones correctivas | X | | | |

## 5. Herramientas

- **Checklists de aceptación** de cada módulo GAIOS (ya definidos en cada uno).
- **Calendario de auditoría interna.**
- **Dashboard de COPQ consolidado.**
- **Plantilla de evento Kaizen.**

## 6. Procedimiento paso a paso

1. **Calendario anual de auditoría interna:** cada módulo GAIOS publicado se audita al menos una vez al año, alineado a su ciclo de revisión de 6 meses (Módulo 0).
2. **Gemba walk:** el auditor observa el proceso real en operación, no solo lee el documento — para confirmar que lo escrito coincide con lo que realmente se hace.
3. **Clasificación de hallazgos:** conformidad, observación menor, o no conformidad (esta última se gestiona bajo `sop-gestion-no-conformidades.md` del Módulo 3).
4. **Consolidación del COPQ:** suma del costo de no calidad reportado por cada módulo con proceso operativo (Compras, Operaciones, Atención al Cliente, etc.) — ver `plantilla-reporte-copq.md`.
5. **Eventos Kaizen:** cuando una auditoría o el scorecard (Módulo 10) revela una oportunidad de mejora rápida que no amerita un DMAIC completo, se organiza un evento de 1-3 días con el equipo del proceso (`sop-evento-kaizen.md`).
6. **Objetivos de calidad anuales:** metas de reducción de COPQ y de no conformidades, en cascada desde la dirección hacia cada módulo, alineadas al ciclo de Rocks (Módulo 10).
7. **Reporte anual de calidad** consolidado para el comité de gobierno de GAIOS (Módulo 0).

## 7. Diagrama de flujo (descrito en texto)

```
[Calendario anual de auditoría interna]
        │
        ▼
[Auditoría de módulo: checklist + gemba walk]
        │
        ▼
[Clasificar hallazgo: Conformidad / Observación menor / No conformidad]
        │
        ▼
  ¿No conformidad? ──Sí──► [Gestión de no conformidades (Módulo 3)]
        │ No
        ▼
  ¿Oportunidad de mejora rápida? ──Sí──► [Evento Kaizen (1-3 días)]
        │ No
        ▼
[Consolidar COPQ de todos los módulos] ──► [Objetivos de calidad anuales en cascada]
        │
        ▼
[Reporte anual de calidad al comité de gobierno de GAIOS]
```

## 8. Checklist operativo

- [ ] Calendario de auditoría interna vigente y cumplido.
- [ ] Todo módulo auditado incluye gemba walk, no solo revisión documental.
- [ ] Hallazgos clasificados y con acción correctiva documentada.
- [ ] COPQ consolidado reportado trimestralmente.
- [ ] Al menos un evento Kaizen ejecutado por trimestre.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| % de módulos auditados según calendario | Auditados / programados | 100% |
| COPQ consolidado | Suma del costo de no calidad de todos los módulos | Tendencia decreciente |
| % de no conformidades cerradas a tiempo | Cerradas dentro del plazo / total | ≥ 90% |
| Eventos Kaizen ejecutados | Nº por trimestre | ≥ 1 por trimestre |
| % de hallazgos recurrentes | Hallazgos repetidos de auditorías anteriores / total | Decreciente |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Auditoría que se vuelve un trámite burocrático sin gemba walk real | Media | Alto |
| COPQ subestimado porque no todos los módulos lo reportan | Media | Medio |
| Mejoras que se revierten sin que nadie audite si se sostuvieron | Media | Alto |
| Cultura de calidad percibida como "policía" en vez de mejora colaborativa | Media | Medio |

## 11. Controles

- Ninguna auditoría se cierra sin gemba walk documentado.
- COPQ reportado obligatoriamente por cada módulo con proceso operativo, consolidado trimestralmente.
- La auditoría de sostenibilidad de 30/60/90 días del Módulo 3 se verifica explícitamente en la auditoría anual de este módulo.

## 12. Automatizaciones posibles

- **Recordatorio automático** del calendario de auditoría interna.
- **Dashboard de COPQ consolidado**, alimentado automáticamente desde el reporte de cada módulo.
- **Tracking de hallazgos con alertas de recurrencia**, señalando si un hallazgo ya apareció en una auditoría anterior.

## 13. Prompts IA relacionados

1. *"Genera el plan de auditoría del Módulo [nombre]: qué verificar del checklist, qué preguntar en el gemba walk, y qué evidencia recolectar."*
2. *"Con estas notas de gemba walk, sintetiza el reporte de hallazgos clasificados en conformidad, observación menor y no conformidad."*
3. *"Con este listado de oportunidades de mejora identificadas, prioriza cuáles califican para un evento Kaizen de 1-3 días vs. cuáles requieren un proyecto DMAIC completo."*
4. *"Consolida el COPQ reportado por estos módulos [datos] en un resumen ejecutivo para el comité de gobierno de GAIOS."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de los módulos GAIOS publicados auditados según el calendario, con gemba walk real.
- COPQ consolidado en tendencia decreciente.
- Cero hallazgos de "mejora revertida" en las auditorías de sostenibilidad verificadas.
- Al menos 2 eventos Kaizen ejecutados con resultado medible.

## 15. Plan de mejora continua

- **Revisión trimestral** del COPQ consolidado y de los hallazgos de auditoría.
- **Revisión anual** del calendario y del alcance del programa de auditoría.
- **Revisión de este documento cada 6 meses.**
- **Retroalimentación continua** al comité de gobierno de GAIOS (Módulo 0) sobre qué módulos requieren revisión prioritaria.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Auditoría interna de cumplimiento | `gaios/12-calidad/sop-auditoria-interna-cumplimiento.md` |
| SOP — Evento Kaizen | `gaios/12-calidad/sop-evento-kaizen.md` |
| Plantilla — Reporte de COPQ | `gaios/12-calidad/plantilla-reporte-copq.md` |
| Checklist operativo de aceptación | `gaios/12-calidad/checklist-modulo12.md` |
| Prompts IA relacionados (ampliado) | `gaios/12-calidad/prompts-ia-modulo12.md` |
| Formulario / dashboard de KPIs de calidad | `gaios/12-calidad/kpis-dashboard-calidad.md` |

**Próximos módulos dependientes:** ninguno formalmente — este módulo cierra el ciclo de gobierno de calidad del roadmap inicial (Módulos 0-12) y retroalimenta a todos ellos a través del comité de gobierno de GAIOS (Módulo 0).
