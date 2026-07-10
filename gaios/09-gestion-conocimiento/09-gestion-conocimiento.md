# GAIOS — Módulo 9: Gestión del Conocimiento

> El ciclo SECI aplicado a la empresa: convertir lo que la gente sabe en algo que la empresa sabe, antes de que esa persona se vaya.

**Versión:** 1.0 · **Estado:** Aprobado (base) · **Dueño:** Especialista en Gestión del Conocimiento · **Última revisión:** 2026-07-10 · **Próxima revisión:** 2027-01-10 · **Depende de:** Módulo 0 — Arquitectura Maestra, Módulo 5 — RRHH (offboarding)

---

## 1. Objetivo

Estandarizar cómo el conocimiento tácito (lo que alguien sabe pero no ha escrito) se convierte en conocimiento explícito (documentado, buscable, reutilizable) usando el modelo SECI, para que el know-how crítico de la empresa no dependa de la memoria de personas específicas y se pueda transferir de forma sistemática en onboarding, cambios de rol y, sobre todo, offboarding — **reduciendo la dependencia de personas clave** para que la operación siga funcionando cuando alguien se va.

## 2. Alcance

**Incluye:** captura de conocimiento tácito (shadowing, entrevistas estructuradas), estructura de la base de conocimiento única, comunidades de práctica, auditoría de brechas de conocimiento, transferencia de conocimiento obligatoria en offboarding de roles críticos.

**Excluye:** el contenido operativo específico de cada módulo (vive en su propio módulo GAIOS); gestión formal de propiedad intelectual y patentes (requiere asesoría legal especializada).

## 3. Entradas

| Fuente | Uso en este proceso |
|---|---|
| Modelo SECI (Nonaka & Takeuchi) | Ciclo de conversión de conocimiento tácito a explícito y de vuelta a tácito compartido |
| Comunidades de práctica (Wenger) | Estructura de socialización periódica del conocimiento |
| Principio de fuente única de verdad | El manual GAIOS es el repositorio central — no hay una segunda "verdad" en otro lugar |
| Módulo 5 — RRHH | El offboarding dispara la captura de conocimiento obligatoria |
| Módulo 0 — Arquitectura Maestra | Estándar documental y de gobierno |

## 4. Responsables (RACI)

| Rol | Responsabilidad | R | A | C | I |
|---|---|:-:|:-:|:-:|:-:|
| Especialista en Gestión del Conocimiento | Dueño del proceso, facilita la captura | X | X | | |
| Dueño del conocimiento (cualquier colaborador) | Fuente del conocimiento tácito | X | | | |
| RRHH | Dispara la captura en el proceso de offboarding | | | X | |
| Director de área | Identifica qué conocimiento de su equipo es crítico | | | X | |

## 5. Herramientas

- **Base de conocimiento única:** el repositorio GAIOS (Notion/Confluence/Git como espejo del manual).
- **Grabación/transcripción** para sesiones de shadowing y entrevistas.
- **IA generativa** para sintetizar conocimiento tácito capturado en documentos estructurados.
- **Búsqueda semántica** sobre la base de conocimiento.

## 6. Procedimiento paso a paso

1. **Auditoría de brechas (knowledge audit):** identificar qué procesos críticos dependen de la memoria de una sola persona, sin documentación explícita (`sop-auditoria-brechas-conocimiento.md`).
2. **Socialización:** el especialista o un colega acompaña (shadowing) a quien tiene el conocimiento tácito, observando cómo lo aplica en la práctica.
3. **Externalización:** entrevista estructurada que convierte lo tácito en explícito — se documenta como artículo de la base de conocimiento (`plantilla-articulo-base-conocimiento.md`) o como SOP bajo el estándar GAIOS si es un proceso operativo.
4. **Combinación:** el nuevo documento se integra con el resto del manual, referenciando los módulos GAIOS relacionados — no queda aislado.
5. **Internalización:** el equipo practica y usa el conocimiento documentado hasta que se vuelve tácito de nuevo, pero ahora compartido por más de una persona.
6. **Captura obligatoria en offboarding:** antes de que alguien con conocimiento crítico salga de la empresa, se ejecuta una sesión de captura dedicada (`sop-captura-conocimiento-offboarding.md`), coordinada con el checklist de offboarding del Módulo 5.
7. **Comunidades de práctica:** reuniones periódicas por disciplina para socializar aprendizajes recientes antes de que se vuelvan brechas.
8. **Auditoría periódica** de vigencia de la base de conocimiento, alineada al ciclo de revisión del Módulo 0.

## 7. Diagrama de flujo (descrito en texto)

```
[Auditoría de brechas: ¿qué depende de una sola persona?]
        │
        ▼
[Socialización: shadowing] ──► [Externalización: entrevista estructurada → documento]
        │
        ▼
[Combinación: integrar con el manual GAIOS, referenciar módulos relacionados]
        │
        ▼
[Internalización: el equipo practica hasta que el conocimiento se comparte]
        │
        ▼
  ¿Colaborador con conocimiento crítico sale de la empresa? ──Sí──► [Captura obligatoria antes del offboarding]
        │ No
        ▼
[Comunidades de práctica periódicas] ──► [Auditoría de vigencia de la base de conocimiento]
```

