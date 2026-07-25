# Commercial Security Checklist — Impulso Sticker Builder (Fase 4.2)

Checklist ejecutado y verificado sobre el paquete real producido por `pnpm build:commercial` (no una descripción teórica). Repetir esta lista antes de cada release que se suba a Gumroad.

## 1. Escaneo de contenido no permitido

`scripts/build-commercial.mjs` falla el build si encuentra `.env`, `.git`, `node_modules` o `.DS_Store` en cualquier nivel del paquete armado (`scanForbidden`). Verificado con un build real: cero coincidencias.

## 2. Exclusión de harnesses de desarrollo (sección 26)

El build comercial usa `vite.commercial.config.ts`, que **solo** declara `index.html` como entrypoint — nunca compila `print-engine-harness.html` ni `print-preview-harness.html` (harnesses internos de Epic 9, ADR-0022/0023). Verificado: `find <paquete> -iname "*harness*"` → sin resultados; `index.html` del paquete solo referencia `assets/main-*.js` y el favicon inline.

## 3. Sin source maps

`vite build` en modo producción no genera `.map` por defecto y no se configuró `build.sourcemap`. Verificado: `find <paquete> -iname "*.map"` → sin resultados.

## 4. Sin `eval` ni secretos/credenciales embebidos

- `grep "eval("` sobre el bundle final → 0 coincidencias.
- Búsqueda de patrones de credenciales (`api_key`, `secret`, `password`, `token`, patrones de claves de AWS) → sin coincidencias reales (algunas subcadenas de nombres de variables minificadas de `pdf-lib` contienen la palabra en un contexto no relacionado con un secreto real — revisado manualmente, no un hallazgo).
- Búsqueda de rutas absolutas del sistema de archivos (`/home/...`) → sin coincidencias.

## 5. Sin llamadas de red no documentadas

Las únicas cadenas tipo URL presentes en el bundle son: el namespace XML de SVG (`http://www.w3.org/2000/svg`, no una llamada de red), un comentario de atribución de `pdf-lib` (link a su repo de GitHub) y un link a la documentación de Konva sobre "tainted canvas" (texto de un mensaje de error, no una llamada real). Cero URLs de telemetría, analítica o backend propio — consistente con `PRIVACIDAD.md` y ADR-0026 (`licensingMode: "delivery-only"`, sin backend en V1).

## 6. Logging saneado

`console.error`/`console.warn` presentes en el bundle (9 y 9 respectivamente) son mensajes propios de la aplicación, en español, sin volcar rutas del sistema de archivos ni contenido de proyectos del usuario — ver `apps/sticker-builder/src/app.ts` y demás módulos (limpiados de prefijos de fase internos, ej. `[Epic 8]`, durante Fase 4.2). Se detectó un único `console.log("FLATE:", ...)` proveniente del código interno ya minificado de `pdf-lib` (no código propio) — es un log de depuración de esa biblioteca de terceros en su ruta de compresión Flate; no imprime datos del usuario ni credenciales, y no es practicable de eliminar sin parchear la dependencia — aceptado como riesgo residual mínimo, ver Technical Debt.

## 7. Reproducibilidad del build

**Encontrado y corregido durante esta verificación:** la primera versión del script estampaba `buildMetadata` (con un `builtAt` real, distinto en cada corrida) directamente en `commercial-product.json` **antes** de correr `vite build`. Como `commercialManifest.ts` importa ese JSON de forma estática, el timestamp terminaba embebido dentro del bundle de JS, haciendo que el hash de archivo (y por lo tanto el nombre del chunk y el contenido del `.zip`) cambiara en cada build aun para el mismo commit — confirmado corriendo el build dos veces seguidas y comparando con `diff -rq` + `sha256sum` (los bundles diferían).

**Fix:** el manifest se compila siempre tal cual está en el repositorio (con `buildMetadata` en null); el `buildId`/`commit`/`builtAt` reales solo se escriben DESPUÉS del build, en los archivos sueltos `commercial-product.json`/`version.json` en la raíz del paquete (nunca leídos por la app en tiempo de ejecución — la app usa la copia embebida en el bundle). Re-verificado tras el fix: dos builds consecutivos del mismo commit producen un `assets/main-*.js` con **el mismo nombre de archivo y el mismo hash SHA-256** (verificado, no solo esperado). El `.zip` completo todavía difiere entre corridas porque `commercial-product.json`/`version.json` sí llevan un `builtAt` real — esto es intencional y documentado, no un defecto: el código ejecutable es reproducible, solo la metadata informativa de "cuándo se generó este paquete" varía, como es de esperar de un timestamp real.

`buildId` tiene la forma `<productVersion>+<commit-corto>` (ej. `1.0.0+ccc194c5074b`) — determinístico para un mismo commit, sin aleatoriedad.

## 8. Checksums de integridad

`CHECKSUMS.sha256` (formato estándar `sha256sum`) se genera junto al `.zip` en cada build — permite al comprador (o a soporte) verificar que la descarga no se corrompió ni fue alterada en tránsito.

## 9. Actualización manual — mecanismo documentado

No hay actualización automática en V1 (decisión de producto, no limitación técnica pendiente). El procedimiento manual completo — dónde descarga el comprador la nueva versión, por qué sus proyectos guardados sobreviven la actualización (puerto fijo 4173, IndexedDB particionado por origen) — está documentado en:
- `apps/sticker-builder/commercial-assets/docs/04-actualizar-y-respaldar.md` (guía para el comprador).
- `docs/platform/OFFLINE_DISTRIBUTION_GUIDE.md` (razón técnica completa).

## 10. Alcance NO cubierto por este checklist (fuera de V1, ver ADR-0028/LICENSING_THREAT_MODEL.md)

- No hay firma de código (el `.command`/`.bat` no están firmados — de ahí la advertencia de macOS sobre "desarrollador no identificado", documentada honestamente en `05-problemas-frecuentes-y-soporte.md`).
- No hay escaneo automatizado de vulnerabilidades de dependencias (`npm audit`/similar) integrado al comando `build:commercial` en esta fase — recomendado para una fase posterior (ver Technical Debt).
- No hay protección anti-copia del paquete en sí — consistente con la decisión explícita de la autorización de Fase 4.2 de NO implementar DRM ni protección anti-copia absoluta en V1.
