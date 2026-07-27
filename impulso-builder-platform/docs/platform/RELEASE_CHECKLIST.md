# Release Checklist — THÖREN Sticker Builder (Fase 4.2)

Checklist técnico para cortar una nueva versión del producto comercial. Para el checklist específico de la publicación en Gumroad (copy, precio, listado), ver `GUMROAD_LAUNCH_PLAN.md`.

## Antes de tocar el manifest

- [ ] `git status` limpio en la rama que se va a publicar (sin cambios sin commitear) — el `buildId` del paquete debe reflejar exactamente un commit real.
- [ ] Verificación completa del monorepo: `pnpm typecheck`, `pnpm test` (todos los paquetes), `pnpm test:e2e` en `apps/sticker-builder` — los tres en verde.
- [ ] Si cambió algo funcional desde la última versión: `docs/NOTAS-DE-VERSION.md` (en `commercial-assets/docs/`) tiene una entrada nueva describiendo qué cambió, en el mismo tono que la v1.0.0 (honesto, sin jerga técnica).

## Bump de versión

- [ ] `commercial-product.json` → `productVersion` actualizado (semver: patch para fixes, minor para funciones nuevas compatibles, major para cambios incompatibles de cara al comprador).
- [ ] `pnpm validate:manifest` pasa con el nuevo `productVersion`.

## Build y verificación del paquete

- [ ] `pnpm build:commercial` corre limpio (los 5 pasos, sin fallar el escaneo de higiene).
- [ ] Confirmar `dist-commercial/CHECKSUMS.sha256` existe y corresponde al `.zip` generado.
- [ ] Verificación de reproducibilidad si se tocó `vite.commercial.config.ts` o cualquier dependencia: correr `build:commercial` dos veces, comparar `assets/main-*.js` (mismo nombre de archivo + mismo SHA-256 esperado) — ver `COMMERCIAL_SECURITY_CHECKLIST.md`, sección 7.
- [ ] Prueba de recorrido completo (task 201 / `docs/ux-audits/0010-*.md`) contra el `.zip` real (descomprimido en una carpeta limpia, launcher real, navegador real) — no contra `vite preview` ni `vite dev`.

## Documentación

- [ ] `apps/sticker-builder/CHANGELOG.md` tiene una entrada nueva.
- [ ] Si cambió algo que afecta al comprador (nueva función, requisito nuevo, limitación resuelta): actualizar la guía correspondiente en `commercial-assets/docs/`.
- [ ] Si cambió el manifest o el `CapabilityProvider`: actualizar `PRODUCT_MANIFEST_GUIDE.md`/`CAPABILITY_PROVIDER_GUIDE.md`.

## Publicación

- [ ] Seguir el checklist de `GUMROAD_LAUNCH_PLAN.md` sección 4.

## Post-publicación

- [ ] Confirmar con una compra/descarga de prueba real que el archivo descargado desde Gumroad coincide en checksum con `CHECKSUMS.sha256` del build local.
- [ ] Archivar (fuera del repo, o en un release de git si se decide etiquetar) el `.zip` publicado + su checksum, para poder atender un ticket de soporte contra la versión exacta que un comprador tiene.
