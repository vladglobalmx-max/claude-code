# GAIOS — Módulo 0: Arquitectura Maestra

> **Global AI Operating System** — El sistema operativo empresarial que elimina trabajo repetitivo, reduce errores, incrementa ventas y productividad, y reduce la dependencia del Director General.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Arquitecto Empresarial · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10

---

## 1. Objetivo

Definir la arquitectura maestra de GAIOS: la taxonomía de módulos, el estándar documental único (15 secciones), el modelo de gobierno, los criterios de calidad y la infraestructura tecnológica sobre los que se construirán **todos** los módulos operativos del sistema (Comercial, Marketing, Operaciones, Compras, RRHH, Tecnología, Finanzas, Conocimiento).

Este módulo no resuelve un proceso operativo puntual: es el **meta-marco** que hace que los demás módulos sean coherentes entre sí, comparables, auditables y escalables a una organización de +500 empleados sin que su calidad dependa de quién los escriba.

## 2. Alcance

**Incluye:**
- Taxonomía completa de módulos GAIOS y su orden de dependencia.
- Estándar documental obligatorio (las 15 secciones) y su plantilla reutilizable.
- Modelo de gobierno: quién aprueba, quién audita, con qué frecuencia se revisa.
- Estructura de repositorio/carpetas y convención de versionado.
- Stack tecnológico recomendado para operar el sistema (no solo documentarlo).
- Criterios de aceptación de calidad para cualquier documento GAIOS.

**Excluye:**
- Contenido operativo específico de cada área funcional (se desarrolla en los módulos 1..N).
- Configuración técnica detallada de cada herramienta (se documenta en el módulo de Tecnología).

## 3. Entradas

| Fuente | Uso en esta arquitectura |
|---|---|
| EOS (Traction, Gino Wickman) | Modelo de responsables (Accountability Chart), reuniones L10, scorecard |
| Scaling Up (Verne Harnish) | Rockefeller Habits, ritmo de cascada de prioridades, One-Page Strategic Plan |
| Lean Six Sigma / DMAIC | Estructura de procedimiento paso a paso, control estadístico, reducción de variación |
| ISO 9001 (control documental) | Versionado, ciclo de aprobación, revisión periódica obligatoria |
| BPMN 2.0 | Notación estándar para los diagramas de flujo de cada módulo |
| TOGAF (simplificado) | Separación en capas: negocio, aplicación, datos, tecnología |
| SECI Model (Nonaka & Takeuchi) | Gestión del conocimiento: tácito → explícito → manual reutilizable |
| Benchmark de plataformas (Salesforce, HubSpot, Notion, Airtable, n8n/Make, ERPs) | Selección de stack tecnológico de referencia |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director General / CEO | Sponsor, prioriza roadmap de módulos | | X | | |
| Arquitecto Empresarial | Dueño del estándar, aprueba cada módulo nuevo | X | X | | |
| Chief AI Officer | Diseña automatizaciones e IA embebida en cada módulo | X | | X | |
| Director de área (Comercial, Ops, RRHH, etc.) | Dueño del contenido de su módulo | X | | X | |
| Consultor EOS / Six Sigma / Scaling Up | Audita metodología y evita reinventar procesos | | | X | |
| Todo colaborador | Consume y ejecuta el manual | | | | X |

## 5. Herramientas

- **Repositorio versionado:** Git (fuente de verdad) + espejo navegable en Notion/Confluence.
- **Diagramación:** Mermaid / BPMN embebido en texto (ver sección 7 de cada módulo).
- **Automatización:** n8n / Make / Zapier para disparar acciones desde el manual.
- **IA generativa:** Claude, como redactor, auditor de estándar y generador de prompts operativos.
- **Gestión de proyectos del roadmap:** Linear / Asana / Airtable.
- **Sistemas de registro (system of record):** CRM, ERP, HRIS — el manual referencia estos sistemas, no los reemplaza.

## 6. Procedimiento paso a paso

