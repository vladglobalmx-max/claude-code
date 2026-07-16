import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { quotationScopeWhere } from "@/lib/quotations/scope";
import { computeWeightedAmount, followupBucket, type FollowupBucket } from "@/lib/followups/rules";
import { QUOTATION_STATUS_LABELS } from "@/lib/quotations/status-labels";

const BUCKET_SECTIONS: { bucket: FollowupBucket; title: string; hint: string }[] = [
  { bucket: "OVERDUE", title: "Vencidos", hint: "El seguimiento programado ya pasó." },
  { bucket: "TODAY", title: "Hoy", hint: "Seguimiento programado para hoy." },
  { bucket: "UPCOMING", title: "Próximos", hint: "Seguimiento programado a futuro." },
  { bucket: "NONE", title: "Sin programar", hint: "Enviadas sin un próximo seguimiento capturado." },
  { bucket: "DONE", title: "Completados", hint: "La cotización ya llegó a un estado final." },
];

const currency = (value: number, code: string) =>
  value.toLocaleString("es-MX", { style: "currency", currency: code });

export default async function FollowupsPage() {
  const session = await requireSession();
  const role = session.user.role;

  const userBusinessUnits = await prisma.userBusinessUnit.findMany({
    where: { userId: session.user.id },
    select: { businessUnitId: true },
  });
  const businessUnitIds = userBusinessUnits.map((ubu) => ubu.businessUnitId);
  const where = quotationScopeWhere({ role, userId: session.user.id, businessUnitIds });

  const quotations = where
    ? await prisma.quotation.findMany({
        where: { ...where, OR: [{ status: "SENT" }, { followups: { some: {} } }] },
        include: {
          customer: { select: { legalName: true } },
          seller: { select: { fullName: true } },
          followups: { orderBy: { sentAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const now = new Date();
  const grouped = new Map<FollowupBucket, typeof quotations>();
  for (const quotation of quotations) {
    const latestFollowup = quotation.followups[0];
    const bucket = followupBucket({
      quotationStatus: quotation.status,
      nextFollowupAt: latestFollowup?.nextFollowupAt ?? null,
      now,
    });
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), quotation]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Seguimiento</h1>
        <p className="text-sm text-zinc-500">
          Módulo 11 — ver docs/ARCHITECTURE.md §5.2/§6.1/§9. Cotizaciones enviadas agrupadas por su
          próximo seguimiento.
        </p>
      </div>

      {where === null ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Tu rol no tiene acceso a seguimiento de cotizaciones.
        </div>
      ) : (
        BUCKET_SECTIONS.map(({ bucket, title, hint }) => {
          const items = grouped.get(bucket) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={bucket}>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {title} ({items.length})
              </h2>
              <p className="mb-2 text-xs text-zinc-500">{hint}</p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-2">Folio</th>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Vendedor</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Ponderado</th>
                      <th className="px-4 py-2">Próximo seguimiento</th>
                      <th className="px-4 py-2">Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((quotation) => {
                      const latestFollowup = quotation.followups[0];
                      const weighted = computeWeightedAmount(
                        quotation.total,
                        latestFollowup?.closeProbabilityPct ?? null,
                      );
                      return (
                        <tr
                          key={quotation.id}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                        >
                          <td className="px-4 py-2">
                            <Link
                              href={`/quotations/${quotation.id}`}
                              className="font-mono text-xs font-semibold hover:underline"
                            >
                              {quotation.folio}
                            </Link>
                          </td>
                          <td className="px-4 py-2">{quotation.customer.legalName}</td>
                          <td className="px-4 py-2 text-zinc-500">{quotation.seller.fullName}</td>
                          <td className="px-4 py-2">{currency(quotation.total.toNumber(), quotation.currency)}</td>
                          <td className="px-4 py-2 text-zinc-500">
                            {weighted != null ? currency(weighted.toNumber(), quotation.currency) : "—"}
                          </td>
                          <td className="px-4 py-2 text-xs text-zinc-500">
                            {latestFollowup?.nextFollowupAt
                              ? latestFollowup.nextFollowupAt.toLocaleDateString("es-MX")
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-xs">{QUOTATION_STATUS_LABELS[quotation.status]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
