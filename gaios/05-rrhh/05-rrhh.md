# GAIOS — Módulo 5: Recursos Humanos

> El ciclo de vida del talento estandarizado: de la definición del puesto a la salida, con selección estructurada y onboarding como puntos de máximo apalancamiento.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director de RRHH · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra

---

## 1. Objetivo

Estandarizar el ciclo de vida del talento — definición del puesto, selección estructurada, onboarding, gestión de desempeño y desarrollo, offboarding — para asegurar contrataciones de calidad predecible, acelerar el tiempo a productividad de nuevos colaboradores, y **reducir la dependencia del CEO y los Directores de área** en decisiones repetitivas de gestión de personas (a quién contratar, cómo evaluar, cómo dar feedback).

## 2. Alcance

**Incluye:** scorecard de puesto, sourcing y selección estructurada, onboarding 30-60-90 días, gestión de desempeño continuo (OKRs/metas), plan de desarrollo, offboarding.

**Excluye:** nómina y administración detallada de compensación (módulo aparte si se requiere); aspectos legales/laborales específicos por país (requieren asesoría legal local); desarrollo profundo de cultura organizacional (se referencia, no se desarrolla aquí).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| *Who: The A Method for Hiring* (Geoff Smart & Randy Street) | Scorecard de puesto y entrevista estructurada por competencias |
| Topgrading (entrevista cronológica de desempeño) | Verificación profunda del historial del candidato |
| Modelo de onboarding 30‑60‑90 días | Estructura del primer trimestre de todo nuevo ingreso |
| OKRs — *Measure What Matters* (John Doerr) | Marco de gestión de desempeño y alineación de metas |
| EOS — Accountability Chart, GWC (Get it, Want it, Capacity to do it) | Claridad de rol y ajuste persona-puesto |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director de RRHH | Dueño del proceso, garantiza el estándar en toda contratación | X | X | | |
| Hiring manager (Director del área que contrata) | Define el scorecard, entrevista, decide la oferta | X | | | |
| CEO | Involucrado en contrataciones de roles clave/liderazgo | | | X | |
| Chief AI Officer | Automatización de ATS, encuestas, recordatorios | | | X | |
| Nuevo colaborador | Ejecuta su plan de onboarding | | | | X |

## 5. Herramientas

- **ATS (Applicant Tracking System):** Greenhouse / Lever / BambooHR.
- **HRIS:** para el registro del ciclo de vida del colaborador.
- **Plataforma de OKRs/desempeño:** Lattice / 15Five / hoja de cálculo estructurada si la empresa es más pequeña.
- **Encuestas de clima/pulso.**
- **Plantillas de entrevista estructurada por competencia.**

## 6. Procedimiento paso a paso

1. **Definición de vacante:** el hiring manager completa el scorecard del puesto (misión del rol, resultados esperados a 12 meses, competencias clave) **antes** de publicar la vacante — nunca se publica una vacante sin scorecard.
2. **Sourcing:** múltiples canales (referidos, LinkedIn, job boards); filtro inicial de currículums contra el scorecard.
3. **Selección estructurada:** entrevistas por competencias con rúbrica, mínimo 2-3 entrevistadores independientes, verificación de referencias obligatoria antes de la oferta (`sop-seleccion-estructurada.md`).
4. **Oferta y contratación.**
5. **Onboarding 30-60-90:** plan estructurado con objetivos claros por periodo, buddy/mentor asignado, check-ins programados con el hiring manager (`sop-onboarding-30-60-90.md`).
6. **Gestión de desempeño continuo:** OKRs o metas trimestrales, 1:1s regulares, evaluación formal semestral o anual (`sop-gestion-desempeno-okr.md`).
7. **Desarrollo:** plan de crecimiento individual; identificación temprana de talento clave para sucesión de roles críticos.
8. **Offboarding:** proceso estructurado de salida, entrevista de salida, transferencia de conocimiento a quien continúa el trabajo.

## 7. Diagrama de flujo (descrito en texto)

```
[Scorecard de puesto] ──► [Sourcing multicanal] ──► [Filtro inicial contra scorecard]
        │
        ▼
[Entrevistas estructuradas ≥2 entrevistadores] ──► [Verificación de referencias]
        │
        ▼
[Oferta y contratación] ──► [Onboarding 30-60-90 con buddy y check-ins]
        │
        ▼
[Gestión de desempeño continuo: OKRs + 1:1s + evaluación formal]
        │
        ▼
  ¿Continúa en la empresa? ──No──► [Offboarding: entrevista de salida + handoff]
        │ Sí
        ▼
[Plan de desarrollo y, si aplica, identificación para sucesión]
```

## 8. Checklist operativo

