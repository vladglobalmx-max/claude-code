import "server-only";

import { prisma } from "@/lib/prisma/client";
import type { ContactMethod } from "@/generated/prisma/enums";
import { isQuotationExpired } from "@/lib/followups/rules";

export class FollowupMutationError extends Error {}

/**
 * Registra un seguimiento (docs/ARCHITECTURE.md §5.2). Solo tiene sentido
 * sobre una cotización enviada y todavía viva — no sobre un borrador (no
 * hay nada que seguir) ni sobre una ya cerrada (aceptada/rechazada/
 * cancelada/vencida/convertida).
 */
export async function addFollowup(input: {
  quotationId: string;
  ownerId: string;
  contactMethod: ContactMethod;
  nextFollowupAt: Date | null;
  closeProbabilityPct: number | null;
  competitor: string | null;
  objection: string | null;
  comments: string | null;
}) {
  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: input.quotationId } });
  if (quotation.status !== "SENT") {
    throw new FollowupMutationError(
      "Solo se puede dar seguimiento a una cotización enviada y todavía vigente.",
    );
  }

  return prisma.quotationFollowup.create({
    data: {
      quotationId: input.quotationId,
      ownerId: input.ownerId,
      contactMethod: input.contactMethod,
      nextFollowupAt: input.nextFollowupAt,
      closeProbabilityPct: input.closeProbabilityPct,
      competitor: input.competitor,
      objection: input.objection,
      comments: input.comments,
    },
  });
}

/**
 * Vencimiento automático (docs/ARCHITECTURE.md §6.1/§10, Módulo 11): pensado
 * para invocarse desde un cron real (Vercel Cron u otro worker programado,
 * ver `docs/ARCHITECTURE.md §3` — no hay un proceso siempre-activo en esta
 * app que lo dispare solo). `/api/cron/expire-quotations` expone esta
 * función para ese propósito; `/admin/followups` la expone también para
 * disparo manual/diagnóstico, igual que Módulo 5 hizo con la emisión de
 * folios de prueba antes de que existieran cotizaciones reales.
 *
 * `quotation_status_history.changed_by_id` nunca es opcional en este
 * esquema (todo cambio de estado tiene un actor humano atribuible) — un
 * disparo por cron real no tiene sesión, así que quien la invoque debe
 * resolver un actor "sistema" explícito (ver `system-actor.ts`) en vez de
 * debilitar esa columna a nullable para todo el resto del sistema.
 */
export async function expireOverdueQuotations(now: Date, actorId: string) {
  const candidates = await prisma.quotation.findMany({
    where: { status: "SENT", validUntil: { not: null } },
    select: { id: true, validUntil: true },
  });
  const overdue = candidates.filter((q) => isQuotationExpired({ status: "SENT", validUntil: q.validUntil, now }));

  return prisma.$transaction(async (tx) => {
    for (const quotation of overdue) {
      await tx.quotation.update({ where: { id: quotation.id }, data: { status: "EXPIRED" } });
      await tx.quotationStatusHistory.create({
        data: {
          quotationId: quotation.id,
          fromStatus: "SENT",
          toStatus: "EXPIRED",
          changedById: actorId,
          note: "Vencimiento automático (Módulo 11): now() > valid_until.",
        },
      });
    }
    return overdue.map((q) => q.id);
  });
}
