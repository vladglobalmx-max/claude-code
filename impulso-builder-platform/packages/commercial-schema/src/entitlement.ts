import { z } from "zod";

/**
 * Contrato de datos de un Entitlement (ver ADR-0028). En Fase 4.1 este tipo
 * no tiene todavía ningún emisor ni consumidor real — es diseño para
 * Fase 4.3 (Entitlements & Local Activation). No confundir con License:
 * un Entitlement es el DERECHO concedido; una License es el mecanismo
 * técnico que lo demuestra/administra (en V1, ninguno — ver
 * docs/adr/0028-entitlements-and-licensing.md, licensingMode "delivery-only").
 */
export const entitlementStatusSchema = z.enum([
  "active",
  "expired",
  "revoked",
  "suspended",
  "pending",
  "grace-period",
]);
export type EntitlementStatus = z.infer<typeof entitlementStatusSchema>;

export const devicePolicySchema = z.enum([
  "single-device",
  "unlimited",
  "n-devices",
]);
export type DevicePolicy = z.infer<typeof devicePolicySchema>;

export const entitlementSchema = z.object({
  entitlementId: z.string().min(1),
  // deviceId hoy, userId el día que exista una cuenta real — nunca un
  // email en claro (ver LICENSING_THREAT_MODEL.md).
  subjectId: z.string().min(1),
  productId: z.string().min(1),
  featureIds: z.array(z.string().min(1)),
  status: entitlementStatusSchema,
  // ChannelId de origen (ver docs/adr/0029-distribution-strategy.md) — tipado
  // como string abierto, mismo criterio que CapabilityId.
  source: z.string().min(1),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  versionRange: z.string().optional(),
  devicePolicy: devicePolicySchema.optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Entitlement = z.infer<typeof entitlementSchema>;

export function parseEntitlement(value: unknown): Entitlement {
  return entitlementSchema.parse(value);
}

export function safeParseEntitlement(
  value: unknown,
): z.SafeParseReturnType<unknown, Entitlement> {
  return entitlementSchema.safeParse(value);
}
