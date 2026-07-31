# @impulso/capabilities

> Capa 4 de la arquitectura comercial (ver [ADR-0026](../../docs/archive/adr-commercial/0026-commercial-platform-boundaries.md), archivado tras `THOREN_PRODUCT_DIRECTION.md` — el motor sigue vigente como componente interno, ver `docs/product/THOREN_STICKER_BUILDER_COMPONENT.md`). Nace en Fase 4.2 (Commercial MVP) como el primer `CapabilityProvider` REAL — hasta esta fase, `CapabilityProvider` era solo una interfaz en `@impulso/commercial-schema`, sin ninguna implementación.

**Estado:** primera versión, conectada a `apps/sticker-builder`. Sin backend, sin llamadas remotas — evalúa un manifest ya leído (import estático en build o inyectado en tests), nunca hace `fetch` por su cuenta.

---

## 1. Qué es y qué no es

- **Sí hace:** dado un `ProductManifest` ya validado, decide si una `CapabilityId` está concedida (`createManifestCapabilityProvider`); provee el default seguro "conceder todo" (`createOpenCapabilityProvider`) exigido por ADR-0026 para que introducir este modelo nunca pueda bloquear a un usuario existente; orquesta la política de fallo del manifest (`loadCapabilityProvider`) — inválido nunca es silencioso, siempre trae `diagnostics`.
- **No hace:** no lee el manifest desde disco/red (eso es responsabilidad de quien lo importa, ver `apps/sticker-builder/src/commercialManifest.ts`), no conoce Gumroad ni ningún proveedor, no emite ni valida `Entitlement` (eso es `@impulso/entitlements`, Fase 4.3, todavía no construido).

## 2. Uso

```ts
import { loadCapabilityProvider } from "@impulso/capabilities";
import manifestJson from "../commercial-product.json";

const { provider, manifest, diagnostics } = loadCapabilityProvider(manifestJson);
if (diagnostics.length > 0) {
  console.warn("[commercial] Manifest inválido, cayendo a acceso abierto:", diagnostics);
}

if (provider.has("print.professional").granted) {
  // mostrar la opción de exportación de producción
}
```

## 3. Desarrollo

```bash
pnpm --filter @impulso/capabilities build
pnpm --filter @impulso/capabilities test
pnpm --filter @impulso/capabilities typecheck
```