1. **Diagnóstico inicial:** inventariar procesos existentes, tribal knowledge y huecos críticos por área.
2. **Definir taxonomía de módulos:** mapa completo de módulos GAIOS (ver `gaios/roadmap/roadmap-modulos.md`) y su secuencia de dependencia.
3. **Fijar el estándar documental:** las 15 secciones obligatorias (este documento las modela). Ninguna sección es opcional; si no aplica, se declara explícitamente "No aplica" y se justifica.
4. **Definir estructura de repositorio:** `gaios/<nn>-<nombre-modulo>/` con el capítulo principal más sus anexos (SOPs, plantillas, checklists, prompts).
5. **Definir modelo de gobierno:** ciclo de vida de un documento — Borrador → Revisión (Director de área + Arquitecto) → Aprobado → Publicado → Revisión periódica (máx. cada 6 meses) → Vigente/Obsoleto.
6. **Fijar criterios de aceptación de calidad** (sección 8 de este documento) que todo módulo debe cumplir antes de publicarse.
7. **Priorizar el roadmap** de construcción de módulos según impacto (ventas, reducción de errores, dependencia del CEO) vs. esfuerzo.
8. **Ejecutar módulo piloto:** el primer módulo funcional se construye usando esta plantilla y sirve de caso de validación del estándar.
9. **Auditar el piloto** contra el checklist de aceptación; ajustar el estándar si se detectan fricciones reales.
10. **Publicar y difundir:** anunciar el módulo, capacitar a los responsables, habilitar acceso.
11. **Ciclo de mejora continua:** revisión periódica programada (sección 15) y actualización por cambios de negocio.

## 7. Diagrama de flujo (descrito en texto)

```
[Diagnóstico de procesos]
        │
        ▼
[Definir taxonomía de módulos] ──► [Roadmap de dependencias]
        │
        ▼
[Fijar estándar documental de 15 secciones]
        │
        ▼
[Definir estructura de repo + gobierno + checklist de calidad]
        │
        ▼
[Seleccionar módulo piloto] ──► ¿Cumple checklist de aceptación? ──No──► [Ajustar estándar]
        │ Sí                                                                │
        ▼                                                                   │
[Publicar módulo] ◄───────────────────────────────────────────────────────┘
        │
        ▼
[Capacitar responsables] ──► [Activar automatizaciones asociadas]
        │
        ▼
[Revisión periódica (≤6 meses)] ──► ¿Sigue vigente? ──No──► [Actualizar / declarar obsoleto]
        │ Sí
        ▼
[Vigente — retroalimenta siguiente módulo del roadmap]
```

## 8. Checklist operativo

Ver detalle ejecutable en `gaios/00-arquitectura-maestra/checklist-modulo0.md`. Resumen de criterios de aceptación para **cualquier** documento GAIOS:

- [ ] Contiene las 15 secciones, en orden, sin omisiones injustificadas.
- [ ] El objetivo es medible y está ligado a al menos un KPI.
- [ ] Tiene responsable único de sección "R" (accountability chart, no comités difusos).
- [ ] El diagrama de flujo es ejecutable por alguien que nunca vio el proceso.
- [ ] Declara automatizaciones posibles, aunque hoy no se implementen.
- [ ] Incluye al menos 3 prompts de IA reutilizables ligados al proceso.
- [ ] Tiene fecha de próxima revisión (máx. 6 meses).
- [ ] Fue validado por el Director de área dueño del proceso.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Cobertura del roadmap | Módulos publicados / módulos planeados | ≥ 80% en 12 meses |
| Cumplimiento del estándar | Documentos que pasan el checklist en 1ra revisión / total | ≥ 90% |
| Tiempo de generación por módulo | Días desde borrador hasta publicado | ≤ 15 días |
| Automatizaciones activadas | Nº de automatizaciones derivadas del manual, en producción | Creciente trimestre a trimestre |
| Dependencia del CEO | Horas/semana del CEO en decisiones operativas repetitivas | Reducción ≥ 30% en 6 meses |
| Adopción | % de colaboradores clave que consultan el manual mensualmente | ≥ 70% |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Módulos inconsistentes por falta de gobierno real | Media | Alto |
| "Documentación por documentar" sin adopción operativa | Alta | Alto |
| Desactualización silenciosa (nadie revisa) | Alta | Medio |
| Resistencia al cambio de directores de área | Media | Alto |
| Un solo punto de falla: dependencia del Arquitecto Empresarial | Media | Alto |
| Sobre-automatización prematura antes de estabilizar el proceso manual | Baja | Medio |

## 11. Controles

- Comité de revisión mensual (Arquitecto Empresarial + Chief AI Officer + 1 Director rotativo) que audita módulos publicados contra el checklist.
- Changelog obligatorio por documento (qué cambió, quién, por qué) en el encabezado del archivo.
- Ningún módulo pasa a "Publicado" sin aprobación explícita del Director de área dueño.
- Alarma automática (ver sección 12) cuando un documento supera 6 meses sin revisión.
- Backup del repositorio versionado con historial completo (Git) — ningún documento se edita "por encima" sin dejar rastro.

