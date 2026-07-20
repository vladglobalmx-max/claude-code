# What should we build next?

> Recomendación de una sola épica, entregada al cierre de Epic 6 (Platform Consolidation). Basada en `docs/platform/STATE_001.md` (auditoría completa), `docs/product/UX_BACKLOG.md`, `docs/product/PRODUCT_BACKLOG.md` y `docs/product/04-Roadmap.md`.
>
> **Estado: construida.** Epic 8 (Autosave, Recovery & Project Safety) implementó esta recomendación — ver [ADR-0019](docs/adr/0019-autosave-save-coordinator.md)/[ADR-0020](docs/adr/0020-project-recovery.md). Este documento se conserva como registro histórico de la recomendación original (incluye la evaluación de alternativas descartadas: PDF Print-Ready, segundo módulo real), no como una recomendación pendiente.

## Recomendación: Autosave

Construir guardado automático del proyecto abierto en el editor, eliminando el riesgo de pérdida silenciosa de trabajo no guardado (UX Audit 0001, hallazgo de mayor impacto detectado hasta la fecha en toda la plataforma).

---

## Por qué esta y no otra

Se evaluaron tres candidatos serios: **Autosave**, **PDF Print-Ready** (Fase 3 del roadmap) y **el segundo módulo real** (Fase 5, Multi Builder Platform — la prueba definitiva de la tesis arquitectónica de Impulso). Los tres son legítimos. Autosave gana por secuenciación, no porque los otros carezcan de valor:

### Valor para el usuario
Hoy, salir del editor hacia la Workspace (o Ctrl/Cmd+O) descarta cualquier cambio hecho desde el último "Guardar" explícito, sin ningún aviso. Ninguna herramienta profesional de referencia (Figma, Illustrator, Canva, Kittl) permite esto. Es, con diferencia, el gap de experiencia más grave que la plataforma tiene hoy — no un pulido cosmético, sino el tipo de sorpresa que rompe la confianza de un usuario nuevo en su primera sesión real.

### Impacto arquitectónico
Menor que construir un segundo módulo, pero real y bien acotado: `ProjectStore.save()` ya existe y es idempotente (Epic 5) — no hace falta ninguna API nueva en `packages/project-library`. El trabajo real es de secuenciación (cuándo autoguardar sin regenerar el thumbnail — una rasterización PNG completa — en cada tecla) y de decidir qué hacer con la inconsistencia de manejo de errores entre paquetes (ver `STATE_001.md` §9/§13) en el único punto donde un fallo silencioso de guardado importaría de verdad.

### Reutilización
Esta es la razón de fondo por la que Autosave debe ir ANTES que el segundo módulo, no después. `shell.ts`/`workspace.ts`/`ProjectStore` son exactamente lo que un segundo módulo (Planner Builder o el que se elija) reutilizaría tal cual, sin reescribirlo — incluyendo el mismo comportamiento de "guardado explícito, sin autosave, sin aviso". Construir el segundo módulo ANTES de resolver esto significaría que ese módulo hereda automáticamente el mismo riesgo de pérdida de datos para sus propios usuarios, duplicando el problema en vez de resolverlo una sola vez en la base compartida.

### Visión de Impulso Platform
El segundo módulo real sigue siendo, sin duda, la prueba definitiva de "un núcleo, múltiples productos" (ver `docs/platform/STATE_001.md`, Riesgos #2). Pero el propósito explícito de Epic 6 fue consolidar la base ANTES de seguir construyendo — y enviar esa base a un segundo módulo con su mayor riesgo de UX conocido sin resolver contradice ese mismo propósito. Resolver Autosave ahora es, en sí mismo, un acto de consolidación: cierra el hallazgo más serio de la primera UX Audit antes de que la plataforma crezca a un segundo consumidor.

## Alternativas descartadas para este turno (no para siempre)

- **PDF Print-Ready**: la capacidad de mayor valor comercial declarado del proyecto, y candidata natural para la épica que siga a esta. Se pospone un turno porque no depende de nada urgente hoy, mientras que Autosave sí resuelve un riesgo ya activo.
- **Segundo módulo real**: la apuesta de mayor impacto arquitectónico de toda la lista, y la razón de ser de "Impulso Platform" como nombre. Se recomienda explícitamente DESPUÉS de Autosave (y probablemente después de una primera pasada de Design System con evidencia real) — no antes, para no propagar el riesgo de pérdida de datos a un segundo módulo antes de resolverlo en el primero.

## Alcance sugerido de la épica (a validar/ajustar, no una implementación aprobada)

- Guardado automático con debounce tras cambios de contenido (no en cada `dispatch`, para no saturar `ProjectStore.save()`).
- Separar la cadencia de "guardar el `Project`" de "regenerar el thumbnail" — el thumbnail no necesita actualizarse en cada autosave.
- Indicador visual de estado ("Guardando…"/"Guardado" — mismo lenguaje ya usado en `saveAsTemplateDialog.ts`).
- Decisión explícita sobre qué pasa con "Guardar" manual una vez existe autosave (¿se mantiene como forzar-guardar-ya, o se retira?).
- UX Audit de esta funcionalidad al cierre, siguiendo la práctica ya establecida.

Como siempre: diseño de arquitectura + UX antes de implementar, con aprobación explícita del usuario antes de escribir código.
