import type { CommercialProduct } from "../commercialProduct.js";
import type { Entitlement } from "../entitlement.js";
import { PRODUCT_MANIFEST_SCHEMA_VERSION, type ProductManifest } from "../productManifest.js";

/**
 * Fixtures de ejemplo — documentación ejecutable del formato, usadas por los
 * tests de serialización de este mismo paquete. No representan un producto
 * realmente en venta todavía (Fase 4.1 es diseño/prototipo, no lanzamiento).
 */
export function createStickerBuilderProfessionalFixture(): CommercialProduct {
  return {
    productId: "sticker-builder-professional",
    slug: "sticker-builder",
    name: "Sticker Builder Professional",
    description:
      "Editor de stickers con exportación de producción para imprenta (Print Engine, Epic 9).",
    productType: "single-app",
    includedModules: ["sticker-builder"],
    includedFeatures: [
      "sticker.core",
      "sticker.templates",
      "export.png",
      "export.svg",
      "export.pdf",
      "print.professional",
      "imposition.grid",
    ],
    edition: "professional",
    version: "1.0.0",
    channels: ["gumroad"],
    priceReference: [{ amount: 29, currency: "USD", channel: "gumroad" }],
    entitlementRequirements: {
      featureIds: [
        "sticker.core",
        "sticker.templates",
        "export.png",
        "export.svg",
        "export.pdf",
        "print.professional",
        "imposition.grid",
      ],
    },
    updatePolicy: "included-minor",
    supportPolicy: "email",
    metadata: {},
    lifecycleStatus: "draft",
  };
}

export function createStickerBuilderManifestFixture(): ProductManifest {
  return {
    schemaVersion: PRODUCT_MANIFEST_SCHEMA_VERSION,
    productId: "sticker-builder-professional",
    productVersion: "1.0.0",
    edition: "professional",
    modules: ["sticker-builder"],
    capabilities: [
      "sticker.core",
      "sticker.templates",
      "export.png",
      "export.svg",
      "export.pdf",
      "print.professional",
      "imposition.grid",
    ],
    branding: {
      displayName: "Sticker Builder Professional",
      shortName: "Sticker Builder",
    },
    support: { email: "soporte@example.com", docsUrl: null },
    updateChannel: "stable",
    licensingMode: "delivery-only",
    termsReference: null,
    buildMetadata: { builtAt: null, commit: null },
  };
}

export function createEntitlementFixture(): Entitlement {
  return {
    entitlementId: "entitlement-fixture-0001",
    subjectId: "device-fixture-0001",
    productId: "sticker-builder-professional",
    featureIds: ["print.professional", "imposition.grid"],
    status: "active",
    source: "gumroad",
    issuedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}
