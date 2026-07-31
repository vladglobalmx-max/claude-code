> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del lanzamiento comercial independiente de Sticker Builder v1.0.0 (RC1/Gumroad) — ese lanzamiento no ocurrirá bajo esta forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como evidencia de un proceso de release real, disciplinado y verificado — reutilizable como referencia si THÖREN necesita empaquetarse comercialmente en el futuro, pero no es una fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# Packaging Guide — Estructura del paquete comercial (Fase 4.2)

Qué contiene el `.zip` que recibe el comprador y por qué cada pieza está donde está. Ver `COMMERCIAL_BUILD_GUIDE.md` para cómo se genera.

```
impulso-sticker-builder-v1.0.0/
├── ABRIR-IMPULSO-WINDOWS.bat        ← launcher, doble clic, Windows
├── ABRIR-IMPULSO-MAC-LINUX.command ← launcher, doble clic, macOS/Linux
├── LEEME-PRIMERO.md                 ← primer archivo que el comprador debe abrir
├── index.html                       ← la app compilada
├── assets/
│   └── main-<hash>.js               ← único bundle de JS (sin harnesses de Epic 9)
├── commercial-product.json          ← manifest estampado (referencia/soporte)
├── version.json                     ← buildId/commit/builtAt (referencia/soporte)
├── docs/                             ← guías del comprador, en español
│   ├── 01-como-empezar.md
│   ├── 02-como-exportar.md
│   ├── 03-exportar-para-impresion.md
│   ├── 04-actualizar-y-respaldar.md
│   ├── 05-problemas-frecuentes-y-soporte.md
│   ├── 06-requisitos-y-limitaciones.md
│   └── NOTAS-DE-VERSION.md
└── legal/
    ├── LICENCIA-DE-USO.md
    ├── PRIVACIDAD.md
    └── LICENCIAS-DE-TERCEROS.md
```

## Principios de diseño de esta estructura

- **Los launchers y `LEEME-PRIMERO.md` están en la raíz**, no dentro de una subcarpeta — es lo primero que un comprador no técnico ve al descomprimir el ZIP, sin tener que navegar.
- **`index.html`/`assets/` están en la raíz, no en una subcarpeta `app/` o `dist/`** — así los launchers (que sirven el directorio donde ellos mismos viven) no necesitan ninguna lógica de "encontrar la carpeta correcta"; sirven su propio directorio tal cual.
- **`docs/` y `legal/` están separados** — un comprador buscando "¿puedo revender esto?" va a `legal/`; uno buscando "¿cómo exporto?" va a `docs/`. Ningún archivo mezcla contenido legal con instrucciones de uso.
- **`commercial-product.json`/`version.json` en la raíz, visibles pero no destacados** — están ahí principalmente para que soporte pueda pedirle al comprador "abre `version.json` y dime qué dice" ante un problema, no para que el comprador los edite o interprete por su cuenta.
- **Ningún archivo de desarrollo** (`.env`, `.git`, `node_modules`, `.DS_Store`, source maps, harnesses de Epic 9) — verificado en cada build por el escaneo de higiene de `build-commercial.mjs` y por `COMMERCIAL_SECURITY_CHECKLIST.md`.

## Fuera del ZIP (no van dentro del paquete comercial)

- El repositorio de código fuente completo, cualquier archivo de configuración del monorepo (`turbo.json`, `pnpm-workspace.yaml`, etc.).
- Los harnesses de Epic 9 (`print-engine-harness.html`, `print-preview-harness.html`) — nunca compilados por `vite.commercial.config.ts`.
- Cualquier test (`*.test.ts`), fixture de desarrollo, o el propio directorio `e2e/`.
- `CHECKSUMS.sha256` — vive en `dist-commercial/` junto al `.zip`, no dentro de él (es metadata sobre el archivo, no parte de su contenido).
