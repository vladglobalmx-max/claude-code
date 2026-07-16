import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";
import { isQuotationExpired } from "@/lib/followups/rules";

import { runExpirationAction } from "./actions";

export default async function FollowupExpirationAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_SEQUENCES)) {
    redirect("/dashboard?error=forbidden");
  }

  const { expired } = await searchParams;

  const now = new Date();
  const candidates = await prisma.quotation.findMany({
    where: { status: "SENT", validUntil: { not: null } },
    select: { id: true, folio: true, validUntil: true },
  });
  const overdue = candidates.filter((q) => isQuotationExpired({ status: "SENT", validUntil: q.validUntil, now }));

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Vencimiento automático</h1>
        <p className="text-sm text-zinc-500">
          Módulo 11 — ver docs/ARCHITECTURE.md §6.1/§10. En producción esto lo dispara un cron real
          contra <code>/api/cron/expire-quotations</code>; aquí se puede correr a mano para
          diagnóstico, igual que la emisión de folios de prueba (Módulo 5).
        </p>
      </div>

      {expired != null ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Se vencieron {expired} cotización(es) en la última ejecución.
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {overdue.length === 0
            ? "No hay cotizaciones enviadas con vigencia vencida en este momento."
            : `${overdue.length} cotización(es) enviada(s) ya pasaron su vigencia y quedarían "Vencida" al ejecutar la tarea:`}
        </p>
        {overdue.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-500">
            {overdue.map((q) => (
              <li key={q.id} className="font-mono">
                {q.folio} — vigente hasta {q.validUntil?.toLocaleDateString("es-MX")}
              </li>
            ))}
          </ul>
        ) : null}

        <form action={runExpirationAction} className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Ejecutar vencimiento ahora
          </button>
        </form>
      </div>
    </div>
  );
}
