# Changelog — @impulso/commercial-schema

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [0.1.0] — Fase 4.1: Commercial Platform Architecture & Product Packaging

### Agregado
- Paquete nuevo, foundation/prototipo de validación arquitectónica (ver ADR-0026, ADR-0027, ADR-0028).
- `CommercialProduct` — tipo + esquema Zod + validadores (`commercialProduct.ts`).
- `ProductManifest` (`commercial-product.json`) — tipo + esquema Zod versionado (`schemaVersion`) + validadores (`productManifest.ts`).
- `Capability`/`CapabilityId`/`CapabilityCheckResult`/`CapabilityProvider` — contrato de "¿puedo usar esto?" (`capability.ts`), sin implementación (interfaz únicamente).
- `Entitlement`/`EntitlementStatus`/`DevicePolicy` — contrato de derecho concedido, diseñado para Fase 4.3, sin emisor/consumidor real todavía (`entitlement.ts`).
- Fixtures reales de ejemplo (`testUtils/fixtures.ts`): un `CommercialProduct` y `ProductManifest` completos para "Sticker Builder Professional", y un `Entitlement` de ejemplo.
- 37 tests, 100% de cobertura (líneas/statements/funciones/branches): round-trip de serialización (`JSON.stringify`/`JSON.parse`/`parse*`) para los 4 tipos, y validación de cada caso inválido relevante (enums, formatos, campos requeridos).

### Fuera de alcance (deliberado, Fase 4.1)
- Ninguna lógica de evaluación de capabilities, ningún emisor/verificador de Entitlement, ningún adaptador de proveedor de comercio (Gumroad, etc.) — ver `docs/platform/COMMERCIAL_PLATFORM_ROADMAP.md` para cuándo se introduce cada uno.
