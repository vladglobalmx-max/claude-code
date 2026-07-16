import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

/**
 * Registro de auditoría (docs/ARCHITECTURE.md §5.2/§10). No es un middleware
 * transparente de Prisma: se llama explícitamente desde cada mutación que
 * toca un campo sensible, con el mismo `actorId` explícito que ya usa el
 * resto del sistema (Módulos 6-8) — evitar una capa de contexto implícito
 * (AsyncLocalStorage) por una que ya sigue el mismo patrón establecido.
 */
export async function recordAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    entityType: string;
    entityId: string;
    userId: string;
    action: AuditAction;
    fieldChanged?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
  },
) {
  await tx.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      action: input.action,
      fieldChanged: input.fieldChanged ?? null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      reason: input.reason ?? null,
    },
  });
}

export type FieldChange = { field: string; oldValue: string | null; newValue: string | null };

/**
 * Compara solo los campos "sensibles" configurados por el llamador (no todo
 * el registro) entre un estado anterior y uno posterior, y reporta los que
 * de verdad cambiaron. Los valores se comparan como string — a los logs de
 * auditoría no les importa el tipo original, solo el antes/después legible.
 */
export function diffSensitiveFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  sensitiveFields: readonly (keyof T & string)[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of sensitiveFields) {
    const oldValue = before[field];
    const newValue = after[field];
    const oldStr = oldValue == null ? null : String(oldValue);
    const newStr = newValue == null ? null : String(newValue);
    if (oldStr !== newStr) {
      changes.push({ field, oldValue: oldStr, newValue: newStr });
    }
  }
  return changes;
}
