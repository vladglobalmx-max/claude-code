# Estándar de ingeniería — Impulso Builder Platform

## Principios de producto (fusionado desde `docs/product/02-Product-Principles.md`, consolidación documental 2026-07-31)

Estos principios guían toda decisión de producto y arquitectura — cuando dos opciones compitan, la que respete mejor estos principios gana, incluso si la otra es más rápida de construir hoy. No dependen del nombre o posicionamiento comercial del producto que los aplica.

- **Simplicidad.** La opción correcta es la más simple que resuelve el problema real — simplicidad para quien usa el producto primero, simplicidad de implementación cuando no compite con eso. Ej.: el Document Schema modela solo 6 tipos de objeto genéricos (`rectangle`/`ellipse`/`path`/`image`/`text`/`group`) en vez de un tipo especial por cada necesidad de módulo — lo específico se expresa con `metadata.role` (ADR-0002).
- **Velocidad.** Tanto velocidad de desarrollo (decisiones suficientemente buenas y reversibles, no perfectas) como velocidad de producto (la app se siente instantánea). Ej.: resize/rotación se previsualizan moviendo el nodo Konva directamente, sin el ciclo completo de validación del Engine en cada frame de arrastre — solo se confirma al soltar (ADR-0007/ADR-0008).
- **Modularidad.** El núcleo (Engine) no sabe nada específico de ningún módulo; un módulo nuevo se agrega sin reescribir lo existente. Arquitectura de dependencia en una sola dirección — `Document Schema → Engine → Renderer → Konva` (ADR-0001) — verificada activamente con `madge --circular`, no solo declarada.
- **AI Provider Agnostic.** El día que el producto incorpore capacidades de IA (generación de imágenes, sugerencias, autocompletado), ninguna debe acoplarlo a un proveedor específico de forma irreversible — se define detrás de un contrato/adaptador propio, igual que `RendererAdapter` (ADR-0001), para que cambiar de proveedor (o correr sin ninguno) sea cuestión de conectar un adaptador distinto. Documentado desde antes de que exista la primera funcionalidad de IA, por la misma razón que Document Schema → Engine → Renderer se diseñó antes de la primera línea de código: retrofitear esta separación después de que el acoplamiento ya existe es mucho más caro.
- **Offline First (cuando aplique).** La funcionalidad esencial (crear, editar, guardar, exportar un documento) funciona sin depender de un servidor. "Cuando aplique" reconoce que capacidades futuras que requieren red por naturaleza (sincronización, colaboración) no están sujetas a este principio de la misma forma. La abstracción `StorageProvider` (planeada) existe para que, el día que se agregue sincronización remota, el modo offline siga siendo válido, no reemplazado.
- **Calidad comercial** y **Performance First** ya están cubiertos como reglas operativas en las secciones de abajo (estándar de paquete, Performance Budget) — se listan aquí solo para que quede explícito que también son principios de producto, no únicamente reglas técnicas.

Regla permanente, vigente desde Foundation 2 en adelante, para **todo paquete** de este monorepo (`packages/*`, `apps/*`):

1. Debe compilar sin errores (`tsc --noEmit` limpio).
2. Debe incluir pruebas automatizadas.
3. Debe evitar dependencias circulares (entre paquetes y entre módulos internos).
4. No debe utilizar `any`.
5. Debe mantener una API pública estable (todo lo exportado desde `src/index.ts` es el contrato; cambios incompatibles se documentan en el CHANGELOG).
6. Debe incluir `README.md` (con ejemplos de uso), `CHANGELOG.md`.
7. Cobertura de tests mínima: **90%** (statements/branches/functions/lines).
8. Cada paquete debe ser potencialmente publicable como paquete independiente (dependencias explícitas en su propio `package.json`, sin asumir estado global del monorepo).

Esta lista es la referencia para revisar cualquier micro-sprint futuro — si un paquete no cumple alguno de estos puntos, no se considera terminado.

## Architecture Decision Records (desde Foundation 3)

Cada Foundation incluye un ADR en [`docs/adr/`](adr) respondiendo: Problema, Contexto, Alternativas evaluadas, Decisión tomada, Consecuencias, Riesgos, Compatibilidad futura. Ver [`docs/adr/README.md`](adr/README.md) para la plantilla completa y el índice.