## 12. Automatizaciones posibles

- **Generación asistida:** prompt estándar que toma la plantilla de la sección 13 y genera el borrador de un módulo nuevo a partir de una entrevista estructurada con el Director de área.
- **Vigilancia de vigencia:** automatización (n8n/Make) que revisa fechas de "próxima revisión" en el repositorio y notifica por Slack/email al dueño 15 días antes de vencer.
- **Dashboard de progreso:** sincronización automática del roadmap (`roadmap-modulos.md`) a un tablero Airtable/Notion con estado en tiempo real.
- **Publicación:** al aprobar un PR de un módulo en el repositorio, un webhook publica automáticamente la versión renderizada en la intranet/wiki.
- **Auditoría de estándar:** acción automatizada que corre el checklist de la sección 8 sobre cualquier documento nuevo antes de permitir el merge.

## 13. Prompts IA relacionados

1. *"Actúa como Arquitecto Empresarial de GAIOS. Usando la plantilla estándar de 15 secciones (`plantilla-estandar-documento.md`), genera el borrador completo del módulo **[nombre del módulo]** para una empresa B2B de [tamaño/industria]. Antes de escribir, hazme las preguntas mínimas necesarias para no inventar procesos."*
2. *"Audita el siguiente documento GAIOS contra el checklist de aceptación de la Arquitectura Maestra (sección 8) y dame una tabla de cumplimiento con gaps específicos."*
3. *"A partir de este SOP existente en Word/PDF sin estructura, conviértelo al estándar GAIOS de 15 secciones, sin inventar pasos que no estén en el original; señala explícitamente qué información falta."*
4. *"Compara dos alternativas de proceso para [tarea] usando criterios de Lean Six Sigma (tiempo, calidad, costo, variación) y recomienda una, justificando la elección."*
5. *"Dado el roadmap de módulos GAIOS, sugiere el orden óptimo de construcción de los próximos 3 módulos priorizando impacto en ventas y reducción de dependencia del Director General."*

## 14. Indicadores de éxito

A 6 meses de iniciada la construcción de GAIOS:
- El estándar de 15 secciones se aplica sin excepciones en el 100% de los módulos publicados.
- Al menos 4 módulos funcionales publicados y en uso activo (no solo escritos).
- Al menos 5 automatizaciones derivadas del manual corriendo en producción.
- Reducción medible y reportada de horas de dependencia del Director General.
- El manual es la primera fuente de consulta ante dudas operativas (medido por encuestas internas), por encima de "preguntarle al jefe".

## 15. Plan de mejora continua

- **Ciclo PDCA trimestral:** Plan (roadmap del trimestre) → Do (construcción/actualización de módulos) → Check (auditoría contra checklist y KPIs) → Act (ajuste del estándar o del roadmap).
- **Revisión obligatoria cada 6 meses** de este mismo documento de Arquitectura Maestra — es el documento que más impacto tiene si queda desactualizado.
- **Canal de retroalimentación continuo:** cualquier colaborador puede señalar un documento como "no aplica en la práctica"; entra a revisión en el siguiente comité mensual.
- **Benchmark externo anual:** revisar si nuevas prácticas (EOS, Scaling Up, ISO, IA) ameritan actualizar el estándar documental base.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP relacionado — Alta de nuevo módulo | `gaios/00-arquitectura-maestra/sop-alta-nuevo-modulo.md` |
| Plantilla estándar (15 secciones) | `gaios/00-arquitectura-maestra/plantilla-estandar-documento.md` |
| Checklist operativo de aceptación | `gaios/00-arquitectura-maestra/checklist-modulo0.md` |
| Prompts IA relacionados (ampliado) | `gaios/00-arquitectura-maestra/prompts-ia-modulo0.md` |
| Formulario / dashboard de KPIs | `gaios/00-arquitectura-maestra/kpis-dashboard.md` |
| Roadmap y dependencias de módulos | `gaios/roadmap/roadmap-modulos.md` |

**Próximos módulos dependientes:** todo módulo 1..N de GAIOS depende de este documento. El roadmap sugerido (`roadmap-modulos.md`) define el orden recomendado de construcción.
