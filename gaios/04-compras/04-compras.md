# GAIOS — Módulo 4: Compras / Cadena de Suministro

> El proceso Purchase‑to‑Pay estandarizado: de la requisición al pago, con segmentación de proveedores y control de tres vías como columna vertebral.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Director de Compras · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 3 — Operaciones/SOP (metodología DMAIC para mejora continua)

---

## 1. Objetivo

Estandarizar el proceso de compras (Purchase‑to‑Pay: requisición → cotización → orden de compra → recepción → factura → pago) usando segmentación de proveedores y control de tres vías, para reducir el costo total de adquisición, mitigar el riesgo de suministro, prevenir fraude y errores de pago, y **reducir la dependencia del Director de Compras** en la aprobación manual de cada compra rutinaria.

## 2. Alcance

**Incluye:** el proceso P2P completo, la segmentación de proveedores (Matriz de Kraljic), la evaluación y homologación de proveedores, la matriz de autorización de compras por monto, el control de tres vías (PO–Recepción–Factura).

**Excluye:** procesos de manufactura o producción interna; contabilidad general y tesorería (Módulo 6 — Finanzas, que recibe el pago ya autorizado); gestión detallada de inventario de almacén (módulo aparte si se requiere).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Matriz de Kraljic (Peter Kraljic, *Purchasing Must Become Supply Management*) | Segmentación de compras por impacto en el negocio vs. riesgo de suministro |
| Purchase‑to‑Pay (P2P) best practices | Estructura del flujo completo requisición → pago |
| Control de tres vías (three‑way match) | Control interno estándar para autorizar pagos a proveedores |
| Total Cost of Ownership (TCO) | Criterio de selección de proveedor más allá del precio de lista |
| ISO 9001 — gestión de proveedores | Evaluación y homologación periódica |
| Módulo 3 — Operaciones/SOP | Metodología DMAIC para mejorar el proceso de compras cuando se detecten errores recurrentes |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Director de Compras | Dueño del proceso, homologación de proveedores, aprueba compras mayores | X | X | | |
| Comprador (Buyer) | Ejecuta cotización, orden de compra, seguimiento | X | | | |
| Área solicitante | Genera la requisición y confirma la recepción | X | | | |
| CFO | Aprueba pagos fuera de umbral, controla el three‑way match | | X | X | |
| Director de Operaciones | Define especificaciones técnicas de insumos críticos | | | X | |
| Proveedor | Cumple la orden de compra bajo los términos acordados | | | | X |

## 5. Herramientas

- **Sistema P2P / módulo de compras del ERP:** SAP Ariba / Coupa / Procurify / módulo nativo del ERP.
- **Portal de proveedores** para cotizaciones y facturación electrónica.
- **Plantilla de RFQ (Request for Quotation).**
- **Scorecard de proveedores** para evaluación periódica.
- **Dashboard de spend analysis** por categoría y proveedor.

## 6. Procedimiento paso a paso

1. **Requisición:** el área solicitante genera la requisición con especificación técnica y justificación de negocio.
2. **Segmentación Kraljic:** clasificar el ítem/proveedor en el cuadrante correspondiente — No críticos (bajo impacto, bajo riesgo), Apalancados (alto impacto, bajo riesgo), Cuello de botella (bajo impacto, alto riesgo), Estratégicos (alto impacto, alto riesgo) — ver `sop-segmentacion-proveedores-kraljic.md`. El cuadrante determina el rigor del proceso siguiente.
3. **Sourcing:** para compras estratégicas o nuevas, cotizar con al menos 3 proveedores (RFQ, `sop-cotizacion-rfq.md`); para compras no críticas recurrentes, usar el catálogo de proveedores homologados sin re-cotizar cada vez.
4. **Selección y orden de compra:** seleccionar proveedor por Costo Total de Propiedad (TCO), no solo precio de lista; generar la orden de compra (PO) formal **antes** de recibir el bien o servicio — nunca después.
5. **Recepción:** el área solicitante confirma la recepción conforme (cantidad y calidad) contra la PO.
6. **Control de tres vías:** Compras/Finanzas concilia PO, recepción y factura antes de autorizar el pago (`sop-control-tres-vias.md`) — ninguna factura se paga sin las tres coincidencias.
7. **Pago** según los términos acordados con el proveedor.
8. **Evaluación periódica del proveedor:** scorecard de calidad, tiempo de entrega, servicio y precio, que alimenta la siguiente decisión de sourcing.

## 7. Diagrama de flujo (descrito en texto)

```
[Requisición del área solicitante] ──► [Segmentación Kraljic]
        │
        ▼
  ¿Estratégico o nuevo? ──Sí──► [RFQ: mínimo 3 cotizaciones]
        │ No (catálogo homologado)                │
        ▼                                          ▼
[Selección por TCO] ◄─────────────────────────────┘
        │
        ▼
[Orden de compra (PO) generada] ──► [Recepción conforme contra la PO]
        │
        ▼
[Factura del proveedor] ──► [Control de tres vías: PO + Recepción + Factura]
        │
        ▼
  ¿Coinciden las tres? ──No──► [Retener pago, investigar discrepancia]
        │ Sí
        ▼
[Autorizar pago] ──► [Evaluación periódica del proveedor (scorecard)]
```

## 8. Checklist operativo

