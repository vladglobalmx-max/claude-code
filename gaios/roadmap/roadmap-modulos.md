# Roadmap y Mapa de Dependencias — Módulos GAIOS

> Todo módulo depende de **Módulo 0 — Arquitectura Maestra** (estándar documental, gobierno, checklist de aceptación). El orden numérico sugiere secuencia de construcción, priorizando impacto en ventas, reducción de errores y reducción de dependencia del Director General — no es un orden rígido.

| # | Módulo | Dueño funcional | Depende de | Estado | Impacto principal |
|---|---|---|---|---|---|
| 00 | Arquitectura Maestra | Arquitecto Empresarial | — | 🟢 Publicado | Fundacional |
| 01 | Comercial / CRM (ventas, pipeline, prospección) | Director Comercial | 00 | 🟢 Publicado | Incremento de ventas |
| 02 | Marketing (generación de demanda, contenido, branding) | Director de Marketing | 00, 01 | 🟢 Publicado | Incremento de ventas |
| 03 | Operaciones / SOPs core (Lean Six Sigma) | Director de Operaciones | 00 | 🟢 Publicado | Reducción de errores, productividad |
| 04 | Compras / Cadena de suministro | Director de Compras | 00, 03 | 🟢 Publicado | Reducción de costos y errores |
| 05 | Recursos Humanos (reclutamiento, onboarding, desempeño) | Director de RRHH | 00 | 🟢 Publicado | Escalabilidad, reducción dependencia CEO |
| 06 | Finanzas / Control (presupuesto, cobranza, reporting) | CFO | 00 | 🟢 Publicado | Reducción de errores, control |
| 07 | Tecnología / Infraestructura (stack, seguridad, integraciones) | Director de Tecnología | 00 | 🟢 Publicado | Habilita automatización de todos los módulos |
| 08 | Automatización e IA transversal | Chief AI Officer | 00, 07 | 🟢 Publicado | Reducción de trabajo repetitivo |
| 09 | Gestión del Conocimiento (SECI, biblioteca, onboarding de saber-hacer) | Especialista en Gestión del Conocimiento | 00, 05 | 🟢 Publicado | Reducción de dependencia de personas clave |
| 10 | Gobierno Corporativo / EOS (Accountability Chart, L10, Scorecard) | COO | 00 | 🟢 Publicado | Reducción de dependencia del CEO |
| 11 | Atención al Cliente / Servicio Postventa | Director Comercial | 00, 01 | ⚪ Planeado | Retención, reducción de errores |
| 12 | Calidad / Mejora Continua (Lean Six Sigma transversal) | Consultor Lean Six Sigma | 00, 03 | ⚪ Planeado | Reducción de errores |

**Leyenda de estado:** 🟢 Publicado · 🟡 En construcción · ⚪ Planeado · 🔴 Bloqueado.

## Criterio de priorización sugerido

Para decidir qué módulo construir después de completar el actual, evaluar cada candidato con:

| Criterio | Peso |
|---|---|
| Impacto en ventas | 30% |
| Reducción de errores/riesgo operativo | 25% |
| Reducción de dependencia del Director General | 25% |
| Facilidad de automatización | 20% |

## Regla de secuencia

No se inicia la construcción de un módulo nuevo hasta que el módulo actual esté "Publicado" según el checklist de aceptación de la Arquitectura Maestra (`00-arquitectura-maestra/checklist-modulo0.md`). Esto evita módulos a medias y mantiene la coherencia del sistema.
