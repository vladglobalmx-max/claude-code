import { expireOverdueQuotations } from "@/lib/followups/mutations";
import { resolveSystemActorId } from "@/lib/followups/system-actor";

/**
 * Endpoint pensado para un cron real (Vercel Cron u otro worker programado
 * — ver `docs/ARCHITECTURE.md §3`, "Cron job ligero"). Protegido con un
 * secreto compartido, el mismo patrón que usa Vercel Cron: agrega el
 * header `Authorization: Bearer $CRON_SECRET` a la petición programada.
 * Esta app no tiene un proceso siempre-activo que lo dispare solo — la
 * programación real es responsabilidad de la infraestructura de
 * despliegue, no de este código.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const systemActorId = await resolveSystemActorId();
  const expiredIds = await expireOverdueQuotations(new Date(), systemActorId);

  return Response.json({ expiredCount: expiredIds.length, expiredIds });
}
