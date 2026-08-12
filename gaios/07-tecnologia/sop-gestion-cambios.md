# SOP — Gestión de Cambios

**Versión:** 1.0 · **Dueño:** Director de Tecnología · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 7 — Tecnología

## 1. Objetivo
Evitar que cambios no controlados a sistemas de producción generen interrupciones inesperadas del negocio, asegurando que todo cambio significativo tenga aprobación, ventana programada y plan de reversión.

## 2. Alcance
Aplica a todo cambio significativo en sistemas de producción (CRM, ERP, sitio web, integraciones críticas). No aplica a configuraciones menores sin impacto en otros usuarios (ej. preferencias personales).

## 3. Entradas
Solicitud de cambio con descripción, sistema afectado y urgencia; catálogo de integraciones activas (`plantilla-catalogo-integraciones.md`) para evaluar impacto en cascada.

## 4. Responsables
| Rol | R | A | C | I |
|---|:-:|:-:|:-:|:-:|
| Solicitante del cambio | X | | | |
| Director de Tecnología | | X | | |
| Usuarios afectados por el sistema | | | X | |

## 5. Herramientas
Sistema de tickets de TI con flujo de aprobación; calendario de ventanas de cambio.

## 6. Procedimiento paso a paso
1. Registrar la solicitud de cambio: qué se cambia, por qué, qué sistemas y usuarios se ven afectados.
2. Evaluar el impacto en cascada usando el catálogo de integraciones — un cambio en un sistema puede romper una integración con otro.
3. Definir la ventana de cambio (fecha/hora de menor impacto operativo) y comunicarla a los usuarios afectados con anticipación.
4. Documentar el plan de rollback: cómo revertir el cambio si algo falla, antes de ejecutar el cambio.
5. Ejecutar el cambio dentro de la ventana aprobada.
6. Verificar que el cambio funcionó como se esperaba y que las integraciones relacionadas siguen operando.
7. Si el cambio falla, ejecutar el rollback documentado y registrar la causa para análisis posterior.

## 7. Diagrama de flujo (descrito en texto)
```
[Solicitud de cambio] → [Evaluar impacto en cascada (catálogo de integraciones)]
        │
        ▼
[Definir ventana de cambio] → [Documentar plan de rollback]
        │
        ▼
[Ejecutar cambio en la ventana aprobada]
        │
        ▼
¿Funcionó como se esperaba? --No--> [Ejecutar rollback] → [Registrar causa]
        │ Sí
        ▼
[Verificar integraciones relacionadas] → [Cerrar el cambio]
```

## 8. Checklist operativo
- [ ] Solicitud de cambio documentada con sistemas y usuarios afectados.
- [ ] Impacto en cascada evaluado contra el catálogo de integraciones.
- [ ] Ventana de cambio comunicada con anticipación a los usuarios afectados.
- [ ] Plan de rollback documentado antes de ejecutar el cambio.
- [ ] Verificación post-cambio de las integraciones relacionadas.

## 9. KPI
| KPI | Fórmula | Meta |
|---|---|---|
| % de cambios con rollback documentado | Cambios con plan de rollback / total | 100% |
| Tasa de cambios exitosos sin rollback | Cambios exitosos / total de cambios ejecutados | ≥ 95% |

## 10. Riesgos
| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Cambio ejecutado sin evaluar impacto en integraciones dependientes | Media | Alto |
| Cambio fuera de ventana aprobada, en horario de alto uso | Baja | Alto |

## 11. Controles
Ningún cambio significativo se ejecuta sin aprobación del Director de Tecnología y plan de rollback documentado.

## 12. Automatizaciones posibles
Verificación automática post-cambio de que las integraciones críticas siguen respondiendo (health check); calendario de ventanas de cambio integrado con notificación automática a usuarios afectados.

## 13. Prompts IA relacionados
1. *"Redacta el plan de cambio para [cambio a sistema], incluyendo ventana propuesta, pasos de ejecución y plan de rollback en caso de falla."*
2. *"Con este catálogo de integraciones, evalúa qué sistemas se verían afectados en cascada si se modifica [sistema]."*

## 14. Indicadores de éxito
100% de los cambios significativos con plan de rollback documentado y tasa de éxito ≥95%, sostenido durante 2 trimestres.

## 15. Plan de mejora continua
Revisión trimestral de los cambios que requirieron rollback, aplicando DMAIC (Módulo 3) si se detecta un patrón recurrente de causa.
