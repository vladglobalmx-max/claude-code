# SOP — Cotización y RFQ (Request for Quotation)

**Versión:** 1.0 · **Dueño:** Director de Compras · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 4 — Compras

## 1. Objetivo
Garantizar que toda compra estratégica o nueva se cotice de forma competitiva y comparable, evitando decisiones de proveedor basadas en una sola opción o en relaciones informales.

## 2. Alcance
Aplica a compras del cuadrante Estratégico o Apalancado de la Matriz de Kraljic, y a cualquier compra nueva sin proveedor homologado previo. No aplica a compras del catálogo homologado en el cuadrante No crítico.

## 3. Entradas
Requisición con especificación técnica; segmentación Kraljic del ítem; lista de proveedores potenciales.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Comprador (Buyer) | X | | | |
| Director de Compras | | X | | |
| Área solicitante (especificación técnica) | | | X | |

## 5. Herramientas
Plantilla de RFQ estandarizada; portal de proveedores; tabla comparativa de cotizaciones.

## 6. Procedimiento paso a paso
1. Redactar la RFQ con especificación técnica clara, cantidad, plazo de entrega requerido y criterios de evaluación.
2. Enviar la RFQ a un mínimo de 3 proveedores potenciales (más si el ítem es del cuadrante Estratégico).
3. Establecer una fecha límite de respuesta igual para todos los proveedores (proceso justo y comparable).
4. Recibir las cotizaciones y construir la tabla comparativa por Costo Total de Propiedad (TCO): precio, tiempo de entrega, condiciones de pago, garantía, riesgo de calidad.
5. Seleccionar al proveedor ganador con justificación documentada — nunca solo "el más barato" sin considerar TCO.
6. Comunicar la decisión a todos los proveedores participantes (transparencia que sostiene relaciones futuras).
7. Generar la orden de compra formal con el proveedor seleccionado.

## 7. Diagrama de flujo (descrito en texto)
```
[Requisición + segmentación Kraljic] → ¿Requiere RFQ? --No (catálogo homologado)--> [Comprar directo]
        │ Sí
        ▼
[Redactar RFQ con especificación y criterios] → [Enviar a mínimo 3 proveedores]
        │
        ▼
[Recibir cotizaciones antes de la fecha límite] → [Tabla comparativa por TCO]
        │
        ▼
[Seleccionar proveedor con justificación documentada] → [Comunicar decisión a todos] → [Generar PO]
```

## 8. Checklist operativo
- [ ] RFQ enviada a mínimo 3 proveedores para compras estratégicas o nuevas.
- [ ] Fecha límite de respuesta igual para todos los proveedores.
- [ ] Comparación hecha por TCO, no solo por precio de lista.
- [ ] Justificación de la selección documentada en el sistema.
- [ ] Proveedores no seleccionados notificados de la decisión.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de compras estratégicas con RFQ completa | RFQs con ≥3 cotizaciones / compras estratégicas del periodo | 100% |
| Tiempo de ciclo de RFQ | Días desde envío hasta selección | ≤ 10 días hábiles |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| RFQ enviada a un solo proveedor "de confianza", sin comparación real | Media | Alto |
| Selección basada solo en precio, ignorando riesgo de calidad o entrega | Media | Alto |

## 11. Controles
Ninguna orden de compra estratégica se emite sin evidencia de al menos 3 cotizaciones comparadas por TCO, salvo excepción documentada y aprobada por el Director de Compras (ej. proveedor único certificado).

## 12. Automatizaciones posibles
Envío automático de RFQ a la lista de proveedores homologados de la categoría; tabla comparativa de TCO generada automáticamente a partir de las cotizaciones cargadas al sistema.

## 13. Prompts IA relacionados
1. *"Genera una RFQ para [ítem/servicio] con las especificaciones técnicas de esta requisición, lista para enviar a proveedores potenciales."*
2. *"Compara estas 3 cotizaciones considerando Costo Total de Propiedad (TCO) y recomienda una, justificando la elección más allá del precio de lista."*

## 14. Indicadores de éxito
100% de compras estratégicas o nuevas con proceso de RFQ completo y documentado, verificado en la auditoría trimestral.

## 15. Plan de mejora continua
Revisión semestral del tiempo de ciclo de RFQ y de la tasa de participación de proveedores, ajustando la plantilla o el proceso si hay fricción recurrente.
