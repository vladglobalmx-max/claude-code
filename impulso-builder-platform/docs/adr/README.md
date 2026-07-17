# Architecture Decision Records — Impulso Builder Platform

Regla permanente desde Foundation 3: **cada Foundation incluye un ADR**. Un ADR no es un resumen de lo que se construyó — es el registro de *por qué* se decidió así y no de otra forma, para que una decisión no tenga que redescubrirse (o revertirse por accidente) más adelante.

## Plantilla

Cada ADR responde, en este orden:

1. **Problema** — qué pregunta concreta había que responder.
2. **Contexto** — qué restricciones/decisiones previas condicionan la respuesta.
3. **Alternativas evaluadas** — qué otras opciones se consideraron y por qué no se eligieron.
4. **Decisión tomada** — qué se decidió, sin ambigüedad.
5. **Consecuencias** — qué implica esta decisión para el código y para Foundations futuras.
6. **Riesgos** — qué podría salir mal o qué deuda se acepta a propósito.
7. **Compatibilidad futura** — qué mantiene esta decisión abierto, y qué cerraría.

Cuando la decisión tiene impacto de rendimiento (regla del Performance Budget, también desde Foundation 3), el ADR incluye además una sección **Rendimiento** con: complejidad aproximada, cuellos de botella posibles, y estrategia de optimización futura (sin implementarla prematuramente). Ver [`../PERFORMANCE_BUDGET.md`](../PERFORMANCE_BUDGET.md) para el registro consolidado entre Foundations.

## Índice

| ADR | Foundation | Título |
|---|---|---|
| [0001](0001-impulso-engine-architecture.md) | 0 | Impulso Engine: Document Schema → Engine → Renderer → Konva |
| [0002](0002-document-schema.md) | 1 | Document Schema como contrato de datos renderer-agnóstico |
| [0003](0003-engine-core.md) | 2 | Engine Core: estado, comandos y eventos |
| [0004](0004-renderer-adapter.md) | 3 | Renderer Adapter: primer adaptador Konva |
| [0005](0005-canvas-runtime.md) | Editor 1 | Canvas Runtime: primera integración end-to-end |
| [0006](0006-selection-system.md) | Editor 2 | Selection System: click, Shift-click, deselección |
