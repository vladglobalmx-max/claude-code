# GAIOS — Módulo 3: Operaciones / SOPs Core

> La metodología con la que la empresa levanta, mide, mejora y controla sus procesos operativos — el motor de mejora continua de GAIOS.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director de Operaciones · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra

---

## 1. Objetivo

Estandarizar la metodología con la que se levantan, miden, mejoran y controlan los procesos operativos core de la empresa usando Lean Six Sigma (ciclo DMAIC), reduciendo variación, desperdicio y errores, e incrementando la productividad — sin depender de que el Director de Operaciones resuelva cada problema operativo de forma reactiva y ad hoc, "apagando incendios".

Este módulo no documenta un proceso operativo específico: es el **método** que los demás módulos (Compras, RRHH, Finanzas, Atención al Cliente) aplican a sus propios procesos cuando necesitan mejorarlos.

## 2. Alcance

**Incluye:** metodología de levantamiento de procesos (SIPOC, mapeo de flujo de valor), el ciclo DMAIC completo para mejora de procesos, identificación y eliminación de desperdicios, análisis de causa raíz, gestión de no conformidades/incidentes, control post-mejora.

**Excluye:** el contenido específico de los procesos comerciales (Módulos 1-2, ya cubiertos) y de compras, RRHH o finanzas (módulos propios que consumen esta metodología); la implementación de software o automatización específica (Módulo 7 — Tecnología).

## 3. Entradas

| Fuente | Uso en esta metodología |
|---|---|
| Lean Six Sigma / DMAIC | Estructura completa del ciclo de mejora |
| Toyota Production System (TPS) / Lean | Identificación de los 8 desperdicios (DOWNTIME) |
| SIPOC (Suppliers-Inputs-Process-Outputs-Customers) | Mapeo inicial de cualquier proceso |
| Value Stream Mapping | Visualización del flujo de valor y cuellos de botella |
| 5 Whys / Diagrama de Ishikawa | Análisis de causa raíz |
| Poka-yoke (a prueba de errores) | Diseño de controles que previenen el error, no solo lo detectan |
| PDCA (Ciclo de Deming) | Marco de control y mejora continua |
| ISO 9001 | Gestión de no conformidades y acciones correctivas |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director de Operaciones | Dueño de la metodología, prioriza proyectos de mejora | X | X | | |
| Consultor Lean Six Sigma | Guía metodológica, certificación de proyectos | | | X | |
| Dueño del proceso (en cada área) | Ejecuta el DMAIC sobre su propio proceso | X | | | |
| Chief AI Officer | Automatización de mediciones y dashboards | | | X | |
| Todo colaborador operativo | Ejecuta el proceso mejorado, reporta no conformidades | | | | X |

## 5. Herramientas

- **Mapeo de procesos:** Miro / Lucidchart para SIPOC y Value Stream Mapping.
- **Gestión de incidentes/no conformidades:** Jira / Trello / sistema de tickets.
- **Control estadístico básico:** hojas de cálculo con gráficos de control (control charts) o Power BI/Looker.
- **Documentación:** estándar GAIOS de 15 secciones (Módulo 0) para todo SOP resultante.
- **Encuestas internas:** para medir satisfacción y fricción operativa.

## 6. Procedimiento paso a paso

El ciclo **DMAIC** es el procedimiento central de este módulo. Se aplica a cualquier proceso operativo que muestre errores recurrentes, tiempo de ciclo excesivo o costo de no calidad relevante.

1. **Definir (Define):** identificar el proceso crítico a mejorar por su impacto en error, costo o tiempo; mapearlo con SIPOC (Proveedores, Entradas, Proceso, Salidas, Clientes); redactar el charter del proyecto (`plantilla-proyecto-dmaic.md`).
2. **Medir (Measure):** levantar datos de línea base reales — tiempo de ciclo, tasa de error/reproceso, costo de no calidad. Sin línea base medida, no hay proyecto de mejora válido.
3. **Analizar (Analyze):** identificar la causa raíz con 5 Whys o diagrama de Ishikawa (`sop-analisis-causa-raiz.md`); mapear los desperdicios presentes (los 8 de Lean: Defectos, Sobreproducción, Espera, Talento no aprovechado, Transporte, Inventario, Movimiento, Exceso de procesamiento — DOWNTIME).
4. **Mejorar (Improve):** rediseñar el proceso atacando la causa raíz, no el síntoma; documentar el nuevo proceso como SOP bajo el estándar GAIOS (Módulo 0); pilotar el cambio antes de escalarlo.
5. **Controlar (Control):** definir el KPI de control y su frecuencia de medición; establecer poka-yoke donde sea posible (que el error sea físicamente imposible, no solo detectable); auditar el proceso a 30/60/90 días para confirmar que la mejora no se revierte.

## 7. Diagrama de flujo (descrito en texto)

```
[Identificar proceso crítico] ──► [DEFINIR: SIPOC + charter del proyecto]
        │
        ▼
[MEDIR: línea base real (tiempo, error, costo)]
        │
        ▼
[ANALIZAR: causa raíz (5 Whys/Ishikawa) + desperdicios presentes]
        │
        ▼
[MEJORAR: rediseñar, documentar como SOP GAIOS, pilotar]
        │
        ▼
  ¿El piloto confirma la mejora? ──No──► [Reanalizar causa raíz]
        │ Sí
        ▼
[CONTROLAR: KPI de control, poka-yoke, auditoría 30/60/90 días]
        │
        ▼
  ¿La mejora se sostiene? ──No──► [Reabrir el ciclo DMAIC]
        │ Sí
        ▼
[Proceso estandarizado y vigente — retroalimenta el catálogo de SOPs]
```

## 8. Checklist operativo

