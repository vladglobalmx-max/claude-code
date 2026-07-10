# SOP — Control de Tres Vías (PO – Recepción – Factura)

**Versión:** 1.0 · **Dueño:** Director de Compras (co-dueño: CFO) · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 4 — Compras

## 1. Objetivo
Garantizar que ningún pago a proveedor se autorice sin la coincidencia verificada entre lo ordenado (PO), lo recibido (Recepción) y lo facturado (Factura) — el control interno estándar contra fraude, error y sobrepago.

## 2. Alcance
Aplica a todo pago a proveedor originado en una orden de compra. No aplica a gastos menores sin PO bajo la política de caja chica, que sigue un proceso simplificado y separado.

## 3. Entradas
Orden de compra (PO) emitida; confirmación de recepción del área solicitante; factura del proveedor.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Comprador (Buyer) | X | | | |
| CFO / Cuentas por pagar | X | X | | |
| Área solicitante (confirma recepción) | X | | | |

## 5. Herramientas
Módulo de cuentas por pagar del ERP con validación de three-way match; portal de facturación electrónica del proveedor.

## 6. Procedimiento paso a paso
1. La PO se registra en el sistema al momento de emitirse, con cantidad, precio y condiciones acordadas.
2. El área solicitante confirma la recepción conforme (cantidad y calidad) contra la PO — sin esta confirmación, la factura no puede procesarse.
3. Al recibir la factura del proveedor, el sistema (o el analista de cuentas por pagar) compara automáticamente los tres documentos: PO, Recepción y Factura.
4. Si los tres coinciden en cantidad, precio y condiciones, se autoriza el pago según los términos acordados.
5. Si hay discrepancia, se retiene el pago y se investiga la causa (error de captura, entrega parcial, cambio de precio no autorizado) antes de resolver.
6. Toda discrepancia resuelta se documenta con la causa y la resolución, para detectar patrones recurrentes (candidatos a proyecto DMAIC del Módulo 3).

## 7. Diagrama de flujo (descrito en texto)
```
[PO emitida y registrada] ──► [Recepción confirmada por el área solicitante]
        │
        ▼
[Factura del proveedor recibida]
        │
        ▼
[Comparar PO + Recepción + Factura]
        │
        ▼
  ¿Coinciden las tres? ──No──► [Retener pago, investigar discrepancia] ──► [Documentar causa y resolución]
        │ Sí
        ▼
[Autorizar pago según términos acordados]
```

## 8. Checklist operativo
- [ ] Toda PO está registrada en el sistema antes de la recepción.
- [ ] Toda recepción está confirmada por el área solicitante antes de procesar la factura.
- [ ] Ninguna factura se paga sin coincidencia completa de las tres vías.
- [ ] Toda discrepancia tiene causa documentada, no solo "resuelta".
- [ ] Segregación de funciones respetada: quien recibe no es quien aprueba el pago.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Cumplimiento de three-way match | Pagos con match completo / total de pagos | 100% |
| Tasa de discrepancias | Facturas con discrepancia / total de facturas procesadas | Decreciente |
| Tiempo de resolución de discrepancias | Días desde detección hasta resolución | ≤ 5 días hábiles |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Pago autorizado sin control de tres vías completo (excepción no documentada) | Baja | Alto |
| Discrepancias recurrentes no analizadas como patrón | Media | Medio |

## 11. Controles
El sistema bloquea el pago si el three-way match no está completo — no es un control manual discrecional, es una regla del sistema.

## 12. Automatizaciones posibles
Three-way match 100% automatizado en el ERP con bloqueo de pago ante discrepancia; alerta automática al Comprador y al área solicitante cuando se detecta una discrepancia.

## 13. Prompts IA relacionados
1. *"Con este registro de discrepancias de three-way match del último trimestre, identifica los patrones más frecuentes y su causa probable."*
2. *"Redacta el resumen mensual de cumplimiento de control de tres vías para el CFO: % de match completo, discrepancias detectadas y tiempo de resolución."*

## 14. Indicadores de éxito
100% de cumplimiento del control de tres vías sostenido durante 2 trimestres consecutivos, sin excepciones no documentadas.

## 15. Plan de mejora continua
Si la tasa de discrepancias supera un umbral definido (ej. 5% de las facturas), se abre un proyecto DMAIC (Módulo 3) para identificar la causa raíz sistémica.
