import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { PERMISSIONS, hasPermission } from "@/lib/auth/permissions";

const NUMBERING_LABELS: Record<string, string> = {
  ANNUAL: "Anual",
  CONTINUOUS: "Continua",
};

export default async function BusinessUnitsPage() {
  const session = await requireSession();
  if (!hasPermission(session.user.role, PERMISSIONS.CONFIGURE_BUSINESS_UNITS)) {
    redirect("/dashboard?error=forbidden");
  }

  const businessUnits = await prisma.businessUnit.findMany({
    where: { deletedAt: null },
    orderBy: { code: "asc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Líneas de negocio</h1>
          <p className="text-sm text-zinc-500">
            Módulo 2 — ver docs/ARCHITECTURE.md §5.2/§10. Todo módulo posterior filtra por línea.
          </p>
        </div>
        <Link
          href="/admin/business-units/new"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Nueva línea
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Numeración de folios</th>
              <th className="px-4 py-2">Estatus</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {businessUnits.map((bu) => (
              <tr key={bu.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-4 py-2 font-mono font-semibold">{bu.code}</td>
                <td className="px-4 py-2">{bu.name}</td>
                <td className="px-4 py-2">{NUMBERING_LABELS[bu.folioNumberingMode] ?? bu.folioNumberingMode}</td>
                <td className="px-4 py-2">
                  {bu.active ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Activa</span>
                  ) : (
                    <span className="text-zinc-400">Inactiva</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/admin/business-units/${bu.id}`} className="text-sm hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
