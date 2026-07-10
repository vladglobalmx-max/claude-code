# SOP — Gestión del Ciclo de Vida de Campañas

**Versión:** 1.0 · **Dueño:** Director de Marketing · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 2 — Marketing

## 1. Objetivo
Estandarizar el lanzamiento, seguimiento y cierre de campañas de marketing, garantizando que toda inversión sea medible y que el aprendizaje de cada campaña se capitalice en la siguiente.

## 2. Alcance
Aplica a toda campaña paga u orgánica con presupuesto o esfuerzo dedicado (ads, email marketing, webinars, eventos). No aplica a publicaciones orgánicas rutinarias de bajo esfuerzo (ver `sop-generacion-contenido.md`).

## 3. Entradas
Calendario trimestral de campañas; presupuesto de marketing aprobado; ICP y buyer personas (Módulo 1).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Growth/Content Marketer | X | | | |
| Director de Marketing | | X | | |
| CFO (si excede umbral de presupuesto) | | X | | |

## 5. Herramientas
Ads Manager (LinkedIn/Google), marketing automation, plantilla de brief de campaña, dashboard de atribución.

## 6. Procedimiento paso a paso
1. Completar el brief de campaña (`plantilla-brief-campana.md`): objetivo, audiencia, presupuesto, canales, KPI de éxito.
2. Aprobación del brief por el Director de Marketing; si el presupuesto excede el umbral definido, aprobación adicional del CFO.
3. Configurar tracking (UTM, pixel de conversión) antes del lanzamiento — nunca después.
4. Lanzar la campaña según el calendario aprobado.
5. Revisión a medio camino (mid-campaign check): ¿el gasto y el ritmo de leads están en línea con el brief? Ajustar segmentación o creativos si no.
6. Cierre de campaña: reporte final con CPL, MQLs generados, conversión a SQL y ROI estimado.
7. Archivar el aprendizaje (qué funcionó, qué no) en el repositorio de campañas para informar la planeación del siguiente trimestre.

## 7. Diagrama de flujo (descrito en texto)
```
[Brief de campaña] → ¿Excede umbral de presupuesto? --Sí--> [Aprobación CFO]
        │ No / Aprobado
        ▼
[Configurar tracking (UTM, pixel)] → [Lanzamiento]
        │
        ▼
[Revisión a medio camino] → ¿En línea con el brief? --No--> [Ajustar segmentación/creativos]
        │ Sí
        ▼
[Cierre: reporte de CPL, MQLs, conversión, ROI] → [Archivar aprendizaje]
```

## 8. Checklist operativo
- [ ] Brief de campaña aprobado antes del lanzamiento.
- [ ] Tracking configurado y validado antes del lanzamiento (no después).
- [ ] Revisión a medio camino realizada y documentada.
- [ ] Reporte de cierre completado con KPI reales vs. meta del brief.
- [ ] Aprendizaje archivado para la siguiente planeación.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Cumplimiento de presupuesto | Gasto real / presupuesto aprobado | 90-110% |
| Campañas con reporte de cierre | Campañas cerradas con reporte / total de campañas | 100% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Campaña lanzada sin tracking correcto → datos irrecuperables | Media | Alto |
| Presupuesto excedido sin aprobación | Baja | Alto |

## 11. Controles
Ninguna campaña se lanza sin brief aprobado y tracking validado; el gasto se audita semanalmente contra el presupuesto del brief.

## 12. Automatizaciones posibles
Validación automática de UTM antes de permitir la publicación del anuncio; alertas de gasto cuando la campaña alcanza 80% del presupuesto aprobado; generación automática del reporte de cierre desde el dashboard de atribución.

## 13. Prompts IA relacionados
1. *"Completa un brief de campaña para [objetivo] dirigido a [ICP/persona], sugiriendo canales, presupuesto estimado y KPI de éxito basados en benchmarks B2B."*
2. *"Con este dashboard de campaña a medio camino, evalúa si el ritmo de gasto y de leads está en línea con la meta y sugiere ajustes."*

## 14. Indicadores de éxito
100% de campañas con brief aprobado, tracking validado y reporte de cierre, sostenido durante 2 trimestres.

## 15. Plan de mejora continua
Revisión trimestral del repositorio de aprendizajes de campañas para identificar patrones de qué canales/creativos funcionan mejor por segmento de ICP.
