# Estándar de ingeniería — Impulso Builder Platform

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
