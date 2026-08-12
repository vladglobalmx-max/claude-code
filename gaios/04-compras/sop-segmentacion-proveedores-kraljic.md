# SOP — Segmentación de Proveedores (Matriz de Kraljic)

**Versión:** 1.0 · **Dueño:** Director de Compras · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 4 — Compras

## 1. Objetivo
Clasificar cada ítem/proveedor según su impacto en el negocio y el riesgo de suministro, para aplicar el nivel correcto de rigor en el proceso de compra — ni sobreproceso en compras triviales, ni subproceso en compras críticas.

## 2. Alcance
Aplica a todo ítem o servicio comprado de forma recurrente. No aplica a compras únicas de muy bajo monto (gasto menor operativo), que siguen un proceso simplificado.

## 3. Entradas
Historial de compras por categoría; volumen y valor anual por ítem; número de proveedores disponibles en el mercado para cada ítem.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Director de Compras | X | X | | |
| Comprador (Buyer) | X | | | |

## 5. Herramientas
Matriz de Kraljic (2x2: impacto en el negocio vs. riesgo de suministro), hoja de cálculo o módulo de categorización del ERP.

## 6. Procedimiento paso a paso
1. Listar todos los ítems/proveedores comprados de forma recurrente.
2. Evaluar el **impacto en el negocio** de cada ítem (costo, criticidad para la operación, efecto en el resultado financiero).
3. Evaluar el **riesgo de suministro** de cada ítem (número de proveedores disponibles, complejidad técnica, tiempo de entrega, barreras de entrada).
4. Ubicar cada ítem en uno de los 4 cuadrantes:
   - **No críticos** (bajo impacto, bajo riesgo): simplificar el proceso, comprar por catálogo.
   - **Apalancados** (alto impacto, bajo riesgo): negociar agresivamente, múltiples proveedores disponibles.
   - **Cuello de botella** (bajo impacto, alto riesgo): asegurar el suministro, buscar proveedores alternos aunque el costo no sea prioritario.
   - **Estratégicos** (alto impacto, alto riesgo): relación de largo plazo, plan de contingencia obligatorio, involucramiento del Director de Compras.
5. Asignar el nivel de rigor del proceso de compra según el cuadrante (ver tabla en la sección 9 del Módulo 4).
6. Revisar la segmentación trimestralmente — un ítem puede migrar de cuadrante si cambian las condiciones de mercado.

## 7. Diagrama de flujo (descrito en texto)
```
[Listar ítems/proveedores recurrentes]
        │
        ▼
[Evaluar impacto en el negocio] × [Evaluar riesgo de suministro]
        │
        ▼
[Ubicar en cuadrante: No crítico / Apalancado / Cuello de botella / Estratégico]
        │
        ▼
[Asignar nivel de rigor del proceso de compra]
        │
        ▼
[Revisión trimestral — posible migración de cuadrante]
```

## 8. Checklist operativo
- [ ] Todo ítem recurrente tiene cuadrante Kraljic asignado.
- [ ] Los ítems del cuadrante Estratégico tienen plan de contingencia documentado.
- [ ] Los ítems del cuadrante Cuello de botella tienen al menos un proveedor alterno identificado.
- [ ] La segmentación se revisó en el último trimestre.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de ítems recurrentes segmentados | Ítems con cuadrante asignado / total recurrentes | 100% |
| Ítems estratégicos con plan de contingencia | Con plan / total en cuadrante Estratégico | 100% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Ítem estratégico sin plan de contingencia — riesgo de desabasto | Media | Alto |
| Segmentación desactualizada que ya no refleja el mercado real | Media | Medio |

## 11. Controles
Ningún ítem del cuadrante Estratégico o Cuello de botella se aprueba con un solo proveedor sin plan de contingencia documentado.

## 12. Automatizaciones posibles
Cálculo semi-automático del cuadrante a partir de reglas (volumen de gasto, número de proveedores en el mercado) con validación humana final.

## 13. Prompts IA relacionados
1. *"Con este historial de compras por categoría de los últimos 12 meses, sugiere una segmentación Kraljic preliminar (impacto en el negocio vs. riesgo de suministro) para cada categoría."*
2. *"Para este ítem clasificado como Estratégico, sugiere qué elementos debería incluir el plan de contingencia (proveedor alterno, inventario de seguridad, contrato de largo plazo)."*

## 14. Indicadores de éxito
100% de los ítems recurrentes segmentados y con el nivel de rigor de compra correspondiente aplicado, verificado en la auditoría trimestral.

## 15. Plan de mejora continua
Revisión trimestral de la segmentación completa, incorporando cambios en el mercado de proveedores o en la criticidad del ítem para el negocio.
