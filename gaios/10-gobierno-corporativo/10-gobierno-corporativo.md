# GAIOS — Módulo 10: Gobierno Corporativo / EOS

> Accountability Chart, Scorecard semanal, Rocks trimestrales y la reunión L10 — el ritmo de ejecución que reemplaza la coordinación informal del CEO.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** COO (o CEO si el rol no existe) · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 5 — RRHH (Accountability Chart, GWC), Módulo 6 — Finanzas (reporting hacia el scorecard)

---

## 1. Objetivo

Estandarizar el ritmo de gobierno corporativo — Accountability Chart, reuniones semanales L10, scorecard de indicadores clave y prioridades trimestrales (Rocks) — para que la ejecución estratégica sea sistemática y visible, en lugar de depender de la memoria, el impulso o la disponibilidad del CEO, **reduciendo directamente su carga de coordinación** — el objetivo central de todo el sistema GAIOS.

## 2. Alcance

**Incluye:** Accountability Chart de funciones de dirección, ritmo semanal de reuniones (L10), Scorecard ejecutivo, definición y seguimiento de Rocks trimestrales, metodología IDS (Identificar-Discutir-Resolver) para problemas recurrentes.

**Excluye:** la ejecución operativa detallada de cada área (vive en su propio módulo); la planeación estratégica de largo plazo completa (Visión/Tracción a 1-3-10 años), que se referencia pero no se desarrolla a fondo en este documento.

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| EOS — *Traction* (Gino Wickman) | Accountability Chart, L10, Scorecard, Rocks, IDS |
| Rockefeller Habits / Scaling Up | Ritmo de cascada de prioridades (ya introducido en Módulo 0) |
| Módulo 5 — RRHH | Accountability Chart y modelo GWC ya definidos a nivel de rol |
| Módulo 6 — Finanzas | El reporting financiero alimenta el scorecard ejecutivo |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| COO (o CEO) | Dueño del ritmo, facilita la L10 | X | X | | |
| Cada Director de área | Dueño de sus Rocks y su parte del scorecard | X | | | |
| Arquitecto Empresarial | Vela por la coherencia con el resto de GAIOS | | | X | |
| CEO | Sponsor del Accountability Chart y la visión | | X | | |

## 5. Herramientas

- **Software EOS:** Ninety.io, o plantilla estructurada si la empresa es más pequeña.
- **Scorecard semanal** compartido y visible para el equipo de liderazgo.
- **Calendario de reuniones L10** con agenda fija.

## 6. Procedimiento paso a paso

1. **Accountability Chart:** definir las funciones (no personas) que la empresa necesita para operar, con un único responsable por función evaluado en GWC (Get it, Want it, Capacity to do it — Módulo 5).
2. **Rocks trimestrales:** cada Director define 3-5 prioridades del trimestre, alineadas al plan estratégico, con responsable único y fecha (`sop-rocks-trimestrales.md`).
3. **Scorecard semanal:** 5-15 números clave que dan el pulso de la empresa (no docenas de métricas vanidosas), alimentados en parte por el reporting del Módulo 6.
4. **Reunión L10 semanal** (90 minutos, agenda fija): segue, revisión del scorecard, revisión de rocks, headlines, IDS, conclusión (`sop-reunion-l10.md`).
5. **IDS (Identificar-Discutir-Resolver):** cuando surge un problema en la L10, se identifica con precisión, se discute a fondo una sola vez, y se resuelve con una acción concreta y un responsable — no se repite la misma discusión semana tras semana.
6. **Revisión trimestral:** evaluación de los rocks del trimestre anterior, ajuste del plan, definición de los rocks del siguiente trimestre.
7. **Revisión anual:** actualización del plan de Visión/Tracción (V/TO) a 1-3-10 años.

## 7. Diagrama de flujo (descrito en texto)

```
[Accountability Chart: funciones con GWC evaluado]
        │
        ▼
[Rocks trimestrales por Director] ──► [Scorecard semanal: 5-15 números clave]
        │
        ▼
[Reunión L10 semanal: segue → scorecard → rocks → headlines → IDS → conclusión]
        │
        ▼
  ¿Surge un problema en la reunión? ──Sí──► [IDS: Identificar → Discutir → Resolver con acción y responsable]
        │ No
        ▼
[Revisión trimestral de rocks] ──► [Definir rocks del siguiente trimestre]
        │
        ▼
[Revisión anual del V/TO]
```

