# SOP — Mapeo de Procesos (SIPOC)

**Versión:** 1.0 · **Dueño:** Director de Operaciones · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 3 — Operaciones/SOP

## 1. Objetivo
Levantar de forma consistente cualquier proceso operativo antes de intentar mejorarlo, evitando rediseñar procesos que nadie ha mapeado con precisión.

## 2. Alcance
Aplica como primer paso de todo proyecto DMAIC (fase Definir) y de todo módulo GAIOS que documente un proceso operativo nuevo. No aplica a procesos ya mapeados y vigentes (se actualiza solo si cambian).

## 3. Entradas
Entrevista con el dueño y los ejecutores del proceso; observación directa del proceso en operación si es posible.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Dueño del proceso | X | | | |
| Facilitador (Consultor Lean Six Sigma o Director de Operaciones) | X | X | | |

## 5. Herramientas
Miro / Lucidchart, plantilla SIPOC, entrevista estructurada.

## 6. Procedimiento paso a paso
1. Identificar el **Proceso** a mapear con nombre claro y límites definidos (dónde empieza, dónde termina).
2. Identificar las **Salidas** (Outputs): qué entrega el proceso y en qué forma.
3. Identificar los **Clientes**: quién recibe la salida, interno o externo.
4. Identificar las **Entradas** (Inputs): qué necesita el proceso para ejecutarse.
5. Identificar los **Proveedores** (Suppliers): de dónde vienen esas entradas.
6. Documentar los pasos intermedios del proceso a alto nivel (5-8 pasos, sin excesivo detalle en esta fase).
7. Validar el SIPOC completo con el dueño del proceso antes de avanzar a la fase Medir del DMAIC.

## 7. Diagrama de flujo (descrito en texto)
```
[Definir límites del proceso] → [Identificar Salidas] → [Identificar Clientes]
        │
        ▼
[Identificar Entradas] → [Identificar Proveedores]
        │
        ▼
[Documentar pasos intermedios a alto nivel] → [Validar con el dueño del proceso]
```

## 8. Checklist operativo
- [ ] Límites del proceso claramente definidos (inicio y fin).
- [ ] Salidas y clientes identificados sin ambigüedad.
- [ ] Entradas y proveedores identificados.
- [ ] Pasos intermedios documentados a alto nivel (no microscópico).
- [ ] Validado por el dueño del proceso.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de mapeo | Horas desde inicio hasta SIPOC validado | ≤ 4 horas por proceso |
| Procesos core mapeados | SIPOCs completos / procesos core identificados | 100% en 12 meses |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Mapeo hecho sin involucrar a quien ejecuta el proceso día a día | Media | Alto |
| Nivel de detalle excesivo que paraliza el avance a la fase Medir | Media | Medio |

## 11. Controles
El SIPOC se valida siempre con el ejecutor real del proceso, no solo con su jefe directo.

## 12. Automatizaciones posibles
Plantilla digital de SIPOC pre-cargada en Miro/Lucidchart; generación asistida por IA de un borrador de SIPOC a partir de la transcripción de la entrevista.

## 13. Prompts IA relacionados
1. *"Con esta transcripción de entrevista sobre el proceso de [nombre], construye un borrador de SIPOC identificando Proveedores, Entradas, Proceso, Salidas y Clientes."*
2. *"Revisa este SIPOC y señala si los límites del proceso están claramente definidos o si hay ambigüedad en dónde empieza o termina."*

## 14. Indicadores de éxito
100% de los proyectos DMAIC iniciados con SIPOC validado antes de pasar a la fase Medir.

## 15. Plan de mejora continua
Revisión de la plantilla SIPOC cada vez que se detecte fricción recurrente en su uso durante los proyectos DMAIC.
