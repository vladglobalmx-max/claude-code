# GAIOS — Módulo 8: Automatización e IA Transversal

> El backlog único de automatizaciones que nace de la sección 12 de cada módulo GAIOS, priorizado, gobernado y monitoreado como un sistema — no como scripts sueltos que nadie más entiende.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Chief AI Officer · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 7 — Tecnología/Infraestructura

---

## 1. Objetivo

Estandarizar cómo se identifican, priorizan, construyen, gobiernan y mantienen las automatizaciones y los casos de uso de IA en todos los módulos de GAIOS, para maximizar la reducción de trabajo repetitivo sin introducir riesgo no controlado (errores silenciosos, decisiones automatizadas sin supervisión donde se necesita, dependencia frágil de una sola persona que entiende cómo funciona una automatización crítica).

## 2. Alcance

**Incluye:** el framework de priorización de automatizaciones (valor vs. factibilidad), la decisión build vs. buy, el gobierno de IA (human-in-the-loop en casos de alto riesgo), el proceso de construcción, documentación y monitoreo de automatizaciones activas.

**Excluye:** la infraestructura técnica subyacente, que vive en el Módulo 7; el contenido específico de cada automatización de área, que se documenta en la sección 12 del módulo correspondiente (ej. el lead scoring vive en el Módulo 2, no aquí).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Matriz valor vs. factibilidad (análoga a Kraljic/Eisenhower) | Priorización del backlog de automatizaciones |
| RPA/iPaaS governance best practices | Gobierno de automatizaciones a escala |
| Principios de IA responsable (human-in-the-loop, explicabilidad) | Salvaguardas para automatizaciones de alto riesgo |
| Sección 12 ("Automatizaciones posibles") de cada módulo GAIOS 0-7 | Fuente primaria del backlog — no se inventan automatizaciones nuevas por fuera de lo que cada módulo ya identificó como necesidad real |
| Módulo 7 — Tecnología | Infraestructura, catálogo de integraciones y stack de automatización (n8n/Make/Zapier) |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Chief AI Officer | Dueño del proceso, prioriza el backlog, gobierna el uso de IA | X | X | | |
| Director de Tecnología | Infraestructura y viabilidad técnica | | | X | |
| Dueño del proceso automatizado (cada área) | Valida que la automatización resuelve el problema real | | | X | |
| Todo colaborador | Usuario o beneficiario de la automatización | | | | X |

## 5. Herramientas

- **Backlog de automatizaciones:** Airtable / Notion / Linear.
- **iPaaS:** n8n / Make / Zapier (Módulo 7).
- **IA generativa:** Claude, para asistir en el diseño, construcción y documentación de automatizaciones.
- **Dashboard de salud de automatizaciones:** tasa de error, última ejecución exitosa.

## 6. Procedimiento paso a paso

1. **Recolectar candidatos:** cada módulo GAIOS ya declara "automatizaciones posibles" en su sección 12; se consolidan en un backlog único (`plantilla-ficha-automatizacion.md`).
2. **Priorizar** por la matriz valor (reducción de trabajo repetitivo/error) vs. factibilidad (complejidad técnica y riesgo) — ver `sop-priorizacion-automatizaciones.md`.
3. **Decisión build vs. buy:** ¿ya existe una herramienta en el stack (Módulo 7) que resuelve esto, o se requiere construir/integrar algo nuevo?
4. **Diseño con gobierno de IA:** para automatizaciones de alto riesgo (decisiones financieras, de contratación, legales), se define el punto de human-in-the-loop obligatorio — la IA asiste, no decide sola (`sop-gobierno-ia-human-in-the-loop.md`).
5. **Construcción y piloto** con el dueño del proceso, antes de escalar a producción.
6. **Despliegue con documentación completa:** qué hace, qué la dispara, qué monitorea, quién es responsable de mantenerla.
7. **Monitoreo continuo** de la tasa de error/excepciones de cada automatización activa.
8. **Registro en el catálogo de automatizaciones activas**, junto al catálogo de integraciones del Módulo 7.

## 7. Diagrama de flujo (descrito en texto)

```
[Sección 12 de cada módulo GAIOS] ──► [Backlog único de automatizaciones]
        │
        ▼
[Priorización: valor vs. factibilidad]
        │
        ▼
  ¿Build o buy? ──Buy──► [Configurar herramienta existente del stack]
        │ Build
        ▼
  ¿Alto riesgo (financiero/legal/contratación)? ──Sí──► [Definir human-in-the-loop obligatorio]
        │ No
        ▼
[Construcción y piloto con el dueño del proceso]
        │
        ▼
  ¿Piloto validado? ──No──► [Ajustar diseño]
        │ Sí
        ▼
[Despliegue con documentación de mantenimiento]
        │
        ▼
[Monitoreo continuo de tasa de error] ──► [Registro en catálogo de automatizaciones activas]
```

## 8. Checklist operativo

