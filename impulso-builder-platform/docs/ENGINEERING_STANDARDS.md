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
