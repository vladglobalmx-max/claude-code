import { z } from "zod";

/**
 * Un CapabilityId es un namespace punteado abierto (ej. "print.professional"),
 * nunca un enum cerrado — agregar una Feature nueva no debe requerir un
 * cambio de tipo en este paquete. Ver docs/platform/CAPABILITY_MODEL.md
 * para el catálogo de referencia (documental, no impuesto por el sistema
 * de tipos).
 */
export const capabilityIdSchema = z.string().min(1);
export type CapabilityId = z.infer<typeof capabilityIdSchema>;

export const capabilityCheckReasonSchema = z.enum([
  "included",
  "not-entitled",
  "expired",
  "unknown",
]);
export type CapabilityCheckReason = z.infer<typeof capabilityCheckReasonSchema>;

export const capabilityCheckResultSchema = z.object({
  granted: z.boolean(),
  reason: capabilityCheckReasonSchema,
});
export type CapabilityCheckResult = z.infer<typeof capabilityCheckResultSchema>;

/**
 * Contrato que un Builder consulta — nunca precio ni canal. La primera
 * implementación real (Fase 4.2) debe incluir un CapabilityProvider por
 * defecto que concede todo, reproduciendo el comportamiento actual (todo
 * siempre activo) para que introducir este modelo no pueda, por sí solo,
 * bloquear a ningún usuario. Ver ADR-0026 y CAPABILITY_MODEL.md.
 */
export interface CapabilityProvider {
  has(capabilityId: CapabilityId): CapabilityCheckResult;
}

export function parseCapabilityId(value: unknown): CapabilityId {
  return capabilityIdSchema.parse(value);
}

export function safeParseCapabilityId(
  value: unknown,
): z.SafeParseReturnType<unknown, CapabilityId> {
  return capabilityIdSchema.safeParse(value);
}