- [ ] Toda vacante tiene scorecard de puesto completo antes de publicarse.
- [ ] Toda contratación tiene mínimo 2 entrevistadores independientes con rúbrica.
- [ ] Verificación de referencias completada antes de la oferta, especialmente en roles de liderazgo.
- [ ] Todo nuevo ingreso tiene plan 30-60-90 documentado y un buddy asignado.
- [ ] Todo colaborador tiene OKRs o metas definidas cada trimestre.
- [ ] Evaluación de desempeño realizada según el calendario establecido (sin retrasos sistemáticos).
- [ ] Toda salida tiene entrevista de offboarding y handoff documentado.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Time-to-fill | Días desde apertura de vacante hasta oferta aceptada | Benchmark por nivel de puesto |
| Calidad de contratación | Desempeño del nuevo ingreso a 6 meses (evaluación) | ≥ 80% "cumple o excede expectativas" |
| Retención a 1 año | Nuevos ingresos que siguen activos al año / total contratados | ≥ 85% |
| % con OKRs definidos | Colaboradores con OKRs vigentes / total | 100% |
| Rotación voluntaria | Salidas voluntarias / headcount promedio | Benchmark de industria |
| Cumplimiento de evaluaciones | Evaluaciones realizadas a tiempo / programadas | ≥ 95% |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Contratación por "buena vibra" sin proceso estructurado (mal hire) | Alta | Alto |
| Onboarding improvisado que alarga el tiempo a productividad | Alta | Medio |
| Falta de feedback continuo → sorpresas en la evaluación formal | Media | Alto |
| Rotación de talento clave sin plan de sucesión | Media | Alto |
| Offboarding mal gestionado (riesgo legal y de reputación) | Baja | Alto |

## 11. Controles

- Ninguna vacante se publica sin scorecard de puesto aprobado.
- Ninguna oferta se extiende sin verificación de referencias en roles de liderazgo o de alta confianza.
- El calendario de evaluaciones de desempeño lo audita RRHH, no queda a discreción de cada gerente.
- Toda salida pasa por checklist de offboarding con handoff firmado.

## 12. Automatizaciones posibles

- **Scoring automático de candidatos** en el ATS contra el scorecard del puesto.
- **Recordatorios automáticos** de check-ins de onboarding a los 30/60/90 días.
- **Encuestas de pulso automáticas** (engagement) con periodicidad definida.
- **Alertas de evaluación de desempeño vencida** al gerente y a RRHH.
- **Dashboard de rotación en tiempo real** conectado al HRIS.

## 13. Prompts IA relacionados

1. *"Ayúdame a construir el scorecard del puesto de [rol]: misión del rol, resultados esperados a 12 meses y competencias clave, haciendo las preguntas necesarias al hiring manager antes de completarlo."*
2. *"Genera 8 preguntas de entrevista estructurada por competencia para evaluar [competencia específica] en un candidato a [rol]."*
3. *"Diseña el plan de onboarding 30-60-90 días para un nuevo [rol], con objetivos claros por periodo y puntos de check-in."*
4. *"Con estas notas de 1:1s de los últimos 3 meses, ayúdame a redactar el borrador de evaluación de desempeño de [colaborador], destacando logros y áreas de desarrollo de forma específica."*
5. *"Analiza los resultados de esta encuesta de clima y sugiere 3 acciones concretas priorizadas por impacto y facilidad de implementación."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de las vacantes publicadas con scorecard completo.
- Retención a 1 año de nuevas contrataciones ≥85%.
- 100% de los colaboradores con OKRs o metas vigentes cada trimestre.
- Cumplimiento del calendario de evaluaciones ≥95%.
- Directores de área reportan menos tiempo dedicado a resolver problemas de desempeño que pudieron detectarse antes con feedback continuo.

## 15. Plan de mejora continua

- **Revisión trimestral** de time-to-fill y calidad de contratación por área, ajustando el proceso de sourcing si hay fricción.
- **Revisión semestral** del modelo de OKRs/desempeño con retroalimentación de gerentes y colaboradores.
- **Revisión de este documento cada 6 meses**, o antes si cambia significativamente el tamaño del equipo.
- **Aplicación de DMAIC (Módulo 3)** si se detecta un patrón recurrente de malas contrataciones o rotación temprana.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Selección estructurada | `gaios/05-rrhh/sop-seleccion-estructurada.md` |
| SOP — Onboarding 30-60-90 | `gaios/05-rrhh/sop-onboarding-30-60-90.md` |
| SOP — Gestión de desempeño (OKRs) | `gaios/05-rrhh/sop-gestion-desempeno-okr.md` |
| Plantilla — Scorecard de puesto | `gaios/05-rrhh/plantilla-scorecard-puesto.md` |
| Checklist operativo de aceptación | `gaios/05-rrhh/checklist-modulo5.md` |
| Prompts IA relacionados (ampliado) | `gaios/05-rrhh/prompts-ia-modulo5.md` |
| Formulario / dashboard de KPIs de RRHH | `gaios/05-rrhh/kpis-dashboard-rrhh.md` |

**Próximos módulos dependientes:** Módulo 9 (Gestión del Conocimiento) reutiliza el proceso de onboarding y offboarding para transferencia de saber-hacer; Módulo 10 (Gobierno Corporativo/EOS) consume el Accountability Chart y el modelo GWC para claridad de roles.