## 8. Checklist operativo

- [ ] Knowledge audit realizado con brechas identificadas y priorizadas.
- [ ] Todo proceso crítico tiene documentación explícita, no solo en la cabeza de alguien.
- [ ] Toda salida de un colaborador con conocimiento crítico tiene sesión de captura previa.
- [ ] Documentos nuevos integrados al manual GAIOS, no aislados en otro sistema.
- [ ] Base de conocimiento auditada periódicamente por vigencia.

## 9. KPI

| KPI | Fórmula | Meta |
|---|---|---|
| % de procesos críticos documentados | Documentados / identificados como críticos en el audit | 100% en 12 meses |
| Sesiones de captura en offboarding | Realizadas / ofertas de baja con conocimiento crítico identificado | 100% |
| Tiempo de cierre de brecha | Días desde brecha identificada hasta documento publicado | ≤ 30 días |
| Uso de la base de conocimiento | Consultas mensuales por colaborador | Creciente |

## 10. Riesgos

| Riesgo | Probabilidad | Impacto |
|---|:-:|:-:|
| Conocimiento crítico que se va con una persona sin captura previa | Media | Alto |
| Documentación desactualizada que genera desconfianza en la fuente | Media | Medio |
| Cultura de "yo lo sé, para qué escribirlo" | Alta | Medio |

## 11. Controles

- Ninguna salida de un colaborador con conocimiento crítico se completa (checklist de offboarding, Módulo 5) sin confirmación de captura de conocimiento.
- Auditoría trimestral de vigencia de la base de conocimiento, alineada al ciclo de revisión del Módulo 0.
- Ningún proceso crítico se considera "bajo control" si depende de una sola persona sin documentación de respaldo.

## 12. Automatizaciones posibles

- **Transcripción y síntesis automática** de sesiones de captura de conocimiento con IA, con revisión humana antes de publicar.
- **Alertas de documentos desactualizados** (>6 meses sin revisión), ligadas al mecanismo del Módulo 0.
- **Búsqueda semántica** sobre la base de conocimiento para reducir tiempo de búsqueda.

## 13. Prompts IA relacionados

1. *"Con esta transcripción de entrevista de captura de conocimiento sobre [proceso/tema], sintetiza un documento estructurado siguiendo el estándar GAIOS, señalando qué información quedó incompleta."*
2. *"A partir de este organigrama y la descripción de cada rol, identifica qué conocimiento crítico podría depender de una sola persona y debería auditarse primero."*
3. *"Genera las preguntas para una sesión de shadowing con [rol], enfocadas en capturar decisiones tácitas que no están en ningún SOP."*
4. *"Revisa este documento de la base de conocimiento y señala si sigue siendo preciso frente al proceso actual, o qué partes están desactualizadas."*

## 14. Indicadores de éxito

A 6 meses de operar este módulo:
- 100% de los procesos críticos identificados en el knowledge audit tienen documentación explícita.
- 100% de las salidas de colaboradores con conocimiento crítico pasaron por sesión de captura previa.
- La base de conocimiento es la primera fuente de consulta ante dudas operativas, por encima de preguntar directamente a una persona.

## 15. Plan de mejora continua

- **Revisión trimestral** del knowledge audit, incorporando nuevas brechas identificadas.
- **Comunidades de práctica** con cadencia definida por disciplina (mínimo trimestral).
- **Revisión de este documento cada 6 meses.**
- **Coordinación continua con RRHH (Módulo 5)** para que ningún offboarding de rol crítico avance sin captura de conocimiento.

---

## Entregables de este módulo

| Entregable | Archivo |
|---|---|
| SOP — Captura de conocimiento en offboarding | `gaios/09-gestion-conocimiento/sop-captura-conocimiento-offboarding.md` |
| SOP — Auditoría de brechas de conocimiento | `gaios/09-gestion-conocimiento/sop-auditoria-brechas-conocimiento.md` |
| Plantilla — Artículo de base de conocimiento | `gaios/09-gestion-conocimiento/plantilla-articulo-base-conocimiento.md` |
| Checklist operativo de aceptación | `gaios/09-gestion-conocimiento/checklist-modulo9.md` |
| Prompts IA relacionados (ampliado) | `gaios/09-gestion-conocimiento/prompts-ia-modulo9.md` |
| Formulario / dashboard de KPIs de conocimiento | `gaios/09-gestion-conocimiento/kpis-dashboard-conocimiento.md` |

**Próximos módulos dependientes:** Módulo 10 (Gobierno Corporativo/EOS) consume la documentación de roles críticos para el Accountability Chart; todo módulo futuro que documente conocimiento tácito usa este proceso como método.
