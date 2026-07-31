> **Documento archivado (Consolidación documental THÖREN, 2026-07-31).** Este documento formaba parte del lanzamiento comercial independiente de Sticker Builder v1.0.0 (RC1/Gumroad) — ese lanzamiento no ocurrirá bajo esta forma tras `THOREN_PRODUCT_DIRECTION.md` (escenario D). Se conserva íntegro como evidencia de un proceso de release real, disciplinado y verificado — reutilizable como referencia si THÖREN necesita empaquetarse comercialmente en el futuro, pero no es una fuente activa. Ver [`../../product/THOREN_STICKER_BUILDER_COMPONENT.md`](../../product/THOREN_STICKER_BUILDER_COMPONENT.md) para lo que sigue vigente como capacidad técnica interna, y [`../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md`](../../product/THOREN_DOCUMENT_STRUCTURE_v1.0.md) para el mapa completo de la consolidación.

# Commercial Product Model — Fase 4.1

> Complementa [ADR-0026](../adr/0026-commercial-platform-boundaries.md) y [ADR-0027](../adr/0027-product-manifest.md). Este documento es la referencia de campo-por-campo del modelo `CommercialProduct`, y la distinción formal Module/Feature/Commercial Product/Entitlement/License/Channel. El tipo y su esquema Zod viven en `packages/commercial-schema/src/commercialProduct.ts` (prototipo de esta fase).

## Boundaries — definiciones formales

| Concepto | Qué es | Ejemplo | Vive en |
|---|---|---|---|
| **Module** | Capacidad funcional principal y autocontenida — corresponde a un Builder completo | `sticker-builder` | Una app en `apps/*` |
| **Feature** | Capacidad habilitable con un identificador de namespace punteado | `print.professional`, `export.pdf`, `imposition.grid` | Un `CapabilityId` (`CAPABILITY_MODEL.md`), no necesariamente un paquete 1:1 |
| **Commercial Product** | Paquete vendible que agrupa uno o varios Modules/Features bajo una identidad comercial | "Sticker Builder Professional" | `CommercialProduct` (este documento) |
| **Entitlement** | Derecho concedido a un sujeto de usar un conjunto de Features | Compra #12345 → acceso a `print.professional` | `Entitlement` (ADR-0028) |
| **License** | Mecanismo técnico que demuestra/administra un Entitlement | En V1: ninguno (entrega controlada). Futuro: clave/token | ADR-0028 |
| **Channel** | Origen comercial de una venta o concesión | `gumroad`, `bookfluence`, `direct`, `internal`, `promotional` | `ChannelId` (ADR-0029) |

**Regla dura**: código de Builder nunca compara contra un `productId` ni un `channel`. Solo pregunta si una `Feature` está permitida (capa 4, Capabilities). Esto es lo que permite que "Sticker Builder Standard" y "Sticker Builder Professional" sean el **mismo build**, diferenciados únicamente por qué `CommercialProduct`/manifest los describe — nunca por una bifurcación de código.

## `CommercialProduct` — campos

```ts
interface CommercialProduct {
  productId: string;               // identificador estable interno, ej. "sticker-builder-professional"
  slug: string;                    // slug de marketing/URL, ej. "sticker-builder"
  name: string;                    // nombre comercial visible
  description: string;
  productType: "single-app" | "bundle" | "asset-pack" | "template-pack";
  includedModules: string[];       // ModuleId[] — qué Builders incluye
  includedFeatures: string[];      // CapabilityId[] — qué Features incluye
  edition: "standard" | "professional" | "bundle" | "internal";
  version: string;                 // semver del PRODUCTO comercial — independiente de la versión de código de cada paquete
  channels: string[];              // ChannelId[] — dónde se vende hoy
  priceReference?: {
    amount: number;
    currency: string;              // ISO 4217, ej. "USD" / "MXN"
    channel: string;               // ChannelId
  }[];
  entitlementRequirements: {
    featureIds: string[];          // qué debe estar concedido para desbloquear TODO el producto
  };
  updatePolicy: "included-minor" | "included-all" | "paid-major" | "time-limited";
  supportPolicy: "community" | "email" | "priority";
  metadata: Record<string, unknown>;
  lifecycleStatus: "draft" | "active" | "deprecated" | "retired";
}
```