- [ ] El proceso tiene SIPOC documentado antes de iniciar el análisis.
- [ ] Existe línea base medida (no estimada ni asumida) antes de proponer una mejora.
- [ ] La causa raíz está identificada y documentada — no solo el síntoma.
- [ ] El SOP resultante cumple el estándar GAIOS de 15 secciones.
- [ ] El piloto se ejecutó y se midió antes de escalar el cambio a toda la operación.
- [ ] Existe un KPI de control con frecuencia de medición definida.
- [ ] Se programó auditoría de sostenibilidad a 30/60/90 días.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Procesos core con SOP vigente | Procesos documentados y vigentes / procesos core identificados | ≥ 90% en 12 meses |
| Reducción de tasa de error | (Tasa de error anterior − actual) / tasa anterior | ≥ 20% por proyecto DMAIC |
| Tiempo de ciclo | Duración promedio del proceso, antes vs. después | Reducción medible |
| Costo de no calidad (COPQ) | Costo de reprocesos + reclamos + desperdicio | Reducción sostenida |
| Proyectos DMAIC completados | Nº de ciclos DMAIC cerrados con control confirmado | Creciente trimestre a trimestre |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Implementar mejoras sin línea base — imposible probar el impacto real | Alta | Alto |
| Atacar el síntoma en vez de la causa raíz | Media | Alto |
| La mejora se revierte con el tiempo por falta de control post-implementación | Alta | Alto |
| Resistencia al cambio de los operadores del proceso | Media | Medio |
| Proyectos DMAIC que nunca cierran (quedan en "Analizar" indefinidamente) | Media | Medio |

## 11. Controles

- Ningún proyecto de mejora pasa a "Mejorar" sin línea base medida documentada (gate obligatorio).
- Todo SOP resultante de un proyecto DMAIC pasa por el checklist de aceptación del Módulo 0 antes de publicarse.
- Auditoría de sostenibilidad obligatoria a 30/60/90 días después de implementar cualquier mejora.
- Revisión trimestral del catálogo de procesos core y su estado de documentación con el Director de Operaciones.

## 12. Automatizaciones posibles

- **Dashboards automáticos de KPI operativo** con gráficos de control (control charts) que alertan desviaciones fuera de rango.
- **Generación asistida de SIPOC** a partir de una entrevista estructurada con el dueño del proceso.
- **Ticketing automático de no conformidades** con clasificación por tipo de desperdicio.
- **Alertas de auditoría de sostenibilidad** a 30/60/90 días después de cada mejora implementada.
- **Análisis asistido de causa raíz** a partir de datos de incidentes históricos.

## 13. Prompts IA relacionados

1. *"Actúa como consultor Lean Six Sigma. Con esta descripción del proceso [proceso], ayúdame a construir el SIPOC (Proveedores, Entradas, Proceso, Salidas, Clientes) haciendo las preguntas necesarias antes de completarlo."*
2. *"Con estos datos de línea base [datos], aplica la técnica de los 5 Whys para llegar a la causa raíz del problema de [error/defecto], sin quedarte en el primer síntoma."*
3. *"Clasifica estos hallazgos de un Value Stream Mapping según los 8 desperdicios de Lean (DOWNTIME) y prioriza cuáles atacar primero por impacto."*
4. *"Redacta el SOP resultante de esta mejora de proceso usando el estándar GAIOS de 15 secciones, incluyendo el mecanismo de control y el poka-yoke propuesto."*
5. *"Diseña el plan de auditoría de sostenibilidad a 30/60/90 días para esta mejora recién implementada: qué medir, con qué frecuencia, quién es responsable."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- Al menos 4 procesos core de la empresa tienen SOP documentado y vigente bajo el estándar GAIOS.
- Al menos 2 proyectos DMAIC completos (Define a Control) con reducción medible de error o tiempo de ciclo.
- Cero mejoras "revertidas" detectadas en las auditorías de sostenibilidad de 30/60/90 días.
- El Director de Operaciones reporta menos tiempo dedicado a resolver el mismo problema recurrente más de una vez.

## 15. Plan de mejora continua

- **Revisión trimestral del catálogo de procesos core** y su prioridad de mejora, usando el mismo criterio de priorización del roadmap de GAIOS (Módulo 0).
- **Retrospectiva por cada proyecto DMAIC cerrado:** qué funcionó del método, qué se ajusta para el siguiente proyecto.
- **Revisión de este documento cada 6 meses**, incorporando aprendizajes reales de los proyectos ejecutados.
- **Kaizen continuo:** cualquier colaborador puede proponer una mejora menor sin pasar por el ciclo DMAIC completo, canalizada al Director de Operaciones para triage.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Mapeo de procesos (SIPOC) | `gaios/03-operaciones-sop/sop-mapeo-proceso-sipoc.md` |
| SOP — Análisis de causa raíz | `gaios/03-operaciones-sop/sop-analisis-causa-raiz.md` |
| SOP — Gestión de no conformidades | `gaios/03-operaciones-sop/sop-gestion-no-conformidades.md` |
| Plantilla — Charter de proyecto DMAIC | `gaios/03-operaciones-sop/plantilla-proyecto-dmaic.md` |
| Checklist operativo de aceptación | `gaios/03-operaciones-sop/checklist-modulo3.md` |
| Prompts IA relacionados (ampliado) | `gaios/03-operaciones-sop/prompts-ia-modulo3.md` |
| Formulario / dashboard de KPIs operativos | `gaios/03-operaciones-sop/kpis-dashboard-operaciones.md` |

**Próximos módulos dependientes:** Módulo 4 (Compras) y Módulo 12 (Calidad/Mejora Continua) aplican directamente esta metodología DMAIC a sus procesos; todo módulo futuro que necesite mejorar un proceso existente usa este módulo como método, no reinventa uno propio.