- [ ] Toda requisición tiene justificación de negocio documentada.
- [ ] Todo ítem/proveedor tiene segmentación Kraljic asignada.
- [ ] Compras estratégicas o nuevas tienen mínimo 3 cotizaciones.
- [ ] Ninguna compra se recibe sin una orden de compra (PO) previa — cero "maverick spending".
- [ ] Ninguna factura se paga sin control de tres vías completo.
- [ ] Todo proveedor activo tiene evaluación de scorecard vigente (últimos 12 meses).
- [ ] Compras que exceden el umbral de autorización tienen aprobación del CFO documentada.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| Ahorro logrado | (Precio de referencia − precio negociado) × volumen | Reporte trimestral acumulado |
| % de compras con PO previa | Compras con PO antes de recepción / total de compras | 100% |
| Tiempo de ciclo de compra | Días desde requisición hasta orden de compra emitida | Reducción trimestral |
| % de proveedores evaluados | Proveedores con scorecard vigente / proveedores activos | 100% en 12 meses |
| Incidencias de calidad de proveedor | Nº de no conformidades de proveedor / total de órdenes | Decreciente |
| Cumplimiento de three‑way match | Pagos con match completo / total de pagos | 100% |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Compras sin PO previa ("maverick spending") | Alta | Alto |
| Fraude por falta de segregación de funciones (quien pide también aprueba y paga) | Baja | Alto |
| Dependencia de un único proveedor para insumos críticos (cuadrante estratégico) | Media | Alto |
| Pago de facturas sin control de tres vías completo | Media | Alto |
| Proveedores no evaluados que degradan calidad de forma silenciosa | Media | Medio |

## 11. Controles

- **Segregación de funciones:** quien solicita la compra no aprueba el pago, y quien aprueba el pago no es quien recibe la mercancía.
- **Matriz de autorización por monto:** umbrales claros de quién aprueba cada nivel de gasto (Comprador → Director de Compras → CFO → CEO según el monto).
- **Control de tres vías obligatorio** antes de cualquier pago a proveedor, sin excepción.
- **Auditoría trimestral de maverick spending:** compras sin PO detectadas y su causa raíz.
- **Plan de contingencia obligatorio** para todo proveedor en el cuadrante Estratégico o Cuello de botella (proveedor alterno identificado).

## 12. Automatizaciones posibles

- **PO automática** para compras recurrentes de proveedores homologados bajo un umbral definido.
- **Control de tres vías automatizado** en el ERP, con bloqueo de pago si no coincide.
- **Alertas de vencimiento** de contrato u homologación de proveedor antes de que expire.
- **Scorecard automático de proveedores** a partir de datos de recepción, incidencias y tiempos de entrega ya capturados en el sistema.
- **Spend analysis automático** por categoría y proveedor para identificar oportunidades de consolidación.

## 13. Prompts IA relacionados

1. *"Genera una RFQ (solicitud de cotización) para [ítem/servicio] con las especificaciones técnicas de esta requisición, lista para enviar a 3 proveedores potenciales."*
2. *"Compara estas 3 cotizaciones considerando no solo precio sino Costo Total de Propiedad (TCO: precio, tiempo de entrega, condiciones de pago, riesgo de calidad) y recomienda una, justificando la elección."*
3. *"Analiza este historial de gasto por categoría y proveedor de los últimos 12 meses y sugiere oportunidades de consolidación de proveedores o renegociación."*
4. *"Con estos datos de recepciones e incidencias del proveedor [nombre], genera el scorecard trimestral: calidad, tiempo de entrega, servicio, precio."*
5. *"Revisa este listado de compras del trimestre y señala cuáles se realizaron sin orden de compra previa (maverick spending), agrupando por causa probable."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de las compras tienen orden de compra previa a la recepción — cero maverick spending.
- 100% de los pagos a proveedores pasan por control de tres vías completo.
- Todos los proveedores activos tienen segmentación Kraljic y scorecard vigente.
- Ahorro acumulado reportado y verificable frente al precio de referencia histórico.
- El Director de Compras reporta menos tiempo dedicado a aprobar compras rutinarias de bajo riesgo.

## 15. Plan de mejora continua

- **Revisión trimestral de la segmentación Kraljic:** los proveedores pueden migrar de cuadrante si cambia el riesgo de suministro o el impacto en el negocio.
- **Revisión trimestral del catálogo de proveedores homologados**, incorporando resultados del scorecard.
- **Aplicación de la metodología DMAIC (Módulo 3)** cuando se detecten errores recurrentes en el proceso de compras (ej. discrepancias de three‑way match repetidas).
- **Revisión de este documento cada 6 meses**, o antes si cambia la política de autorización de compras.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Segmentación de proveedores (Matriz de Kraljic) | `gaios/04-compras/sop-segmentacion-proveedores-kraljic.md` |
| SOP — Cotización y RFQ | `gaios/04-compras/sop-cotizacion-rfq.md` |
| SOP — Control de tres vías (PO–Recepción–Factura) | `gaios/04-compras/sop-control-tres-vias.md` |
| Plantilla — Scorecard de proveedor | `gaios/04-compras/plantilla-scorecard-proveedor.md` |
| Checklist operativo de aceptación | `gaios/04-compras/checklist-modulo4.md` |
| Prompts IA relacionados (ampliado) | `gaios/04-compras/prompts-ia-modulo4.md` |
| Formulario / dashboard de KPIs de compras | `gaios/04-compras/kpis-dashboard-compras.md` |

**Próximos módulos dependientes:** Módulo 6 (Finanzas) consume el control de tres vías para ejecutar el pago; Módulo 12 (Calidad/Mejora Continua) puede aplicar DMAIC sobre incidencias recurrentes de proveedores detectadas en el scorecard.
