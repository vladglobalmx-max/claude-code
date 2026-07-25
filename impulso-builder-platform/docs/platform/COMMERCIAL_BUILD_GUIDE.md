# Commercial Build Guide — Impulso Sticker Builder (Fase 4.2)

Cómo producir el paquete comercial real que se sube a Gumroad, y qué garantiza cada paso.

## Comando

```
cd apps/sticker-builder
pnpm build:commercial
```

Ejecuta `scripts/build-commercial.mjs`. Requiere `zip` y `git` disponibles en el `PATH` (ambos estándar en Linux/macOS; en Windows, usar WSL o Git Bash para correr este script — es una herramienta de desarrollo interna, nunca corre en la máquina del comprador).

## Qué produce

```
dist-commercial/
  impulso-sticker-builder-v1.0.0/       ← paquete sin comprimir (para inspección)
    index.html
    assets/main-<hash>.js
    ABRIR-IMPULSO-WINDOWS.bat
    ABRIR-IMPULSO-MAC-LINUX.command
    LEEME-PRIMERO.md
    docs/                                ← guías del comprador (ver Packaging Guide)
    legal/                                ← EULA, privacidad, licencias de terceros
    commercial-product.json              ← manifest estampado (buildId/commit/builtAt reales)
    version.json                         ← metadata de build suelta, mismo propósito
  impulso-sticker-builder-v1.0.0.zip     ← lo que efectivamente se sube a Gumroad
  CHECKSUMS.sha256                       ← sha256sum del .zip
```

`dist-commercial/` y `dist-commercial-raw/` (staging intermedio) están en `.gitignore` — nunca se commitean.

## Los 5 pasos, y qué garantiza cada uno

1. **Validación del manifest (build-time, obligatoria)** — `node scripts/validate-commercial-manifest.mjs` contra `@impulso/commercial-schema`. Si `commercial-product.json` es inválido, el build **se detiene aquí**, con la lista completa de errores. Ver ADR-0027 para la política de fallo completa (el fallback abierto de `commercialManifest.ts` es solo para desarrollo local, nunca para este script).
2. **Compilación con `vite.commercial.config.ts`** — a propósito, un config de Vite *distinto* al normal (`vite.config.ts`), que solo declara `index.html` como entrypoint. `vite.config.ts` (usado por `pnpm dev`/`pnpm build`/`pnpm test:e2e`) también compila `print-engine-harness.html` y `print-preview-harness.html`, herramientas de verificación interna de Epic 9 sin ruta de producto — el build comercial nunca les pide a Rollup que las compile, así que quedan excluidas por construcción, no por un filtro posterior.
3. **Armado del paquete** — copia el build + launchers + `LEEME-PRIMERO.md` + `docs/` + `legal/` desde `commercial-assets/`, y escribe `commercial-product.json`/`version.json` con la metadata de build real.
4. **Escaneo de higiene** — falla si aparece `.env`, `.git`, `node_modules` o `.DS_Store` dentro del paquete armado.
5. **Compresión + checksum** — `zip -rqX` (sin metadata extra de filesystem) + SHA-256 del `.zip` en `CHECKSUMS.sha256`.

## Reproducibilidad — qué es y qué no es reproducible

El manifest se compila **tal cual está en el repositorio** (con `buildMetadata` en `null`) — nunca se estampa antes de correr `vite build`. Esto es deliberado: como `commercialManifest.ts` importa el JSON de forma estática, cualquier valor variable (timestamp) embebido ahí antes del build terminaría dentro del bundle de JS, haciendo que su hash cambiara en cada build aun para el mismo commit.

Resultado verificado (ver `COMMERCIAL_SECURITY_CHECKLIST.md`, sección 7): dos builds consecutivos del mismo commit producen `assets/main-*.js` con el mismo nombre de archivo y el mismo SHA-256. El `buildId` (`<productVersion>+<commit-corto>`) es determinístico. El `.zip` completo sí difiere entre corridas porque `commercial-product.json`/`version.json` llevan un `builtAt` real (metadata informativa, nunca leída por la app en ejecución) — esto es esperado, no un defecto.

## Cuándo correr esto

Antes de cualquier publicación en Gumroad, siempre sobre un working tree limpio (`git status` sin cambios sin commitear) para que `buildId` refleje exactamente el código que se está empaquetando. Ver `docs/platform/GUMROAD_LAUNCH_PLAN.md` para el checklist de publicación completo.
