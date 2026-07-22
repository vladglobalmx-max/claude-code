import { z } from "zod";

/**
 * Contrato de datos de un CommercialProduct (ver ADR-0026 y
 * docs/platform/COMMERCIAL_PRODUCT_MODEL.md). Describe un paquete vendible
 * — nunca lógica de precio/cobro real (priceReference es solo informativo,
 * la fuente de verdad de cobro vive en el canal/proveedor de pagos).
 */
export const productTypeSchema = z.enum([
  "single-app",
  "bundle",
  "asset-pack",
  "template-pack",
]);
export type ProductType = z.infer<typeof productTypeSchema>;

export const productEditionSchema = z.enum([
  "standard",
  "professional",
  "bundle",
  "internal",
]);
export type ProductEdition = z.infer<typeof productEditionSchema>;

export const updatePolicySchema = z.enum([
  "included-minor",
  "included-all",
  "paid-major",
  "time-limited",
]);
export type UpdatePolicy = z.infer<typeof updatePolicySchema>;

export const supportPolicySchema = z.enum(["community", "email", "priority"]);
export type SupportPolicy = z.infer<typeof supportPolicySchema>;

export const lifecycleStatusSchema = z.enum([
  "draft",
  "active",
  "deprecated",
  "retired",
]);
export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>;

export const priceReferenceSchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3), // ISO 4217, ej. "USD"/"MXN"
  channel: z.string().min(1),
});
export type PriceReference = z.infer<typeof priceReferenceSchema>;

export const commercialProductSchema = z.object({
  productId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  productType: productTypeSchema,
  includedModules: z.array(z.string().min(1)),
  includedFeatures: z.array(z.string().min(1)),
  edition: productEditionSchema,
  version: z.string().min(1), // semver del producto comercial, no del código
  channels: z.array(z.string().min(1)),
  priceReference: z.array(priceReferenceSchema).optional(),
  entitlementRequirements: z.object({
    featureIds: z.array(z.string().min(1)),
  }),
  updatePolicy: updatePolicySchema,
  supportPolicy: supportPolicySchema,
  metadata: z.record(z.unknown()).default({}),
  lifecycleStatus: lifecycleStatusSchema,
});
export type CommercialProduct = z.infer<typeof commercialProductSchema>;

export function parseCommercialProduct(value: unknown): CommercialProduct {
  return commercialProductSchema.parse(value);
}

export function safeParseCommercialProduct(
  value: unknown,
): z.SafeParseReturnType<unknown, CommercialProduct> {
  return commercialProductSchema.safeParse(value);
}