### Notas por campo
- **`version` vs. las versiones de paquete**: `CommercialProduct.version` es la versión del *producto vendido* (ej. "1.0.0" para el primer release comercial de Sticker Builder Professional). Es independiente de que `@impulso/print-engine` esté en 0.5.0 o `apps/sticker-builder` en 0.16.0 — esos son versiones de *código*, no de *producto vendido*. Un mismo `productVersion` puede corresponder a distintas combinaciones de versiones de paquete a lo largo del tiempo (parches internos que no cambian lo que el comprador percibe).
- **`priceReference` es solo informativo, nunca autoritativo**: el precio real de cobro vive en el canal (Gumroad, etc.) — este campo existe para que la documentación/catálogo interno tenga un valor de referencia, no para que ningún código de THÖREN calcule o aplique un cobro. Duplicar el precio aquí y dejarlo desactualizado respecto al canal real es un riesgo aceptado de mantenimiento manual, no un bug de arquitectura.
- **`entitlementRequirements.featureIds` vs. `includedFeatures`**: `includedFeatures` es catálogo/marketing ("qué trae este producto"); `entitlementRequirements.featureIds` es lo que la capa de Capabilities (4) realmente necesita ver concedido para desbloquear el producto — en V1 son idénticos por definición (todo lo que el producto anuncia, lo concede), pero se modelan separados desde ahora para no reñir el schema cuando un futuro producto incluya una feature marketing-only (ej. "acceso anticipado a novedades") que no corresponde a ningún `CapabilityId` técnico.
- **`updatePolicy`**: ver `V1_COMMERCIAL_RECOMMENDATION.md` para la política elegida para V1 (`included-minor`: actualizaciones menores incluidas indefinidamente con la compra, mayores a evaluar).
- **`lifecycleStatus`**: permite retirar un producto del catálogo (`retired`) sin borrar el registro histórico — importante para compradores existentes que necesiten reinstalar/recuperar una versión de un producto ya descontinuado.

## Tipos de producto comercializable (sección 2)

Ejemplos concretos evaluados para este modelo (ninguno implica compromiso de construirlos, solo que el modelo los admite sin cambios):
- **App individual**: Sticker Builder (única app real hoy).
- **Bundle**: "THÖREN Creator Bundle" (Sticker Builder + un segundo Builder futuro) — `productType: "bundle"`, `includedModules` con 2+ entradas.
- **Ediciones especializadas**: "Sticker Builder — Internal Global Supplier Edition" — `edition: "internal"`, mismo código, manifest distinto.
- **Templates premium / asset packs**: `productType: "template-pack"`/`"asset-pack"` — no incluyen ningún `Module` (no son un Builder), solo contenido consumido por un Module ya poseído; su `entitlementRequirements` podría exigir poseer el Module base como precondición (a diseñar en Fase 4.2+, no resuelto aquí).

## Paquetes propuestos — recomendación final (sección 21)

| Paquete | Decisión en 4.1 | Justificación |
|---|---|---|
| `@impulso/commercial-schema` | **Creado** (0.1.0) | Boundary real (contrato de datos comercial), consumidor identificado (esta fase + futuras), independencia útil (cero I/O) |
| `@impulso/capabilities` | Diferido a Fase 4.2 | Sin consumidor real todavía (nada gatea capabilities hoy) |
| `@impulso/entitlements` | Diferido a Fase 4.3 | Sin emisor/consumidor real todavía |
| `@impulso/licensing` | Diferido a Fase 4.3 | Depende de que `entitlements` exista primero |
| `@impulso/product-manifest` | No se crea como paquete separado — su schema vive dentro de `commercial-schema` | Es solo tipos+validación hoy; se separaría solo si Fase 4.2 demuestra lógica propia no-trivial |
| `@impulso/commerce-adapters` | Diferido a Fase 4.4 | Depende de que exista una integración real (Gumroad) que adaptar |
