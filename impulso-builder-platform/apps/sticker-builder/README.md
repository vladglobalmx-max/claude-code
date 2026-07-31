# @impulso/sticker-builder

> Editor de canvas y motor de creación/impresión que THÖREN 2.0 invoca internamente para componer y exportar cada propuesta — no es una interfaz que la persona usuaria abra directamente. Ver [`docs/product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../docs/product/THOREN_STICKER_BUILDER_COMPONENT.md) para la documentación técnica completa (estructura de módulos, decisiones de ingeniería, kit de producción, convenciones de calidad, licencias) y [ADR-0010](../../docs/adr/0010-sticker-creation-experience.md)/[ADR-0011](../../docs/adr/0011-asset-library.md)/[ADR-0012](../../docs/adr/0012-export-engine.md)/[ADR-0025](../../docs/adr/0025-production-export-workflow.md) para el razonamiento arquitectónico de cada capa.

**Estado:** el código de este app (editor, capas, assets, exportación a pantalla y a producción) sigue completo y en uso — es el motor real por debajo del Motor Creativo de THÖREN. Su documentación técnica exhaustiva original (README de producto independiente, versión previa a la consolidación documental del 2026-07-31) queda archivada íntegra en [`docs/archive/sticker-builder/platform-app-readme.md`](../../docs/archive/sticker-builder/platform-app-readme.md).

## Desarrollo

```bash
pnpm --filter @impulso/sticker-builder dev        # servidor de desarrollo
pnpm --filter @impulso/sticker-builder build       # build de producción
pnpm --filter @impulso/sticker-builder preview     # sirve el build de producción
pnpm --filter @impulso/sticker-builder test         # tests
pnpm --filter @impulso/sticker-builder typecheck    # tsc --noEmit
pnpm --filter @impulso/sticker-builder test:e2e      # Playwright, navegador real (ver e2e/)
```

Ver `CHANGELOG.md` de este mismo directorio para el historial de cambios de ingeniería.