## Performance Budget (desde Foundation 3)

Impulso debe poder manejar documentos grandes (miles de objetos) sin degradar la experiencia de edición. Toda decisión con impacto de rendimiento se documenta — en el ADR del Foundation correspondiente, y como fila nueva en [`docs/PERFORMANCE_BUDGET.md`](PERFORMANCE_BUDGET.md) — con: complejidad aproximada, cuellos de botella posibles, y estrategia de optimización futura. No se optimiza prematuramente; se documenta el camino para cuando haga falta.

## Stable Public API (desde la etapa Editor)

Toda API pública (lo exportado desde el `src/index.ts` de cada paquete) se mantiene estable siempre que sea posible. Si un cambio a una API pública es inevitable, se documenta con un ADR que responda: Motivo del cambio, Impacto (qué consumidores/paquetes se ven afectados), Compatibilidad (qué sigue funcionando, qué no), y Estrategia de migración (cuando aplique). Agregar una exportación nueva sin tocar el comportamiento de las existentes no es un "cambio" en este sentido — no requiere ADR, aunque sí conviene anotarlo en el CHANGELOG del paquete.

## UX First (desde Editor 2)

En cada micro-sprint de la etapa Editor se documenta, junto con la implementación técnica, la experiencia de uso: **Flujo del usuario** (los pasos concretos que sigue), **Consistencia de interacción** (por qué el comportamiento elegido no sorprende a quien ya usa herramientas similares), **Accesibilidad** (qué funciona y qué NO funciona todavía para teclado/lectores de pantalla — con honestidad, no optimismo), y **Mejoras futuras** (qué queda pendiente y por qué no se resolvió ahora). Vive en el README del paquete/app correspondiente, junto a la explicación técnica — no en un documento aparte.

## Evaluación dual: Arquitectura + UX (desde Epic 5)

Toda capacidad nueva se evalúa desde **dos perspectivas**, ninguna suficiente por sí sola: que sea técnicamente correcta NO es "terminado" si la experiencia no está a la altura. Antes de implementar una interacción nueva, se analiza explícitamente:

- **Número de clics** — el camino más corto razonable, no el que resultó más simple de programar.
- **Descubribilidad** — ¿un usuario nuevo encuentra esto sin documentación externa?
- **Consistencia** — ¿coincide con el mismo patrón ya usado en otra parte de Impulso, y con la convención de herramientas de referencia (Figma, Illustrator, Canva, Kittl)?
- **Accesibilidad** — igual que el punto de "UX First" arriba: honestidad sobre qué funciona y qué no.
- **Atajos de teclado** — ¿un usuario experto puede evitar el mouse para la acción frecuente?
- **Comportamiento esperado por un usuario experto** — el que ya conoce herramientas de diseño profesionales.
- **Comportamiento esperado por un usuario nuevo** — el que nunca usó ninguna.

La vara es explícita: Impulso debe sentirse como un producto profesional (comparable a Figma/Illustrator/Canva/Kittl cuando aplique) desde su primera versión, no solo estar bien construido por dentro. Si este análisis revela una mejora de UX clara que no rompe la arquitectura ni amplía significativamente el alcance de la épica en curso, se incorpora y se documenta al cierre — no se difiere solo porque no fue pedida explícitamente.

## UX Audits (desde Epic 5)

Al cerrar cada gran bloque funcional (Workspace, Editor, Export, etc.) se realiza una **UX Audit independiente**, registrada en [`docs/ux-audits/`](ux-audits) — analiza el bloque ya construido como lo haría un equipo de UX de una herramienta profesional de referencia, evaluando las diez dimensiones de "Evaluación dual" de arriba. No modifica código, no propone refactors arquitectónicos, no abre épicas nuevas: es un insumo para decisiones de producto futuras, con hallazgos clasificados en quick wins (<30 min), cambios medianos, y cambios grandes que esperan una épica futura. Ver [`docs/ux-audits/README.md`](ux-audits/README.md) para la plantilla completa.