- [ ] Toda automatización nace de la sección 12 de un módulo GAIOS existente, no se inventa fuera de contexto.
- [ ] Automatización priorizada por la matriz valor-factibilidad, no por preferencia individual.
- [ ] Decisión build vs. buy documentada antes de construir.
- [ ] Automatizaciones de alto riesgo tienen human-in-the-loop definido explícitamente.
- [ ] Piloto validado por el dueño del proceso antes de escalar.
- [ ] Documentación de mantenimiento completa (qué hace, qué dispara, responsable).
- [ ] Automatización registrada en el catálogo activo con monitoreo asignado.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Automatizaciones activas | Nº en producción con monitoreo vigente | Creciente trimestre a trimestre |
| Horas ahorradas estimadas | Suma de horas/mes ahorradas por automatización activa | Reporte trimestral acumulado |
| Tasa de error de automatizaciones | Ejecuciones con error / total de ejecuciones | ≤ 2% |
| % de alto riesgo con human-in-the-loop | Automatizaciones de alto riesgo con control humano / total de alto riesgo | 100% |
| Tiempo de construcción promedio | Días desde priorización hasta despliegue | Reducción sostenida |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Automatizar un proceso mal diseñado — se automatiza el caos, no se resuelve | Media | Alto |
| Falta de monitoreo — un error silencioso se acumula sin que nadie lo note | Media | Alto |
| Automatización de alto riesgo sin supervisión humana adecuada | Baja | Alto |
| Dependencia de una sola persona que entiende cómo funciona una automatización crítica ("bus factor") | Media | Alto |
| Sobre-automatización prematura de un proceso aún inestable (contradice Módulo 3) | Media | Medio |

## 11. Controles

- Ninguna automatización se prioriza sin haber pasado primero por la fase Mejorar del DMAIC (Módulo 3) si el proceso base era inestable — no se automatiza el caos.
- Ninguna automatización de alto riesgo se despliega sin human-in-the-loop documentado.
- Documentación de mantenimiento obligatoria antes de considerar una automatización "completa" — mitiga el bus factor.
- Revisión periódica de la tasa de error de cada automatización activa por el Chief AI Officer.

## 12. Automatizaciones posibles

- **Dashboard de salud de automatizaciones:** tasa de error, última ejecución exitosa, tiempo de respuesta.
- **Alertas automáticas** cuando una automatización falla repetidamente (ej. 3 fallos consecutivos).
- **Sincronización automática del backlog** con la sección 12 de cada módulo GAIOS al publicarse o actualizarse.

## 13. Prompts IA relacionados

1. *"Evalúa esta automatización candidata usando la matriz valor-factibilidad: ¿qué tan repetitivo/propenso a error es el proceso actual, y qué tan compleja es la implementación técnica?"*
2. *"Diseña el flujo de esta automatización [descripción], señalando en qué punto debería haber intervención humana obligatoria si el proceso involucra una decisión financiera o de contratación."*
3. *"Genera la documentación de mantenimiento de esta automatización: qué hace, qué la dispara, qué sistemas toca, y qué debería revisar alguien nuevo que la herede."*
4. *"Con este registro de ejecuciones de la automatización [nombre], analiza la tasa de error y sugiere la causa raíz más probable."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- Al menos 8 automatizaciones activas provenientes del backlog consolidado de los módulos 0-7.
- Tasa de error de automatizaciones activas ≤2%.
- 100% de las automatizaciones de alto riesgo con human-in-the-loop documentado y verificado.
- Cero automatizaciones críticas dependientes del conocimiento exclusivo de una sola persona.

## 15. Plan de mejora continua

- **Revisión mensual** del backlog de automatizaciones y su priorización.
- **Revisión trimestral** de la tasa de error y del catálogo de automatizaciones activas.
- **Revisión de este documento cada 6 meses**, incorporando nuevas prácticas de gobierno de IA si el panorama regulatorio o tecnológico cambia.
- **Aplicación de DMAIC (Módulo 3)** cuando una automatización activa muestre una tasa de error sostenida fuera de meta.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Priorización de automatizaciones | `gaios/08-automatizacion-ia/sop-priorizacion-automatizaciones.md` |
| SOP — Gobierno de IA (human-in-the-loop) | `gaios/08-automatizacion-ia/sop-gobierno-ia-human-in-the-loop.md` |
| Plantilla — Ficha de automatización | `gaios/08-automatizacion-ia/plantilla-ficha-automatizacion.md` |
| Checklist operativo de aceptación | `gaios/08-automatizacion-ia/checklist-modulo8.md` |
| Prompts IA relacionados (ampliado) | `gaios/08-automatizacion-ia/prompts-ia-modulo8.md` |
| Formulario / dashboard de KPIs de automatización | `gaios/08-automatizacion-ia/kpis-dashboard-automatizacion.md` |

**Próximos módulos dependientes:** todos los módulos futuros de GAIOS alimentan su sección 12 a este backlog; Módulo 9 (Gestión del Conocimiento) documenta el saber-hacer detrás de cada automatización para mitigar el bus factor.