## 8. Checklist operativo

- [ ] Accountability Chart vigente con GWC evaluado por función.
- [ ] Rocks trimestrales definidos con responsable único y fecha, no genéricos.
- [ ] Scorecard actualizado semanalmente antes de cada L10.
- [ ] L10 realizada con la agenda completa — sin saltarse el IDS.
- [ ] Problemas discutidos en IDS resueltos con acción y responsable documentados, no repetidos semana tras semana.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| % de Rocks completados a tiempo | Rocks cerrados en el trimestre / Rocks definidos | ≥ 80% |
| Cumplimiento de la cadencia de L10 | L10 realizadas / L10 programadas | 100% |
| % del scorecard en verde | Números dentro de meta / total de números del scorecard | ≥ 80% |
| Tiempo dedicado a IDS | % del tiempo de la L10 dedicado a resolver, no a reportar | ≥ 50% |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Reuniones que se vuelven actualización de status, sin resolver nada | Alta | Alto |
| Rocks definidos pero nunca revisados hasta el final del trimestre | Media | Alto |
| Scorecard con métricas vanidosas que no predicen el negocio | Media | Medio |
| Dependencia del CEO como único punto de decisión en la reunión | Media | Alto |

## 11. Controles

- La agenda de la L10 se audita: ¿se llegó al IDS?, ¿cuánto tiempo se dedicó a resolver vs. reportar?
- Revisión de rocks a mitad de trimestre, no solo al final.
- El scorecard se limita a 5-15 números — más que eso es señal de falta de foco.
- Ningún Rock se define sin responsable único y fecha concreta.

## 12. Automatizaciones posibles

- **Scorecard alimentado automáticamente** desde los dashboards de KPI de cada módulo (Comercial, Marketing, Finanzas, etc.).
- **Recordatorio automático de actualización** del scorecard antes de cada L10.
- **Tracking de Rocks con alertas** de riesgo de incumplimiento a mitad de trimestre.

## 13. Prompts IA relacionados

1. *"Ayúdame a definir los Rocks trimestrales del área de [área], alineados a esta prioridad estratégica [prioridad], con responsable único y fecha."*
2. *"Redacta la agenda de la próxima L10 con los temas IDS pendientes de la semana anterior, priorizados por impacto."*
3. *"Con este scorecard semanal, identifica qué números están fuera de meta y sintetiza un resumen ejecutivo de 3 líneas para el CEO."*
4. *"Facilita una sesión IDS sobre este problema [descripción]: ayúdame a definirlo con precisión antes de discutirlo, para no resolver el síntoma equivocado."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de cumplimiento de la cadencia de L10 semanal.
- ≥80% de los Rocks trimestrales completados a tiempo.
- ≥80% del scorecard en verde de forma sostenida.
- El CEO reporta una reducción medible del tiempo dedicado a coordinación informal entre áreas.

## 15. Plan de mejora continua

- **Revisión trimestral** de la relevancia de los números del scorecard — ¿siguen prediciendo el negocio?
- **Revisión anual** del Accountability Chart y del V/TO.
- **Revisión de este documento cada 6 meses.**
- **Retrospectiva de las L10:** cada trimestre, el equipo evalúa si las reuniones están resolviendo problemas reales o solo reportando estado.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Reunión L10 | `gaios/10-gobierno-corporativo/sop-reunion-l10.md` |
| SOP — Rocks trimestrales | `gaios/10-gobierno-corporativo/sop-rocks-trimestrales.md` |
| Plantilla — Accountability Chart | `gaios/10-gobierno-corporativo/plantilla-accountability-chart.md` |
| Checklist operativo de aceptación | `gaios/10-gobierno-corporativo/checklist-modulo10.md` |
| Prompts IA relacionados (ampliado) | `gaios/10-gobierno-corporativo/prompts-ia-modulo10.md` |
| Formulario / dashboard de scorecard ejecutivo | `gaios/10-gobierno-corporativo/kpis-dashboard-gobierno.md` |

**Próximos módulos dependientes:** todos los módulos alimentan el scorecard ejecutivo con sus propios KPIs; Módulo 12 (Calidad/Mejora Continua) puede usar el IDS como puerta de entrada a un proyecto DMAIC (Módulo 3) cuando un problema en la L10 resulta ser sistémico.
