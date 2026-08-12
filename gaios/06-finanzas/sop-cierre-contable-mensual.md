# SOP — Cierre Contable Mensual

**Versión:** 1.0 · **Dueño:** CFO · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 6 — Finanzas

## 1. Objetivo
Cerrar la contabilidad de cada mes de forma disciplinada y en un plazo fijo, para que la información financiera esté disponible a tiempo para decisiones, no semanas después de que dejó de ser útil.

## 2. Alcance
Aplica al cierre mensual de todas las cuentas contables de la empresa. No aplica al cierre fiscal anual, que sigue un calendario y proceso definido por la asesoría fiscal.

## 3. Entradas
Movimientos bancarios del mes; facturas emitidas y recibidas; nómina procesada; control de tres vías del Módulo 4 ya conciliado.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Contador / Analista financiero | X | | | |
| CFO | | X | | |

## 5. Herramientas
ERP/sistema contable; checklist de cierre estandarizado; herramienta de conciliación bancaria.

## 6. Procedimiento paso a paso
1. Conciliación bancaria de todas las cuentas de la empresa.
2. Registro de devengos (ingresos y gastos del periodo no facturados/pagados aún).
3. Conciliación de cuentas por pagar (con el control de tres vías del Módulo 4) y cuentas por cobrar (con el aging del ciclo de cobranza).
4. Revisión de partidas inusuales o de monto significativo por el CFO.
5. Cierre del periodo en el sistema contable — bloqueo de nuevos movimientos al periodo cerrado.
6. Generación de los estados financieros del periodo (P&L, balance, flujo de caja).
7. El cierre debe completarse dentro de un plazo fijo (ej. día 5 hábil del mes siguiente) para alimentar el reporting a tiempo.

## 7. Diagrama de flujo (descrito en texto)
```
[Conciliación bancaria] → [Registro de devengos]
        │
        ▼
[Conciliación de CxP (Módulo 4) y CxC (ciclo de cobranza)]
        │
        ▼
[Revisión de partidas inusuales por el CFO]
        │
        ▼
[Cierre del periodo — bloqueo de movimientos]
        │
        ▼
[Generación de estados financieros] → [Alimenta el reporting mensual]
```

## 8. Checklist operativo
- [ ] Conciliación bancaria completa de todas las cuentas.
- [ ] Devengos registrados para el periodo.
- [ ] CxP y CxC conciliadas contra los módulos de origen (Compras, Cobranza).
- [ ] Partidas inusuales revisadas y explicadas por el CFO.
- [ ] Cierre completado dentro del plazo fijo establecido.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de cierre | Días hábiles desde fin de mes hasta cierre | ≤ 5 días hábiles |
| Ajustes post-cierre | Nº de correcciones a un periodo ya cerrado | Decreciente, idealmente 0 |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Cierre retrasado que atrasa el reporting a la dirección | Media | Alto |
| Ajustes frecuentes a periodos ya cerrados (señal de proceso débil) | Media | Medio |

## 11. Controles
El CFO audita el checklist de cierre antes de declarar el periodo oficialmente cerrado; el sistema bloquea nuevos movimientos al periodo una vez cerrado, salvo reapertura formal aprobada.

## 12. Automatizaciones posibles
Conciliación bancaria automatizada vía feed directo del banco; checklist de cierre con estado en tiempo real visible para el CFO; generación automática de los estados financieros al completar el checklist.

## 13. Prompts IA relacionados
1. *"Revisa este listado de movimientos del mes y señala partidas inusuales por monto o naturaleza que ameriten revisión antes del cierre."*
2. *"Con este checklist de cierre parcialmente completado, identifica qué pasos faltan y cuáles son bloqueantes para cerrar a tiempo."*

## 14. Indicadores de éxito
Cierre contable completado dentro de 5 días hábiles, sin ajustes posteriores significativos, durante 3 meses consecutivos.

## 15. Plan de mejora continua
Aplicar DMAIC (Módulo 3) si el tiempo de cierre se deteriora de forma sostenida, para identificar el cuello de botella específico del proceso.
