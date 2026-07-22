# @impulso/commercial-schema

> Contrato de datos de la Commercial Platform, nacido en Fase 4.1 (Commercial Platform Architecture & Product Packaging) tras el cierre de Epic 9. Ver [ADR-0026](../../docs/adr/0026-commercial-platform-boundaries.md), [ADR-0027](../../docs/adr/0027-product-manifest.md) y [ADR-0028](../../docs/adr/0028-entitlements-and-licensing.md).

**Estado:** foundation/prototipo de validación arquitectónica — explícitamente **no** un producto terminado. Define únicamente tipos + esquemas Zod + validadores puros para `CommercialProduct`, `ProductManifest`, `Capability` y `Entitlement`. Sin lógica de evaluación, sin I/O, sin conocimiento de ningún proveedor de comercio (Gumroad, etc.) — esos llegan en paquetes futuros (`@impulso/capabilities`, `@impulso/entitlements`, `@impulso/licensing`, `@impulso/commerce-adapters`, ver Fase 4.2 en adelante).

---

## 1. Qué es y qué no es

- **Sí hace:** tipar y validar (`.parse`/`.safeParse`) los 4 contratos de datos de la capa comercial — el mismo rol que `@impulso/document-schema` cumple para el dominio creativo.
- **No hace:** no evalúa si una capability está concedida, no emite ni valida licencias, no llama a ningún proveedor externo. `CapabilityProvider` es solo una interfaz — su implementación real (empezando por un `OpenCapabilityProvider` que concede todo, ver `docs/platform/CAPABILITY_MODEL.md`) es trabajo de Fase 4.2.
- **Regla dura de dependencia**: ningún paquete del dominio creativo (`document-schema`, `engine`, `renderer-konva`, `asset-library`, `template-library`, `project-library`, `export-engine`, `print-engine`) puede depender de este paquete — la flecha va siempre en un solo sentido (capa comercial → nada del dominio creativo la necesita).

## 2. Por qué existe ya, sin un segundo consumidor real todavía

Es la única excepción documentada al principio "no crear un paquete sin consumidor real" (ver `docs/product/02-Product-Principles.md` y ADR-0026) — permitida explícitamente por el enunciado de Fase 4.1 como "prototipo técnico mínimo... para validar arquitectura". Es deliberadamente pequeño (solo tipos + Zod) para minimizar ese riesgo aceptado.

## 3. Uso

```ts
import {
  parseCommercialProduct,
  parseProductManifest,
  parseEntitlement,
  type CapabilityProvider,
} from "@impulso/commercial-schema";

const product = parseCommercialProduct(rawJson); // lanza si es inválido
const manifestResult = safeParseProductManifest(rawManifestJson); // nunca lanza

const openProvider: CapabilityProvider = {
  has: () => ({ granted: true, reason: "included" }),
};
```

Ver `src/testUtils/fixtures.ts` para ejemplos completos y ejecutables de cada tipo.

## 4. Desarrollo

```bash
pnpm --filter @impulso/commercial-schema build
pnpm --filter @impulso/commercial-schema test
pnpm --filter @impulso/commercial-schema typecheck
```
