# Final Release Checklist — v1.0.0

Registro de la ejecución del hito **Final Release Preparation — Version 1.0.0**. Este documento es el resultado ya ejecutado y verificado, no una plantilla — para el checklist genérico reutilizable en futuras versiones, ver `RELEASE_CHECKLIST.md`.

## 1. Validación manual de comprador

- [x] Validación manual de comprador ejecutada de punta a punta sobre el ZIP de distribución real, en la máquina real del validador.
- [x] Aprobada explícitamente por el propietario del producto.
- [x] Reporte completo: `BUYER_VALIDATION_REPORT.md`.

## 2. Correcciones de Release Candidate incluidas en el paquete final

- [x] Las 6 correcciones de RC1 (4 críticas + 2 menores, ver `BUYER_VALIDATION_REPORT.md`) están en el historial de commits de la rama y compiladas en el build final.
- [x] `apps/sticker-builder/CHANGELOG.md` documenta cada una con causa raíz y verificación.

## 3. Verificación final

- [x] **Typecheck** — monorepo completo (23 paquetes vía `turbo run typecheck`): 23/23 exitosos.
- [x] **Tests unitarios** — monorepo completo (`turbo run test`): 23/23 tareas exitosas — 229 tests en `@impulso/renderer-konva`, 497 en `@impulso/print-engine`, 443 en `@impulso/sticker-builder` (30 archivos), y el resto de paquetes vía sus propias suites.
- [x] **E2E (Playwright, Chromium real)** — `apps/sticker-builder`: 54/54 escenarios verdes.
- [x] **Build comercial** — `pnpm build:commercial` corrió limpio, sin fallar el escaneo de higiene del paquete.
- [x] **Integridad del ZIP** — extracción limpia verificada en una carpeta nueva, sin advertencias ni archivos corruptos.
- [x] **Launchers** — `ABRIR-IMPULSO-MAC-LINUX.command` y `ABRIR-IMPULSO-WINDOWS.bat` revisados: contenido correcto, sin rutas de desarrollo ni referencias internas.
- [x] **Manifest** (`commercial-product.json`) — válido, `buildMetadata.commit` coincide exactamente con el commit del build.
- [x] **`version.json`** — coincide con el manifest (`productVersion`, `buildId`, `commit`).
- [x] **Documentación del comprador** (`docs/` dentro del paquete) — presente completa (7 guías + notas de versión).
- [x] **Archivos legales** (`legal/` dentro del paquete) — presentes completos (licencia de uso, privacidad, licencias de terceros).
- [x] **Higiene del paquete** — verificado que el ZIP NO contiene: archivos fuente (`.ts`/`.tsx`), tests, configuración de desarrollo, secretos, `node_modules`, `.git`, archivos temporales, ni referencias a Claude/Anthropic/el repositorio o el entorno de desarrollo (búsqueda explícita, sin coincidencias reales — los 2 falsos positivos encontrados fueron un flag de campo de formulario "Password" de `pdf-lib` y la palabra "secreto" en prosa normal de un documento para el comprador).

## 4. ZIP final de distribución

Re-generado tras el hito **Brand Integration — THÖREN** (identidad visual integrada, cero cambios de funcionalidad/arquitectura). El ZIP anterior (commit `6e1f02e254cc`, SHA-256 `d0dbbb12e5a899f59b01e818e60543dfa4fa1ec440158167ecab0344bd9b5168`) queda documentado en el historial de este archivo pero ya no es el paquete final vigente.

- [x] **Nombre exacto:** `thoren-sticker-builder-v1.0.0.zip`
- [x] **Tamaño:** 413,480 bytes (~0.39 MB)
- [x] **Fecha de generación:** 2026-07-27T15:58:57.841Z
- [x] **Ruta absoluta:** `/home/user/claude-code/impulso-builder-platform/apps/sticker-builder/dist-commercial/thoren-sticker-builder-v1.0.0.zip`
- [x] **SHA-256:** `cbb49f65cf615b265f9059b1b0cce80836a5eacb4f92a8b6b88851dcdeccee19`
- [x] **Commit exacto del build:** `938bfe2ef83f7d9968bfe0d8960ed26006549b3f`
- [x] **Build ID:** `1.0.0+938bfe2ef83f`

## 5. Documentación del release

- [x] `RELEASE_NOTES_v1.0.0.md` — creado.
- [x] `FINAL_RELEASE_CHECKLIST.md` — este documento.
- [x] `BUYER_VALIDATION_REPORT.md` — creado.
- [x] `KNOWN_LIMITATIONS_v1.0.0.md` — creado.

## 6. Tag de versión

- [x] Tag local `v1.0.0` existe, apuntando a `6e1f02e254cc2be55e9982c73c005788f1d62cdf` (el commit de RC1, previo a Brand Integration).
- [ ] Tag en el remoto — **pendiente**: el push de este tag falló de forma persistente (`HTTP 403`) durante el hito "Resolver el tag remoto de v1.0.0"; reportado en su momento, no reintentado desde entonces.
- [ ] El tag `v1.0.0` **ya no apunta al commit del ZIP vigente** (`938bfe2ef83f7d9968bfe0d8960ed26006549b3f`, post Brand Integration) — divergencia abierta, sin resolver todavía; requiere decisión explícita del propietario del producto (mover el tag vs. dejarlo documentando el estado pre-branding).

## Criterio de cierre — evaluación

| Criterio | Estado |
|---|---|
| Todas las verificaciones pasan | ✅ Sí (typecheck 23/23, unit tests 443/443, E2E Chromium 54/54 — revalidado tras Brand Integration) |
| El paquete final abre correctamente | ✅ Sí (validado por el propietario en su propia máquina; el rebuild post-branding no repite la validación manual en vivo — ver nota abajo) |
| No hay bugs críticos conocidos | ✅ Sí (los 4 encontrados durante RC1 están corregidos y verificados; cero bugs nuevos, Brand Integration es cambio puramente visual) |
| La documentación coincide con el producto | ✅ Sí |
| El ZIP final es exactamente el que se entregará al comprador | ✅ Sí — mismo archivo, mismo SHA-256, generado desde el commit `938bfe2` (no del commit etiquetado — ver sección 6) |

**Nota:** el rebuild de Brand Integration no incluyó una nueva validación manual de comprador en vivo (el cambio es visual/de branding, verificado con typecheck + unit + E2E automatizados, incluida la regresión de contraste del botón de impresión y del foco del diálogo de bienvenida). La validación manual original (`BUYER_VALIDATION_REPORT.md`) sigue siendo la referencia de fondo del producto funcional.

**Versión v1.0.0: APROBADA para publicación, pendiente de autorización explícita del propietario del producto para publicar en Gumroad.**

No se publicó nada en Gumroad. No se inició ninguna otra fase.
