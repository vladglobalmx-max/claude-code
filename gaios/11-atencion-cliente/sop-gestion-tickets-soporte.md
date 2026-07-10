# SOP — Gestión de Tickets de Soporte

**Versión:** 1.0 · **Dueño:** Director Comercial / Customer Success Manager · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 11 — Atención al Cliente

## 1. Objetivo
Resolver las solicitudes de soporte de forma predecible y a tiempo, evitando que la percepción de servicio dependa de qué agente atienda o de cuánta suerte tenga el cliente.

## 2. Alcance
Aplica a todo ticket de soporte de un cliente activo. No aplica a solicitudes comerciales (nuevas cotizaciones), que se enrutan a Ventas (Módulo 1).

## 3. Entradas
Ticket entrante (email, chat, portal); historial de la cuenta en el CRM (Módulo 1).

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Agente de soporte (Tier 1) | X | | | |
| Especialista técnico (Tier 2/3) | X | | | |
| Customer Success Manager | | X | | |

## 5. Herramientas
Sistema de tickets (Zendesk/Freshdesk/Intercom) con reglas de enrutamiento y SLA configurados.

## 6. Procedimiento paso a paso
1. El ticket entra al sistema y se clasifica automáticamente por tipo y severidad (crítica, alta, media, baja).
2. **Tier 1** atiende consultas básicas y problemas conocidos con solución documentada — objetivo: resolver sin escalar.
3. Si el problema requiere conocimiento técnico más profundo, se escala a **Tier 2**.
4. Si el problema es un defecto de producto o requiere desarrollo, se escala a **Tier 3** (producto/ingeniería).
5. Cada nivel tiene un SLA de primera respuesta y de resolución según la severidad.
6. Al resolver, se envía automáticamente una encuesta CSAT breve al cliente.
7. Tickets sin resolver dentro del SLA se escalan automáticamente al Customer Success Manager.

## 7. Diagrama de flujo (descrito en texto)
```
[Ticket entrante] → [Clasificación automática: tipo y severidad]
        │
        ▼
[Tier 1: consultas básicas] → ¿Resuelto? --Sí--> [CSAT automático]
        │ No
        ▼
[Tier 2: problema técnico] → ¿Resuelto? --Sí--> [CSAT automático]
        │ No
        ▼
[Tier 3: producto/ingeniería] → [Resolución] → [CSAT automático]
        │
        ▼
¿SLA excedido en cualquier nivel? --Sí--> [Escalamiento automático a Customer Success Manager]
```

## 8. Checklist operativo
- [ ] Todo ticket clasificado por tipo y severidad al ingresar.
- [ ] SLA de primera respuesta cumplido según severidad.
- [ ] Intento de resolución en Tier 1 antes de escalar, salvo urgencia crítica.
- [ ] CSAT enviado automáticamente al resolver.
- [ ] Tickets fuera de SLA escalados automáticamente.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| Tiempo de primera respuesta | Minutos/horas por severidad | Según SLA |
| Tasa de resolución en Tier 1 | Resueltos sin escalar / total | ≥ 70% |
| CSAT | % de calificaciones satisfactorias | ≥ 90% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Tickets críticos sin escalamiento oportuno | Baja | Alto |
| Sobre-escalamiento a Tier 2/3 por falta de documentación en Tier 1 | Media | Medio |

## 11. Controles
El sistema escala automáticamente cualquier ticket que exceda el SLA de su severidad, sin depender de que un agente lo note manualmente.

## 12. Automatizaciones posibles
Enrutamiento automático por tipo/severidad; encuestas CSAT automáticas; base de soluciones conocidas sugeridas automáticamente al agente de Tier 1.

## 13. Prompts IA relacionados
1. *"Redacta una respuesta a este ticket de soporte [descripción del problema], con tono empático, solución clara y próximos pasos concretos."*
2. *"Con este historial de tickets, identifica los problemas más recurrentes en Tier 1 que podrían documentarse como solución conocida para reducir escalamientos."*

## 14. Indicadores de éxito
CSAT ≥90% y tasa de resolución en Tier 1 ≥70%, sostenido durante 2 trimestres consecutivos.

## 15. Plan de mejora continua
Aplicar DMAIC (Módulo 3) si un tipo de ticket se vuelve recurrente y señala un problema sistémico de producto u operación.
