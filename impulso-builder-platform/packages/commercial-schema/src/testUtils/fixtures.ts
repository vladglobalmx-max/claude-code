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
    productId: "impulso-sticker-builder",
    slug: "sticker-builder",
    name: "Impulso Sticker Builder Professional",
    description:
      "Editor de stickers con exportación de producción para imprenta (Print Engine, Epic 9).",
    productType: "single-app",
    includedModules: ["sticker-builder"],
    includedFeatures: [
      "sticker.core",
      "sticker.asset-library",
      "sticker.templates",
      "export.png",
      "export.svg",
      "print.professional",
      "print.pdf",
      "print.imposition",
      "print.cut-paths",
      "print.crop-marks",
      "print.preflight",
      "storage.local",
      "commercial-use",
    ],
    edition: "professional",
    version: "1.0.0",
    channels: ["gumroad"],
    priceReference: [{ amount: 29, currency: "USD", channel: "gumroad" }],
    entitlementRequirements: {
      featureIds: [
        "sticker.core",
        "sticker.asset-library",
        "sticker.templates",
        "export.png",
        "export.svg",
        "print.professional",
        "print.pdf",
        "print.imposition",
        "print.cut-paths",
        "print.crop-marks",
        "print.preflight",
        "storage.local",
        "commercial-use",
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
    productId: "impulso-sticker-builder",
    slug: "sticker-builder",
    productVersion: "1.0.0",
    edition: "professional",
    modules: ["sticker-builder"],
    capabilities: [
      "sticker.core",
      "sticker.asset-library",
      "sticker.templates",
      "export.png",
      "export.svg",
      "print.professional",
      "print.pdf",
      "print.imposition",
      "print.cut-paths",
      "print.crop-marks",
      "print.preflight",
      "storage.local",
      "commercial-use",
    ],
    branding: {
      displayName: "Impulso Sticker Builder Professional",
      shortName: "Impulso Sticker Builder",
    },
    support: { email: "soporte@example.com", docsUrl: null },
    updateChannel: "stable",
    licensingMode: "delivery-only",
    channel: "gumroad",
    termsReference: null,
    legal: { eulaPath: null, privacyPath: null, thirdPartyLicensesPath: null },
    buildMetadata: { builtAt: null, commit: null, buildId: null },
    releaseMetadata: { releaseDate: null, releaseNotesPath: null },
  };
}

export function createEntitlementFixture(): Entitlement {
  return {
    entitlementId: "entitlement-fixture-0001",
    subjectId: "device-fixture-0001",
    productId: "impulso-sticker-builder",
    featureIds: ["print.professional", "print.imposition"],
    status: "active",
    source: "gumroad",
    issuedAt: "2026-01-01T00:00:00.000Z",
    metadata: {},
  };
}
