import "server-only";

import { prisma } from "@/lib/prisma/client";

/**
 * Actor para transiciones disparadas por un proceso automático (cron real),
 * no por una sesión humana. `quotation_status_history.changed_by_id` nunca
 * es opcional, así que se atribuye al Super Admin activo más antiguo — en
 * un sistema con cuentas de servicio dedicadas esto sería una cuenta
 * "sistema" sin login propio; aquí no existe esa cuenta todavía, así que
 * se documenta esta convención explícitamente en vez de fingir que no hace
 * falta un actor.
 */
export async function resolveSystemActorId(): Promise<string> {
  const systemActor = await prisma.user.findFirstOrThrow({
    where: { role: { code: "SUPER_ADMIN" }, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return systemActor.id;
}
