import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

import { IssueTestFolioForm } from "./issue-test-folio-form";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  QUOTATION: "Cotización",
  ORDER: "Pedido",
  CREDIT_NOTE: "Nota de crédito",
  DELIVERY_NOTE: "Remisión",
};

const NUMBERING_MODE_LABELS: Record<string, string> = {
  ANNUAL: "Anual (reinicia en enero)",
  CONTINUOUS: "Continua (nunca reinicia)",
};

export default async function SequencesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    businessUnitId?: string;
    documentType?: string;
    sellerCode?: string;
    issueError?: string;
    issuedFolio?: string;
    issuedShortFolio?: string;
  }>;
}) {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_SEQUENCES)) {
    redirect("/dashboard?error=forbidden");
  }

  const params = await searchParams;

  const [businessUnits, currentUser] = await Promise.all([
    prisma.businessUnit.findMany({
      where: { deletedAt: null },
      include: { sequenceSettings: { orderBy: [{ documentType: "asc" }, { year: "desc" }] } },
      orderBy: { code: "asc" },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Folios y series</h1>
        <p className="text-sm text-zinc-500">
          Módulo 5 — motor de folios (docs/ARCHITECTURE.md §7). El consecutivo de cada línea nunca
          se reutiliza, aunque una cotización se cancele o rechace.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Emitir folio de prueba
        </h2>
        <div className="mt-3">
          <IssueTestFolioForm
            businessUnits={businessUnits}
            defaults={{
              businessUnitId: params.businessUnitId ?? "",
              documentType: params.documentType ?? "QUOTATION",
              sellerCode: params.sellerCode ?? currentUser.folioCode ?? "",
              issueError: params.issueError,
              issuedFolio: params.issuedFolio,
              issuedShortFolio: params.issuedShortFolio,
            }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Consecutivos por línea
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          {businessUnits.map((unit) => (
            <div
              key={unit.id}
              className="rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {unit.code} — {unit.name}
              </p>
              <p className="text-xs text-zinc-500">
                Numeración: {NUMBERING_MODE_LABELS[unit.folioNumberingMode]}
              </p>
              {unit.sequenceSettings.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-400">
                  Sin folios emitidos todavía en esta línea.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {unit.sequenceSettings.map((seq) => (
                    <li key={seq.id}>
                      {DOCUMENT_TYPE_LABELS[seq.documentType]} ·{" "}
                      {seq.year === 0 ? "serie continua" : `año ${seq.year}`} · último consecutivo:{" "}
                      <span className="font-mono font-semibold">{seq.lastConsecutive}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
