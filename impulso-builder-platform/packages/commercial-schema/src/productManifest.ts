import { z } from "zod";

/**
 * Contrato de datos de commercial-product.json (ver ADR-0027). Formato
 * versionado (schemaVersion, independiente de productVersion) que describe
 * QUÉ es un build/edición concreta — nunca contiene secretos (ninguna clave
 * de API, ninguna credencial, nada usado para validar autenticidad
 * criptográfica de una licencia).
 */
export const PRODUCT_MANIFEST_SCHEMA_VERSION = 1;

export const licensingModeSchema = z.string().min(1);
export type LicensingMode = z.infer<typeof licensingModeSchema>;

export const updateChannelSchema = z.enum(["stable", "beta", "internal"]);
export type UpdateChannel = z.infer<typeof updateChannelSchema>;

export const productManifestSchema = z.object({
  schemaVersion: z.literal(PRODUCT_MANIFEST_SCHEMA_VERSION),
  productId: z.string().min(1),
  productVersion: z.string().min(1),
  edition: z.string().min(1),
  modules: z.array(z.string().min(1)),
  // CapabilityId[] incluidos por defecto en este producto — no implica que
  // estén técnicamente gateados (ver docs/platform/CAPABILITY_MODEL.md).
  capabilities: z.array(z.string().min(1)),
  branding: z.object({
    displayName: z.string().min(1),
    shortName: z.string().min(1),
  }),
  support: z.object({
    email: z.string().email().nullable(),
    docsUrl: z.string().url().nullable(),
  }),
  updateChannel: updateChannelSchema,
  // "delivery-only" en V1 (ver ADR-0028) — string abierto para admitir modos
  // futuros ("license-key", "account-bound") sin romper el schema.
  licensingMode: licensingModeSchema,
  termsReference: z.string().nullable(),
  buildMetadata: z.object({
    builtAt: z.string().datetime().nullable(),
    commit: z.string().nullable(),
  }),
});
export type ProductManifest = z.infer<typeof productManifestSchema>;

export function parseProductManifest(value: unknown): ProductManifest {
  return productManifestSchema.parse(value);
}

export function safeParseProductManifest(
  value: unknown,
): z.SafeParseReturnType<unknown, ProductManifest> {
  return productManifestSchema.safeParse(value);
}
